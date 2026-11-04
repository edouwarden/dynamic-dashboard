// Configuration globale

import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';

export const CONFIG = {
  WEB_PORT: parseInt(process.env.WEB_PORT || '3000'),
  HOST: process.env.HOST || 'localhost',

  DATA_DIR,
  DB_PATH: process.env.DB_PATH || join(DATA_DIR, 'dashboard.db'),
  DEMO_DB_PATH: process.env.DEMO_DB_PATH || join(DATA_DIR, 'demo.db'),

  TABS_DIR: process.env.TABS_DIR || './tabs',
  DEMO_TABS_DIR: process.env.DEMO_TABS_DIR || join(DATA_DIR, 'demo-tabs'),
  WIDGETS_DIR: process.env.WIDGETS_DIR || join(DATA_DIR, 'widgets'),
  SCRIPTS_DIR: process.env.SCRIPTS_DIR || join(DATA_DIR, 'scripts'),
  CONFIG_FILE: process.env.CONFIG_FILE || join(DATA_DIR, 'dashboard.json'),

  /** OpenCode CLI — must be on PATH or set OPENCODE_BIN explicitly. */
  OPENCODE_BIN: process.env.OPENCODE_BIN || 'opencode',
  OPENCODE_MODEL: process.env.OPENCODE_MODEL || 'opencode-go/minimax-m2.7',

  /** Password for the OpenCode dashboard panel (empty = no protection). */
  DASHBOARD_OPENCODE_PASSWORD: process.env.DASHBOARD_OPENCODE_PASSWORD || '',

  /** Demo mode: "mock" never spawns OpenCode or touches real data. */
  DEMO_AI_MODE: process.env.DEMO_AI_MODE || 'mock',
  /** Set DEMO_READ_ONLY=1 to disable writes in the public demo. */
  DEMO_READ_ONLY: process.env.DEMO_READ_ONLY === '1',
};
