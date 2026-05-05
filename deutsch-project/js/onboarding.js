// ONBOARDING

let ltIdx = 0;
let ltScore = 0;
let ltAnswered = false;
let ltSession = [];

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildTestSession() {
  return shuffleArray(LEVEL_TEST).map((question) => {
    const opts = question.opts.map((text, idx) => ({
      text,
      isAnswer: idx === question.a,
    }));
    const shuffled = shuffleArray(opts);
    return {
      ...question,
      opts: shuffled.map((item) => item.text),
      a: shuffled.findIndex((item) => item.isAnswer),
    };
  });
}

function buildSpecGrid() {
  const grid = document.getElementById('specGrid');
  grid.innerHTML = '';
  SPECIALIZATIONS.forEach((spec) => {
    const card = document.createElement('div');
    card.className = `spec-card${S.specs.includes(spec.id) ? ' sel' : ''}`;
    card.id = `sc-${spec.id}`;
    card.innerHTML = `
      <div class="spec-icon">${spec.icon}</div>
      <div class="spec-name">${spec.name}</div>
      <div class="spec-desc">${spec.desc}</div>
      <div class="spec-check">✓</div>
    `;
    card.onclick = () => {
      if (S.specs.includes(spec.id)) S.specs = S.specs.filter((item) => item !== spec.id);
      else S.specs.push(spec.id);
      card.classList.toggle('sel', S.specs.includes(spec.id));
    };
    grid.appendChild(card);
  });
}

function obNext(step) {
  if (step === 2 && !document.getElementById('nameInput').value.trim()) {
    toast('Введи своё имя!');
    return;
  }
  if (step === 2) {
    S.name = document.getElementById('nameInput').value.trim() || 'Азамат';
    saveS();
  }
  if (step === 3 && S.specs.length === 0) {
    toast('Выбери хотя бы одну специальность!');
    return;
  }
  document.querySelectorAll('.ob-step').forEach((item) => item.classList.remove('on'));
  document.getElementById(`ob${step}`).classList.add('on');
  if (step === 2) buildSpecGrid();
}

function startLevelTest() {
  ltIdx = 0;
  ltScore = 0;
  ltAnswered = false;
  ltSession = buildTestSession();
  document.querySelectorAll('.ob-step').forEach((item) => item.classList.remove('on'));
  document.getElementById('ob3b').classList.add('on');
  renderLTQ();
}

function renderLTQ() {
  if (ltIdx >= ltSession.length) {
    showLTResult();
    return;
  }
  const question = ltSession[ltIdx];
  document.getElementById('ltNum').textContent = `Вопрос ${ltIdx + 1} из ${ltSession.length}`;
  document.getElementById('ltBar').style.width = `${(ltIdx / ltSession.length) * 100}%`;
  document.getElementById('ltWord').textContent = question.q;
  document.getElementById('ltNext').style.display = 'none';
  ltAnswered = false;

  const optsWrap = document.getElementById('ltOpts');
  optsWrap.innerHTML = '';
  question.opts.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.className = 'lt-opt';
    btn.textContent = option;
    btn.onclick = () => answerLT(index);
    optsWrap.appendChild(btn);
  });
}

function answerLT(selected) {
  if (ltAnswered) return;
  ltAnswered = true;
  const question = ltSession[ltIdx];
  document.querySelectorAll('.lt-opt').forEach((button, index) => {
    button.classList.add(index === question.a ? 'correct' : 'wrong');
    button.disabled = true;
  });
  if (selected === question.a) ltScore += 1;
  document.getElementById('ltNext').style.display = 'inline-flex';
}

function ltNextQ() {
  ltIdx += 1;
  renderLTQ();
}

function showLTResult() {
  const score = ltScore;
  let level = 'A1';
  let desc = '';

  if (score <= 3) {
    level = 'A1';
    desc = 'Ты в самом начале пути. Мы начнём с основ: приветствия, базовых слов и простых конструкций.';
  } else if (score <= 5) {
    level = 'A2';
    desc = 'Базовый уровень уже есть. Дальше усилим бытовой немецкий, понимание речи и короткие диалоги.';
  } else if (score <= 7) {
    level = 'B1';
    desc = 'Хорошая база. Теперь фокус на более длинных фразах, уверенном общении и профессиональной лексике.';
  } else {
    level = 'B2';
    desc = 'Уровень уже крепкий. Можно больше работать над беглостью, нюансами и рабочими сценариями.';
  }

  S.level = level;
  S.levelScore = score;
  saveS();

  document.getElementById('resultScore').textContent = score;
  document.getElementById('resultLevel').textContent = `Уровень: ${level}`;
  document.getElementById('resultDesc').textContent = desc;
  const specNames = SPECIALIZATIONS
    .filter((item) => S.specs.includes(item.id))
    .map((item) => item.name)
    .join(', ') || 'Общий';
  document.getElementById('planPreview').innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Твой план будет включать:</div>
    <div style="font-size:13px;line-height:1.8;color:var(--text);">
      ✦ Общий немецкий с уровня <strong style="color:var(--gold);">${level}</strong><br>
      ✦ Профессиональная лексика: <strong style="color:var(--gold);">${specNames}</strong><br>
      ✦ Домашние задания под каждый урок<br>
      ✦ Разговорник и словарь по специальности
    </div>
  `;
  document.querySelectorAll('.ob-step').forEach((item) => item.classList.remove('on'));
  document.getElementById('ob4').classList.add('on');
}

function finishOnboarding() {
  S.onboardingDone = true;
  saveS();
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('appHdr').style.display = '';
  document.getElementById('appNav').style.display = '';
  document.getElementById('appMain').style.display = '';
  initApp();
}
