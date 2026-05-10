// Настройки фронтенда.
//
// apiUrl: адрес backend'а, где развёрнут Flask-сервер (например, Render).
//   Пример: 'https://deutsch-app-backend.onrender.com'
//   Пустая строка = static-режим без AI.
//
// staticMode: если true, фронтенд работает без аккаунтов/синхронизации.
//   AI-запросы всё равно будут идти на apiUrl, если он задан.
//
// geminiApiKey: больше не используется и оставлено для обратной совместимости.
//   Ключ Gemini должен храниться в переменной окружения GEMINI_API_KEY на сервере.
window.DEUTSCH_CONFIG = {
  staticMode: true,
  apiUrl: '',
  geminiApiKey: '',
};
