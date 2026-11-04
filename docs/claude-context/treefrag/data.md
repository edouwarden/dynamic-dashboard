# BRANCH Data(118) + DevScripts(124)

```
Data(118)
├── EmojisJSON(119) src/public/static/data/emojis.json — 1400+ auto-generated emojis, 9 categories
├── WidgetData(120) data/widgets/{id}/ — html, css, js, manifest.json, script.js
├── TabData(121) tabs/ — real dashboard tabs (generated)
├── DemoTabData(130) data/demo-tabs/demo-tab-{id}/ — isolated demo tabs (generated)
├── ScriptData(122) data/scripts/{id}/ — runtime scripts
├── SQLiteDB(123) data/dashboard.db — real dashboard SQLite (generated)
└── DemoSQLiteDB(131) data/demo.db — isolated demo SQLite (generated)

DevScripts(124) scripts/
├── BumpVersion(125) bump-version.ts — auto-increments ?v=XX in HTML and JS
├── GenerateIcons(126) generate-icons.ts — PWA icons 192+512
├── GenerateEmojis(128) generate-emojis.ts — generates emojis.json from emoji-datasource-google
└── Seed(127) seed.ts — seeds dashboard + demo (--reset to rebuild from scratch)
```
