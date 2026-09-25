// OpenAI, Gemini and DeepSeek adapter (Gemini and DeepSeek expose OpenAI-compatible APIs).
// OpenAI/Gemini: JSON-schema structured outputs. DeepSeek: JSON mode + zod validation (no json_schema support).

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ClassifyInput, DraftReplyInput, LlmProvider } from '../../../contexts/moderation/domain/LlmPorts';
import { CLASSIFY_SYSTEM, ClassificationSchema, REPLY_SYSTEM, classifyUserMessage, cleanReply, replyUserMessage } from './prompts';
import { LLM_TIMEOUT_MS } from './config';

type Flavor = 'openai' | 'gemini' | 'deepseek';

const BASE_URL: Record<Flavor, string | undefined> = {
  openai: undefined,
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  deepseek: 'https://api.deepseek.com'
};

export function createOpenAICompatProvider(opts: {
  flavor: Flavor;
  apiKey: string;
  classifyModel: string;
  replyModel: string;
}): LlmProvider {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: BASE_URL[opts.flavor],
    timeout: LLM_TIMEOUT_MS,
    maxRetries: 2
  });
  // Gemini 3.x thinks before answering; short classification/replies don't need it (latency).
  const thinking = opts.flavor === 'gemini' ? { reasoning_effort: 'minimal' as const } : {};
  const usage = (model: string, u?: OpenAI.CompletionUsage) => ({
    provider: opts.flavor,
    model,
    inputTokens: u?.prompt_tokens ?? 0,
    outputTokens: u?.completion_tokens ?? 0
  });

  return {
    name: opts.flavor,

    async classify(input: ClassifyInput) {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: CLASSIFY_SYSTEM },
        { role: 'user', content: classifyUserMessage(input) }
      ];

      if (opts.flavor !== 'deepseek') {
        const completion = await client.chat.completions.parse({
          model: opts.classifyModel,
          messages,
          ...thinking,
          response_format: zodResponseFormat(ClassificationSchema, 'comment_classification')
        });
        const parsed = completion.choices[0]?.message.parsed;
        if (!parsed) throw new Error(completion.choices[0]?.message.refusal || 'Classification output did not match schema');
        return { result: parsed, usage: usage(opts.classifyModel, completion.usage) };
      }

      // DeepSeek JSON mode: the word "JSON" must appear in the prompt (it does, in CLASSIFY_SYSTEM).
      const completion = await client.chat.completions.create({
        model: opts.classifyModel,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 512
      });
      const raw = completion.choices[0]?.message.content ?? '';
      const parsed = ClassificationSchema.safeParse(JSON.parse(raw || '{}'));
      if (!parsed.success) throw new Error(`Classification output did not match schema: ${parsed.error.message}`);
      return { result: parsed.data, usage: usage(opts.classifyModel, completion.usage) };
    },

    async draftReply(input: DraftReplyInput) {
      const completion = await client.chat.completions.create({
        model: opts.replyModel,
        ...thinking,
        messages: [
          { role: 'system', content: REPLY_SYSTEM },
          { role: 'user', content: replyUserMessage(input) }
        ],
        // Gemini counts thinking tokens against the limit; leave headroom so the reply isn't cut off.
        max_tokens: opts.flavor === 'gemini' ? 1024 : 300
      });
      const text = completion.choices[0]?.message.content ?? '';
      if (!text.trim()) throw new Error('Empty reply draft');
      return { text: cleanReply(text), usage: usage(opts.replyModel, completion.usage) };
    }
  };
}
