/**
 * Static demo shell.
 *
 * Loaded before app.js so it can:
 *   - force English UI on first visit;
 *   - intercept every /api/* fetch and answer it from engine.js (IndexedDB);
 *   - translate the built-in demo banner and badge;
 *   - label the agent as scripted and expose three example prompts;
 *   - add a header Reset control for the local demo data;
 *   - pass the active tab theme into widget iframes.
 */

import { SCRIPTED_AGENT_PROMPTS, handleFetch } from './engine.js?v=2';

const nativeFetch = window.fetch.bind(window);

if (!localStorage.getItem('uiLang')) localStorage.setItem('uiLang', 'en');
// The dashboard agent normally asks for a password before opening. The static
// demo is read-only for authoring, so skip the prompt with a placeholder token.
if (!localStorage.getItem('dashboardOpenCodeToken')) {
  localStorage.setItem('dashboardOpenCodeToken', 'static-demo');
}
window.DEMO_STATIC = true;

window.fetch = async function staticDemoFetch(input, init) {
  let url;
  try {
    url = new URL(typeof input === 'string' ? input : input.url, location.href);
  } catch {
    return nativeFetch(input, init);
  }

  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    let body = init?.body;
    const method = init?.method || (typeof input === 'object' && input.method) || 'GET';
    if (body === undefined && typeof input === 'object' && input.body) {
      body = await input.clone().text();
    }
    return handleFetch(
      new Request(url.toString(), {
        method,
        headers: init?.headers || (typeof input === 'object' ? input.headers : undefined),
        body,
      }),
    );
  }

  return nativeFetch(input, init);
};

// === Small visual additions ===

const CSS = `
  /* The static build has no server-side scripts, so the Scripts entry point
     would only lead to an empty screen. */
  #scriptsSidebarBtn { display: none !important; }
  /* Widget authoring writes files to disk; the static demo can only browse. */
  #createWidgetBtn[disabled] { opacity: 0.45; cursor: not-allowed; }
  .demo-reset-btn { font-size: 12px; padding: 4px 9px; white-space: nowrap; }
  .demo-reset-btn span { margin-right: 4px; }
  .demo-reset-btn[disabled] { opacity: 0.5; cursor: progress; }
  /* Nothing is written to disk in the static demo, so the "reload to see
     changes" banner would be misleading. */
  .dashboard-reload-banner { display: none !important; }
  .demo-agent-note {
    margin: 8px 0 4px; padding: 6px 10px; border-radius: 8px;
    background: rgba(245, 158, 11, 0.12); color: #fbbf24;
    border: 1px dashed rgba(245, 158, 11, 0.45);
    font: 600 11px/1.35 Inter, system-ui, sans-serif;
  }
`;

function injectStyle() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

const THEME_VARS = [
  '--color-primary',
  '--color-secondary',
  '--color-bg',
  '--color-text',
  '--font-family',
  '--border-radius',
  '--border-style',
  '--border-width',
];

// CSS custom properties do not cross iframe boundaries. Widgets are written
// against the tab theme vars, so copy the active tab's values into each widget
// document once it loads. This is what makes the shared background colour
// actually reach Routine, Todo, Daily Tracking and the other themed widgets.
function applyWidgetTheme(iframe) {
  try {
    const doc = iframe.contentDocument;
    if (!doc?.documentElement) return;
    const computed = getComputedStyle(document.documentElement);
    for (const name of THEME_VARS) {
      const value = computed.getPropertyValue(name).trim();
      if (value) doc.documentElement.style.setProperty(name, value);
    }
  } catch {
    /* cross-origin or not ready yet */
  }
}

document.addEventListener(
  'load',
  (event) => {
    const target = event.target;
    if (target instanceof HTMLIFrameElement && target.classList.contains('widget-iframe')) {
      applyWidgetTheme(target);
    }
  },
  true,
);

// The demo banner is fixed above a 100dvh layout, which used to push the
// bottom of the dashboard off screen. Shrink the layout by the banner height
// instead of only padding the body.
function syncBannerLayout() {
  const dashboard = document.querySelector('.dashboard');
  if (!dashboard) return;
  const banner = document.getElementById('demoBanner');
  if (banner) {
    const height = `${banner.offsetHeight}px`;
    if (document.body.style.paddingTop !== height) document.body.style.paddingTop = height;
    const next = `calc(100dvh - ${banner.offsetHeight}px)`;
    if (dashboard.style.height !== next) dashboard.style.height = next;
  } else {
    if (document.body.style.paddingTop) document.body.style.paddingTop = '';
    if (dashboard.style.height) dashboard.style.height = '';
  }
}

window.addEventListener('resize', syncBannerLayout);

function resetDemo(button) {
  if (!confirm('Restore the original demo data? Your local changes will be lost.')) return;
  button.disabled = true;
  const label = button.querySelector('.demo-reset-label');
  const original = label ? label.textContent : button.textContent;
  if (label) label.textContent = 'Resetting…';
  else button.textContent = 'Resetting…';
  fetch('/api/demo/reset', { method: 'POST' })
    .then((response) => {
      if (!response.ok) throw new Error('Reset failed');
      localStorage.removeItem('currentTabId');
      location.reload();
    })
    .catch((error) => {
      button.disabled = false;
      if (label) label.textContent = original;
      else button.textContent = original;
      alert('Could not reset the demo data: ' + error.message);
    });
}

// Reset lives in the header toolbar; the old floating pill was cropped on
// short viewports.
function addHeaderReset() {
  const actions = document.getElementById('headerActions');
  if (!actions || document.getElementById('demoResetHeaderBtn')) return;
  const button = document.createElement('button');
  button.className = 'btn btn-ghost demo-reset-btn';
  button.id = 'demoResetHeaderBtn';
  button.type = 'button';
  button.title = 'Restore the original demo data';
  button.setAttribute('aria-label', 'Reset demo data');
  button.innerHTML = '<span aria-hidden="true">↺</span><span class="demo-reset-label">Reset</span>';
  button.addEventListener('click', () => resetDemo(button));
  actions.appendChild(button);
}

function applyStaticRestrictions() {
  const create = document.getElementById('createWidgetBtn');
  if (create && !create.disabled) {
    create.disabled = true;
    create.title = 'Widget authoring needs the local Bun app — disabled in the static demo.';
  }
}

function translateDemoChrome() {
  const badge = document.getElementById('demoBadge');
  if (badge) {
    // Only write when needed: writing inside the observer callback would
    // otherwise retrigger the observer forever.
    const label = '🎭 STATIC DEMO';
    const title = 'Static demo — browser storage, fictional data, scripted agent';
    if (badge.textContent !== label) badge.textContent = label;
    if (badge.title !== title) badge.title = title;
  }

  const banner = document.getElementById('demoBanner');
  if (banner && !banner.dataset.staticDemo) {
    banner.dataset.staticDemo = '1';
    banner.innerHTML = `
      <span>🎭 Static demo</span>
      <span style="opacity:0.5">|</span>
      <span>No server · fictional data in your browser · web version archived</span>
      <button id="demoBannerClose" style="margin-left:8px;background:none;border:none;cursor:pointer;font-size:14px;line-height:1;padding:0 4px;opacity:0.6" title="Hide">✕</button>
    `;
    banner.querySelector('#demoBannerClose')?.addEventListener('click', () => {
      banner.remove();
      document.body.style.paddingTop = '';
      sessionStorage.setItem('demoBannerClosed', '1');
    });
  }
}

function setText(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}

function relabelAgentUi() {
  setText(document.querySelector('.dashboard-opencode-title'), '🧪 Scripted demo agent — Dashboard');
  const dashboardBtn = document.getElementById('dashboardOpenCodeBtn');
  if (dashboardBtn) setText(dashboardBtn, '🧪 Demo agent');
  const editorTab = document.querySelector('.widget-tab[data-tab="editor"]');
  if (editorTab) setText(editorTab, '🧪 Demo agent');
  const scriptTab = document.querySelector('.script-subtab[data-subtab="opencode"]');
  if (scriptTab) setText(scriptTab, '🧪 Demo agent');
  document.querySelectorAll('.opencode-textarea').forEach((input) => {
    const placeholder = 'Pick one of the three scripted prompts…';
    if (input.placeholder !== placeholder) input.placeholder = placeholder;
  });
  document.querySelectorAll('.chat-empty-state').forEach((state) => {
    setText(state.querySelector('h3'), 'Scripted demo agent');
    setText(
      state.querySelector('p'),
      'Pick one of the three example prompts below. Replies are canned and stream in locally.',
    );
  });
  document.querySelectorAll('.chat-message.assistant .message-header span').forEach((span) => {
    const text = span.textContent.trim();
    if (text === 'OpenCode') setText(span, 'Scripted agent');
    else if (text.includes('Réponse en cours')) setText(span, '⏳ Generating scripted reply…');
  });
}

// Clicking a demo prompt fills the textarea (the panel's own handler) and we
// then trigger the same send button a user would press.
document.addEventListener('click', (event) => {
  const chip = event.target.closest?.('.input-action-chip[data-prompt]');
  if (!chip) return;
  const scope =
    chip.closest('.dashboard-opencode-panel') ||
    chip.closest('.editor-opencode-panel') ||
    chip.closest('.script-subtab-content') ||
    document;
  const send = scope.querySelector('.opencode-send-btn');
  if (!send || send.dataset.state === 'executing') return;
  setTimeout(() => send.click(), 60);
});

function decorateAgentPanels() {
  document.querySelectorAll('.opencode-input-actions').forEach((container) => {
    if (container.dataset.staticDemo) return;
    container.dataset.staticDemo = '1';
    container.innerHTML = SCRIPTED_AGENT_PROMPTS.map(
      (item) =>
        `<button class="input-action-chip" data-prompt="${item.prompt}" title="Scripted demo prompt">${item.label}</button>`,
    ).join('');

    if (!container.previousElementSibling?.classList.contains('demo-agent-note')) {
      container.insertAdjacentHTML(
        'beforebegin',
        '<div class="demo-agent-note">🧪 Scripted demo agent — canned replies streamed locally. No model runs.</div>',
      );
    }
  });
}

function observe() {
  const observer = new MutationObserver(() => {
    translateDemoChrome();
    relabelAgentUi();
    decorateAgentPanels();
    addHeaderReset();
    applyStaticRestrictions();
    syncBannerLayout();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  translateDemoChrome();
  relabelAgentUi();
  decorateAgentPanels();
  addHeaderReset();
  applyStaticRestrictions();
  syncBannerLayout();
}

function boot() {
  injectStyle();
  observe();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
