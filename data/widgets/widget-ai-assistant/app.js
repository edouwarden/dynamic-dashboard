// AI Assistant — deterministic mock chat with optional demo SSE.

const el = {
  messages: document.getElementById('messages'),
  form: document.getElementById('composer'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  chips: document.getElementById('chips'),
};

let busy = false;

const REPLIES = [
  {
    match: /portfolio|finance|market|position|stock|crypto/i,
    text: 'Your seeded paper portfolio holds SPY, NVDA, MSFT and a small BTC position. The Finance Terminal derives net worth, day P/L and total P/L from the finance_positions table, then joins quotes from finance_watchlist for the day move.\n\nNo market API is called in this demo — every number is fictional.',
  },
  {
    match: /widget|api|code|opencode|agent|sse/i,
    text: 'Widgets are isolated HTML/CSS/JS iframes. Each one receives tabId, instanceId and config in the query string, then calls queryDB() against /api/tabs/:tabId/widgets/:instanceId/query.\n\nThe server enforces the manifest dbPermissions before touching SQLite. In the demo, tab ids start with demo-tab- and are routed to data/demo.db instead of the real database.',
  },
  {
    match: /focus|pomodoro|habit|streak|time/i,
    text: 'A good block: 25 minutes of focus, 5 minutes away from the screen, then repeat. The Focus Timer keeps its count in localStorage, so it never needs a backend.\n\nThe Habit Streak widget reads habit_streaks and renders a seven-day mask per habit. Both are intentionally simple and offline-friendly.',
  },
  {
    match: /system|health|service|latency|uptime/i,
    text: 'The System Status widget reads system_services and computes operational count, average latency and mean uptime. In this demo the rows are seeded; in a real deployment a script trigger could refresh them from local probes.',
  },
];

const DEFAULT_REPLY =
  'This is a canned demo reply. I run entirely in the browser (or via the isolated demo SSE route) and never call a model, spawn OpenCode or write files.\n\nTry asking about the portfolio, the widget API, focus habits or system health.';

function pickReply(message) {
  const hit = REPLIES.find((reply) => reply.match.test(message));
  return hit ? hit.text : DEFAULT_REPLY;
}

function scrollToBottom() {
  el.messages.scrollTop = el.messages.scrollHeight;
}

function addMessage(role, text = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (text) {
    const p = document.createElement('p');
    p.textContent = text;
    bubble.appendChild(p);
  }
  wrapper.appendChild(bubble);
  el.messages.appendChild(wrapper);
  scrollToBottom();
  return bubble;
}

function addTyping() {
  const bubble = addMessage('assistant');
  const dots = document.createElement('div');
  dots.className = 'typing';
  dots.innerHTML = '<span></span><span></span><span></span>';
  bubble.appendChild(dots);
  return bubble;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamLocal(bubble, text) {
  const p = document.createElement('p');
  bubble.innerHTML = '';
  bubble.appendChild(p);
  const tokens = text.split(/(\s+)/);
  for (const token of tokens) {
    p.textContent += token;
    scrollToBottom();
    await sleep(18);
  }
}

async function streamServer(bubble, message) {
  const response = await fetch('/api/demo/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok || !response.body) throw new Error('mock stream unavailable');

  bubble.textContent = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.type === 'delta' && event.text) {
            bubble.textContent += event.text;
            scrollToBottom();
          }
          if (event.type === 'done') return;
        } catch {
          /* ignore malformed chunks */
        }
      }
    }
  }
}

async function respond(message) {
  const typing = addTyping();
  const bubble = typing;
  await sleep(260);

  try {
    if (tabId.startsWith('demo-tab-')) {
      await streamServer(bubble, message);
    } else {
      await streamLocal(bubble, pickReply(message));
    }
  } catch {
    await streamLocal(bubble, pickReply(message));
  }

  scrollToBottom();
}

async function send(message) {
  if (busy || !message.trim()) return;
  busy = true;
  el.send.disabled = true;

  addMessage('user', message.trim());
  el.input.value = '';
  resizeInput();

  await respond(message.trim());

  busy = false;
  el.send.disabled = false;
  el.input.focus();
}

function resizeInput() {
  el.input.style.height = 'auto';
  el.input.style.height = `${Math.min(el.input.scrollHeight, 84)}px`;
}

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  send(el.input.value);
});

el.input.addEventListener('input', resizeInput);

el.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send(el.input.value);
  }
});

el.chips.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-prompt]');
  if (!button) return;
  send(button.dataset.prompt);
});

resizeInput();
