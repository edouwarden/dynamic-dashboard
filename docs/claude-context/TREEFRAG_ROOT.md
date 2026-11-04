# TREEFRAG ROOT (LOD 1)

> Root skeleton — always load this first.
> For a branch's details, read `docs/claude-context/treefrag/<branch>.md`

```
Dashboard(1)
├── Server(2) — Hono REST API (widgets, scripts, tabs, DB, OpenCode, dashboard, demo)
├── OpenCode(21) — OpenCode session managers (base, widget, script, dashboard) + system prompts
├── Database(28) — SQLite manager + granular permissions (558l)
├── Scripts(30) — Sandboxed executor + cron scheduler + backups
├── Widgets(35) — Widget CRUD backend + backups (manager 872l, backup 338l)
├── Tabs(38) — Tab CRUD backend (manager 689l)
├── DashboardBackup(40) — Backup/restore of src/ (211l)
├── Presets(42) — Style preset manager (498l)
├── MCP(44) — Dashboard MCP tools (235l)
├── BackupGlobal(46) — Global backup manager (368l)
├── Config(48) — config.ts (env paths, demo flags, OpenCode binary/model)
├── Types(49) — types.ts 180l (TypeScript interfaces, borderStyle incl. dotted)
├── Frontend(50) — Dashboard UI: core, tabs, widgets, DB, OpenCode, UI, managers
├── CSS(106) — 11 modular CSS files (~8.8k lines total)
├── Data(118) — Runtime: widgets/, tabs/, data/dashboard.db, data/demo.db, data/demo-tabs/, emojis.json
└── DevScripts(124) — bump-version, generate-icons, generate-emojis, seed
```

## Available branches

| Branch | File | Load when |
|--------|------|-----------|
| Server(2) | `treefrag/server.md` | Backend API routes |
| OpenCode(21) | `treefrag/opencode.md` | OpenCode sessions, SSE, system prompts |
| Database(28) | `treefrag/database.md` | SQLite, permissions, tables |
| Scripts(30) | `treefrag/scripts.md` | Executor, scheduler, global scripts |
| Frontend(50) | `treefrag/frontend.md` | Dashboard UI, managers, widgets/DB/OpenCode frontend |
| CSS(106) | `treefrag/css.md` | Styles, variables, layout |
| Data(118) | `treefrag/data.md` | Runtime data, dev scripts |
