#!/usr/bin/env bun
/**
 * Serveur MCP (Model Context Protocol) pour le dashboard
 * Expose les fonctions disponibles (queryDB, notifications, tables, etc.)
 * au CLI Claude via le protocole stdio JSON-RPC 2.0
 *
 * Usage: bun run src/mcp/dashboard-tools.ts --script-id <id> [--port 3000]
 *        bun run src/mcp/dashboard-tools.ts --widget-id <id> [--port 3000]
 */

// === Parse arguments ===
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const scriptId = getArg('script-id');
const widgetId = getArg('widget-id');
const port = getArg('port') || '3000';
const BASE = `http://localhost:${port}`;
const entityId = scriptId || widgetId || '';
const isScript = !!scriptId;

// === MCP Protocol (Content-Length framing) ===

function sendMessage(msg: any): void {
  const json = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n`;
  process.stdout.write(header + json);
}

let inputBuffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk: string) => {
  inputBuffer += chunk;
  processBuffer();
});

function processBuffer(): void {
  while (true) {
    const headerEnd = inputBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = inputBuffer.substring(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { inputBuffer = inputBuffer.substring(headerEnd + 4); continue; }

    const len = parseInt(match[1]);
    const bodyStart = headerEnd + 4;
    if (inputBuffer.length < bodyStart + len) break;

    const body = inputBuffer.substring(bodyStart, bodyStart + len);
    inputBuffer = inputBuffer.substring(bodyStart + len);

    try {
      const msg = JSON.parse(body);
      handleMessage(msg);
    } catch { /* ignorer les erreurs de parsing */ }
  }
}

// === Handlers JSON-RPC ===

async function handleMessage(msg: any): Promise<void> {
  const { id, method, params } = msg;

  // Notifications (pas de réponse attendue)
  if (!id && method === 'notifications/initialized') return;
  if (!id && method?.startsWith('notifications/')) return;

  switch (method) {
    case 'initialize':
      sendMessage({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'dashboard-tools', version: '1.0.0' },
          capabilities: { tools: {} }
        }
      });
      break;

    case 'tools/list':
      sendMessage({ jsonrpc: '2.0', id, result: { tools: getToolsList() } });
      break;

    case 'tools/call': {
      try {
        const result = await callTool(params.name, params.arguments || {});
        sendMessage({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] }
        });
      } catch (err: any) {
        sendMessage({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `Erreur: ${err.message}` }], isError: true }
        });
      }
      break;
    }

    default:
      if (id) {
        sendMessage({ jsonrpc: '2.0', id, error: { code: -32601, message: `Méthode inconnue: ${method}` } });
      }
  }
}

// === Définitions des outils ===

function getToolsList(): any[] {
  const tools: any[] = [
    {
      name: 'query_database',
      description: 'Exécuter une requête sur la base de données SQLite. Actions: select, insert, update, delete. Les permissions sont vérifiées automatiquement.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Nom de la table' },
          action: { type: 'string', enum: ['select', 'insert', 'update', 'delete'], description: 'Type d\'action' },
          data: { type: 'object', description: 'Données pour insert/update (clé: valeur)' },
          where: { type: 'object', description: 'Conditions WHERE pour select/update/delete (clé: valeur)' },
          columns: { type: 'array', items: { type: 'string' }, description: 'Colonnes à sélectionner (défaut: toutes)' },
          limit: { type: 'number', description: 'Limite de résultats pour select (défaut: 100)' },
          orderBy: { type: 'string', description: 'Clause ORDER BY pour select' }
        },
        required: ['table', 'action']
      }
    },
    {
      name: 'list_tables',
      description: 'Lister toutes les tables de la base de données avec leurs colonnes et nombre de lignes.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'create_table',
      description: 'Créer une nouvelle table dans la base de données. Peut nécessiter une approbation de l\'utilisateur.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom de la table (alphanumérique + underscore)' },
          schema: {
            type: 'array',
            description: 'Définition des colonnes',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Nom de la colonne' },
                type: { type: 'string', description: 'Type SQL (INTEGER, TEXT, REAL, BLOB)' },
                primaryKey: { type: 'boolean' },
                autoIncrement: { type: 'boolean' },
                notNull: { type: 'boolean' },
                default: { type: 'string' }
              },
              required: ['name', 'type']
            }
          }
        },
        required: ['name', 'schema']
      }
    },
    {
      name: 'send_notification',
      description: 'Envoyer une notification visible dans le dashboard de l\'utilisateur.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Titre de la notification' },
          message: { type: 'string', description: 'Message de la notification' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'], description: 'Type (défaut: info)' },
          duration: { type: 'number', description: 'Durée d\'affichage en ms (défaut: 5000)' }
        },
        required: ['message']
      }
    }
  ];

  if (isScript) {
    tools.push(
      {
        name: 'run_script',
        description: 'Exécuter le script actuel (script.js) et retourner les logs de sortie.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_script_logs',
        description: 'Récupérer les derniers logs d\'exécution du script.',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', description: 'Nombre de logs (défaut: 10)' } }
        }
      }
    );
  }

  return tools;
}

// === Exécution des outils via l'API HTTP du dashboard ===

async function apiCall(path: string, method: string = 'GET', body?: any): Promise<any> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

async function callTool(name: string, args: Record<string, any>): Promise<any> {
  const prefix = isScript ? `/api/scripts/${entityId}` : `/api/widgets/${entityId}`;

  switch (name) {
    case 'query_database':
      return apiCall(`${prefix}/query`, 'POST', args);

    case 'list_tables':
      return apiCall(`${prefix}/tables`);

    case 'create_table':
      return apiCall(`${prefix}/tables`, 'POST', { name: args.name, schema: args.schema });

    case 'send_notification':
      return apiCall(`/api/scripts/notify`, 'POST', { scriptId: entityId, ...args });

    case 'run_script':
      return apiCall(`${prefix}/run`, 'POST');

    case 'get_script_logs':
      return apiCall(`${prefix}/logs?limit=${args.limit || 10}`);

    default:
      return { error: `Outil inconnu: ${name}` };
  }
}
