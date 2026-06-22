/**
 * AI Provider Factory
 *
 * Manages provider instances and routes requests to the configured provider.
 * Reads provider configuration from platform_settings_list (with caching).
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import type { AiProvider, ProviderType, ChatCompletionRequest, ChatCompletionResult, EmbeddingRequest, EmbeddingResult } from './AiProvider';
import { OpenAiProvider } from './OpenAiProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GoogleProvider } from './GoogleProvider';
import { MistralProvider } from './MistralProvider';

class AiProviderFactory {
  private static instance: AiProviderFactory;
  private providers: Map<ProviderType, AiProvider> = new Map();
  private configCache: { chatProvider: ProviderType; embeddingProvider: ProviderType; chatModel: string; embeddingModel: string } | null = null;
  private configCacheTime: number = 0;
  private static readonly CONFIG_CACHE_TTL = 60_000; // 60 seconds

  private constructor() {
    // Initialize all providers — each checks its own env vars and only activates if keys are set
    this.providers.set('openai', new OpenAiProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('google', new GoogleProvider());
    this.providers.set('mistral', new MistralProvider());
  }

  static getInstance(): AiProviderFactory {
    if (!AiProviderFactory.instance) {
      AiProviderFactory.instance = new AiProviderFactory();
    }
    return AiProviderFactory.instance;
  }

  /**
   * Get the configured chat provider + model from platform settings (cached).
   */
  async getChatConfig(): Promise<{ provider: AiProvider; model: string }> {
    const config = await this.getConfig();
    const provider = this.providers.get(config.chatProvider);
    if (!provider || !provider.isAvailable()) {
      // Fallback to OpenAI if the configured provider isn't available
      const fallback = this.providers.get('openai');
      if (fallback?.isAvailable()) {
        return { provider: fallback, model: 'gpt-4o-mini' };
      }
      throw new Error(`Chat provider "${config.chatProvider}" is not available and no fallback could be initialized`);
    }
    return { provider, model: config.chatModel };
  }

  /**
   * Get the configured embedding provider + model from platform settings (cached).
   */
  async getEmbeddingConfig(): Promise<{ provider: AiProvider; model: string }> {
    const config = await this.getConfig();
    const provider = this.providers.get(config.embeddingProvider);
    if (!provider || !provider.isAvailable()) {
      // Fallback to OpenAI if the configured provider isn't available
      const fallback = this.providers.get('openai');
      if (fallback?.isAvailable()) {
        return { provider: fallback, model: 'text-embedding-3-small' };
      }
      throw new Error(`Embedding provider "${config.embeddingProvider}" is not available and no fallback could be initialized`);
    }
    return { provider, model: config.embeddingModel };
  }

  /**
   * Check if any chat provider is available.
   */
  isChatAvailable(): boolean {
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) return true;
    }
    return false;
  }

  /**
   * Check if any embedding provider is available.
   */
  isEmbeddingAvailable(): boolean {
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) return true;
    }
    return false;
  }

  /**
   * Generate chat completion using the configured provider.
   */
  async generateChatCompletion(req: Omit<ChatCompletionRequest, 'model'>): Promise<ChatCompletionResult> {
    const { provider, model } = await this.getChatConfig();
    return provider.generateChatCompletion({ ...req, model });
  }

  /**
   * Generate embeddings using the configured provider.
   */
  async generateEmbeddings(req: Omit<EmbeddingRequest, 'model'>): Promise<EmbeddingResult> {
    const { provider, model } = await this.getEmbeddingConfig();
    return provider.generateEmbeddings({ ...req, model });
  }

  /**
   * Generate a single query embedding (for similarity search).
   */
  async generateQueryEmbedding(text: string): Promise<number[]> {
    const result = await this.generateEmbeddings({ inputs: [text] });
    return result.embeddings[0];
  }

  /**
   * Get available providers (those with API keys configured).
   */
  getAvailableProviders(): ProviderType[] {
    const available: ProviderType[] = [];
    for (const [type, provider] of this.providers) {
      if (provider.isAvailable()) {
        available.push(type);
      }
    }
    return available;
  }

  /**
   * Invalidate the config cache (e.g. after admin updates settings).
   */
  invalidateCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
  }

  private async getConfig(): Promise<{ chatProvider: ProviderType; embeddingProvider: ProviderType; chatModel: string; embeddingModel: string }> {
    const now = Date.now();
    if (this.configCache !== null && (now - this.configCacheTime) < AiProviderFactory.CONFIG_CACHE_TTL) {
      return this.configCache;
    }

    try {
      const settings = await prisma.platform_settings_list.findFirst();
      this.configCache = {
        chatProvider: (settings?.bot_chat_provider as ProviderType) || 'openai',
        embeddingProvider: (settings?.bot_embedding_provider as ProviderType) || 'openai',
        chatModel: settings?.bot_chat_model || 'gpt-4o-mini',
        embeddingModel: settings?.bot_embedding_model || 'text-embedding-3-small',
      };
      this.configCacheTime = now;
      return this.configCache;
    } catch (e) {
      logger.warn('[AiProviderFactory] Failed to read config, using defaults', undefined, { error: String(e) });
      return {
        chatProvider: 'openai',
        embeddingProvider: 'openai',
        chatModel: 'gpt-4o-mini',
        embeddingModel: 'text-embedding-3-small',
      };
    }
  }
}

export default AiProviderFactory.getInstance();
