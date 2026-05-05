// APP - navigation, dashboard, lessons, homework, vocab, sync

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2600);
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    toast('Аудио не поддерживается в этом браузере');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  speechSynthesis.speak(utterance);
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function avatarLetter(name) {
  return (name || 'A').trim().slice(0, 1).toUpperCase() || 'A';
}

function hasBackend() {
  return S.staticMode === false && !!S.apiUrl;
}

function getAllSpecLessons() {
  return S.specs.flatMap((spec) => SPEC_LESSONS[spec] || []);
}

function getCompletedWordCount() {
  return [...GENERAL_LESSONS, ...getAllSpecLessons()]
    .filter((lesson) => S.completedLessons.includes(lesson.id))
    .reduce((sum, lesson) => sum + lesson.words.length, 0);
}

function getProfileSummary() {
  return {
    lessons: S.completedLessons.length,
    words: getCompletedWordCount(),
    homework: Object.values(S.hwDone).filter(Boolean).length,
    specs: SPECIALIZATIONS
      .filter((item) => S.specs.includes(item.id))
      .map((item) => item.name)
      .join(', ') || 'Общий',
  };
}

async function initApp() {
  document.getElementById('hdrAvatar').textContent = avatarLetter(S.name);
  document.getElementById('hdrName').textContent = S.name || 'Azamat';
  document.getElementById('hdrLevel').textContent = S.level || 'A1';
  document.getElementById('dName').textContent = S.name || 'Azamat';

  const specLabel = SPECIALIZATIONS
    .filter((item) => S.specs.includes(item.id))
    .map((item) => `${item.icon} ${item.id.toUpperCase()}`)
    .join(' · ') || 'Общий';
  document.getElementById('dMeta').textContent = `уровень ${S.level} · ${specLabel}`;
  document.getElementById('planSpecLabel').textContent = SPECIALIZATIONS
    .filter((item) => S.specs.includes(item.id))
    .map((item) => item.name)
    .join(' · ') || 'Общий немецкий';

  if (S.token && hasBackend()) {
    await syncFromBackend();
  } else if (!hasBackend() && S.token) {
    S.token = null;
    saveS();
  }

  updateDash();
  renderPlan();
  renderHW();
  renderVocab();
  renderPhrases();
  renderLogin();
}

function goPage(name) {
  document.querySelectorAll('.page').forEach((page) => page.classList.remove('on'));
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('on'));
  document.getElementById(`page-${name}`).classList.add('on');

  const pages = ['dashboard', 'plan', 'homework', 'vocab', 'phrases', 'practice', 'repetition', 'login', 'settings'];
  const idx = pages.indexOf(name);
  if (idx >= 0) document.querySelectorAll('.nav-btn')[idx].classList.add('on');

  if (name === 'practice') renderScenarios();
  if (name === 'settings') renderSettings();
  if (name === 'repetition') renderRepetition();
  if (name === 'login') renderLogin();
  window.scrollTo(0, 0);
}

function updateDash() {
  document.getElementById('kpi-words').textContent = getCompletedWordCount();
  document.getElementById('kpi-lessons').textContent = S.completedLessons.length;
  document.getElementById('kpi-hw').textContent = Object.values(S.hwDone).filter(Boolean).length;
  document.getElementById('kpi-streak').textContent = S.points;

  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const levelNames = {
    A1: 'Начальный',
    A2: 'Элементарный',
    B1: 'Средний',
    B2: 'Выше среднего',
    C1: 'Продвинутый',
    C2: 'Свободный',
  };
  const lt = document.getElementById('levelTrack');
  lt.innerHTML = '';

  levels.forEach((level) => {
    const isCur = level === S.level;
    const isDone = levels.indexOf(level) < levels.indexOf(S.level);
    const item = document.createElement('div');
    item.className = `lvl-item${isCur ? ' cur' : ''}${isDone ? ' done' : ''}`;
    item.innerHTML = `
      <div class="lvl-name">${level}</div>
      <div class="lvl-sub">${levelNames[level]}</div>
      <div class="lvl-prog">
        <div class="lvl-prog-fill" style="width:${isDone ? 100 : isCur ? Math.round((S.completedLessons.length / Math.max(GENERAL_LESSONS.length, 1)) * 100) : 0}%"></div>
      </div>
    `;
    lt.appendChild(item);
  });

  const nextLesson = GENERAL_LESSONS.find((lesson) => !S.completedLessons.includes(lesson.id));
  const nextLessonEl = document.getElementById('nextLesson');
  if (nextLesson) {
    nextLessonEl.innerHTML = `
      <div class="plan-card ${nextLesson.color}" style="max-width:420px;cursor:pointer;" onclick="openLessonById('${nextLesson.id}')">
        <div class="plan-type">${nextLesson.type}</div>
        <div class="plan-title">${nextLesson.title}</div>
        <div class="plan-sub">${nextLesson.de} · ${nextLesson.words.length} слов</div>
        <div class="plan-status cur">● Текущий</div>
      </div>
    `;
  } else {
    nextLessonEl.innerHTML = `<div style="color:var(--green);font-family:'IBM Plex Mono',monospace;font-size:12px;">✓ Все общие уроки пройдены</div>`;
  }

  const pending = getHWList()
    .filter((item) => !S.hwDone[item.id])
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  const nextHW = document.getElementById('nextHW');
  if (pending.length) {
    const hw = pending[0];
    nextHW.innerHTML = `
      <div class="hw-card" style="max-width:520px;cursor:pointer;" onclick="goPage('homework')">
        <div class="hw-meta">
          <span class="hw-badge hw-b-${hw.type}">${HW_TYPE_LABELS[hw.type] || hw.type}</span>
          <span class="hw-due">${fmtDue(hw.due)}</span>
        </div>
        <div class="hw-ttl">${hw.title}</div>
        <div class="hw-dsc" style="margin-top:4px;">${hw.desc.slice(0, 120)}...</div>
      </div>
    `;
  } else {
    nextHW.innerHTML = `<div style="color:var(--green);font-family:'IBM Plex Mono',monospace;font-size:12px;">✓ Все задания сданы</div>`;
  }
}

function renderPlan() {
  const generalGrid = document.getElementById('generalGrid');
  generalGrid.innerHTML = '';

  GENERAL_LESSONS.forEach((lesson, index) => {
    const done = S.completedLessons.includes(lesson.id);
    const unlocked = done || index === 0 || S.completedLessons.includes(GENERAL_LESSONS[index - 1]?.id);
    const card = document.createElement('div');
    card.className = `plan-card ${lesson.color}${unlocked ? '' : ' locked'}`;
    card.innerHTML = `
      <div class="plan-type">${lesson.type}</div>
      <div class="plan-title">${lesson.title}</div>
      <div class="plan-sub">${lesson.de}</div>
      <div class="plan-chips">${lesson.words.slice(0, 3).map((word) => `<span class="chip">${word.de}</span>`).join('')}</div>
      <div class="plan-status ${done ? 'done' : unlocked ? 'cur' : ''}">${done ? '✓ Готово' : unlocked ? '● Доступно' : 'Закрыто'}</div>
    `;
    if (unlocked) {
      card.onclick = () => openLesson(lesson);
    }
    generalGrid.appendChild(card);
  });

  const specGrid = document.getElementById('specPlanGrid');
  const specLabel = document.getElementById('specGridLabel');
  const specLessons = getAllSpecLessons();
  specGrid.innerHTML = '';

  if (!specLessons.length) {
    specLabel.style.display = 'none';
    return;
  }

  specLabel.style.display = '';
  specLabel.textContent = `Профессиональные темы: ${SPECIALIZATIONS.filter((item) => S.specs.includes(item.id)).map((item) => item.name).join(', ')}`;

  specLessons.forEach((lesson) => {
    const done = S.completedLessons.includes(lesson.id);
    const card = document.createElement('div');
    card.className = `plan-card ${lesson.color}`;
    card.innerHTML = `
      <div class="plan-type">${lesson.type}</div>
      <div class="plan-title">${lesson.title}</div>
      <div class="plan-sub">${lesson.de}</div>
      <div class="plan-chips">${lesson.words.slice(0, 3).map((word) => `<span class="chip">${word.de}</span>`).join('')}</div>
      <div class="plan-status ${done ? 'done' : 'cur'}">${done ? '✓ Готово' : '● Доступно'}</div>
    `;
    card.onclick = () => openLesson(lesson);
    specGrid.appendChild(card);
  });
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function addD(days) {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

const HW_TYPE_LABELS = {
  writing: 'Письмо',
  translation: 'Перевод',
  listening: 'Аудирование',
  grammar: 'Грамматика',
  reading: 'Чтение',
};

function fmtDue(dateString) {
  const due = new Date(dateString);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - TODAY) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  if (diff < 0) return `Просрочено (${Math.abs(diff)} дн.)`;
  return `Через ${diff} дн.`;
}

function hwSt(hw) {
  if (S.hwDone[hw.id]) return 'done';
  const due = new Date(hw.due);
  due.setHours(0, 0, 0, 0);
  if (due < TODAY) return 'overdue';
  if (due.getTime() === TODAY.getTime()) return 'today';
  return 'pending';
}

function getHWList() {
  const base = [
    { id: 'hw1', type: 'writing', title: 'Напиши приветствие', due: addD(-2), desc: 'Напиши 5 предложений о себе по-немецки. Используй: Ich bin..., Mein Name ist..., Ich komme aus...' },
    { id: 'hw2', type: 'translation', title: 'Переведи числа', due: addD(-1), desc: 'Переведи числа 1, 5, 10, 15 и 20 на немецкий язык.' },
    { id: 'hw3', type: 'writing', title: 'Опиши предметы вокруг', due: addD(0), desc: 'Найди 5 предметов рядом и опиши их цвет по-немецки.' },
    { id: 'hw4', type: 'grammar', title: 'Артикли der/die/das', due: addD(2), desc: 'Напиши 6 существительных с правильными артиклями.' },
    { id: 'hw5', type: 'reading', title: 'Дневник на немецком', due: addD(4), desc: 'Напиши 3-5 предложений про сегодняшний день.' },
    { id: 'hw6', type: 'listening', title: 'Немецкий алфавит', due: addD(3), desc: 'Прослушай немецкий алфавит и выпиши 5 слов на разные буквы.' },
  ];

  if (S.specs.includes('it')) {
    base.push(
      { id: 'hw_it1', type: 'translation', title: 'IT: Переведи термины', due: addD(5), desc: 'Переведи на немецкий: сеть, пароль, доступ, обновление, резервная копия, шифрование.' },
      { id: 'hw_it2', type: 'writing', title: 'IT: Опиши инцидент', due: addD(7), desc: 'Напиши короткий отчёт об IT-инциденте на немецком языке.' }
    );
  }
  if (S.specs.includes('med')) {
    base.push({ id: 'hw_med1', type: 'translation', title: 'Медицина: Термины', due: addD(5), desc: 'Переведи: пациент, диагноз, рецепт, таблетка, больница.' });
  }
  if (S.specs.includes('fin')) {
    base.push({ id: 'hw_fin1', type: 'writing', title: 'Финансы: Предложения', due: addD(6), desc: 'Составь 4 предложения с финансовыми терминами.' });
  }
  if (S.specs.includes('biz')) {
    base.push({ id: 'hw_biz1', type: 'writing', title: 'Бизнес: Деловое письмо', due: addD(6), desc: 'Напиши короткое деловое письмо на немецком языке.' });
  }
  return base;
}

let curHWFilter = 'all';

function renderHW(filter) {
  if (filter) curHWFilter = filter;

  let list = getHWList().sort((a, b) => new Date(a.due) - new Date(b.due));
  const total = list.length;
  const done = list.filter((item) => S.hwDone[item.id]).length;
  const overdue = list.filter((item) => hwSt(item) === 'overdue').length;
  const pending = list.filter((item) => !S.hwDone[item.id] && hwSt(item) !== 'overdue').length;

  const filterWrap = document.getElementById('hwFilter');
  if (!filterWrap.children.length) {
    [
      ['all', 'Все'],
      ['pending', 'Активные'],
      ['done', 'Сданные'],
      ['overdue', 'Просроченные'],
    ].forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.className = `hw-fb${value === curHWFilter ? ' on' : ''}`;
      btn.textContent = label;
      btn.onclick = () => {
        document.querySelectorAll('.hw-fb').forEach((el) => el.classList.remove('on'));
        btn.classList.add('on');
        renderHW(value);
      };
      filterWrap.appendChild(btn);
    });
  }

  document.getElementById('hwStats').innerHTML = `
    <div class="hw-stat"><div class="hw-sn" style="color:var(--gold)">${total}</div><div class="hw-sl">Всего</div></div>
    <div class="hw-stat"><div class="hw-sn" style="color:var(--green)">${done}</div><div class="hw-sl">Сдано</div></div>
    <div class="hw-stat"><div class="hw-sn" style="color:var(--muted)">${pending}</div><div class="hw-sl">Активных</div></div>
    <div class="hw-stat"><div class="hw-sn" style="color:var(--red)">${overdue}</div><div class="hw-sl">Просрочено</div></div>
  `;

  if (curHWFilter === 'done') list = list.filter((item) => S.hwDone[item.id]);
  else if (curHWFilter === 'pending') list = list.filter((item) => !S.hwDone[item.id] && hwSt(item) !== 'overdue');
  else if (curHWFilter === 'overdue') list = list.filter((item) => hwSt(item) === 'overdue');

  const hwList = document.getElementById('hwList');
  hwList.innerHTML = '';
  if (!list.length) {
    hwList.innerHTML = `<div style="color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:12px;padding:20px 0;">Нет заданий в этой категории.</div>`;
    return;
  }

  list.forEach((hw) => {
    const state = hwSt(hw);
    const isDone = !!S.hwDone[hw.id];
    const saved = S.hwAnswers[hw.id] || '';
    const card = document.createElement('div');
    card.className = `hw-card${isDone ? ' hw-ok' : state === 'overdue' ? ' hw-late' : state === 'today' ? ' hw-today' : ''}`;
    card.innerHTML = `
      <div class="hw-top">
        <div class="hw-left" style="flex:1;">
          <div class="hw-meta">
            <span class="hw-badge hw-b-${hw.type}">${HW_TYPE_LABELS[hw.type] || hw.type}</span>
            <span class="hw-due ${state === 'overdue' ? 'late' : state === 'today' ? 'today' : ''}">${fmtDue(hw.due)}</span>
            ${isDone ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--green);letter-spacing:2px;text-transform:uppercase;">✓ Сдано</span>` : ''}
          </div>
          <div class="hw-ttl">${hw.title}</div>
          <div class="hw-dsc">${hw.desc}</div>
        </div>
        <div class="hw-acts">
          <button class="hw-chk ${isDone ? 'chk' : ''}" onclick="toggleHWDone('${hw.id}')">${isDone ? '✓' : '○'}</button>
          <button class="hw-ans-btn" onclick="toggleHWAns('${hw.id}')">${saved ? 'Ответ ▾' : 'Ответить ▾'}</button>
        </div>
      </div>
      <div class="hw-ans-area" id="hwa-${hw.id}">
        ${saved ? `<div class="hw-saved"><div class="hw-saved-lbl">✓ Сохранённый ответ</div><div class="hw-saved-txt">${esc(saved)}</div></div>` : ''}
        <textarea class="hw-textarea" id="hwtxt-${hw.id}" placeholder="Напиши ответ здесь..." style="margin-top:${saved ? '10px' : '0'}">${esc(saved)}</textarea>
        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="saveHWAns('${hw.id}')">Сохранить</button>
          ${!isDone ? `<button class="btn btn-green btn-sm" onclick="submitHW('${hw.id}')">Сдать ✓</button>` : ''}
        </div>
      </div>
    `;
    hwList.appendChild(card);
  });
}

function toggleHWAns(id) {
  const area = document.getElementById(`hwa-${id}`);
  area.classList.toggle('on');
  if (area.classList.contains('on')) {
    const input = document.getElementById(`hwtxt-${id}`);
    if (input) input.focus();
  }
}

function saveHWAns(id) {
  const input = document.getElementById(`hwtxt-${id}`);
  if (!input) return;
  const value = input.value.trim();
  if (!value) {
    toast('Напиши что-нибудь!');
    return;
  }
  S.hwAnswers[id] = value;
  saveS();
  toast('✓ Ответ сохранён');
  renderHW(curHWFilter);
  updateDash();
}

async function submitHW(id) {
  const input = document.getElementById(`hwtxt-${id}`);
  if (input && input.value.trim()) S.hwAnswers[id] = input.value.trim();
  S.hwDone[id] = true;
  S.points += 5;
  saveS();
  syncProfile();
  toast('🏆 Задание сдано! Sehr gut!');
  renderHW(curHWFilter);
  updateDash();

  const hw = getHWList().find((item) => item.id === id);
  if (hw && S.hwAnswers[id]) {
    await checkHWWithAI(S.hwAnswers[id], hw, S.level);
  }
}

async function checkHWWithAI(answer, hw, level) {
  if (!hasBackend()) {
    toast('AI-проверка доступна только с подключённым backend');
    return;
  }

  const result = await apiRequest(
    '/ai/homework-feedback',
    { answer, level, homework: { id: hw.id, title: hw.title, desc: hw.desc, type: hw.type } },
    'POST'
  );
  if (result && result.text) {
    setTimeout(() => alert(`AI Фидбек:\n${result.text}`), 300);
  } else if (result && result.error) {
    toast(`AI недоступен: ${result.error}`);
  }
}

function toggleHWDone(id) {
  S.hwDone[id] = !S.hwDone[id];
  saveS();
  toast(S.hwDone[id] ? '✓ Отмечено выполненным' : 'Отметка снята');
  renderHW(curHWFilter);
  updateDash();
}

let curVocabFilter = 'all';

function getAllVocab() {
  const general = GENERAL_LESSONS.flatMap((lesson) => lesson.words);
  const spec = S.specs.flatMap((specId) => SPEC_VOCAB[specId] || []);
  return [...general, ...spec];
}

function renderVocab(filter) {
  if (filter !== undefined) curVocabFilter = filter;

  const filterWrap = document.getElementById('vocabFilter');
  const cats = ['all', ...new Set(getAllVocab().map((word) => word.cat))];
  if (!cats.includes(curVocabFilter)) curVocabFilter = 'all';
  filterWrap.innerHTML = '';
  cats.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = `vf-btn${cat === curVocabFilter ? ' on' : ''}`;
    btn.textContent = cat === 'all' ? 'Все' : cat;
    btn.onclick = () => renderVocab(cat);
    filterWrap.appendChild(btn);
  });

  let words = getAllVocab();
  if (curVocabFilter !== 'all') words = words.filter((word) => word.cat === curVocabFilter);

  const body = document.getElementById('vocabBody');
  body.innerHTML = '';
  words.forEach((word) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="vt-de">${word.de}</span> <button onclick="speak('${word.de.replace(/'/g, "\\'")}')" style="background:none;border:none;cursor:pointer;font-size:14px;">🔊</button></td>
      <td class="vt-ru">${word.ru}</td>
      <td class="vt-ex">${word.ex}</td>
      <td><span class="vt-tag">${word.cat}</span></td>
    `;
    body.appendChild(row);
  });
}

function renderPhrases() {
  const grid = document.getElementById('phrasesGrid');
  grid.innerHTML = '';
  PHRASES.forEach((phrase) => {
    const card = document.createElement('div');
    card.className = 'ph-card';
    card.innerHTML = `
      <div class="ph-de">${phrase.de} <button onclick="speak('${phrase.de.replace(/'/g, "\\'")}')" style="background:none;border:none;cursor:pointer;font-size:14px;">🔊</button></div>
      <div class="ph-ru">${phrase.ru}</div>
      <div class="ph-cat">${phrase.cat}</div>
    `;
    grid.appendChild(card);
  });
}

function renderSettings() {
  document.getElementById('settingsName').value = S.name || '';
  document.getElementById('settingsLevel').textContent = S.level || 'A1';
  const grid = document.getElementById('settingsSpecGrid');
  grid.innerHTML = '';

  SPECIALIZATIONS.forEach((spec) => {
    const checked = S.specs.includes(spec.id);
    const card = document.createElement('div');
    card.className = `spec-card${checked ? ' sel' : ''}`;
    card.innerHTML = `
      <div class="spec-icon">${spec.icon}</div>
      <div class="spec-name">${spec.name}</div>
      <div class="spec-desc">${spec.desc}</div>
      <input type="checkbox" class="spec-check" id="spec-${spec.id}" ${checked ? 'checked' : ''}>
    `;
    card.onclick = () => {
      const checkbox = document.getElementById(`spec-${spec.id}`);
      checkbox.checked = !checkbox.checked;
      card.classList.toggle('sel', checkbox.checked);
    };
    grid.appendChild(card);
  });
}

function saveSettings() {
  const newName = document.getElementById('settingsName').value.trim();
  if (newName) S.name = newName;
  S.specs = SPECIALIZATIONS
    .filter((spec) => document.getElementById(`spec-${spec.id}`).checked)
    .map((spec) => spec.id);
  saveS();
  syncProfile();
  initApp();
  toast('✓ Настройки сохранены');
  goPage('dashboard');
}

function retakeTest() {
  if (!confirm('Перепройти тест уровня? Прогресс уроков сохранится, но уровень будет пересчитан.')) return;
  S.level = 'A1';
  S.levelScore = 0;
  S.onboardingDone = false;
  saveS();
  location.reload();
}

let QS = { lesson: null, phase: 'vocab', idx: 0, score: 0, answered: false };

function openLessonById(id) {
  const lesson = [...GENERAL_LESSONS, ...getAllSpecLessons()].find((item) => item.id === id);
  if (lesson) openLesson(lesson);
}

function openLesson(lesson) {
  QS = { lesson, phase: 'vocab', idx: 0, score: 0, answered: false };
  document.getElementById('modalTtl').textContent = lesson.title;
  renderModal();
  document.getElementById('lessonModal').classList.add('on');
}

function closeModal() {
  document.getElementById('lessonModal').classList.remove('on');
}

document.getElementById('lessonModal').addEventListener('click', function modalBgClick(event) {
  if (event.target === this) closeModal();
});

function renderModal() {
  const lesson = QS.lesson;
  const body = document.getElementById('modalBody');

  if (QS.phase === 'vocab') {
    body.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">${lesson.words.length} слов · ${lesson.de}</div>
      <table class="vocab-table" style="margin-bottom:24px;">
        <thead><tr><th>Немецкий</th><th>Русский</th><th>Пример</th></tr></thead>
        <tbody>
          ${lesson.words.map((word) => `
            <tr>
              <td><span class="vt-de">${word.de}</span> <button onclick="speak('${word.de.replace(/'/g, "\\'")}')" style="background:none;border:none;cursor:pointer;font-size:14px;">🔊</button></td>
              <td>${word.ru}</td>
              <td class="vt-ex">${word.ex}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="btn-row">
        <button class="btn btn-gold" onclick="QS.phase='quiz';renderModal()">Перейти к тесту →</button>
      </div>
    `;
    return;
  }

  const quiz = lesson.quiz || [];
  if (QS.idx >= quiz.length) {
    const perfect = QS.score === quiz.length;
    if (perfect && !S.completedLessons.includes(lesson.id)) {
      S.completedLessons.push(lesson.id);
      S.points += 10;
      saveS();
      syncProgress(lesson.id, true, QS.score);
      syncProfile();
    }
    body.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <span class="qz-score">${QS.score}/${quiz.length}</span>
        <div class="qz-msg">${perfect ? 'PERFEKT! УРОК ЗАВЕРШЁН' : QS.score >= Math.ceil(quiz.length / 2) ? 'GUT GEMACHT!' : 'ПОПРОБУЙ ЕЩЁ РАЗ'}</div>
        <div class="btn-row" style="justify-content:center;">
          ${!perfect ? `<button class="btn btn-ghost" onclick="QS.idx=0;QS.score=0;QS.answered=false;renderModal()">Повторить</button>` : ''}
          <button class="btn btn-gold" onclick="closeModal();renderPlan();updateDash()">Готово</button>
        </div>
      </div>
    `;
    if (perfect) toast(`🏆 Урок завершён: ${lesson.title}`);
    return;
  }

  const question = quiz[QS.idx];
  body.innerHTML = `
    <div class="qz-prog"><div class="qz-bar" style="width:${(QS.idx / quiz.length) * 100}%"></div></div>
    <div class="qz-num">Вопрос ${QS.idx + 1} из ${quiz.length}</div>
    <div class="qz-word">${question.q}</div>
    <div class="qz-opts">${question.opts.map((option, index) => `<button class="qz-opt" id="qo${index}" onclick="answerQ(${index})">${option}</button>`).join('')}</div>
    <button class="btn btn-gold qz-next" id="qnxt" onclick="nextQ()" style="display:none;margin-top:16px;">Следующий →</button>
  `;
}

function answerQ(selected) {
  if (QS.answered) return;
  QS.answered = true;
  const question = QS.lesson.quiz[QS.idx];
  question.opts.forEach((_, index) => {
    const button = document.getElementById(`qo${index}`);
    button.classList.add(index === question.a ? 'ok' : 'no');
    button.disabled = true;
  });
  if (selected === question.a) QS.score += 1;
  document.getElementById('qnxt').style.display = 'inline-flex';
}

function nextQ() {
  QS.idx += 1;
  QS.answered = false;
  renderModal();
}

let REP = { words: [], idx: 0 };

function getTodayWords(today) {
  const allWords = [
    ...GENERAL_LESSONS.flatMap((lesson) => lesson.words.map((word) => ({ de: word.de, ru: word.ru, ex: word.ex }))),
    ...Object.values(SPEC_VOCAB).flatMap((items) => items.map((word) => ({ de: word.de, ru: word.ru, ex: word.ex }))),
  ];
  return allWords.filter((word) => {
    const progress = S.vocabProgress[word.de];
    if (!progress) return true;
    return progress.nextReview <= today;
  });
}

function renderRepetition() {
  const today = new Date().toISOString().split('T')[0];
  REP = { words: getTodayWords(today), idx: 0 };

  const status = document.getElementById('repStatus');
  const card = document.getElementById('repCard');
  const done = document.getElementById('repDone');

  if (!REP.words.length) {
    status.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:14px;">Сегодня нет слов для повторения. Изучи новые уроки, и они появятся здесь.</div>`;
    card.style.display = 'none';
    done.style.display = 'none';
    return;
  }

  status.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:14px;">${REP.words.length} слов для повторения сегодня</div>`;
  card.style.display = 'block';
  done.style.display = 'none';
  showCard();
}

function showCard() {
  const word = REP.words[REP.idx];
  document.getElementById('repFront').innerHTML = `
    <div style="font-size:28px;font-weight:600;margin-bottom:8px;">${word.de}</div>
    <div style="color:var(--muted);font-size:14px;">${word.ex}</div>
    <button class="btn btn-teal" onclick="speak('${word.de.replace(/'/g, "\\'")}')" style="margin-top:12px;">🔊 Произнести</button>
  `;
  document.getElementById('repBack').innerHTML = `
    <div style="font-size:24px;color:var(--green);margin-bottom:8px;">${word.ru}</div>
    <div style="color:var(--muted);font-size:14px;">${word.ex}</div>
  `;
  document.getElementById('repBack').style.display = 'none';
  document.getElementById('repActions').style.display = 'none';
  document.querySelector('.rep-card').classList.remove('flipped');
}

function flipCard() {
  document.getElementById('repBack').style.display = 'block';
  document.getElementById('repActions').style.display = 'flex';
  document.querySelector('.rep-card').classList.add('flipped');
}

function repAnswer(correct) {
  const word = REP.words[REP.idx];
  const progress = S.vocabProgress[word.de] || { level: 0, nextReview: new Date().toISOString().split('T')[0] };
  progress.level = correct ? Math.min(progress.level + 1, 5) : Math.max(progress.level - 1, 0);

  const intervals = [1, 2, 4, 7, 14, 30];
  const next = new Date();
  next.setDate(next.getDate() + (intervals[progress.level] || 30));
  progress.nextReview = next.toISOString().split('T')[0];

  S.vocabProgress[word.de] = progress;
  saveS();
  syncVocabProgress(word.de, progress.level, progress.nextReview);

  REP.idx += 1;
  if (REP.idx >= REP.words.length) {
    document.getElementById('repCard').style.display = 'none';
    document.getElementById('repDone').style.display = 'block';
  } else {
    showCard();
  }
}

async function apiRequest(endpoint, data = null, method = 'GET') {
  if (!hasBackend()) {
    return { error: 'Backend is not connected in static-only mode.' };
  }

  const url = `${S.apiUrl}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = `Bearer ${S.token}`;

  const config = { method, headers };
  if (data) config.body = JSON.stringify(data);

  try {
    const response = await fetch(url, config);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return payload || { error: `HTTP ${response.status}` };
    }
    return payload;
  } catch (error) {
    console.warn('API request failed:', error);
    return { error: error.message };
  }
}

async function syncProfile() {
  if (!S.token || !hasBackend()) return null;
  return apiRequest('/profile', { username: S.name, level: S.level, points: S.points }, 'PATCH');
}

async function syncLocalDataToBackend() {
  if (!S.token || !hasBackend()) return;
  await syncProfile();
  for (const lessonId of S.completedLessons) {
    await syncProgress(lessonId, true, 1);
  }
  for (const [word, progress] of Object.entries(S.vocabProgress)) {
    await syncVocabProgress(word, progress.level, progress.nextReview);
  }
}

async function syncProgress(lessonId, completed, score) {
  if (!S.token || !hasBackend()) return;
  await apiRequest('/progress', { lesson_id: lessonId, completed, score }, 'POST');
}

async function syncVocabProgress(word, level, nextReview) {
  if (!S.token || !hasBackend()) return;
  await apiRequest('/vocab_progress', { word, level, next_review: nextReview }, 'POST');
}

async function logAnalytics(action, data = null) {
  if (!S.token || !hasBackend()) return;
  await apiRequest('/analytics', { action, data }, 'POST');
}

function renderLogin() {
  const form = document.getElementById('loginForm');
  const profile = document.getElementById('loginProfile');
  if (!hasBackend()) {
    form.style.display = 'none';
    profile.style.display = 'block';
    const summary = getProfileSummary();
    profile.innerHTML = `
      <div class="profile-panel">
        <div class="profile-hero">
          <div class="profile-avatar">${esc(avatarLetter(S.name))}</div>
          <div class="profile-copy">
            <div class="profile-title">${esc(S.name || 'Пользователь')}</div>
            <div class="profile-sub">Статическая версия: прогресс хранится в этом браузере. Для переноса на другое устройство используй экспорт и импорт.</div>
          </div>
        </div>
        <div class="profile-grid">
          <div class="profile-metric">
            <div class="profile-metric-value">${esc(S.level || 'A1')}</div>
            <div class="profile-metric-label">Уровень</div>
          </div>
          <div class="profile-metric">
            <div class="profile-metric-value">${S.points || 0}</div>
            <div class="profile-metric-label">Очки</div>
          </div>
          <div class="profile-metric">
            <div class="profile-metric-value">${summary.lessons}</div>
            <div class="profile-metric-label">Уроков</div>
          </div>
          <div class="profile-metric">
            <div class="profile-metric-value">${summary.words}</div>
            <div class="profile-metric-label">Слов</div>
          </div>
        </div>
        <div class="profile-summary">
          <div class="profile-summary-row">
            <span class="profile-summary-label">Специализации</span>
            <span class="profile-summary-value">${esc(summary.specs)}</span>
          </div>
          <div class="profile-summary-row">
            <span class="profile-summary-label">Сдано домашек</span>
            <span class="profile-summary-value">${summary.homework}</span>
          </div>
          <div class="profile-summary-row">
            <span class="profile-summary-label">Синхронизация</span>
            <span class="profile-summary-value">Локально</span>
          </div>
        </div>
        <div class="btn-row" style="margin-top:20px;">
          <button class="btn btn-gold" onclick="exportProgress()">Экспорт JSON</button>
          <label class="btn btn-ghost" for="progressImport">Импорт JSON</label>
          <input id="progressImport" type="file" accept="application/json,.json" onchange="importProgressFile(this)" style="display:none;">
          <button class="btn btn-ghost" onclick="goPage('settings')">Настройки</button>
        </div>
      </div>
    `;
  } else if (S.token) {
    form.style.display = 'none';
    profile.style.display = 'block';
    const summary = getProfileSummary();
    profile.innerHTML = `
      <div class="profile-panel">
        <div class="profile-hero">
          <div class="profile-avatar">${esc(avatarLetter(S.name))}</div>
          <div class="profile-copy">
            <div class="profile-title">Привет, ${esc(S.name || 'Пользователь')}!</div>
            <div class="profile-sub">Профиль подключён. Здесь можно быстро проверить прогресс и перейти в настройки.</div>
          </div>
        </div>
        <div class="profile-grid">
          <div class="profile-metric">
            <div class="profile-metric-value">${esc(S.level || 'A1')}</div>
            <div class="profile-metric-label">Уровень</div>
          </div>
          <div class="profile-metric">
            <div class="profile-metric-value">${S.points || 0}</div>
            <div class="profile-metric-label">Очки</div>
          </div>
          <div class="profile-metric">
            <div class="profile-metric-value">${summary.lessons}</div>
            <div class="profile-metric-label">Уроков</div>
          </div>
          <div class="profile-metric">
            <div class="profile-metric-value">${summary.words}</div>
            <div class="profile-metric-label">Слов</div>
          </div>
        </div>
        <div class="profile-summary">
          <div class="profile-summary-row">
            <span class="profile-summary-label">Специализации</span>
            <span class="profile-summary-value">${esc(summary.specs)}</span>
          </div>
          <div class="profile-summary-row">
            <span class="profile-summary-label">Сдано домашек</span>
            <span class="profile-summary-value">${summary.homework}</span>
          </div>
          <div class="profile-summary-row">
            <span class="profile-summary-label">Статус</span>
            <span class="profile-summary-value">Аккаунт подключён</span>
          </div>
        </div>
        <div class="btn-row" style="margin-top:20px;">
          <button class="btn btn-ghost" onclick="goPage('settings')">Открыть настройки</button>
          <button class="btn btn-gold" onclick="goPage('dashboard')">На главную</button>
          <button class="btn btn-red" onclick="logoutUser()">Выйти</button>
        </div>
      </div>
    `;
  } else {
    form.style.display = 'block';
    profile.style.display = 'none';
    profile.innerHTML = '';
  }
}

function exportProgress() {
  const payload = {
    ...S,
    token: null,
    apiUrl: '',
    staticMode: true,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deutsch-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  toast('✓ Прогресс экспортирован');
}

function importProgressFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeState(JSON.parse(reader.result));
      imported.staticMode = true;
      imported.apiUrl = '';
      imported.token = null;
      S = imported;
      saveS();
      toast('✓ Прогресс импортирован');
      initApp();
      goPage('dashboard');
    } catch {
      toast('Не удалось импортировать JSON');
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}

async function loginUser() {
  if (!hasBackend()) return toast('В статической версии вход отключён');

  const localSnapshot = {
    name: S.name,
    level: S.level,
    points: S.points,
    completedLessons: [...S.completedLessons],
    vocabProgress: { ...S.vocabProgress },
    specs: [...S.specs],
    hwDone: { ...S.hwDone },
    hwAnswers: { ...S.hwAnswers },
  };
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!email || !password) return toast('Заполните все поля');

  const status = document.getElementById('loginStatus');
  status.textContent = 'Вход...';
  const res = await apiRequest('/login', { email, password }, 'POST');

  if (res && res.token) {
    S.token = res.token;
    S.name = localSnapshot.name || res.user.username;
    S.level = localSnapshot.level || res.user.level;
    S.points = Math.max(localSnapshot.points || 0, res.user.points || 0);
    S.completedLessons = [...new Set([...localSnapshot.completedLessons])];
    S.vocabProgress = { ...localSnapshot.vocabProgress };
    S.specs = [...localSnapshot.specs];
    S.hwDone = { ...localSnapshot.hwDone };
    S.hwAnswers = { ...localSnapshot.hwAnswers };
    saveS();
    await syncLocalDataToBackend();
    toast('✅ Вход выполнен');
    await initApp();
    return;
  }

  status.textContent = res?.error || 'Ошибка входа';
}

async function registerUser() {
  if (!hasBackend()) return toast('В статической версии регистрация отключена');

  const localSnapshot = {
    name: S.name,
    level: S.level,
    points: S.points,
    completedLessons: [...S.completedLessons],
    vocabProgress: { ...S.vocabProgress },
    specs: [...S.specs],
    hwDone: { ...S.hwDone },
    hwAnswers: { ...S.hwAnswers },
  };
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!email || !password) return toast('Заполните все поля');

  const status = document.getElementById('loginStatus');
  status.textContent = 'Регистрация...';
  const res = await apiRequest('/register', { username: email.split('@')[0], email, password }, 'POST');

  if (res && res.token) {
    S.token = res.token;
    S.name = localSnapshot.name || res.user.username;
    S.level = localSnapshot.level || res.user.level;
    S.points = Math.max(localSnapshot.points || 0, res.user.points || 0);
    S.completedLessons = [...new Set([...localSnapshot.completedLessons])];
    S.vocabProgress = { ...localSnapshot.vocabProgress };
    S.specs = [...localSnapshot.specs];
    S.hwDone = { ...localSnapshot.hwDone };
    S.hwAnswers = { ...localSnapshot.hwAnswers };
    saveS();
    await syncLocalDataToBackend();
    toast('✅ Регистрация успешна');
    await initApp();
    return;
  }

  status.textContent = res?.error || 'Ошибка регистрации';
}

function logoutUser() {
  if (!hasBackend()) return;

  S.token = null;
  saveS();
  toast('Выход выполнен');
  renderLogin();
  initApp();
}

async function syncFromBackend() {
  if (!hasBackend()) return;

  const profile = await apiRequest('/profile');
  if (profile && !profile.error) {
    S.name = profile.username || S.name;
    S.level = profile.level || S.level;
    S.points = typeof profile.points === 'number' ? profile.points : S.points;
  }

  const progress = await apiRequest('/progress');
  if (Array.isArray(progress)) {
    progress.forEach((item) => {
      if (item.completed && !S.completedLessons.includes(item.lesson_id)) {
        S.completedLessons.push(item.lesson_id);
      }
    });
  }

  const vocab = await apiRequest('/vocab_progress');
  if (Array.isArray(vocab)) {
    vocab.forEach((item) => {
      S.vocabProgress[item.word] = { level: item.level, nextReview: item.next_review };
    });
  }

  saveS();
}
