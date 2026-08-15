/**
 * Vercel AI Gateway Provider
 *
 * Routes chat completions and embeddings through Vercel AI Gateway via OpenAI-compatible endpoint.
 * Supports universal model IDs across providers (e.g. openai/gpt-4o-mini, anthropic/claude-3-5-sonnet, google/gemini-2.0-flash).
 */

import OpenAI from 'openai';
import { logger } from '../../logger';
import { unifiedConfig } from '../../config/unifiedConfig';
import type {
  AiProvider,
  ChatCompletionRequest,
  ChatCompletionResult,
  EmbeddingRequest,
  EmbeddingResult,
} from './AiProvider';

export interface GatewayRequestMetadata {
  tenantId?: string;
  campaignId?: string;
  userId?: string;
}

export class VercelGatewayProvider implements AiProvider {
  readonly name = 'vercel-gateway';
  private client: OpenAI | null = null;

  constructor() {
    this.initialize();
  }

  initialize(): void {
    const apiKey = unifiedConfig.aiGatewayApiKey;
    if (apiKey) {
      try {
        this.client = new OpenAI({
          apiKey,
          baseURL: unifiedConfig.aiGatewayUrl,
        });
        logger.info('[VercelGatewayProvider] Initialized with Vercel AI Gateway');
      } catch (e) {
        logger.warn('[VercelGatewayProvider] Failed to initialize', undefined, { error: String(e) });
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  isAvailable(): boolean {
    const apiKey = unifiedConfig.aiGatewayApiKey;
    if (!apiKey) {
      this.client = null;
      return false;
    }
    if (!this.client) {
      this.initialize();
    }
    return this.client !== null;
  }

  async generateChatCompletion(
    req: ChatCompletionRequest & { metadata?: GatewayRequestMetadata }
  ): Promise<ChatCompletionResult> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Vercel AI Gateway not initialized — set AI_GATEWAY_API_KEY or VERCEL_AI_GATEWAY_TOKEN');
    }

    const headers: Record<string, string> = {};
    if (req.metadata?.tenantId) {
      headers['x-tenant-id'] = req.metadata.tenantId;
    }
    if (req.metadata?.campaignId) {
      headers['x-campaign-id'] = req.metadata.campaignId;
    }
    if (req.metadata?.userId) {
      headers['x-user-id'] = req.metadata.userId;
    }

    const completion = await this.client.chat.completions.create(
      {
        model: req.model,
        messages: req.messages,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
      },
      Object.keys(headers).length > 0 ? { headers } : undefined
    );

    return {
      content: completion.choices[0]?.message?.content?.trim() || '',
      model: completion.model || req.model,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }

  async generateEmbeddings(
    req: EmbeddingRequest & { metadata?: GatewayRequestMetadata }
  ): Promise<EmbeddingResult> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Vercel AI Gateway not initialized — set AI_GATEWAY_API_KEY or VERCEL_AI_GATEWAY_TOKEN');
    }

    const headers: Record<string, string> = {};
    if (req.metadata?.tenantId) {
      headers['x-tenant-id'] = req.metadata.tenantId;
    }
    if (req.metadata?.campaignId) {
      headers['x-campaign-id'] = req.metadata.campaignId;
    }
    if (req.metadata?.userId) {
      headers['x-user-id'] = req.metadata.userId;
    }

    const response = await this.client.embeddings.create(
      {
        model: req.model,
        input: req.inputs,
      },
      Object.keys(headers).length > 0 ? { headers } : undefined
    );

    return {
      embeddings: response.data.map((d: any) => d.embedding),
      model: response.model || req.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}
