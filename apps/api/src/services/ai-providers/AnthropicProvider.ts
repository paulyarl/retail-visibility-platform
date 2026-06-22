/**
 * Anthropic Provider
 *
 * Chat completions via @anthropic-ai/sdk (Claude models).
 * Embeddings via Voyage AI API (Anthropic's recommended embedding partner).
 * Voyage API is OpenAI-compatible, so we reuse the OpenAI client with a different base URL.
 */

import { logger } from '../../logger';
import type { AiProvider, ChatCompletionRequest, ChatCompletionResult, EmbeddingRequest, EmbeddingResult } from './AiProvider';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private client: any = null;
  private voyageClient: any = null;

  constructor() {
    // Chat: Anthropic SDK
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = require('@anthropic-ai/sdk').default;
        this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        logger.info('[AnthropicProvider] Chat initialized (Claude)');
      } catch (e) {
        logger.warn('[AnthropicProvider] Failed to init Anthropic SDK', undefined, { error: String(e) });
      }
    }

    // Embeddings: Voyage AI (OpenAI-compatible API)
    if (process.env.VOYAGE_API_KEY) {
      try {
        const OpenAI = require('openai').default;
        this.voyageClient = new OpenAI({
          apiKey: process.env.VOYAGE_API_KEY,
          baseURL: 'https://api.voyageai.com/v1',
        });
        logger.info('[AnthropicProvider] Embeddings initialized (Voyage AI)');
      } catch (e) {
        logger.warn('[AnthropicProvider] Failed to init Voyage AI', undefined, { error: String(e) });
      }
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    if (!this.client) throw new Error('Anthropic not initialized — set ANTHROPIC_API_KEY');

    // Extract system message (Anthropic handles system separately)
    const systemMsg = req.messages.find(m => m.role === 'system');
    const conversationMessages = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens || 300,
      temperature: req.temperature ?? 0.5,
      system: systemMsg?.content,
      messages: conversationMessages,
    });

    const content = response.content
      ?.filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('') || '';

    return {
      content: content.trim(),
      model: response.model || req.model,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
      } : undefined,
    };
  }

  async generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!this.voyageClient) throw new Error('Voyage AI not initialized — set VOYAGE_API_KEY');

    const response = await this.voyageClient.embeddings.create({
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
