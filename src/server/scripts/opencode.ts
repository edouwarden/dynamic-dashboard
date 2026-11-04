/**
 * OpenCode pour scripts : chat SSE, historique, sessions,
 * autocomplétion Monaco (OpenCode via subprocess)
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { spawn } from 'child_process';
import { scriptOpenCodeSessionManager } from '../../opencode/script-sessions';
import { CONFIG } from '../../config';

export const opencodeRouter = new Hono();

opencodeRouter.post("/:id/opencode/chat", async (c) => {
	const id = c.req.param("id");
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
			stream.writeSSE({ data: JSON.stringify(event) }).catch(() => {
				isClosed = true;
				clearInterval(heartbeat);
			});
			if (event.type === "done") {
				isClosed = true;
				clearInterval(heartbeat);
			}
		};

		try {
			await scriptOpenCodeSessionManager.sendMessage(id, message, sendEvent, undefined, { model: model || "opencode-go/minimax-m2.7", thinking: thinking || false }, sessionId || undefined);
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

opencodeRouter.get("/:id/opencode/history", async (c) => {
	try {
		const history = await scriptOpenCodeSessionManager.getHistory(c.req.param("id"));
		return c.json(history);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.delete("/:id/opencode/history", async (c) => {
	try {
		await scriptOpenCodeSessionManager.clearHistory(c.req.param("id"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.get("/:id/opencode/sessions", async (c) => {
	try {
		const scriptId = c.req.param("id");
		const sessions = await scriptOpenCodeSessionManager.listSessions(scriptId);
		const activeSessionId = await scriptOpenCodeSessionManager.getActiveSession(scriptId);
		return c.json({ sessions, activeSessionId });
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

opencodeRouter.post("/:id/opencode/sessions", async (c) => {
	try {
		const { name } = await c.req.json().catch(() => ({}));
		const session = await scriptOpenCodeSessionManager.createSession(c.req.param("id"), name);
		return c.json(session, 201);
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

opencodeRouter.put("/:id/opencode/sessions/:sessionId/active", async (c) => {
	try {
		await scriptOpenCodeSessionManager.setActiveSession(c.req.param("id"), c.req.param("sessionId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

opencodeRouter.delete("/:id/opencode/sessions/:sessionId", async (c) => {
	try {
		await scriptOpenCodeSessionManager.deleteSession(c.req.param("id"), c.req.param("sessionId"));
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ error: error.message }, 400);
	}
});

/**
 * Autocomplétion AI pour Monaco (OpenCode via subprocess)
 * Reçoit { codeBefore, codeAfter } → retourne { completion }
 */
opencodeRouter.post("/autocomplete", async (c) => {
	try {
		const { codeBefore, codeAfter } = await c.req.json();
		if (!codeBefore && !codeAfter) return c.json({ completion: "" });

		const systemPrompt = `Tu es un assistant d'autocomplétion de code JavaScript. Tu complètes le code à l'endroit du curseur <CURSOR>.
Fonctions disponibles : queryDB({table,action,data?,where?,columns?,limit?,orderBy?}), log(msg,level?), sendWebhook(url,data), sendNotification({title?,message,type?,duration?}), fetch(url,opts?).
Variables : script {id,name}, trigger ('cron'|'manual'|'webhook'), webhookPayload.
Runtime : Bun.js (pas de DOM).

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le code à insérer à l'endroit du curseur, RIEN D'AUTRE
- Pas de commentaire, pas d'explication, pas de markdown
- Maximum 3 lignes
- Si tu ne sais pas, réponds avec une chaîne vide`;

		const userMsg = `${codeBefore}<CURSOR>${codeAfter}`;

		const completion = await new Promise<string>((resolve) => {
			const opencode = spawn(CONFIG.OPENCODE_BIN, ["run", "--format", "text", "--model", CONFIG.OPENCODE_MODEL, "--agent", "safe", systemPrompt + "\n\nUser: " + userMsg], { stdio: ["pipe", "pipe", "pipe"] });

			let result = "";
			opencode.stdout.on("data", (chunk) => {
				result += chunk.toString();
			});
			opencode.on("close", () => {
				let completion = result.trim();
				if (completion.startsWith("```")) {
					completion = completion
						.replace(/^```\w*\n?/, "")
						.replace(/\n?```$/, "")
						.trim();
				}
				resolve(completion);
			});
			opencode.on("error", () => resolve(""));
			setTimeout(() => {
				try {
					opencode.kill();
				} catch {}
				resolve("");
			}, 8000);
		});

		return c.json({ completion });
	} catch {
		return c.json({ completion: "" });
	}
});
