/**
 * Gestionnaire de sessions OpenCode pour scripts globaux
 * Étend BaseOpenCodeSessionManager — surcharge uniquement ce qui est spécifique aux scripts :
 * répertoire, prompt système, backups et proposals de tables.
 */

import { join } from 'path';
import { CONFIG } from '../config';
import { globalScriptManager } from '../scripts/global-manager';
import { scriptBackupManager } from '../scripts/script-backup';
import { databaseManager } from '../database/manager';
import type { GlobalScript } from '../types';
import { BaseOpenCodeSessionManager } from './opencode-session-manager';

// Ré-exporter les types communs utilisés ailleurs
export type { ChatMessage, OpenCodeConfig, OpenCodeEvent, OpenCodeSession } from './opencode-session-manager';

// ===== Proposals de tables (in-memory, propres aux scripts) =====

interface ScriptTableProposal {
  id: string;
  scriptId: string;
  type: 'create' | 'alter';
  name: string;
  schema?: any;
  alterations?: any;
  createdAt: string;
}

const scriptProposals = new Map<string, ScriptTableProposal[]>();

export function addScriptProposal(scriptId: string, proposal: ScriptTableProposal): void {
  if (!scriptProposals.has(scriptId)) scriptProposals.set(scriptId, []);
  scriptProposals.get(scriptId)!.push(proposal);
}

export function getScriptProposals(scriptId: string): ScriptTableProposal[] {
  return scriptProposals.get(scriptId) || [];
}

export function removeScriptProposal(scriptId: string, proposalId: string): ScriptTableProposal | null {
  const proposals = scriptProposals.get(scriptId) || [];
  const idx = proposals.findIndex(p => p.id === proposalId);
  if (idx === -1) return null;
  return proposals.splice(idx, 1)[0];
}

// ===== Manager =====

class ScriptOpenCodeSessionManager extends BaseOpenCodeSessionManager {
  getEntityDir(scriptId: string): string {
    return join(CONFIG.SCRIPTS_DIR, scriptId);
  }

  protected getLogPrefix(): string {
    return '[ScriptOpenCode]';
  }

  async getSystemPrompt(scriptId: string): Promise<string> {
    const script = await globalScriptManager.getScript(scriptId);
    if (!script) throw new Error(`Script ${scriptId} introuvable`);
    return this.buildScriptSystemPrompt(script);
  }

  protected async createBeforeBackup(scriptId: string, message: string): Promise<{ id?: string } | null> {
    return scriptBackupManager.createBackup(scriptId, {
      source: 'auto-restore',
      autoName: `⏮️ Avant: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
      skipIfRecent: true,
    });
  }

  protected async createAfterBackup(scriptId: string, message: string): Promise<void> {
    await scriptBackupManager.createBackup(scriptId, {
      source: 'auto-opencode',
      autoName: `🤖 ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      skipIfRecent: true,
    });
  }

  protected getPendingProposals(scriptId: string): any[] {
    return getScriptProposals(scriptId);
  }

  /**
   * Génère le prompt système pour un script global
   */
  private async buildScriptSystemPrompt(script: GlobalScript): Promise<string> {
    const scriptSlug = script.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // === Tables assignées au script ===
    let dbSection = '';
    if (script.dbPermissions && script.dbPermissions.length > 0) {
      dbSection = `## DB — Tables assignées (${script.dbPermissions.length})\n\n`;
      for (const perm of script.dbPermissions) {
        dbSection += `**\`${perm.table}\`** — ${perm.actions.join(', ')}\n`;
        try {
          const schema = await databaseManager.getTableSchema(perm.table);
          dbSection += '```sql\n';
          for (const col of schema) {
            let colDef = `  ${col.name} ${col.type}`;
            if (col.pk) colDef += ' PRIMARY KEY';
            if (col.notnull) colDef += ' NOT NULL';
            if (col.dflt_value !== null) colDef += ` DEFAULT ${col.dflt_value}`;
            dbSection += `${colDef}\n`;
          }
          dbSection += '```\n';
        } catch (err: any) {
          dbSection += `⚠️ Table introuvable: ${err.message}\n`;
        }
      }
      dbSection += `\n\`queryDB()\` est disponible dans \`script.js\` — utilise-la directement.\n\n`;
    } else {
      dbSection = `## DB\n\nAucune table assignée. Si nécessaire, tu peux en créer une (voir section Tables ci-dessous).\n\n`;
    }

    return `# Script "${script.name}" ${script.emoji || ''}

**ID** : \`${script.id}\` | **Dossier** : \`data/scripts/${script.id}/\` | **Fichier** : \`script.js\` (unique fichier backend)
**Runtime** : Bun.js — pas de DOM, pas de \`window\`, pas d'import/require

${dbSection}## Créer / modifier une table

\`\`\`bash
# Créer
curl -s -X POST http://localhost:3000/api/scripts/${script.id}/tables \\
  -H "Content-Type: application/json" \\
  -d '{"name":"${scriptSlug}_data","schema":[{"name":"id","type":"INTEGER","primaryKey":true,"autoIncrement":true},{"name":"valeur","type":"TEXT","notNull":true}]}'

# Modifier (ajouter colonnes)
curl -s -X PATCH http://localhost:3000/api/scripts/${script.id}/tables/NOM_TABLE \\
  -H "Content-Type: application/json" \\
  -d '{"addColumns":[{"name":"col","type":"TEXT"}]}'
\`\`\`

- Table auto-assignée au script après création. Si le nom est déjà pris, l'API renvoie un nom alternatif dans la réponse — utilise ce nom dans le code
- Si \`"pendingApproval":true\` → carte de confirmation dans le chat, continue en supposant que la table sera créée
- Préfixe obligatoire : \`${scriptSlug}_\` — jamais de noms génériques (\`data\`, \`items\`, \`users\`)

## queryDB()

\`\`\`javascript
await queryDB({ table: 'ma_table', action: 'select', where: { id: 1 }, limit: 100 });
await queryDB({ table: 'ma_table', action: 'insert', data: { col: 'val' } });
await queryDB({ table: 'ma_table', action: 'update', where: { id: 1 }, data: { col: 'new' } });
await queryDB({ table: 'ma_table', action: 'delete', where: { id: 1 } });
\`\`\`

## Fonctions disponibles

\`\`\`javascript
log(message, level?)  // level: 'info'|'warn'|'error'
sendNotification({ title?, message, type?: 'success'|'error'|'warning', duration? })
await fetch(url, options?)
await sendWebhook(url, payload)  // POST JSON
await saveFile(filename, data)   // → '/api/scripts/${script.id}/files/filename'
\`\`\`

**Variables de contexte** : \`script.id\`, \`script.name\`, \`trigger\` ('cron'|'manual'|'webhook'), \`webhookPayload\`
**URL webhook** : \`POST /api/scripts/webhook/${script.id}\`

## Règles

1. Modifie **UNIQUEMENT** \`script.js\`
2. Le code est exécuté dans une async function (await fonctionne au top-level)
3. Timeout : 30 secondes max
4. Utilise \`log()\` pour le debugging, \`sendNotification()\` pour alerter l'utilisateur
5. Sois concis et écris du code fonctionnel directement
6. Si ce script génère des widgets dynamiques, conçois-les responsive à la taille de leur iframe`;
  }
}

export const scriptOpenCodeSessionManager = new ScriptOpenCodeSessionManager();
