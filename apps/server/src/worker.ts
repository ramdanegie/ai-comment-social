import { db, schema } from '@replyra/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  enqueueJob,
  hideComment,
  ingestWebhookPayload,
  markCommentFailed,
  pollAccount,
  sendReply
} from './contexts/engagement/application/MetaIngestion';

const MAX_ATTEMPTS = 3;
/** Dev mode has no comment webhooks → polling is the primary source. PRD fallback in production = 600s. */
const POLL_INTERVAL_SEC = Number(process.env.META_POLL_INTERVAL_SEC || 300);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Job = { id: string; type: string; payload: any; attempts: number };

/** Claim atomically: SELECT ... SKIP LOCKED inside the UPDATE, so two workers never pick the same job. */
async function claimNextJob(): Promise<Job | null> {
  const rows = await db.execute(sql`
    UPDATE jobs SET status = 'running', attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_at <= NOW()
      ORDER BY run_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts;
  `);
  return (rows[0] as Job | undefined) ?? null;
}

async function handle(job: Job) {
  const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

  switch (job.type) {
    case 'poll_account': {
      const res = await pollAccount(payload.accountId);
      if (!res.skipped) console.log(`[Worker] poll ${payload.accountId}: ${res.newComments} new comment(s)`);
      return;
    }
    case 'classify_comment': // Meta webhook payload (enqueued by POST /webhooks/meta)
      await ingestWebhookPayload(payload);
      return;
    case 'send_reply':
      await sendReply(payload.commentId);
      return;
    case 'hide_comment':
      await hideComment(payload.commentId, payload.hide !== false);
      return;
    case 'aggregate_daily':
      console.log(`[Worker] Aggregating daily metrics`);
      return;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

export async function processNextJob() {
  const job = await claimNextJob();
  if (!job) return false;

  try {
    await handle(job);
    await db.update(schema.jobs).set({ status: 'done', lastError: null }).where(eq(schema.jobs.id, job.id));
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const final = job.attempts >= MAX_ATTEMPTS;
    console.error(`[Worker] job ${job.id} (${job.type}) attempt ${job.attempts} failed: ${message}`);

    await db
      .update(schema.jobs)
      .set({
        status: final ? 'failed' : 'pending',
        lastError: message,
        // exponential backoff: 30s, 60s, 120s
        runAt: new Date(Date.now() + 30_000 * 2 ** (job.attempts - 1))
      })
      .where(eq(schema.jobs.id, job.id));

    if (final && job.type === 'send_reply') await markCommentFailed(job.payload.commentId, message);
  }
  return true;
}

/** Enqueue one poll_account job per connected Meta account per interval bucket (dedupe_key keeps it idempotent). */
export async function schedulePolls() {
  const accounts = await db
    .select({ id: schema.socialAccounts.id })
    .from(schema.socialAccounts)
    .where(
      and(
        eq(schema.socialAccounts.status, 'connected'),
        inArray(schema.socialAccounts.platform, ['instagram', 'facebook'])
      )
    );

  const bucket = Math.floor(Date.now() / (POLL_INTERVAL_SEC * 1000));
  for (const acc of accounts) {
    await enqueueJob('poll_account', { accountId: acc.id }, `poll:${acc.id}:${bucket}`);
  }
}

/** Long-running worker (VPS / local dev). */
export async function loop() {
  console.log('Replyra Background Worker started...');
  let lastSchedule = 0;
  while (true) {
    try {
      if (Date.now() - lastSchedule > 30_000) {
        await schedulePolls();
        lastSchedule = Date.now();
      }
      const processed = await processNextJob();
      if (!processed) await sleep(2000);
    } catch (err) {
      console.error('[Worker] loop error:', err);
      await sleep(5000);
    }
  }
}

/**
 * One pass for cron on shared hosting (no long-running processes allowed):
 * enqueue due polls, then drain the queue until empty or the time budget runs out.
 */
export async function runOnce(budgetMs = 50_000) {
  const deadline = Date.now() + budgetMs;
  await schedulePolls();
  let processed = 0;
  while (Date.now() < deadline && (await processNextJob())) processed++;
  return processed;
}

if (import.meta.main) {
  if (process.argv.includes('--once')) {
    runOnce()
      .then((n) => console.log(`[Worker] once: ${n} job(s) processed`))
      .finally(() => process.exit(0));
  } else {
    loop();
  }
}
