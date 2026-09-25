// Shared LLM client settings.

/** Per-request timeout. Replies/classifications are tiny, so a stalled request is retried quickly
 *  instead of blocking for 30s (seen on the Gemini free tier). The SDKs retry twice. */
export const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 12_000);
