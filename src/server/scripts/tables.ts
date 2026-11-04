/**
 * Gestion des tables DB pour les scripts : query, permissions,
 * création/altération de tables avec système d'approbation (proposals)
 */

import { Hono } from 'hono';
import { globalScriptManager } from '../../scripts/global-manager';
import { databaseManager } from '../../database/manager';
import { addScriptProposal, getScriptProposals, removeScriptProposal } from '../../opencode/script-sessions';
import type { DbPermission } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export const tablesRouter = new Hono();

/** Exécuter une requête DB (pour MCP tools) */
tablesRouter.post('/:id/query', async (c) => {
  try {
    const id = c.req.param('id');
    const query = await c.req.json();
    const script = await globalScriptManager.getScript(id);
    if (!script) return c.json({ error: 'Script introuvable' }, 404);

    const permissions = script.dbPermissions || [];
    if (permissions.length === 0) {
      return c.json({ error: 'Aucune permission DB configurée pour ce script' }, 403);
    }

    const result = databaseManager.executeQuery(id, permissions, query);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

/** Mettre à jour les permissions DB d'un script */
tablesRouter.post('/:id/permissions', async (c) => {
  try {
    const id = c.req.param('id');
    const permissions = await c.req.json<DbPermission[]>();
    await globalScriptManager.updatePermissions(id, permissions);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Lister toutes les tables existantes */
tablesRouter.get('/:id/tables', async (c) => {
  try {
    const tables = databaseManager.getAllTables();
    return c.json({ tables });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/** Créer une table (avec approbation si autoApproveCreateTable est OFF) */
tablesRouter.post('/:id/tables', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, schema } = await c.req.json<{ name: string; schema: any }>();
    if (!name || !schema) return c.json({ error: 'name and schema sont requis' }, 400);

    const existingTables = databaseManager.getAllTableNames();
    let resolvedName = name;
    if (existingTables.includes(resolvedName)) {
      let suffix = 2;
      while (existingTables.includes(`${name}_${suffix}`)) suffix++;
      resolvedName = `${name}_${suffix}`;
    }

    const script = await globalScriptManager.getScript(id);
    if (!script) return c.json({ error: 'Script introuvable' }, 404);

    if (!script.autoApproveCreateTable) {
      const proposal = { id: uuidv4(), scriptId: id, type: 'create' as const, name: resolvedName, schema, createdAt: new Date().toISOString() };
      addScriptProposal(id, proposal);
      return c.json({ pendingApproval: true, proposalId: proposal.id, message: `Création de "${resolvedName}" en attente d'approbation.`, name: resolvedName, schema });
    }

    databaseManager.createTable(resolvedName, schema);
    const permissions = script.dbPermissions || [];
    if (!permissions.some(p => p.table === resolvedName)) {
      permissions.push({ table: resolvedName, actions: ['select', 'insert', 'update', 'delete'] });
      await globalScriptManager.updatePermissions(id, permissions);
    }
    return c.json({ success: true, table: resolvedName }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Modifier une table (ALTER TABLE) */
tablesRouter.patch('/:id/tables/:tableName', async (c) => {
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const alterations = await c.req.json();

    const script = await globalScriptManager.getScript(id);
    if (!script) return c.json({ error: 'Script introuvable' }, 404);

    if (!script.autoApproveAlterTable) {
      const proposal = { id: uuidv4(), scriptId: id, type: 'alter' as const, name: tableName, alterations, createdAt: new Date().toISOString() };
      addScriptProposal(id, proposal);
      return c.json({ pendingApproval: true, proposalId: proposal.id, message: `Modification de "${tableName}" en attente d'approbation.`, name: tableName, alterations });
    }

    databaseManager.alterTable(tableName, alterations);
    return c.json({ success: true, table: tableName });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Lister les proposals en attente */
tablesRouter.get('/:id/tables/proposals', async (c) => {
  return c.json({ proposals: getScriptProposals(c.req.param('id')) });
});

/** Approuver une proposal */
tablesRouter.post('/:id/tables/proposals/:proposalId/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const proposalId = c.req.param('proposalId');
    const proposal = removeScriptProposal(id, proposalId);
    if (!proposal) return c.json({ error: 'Proposition introuvable' }, 404);

    if (proposal.type === 'create') {
      databaseManager.createTable(proposal.name, proposal.schema);
      const script = await globalScriptManager.getScript(id);
      if (script) {
        const permissions = script.dbPermissions || [];
        if (!permissions.some(p => p.table === proposal.name)) {
          permissions.push({ table: proposal.name, actions: ['select', 'insert', 'update', 'delete'] });
          await globalScriptManager.updatePermissions(id, permissions);
        }
      }
    } else if (proposal.type === 'alter') {
      databaseManager.alterTable(proposal.name, proposal.alterations);
    }

    return c.json({ success: true, table: proposal.name, type: proposal.type });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Rejeter une proposal */
tablesRouter.delete('/:id/tables/proposals/:proposalId', async (c) => {
  const id = c.req.param('id');
  const proposal = removeScriptProposal(id, c.req.param('proposalId'));
  if (!proposal) return c.json({ error: 'Proposition introuvable' }, 404);
  return c.json({ success: true });
});
