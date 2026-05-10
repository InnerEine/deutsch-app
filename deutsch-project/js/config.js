// Настройки фронтенда.
//
// apiUrl: адрес backend'а, где развёрнут Flask-сервер (например, Render).
//   Пример: 'https://deutsch-app-backend.onrender.com'
//   Пустая строка = static-режим без AI.
//
// staticMode: если false И apiUrl задан — фронт ходит в backend (AI, синхронизация).
//   Если true — фронт работает полностью оффлайн на GitHub Pages, без AI.
//
// geminiApiKey: больше не используется и оставлено для обратной совместимости.
//   Ключ Gemini должен храниться в переменной окружения GEMINI_API_KEY на сервере.
window.DEUTSCH_CONFIG = {
  staticMode: false,
  apiUrl: 'https://deutsch-app-backend.onrender.com',
  geminiApiKey: '',
};
