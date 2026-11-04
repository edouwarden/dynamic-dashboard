/**
 * GlobalScriptManager — éditeur Monaco
 * selectScript, loadMonacoEditor avec TypeScript defs et AI completions
 * Méthodes : selectScript, loadMonacoEditor
 * Méthodes ajoutées au prototype GlobalScriptManager
 */
import { GlobalScriptManager } from './core.js?v=331';

Object.assign(GlobalScriptManager.prototype, {
  async selectScript(scriptId) {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) return;

    this.currentScript = script;

    // Afficher la vue éditeur, masquer la grille
    const contentArea = document.querySelector('.content-area');
    const editorView = document.getElementById('scriptEditorView');
    if (contentArea) contentArea.style.display = 'none';
    if (editorView) editorView.style.display = 'flex';

    // Masquer le header de tabs
    document.getElementById('headerActions')?.style && (document.getElementById('headerActions').style.display = 'none');
    document.getElementById('editToolbar')?.style && (document.getElementById('editToolbar').style.display = 'none');
    document.getElementById('currentTabName').textContent = `${script.emoji || '⚡'} ${script.name}`;

    // Désélectionner les tabs
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));

    // Mettre à jour le catalogue
    this.renderCatalog();

    // Remplir le header de l'éditeur
    document.getElementById('globalScriptEditorEmoji').textContent = script.emoji || '⚡';
    document.getElementById('globalScriptEditorName').textContent = script.name;
    const idBadge = document.getElementById('globalScriptEditorId');
    if (idBadge) {
      const textSpan = idBadge.querySelector('.script-id-badge-text');
      if (textSpan) textSpan.textContent = script.id;
      // Remplacer le listener à chaque sélection de script
      const newBadge = idBadge.cloneNode(true);
      idBadge.replaceWith(newBadge);
      newBadge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.copyToClipboard(script.id);
      });
    }

    // Charger le code
    const { code } = await this.dashboard.api(`/scripts/${scriptId}/code`);
    this.loadMonacoEditor(code || '');

    // Charger la config
    const config = await this.dashboard.api(`/scripts/${scriptId}/config`);
    document.getElementById('globalScriptEnabledToggle').checked = config.enabled || false;
    this.renderTriggers(config.triggers || []);

    // Activer premier subtab
    this.activateSubtab('opencode');

    // Charger les sous-onglets
    await this.openCodePanel.init(scriptId); // sessions + historique via OpenCodePanel
    await this.loadLogs();
    await this.loadPermissions();
    await this.loadTimeline();
    await this.loadBackups();

    // Listeners
    this.bindScriptEditorEvents();
  },

  loadMonacoEditor(code) {
    const container = document.getElementById('globalScriptMonacoContainer');
    if (!container) return;

    if (this.monacoEditor) {
      this.monacoEditor.setValue(code);
      return;
    }

    if (typeof require !== 'undefined') {
      require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
      require(['vs/editor/editor.main'], () => {
        // Injecter les types des fonctions disponibles dans le contexte du script
        if (!this._monacoLibsAdded) {
          this._monacoLibsAdded = true;
          const scriptTypeDefs = `
/** Requête sur la base de données SQLite du dashboard. */
interface QueryRequest {
  /** Nom de la table */
  table: string;
  /** Action à effectuer */
  action: 'select' | 'insert' | 'update' | 'delete';
  /** Données pour insert/update (clé: valeur) */
  data?: Record<string, any>;
  /** Conditions WHERE (clé: valeur) */
  where?: Record<string, any>;
  /** Colonnes à sélectionner (défaut: toutes) */
  columns?: string[];
  /** Limite de résultats (défaut: 100) */
  limit?: number;
  /** Clause ORDER BY */
  orderBy?: string;
}

/**
 * Exécuter une requête sur la base de données.
 * @example queryDB({ table: 'metrics', action: 'select', limit: 10 })
 * @example queryDB({ table: 'metrics', action: 'insert', data: { name: 'temp', value: 22.5 } })
 * @example queryDB({ table: 'metrics', action: 'update', where: { id: 1 }, data: { value: 25 } })
 * @example queryDB({ table: 'metrics', action: 'delete', where: { id: 1 } })
 */
declare function queryDB(query: QueryRequest): any;

/**
 * Logger un message dans les logs du script.
 * @param message - Le message à logger
 * @param level - Niveau: 'info' (défaut), 'warn', 'error'
 * @example log('Traitement terminé')
 * @example log('Attention', 'warn')
 */
declare function log(message: any, level?: 'info' | 'warn' | 'error'): void;

/**
 * Envoyer un webhook HTTP POST.
 * @param url - URL de destination
 * @param data - Données JSON à envoyer
 * @example await sendWebhook('https://hooks.slack.com/xxx', { text: 'Alerte!' })
 */
declare function sendWebhook(url: string, data: any): Promise<Response>;

/**
 * Envoyer une notification visible dans le dashboard.
 * @example sendNotification({ message: 'Script terminé', type: 'success' })
 * @example sendNotification({ title: 'Alerte', message: 'Erreur détectée', type: 'error', duration: 10000 })
 */
declare function sendNotification(options: {
  /** Titre de la notification */
  title?: string;
  /** Message de la notification */
  message: string;
  /** Type: 'info' | 'success' | 'warning' | 'error' */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Durée d'affichage en ms (défaut: 5000) */
  duration?: number;
}): void;

/** Informations sur le script en cours d'exécution */
declare const script: { id: string; name: string };

/** Type de déclenchement actuel */
declare const trigger: 'cron' | 'manual' | 'webhook';

/** Données reçues si le script est déclenché par webhook, sinon null */
declare const webhookPayload: any;

/** HTTP fetch natif (standard web) */
declare function fetch(url: string, options?: RequestInit): Promise<Response>;

/**
 * Sauvegarde un fichier sur le disque dans le dossier cache du script.
 * @returns L'URL publique pour accéder au fichier (ex: /api/scripts/{id}/files/image.jpg)
 * @example
 * const res = await fetch('https://api.example.com/photo.jpg');
 * const buffer = await res.arrayBuffer();
 * const url = await saveFile('photo.jpg', buffer);
 * queryDB({ table: 'images', action: 'update', where: { id: 1 }, data: { url } });
 */
declare function saveFile(filename: string, data: ArrayBuffer | Buffer | string): Promise<string>;
`;
          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
          });
          monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            allowNonTsExtensions: true,
            allowJs: true,
            checkJs: true,
          });
          monaco.languages.typescript.javascriptDefaults.addExtraLib(scriptTypeDefs, 'dashboard-script-context.d.ts');
        }

        // Provider AI inline (ghost text) — enregistré une seule fois globalement
        if (!window._monacoAIProviderRegistered) {
          window._monacoAIProviderRegistered = true;
          window._monacoAITrigger = false;

          monaco.languages.registerInlineCompletionsProvider('javascript', {
            provideInlineCompletions: async (model, position, context, token) => {
              if (!window._monacoAITrigger) return { items: [] };
              window._monacoAITrigger = false;

              const currentLine = model.getLineContent(position.lineNumber).trim();
              if (currentLine.length < 3) return { items: [] };

              const textBefore = model.getValueInRange({
                startLineNumber: 1, startColumn: 1,
                endLineNumber: position.lineNumber, endColumn: position.column,
              });
              const textAfter = model.getValueInRange({
                startLineNumber: position.lineNumber, startColumn: position.column,
                endLineNumber: model.getLineCount(), endColumn: model.getLineMaxColumn(model.getLineCount()),
              });

              try {
                const res = await fetch('/api/scripts/autocomplete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ codeBefore: textBefore.slice(-1500), codeAfter: textAfter.slice(0, 500) }),
                  signal: AbortSignal.timeout(9000),
                });
                if (token.isCancellationRequested) return { items: [] };
                const data = await res.json();
                if (!data.completion || !data.completion.trim()) return { items: [] };
                return {
                  items: [{
                    insertText: data.completion,
                    range: {
                      startLineNumber: position.lineNumber, startColumn: position.column,
                      endLineNumber: position.lineNumber, endColumn: position.column,
                    },
                  }],
                };
              } catch {
                return { items: [] };
              }
            },
            freeInlineCompletions() {},
          });
        }

        this.monacoEditor = monaco.editor.create(container, {
          value: code,
          language: 'javascript',
          theme: 'vs-dark',
          fontSize: 13,
          minimap: { enabled: false },
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          inlineSuggest: { enabled: true, mode: 'prefix' },
        });

        // Ctrl+Shift+Space → déclenche l'autocomplétion AI (ghost text visible, Tab pour accepter)
        this.monacoEditor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Space,
          () => {
            window._monacoAITrigger = true;
            this.monacoEditor.trigger('ai', 'editor.action.inlineSuggest.trigger', {});
          }
        );
      });
    }
  },
});
