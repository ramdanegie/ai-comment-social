// Deploy step: apply SQL migrations (packages/db/drizzle → <app root>/drizzle) and billing defaults.
// Defaults are inserted only when missing — prices edited by the superadmin are never overwritten.
import './env';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from '@replyra/db';
import { APP_ROOT } from './env';
import { ensureBillingDefaults } from '../contexts/billing/application/Billing';

async function main() {
  await migrate(db, { migrationsFolder: path.join(APP_ROOT, 'drizzle') });
  await ensureBillingDefaults();
  console.log('✓ migrations applied, billing defaults ensured');
}

main()
  .catch((err) => {
    console.error('✗ migrate failed:', err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
