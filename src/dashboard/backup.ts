/**
 * DashboardBackupManager — sauvegardes du projet dashboard global
 * Sauvegarde les fichiers source (JS, CSS, HTML) à l'exclusion des données widgets/tabs/scripts
 * qui ont leurs propres systèmes de backup.
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdir, readdir, readFile, writeFile, cp, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';

const DASHBOARD_DIR = '.'; // racine du projet
const BACKUP_DIR = './data/.dashboard-backups';
const MANIFEST_PATH = './data/.dashboard-backups/manifest.json';
const MAX_BACKUPS = 30;

// Dossiers à sauvegarder (relatifs à la racine du projet)
const BACKUP_SOURCES = [
  'src/public/static/js',
  'src/public/static/css',
  'src/public/index.html',
  'src/server',
  'src/opencode',
  'src/dashboard',
  'src/database',
  'src/tabs',
  'src/widgets',
  'src/scripts',
  'src/types.ts',
  'src/config.ts',
  'index.ts',
];

// Exclure les sous-dossiers redondants
const BACKUP_EXCLUDES = [
  'node_modules',
  '.sessions',
  '.backups',
  'uploads',
  'data',
];

export interface DashboardBackup {
  id: string;
  timestamp: string;
  name: string;
  source: 'manual' | 'auto-opencode' | 'auto-restore';
  fileCount: number;
}

interface BackupManifest {
  backups: DashboardBackup[];
}

class DashboardBackupManager {
  private async getManifest(): Promise<BackupManifest> {
    if (!existsSync(MANIFEST_PATH)) return { backups: [] };
    const data = await readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  }

  private async saveManifest(manifest: BackupManifest): Promise<void> {
    await mkdir(BACKUP_DIR, { recursive: true });
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  async listBackups(): Promise<DashboardBackup[]> {
    const manifest = await this.getManifest();
    return manifest.backups;
  }

  async createBackup(options?: {
    name?: string;
    source?: 'manual' | 'auto-opencode' | 'auto-restore';
    skipIfRecent?: boolean;
  }): Promise<DashboardBackup | null> {
    // Skip si backup récent (< 30s)
    if (options?.skipIfRecent) {
      const manifest = await this.getManifest();
      if (manifest.backups.length > 0) {
        const last = manifest.backups[0];
        const age = Date.now() - new Date(last.timestamp).getTime();
        if (age < 30000) {
          console.log('[DashboardBackup] Skipping — backup récent existe');
          return null;
        }
      }
    }

    const id = uuidv4();
    const backupPath = join(BACKUP_DIR, id);
    await mkdir(backupPath, { recursive: true });

    let fileCount = 0;

    for (const src of BACKUP_SOURCES) {
      const srcPath = join(DASHBOARD_DIR, src);
      if (!existsSync(srcPath)) continue;

      const destPath = join(backupPath, src);
      const s = await stat(srcPath);

      if (s.isDirectory()) {
        await this._copyDir(srcPath, destPath);
        // Compter approximativement
        fileCount++;
      } else {
        await mkdir(join(destPath, '..'), { recursive: true });
        await cp(srcPath, destPath);
        fileCount++;
      }
    }

    const source = options?.source || 'manual';
    const emoji = source === 'auto-opencode' ? '🤖' : source === 'auto-restore' ? '⏮️' : '💾';
    const name = options?.name || `${emoji} Backup dashboard`;

    const backup: DashboardBackup = {
      id,
      timestamp: new Date().toISOString(),
      name,
      source,
      fileCount,
    };

    const manifest = await this.getManifest();
    manifest.backups.unshift(backup);

    // Garder max MAX_BACKUPS
    if (manifest.backups.length > MAX_BACKUPS) {
      const old = manifest.backups.splice(MAX_BACKUPS);
      for (const b of old) {
        const p = join(BACKUP_DIR, b.id);
        if (existsSync(p)) await rm(p, { recursive: true });
      }
    }

    await this.saveManifest(manifest);
    console.log(`[DashboardBackup] Créé : ${name} (id=${id})`);
    return backup;
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backupPath = join(BACKUP_DIR, backupId);
    if (!existsSync(backupPath)) {
      throw new Error(`Backup ${backupId} introuvable`);
    }

    // Créer un backup avant restauration
    await this.createBackup({
      name: `⏮️ Avant restauration ${backupId.slice(0, 8)}`,
      source: 'auto-restore',
      skipIfRecent: true,
    });

    // Restaurer chaque source
    for (const src of BACKUP_SOURCES) {
      const srcInBackup = join(backupPath, src);
      const destPath = join(DASHBOARD_DIR, src);

      if (!existsSync(srcInBackup)) continue;

      // Supprimer l'existant
      if (existsSync(destPath)) {
        await rm(destPath, { recursive: true, force: true });
      }

      const s = await stat(srcInBackup);
      if (s.isDirectory()) {
        await cp(srcInBackup, destPath, { recursive: true });
      } else {
        await mkdir(join(destPath, '..'), { recursive: true });
        await cp(srcInBackup, destPath);
      }
    }

    console.log(`[DashboardBackup] Restauré backup ${backupId}`);
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = join(BACKUP_DIR, backupId);
    if (existsSync(backupPath)) {
      await rm(backupPath, { recursive: true });
    }
    const manifest = await this.getManifest();
    manifest.backups = manifest.backups.filter(b => b.id !== backupId);
    await this.saveManifest(manifest);
  }

  async getLatestBackupId(): Promise<string | null> {
    const manifest = await this.getManifest();
    return manifest.backups[0]?.id || null;
  }

  private async _copyDir(src: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (BACKUP_EXCLUDES.some(ex => entry.name === ex)) continue;
      const srcChild = join(src, entry.name);
      const destChild = join(dest, entry.name);
      if (entry.isDirectory()) {
        await this._copyDir(srcChild, destChild);
      } else {
        await cp(srcChild, destChild);
      }
    }
  }
}

export const dashboardBackupManager = new DashboardBackupManager();
