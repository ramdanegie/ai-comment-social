import { db, schema } from '@replyra/db';
import { eq, sql, and, lte } from 'drizzle-orm';
import { LlmClassifier } from './contexts/moderation/domain/LlmClassifier';
import { ReplyPolicyEvaluator } from './contexts/response/domain/ReplyPolicyEvaluator';
import { LlmReplyGenerator } from './contexts/response/domain/LlmReplyGenerator';

console.log('Replyra Background Worker started...');

async function processNextJob() {
  try {
    // 1. Pick job with FOR UPDATE SKIP LOCKED
    const pendingJobs = await db.execute(sql`
      SELECT id, type, payload, attempts 
      FROM jobs 
      WHERE status = 'pending' AND run_at <= NOW()
      ORDER BY run_at ASC 
      LIMIT 1 
      FOR UPDATE SKIP LOCKED;
    `);

    if (!pendingJobs || pendingJobs.length === 0) {
      return false;
    }

    const job = pendingJobs[0] as { id: string; type: string; payload: any; attempts: number };

    // Mark running
    await db
      .update(schema.jobs)
      .set({ status: 'running', attempts: job.attempts + 1 })
      .where(eq(schema.jobs.id, job.id as any));

    console.log(`[Worker] Processing job ${job.id} (${job.type})`);

    // Handle job types
    if (job.type === 'classify_comment') {
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      // In production parses Meta webhook object entry -> changes -> value
      console.log(`[Worker] Classifying comment from webhook payload`);
    } else if (job.type === 'send_reply') {
      console.log(`[Worker] Sending scheduled reply to platform API`);
    } else if (job.type === 'aggregate_daily') {
      console.log(`[Worker] Aggregating daily metrics`);
    }

    // Mark done
    await db
      .update(schema.jobs)
      .set({ status: 'done' })
      .where(eq(schema.jobs.id, job.id as any));

    return true;
  } catch (err: any) {
    console.error('[Worker] Error processing job:', err);
    return false;
  }
}

async function loop() {
  while (true) {
    const processed = await processNextJob();
    if (!processed) {
      // Sleep 2 seconds before checking for new jobs
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

if (import.meta.main) {
  loop();
}
