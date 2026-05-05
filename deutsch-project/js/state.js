// ═══════════════════════════════════
// STATE — localStorage
// ═══════════════════════════════════

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
const BACKEND_CONFIG = window.DEUTSCH_CONFIG || {};
const CONFIG_API_URL = String(BACKEND_CONFIG.apiUrl || '').replace(/\/$/, '');

const DEFAULT_STATE = {
  name: 'Азамат',
  specs: [],
  level: 'A1',
  levelScore: 0,
  completedLessons: [],
  hwDone: {},
  hwAnswers: {},
  onboardingDone: false,
  points: 0,
  badges: [],
  vocabProgress: {}, // {word: {level: 0, nextReview: '2024-01-01'}}
  staticMode: !CONFIG_API_URL,
  apiUrl: CONFIG_API_URL, // Optional backend API URL. Empty means static-only release.
  token: null, // JWT token, only used when backend is connected.
};

function normalizeState(state) {
  const next = { ...DEFAULT_STATE, ...(state || {}) };
  next.specs = Array.isArray(next.specs) ? next.specs : [];
  next.completedLessons = Array.isArray(next.completedLessons) ? next.completedLessons : [];
  next.hwDone = next.hwDone && typeof next.hwDone === 'object' ? next.hwDone : {};
  next.hwAnswers = next.hwAnswers && typeof next.hwAnswers === 'object' ? next.hwAnswers : {};
  next.badges = Array.isArray(next.badges) ? next.badges : [];
  next.vocabProgress = next.vocabProgress && typeof next.vocabProgress === 'object' ? next.vocabProgress : {};

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

function saveS(){ localStorage.setItem('daz3',JSON.stringify(S)); }

let S = loadS();
