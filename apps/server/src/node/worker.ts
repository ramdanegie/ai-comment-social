// Cron entry (every minute): node dist/worker.cjs — one pass, then exit.
import './env';
import { client } from '@replyra/db';
import { runOnce } from '../worker';

runOnce(Number(process.env.WORKER_BUDGET_MS || 50_000))
  .then((n) => {
    if (n > 0) console.log(`[${new Date().toISOString()}] worker: ${n} job(s)`);
  })
  .catch((err) => {
    console.error(`[${new Date().toISOString()}] worker error:`, err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
