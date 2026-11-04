/**
 * WidgetManager - Gestionnaire de widgets
 *
 * Responsabilités :
 * - CRUD des widgets
  * - Génération du contexte OpenCode (OPENCODE.md)
 * - Gestion des permissions DB
 */

import { readdir, mkdir, writeFile, readFile, rm, stat, cp } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config';
import type { Widget, WidgetConfig, DbPermission } from '../types';
import { databaseManager } from '../database/manager';

export class WidgetManager {
  private widgetsDir: string;

  constructor() {
    this.widgetsDir = CONFIG.WIDGETS_DIR;
  }

  /**
   * Initialiser le dossier widgets
   */
  async initialize(): Promise<void> {
    try {
      await stat(this.widgetsDir);
    } catch (error) {
      await mkdir(this.widgetsDir, { recursive: true });
      console.log(`✅ Dossier widgets créé: ${this.widgetsDir}`);
    }
  }

  /**
   * Régénérer le fragtree d'un widget (appelé après modification du code)
   */
  async refreshWidgetFragtree(widgetId: string): Promise<void> {
    await this.generateWidgetFragtree(widgetId);
  }

  /**
   * Mettre à jour les fragtrees de tous les widgets existants
   */
  async updateAllFragtrees(): Promise<void> {
    const dirs = await readdir(this.widgetsDir);

    for (const dir of dirs) {
      try {
        const widgetDir = join(this.widgetsDir, dir);
        const stats = await stat(widgetDir);

        if (!stats.isDirectory()) continue;

        const opencodePath = join(widgetDir, 'OPENCODE.md');
        const fragtreePath = join(widgetDir, 'fragtree.md');

        // Mettre à jour OPENCODE.md si @fragtree.md n'est pas présent
        try {
          const opencodeContent = await readFile(opencodePath, 'utf-8');
          if (!opencodeContent.includes('@fragtree.md')) {
            const updated = opencodeContent.replace(
              /\n*$/, // Remplacer la fin du fichier
              '\n\n---\n\n@fragtree.md\n'
            );
            await writeFile(opencodePath, updated);
            console.log(`✅ @fragtree.md ajouté à ${dir}/OPENCODE.md`);
          }
        } catch (err) {
          // OPENCODE.md n'existe pas, ignorer
        }

        // Générer fragtree.md s'il n'existe pas
        try {
          await stat(fragtreePath);
        } catch {
          // fragtree.md n'existe pas, le générer
          await this.generateWidgetFragtree(dir);
          console.log(`✅ fragtree.md généré pour ${dir}`);
        }
      } catch (err) {
        // Ignorer les erreurs pour les widgets individuels
      }
    }
  }

  /**
   * Vérifier si un fichier existe
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Créer un nouveau widget
   */
  async createWidget(data: Partial<Widget>): Promise<Widget> {
    await this.initialize();

    const now = new Date().toISOString();
    const widget: Widget = {
      id: `widget-${uuidv4()}`,
      name: data.name || 'Nouveau widget',
      emoji: data.emoji || '📦',
      description: data.description || '',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      dbPermissions: data.dbPermissions || [],
      configSchema: data.configSchema || {}
    };

    const widgetDir = join(this.widgetsDir, widget.id);
    await mkdir(widgetDir, { recursive: true });

    // Créer manifest.json
    const manifest: WidgetConfig = {
      widget,
      version: 1
    };
    await writeFile(
      join(widgetDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Créer le template HTML de base
    await this.createDefaultTemplate(widgetDir, widget);

    // Créer le contexte OpenCode
    await this.updateWidgetOpenCodeContext(widget.id);

    // Créer le dossier .backups
    await mkdir(join(widgetDir, '.backups'), { recursive: true });
    await writeFile(
      join(widgetDir, '.backups', 'manifest.json'),
      JSON.stringify({ backups: [] }, null, 2)
    );

    console.log(`✅ Widget créé: ${widget.id} (${widget.name})`);
    return widget;
  }

  /**
   * Récupérer un widget
   */
  async getWidget(id: string): Promise<Widget | null> {
    try {
      const widgetDir = join(this.widgetsDir, id);
      const manifestPath = join(widgetDir, 'manifest.json');

      const content = await readFile(manifestPath, 'utf-8');
      const manifest: WidgetConfig = JSON.parse(content);

      return manifest.widget;
    } catch (error) {
      return null;
    }
  }

  /**
   * Lister tous les widgets
   */
  async listWidgets(): Promise<Widget[]> {
    try {
      await this.initialize();
      const dirs = await readdir(this.widgetsDir);

      // Lire tous les widgets en parallèle
      const results = await Promise.all(
        dirs.map(async (dir) => {
          try {
            const widgetDir = join(this.widgetsDir, dir);
            const stats = await stat(widgetDir);
            if (!stats.isDirectory()) return null;
            return await this.getWidget(dir);
          } catch {
            return null;
          }
        })
      );

      // Trier par date de création (plus récents en premier)
      return results
        .filter((w): w is Widget => w !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Erreur lors du listage des widgets:', error);
      return [];
    }
  }

  /**
   * Mettre à jour un widget
   */
  async updateWidget(id: string, data: Partial<Widget>): Promise<void> {
    const widget = await this.getWidget(id);
    if (!widget) {
      throw new Error(`Widget ${id} introuvable`);
    }

    const updatedWidget: Widget = {
      ...widget,
      ...data,
      id: widget.id, // On ne change jamais l'ID
      updatedAt: new Date().toISOString()
    };

    const widgetDir = join(this.widgetsDir, id);
    const manifestPath = join(widgetDir, 'manifest.json');

    // Lire la version actuelle
    const content = await readFile(manifestPath, 'utf-8');
    const manifest: WidgetConfig = JSON.parse(content);

    // Mettre à jour
    const newManifest: WidgetConfig = {
      widget: updatedWidget,
      version: manifest.version + 1
    };

    await writeFile(manifestPath, JSON.stringify(newManifest, null, 2));

    // Mettre à jour le contexte OpenCode si les permissions ont changé
    if (data.dbPermissions) {
      await this.updateWidgetOpenCodeContext(id);
    }

    console.log(`✅ Widget mis à jour: ${id}`);
  }

  /**
   * Supprimer un widget
   */
  async deleteWidget(id: string): Promise<void> {
    const widgetDir = join(this.widgetsDir, id);

    try {
      await rm(widgetDir, { recursive: true, force: true });
      console.log(`✅ Widget supprimé: ${id}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression du widget ${id}:`, error);
      throw error;
    }
  }

  /**
   * Cloner un widget existant (copie les fichiers + nouveau manifest)
   */
  async cloneWidget(id: string): Promise<Widget> {
    const source = await this.getWidget(id);
    if (!source) throw new Error(`Widget ${id} introuvable`);

    const now = new Date().toISOString();
    const newId = `widget-${uuidv4()}`;
    const newWidget: Widget = {
      ...source,
      id: newId,
      name: `${source.name} (copie)`,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
    };

    const srcDir = join(this.widgetsDir, id);
    const destDir = join(this.widgetsDir, newId);

    const backupsDir = join(srcDir, '.backups');
    // Copier tout le dossier source sauf .backups
    await cp(srcDir, destDir, {
      recursive: true,
      filter: (src) => !src.startsWith(backupsDir),
    });

    // Créer un dossier .backups vierge
    await mkdir(join(destDir, '.backups'), { recursive: true });
    await writeFile(
      join(destDir, '.backups', 'manifest.json'),
      JSON.stringify({ backups: [] }, null, 2)
    );

    // Écrire le nouveau manifest
    const newManifest: WidgetConfig = { widget: newWidget, version: 1 };
    await writeFile(join(destDir, 'manifest.json'), JSON.stringify(newManifest, null, 2));

    // Mettre à jour le contexte OpenCode
    await this.updateWidgetOpenCodeContext(newId);

    console.log(`✅ Widget cloné: ${id} → ${newId}`);
    return newWidget;
  }

  /**
   * Mettre à jour les permissions DB d'un widget
   */
  async updateWidgetPermissions(id: string, permissions: DbPermission[]): Promise<void> {
    await this.updateWidget(id, { dbPermissions: permissions });
  }

  /**
   * Générer le contexte OpenCode (OPENCODE.md) pour un widget
   */
  async updateWidgetOpenCodeContext(widgetId: string): Promise<void> {
    const widget = await this.getWidget(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} introuvable`);
    }

    const widgetDir = join(this.widgetsDir, widgetId);

  const hasGlobal = widget.canSendGlobalNotifications ?? false;
  const hasTab = widget.canSendTabNotifications ?? false;

  // Générer le contenu du OPENCODE.md (version optimisée)
let opencodeContent = `# 🤖 Assistant Widget "${widget.name}" ${widget.emoji}

> **CONTEXTE ISOLÉ** : Ce fichier OPENCODE.md remplace et annule toutes les instructions des OPENCODE.md parents (projet, racine). Tu travailles UNIQUEMENT dans ce dossier widget. Ignore toute instruction de mettre à jour docs/, FILEMAP.md, ou tout autre fichier hors de ce dossier.

## Environnement
- **Dossier** : \`data/widgets/${widget.id}/\`
- **Fichiers autorisés** : \`index.html\`, \`style.css\`, \`app.js\`, dossier \`assets/\`
- **Base de données** : uniquement via la fonction \`queryDB()\` (déjà injectée)

## 🗄️ Permissions Base de Données

${widget.dbPermissions && widget.dbPermissions.length > 0 
  ? widget.dbPermissions.map(perm => `
### Table \`${perm.table}\`
- **Actions** : ${perm.actions.join(', ')}
- **Colonnes** : ${perm.columns?.length ? perm.columns.join(', ') : 'toutes'}
${perm.maxRows ? `- **Limite** : ${perm.maxRows} lignes` : ''}
**Schéma** :
\`\`\`sql
${databaseManager.getTableSchema(perm.table).map(col => {
  const cons = [];
  if (col.pk) cons.push('PK');
  if (col.notnull) cons.push('NOT NULL');
  return `${col.name} ${col.type}${cons.length ? ` (${cons.join(' ')})` : ''}`;
}).join('\n')}
\`\`\`
`).join('\n')
  : '❌ Aucune permission DB configurée.'}

### Helper queryDB (déjà disponible)
\`\`\`js
const data = await queryDB({
  table: 'ma_table',
  action: 'select',
  where: { id: 5 },
  limit: 50
});
\`\`\`

## 🎨 Variables CSS (thème de la tab)
Utilise **uniquement** ces variables dans \`style.css\` :
- \`--color-primary\`, \`--color-secondary\`, \`--color-bg\`, \`--color-text\`
- \`--font-family\`, \`--border-radius\`, \`--border-width\`, \`--border-style\`

## 🔔 Notifications (si autorisé)
${hasGlobal || hasTab ? `Fonction \`sendNotification()\` disponible :
\`\`\`js
await sendNotification({
  title: "Titre optionnel",
  message: "Message",
  type: "info|success|warning|error",
  scope: "${hasGlobal && hasTab ? 'global|tab' : hasGlobal ? 'global' : 'tab'}",
  duration: 5000
});
\`\`\`` : ''}

## ⚙️ Configuration & Variables d’onglet
- \`resolveConfig(config)\` → résout automatiquement les \`\$var:xxx\`
- \`onConfigChange((newCfg, key, value) => {})\`
- Variables partagées : \`getVar()\`, \`setVar()\`, \`watchVar()\`

**Exemple complet** :
\`\`\`js
async function init() {
  const cfg = await resolveConfig(config);
  const asset = await getVar('asset');

  const unwatch = watchVar('asset', (v) => updateWidget(v));
}
\`\`\`

## ⚠️ RÈGLES CRITIQUES (à respecter À LA LETTRE)
1. **Périmètre strict** : UNIQUEMENT les fichiers de CE dossier widget. INTERDIT : chemins \`../../\`, chemins absolus hors widget, modifier docs/ ou tout fichier projet
2. **DB** : exclusivement \`queryDB()\` (jamais de fetch direct)
3. **Code** : ne jamais répéter du code déjà présent dans index.html
4. **Librairies externes** (TradingView, Chart.js…) → wrapper obligatoire + try/catch + fallback
5. **Fichiers** : utilise Write/Edit directement pour modifier index.html, style.css, app.js

**Widget ID** : ${widget.id} | Créé ${new Date(widget.createdAt).toLocaleDateString('fr-FR')}

---

@fragtree.md
`;

    // Écrire OPENCODE.md
    await writeFile(join(widgetDir, 'OPENCODE.md'), opencodeContent);

    // Générer le fragtree
    await this.generateWidgetFragtree(widgetId);

    console.log(`✅ Contexte OpenCode mis à jour pour ${widget.id}`);
  }

  /**
   * Générer le fragtree du widget (carte des fichiers)
   */
  private async generateWidgetFragtree(widgetId: string): Promise<void> {
    const widget = await this.getWidget(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} introuvable`);
    }

    const widgetDir = join(this.widgetsDir, widgetId);

    const EXCLUDED_FILES = new Set(['OPENCODE.md', 'CLAUDE.md', 'fragtree.md']);
    const EXCLUDED_DIRS = new Set(['.backups', '.sessions', '.opencode']);

    interface TreeNode {
      node_id: number;
      name: string;
      isDir: boolean;
      lines?: number;
      functions?: Array<{ node_id: number; name: string; line: number }>;
      children?: TreeNode[];
    }

    let nodeCounter = 2;

    const scanDir = async (dirPath: string): Promise<TreeNode[]> => {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const nodes: TreeNode[] = [];

      const sorted = entries.sort((a, b) => {
        // Dossiers d'abord, puis fichiers
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of sorted) {
        if (entry.isDirectory()) {
          if (EXCLUDED_DIRS.has(entry.name)) continue;
          const id = nodeCounter++;
          const children = await scanDir(join(dirPath, entry.name));
          nodes.push({ node_id: id, name: entry.name, isDir: true, children });
        } else {
          if (EXCLUDED_FILES.has(entry.name)) continue;
          const filePath = join(dirPath, entry.name);
          let lines = 0;
          let functions: TreeNode['functions'];
          try {
            const content = await readFile(filePath, 'utf-8');
            lines = content.split('\n').length - 1;

            if (entry.name.endsWith('.js')) {
              const functionRegex = /^(async\s+)?function\s+(\w+)|^const\s+(\w+)\s*=\s*(async\s*)?(function|\()/gm;
              const fns: NonNullable<TreeNode['functions']> = [];
              let fnCounter = 1;
              let match;
              while ((match = functionRegex.exec(content)) !== null) {
                const lineNum = content.substring(0, match.index).split('\n').length;
                const fnName = match[2] || match[3] || 'unknown';
                if (fnName !== 'unknown') {
                  fns.push({ node_id: fnCounter++, name: fnName, line: lineNum });
                }
              }
              if (fns.length > 0) functions = fns;
            }
          } catch {
            // ignorer
          }
          const id = nodeCounter++;
          nodes.push({ node_id: id, name: entry.name, isDir: false, lines, functions });
        }
      }
      return nodes;
    };

    const rootNodes = await scanDir(widgetDir);

    const renderNodes = (nodes: TreeNode[], indent: string): string => {
      let out = '';
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isLast = i === nodes.length - 1;
        const branch = isLast ? '└──' : '├──';
        const childIndent = indent + (isLast ? '    ' : '│   ');

        if (node.isDir) {
          out += `${indent}${branch} ${node.name}/(${node.node_id})\n`;
          if (node.children && node.children.length > 0) {
            out += renderNodes(node.children, childIndent);
          }
        } else {
          out += `${indent}${branch} ${node.name}(${node.node_id}) — ${node.lines}l\n`;
          if (node.functions && node.functions.length > 0) {
            for (let j = 0; j < node.functions.length; j++) {
              const fn = node.functions[j];
              const isLastFn = j === node.functions.length - 1;
              const fnPrefix = isLastFn ? '└──' : '├──';
              out += `${childIndent}${fnPrefix} ${fn.name}(${node.node_id}.${fn.node_id}) :${fn.line}\n`;
            }
          }
        }
      }
      return out;
    };

    // Générer l'arborescence ASCII
    let fragtreeContent = `# TREEFRAG — ${widget.name} ${widget.emoji}

\`\`\`
${widgetId}(1)
${renderNodes(rootNodes, '')}`;

    fragtreeContent += `\`\`\`
`;

    await writeFile(join(widgetDir, 'fragtree.md'), fragtreeContent);
  }

  /**
   * Créer le template par défaut d'un widget
   */
  private async createDefaultTemplate(widgetDir: string, widget: Widget): Promise<void> {
    // index.html
    const htmlTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${widget.name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="widget-root">
    <div class="glow"></div>
    <div class="starter">
      <div class="starter-icon">${widget.emoji}</div>
      <h2>${widget.name}</h2>
      <p>Starter widget — ready for your data.</p>
      <div class="starter-files">
        <span>index.html</span><span>style.css</span><span>app.js</span>
      </div>
      <p class="starter-hint">Edit the files or ask OpenCode to build it.</p>
    </div>
  </div>

  <script>
    // Récupérer la config depuis l'URL
    const params = new URLSearchParams(window.location.search);
    const instanceId = params.get('instanceId');
    const tabId = params.get('tabId');
    const config = JSON.parse(params.get('config') || '{}');

    // Résoudre la config : remplace les références $var:xxx par les valeurs réelles
    // Retourne un objet avec les valeurs résolues + met en place des watchers automatiques
    let _resolvedConfig = {};
    const _configChangeCallbacks = [];

    async function resolveConfig(rawConfig) {
      rawConfig = rawConfig || config;
      const resolved = {};
      const varRefs = {}; // key -> varName

      for (const [key, val] of Object.entries(rawConfig)) {
        if (typeof val === 'string' && val.startsWith('$var:')) {
          const varName = val.replace('$var:', '');
          varRefs[key] = varName;
          resolved[key] = await getVar(varName);
        } else {
          resolved[key] = val;
        }
      }

      // Mettre en place les watchers pour les variables référencées
      for (const [key, varName] of Object.entries(varRefs)) {
        watchVar(varName, (newValue) => {
          _resolvedConfig[key] = newValue;
          _configChangeCallbacks.forEach(cb => cb({ ..._resolvedConfig }, key, newValue));
        });
      }

      _resolvedConfig = resolved;
      return resolved;
    }

    // Écouter les changements de config résolue
    function onConfigChange(callback) {
      _configChangeCallbacks.push(callback);
      return () => {
        const idx = _configChangeCallbacks.indexOf(callback);
        if (idx !== -1) _configChangeCallbacks.splice(idx, 1);
      };
    }

    // Helper queryDB injecté automatiquement
    async function queryDB(query) {
      const res = await fetch(\`/api/tabs/\${tabId}/widgets/\${instanceId}/query\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    }

    // Helper sendNotification injecté automatiquement
    async function sendNotification(options) {
      const { title, message, type = 'widget', duration = 5000, scope = 'global' } = options;
      const res = await fetch(\`/api/tabs/\${tabId}/widgets/\${instanceId}/notify\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type, duration })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      // Envoyer un message au parent pour afficher la notification
      if (window.parent) {
        window.parent.postMessage({
          type: 'widget-notification',
          notification: {
            title: title || result.notification.widgetName,
            message,
            type,
            duration,
            icon: result.notification.widgetEmoji,
            scope  // 'global' ou 'tab'
          }
        }, '*');
      }

      return result;
    }

    // === TAB VARIABLES (partagées entre widgets) ===

    // Cache des variables en mémoire
    let _tabVariables = {};

    // Charger toutes les variables de l'onglet
    async function loadTabVariables() {
      try {
        const res = await fetch(\`/api/tabs/\${tabId}/variables\`);
        _tabVariables = await res.json();
        return _tabVariables;
      } catch (err) {
        console.error('Erreur lors du chargement des variables:', err);
        return {};
      }
    }

    // Récupérer une variable
    async function getVar(key) {
      try {
        const res = await fetch(\`/api/tabs/\${tabId}/variables/\${key}\`);
        const data = await res.json();
        return data.value;
      } catch (err) {
        console.error('Erreur lors de la récupération de la variable "' + key + '":', err);
        return null;
      }
    }

    // Définir une variable (notifie automatiquement les autres widgets)
    async function setVar(key, value) {
      try {
        await fetch(\`/api/tabs/\${tabId}/variables/\${key}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value })
        });
        _tabVariables[key] = value;
        return true;
      } catch (err) {
        console.error('Erreur lors de la définition de la variable "' + key + '":', err);
        return false;
      }
    }

    // Écouter les changements de variables (callback appelé quand une variable change)
    const _varWatchers = {};
    function watchVar(key, callback) {
      if (!_varWatchers[key]) _varWatchers[key] = [];
      _varWatchers[key].push(callback);

      // Retourner une fonction pour arrêter d'écouter
      return () => {
        _varWatchers[key] = _varWatchers[key].filter(cb => cb !== callback);
      };
    }

    // Recevoir les notifications de changement depuis le dashboard
    window.addEventListener('message', (event) => {
      if (event.data.type === 'tab-variable-changed') {
        const { key, value } = event.data;
        _tabVariables[key] = value;

        // Notifier les watchers
        if (_varWatchers[key]) {
          _varWatchers[key].forEach(callback => callback(value, key));
        }
      }
    });

    // Charger les variables au démarrage
    loadTabVariables();

    console.log('Widget ${widget.name} chargé');
    console.log('Config:', config);
  </script>
  <script src="app.js"></script>
</body>
</html>`;

    await writeFile(join(widgetDir, 'index.html'), htmlTemplate);

    // style.css
    const cssTemplate = `/* Starter styles for ${widget.name} */

:root {
  --starter-accent: var(--color-primary, #3b82f6);
}

* { box-sizing: border-box; }

html, body {
  height: 100%;
  margin: 0;
}

body {
  font-family: var(--font-family, Inter, ui-sans-serif, system-ui, sans-serif);
  color: var(--color-text, #e5e7eb);
  background:
    radial-gradient(300px 220px at 18% 0%,
      color-mix(in srgb, var(--starter-accent) 22%, transparent),
      transparent 70%),
    var(--color-bg, #0b1120);
  overflow: hidden;
}

#widget-root {
  position: relative;
  height: 100%;
  display: grid;
  place-items: center;
  padding: 18px;
}

.glow {
  position: absolute;
  inset: auto -20% -60% 40%;
  height: 60%;
  background: radial-gradient(closest-side,
    color-mix(in srgb, var(--starter-accent) 18%, transparent),
    transparent);
  pointer-events: none;
}

.starter {
  position: relative;
  width: min(100%, 340px);
  padding: 22px 20px 18px;
  border-radius: 16px;
  text-align: center;
  background: color-mix(in srgb, var(--starter-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--starter-accent) 26%, transparent);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
}

.starter-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: 13px;
  font-size: 22px;
  background: color-mix(in srgb, var(--starter-accent) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--starter-accent) 34%, transparent);
}

.starter h2 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.starter p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: color-mix(in srgb, var(--color-text, #e5e7eb) 62%, transparent);
}

.starter-files {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
  margin: 14px 0 10px;
}

.starter-files span {
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: color-mix(in srgb, var(--starter-accent) 85%, white);
  background: color-mix(in srgb, var(--starter-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--starter-accent) 24%, transparent);
}

.starter .starter-hint {
  font-size: 10px;
  opacity: 0.75;
}`;

    await writeFile(join(widgetDir, 'style.css'), cssTemplate);

    // app.js
    const jsTemplate = `// Logique pour ${widget.name}

// Le widget est initialisé
console.log('${widget.name} prêt');

// Exemple d'utilisation de la config
if (config.title) {
  document.querySelector('#widget-root h2').textContent = config.title;
}

// Exemple d'utilisation de queryDB (si permissions DB configurées)
/*
async function loadData() {
  try {
    const data = await queryDB({
      table: 'your_table',
      action: 'select',
      limit: 10
    });
    console.log('Données chargées:', data);
  } catch (error) {
    console.error('Erreur:', error);
  }
}

loadData();
*/`;

    await writeFile(join(widgetDir, 'app.js'), jsTemplate);

    // Créer dossier assets
    await mkdir(join(widgetDir, 'assets'), { recursive: true });
  }
}

// Export singleton
export const widgetManager = new WidgetManager();
