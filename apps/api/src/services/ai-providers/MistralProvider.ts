/**
 * Mistral Provider
 *
 * Chat completions + embeddings via @mistralai/mistralai SDK.
 * Mistral's API is similar to OpenAI's, making this a thin wrapper.
 */

import { logger } from '../../logger';
import type { AiProvider, ChatCompletionRequest, ChatCompletionResult, EmbeddingRequest, EmbeddingResult } from './AiProvider';

export class MistralProvider implements AiProvider {
  readonly name = 'mistral';
  private client: any = null;

  constructor() {
    if (process.env.MISTRAL_API_KEY) {
      try {
        const MistralClient = require('@mistralai/mistralai').default || require('@mistralai/mistralai').MistralClient;
        this.client = new MistralClient({ apiKey: process.env.MISTRAL_API_KEY });
        logger.info('[MistralProvider] Initialized');
      } catch (e) {
        logger.warn('[MistralProvider] Failed to init', undefined, { error: String(e) });
      }
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    if (!this.client) throw new Error('Mistral not initialized — set MISTRAL_API_KEY');

    const response = await this.client.chat({
      model: req.model,
      messages: req.messages,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
    });

    const content = response.choices?.[0]?.message?.content || '';

    return {
      content: typeof content === 'string' ? content.trim() : String(content).trim(),
      model: response.model || req.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  async generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!this.client) throw new Error('Mistral not initialized — set MISTRAL_API_KEY');

    const response = await this.client.embeddings({
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
