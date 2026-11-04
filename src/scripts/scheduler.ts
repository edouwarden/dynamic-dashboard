/**
 * Planificateur de scripts backend
 * Tick toutes les 60s, vérifie les expressions cron, déclenche les scripts
 * Pas de dépendance externe — parseur cron minimal intégré
 */

import { executeGlobalScript } from './executor';
import { globalScriptManager } from './global-manager';
import type { GlobalScript } from '../types';

interface ScheduledJob {
  id: string;
  cronExpression: string;
}

class ScriptScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialise le scheduler au démarrage du serveur
   * Charge tous les widgets avec scripts cron activés
   */
  async init(): Promise<void> {
    console.log('[Scheduler] Initialisation des scripts planifiés...');

    // Charger les scripts globaux
    const scripts = await globalScriptManager.listScripts();
    for (const script of scripts) {
      if (script.enabled) {
        this.registerGlobalScript(script.id, script);
      }
    }

    console.log(`[Scheduler] ${this.jobs.size} job(s) cron enregistré(s)`);

    // Tick toutes les 60 secondes
    this.tickTimer = setInterval(() => this.tick(), 60_000);
  }

  registerGlobalScript(scriptId: string, script: GlobalScript): void {
    this.unregisterGlobalScript(scriptId);
    if (!script.enabled) return;
    const cronTrigger = script.triggers.find(t => t.type === 'cron' && t.enabled && t.cron);
    if (cronTrigger && cronTrigger.cron) {
      this.jobs.set(scriptId, { id: scriptId, cronExpression: cronTrigger.cron });
      console.log(`[Scheduler] Global script enregistré: ${scriptId} → ${cronTrigger.cron}`);
    }
  }

  unregisterGlobalScript(scriptId: string): void {
    if (this.jobs.has(scriptId)) {
      this.jobs.delete(scriptId);
      console.log(`[Scheduler] Global script supprimé: ${scriptId}`);
    }
  }

  /**
   * Vérifie toutes les 60s si un job cron doit être déclenché
   */
  private tick(): void {
    const now = new Date();

    for (const [id, job] of this.jobs) {
      if (cronMatches(job.cronExpression, now)) {
        console.log(`[Scheduler] Déclenchement: ${id} (${job.cronExpression})`);
        executeGlobalScript(id, 'cron').catch(err =>
          console.error(`[Scheduler] Erreur global script ${id}:`, err.message)
        );
      }
    }
  }

  /**
   * Arrête le scheduler
   */
  destroy(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.jobs.clear();
    console.log('[Scheduler] Arrêté');
  }

  /**
   * Nombre de jobs actifs
   */
  get jobCount(): number {
    return this.jobs.size;
  }
}

// Parseur cron : "minute heure jour-mois mois jour-semaine"
function cronMatches(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const fields = [
    { value: date.getMinutes(), field: parts[0] },
    { value: date.getHours(), field: parts[1] },
    { value: date.getDate(), field: parts[2] },
    { value: date.getMonth() + 1, field: parts[3] },
    { value: date.getDay(), field: parts[4] },
  ];

  for (const { value, field } of fields) {
    if (!fieldMatches(field, value)) return false;
  }

  return true;
}

/**
 * Vérifie si un champ cron correspond à une valeur
 */
function fieldMatches(field: string, value: number): boolean {
  // Wildcard
  if (field === '*') return true;

  // Step : */N
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2));
    if (isNaN(step) || step <= 0) return false;
    return value % step === 0;
  }

  // Range : N-M
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    if (isNaN(start) || isNaN(end)) return false;
    return value >= start && value <= end;
  }

  // Liste : N,M,O
  if (field.includes(',')) {
    const values = field.split(',').map(Number);
    return values.includes(value);
  }

  // Valeur simple
  return parseInt(field) === value;
}

export const scriptScheduler = new ScriptScheduler();
