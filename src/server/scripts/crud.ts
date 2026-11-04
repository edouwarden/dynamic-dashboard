/**
 * CRUD scripts globaux : liste, création, lecture, mise à jour, suppression,
 * gestion du code (script.js), config (triggers + enabled), backups
 */

import { Hono } from 'hono';
import { globalScriptManager } from '../../scripts/global-manager';
import { scriptBackupManager } from '../../scripts/script-backup';
import { scriptScheduler } from '../../scripts/scheduler';

export const crudRouter = new Hono();

crudRouter.get('/', async (c) => {
  try {
    const scripts = await globalScriptManager.listScripts();
    return c.json(scripts);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crudRouter.post('/', async (c) => {
  try {
    const data = await c.req.json();
    const script = await globalScriptManager.createScript(data);
    return c.json(script, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

crudRouter.get('/:id', async (c) => {
  try {
    const script = await globalScriptManager.getScript(c.req.param('id'));
    if (!script) return c.json({ error: 'Script introuvable' }, 404);
    return c.json(script);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crudRouter.put('/:id', async (c) => {
  try {
    const data = await c.req.json();
    const script = await globalScriptManager.updateScript(c.req.param('id'), data);
    return c.json(script);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

crudRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    scriptScheduler.unregisterGlobalScript(id);
    await globalScriptManager.deleteScript(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Code (script.js)

crudRouter.get('/:id/code', async (c) => {
  try {
    const code = await globalScriptManager.getScriptCode(c.req.param('id'));
    return c.json({ code });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crudRouter.put('/:id/code', async (c) => {
  try {
    const { code } = await c.req.json<{ code: string }>();
    await globalScriptManager.saveScriptCode(c.req.param('id'), code);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Config (triggers + enabled)

crudRouter.get('/:id/config', async (c) => {
  try {
    const script = await globalScriptManager.getScript(c.req.param('id'));
    if (!script) return c.json({ error: 'Script introuvable' }, 404);
    return c.json({ enabled: script.enabled, triggers: script.triggers });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crudRouter.put('/:id/config', async (c) => {
  try {
    const id = c.req.param('id');
    const { enabled, triggers } = await c.req.json();
    const script = await globalScriptManager.updateScript(id, { enabled, triggers });
    scriptScheduler.registerGlobalScript(id, script);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Backups

crudRouter.get('/:id/backups', async (c) => {
  try {
    const backups = await scriptBackupManager.listBackups(c.req.param('id'));
    return c.json(backups);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

crudRouter.post('/:id/backups', async (c) => {
  try {
    const backup = await scriptBackupManager.createBackup(c.req.param('id'), { source: 'manual' });
    return c.json(backup, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

crudRouter.post('/:id/backups/:backupId/restore', async (c) => {
  try {
    await scriptBackupManager.restoreBackup(c.req.param('id'), c.req.param('backupId'));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

crudRouter.delete('/:id/backups/:backupId', async (c) => {
  try {
    await scriptBackupManager.deleteBackup(c.req.param('id'), c.req.param('backupId'));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});
