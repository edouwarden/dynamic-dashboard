# BRANCH Scripts(30) — Executor, Scheduler, Backend

```
Scripts(30) src/scripts/
├── ScriptExecutor(31) executor.ts 168l — Sandboxed execution (queryDB, log, fetch, sendWebhook, sendNotification, saveFile)
├── ScriptScheduler(32) scheduler.ts 145l — Cron scheduling
├── ScriptGlobalManager(33) global-manager.ts 146l — Global script management
└── ScriptBackup(34) script-backup.ts 125l — Script backups

Widgets(35) src/widgets/
├── WidgetManager(36) manager.ts 872l — Widget CRUD backend + fragtree auto-generation/refresh
│   ├── createWidget() — generates OPENCODE.md + fragtree.md automatically
│   ├── generateWidgetFragtree() — maps (node_id, name, lines, functions)
│   │   └── Format: widget_id(1) ├── file(2) — Nl ├── func(2.n) :line
│   ├── refreshWidgetFragtree() — regenerate after a code change (API: POST /widgets/:id/refresh-fragtree)
│   ├── updateAllFragtrees() — migration: update every widget
│   └── fileExists() — helper
└── WidgetBackup(37) backup.ts 338l — Widget backups

Tabs(38) src/tabs/
└── TabManager(39) manager.ts 689l — Tab CRUD backend

DashboardBackup(40) src/dashboard/
└── BackupManager(41) backup.ts 211l — Backup src/, restore, list

Presets(42) src/presets/
└── PresetManager(43) manager.ts 498l — Style preset management

MCP(44) src/mcp/
└── DashboardTools(45) dashboard-tools.ts 235l — Dashboard MCP tools

BackupGlobal(46) src/backup/
└── BackupGlobalManager(47) manager.ts 368l — Global backup manager
```
