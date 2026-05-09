# Deutsch.app — статическое приложение для немецкого

Персональное приложение для изучения немецкого с тестом уровня, профессиональными терминами, домашними заданиями, интервальным повторением и PWA/offline-режимом. Основной релиз работает как статический сайт без личного сервера.

## Структура проекта

```
deutsch-project/
├── index.html          # Главный файл — вся HTML-разметка
├── css/
│   └── style.css       # Все стили (переменные, компоненты, адаптив)
├── js/
│   ├── data.js         # Данные: уроки, словарь, сценарии, специальности
│   ├── state.js        # Состояние приложения (localStorage)
│   ├── onboarding.js   # Онбординг + тест уровня
│   ├── app.js          # Основная логика: dashboard, план, задания, словарь
│   ├── practice.js     # AI-диалоговый тренажёр (через backend + Ollama/Gemini)
│   └── boot.js         # Инициализация приложения
├── manifest.json       # PWA манифест
├── sw.js               # Service Worker для офлайн
└── README.md

backend/                 # опционально, не нужен для static-only релиза
├── app.py              # Flask API с авторизацией и синхронизацией
├── requirements.txt    # Зависимости Python
├── instance/deutsch_app.db # локальная SQLite база данных
└── README.md
```

## Запуск static-only версии

```bash
cd deutsch-project
python -m http.server 8000
```

Открой http://localhost:8000 в браузере.

Такой режим можно выкладывать на GitHub Pages, Netlify, Vercel, Cloudflare Pages или любой static hosting.

## Публикация на GitHub Pages

В репозитории уже есть GitHub Actions workflow `.github/workflows/pages.yml`. Он публикует содержимое папки `deutsch-project` на GitHub Pages после каждого push в ветку `main`.

Первый запуск:

```bash
git init
git add .
git commit -m "Initial static-only release"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

В настройках GitHub repo открой `Settings -> Pages` и выбери `Build and deployment -> Source: GitHub Actions`.

Работает без backend:
- онбординг и тест уровня;
- уроки, квизы, словарь и разговорник;
- домашние задания локально;
- интервальное повторение;
- PWA/offline;
- экспорт/импорт прогресса JSON.

Для генерации новых уроков Gemini в static-only режиме ключ вводится в настройках приложения и хранится только в localStorage браузера. Если ключ не задан, уроки открываются в офлайн-режиме.

Backend нужен только для аккаунтов, синхронизации между устройствами и AI через Ollama или Gemini.

## Опциональный запуск с backend

Если когда-нибудь понадобится вернуть аккаунты, синхронизацию и AI, укажи backend API в `js/config.js`:

```js
window.DEUTSCH_CONFIG = {
  staticMode: false,
  apiUrl: 'https://your-api.example.com/api',
};
```

### 1. Запуск бэкенда
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app.py
```
Бэкенд запустится на http://127.0.0.1:5000

### 2. Запуск Ollama или Gemini для AI
```bash
ollama run gemma3
```
Ollama по умолчанию поднимает локальный API на http://127.0.0.1:11434

Для Gemini запусти backend с переменными:

```bash
set AI_PROVIDER=gemini
set GEMINI_API_KEY=your_key_here
python app.py
```

### 3. Запуск фронтенда
```bash
cd deutsch-project
python -m http.server 8000
```
Открой http://localhost:8000 в браузере.

### 4. AI-функции
- AI-диалоги и AI-проверка домашки идут через backend в локальный Ollama или Gemini.
- Если AI-провайдер не настроен, приложение всё равно работает, но AI-практика и AI-фидбек будут недоступны.

### 5. Синхронизация
- Перейди в "Аккаунт" → зарегистрируйся или войди.
- Прогресс будет синхронизироваться с бэкендом.

## Что реализовано

- [x] Онбординг: имя → специальность → тест уровня → персональный план
- [x] Тест уровня (10 вопросов, определяет A1/A2/B1/B2)
- [x] 20 уроков (A1-A2) + профессиональные уроки по специальностям (~400 слов)
- [x] Квизы с разблокировкой следующего урока
- [x] Домашние задания с локальным сохранением и опциональной AI-проверкой через backend
- [x] Словарь с аудио и фильтрацией
- [x] Разговорник
- [x] AI-диалоговый тренажёр (9 сценариев, опционально через backend + Ollama/Gemini)
- [x] Интервальное повторение (Leitner system)
- [x] PWA (офлайн, установка)
- [x] Настройки профиля + геймификация (очки)
- [x] Static-only режим без личного сервера
- [x] Экспорт/импорт прогресса JSON
- [x] Опциональный бэкенд: авторизация, синхронизация прогресса, аналитика
- [x] localStorage + опциональная API синхронизация

## Специальности

| ID | Название | Терминов |
|----|----------|----------|
| `it` | IT / Сисадмин | 20 |
| `med` | Медицина | 15 |
| `fin` | Финансы | 13 |
| `biz` | Бизнес | 12 |
| `law` | Право | 14 |
| `eng` | Инженерия | 11 |

## AI Сценарии

| Сценарий | Специальность | Сложность |
|----------|--------------|-----------|
| Знакомство с коллегой | Общий | A1 |
| В кафе | Общий | A1 |
| Спросить дорогу | Общий | A2 |
| IT: Отчёт об инциденте | IT | A2 |
| IT: Техподдержка | IT | A1 |
| IT: Собеседование | IT | B1 |
| Финансы: В банке | Финансы | A2 |
| Бизнес: Переговоры | Бизнес | B1 |
| Медицина: У врача | Медицина | A2 |

## Технологии

- Vanilla HTML/CSS/JS — без фреймворков
- Ollama (`gemma3` по умолчанию) или Gemini (`gemini-2.5-flash`) — AI-диалоги через backend
- localStorage — хранение прогресса
- Google Fonts (Space Grotesk, Syne, IBM Plex Mono)
- Flask + SQLAlchemy — бэкенд
- Web Speech API — аудио
- Service Worker — PWA

## Релизная проверка

```bash
cd deutsch-project
node --check js\data.js
node --check js\state.js
node --check js\onboarding.js
node --check js\app.js
node --check js\practice.js
node smoke-test.js
```

Для опционального backend дополнительно:

```bash
cd backend
python -m py_compile app.py
```

Если backend будет включён в production, задай `JWT_SECRET_KEY`, при необходимости `CORS_ORIGINS`, `DATABASE_URL`, `FLASK_DEBUG=0`. Для Gemini добавь `AI_PROVIDER=gemini` и `GEMINI_API_KEY`.

## Переменные CSS

```css
--bg: #07080a          /* основной фон */
--gold: #f0c060        /* акцентный цвет */
--green: #3dd68c       /* успех */
--teal: #2dd4bf        /* AI практика */
--red: #f05555         /* ошибки */
--muted: #5a5f70       /* второстепенный текст */
```
