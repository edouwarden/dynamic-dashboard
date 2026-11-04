/**
 * Build-time data export for the static demo.
 *
 * Reads the isolated demo database, the demo tabs and the widget manifests,
 * then writes a single JSON file that the browser demo seeds into IndexedDB.
 *
 * Run with: bun demo-static/tools/generate-data.mjs
 */

import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PresetManager } from '../../src/presets/manager.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const demoRoot = join(here, '..');

const dbPath = join(repoRoot, 'data', 'demo.db');
const tabsDir = join(repoRoot, 'data', 'demo-tabs');
const widgetsDir = join(repoRoot, 'data', 'widgets');

if (!existsSync(dbPath)) {
  console.error('Missing data/demo.db. Run `bun run seed --reset` first.');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const tableNames = db
  .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row) => row.name);

const tables = {};
for (const name of tableNames) {
  const columns = db.query(`PRAGMA table_info("${name}")`).all();
  const rows = db.query(`SELECT * FROM "${name}"`).all();
  tables[name] = { columns, rows };
}
db.close();

const tabs = readdirSync(tabsDir)
  .filter((entry) => existsSync(join(tabsDir, entry, 'tab.json')))
  .map((entry) => JSON.parse(readFileSync(join(tabsDir, entry, 'tab.json'), 'utf8')).tab)
  .sort((a, b) => a.order - b.order);

const widgets = readdirSync(widgetsDir)
  .filter((entry) => existsSync(join(widgetsDir, entry, 'manifest.json')))
  .map((entry) => JSON.parse(readFileSync(join(widgetsDir, entry, 'manifest.json'), 'utf8')).widget)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

const presets = new PresetManager()['getDefaultPresets']();

const seed = { tabs, widgets, presets, tables };
const payload = JSON.stringify(seed);
const version = new Bun.CryptoHasher('sha256').update(payload).digest('hex').slice(0, 12);

const output = { version: `static-demo-${version}`, ...seed };
mkdirSync(join(demoRoot, 'data'), { recursive: true });
writeFileSync(join(demoRoot, 'data', 'seed.json'), JSON.stringify(output));

console.log(
  `Wrote demo-static/data/seed.json: ${tabs.length} tabs, ${widgets.length} widgets, ` +
    `${Object.keys(tables).length} tables, version ${output.version}`,
);
