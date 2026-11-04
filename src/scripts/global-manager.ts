/**
 * GlobalScriptManager - CRUD pour les scripts globaux
 * Stocke dans data/scripts/{id}/
 */

import { readdir, mkdir, writeFile, readFile, rm, stat } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync } from 'fs';
import { CONFIG } from '../config';
import type { GlobalScript, GlobalScriptManifest, DbPermission } from '../types';

const DEFAULT_SCRIPT = `// Script global — Runtime Bun.js
// Fonctions disponibles : queryDB, log, fetch, sendWebhook, sendNotification
// Variables : script, trigger, webhookPayload

log('Script démarré');

// Exemple : fetch API
// const res = await fetch('https://api.example.com/data');
// const data = await res.json();
// log(\`Reçu \${data.length} entrées\`);
`;

export class GlobalScriptManager {
  private scriptsDir: string;

  constructor() {
    this.scriptsDir = CONFIG.SCRIPTS_DIR;
  }

  async initialize(): Promise<void> {
    await mkdir(this.scriptsDir, { recursive: true });
  }

  private getScriptDir(scriptId: string): string {
    return join(this.scriptsDir, scriptId);
  }

  private getManifestPath(scriptId: string): string {
    return join(this.getScriptDir(scriptId), 'manifest.json');
  }

  async createScript(data: Partial<GlobalScript>): Promise<GlobalScript> {
    await this.initialize();

    const now = new Date().toISOString();
    const script: GlobalScript = {
      id: `script-${uuidv4()}`,
      name: data.name || 'Nouveau script',
      emoji: data.emoji || '⚡',
      description: data.description || '',
      createdAt: now,
      updatedAt: now,
      enabled: data.enabled ?? false,
      triggers: data.triggers || [],
      dbPermissions: data.dbPermissions || [],
    };

    const scriptDir = this.getScriptDir(script.id);
    await mkdir(scriptDir, { recursive: true });

    // manifest.json
    const manifest: GlobalScriptManifest = { script, version: 1 };
    await writeFile(this.getManifestPath(script.id), JSON.stringify(manifest, null, 2));

    // script.js
    await writeFile(join(scriptDir, 'script.js'), DEFAULT_SCRIPT);

    // .backups/
    await mkdir(join(scriptDir, '.backups'), { recursive: true });
    await writeFile(join(scriptDir, '.backups', 'manifest.json'), JSON.stringify({ backups: [] }, null, 2));

    // .sessions/
    await mkdir(join(scriptDir, '.sessions'), { recursive: true });
    await writeFile(join(scriptDir, '.sessions', 'manifest.json'), JSON.stringify({ sessions: [], activeSessionId: null }, null, 2));

    console.log(`[GlobalScript] Créé: ${script.name} (${script.id})`);
    return script;
  }

  async getScript(scriptId: string): Promise<GlobalScript | null> {
    const manifestPath = this.getManifestPath(scriptId);
    if (!existsSync(manifestPath)) return null;
    const data = await readFile(manifestPath, 'utf-8');
    const manifest: GlobalScriptManifest = JSON.parse(data);
    return manifest.script;
  }

  async listScripts(): Promise<GlobalScript[]> {
    await this.initialize();
    const scripts: GlobalScript[] = [];
    try {
      const entries = await readdir(this.scriptsDir);
      for (const entry of entries) {
        if (!entry.startsWith('script-')) continue;
        const script = await this.getScript(entry);
        if (script) scripts.push(script);
      }
    } catch { }
    return scripts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async updateScript(scriptId: string, data: Partial<GlobalScript>): Promise<GlobalScript> {
    const script = await this.getScript(scriptId);
    if (!script) throw new Error(`Script ${scriptId} introuvable`);

    const updated: GlobalScript = {
      ...script,
      ...data,
      id: script.id,
      createdAt: script.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const manifest: GlobalScriptManifest = { script: updated, version: 1 };
    await writeFile(this.getManifestPath(scriptId), JSON.stringify(manifest, null, 2));
    return updated;
  }

  async deleteScript(scriptId: string): Promise<void> {
    const scriptDir = this.getScriptDir(scriptId);
    if (existsSync(scriptDir)) {
      await rm(scriptDir, { recursive: true });
    }
    console.log(`[GlobalScript] Supprimé: ${scriptId}`);
  }

  async getScriptCode(scriptId: string): Promise<string> {
    const codePath = join(this.getScriptDir(scriptId), 'script.js');
    if (!existsSync(codePath)) return '';
    return readFile(codePath, 'utf-8');
  }

  async saveScriptCode(scriptId: string, code: string): Promise<void> {
    const codePath = join(this.getScriptDir(scriptId), 'script.js');
    await writeFile(codePath, code);
    await this.updateScript(scriptId, { updatedAt: new Date().toISOString() } as any);
  }

  async updatePermissions(scriptId: string, permissions: DbPermission[]): Promise<void> {
    await this.updateScript(scriptId, { dbPermissions: permissions });
  }
}

export const globalScriptManager = new GlobalScriptManager();
