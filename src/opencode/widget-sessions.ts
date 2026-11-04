/**
 * Gestionnaire de sessions OpenCode pour widgets
 * Étend BaseOpenCodeSessionManager — surcharge uniquement ce qui est spécifique aux widgets :
 * répertoire, prompt système, backups et proposals de tables.
 *
 * Prompt système : voir widget-system-prompt.ts
 */

import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { CONFIG } from '../config';
import { widgetManager } from '../widgets/manager';
import { widgetBackupManager } from '../widgets/backup';
import { getProposals } from '../server/widgets/proposals';
import { buildWidgetSystemPrompt } from './widget-system-prompt';
import { BaseOpenCodeSessionManager, type OpenCodeConfig } from './opencode-session-manager';

// Ré-exporter les types communs utilisés ailleurs
export type { ChatMessage, OpenCodeConfig, OpenCodeEvent, OpenCodeSession } from './opencode-session-manager';

class WidgetOpenCodeSessionManager extends BaseOpenCodeSessionManager {
  getEntityDir(widgetId: string): string {
    return join(CONFIG.WIDGETS_DIR, widgetId);
  }

  protected getLogPrefix(): string {
    return '[WidgetOpenCode]';
  }

  async getSystemPrompt(widgetId: string): Promise<string> {
    const widget = await widgetManager.getWidget(widgetId);
    if (!widget) throw new Error(`Widget ${widgetId} introuvable`);
    return buildWidgetSystemPrompt(widget);
  }

  protected async createBeforeBackup(widgetId: string, message: string): Promise<{ id?: string } | null> {
    return widgetBackupManager.createBackup(widgetId, {
      source: 'auto-restore',
      autoName: `⏮️ Avant: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
      skipIfRecent: true,
    });
  }

  protected async createAfterBackup(widgetId: string, message: string): Promise<void> {
    await widgetBackupManager.createBackup(widgetId, {
      source: 'auto-opencode',
      autoName: `🤖 ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      skipIfNoChanges: true,
      skipIfRecent: true,
    });
  }

  protected getPendingProposals(widgetId: string): any[] {
    return getProposals(widgetId);
  }

  /** Sauvegarder un fichier uploadé pour OpenCode (images, PDFs, etc.) */
  async saveUploadedFile(widgetId: string, fileName: string, buffer: Buffer): Promise<string> {
    const widgetDir = this.getEntityDir(widgetId);
    const uploadsDir = join(widgetDir, 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = join(uploadsDir, safeName);
    await writeFile(filePath, buffer);
    return `uploads/${safeName}`;
  }
}

export const widgetOpenCodeSessionManager = new WidgetOpenCodeSessionManager();
