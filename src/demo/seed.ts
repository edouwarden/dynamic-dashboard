/**
 * Deterministic demo data + dashboard layouts.
 *
 * Everything here is fictional. The demo database is disposable and can be
 * regenerated with `bun run seed` or `POST /api/demo/reset`.
 */

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { mkdir, readdir, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { Tab, TabConfig, WidgetInstance } from '../types';

export const WIDGETS = {
  financeTerminal: 'widget-finance-terminal',
  focusTimer: 'widget-focus-timer',
  habitStreak: 'widget-habit-streak',
  systemStatus: 'widget-system-status',
  aiAssistant: 'widget-ai-assistant',
  flashcards: 'widget-0ed92de3-1b6d-4b6d-980a-5d0cfc689e69',
  tracking: 'widget-115205e4-5782-4bef-b135-a688ee178b25',
  calendar: 'widget-1199fbe6-a8f2-4ff6-8366-189fb41d6d12',
  marketHours: 'widget-1422e28c-14ed-4e29-bf00-6bb2593b7ea4',
  blackswan: 'widget-19575800-9095-431e-b2e2-09a70bd0d5c3',
  worldTrend: 'widget-20274a60-3610-457a-adcd-a73233542b60',
  dailyWord: 'widget-2772fa56-37bd-43fd-ac13-74da78650e42',
  morningDew: 'widget-40bba877-adb0-4c97-af33-a70a37b5de68',
  chart: 'widget-59b700a8-8a6d-4d36-bd62-8f5413544a93',
  routine: 'widget-608ac591-55d2-4aa4-9196-f4c9e432368c',
  sentiment: 'widget-74dcd243-46ec-42ab-88db-fecfef137eb2',
  todo: 'widget-9218f66b-dcd2-4993-8c33-9a1ab8279071',
  notes: 'widget-96f7929c-852d-41fd-bd2d-5c47f2b2e384',
  worldHeatmap: 'widget-fc2dd47d-a622-47ce-8f78-df1b7af50226',
  scriptTrigger: 'widget-script-trigger',
  budgetPlanner: 'widget-budget-planner',
  netWorth: 'widget-net-worth',
  savingsGoals: 'widget-savings-goals',
  subscriptions: 'widget-subscriptions',
  assignments: 'widget-assignments',
  gradeTracker: 'widget-grade-tracker',
  classTimetable: 'widget-class-timetable',
  countdown: 'widget-countdown',
} as const;

const DAY = 86_400_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

function tableStatements(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_center (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, message TEXT NOT NULL,
      type TEXT DEFAULT 'info', icon TEXT, source TEXT DEFAULT 'system',
      source_id TEXT, source_name TEXT, read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, unit TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6', icon TEXT DEFAULT '📊', target REAL,
      order_index INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS metric_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, metric_id INTEGER NOT NULL,
      date TEXT NOT NULL, value REAL NOT NULL, notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS morning_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      icon TEXT DEFAULT '✅', order_index INTEGER DEFAULT 0,
      last_done_date TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS evening_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      icon TEXT DEFAULT '🌙', order_index INTEGER DEFAULT 0,
      last_done_date TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY, front TEXT NOT NULL, back TEXT NOT NULL, tags TEXT,
      createdAt INTEGER NOT NULL, nextReviewAt INTEGER, lastReviewAt INTEGER,
      lastInterval INTEGER, reviewCount INTEGER NOT NULL,
      personalConsolidationSpeed REAL, priorityBoost INTEGER, status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS flashcard_reviews (
      id TEXT PRIMARY KEY, cardId TEXT NOT NULL, timestamp INTEGER NOT NULL,
      responseTimeMs INTEGER NOT NULL, confidence INTEGER NOT NULL,
      lastInterval INTEGER
    );
    CREATE TABLE IF NOT EXISTS learner_profile (
      id TEXT PRIMARY KEY, consolidationSpeedMs REAL NOT NULL,
      totalReviews INTEGER NOT NULL, lastSessionAt INTEGER,
      currentStreak INTEGER NOT NULL, streakStartAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS life_eras (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
      start_date TEXT NOT NULL, end_date TEXT, color TEXT DEFAULT '#6366f1',
      image_url TEXT, is_current INTEGER DEFAULT 0, order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, start_month INTEGER, end_month INTEGER
    );
    CREATE TABLE IF NOT EXISTS life_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      date TEXT NOT NULL, type TEXT DEFAULT 'achievement', icon TEXT DEFAULT '🏆',
      color TEXT DEFAULT '#f59e0b', era_id INTEGER, achieved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_era_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT, era_id INTEGER NOT NULL, url TEXT NOT NULL,
      caption TEXT, order_index INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      target_date TEXT, start_date TEXT, parent_id INTEGER, level TEXT DEFAULT 'decade',
      status TEXT DEFAULT 'pending', progress INTEGER DEFAULT 0, priority INTEGER DEFAULT 0,
      color TEXT DEFAULT '#3b82f6', era_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_sidequests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active',
      color TEXT DEFAULT '#8b5cf6', icon TEXT DEFAULT '⚔️',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      date TEXT NOT NULL, time_start TEXT, time_end TEXT, type TEXT DEFAULT 'rdv',
      recurrence TEXT, color TEXT DEFAULT '#ec4899', icon TEXT DEFAULT '📅',
      reminder_minutes INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_chores (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      recurrence TEXT DEFAULT 'weekly', interval_days INTEGER DEFAULT 7,
      duration_minutes INTEGER DEFAULT 30, last_done TEXT, next_due TEXT,
      priority INTEGER DEFAULT 0, color TEXT DEFAULT '#14b8a6',
      icon TEXT DEFAULT '🧹', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
      color TEXT DEFAULT '#f97316', is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_routine_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER NOT NULL, title TEXT NOT NULL,
      start_minutes INTEGER NOT NULL, end_minutes INTEGER NOT NULL,
      color TEXT DEFAULT '#6366f1', icon TEXT, category TEXT DEFAULT 'other',
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS life_routine_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT, weekdays TEXT DEFAULT '1,2,3,4,5,6,7',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS life_time_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, block_type TEXT DEFAULT 'task',
      reference_id INTEGER, reference_type TEXT, color TEXT DEFAULT '#3b82f6',
      completed INTEGER DEFAULT 0, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      probability REAL DEFAULT 5, impact TEXT DEFAULT 'extreme',
      category TEXT DEFAULT 'systemic', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS trend_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      importance INTEGER NOT NULL DEFAULT 5, category TEXT, status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finance_watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      price REAL NOT NULL, change REAL NOT NULL, change_pct REAL NOT NULL,
      spark TEXT, volume TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS finance_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, name TEXT NOT NULL,
      quantity REAL NOT NULL, avg_price REAL NOT NULL, price REAL NOT NULL,
      value REAL NOT NULL, pnl REAL NOT NULL, pnl_pct REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_news (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, source TEXT NOT NULL,
      tag TEXT, sentiment TEXT DEFAULT 'neutral', published_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, condition TEXT NOT NULL,
      target REAL NOT NULL, status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS habit_streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT,
      color TEXT, streak INTEGER DEFAULT 0, best_streak INTEGER DEFAULT 0,
      week_mask TEXT DEFAULT '0000000', last_done TEXT
    );
    CREATE TABLE IF NOT EXISTS system_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT NOT NULL,
      latency_ms INTEGER DEFAULT 0, uptime_pct REAL DEFAULT 100, note TEXT
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '💳',
      budget REAL NOT NULL, spent REAL NOT NULL, color TEXT DEFAULT '#34d399',
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS net_worth_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '💵',
      kind TEXT NOT NULL DEFAULT 'asset', value REAL NOT NULL, color TEXT DEFAULT '#34d399',
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '🎯',
      target REAL NOT NULL, saved REAL NOT NULL, color TEXT DEFAULT '#fbbf24',
      deadline TEXT, order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '🔁',
      amount REAL NOT NULL, cycle TEXT DEFAULT 'monthly', next_charge TEXT,
      category TEXT, color TEXT DEFAULT '#22d3ee', active INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS school_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, course TEXT NOT NULL,
      due_date TEXT NOT NULL, status TEXT DEFAULT 'not_started',
      priority TEXT DEFAULT 'medium', progress INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS school_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course TEXT NOT NULL, assessment TEXT NOT NULL,
      grade REAL NOT NULL, weight REAL DEFAULT 1, credits REAL DEFAULT 3,
      color TEXT DEFAULT '#c084fc'
    );
    CREATE TABLE IF NOT EXISTS school_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course TEXT NOT NULL, day INTEGER NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, room TEXT, teacher TEXT,
      color TEXT DEFAULT '#c084fc'
    );
    CREATE TABLE IF NOT EXISTS countdown_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL,
      icon TEXT DEFAULT '⏳', color TEXT DEFAULT '#c084fc'
    );
  `);
}

function clearSeedTables(db: Database) {
  const tables = [
    'metrics', 'metric_entries', 'morning_tasks', 'evening_tasks',
    'flashcards', 'flashcard_reviews', 'learner_profile', 'life_eras',
    'life_milestones', 'life_era_images', 'life_objectives',
    'life_sidequests', 'life_events', 'life_chores',
    'life_routines', 'life_routine_blocks',
    'life_routine_assignments', 'life_time_blocks',
    'risk_events', 'trend_items', 'finance_watchlist',
    'finance_positions', 'finance_news', 'finance_alerts', 'habit_streaks',
    'system_services', 'notification_center', 'budget_categories', 'net_worth_items',
    'savings_goals', 'subscriptions', 'school_assignments', 'school_grades',
    'school_classes', 'countdown_events',
  ];
  for (const t of tables) {
    db.exec(`DELETE FROM ${t}`);
    // Keep generated ids stable across reseeds so cross-table references stay valid.
    db.exec(`DELETE FROM sqlite_sequence WHERE name = '${t}'`);
  }
}

function seedRows(db: Database) {
  const today = iso(new Date());

  db.prepare(`INSERT INTO metrics (name, unit, color, icon, target, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .run('Deep work', 'h', '#6366f1', '🎯', 5, 0);
  db.prepare(`INSERT INTO metrics (name, unit, color, icon, target, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .run('Sleep', 'h', '#0ea5e9', '🌙', 8, 1);
  db.prepare(`INSERT INTO metrics (name, unit, color, icon, target, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .run('Training', 'min', '#22c55e', '🏋️', 45, 2);
  db.prepare(`INSERT INTO metrics (name, unit, color, icon, target, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .run('Reading', 'pages', '#f59e0b', '📚', 20, 3);

  const metricIds = (db.query('SELECT id FROM metrics ORDER BY order_index ASC').all() as Array<{ id: number }>)
    .map((row) => row.id);

  const stat = db.prepare(`INSERT INTO metric_entries (metric_id, date, value, notes) VALUES (?, ?, ?, ?)`);
  const values = [
    [3, 4, 2, 5, 3, 4, 7],
    [7.1, 7.8, 8.2, 6.9, 7.6, 8.1, 7.4],
    [35, 50, 20, 45, 0, 60, 25],
    [12, 24, 18, 30, 22, 15, 26],
  ];
  for (let m = 0; m < metricIds.length; m++) {
    for (let d = 6; d >= 0; d--) {
      stat.run(metricIds[m], iso(daysAgo(d)), values[m][6 - d], d === 0 ? 'Today' : null);
    }
  }

  const task = db.prepare(`INSERT INTO morning_tasks (title, icon, order_index, last_done_date) VALUES (?, ?, ?, ?)`);
  const morning = [
    ['Wake up without snooze', '⏰', today],
    ['Hydrate + sunlight', '💧', today],
    ['Movement / mobility', '🏃', today],
    ['Deep work block', '🎯', today],
    ['Inbox to zero', '📬', ''],
    ['Plan tomorrow', '🗒️', ''],
  ];
  morning.forEach((t, i) => task.run(t[0], t[1], i, t[2]));

  const evening = db.prepare(`INSERT INTO evening_tasks (title, icon, order_index, last_done_date) VALUES (?, ?, ?, ?)`);
  const night = [
    ['Shutdown ritual', '🖥️', today],
    ['Read 20 pages', '📚', ''],
    ['Prep tomorrow', '📋', ''],
    ['No screens', '📵', ''],
    ['Stretch', '🧘', ''],
    ['Sleep before 23:00', '🌙', ''],
  ];
  night.forEach((t, i) => evening.run(t[0], t[1], i, t[2]));

  const card = db.prepare(`INSERT INTO flashcards (id, front, back, tags, createdAt, nextReviewAt, lastReviewAt, lastInterval, reviewCount, personalConsolidationSpeed, priorityBoost, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const cards: Array<[string, string, string, string]> = [
    ['c1', 'What is the CAP theorem?', 'Consistency, Availability, Partition tolerance — pick two.', '["distributed","systems"]'],
    ['c2', 'SQLite WAL mode?', 'Write-ahead logging: better concurrency for readers and writers.', '["sqlite","storage"]'],
    ['c3', 'What is a credit spread?', 'Yield difference between corporate and risk-free debt.', '["finance","credit"]'],
    ['c4', 'SSE vs WebSocket?', 'SSE is one-way server→client over HTTP; WebSocket is bidirectional.', '["web","realtime"]'],
    ['c5', 'Define convexity.', 'Second-order sensitivity of bond price to yield changes.', '["finance","rates"]'],
  ];
  cards.forEach((c, i) => card.run(c[0], c[1], c[2], c[3], Date.now() - (i + 2) * DAY, Date.now() - i * 3600_000, Date.now() - DAY, 1, i + 1, 15000, 0, 'active'));
  db.prepare(`INSERT INTO learner_profile (id, consolidationSpeedMs, totalReviews, lastSessionAt, currentStreak, streakStartAt) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('default_user', 15000, 128, Date.now() - DAY, 12, Date.now() - 12 * DAY);

  db.prepare(`INSERT INTO life_eras (name, description, start_date, end_date, color, is_current, order_index, start_month, end_month) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Foundations', 'Learning the craft, shipping small things.', '2018-01-01', '2021-12-31', '#6366f1', 0, 0, 1, 12);
  db.prepare(`INSERT INTO life_eras (name, description, start_date, end_date, color, is_current, order_index, start_month, end_month) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Deep Work', 'Systems, finance and focused execution.', '2022-01-01', '2024-12-31', '#14b8a6', 0, 1, 1, 12);
  db.prepare(`INSERT INTO life_eras (name, description, start_date, end_date, color, is_current, order_index, start_month, end_month) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Build Mode', 'Products, open source and compounding.', '2025-01-01', '2028-12-31', '#f59e0b', 1, 2, 1, 12);

  const ms = db.prepare(`INSERT INTO life_milestones (title, description, date, type, icon, color, era_id, achieved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  ms.run('First production app', 'Shipped to real users.', '2019-06-15', 'achievement', '🚀', '#6366f1', 1, 1);
  ms.run('Open source release', 'First public repository with contributors.', '2023-03-10', 'achievement', '🌍', '#14b8a6', 2, 1);
  ms.run('1,000 commits', 'A year of consistent building.', '2025-11-20', 'achievement', '💻', '#f59e0b', 3, 1);
  ms.run('Launch portfolio dashboard', 'This project goes public.', iso(new Date()), 'launch', '⚡', '#f59e0b', 3, 0);

  db.prepare(`INSERT INTO life_objectives (title, description, target_date, start_date, level, status, progress, priority, color, era_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Ship one useful tool per quarter', 'Small, complete, documented.', '2027-12-31', '2026-01-01', 'year', 'in_progress', 42, 1, '#3b82f6', 3);
  db.prepare(`INSERT INTO life_sidequests (title, description, start_date, status, color, icon) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('Write a short paper on context-efficient agents', 'A small experiment in low-token code navigation.', '2026-01-10', 'active', '#8b5cf6', '📝');
  db.prepare(`INSERT INTO life_events (title, description, date, time_start, time_end, type, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Weekly review', 'Metrics, habits, next week.', iso(daysAgo(-2)), '09:00', '09:45', 'routine', '#ec4899', '📅');
  db.prepare(`INSERT INTO life_chores (title, description, recurrence, last_done, next_due, priority, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Backup notes', 'Export a local copy.', 'weekly', iso(daysAgo(3)), iso(daysAgo(-4)), 1, '#14b8a6', '🧹');
  db.prepare(`INSERT INTO life_routines (name, description, color, is_default) VALUES (?, ?, ?, ?)`)
    .run('Weekday', 'Default weekday rhythm.', '#f97316', 1);
  db.prepare(`INSERT INTO life_routine_blocks (routine_id, title, start_minutes, end_minutes, color, icon, category, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(1, 'Deep work', 540, 720, '#6366f1', '🎯', 'work', 0);
  db.prepare(`INSERT INTO life_routine_assignments (routine_id, start_date, weekdays) VALUES (?, ?, ?)`)
    .run(1, '2026-01-01', '1,2,3,4,5');
  db.prepare(`INSERT INTO life_time_blocks (title, date, start_time, end_time, block_type, color, completed) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('Deep work', today, '09:00', '12:00', 'task', '#6366f1', 0);

  const ev = db.prepare(`INSERT INTO risk_events (title, description, probability, impact, category) VALUES (?, ?, ?, ?, ?)`);
  ev.run('Cloud provider outage', 'A major region goes down during market hours.', 12, 'high', 'cyber');
  ev.run('Credit liquidity shock', 'Spreads gap wider; refinancing window closes.', 9, 'extreme', 'credit');
  ev.run('Energy price spike', 'Supply disruption pushes input costs higher.', 15, 'high', 'energie');
  ev.run('AI capex correction', 'Hyperscaler spending resets sharply.', 22, 'high', 'marche');
  ev.run('Market infrastructure cyberattack', 'Clearing or settlement is impaired.', 6, 'extreme', 'cyber');

  const trend = db.prepare(`INSERT INTO trend_items (title, description, importance, category, status) VALUES (?, ?, ?, ?, 'active')`);
  trend.run('AI inference costs keep falling', 'Smaller models and better serving stacks compress unit economics.', 9, 'Technology');
  trend.run('Data-centre energy demand', 'Power availability is becoming the binding constraint.', 8, 'Energy');
  trend.run('Stablecoin payment rails', 'On-chain settlement moves into mainstream treasury flows.', 7, 'Finance');
  trend.run('Global liquidity cycle', 'Rate cuts and balance-sheet policy diverge by region.', 8, 'Macro');
  trend.run('Semiconductor supply diversification', 'New fabs reduce single-region concentration.', 6, 'Industry');

  const watch = db.prepare(`INSERT INTO finance_watchlist (symbol, name, price, change, change_pct, spark, volume) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  watch.run('SPY', 'S&P 500 ETF', 612.40, 3.18, 0.52, '598,601,599,604,603,608,610,607,609,612', '48.2M');
  watch.run('QQQ', 'Nasdaq 100 ETF', 548.12, 4.02, 0.74, '532,536,534,539,541,540,544,543,546,548', '31.7M');
  watch.run('NVDA', 'NVIDIA', 178.30, 3.94, 2.26, '164,168,166,170,171,169,173,175,174,178', '212M');
  watch.run('AAPL', 'Apple', 246.80, -1.12, -0.45, '251,249,250,248,247,249,248,247,248,247', '52.1M');
  watch.run('MSFT', 'Microsoft', 512.10, 2.45, 0.48, '504,506,505,508,507,510,509,511,510,512', '19.8M');
  watch.run('BTC-USD', 'Bitcoin', 96420, 1180, 1.24, '92100,93400,92800,94100,95000,94600,95800,95200,96100,96420', '38.4B');
  watch.run('EURUSD', 'Euro / US Dollar', 1.0872, 0.0014, 0.13, '1.082,1.084,1.083,1.085,1.086,1.085,1.087,1.086,1.087,1.087', '—');

  const pos = db.prepare(`INSERT INTO finance_positions (symbol, name, quantity, avg_price, price, value, pnl, pnl_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  pos.run('SPY', 'S&P 500 ETF', 42, 548.20, 612.40, 25720.80, 2696.40, 11.71);
  pos.run('NVDA', 'NVIDIA', 80, 142.10, 178.30, 14264.00, 2896.00, 25.48);
  pos.run('MSFT', 'Microsoft', 18, 441.50, 512.10, 9217.80, 1270.80, 16.00);
  pos.run('BTC-USD', 'Bitcoin', 0.35, 74200, 96420, 33747.00, 7777.00, 29.94);

  const news = db.prepare(`INSERT INTO finance_news (title, source, tag, sentiment, published_at) VALUES (?, ?, ?, ?, ?)`);
  news.run('Chipmakers lead as AI spending stays resilient', 'Market Wire', 'Equities', 'positive', new Date(Date.now() - 18 * 60_000).toISOString());
  news.run('Treasury yields steady ahead of inflation print', 'Rates Desk', 'Macro', 'neutral', new Date(Date.now() - 52 * 60_000).toISOString());
  news.run('Bitcoin reclaims key level on ETF inflows', 'Crypto Brief', 'Crypto', 'positive', new Date(Date.now() - 96 * 60_000).toISOString());
  news.run('Oil slips as supply concerns ease', 'Commodities', 'Energy', 'negative', new Date(Date.now() - 140 * 60_000).toISOString());

  const alert = db.prepare(`INSERT INTO finance_alerts (symbol, condition, target, status) VALUES (?, ?, ?, ?)`);
  alert.run('NVDA', 'above', 180, 'active');
  alert.run('SPY', 'below', 600, 'active');
  alert.run('BTC-USD', 'above', 100000, 'active');

  const habits = db.prepare(`INSERT INTO habit_streaks (name, icon, color, streak, best_streak, week_mask, last_done) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  habits.run('Deep work', '🎯', '#6366f1', 18, 24, '1111110', today);
  habits.run('Read 30 min', '📚', '#f59e0b', 11, 19, '1110111', today);
  habits.run('Training', '🏋️', '#22c55e', 7, 15, '1011010', iso(daysAgo(1)));
  habits.run('No sugar', '🥗', '#14b8a6', 4, 12, '1110011', today);
  habits.run('Sleep < 23:00', '🌙', '#8b5cf6', 9, 21, '1101111', today);
  habits.run('Inbox zero', '📬', '#ec4899', 2, 8, '1001000', iso(daysAgo(2)));

  const svc = db.prepare(`INSERT INTO system_services (name, status, latency_ms, uptime_pct, note) VALUES (?, ?, ?, ?, ?)`);
  svc.run('Dashboard API', 'operational', 12, 99.99, 'Hono on Bun');
  svc.run('SQLite', 'operational', 2, 100, 'WAL mode');
  svc.run('OpenCode runtime', 'operational', 84, 99.92, 'Local subprocess');
  svc.run('Widget sandbox', 'operational', 6, 100, 'Iframe isolation');
  svc.run('Worker queue', 'degraded', 240, 99.41, 'Backlog draining');

  const notif = db.prepare(`INSERT INTO notification_center (title, message, type, icon, source, source_name, read) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  notif.run('Daily brief ready', 'Portfolio is up 0.82% with tech leading.', 'info', '📈', 'finance', 'Finance Terminal', 0);
  notif.run('Backup completed', 'Workspace snapshot stored locally.', 'success', '💾', 'system', 'System', 1);

  // Personal finance
  const budget = db.prepare(`INSERT INTO budget_categories (name, icon, budget, spent, color, order_index) VALUES (?, ?, ?, ?, ?, ?)`);
  [
    ['Housing', '🏠', 1800, 1800, '#34d399'],
    ['Groceries', '🛒', 520, 438, '#22d3ee'],
    ['Transport', '🚇', 180, 142, '#60a5fa'],
    ['Dining out', '🍜', 240, 287, '#fb7185'],
    ['Subscriptions', '🔁', 96, 89, '#a78bfa'],
    ['Health', '🩺', 120, 65, '#34d399'],
    ['Fun', '🎬', 200, 164, '#fbbf24'],
    ['Savings', '🏦', 700, 700, '#22d3ee'],
  ].forEach((row, i) => budget.run(row[0], row[1], row[2], row[3], row[4], i));

  const worth = db.prepare(`INSERT INTO net_worth_items (name, icon, kind, value, color, order_index) VALUES (?, ?, ?, ?, ?, ?)`);
  [
    ['Checking', '💳', 'asset', 8420, '#34d399'],
    ['Savings', '🏦', 'asset', 7400, '#34d399'],
    ['Brokerage', '📈', 'asset', 25720, '#22d3ee'],
    ['Crypto', '₿', 'asset', 33747, '#fbbf24'],
    ['Car', '🚗', 'asset', 14500, '#60a5fa'],
    ['Student loan', '🎓', 'liability', 12400, '#fb7185'],
    ['Credit card', '💳', 'liability', 1840, '#fb7185'],
  ].forEach((row, i) => worth.run(row[0], row[1], row[2], row[3], row[4], i));

  const goal = db.prepare(`INSERT INTO savings_goals (name, icon, target, saved, color, deadline, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  [
    ['Emergency fund', '🛟', 10000, 7400, '#34d399', '2027-06-30'],
    ['Japan trip', '🗾', 4000, 1850, '#fb7185', '2027-04-15'],
    ['New laptop', '💻', 2400, 2100, '#22d3ee', '2026-12-20'],
    ['House down payment', '🏡', 60000, 18500, '#fbbf24', '2029-12-31'],
  ].forEach((row, i) => goal.run(row[0], row[1], row[2], row[3], row[4], row[5], i));

  const sub = db.prepare(`INSERT INTO subscriptions (name, icon, amount, cycle, next_charge, category, color, active, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  [
    ['Netflix', '🎬', 15.49, 'monthly', iso(daysAgo(-6)), 'Entertainment', '#fb7185'],
    ['Spotify', '🎧', 11.99, 'monthly', iso(daysAgo(-11)), 'Music', '#34d399'],
    ['iCloud+', '☁️', 2.99, 'monthly', iso(daysAgo(-2)), 'Storage', '#60a5fa'],
    ['GitHub', '🐙', 4.00, 'monthly', iso(daysAgo(-17)), 'Developer', '#a78bfa'],
    ['Notion', '📝', 10.00, 'monthly', iso(daysAgo(-21)), 'Productivity', '#e5e7eb'],
    ['Gym', '🏋️', 39.00, 'monthly', iso(daysAgo(-8)), 'Health', '#fbbf24'],
    ['Adobe CC', '🎨', 22.99, 'monthly', iso(daysAgo(-14)), 'Creative', '#fb7185'],
    ['Domain', '🌐', 24.00, 'yearly', iso(daysAgo(-64)), 'Developer', '#22d3ee'],
  ].forEach((row, i) => sub.run(row[0], row[1], row[2], row[3], row[4], row[5], row[6], i));

  // School
  const assignment = db.prepare(`INSERT INTO school_assignments (title, course, due_date, status, priority, progress) VALUES (?, ?, ?, ?, ?, ?)`);
  [
    ['Problem set 4', 'Linear Algebra', iso(daysAgo(-1)), 'in_progress', 'high', 60],
    ['Essay: attention economies', 'Media Theory', iso(daysAgo(-3)), 'not_started', 'medium', 0],
    ['Lab report: enzymes', 'Biology', iso(daysAgo(-5)), 'in_progress', 'high', 35],
    ['Reading response', 'Philosophy', iso(daysAgo(-7)), 'not_started', 'low', 0],
    ['Group presentation', 'Data Systems', iso(daysAgo(-10)), 'in_progress', 'medium', 20],
    ['Problem set 3', 'Linear Algebra', iso(daysAgo(4)), 'completed', 'medium', 100],
  ].forEach((row) => assignment.run(row[0], row[1], row[2], row[3], row[4], row[5]));

  const grade = db.prepare(`INSERT INTO school_grades (course, assessment, grade, weight, credits, color) VALUES (?, ?, ?, ?, ?, ?)`);
  [
    ['Linear Algebra', 'Midterm', 92, 0.4, 4, '#60a5fa'],
    ['Linear Algebra', 'Problem sets', 88, 0.6, 4, '#60a5fa'],
    ['Media Theory', 'Essay', 85, 0.5, 3, '#fb7185'],
    ['Media Theory', 'Presentation', 91, 0.5, 3, '#fb7185'],
    ['Biology', 'Lab report', 78, 0.4, 4, '#34d399'],
    ['Biology', 'Midterm', 86, 0.6, 4, '#34d399'],
    ['Philosophy', 'Essay', 94, 0.6, 3, '#fbbf24'],
    ['Philosophy', 'Reading responses', 90, 0.4, 3, '#fbbf24'],
    ['Data Systems', 'Project', 88, 0.5, 4, '#a78bfa'],
    ['Data Systems', 'Quiz', 95, 0.5, 4, '#a78bfa'],
  ].forEach((row) => grade.run(row[0], row[1], row[2], row[3], row[4], row[5]));

  const klass = db.prepare(`INSERT INTO school_classes (course, day, start_time, end_time, room, teacher, color) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  [
    ['Linear Algebra', 1, '09:00', '10:30', 'B-204', 'Dr. Moreau', '#60a5fa'],
    ['Media Theory', 1, '14:00', '15:30', 'A-112', 'Prof. Laurent', '#fb7185'],
    ['Biology', 2, '10:00', '12:00', 'Lab 3', 'Dr. Chen', '#34d399'],
    ['Data Systems', 2, '15:00', '17:00', 'C-301', 'Prof. Silva', '#a78bfa'],
    ['Philosophy', 3, '11:00', '12:30', 'A-210', 'Dr. Novak', '#fbbf24'],
    ['Linear Algebra', 4, '09:00', '10:30', 'B-204', 'Dr. Moreau', '#60a5fa'],
    ['Biology Lab', 4, '14:00', '17:00', 'Lab 3', 'Dr. Chen', '#34d399'],
    ['Data Systems', 5, '10:00', '11:30', 'C-301', 'Prof. Silva', '#a78bfa'],
  ].forEach((row) => klass.run(row[0], row[1], row[2], row[3], row[4], row[5], row[6]));

  const countdown = db.prepare(`INSERT INTO countdown_events (title, date, icon, color) VALUES (?, ?, ?, ?)`);
  [
    ['Essay deadline', iso(daysAgo(-3)), '📝', '#fb7185'],
    ['Linear Algebra midterm', iso(daysAgo(-5)), '📐', '#60a5fa'],
    ['Spring break', iso(daysAgo(-24)), '🌴', '#34d399'],
    ['Semester ends', iso(daysAgo(-52)), '🎓', '#c084fc'],
  ].forEach((row) => countdown.run(row[0], row[1], row[2], row[3]));

  console.log('[Seed] Demo rows inserted');
}

export function seedDatabase(dbPath: string, { reset = false } = {}): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });
  tableStatements(db);
  if (reset) clearSeedTables(db);
  const existing = db.query(`
    SELECT (SELECT COUNT(*) FROM metrics)
         + (SELECT COUNT(*) FROM finance_watchlist)
         + (SELECT COUNT(*) FROM habit_streaks) AS count
  `).get() as { count: number };
  if (existing.count === 0) seedRows(db);
  db.close();
}

export function isEmptyDatabase(dbPath: string): boolean {
  if (!existsSync(dbPath)) return true;
  const db = new Database(dbPath);
  const exists = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='metrics'`).get();
  if (!exists) { db.close(); return true; }
  const count = db.query('SELECT COUNT(*) as count FROM metrics').get() as { count: number };
  db.close();
  return count.count === 0;
}

const STYLE = {
  colorPrimary: '#60a5fa',
  colorSecondary: '#a78bfa',
  colorBackground: '#0b1120',
  colorText: '#e5e7eb',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  borderRadius: '10px',
  borderStyle: 'solid' as const,
  borderWidth: '1px',
  shadowStyle: 'medium' as const,
};

const tabStyle = (
  colorPrimary: string,
  colorSecondary: string,
  colorBackground: string,
) => ({ ...STYLE, colorPrimary, colorSecondary, colorBackground });

const instance = (id: string, widgetId: string, x: number, y: number, cols: number, rows: number, config: Record<string, any> = {}): WidgetInstance => ({
  id,
  widgetId,
  position: { x, y, cols, rows },
  config,
});

type TabDef = {
  id: string;
  name: string;
  emoji: string;
  style: typeof STYLE;
  gridConfig: { cols: number; rowHeight: number; gap: number };
  widgets: WidgetInstance[];
};

function layout(): TabDef[] {
  return [
    {
      id: 'personal',
      name: 'Personal OS',
      emoji: '🧭',
      style: tabStyle('#60a5fa', '#a78bfa', '#0b1120'),
      gridConfig: { cols: 24, rowHeight: 40, gap: 12 },
      widgets: [
        instance('inst-personal-calendar', WIDGETS.calendar, 0, 0, 14, 9),
        instance('inst-personal-routine', WIDGETS.routine, 14, 0, 10, 5, { mode: 'matin' }),
        instance('inst-personal-habits', WIDGETS.habitStreak, 14, 5, 10, 4),
        instance('inst-personal-tracking', WIDGETS.tracking, 0, 9, 12, 5),
        instance('inst-personal-todo', WIDGETS.todo, 12, 9, 12, 5),
      ],
    },
    {
      id: 'personal-finance',
      name: 'Personal Finance',
      emoji: '💳',
      style: tabStyle('#34d399', '#22d3ee', '#071612'),
      gridConfig: { cols: 24, rowHeight: 40, gap: 14 },
      widgets: [
        instance('inst-pf-budget', WIDGETS.budgetPlanner, 0, 0, 10, 10),
        instance('inst-pf-goals', WIDGETS.savingsGoals, 0, 10, 10, 4),
        instance('inst-pf-worth', WIDGETS.netWorth, 10, 0, 14, 4),
        instance('inst-pf-subs', WIDGETS.subscriptions, 10, 4, 14, 5),
        instance('inst-pf-countdown', WIDGETS.countdown, 10, 9, 14, 5),
      ],
    },
    {
      id: 'school',
      name: 'School',
      emoji: '🎓',
      style: tabStyle('#c084fc', '#f472b6', '#140b20'),
      gridConfig: { cols: 24, rowHeight: 40, gap: 10 },
      widgets: [
        instance('inst-school-assignments', WIDGETS.assignments, 0, 0, 9, 6),
        instance('inst-school-timetable', WIDGETS.classTimetable, 9, 0, 15, 6),
        instance('inst-school-grades', WIDGETS.gradeTracker, 0, 6, 9, 6),
        instance('inst-school-flashcards', WIDGETS.flashcards, 9, 6, 8, 6),
        instance('inst-school-focus', WIDGETS.focusTimer, 17, 6, 7, 6),
      ],
    },
    {
      id: 'health',
      name: 'Health',
      emoji: '🌱',
      style: tabStyle('#fb7185', '#f59e0b', '#1a0d14'),
      gridConfig: { cols: 24, rowHeight: 40, gap: 12 },
      widgets: [
        instance('inst-health-habits', WIDGETS.habitStreak, 0, 0, 8, 6),
        instance('inst-health-focus', WIDGETS.focusTimer, 8, 0, 8, 6),
        instance('inst-health-routine', WIDGETS.routine, 16, 0, 8, 6, { mode: 'soir' }),
        instance('inst-health-tracking', WIDGETS.tracking, 0, 6, 16, 6),
        instance('inst-health-todo', WIDGETS.todo, 16, 6, 8, 6),
      ],
    },
    {
      id: 'finance',
      name: 'Finance Terminal',
      emoji: '📈',
      style: tabStyle('#38bdf8', '#818cf8', '#08111d'),
      gridConfig: { cols: 24, rowHeight: 40, gap: 12 },
      widgets: [
        instance('inst-finance-terminal', WIDGETS.financeTerminal, 0, 0, 16, 9),
        instance('inst-finance-hours', WIDGETS.marketHours, 16, 0, 8, 4),
        instance('inst-finance-blackswan', WIDGETS.blackswan, 16, 4, 8, 5),
        instance('inst-finance-trend', WIDGETS.worldTrend, 0, 9, 8, 8),
        instance('inst-finance-sentiment', WIDGETS.sentiment, 8, 9, 8, 8),
        instance('inst-finance-chart', WIDGETS.chart, 16, 9, 8, 8, { ticker: 'SPY' }),
      ],
    },
    {
      id: 'ai',
      name: 'AI Lab',
      emoji: '🤖',
      style: tabStyle('#a78bfa', '#60a5fa', '#0d0a1a'),
      gridConfig: { cols: 24, rowHeight: 40, gap: 12 },
      widgets: [
        instance('inst-ai-assistant', WIDGETS.aiAssistant, 0, 0, 14, 10),
        instance('inst-ai-system', WIDGETS.systemStatus, 14, 0, 10, 5),
        instance('inst-ai-focus', WIDGETS.focusTimer, 14, 5, 10, 5),
        instance('inst-ai-trend', WIDGETS.worldTrend, 0, 10, 14, 6),
        instance('inst-ai-word', WIDGETS.dailyWord, 14, 10, 10, 6),
      ],
    },
  ];
}

export async function seedTabs(
  tabsDir: string,
  {
    prefix = '',
    reset = false,
  }: { prefix?: string; reset?: boolean } = {},
): Promise<void> {
  if (reset && existsSync(tabsDir)) {
    for (const entry of await readdir(tabsDir)) {
      await rm(join(tabsDir, entry), { recursive: true, force: true });
    }
  }
  await mkdir(tabsDir, { recursive: true });

  const existing = await readdir(tabsDir);
  if (!reset && existing.some((entry) => existsSync(join(tabsDir, entry, 'tab.json')))) {
    return;
  }

  const now = nowIso();
  const defs = layout();
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const id = `${prefix}${def.id}`;
    const tab: Tab = {
      id,
      name: def.name,
      emoji: def.emoji,
      createdAt: now,
      updatedAt: now,
      order: i,
      style: def.style,
      widgets: def.widgets,
      gridConfig: def.gridConfig,
      variables: {},
    };
    const tabConfig: TabConfig = { tab, version: 1 };
    const dir = join(tabsDir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'tab.json'), JSON.stringify(tabConfig, null, 2));
  }
  console.log(`[Seed] ${defs.length} tabs written to ${tabsDir}`);
}

export async function ensureSeeded(demo = false): Promise<void> {
  if (demo) {
    seedDatabase(demoDbPath(), { reset: isEmptyDatabase(demoDbPath()) });
    await seedTabs(demoTabsDir(), { prefix: 'demo-tab-', reset: false });
    return;
  }
  seedDatabase(dbPath(), { reset: isEmptyDatabase(dbPath()) });
}

export function dbPath(): string {
  return join(process.cwd(), 'data', 'dashboard.db');
}

export function demoDbPath(): string {
  return join(process.cwd(), 'data', 'demo.db');
}

export function demoTabsDir(): string {
  return join(process.cwd(), 'data', 'demo-tabs');
}
