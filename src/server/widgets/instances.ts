/**
 * Instances de widgets dans les tabs : ajout, mise à jour, suppression,
 * exécution de requêtes DB, notifications, style et grid de tab
 */

import { Hono } from 'hono';
import type { WidgetInstance } from '../../types';
import { widgetManager } from '../../widgets/manager';
import { tabManager } from '../../tabs/manager';
import { databaseManager } from '../../database/manager';

export const instancesRouter = new Hono();

/** Liste des widgets d'une tab (instances) */
instancesRouter.get('/tabs/:tabId/widgets', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const tab = await tabManager.getTab(tabId);
    if (!tab) return c.json({ error: 'Tab not found' }, 404);
    return c.json(tab.widgets || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/** Ajouter un widget à une tab */
instancesRouter.post('/tabs/:tabId/widgets', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const { widgetId, position, config } = await c.req.json();
    const instance = await tabManager.addWidgetToTab(tabId, widgetId, position, config);
    return c.json(instance, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Mettre à jour la position/config d'une instance de widget */
instancesRouter.put('/tabs/:tabId/widgets/:instanceId', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const instanceId = c.req.param('instanceId');
    const { position, config, widgetId } = await c.req.json();

    if (position) await tabManager.updateWidgetPosition(tabId, instanceId, position);
    if (config) {
      // Récupérer le schema du widget pour ajouter les defaults manquants
      const widget = widgetId ? await widgetManager.getWidget(widgetId) : null;
      const configSchema = widget?.configSchema;
      await tabManager.updateWidgetConfig(tabId, instanceId, config, configSchema);
    }

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Retirer un widget d'une tab */
instancesRouter.delete('/tabs/:tabId/widgets/:instanceId', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const instanceId = c.req.param('instanceId');
    await tabManager.removeWidgetFromTab(tabId, instanceId);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Exécuter une requête DB depuis un widget */
instancesRouter.post('/tabs/:tabId/widgets/:instanceId/query', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const instanceId = c.req.param('instanceId');
    const query = await c.req.json();

    const tab = await tabManager.getTab(tabId);
    if (!tab) return c.json({ error: 'Tab not found' }, 404);

    const instance = tab.widgets?.find(w => w.id === instanceId);
    if (!instance) return c.json({ error: 'Widget instance not found' }, 404);

    const widget = await widgetManager.getWidget(instance.widgetId);
    if (!widget) return c.json({ error: 'Widget not found' }, 404);

    const permissions = widget.dbPermissions || [];
    if (permissions.length === 0) {
      return c.json({ error: 'No database permissions configured for this widget' }, 403);
    }

    const result = databaseManager.executeQuery(tabId, permissions, query);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

/** Envoyer une notification depuis un widget */
instancesRouter.post('/tabs/:tabId/widgets/:instanceId/notify', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const instanceId = c.req.param('instanceId');
    const { title, message, type = 'widget', duration = 5000, scope = 'global' } = await c.req.json();

    const tabData = await tabManager.getTab(tabId);
    if (!tabData) return c.json({ error: 'Tab not found' }, 404);

    const widgetInstance = tabData.widgets?.find((w: WidgetInstance) => w.id === instanceId);
    if (!widgetInstance) return c.json({ error: 'Widget instance not found' }, 404);

    const widget = await widgetManager.getWidget(widgetInstance.widgetId);
    if (!widget) return c.json({ error: 'Widget not found' }, 404);

    const hasPermission = scope === 'global'
      ? widget.canSendGlobalNotifications
      : widget.canSendTabNotifications;

    if (!hasPermission) {
      return c.json({ error: `Widget does not have permission to send ${scope} notifications` }, 403);
    }

    // Persister dans le centre de notifications
    try {
      const { databaseManager } = await import('../../database/manager');
      databaseManager.queryRaw(
        `INSERT INTO notification_center (title, message, type, icon, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title || null, message, type, widget.emoji || null, 'widget', widgetInstance.widgetId, widget.name]
      );
    } catch { /* ignore */ }

    return c.json({
      success: true,
      notification: { title, message, type, duration, widgetName: widget.name, widgetEmoji: widget.emoji }
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

/** Récupérer le style d'une tab */
instancesRouter.get('/tabs/:tabId/style', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const tab = await tabManager.getTab(tabId);
    if (!tab) return c.json({ error: 'Tab not found' }, 404);
    return c.json(tab.style || {});
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/** Mettre à jour le style d'une tab */
instancesRouter.put('/tabs/:tabId/style', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const style = await c.req.json();
    await tabManager.updateTabStyle(tabId, style);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Mettre à jour la config du grid d'une tab */
instancesRouter.put('/tabs/:tabId/grid', async (c) => {
  try {
    const tabId = c.req.param('tabId');
    const gridConfig = await c.req.json();
    await tabManager.updateGridConfig(tabId, gridConfig);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});
