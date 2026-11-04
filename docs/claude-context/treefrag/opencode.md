# BRANCH OpenCode(21) — Sessions & OpenCode Integration

```
OpenCode(21) src/opencode/
├── BaseOpenCodeSessionManager(22) opencode-session-manager.ts 468l — Abstract: session CRUD, sendMessage SSE, usage tracker, getCwd() hook. Model selection through the OpenCode CLI
├── ServerPool(132) opencode-server-pool.ts 200l — Shared OpenCode server lifecycle and connection pooling
├── WidgetSessions(23) widget-sessions.ts 69l — Extends the base manager: system prompt, backups, proposals
├── ScriptSessions(24) script-sessions.ts 173l — Extends the base manager: system prompt, proposals, script-specific handling
├── DashboardSessions(25) dashboard-sessions.ts 141l — Extends the base manager: cwd='.', automatic bump, system prompt from the TREEFRAG root
├── WidgetSystemPrompt(26) widget-system-prompt.ts 94l — buildWidgetSystemPrompt(): assigned tables + schemas, curl tables (auto-rename), queryDB, CSS variables, config, **responsive rule**
├── OpenCodeStats(27) opencode-stats-pty.cjs 66l — PTY script that reads OpenCode usage stats (requests, cost)
└── OpenCodeStream(133) opencode-stream-pty.cjs 54l — PTY wrapper for `opencode run --format json`
```

**Inheritance**: `BaseOpenCodeSessionManager` ← `Widget` | `Script` | `Dashboard` session managers.

**Supported models**: `OpenCodeConfig.model` accepts `'opencode-go/minimax-m2.7'` (default) | `'minimax-m2.7'` | `'sonnet'` | `'haiku'` | `'opus'` | any string.

**Default agent**: `'safe'`.

**Major change**: the legacy `claude` CLI has been fully removed. The app only uses `opencode` (binary configurable via `OPENCODE_BIN`, default `opencode` on `PATH`). API routes live under `/api/*/opencode/*`.
