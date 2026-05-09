---
inclusion: always
---

# DEUTSCH.app — Обзор проекта для Kiro

> Полная документация проекта в одном steering-файле. Kiro должен учитывать это при любых изменениях.

## 1. Что это такое

**DEUTSCH.app** — веб-приложение для изучения немецкого языка по методике CEFR (A1–B2).

- **Репозиторий:** `InnerEine/deutsch-app`
- **Хостинг:** GitHub Pages (`innereine.github.io/deutsch-app`)
- **Стек:** HTML + CSS + ванильный JS, Firebase (Auth + Realtime DB), Gemini API, Web Speech API
- **Цель:** Научить немецкому через input → output, с AI-генерацией уроков и AI-проверкой текста

## 2. Реальная файловая структура

```
deutsch-app/
├── backend/                      # Python Flask для AI-прокси (опционально)
│   ├── app.py
│   └── requirements.txt
└── deutsch-project/              # статический фронтенд — основной код
    ├── index.html                # вся разметка + большая часть JS (~14k строк)
    ├── css/style.css
    ├── js/
    │   ├── boot.js               # инициализация
    │   ├── config.js             # DEUTSCH_CONFIG: staticMode, apiUrl, geminiApiKey
    │   ├── state.js              # S + localStorage
    │   ├── data.js               # SPECIALIZATIONS, LEVEL_TEST, lessonsData, GENERAL_LESSONS, vocabularyData
    │   ├── app.js                # initApp, updateDash, renderPlan
    │   ├── onboarding.js         # тест уровня, выбор специализации
    │   └── practice.js           # AI-собеседник по сценариям
    ├── sw.js                     # service worker (PWA)
    ├── manifest.json             # PWA-манифест
    └── smoke-test.js             # дымовые E2E-тесты
```

ВАЖНО: документация иногда говорит «весь код в одном index.html» — это устарело. Код распределён по модулям js/*.js, но много логики всё ещё в `index.html` (inline `<script>`).

## 3. Модель данных (state)

**localStorage-ключ `daz3`** содержит объект `S`:

```
name, specs[], level, levelScore, completedLessons[],
hwDone{}, hwAnswers{}, onboardingDone, points, xp,
streakCount, lastStudyDate, dailyStats{}, achievements[],
aiCleanStreak, theme, badges[], vocabProgress{},
staticMode, apiUrl, token
```

Плюс отдельные ключи: `xp`, `streak`, `achievements`, `theme`, `lastStudyDate`,
`userLevel`, `currentLevel`, `currentBlock`, `currentLesson`, `planProgress`,
`lesson_${key}` (кэш уроков Gemini), и др.

## 4. Firebase

- Auth: email/пароль, Google, анонимный, сброс пароля
- Realtime DB: `/users/{uid}/profile`, `/progress`, `/planProgress`, `/vocabulary`, `/diary`, `/favorites`, `/errorHistory`, `/weeklyReports`, `/chat/{room}`

Конфиг firebase зашит в `index.html`. НЕ коммитить в новые файлы.

## 5. Gemini API

- Модель: `gemini-2.5-flash` (ранее — `1.5-flash`)
- Endpoint: `generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
- Ключ зашит в коде (`GEMINI_API_KEY` в index.html) — НЕ показывать поле ввода ключа в UI настроек
- `temperature: 0.7` для уроков, `0.3` для проверки текста

## 6. Критические правила (МАСТ)

### 6.1 Имена персонажей
- **НЕ использовать «Azamat» / «Азамат»** нигде: ни в хардкоде примеров, ни в промптах, ни в fallback-именах.
- Разрешённые персонажи в примерах уроков и AI-диалогах:
  `Lena`, `Thomas`, `Sarah`, `Markus`, `Anna`, `Max`
  или роли: `Журналист`, `Студент`, `Arzt`, `Kellner`, `Lehrer`.
- Fallback-обращение к пользователю (если имя не задано): «Freund» / «друг».

### 6.2 Стоп-слова (не добавлять в словарь)
Список хранится в `index.html` как `stopWords`. Расширять его нужно по списку:
артикли, местоимения, предлоги, союзы, вспомогательные глаголы, служебные частицы.

### 6.3 Методика обучения
- Input первичен (70% времени — чтение/слушание), output (30%) — письмо
- Грамматика через паттерны (примеры → правило, не наоборот)
- Spaced Repetition (Leitner) для словаря
- Урок = 5 шагов: объяснение → диалог → упражнения → слова → письмо

### 6.4 Уровни CEFR и блоки
```
A1: Кто я? / Семья / Город / Еда / Время
    грамматика: sein, haben, Akkusativ, Nominativ, Präteritum
A2: Работа / Квартира / Здоровье / Путешествия / Чувства
    грамматика: Perfekt, Dativ, Modalverben, Komparativ, Konjunktionen
B1: Медиа / Карьера / Экология / История / Общество
    грамматика: Konjunktiv II, Passiv, Infinitiv, Plusquamperfekt, Konjunktiv I
B2: Политика / Экономика / Наука / Искусство / Философия
    грамматика: Nominalstil, Partizipien, Konzessiv, Modalpartikeln
```

### 6.5 XP пороги уровней
```
A1: 0 XP / A2: 200 / B1: 500 / B2: 1000 / C1: 2000
```

## 7. Дизайн-токены

### Темы (в `:root` / `[data-theme]`)
- **Тёмная (по умолчанию):** bg `#0A0A0A`, accent `#F5C518`, text `#FFFFFF`
- **Светлая:** bg `#FFFFFF`, accent `#F5C518`, text `#111111`
- **Фиолетовая:** bg `#0D0A1A`, accent `#A855F7`

### Цвет слов по уровню (цвет букв + подчёркивание, НЕ фон)
```
A1 #9CA3AF · A2 #A78BFA · B1 #60A5FA · B2 #34D399 · C1 #FBBF24 · C2 #F87171
```

### Компоненты
- Карточки: `border-radius: 14px`, `padding: 18px 20px`, hover: translateY(-2px)
- Кнопки PRIMARY: accent bg, `border-radius: 10px`, `min-height: 44px` мобиль
- Bottom sheet: `bottom: 64px` (над таббаром), `border-radius: 20px 20px 0 0`

## 8. Геймификация

### XP
- Урок +10 / Тест блока +50 (+25 с первой попытки) / Экзамен +200 (+100 с первой) /
  Слово +2 / Карточка «Знаю» +2 / Запись дневника +15 (+10 с грамматикой) /
  Статья +20 / Раздел +50

### Достижения (6)
- Первый шаг, Первое слово, Неделя подряд (7 дней), 10 уроков, Полиглот (10 реплик без ошибок), Знаток (50 слов)

## 9. Промпт для Gemini (уроки и проверка)

Правила для LLM-генерации уроков:
- Диалог строго по теме блока
- Упражнения строго по грамматике урока
- Минимум 6 реплик в диалоге
- Минимум 8 слов в словаре урока
- Каждое слово с переводом RU И EN
- Грамматические формы в `<b>` тегах
- **Никогда** не использовать имя «Azamat»

Полный JSON-формат промптов — в разделе `7.1` / `7.2` / `7.3` оригинальной доки (при
необходимости, см. историю чата).

## 10. Приоритеты работ (дорожная карта)

### Этап 1 — критические баги (в работе)
- [x] Убрать поле Gemini API Key из UI (поля в UI нет; ключ зашит в коде)
- [x] Убрать хардкод «Azamat» из всех промптов, примеров, fallback-имён
- [x] Результат теста применяется к плану (`startPlanFromDetectedLevel` + safety net в `finishOnboarding`)
- [x] Убран старый линейный план (`APP_LESSONS` остался только для онбординг-рекомендации; основная страница плана рендерит `planData` через `renderPlanMain`)
- [x] Прогресс-бар показывает текущий уровень (единый источник — `getUserLevel()`)
- [x] Стоп-слова расширены, проверка `isStopWord` добавлена в `addManualDictionaryWord` и `ensureArticleWordsInVocab`

### Этап 2 — уроки через Gemini
- [ ] Объяснение грамматики перед уроком
- [ ] Упражнения строго по материалу урока
- [ ] AI-проверка текста через Gemini (дневник, письмо)
- [ ] Кэш уроков: генерировать один раз

### Этап 3 — словарь
- [ ] germanDict подключён везде
- [ ] Перевод RU+EN для всех слов
- [ ] Убрать «из статьи» из карточки

### Этап 4 — мобиль и UX
- [ ] Таббар стабильно реагирует на touch
- [ ] Чат: поле ввода не перекрывает сообщения
- [ ] Практика: компактные иконки-кнопки, полный перевод

### Этап 5 — новые функции
- [ ] Еженедельный AI-отчёт через Gemini
- [ ] Больше статей в Чтении (3–5 на раздел)
- [ ] Фильтр карточек по теме/статье
- [ ] ElevenLabs озвучка (платно)

## 11. Правила для Kiro при работе с этим проектом

1. **Не создавать новые README / markdown-файлы** без явной просьбы.
2. Перед правкой — читать соответствующий модуль целиком, не догадываться.
3. Изменения в `index.html` делать минимальные и локальные — файл огромный.
4. Никогда не коммитить ключи API в новые файлы; Firebase-ключ и Gemini-ключ уже
   в `index.html` — трогать не нужно.
5. Следовать методике: примеры → правило, input → output, без имени Azamat.
6. Избегать emoji в новом коде, если пользователь явно не просит.
7. Push всегда в новую ветку, PR в `main`.
