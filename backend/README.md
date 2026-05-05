# Deutsch App Backend

Flask API для фронтенда `deutsch-project`.

## Что есть

- JWT-регистрация и вход
- синхронизация прогресса уроков
- синхронизация интервального повторения слов
- профиль пользователя: имя, уровень, очки
- AI-прокси для диалогов и проверки домашки через локальный Ollama

## Запуск

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

По умолчанию сервер стартует на `http://127.0.0.1:5000`.

## Запуск Ollama

Установи Ollama для Windows и запусти локальную модель:

```bash
ollama run gemma3
```

По умолчанию backend ожидает Ollama на `http://127.0.0.1:11434`.

## Переменные окружения

- `JWT_SECRET_KEY` — секрет для JWT
- `DATABASE_URL` — строка подключения к БД, по умолчанию используется SQLite
- `AI_PROVIDER` — сейчас поддерживается `ollama`
- `OLLAMA_BASE_URL` — адрес Ollama API, по умолчанию `http://127.0.0.1:11434`
- `OLLAMA_MODEL` — локальная модель, по умолчанию `gemma3`
- `OLLAMA_KEEP_ALIVE` — сколько держать модель загруженной, по умолчанию `10m`
- `OLLAMA_TIMEOUT` — таймаут AI-запроса в секундах
- `FLASK_HOST`, `FLASK_PORT`, `FLASK_DEBUG` — параметры запуска Flask

Если Ollama не запущен или модель не загружена, приложение продолжит работать, но AI-диалоги и AI-проверка домашки будут возвращать понятную ошибку с backend.

## API

- `GET /api/health`
- `POST /api/register`
- `POST /api/login`
- `GET|PATCH /api/profile`
- `GET|POST /api/progress`
- `GET|POST /api/vocab_progress`
- `POST /api/analytics`
- `POST /api/push_subscribe`
- `POST /api/ai/chat`
- `POST /api/ai/homework-feedback`
