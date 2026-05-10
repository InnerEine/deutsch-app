# Deutsch App Backend

Flask API для фронтенда `deutsch-project`.

## Что есть

- JWT-регистрация и вход
- синхронизация прогресса уроков
- синхронизация интервального повторения слов
- профиль пользователя: имя, уровень, очки
- AI-прокси для диалогов, генерации уроков и проверки домашки через Ollama или Gemini
  (ключ Gemini никогда не попадает в браузер — он хранится только в env-переменных сервера)

## Локальный запуск

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

По умолчанию сервер стартует на `http://127.0.0.1:5000`.

## Запуск Ollama (опционально)

Установи Ollama и запусти локальную модель:

```bash
ollama run gemma3
```

По умолчанию backend ожидает Ollama на `http://127.0.0.1:11434`.

## Деплой на Render (бесплатно)

1. Залей репозиторий на GitHub (уже сделано: `InnerEine/deutsch-app`).
2. Зарегистрируйся на https://render.com, подключи свой GitHub-аккаунт.
3. Нажми **New → Blueprint**, выбери репозиторий. Render прочитает `render.yaml`
   из корня и предложит создать сервис `deutsch-app-backend`.
   Если `render.yaml` не используешь — создай вручную **New → Web Service**:
   - Runtime: Python
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
   - Plan: Free
4. В разделе **Environment** добавь переменные:
   - `AI_PROVIDER=gemini`
   - `GEMINI_API_KEY=<твой_новый_ключ>` (создай в https://aistudio.google.com/app/apikey)
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `JWT_SECRET_KEY=<случайная_строка>` (Render сгенерирует сам при Blueprint)
   - `CORS_ORIGINS=https://innereine.github.io` (или `*` на время отладки)
5. Нажми **Deploy**. Через 2–3 минуты получишь URL вида
   `https://deutsch-app-backend.onrender.com`.
6. Проверь: открой в браузере `https://<твой-url>/api/health` — должен вернуться
   JSON со статусом `ok` и `gemini_configured: true`.

### Подключение фронтенда

В `deutsch-project/js/config.js` укажи адрес backend'а:

```js
window.DEUTSCH_CONFIG = {
  staticMode: true,                                    // аккаунты не обязательны
  apiUrl: 'https://deutsch-app-backend.onrender.com',  // <- сюда URL из Render
  geminiApiKey: '',                                    // не используется, оставить пустым
};
```

Запушь изменения — GitHub Pages сам пересоберёт сайт.

### Про «засыпание» free-инстанса

Бесплатный Render усыпляет сервис после 15 минут простоя, первый запрос после сна
идёт ~1 минуту. Если хочется держать бодрым — подключи бесплатный cron (например,
https://cron-job.org) и пингуй `/api/health` каждые 10 минут.

## Переменные окружения

- `JWT_SECRET_KEY` — секрет для JWT
- `DATABASE_URL` — строка подключения к БД, по умолчанию SQLite (на Render данные
  не переживают перезапуск — подключи Render PostgreSQL или Neon, если нужна
  синхронизация аккаунтов)
- `CORS_ORIGINS` — список разрешённых origin'ов через запятую (`*` по умолчанию)
- `AI_PROVIDER` — `ollama` или `gemini`
- `OLLAMA_BASE_URL` — адрес Ollama API, по умолчанию `http://127.0.0.1:11434`
- `OLLAMA_MODEL` — локальная модель, по умолчанию `gemma3`
- `OLLAMA_KEEP_ALIVE` — сколько держать модель загруженной, по умолчанию `10m`
- `OLLAMA_TIMEOUT` — таймаут AI-запроса в секундах
- `GEMINI_API_KEY` — ключ Gemini, нужен при `AI_PROVIDER=gemini`
- `GEMINI_MODEL` — модель Gemini, по умолчанию `gemini-2.5-flash`
- `GEMINI_TIMEOUT` — таймаут Gemini-запроса в секундах
- `FLASK_HOST`, `FLASK_PORT`, `FLASK_DEBUG` — параметры запуска Flask

Если выбранный AI-провайдер не настроен или недоступен, приложение продолжит
работать, но AI-диалоги и AI-проверка домашки будут возвращать понятную ошибку с backend.

## API

- `GET  /api/health`
- `POST /api/register`
- `POST /api/login`
- `GET|PATCH /api/profile`
- `GET|POST  /api/progress`
- `GET|POST  /api/vocab_progress`
- `POST /api/analytics`
- `POST /api/push_subscribe`
- `POST /api/ai/chat`               — диалоговая практика (system + history + message)
- `POST /api/ai/generate`           — универсальный prompt → text (генерация уроков, проверка текста)
- `POST /api/ai/homework-feedback`  — проверка домашки
