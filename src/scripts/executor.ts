/**
 * Moteur d'exécution des scripts globaux
 * Charge script.js, injecte le contexte (queryDB, log, fetch, sendWebhook, sendNotification, saveFile)
 * et exécute dans un environnement contrôlé avec timeout
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { CONFIG } from '../config';
import { databaseManager } from '../database/manager';
import { globalScriptManager } from './global-manager';
import type { DbPermission, QueryRequest } from '../types';

export interface ScriptLogEntry {
  widget_id: string;
  trigger_type: string;
  status: 'success' | 'error';
  logs: string; // JSON array
  error?: string | null;
  duration_ms: number;
}

const SCRIPT_TIMEOUT_MS = 30_000; // 30 secondes max

// === Notifications en attente depuis les scripts globaux ===
interface PendingNotification {
  scriptId: string;
  scriptName: string;
  scriptEmoji?: string;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  timestamp: string;
}

const pendingNotifications: PendingNotification[] = [];

export function getPendingNotifications(): PendingNotification[] {
  return pendingNotifications.splice(0);
}

export function addPendingNotification(notif: Omit<PendingNotification, 'timestamp'> & { timestamp?: string }): void {
  pendingNotifications.push({ ...notif, timestamp: notif.timestamp || new Date().toISOString() });
  // Persister dans le centre de notifications
  try {
    databaseManager.queryRaw(
      `INSERT INTO notification_center (title, message, type, icon, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [notif.title || null, notif.message, notif.type || 'info', notif.scriptEmoji || null, 'script', notif.scriptId, notif.scriptName]
    );
  } catch { /* ignore */ }
}

/**
 * Exécute un script global (standalone, sans widget parent)
 */
export async function executeGlobalScript(
  scriptId: string,
  trigger: 'cron' | 'manual' | 'webhook',
  webhookPayload?: any,
  onLog?: (entry: { level: string; message: string; ts: string }) => void
): Promise<ScriptLogEntry> {
  const startTime = Date.now();
  const logs: Array<{ level: string; message: string; ts: string }> = [];

  const script = await globalScriptManager.getScript(scriptId);
  if (!script) throw new Error(`Script ${scriptId} introuvable`);

  const { join } = await import('path');
  const { readFile } = await import('fs/promises');
  const { existsSync } = await import('fs');
  const { CONFIG } = await import('../config');

  const scriptPath = join(CONFIG.SCRIPTS_DIR, scriptId, 'script.js');
  if (!existsSync(scriptPath)) throw new Error(`script.js introuvable pour ${script.name}`);

  const scriptCode = await readFile(scriptPath, 'utf-8');
  const permissions = script.dbPermissions || [];

  const contextQueryDB = (query: QueryRequest) =>
    databaseManager.executeQuery(scriptId, permissions, query);

  const contextLog = (message: any, level: string = 'info') => {
    const entry = { level, message: String(message), ts: new Date().toISOString() };
    logs.push(entry);
    onLog?.(entry);
    console.log(`[GlobalScript:${script.name}] [${level}] ${message}`);
  };

  const contextSendWebhook = async (url: string, data: any) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  const contextSendNotification = (options: {
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
  }) => {
    pendingNotifications.push({
      scriptId,
      scriptName: script.name,
      scriptEmoji: script.emoji,
      ...options,
      timestamp: new Date().toISOString(),
    });
  };

  const contextSaveFile = async (filename: string, data: ArrayBuffer | Buffer | string): Promise<string> => {
    const cacheDir = join(CONFIG.SCRIPTS_DIR, scriptId, 'cache');
    await mkdir(cacheDir, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const buf = data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data as any);
    await writeFile(join(cacheDir, safeName), buf);
    return `/api/scripts/${scriptId}/files/${safeName}`;
  };

  const contextScript = { id: script.id, name: script.name };

  let status: 'success' | 'error' = 'success';
  let errorMessage: string | null = null;

  try {
    const wrappedCode = `
      return (async function(queryDB, log, fetch, sendWebhook, sendNotification, saveFile, script, trigger, webhookPayload) {
        "use strict";
        ${scriptCode}
      })(queryDB, log, fetch, sendWebhook, sendNotification, saveFile, script, trigger, webhookPayload);
    `;
    const fn = new Function('queryDB', 'log', 'fetch', 'sendWebhook', 'sendNotification', 'saveFile', 'script', 'trigger', 'webhookPayload', wrappedCode);
    await Promise.race([
      fn(contextQueryDB, contextLog, globalThis.fetch, contextSendWebhook, contextSendNotification, contextSaveFile, contextScript, trigger, webhookPayload || null),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: script dépassé ${SCRIPT_TIMEOUT_MS / 1000}s`)), SCRIPT_TIMEOUT_MS))
    ]);
  } catch (err: any) {
    status = 'error';
    errorMessage = err.message || String(err);
    logs.push({ level: 'error', message: errorMessage!, ts: new Date().toISOString() });
    console.error(`[GlobalScript:${script.name}] Erreur:`, errorMessage);
  }

  const duration = Date.now() - startTime;
  const entry: ScriptLogEntry = {
    widget_id: scriptId,
    trigger_type: trigger,
    status,
    logs: JSON.stringify(logs),
    error: errorMessage,
    duration_ms: duration,
  };

  try {
    databaseManager.insertRow('script_logs', entry);
  } catch (err) {
    console.error(`[GlobalScript:${script.name}] Erreur sauvegarde log:`, err);
  }

  try {
    await globalScriptManager.updateScript(scriptId, {
      lastRun: new Date().toISOString(),
      lastStatus: status,
    });
  } catch (err) {
    console.error(`[GlobalScript:${script.name}] Erreur mise à jour manifest:`, err);
  }

  return entry;
}
