// Ports for AI providers (PRD §2 "LlmClassifier / LlmReplyGenerator", §18.1-2: domain imports no SDKs).
// Adapters live in shared/infrastructure/llm/*.

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type RiskLabel = 'none' | 'spam' | 'toxic' | 'hate' | 'threat' | 'sensitive';
export type Intent = 'praise' | 'purchase_intent' | 'question' | 'complaint' | 'other';

export interface LlmUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ClassifyInput {
  commentText: string;
  postCaption: string | null;
  brandName: string;
}

export interface LlmClassification {
  sentiment: Sentiment;
  riskLabel: RiskLabel;
  intent: Intent;
  confidence: number;
  language: string;
  reason: string;
}

export interface DraftReplyInput {
  commentText: string;
  authorName: string | null;
  postCaption: string | null;
  classification: { sentiment: Sentiment; riskLabel: RiskLabel; intent: Intent };
  brandVoice: { brandName: string; tone: string; useEmoji: boolean; cta: string; forbiddenPhrases: string[] };
}

export interface LlmProvider {
  readonly name: string;
  classify(input: ClassifyInput): Promise<{ result: LlmClassification; usage: LlmUsage }>;
  draftReply(input: DraftReplyInput): Promise<{ text: string; usage: LlmUsage }>;
}
