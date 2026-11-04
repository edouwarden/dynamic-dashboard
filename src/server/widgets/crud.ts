/**
 * CRUD widgets + mise à jour des permissions DB
 */

import { Hono } from 'hono';
import { widgetManager } from '../../widgets/manager';
import { tabManager } from '../../tabs/manager';
import type { DbPermission } from '../../types';

export const crudRouter = new Hono();

/** Liste tous les widgets */
crudRouter.get('/', async (c) => {
  try {
    const widgets = await widgetManager.listWidgets();
    return c.json(widgets);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/** Créer un nouveau widget */
crudRouter.post('/', async (c) => {
  try {
    const data = await c.req.json();
    const widget = await widgetManager.createWidget(data);
    return c.json(widget, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Récupérer un widget */
crudRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const widget = await widgetManager.getWidget(id);
    if (!widget) return c.json({ error: 'Widget not found' }, 404);
    return c.json(widget);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/** Mettre à jour un widget */
crudRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();
    await widgetManager.updateWidget(id, data);
    const widget = await widgetManager.getWidget(id);
    return c.json(widget);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Supprimer un widget */
crudRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await tabManager.removeWidgetFromAllTabs(id);
    await widgetManager.deleteWidget(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Cloner un widget */
crudRouter.post('/:id/clone', async (c) => {
  try {
    const id = c.req.param('id');
    const widget = await widgetManager.cloneWidget(id);
    return c.json(widget, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Mettre à jour les permissions DB d'un widget */
crudRouter.post('/:id/permissions', async (c) => {
  try {
    const id = c.req.param('id');
    const permissions = await c.req.json<DbPermission[]>();
    await widgetManager.updateWidgetPermissions(id, permissions);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});
