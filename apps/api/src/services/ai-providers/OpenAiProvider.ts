/**
 * OpenAI Provider
 *
 * Wraps the OpenAI SDK for embeddings + chat completions.
 */

import { logger } from '../../logger';
import type { AiProvider, ChatCompletionRequest, ChatCompletionResult, EmbeddingRequest, EmbeddingResult } from './AiProvider';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private client: any = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai').default;
        this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        logger.info('[OpenAiProvider] Initialized');
      } catch (e) {
        logger.warn('[OpenAiProvider] Failed to init', undefined, { error: String(e) });
      }
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    if (!this.client) throw new Error('OpenAI not initialized — set OPENAI_API_KEY');

    const completion = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
    });

    return {
      content: completion.choices[0]?.message?.content?.trim() || '',
      model: completion.model || req.model,
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      } : undefined,
    };
  }

  async generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!this.client) throw new Error('OpenAI not initialized — set OPENAI_API_KEY');

    const response = await this.client.embeddings.create({
      model: req.model,
      input: req.inputs,
    });

    return {
      embeddings: response.data.map((d: any) => d.embedding),
      model: response.model || req.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }
}
