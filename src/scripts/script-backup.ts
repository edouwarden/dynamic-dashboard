/**
 * ScriptBackupManager - Sauvegardes pour les scripts globaux
 * Sauvegarde uniquement script.js (+ manifest.json)
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdir, readFile, writeFile, cp, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config';
import type { Backup, BackupManifest } from '../types';

export class ScriptBackupManager {
  private getBackupDir(scriptId: string): string {
    return join(CONFIG.SCRIPTS_DIR, scriptId, '.backups');
  }

  private getManifestPath(scriptId: string): string {
    return join(this.getBackupDir(scriptId), 'manifest.json');
  }

  private async getManifest(scriptId: string): Promise<BackupManifest> {
    const manifestPath = this.getManifestPath(scriptId);
    if (!existsSync(manifestPath)) return { backups: [] };
    const data = await readFile(manifestPath, 'utf-8');
    return JSON.parse(data);
  }

  private async saveManifest(scriptId: string, manifest: BackupManifest): Promise<void> {
    await writeFile(this.getManifestPath(scriptId), JSON.stringify(manifest, null, 2));
  }

  async createBackup(
    scriptId: string,
    options?: {
      autoName?: string;
      source?: 'manual' | 'auto-opencode' | 'auto-restore';
      skipIfRecent?: boolean;
    }
  ): Promise<Backup | null> {
    const scriptDir = join(CONFIG.SCRIPTS_DIR, scriptId);
    const backupDir = this.getBackupDir(scriptId);

    if (options?.skipIfRecent) {
      const manifest = await this.getManifest(scriptId);
      if (manifest.backups.length > 0) {
        const lastTime = new Date(manifest.backups[0].timestamp).getTime();
        if (Date.now() - lastTime < 30000) return null;
      }
    }

    const backupId = uuidv4();
    const backupPath = join(backupDir, backupId);
    await mkdir(backupPath, { recursive: true });

    const filesToBackup = ['script.js', 'manifest.json'];
    for (const file of filesToBackup) {
      const src = join(scriptDir, file);
      if (existsSync(src)) await cp(src, join(backupPath, file));
    }

    const emojis = { 'manual': '💾', 'auto-opencode': '🤖', 'auto-restore': '⏮️' };
    const emoji = emojis[options?.source as keyof typeof emojis] || '💾';
    const autoName = options?.autoName || `${emoji} Backup script.js`;

    const backup: Backup = {
      id: backupId,
      widgetId: scriptId,
      timestamp: new Date().toISOString(),
      autoName,
      files: filesToBackup,
      filesChanged: ['script.js'],
      source: options?.source || 'manual',
    };

    const manifest = await this.getManifest(scriptId);
    manifest.backups.unshift(backup);

    // Max 30 backups
    if (manifest.backups.length > 30) {
      const old = manifest.backups.splice(30);
      for (const o of old) {
        const p = join(backupDir, o.id);
        if (existsSync(p)) await rm(p, { recursive: true });
      }
    }

    await this.saveManifest(scriptId, manifest);
    console.log(`[ScriptBackup] Créé: ${autoName} pour ${scriptId}`);
    return backup;
  }

  async listBackups(scriptId: string): Promise<Backup[]> {
    const manifest = await this.getManifest(scriptId);
    return manifest.backups;
  }

  async restoreBackup(scriptId: string, backupId: string): Promise<void> {
    const scriptDir = join(CONFIG.SCRIPTS_DIR, scriptId);
    const backupPath = join(this.getBackupDir(scriptId), backupId);
    if (!existsSync(backupPath)) throw new Error(`Backup ${backupId} introuvable`);

    await this.createBackup(scriptId, { autoName: '⏮️ Avant restauration', source: 'auto-restore', skipIfRecent: true });

    for (const file of ['script.js', 'manifest.json']) {
      const src = join(backupPath, file);
      const dest = join(scriptDir, file);
      if (existsSync(src)) {
        if (existsSync(dest)) await rm(dest, { force: true });
        await cp(src, dest);
      }
    }
    console.log(`[ScriptBackup] Restauré: ${backupId} pour ${scriptId}`);
  }

  async deleteBackup(scriptId: string, backupId: string): Promise<void> {
    const backupPath = join(this.getBackupDir(scriptId), backupId);
    if (existsSync(backupPath)) await rm(backupPath, { recursive: true });
    const manifest = await this.getManifest(scriptId);
    manifest.backups = manifest.backups.filter(b => b.id !== backupId);
    await this.saveManifest(scriptId, manifest);
  }
}

export const scriptBackupManager = new ScriptBackupManager();
