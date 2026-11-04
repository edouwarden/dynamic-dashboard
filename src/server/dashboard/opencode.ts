/**
 * Routes OpenCode pour le dashboard global
 * Chat SSE, sessions, historique, backups dashboard
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { dashboardOpenCodeSessionManager, DASHBOARD_ENTITY_ID } from '../../opencode/dashboard-sessions';
import { dashboardBackupManager } from '../../dashboard/backup';
import { CONFIG } from '../../config';

export const dashboardOpenCodeRouter = new Hono();

// =====================================================================
// Auth helper — vérifie le token si un mot de passe est configuré
// =====================================================================

async function sha256hex(text: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function checkAuth(c: any): Promise<boolean> {
	if (!CONFIG.DASHBOARD_OPENCODE_PASSWORD) return true;
	const token = c.req.header("X-Dashboard-Token") || "";
	const expected = await sha256hex(CONFIG.DASHBOARD_OPENCODE_PASSWORD);
	return token === expected;
}

// =====================================================================
// Chat SSE
// =====================================================================

dashboardOpenCodeRouter.post("/opencode/chat", async (c) => {
	if (!(await checkAuth(c))) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const { message, model, thinking, sessionId } = await c.req.json();

	return streamSSE(c, async (stream) => {
		let isClosed = false;

		const heartbeat = setInterval(() => {
			if (isClosed || stream.closed) {
				clearInterval(heartbeat);
				return;
			}
			stream.write(": ping\n\n").catch(() => {
				isClosed = true;
				clearInterval(heartbeat);
			});
		}, 15000);

		const sendEvent = (event: any) => {
			if (isClosed || stream.closed) return;
			const write = stream.writeSSE({ data: JSON.stringify(event) }).catch(() => {
				isClosed = true;
				clearInterval(heartbeat);
			});
			if (event.type === "done") {
				isClosed = true;
				clearInterval(heartbeat);
				return write;
			}
		};

		try {
			await dashboardOpenCodeSessionManager.sendMessage(DASHBOARD_ENTITY_ID, message, sendEvent, undefined, { model: model || "opencode-go/minimax-m2.7", thinking: thinking || false }, sessionId || undefined);
		} catch (error: any) {
			if (!isClosed && !stream.closed) {
				stream.writeSSE({ data: JSON.stringify({ type: "error", data: error.message }) }).catch(() => {});
			}
		} finally {
			clearInterval(heartbeat);
		}
	}, async (error, stream) => {
		await stream.writeSSE({ data: JSON.stringify({ type: "error", data: error.message }) }).catch(() => {});
	});
});

// =====================================================================
// Historique
// =====================================================================

dashboardOpenCodeRouter.get("/opencode/history", async (c) => {
	try {
		const history = await dashboardOpenCodeSessionManager.getHistory(DASHBOARD_ENTITY_ID);
		return c.json(history);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

dashboardOpenCodeRouter.delete("/opencode/history", async (c) => {
	try {
		await dashboardOpenCodeSessionManager.clearHistory(DASHBOARD_ENTITY_ID);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

// =====================================================================
// Sessions
// =====================================================================

dashboardOpenCodeRouter.get("/opencode/sessions", async (c) => {
	try {
		const sessions = await dashboardOpenCodeSessionManager.listSessions(DASHBOARD_ENTITY_ID);
		const activeSessionId = await dashboardOpenCodeSessionManager.getActiveSession(DASHBOARD_ENTITY_ID);
		return c.json({ sessions, activeSessionId });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

dashboardOpenCodeRouter.post("/opencode/sessions", async (c) => {
	try {
		const { name } = await c.req.json().catch(() => ({}));
		const session = await dashboardOpenCodeSessionManager.createSession(DASHBOARD_ENTITY_ID, name);
		return c.json(session, 201);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

dashboardOpenCodeRouter.put("/opencode/sessions/:sessionId/active", async (c) => {
	try {
		await dashboardOpenCodeSessionManager.setActiveSession(DASHBOARD_ENTITY_ID, c.req.param("sessionId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

dashboardOpenCodeRouter.delete("/opencode/sessions/:sessionId", async (c) => {
	try {
		await dashboardOpenCodeSessionManager.deleteSession(DASHBOARD_ENTITY_ID, c.req.param("sessionId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

// =====================================================================
// Backups dashboard
// =====================================================================

dashboardOpenCodeRouter.get("/backups", async (c) => {
	try {
		const backups = await dashboardBackupManager.listBackups();
		return c.json(backups);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

dashboardOpenCodeRouter.post("/backups", async (c) => {
	try {
		const { name } = await c.req.json().catch(() => ({}));
		const backup = await dashboardBackupManager.createBackup({
			name: name || "💾 Backup manuel",
			source: "manual"
		});
		return c.json(backup);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

/** Restaurer la dernière backup (endpoint rapide pour l'UI de récupération) */
dashboardOpenCodeRouter.post("/backups/restore-latest", async (c) => {
	try {
		const latestId = await dashboardBackupManager.getLatestBackupId();
		if (!latestId) {
			return c.json({ error: "Aucun backup disponible" }, 404);
		}
		await dashboardBackupManager.restoreBackup(latestId);
		return c.json({ success: true, restoredId: latestId });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

dashboardOpenCodeRouter.post("/backups/:backupId/restore", async (c) => {
	try {
		await dashboardBackupManager.restoreBackup(c.req.param("backupId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

dashboardOpenCodeRouter.delete("/backups/:backupId", async (c) => {
	try {
		await dashboardBackupManager.deleteBackup(c.req.param("backupId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});
