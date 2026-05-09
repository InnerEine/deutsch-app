// Lightweight static smoke test for the deutsch-project frontend.
// It does NOT require a real browser — so it can run in any CI.
//
// The original `smoke-test.js` drives headless Chrome and is still useful on
// developer machines with Chrome installed, but this file gives a quick check
// that the static build is not obviously broken.
//
// Usage:
//   node static-smoke.js
//
// Exit code 0 = all checks passed, non-zero = something regressed.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.STATIC_SMOKE_PORT || 8764);
const BASE = `http://127.0.0.1:${PORT}`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchText(urlPath) {
  const res = await fetch(`${BASE}${urlPath}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${urlPath}`);
  return res.text();
}

async function waitForServer(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/index.html`);
      if (res.ok) return true;
    } catch {}
    await sleep(200);
  }
  throw new Error('server did not start in time');
}

function extractInlineScripts(html) {
  const re = /<script(?![^>]*src=)(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

function nodeCheck(source, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--check', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      resolve({ ok: code === 0, label, stderr: stderr.slice(0, 400) });
    });
    child.stdin.end(source);
  });
}

async function main() {
  const pythonBin = process.env.PYTHON || 'python3';
  const server = spawn(pythonBin, ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  process.on('exit', () => { try { server.kill(); } catch {} });

  const issues = [];
  const ok = [];

  try {
    await waitForServer();
    ok.push('server started');

    const html = await fetchText('/index.html');
    if (!/<title>DEUTSCH\.app/.test(html)) issues.push('title missing');
    else ok.push('title ok');

    const expectedIds = [
      'onboarding', 'appHdr', 'appNav', 'appMain',
      'nameInput', 'specGrid', 'ltOpts', 'ltWord', 'ltBar', 'ltNum', 'ltNext',
      'resultScore', 'resultLevel', 'resultDesc', 'planPreview', 'startDetectedLevelBtn',
      'hdrName', 'hdrLevel', 'hdrAvatar', 'topbarTitle',
      'kpi-lessons', 'kpi-words', 'kpi-hw', 'kpi-xp', 'kpi-streak',
      'mobile-tabbar', 'more-menu', 'sheet-overlay',
      'scenarioGrid', 'chatMessages', 'chatInput', 'sendBtn', 'cleanCounter',
      'vocabSearch', 'vocabFilter', 'vocabBody',
      'hwFilter', 'hwList', 'hwStats',
      'loginForm', 'loginProfile',
      'settingsName', 'settingsLevel', 'settingsSpecGrid', 'settingsThemeSelect', 'translationLangSelect',
      'planRoot', 'readingRoot',
      'communityMessages', 'communityInput', 'communitySend',
      'page-dashboard', 'page-plan', 'page-reading', 'page-homework', 'page-vocab',
      'page-phrases', 'page-practice', 'page-chat', 'page-settings', 'page-repetition', 'page-login',
      'lessonModal', 'modalBody', 'modalTtl', 'toast',
    ];
    for (const id of expectedIds) {
      if (!html.includes(`id="${id}"`)) issues.push(`missing dom id: ${id}`);
    }
    ok.push(`${expectedIds.length} dom ids present`);

    // "Azamat" / "Азамат" should only appear as a Gemini prompt instruction or inside the sanitizer.
    const azamatMatches = [...html.matchAll(/Azamat|Азамат/gi)].map((m) => {
      const line = html.slice(0, m.index).split('\n').length;
      return { line, snippet: html.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\n/g, ' ') };
    });
    const forbidden = azamatMatches.filter((hit) => {
      const s = hit.snippet;
      return !s.includes('replace(') && !s.includes('НЕ использовать имя');
    });
    if (forbidden.length) issues.push(`Azamat/Азамат leftover: ${JSON.stringify(forbidden, null, 2)}`);
    else ok.push('no Azamat/Азамат defaults in HTML');

    const settingsMatch = html.match(/<div class="page" id="page-settings">[\s\S]*?<!-- REPETITION/);
    if (settingsMatch && /[Gg]emini/i.test(settingsMatch[0])) issues.push('settings page still references Gemini');
    else ok.push('Gemini key not exposed in settings');

    if (/id="dName"[^>]*>\s*Азамат|id="hdrName"[^>]*>\s*Азамат|id="dName"[^>]*>\s*Azamat|id="hdrName"[^>]*>\s*Azamat/.test(html)) {
      issues.push('header/greeting still defaults to Azamat');
    } else ok.push('header/greeting defaults neutral');

    const blocks = extractInlineScripts(html);
    const checks = await Promise.all(blocks.map((src, i) => nodeCheck(src, `inline-script-${i + 1}`)));
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) issues.push(`inline scripts failed syntax: ${JSON.stringify(failed)}`);
    else ok.push(`${blocks.length} inline scripts parse`);

    const manifestText = await fetchText('/manifest.json');
    try {
      const manifest = JSON.parse(manifestText);
      if (!manifest.name) issues.push('manifest has no name');
      if (!manifest.start_url) issues.push('manifest has no start_url');
      ok.push('manifest.json ok');
    } catch (err) {
      issues.push(`manifest.json invalid: ${err.message}`);
    }

    const swText = await fetchText('/sw.js');
    if (!/self\.addEventListener/.test(swText)) issues.push('sw.js missing addEventListener');
    else ok.push('sw.js served');
  } catch (err) {
    issues.push(`fatal: ${err.message}`);
  } finally {
    try { server.kill(); } catch {}
  }

  const report = { passed: issues.length === 0, ok, issues };
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}

main().catch((err) => {
  console.error('static-smoke failed', err);
  process.exit(2);
});
