# BRANCH Frontend(50) — Dashboard UI & Managers

Root path: `src/public/static/js/`

```
Frontend(50)
├── AppEntry(51) app.js 50l — ES module entry, SW registration, Dashboard init
├── IndexHTML(52) index.html — HTML shell, cache-bust ?v=XX (src/public/)
├── TabPersistence(53) tab-persistence.js 168l — Tab state in localStorage
├── PWA(54)
│   ├── Manifest(55) manifest.json (src/public/)
│   └── ServiceWorker(56) sw.js (src/public/) — Network First, bypasses API/SSE
├── DashboardCore(57) dashboard/
│   ├── Core(58) core.js 307l — Dashboard class, constructor, init(), api(), OpenCodePanel init
│   ├── Tabs(59) tabs.js 1124l — loadTabs, renderGrid (responsive grid cols), grid editing, fullscreen, page navigation, drag-and-drop tab reorder
│   ├── TabsOps(60) tabs-ops.js 317l — createTab, editTabModal, variables CRUD, deleteTab, addPage
│   ├── DashboardOpenCodeUI(61) dashboard-opencode.js 121l — initDashboardOpenCodePanel, open/close, reload banner
│   ├── DatabaseAggregator(62) database.js 13l — Re-exports database/*
│   ├── UIAggregator(63) ui.js 13l — Re-exports ui/*
│   └── WidgetsAggregator(64) widgets.js 22l — Re-exports widgets/*
├── WidgetsFrontend(65) dashboard/widgets/
│   ├── WidgetCrudUI(66) crud.js 359l — Create/edit widget modal, preview, backups, widget ID
│   ├── WidgetPermissionsUI(67) permissions.js 704l — Permissions, table explorer, column builder
│   ├── WidgetStyleUI(68) style.js 241l — Style presets, config modal, live preview
│   ├── WidgetInstanceConfigUI(69) instance-config.js 190l — Per-instance configuration
│   ├── WidgetSettingsUI(70) settings.js 112l — Name, emoji and description settings, notifications, copy widget ID
│   ├── WidgetProposalsUI(71) proposals.js 79l — Approve/reject proposals
│   ├── WidgetQueueUI(72) queue.js 68l — Send/clear, refresh iframes, polling
│   ├── WidgetAttachmentsUI(73) attachments.js 32l — File uploads
│   └── WidgetOpenCodeSessionsUI(74) opencode-sessions.js 14l — Panel wrapper around init()
├── DatabaseFrontend(75) dashboard/database/
│   ├── DBTablesUI(76) tables.js 393l — DB modal, table list, permissions, proposals
│   ├── DBExplorerUI(77) explorer.js 435l — SQL explorer, pagination, row CRUD, schema
│   ├── DBCreateTableUI(78) create-table.js 128l — Column builder, create table
│   ├── DBPermissionsQuickUI(79) permissions-quick.js 63l — Quick selection
│   └── DBBackupsUI(80) backups.js 185l — Tab backups
├── UIFrontend(86) dashboard/ui/
│   ├── EventsUI(87) events.js 583l — bindEvents(): all listeners
│   ├── CategoriesUI(88) categories.js 362l — Widget category CRUD, drag-and-drop, trash
│   ├── EmojiUI(89) emoji.js 258l — Inline rename, emoji picker, fuzzy search
│   ├── ModalsDialogsUI(90) modals-dialogs.js 123l — openModal, closeModal, showAlert, showConfirm
│   └── ContextMenusUI(91) context-menus.js 93l — Tab/widget context menus
└── Managers(92) managers/
    ├── OpenCodePanelManager(93) opencode-panel.js 1385l — Unified OpenCodePanel: sessions, SSE, queue (persisted in the DB), rate-limit handling, model (haiku/sonnet/opus/custom), thinking + thinking-block rendering
    ├── WidgetManagerFE(94) widget-manager.js 259l — CRUD, gallery, backups
    ├── NotificationManagerFE(95) notification-manager.js 119l — Global/tab toasts
    ├── NotificationCenterFE(126) notification-center.js 195l — Central panel for persisted notifications, badge, mark read, clear
    ├── ScriptManagerFE(96) script-manager/
    │   ├── ScriptManagerCore(97) core.js 74l — GlobalScriptManager class
    │   ├── ScriptCatalogUI(98) catalog.js 86l — loadScripts, renderCatalog
    │   ├── ScriptEditorUI(99) editor.js 258l — Monaco editor, AI completions
    │   ├── ScriptActionsUI(100) actions.js 171l — save/run/create/delete, SSE
    │   ├── ScriptTriggersUI(101) triggers.js 189l — Cron builder
    │   ├── ScriptChatUI(102) chat.js 44l — Execution logs
    │   ├── ScriptAdminUI(103) admin.js 160l — Permissions, timeline, backups
    │   └── ScriptTimelineUI(104) timeline-scheduler.js 118l — 24h grid
    └── ScriptManagerAggregator(105) script-manager.js 13l — Re-exports
```

Note: the `dashboard/claude/` folder (former nodes 81-85) no longer exists. Tab-level OpenCode chat is handled directly by OpenCodePanelManager(93).
