// Anthropic (Claude) adapter. Default model: claude-haiku-4-5 (cheap, fast, supports structured outputs).
// Prompt caching is not used: our prompts are far below Haiku 4.5's 4096-token cacheable minimum.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ClassifyInput, DraftReplyInput, LlmProvider } from '../../../contexts/moderation/domain/LlmPorts';
import { CLASSIFY_SYSTEM, ClassificationSchema, REPLY_SYSTEM, classifyUserMessage, cleanReply, replyUserMessage } from './prompts';
import { LLM_TIMEOUT_MS } from './config';

export function createAnthropicProvider(opts: { apiKey: string; classifyModel: string; replyModel: string }): LlmProvider {
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: 2 });
  const usage = (model: string, u: Anthropic.Usage) => ({
    provider: 'anthropic',
    model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens
  });

  return {
    name: 'anthropic',

    async classify(input: ClassifyInput) {
      const response = await client.messages.parse({
        model: opts.classifyModel,
        max_tokens: 512,
        system: CLASSIFY_SYSTEM,
        messages: [{ role: 'user', content: classifyUserMessage(input) }],
        output_config: { format: zodOutputFormat(ClassificationSchema) }
      });
      if (response.stop_reason === 'refusal') throw new Error('Model refused to classify');
      if (!response.parsed_output) throw new Error('Classification output did not match schema');
      return { result: response.parsed_output, usage: usage(opts.classifyModel, response.usage) };
    },

    async draftReply(input: DraftReplyInput) {
      const response = await client.messages.create({
        model: opts.replyModel,
        max_tokens: 300,
        system: REPLY_SYSTEM,
        messages: [{ role: 'user', content: replyUserMessage(input) }]
      });
      if (response.stop_reason === 'refusal') throw new Error('Model refused to draft a reply');
      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      if (!text.trim()) throw new Error('Empty reply draft');
      return { text: cleanReply(text), usage: usage(opts.replyModel, response.usage) };
    }
  };
}
