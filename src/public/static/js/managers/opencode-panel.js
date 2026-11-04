/**
 * OpenCodePanel — module unifié pour l'interface OpenCode
 * Sessions, historique, SSE streaming, queue séquentielle globale, modèle, usage
 * Auto-contenu : génère son propre HTML dans un container fourni
 *
 * Usage :
 *   const panel = new OpenCodePanel('mountDivId', { apiBaseTemplate, placeholder, onDone, ... });
 *   await panel.init(entityId);   // à chaque ouverture d'un widget/script
 *   panel.send(optionalOverride); // depuis l'extérieur si besoin
 */

// =====================================================================
// QUEUE GLOBALE — partagée entre toutes les instances OpenCodePanel
// =====================================================================
const _globalQueue = {
	items: [], // { message, model, entityId, sessionId, apiBaseTemplate, panelRef }
	isProcessing: false,
	queuePaused: false,
	_rateLimitTimeout: null,
	_rateLimitInterval: null,
	_panels: new Set(), // instances OpenCodePanel enregistrées
	_restored: false,
	_dbIds: new Map(),

	register(panel) {
		this._panels.add(panel);
		// Trigger queue if there are unresolved items waiting for a panel
		if (!this.isProcessing && !this.queuePaused && this.items.some(it => !it.panelRef)) {
			this.isProcessing = true;
			this.processNext();
		}
	},

	async _saveToDb(item) {
		try {
			const res = await fetch('/api/opencode/queue', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entity_id: item.entityId,
					session_id: item.sessionId,
					message: item.message,
					model: item.model,
					api_base_template: item.apiBaseTemplate,
					entity_label: item.entityLabel,
					panel_type: item.panelType,
					session_name: item.sessionName
				})
			});
			if (!res.ok) return null;
			const { id } = await res.json();
			return id;
		} catch {
			return null;
		}
	},

	async _removeFromDb(item) {
		const id = this._dbIds.get(item);
		if (id == null) return;
		this._dbIds.delete(item);
		try {
			await fetch(`/api/opencode/queue/${id}`, { method: 'DELETE' });
		} catch {
			// silent fail on network errors
		}
	},

	notifyAll() {
		for (const p of this._panels) p.updateQueueUI();
	},

	async enqueueOrExecute(item) {
		if (this.isProcessing || this.queuePaused) {
			const id = await this._saveToDb(item);
			if (id != null) this._dbIds.set(item, id);
			this.items.push(item);
			this.notifyAll();
		} else {
			this.isProcessing = true;
			this.notifyAll();
			item.panelRef._executePrompt(item);
		}
	},

	processNext() {
		if (this.queuePaused || this.items.length === 0) {
			this.isProcessing = false;
			this.notifyAll();
			return;
		}
		const item = this.items[0];

		// Resolve panelRef if not yet set
		if (!item.panelRef) {
			const panel = [...this._panels].find(
				p => p.opts.apiBaseTemplate === item.apiBaseTemplate
			);
			if (panel) {
				item.panelRef = panel;
			}
		}

		if (!item.panelRef) {
			// Panel not mounted yet — park until a panel registers
			this.isProcessing = false;
			this.notifyAll();
			return;
		}

		this.items.shift(); // dequeue only after panelRef confirmed
		this.notifyAll();
		item.panelRef._executePrompt(item);
	},

	_clearTimers() {
		if (this._rateLimitTimeout) {
			clearTimeout(this._rateLimitTimeout);
			this._rateLimitTimeout = null;
		}
		if (this._rateLimitInterval) {
			clearInterval(this._rateLimitInterval);
			this._rateLimitInterval = null;
		}
		for (const p of this._panels) {
			p.el.messages?.querySelector("#opencodePanelRateLimitCountdown")?.remove();
		}
	},

	cancelRateLimitRetry() {
			localStorage.removeItem('opencodeRateLimitRetryAt');
		this._clearTimers();
		this.queuePaused = false;
		this.notifyAll();
	}
};

async function _restoreQueueFromDb() {
	if (_globalQueue._restored) return;
	_globalQueue._restored = true;

	try {
		const res = await fetch('/api/opencode/queue');
		if (!res.ok) return;
		const { items: rows } = await res.json();
		if (!rows?.length) return;

		for (const row of rows) {
			const item = {
				entityId: row.entity_id,
				sessionId: row.session_id,
				message: row.message,
				model: row.model,
				apiBaseTemplate: row.api_base_template,
				entityLabel: row.entity_label,
				panelType: row.panel_type,
				sessionName: row.session_name,
				panelRef: null
			};
			_globalQueue.items.push(item);
			_globalQueue._dbIds.set(item, row.id);
		}
	} catch {
		return;
	}

	// Restore rate limit timer if still active
	const retryAt = parseInt(localStorage.getItem('opencodeRateLimitRetryAt') || '0');
	if (retryAt && Date.now() < retryAt) {
		_globalQueue.queuePaused = true;
		_globalQueue._rateLimitTimeout = setTimeout(() => {
		localStorage.removeItem('opencodeRateLimitRetryAt');
			_globalQueue._rateLimitTimeout = null;
			_globalQueue.queuePaused = false;
			_globalQueue.processNext();
		}, retryAt - Date.now());
	}

	_globalQueue.notifyAll();
}

export class OpenCodePanel {
	/**
	 * @param {string} mountId   — ID du div container dans index.html
	 * @param {Object} opts
	 *   apiBaseTemplate   {string}   — ex: '/api/widgets/:id/opencode'
	 *   placeholder       {string}
	 *   emptyStateTitle   {string}
	 *   emptyStateDesc    {string}
	 *   suggestions       {Array}    — [{ label, prompt }]
	 *   onDone            {Function} — async (entityId) => void
	 *   onApproveProposal {Function} — async (proposalId, entityId, cardEl) => void
	 *   onRejectProposal  {Function} — async (proposalId, entityId, cardEl) => void
	 *   onUploadFiles     {Function} — async (files[]) => [{ name, path, type }]
	 */
	constructor(mountId, opts = {}) {
		this.mount = document.getElementById(mountId);
		if (!this.mount) return;

		this.opts = {
			apiBaseTemplate: opts.apiBaseTemplate || "",
			placeholder: opts.placeholder || "Envoyer un message...",
			emptyStateTitle: opts.emptyStateTitle || "Que veux-tu créer ?",
			emptyStateDesc: opts.emptyStateDesc || "Décris ce que tu veux et OpenCode s'en charge.",
			panelType: opts.panelType || "widget", // 'widget' | 'script' | 'dashboard'
			getEntityLabel: opts.getEntityLabel || null, // () => { emoji, name } — label pour la queue
			suggestions: opts.suggestions || [
				{ label: "📊 Graphique", prompt: "Crée un graphique interactif avec Chart.js qui affiche des données dynamiques" },
				{ label: "📋 Tableau", prompt: "Affiche les données de la base sous forme de tableau filtrable et triable" },
				{ label: "🎨 Design", prompt: "Améliore le design avec un style moderne et des animations CSS" },
				{ label: "✨ Animation", prompt: "Ajoute une animation CSS subtile et élégante" }
			],
			onDone: opts.onDone || null,
			onApproveProposal: opts.onApproveProposal || null,
			onRejectProposal: opts.onRejectProposal || null,
			onUploadFiles: opts.onUploadFiles || null
		};

		// État par instance
		this.entityId = null;
		this.sessions = [];
		this.activeSessionId = null;
		this._pendingFiles = [];
		this._abortController = null;
		this._isExecuting = false;
		this._executingEntityId = null; // entityId du prompt en cours d'exécution
		this._initGeneration = 0; // incrémenté à chaque init() pour détecter les changements d'entité

		// Refs DOM (remplis par _render)
		this.el = {};

		_globalQueue.register(this);
		_restoreQueueFromDb(); // fire-and-forget
		this._render();
		this._bindEvents();
	}

	get _apiBase() {
		return this.opts.apiBaseTemplate.replace(":id", this.entityId);
	}

	// =====================================================================
	// INIT — appelé à chaque ouverture d'un widget / script différent
	// =====================================================================

	async init(entityId) {
		this._initGeneration++;
		this.entityId = entityId;
		this._pendingFiles = [];
		this._renderFiles();
		this.updateQueueUI();
		// Bouton envoyer/stop selon si un prompt est en cours pour CETTE entité
		this._updateSendButtonState(this._isExecuting && this._executingEntityId === entityId ? "executing" : "idle");
		await Promise.all([this.loadSessions(), this.loadHistory()]);
	}

	// =====================================================================
	// RENDU HTML
	// =====================================================================

	_render() {
		const { placeholder, suggestions } = this.opts;

		const suggestionsHtml = suggestions.length
			? `<div class="opencode-input-actions" data-ref="suggestions">
          ${suggestions.map((s) => `<button class="input-action-chip" data-prompt="${this._esc(s.prompt)}">${s.label}</button>`).join("")}
        </div>`
			: "";

		this.mount.innerHTML = `
      <div class="opencode-header">
        <div class="opencode-header-top">
          <div class="opencode-header-left">
            <select data-ref="sessionSelect" class="opencode-select">
              <option value="">Session 1</option>
            </select>
            <button class="opencode-icon-btn" data-ref="newSessionBtn" title="Nouvelle session">+</button>
            <button class="opencode-icon-btn" data-ref="deleteSessionBtn" title="Supprimer la session" style="color:#ff6b6b;">×</button>
          </div>
          <div class="opencode-header-controls">
            <select data-ref="modelSelect" class="opencode-select opencode-select-model">
              <option value="opencode-go/minimax-m2.7" selected>Minimax</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
              <option value="opus">Opus</option>
              <option value="custom">Autre...</option>
            </select>
            <input data-ref="customModelInput" class="opencode-select opencode-custom-model" type="text" placeholder="opencode-go/minimax-m2.7" style="display:none;width:140px;">
          </div>
        </div>
        <div class="opencode-header-bottom">
          <div class="opencode-usage-chips">
            <div class="opencode-usage-chip chip-session" data-ref="chipSession" title="Usage session">
              <span data-ref="usageSessionPct">–</span>
            </div>
            <div class="opencode-usage-chip chip-week" data-ref="chipWeek" title="Usage semaine">
              <span data-ref="usageWeekPct">–</span>
            </div>
            <div class="opencode-usage-chip chip-reset" data-ref="chipReset" title="Reset">
              <span data-ref="usageReset">–</span>
            </div>
            <button class="opencode-usage-refresh" data-ref="usageRefreshBtn" title="Rafraîchir usage">↻</button>
          </div>
        </div>
      </div>

      <div class="chat-messages" data-ref="messages"></div>

      <div class="opencode-input-area">
        ${suggestionsHtml}
        <div class="prompt-queue-container" data-ref="queueContainer">
          <div class="queue-empty-state">Aucun prompt en attente</div>
        </div>
        <div class="opencode-attachments" data-ref="attachmentsContainer" style="display:none"></div>
        <div class="opencode-input-row">
          <input type="file" data-ref="fileInput" multiple
            accept="image/*,.pdf,.txt,.csv,.json,.js,.ts,.html,.css,.md,.xml,.yaml,.yml,.sql,.py"
            style="display:none">
          <button class="opencode-attach-btn" data-ref="attachBtn" title="Joindre un fichier">📎</button>
          <textarea data-ref="input" class="opencode-textarea"
            placeholder="${this._esc(placeholder)}" rows="2"></textarea>
          <div class="opencode-send-group">
            <button class="opencode-send-btn" data-ref="sendBtn" title="Envoyer (Entrée)" data-state="idle">➤</button>
            <span class="queue-badge" data-ref="queueBadge" style="display:none" title="Prompts en attente">0</span>
          </div>
        </div>
        <div class="opencode-input-meta">
          <span class="opencode-input-tip">↵ Envoyer · ⇧↵ Retour à la ligne</span>
          <button class="opencode-input-action" data-ref="clearQueueBtn"
            title="Vider la queue" style="display:none">🗑️ Queue</button>
          <button class="opencode-input-action" data-ref="clearHistoryBtn" title="Effacer l'historique">🗑️ Effacer</button>
        </div>
      </div>
    `;

		// Stocker les refs DOM
		this.mount.querySelectorAll("[data-ref]").forEach((el) => {
			this.el[el.dataset.ref] = el;
		});

		// Délégation : proposals dans les messages
		this.el.messages?.addEventListener("click", (e) => {
			const btn = e.target.closest("[data-panel-action]");
			if (!btn) return;
			const action = btn.dataset.panelAction;
			const id = btn.dataset.proposalId;
			if (action === "approve") this._approveProposal(id, btn);
			if (action === "reject") this._rejectProposal(id, btn);
		});

		// Délégation : chips de suggestions
		this.el.suggestions?.addEventListener("click", (e) => {
			const chip = e.target.closest(".input-action-chip");
			if (chip?.dataset.prompt && this.el.input) {
				this.el.input.value = chip.dataset.prompt;
				this.el.input.focus();
			}
		});
	}

	_bindEvents() {
		const el = this.el;
		if (!el.input) return;

		el.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (el.input.value.trim() || this._pendingFiles.length) this.send();
			}
			if (e.key === "Escape" && this._isExecuting) {
				e.preventDefault();
				this._abortExecution();
			}
		});

		el.sendBtn?.addEventListener("click", () => {
			if (this._isExecuting) {
				this._abortExecution();
			} else {
				this.send();
			}
		});
		el.newSessionBtn?.addEventListener("click", () => this.createSession());
		el.deleteSessionBtn?.addEventListener("click", () => this.deleteSession());
		el.clearHistoryBtn?.addEventListener("click", () => this.clearHistory());
		el.clearQueueBtn?.addEventListener("click", () => this.clearQueue());
		el.usageRefreshBtn?.addEventListener("click", () => this._pollUsage());

		el.sessionSelect?.addEventListener("change", (e) => {
			if (e.target.value) this.selectSession(e.target.value);
		});

		// Gestion modèle custom
		el.modelSelect?.addEventListener("change", (e) => {
			if (e.target.value === "custom") {
				el.customModelInput.style.display = "inline-block";
				el.customModelInput.focus();
			} else {
				el.customModelInput.style.display = "none";
			}
		});

		// Pièces jointes
		el.attachBtn?.addEventListener("click", () => el.fileInput?.click());

		el.fileInput?.addEventListener("change", (e) => {
			this._addFiles(e.target.files);
			e.target.value = "";
		});

		el.input.addEventListener("dragover", (e) => {
			e.preventDefault();
			el.input.classList.add("drag-over");
		});
		el.input.addEventListener("dragleave", () => el.input.classList.remove("drag-over"));
		el.input.addEventListener("drop", (e) => {
			e.preventDefault();
			el.input.classList.remove("drag-over");
			if (e.dataTransfer?.files?.length) this._addFiles(e.dataTransfer.files);
		});
		el.input.addEventListener("paste", (e) => {
			const items = e.clipboardData?.items;
			if (!items) return;
			const files = [];
			for (const item of items) {
				if (item.kind === "file") {
					const f = item.getAsFile();
					if (f) files.push(f);
				}
			}
			if (files.length) this._addFiles(files);
		});
	}

	// =====================================================================
	// USAGE — scrape via opencode /usage (PTY, bouton refresh uniquement)
	// =====================================================================

	async _pollUsage() {
		try {
			const res = 			await fetch("/api/opencode/opencode-usage");
			if (!res.ok) return;
			const data = await res.json();

			// Session usage
			if (this.el.usageSessionPct) {
				const sPct = data.sessionPct ?? 0;
				this.el.usageSessionPct.textContent = `S: ${sPct}%`;
				const chipS = this.el.chipSession;
				if (chipS) {
					chipS.className = `opencode-usage-chip chip-session${sPct >= 80 ? " quota-critical" : sPct >= 50 ? " quota-low" : ""}`;
					chipS.title = `Session : ${sPct}% utilisé`;
				}
			}

			// Week usage
			if (this.el.usageWeekPct) {
				const wPct = data.weekPct ?? 0;
				this.el.usageWeekPct.textContent = `W: ${wPct}%`;
				const chipW = this.el.chipWeek;
				if (chipW) {
					chipW.className = `opencode-usage-chip chip-week${wPct >= 80 ? " quota-critical" : wPct >= 50 ? " quota-low" : ""}`;
					chipW.title = `Semaine : ${wPct}% utilisé`;
				}
			}

			// Reset time
			if (this.el.usageReset) {
				const reset = data.sessionReset || data.weekReset || "?";
				this.el.usageReset.textContent = `↺ ${reset}`;
				if (this.el.chipReset) {
					this.el.chipReset.title = `Reset : ${reset} (UTC)`;
				}
			}
		} catch {
			/* silencieux */
		}
	}

	// =====================================================================
	// SESSIONS
	// =====================================================================

	async loadSessions() {
		if (!this.entityId) return;
		try {
			const res = await fetch(`${this._apiBase}/sessions`);
			const { sessions, activeSessionId } = await res.json();
			this.sessions = sessions || [];
			this.activeSessionId = activeSessionId || this.sessions[0]?.id || null;
			this._renderSessions();
		} catch {
			this.sessions = [];
		}
	}

	_renderSessions() {
		const sel = this.el.sessionSelect;
		if (!sel) return;
		sel.innerHTML =
			this.sessions.length === 0
				? '<option value="">Session 1</option>'
				: this.sessions
						.map((s) => {
							const date = new Date(s.updatedAt);
							const locale = localStorage.getItem("uiLang") === "en" ? "en-US" : "fr-FR";
							const dateStr = date.toLocaleDateString(locale, {
								day: "numeric",
								month: "short",
								hour: "2-digit",
								minute: "2-digit"
							});
							return `<option value="${s.id}" ${s.id === this.activeSessionId ? "selected" : ""}>${this._esc(s.name)} (${dateStr})</option>`;
						})
						.join("");
	}

	async selectSession(sessionId) {
		if (!this.entityId || !sessionId) return;
		try {
			await fetch(`${this._apiBase}/sessions/${sessionId}/active`, { method: "PUT" });
			this.activeSessionId = sessionId;
			await this.loadHistory();
		} catch (err) {
			console.error("[OpenCodePanel] Erreur sélection session:", err);
		}
	}

	async createSession() {
		const name = prompt("Nom de la nouvelle session :", `Session ${this.sessions.length + 1}`);
		if (!name) return;
		try {
			const res = await fetch(`${this._apiBase}/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name })
			});
			const session = await res.json();
			this.sessions.push(session);
			this.activeSessionId = session.id;
			await fetch(`${this._apiBase}/sessions/${session.id}/active`, { method: "PUT" });
			this._renderSessions();
			await this.loadHistory();
		} catch {
			console.error("[OpenCodePanel] Erreur création session");
		}
	}

	async deleteSession() {
		if (!this.entityId || !this.activeSessionId) return;
		const session = this.sessions.find(s => s.id === this.activeSessionId);
		if (!session) return;
		if (!confirm(`Supprimer la session "${session.name}" ?`)) return;
		try {
			await fetch(`${this._apiBase}/sessions/${this.activeSessionId}`, { method: "DELETE" });
			this.sessions = this.sessions.filter(s => s.id !== this.activeSessionId);
			this.activeSessionId = this.sessions[0]?.id || null;
			if (this.activeSessionId) {
				await fetch(`${this._apiBase}/sessions/${this.activeSessionId}/active`, { method: "PUT" });
			}
			this._renderSessions();
			await this.loadHistory();
		} catch {
			console.error("[OpenCodePanel] Erreur suppression session");
		}
	}

	// =====================================================================
	// HISTORIQUE
	// =====================================================================

	async loadHistory() {
		if (!this.entityId) return;
		const container = this.el.messages;
		if (!container) return;

		// Annuler un éventuel poll en cours
		if (this._pendingResponsePoll) {
			clearInterval(this._pendingResponsePoll);
			this._pendingResponsePoll = null;
		}

		try {
			const res = await fetch(`${this._apiBase}/history`);
			const history = await res.json();

			if (history.length === 0) {
				this._showEmptyState();
				return;
			}

			if (this.el.suggestions) this.el.suggestions.style.display = "none";
			container.innerHTML = "";
			for (const msg of history) {
				container.insertAdjacentHTML("beforeend", this._renderMessage(msg.role, msg.content || "", msg.timestamp));
				if (msg.actions?.length) {
					container.insertAdjacentHTML("beforeend", this._renderActions(msg.actions));
				}
			}
			container.scrollTop = container.scrollHeight;

			// Si le dernier message est de l'utilisateur (sans réponse), OpenCode est encore en train de répondre
			const lastMsg = history[history.length - 1];
			if (lastMsg?.role === "user") {
				this._showPendingResponseIndicator(container);
				this._startPendingResponsePoll();
			}
		} catch (err) {
			console.error("[OpenCodePanel] Erreur chargement historique:", err);
		}
	}

	_showPendingResponseIndicator(container) {
		const div = document.createElement("div");
		div.className = "chat-message assistant";
		div.id = "opencodePanelPendingResponse";
		div.innerHTML = `
      <div class="message-header">
        <div class="message-avatar assistant">🤖</div>
        <span>OpenCode</span>
        <span style="margin-left:auto;font-size:0.75rem;opacity:0.6">⏳ Réponse en cours...</span>
      </div>
      <div class="message-bubble message-bubble-loading">
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
      </div>
    `;
		container.appendChild(div);
		container.scrollTop = container.scrollHeight;
	}

	_startPendingResponsePoll() {
		// Capturer l'API base et la génération au moment du lancement du poll
		const pollApiBase = this._apiBase;
		const pollEntityId = this.entityId;
		const pollGeneration = this._initGeneration;
		let attempts = 0;
		const maxAttempts = 120; // 4 minutes max (2s * 120)
		this._pendingResponsePoll = setInterval(async () => {
			attempts++;
			if (attempts > maxAttempts) {
				clearInterval(this._pendingResponsePoll);
				this._pendingResponsePoll = null;
				// Remplacer l'indicateur seulement si on est encore sur la même entité
				if (this._initGeneration === pollGeneration) {
					const indicator = this.el.messages?.querySelector("#opencodePanelPendingResponse");
					if (indicator) {
						indicator.querySelector(".message-bubble").innerHTML = '<span style="color:var(--color-danger,#e74c3c)">⚠️ Délai dépassé — OpenCode n\'a pas répondu.</span>';
						indicator.querySelector(".message-bubble").classList.remove("message-bubble-loading");
					}
				}
				return;
			}
			try {
				// Toujours utiliser l'API base capturée (pas this._apiBase qui a pu changer)
				const res = await fetch(`${pollApiBase}/history`);
				const history = await res.json();
				const lastMsg = history[history.length - 1];
				if (lastMsg?.role === "assistant") {
					clearInterval(this._pendingResponsePoll);
					this._pendingResponsePoll = null;
					// Recharger l'historique seulement si on est encore sur la même entité
					if (this._initGeneration === pollGeneration) {
						await this.loadHistory();
					}
					if (this.opts.onDone) await this.opts.onDone(pollEntityId);
				}
			} catch {
				// Ignorer les erreurs de poll
			}
		}, 2000);
	}

	_showEmptyState() {
		const container = this.el.messages;
		if (!container) return;
		if (this.el.suggestions) this.el.suggestions.style.display = "flex";

		const { emptyStateTitle, emptyStateDesc } = this.opts;
		container.innerHTML = `
      <div class="chat-empty-state">
        <div class="empty-icon">🤖</div>
        <h3>${this._esc(emptyStateTitle)}</h3>
        <p>${this._esc(emptyStateDesc)}</p>
      </div>`;
	}

	async clearHistory() {
		if (!this.entityId) return;
		if (!confirm("Effacer l'historique de cette session ?")) return;
		try {
			await fetch(`${this._apiBase}/history`, { method: "DELETE" });
			await this.loadHistory();
		} catch (err) {
			console.error("[OpenCodePanel] Erreur effacement historique:", err);
		}
	}

	// =====================================================================
	// PIÈCES JOINTES
	// =====================================================================

	_addFiles(files) {
		if (!files?.length) return;
		for (const file of files) {
			this._pendingFiles.push({ file, name: file.name });
		}
		this._renderFiles();
	}

	_removeFile(index) {
		this._pendingFiles.splice(index, 1);
		this._renderFiles();
	}

	_renderFiles() {
		const container = this.el.attachmentsContainer;
		if (!container) return;
		if (!this._pendingFiles.length) {
			container.style.display = "none";
			container.innerHTML = "";
			return;
		}
		container.style.display = "flex";
		container.innerHTML = this._pendingFiles
			.map((att, i) => {
				const icon = att.file.type?.startsWith("image/") ? "🖼️" : "📄";
				return `<div class="opencode-attachment-chip">
        <span>${icon}</span>
        <span class="attachment-name">${this._esc(att.name)}</span>
        <span class="attachment-remove" data-file-idx="${i}" style="cursor:pointer">×</span>
      </div>`;
			})
			.join("");

		container.querySelectorAll("[data-file-idx]").forEach((btn) => {
			btn.addEventListener("click", () => this._removeFile(parseInt(btn.dataset.fileIdx)));
		});
	}

	async _uploadFiles() {
		if (!this._pendingFiles.length || !this.opts.onUploadFiles) return [];
		const files = this._pendingFiles.map((a) => a.file);
		this._pendingFiles = [];
		this._renderFiles();
		return await this.opts.onUploadFiles(files);
	}

	// =====================================================================
	// GESTION ÉTAT BOUTON D'ENVOI
	// =====================================================================

	_updateSendButtonState(state) {
		const btn = this.el.sendBtn;
		if (!btn) return;
		btn.dataset.state = state;
		if (state === "executing") {
			btn.textContent = "⏹️";
			btn.title = "Arrêter (Échap)";
		} else {
			btn.textContent = "➤";
			btn.title = "Envoyer (Entrée)";
		}
	}

	_abortExecution() {
		if (this._abortController) {
			this._abortController.abort();
			this._abortController = null;
		}
		this._isExecuting = false;
		this._updateSendButtonState("idle");
		this.el.input?.focus();
	}

	// =====================================================================
	// ENVOI / QUEUE GLOBALE
	// =====================================================================

	_buildQueueItem(message, model) {
		console.log('[OpenCodePanel] _buildQueueItem model:', model);
		const label = this.opts.getEntityLabel ? this.opts.getEntityLabel() : null;
		const session = this.sessions.find((s) => s.id === this.activeSessionId);
		return {
			entityId: this.entityId,
			sessionId: this.activeSessionId,
			message,
			model,
			apiBaseTemplate: this.opts.apiBaseTemplate,
			panelRef: this,
			// Contexte pour affichage queue
			entityLabel: label ? `${label.emoji || ""} ${label.name}`.trim() : this.entityId,
			panelType: this.opts.panelType,
			sessionName: session?.name || null
		};
	}

	async send(overrideMessage) {
		if (!this.entityId) return;
		let message = overrideMessage || this.el.input?.value?.trim();
		if (!message && !this._pendingFiles.length) return;

		if (!overrideMessage && this.el.input) this.el.input.value = "";

		if (this._pendingFiles.length && !overrideMessage) {
			const uploaded = await this._uploadFiles();
			if (uploaded.length) {
				const filesPart = uploaded.map((f) => `[Fichier joint : ${f.path}]`).join("\n");
				message = message ? `${message}\n\n${filesPart}` : filesPart;
			}
		}

		const model = this._getSelectedModel();
		const item = this._buildQueueItem(message, model);

		_globalQueue.enqueueOrExecute(item);
	}

	_getSelectedModel() {
		const selectValue = this.el.modelSelect?.value || "opencode-go/minimax-m2.7";
		console.log('[OpenCodePanel] modelSelect value:', selectValue);
		if (selectValue === "custom") {
			const customValue = this.el.customModelInput?.value?.trim();
			console.log('[OpenCodePanel] custom model input:', customValue);
			return customValue || "opencode-go/minimax-m2.7";
		}
		return selectValue;
	}

	async addToQueue(message, priority = false) {
		const model = this._getSelectedModel();
		const item = this._buildQueueItem(message, model);
		const id = await _globalQueue._saveToDb(item);
		if (id != null) _globalQueue._dbIds.set(item, id);
		if (priority) _globalQueue.items.unshift(item);
		else _globalQueue.items.push(item);
		_globalQueue.notifyAll();
	}

	removeFromQueue(index) {
		const item = _globalQueue.items[index];
		_globalQueue._removeFromDb(item); // fire-and-forget
		_globalQueue.items.splice(index, 1);
		_globalQueue.notifyAll();
	}

	editQueueItem(index) {
		const item = _globalQueue.items[index];
		const queueItem = this.el.queueContainer?.querySelectorAll(".queue-item")[index];
		if (!item || !queueItem) return;

		queueItem.innerHTML = `
      <textarea class="queue-edit-textarea" rows="3">${this._esc(item.message)}</textarea>
      <div class="queue-edit-actions">
        <button class="btn btn-sm btn-primary" data-save-idx="${index}">✓</button>
        <button class="btn btn-sm btn-secondary" data-cancel-queue>✕</button>
      </div>
    `;
		queueItem.querySelector(`[data-save-idx="${index}"]`)?.addEventListener("click", () => {
			const ta = queueItem.querySelector(".queue-edit-textarea");
			if (ta?.value.trim()) {
				const item = _globalQueue.items[index];
				item.message = ta.value.trim();
				const dbId = _globalQueue._dbIds.get(item);
				if (dbId != null) {
					fetch(`/api/opencode/queue/${dbId}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ message: item.message })
					});
				}
			}
			this.updateQueueUI();
		});
		queueItem.querySelector("[data-cancel-queue]")?.addEventListener("click", () => this.updateQueueUI());
		queueItem.querySelector(".queue-edit-textarea")?.focus();
	}

	clearQueue() {
		_globalQueue.items = [];
		_globalQueue._dbIds.clear();
		_globalQueue.queuePaused = false;
		_globalQueue.cancelRateLimitRetry();
		fetch('/api/opencode/queue', { method: 'DELETE' }); // fire-and-forget
		_globalQueue.notifyAll();
	}

	updateQueueUI() {
		const { queueBadge, queueContainer, clearQueueBtn } = this.el;
		const queue = _globalQueue.items;

		if (queueBadge) {
			queueBadge.textContent = queue.length;
			queueBadge.style.display = queue.length > 0 ? "flex" : "none";
		}
		if (clearQueueBtn) {
			clearQueueBtn.style.display = queue.length > 0 ? "inline-flex" : "none";
		}

		if (!queueContainer) return;

		if (queue.length === 0) {
			queueContainer.classList.add("queue-empty");
			queueContainer.innerHTML = '<div class="queue-empty-state">queue vide</div>';
			return;
		}
		queueContainer.classList.remove("queue-empty");

		const typeIcons = { widget: "🧩", script: "⚡", dashboard: "🏠" };
		queueContainer.innerHTML =
			`<div class="queue-header">📋 File d'attente (${queue.length}${_globalQueue.queuePaused ? " · ⏸ pause" : ""})</div>` +
			queue
				.map((it, i) => {
					const typeIcon = typeIcons[it.panelType] || "💬";
					const label = it.entityLabel || it.entityId || "?";
					const sessionTag = it.sessionName ? `<span class="queue-item-session" title="Session">${this._esc(it.sessionName)}</span>` : "";
					const contextHtml = `<div class="queue-item-context">${typeIcon} ${this._esc(label)}${sessionTag}</div>`;
					return `
          <div class="queue-item">
            <span class="queue-item-num">#${i + 1}</span>
            <div class="queue-item-body">
              ${contextHtml}
              <span class="queue-item-text">${this._esc(it.message.length > 80 ? it.message.slice(0, 80) + "…" : it.message)}</span>
            </div>
            <div class="queue-item-actions">
              <button class="queue-item-btn edit"   data-edit-idx="${i}"   title="Modifier">✏️</button>
              <button class="queue-item-btn remove" data-remove-idx="${i}" title="Supprimer">✕</button>
            </div>
          </div>
        `;
				})
				.join("");

		queueContainer.querySelectorAll("[data-edit-idx]").forEach((btn) => {
			btn.addEventListener("click", () => this.editQueueItem(parseInt(btn.dataset.editIdx)));
		});
		queueContainer.querySelectorAll("[data-remove-idx]").forEach((btn) => {
			btn.addEventListener("click", () => this.removeFromQueue(parseInt(btn.dataset.removeIdx)));
		});
	}

	cancelRateLimitRetry() {
		_globalQueue.cancelRateLimitRetry();
	}

	// =====================================================================
	// SSE STREAMING
	// =====================================================================

	async _executePrompt(item) {
		const { entityId, sessionId: itemSessionId, message, model, apiBaseTemplate } = item;
		const container = this.el.messages;
		if (!container) return;

		// Capturer la génération au début pour détecter si on change d'entité pendant le stream
		const startGeneration = this._initGeneration;
		const isStillActive = () => this._initGeneration === startGeneration;

		this._isExecuting = true;
		this._executingEntityId = entityId;
		this._abortController = new AbortController();
		if (isStillActive()) this._updateSendButtonState("executing");

		if (isStillActive()) {
			container.querySelector(".chat-empty-state")?.remove();
			if (this.el.suggestions) this.el.suggestions.style.display = "none";
		}

		// Message utilisateur
		const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
		const userMsgDiv = document.createElement("div");
		userMsgDiv.className = "chat-message user";
		userMsgDiv.innerHTML = `
      <div class="message-header">
        <div class="message-avatar user">👤</div>
        <span>Vous</span>
        <span style="margin-left:auto">${timeStr}</span>
      </div>
      <div class="message-bubble">${this._esc(message)}</div>
    `;
		if (isStillActive()) {
			container.appendChild(userMsgDiv);
			container.scrollTop = container.scrollHeight;
		}

		// Placeholder assistant avec loading
		const assistantDiv = document.createElement("div");
		assistantDiv.className = "chat-message assistant";
		assistantDiv.innerHTML = `
      <div class="message-header">
        <div class="message-avatar assistant">🤖</div>
        <span>OpenCode</span>
      </div>
      <div class="message-bubble message-bubble-loading">
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
      </div>
      <div class="message-tools" style="display:none"></div>
    `;
		if (isStillActive()) container.appendChild(assistantDiv);

		let currentMsgDiv = assistantDiv;
		let currentBubble = assistantDiv.querySelector(".message-bubble");
		let currentTools = assistantDiv.querySelector(".message-tools");
		let responseText = "";
		let hadContent = false;
		let hadToolsSinceLastText = false;
		let rateLimitResetTime = null;

		try {
			const requestBody = { message, model, sessionId: itemSessionId };
			console.log('[OpenCodePanel] Sending request with model:', model, 'body:', requestBody);
			const response = await fetch(`${apiBaseTemplate.replace(":id", entityId)}/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
				signal: this._abortController.signal
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.trim() || !line.startsWith("data: ")) continue;
					let event;
					try {
						event = JSON.parse(line.slice(6));
					} catch {
						continue;
					}

					if (event.type === "text") {
						// Accumuler le texte même si le panel a changé (pour la détection rate limit)
						if (hadToolsSinceLastText && hadContent) {
							responseText = event.data;
							hadToolsSinceLastText = false;
							if (isStillActive()) {
								const newMsgDiv = document.createElement("div");
								newMsgDiv.className = "chat-message assistant";
								newMsgDiv.innerHTML = `
                  <div class="message-header">
                    <div class="message-avatar assistant">🤖</div>
                    <span>OpenCode</span>
                  </div>
                  <div class="message-bubble">${this._esc(event.data)}</div>
                  <div class="message-tools" style="display:none"></div>
                `;
								container.appendChild(newMsgDiv);
								currentMsgDiv = newMsgDiv;
								currentBubble = newMsgDiv.querySelector(".message-bubble");
								currentTools = newMsgDiv.querySelector(".message-tools");
							}
						} else {
							if (!hadContent) hadContent = true;
							responseText += event.data;
							if (isStillActive()) {
								currentBubble.classList.remove("message-bubble-loading");
								currentBubble.textContent = responseText;
							}
						}
						if (isStillActive()) container.scrollTop = container.scrollHeight;

						// Détection rate limit
						if (!rateLimitResetTime) {
							const m = responseText.match(/resets?\s+(?:[A-Za-z]+\s+(\d{1,2}),?\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(UTC\)/i);
							if (m) {
								const dayOfMonth = m[1] ? parseInt(m[1]) : null;
								let hours = parseInt(m[2]);
								const mins = parseInt(m[3] || "0");
								const ampm = m[4].toLowerCase();
								if (ampm === "pm" && hours !== 12) hours += 12;
								if (ampm === "am" && hours === 12) hours = 0;
								const now = new Date();
								rateLimitResetTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth || now.getUTCDate(), hours, mins, 0));
								if (rateLimitResetTime.getTime() < now.getTime() && !dayOfMonth) {
									rateLimitResetTime.setUTCDate(rateLimitResetTime.getUTCDate() + 1);
								}
								if (isStillActive()) {
									currentBubble.innerHTML = `<span class="rate-limit-inline">⏳ Rate limit atteint — reprise automatique programmée</span>`;
								}
							}
						}
					} else if (event.type === "tool_use") {
						hadToolsSinceLastText = true;
						if (isStillActive()) {
							currentBubble.classList.remove("message-bubble-loading");
							if (!hadContent) currentBubble.innerHTML = "";
							if (currentTools) {
								currentTools.style.display = "flex";
								const toolItem = document.createElement("div");

								if (event.data.name === "AskUserQuestion" && event.data.input?.questions?.length) {
									toolItem.className = "tool-use-item tool-ask-user";
									const questions = event.data.input.questions;
									const questionsHtml = questions
										.map((q, qi) => {
											const hasChoices = Array.isArray(q.options) && q.options.length;
											const choicesHtml = hasChoices
												? q.options
														.map(
															(opt, oi) => `
                          <label class="ask-choice-label">
                            <input type="radio" name="ask-q${qi}" value="${this._esc(opt)}" />
                            <span>${this._esc(opt)}</span>
                          </label>`
														)
														.join("")
												: `<input type="text" class="ask-text-input" placeholder="Votre réponse..." data-qi="${qi}" />`;
											return `
                      <div class="ask-question-block">
                        <div class="ask-question-text">${this._esc(q.question)}</div>
                        <div class="ask-choices">${choicesHtml}</div>
                      </div>`;
										})
										.join("");
									toolItem.innerHTML = `
                    <div class="tool-use-name">❓ Question</div>
                    ${questionsHtml}
                    <button class="ask-submit-btn">Répondre ➤</button>
                  `;
									toolItem.querySelector(".ask-submit-btn").addEventListener("click", () => {
										const answers = questions
											.map((q, qi) => {
												const checked = toolItem.querySelector(`input[name="ask-q${qi}"]:checked`);
												if (checked) return `${q.question}: ${checked.value}`;
												const txt = toolItem.querySelector(`input.ask-text-input[data-qi="${qi}"]`);
												return txt ? `${q.question}: ${txt.value.trim()}` : "";
											})
											.filter(Boolean)
											.join("\n");
										if (!answers) return;
										toolItem.querySelector(".ask-submit-btn").disabled = true;
										toolItem.querySelector(".ask-submit-btn").textContent = "✓ Envoyé";
										toolItem.classList.add("ask-answered");
										this.send(answers);
									});
								} else {
									toolItem.className = "tool-use-item";
									toolItem.innerHTML = `
                    <div class="tool-use-name">🔧 ${this._esc(event.data.name)}</div>
                    ${event.data.input ? `<div class="tool-use-input">${this._esc(JSON.stringify(event.data.input, null, 2).substring(0, 100))}...</div>` : ""}
                  `;
								}

								currentTools.appendChild(toolItem);
								container.scrollTop = container.scrollHeight;
							}
						}
					} else if (event.type === "error") {
						throw new Error(event.data);
					} else if (event.type === "table_proposal") {
						if (isStillActive()) this._renderProposal(event.data, container);
					} else if (event.type === "done") {
						// Recharger sessions/usage seulement si on est encore sur la même entité
						if (isStillActive()) {
							await this.loadSessions();
							this._pollUsage();
						}
						// onDone toujours appelé avec l'entityId d'origine (refresh iframe, etc.)
						if (this.opts.onDone) await this.opts.onDone(entityId);
					}
				}
			}
		} catch (err) {
			// Gérer l'annulation sans afficher d'erreur — seulement si on est encore sur la même entité
			if (isStillActive()) {
				if (err.name === "AbortError") {
					if (currentBubble) {
						currentBubble.classList.remove("message-bubble-loading");
						currentBubble.innerHTML = '<span style="color:#ec9706">⏹️ Arrêté par l\'utilisateur</span>';
					}
				} else if (currentBubble) {
					currentBubble.classList.remove("message-bubble-loading");
					currentBubble.innerHTML = `<span style="color:#dc2626">❌ ${this._esc(err.message)}</span>`;
				}
			}
		} finally {
			// Remove from DB — covers success, error, abort
			await _globalQueue._removeFromDb(item);

			this._isExecuting = false;
			this._executingEntityId = null;
			this._abortController = null;
			if (isStillActive()) this._updateSendButtonState("idle");
			// Gestion rate limit avec reprise automatique
			if (rateLimitResetTime) {
				const retryAt = rateLimitResetTime.getTime() + 60000;
				localStorage.setItem('opencodeRateLimitRetryAt', String(retryAt));
				const delay = retryAt - Date.now();
				if (delay > 0) {
					_globalQueue.queuePaused = true;
					_globalQueue._clearTimers(); // nettoyer tout timer précédent

					if (!_globalQueue.items.some((q) => q.message === "continue")) {
						this.addToQueue("continue", true);
					}

					let countdownDiv = null;
					if (isStillActive()) {
						countdownDiv = document.createElement("div");
						countdownDiv.className = "chat-message system";
						countdownDiv.id = "opencodePanelRateLimitCountdown";
						const queueCount = _globalQueue.items.length;
						countdownDiv.innerHTML = `
              <div class="rate-limit-countdown">
                <span class="rate-limit-icon">⏳</span>
                <span class="rate-limit-text">Rate limit — reprise auto dans <strong class="countdown-timer"></strong>${queueCount > 1 ? ` <small>(+ ${queueCount - 1} en queue)</small>` : ""}</span>
                <button class="btn-cancel-retry" data-cancel-retry>✕ Annuler</button>
              </div>
            `;
						container.appendChild(countdownDiv);
						container.scrollTop = container.scrollHeight;

						countdownDiv.querySelector("[data-cancel-retry]")?.addEventListener("click", () => _globalQueue.cancelRateLimitRetry());

						const timerSpan = countdownDiv.querySelector(".countdown-timer");
						const updateCountdown = () => {
							const remaining = retryAt - Date.now();
							if (remaining <= 0) {
								timerSpan.textContent = "maintenant…";
								return;
							}
							const m = Math.floor(remaining / 60000);
							const s = Math.floor((remaining % 60000) / 1000);
							timerSpan.textContent = m > 0 ? `${m}m ${s}s` : `${s}s`;
						};
						updateCountdown();
						_globalQueue._rateLimitInterval = setInterval(updateCountdown, 1000);
					}

					_globalQueue._rateLimitTimeout = setTimeout(() => {
						if (_globalQueue._rateLimitInterval) {
							clearInterval(_globalQueue._rateLimitInterval);
							_globalQueue._rateLimitInterval = null;
						}
						_globalQueue._rateLimitTimeout = null;
						if (countdownDiv) countdownDiv.remove();
						_globalQueue.queuePaused = false;
						_globalQueue.processNext();
					}, delay);

					return; // Le timer gère la suite
				}
			}

			_globalQueue.processNext();
		}
	}

	// =====================================================================
	// PROPOSALS
	// =====================================================================

	_renderProposal(proposal, container) {
		const schemaHtml =
			proposal.type === "create" && proposal.schema
				? Array.isArray(proposal.schema)
					? proposal.schema.map((c) => `<span class="wt-col-tag${c.primaryKey ? " pk" : ""}">${this._esc(c.name)} <small>${c.type || "TEXT"}</small></span>`).join("")
					: `<code>${this._esc(String(proposal.schema))}</code>`
				: "";

		const alterHtml = proposal.type === "alter" && proposal.alterations?.addColumns ? proposal.alterations.addColumns.map((c) => `<span class="wt-col-tag">${this._esc(c.name)} <small>${c.type || "TEXT"}</small></span>`).join("") : "";

		const div = document.createElement("div");
		div.className = "chat-message proposal";
		div.innerHTML = `
      <div class="proposal-card-inline">
        <div class="proposal-card-header">
          <span class="proposal-icon">${proposal.type === "create" ? "🆕" : "✏️"}</span>
          <div>
            <strong>${proposal.type === "create" ? "Créer la table" : "Modifier la table"} <code>${this._esc(proposal.name)}</code></strong>
            <p>OpenCode souhaite ${proposal.type === "create" ? "créer cette table" : "modifier cette table"}.</p>
          </div>
        </div>
        ${schemaHtml || alterHtml ? `<div class="proposal-schema-preview">${schemaHtml || alterHtml}</div>` : ""}
        <div class="proposal-actions-inline">
          <button class="btn btn-sm btn-success" data-panel-action="approve" data-proposal-id="${proposal.id}">✓ Accepter</button>
          <button class="btn btn-sm btn-danger"  data-panel-action="reject"  data-proposal-id="${proposal.id}">✕ Refuser</button>
        </div>
      </div>
    `;
		container.appendChild(div);
		container.scrollTop = container.scrollHeight;
	}

	async _approveProposal(proposalId, btn) {
		const card = btn.closest(".proposal-card-inline");
		if (card) card.innerHTML = '<div class="proposal-status pending">⏳ Création en cours...</div>';
		try {
			if (this.opts.onApproveProposal) {
				await this.opts.onApproveProposal(proposalId, this.entityId, card);
			}
		} catch (err) {
			if (card) card.innerHTML = `<div class="proposal-status rejected">❌ Erreur : ${this._esc(err.message)}</div>`;
		}
	}

	async _rejectProposal(proposalId, btn) {
		const card = btn.closest(".proposal-card-inline");
		try {
			if (this.opts.onRejectProposal) {
				await this.opts.onRejectProposal(proposalId, this.entityId, card);
			}
			if (card) card.innerHTML = '<div class="proposal-status rejected">🚫 Proposition refusée</div>';
		} catch (err) {
			console.error("[OpenCodePanel] Erreur rejet proposition:", err);
		}
	}

	// =====================================================================
	// RENDU DES MESSAGES (historique)
	// =====================================================================

	_renderMessage(role, content, timestamp) {
		const isUser = role === "user";
		const date = timestamp ? new Date(timestamp) : new Date();
		const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
		return `
      <div class="chat-message ${isUser ? "user" : "assistant"}">
        <div class="message-header">
          <div class="message-avatar ${isUser ? "user" : "assistant"}">${isUser ? "👤" : "🤖"}</div>
          <span>${isUser ? "Vous" : "OpenCode"}</span>
          <span style="margin-left:auto">${timeStr}</span>
        </div>
        <div class="message-bubble">${this._formatContent(content)}</div>
      </div>
    `;
	}

	_renderActions(actions) {
		if (!actions?.length) return "";
		return `
      <div class="message-tools" style="display:flex;flex-direction:column;gap:4px;margin:4px 0 8px 0">
        ${actions
		.map(
			(a) => `
          <div class="tool-use-item">
            <div class="tool-use-name">🔧 ${this._esc(a.name)}</div>
            ${a.input ? `<div class="tool-use-input">${this._esc(JSON.stringify(a.input, null, 2).substring(0, 100))}...</div>` : ""}
          </div>
        `
		)
		.join("")}
      </div>
    `;
	}

	_formatContent(content) {
		const html = content
			.replace(
				/```file:([^\n]+)\n([\s\S]*?)```/g,
				(_m, filename, code) =>
					`<div class="chat-file-edit">
          <div class="chat-file-edit-header">📝 ${this._esc(filename)}</div>
          <pre><code>${this._esc(code)}</code></pre>
        </div>`
			)
			.replace(/```([^\n]*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
			.replace(/\n\n/g, "</p><p>")
			.replace(/\n/g, "<br>");
		return `<p>${html}</p>`;
	}

	_esc(str) {
		if (str === null || str === undefined) return "";
		return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}
}
