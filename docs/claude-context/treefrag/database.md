# BRANCH Database(28) — SQLite & Permissions

```
Database(28) src/database/
└── DatabaseManager(29) manager.ts 558l — Query execution, permissions, table CRUD, row CRUD, notification_center, opencode_queue
    Key functions:
    - L71: executeQuery(tabId, permissions, query) — dispatch select/insert/update/delete
    - L236: createTable(tableName, schema) — from a schema object or SQL
    - L281: getTableSchema(tableName) — PRAGMA table_info
    - L302: getAllTables() — tables + rowCount + columns
    - L356: exploreTable(tableName, limit, offset)
    - L389: alterTable(tableName, alterations) — {add, drop}
    - L477: updateRow() / L498: deleteRow() / L515: queryRaw() / L538: insertRow() / L529: runRaw()

Tables:
    - script_logs, notification_center, opencode_queue
```

Permission system: `DbPermission { table, actions[], columns[], maxRows? }` in `manifest.json`.
