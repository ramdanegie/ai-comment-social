// Deploy step: apply SQL migrations (packages/db/drizzle → dist/../drizzle) and default plans.
import './env';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, schema, client } from '@replyra/db';
import { APP_ROOT } from './env';

const PLANS = [
  { id: 'starter', name: 'Starter', monthlyAiUnits: 1000, maxSocialAccounts: 2, priceIdr: 299000 },
  { id: 'growth', name: 'Growth (Recommended)', monthlyAiUnits: 5000, maxSocialAccounts: 5, priceIdr: 799000 },
  { id: 'agency', name: 'Agency Pro', monthlyAiUnits: 20000, maxSocialAccounts: 20, priceIdr: 1999000 }
];

async function main() {
  await migrate(db, { migrationsFolder: path.join(APP_ROOT, 'drizzle') });
  await db.insert(schema.plans).values(PLANS).onConflictDoNothing({ target: schema.plans.id });
  console.log('✓ migrations applied, plans ensured');
}

main()
  .catch((err) => {
    console.error('✗ migrate failed:', err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
