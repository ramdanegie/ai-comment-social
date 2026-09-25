// Superadmin (platform operator) API — access enforced by authGuard (/api/v1/admin/* → isSuperadmin).

import { Elysia, t } from 'elysia';
import { db, schema } from '@replyra/db';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { getBillingStatus, getTrialDays, setTrialDays } from '../application/Billing';
import { authGuard } from '../../../shared/http/authGuard';

const Slug = t.String({ pattern: '^[a-z0-9-]{2,40}$' });
const Idr = t.Integer({ minimum: 0, maximum: 1_000_000_000 });
const Units = t.Integer({ minimum: 0, maximum: 10_000_000 });

async function audit(actor: string, action: string, targetType: string, targetId: string, meta: unknown, workspaceId?: string) {
  // audit_logs.workspace_id is required; platform-level changes are logged against the actor's first workspace
  // when there is no tenant, which keeps the existing table without a schema change.
  const wsId =
    workspaceId ??
    (await db.query.memberships.findFirst({ where: eq(schema.memberships.userId, actor) }))?.workspaceId;
  if (!wsId) return;
  await db.insert(schema.auditLogs).values({ workspaceId: wsId, actor, action, targetType, targetId, meta });
}

export const adminRoutes = new Elysia({ prefix: '/api/v1/admin' })
  .use(authGuard)
  .get('/overview', async () => {
    const [ws] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.workspaces);
    const subs = await db
      .select({ status: schema.subscriptions.status, expired: sql<boolean>`${schema.subscriptions.periodEnd} < now()`, n: sql<number>`count(*)::int` })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.status, sql`${schema.subscriptions.periodEnd} < now()`);
    const [rev] = await db
      .select({ total: sql<number>`coalesce(sum(${schema.payments.amountIdr}), 0)::int` })
      .from(schema.payments)
      .where(sql`${schema.payments.status} = 'settlement' and ${schema.payments.paidAt} >= date_trunc('month', now())`);
    const [ai] = await db
      .select({ units: sql<number>`coalesce(sum(${schema.usageEvents.units}), 0)::int`, cost: sql<number>`coalesce(sum(${schema.usageEvents.costUsdMicros}), 0)::bigint` })
      .from(schema.usageEvents)
      .where(sql`${schema.usageEvents.createdAt} >= date_trunc('month', now())`);
    return {
      workspaces: ws?.n ?? 0,
      subscriptions: subs,
      revenueThisMonthIdr: rev?.total ?? 0,
      aiUnitsThisMonth: ai?.units ?? 0,
      aiCostThisMonthUsd: Number(ai?.cost ?? 0) / 1_000_000
    };
  })

  // ----- Plans -----
  .get('/plans', () => db.query.plans.findMany({ orderBy: [asc(schema.plans.sortOrder)] }))
  .post(
    '/plans',
    async ({ body, session, set }) => {
      const exists = await db.query.plans.findFirst({ where: eq(schema.plans.id, body.id) });
      if (exists) {
        set.status = 409;
        return { error: 'Plan id sudah ada' };
      }
      const [plan] = await db.insert(schema.plans).values(body).returning();
      await audit(session!.user.id, 'admin.plan_created', 'plan', plan.id, body);
      return plan;
    },
    {
      body: t.Object({
        id: Slug,
        name: t.String({ minLength: 2, maxLength: 60 }),
        priceIdr: Idr,
        monthlyAiUnits: Units,
        maxSocialAccounts: t.Integer({ minimum: 1, maximum: 1000 }),
        description: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
        isPublic: t.Boolean(),
        sortOrder: t.Integer({ minimum: 0, maximum: 1000 })
      })
    }
  )
  .put(
    '/plans/:id',
    async ({ params, body, session, set }) => {
      if (params.id === 'trial' && body.isPublic) {
        set.status = 400;
        return { error: 'Paket trial tidak boleh dijual' };
      }
      const [plan] = await db.update(schema.plans).set(body).where(eq(schema.plans.id, params.id)).returning();
      if (!plan) {
        set.status = 404;
        return { error: 'Plan not found' };
      }
      await audit(session!.user.id, 'admin.plan_updated', 'plan', plan.id, body);
      return plan;
    },
    {
      body: t.Partial(
        t.Object({
          name: t.String({ minLength: 2, maxLength: 60 }),
          priceIdr: Idr,
          monthlyAiUnits: Units,
          maxSocialAccounts: t.Integer({ minimum: 1, maximum: 1000 }),
          description: t.Nullable(t.String({ maxLength: 200 })),
          isPublic: t.Boolean(),
          sortOrder: t.Integer({ minimum: 0, maximum: 1000 })
        })
      )
    }
  )

  // ----- Top-up packages -----
  .get('/topups', () => db.query.topupPackages.findMany({ orderBy: [asc(schema.topupPackages.sortOrder)] }))
  .post(
    '/topups',
    async ({ body, session, set }) => {
      const exists = await db.query.topupPackages.findFirst({ where: eq(schema.topupPackages.id, body.id) });
      if (exists) {
        set.status = 409;
        return { error: 'Id paket top-up sudah ada' };
      }
      const [pack] = await db.insert(schema.topupPackages).values(body).returning();
      await audit(session!.user.id, 'admin.topup_created', 'topup_package', pack.id, body);
      return pack;
    },
    {
      body: t.Object({
        id: Slug,
        name: t.String({ minLength: 2, maxLength: 60 }),
        aiUnits: t.Integer({ minimum: 1, maximum: 10_000_000 }),
        priceIdr: t.Integer({ minimum: 1000, maximum: 1_000_000_000 }),
        isActive: t.Boolean(),
        sortOrder: t.Integer({ minimum: 0, maximum: 1000 })
      })
    }
  )
  .put(
    '/topups/:id',
    async ({ params, body, session, set }) => {
      const [pack] = await db.update(schema.topupPackages).set(body).where(eq(schema.topupPackages.id, params.id)).returning();
      if (!pack) {
        set.status = 404;
        return { error: 'Top-up package not found' };
      }
      await audit(session!.user.id, 'admin.topup_updated', 'topup_package', pack.id, body);
      return pack;
    },
    {
      body: t.Partial(
        t.Object({
          name: t.String({ minLength: 2, maxLength: 60 }),
          aiUnits: t.Integer({ minimum: 1, maximum: 10_000_000 }),
          priceIdr: t.Integer({ minimum: 1000, maximum: 1_000_000_000 }),
          isActive: t.Boolean(),
          sortOrder: t.Integer({ minimum: 0, maximum: 1000 })
        })
      )
    }
  )

  // ----- Trial settings -----
  .get('/settings', async () => ({ trialDays: await getTrialDays() }))
  .put(
    '/settings',
    async ({ body, session }) => {
      await setTrialDays(body.trialDays);
      await audit(session!.user.id, 'admin.settings_updated', 'settings', 'trial', body);
      return { trialDays: body.trialDays };
    },
    { body: t.Object({ trialDays: t.Integer({ minimum: 1, maximum: 90 }) }) }
  )

  // ----- Tenants -----
  .get('/workspaces', async () => {
    const rows = await db
      .select({
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        slug: schema.workspaces.slug,
        createdAt: schema.workspaces.createdAt,
        owner: sql<string | null>`(select u.email from memberships m join users u on u.id = m.user_id where m.workspace_id = "workspaces"."id" and m.role = 'owner' limit 1)`,
        accounts: sql<number>`(select count(*)::int from social_accounts s where s.workspace_id = "workspaces"."id")`
      })
      .from(schema.workspaces)
      .orderBy(desc(schema.workspaces.createdAt));
    return Promise.all(rows.map(async (w) => ({ ...w, billing: await getBillingStatus(w.id) })));
  })
  .put(
    '/workspaces/:id/subscription',
    async ({ params, body, session, set }) => {
      const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, body.planId) });
      if (!plan) {
        set.status = 400;
        return { error: 'Plan not found' };
      }
      const values = {
        planId: body.planId,
        status: body.planId === 'trial' ? 'trial' : 'active',
        periodEnd: new Date(body.periodEnd),
        extraAiUnits: body.extraAiUnits
      };
      const [sub] = await db
        .insert(schema.subscriptions)
        .values({ workspaceId: params.id, periodStart: new Date(), ...values })
        .onConflictDoUpdate({ target: schema.subscriptions.workspaceId, set: values })
        .returning();
      await audit(session!.user.id, 'admin.subscription_adjusted', 'workspace', params.id, body, params.id);
      return sub;
    },
    {
      body: t.Object({
        planId: t.String(),
        periodEnd: t.String({ format: 'date-time' }),
        extraAiUnits: t.Integer({ minimum: 0, maximum: 10_000_000 })
      })
    }
  )

  .get('/payments', () =>
    db
      .select({
        orderId: schema.payments.orderId,
        kind: schema.payments.kind,
        amountIdr: schema.payments.amountIdr,
        status: schema.payments.status,
        paymentType: schema.payments.paymentType,
        planId: schema.payments.planId,
        aiUnits: schema.payments.aiUnits,
        createdAt: schema.payments.createdAt,
        paidAt: schema.payments.paidAt,
        workspace: schema.workspaces.name
      })
      .from(schema.payments)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.payments.workspaceId))
      .orderBy(desc(schema.payments.createdAt))
      .limit(200)
  );
