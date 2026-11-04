/**
 * Isolated demo API.
 *
 * Everything served here reads from data/demo.db and data/demo-tabs/. The demo
 * never touches the real dashboard database, tabs or OpenCode sessions.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { mkdir, readdir, readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config';
import { demoDatabaseManager } from '../database/manager';
import { widgetManager } from '../widgets/manager';
import { seedDatabase, seedTabs, demoDbPath, demoTabsDir } from '../demo/seed';
import type { Tab, TabConfig, WidgetInstance } from '../types';

export const demoApi = new Hono();

const DEMO_DIR = CONFIG.DEMO_TABS_DIR;

function isDemoTabId(id: string): boolean {
  return id.startsWith('demo-tab-') && !id.includes('/') && !id.includes('\\') && !id.includes('..');
}

function readOnly(c: any) {
  if (!CONFIG.DEMO_READ_ONLY) return null;
  return c.json({ success: false, error: 'This demo is read-only.' }, 403);
}

// === Demo tabs ===

async function getDemoTabs(): Promise<Tab[]> {
  try {
    if (!existsSync(DEMO_DIR)) return [];
    const dirs = await readdir(DEMO_DIR);

    const results = await Promise.all(
      dirs.map(async (dir) => {
        const tabJsonPath = join(DEMO_DIR, dir, 'tab.json');
        if (!existsSync(tabJsonPath)) return null;
        try {
          const content = await readFile(tabJsonPath, 'utf-8');
          const tabConfig: TabConfig = JSON.parse(content);
          return tabConfig.tab;
        } catch {
          return null;
        }
      }),
    );

    return results.filter((tab): tab is Tab => tab !== null).sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export async function getDemoTab(id: string): Promise<Tab | null> {
  try {
    if (!isDemoTabId(id)) return null;
    const tabJsonPath = join(DEMO_DIR, id, 'tab.json');
    if (!existsSync(tabJsonPath)) return null;
    const content = await readFile(tabJsonPath, 'utf-8');
    const tabConfig: TabConfig = JSON.parse(content);
    return tabConfig.tab;
  } catch {
    return null;
  }
}

async function saveDemoTab(tab: Tab): Promise<void> {
  if (!isDemoTabId(tab.id)) throw new Error('Invalid demo tab id');
  const tabDir = join(DEMO_DIR, tab.id);
  await mkdir(tabDir, { recursive: true });
  const tabConfig: TabConfig = { tab, version: 1 };
  await writeFile(join(tabDir, 'tab.json'), JSON.stringify(tabConfig, null, 2));
}

// === Health & reset ===

demoApi.get('/health', (c) => {
  let rows = 0;
  try {
    const result = demoDatabaseManager.queryRaw('SELECT COUNT(*) AS count FROM finance_watchlist') as Array<{ count: number }>;
    rows = result?.[0]?.count ?? 0;
  } catch {
    rows = 0;
  }
  return c.json({
    ok: true,
    demo: true,
    aiMode: CONFIG.DEMO_AI_MODE,
    readOnly: CONFIG.DEMO_READ_ONLY,
    seeded: rows > 0,
    db: 'data/demo.db',
  });
});

demoApi.post('/reset', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  seedDatabase(demoDbPath(), { reset: true });
  await seedTabs(demoTabsDir(), { prefix: 'demo-tab-', reset: true });
  return c.json({ success: true, message: 'Demo data restored.' });
});

// === Mock AI ===

const MOCK_REPLIES: Record<string, string[]> = {
  default: [
    'This is a mocked reply — the public demo does not call any model or spawn OpenCode.\n\nTry the Finance Terminal, Personal OS and AI Lab tabs. Every value you see is seeded and fictional.',
    'The demo runs on the same Hono + Bun + SQLite stack as the real dashboard, but with an isolated database and read-only safe defaults.',
  ],
  finance: [
    'The seeded paper portfolio holds SPY, NVDA, MSFT and a small BTC position. Net worth, day P/L and total P/L are derived from finance_positions, then joined with finance_watchlist for the day move.\n\nNo market API is called in this demo — every number is fictional.',
    'The Finance Terminal is a composite widget: one iframe, four SQLite tables, sparklines rendered as inline SVG. The same widget is reused on the Overview and Finance tabs.',
  ],
  opencode: [
    'In the real project, OpenCode runs locally and edits widget source files through a permissioned API. Each widget declares its database tables in manifest.json.\n\nThe public demo keeps AI in mock mode: deterministic SSE chunks, no subprocess, no filesystem writes.',
    'Widgets are isolated iframes. They receive tabId, instanceId and config in the query string, then call queryDB() against /api/tabs/:tabId/widgets/:instanceId/query.',
  ],
};

function pickReply(replies: string[], message: string): string {
  const index = [...message].reduce((sum, char) => sum + char.charCodeAt(0), 0) % replies.length;
  return replies[index];
}

function mockReply(message: string): string {
  const lower = message.toLowerCase();
  if (/(finance|market|stock|btc|crypto|portfolio|position|net worth)/.test(lower)) {
    return pickReply(MOCK_REPLIES.finance, message);
  }
  if (/(opencode|agent|code|widget|api)/.test(lower)) {
    return pickReply(MOCK_REPLIES.opencode, message);
  }
  return MOCK_REPLIES.default[0];
}

demoApi.post('/ai/chat', async (c) => {
  const body = await c.req.json<{ message?: string }>().catch(() => ({ message: '' }));
  const message = body.message || '';

  return streamSSE(c, async (stream) => {
    const reply = mockReply(message);
    const words = reply.split(' ');
    for (let i = 0; i < words.length; i++) {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'delta', text: (i ? ' ' : '') + words[i] }),
      });
      await new Promise((resolve) => setTimeout(resolve, 24));
    }
    await stream.writeSSE({ data: JSON.stringify({ type: 'done' }) });
  });
});

// === Scripts (fictional, read-only) ===

const DEMO_SCRIPTS = [
  {
    id: 'demo-script-1',
    name: 'Daily brief',
    emoji: '📊',
    description: 'Builds a short morning summary from local tables.',
    category: 'Reports',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-20T08:00:00Z',
    enabled: true,
    triggers: [{ type: 'cron' as const, cron: '0 8 * * *', enabled: true }],
    dbPermissions: [],
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    lastStatus: 'success' as const,
  },
  {
    id: 'demo-script-2',
    name: 'Data sync',
    emoji: '🔄',
    description: 'Reconciles local tables every 30 minutes.',
    category: 'Sync',
    createdAt: '2026-01-20T14:00:00Z',
    updatedAt: '2026-02-21T14:30:00Z',
    enabled: true,
    triggers: [{ type: 'cron' as const, cron: '*/30 * * * *', enabled: true }],
    dbPermissions: [],
    lastRun: new Date(Date.now() - 1800000).toISOString(),
    lastStatus: 'success' as const,
  },
  {
    id: 'demo-script-3',
    name: 'Webhook alerts',
    emoji: '🔔',
    description: 'Handles external alerts and writes a notification.',
    category: 'Alerts',
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-22T12:15:00Z',
    enabled: true,
    triggers: [{ type: 'webhook' as const, enabled: true }],
    dbPermissions: [],
    lastRun: new Date(Date.now() - 7200000).toISOString(),
    lastStatus: 'success' as const,
  },
];

// === Tabs ===

demoApi.get('/tabs', async (c) => {
  return c.json(await getDemoTabs());
});

demoApi.get('/tabs/:id', async (c) => {
  const tab = await getDemoTab(c.req.param('id'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);
  return c.json(tab);
});

// Widget DB query through the isolated demo database.
demoApi.post('/tabs/:tabId/widgets/:instanceId/query', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const instanceId = c.req.param('instanceId');
    const query = await c.req.json();

    const tab = await getDemoTab(tabId);
    if (!tab) return c.json({ success: false, error: 'Tab not found' }, 404);

    const instance = tab.widgets?.find((w) => w.id === instanceId);
    if (!instance) return c.json({ success: false, error: 'Widget instance not found' }, 404);

    const widget = await widgetManager.getWidget(instance.widgetId);
    if (!widget) return c.json({ success: false, error: 'Widget not found' }, 404);

    const permissions = widget.dbPermissions || [];
    if (permissions.length === 0) {
      return c.json({ success: false, error: 'No database permissions configured' }, 403);
    }

    if (CONFIG.DEMO_READ_ONLY && ['insert', 'update', 'delete'].includes(query.action)) {
      return c.json({ success: false, error: 'This demo is read-only.' }, 403);
    }

    const result = demoDatabaseManager.executeQuery(tabId, permissions, query);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Variables

demoApi.get('/tabs/:id/variables', async (c) => {
  const tab = await getDemoTab(c.req.param('id'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);
  return c.json(tab.variables || {});
});

demoApi.get('/tabs/:id/variables/:key', async (c) => {
  const tab = await getDemoTab(c.req.param('id'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);
  const value = tab.variables?.[c.req.param('key')];
  return c.json({ key: c.req.param('key'), value: value ?? null });
});

demoApi.put('/tabs/:id/variables/:key', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const tab = await getDemoTab(c.req.param('id'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);

  const { value } = await c.req.json<{ value: any }>();
  if (!tab.variables) tab.variables = {};
  tab.variables[c.req.param('key')] = value;
  tab.updatedAt = new Date().toISOString();
  await saveDemoTab(tab);
  return c.json({ key: c.req.param('key'), value });
});

demoApi.delete('/tabs/:id/variables/:key', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const tab = await getDemoTab(c.req.param('id'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);
  if (tab.variables) delete tab.variables[c.req.param('key')];
  tab.updatedAt = new Date().toISOString();
  await saveDemoTab(tab);
  return c.json({ success: true });
});

// Tab state (ephemeral in the public demo)

demoApi.get('/tabs/:id/state', (c) => c.json({}));
demoApi.post('/tabs/:id/state', (c) => c.json({ success: true }));
demoApi.get('/tabs/:id/backups', (c) => c.json([]));

// Scripts & config

demoApi.get('/scripts', (c) => c.json(DEMO_SCRIPTS));

demoApi.get('/scripts/:id', (c) => {
  const script = DEMO_SCRIPTS.find((s) => s.id === c.req.param('id'));
  if (!script) return c.json({ error: 'Script not found' }, 404);
  return c.json(script);
});

demoApi.get('/scripts/notifications/pending', (c) => c.json([]));

demoApi.get('/config', (c) => {
  return c.json({
    opencodeEnabled: false,
    demo: true,
    aiMode: CONFIG.DEMO_AI_MODE,
    readOnly: CONFIG.DEMO_READ_ONLY,
  });
});

// Notifications (demo DB only)

demoApi.get('/notifications', (c) => {
  try {
    const unreadOnly = c.req.query('unread') === '1';
    const limit = parseInt(c.req.query('limit') || '100');
    const where = unreadOnly ? 'WHERE read = 0' : '';
    const rows = demoDatabaseManager.queryRaw(
      `SELECT * FROM notification_center ${where} ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    const unreadCount = (demoDatabaseManager.queryRaw(
      'SELECT COUNT(*) AS count FROM notification_center WHERE read = 0',
    ) as Array<{ count: number }>)?.[0]?.count || 0;
    return c.json({ notifications: rows, unreadCount });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

demoApi.put('/notifications/read-all', (c) => {
  const denied = readOnly(c);
  if (denied) return denied;
  try {
    demoDatabaseManager.queryRaw('UPDATE notification_center SET read = 1 WHERE read = 0');
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

demoApi.put('/notifications/:id/read', (c) => {
  const denied = readOnly(c);
  if (denied) return denied;
  try {
    demoDatabaseManager.queryRaw('UPDATE notification_center SET read = 1 WHERE id = ?', [c.req.param('id')]);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

demoApi.delete('/notifications/clear-read', (c) => {
  const denied = readOnly(c);
  if (denied) return denied;
  try {
    demoDatabaseManager.queryRaw('DELETE FROM notification_center WHERE read = 1');
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

demoApi.delete('/notifications/:id', (c) => {
  const denied = readOnly(c);
  if (denied) return denied;
  try {
    demoDatabaseManager.queryRaw('DELETE FROM notification_center WHERE id = ?', [c.req.param('id')]);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Widget gallery (real widgets, read-only)

demoApi.get('/widgets', async (c) => {
  return c.json(await widgetManager.listWidgets());
});

demoApi.get('/widgets/:id', async (c) => {
  const widget = await widgetManager.getWidget(c.req.param('id'));
  if (!widget) return c.json({ error: 'Widget not found' }, 404);
  return c.json(widget);
});

// === Demo tab editing ===

demoApi.post('/tabs', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const { name } = await c.req.json<{ name: string }>();
  if (!name) return c.json({ error: 'Name is required' }, 400);

  const tabs = await getDemoTabs();
  const now = new Date().toISOString();
  const tab: Tab = {
    id: `demo-tab-${crypto.randomUUID()}`,
    name,
    emoji: '📄',
    createdAt: now,
    updatedAt: now,
    order: tabs.length,
    widgets: [],
    gridConfig: { cols: 24, rowHeight: 40, gap: 12 },
    style: {
      colorPrimary: '#60a5fa',
      colorSecondary: '#a78bfa',
      colorBackground: '#0b1120',
      colorText: '#e5e7eb',
      fontFamily: 'Inter, sans-serif',
      borderRadius: '8px',
      borderStyle: 'solid',
      borderWidth: '1px',
      shadowStyle: 'medium',
    },
  };

  await saveDemoTab(tab);
  return c.json(tab, 201);
});

demoApi.patch('/tabs/:id', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const tab = await getDemoTab(c.req.param('id'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);

  const { name, emoji, order } = await c.req.json<{ name?: string; emoji?: string; order?: number }>();
  if (name !== undefined) tab.name = name;
  if (emoji !== undefined) tab.emoji = emoji;
  if (order !== undefined) tab.order = order;
  tab.updatedAt = new Date().toISOString();
  await saveDemoTab(tab);
  return c.json(tab);
});

demoApi.delete('/tabs/:id', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const id = c.req.param('id');
  if (!isDemoTabId(id)) return c.json({ error: 'Tab not found' }, 404);
  await rm(join(DEMO_DIR, id), { recursive: true, force: true });
  return c.json({ success: true });
});

// Widget instances in demo tabs

demoApi.get('/tabs/:tabId/widgets', async (c) => {
  const tab = await getDemoTab(c.req.param('tabId'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);
  return c.json(tab.widgets || []);
});

demoApi.post('/widgets/tabs/:tabId/widgets', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const tab = await getDemoTab(c.req.param('tabId'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);

  const { widgetId, position, config } = await c.req.json();
  const instance: WidgetInstance = {
    id: crypto.randomUUID(),
    widgetId,
    position: position || { x: 0, y: 0, cols: 12, rows: 8 },
    config: config || {},
  };

  if (!tab.widgets) tab.widgets = [];
  tab.widgets.push(instance);
  tab.updatedAt = new Date().toISOString();
  await saveDemoTab(tab);
  return c.json(instance, 201);
});

demoApi.put('/widgets/tabs/:tabId/widgets/:instanceId', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const tab = await getDemoTab(c.req.param('tabId'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);

  const instanceId = c.req.param('instanceId');
  const { position, config } = await c.req.json();
  const widget = tab.widgets?.find((w) => w.id === instanceId);
  if (!widget) return c.json({ error: 'Instance not found' }, 404);

  if (position) widget.position = position;
  if (config) widget.config = config;
  tab.updatedAt = new Date().toISOString();
  await saveDemoTab(tab);
  return c.json({ success: true });
});

demoApi.delete('/widgets/tabs/:tabId/widgets/:instanceId', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const tab = await getDemoTab(c.req.param('tabId'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);

  const instanceId = c.req.param('instanceId');
  if (tab.widgets) tab.widgets = tab.widgets.filter((w) => w.id !== instanceId);
  tab.updatedAt = new Date().toISOString();
  await saveDemoTab(tab);
  return c.json({ success: true });
});

// Demo tab style

demoApi.get('/widgets/tabs/:tabId/style', async (c) => {
  const tab = await getDemoTab(c.req.param('tabId'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);
  return c.json(tab.style || {});
});

demoApi.put('/widgets/tabs/:tabId/style', async (c) => {
  const denied = readOnly(c);
  if (denied) return denied;

  const tab = await getDemoTab(c.req.param('tabId'));
  if (!tab) return c.json({ error: 'Tab not found' }, 404);

  const style = await c.req.json();
  tab.style = style;
  tab.updatedAt = new Date().toISOString();
  await saveDemoTab(tab);
  return c.json({ success: true });
});
