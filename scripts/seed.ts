/**
 * Seed the local dashboard and the isolated demo.
 *
 * - Creates data/dashboard.db + tabs/ if they are missing/empty.
 * - Creates data/demo.db + data/demo-tabs/ if they are missing/empty.
 * - Never overwrites an existing, non-empty setup.
 */

import { CONFIG } from '../src/config';
import { seedDatabase, seedTabs, isEmptyDatabase } from '../src/demo/seed';

const reset = process.argv.includes('--reset');

seedDatabase(CONFIG.DB_PATH, { reset });
seedDatabase(CONFIG.DEMO_DB_PATH, { reset });
await seedTabs(CONFIG.TABS_DIR, { reset });
await seedTabs(CONFIG.DEMO_TABS_DIR, { prefix: 'demo-tab-', reset: reset || isEmptyDatabase(CONFIG.DEMO_DB_PATH) });

console.log('✅ Seed complete');
console.log(`   dashboard DB: ${CONFIG.DB_PATH}`);
console.log(`   demo DB:      ${CONFIG.DEMO_DB_PATH}`);
console.log(`   tabs:         ${CONFIG.TABS_DIR}`);
console.log(`   demo tabs:    ${CONFIG.DEMO_TABS_DIR}`);
