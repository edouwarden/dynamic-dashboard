// Gestionnaire des sauvegardes

import { v4 as uuidv4 } from 'uuid';
import { mkdir, readdir, readFile, writeFile, cp, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config';
import type { Backup, BackupManifest } from '../types';

export class BackupManager {
  private getBackupDir(tabId: string): string {
    return join(CONFIG.TABS_DIR, tabId, '.backups');
  }

  private getManifestPath(tabId: string): string {
    return join(this.getBackupDir(tabId), 'manifest.json');
  }

  private async getManifest(tabId: string): Promise<BackupManifest> {
    const manifestPath = this.getManifestPath(tabId);
    if (!existsSync(manifestPath)) {
      return { backups: [] };
    }
    const data = await readFile(manifestPath, 'utf-8');
    return JSON.parse(data);
  }

  private async saveManifest(tabId: string, manifest: BackupManifest): Promise<void> {
    await writeFile(this.getManifestPath(tabId), JSON.stringify(manifest, null, 2));
  }

  async createBackup(
    tabId: string,
    description?: string,
    options?: {
      source?: 'manual' | 'auto-opencode' | 'auto-restore';
      skipIfRecent?: boolean; // Skip si backup récent (< 30s)
      skipIfNoChanges?: boolean; // Skip si aucun fichier modifié
      screenshot?: string; // Base64 screenshot (optionnel)
      userMessage?: string;
    }
  ): Promise<Backup | null> {
    const tabDir = join(CONFIG.TABS_DIR, tabId);
    const backupDir = this.getBackupDir(tabId);

    // Vérifier si un backup récent existe déjà
    if (options?.skipIfRecent) {
      const lastBackupTime = await this.getLastBackupTime(tabId);
      if (lastBackupTime && Date.now() - lastBackupTime < 30000) {
        console.log(`[Backup] Skipping backup for ${tabId} - recent backup exists`);
        return null;
      }
    }

    // Lister les fichiers à sauvegarder (uniquement le dossier content/)
    const files = await readdir(tabDir);
    const filesToBackup = files.filter(f => f === 'content');

    // Détecter les fichiers modifiés depuis le dernier backup
    const filesChanged = await this.detectChangedFiles(tabId, filesToBackup);

    // Skip si aucun changement et que l'option est activée
    if (options?.skipIfNoChanges && filesChanged.length === 0) {
      console.log(`[Backup] Skipping backup for ${tabId} - no changes detected`);
      return null;
    }

    const backupId = uuidv4();
    const backupPath = join(backupDir, backupId);

    // Créer le dossier de backup
    await mkdir(backupPath, { recursive: true });

    // Copier les fichiers
    for (const file of filesToBackup) {
      const srcPath = join(tabDir, file);
      const destPath = join(backupPath, file);
      const fileStat = await stat(srcPath);

      if (fileStat.isDirectory()) {
        await cp(srcPath, destPath, { recursive: true });
      } else {
        await cp(srcPath, destPath);
      }
    }

    // Générer un nom automatique basé sur les changements
    const autoName = this.generateAutoName(filesChanged, options?.source, options?.userMessage);
    console.log('[Backup] Generated autoName:', autoName, 'for source:', options?.source, 'with message:', options?.userMessage);

    // Sauvegarder le screenshot si fourni
    let screenshotPath: string | undefined;
    if (options?.screenshot) {
      try {
        screenshotPath = 'screenshot.png';
        const screenshotData = options.screenshot.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(screenshotData, 'base64');
        await writeFile(join(backupPath, screenshotPath), buffer);
      } catch (err) {
        console.error('[Backup] Failed to save screenshot:', err);
        screenshotPath = undefined;
      }
    }

    const backup: Backup = {
      id: backupId,
      tabId,
      timestamp: new Date().toISOString(),
      description,
      autoName,
      screenshot: screenshotPath,
      files: filesToBackup,
      filesChanged,
      source: options?.source || 'manual',
    };

    // Mettre à jour le manifest
    const manifest = await this.getManifest(tabId);
    console.log('[Backup] Backup object before saving to manifest:', JSON.stringify(backup, null, 2));
    manifest.backups.unshift(backup); // Ajouter au début

    // Garder seulement les 50 derniers backups
    if (manifest.backups.length > 50) {
      const oldBackups = manifest.backups.splice(50);
      // Supprimer les anciens backups du disque
      for (const old of oldBackups) {
        const oldPath = join(backupDir, old.id);
        if (existsSync(oldPath)) {
          await rm(oldPath, { recursive: true });
        }
      }
    }

    await this.saveManifest(tabId, manifest);
    console.log(`[Backup] Created: ${autoName || description || backupId}`);
    return backup;
  }

  private async detectChangedFiles(tabId: string, currentFiles: string[]): Promise<string[]> {
    const manifest = await this.getManifest(tabId);
    if (manifest.backups.length === 0) {
      return currentFiles; // Premier backup, tous les fichiers sont "changés"
    }

    const lastBackup = manifest.backups[0];
    const lastBackupPath = join(this.getBackupDir(tabId), lastBackup.id);

    if (!existsSync(lastBackupPath)) {
      return currentFiles;
    }

    const changed: string[] = [];
    const tabDir = join(CONFIG.TABS_DIR, tabId);

    for (const file of currentFiles) {
      const currentPath = join(tabDir, file);
      const lastPath = join(lastBackupPath, file);

      // Fichier n'existait pas dans le dernier backup
      if (!existsSync(lastPath)) {
        changed.push(file);
        continue;
      }

      // Comparer les stats (taille et date de modification)
      try {
        const currentStat = await stat(currentPath);
        const lastStat = await stat(lastPath);

        // Pour les dossiers, on vérifie récursivement
        if (currentStat.isDirectory()) {
          const hasChanges = await this.directoryHasChanges(currentPath, lastPath);
          if (hasChanges) {
            changed.push(file);
          }
        } else {
          // Pour les fichiers, comparer taille et contenu
          if (currentStat.size !== lastStat.size) {
            changed.push(file);
          } else {
            // Si même taille, comparer le contenu
            const currentContent = await readFile(currentPath);
            const lastContent = await readFile(lastPath);
            if (!currentContent.equals(lastContent)) {
              changed.push(file);
            }
          }
        }
      } catch (err) {
        // En cas d'erreur, considérer comme changé
        changed.push(file);
      }
    }

    return changed;
  }

  private async directoryHasChanges(dir1: string, dir2: string): Promise<boolean> {
    try {
      const files1 = await readdir(dir1);
      const files2 = await readdir(dir2);

      // Nombre de fichiers différent
      if (files1.length !== files2.length) return true;

      // Comparer chaque fichier
      for (const file of files1) {
        const path1 = join(dir1, file);
        const path2 = join(dir2, file);

        if (!existsSync(path2)) return true;

        const stat1 = await stat(path1);
        const stat2 = await stat(path2);

        if (stat1.isDirectory() !== stat2.isDirectory()) return true;

        if (stat1.isFile()) {
          if (stat1.size !== stat2.size) return true;
          const content1 = await readFile(path1);
          const content2 = await readFile(path2);
          if (!content1.equals(content2)) return true;
        } else if (stat1.isDirectory()) {
          const hasChanges = await this.directoryHasChanges(path1, path2);
          if (hasChanges) return true;
        }
      }

      return false;
    } catch {
      return true; // En cas d'erreur, considérer comme changé
    }
  }

  private generateAutoName(filesChanged: string[], source?: string, userMessage?: string): string {
    const emojis: Record<string, string> = {
      'manual': '💾',
      'auto-opencode': '🤖',
      'auto-restore': '⏮️',
    };

    const emoji = emojis[source || 'manual'] || '💾';

    if (source === 'auto-opencode' && userMessage) {
      // Tronquer le message à 50 caractères
      const truncated = userMessage.length > 50
        ? userMessage.substring(0, 50) + '...'
        : userMessage;
      return `${emoji} ${truncated}`;
    }

    if (!filesChanged || filesChanged.length === 0) {
      return `${emoji} Sauvegarde initiale`;
    }

    // Détecter le type de changement
    const hasContent = filesChanged.some(f => f === 'content' || f.startsWith('content/'));
    const hasConfig = filesChanged.some(f => f === 'tab.json' || f === 'CLAUDE.md');

    if (filesChanged.length === 1) {
      const file = filesChanged[0];
      if (file === 'content') {
        return `${emoji} Modification du contenu`;
      }
      return `${emoji} Modification de ${file}`;
    }

    if (hasContent && filesChanged.length <= 3) {
      return `${emoji} Modification de ${filesChanged.join(', ')}`;
    }

    if (hasContent) {
      return `${emoji} Mise à jour du contenu (${filesChanged.length} fichiers)`;
    }

    if (hasConfig) {
      return `${emoji} Mise à jour de la configuration`;
    }

    return `${emoji} Modifications (${filesChanged.length} fichiers)`;
  }

  async getBackups(tabId: string): Promise<Backup[]> {
    const manifest = await this.getManifest(tabId);
    return manifest.backups;
  }

  async getLastBackupTime(tabId: string): Promise<number | null> {
    const manifest = await this.getManifest(tabId);
    if (manifest.backups.length === 0) return null;
    return new Date(manifest.backups[0].timestamp).getTime();
  }

  async getBackup(tabId: string, backupId: string): Promise<Backup | null> {
    const manifest = await this.getManifest(tabId);
    return manifest.backups.find(b => b.id === backupId) || null;
  }

  async restoreBackup(tabId: string, backupId: string): Promise<boolean> {
    const backup = await this.getBackup(tabId, backupId);
    if (!backup) return false;

    const tabDir = join(CONFIG.TABS_DIR, tabId);
    const backupPath = join(this.getBackupDir(tabId), backupId);

    if (!existsSync(backupPath)) return false;

    // Créer un backup avant la restauration SEULEMENT si skipIfRecent ne trouve pas de backup récent
    const backupCreated = await this.createBackup(
      tabId,
      `Avant restauration de "${backup.autoName || backupId.slice(0, 8)}"`,
      {
        source: 'auto-restore',
        skipIfRecent: true, // Ne crée pas de backup si un existe déjà < 30s
      }
    );

    if (backupCreated) {
      console.log('[Backup] Safety backup created before restore');
    } else {
      console.log('[Backup] Skipped safety backup (recent backup exists)');
    }

    // Supprimer uniquement le dossier content/ actuel
    const contentDir = join(tabDir, 'content');
    if (existsSync(contentDir)) {
      await rm(contentDir, { recursive: true });
    }

    // Restaurer uniquement le dossier content/ depuis le backup
    const backupContentDir = join(backupPath, 'content');
    if (existsSync(backupContentDir)) {
      await cp(backupContentDir, contentDir, { recursive: true });
    }

    return true;
  }

  async deleteBackup(tabId: string, backupId: string): Promise<boolean> {
    const manifest = await this.getManifest(tabId);
    const index = manifest.backups.findIndex(b => b.id === backupId);
    if (index === -1) return false;

    // Supprimer du disque
    const backupPath = join(this.getBackupDir(tabId), backupId);
    if (existsSync(backupPath)) {
      await rm(backupPath, { recursive: true });
    }

    // Supprimer du manifest
    manifest.backups.splice(index, 1);
    await this.saveManifest(tabId, manifest);

    return true;
  }

  async getBackupScreenshot(tabId: string, backupId: string): Promise<Buffer | null> {
    const backup = await this.getBackup(tabId, backupId);
    if (!backup || !backup.screenshot) return null;

    const screenshotPath = join(this.getBackupDir(tabId), backupId, backup.screenshot);
    if (!existsSync(screenshotPath)) return null;

    return await readFile(screenshotPath);
  }
}

export const backupManager = new BackupManager();
