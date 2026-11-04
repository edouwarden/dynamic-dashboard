/**
 * Gestionnaire de sessions OpenCode — classe de base abstraite
 * Centralise la logique commune : sessions CRUD, subprocess OpenCode, SSE streaming.
 * Chaque contexte (widget, script, dashboard…) étend cette classe et surcharge
 * uniquement getEntityDir(), getSystemPrompt() et les hooks de backup/proposals.
 */

import { join } from 'path';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  serverPool,
  createSessionOnServer,
  streamSSE,
  sendMessageToSession,
} from './opencode-server-pool';

const activeSSEControllers = new Map<string, AbortController>();

// =====================================================================
// Compteur d'usage global (in-memory, remis à zéro chaque jour)
// =====================================================================
export const opencodeUsageTracker = {
  requestsToday:    0,
  totalRequests:    0,
  inputTokensToday:  0,
  outputTokensToday: 0,
  rateLimitCount:    0,
  lastResetDate:    new Date().toDateString(),
  byModel:          {} as Record<string, number>,

  trackRequest(model: string) {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.requestsToday    = 0;
      this.inputTokensToday  = 0;
      this.outputTokensToday = 0;
      this.lastResetDate    = today;
    }
    this.requestsToday++;
    this.totalRequests++;
    this.byModel[model] = (this.byModel[model] || 0) + 1;
  },

  trackTokens(inputTokens: number, outputTokens: number) {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.requestsToday    = 0;
      this.inputTokensToday  = 0;
      this.outputTokensToday = 0;
      this.lastResetDate    = today;
    }
    this.inputTokensToday  += inputTokens;
    this.outputTokensToday += outputTokens;
  },

  trackRateLimit() {
    this.rateLimitCount++;
  },
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  backupId?: string;
  actions?: any[];
}

export interface OpenCodeConfig {
  model?: string;
  thinking?: boolean;
  agent?: string;
}

// Modèles supportés par OpenCode
const DEFAULT_MODELS = ['opencode-go/minimax-m2.7', 'minimax-m2.7', 'sonnet', 'haiku', 'opus'];

function isKnownModel(model?: string): boolean {
  if (!model) return true;
  return DEFAULT_MODELS.includes(model) || model.includes(':');
}

export interface OpenCodeEvent {
  type: 'text' | 'tool_use' | 'thinking' | 'error' | 'done' | 'table_proposal';
  data: any;
}

export interface OpenCodeSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionsManifest {
  sessions: OpenCodeSession[];
  activeSessionId?: string;
}

interface ImageData {
  name: string;
  type: string;
  data: string;
}

export abstract class BaseOpenCodeSessionManager {
  // ===== À implémenter par chaque contexte =====

  /** Chemin absolu vers le dossier de l'entité (widget, script, etc.) */
  abstract getEntityDir(entityId: string): string;

  /** Prompt système dynamique pour OpenCode */
  abstract getSystemPrompt(entityId: string): Promise<string>;

  // ===== Hooks optionnels (surcharger si nécessaire) =====

  /** Backup AVANT envoi. Retourne l'objet backup (pour stocker le backupId) ou null. */
  protected async createBeforeBackup(entityId: string, message: string): Promise<{ id?: string } | null> {
    return null;
  }

  /** Backup APRÈS que OpenCode a terminé. */
  protected async createAfterBackup(entityId: string, message: string): Promise<void> {
    // no-op par défaut
  }

  /** Retourne les proposals de tables en attente à émettre après la réponse. */
  protected getPendingProposals(entityId: string): any[] {
    return [];
  }

  /** Préfixe de log pour identifier le contexte dans la console. */
  protected getLogPrefix(): string {
    return '[OpenCode]';
  }

  /** Répertoire de travail du subprocess OpenCode (par défaut = entityDir). */
  protected getCwd(entityId: string): string {
    return this.getEntityDir(entityId);
  }

  /** Agent OpenCode à utiliser (par défaut: 'safe') */
  protected getAgent(): string {
    return 'safe';
  }

  // ===== Session CRUD (commun) =====

  private getSessionsDir(entityId: string): string {
    return join(this.getEntityDir(entityId), '.sessions');
  }

  private getManifestPath(entityId: string): string {
    return join(this.getSessionsDir(entityId), 'manifest.json');
  }

  private getSessionHistoryPath(entityId: string, sessionId: string): string {
    return join(this.getSessionsDir(entityId), sessionId, 'history.json');
  }

  private async loadManifest(entityId: string): Promise<SessionsManifest> {
    const manifestPath = this.getManifestPath(entityId);
    if (!existsSync(manifestPath)) return { sessions: [] };
    const content = await readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  private async saveManifest(entityId: string, manifest: SessionsManifest): Promise<void> {
    const sessionsDir = this.getSessionsDir(entityId);
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(this.getManifestPath(entityId), JSON.stringify(manifest, null, 2));
  }

  async listSessions(entityId: string): Promise<OpenCodeSession[]> {
    const manifest = await this.loadManifest(entityId);
    return manifest.sessions;
  }

  async getActiveSession(entityId: string): Promise<string | null> {
    const manifest = await this.loadManifest(entityId);
    return manifest.activeSessionId || null;
  }

  async createSession(entityId: string, name?: string): Promise<OpenCodeSession> {
    const manifest = await this.loadManifest(entityId);
    const now = new Date().toISOString();
    const session: OpenCodeSession = {
      id: uuidv4(),
      name: name || `Session ${manifest.sessions.length + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    manifest.sessions.push(session);
    if (manifest.sessions.length === 1) manifest.activeSessionId = session.id;
    await this.saveManifest(entityId, manifest);

    const sessionDir = join(this.getSessionsDir(entityId), session.id);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'history.json'), JSON.stringify([], null, 2));
    return session;
  }

  async setActiveSession(entityId: string, sessionId: string): Promise<void> {
    const manifest = await this.loadManifest(entityId);
    if (!manifest.sessions.find(s => s.id === sessionId)) {
      throw new Error(`Session ${sessionId} introuvable`);
    }
    manifest.activeSessionId = sessionId;
    await this.saveManifest(entityId, manifest);
  }

  async deleteSession(entityId: string, sessionId: string): Promise<void> {
    const manifest = await this.loadManifest(entityId);
    manifest.sessions = manifest.sessions.filter(s => s.id !== sessionId);
    if (manifest.activeSessionId === sessionId) {
      manifest.activeSessionId = manifest.sessions[0]?.id;
    }
    await this.saveManifest(entityId, manifest);
  }

  async getHistory(entityId: string, sessionId?: string): Promise<ChatMessage[]> {
    let targetSessionId: string | null = sessionId ?? null;
    if (!targetSessionId) {
      targetSessionId = await this.getActiveSession(entityId);
      if (!targetSessionId) {
        const session = await this.createSession(entityId, 'Session 1');
        targetSessionId = session.id;
      }
    }
    const historyPath = this.getSessionHistoryPath(entityId, targetSessionId);
    if (!existsSync(historyPath)) return [];
    const content = await readFile(historyPath, 'utf-8');
    return JSON.parse(content);
  }

  private async saveHistory(entityId: string, sessionId: string, history: ChatMessage[]): Promise<void> {
    const historyPath = this.getSessionHistoryPath(entityId, sessionId);
    const sessionDir = join(this.getSessionsDir(entityId), sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(historyPath, JSON.stringify(history, null, 2));

    // Mettre à jour le timestamp de la session dans le manifest
    const manifest = await this.loadManifest(entityId);
    const session = manifest.sessions.find(s => s.id === sessionId);
    if (session) {
      session.updatedAt = new Date().toISOString();
      await this.saveManifest(entityId, manifest);
    }
  }

  async clearHistory(entityId: string, sessionId?: string): Promise<void> {
    let targetSessionId: string | null = sessionId ?? null;
    if (!targetSessionId) {
      targetSessionId = await this.getActiveSession(entityId);
      if (!targetSessionId) return;
    }
    await this.saveHistory(entityId, targetSessionId, []);
  }

  // ===== Envoi de message via HTTP+SSE (serveur persistent) =====

  async sendMessage(
    entityId: string,
    message: string,
    onEvent: (event: OpenCodeEvent) => void,
    images?: ImageData[],
    config?: OpenCodeConfig,
    sessionId?: string
  ): Promise<void> {
    console.log('[BaseOpenCodeSessionManager] sendMessage HTTP+SSE, config:', config);

    const cwd = this.getCwd(entityId);
    const prefix = this.getLogPrefix();

    // 0. Créer .opencode/settings.json dans le cwd pour exclure le OPENCODE.md racine
    await mkdir(join(cwd, '.opencode'), { recursive: true });
    await writeFile(
      join(cwd, '.opencode', 'settings.json'),
      JSON.stringify({ excludes: [join(cwd, 'OPENCODE.md')] }, null, 2),
    );

    // 1. Backup AVANT
    const beforeBackup = await this.createBeforeBackup(entityId, message);

    // 2. Historique (10 derniers messages pour le contexte)
    let history = await this.getHistory(entityId, sessionId ?? undefined);
    if (history.length > 10) history = history.slice(-10);

    // 2b. Sauvegarder le message user immédiatement (avant que OpenCode réponde)
    const userMsgImmediate: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
      backupId: beforeBackup?.id,
    };
    const fullHistoryImmediate = await this.getHistory(entityId, sessionId ?? undefined);
    fullHistoryImmediate.push(userMsgImmediate);
    const targetSessionId = sessionId ?? (await this.createSession(entityId, 'Session')).id;
    await this.saveHistory(entityId, targetSessionId, fullHistoryImmediate);

    // Tracking usage
    opencodeUsageTracker.trackRequest(config?.model || 'opencode-go/minimax-m2.7');

    // 3. Message enrichi de l'historique
    const historyText = history.map(msg =>
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');
    const fullMessage = historyText ? `${historyText}\n\nUser: ${message}` : message;

    const model = config?.model || 'opencode-go/minimax-m2.7';
    const agent = config?.agent || this.getAgent();

    console.log(`[OpenCode] HTTP+SSE Model: ${model}, Agent: ${agent}, cwd: ${cwd}`);

    // 4. Obtenir un serveur du pool (ou le démarrer)
    const { url: serverUrl } = await serverPool.getServer(cwd);

    // 5. Créer une session sur le serveur
    const { sessionId: opencodeSessionId } = await createSessionOnServer(serverUrl, cwd, agent);

    // 6. Lancer le streaming SSE + envoi message en parallèle
    const fullResponse = '';
    const toolUses: any[] = [];
    let doneEmitted = false;
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
    };

    let onDoneCalled = false;
    const emitDone = async (tokens?: { input: number; output: number }) => {
      if (doneEmitted) return;
      doneEmitted = true;
      cleanup();

      if (tokens) {
        opencodeUsageTracker.trackTokens(tokens.input || 0, tokens.output || 0);
      }

      try {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: '', //填充见下
          timestamp: new Date(),
          actions: toolUses,
        };

        const fullHistory = await this.getHistory(entityId, targetSessionId);
        const lastMsg = fullHistory[fullHistory.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.content = ''; // will be updated below
        }
        await this.saveHistory(entityId, targetSessionId, fullHistory);
        await this.createAfterBackup(entityId, message);

        const proposals = this.getPendingProposals(entityId);
        for (const proposal of proposals) {
          onEvent({ type: 'table_proposal', data: proposal });
        }

        onDoneCalled = true;
        onEvent({ type: 'done', data: null });
      } catch (err: any) {
        onEvent({ type: 'error', data: err.message });
      }
    };

    // Annuler tout SSE actif pour cette entité
    const existingCtrl = activeSSEControllers.get(entityId);
    if (existingCtrl) {
      existingCtrl.abort();
    }
    const sseController = new AbortController();
    activeSSEControllers.set(entityId, sseController);

    // Démarrer le consumer SSE et l'envoi du message en parallèle
    const ssePromise = (async () => {
      let accumulatedText = '';

      try {
        for await (const event of streamSSE(serverUrl, sseController.signal)) {
          const { type, data } = event;

          if (type === 'message.part.delta') {
            const delta = data.delta as string;
            if (delta) {
              accumulatedText += delta;
              onEvent({ type: 'text', data: delta });
            }
          } else if (type === 'message.part.updated') {
            const part = data.part;
            if (!part) continue;

            if (part.type === 'tool' && part.name) {
              toolUses.push(part);
              onEvent({ type: 'tool_use', data: { name: part.name, input: part.input, id: part.id } });
            } else if (part.type === 'step-finish') {
              if (part.tokens) {
                opencodeUsageTracker.trackTokens(
                  part.tokens.input || 0,
                  part.tokens.output || 0
                );
              }
              try {
                const hist = await this.getHistory(entityId, targetSessionId);
                const last = hist[hist.length - 1];
                if (last?.role === 'assistant') {
                  last.content = accumulatedText;
                  await this.saveHistory(entityId, targetSessionId, hist);
                }
              } catch { /* ignore */ }
              await emitDone(part.tokens);
            }
          } else if (type === 'session.idle') {
            if (!doneEmitted) {
              await emitDone();
              return;
            }
          } else if (type === 'session.status') {
            if (data.status?.type === 'idle' && !doneEmitted) {
              await emitDone();
              return;
            }
          } else if (type === 'server.heartbeat' || type === 'server.connected') {
            // Ignore heartbeats
          }
        }
      } catch (err: any) {
        console.error(`${prefix} SSE error:`, err.message);
        if (!doneEmitted) {
          onEvent({ type: 'error', data: err.message });
          cleanup();
        }
      } finally {
        activeSSEControllers.delete(entityId);
      }
    })();

    // Envoyer le message (SSE est déjà connecté en parallèle)
    try {
      await sendMessageToSession(serverUrl, opencodeSessionId, fullMessage, images);
    } catch (err: any) {
      console.error(`${prefix} send message error:`, err.message);
      activeSSEControllers.delete(entityId);
      sseController.abort();
      onEvent({ type: 'error', data: err.message });
      cleanup();
      throw err;
    }

    // Attendre que le streaming SSE se termine
    await ssePromise;
    activeSSEControllers.delete(entityId);

    // Fallback: si emitDone n'a jamais été appelé (SSE terminée sans session.idle)
    if (!doneEmitted) {
      doneEmitted = true;
      cleanup();
      if (onDoneCalled === false) {
        onEvent({ type: 'done', data: null });
      }
    }
  }
}
