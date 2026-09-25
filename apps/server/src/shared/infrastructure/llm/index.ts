// Provider selection from env (PRD §13). Returns null when AI isn't configured → rule-only mode (FR-9).
//
//   LLM_PROVIDER=anthropic | openai | gemini | deepseek
//   ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / DEEPSEEK_API_KEY
//   LLM_MODEL_CLASSIFY, LLM_MODEL_REPLY   (optional for anthropic/gemini/deepseek, required for openai)
//   Note: on the Gemini free tier Google may use submitted content to improve its products.
//   LLM_PRICE_INPUT_PER_MTOK, LLM_PRICE_OUTPUT_PER_MTOK  (USD, for usage metering; defaults per provider)
//   LLM_TIMEOUT_MS  (per request, default 12000; the SDK retries twice on timeout)

import type { LlmProvider, LlmUsage } from '../../../contexts/moderation/domain/LlmPorts';
import { createAnthropicProvider } from './anthropicProvider';
import { createOpenAICompatProvider } from './openaiCompatProvider';

const DEFAULT_MODEL: Record<string, string | undefined> = {
  anthropic: 'claude-haiku-4-5',
  gemini: 'gemini-3.1-flash-lite',
  deepseek: 'deepseek-chat',
  openai: undefined // model names change often — set LLM_MODEL_CLASSIFY / LLM_MODEL_REPLY explicitly
};

/** USD per 1M tokens [input, output]. Only models we've priced; others need LLM_PRICE_* env. */
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5': [2, 10],
  'claude-opus-5': [5, 25]
};

let cached: LlmProvider | null | undefined;

/** Tests only: inject a fake provider (or null for rules-only). */
export function setLlmProviderForTests(p: LlmProvider | null | undefined) {
  cached = p;
}

export function getLlmProvider(): LlmProvider | null {
  if (cached !== undefined) return cached;

  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const key =
    provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : provider === 'gemini'
          ? process.env.GEMINI_API_KEY
          : provider === 'deepseek'
            ? process.env.DEEPSEEK_API_KEY
            : undefined;

  if (!provider || !key) {
    cached = null;
    return cached;
  }

  const classifyModel = process.env.LLM_MODEL_CLASSIFY || DEFAULT_MODEL[provider];
  const replyModel = process.env.LLM_MODEL_REPLY || classifyModel;
  if (!classifyModel || !replyModel) {
    console.warn(`[llm] LLM_PROVIDER=${provider} needs LLM_MODEL_CLASSIFY — AI disabled`);
    cached = null;
    return cached;
  }

  cached =
    provider === 'anthropic'
      ? createAnthropicProvider({ apiKey: key, classifyModel, replyModel })
      : createOpenAICompatProvider({ flavor: provider as 'openai' | 'gemini' | 'deepseek', apiKey: key, classifyModel, replyModel });
  return cached;
}

/** Estimated cost in micro-USD for usage_events (FR-9). */
export function estimateCostMicros(usage: LlmUsage): number {
  const envIn = Number(process.env.LLM_PRICE_INPUT_PER_MTOK);
  const envOut = Number(process.env.LLM_PRICE_OUTPUT_PER_MTOK);
  const [pin, pout] = envIn && envOut ? [envIn, envOut] : (PRICES[usage.model] ?? [0, 0]);
  // tokens × $/1M × 1e6 µ$ / 1e6 = tokens × $/1M
  return Math.round(usage.inputTokens * pin + usage.outputTokens * pout);
}
