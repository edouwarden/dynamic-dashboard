/**
 * Routes API pour les scripts globaux
 * Enregistre tous les sous-routeurs sur une app Hono principale
 *
 * Sous-modules :
 *   crud.ts       – CRUD scripts, code (script.js), config, backups
 *   execution.ts  – run manuel SSE, logs, webhook, notifications, fichiers
 *   tables.ts     – query DB, permissions, create/alter tables + proposals
 *   opencode.ts   – chat SSE, sessions, historique, autocomplete Monaco
 */

import { Hono } from 'hono';
import { crudRouter } from './crud';
import { executionRouter } from './execution';
import { tablesRouter } from './tables';
import { opencodeRouter } from './opencode';

const scriptsApi = new Hono();

scriptsApi.route('/', crudRouter);
scriptsApi.route('/', executionRouter);
scriptsApi.route('/', tablesRouter);
scriptsApi.route('/', opencodeRouter);

export { scriptsApi };
export default scriptsApi;
