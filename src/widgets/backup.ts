/**
 * WidgetBackupManager - Gestionnaire de sauvegardes pour widgets
 *
 * Similaire au BackupManager pour tabs mais adapté aux widgets
 * Sauvegarde : index.html, style.css, app.js, manifest.json, assets/
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdir, readdir, readFile, writeFile, cp, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config';
import type { Backup, BackupManifest } from '../types';

export class WidgetBackupManager {
  private getBackupDir(widgetId: string): string {
    return join(CONFIG.WIDGETS_DIR, widgetId, '.backups');
  }

  private getManifestPath(widgetId: string): string {
    return join(this.getBackupDir(widgetId), 'manifest.json');
  }

  private async getManifest(widgetId: string): Promise<BackupManifest> {
    const manifestPath = this.getManifestPath(widgetId);
    if (!existsSync(manifestPath)) {
      return { backups: [] };
    }
    const data = await readFile(manifestPath, 'utf-8');
    return JSON.parse(data);
  }

  private async saveManifest(widgetId: string, manifest: BackupManifest): Promise<void> {
    await writeFile(this.getManifestPath(widgetId), JSON.stringify(manifest, null, 2));
  }

  /**
   * Créer un backup d'un widget
   */
  async createBackup(
    widgetId: string,
    options?: {
      autoName?: string;
      source?: 'manual' | 'auto-opencode' | 'auto-restore';
      skipIfRecent?: boolean;
      skipIfNoChanges?: boolean;
    }
  ): Promise<Backup | null> {
    const widgetDir = join(CONFIG.WIDGETS_DIR, widgetId);
    const backupDir = this.getBackupDir(widgetId);

    // Vérifier si un backup récent existe déjà
    if (options?.skipIfRecent) {
      const lastBackupTime = await this.getLastBackupTime(widgetId);
      if (lastBackupTime && Date.now() - lastBackupTime < 30000) {
        console.log(`[WidgetBackup] Skipping backup for ${widgetId} - recent backup exists`);
        return null;
      }
    }

    // Lister les fichiers à sauvegarder
    const allFiles = await readdir(widgetDir);
    const filesToBackup = allFiles.filter(f =>
      ['index.html', 'style.css', 'app.js', 'manifest.json', 'assets'].includes(f)
    );

    // Détecter les fichiers modifiés
    const filesChanged = await this.detectChangedFiles(widgetId, filesToBackup);

    // Skip si aucun changement
    if (options?.skipIfNoChanges && filesChanged.length === 0) {
      console.log(`[WidgetBackup] Skipping backup for ${widgetId} - no changes detected`);
      return null;
    }

    const backupId = uuidv4();
    const backupPath = join(backupDir, backupId);

    // Créer le dossier de backup
    await mkdir(backupPath, { recursive: true });

    // Copier les fichiers
    for (const file of filesToBackup) {
      const srcPath = join(widgetDir, file);
      const destPath = join(backupPath, file);

      if (!existsSync(srcPath)) continue;

      const fileStat = await stat(srcPath);

      if (fileStat.isDirectory()) {
        await cp(srcPath, destPath, { recursive: true });
      } else {
        await cp(srcPath, destPath);
      }
    }

    // Générer un nom automatique
    const autoName = options?.autoName || this.generateAutoName(filesChanged, options?.source);

    const backup: Backup = {
      id: backupId,
      widgetId,
      timestamp: new Date().toISOString(),
      autoName,
      files: filesToBackup,
      filesChanged,
      source: options?.source || 'manual',
    };

    // Mettre à jour le manifest
    const manifest = await this.getManifest(widgetId);
    manifest.backups.unshift(backup);

    // Garder seulement les 50 derniers backups
    if (manifest.backups.length > 50) {
      const oldBackups = manifest.backups.splice(50);
      for (const old of oldBackups) {
        const oldPath = join(backupDir, old.id);
        if (existsSync(oldPath)) {
          await rm(oldPath, { recursive: true });
        }
      }
    }

    await this.saveManifest(widgetId, manifest);
    console.log(`[WidgetBackup] Created: ${autoName} for ${widgetId}`);
    return backup;
  }

  /**
   * Lister les backups d'un widget
   */
  async listBackups(widgetId: string): Promise<Backup[]> {
    const manifest = await this.getManifest(widgetId);
    return manifest.backups;
  }

  /**
   * Restaurer un backup
   */
  async restoreBackup(widgetId: string, backupId: string): Promise<void> {
    const widgetDir = join(CONFIG.WIDGETS_DIR, widgetId);
    const backupPath = join(this.getBackupDir(widgetId), backupId);

    if (!existsSync(backupPath)) {
      throw new Error(`Backup ${backupId} introuvable`);
    }

    // Créer un backup avant la restauration (pour pouvoir revenir en arrière).
    // Ne jamais sauter ce snapshot : c'est lui qui rend le restore réversible.
    await this.createBackup(widgetId, {
      autoName: `⏮️ Before restore · ${backupId.slice(0, 8)}`,
      source: 'auto-restore'
    });

    // Copier les fichiers du backup vers le widget
    const files = await readdir(backupPath);

    for (const file of files) {
      const srcPath = join(backupPath, file);
      const destPath = join(widgetDir, file);

      const fileStat = await stat(srcPath);

      // Supprimer d'abord le fichier/dossier de destination
      if (existsSync(destPath)) {
        await rm(destPath, { recursive: true, force: true });
      }

      if (fileStat.isDirectory()) {
        await cp(srcPath, destPath, { recursive: true });
      } else {
        await cp(srcPath, destPath);
      }
    }

    console.log(`[WidgetBackup] Restored backup ${backupId} for ${widgetId}`);
  }

  /**
   * Supprimer un backup
   */
  async deleteBackup(widgetId: string, backupId: string): Promise<void> {
    const backupPath = join(this.getBackupDir(widgetId), backupId);

    if (existsSync(backupPath)) {
      await rm(backupPath, { recursive: true });
    }

    // Mettre à jour le manifest
    const manifest = await this.getManifest(widgetId);
    manifest.backups = manifest.backups.filter(b => b.id !== backupId);
    await this.saveManifest(widgetId, manifest);

    console.log(`[WidgetBackup] Deleted backup ${backupId} for ${widgetId}`);
  }

  /**
   * Obtenir le timestamp du dernier backup
   */
  private async getLastBackupTime(widgetId: string): Promise<number | null> {
    const manifest = await this.getManifest(widgetId);
    if (manifest.backups.length === 0) return null;

    const lastBackup = manifest.backups[0];
    return new Date(lastBackup.timestamp).getTime();
  }

  /**
   * Détecter les fichiers modifiés depuis le dernier backup
   */
  private async detectChangedFiles(widgetId: string, currentFiles: string[]): Promise<string[]> {
    const manifest = await this.getManifest(widgetId);
    if (manifest.backups.length === 0) {
      return currentFiles; // Premier backup, tous les fichiers sont "changés"
    }

    const lastBackup = manifest.backups[0];
    const lastBackupPath = join(this.getBackupDir(widgetId), lastBackup.id);

    if (!existsSync(lastBackupPath)) {
      return currentFiles;
    }

    const changed: string[] = [];
    const widgetDir = join(CONFIG.WIDGETS_DIR, widgetId);

    for (const file of currentFiles) {
      const currentPath = join(widgetDir, file);
      const lastPath = join(lastBackupPath, file);

      // Fichier n'existait pas dans le dernier backup
      if (!existsSync(lastPath)) {
        changed.push(file);
        continue;
      }

      // Comparer les fichiers
      try {
        const currentStat = await stat(currentPath);
        const lastStat = await stat(lastPath);

        if (currentStat.isDirectory()) {
          const hasChanges = await this.directoryHasChanges(currentPath, lastPath);
          if (hasChanges) {
            changed.push(file);
          }
        } else {
          // Comparer la taille
          if (currentStat.size !== lastStat.size) {
            changed.push(file);
          } else {
            // Comparer le contenu
            const currentContent = await readFile(currentPath);
            const lastContent = await readFile(lastPath);
            if (!currentContent.equals(lastContent)) {
              changed.push(file);
            }
          }
        }
      } catch (err) {
        changed.push(file);
      }
    }

    return changed;
  }

  /**
   * Vérifier si un dossier a des changements
   */
  private async directoryHasChanges(dir1: string, dir2: string): Promise<boolean> {
    try {
      const files1 = await readdir(dir1);
      const files2 = await readdir(dir2);

      // Différent nombre de fichiers
      if (files1.length !== files2.length) return true;

      // Vérifier chaque fichier
      for (const file of files1) {
        if (!files2.includes(file)) return true;

        const path1 = join(dir1, file);
        const path2 = join(dir2, file);

        const stat1 = await stat(path1);
        const stat2 = await stat(path2);

        // Type différent (fichier vs dossier)
        if (stat1.isDirectory() !== stat2.isDirectory()) return true;

        if (stat1.isDirectory()) {
          // Récursion
          if (await this.directoryHasChanges(path1, path2)) return true;
        } else {
          // Comparer taille et contenu
          if (stat1.size !== stat2.size) return true;

          const content1 = await readFile(path1);
          const content2 = await readFile(path2);
          if (!content1.equals(content2)) return true;
        }
      }

      return false;
    } catch (error) {
      return true; // En cas d'erreur, considérer comme changé
    }
  }

  /**
   * Générer un nom automatique pour le backup
   */
  private generateAutoName(filesChanged: string[], source?: string): string {
    const emojis = {
      'manual': '💾',
      'auto-opencode': '🤖',
      'auto-restore': '⏮️'
    };

    const emoji = emojis[source as keyof typeof emojis] || '💾';

    if (filesChanged.length === 0) {
      return `${emoji} Backup`;
    }

    if (filesChanged.length === 1) {
      return `${emoji} Modification de ${filesChanged[0]}`;
    }

    return `${emoji} ${filesChanged.length} fichiers modifiés`;
  }
}

// Export singleton
export const widgetBackupManager = new WidgetBackupManager();
