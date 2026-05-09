const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
].filter(Boolean);

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
}

const CHROME = findChrome();
const DEBUG_PORT = 9222;
const FRONTEND_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}/`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Timeout while waiting for ${label}`);
}

async function httpJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function httpOk(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function startServer(command, args, options, healthUrl, label) {
  if (await httpOk(healthUrl)) return null;
  const proc = spawn(command, args, { stdio: 'ignore', ...options });
  await waitFor(() => httpOk(healthUrl), 15000, label);
  return proc;
}

async function main() {
  if (!CHROME) {
    console.log(JSON.stringify({
      skipped: true,
      reason: 'Chrome/Chromium executable not found. Set CHROME_PATH to enable the smoke test.',
      tried: CHROME_CANDIDATES,
    }, null, 2));
    return;
  }
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deutsch-smoke-'));
  const frontendServer = await startServer(
    'python',
    ['-m', 'http.server', String(FRONTEND_PORT), '--bind', '127.0.0.1'],
    { cwd: __dirname },
    `${BASE_URL}index.html`,
    'frontend server'
  );
  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const cleanup = () => {
    if (!chrome.killed) chrome.kill();
    if (frontendServer && !frontendServer.killed) frontendServer.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  };

  try {
    const version = await waitFor(
      () => httpJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`),
      10000,
      'chrome devtools'
    );
    const browserWsUrl = version.webSocketDebuggerUrl;
    const browserWs = new WebSocket(browserWsUrl);
    await new Promise((resolve, reject) => {
      browserWs.onopen = resolve;
      browserWs.onerror = reject;
    });

    let msgId = 0;
    const pending = new Map();

    browserWs.onmessage = (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    };

    function browserCmd(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        browserWs.send(JSON.stringify({ id, method, params }));
      });
    }

    const { targetId } = await browserCmd('Target.createTarget', { url: BASE_URL });
    const targets = await waitFor(
      async () => {
        const list = await httpJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        return list.find((item) => item.id === targetId);
      },
      10000,
      'page target'
    );

    const pageWs = new WebSocket(targets.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      pageWs.onopen = resolve;
      pageWs.onerror = reject;
    });

    let pageMsgId = 0;
    const pagePending = new Map();
    const events = [];
    const consoleMessages = [];

    pageWs.onmessage = (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id && pagePending.has(message.id)) {
        const { resolve, reject } = pagePending.get(message.id);
        pagePending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      events.push(message);
      if (message.method === 'Runtime.consoleAPICalled') {
        consoleMessages.push(
          message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')
        );
      }
    };

    function pageCmd(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++pageMsgId;
        pagePending.set(id, { resolve, reject });
        pageWs.send(JSON.stringify({ id, method, params }));
      });
    }

    await pageCmd('Page.enable');
    await pageCmd('Runtime.enable');
    await pageCmd('Log.enable');
    await pageCmd('Console.enable').catch(() => null);

    await waitFor(
      async () => events.some((event) => event.method === 'Page.loadEventFired'),
      10000,
      'initial page load'
    );

    const evalJs = async (expression) => {
      const result = await pageCmd('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
        throw new Error(description);
      }
      return result.result?.value;
    };

    await evalJs(`
      window.__smokeErrors = [];
      window.addEventListener('error', (e) => window.__smokeErrors.push(String(e.message || e.error)));
      window.addEventListener('unhandledrejection', (e) => window.__smokeErrors.push('unhandled:' + String(e.reason)));
      true;
    `);

    await evalJs(`
      localStorage.removeItem('daz3');
      location.reload();
      true;
    `);
    await waitFor(
      () => evalJs(`!!document.getElementById('nameInput')`),
      10000,
      'onboarding form after reload'
    );

    await evalJs(`
      (async () => {
        document.getElementById('nameInput').value = 'Smoke';
        obNext(2);
        document.getElementById('sc-it').click();
        obNext(3);
        startLevelTest();
        for (let i = 0; i < 10; i += 1) {
          answerLT(ltSession[ltIdx].a);
          ltNextQ();
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        getReadingForCurrentLevel().questions.forEach((question, index) => selectReadingAnswer(index, question.a));
        ltNextQ();
        ltNextQ();
        document.getElementById('ltWriting').value = 'Ich arbeite heute an einem Projekt, und ich habe mehrere Aufgaben erledigt. Wir testen die Anwendung und sprechen über Probleme. Danach schreibe ich einen Bericht.';
        ltNextQ();
        ltNextQ();
        finishOnboarding();
        return true;
      })();
    `);
    await sleep(1000);

    const dashboardState = await evalJs(`({
      onboardingDone: S.onboardingDone,
      header: !!document.getElementById('appHdr'),
      lessons: document.getElementById('kpi-lessons').textContent
    })`);

    await evalJs(`
      goPage('plan');
      openLesson(GENERAL_LESSONS[0]);
      QS.phase='quiz';
      QS.idx=0;
      QS.score=0;
      QS.answered=false;
      renderModal();
      for (const q of QS.lesson.quiz) { answerQ(q.a); nextQ(); }
      true;
    `);
    await sleep(500);

    const lessonState = await evalJs(`({
      completed: S.completedLessons.includes('g1'),
      points: S.points
    })`);

    await evalJs(`
      goPage('homework');
      toggleHWAns('hw1');
      document.getElementById('hwtxt-hw1').value = 'Ich bin Smoke. Ich komme aus Pakistan.';
      true;
    `);
    await evalJs(`submitHW('hw1')`);
    await sleep(1000);

    const hwState = await evalJs(`({
      done: !!S.hwDone.hw1,
      answerSaved: !!S.hwAnswers.hw1
    })`);

    await evalJs(`
      goPage('login');
      true;
    `);
    await sleep(300);

    const loginState = await evalJs(`({
      staticMode: S.staticMode === true,
      noApiUrl: !S.apiUrl,
      token: !!S.token,
      profileVisible: document.getElementById('loginProfile').style.display !== 'none',
      exportVisible: !!document.querySelector('[onclick="exportProgress()"]')
    })`);

    await evalJs(`
      goPage('practice');
      true;
    `);
    await sleep(300);

    const aiState = await evalJs(`({
      disabledMessage: document.getElementById('scenarioGrid').textContent.includes('AI-практика отключена'),
      scenarioCards: document.querySelectorAll('#scenarioGrid .pr-card').length
    })`);

    await evalJs(`
      goPage('repetition');
      if (REP.words.length > 0) { flipCard(); repAnswer(true); }
      true;
    `);
    await sleep(500);

    const repetitionState = await evalJs(`({
      wordsLoaded: REP.words.length,
      vocabProgressKeys: Object.keys(S.vocabProgress).length
    })`);

    await pageCmd('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await pageCmd('Emulation.setTouchEmulationEnabled', { enabled: true });
    await evalJs(`window.dispatchEvent(new Event('resize')); goPage('dashboard'); true;`);
    await sleep(500);

    const mobileState = await evalJs(`
      (async () => {
        const wait = () => new Promise((resolve) => setTimeout(resolve, 90));
        const waitSheet = () => new Promise((resolve) => setTimeout(resolve, 360));
        const activePage = () => document.querySelector('.page.on')?.id?.replace(/^page-/, '') || '';
        const isVisible = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const hitTarget = (el) => {
          if (!isVisible(el)) return false;
          const rect = el.getBoundingClientRect();
          const x = Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
          const y = Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
          const top = document.elementFromPoint(x, y);
          return top === el || el.contains(top);
        };
        const activeSection = () => document.querySelector('#mobile-tabbar .tab-btn.active')?.dataset.section || '';
        const tabbar = document.getElementById('mobile-tabbar');
        const more = document.querySelector('#mobile-tabbar .tab-btn[data-section="more"]');
        const menu = document.getElementById('more-menu');
        const checks = [];

        for (const [section, expected] of [
          ['home', 'dashboard'],
          ['plan', 'plan'],
          ['reading', 'reading'],
          ['vocabulary', 'vocab'],
          ['practice', 'practice'],
        ]) {
          const btn = document.querySelector(\`#mobile-tabbar .tab-btn[data-section="\${section}"]\`);
          const check = { section, expected, visible: isVisible(btn), hit: hitTarget(btn) };
          btn?.click();
          await wait();
          check.page = activePage();
          check.active = activeSection();
          checks.push(check);
        }

        more?.click();
        await waitSheet();
        const sheetOpened = isVisible(menu) && menu.classList.contains('open');

        for (const [section, expected] of [
          ['tasks', 'homework'],
          ['phrases', 'phrases'],
          ['repeat', 'repetition'],
          ['chat', 'chat'],
          ['profile', 'login'],
          ['settings', 'settings'],
        ]) {
          if (!menu.classList.contains('open')) {
            more?.click();
            await waitSheet();
          }
          const btn = menu.querySelector(\`button[data-section="\${section}"]\`);
          const check = { section, expected, visible: isVisible(btn), hit: hitTarget(btn) };
          btn?.click();
          await wait();
          check.page = activePage();
          check.active = activeSection();
          checks.push(check);
        }

        return {
          tabbarVisible: isVisible(tabbar),
          moreVisible: isVisible(more),
          moreHit: hitTarget(more),
          sheetOpened,
          checks,
        };
      })();
    `);

    const smokeErrors = await evalJs(`window.__smokeErrors`);
    const exceptions = events
      .filter((event) => event.method === 'Runtime.exceptionThrown')
      .map((event) => event.params.exceptionDetails.text || 'Runtime exception');
    const logErrors = events
      .filter((event) => event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
      .map((event) => event.params.entry.text);
    const filteredLogErrors = logErrors.filter(
      (text) => !text.includes('status of 503')
    );

    const report = {
      dashboardState,
      lessonState,
      hwState,
      loginState,
      aiState,
      repetitionState,
      mobileState,
      smokeErrors,
      exceptions,
      logErrors: filteredLogErrors,
      consoleMessages: consoleMessages.slice(-20),
    };

    console.log(JSON.stringify(report, null, 2));

    const hasBlockingErrors =
      !dashboardState?.onboardingDone ||
      !lessonState?.completed ||
      !hwState?.done ||
      !loginState?.staticMode ||
      !loginState?.noApiUrl ||
      loginState?.token ||
      !loginState?.exportVisible ||
      aiState?.disabledMessage ||
      !aiState?.scenarioCards ||
      !mobileState?.tabbarVisible ||
      !mobileState?.moreVisible ||
      !mobileState?.moreHit ||
      !mobileState?.sheetOpened ||
      !mobileState?.checks?.every((item) => item.visible && item.hit && item.page === item.expected && (item.active === item.section || item.active === 'more')) ||
      (smokeErrors && smokeErrors.length) ||
      exceptions.length ||
      filteredLogErrors.length;

    if (hasBlockingErrors) {
      process.exitCode = 1;
    }
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
