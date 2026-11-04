/**
 * Routes API pour les widgets
 * Enregistre tous les sous-routeurs sur une app Hono principale
 *
 * Sous-modules :
 *   proposals.ts  – store in-memory des proposals de tables
 *   crud.ts       – CRUD widgets + permissions
 *   tables.ts     – création/altération de tables + approbation proposals
 *   instances.ts  – instances dans tabs, requêtes DB, notifications, style/grid
 *   opencode.ts   – chat SSE, upload, backups, sessions, historique
 */

import { Hono } from 'hono';
import { crudRouter } from './crud';
import { tablesRouter } from './tables';
import { instancesRouter } from './instances';
import { opencodeRouter } from './opencode';

export { getProposals, consumeProposals } from './proposals';
export type { TableProposal } from './proposals';

const widgetsApi = new Hono();

widgetsApi.route('/', crudRouter);
widgetsApi.route('/', tablesRouter);
widgetsApi.route('/', instancesRouter);
widgetsApi.route('/', opencodeRouter);

export { widgetsApi };
export default widgetsApi;
