/**
 * Unit tests for VercelGatewayProvider and AiProviderFactory Gateway Routing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOpenAiClient, mockLogger, mockPrisma } = vi.hoisted(() => {
  const mockOpenAiClient = {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    embeddings: {
      create: vi.fn(),
    },
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockPrisma = {
    platform_settings_list: {
      findFirst: vi.fn(),
    },
  };

  return { mockOpenAiClient, mockLogger, mockPrisma };
});

vi.mock('../../../logger', () => ({
  logger: mockLogger,
}));

vi.mock('../../../prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('openai', () => {
  const MockClass = vi.fn().mockImplementation(function () {
    return mockOpenAiClient;
  });
  return {
    default: MockClass,
  };
});

import { VercelGatewayProvider } from '../VercelGatewayProvider';
import { unifiedConfig } from '../../../config/unifiedConfig';
import AiProviderFactory from '../AiProviderFactory';

describe('VercelGatewayProvider', () => {
  let provider: VercelGatewayProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    (unifiedConfig as any).env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    (unifiedConfig as any).env.AI_GATEWAY_URL = 'https://gateway.ai.vercel.com/v1';
    provider = new VercelGatewayProvider();
  });

  it('reports available when AI_GATEWAY_API_KEY is present', () => {
    expect(provider.isAvailable()).toBe(true);
    expect(provider.name).toBe('vercel-gateway');
  });

  it('reports unavailable when API key is missing', () => {
    (unifiedConfig as any).env.AI_GATEWAY_API_KEY = undefined;
    (unifiedConfig as any).env.VERCEL_AI_GATEWAY_TOKEN = undefined;
    (unifiedConfig as any).env.AI_GATEWAY_SECRET = undefined;
    const unconfigured = new VercelGatewayProvider();
    expect(unconfigured.isAvailable()).toBe(false);
  });

  it('generates chat completion with metadata headers and returns content with usage', async () => {
    mockOpenAiClient.chat.completions.create.mockResolvedValueOnce({
      model: 'openai/gpt-4o-mini',
      choices: [
        {
          message: {
            content: 'Test generated response from gateway',
          },
        },
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 25,
        total_tokens: 40,
      },
    });

    const result = await provider.generateChatCompletion({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello gateway' }],
      metadata: {
        tenantId: 'tenant-123',
        campaignId: 'camp-456',
        userId: 'user-789',
      },
    });

    expect(result.content).toBe('Test generated response from gateway');
    expect(result.model).toBe('openai/gpt-4o-mini');
    expect(result.usage).toEqual({
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40,
    });

    expect(mockOpenAiClient.chat.completions.create).toHaveBeenCalledWith(
      {
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello gateway' }],
        max_tokens: undefined,
        temperature: undefined,
      },
      {
        headers: {
          'x-tenant-id': 'tenant-123',
          'x-campaign-id': 'camp-456',
          'x-user-id': 'user-789',
        },
      }
    );
  });

  it('generates embeddings with metadata headers', async () => {
    mockOpenAiClient.embeddings.create.mockResolvedValueOnce({
      model: 'openai/text-embedding-3-small',
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      usage: {
        prompt_tokens: 8,
        total_tokens: 8,
      },
    });

    const result = await provider.generateEmbeddings({
      model: 'openai/text-embedding-3-small',
      inputs: ['test input text'],
      metadata: {
        tenantId: 'tenant-123',
      },
    });

    expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]]);
    expect(result.model).toBe('openai/text-embedding-3-small');
    expect(result.usage).toEqual({
      promptTokens: 8,
      totalTokens: 8,
    });
    expect(mockOpenAiClient.embeddings.create).toHaveBeenCalledWith(
      {
        model: 'openai/text-embedding-3-small',
        input: ['test input text'],
      },
      {
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      }
    );
  });

  it('throws error on chat completion if uninitialized', async () => {
    (unifiedConfig as any).env.AI_GATEWAY_API_KEY = undefined;
    (unifiedConfig as any).env.VERCEL_AI_GATEWAY_TOKEN = undefined;
    (unifiedConfig as any).env.AI_GATEWAY_SECRET = undefined;
    const unconfigured = new VercelGatewayProvider();

    await expect(
      unconfigured.generateChatCompletion({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toThrow(/Vercel AI Gateway not initialized/);
  });
});

describe('AiProviderFactory with Gateway Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AiProviderFactory.invalidateCache();
  });

  it('routes to vercel-gateway when AI_GATEWAY_ENABLED is true', async () => {
    (unifiedConfig as any).env.AI_GATEWAY_ENABLED = 'true';
    (unifiedConfig as any).env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    (unifiedConfig as any).env.AI_GATEWAY_DEFAULT_CHAT_MODEL = 'openai/gpt-4o-mini';

    const chatConfig = await AiProviderFactory.getChatConfig();
    expect(chatConfig.provider.name).toBe('vercel-gateway');
    expect(chatConfig.model).toBe('openai/gpt-4o-mini');
  });

  it('routes to direct provider if gateway is disabled', async () => {
    (unifiedConfig as any).env.AI_GATEWAY_ENABLED = 'false';
    (unifiedConfig as any).env.OPENAI_API_KEY = 'test-openai-key';
    mockPrisma.platform_settings_list.findFirst.mockResolvedValueOnce({
      bot_chat_provider: 'openai',
      bot_chat_model: 'gpt-4o-mini',
    });

    const chatConfig = await AiProviderFactory.getChatConfig();
    expect(chatConfig.provider.name).toBe('openai');
    expect(chatConfig.model).toBe('gpt-4o-mini');
  });
});
