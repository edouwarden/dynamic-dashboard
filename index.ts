// Dashboard - Point d'entrée principal

import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { api } from './src/server/api';
import { widgetsApi } from './src/server/widgets/index';
import { scriptsApi } from './src/server/scripts/index';
import { demoApi } from './src/server/demo-api';
import { dashboardOpenCodeRouter } from './src/server/dashboard/opencode';
import { tabManager } from './src/tabs/manager';
import { widgetManager } from './src/widgets/manager';
import { getDemoTab } from './src/server/demo-api';
import { ensureSeeded } from './src/demo/seed';
import { CONFIG } from './src/config';

// Créer l'application Hono
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// API
app.route('/api', api);
app.route('/api/widgets', widgetsApi);
app.route('/api/scripts', scriptsApi);

// API démo (onglets séparés, données randomisées)
app.route('/api/demo', demoApi);

// API OpenCode dashboard global
app.route('/api/dashboard', dashboardOpenCodeRouter);

// Servir les fichiers statiques du dashboard
app.use('/static/*', serveStatic({ root: './src/public' }));

// PWA assets live at the site root, not under /static
app.get('/manifest.json', async (c) => {
  const content = await readFile('./src/public/manifest.json', 'utf-8');
  c.header('Content-Type', 'application/manifest+json');
  return c.body(content);
});

app.get('/sw.js', async (c) => {
  const content = await readFile('./src/public/sw.js', 'utf-8');
  c.header('Content-Type', 'application/javascript');
  c.header('Service-Worker-Allowed', '/');
  return c.body(content);
});

// Servir les fichiers d'un widget
app.get('/widgets/:id/*', async (c) => {
  const widgetId = c.req.param('id');
  const filePath = c.req.path.replace(`/widgets/${widgetId}/`, '') || 'index.html';

  const fullPath = join(CONFIG.WIDGETS_DIR, widgetId, filePath);

  if (!existsSync(fullPath)) {
    return c.notFound();
  }

  let content = await readFile(fullPath);
  const ext = filePath.split('.').pop() || '';

  // Injecter les variables CSS dans les fichiers HTML
  if (ext === 'html' && filePath === 'index.html') {
    const tabId = c.req.query('tabId');

    if (tabId) {
      try {
        const tab = tabId.startsWith('demo-tab-')
          ? await getDemoTab(tabId)
          : await tabManager.getTab(tabId);

        if (tab && tab.style) {
          const cssVars = `
    <style>
      :root {
        --color-primary: ${tab.style.colorPrimary || '#3b82f6'};
        --color-secondary: ${tab.style.colorSecondary || '#8b5cf6'};
        --color-bg: ${tab.style.colorBackground || '#ffffff'};
        --color-text: ${tab.style.colorText || '#1f2937'};
        --font-family: ${tab.style.fontFamily || 'Inter, sans-serif'};
        --border-radius: ${tab.style.borderRadius || '8px'};
        --border-style: ${tab.style.borderStyle || 'solid'};
        --border-width: ${tab.style.borderWidth || '1px'};
      }
    </style>`;

          // Injecter les variables CSS juste après la balise <head>
          let html = content.toString('utf-8');
          html = html.replace(/<head>/i, `<head>${cssVars}`);
          content = Buffer.from(html, 'utf-8');
        }
      } catch (err) {
        console.error('[Widget] Erreur lors de l\'injection des CSS:', err);
      }
    }
  }

  const mimeTypes: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
  };

  c.header('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  // no-store pour HTML/CSS/JS (modifiés fréquemment par Claude), no-cache pour les assets
  if (['html', 'css', 'js'].includes(ext)) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  } else {
    c.header('Cache-Control', 'no-cache');
  }
  return c.body(content);
});

// Page principale du dashboard
app.get('/', async (c) => {
  const html = await readFile('./src/public/index.html', 'utf-8');
  return c.html(html);
});

// Mode démo — même frontend avec flag DEMO_MODE
app.get('/demo', async (c) => {
  let html = await readFile('./src/public/index.html', 'utf-8');
  html = html.replace('<head>', '<head><script>window.DEMO_MODE=true;</script>');
  return c.html(html);
});

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║             ⚡ Dashboard ⚡              ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Initialiser le gestionnaire d'onglets
  await tabManager.init();
  console.log('[INIT] Gestionnaire d\'onglets initialisé');

  // Seed the local dashboard + isolated demo with neutral data (only if empty)
  await ensureSeeded(false);
  await ensureSeeded(true);
  console.log('[INIT] Données de démonstration prêtes');

  // Initialiser le gestionnaire de widgets
  await widgetManager.initialize();
  console.log('[INIT] Gestionnaire de widgets initialisé');

  // Initialiser le gestionnaire de presets
  const { presetManager } = await import('./src/presets/manager');
  await presetManager.init();
  console.log('[INIT] Gestionnaire de presets initialisé');

  // Initialiser le gestionnaire de scripts globaux
  const { globalScriptManager } = await import('./src/scripts/global-manager');
  await globalScriptManager.initialize();
  console.log('[INIT] Gestionnaire de scripts globaux initialisé');

  // Initialiser le scheduler de scripts backend
  const { scriptScheduler } = await import('./src/scripts/scheduler');
  await scriptScheduler.init();
  console.log('[INIT] Scheduler de scripts initialisé');

  console.log('');
  console.log('────────────────────────────────────────');
  console.log(`🌐 Dashboard:  http://localhost:${CONFIG.WEB_PORT}`);
  console.log('────────────────────────────────────────');
  console.log('');
}

// Démarrer l'initialisation
main().catch(console.error);

// Exporter pour Bun.serve
export default {
  port: CONFIG.WEB_PORT,

  fetch(req: Request, server: any) {
    return app.fetch(req, { server });
  },

	// Timeout max (255 secondes = ~4 minutes) pour supporter les connexions SSE longues (chat OpenCode)
  idleTimeout: 255,
};
