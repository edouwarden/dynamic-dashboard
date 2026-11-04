# BRANCH Server(2) — Hono API Routes

```
Server(2) src/server/
├── EntryPoint(3) index.ts 201l — Hono entry point (repo root): middleware, routes, static files, PWA
├── API(4) api.ts 785l — Routes: DB admin, tab CRUD (incl. PUT /tabs/order), presets, backups, OpenCode usage, config, variables, notification center, OpenCode queue CRUD, widget fragtree refresh
├── DemoAPI(5) demo-api.ts 541l — Isolated demo mode: seeded tabs/widgets, data/demo.db, mock AI SSE, reset/health
├── WidgetRoutes(6)
│   ├── WidgetIndex(7) widgets/index.ts 30l — Hono aggregator
│   ├── WidgetCRUD(8) widgets/crud.ts 91l — List, create, get, update, delete, permissions
│   ├── WidgetTables(9) widgets/tables.ts 194l — Create/alter tables, proposals, auto-approve, auto-rename on collision
│   ├── WidgetInstances(10) widgets/instances.ts 175l — Tab instances, queryDB, notifications, style, grid
│   ├── WidgetOpenCode(11) widgets/opencode.ts 217l — Chat SSE (streamSSE), upload, backups, sessions + fragtree auto-refresh on the done event
│   └── WidgetProposals(12) widgets/proposals.ts 47l — In-memory proposal store
├── ScriptRoutes(13)
│   ├── ScriptIndex(14) scripts/index.ts 26l — Hono aggregator
│   ├── ScriptCRUD(15) scripts/crud.ts 144l — Script CRUD, code, config, backups
│   ├── ScriptExecution(16) scripts/execution.ts 113l — Run SSE, logs, webhook, notifications, files
│   ├── ScriptTables(17) scripts/tables.ts 155l — queryDB, permissions, proposals, auto-rename on collision
│   └── ScriptOpenCode(18) scripts/opencode.ts 167l — Chat SSE (streamSSE), sessions, Monaco autocomplete
└── DashboardRoutes(19)
    └── DashboardOpenCode(20) dashboard/opencode.ts 203l — Dashboard chat SSE (streamSSE), sessions, backups, restore
```
