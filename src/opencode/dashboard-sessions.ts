/**
 * Gestionnaire de sessions OpenCode pour le dashboard global
 * Étend BaseOpenCodeSessionManager — permet à OpenCode de modifier le dashboard lui-même.
 * Le répertoire de travail est la racine du projet.
 * Backup automatique avant/après chaque prompt.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { dashboardBackupManager } from '../dashboard/backup';
import { BaseOpenCodeSessionManager } from './opencode-session-manager';

// Ré-exporter les types communs
export type { ChatMessage, OpenCodeConfig, OpenCodeEvent, OpenCodeSession } from './opencode-session-manager';

// ID fixe pour les sessions dashboard (entité unique)
export const DASHBOARD_ENTITY_ID = 'dashboard';

class DashboardOpenCodeSessionManager extends BaseOpenCodeSessionManager {
  getEntityDir(_entityId: string): string {
    // Les sessions (.sessions/) seront stockées dans data/.dashboard-entity/
    return './data/.dashboard-entity';
  }

  protected getCwd(_entityId: string): string {
    // Claude s'exécute depuis la racine du projet pour accéder à tous les fichiers
    return '.';
  }

  protected getLogPrefix(): string {
    return '[DashboardOpenCode]';
  }

  async getSystemPrompt(_entityId: string): Promise<string> {
    return buildDashboardSystemPrompt();
  }

  protected async createBeforeBackup(entityId: string, message: string): Promise<{ id?: string } | null> {
    return dashboardBackupManager.createBackup({
      name: `⏮️ Avant: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
      source: 'auto-restore',
      skipIfRecent: true,
    });
  }

  protected async createAfterBackup(entityId: string, message: string): Promise<void> {
    // Bump les versions frontend (cache-busting automatique)
    await runBump();

    await dashboardBackupManager.createBackup({
      name: `🤖 ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      source: 'auto-opencode',
      skipIfRecent: true,
    });
  }
}

/** Exécute bun run bump pour incrémenter les ?v= dans les fichiers frontend */
function runBump(): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', 'bump'], {
      cwd: '.',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d: Buffer) => console.log('[DashboardOpenCode] bump:', d.toString().trim()));
    proc.stderr.on('data', (d: Buffer) => console.error('[DashboardOpenCode] bump err:', d.toString().trim()));
    proc.on('close', () => resolve());
    proc.on('error', () => resolve()); // Ne pas bloquer si bun indisponible
  });
}

export const dashboardOpenCodeSessionManager = new DashboardOpenCodeSessionManager();

// =====================================================================
// System prompt dashboard
// =====================================================================

async function buildDashboardSystemPrompt(): Promise<string> {
  // Note: Cette fonction génère le prompt système pour OpenCode dans le contexte dashboard
  // Lire le root TREEFRAG pour le contexte projet (CLAUDE_CORE.md optionnel, peut ne pas exister)
  let treefragRoot = '';
  let claudeCore = '';

  try {
    if (existsSync('./docs/claude-context/TREEFRAG_ROOT.md')) {
      treefragRoot = await readFile('./docs/claude-context/TREEFRAG_ROOT.md', 'utf-8');
    }
  } catch { /* ignorer */ }

  try {
    if (existsSync('./docs/claude-context/CLAUDE_CORE.md')) {
      claudeCore = await readFile('./docs/claude-context/CLAUDE_CORE.md', 'utf-8');
    }
  } catch { /* ignorer */ }

  return `Tu es un assistant spécialisé dans la modification du Dashboard.
Tu as accès à tous les fichiers du projet et peux les modifier directement.

## Contexte Projet
${claudeCore || treefragRoot || 'Dashboard web modulaire avec Bun.js + Hono + SQLite + widgets iframes.'}

## Règles Critiques

### Cache-busting (OBLIGATOIRE)
Après chaque modification de fichier frontend (JS, CSS, HTML), les versions seront **automatiquement incrémentées** par le système — tu n'as pas à t'en occuper.
MAIS : tu dois quand même modifier les fichiers avec le bon numéro de version **courant** pour les imports inter-modules.
Pour connaître la version actuelle, lis \`src/public/index.html\` et cherche \`?v=\`.

### Structure des fichiers
- Frontend JS : \`src/public/static/js/\`
  - \`dashboard/core.js\` — classe Dashboard principale
  - \`dashboard/tabs.js\`, \`tabs-ops.js\` — gestion onglets
  - \`dashboard/ui/events.js\` — tous les event listeners
  - \`managers/opencode-panel.js\` — panneau OpenCode unifié (ne pas dupliquer)
- Frontend CSS : \`src/public/static/css/\`
- HTML principal : \`src/public/index.html\`
- Backend : \`src/server/\`, \`src/opencode/\`, \`src/database/\`, etc.
- Point d'entrée serveur : \`index.ts\`

### Patterns obligatoires
- Les features Dashboard s'ajoutent via \`Object.assign(Dashboard.prototype, {...})\`
- Le ClaudePanel unifié est réutilisé — ne pas recréer de système SSE custom
- Les events sont dans \`dashboard/ui/events.js\`
- Les imports ES modules utilisent \`?v=XX\` — respecter la version existante

### Ce que tu peux faire
- Modifier tout fichier JS/TS/CSS/HTML du projet
- Ajouter de nouvelles features, corriger des bugs
- Modifier l'UI, le CSS, les routes API
- Réorganiser le code

### Ce que tu ne dois PAS faire
- Supprimer ou écraser \`data/\` (bases de données, widgets des utilisateurs)
- Modifier \`data/dashboard.db\` directement
- Toucher aux fichiers \`node_modules/\`

### Après tes modifications
Les versions frontend seront auto-incrémentées. Tu n'as pas à exécuter bun run bump.
`;
}
