// API REST du dashboard

import { Hono } from "hono";
import { tabManager } from "../tabs/manager";
import { backupManager } from "../backup/manager";
import { CONFIG } from "../config";
import { databaseManager, demoDatabaseManager } from "../database/manager";
import { widgetManager } from "../widgets/manager";

export const api = new Hono();

// === WIDGET DB QUERY (accessible via /api/tabs/:tabId/widgets/:instanceId/query) ===
// Les widgets appellent cette URL depuis leur iframe.
// Les onglets démo (tabId commençant par "demo-tab-") lisent data/demo.db.
api.post("/tabs/:tabId/widgets/:instanceId/query", async (c) => {
	try {
		const tabId = c.req.param("tabId");
		const instanceId = c.req.param("instanceId");
		const query = await c.req.json();
		// Tous les onglets démo ont un ID commençant par "demo-tab-" (initial ou créés par l'utilisateur)
		const isDemoTab = tabId.startsWith("demo-tab-");

		// Résoudre l'onglet (démo ou réel)
		let tab;
		if (isDemoTab) {
			const { getDemoTab } = await import("./demo-api");
			tab = await getDemoTab(tabId);
		} else {
			tab = await tabManager.getTab(tabId);
		}
		if (!tab) return c.json({ success: false, error: "Tab not found" }, 404);

		const instance = tab.widgets?.find((w: any) => w.id === instanceId);
		if (!instance) return c.json({ success: false, error: "Widget instance not found" }, 404);

		const widget = await widgetManager.getWidget(instance.widgetId);
		if (!widget) return c.json({ success: false, error: "Widget not found" }, 404);

		const permissions = widget.dbPermissions || [];
		if (permissions.length === 0) {
			return c.json({ success: false, error: "No database permissions configured for this widget" }, 403);
		}

		// En mode démo, bloquer les écritures quand la démo est en lecture seule
		if (isDemoTab && CONFIG.DEMO_READ_ONLY && ["insert", "update", "delete"].includes(query.action)) {
			return c.json({ success: false, error: "This demo is read-only." }, 403);
		}

		const result = isDemoTab
			? demoDatabaseManager.executeQuery(tabId, permissions, query)
			: databaseManager.executeQuery(tabId, permissions, query);

		return c.json({ success: true, data: result });
	} catch (error: any) {
		return c.json({ success: false, error: error.message }, 400);
	}
});

// === WIDGET CODE MODIFICATIONS ===

// Régénérer le fragtree après modification du code du widget
api.post("/widgets/:widgetId/refresh-fragtree", async (c) => {
	try {
		const widgetId = c.req.param("widgetId");
		await widgetManager.refreshWidgetFragtree(widgetId);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ success: false, error: error.message }, 400);
	}
});

// === DATABASE ===

// Lister toutes les tables disponibles
api.get("/database/tables", async (c) => {
	const tables = databaseManager.getAllTables();
	return c.json({ tables });
});

// Obtenir le schéma d'une table
api.get("/database/schema/:table", async (c) => {
	const table = c.req.param("table");
	try {
		const schema = databaseManager.getTableSchema(table);
		return c.json({ table, schema });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Créer une nouvelle table
api.post("/database/tables", async (c) => {
	const { name, schema } = await c.req.json<{ name: string; schema: any }>();

	if (!name || !schema) {
		return c.json({ error: "name and schema are required" }, 400);
	}

	try {
		databaseManager.createTable(name, schema);
		return c.json({ success: true, table: name }, 201);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Supprimer une table
api.delete("/database/tables/:table", async (c) => {
	const table = c.req.param("table");

	try {
		databaseManager.dropTable(table);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Statistiques d'une table
api.get("/database/tables/:table/stats", async (c) => {
	const table = c.req.param("table");

	try {
		const stats = databaseManager.getTableStats(table);
		return c.json(stats);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// === SQL EXPLORER ===

// Explorer les données d'une table (pagination)
api.get("/database/tables/:table/explore", async (c) => {
	const table = c.req.param("table");
	const limit = parseInt(c.req.query("limit") || "100");
	const offset = parseInt(c.req.query("offset") || "0");

	try {
		const data = databaseManager.exploreTable(table, limit, offset);
		return c.json(data);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Modifier une table (ALTER TABLE)
api.patch("/database/tables/:table", async (c) => {
	const table = c.req.param("table");
	const alterations = await c.req.json<{
		addColumns?: Array<{ name: string; type: string; notNull?: boolean; defaultValue?: string }>;
		dropColumns?: string[];
	}>();

	try {
		databaseManager.alterTable(table, alterations);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Mettre à jour une ligne
api.put("/database/tables/:table/rows/:rowId", async (c) => {
	const table = c.req.param("table");
	const rowId = c.req.param("rowId");
	const data = await c.req.json();

	try {
		const result = databaseManager.updateRow(table, rowId, data);
		return c.json({ success: true, ...result });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Supprimer une ligne
api.delete("/database/tables/:table/rows/:rowId", async (c) => {
	const table = c.req.param("table");
	const rowId = c.req.param("rowId");

	try {
		const result = databaseManager.deleteRow(table, rowId);
		return c.json({ success: true, ...result });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Insérer une nouvelle ligne
api.post("/database/tables/:table/rows", async (c) => {
	const table = c.req.param("table");
	const data = await c.req.json();

	try {
		const result = databaseManager.insertRow(table, data);
		return c.json({ success: true, ...result });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// === TABS ===

// Liste des onglets
api.get("/tabs", async (c) => {
	const tabs = await tabManager.getTabs();
	return c.json(tabs);
});

// Réordonner les tabs
api.put("/tabs/order", async (c) => {
	const { tabIds } = await c.req.json<{ tabIds: string[] }>();
	await tabManager.reorderTabs(tabIds);
	return c.json({ ok: true });
});

// Détails d'un onglet
api.get("/tabs/:id", async (c) => {
	const tab = await tabManager.getTab(c.req.param("id"));
	if (!tab) return c.json({ error: "Tab not found" }, 404);
	return c.json(tab);
});

// Créer un onglet
api.post("/tabs", async (c) => {
	const { name } = await c.req.json<{ name: string }>();
	if (!name) return c.json({ error: "Name is required" }, 400);

	const tab = await tabManager.createTab(name);
	return c.json(tab, 201);
});

// Modifier un onglet
api.patch("/tabs/:id", async (c) => {
	const { name, order, emoji } = await c.req.json<{ name?: string; order?: number; emoji?: string }>();
	const tab = await tabManager.updateTab(c.req.param("id"), { name, order, emoji });
	if (!tab) return c.json({ error: "Tab not found" }, 404);
	return c.json(tab);
});

// Supprimer un onglet
api.delete("/tabs/:id", async (c) => {
	const tab = await tabManager.getTab(c.req.param("id"));
	if (!tab) return c.json({ error: "Tab not found" }, 404);
	await tabManager.deleteTab(c.req.param("id"));
	return c.json({ success: true });
});

// === PAGES ===

// Ajouter une page à un onglet
api.post("/tabs/:id/pages", async (c) => {
	try {
		const { name, emoji } = await c.req.json<{ name: string; emoji?: string }>();
		if (!name) return c.json({ error: "Name is required" }, 400);
		const page = await tabManager.addPage(c.req.param("id"), name, emoji);
		return c.json(page, 201);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Modifier une page
api.patch("/tabs/:id/pages/:pageId", async (c) => {
	try {
		const { name, emoji, order } = await c.req.json<{ name?: string; emoji?: string; order?: number }>();
		const page = await tabManager.updatePage(c.req.param("id"), c.req.param("pageId"), { name, emoji, order });
		if (!page) return c.json({ error: "Page not found" }, 404);
		return c.json(page);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Supprimer une page
api.delete("/tabs/:id/pages/:pageId", async (c) => {
	try {
		await tabManager.deletePage(c.req.param("id"), c.req.param("pageId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Réordonner les pages
api.put("/tabs/:id/pages/order", async (c) => {
	try {
		const { pageIds } = await c.req.json<{ pageIds: string[] }>();
		await tabManager.reorderPages(c.req.param("id"), pageIds);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Définir la page courante
api.put("/tabs/:id/current-page", async (c) => {
	try {
		const { pageId } = await c.req.json<{ pageId: string }>();
		await tabManager.setCurrentPage(c.req.param("id"), pageId);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Ajouter un widget à une page
api.post("/tabs/:id/pages/:pageId/widgets", async (c) => {
	try {
		const { widgetId, position, config } = await c.req.json();
		const instance = await tabManager.addWidgetToPage(c.req.param("id"), c.req.param("pageId"), widgetId, position, config);
		return c.json(instance, 201);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Retirer un widget d'une page
api.delete("/tabs/:id/pages/:pageId/widgets/:instanceId", async (c) => {
	try {
		await tabManager.removeWidgetFromPage(c.req.param("id"), c.req.param("pageId"), c.req.param("instanceId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Mettre à jour la position d'un widget dans une page
api.put("/tabs/:id/pages/:pageId/widgets/:instanceId", async (c) => {
	try {
		const { position } = await c.req.json();
		await tabManager.updateWidgetPositionInPage(c.req.param("id"), c.req.param("pageId"), c.req.param("instanceId"), position);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Contenu d'un onglet
api.get("/tabs/:id/content", async (c) => {
	const content = await tabManager.getTabContent(c.req.param("id"));
	if (content === null) return c.json({ error: "Tab not found" }, 404);
	return c.html(content);
});

// Fichiers d'un onglet
api.get("/tabs/:id/files", async (c) => {
	const files = await tabManager.getTabFiles(c.req.param("id"));
	return c.json(files);
});

// === STYLE PRESETS ===

// Lister tous les presets (par défaut + personnalisés)
api.get("/presets", async (c) => {
	const { presetManager } = await import("../presets/manager");
	const presets = await presetManager.getPresets();
	return c.json(presets);
});

// Récupérer un preset par ID
api.get("/presets/:id", async (c) => {
	const { presetManager } = await import("../presets/manager");
	const preset = await presetManager.getPreset(c.req.param("id"));
	if (!preset) return c.json({ error: "Preset not found" }, 404);
	return c.json(preset);
});

// Créer un nouveau preset personnalisé
api.post("/presets", async (c) => {
	const { presetManager } = await import("../presets/manager");
	const { name, style } = await c.req.json<{ name: string; style: any }>();

	if (!name || !style) {
		return c.json({ error: "name and style are required" }, 400);
	}

	try {
		const preset = await presetManager.createPreset(name, style);
		return c.json(preset, 201);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// Supprimer un preset personnalisé
api.delete("/presets/:id", async (c) => {
	const { presetManager } = await import("../presets/manager");

	try {
		await presetManager.deletePreset(c.req.param("id"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

// === BACKUPS ===

// Liste des backups d'un onglet
api.get("/tabs/:id/backups", async (c) => {
	const backups = await backupManager.getBackups(c.req.param("id"));
	console.log("[API] Returning", backups.length, "backups. First backup:", backups[0] ? JSON.stringify(backups[0], null, 2) : "none");
	return c.json(backups);
});

// Créer un backup
api.post("/tabs/:id/backups", async (c) => {
	const { description, screenshot, source, userMessage, skipIfNoChanges } = await c.req
		.json<{
			description?: string;
			screenshot?: string;
			source?: "manual" | "auto-opencode" | "auto-restore";
			userMessage?: string;
			skipIfNoChanges?: boolean;
		}>()
		.catch(() => ({} as any));
	const backup = await backupManager.createBackup(c.req.param("id"), description, {
		source: source || "manual",
		screenshot,
		userMessage,
		skipIfNoChanges
	});
	return c.json(backup, 201);
});

// Restaurer un backup
api.post("/tabs/:id/backups/:backupId/restore", async (c) => {
	const success = await backupManager.restoreBackup(c.req.param("id"), c.req.param("backupId"));
	if (!success) return c.json({ error: "Backup not found" }, 404);
	return c.json({ success: true });
});

// Supprimer un backup
api.delete("/tabs/:id/backups/:backupId", async (c) => {
	const success = await backupManager.deleteBackup(c.req.param("id"), c.req.param("backupId"));
	if (!success) return c.json({ error: "Backup not found" }, 404);
	return c.json({ success: true });
});

// Récupérer le screenshot d'un backup
api.get("/tabs/:id/backups/:backupId/screenshot", async (c) => {
	const screenshot = await backupManager.getBackupScreenshot(c.req.param("id"), c.req.param("backupId"));
	if (!screenshot) return c.json({ error: "Screenshot not found" }, 404);

	return new Response(new Uint8Array(screenshot), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000"
		}
	});
});

// === OPENCODE USAGE ===

api.get("/opencode/usage", async (c) => {
	const { opencodeUsageTracker } = await import("../opencode/opencode-session-manager");
	return c.json({
		requestsToday: opencodeUsageTracker.requestsToday,
		totalRequests: opencodeUsageTracker.totalRequests,
		inputTokensToday: opencodeUsageTracker.inputTokensToday,
		outputTokensToday: opencodeUsageTracker.outputTokensToday,
		rateLimitCount: opencodeUsageTracker.rateLimitCount,
		lastResetDate: opencodeUsageTracker.lastResetDate,
		byModel: opencodeUsageTracker.byModel
	});
});

// === CCUSAGE — DÉSACTIVÉ (spécifique Claude Code, non OpenCode) ===
// Ce endpoint utilisait `ccusage` CLI qui est spécifique à Anthropic Claude Code
// OpenCode n'a pas de fonctionnalité equivalente pour le moment

// let _ccusageCache: { data: Record<string, unknown>; ts: number } | null = null;
// const CCUSAGE_TTL = 45_000;
// api.get("/opencode/ccusage", async (c) => { ... });

// === OPENCODE /usage — stats via opencode stats ===

let _opencodeUsageCache: { data: Record<string, unknown>; ts: number } | null = null;
const OPENCODE_USAGE_TTL = 90_000; // 90s

// Lance opencode-stats-pty.cjs via `node` (node-pty échoue avec ESPIPE sous bun)
async function _fetchOpenCodeUsage(): Promise<Record<string, unknown>> {
	const { spawn } = await import("child_process");
	const { resolve: pathResolve } = await import("path");
	const script = pathResolve(import.meta.dir, "../opencode/opencode-stats-pty.cjs");

	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (v !== undefined) env[k] = v;
	}

	return new Promise<Record<string, unknown>>((resolve) => {
		let stdout = "";
		let settled = false;
		const done = () => {
			if (!settled) {
				settled = true;
				try {
					resolve(JSON.parse(stdout));
				} catch {
					resolve({});
				}
			}
		};

		const proc = spawn("node", [script], { env, stdio: ["ignore", "pipe", "ignore"] });
		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		proc.on("close", done);
		proc.on("error", done);

		// Kill de secours après 18s
		setTimeout(() => {
			try {
				proc.kill("SIGTERM");
			} catch {
				/* */
			}
			done();
		}, 18_000);
	});
}

api.get("/opencode/opencode-usage", async (c) => {
	const now = Date.now();
	if (!_opencodeUsageCache || now - _opencodeUsageCache.ts > OPENCODE_USAGE_TTL) {
		try {
			const data = await _fetchOpenCodeUsage();
			_opencodeUsageCache = { data, ts: now };
		} catch {
			/* garder cache précédent */
		}
	}
	if (!_opencodeUsageCache) return c.json({ raw: "", costUSD: 0, requests: 0 });
	return c.json(_opencodeUsageCache.data);
});

// === CONFIG ===

api.get("/config", (c) => {
	return c.json({
		opencodeEnabled: true, // Toujours activé car on utilise OpenCode CLI local
		opencodeProvider: 'opencode' // Indique le provider AI utilisé
	});
});

// === TAB VARIABLES (partagées entre widgets) ===
// Note : le dashboard en mode démo utilise /api/demo/tabs/:id/variables/*
// Ces routes servent aux widgets (iframes) qui appellent /api/tabs/:id/variables/* directement

// Récupérer toutes les variables d'un onglet
api.get("/tabs/:id/variables", async (c) => {
	const id = c.req.param("id");
	let tab;
	if (id.startsWith("demo-tab-")) {
		const { getDemoTab } = await import("./demo-api");
		tab = await getDemoTab(id);
	} else {
		tab = await tabManager.getTab(id);
	}
	if (!tab) return c.json({ error: "Tab not found" }, 404);
	return c.json(tab.variables || {});
});

// Récupérer une variable spécifique
api.get("/tabs/:id/variables/:key", async (c) => {
	const id = c.req.param("id");
	let tab;
	if (id.startsWith("demo-tab-")) {
		const { getDemoTab } = await import("./demo-api");
		tab = await getDemoTab(id);
	} else {
		tab = await tabManager.getTab(id);
	}
	if (!tab) return c.json({ error: "Tab not found" }, 404);
	const value = tab.variables?.[c.req.param("key")];
	return c.json({ key: c.req.param("key"), value: value ?? null });
});

// Définir/modifier une variable (réel ou démo — utilisé aussi par les iframes widgets)
api.put("/tabs/:id/variables/:key", async (c) => {
	const id = c.req.param("id");
	const { value } = await c.req.json<{ value: any }>();
	if (id.startsWith("demo-tab-")) {
		if (CONFIG.DEMO_READ_ONLY) return c.json({ error: "This demo is read-only." }, 403);
		const { getDemoTab } = await import("./demo-api");
		const tab = await getDemoTab(id);
		if (!tab) return c.json({ error: "Tab not found" }, 404);
		if (!tab.variables) tab.variables = {};
		tab.variables[c.req.param("key")] = value;
		tab.updatedAt = new Date().toISOString();
		const { writeFile, mkdir } = await import("fs/promises");
		const { join } = await import("path");
		const tabDir = join(CONFIG.DEMO_TABS_DIR, id);
		await mkdir(tabDir, { recursive: true });
		await writeFile(join(tabDir, "tab.json"), JSON.stringify({ tab, version: 1 }, null, 2));
		return c.json({ key: c.req.param("key"), value });
	}
	const success = await tabManager.setTabVariable(id, c.req.param("key"), value);
	if (!success) return c.json({ error: "Tab not found" }, 404);
	return c.json({ success: true, key: c.req.param("key"), value });
});

// Supprimer une variable (réel ou démo)
api.delete("/tabs/:id/variables/:key", async (c) => {
	const id = c.req.param("id");
	if (id.startsWith("demo-tab-")) {
		if (CONFIG.DEMO_READ_ONLY) return c.json({ error: "This demo is read-only." }, 403);
		const { getDemoTab } = await import("./demo-api");
		const tab = await getDemoTab(id);
		if (!tab) return c.json({ error: "Tab not found" }, 404);
		if (tab.variables) delete tab.variables[c.req.param("key")];
		tab.updatedAt = new Date().toISOString();
		const { writeFile, mkdir } = await import("fs/promises");
		const { join } = await import("path");
		const tabDir = join(CONFIG.DEMO_TABS_DIR, id);
		await mkdir(tabDir, { recursive: true });
		await writeFile(join(tabDir, "tab.json"), JSON.stringify({ tab, version: 1 }, null, 2));
		return c.json({ success: true });
	}
	const success = await tabManager.deleteTabVariable(id, c.req.param("key"));
	if (!success) return c.json({ error: "Tab not found" }, 404);
	return c.json({ success: true });
});

// === TAB STATE PERSISTENCE ===

// Récupérer l'état d'un tab
api.get("/tabs/:id/state", async (c) => {
	const state = await tabManager.getTabState(c.req.param("id"));
	if (!state) return c.json({ error: "Tab not found" }, 404);
	return c.json(state);
});

// Sauvegarder l'état d'un tab
api.post("/tabs/:id/state", async (c) => {
	try {
		const state = await c.req.json();
		await tabManager.saveTabState(c.req.param("id"), state);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

// === NOTIFICATION CENTER ===

/** Lister les notifications (avec filtre optionnel ?unread=1&limit=50) */
api.get("/notifications", async (c) => {
	try {
		const unreadOnly = c.req.query("unread") === "1";
		const limit = parseInt(c.req.query("limit") || "100");
		const where = unreadOnly ? "WHERE read = 0" : "";
		const rows = databaseManager.queryRaw(`SELECT * FROM notification_center ${where} ORDER BY created_at DESC LIMIT ?`, [limit]);
		const unreadCount = databaseManager.queryRaw("SELECT COUNT(*) as count FROM notification_center WHERE read = 0")?.[0]?.count || 0;
		return c.json({ notifications: rows, unreadCount });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

/** Ajouter une notification au centre */
api.post("/notifications", async (c) => {
	try {
		const { title, message, type = "info", icon, source = "system", sourceId, sourceName } = await c.req.json();
		if (!message) return c.json({ error: "message requis" }, 400);
		databaseManager.queryRaw(`INSERT INTO notification_center (title, message, type, icon, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?, ?)`, [title || null, message, type, icon || null, source, sourceId || null, sourceName || null]);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

/** Marquer toutes les notifications comme lues */
api.put("/notifications/read-all", async (c) => {
	try {
		databaseManager.queryRaw("UPDATE notification_center SET read = 1 WHERE read = 0");
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

/** Marquer une notification comme lue */
api.put("/notifications/:id/read", async (c) => {
	try {
		const id = c.req.param("id");
		databaseManager.queryRaw("UPDATE notification_center SET read = 1 WHERE id = ?", [id]);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

/** Vider toutes les notifications lues */
api.delete("/notifications/clear-read", async (c) => {
	try {
		databaseManager.queryRaw("DELETE FROM notification_center WHERE read = 1");
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

/** Supprimer une notification */
api.delete("/notifications/:id", async (c) => {
	try {
		const id = c.req.param("id");
		databaseManager.queryRaw("DELETE FROM notification_center WHERE id = ?", [id]);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

// === OPENCODE QUEUE ===

api.get("/opencode/queue", async (c) => {
	try {
		const items = databaseManager.queryRaw("SELECT * FROM opencode_queue ORDER BY position ASC", []);
		return c.json({ items });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

api.post("/opencode/queue", async (c) => {
	try {
		const body = await c.req.json<{
			entity_id: string;
			session_id?: string;
			message: string;
			model: string;
			thinking: number;
			api_base_template: string;
			entity_label?: string;
			panel_type: string;
			session_name?: string;
		}>();

		const result = databaseManager.runRaw(
			`INSERT INTO opencode_queue
			(entity_id, session_id, message, model, thinking, api_base_template, entity_label, panel_type, session_name, position)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM opencode_queue))`,
			[body.entity_id, body.session_id || null, body.message, body.model, body.thinking ? 1 : 0, body.api_base_template, body.entity_label || null, body.panel_type, body.session_name || null]
		);

		return c.json({ id: result.lastInsertRowid }, 201);
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

api.delete("/opencode/queue/:id", async (c) => {
	try {
		const id = c.req.param("id");
		databaseManager.queryRaw("DELETE FROM opencode_queue WHERE id = ?", [id]);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

api.delete("/opencode/queue", async (c) => {
	try {
		databaseManager.queryRaw("DELETE FROM opencode_queue", []);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

api.patch("/opencode/queue/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json<{ message: string }>();
		databaseManager.queryRaw("UPDATE opencode_queue SET message = ? WHERE id = ?", [body.message, id]);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});
