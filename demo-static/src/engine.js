/**
 * Static demo engine.
 *
 * Reimplements the subset of the dashboard API used by the shell and the
 * widgets, on top of IndexedDB. Every call that the real app would send to
 * Hono is intercepted by shell.js / widget-bridge.js and resolved here.
 *
 * No server, no SQLite, no model: data comes from /site-data/seed.json and
 * every change is stored in the browser.
 */

const DB_NAME = 'dashboard-static-demo';
const DB_VERSION = 1;
const SEED_URL = '/site-data/seed.json';

export const SCRIPTED_AGENT_PROMPTS = [
  {
    label: '① Explain this dashboard',
    prompt: 'Explain this dashboard',
  },
  {
    label: '② Summarize the finance data',
    prompt: 'Summarize the finance data',
  },
  {
    label: '③ How are widgets built?',
    prompt: 'How are widgets built?',
  },
];

const AGENT_REPLIES = {
  overview: `This is a static copy of the dashboard. The shell, the six tabs, the 28 widgets and the themes are all real, but there is no Bun process behind it.

Tab layouts, widget positions, notifications and widget data live in IndexedDB in your browser. Use the Reset control at the bottom right to restore the seeded demo.

The agent panel you are reading is scripted: three canned prompts, streamed word by word, never sent to a model.`,

  finance: `The Finance Terminal is one widget reading four tables: finance_positions, finance_watchlist, finance_news and finance_alerts.

The seeded paper portfolio holds SPY, NVDA, MSFT and a small BTC position. Net worth and P/L are computed in the widget from those rows; nothing is fetched from a market API.

You can edit rows in the widget and they persist in IndexedDB. Open the database explorer from a widget's permissions panel to see the underlying tables.`,

  widgets: `Each widget is an isolated iframe with its own HTML, CSS and JavaScript. The host passes tabId, instanceId, language and per-instance config in the query string.

Widgets never talk to SQLite directly. They call queryDB({ table, action, where, data }), which the real app forwards to a permissioned endpoint. Here the same call is answered by the IndexedDB engine, using the tables declared in manifest.json.

In the full project, the local OpenCode agent can rewrite those files. The static demo replaces it with this scripted panel.`,
};

const DEFAULT_AGENT_REPLY = `This is a scripted demo response. The static build ships three example prompts: explain the dashboard, summarize the finance data, or explain how widgets are built.

Everything else here is real client-side code: the dashboard shell, the grid, the widgets and their queries run against IndexedDB.`;

const DEFAULT_TAB_STYLE = {
  colorPrimary: '#60a5fa',
  colorSecondary: '#a78bfa',
  colorBackground: '#0b1120',
  colorText: '#e5e7eb',
  fontFamily: 'Inter, sans-serif',
  borderRadius: '8px',
  borderStyle: 'solid',
  borderWidth: '1px',
  shadowStyle: 'medium',
};

const DEFAULT_GRID = { cols: 24, rowHeight: 40, gap: 12 };

let dbPromise = null;
let seedPromise = null;
let cachedSeedVersion = null;
let cachedSeed = null;

// === IndexedDB plumbing ===

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('tables')) db.createObjectStore('tables', { keyPath: 'name' });
        if (!db.objectStoreNames.contains('tabs')) db.createObjectStore('tabs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('widgets')) db.createObjectStore('widgets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('agentSessions')) {
          const store = db.createObjectStore('agentSessions', { keyPath: 'id' });
          store.createIndex('base', 'base');
        }
        if (!db.objectStoreNames.contains('agentMessages')) {
          const store = db.createObjectStore('agentMessages', { keyPath: 'id', autoIncrement: true });
          store.createIndex('sessionId', 'sessionId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function p(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function get(store, key) {
  const db = await openDb();
  return p(db.transaction(store, 'readonly').objectStore(store).get(key));
}

async function getAll(store) {
  const db = await openDb();
  return p(db.transaction(store, 'readonly').objectStore(store).getAll());
}

async function put(store, value) {
  const db = await openDb();
  return p(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

async function del(store, key) {
  const db = await openDb();
  return p(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

// === Seed ===

async function applySeed(seed) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['tables', 'tabs', 'widgets', 'agentSessions', 'agentMessages', 'meta'], 'readwrite');
    tx.objectStore('tables').clear();
    tx.objectStore('tabs').clear();
    tx.objectStore('widgets').clear();
    tx.objectStore('agentSessions').clear();
    tx.objectStore('agentMessages').clear();

    const tableStore = tx.objectStore('tables');
    for (const [name, definition] of Object.entries(seed.tables || {})) {
      const rows = definition.rows || [];
      const auto = rows.reduce((max, row) => (typeof row.id === 'number' && row.id > max ? row.id : max), 0);
      tableStore.put({ name, columns: definition.columns || [], rows, autoIncrement: auto });
    }

    const tabStore = tx.objectStore('tabs');
    for (const tab of seed.tabs || []) tabStore.put(tab);

    const widgetStore = tx.objectStore('widgets');
    for (const widget of seed.widgets || []) widgetStore.put(widget);

    const metaStore = tx.objectStore('meta');
    metaStore.clear();
    metaStore.put({ key: 'seedVersion', value: seed.version });
    metaStore.put({ key: 'seededAt', value: new Date().toISOString() });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    if (cachedSeedVersion) {
      const meta = await get('meta', 'seedVersion');
      if (meta?.value === cachedSeedVersion) return;
    }

    const response = await fetch(SEED_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Could not load demo data');
    const seed = await response.json();
    cachedSeed = seed;
    cachedSeedVersion = seed.version;

    const meta = await get('meta', 'seedVersion');
    if (meta?.value === seed.version) return;

    await applySeed(seed);
  })();
  return seedPromise;
}

export async function resetDemo() {
  const response = await fetch(SEED_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load demo data');
  const seed = await response.json();
  cachedSeed = seed;
  cachedSeedVersion = seed.version;
  seedPromise = null;
  await applySeed(seed);
}

// === Table helpers ===

function tableRecord(name) {
  return get('tables', name).then((record) => {
    if (!record) throw new Error(`Table '${name}' not found`);
    return record;
  });
}

function looseEqual(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

function matchWhere(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => looseEqual(row[key], value));
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function columnDefault(column) {
  const raw = column.dflt_value;
  if (raw === null || raw === undefined) return undefined;
  const value = String(raw);
  if (/^current_timestamp$/i.test(value)) return nowSql();
  if (/^'.*'$/.test(value)) return value.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function normalizeInsert(record, data) {
  const row = { ...data };
  const byName = new Map(record.columns.map((column) => [column.name, column]));
  const primary = record.columns.find((column) => column.pk);

  for (const column of record.columns) {
    if (row[column.name] !== undefined) continue;
    const fallback = columnDefault(column);
    if (fallback !== undefined) row[column.name] = fallback;
  }

  if (primary && (row[primary.name] === undefined || row[primary.name] === null)) {
    const defined = record.columns.some((column) => column.pk && /INT/i.test(column.type));
    if (defined) {
      record.autoIncrement = Math.max(record.autoIncrement || 0, ...record.rows.map((r) => Number(r[primary.name]) || 0)) + 1;
      row[primary.name] = record.autoIncrement;
    }
  }

  for (const key of Object.keys(row)) {
    if (!byName.has(key)) delete row[key];
  }
  return row;
}

function projectRow(row, columns) {
  if (!columns || !columns.length || columns.includes('*')) return { ...row };
  const out = {};
  for (const column of columns) out[column] = row[column] ?? null;
  return out;
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function applyOrder(rows, orderBy) {
  if (!orderBy) return rows;
  const sorts = String(orderBy)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [column, direction] = part.split(/\s+/);
      return { column, desc: /^desc$/i.test(direction || '') };
    });

  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const result = compareValues(a[sort.column], b[sort.column]);
      if (result !== 0) return sort.desc ? -result : result;
    }
    return 0;
  });
}

// === Query execution (mirrors DatabaseManager.executeQuery) ===

async function executeQuery(permissions, query) {
  const permission = (permissions || []).find((entry) => entry.table === query.table);
  if (!permission) throw new Error(`Table '${query.table}' not authorized`);
  if (!permission.actions?.includes(query.action)) {
    throw new Error(`Action '${query.action}' not authorized for table '${query.table}'`);
  }

  const record = await tableRecord(query.table);

  switch (query.action) {
    case 'select': {
      const allowed = permission.columns?.length ? permission.columns : null;
      let columns = query.columns;
      if (allowed) {
        if (columns) {
          const denied = columns.filter((column) => !allowed.includes(column));
          if (denied.length) throw new Error(`Columns not authorized: ${denied.join(', ')}`);
        } else {
          columns = allowed;
        }
      }
      const limit = Math.min(query.limit || 100, permission.maxRows || 1000);
      const filtered = record.rows.filter((row) => matchWhere(row, query.where));
      const ordered = applyOrder(filtered, query.orderBy);
      return ordered.slice(0, limit).map((row) => projectRow(row, columns));
    }

    case 'insert': {
      if (!query.data) throw new Error('No data provided for insert');
      const allowed = permission.columns?.length ? permission.columns : null;
      if (allowed) {
        const denied = Object.keys(query.data).filter((column) => !allowed.includes(column));
        if (denied.length) throw new Error(`Columns not authorized: ${denied.join(', ')}`);
      }
      let insertedId = null;
      await mutateTable(query.table, (current) => {
        const row = normalizeInsert(current, query.data);
        current.rows.push(row);
        insertedId = row.id ?? null;
      });
      return { id: { id: insertedId }, lastInsertRowid: insertedId, changes: 1 };
    }

    case 'update': {
      if (!query.data) throw new Error('No data provided for update');
      const allowed = permission.columns?.length ? permission.columns : null;
      if (allowed) {
        const denied = Object.keys(query.data).filter((column) => !allowed.includes(column));
        if (denied.length) throw new Error(`Columns not authorized: ${denied.join(', ')}`);
      }
      if (!query.where || Object.keys(query.where).length === 0) {
        throw new Error('WHERE clause required for UPDATE');
      }
      let changes = 0;
      await mutateTable(query.table, (current) => {
        for (const row of current.rows) {
          if (matchWhere(row, query.where)) {
            Object.assign(row, query.data);
            changes++;
          }
        }
      });
      return { changes: { changes } };
    }

    case 'delete': {
      let changes = 0;
      await mutateTable(query.table, (current) => {
        const keep = [];
        for (const row of current.rows) {
          if (matchWhere(row, query.where)) changes++;
          else keep.push(row);
        }
        current.rows = keep;
      });
      return { changes: { changes } };
    }

    default:
      throw new Error(`Unknown action: ${query.action}`);
  }
}

function mutateTable(name, mutate) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('tables', 'readwrite');
        const store = tx.objectStore('tables');
        const request = store.get(name);
        let result;
        request.onsuccess = () => {
          const record = request.result;
          if (!record) {
            tx.abort();
            reject(new Error(`Table '${name}' not found`));
            return;
          }
          result = mutate(record) ?? { changes: { changes: 0 } };
          store.put(record);
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

// === Tabs ===

async function listTabs() {
  const tabs = await getAll('tabs');
  return tabs.sort((a, b) => a.order - b.order);
}

function findInstance(tab, instanceId) {
  const direct = (tab.widgets || []).find((instance) => instance.id === instanceId);
  if (direct) return { instance: direct, page: null };
  for (const page of tab.pages || []) {
    const found = (page.widgets || []).find((instance) => instance.id === instanceId);
    if (found) return { instance: found, page };
  }
  return null;
}

function instancesOf(tab) {
  const list = [...(tab.widgets || [])];
  for (const page of tab.pages || []) list.push(...(page.widgets || []));
  return list;
}

async function saveTab(tab) {
  tab.updatedAt = new Date().toISOString();
  await put('tabs', tab);
  return tab;
}

function makeTab(name) {
  const now = new Date().toISOString();
  return {
    id: `demo-tab-${crypto.randomUUID()}`,
    name,
    emoji: '📄',
    createdAt: now,
    updatedAt: now,
    order: 0,
    widgets: [],
    gridConfig: { ...DEFAULT_GRID },
    style: { ...DEFAULT_TAB_STYLE },
    variables: {},
  };
}

// === Notifications ===

async function listNotifications(params) {
  const record = await tableRecord('notification_center');
  const unreadOnly = params.get('unread') === '1';
  const limit = Number(params.get('limit') || 100) || 100;
  const rows = [...record.rows]
    .filter((row) => (unreadOnly ? !row.read : true))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
  const unreadCount = record.rows.filter((row) => !row.read).length;
  return { notifications: rows, unreadCount };
}

// === Scripted agent ===

function agentReply(message) {
  const lower = String(message || '').toLowerCase();
  if (lower.includes('finance') || lower.includes('market') || lower.includes('portfolio') || lower.includes('stock')) {
    return AGENT_REPLIES.finance;
  }
  if (lower.includes('widget') || lower.includes('built') || lower.includes('querydb') || lower.includes('iframe')) {
    return AGENT_REPLIES.widgets;
  }
  if (lower.includes('dashboard') || lower.includes('explain') || lower.includes('demo') || lower.includes('static')) {
    return AGENT_REPLIES.overview;
  }
  return DEFAULT_AGENT_REPLY;
}

function sseResponse(text, onDone) {
  const encoder = new TextEncoder();
  const chunks = text.split(/(\s+)/).filter(Boolean);
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'text', data: chunk })}\n\n`),
        );
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
      if (onDone) await onDone();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// === Agent store ===

async function sessionsFor(base) {
  const all = await getAll('agentSessions');
  return all.filter((session) => session.base === base).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function activeSessionFor(base) {
  const meta = await get('meta', `agentActive:${base}`);
  const sessions = await sessionsFor(base);
  if (!sessions.length) return null;
  return sessions.find((session) => session.id === meta?.value) || sessions[0];
}

async function ensureSession(base, name = 'Demo session') {
  let session = await activeSessionFor(base);
  if (session) return session;
  const now = new Date().toISOString();
  session = { id: crypto.randomUUID(), base, name, createdAt: now, updatedAt: now };
  await put('agentSessions', session);
  await put('meta', { key: `agentActive:${base}`, value: session.id });
  return session;
}

async function messagesFor(sessionId) {
  const db = await openDb();
  const index = db.transaction('agentMessages', 'readonly').objectStore('agentMessages').index('sessionId');
  const rows = await p(index.getAll(IDBKeyRange.only(sessionId)));
  return rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)) || a.id - b.id);
}

async function appendMessage(base, sessionId, role, content) {
  await put('agentMessages', {
    sessionId,
    base,
    role,
    content,
    timestamp: new Date().toISOString(),
  });
}

async function handleAgent(path, method, body) {
  let base;
  let rest;
  let match = path.match(/^\/(widgets|scripts)\/([^/]+)\/opencode(\/.*)?$/);
  if (match) {
    base = `${match[1]}:${match[2]}`;
    rest = match[3] || '/';
  } else {
    match = path.match(/^\/dashboard\/opencode(\/.*)?$/);
    if (!match) return null;
    base = 'dashboard:dashboard';
    rest = match[1] || '/';
  }

  if (method === 'GET' && rest === '/sessions') {
    const sessions = await sessionsFor(base);
    const active = await activeSessionFor(base);
    return { sessions, activeSessionId: active?.id || null };
  }

  if (method === 'POST' && rest === '/sessions') {
    const now = new Date().toISOString();
    const session = {
      id: crypto.randomUUID(),
      base,
      name: body?.name || `Session ${(await sessionsFor(base)).length + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    await put('agentSessions', session);
    await put('meta', { key: `agentActive:${base}`, value: session.id });
    return session;
  }

  if (method === 'DELETE' && rest.startsWith('/sessions/')) {
    const id = rest.split('/')[2];
    await del('agentSessions', id);
    const remaining = await sessionsFor(base);
    if (remaining.length) await put('meta', { key: `agentActive:${base}`, value: remaining[0].id });
    return { success: true };
  }

  if (method === 'PUT' && /^\/sessions\/[^/]+\/active$/.test(rest)) {
    const id = rest.split('/')[2];
    await put('meta', { key: `agentActive:${base}`, value: id });
    return { success: true };
  }

  if (method === 'GET' && rest === '/history') {
    const session = await ensureSession(base);
    return messagesFor(session.id);
  }

  if (method === 'DELETE' && rest === '/history') {
    const sessions = await sessionsFor(base);
    for (const session of sessions) {
      const messages = await messagesFor(session.id);
      for (const message of messages) await del('agentMessages', message.id);
    }
    return { success: true };
  }

  if (method === 'GET' && rest === '/usage') {
    return { sessionPct: 4, weekPct: 11, sessionReset: 'scripted', weekReset: 'scripted' };
  }

  if (method === 'POST' && rest === '/chat') {
    const session = body?.sessionId
      ? (await sessionsFor(base)).find((entry) => entry.id === body.sessionId) || (await ensureSession(base))
      : await ensureSession(base);
    const message = body?.message || '';
    await appendMessage(base, session.id, 'user', message);
    const reply = agentReply(message);
    await appendMessage(base, session.id, 'assistant', reply);
    session.updatedAt = new Date().toISOString();
    await put('agentSessions', session);
    return sseResponse(reply);
  }

  if (method === 'GET' && rest.startsWith('/sessions')) {
    return { sessions: await sessionsFor(base), activeSessionId: (await activeSessionFor(base))?.id || null };
  }

  throw Object.assign(new Error(`Unknown agent endpoint: ${method} ${path}`), { status: 404 });
}

// === Route ===

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function route(path, params, method, body) {
  // --- Demo API (same contract as /api/demo in the Bun app) ---
  if (path === '/health') {
    return { ok: true, demo: true, static: true, aiMode: 'scripted', seeded: true, db: 'IndexedDB' };
  }

  if (path === '/reset' && method === 'POST') {
    await resetDemo();
    return { success: true, message: 'Demo data restored.' };
  }

  if (path === '/ai/chat' && method === 'POST') {
    return sseResponse(agentReply(body?.message || ''));
  }

  if (path === '/config') {
    return { opencodeEnabled: true, demo: true, static: true, aiMode: 'scripted', readOnly: false };
  }

  if (path === '/tabs' && method === 'GET') return listTabs();
  if (path === '/tabs' && method === 'POST') {
    const tabs = await listTabs();
    const tab = makeTab(body?.name || 'New tab');
    tab.order = tabs.length;
    return saveTab(tab);
  }

  if (path === '/tabs/order' && method === 'PUT') {
    const ids = body?.tabIds || [];
    const tabs = await listTabs();
    for (const [index, id] of ids.entries()) {
      const tab = tabs.find((entry) => entry.id === id);
      if (tab) {
        tab.order = index;
        await put('tabs', tab);
      }
    }
    return { success: true };
  }

  let match = path.match(/^\/tabs\/([^/]+)$/);
  if (match) {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    if (method === 'GET') return tab;
    if (method === 'PUT' || method === 'PATCH') {
      for (const key of ['name', 'emoji', 'order', 'style', 'gridConfig', 'variables', 'currentPageId']) {
        if (body?.[key] !== undefined) tab[key] = body[key];
      }
      return saveTab(tab);
    }
    if (method === 'DELETE') {
      await del('tabs', match[1]);
      return { success: true };
    }
  }

  match = path.match(/^\/tabs\/([^/]+)\/state$/);
  if (match) {
    const key = `tabState:${match[1]}`;
    if (method === 'GET') {
      const stored = await get('meta', key);
      return stored?.value || {};
    }
    await put('meta', { key, value: body || {} });
    return { success: true };
  }

  match = path.match(/^\/tabs\/([^/]+)\/current-page$/);
  if (match && method === 'PUT') {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    tab.currentPageId = body?.pageId;
    await saveTab(tab);
    return { success: true };
  }

  match = path.match(/^\/tabs\/([^/]+)\/variables(?:\/([^/]+))?$/);
  if (match) {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    tab.variables = tab.variables || {};
    const key = match[2];
    if (method === 'GET' && !key) return tab.variables;
    if (method === 'GET' && key) return { key, value: tab.variables[key] ?? null };
    if (method === 'PUT' && key) {
      tab.variables[key] = body?.value;
      await saveTab(tab);
      return { key, value: body?.value };
    }
    if (method === 'DELETE' && key) {
      delete tab.variables[key];
      await saveTab(tab);
      return { success: true };
    }
  }

  match = path.match(/^\/tabs\/([^/]+)\/backups$/);
  if (match) return [];

  match = path.match(/^\/tabs\/([^/]+)\/db-permissions$/);
  if (match) {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    if (method === 'GET') return tab.dbPermissions || [];
    if (method === 'POST' || method === 'PUT') {
      tab.dbPermissions = Array.isArray(body) ? body : body?.permissions || [];
      await saveTab(tab);
      return tab.dbPermissions;
    }
  }

  match = path.match(/^\/tabs\/([^/]+)\/db-auto-modify$/);
  if (match && method === 'POST') return { success: true };

  match = path.match(/^\/tabs\/([^/]+)\/table-(?:modification-)?proposals(?:\/.*)?$/);
  if (match) return method === 'GET' ? [] : { success: true };

  // Pages
  match = path.match(/^\/tabs\/([^/]+)\/pages$/);
  if (match && method === 'POST') {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    if (!tab.pages || !tab.pages.length) {
      tab.pages = [
        {
          id: crypto.randomUUID(),
          name: 'Page 1',
          emoji: '1️⃣',
          order: 0,
          widgets: tab.widgets || [],
          gridConfig: tab.gridConfig || { ...DEFAULT_GRID },
        },
      ];
    }
    tab.pages.push({
      id: crypto.randomUUID(),
      name: body?.name || `Page ${tab.pages.length + 1}`,
      emoji: body?.emoji || '📄',
      order: tab.pages.length,
      widgets: [],
      gridConfig: tab.gridConfig || { ...DEFAULT_GRID },
    });
    await saveTab(tab);
    return tab;
  }

  match = path.match(/^\/tabs\/([^/]+)\/pages\/([^/]+)$/);
  if (match) {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    const page = (tab.pages || []).find((entry) => entry.id === match[2]);
    if (!page) throw Object.assign(new Error('Page not found'), { status: 404 });
    if (method === 'PUT' || method === 'PATCH') {
      for (const key of ['name', 'emoji', 'order']) {
        if (body?.[key] !== undefined) page[key] = body[key];
      }
      await saveTab(tab);
      return tab;
    }
    if (method === 'DELETE') {
      tab.pages = tab.pages.filter((entry) => entry.id !== match[2]);
      await saveTab(tab);
      return tab;
    }
  }

  match = path.match(/^\/tabs\/([^/]+)\/pages\/([^/]+)\/widgets$/);
  if (match && method === 'POST') {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    const page = (tab.pages || []).find((entry) => entry.id === match[2]);
    if (!page) throw Object.assign(new Error('Page not found'), { status: 404 });
    const instance = {
      id: crypto.randomUUID(),
      widgetId: body?.widgetId,
      position: body?.position || { x: 0, y: 0, cols: 12, rows: 8 },
      config: body?.config || {},
    };
    page.widgets = page.widgets || [];
    page.widgets.push(instance);
    await saveTab(tab);
    return instance;
  }

  match = path.match(/^\/tabs\/([^/]+)\/pages\/([^/]+)\/widgets\/([^/]+)$/);
  if (match) {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    const page = (tab.pages || []).find((entry) => entry.id === match[2]);
    if (!page) throw Object.assign(new Error('Page not found'), { status: 404 });
    const instance = (page.widgets || []).find((entry) => entry.id === match[3]);
    if (!instance) throw Object.assign(new Error('Instance not found'), { status: 404 });
    if (method === 'PUT') {
      if (body?.position) instance.position = body.position;
      if (body?.config) instance.config = { ...(instance.config || {}), ...body.config };
      await saveTab(tab);
      return { success: true };
    }
    if (method === 'DELETE') {
      page.widgets = page.widgets.filter((entry) => entry.id !== match[3]);
      await saveTab(tab);
      return { success: true };
    }
  }

  match = path.match(/^\/tabs\/([^/]+)\/widgets$/);
  if (match && method === 'GET') {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    return tab.widgets || [];
  }

  match = path.match(/^\/tabs\/([^/]+)\/widgets\/([^/]+)\/query$/);
  if (match && method === 'POST') {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    const found = findInstance(tab, match[2]);
    if (!found) throw Object.assign(new Error('Widget instance not found'), { status: 404 });
    const widget = await get('widgets', found.instance.widgetId);
    if (!widget) throw Object.assign(new Error('Widget not found'), { status: 404 });
    const data = await executeQuery(widget.dbPermissions || [], body || {});
    return { success: true, data };
  }

  match = path.match(/^\/tabs\/([^/]+)\/widgets\/([^/]+)\/notify$/);
  if (match && method === 'POST') {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    const found = findInstance(tab, match[2]);
    const widget = found ? await get('widgets', found.instance.widgetId) : null;
    await mutateTable('notification_center', (record) => {
      const id = Math.max(0, ...record.rows.map((row) => Number(row.id) || 0)) + 1;
      record.rows.push({
        id,
        title: body?.title || widget?.name || 'Notification',
        message: body?.message || '',
        type: body?.type || 'info',
        icon: widget?.emoji || '🔔',
        source: 'widget',
        source_id: widget?.id || null,
        source_name: widget?.name || 'Widget',
        read: 0,
        created_at: nowSql(),
      });
      return { changes: { changes: 1 } };
    });
    return {
      success: true,
      notification: { widgetName: widget?.name || 'Widget', widgetEmoji: widget?.emoji || '🔔' },
    };
  }

  // --- Widget instances (demo path prefix) ---
  match = path.match(/^\/widgets\/tabs\/([^/]+)\/widgets$/);
  if (match && method === 'POST') {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    const instance = {
      id: crypto.randomUUID(),
      widgetId: body?.widgetId,
      position: body?.position || { x: 0, y: 0, cols: 12, rows: 8 },
      config: body?.config || {},
    };
    tab.widgets = tab.widgets || [];
    tab.widgets.push(instance);
    await saveTab(tab);
    return instance;
  }

  match = path.match(/^\/widgets\/tabs\/([^/]+)\/widgets\/([^/]+)$/);
  if (match) {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    const found = findInstance(tab, match[2]);
    if (!found) throw Object.assign(new Error('Instance not found'), { status: 404 });
    if (method === 'PUT') {
      if (body?.position) found.instance.position = body.position;
      if (body?.config) found.instance.config = { ...(found.instance.config || {}), ...body.config };
      await saveTab(tab);
      return { success: true };
    }
    if (method === 'DELETE') {
      if (found.page) found.page.widgets = found.page.widgets.filter((entry) => entry.id !== match[2]);
      else tab.widgets = (tab.widgets || []).filter((entry) => entry.id !== match[2]);
      await saveTab(tab);
      return { success: true };
    }
  }

  match = path.match(/^\/widgets\/tabs\/([^/]+)\/style$/);
  if (match) {
    const tab = await get('tabs', match[1]);
    if (!tab) throw Object.assign(new Error('Tab not found'), { status: 404 });
    if (method === 'GET') return tab.style || {};
    tab.style = body || {};
    await saveTab(tab);
    return { success: true };
  }

  // --- Widget gallery & manifests ---
  if (path === '/widgets' && method === 'GET') {
    const widgets = await getAll('widgets');
    return widgets.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  match = path.match(/^\/widgets\/([^/]+)\/tables\/check$/);
  if (match && method === 'GET') {
    const widget = await get('widgets', match[1]);
    const names = new Set((await getAll('tables')).map((record) => record.name));
    const missing = (widget?.dbPermissions || []).map((entry) => entry.table).filter((name) => !names.has(name));
    return { ok: missing.length === 0, missing };
  }

  match = path.match(/^\/widgets\/([^/]+)\/tables\/proposals(?:\/.*)?$/);
  if (match) return method === 'GET' ? [] : { success: true };

  match = path.match(/^\/widgets\/([^/]+)\/backups(?:\/.*)?$/);
  if (match) {
    if (method === 'GET') return [];
    throw Object.assign(new Error('Backups are read-only in the static demo.'), { status: 403 });
  }

  match = path.match(/^\/widgets\/([^/]+)\/opencode(\/.*)?$/);
  if (match) return handleAgent(path, method, body);

  match = path.match(/^\/widgets\/([^/]+)$/);
  if (match) {
    const widget = await get('widgets', match[1]);
    if (!widget) throw Object.assign(new Error('Widget not found'), { status: 404 });
    if (method === 'GET') return widget;
    if (method === 'PUT' || method === 'PATCH') {
      for (const key of [
        'name',
        'emoji',
        'description',
        'category',
        'dbPermissions',
        'canSendGlobalNotifications',
        'canSendTabNotifications',
        'configSchema',
        'defaultSize',
      ]) {
        if (body?.[key] !== undefined) widget[key] = body[key];
      }
      widget.updatedAt = new Date().toISOString();
      await put('widgets', widget);
      return widget;
    }
    if (method === 'DELETE') {
      throw Object.assign(new Error('Widget authoring is disabled in the static demo. Run the Bun app locally to create or delete widgets.'), { status: 403 });
    }
  }

  if (path === '/widgets' && method === 'POST') {
    throw Object.assign(new Error('Widget authoring is disabled in the static demo. Run the Bun app locally to create widgets.'), { status: 403 });
  }

  match = path.match(/^\/widgets\/([^/]+)\/clone$/);
  if (match) {
    throw Object.assign(new Error('Widget authoring is disabled in the static demo.'), { status: 403 });
  }

  // --- Presets ---
  if (path === '/presets' && method === 'GET') {
    if (!cachedSeed) {
      const response = await fetch(SEED_URL, { cache: 'no-cache' });
      cachedSeed = await response.json();
    }
    return cachedSeed.presets || [];
  }

  // --- Database explorer ---
  if (path === '/database/tables' && method === 'GET') {
    const records = await getAll('tables');
    return { tables: records.map((record) => record.name) };
  }

  if (path === '/database/tables' && method === 'POST') {
    const name = body?.name;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name || '')) throw new Error('Invalid table name');
    if (await get('tables', name)) throw new Error(`Table '${name}' already exists`);
    const columns = (body?.schema || []).map((column) => ({
      name: column.name,
      type: column.type || 'TEXT',
      notnull: column.notNull ? 1 : 0,
      dflt_value: column.default ?? null,
      pk: column.primaryKey ? 1 : 0,
    }));
    await put('tables', { name, columns, rows: [], autoIncrement: 0 });
    return { success: true, table: name };
  }

  match = path.match(/^\/database\/schema\/([^/]+)$/);
  if (match && method === 'GET') {
    const record = await tableRecord(match[1]);
    return { schema: record.columns };
  }

  match = path.match(/^\/database\/tables\/([^/]+)\/stats$/);
  if (match && method === 'GET') {
    const record = await tableRecord(match[1]);
    return { stats: { rowCount: record.rows.length } };
  }

  match = path.match(/^\/database\/tables\/([^/]+)\/explore$/);
  if (match && method === 'GET') {
    const record = await tableRecord(match[1]);
    const limit = Number(params.get('limit') || 50) || 50;
    const offset = Number(params.get('offset') || 0) || 0;
    return {
      table: record.name,
      columns: record.columns.map((column) => column.name),
      rows: record.rows.slice(offset, offset + limit),
      total: record.rows.length,
      limit,
      offset,
    };
  }

  match = path.match(/^\/database\/tables\/([^/]+)\/rows$/);
  if (match && method === 'POST') {
    let inserted = null;
    await mutateTable(match[1], (record) => {
      const row = normalizeInsert(record, body || {});
      record.rows.push(row);
      inserted = row.id ?? null;
    });
    return { success: true, id: inserted };
  }

  match = path.match(/^\/database\/tables\/([^/]+)\/rows\/([^/]+)$/);
  if (match) {
    const key = match[2];
    const column = (await tableRecord(match[1])).columns.find((entry) => entry.pk)?.name || 'id';
    if (method === 'PUT') {
      await mutateTable(match[1], (record) => {
        for (const row of record.rows) {
          if (looseEqual(row[column], key)) Object.assign(row, body || {}, { [column]: row[column] });
        }
      });
      return { success: true };
    }
    if (method === 'DELETE') {
      await mutateTable(match[1], (record) => {
        record.rows = record.rows.filter((row) => !looseEqual(row[column], key));
      });
      return { success: true };
    }
  }

  match = path.match(/^\/database\/tables\/([^/]+)$/);
  if (match) {
    if (method === 'DELETE') {
      await del('tables', match[1]);
      return { success: true };
    }
    if (method === 'PATCH') {
      const record = await tableRecord(match[1]);
      for (const alteration of body?.alterations || []) {
        if (alteration.type === 'add' && alteration.column) {
          record.columns.push({
            name: alteration.column.name,
            type: alteration.column.type || 'TEXT',
            notnull: alteration.column.notNull ? 1 : 0,
            dflt_value: alteration.column.default ?? null,
            pk: 0,
          });
        }
        if (alteration.type === 'drop' && alteration.column) {
          const name = typeof alteration.column === 'string' ? alteration.column : alteration.column.name;
          record.columns = record.columns.filter((column) => column.name !== name);
          for (const row of record.rows) delete row[name];
        }
      }
      await put('tables', record);
      return { success: true };
    }
  }

  // --- Notifications ---
  if (path === '/notifications' && method === 'GET') return listNotifications(params);

  if (path === '/notifications/read-all' && method === 'PUT') {
    await mutateTable('notification_center', (record) => {
      for (const row of record.rows) row.read = 1;
    });
    return { success: true };
  }

  match = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (match && method === 'PUT') {
    await mutateTable('notification_center', (record) => {
      for (const row of record.rows) if (looseEqual(row.id, match[1])) row.read = 1;
    });
    return { success: true };
  }

  if (path === '/notifications/clear-read' && method === 'DELETE') {
    await mutateTable('notification_center', (record) => {
      record.rows = record.rows.filter((row) => !row.read);
    });
    return { success: true };
  }

  match = path.match(/^\/notifications\/([^/]+)$/);
  if (match && method === 'DELETE') {
    await mutateTable('notification_center', (record) => {
      record.rows = record.rows.filter((row) => !looseEqual(row.id, match[1]));
    });
    return { success: true };
  }

  // --- Scripts ---
  if (path === '/scripts' && method === 'GET') return DEMO_SCRIPTS;

  if (path === '/scripts/notifications/pending' && method === 'GET') return { notifications: [] };

  match = path.match(/^\/scripts\/([^/]+)\/opencode(\/.*)?$/);
  if (match) return handleAgent(path, method, body);

  match = path.match(/^\/scripts\/([^/]+)\/code$/);
  if (match && method === 'GET') {
    return {
      code: `// Static demo: scripts are illustrative only.\n// The Bun app runs this file; the static build cannot execute it.\n\nexport function run(ctx) {\n  ctx.log('Static demo — no script execution.');\n  return { ok: true };\n}\n`,
    };
  }

  match = path.match(/^\/scripts\/([^/]+)\/(logs|backups|config|timeline)$/);
  if (match) {
    if (method === 'GET') {
      if (match[2] === 'config') return {};
      if (match[2] === 'logs') return [];
      return [];
    }
    return { success: true };
  }

  match = path.match(/^\/scripts\/([^/]+)$/);
  if (match && method === 'GET') {
    const script = DEMO_SCRIPTS.find((entry) => entry.id === match[1]);
    if (!script) throw Object.assign(new Error('Script not found'), { status: 404 });
    return script;
  }

  if (path.startsWith('/scripts/') || path === '/scripts') {
    throw Object.assign(new Error('Script execution is disabled in the static demo.'), { status: 403 });
  }

  if (path.startsWith('/dashboard/opencode')) return handleAgent(path, method, body);

  // --- OpenCode queue (transient) ---
  if (path === '/opencode/queue') {
    if (method === 'GET') return [];
    let id = 0;
    const stored = await get('meta', 'queueCounter');
    id = (stored?.value || 0) + 1;
    await put('meta', { key: 'queueCounter', value: id });
    return { id };
  }

  if (path.startsWith('/opencode/queue/')) return { success: true };

  if (path === '/opencode/opencode-usage') {
    return { sessionPct: 4, weekPct: 11, sessionReset: 'scripted', weekReset: 'scripted' };
  }

  throw Object.assign(new Error(`Not found: ${method} ${path}`), { status: 404 });
}

const DEMO_SCRIPTS = [
  {
    id: 'demo-script-1',
    name: 'Daily brief',
    emoji: '📊',
    description: 'Builds a short morning summary from local tables.',
    category: 'Reports',
    enabled: true,
    triggers: [{ type: 'cron', cron: '0 8 * * *', enabled: true }],
    dbPermissions: [],
    lastStatus: 'success',
  },
  {
    id: 'demo-script-2',
    name: 'Data sync',
    emoji: '🔄',
    description: 'Reconciles local tables every 30 minutes.',
    category: 'Sync',
    enabled: true,
    triggers: [{ type: 'cron', cron: '*/30 * * * *', enabled: true }],
    dbPermissions: [],
    lastStatus: 'success',
  },
  {
    id: 'demo-script-3',
    name: 'Webhook alerts',
    emoji: '🔔',
    description: 'Handles external alerts and writes a notification.',
    category: 'Alerts',
    enabled: true,
    triggers: [{ type: 'webhook', enabled: true }],
    dbPermissions: [],
    lastStatus: 'success',
  },
];

// === Public entry point ===

export async function handleFetch(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const body = await readBody(request);

  let path = url.pathname.replace(/^\/api/, '');
  if (!path) path = '/';
  const isDemoPath = path === '/demo' || path.startsWith('/demo/');
  if (isDemoPath) path = path.slice('/demo'.length) || '/';

  try {
    await ensureSeeded();
    const result = await route(path, url.searchParams, method, body);
    if (result instanceof Response) return result;
    return json(result ?? {});
  } catch (error) {
    const status = error?.status || 400;
    return json({ error: error?.message || String(error) }, status);
  }
}
