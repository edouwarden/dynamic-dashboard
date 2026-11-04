/**
 * Exécution des scripts : run manuel (SSE), logs, webhook trigger,
 * notifications en attente (polling), fichiers statiques (saveFile)
 */

import { Hono } from 'hono';
import { existsSync } from 'fs';
import { join } from 'path';
import { executeGlobalScript, getPendingNotifications, addPendingNotification } from '../../scripts/executor';
import { globalScriptManager } from '../../scripts/global-manager';
import { databaseManager } from '../../database/manager';

export const executionRouter = new Hono();

/** Exécution manuelle (SSE streaming) */
executionRouter.post('/:id/run', async (c) => {
  const id = c.req.param('id');
  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: any) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch {}
      };
      try {
        const entry = await executeGlobalScript(id, 'manual', undefined, (log) => {
          send({ type: 'log', data: log });
        });
        send({ type: 'done', data: entry });
      } catch (error: any) {
        send({ type: 'error', data: error.message });
      } finally {
        controller.close();
      }
    }
  });
  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  });
});

/** Logs d'exécution */
executionRouter.get('/:id/logs', async (c) => {
  try {
    const id = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50');
    const rows = databaseManager.queryRaw(
      `SELECT * FROM script_logs WHERE widget_id = ? ORDER BY rowid DESC LIMIT ?`,
      [id, limit]
    );
    const logs = rows.map((r: any) => ({ ...r, logs: JSON.parse(r.logs || '[]') }));
    return c.json(logs);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

executionRouter.delete('/:id/logs', async (c) => {
  try {
    const id = c.req.param('id');
    databaseManager.queryRaw(`DELETE FROM script_logs WHERE widget_id = ?`, [id]);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/** Webhook trigger */
executionRouter.post('/webhook/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const payload = await c.req.json().catch(() => ({}));
    const entry = await executeGlobalScript(id, 'webhook', payload);
    return c.json({ success: true, status: entry.status });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Notifications en attente (polling frontend) */
executionRouter.get('/notifications/pending', async (c) => {
  return c.json({ notifications: getPendingNotifications() });
});

/** Sauvegarder une notification (depuis scripts ou MCP) */
executionRouter.post('/notify', async (c) => {
  try {
    const { scriptId, title, message, type, duration } = await c.req.json();
    if (!message) return c.json({ error: 'message requis' }, 400);
    const script = scriptId ? await globalScriptManager.getScript(scriptId).catch(() => null) : null;
    addPendingNotification({
      scriptId: scriptId || 'mcp',
      scriptName: script?.name || 'MCP',
      scriptEmoji: script?.emoji,
      title, message,
      type: type || 'info',
      duration,
    });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Fichiers statiques sauvegardés par saveFile() */
executionRouter.get('/:id/files/:filename', async (c) => {
  const scriptId = c.req.param('id');
  const filename = c.req.param('filename').replace(/[^a-zA-Z0-9._-]/g, '_');
  const { CONFIG } = await import('../../config');
  const filePath = join(CONFIG.SCRIPTS_DIR, scriptId, 'cache', filename);
  if (!existsSync(filePath)) return c.json({ error: 'Fichier introuvable' }, 404);
  const file = Bun.file(filePath);
  return new Response(file, { headers: { 'Cache-Control': 'no-store' } });
});
