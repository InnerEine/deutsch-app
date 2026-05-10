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

const XP_THRESHOLDS = [
  { level: 'A1', xp: 0 },
  { level: 'A2', xp: 200 },
  { level: 'B1', xp: 500 },
  { level: 'B2', xp: 1000 },
  { level: 'C1', xp: 2000 },
];

const ACHIEVEMENTS = [
  { id: 'first_step', icon: '🌱', title: 'Первый шаг', desc: 'Пройти онбординг' },
  { id: 'first_word', icon: '📖', title: 'Первое слово', desc: 'Выучить первое слово' },
  { id: 'week_streak', icon: '🔥', title: 'Неделя подряд', desc: '7 дней стрика' },
  { id: 'ten_lessons', icon: '🏆', title: '10 уроков', desc: 'Завершить 10 уроков' },
  { id: 'polyglot', icon: '💬', title: 'Полиглот', desc: '10 реплик без ошибок' },
  { id: 'expert', icon: '🧠', title: 'Знаток', desc: 'Выучить 50 слов' },
];

function normalizeWord(word) {
  return {
    de: word.de,
    ru: word.ru,
    ex: word.ex || word.example || '',
    cat: word.cat || word.category || 'Everyday',
    example: word.example || word.ex || '',
    category: word.category || word.cat || 'Everyday',
  };
}

function lessonWordsFor(lesson) {
  if (Array.isArray(lesson.words) && lesson.words.length) return lesson.words.map(normalizeWord);
  const all = (typeof vocabularyData !== 'undefined' ? vocabularyData : []).map(normalizeWord);
  const categoryWords = all.filter((word) => word.cat === lesson.category);
  if (lesson.id === 'lesson-greetings') return categoryWords.slice(0, 8);
  if (lesson.id === 'lesson-numbers-time') return categoryWords.filter((word) => ['die Zeit', 'die Uhr', 'der Tag', 'die Woche', 'die Frage', 'die Antwort'].includes(word.de));
  return categoryWords.slice(0, 8);
}

function normalizeLesson(lesson, index = 0) {
  const quiz = (lesson.quiz || []).map((item) => ({
    ...item,
    q: item.q || item.question,
    opts: item.opts || item.options || [],
    a: Number.isInteger(item.a) ? item.a : item.correct,
  }));
  return {
    ...lesson,
    quiz,
    words: lessonWordsFor(lesson),
    de: lesson.de || (typeof lessonGermanTitles !== 'undefined' ? lessonGermanTitles[lesson.id] : '') || lesson.title,
    color: lesson.color || (typeof lessonColors !== 'undefined' ? lessonColors[index % lessonColors.length] : 'c-gold'),
    type: lesson.type || `${lesson.category || 'Everyday'} ${lesson.level || 'A1'}`,
  };
}

const REQUIRED_LESSONS = typeof lessonsData !== 'undefined' ? lessonsData.map(normalizeLesson) : [];
const APP_LESSONS = REQUIRED_LESSONS.length
  ? [...REQUIRED_LESSONS, ...GENERAL_LESSONS.filter((lesson) => !['g1', 'g2'].includes(lesson.id))]
  : GENERAL_LESSONS;

function uniqueLessons(list) {
  const seen = new Set();
  return list.filter((lesson) => {
    if (seen.has(lesson.id)) return false;
    seen.add(lesson.id);
    return true;
  });
}

function getAllSpecLessons() {
  return S.specs.flatMap((spec) => SPEC_LESSONS[spec] || []);
}

function getAllLessonsForProgress() {
  return uniqueLessons([...APP_LESSONS, ...GENERAL_LESSONS, ...getAllSpecLessons()]);
}

function getCompletedWordCount() {
  return getAllLessonsForProgress()
    .filter((lesson) => S.completedLessons.includes(lesson.id))
    .reduce((sum, lesson) => sum + lesson.words.length, 0);
}

function getLearnedWordSet() {
  const learned = new Set();
  getAllLessonsForProgress()
    .filter((lesson) => S.completedLessons.includes(lesson.id))
    .forEach((lesson) => lesson.words.forEach((word) => learned.add(word.de)));
  Object.entries(S.vocabProgress || {}).forEach(([word, progress]) => {
    if (progress && progress.level > 0) learned.add(word);
  });
  return learned;
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function dayDiff(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

function getTodayStats() {
  const key = todayKey();
  S.dailyStats = S.dailyStats && typeof S.dailyStats === 'object' ? S.dailyStats : {};
  S.dailyStats[key] = S.dailyStats[key] || { words: 0, lessons: 0, celebrated: false };
  return S.dailyStats[key];
}

function refreshStreakForMissedDay() {
  const today = todayKey();
  if (S.lastStudyDate && dayDiff(S.lastStudyDate, today) > 1) {
    S.streakCount = 0;
    saveS();
  }
}

function recordStudyActivity() {
  const today = todayKey();
  if (S.lastStudyDate === today) return;
  if (S.lastStudyDate && dayDiff(S.lastStudyDate, today) === 1) S.streakCount = (S.streakCount || 0) + 1;
  else S.streakCount = 1;
  S.lastStudyDate = today;
  saveS();
}

function addXP(amount, reason = '', anchor = null) {
  S.xp = Number(S.xp || S.points || 0) + amount;
  S.points = S.xp;
  saveS();
  if (anchor) showXPFloating(anchor, amount);
  updateHeaderLevel();
  checkAchievements();
  return S.xp;
}

function getXPLevelInfo() {
  const xp = Number(S.xp || S.points || 0);
  let current = XP_THRESHOLDS[0];
  let next = XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
  for (let i = 0; i < XP_THRESHOLDS.length; i += 1) {
    if (xp >= XP_THRESHOLDS[i].xp) {
      current = XP_THRESHOLDS[i];
      next = XP_THRESHOLDS[i + 1] || XP_THRESHOLDS[i];
    }
  }
  const span = Math.max(next.xp - current.xp, 1);
  const progress = current === next ? 100 : Math.max(0, Math.min(100, ((xp - current.xp) / span) * 100));
  return { xp, current, next, progress };
}

function updateHeaderLevel() {
  const levelInfo = getXPLevelInfo();
  const level = levelInfo.current.level;
  S.level = S.level || level;
  const hdrLevel = document.getElementById('hdrLevel');
  if (hdrLevel) hdrLevel.textContent = level;
}

function renderKPI(id, value, emptyText) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value > 0) {
    el.textContent = value;
    el.classList.remove('empty');
  } else {
    el.textContent = emptyText;
    el.classList.add('empty');
  }
}

function fireConfetti() {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.18 } });
  }
}

function showAchievementPopup(item) {
  const popup = document.createElement('div');
  popup.className = 'achievement-popup';
  popup.textContent = `Новое достижение! ${item.icon} ${item.title}`;
  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add('on'));
  fireConfetti();
  setTimeout(() => popup.classList.remove('on'), 3000);
  setTimeout(() => popup.remove(), 3400);
}

function checkAchievements() {
  const owned = new Set(S.achievements || []);
  const learnedWords = getLearnedWordSet().size;
  const checks = {
    first_step: !!S.onboardingDone,
    first_word: learnedWords >= 1,
    week_streak: (S.streakCount || 0) >= 7,
    ten_lessons: S.completedLessons.length >= 10,
    polyglot: (S.aiCleanStreak || 0) >= 10,
    expert: learnedWords >= 50,
  };
  ACHIEVEMENTS.forEach((item) => {
    if (checks[item.id] && !owned.has(item.id)) {
      owned.add(item.id);
      S.achievements = [...owned];
      saveS();
      showAchievementPopup(item);
    }
  });
  renderAchievements();
}

function renderAchievements() {
  const grid = document.getElementById('achievementsGrid');
  if (!grid) return;
  const owned = new Set(S.achievements || []);
  grid.innerHTML = ACHIEVEMENTS.map((item) => `
    <div class="ach-badge${owned.has(item.id) ? ' got' : ''}">
      <div class="ach-icon">${item.icon}</div>
      <div class="ach-title">${item.title}</div>
      <div class="ach-desc">${item.desc}</div>
    </div>
  `).join('');
}

function updateDailyGoal(type) {
  const stats = getTodayStats();
  if (type === 'word') stats.words = Math.min(10, (stats.words || 0) + 1);
  if (type === 'lesson') stats.lessons = Math.min(1, (stats.lessons || 0) + 1);
  const complete = stats.words >= 10 || stats.lessons >= 1;
  if (complete && !stats.celebrated) {
    stats.celebrated = true;
    setTimeout(fireConfetti, 150);
  }
  saveS();
}

function renderDailyGoal() {
  const el = document.getElementById('dailyGoal');
  if (!el) return;
  const stats = getTodayStats();
  const wordProgress = Math.min(100, ((stats.words || 0) / 10) * 100);
  const lessonProgress = Math.min(100, (stats.lessons || 0) * 100);
  const progress = Math.max(wordProgress, lessonProgress);
  const done = progress >= 100;
  const wordsLabel = stats.words ? `${stats.words}/10 слов` : 'слова ждут';
  const lessonLabel = stats.lessons ? '1/1 урок' : 'урок ждёт';
  const valueText = (stats.words || stats.lessons)
    ? `${wordsLabel} · ${lessonLabel}`
    : 'Начни урок или карточки 👇';
  el.classList.toggle('done', done);
  el.innerHTML = `
    <div class="daily-head">
      <span>Цель на сегодня</span>
      <span class="daily-value">${valueText}</span>
    </div>
    <div class="daily-bar"><div class="daily-fill" style="width:${progress}%"></div></div>
    <div class="daily-copy" style="margin-top:10px;">${done ? 'Цель выполнена. Отличный темп!' : 'Выучи 10 слов или заверши 1 урок, чтобы закрыть день.'}</div>
  `;
}

function showXPFloating(anchor, amount) {
  const target = anchor.closest ? anchor.closest('.rep-card') || anchor : anchor;
  if (!target) return;
  const float = document.createElement('div');
  float.className = 'xp-float';
  float.textContent = `+${amount} XP`;
  target.appendChild(float);
  setTimeout(() => float.remove(), 1000);
}

function applyTheme(theme) {
  S.theme = theme === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('dark', S.theme === 'dark');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = S.theme === 'dark' ? '☀️' : '🌙';
  saveS();
}

function toggleTheme() {
  applyTheme(S.theme === 'dark' ? 'light' : 'dark');
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
  applyTheme(S.theme || 'dark');
  refreshStreakForMissedDay();
  document.getElementById('hdrAvatar').textContent = avatarLetter(S.name);
  document.getElementById('hdrName').textContent = S.name || 'Azamat';
  updateHeaderLevel();
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
  checkAchievements();
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
  refreshStreakForMissedDay();
  const learnedWords = getLearnedWordSet().size;
  const completedLessons = S.completedLessons.length;
  const doneHW = Object.values(S.hwDone).filter(Boolean).length;
  renderKPI('kpi-words', learnedWords, 'Начни первый урок, чтобы слова появились здесь 👇');
  renderKPI('kpi-lessons', completedLessons, 'Открой урок ниже и заверши первый квиз 👇');
  renderKPI('kpi-hw', doneHW, 'Сдай первое задание в разделе “Задания” 👇');
  const streakEl = document.getElementById('kpi-streak');
  streakEl.textContent = (S.streakCount || 0) > 0 ? `🔥 ${S.streakCount} дней подряд` : 'Заверши урок сегодня, чтобы зажечь серию 👇';
  streakEl.classList.toggle('empty', !(S.streakCount > 0));

  const levelInfo = getXPLevelInfo();
  const xpPanel = document.getElementById('xpPanel');
  if (xpPanel) {
    xpPanel.innerHTML = `
      <div class="xp-head">
        <span>Прогресс уровня</span>
        <span class="xp-value">${levelInfo.xp} XP</span>
      </div>
      <div class="xp-route">
        <span>${levelInfo.current.level}</span>
        <div class="xp-bar"><div class="xp-fill" style="width:${levelInfo.progress}%"></div></div>
        <span>${levelInfo.next.level}</span>
      </div>
    `;
  }
  renderDailyGoal();
  renderAchievements();

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
        <div class="lvl-prog-fill" style="width:${isDone ? 100 : isCur ? Math.round((S.completedLessons.length / Math.max(APP_LESSONS.length, 1)) * 100) : 0}%"></div>
      </div>
    `;
    lt.appendChild(item);
  });

  const nextLesson = APP_LESSONS.find((lesson) => !S.completedLessons.includes(lesson.id));
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

  APP_LESSONS.forEach((lesson, index) => {
    const done = S.completedLessons.includes(lesson.id);
    const unlocked = done || index === 0 || S.completedLessons.includes(APP_LESSONS[index - 1]?.id);
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
    <div class="hw-stat"><div class="hw-sn" style="color:var(--green)">${done || 'пока нет'}</div><div class="hw-sl">Сдано</div></div>
    <div class="hw-stat"><div class="hw-sn" style="color:var(--muted)">${pending || 'всё чисто'}</div><div class="hw-sl">Активных</div></div>
    <div class="hw-stat"><div class="hw-sn" style="color:var(--red)">${overdue || 'нет'}</div><div class="hw-sl">Просрочено</div></div>
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
  addXP(5, 'homework');
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
  const primary = typeof vocabularyData !== 'undefined' ? vocabularyData.map(normalizeWord) : APP_LESSONS.flatMap((lesson) => lesson.words);
  const spec = S.specs.flatMap((specId) => SPEC_VOCAB[specId] || []).map(normalizeWord);
  const seen = new Set();
  return [...primary, ...spec].filter((word) => {
    const key = `${word.de}|${word.cat}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const lesson = [...APP_LESSONS, ...GENERAL_LESSONS, ...getAllSpecLessons()].find((item) => item.id === id);
  if (lesson) openLesson(lesson);
}

function openLesson(lesson) {
  QS = { lesson: normalizeLesson(lesson), phase: lesson.theory ? 'theory' : 'vocab', idx: 0, score: 0, answered: false };
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

  if (QS.phase === 'theory') {
    body.innerHTML = `
      <div class="lesson-theory">${esc(lesson.theory)}</div>
      <div class="btn-row">
        <button class="btn btn-gold" onclick="QS.phase='examples';renderModal()">Примеры →</button>
      </div>
    `;
    return;
  }

  if (QS.phase === 'examples') {
    body.innerHTML = `
      <div class="lesson-example-grid">
        ${(lesson.examples || []).map((item) => `
          <div class="lesson-example">
            <div class="lesson-example-de">${esc(item.de)}</div>
            <div class="lesson-example-ru">${esc(item.ru)}</div>
          </div>
        `).join('')}
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" onclick="QS.phase='theory';renderModal()">← Теория</button>
        <button class="btn btn-gold" onclick="QS.phase='quiz';QS.idx=0;QS.score=0;QS.answered=false;renderModal()">Квиз →</button>
      </div>
    `;
    return;
  }

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
    const passed = QS.score >= Math.ceil(quiz.length / 2);
    if (passed && !S.completedLessons.includes(lesson.id)) {
      S.completedLessons.push(lesson.id);
      recordStudyActivity();
      addXP(10, 'lesson');
      updateDailyGoal('lesson');
      saveS();
      syncProgress(lesson.id, true, QS.score);
      syncProfile();
    }
    body.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <span class="qz-score">${QS.score}/${quiz.length}</span>
        <div class="qz-msg">${passed ? 'УРОК ЗАВЕРШЁН · +10 XP' : 'ПОПРОБУЙ ЕЩЁ РАЗ'}</div>
        <div class="btn-row" style="justify-content:center;">
          ${!passed ? `<button class="btn btn-ghost" onclick="QS.idx=0;QS.score=0;QS.answered=false;renderModal()">Повторить</button>` : ''}
          <button class="btn btn-gold" onclick="closeModal();renderPlan();updateDash()">Готово</button>
        </div>
      </div>
    `;
    if (passed) toast(`🏆 Урок завершён: ${lesson.title}`);
    checkAchievements();
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
  if (selected === question.a) {
    QS.score += 1;
    addXP(5, 'quiz');
  }
  document.getElementById('qnxt').style.display = 'inline-flex';
}

function nextQ() {
  QS.idx += 1;
  QS.answered = false;
  renderModal();
}

let REP = { words: [], idx: 0 };

function getTodayWords(today) {
  const allWords = getAllVocab().map(normalizeWord);
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
  document.querySelectorAll('#repActions button').forEach((button) => { button.disabled = false; });
  document.querySelector('.rep-card').classList.remove('flipped', 'flash-correct', 'shake');
}

function flipCard() {
  document.getElementById('repBack').style.display = 'block';
  document.getElementById('repActions').style.display = 'flex';
  document.querySelector('.rep-card').classList.add('flipped');
}

function repAnswer(correct) {
  const word = REP.words[REP.idx];
  const card = document.querySelector('.rep-card');
  document.querySelectorAll('#repActions button').forEach((button) => { button.disabled = true; });
  const progress = S.vocabProgress[word.de] || { level: 0, nextReview: new Date().toISOString().split('T')[0] };
  progress.level = correct ? Math.min(progress.level + 1, 5) : Math.max(progress.level - 1, 0);

  const intervals = [1, 2, 4, 7, 14, 30];
  const next = new Date();
  next.setDate(next.getDate() + (intervals[progress.level] || 30));
  progress.nextReview = next.toISOString().split('T')[0];

  S.vocabProgress[word.de] = progress;
  recordStudyActivity();
  if (correct) {
    addXP(2, 'word', card);
    updateDailyGoal('word');
    if (card) {
      card.classList.remove('flash-correct');
      void card.offsetWidth;
      card.classList.add('flash-correct');
    }
  } else if (card) {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }
  saveS();
  syncVocabProgress(word.de, progress.level, progress.nextReview);

  setTimeout(() => {
    REP.idx += 1;
    if (REP.idx >= REP.words.length) {
      document.getElementById('repCard').style.display = 'none';
      document.getElementById('repDone').style.display = 'block';
    } else {
      showCard();
    }
    updateDash();
    checkAchievements();
  }, correct ? 650 : 380);
}

async function apiRequest(endpoint, data = null, method = 'GET') {
  if (!hasBackend()) {
    return { error: 'Backend is not connected in static-only mode.' };
  }

  // Backend serves all routes under /api/*. Add the prefix if the caller
  // didn't include it, so endpoints like '/ai/chat' resolve to '/api/ai/chat'.
  const path = endpoint.startsWith('/api/') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const url = `${S.apiUrl}${path}`;
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
  if (!email || !password) {
    toast('Заполните email и пароль');
    return;
  }

  const status = document.getElementById('loginStatus');
  status.textContent = 'Входим… сервер мог уснуть, это занимает до минуты';
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
    status.textContent = '';
    toast('✅ Вход выполнен');
    await initApp();
    return;
  }

  const message = res?.error || 'Ошибка входа. Попробуйте ещё раз';
  status.textContent = message;
  toast(message);
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
  if (!email || !password) {
    toast('Заполните email и пароль');
    return;
  }
  if (!/.+@.+\..+/.test(email)) {
    toast('Укажите корректный email, например name@example.com');
    return;
  }
  if (password.length < 6) {
    toast('Пароль должен быть не короче 6 символов');
    return;
  }

  const status = document.getElementById('loginStatus');
  status.textContent = 'Регистрируем… сервер мог уснуть, это занимает до минуты';
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
    status.textContent = '';
    toast('✅ Регистрация успешна');
    await initApp();
    return;
  }

  const message = res?.error || 'Ошибка регистрации. Попробуйте ещё раз';
  status.textContent = message;
  toast(message);
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
