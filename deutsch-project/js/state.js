// ═══════════════════════════════════
// STATE — localStorage
// ═══════════════════════════════════

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
const BACKEND_CONFIG = window.DEUTSCH_CONFIG || {};
const CONFIG_API_URL = String(BACKEND_CONFIG.apiUrl || '').replace(/\/$/, '');

const DEFAULT_STATE = {
  name: '',
  specs: [],
  level: 'A1',
  levelScore: 0,
  completedLessons: [],
  hwDone: {},
  hwAnswers: {},
  onboardingDone: false,
  points: 0,
  xp: 0,
  streakCount: 0,
  lastStudyDate: '',
  dailyStats: {},
  achievements: [],
  aiCleanStreak: 0,
  theme: 'dark',
  badges: [],
  vocabProgress: {}, // {word: {level: 0, nextReview: '2024-01-01'}}
  staticMode: !CONFIG_API_URL,
  apiUrl: CONFIG_API_URL, // Optional backend API URL. Empty means static-only release.
  token: null, // JWT token, only used when backend is connected.
};

function readJSONKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readNumberKey(keys, fallback = 0) {
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw !== null && raw !== '') {
      const value = Number(raw);
      if (Number.isFinite(value)) return value;
    }
  }
  return fallback;
}

function normalizeState(state) {
  const next = { ...DEFAULT_STATE, ...(state || {}) };
  next.specs = Array.isArray(next.specs) ? next.specs : [];
  next.completedLessons = Array.isArray(next.completedLessons) ? next.completedLessons : [];
  next.hwDone = next.hwDone && typeof next.hwDone === 'object' ? next.hwDone : {};
  next.hwAnswers = next.hwAnswers && typeof next.hwAnswers === 'object' ? next.hwAnswers : {};
  next.badges = Array.isArray(next.badges) ? next.badges : [];
  next.achievements = Array.isArray(next.achievements) ? next.achievements : [];
  next.dailyStats = next.dailyStats && typeof next.dailyStats === 'object' ? next.dailyStats : {};
  next.vocabProgress = next.vocabProgress && typeof next.vocabProgress === 'object' ? next.vocabProgress : {};

  const storedAchievements = readJSONKey('achievements', []);
  next.achievements = [...new Set([
    ...next.achievements,
    ...next.badges,
    ...(Array.isArray(storedAchievements) ? storedAchievements : []),
  ])];
  next.badges = [...next.achievements];

  const storedXP = readNumberKey(['xp'], Number(next.xp || next.points || 0));
  next.xp = Math.max(Number(next.xp || 0), Number(next.points || 0), storedXP);
  next.points = next.xp;

  const storedStreak = readNumberKey(['streakCount', 'streak'], Number(next.streakCount || 0));
  next.streakCount = Math.max(0, storedStreak);
  next.lastStudyDate = localStorage.getItem('lastStudyDate') || localStorage.getItem('lastDate') || next.lastStudyDate || '';
  next.aiCleanStreak = Math.max(0, Number(next.aiCleanStreak || 0));
  next.theme = localStorage.getItem('theme') || next.theme || 'dark';

  if (CONFIG_API_URL && BACKEND_CONFIG.staticMode === false) {
    next.staticMode = false;
    next.apiUrl = CONFIG_API_URL;
  } else {
    next.staticMode = true;
    next.apiUrl = '';
    next.token = null;
  }

  return next;
}

function loadS() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem('daz3') || 'null'));
  } catch {
    return normalizeState(null);
  }
}

function syncContentStorage() {
  if (typeof vocabularyData !== 'undefined') localStorage.setItem('vocabulary', JSON.stringify(vocabularyData));
  if (typeof lessonsData !== 'undefined') localStorage.setItem('lessons', JSON.stringify(lessonsData));
}

function saveS(){
  S.xp = Math.max(Number(S.xp || 0), Number(S.points || 0));
  S.points = S.xp;
  S.achievements = Array.isArray(S.achievements) ? S.achievements : [];
  S.badges = [...S.achievements];
  localStorage.setItem('daz3',JSON.stringify(S));
  localStorage.setItem('xp', String(S.xp));
  localStorage.setItem('streak', String(S.streakCount || 0));
  localStorage.setItem('streakCount', String(S.streakCount || 0));
  localStorage.setItem('lastDate', S.lastStudyDate || '');
  localStorage.setItem('lastStudyDate', S.lastStudyDate || '');
  localStorage.setItem('achievements', JSON.stringify(S.achievements));
  localStorage.setItem('theme', S.theme || 'dark');
  syncContentStorage();
}

let S = loadS();
syncContentStorage();
