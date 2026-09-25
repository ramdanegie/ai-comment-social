// Node doesn't auto-load .env (Bun does). Load <app root>/.env before anything reads process.env.
// Must be the FIRST import of every node entry.
//
// App root = working directory: Passenger starts the app in its root and cron runs
// `cd ~/replyra-api && node dist/worker.cjs`. (Don't use __dirname: `bun build` inlines the
// *source* directory at build time.)
import fs from 'node:fs';
import path from 'node:path';

export const APP_ROOT = process.env.APP_ROOT || process.cwd();

const envFile = process.env.ENV_FILE || path.join(APP_ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// Fail fast instead of silently falling back to local-dev defaults (wrong DB, default encryption key).
const REQUIRED = ['DATABASE_URL', 'TOKEN_ENCRYPTION_KEY', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing ${missing.join(', ')} — expected in ${envFile} (cwd: ${process.cwd()})`);
}
