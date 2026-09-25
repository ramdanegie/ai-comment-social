// Subscriptions, AI-unit top-ups and Midtrans Snap payments (PRD FR-9, §3.5).
//
// Rules:
//  - Prices always come from the database (set by the superadmin), never from the client.
//  - A payment is only trusted after Midtrans' Get Status API confirms it (notification bodies can be forged).
//  - Applying a paid order is idempotent: the pending→settlement transition happens exactly once.

import crypto from 'node:crypto';
import { db, schema } from '@replyra/db';
import { and, asc, eq, gte, ne, sql } from 'drizzle-orm';

export const TRIAL_PLAN_ID = 'trial';
const DEFAULT_TRIAL_DAYS = 14;

// ---------- Defaults (inserted once; superadmin edits afterwards) ----------

export const DEFAULT_PLANS = [
  { id: TRIAL_PLAN_ID, name: 'Trial', monthlyAiUnits: 200, maxSocialAccounts: 1, priceIdr: 0, isPublic: false, sortOrder: 0, description: 'Shadow mode, 14 hari' },
  { id: 'starter', name: 'Starter', monthlyAiUnits: 1000, maxSocialAccounts: 2, priceIdr: 299000, isPublic: true, sortOrder: 1, description: null },
  { id: 'growth', name: 'Growth', monthlyAiUnits: 5000, maxSocialAccounts: 5, priceIdr: 799000, isPublic: true, sortOrder: 2, description: 'Paling populer' },
  { id: 'agency', name: 'Agency Pro', monthlyAiUnits: 20000, maxSocialAccounts: 20, priceIdr: 1999000, isPublic: true, sortOrder: 3, description: null }
];

export const DEFAULT_TOPUPS = [
  { id: 'topup-500', name: '500 unit AI', aiUnits: 500, priceIdr: 150000, isActive: true, sortOrder: 1 },
  { id: 'topup-2000', name: '2.000 unit AI', aiUnits: 2000, priceIdr: 500000, isActive: true, sortOrder: 2 }
];

export async function ensureBillingDefaults() {
  await db.insert(schema.plans).values(DEFAULT_PLANS).onConflictDoNothing({ target: schema.plans.id });
  await db.insert(schema.topupPackages).values(DEFAULT_TOPUPS).onConflictDoNothing({ target: schema.topupPackages.id });
  await db
    .insert(schema.platformSettings)
    .values({ key: 'trial', value: { days: DEFAULT_TRIAL_DAYS } })
    .onConflictDoNothing({ target: schema.platformSettings.key });
}

// ---------- Settings ----------

export async function getTrialDays(): Promise<number> {
  const row = await db.query.platformSettings.findFirst({ where: eq(schema.platformSettings.key, 'trial') });
  const days = Number((row?.value as { days?: number } | undefined)?.days);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_TRIAL_DAYS;
}

export async function setTrialDays(days: number) {
  await db
    .insert(schema.platformSettings)
    .values({ key: 'trial', value: { days } })
    .onConflictDoUpdate({ target: schema.platformSettings.key, set: { value: { days }, updatedAt: new Date() } });
}

// ---------- Subscription state ----------

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

export async function startTrial(workspaceId: string) {
  const now = new Date();
  await db
    .insert(schema.subscriptions)
    .values({
      workspaceId,
      planId: TRIAL_PLAN_ID,
      periodStart: now,
      periodEnd: addDays(now, await getTrialDays()),
      status: 'trial'
    })
    .onConflictDoNothing({ target: schema.subscriptions.workspaceId });
}

export type BillingStatus = Awaited<ReturnType<typeof getBillingStatus>>;

/** Current plan, period and AI units for a workspace. Expired periods have no AI units. */
export async function getBillingStatus(workspaceId: string) {
  const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.workspaceId, workspaceId) });
  if (!sub) return null;
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, sub.planId) });
  const [row] = await db
    .select({ used: sql<number>`coalesce(sum(${schema.usageEvents.units}), 0)::int` })
    .from(schema.usageEvents)
    .where(and(eq(schema.usageEvents.workspaceId, workspaceId), gte(schema.usageEvents.createdAt, sub.periodStart)));

  const expired = sub.periodEnd.getTime() < Date.now();
  const includedUnits = plan?.monthlyAiUnits ?? 0;
  const usedUnits = row?.used ?? 0;
  const totalUnits = includedUnits + sub.extraAiUnits;
  return {
    subscription: sub,
    plan,
    isTrial: sub.status === 'trial',
    expired,
    includedUnits,
    extraUnits: sub.extraAiUnits,
    usedUnits,
    totalUnits,
    remainingUnits: expired ? 0 : Math.max(0, totalUnits - usedUnits)
  };
}

// ---------- Midtrans ----------

function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error('Pembayaran belum dikonfigurasi (MIDTRANS_SERVER_KEY)');
  const prod = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  return {
    serverKey,
    snapUrl: prod ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    apiBase: prod ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com',
    auth: 'Basic ' + Buffer.from(serverKey + ':').toString('base64')
  };
}

export function verifyMidtransSignature(n: { order_id?: string; status_code?: string; gross_amount?: string; signature_key?: string }) {
  const { serverKey } = midtransConfig();
  if (!n.order_id || !n.status_code || !n.gross_amount || !n.signature_key) return false;
  const expected = crypto.createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + serverKey).digest('hex');
  const given = n.signature_key.toLowerCase();
  return expected.length === given.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

async function midtransStatus(orderId: string) {
  const { apiBase, auth } = midtransConfig();
  const res = await fetch(`${apiBase}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: 'application/json', Authorization: auth },
    signal: AbortSignal.timeout(15_000)
  });
  return (await res.json()) as {
    status_code?: string;
    transaction_status?: string;
    fraud_status?: string;
    gross_amount?: string;
    payment_type?: string;
    transaction_id?: string;
  };
}

export type CheckoutRequest = { kind: 'subscription'; planId: string } | { kind: 'top_up'; packageId: string };

export async function createCheckout(args: {
  workspace: { id: string; name: string; slug: string };
  user: { id: string; name: string; email: string };
  request: CheckoutRequest;
  finishUrl: string;
}) {
  const { snapUrl, auth } = midtransConfig();
  const status = await getBillingStatus(args.workspace.id);

  let item: { id: string; name: string; price: number };
  let values: Partial<typeof schema.payments.$inferInsert>;

  if (args.request.kind === 'subscription') {
    const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, args.request.planId) });
    if (!plan || !plan.isPublic || plan.priceIdr <= 0) throw new Error('Paket tidak tersedia');
    item = { id: `plan-${plan.id}`, name: `Replyra ${plan.name} (1 bulan)`, price: plan.priceIdr };
    values = { kind: 'subscription', planId: plan.id, amountIdr: plan.priceIdr };
  } else {
    if (!status || status.isTrial || status.expired) {
      throw new Error('Top-up hanya untuk langganan berbayar yang aktif. Pilih paket dulu.');
    }
    const pack = await db.query.topupPackages.findFirst({ where: eq(schema.topupPackages.id, args.request.packageId) });
    if (!pack || !pack.isActive) throw new Error('Paket top-up tidak tersedia');
    item = { id: `topup-${pack.id}`, name: `Top-up ${pack.aiUnits} unit AI`, price: pack.priceIdr };
    values = { kind: 'top_up', topupPackageId: pack.id, aiUnits: pack.aiUnits, amountIdr: pack.priceIdr };
  }

  const orderId = `RPL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const res = await fetch(snapUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: item.price },
      item_details: [{ id: item.id, price: item.price, quantity: 1, name: item.name.slice(0, 50) }],
      customer_details: { first_name: args.user.name.slice(0, 50), email: args.user.email },
      callbacks: { finish: args.finishUrl }
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const snap = (await res.json()) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!res.ok || !snap.redirect_url) {
    throw new Error(`Midtrans menolak transaksi: ${snap.error_messages?.join('; ') ?? res.status}`);
  }

  await db.insert(schema.payments).values({
    workspaceId: args.workspace.id,
    orderId,
    status: 'pending',
    createdBy: args.user.id,
    redirectUrl: snap.redirect_url,
    kind: values.kind!,
    amountIdr: values.amountIdr!,
    planId: values.planId ?? null,
    topupPackageId: values.topupPackageId ?? null,
    aiUnits: values.aiUnits ?? null
  });
  return { orderId, redirectUrl: snap.redirect_url, amountIdr: item.price };
}

/**
 * Ask Midtrans for the authoritative status and apply it. Used by the notification webhook and by the
 * "I've paid" refresh on /billing. Safe to call any number of times.
 */
export async function syncPayment(orderId: string) {
  const payment = await db.query.payments.findFirst({ where: eq(schema.payments.orderId, orderId) });
  if (!payment) return { found: false as const };

  const st = await midtransStatus(orderId);
  const ts = st.transaction_status;
  const paid = ts === 'settlement' || (ts === 'capture' && (st.fraud_status ?? 'accept') === 'accept');
  const amountOk = Math.round(Number(st.gross_amount)) === payment.amountIdr;

  if (paid && amountOk) {
    // Exactly-once: only the request that flips pending→settlement applies the effect.
    const [flipped] = await db
      .update(schema.payments)
      .set({ status: 'settlement', paidAt: new Date(), paymentType: st.payment_type, midtransTransactionId: st.transaction_id, rawNotification: st })
      .where(and(eq(schema.payments.id, payment.id), ne(schema.payments.status, 'settlement')))
      .returning();
    if (flipped) await applyPaid(flipped);
    return { found: true as const, status: 'settlement' };
  }

  if (ts && ['deny', 'cancel', 'expire', 'failure', 'refund'].includes(ts) && payment.status !== 'settlement') {
    await db.update(schema.payments).set({ status: ts, rawNotification: st }).where(eq(schema.payments.id, payment.id));
  }
  if (paid && !amountOk) console.error(`[billing] amount mismatch for ${orderId}: midtrans=${st.gross_amount} expected=${payment.amountIdr}`);
  return { found: true as const, status: ts ?? payment.status };
}

async function applyPaid(p: typeof schema.payments.$inferSelect) {
  const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.workspaceId, p.workspaceId) });
  const now = new Date();

  if (p.kind === 'subscription' && p.planId) {
    // New monthly allowance starts now. Renewing the same active plan early keeps the unused days
    // (end = old end + 1 month) and the purchased top-up units; switching plans starts clean.
    const extend = sub && sub.status === 'active' && sub.planId === p.planId && sub.periodEnd > now;
    const periodStart = now;
    const periodEnd = addMonths(extend ? sub!.periodEnd : now, 1);
    await db
      .insert(schema.subscriptions)
      .values({ workspaceId: p.workspaceId, planId: p.planId, periodStart, periodEnd, status: 'active', extraAiUnits: 0 })
      .onConflictDoUpdate({
        target: schema.subscriptions.workspaceId,
        set: { planId: p.planId, periodStart, periodEnd, status: 'active', ...(extend ? {} : { extraAiUnits: 0 }) }
      });
  } else if (p.kind === 'top_up' && p.aiUnits) {
    await db
      .update(schema.subscriptions)
      .set({ extraAiUnits: sql`${schema.subscriptions.extraAiUnits} + ${p.aiUnits}` })
      .where(eq(schema.subscriptions.workspaceId, p.workspaceId));
  }

  await db.insert(schema.auditLogs).values({
    workspaceId: p.workspaceId,
    actor: 'system',
    action: p.kind === 'top_up' ? 'billing.topup_paid' : 'billing.subscription_paid',
    targetType: 'payment',
    targetId: p.orderId,
    meta: { amountIdr: p.amountIdr, planId: p.planId, aiUnits: p.aiUnits }
  });
}

export async function listPublicPricing() {
  const [plans, topups] = await Promise.all([
    db.query.plans.findMany({ where: eq(schema.plans.isPublic, true), orderBy: [asc(schema.plans.sortOrder)] }),
    db.query.topupPackages.findMany({ where: eq(schema.topupPackages.isActive, true), orderBy: [asc(schema.topupPackages.sortOrder)] })
  ]);
  return { plans, topups, trialDays: await getTrialDays() };
}
