/**
 * Génération du prompt système pour Claude dans le contexte d'un widget.
 * Extrait de widget-sessions.ts pour faciliter la lecture et les modifications.
 */

import { databaseManager } from '../database/manager';
import type { Widget } from '../types';

/**
 * Construit le prompt système envoyé à Claude lors du chat widget.
 * Inclut : tables assignées + schémas, commandes curl, queryDB, CSS vars, config, règles.
 */
export async function buildWidgetSystemPrompt(widget: Widget): Promise<string> {
  const widgetId = widget.id;
  const widgetSlug = widget.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // === Tables assignées au widget ===
  let dbSection = '';
  if (widget.dbPermissions && widget.dbPermissions.length > 0) {
    dbSection = `## DB — Tables assignées (${widget.dbPermissions.length})\n\n`;
    for (const perm of widget.dbPermissions) {
      dbSection += `**\`${perm.table}\`** — ${perm.actions.join(', ')}\n`;
      try {
        const schema = await databaseManager.getTableSchema(perm.table);
        dbSection += '```sql\n';
        for (const col of schema) {
          let colDef = `  ${col.name} ${col.type}`;
          if (col.pk) colDef += ' PRIMARY KEY';
          if (col.notnull) colDef += ' NOT NULL';
          if (col.dflt_value !== null) colDef += ` DEFAULT ${col.dflt_value}`;
          dbSection += `${colDef}\n`;
        }
        dbSection += '```\n';
      } catch (err: any) {
        dbSection += `⚠️ Table introuvable: ${err.message}\n`;
      }
    }
    dbSection += `\n\`queryDB()\` est injectée dans \`index.html\` — utilise-la directement dans \`app.js\`.\n\n`;
  } else {
    dbSection = `## DB\n\nAucune table assignée. Si nécessaire, tu peux en créer une (voir section Tables ci-dessous).\n\n`;
  }


  return `# Widget "${widget.name}" ${widget.emoji || ''}

**ID** : \`${widgetId}\` | **Dossier** : \`data/widgets/${widgetId}/\` | **Fichiers** : \`index.html\`, \`style.css\`, \`app.js\`
${widget.description ? `**Description** : ${widget.description}\n` : ''}
${dbSection}## Créer / modifier une table

\`\`\`bash
# Créer
curl -s -X POST http://localhost:3000/api/widgets/${widgetId}/tables \\
  -H "Content-Type: application/json" \\
  -d '{"name":"${widgetSlug}_data","schema":[{"name":"id","type":"INTEGER","primaryKey":true,"autoIncrement":true},{"name":"valeur","type":"TEXT","notNull":true}]}'

# Modifier (ajouter colonnes)
curl -s -X PATCH http://localhost:3000/api/widgets/${widgetId}/tables/NOM_TABLE \\
  -H "Content-Type: application/json" \\
  -d '{"addColumns":[{"name":"col","type":"TEXT"}]}'
\`\`\`

- Table auto-assignée au widget après création. Si le nom est déjà pris, l'API renvoie un nom alternatif dans la réponse — utilise ce nom dans le code
- Si \`"pendingApproval":true\` → carte de confirmation dans le chat, continue en supposant que la table sera créée
- Préfixe obligatoire : \`${widgetSlug}_\` — jamais de noms génériques (\`data\`, \`items\`, \`users\`)

## queryDB()

\`\`\`javascript
await queryDB({ table: 'ma_table', action: 'select', where: { id: 1 }, limit: 100 });
await queryDB({ table: 'ma_table', action: 'insert', data: { col: 'val' } });
await queryDB({ table: 'ma_table', action: 'update', where: { id: 1 }, data: { col: 'new' } });
await queryDB({ table: 'ma_table', action: 'delete', where: { id: 1 } });
\`\`\`

## CSS — Thème hérité de la tab

\`--color-primary\`, \`--color-secondary\`, \`--color-bg\`, \`--color-text\`, \`--font-family\`, \`--border-radius\`, \`--border-style\`, \`--border-width\`

## Config (paramètres par instance)

Déclarer dans \`manifest.json\` → \`widget.configSchema\` uniquement si demandé explicitement.
Types : \`string\`, \`number\`, \`boolean\`, \`select\` (avec \`options\`).
Lire dans \`app.js\` : \`const cfg = await resolveConfig()\` / \`onConfigChange((cfg, key, val) => {})\`

## Règles

1. **\`<!DOCTYPE html>\` obligatoire** en première ligne de \`index.html\` — sans ça, le navigateur passe en Quirks Mode (layout cassé, CSS imprévisible)
2. **Pas de header ni footer** — c'est un widget dans une grille, l'espace est précieux. Sauf si explicitement demandé
3. **Responsive à la taille de l'iframe** — le widget est affiché dans une iframe dont la taille varie selon la grille et le viewport. Conçois le layout pour s'adapter dynamiquement à n'importe quelle dimension (petit ou grand). Utilise flexbox/grid et units relatives (%, vh, flex) plutôt que des tailles fixes. Le widget doit remplir l'espace disponible sans déborder (100% width/height sur le conteneur principal, pas de scroll interne si possible)
4. **Périmètre strict** : fichiers de \`data/widgets/${widgetId}/\` uniquement — pas de \`../../\`, pas de chemins absolus
5. **Accès DB** : uniquement via \`queryDB()\` dans \`app.js\`
6. **Utilise les variables CSS** du thème
7. **Agis directement** — pas de confirmation inutile, pas de lecture de fichiers hors du dossier widget`;
}
