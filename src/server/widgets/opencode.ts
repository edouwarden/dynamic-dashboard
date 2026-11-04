/**
 * OpenCode pour widgets : chat SSE, upload de fichiers,
 * historique, gestion des sessions
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { widgetBackupManager } from "../../widgets/backup";
import { widgetManager } from "../../widgets/manager";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { CONFIG } from "../../config";

export const opencodeRouter = new Hono();

opencodeRouter.post("/:id/opencode/chat", async (c) => {
	const widgetId = c.req.param("id");
	const body = await c.req.json();
	const { message, model, thinking, sessionId } = body;

	const { widgetOpenCodeSessionManager } = await import("../../opencode/widget-sessions");

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
			stream.writeSSE({ data: JSON.stringify(event) }).catch(() => {
				isClosed = true;
				clearInterval(heartbeat);
			});
			if (event.type === "done") {
				isClosed = true;
				clearInterval(heartbeat);
				widgetManager.refreshWidgetFragtree(widgetId).catch(() => {});
			}
		};

		try {
			await widgetOpenCodeSessionManager.sendMessage(widgetId, message, sendEvent, undefined, { model: model || "opencode-go/minimax-m2.7", thinking: thinking || false }, sessionId || undefined);
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

/**
 * Upload de fichiers pour un widget (images, etc.)
 * Stocke dans data/widgets/{id}/uploads/
 */
opencodeRouter.post("/:id/opencode/upload", async (c) => {
	const widgetId = c.req.param("id");

	try {
		const formData = await c.req.formData();
		const file = formData.get("file") as File | null;
		if (!file) return c.json({ success: false, error: "Aucun fichier fourni" }, 400);

		const widgetDir = join(CONFIG.WIDGETS_DIR, widgetId);
		const uploadsDir = join(widgetDir, "uploads");
		await mkdir(uploadsDir, { recursive: true });

		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
		const fileName = `${Date.now()}-${safeName}`;
		const filePath = join(uploadsDir, fileName);

		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filePath, buffer);

		return c.json({
			success: true,
			fileName: file.name,
			relativePath: `uploads/${fileName}`,
			absolutePath: filePath,
			size: file.size,
			type: file.type
		});
	} catch (error: any) {
		return c.json({ success: false, error: error.message }, 500);
	}
});

/** Backups d'un widget */
opencodeRouter.get("/:id/backups", async (c) => {
	try {
		const id = c.req.param("id");
		const backups = await widgetBackupManager.listBackups(id);
		return c.json(backups);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.post("/:id/backups", async (c) => {
	try {
		const id = c.req.param("id");
		const { autoName } = await c.req.json();
		const backup = await widgetBackupManager.createBackup(id, {
			autoName: autoName || "💾 Backup manuel",
			source: "manual"
		});
		return c.json(backup);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

opencodeRouter.post("/:id/backups/:backupId/restore", async (c) => {
	try {
		const id = c.req.param("id");
		const backupId = c.req.param("backupId");
		await widgetBackupManager.restoreBackup(id, backupId);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

opencodeRouter.delete("/:id/backups/:backupId", async (c) => {
	try {
		const id = c.req.param("id");
		const backupId = c.req.param("backupId");
		await widgetBackupManager.deleteBackup(id, backupId);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

/** Historique OpenCode d'un widget */
opencodeRouter.get("/:id/opencode/history", async (c) => {
	const widgetId = c.req.param("id");
	try {
		const { widgetOpenCodeSessionManager } = await import("../../opencode/widget-sessions");
		const history = await widgetOpenCodeSessionManager.getHistory(widgetId);
		return c.json(history);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.delete("/:id/opencode/history", async (c) => {
	const widgetId = c.req.param("id");
	try {
		const { widgetOpenCodeSessionManager } = await import("../../opencode/widget-sessions");
		await widgetOpenCodeSessionManager.clearHistory(widgetId);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

/** Sessions OpenCode d'un widget */
opencodeRouter.get("/:id/opencode/sessions", async (c) => {
	const widgetId = c.req.param("id");
	try {
		const { widgetOpenCodeSessionManager } = await import("../../opencode/widget-sessions");
		const sessions = await widgetOpenCodeSessionManager.listSessions(widgetId);
		const activeSessionId = await widgetOpenCodeSessionManager.getActiveSession(widgetId);
		return c.json({ sessions, activeSessionId });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.post("/:id/opencode/sessions", async (c) => {
	const widgetId = c.req.param("id");
	const { name } = await c.req.json<{ name?: string }>();
	try {
		const { widgetOpenCodeSessionManager } = await import("../../opencode/widget-sessions");
		const session = await widgetOpenCodeSessionManager.createSession(widgetId, name);
		return c.json(session, 201);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.put("/:id/opencode/sessions/:sessionId/active", async (c) => {
	const widgetId = c.req.param("id");
	const sessionId = c.req.param("sessionId");
	try {
		const { widgetOpenCodeSessionManager } = await import("../../opencode/widget-sessions");
		await widgetOpenCodeSessionManager.setActiveSession(widgetId, sessionId);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.delete("/:id/opencode/sessions/:sessionId", async (c) => {
	const widgetId = c.req.param("id");
	const sessionId = c.req.param("sessionId");
	try {
		const { widgetOpenCodeSessionManager } = await import("../../opencode/widget-sessions");
		await widgetOpenCodeSessionManager.deleteSession(widgetId, sessionId);
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});
