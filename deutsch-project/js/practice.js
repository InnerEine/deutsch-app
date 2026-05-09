// AI PRACTICE - conversational trainer

const SCENARIOS = [
  {
    id: 's_greet',
    spec: 'general',
    icon: '👋',
    title: 'Знакомство',
    diff: 'easy',
    desc: 'Познакомься с немецким коллегой и коротко расскажи о себе.',
    tip: 'Используй: Hallo, ich bin... · Ich komme aus... · Ich arbeite als...',
    system: `Du bist ein freundlicher deutscher Kollege namens Klaus. Du sprichst nur Deutsch.
Der Lernende heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Führe ein natürliches Vorstellungsgespräch und stelle einfache Fragen zu Name, Herkunft und Beruf.
Wenn der Lernende Fehler macht, korrigiere freundlich im Format:
❌ Fehler: [falsch] → ✅ Richtig: [korrekt]
Antworte knapp, maximal 3 Sätze.`,
  },
  {
    id: 's_cafe',
    spec: 'general',
    icon: '☕',
    title: 'В кафе',
    diff: 'easy',
    desc: 'Закажи еду и напитки в немецком кафе.',
    tip: 'Используй: Ich möchte... · Wie viel kostet...? · Danke schön!',
    system: `Du bist ein Kellner in einem deutschen Café. Du sprichst nur Deutsch.
Der Gast heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Begrüße den Gast, stelle Rückfragen und nenne einfache Preise.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]
Antworte kurz, maximal 3 Sätze.`,
  },
  {
    id: 's_direction',
    spec: 'general',
    icon: '🗺️',
    title: 'Спросить дорогу',
    diff: 'med',
    desc: 'Попроси прохожего подсказать дорогу в немецком городе.',
    tip: 'Используй: Entschuldigung... · Wo ist...? · Wie komme ich zu...?',
    system: `Du bist ein hilfsbereiter Passant in einer deutschen Stadt. Du sprichst nur Deutsch.
Der Tourist heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Erkläre den Weg mit links, rechts, geradeaus, neben und gegenüber.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]
Antworte klar und kurz.`,
  },
  {
    id: 's_it_incident',
    spec: 'it',
    icon: '🖥️',
    title: 'IT: Отчёт об инциденте',
    diff: 'med',
    desc: 'Объясни руководителю, что случилось с сервером.',
    tip: 'Используй: Der Server ist ausgefallen · Die Verbindung ist unterbrochen · Wir haben eine Störung',
    system: `Du bist ein deutscher IT-Manager. Du sprichst nur Deutsch.
Der Mitarbeiter heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Frage nach Ursache, Zeitpunkt, betroffenen Systemen und nächsten Schritten.
Verwende IT-Wörter wie Netzwerk, Server, Firewall, Zugriff, Sicherung.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]`,
  },
  {
    id: 's_it_support',
    spec: 'it',
    icon: '📞',
    title: 'IT: Техподдержка',
    diff: 'easy',
    desc: 'Помоги пользователю решить простую IT-проблему.',
    tip: 'Используй: Haben Sie...? · Bitte starten Sie... · Das Kennwort ist...',
    system: `Du bist ein deutschsprachiger Benutzer mit einem IT-Problem. Du sprichst nur Deutsch.
Der Support-Mitarbeiter heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Beschreibe ein einfaches Problem mit Drucker oder Zugang und antworte auf Rückfragen.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]`,
  },
  {
    id: 's_it_interview',
    spec: 'it',
    icon: '💼',
    title: 'IT: Собеседование',
    diff: 'hard',
    desc: 'Собеседование на позицию сисадмина в немецкой компании.',
    tip: 'Используй: Ich habe Erfahrung mit... · Ich kann... · In meiner bisherigen Stelle...',
    system: `Du bist ein HR-Manager einer deutschen IT-Firma. Du sprichst nur Deutsch.
Der Bewerber heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Frage nach Erfahrung, Linux, Windows Server, Netzwerk, Motivation und Arbeitsweise.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]`,
  },
  {
    id: 's_bank',
    spec: 'fin',
    icon: '🏦',
    title: 'Финансы: В банке',
    diff: 'med',
    desc: 'Открой счёт в немецком банке.',
    tip: 'Используй: Ich möchte ein Konto eröffnen · die Rechnung · der Kredit',
    system: `Du bist ein Bankangestellter in Deutschland. Du sprichst nur Deutsch.
Der Kunde heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Hilf beim Eröffnen eines Kontos und frage nach Name, Adresse und Beschäftigung.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]`,
  },
  {
    id: 's_meeting',
    spec: 'biz',
    icon: '📊',
    title: 'Бизнес: Переговоры',
    diff: 'hard',
    desc: 'Обсуди условия контракта с немецким партнёром.',
    tip: 'Используй: Unser Angebot ist... · Wir schlagen vor... · Das Budget beträgt...',
    system: `Du bist ein deutscher Geschäftspartner in Vertragsverhandlungen. Du sprichst nur Deutsch.
Der Verhandlungspartner heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Diskutiere Preis, Lieferzeit und Zahlungsbedingungen in professionellem Ton.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]`,
  },
  {
    id: 's_doctor',
    spec: 'med',
    icon: '🏥',
    title: 'Медицина: У врача',
    diff: 'med',
    desc: 'Поговори с врачом о симптомах на немецком.',
    tip: 'Используй: Ich habe Schmerzen · Mir ist nicht gut · Seit wann...?',
    system: `Du bist ein Arzt in Deutschland. Du sprichst nur Deutsch.
Der Patient heißt ${S.name || 'Lernende/-r'} und lernt Deutsch auf Niveau ${S.level || 'A1'}.
Frage nach Symptomen, Dauer und möglichen Begleiterscheinungen.
Bei Fehlern: ❌ Fehler: [falsch] → ✅ Richtig: [korrekt]`,
  },
];

let activeScenario = null;
let chatHistory = [];
let isTyping = false;

function renderCleanCounter() {
  const el = document.getElementById('cleanCounter');
  if (el) el.textContent = `Реплик без ошибок: ${S.aiCleanStreak || 0} 🎯`;
}

function hasErrorMarkers(text) {
  return /❌|Fehler|ошиб|неправильно|falsch|incorrect/i.test(text || '');
}

function updateCleanStreak(aiReply) {
  if (hasErrorMarkers(aiReply)) S.aiCleanStreak = 0;
  else S.aiCleanStreak = (S.aiCleanStreak || 0) + 1;
  saveS();
  renderCleanCounter();
  addMessage('system', `Реплик без ошибок: ${S.aiCleanStreak} 🎯`);
  if (typeof checkAchievements === 'function') checkAchievements();
}

function getRelevantScenarios() {
  return SCENARIOS.filter((scenario) => scenario.spec === 'general' || S.specs.includes(scenario.spec));
}

function renderScenarios() {
  const grid = document.getElementById('scenarioGrid');
  if (!grid) return;

  grid.innerHTML = '';
  if (typeof hasBackend === 'function' && !hasBackend()) {
    grid.innerHTML = `
      <div class="profile-panel" style="grid-column:1/-1;">
        <div class="profile-title">AI-практика отключена</div>
        <div class="profile-sub">Статическая версия работает без личного сервера: уроки, словарь, задания и повторение доступны офлайн, а AI можно вернуть позже через backend или serverless API.</div>
      </div>
    `;
    return;
  }

  const relevant = getRelevantScenarios();
  const diffLabel = {
    easy: 'A1 · Лёгкий',
    med: 'A2 · Средний',
    hard: 'B1 · Сложный',
  };

  relevant.forEach((scenario) => {
    const card = document.createElement('div');
    card.className = 'pr-card';
    card.innerHTML = `
      <div class="pr-card-diff ${scenario.diff}">${diffLabel[scenario.diff]}</div>
      <div class="pr-card-icon">${scenario.icon}</div>
      <div class="pr-card-spec">${scenario.spec === 'general' ? 'Общий' : scenario.spec.toUpperCase()}</div>
      <div class="pr-card-title">${scenario.title}</div>
      <div class="pr-card-desc">${scenario.desc}</div>
    `;
    card.onclick = () => startScenario(scenario);
    grid.appendChild(card);
  });

  if (!relevant.length) {
    grid.innerHTML = `<div style="color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:12px;">Нет сценариев. Обнови специальности в настройках.</div>`;
  }
}

function startScenario(scenario) {
  if (typeof hasBackend === 'function' && !hasBackend()) {
    toast('AI-практика доступна только с подключённым backend');
    return;
  }

  activeScenario = scenario;
  chatHistory = [];
  document.getElementById('practiceScenarios').style.display = 'none';
  document.getElementById('practiceChat').style.display = 'block';
  document.getElementById('activeSName').textContent = `${scenario.icon}  ${scenario.title}`;
  document.getElementById('activeSDesc').textContent = scenario.desc;
  document.getElementById('prTip').textContent = `💡 ${scenario.tip}`;
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('prHint').style.display = 'none';
  document.getElementById('chatInput').value = '';
  renderCleanCounter();
  aiOpen(scenario);
}

function endChat() {
  document.getElementById('practiceScenarios').style.display = 'block';
  document.getElementById('practiceChat').style.display = 'none';
  activeScenario = null;
  chatHistory = [];
}

function clearChat() {
  if (!activeScenario) return;
  chatHistory = [];
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('prHint').style.display = 'none';
  aiOpen(activeScenario);
}

async function aiOpen(scenario) {
  showTyping();
  const openingPrompt = `Eröffne das Gespräch auf Deutsch. Begrüße ${S.name || 'Lernende/-r'} und starte das Szenario "${scenario.title}". Maximal 2 Sätze.`;
  const reply = await callClaude(scenario.system, openingPrompt, []);
  hideTyping();
  addMessage('ai', reply);
  chatHistory.push({ role: 'assistant', content: reply });
}

async function sendMsg() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isTyping || !activeScenario) return;

  input.value = '';
  autoResize(input);
  document.getElementById('prHint').style.display = 'none';
  addMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  showTyping();
  const reply = await callClaude(activeScenario.system, text, chatHistory.slice(-10));
  hideTyping();
  addMessage('ai', reply);
  chatHistory.push({ role: 'assistant', content: reply });
  updateCleanStreak(reply);
}

async function requestHint() {
  if (isTyping || !activeScenario) return;
  const lastAI = chatHistory.filter((message) => message.role === 'assistant').slice(-1)[0];
  if (!lastAI) return;

  showTyping();
  const prompt = `Gib dem Lernenden einen Hinweis auf Russisch: Wie könnte er auf diese Frage antworten: "${lastAI.content}"? Maximal 2 kurze Sätze und 1-2 deutsche Beispielphrasen.`;
  const hint = await callClaude(
    'Du bist ein Sprachlehrer. Antworte auf Russisch mit kurzen deutschen Beispielen.',
    prompt,
    []
  );
  hideTyping();
  const hintEl = document.getElementById('prHint');
  hintEl.textContent = `💡 ${hint}`;
  hintEl.style.display = 'block';
}

async function requestTranslation() {
  if (isTyping || !activeScenario) return;
  const lastAI = chatHistory.filter((message) => message.role === 'assistant').slice(-1)[0];
  if (!lastAI) return;

  showTyping();
  const prompt = `Переведи на русский эту немецкую фразу и объясни ключевые слова: "${lastAI.content}". Формат: Перевод: [...] | Ключевые слова: [слово - значение, ...]`;
  const translation = await callClaude(
    'Ты переводчик. Отвечай только на русском языке.',
    prompt,
    []
  );
  hideTyping();
  addMessage('system', `🔄 ${translation}`);
}

async function requestFeedback() {
  if (isTyping || !activeScenario) return;
  const userMessages = chatHistory.filter((message) => message.role === 'user');
  if (!userMessages.length) {
    toast('Сначала напиши что-нибудь!');
    return;
  }

  const lastUser = userMessages.slice(-1)[0].content;
  showTyping();
  const prompt = `Проанализируй этот немецкий ответ ученика на русском языке: "${lastUser}".
Проверь грамматику, порядок слов, артикли и падежи.
Формат ответа:
✅ Что хорошо: [...]
❌ Ошибки: [если есть: неправильно → правильно]
💡 Совет: [краткий совет]`;
  const feedback = await callClaude(
    'Du bist ein Deutschlehrer. Gib Feedback auf Russisch.',
    prompt,
    []
  );
  hideTyping();
  addMessage('system', feedback);
}

async function callClaude(systemPrompt, userMessage, history) {
  isTyping = true;
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const response = await apiRequest(
      '/ai/chat',
      {
        system: systemPrompt,
        message: userMessage,
        history: history || [],
        max_tokens: 400,
      },
      'POST'
    );
    if (response && response.text) return response.text;
    if (response && response.error) return `⚠️ Ошибка AI: ${response.error}`;
    return '⚠️ Не удалось получить ответ от AI.';
  } catch (error) {
    return `⚠️ Ошибка соединения: ${error.message}`;
  } finally {
    isTyping = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function formatInlineCorrections(html) {
  return html.replace(/([^<\n:;]+?)\s*(?:→|-&gt;)\s*([^<\n;]+)/g, (_, wrong, right) => {
    const cleanWrong = wrong.trim();
    const cleanRight = right.trim();
    if (!cleanWrong || !cleanRight) return _;
    return `<span class="pr-wrong-inline">${cleanWrong}</span><span class="pr-right-inline">${cleanRight}</span>`;
  });
}

function addMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `pr-msg ${role}`;

  let formattedText = esc(text)
    .replace(/❌ Fehler:(.*?)→ ✅ Richtig:(.*?)(?=<br>|[\r\n]|$)/g, (_, wrong, right) => {
      return `<div class="pr-correction"><b>❌ Ошибка:</b>${wrong}<br><b>✅ Правильно:</b>${right}</div>`;
    })
    .replace(/\r?\n/g, '<br>');
  formattedText = formatInlineCorrections(formattedText);

  if (role === 'system') {
    div.innerHTML = `<div class="pr-bubble" style="max-width:100%;">${formattedText}</div>`;
  } else {
    const avatar = role === 'ai' ? '🤖' : esc(avatarLetter(S.name));
    div.innerHTML = `
      <div class="pr-avatar">${avatar}</div>
      <div class="pr-bubble">${formattedText}</div>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'pr-msg ai';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="pr-avatar">🤖</div>
    <div class="pr-bubble">
      <div class="pr-typing">
        <div class="pr-dot"></div><div class="pr-dot"></div><div class="pr-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}
