// OpenAI and DeepSeek adapter (DeepSeek exposes an OpenAI-compatible API).
// OpenAI: strict JSON-schema structured outputs. DeepSeek: JSON mode + zod validation (no json_schema support).

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ClassifyInput, DraftReplyInput, LlmProvider } from '../../../contexts/moderation/domain/LlmPorts';
import { CLASSIFY_SYSTEM, ClassificationSchema, REPLY_SYSTEM, classifyUserMessage, cleanReply, replyUserMessage } from './prompts';

type Flavor = 'openai' | 'deepseek';

export function createOpenAICompatProvider(opts: {
  flavor: Flavor;
  apiKey: string;
  classifyModel: string;
  replyModel: string;
}): LlmProvider {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.flavor === 'deepseek' ? 'https://api.deepseek.com' : undefined,
    timeout: 30_000,
    maxRetries: 2
  });
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

      if (opts.flavor === 'openai') {
        const completion = await client.chat.completions.parse({
          model: opts.classifyModel,
          messages,
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
        messages: [
          { role: 'system', content: REPLY_SYSTEM },
          { role: 'user', content: replyUserMessage(input) }
        ],
        max_tokens: 300
      });
      const text = completion.choices[0]?.message.content ?? '';
      if (!text.trim()) throw new Error('Empty reply draft');
      return { text: cleanReply(text), usage: usage(opts.replyModel, completion.usage) };
    }
  };
}
