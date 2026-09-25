// Classification + reply drafting with the configured AI provider (PRD FR-4, FR-5, FR-9).
//  - Rule prefilter always runs; AI can never lower a risk the prefilter found.
//  - AI usage is metered in usage_events; when a workspace runs out of AI units (or no provider is
//    configured / the call fails) we fall back to rules only and force human review (low confidence).

import { db, schema } from '@replyra/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { RulePrefilter } from '../domain/RulePrefilter';
import { LlmClassifier, type ClassificationOutput } from '../domain/LlmClassifier';
import { LlmReplyGenerator } from '../../response/domain/LlmReplyGenerator';
import type { DraftReplyInput, LlmUsage, RiskLabel } from '../domain/LlmPorts';
import { estimateCostMicros, getLlmProvider } from '../../../shared/infrastructure/llm';
import { cleanReply } from '../../../shared/infrastructure/llm/prompts';

const RISK_SEVERITY: Record<RiskLabel, number> = { none: 0, spam: 1, sensitive: 2, toxic: 3, hate: 4, threat: 5 };
/** Below policy.minConfidence (default 0.75) → NEEDS_REVIEW. */
const RULES_ONLY_CONFIDENCE = 0.5;

export type ModerationResult = ClassificationOutput & { model: string };

/** AI units left in the current period (plan + top-up − used). `null` = no subscription → unlimited (dev). */
export async function remainingAiUnits(workspaceId: string): Promise<number | null> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.workspaceId, workspaceId) });
  if (!sub) return null;
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, sub.planId) });
  const [row] = await db
    .select({ used: sql<number>`coalesce(sum(${schema.usageEvents.units}), 0)::int` })
    .from(schema.usageEvents)
    .where(and(eq(schema.usageEvents.workspaceId, workspaceId), gte(schema.usageEvents.createdAt, sub.periodStart)));
  return (plan?.monthlyAiUnits ?? 0) + sub.extraAiUnits - (row?.used ?? 0);
}

async function recordUsage(workspaceId: string, commentId: string | null, kind: string, usage: LlmUsage) {
  await db.insert(schema.usageEvents).values({
    workspaceId,
    commentId,
    kind,
    units: 1,
    model: `${usage.provider}:${usage.model}`,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsdMicros: estimateCostMicros(usage)
  });
}

async function aiAvailable(workspaceId: string) {
  const provider = getLlmProvider();
  if (!provider) return null;
  const left = await remainingAiUnits(workspaceId);
  return left === null || left > 0 ? provider : null;
}

export async function classifyComment(args: {
  workspaceId: string;
  commentId: string | null;
  text: string;
  postCaption: string | null;
  brandName: string;
  customKeywords: string[];
}): Promise<ModerationResult> {
  const prefilter = RulePrefilter.check(args.text, args.customKeywords);
  const provider = await aiAvailable(args.workspaceId);

  if (provider) {
    try {
      const { result, usage } = await provider.classify({
        commentText: args.text,
        postCaption: args.postCaption,
        brandName: args.brandName
      });
      await recordUsage(args.workspaceId, args.commentId, 'classify', usage);

      // Invariant FR-4: take the more severe risk of prefilter vs AI.
      let riskLabel = result.riskLabel;
      if (prefilter.hasRisk && prefilter.riskLabel && RISK_SEVERITY[prefilter.riskLabel] > RISK_SEVERITY[riskLabel]) {
        riskLabel = prefilter.riskLabel;
      }
      return {
        sentiment: ['toxic', 'hate', 'threat'].includes(riskLabel) ? 'negative' : result.sentiment,
        riskLabel,
        intent: result.intent,
        confidence: result.confidence,
        reason: riskLabel !== result.riskLabel ? `Prefilter (${riskLabel}): ${prefilter.matchedKeywords.join(', ')}` : result.reason,
        prefilterHits: prefilter.matchedKeywords,
        model: `${usage.provider}:${usage.model}`
      };
    } catch (err) {
      console.warn(`[ai] classify failed, falling back to rules: ${(err as Error).message}`);
    }
  }

  // Rules only: keyword heuristics, forced into human review.
  const rules = await LlmClassifier.classify(args.text, args.postCaption, args.brandName, args.customKeywords);
  return {
    ...rules,
    confidence: Math.min(rules.confidence, RULES_ONLY_CONFIDENCE),
    reason: `${provider ? 'AI gagal' : 'Tanpa AI (kuota habis / belum dikonfigurasi)'} — ${rules.reason}`,
    model: 'rules-only'
  };
}

export async function draftReply(args: {
  workspaceId: string;
  commentId: string | null;
  input: DraftReplyInput;
}): Promise<{ text: string; model: string }> {
  const provider = await aiAvailable(args.workspaceId);
  if (provider) {
    try {
      const { text, usage } = await provider.draftReply(args.input);
      await recordUsage(args.workspaceId, args.commentId, 'generate_reply', usage);
      return { text: cleanReply(text), model: `${usage.provider}:${usage.model}` };
    } catch (err) {
      console.warn(`[ai] draft failed, using template: ${(err as Error).message}`);
    }
  }
  const i = args.input;
  const text = LlmReplyGenerator.generate(
    i.commentText,
    i.authorName,
    { ...i.classification, confidence: 0, reason: '', prefilterHits: [] },
    i.brandVoice
  );
  return { text, model: 'template' };
}
