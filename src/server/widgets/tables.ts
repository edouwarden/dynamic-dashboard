/**
 * Création / altération de tables avec système d'approbation
 * Liste des tables, vérification des tables manquantes, proposals
 */

import { Hono } from 'hono';
import { widgetManager } from '../../widgets/manager';
import { databaseManager } from '../../database/manager';
import { addProposal, getProposals, removeProposal, createProposalId } from './proposals';
import type { TableProposal } from './proposals';

export const tablesRouter = new Hono();

/**
 * Créer une table ET l'assigner au widget (utilisé par Claude)
 * Si autoApproveCreateTable est OFF → crée une proposal en attente
 */
tablesRouter.post('/:id/tables', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, schema } = await c.req.json<{ name: string; schema: any }>();

    if (!name || !schema) {
      return c.json({ error: 'name and schema are required' }, 400);
    }

    const existingTables = databaseManager.getAllTableNames();
    let resolvedName = name;
    if (existingTables.includes(resolvedName)) {
      let suffix = 2;
      while (existingTables.includes(`${name}_${suffix}`)) suffix++;
      resolvedName = `${name}_${suffix}`;
    }

    const widget = await widgetManager.getWidget(id);
    if (!widget) return c.json({ error: 'Widget not found' }, 404);

    if (!widget.autoApproveCreateTable) {
      const proposal: TableProposal = {
        id: createProposalId(),
        widgetId: id,
        type: 'create',
        name: resolvedName,
        schema,
        createdAt: new Date().toISOString()
      };
      addProposal(id, proposal);
      console.log(`[Tables] Proposal created for widget ${id}: ${resolvedName} (id: ${proposal.id})`);
      return c.json({
        pendingApproval: true,
        proposalId: proposal.id,
        message: `Table "${resolvedName}" creation requires user approval. The user will see a confirmation dialog.`,
        name: resolvedName,
        schema
      });
    }

    databaseManager.createTable(resolvedName, schema);

    const permissions = widget.dbPermissions || [];
    if (!permissions.some(p => p.table === resolvedName)) {
      permissions.push({ table: resolvedName, actions: ['select', 'insert', 'update', 'delete'] as const });
      await widgetManager.updateWidget(id, { dbPermissions: permissions });
    }

    return c.json({ success: true, table: resolvedName, assignedToWidget: true }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/**
 * Modifier une table d'un widget (ALTER TABLE)
 * Si autoApproveAlterTable est OFF → crée une proposal en attente
 */
tablesRouter.patch('/:id/tables/:tableName', async (c) => {
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const alterations = await c.req.json();

    const widget = await widgetManager.getWidget(id);
    if (!widget) return c.json({ error: 'Widget not found' }, 404);

    if (!widget.autoApproveAlterTable) {
      const proposal: TableProposal = {
        id: createProposalId(),
        widgetId: id,
        type: 'alter',
        name: tableName,
        alterations,
        createdAt: new Date().toISOString()
      };
      addProposal(id, proposal);
      console.log(`[Tables] Alter proposal created for widget ${id}: ${tableName} (id: ${proposal.id})`);
      return c.json({
        pendingApproval: true,
        proposalId: proposal.id,
        message: `Table "${tableName}" modification requires user approval. The user will see a confirmation dialog.`,
        name: tableName,
        alterations
      });
    }

    databaseManager.alterTable(tableName, alterations);
    return c.json({ success: true, table: tableName });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/** Lister les proposals en attente pour un widget */
tablesRouter.get('/:id/tables/proposals', async (c) => {
  const id = c.req.param('id');
  return c.json({ proposals: getProposals(id) });
});

/** Approuver une proposal (crée la table + assigne) */
tablesRouter.post('/:id/tables/proposals/:proposalId/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const proposalId = c.req.param('proposalId');

    const proposal = removeProposal(id, proposalId);
    if (!proposal) return c.json({ error: 'Proposal not found' }, 404);

    if (proposal.type === 'create') {
      const existingTables = databaseManager.getAllTableNames();
      if (existingTables.includes(proposal.name)) {
        return c.json({ error: `Table '${proposal.name}' already exists` }, 409);
      }

      databaseManager.createTable(proposal.name, proposal.schema);

      const widget = await widgetManager.getWidget(id);
      if (widget) {
        const permissions = widget.dbPermissions || [];
        if (!permissions.some(p => p.table === proposal.name)) {
          permissions.push({ table: proposal.name, actions: ['select', 'insert', 'update', 'delete'] as const });
          await widgetManager.updateWidget(id, { dbPermissions: permissions });
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
  const proposalId = c.req.param('proposalId');
  const proposal = removeProposal(id, proposalId);
  if (!proposal) return c.json({ error: 'Proposal not found' }, 404);
  return c.json({ success: true, rejected: proposal.name });
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

/**
 * Vérifier les tables manquantes d'un widget
 * Compare dbPermissions du manifest avec les tables réelles en base
 */
tablesRouter.get('/:id/tables/check', async (c) => {
  try {
    const id = c.req.param('id');
    const widget = await widgetManager.getWidget(id);
    if (!widget) return c.json({ error: 'Widget not found' }, 404);

    const permissions = widget.dbPermissions || [];
    if (permissions.length === 0) return c.json({ missing: [], ok: true });

    const existingTables = databaseManager.getAllTableNames();
    const missing = permissions
      .filter(p => !existingTables.includes(p.table))
      .map(p => p.table);

    return c.json({ missing, ok: missing.length === 0 });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
