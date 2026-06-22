---
description: How to add a new AI provider (chat completions + embeddings) to the VisibleShelf platform using the AiProvider abstraction
---

# AI Provider Integration Guide

This document describes how to extend the VisibleShelf platform with a new AI provider for chat completions and/or embeddings. The platform uses a unified `AiProvider` abstraction that allows bot chat, bot embeddings, and quick-start product generation to switch providers dynamically via platform settings.

## Architecture Overview

```
1. AiProvider interface        → apps/api/src/services/ai-providers/AiProvider.ts
2. Provider implementations  → apps/api/src/services/ai-providers/<Name>Provider.ts
3. Factory + cache             → apps/api/src/services/ai-providers/AiProviderFactory.ts
4. Schema / settings         → apps/api/prisma/schema.prisma + admin/bot-platform.ts
5. Frontend provider/model UI → apps/web/src/components/bot/BotAiControls.tsx
```

**Key principle**: Each provider implements a common interface. Callers (BotRagService, BotDynamicResponseService, AIProviderService, etc.) do not import provider-specific SDKs directly; they request the configured provider through the factory.

## The AiProvider Interface

**File**: `apps/api/src/services/ai-providers/AiProvider.ts`

```ts
export interface AiProvider {
  readonly name: string;
  initialize(): void;
  isAvailable(): boolean;
  generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult>;
  generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult>;
}
```

A minimal implementation needs to initialize itself from environment variables, report availability, and implement chat completions. Embeddings can be delegated to another provider if the new provider does not offer embeddings (e.g., Anthropic uses Voyage AI for embeddings).

## Step-by-Step: Adding a New Provider

### 1. Add the Provider to the Type Registry

**File**: `apps/api/src/services/ai-providers/AiProvider.ts`

Add the provider to the `ProviderType` union and update the `PROVIDER_MODELS` and `PROVIDER_OPTIONS` registries with available chat and embedding models and human-readable labels.

```ts
export type ProviderType = 'openai' | 'anthropic' | 'google' | 'mistral' | 'xai';

export const PROVIDER_MODELS: Record<ProviderType, { chat: { value: string; label: string }[]; embedding: { value: string; label: string }[] }> = {
  ...
  xai: {
    chat: [
      { value: 'grok-2-1212', label: 'Grok 2 (grok-2-1212)' },
    ],
    embedding: [], // xAI does not offer embeddings yet
  },
};

export const PROVIDER_OPTIONS = [
  ...
  { value: 'xai', label: 'xAI (Grok)' },
];
```

### 2. Implement the Provider Class

**File**: `apps/api/src/services/ai-providers/XaiProvider.ts` (new file)

```ts
import type { AiProvider, ChatCompletionRequest, ChatCompletionResult, EmbeddingRequest, EmbeddingResult } from './AiProvider';

export class XaiProvider implements AiProvider {
  readonly name = 'xai';
  private client: any = null;

  initialize() {
    if (process.env.XAI_API_KEY) {
      try {
        const OpenAI = require('openai').default; // xAI is OpenAI-compatible
        this.client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
      } catch (error) {
        console.warn('[XaiProvider] Failed to initialize:', error);
      }
    }
  }

  isAvailable() {
    return this.client !== null;
  }

  async generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    if (!this.client) throw new Error('xAI not initialized');
    const response = await this.client.chat.completions.create({
      model: req.model || 'grok-2-1212',
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1000,
    });
    return {
      content: response.choices[0].message.content,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult> {
    throw new Error('xAI does not provide embeddings; configure a different embedding provider');
  }
}
```

**Lazy loading**: Use `require()` inside `initialize()` so the package only needs to be installed if the provider is configured. This avoids startup crashes when the provider is not in use.

### 3. Register the Provider in the Factory

**File**: `apps/api/src/services/ai-providers/AiProviderFactory.ts`

Import the new class and register it in the provider map so `getProvider()` and `getChatProvider()` can resolve it.

```ts
import { XaiProvider } from './XaiProvider';

private readonly providers: Record<ProviderType, AiProvider> = {
  openai: new OpenAiProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleProvider(),
  mistral: new MistralProvider(),
  xai: new XaiProvider(),
};
```

### 4. Install the Provider SDK (if needed)

```bash
pnpm --filter api add <sdk-package>
```

If the SDK is only a dev dependency, add it as a regular dependency. For OpenAI-compatible APIs, no extra SDK may be needed (use the `openai` package with a custom `baseURL`).

### 5. Add Environment Variable

Document the required key in `.env.example` and any deployment secrets manager:

```env
XAI_API_KEY=your_xai_api_key
```

### 6. Frontend Alignment

The factory already reads `bot_chat_provider` and `bot_embedding_provider` from `platform_settings_list`. If the new provider supports only chat or only embeddings, make sure the model lists in `PROVIDER_MODELS` reflect that.

**File**: `apps/api/src/services/ai-providers/AiProvider.ts` (registry)

Ensure the registry lists the provider. `BotAiControls.tsx` will automatically render the provider in the dropdown and update the model list when the provider is selected.

## Provider Patterns and Constraints

### Chat Completions

All providers must accept the `ChatMessage` format:

```ts
export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}
```

Some providers (e.g., Anthropic) do not support a `system` role in the `messages` array; implementers should extract the first `system` message into the provider-specific system parameter (see `AnthropicProvider.ts` for an example).

### Embeddings

If the provider does not support embeddings, throw a clear error in `generateEmbeddings`. The caller should catch this and fall back to the configured OpenAI provider (which is the default). Alternatively, the factory can be updated to allow separate chat and embedding providers and route each request independently.

### JSON Mode / Structured Output

Only some providers support JSON mode. For providers that do not, include explicit instructions in the system/user prompt to return only JSON, and strip markdown code fences before parsing (see `GoogleProvider.ts` and `AnthropicProvider.ts`).

## Fallback Strategy

The factory tries the configured provider first. If unavailable or the request fails, it falls back to OpenAI when possible. Provider implementations should not silently switch providers; they should throw so the factory or caller can decide whether to retry with a different provider.

## Quick-Start Product Generation

If the new provider should be available for quick-start product generation, update the provider routing in `apps/api/src/services/AIProviderService.ts`:

```ts
export type AIProvider = 'openai' | 'google' | 'anthropic' | 'mistral' | 'xai';
```

and the `generateProducts` dispatch logic. If the provider is OpenAI-compatible, you may route it through the generic `AiProviderFactory.generateChatCompletion()` path; otherwise, add a dedicated provider-specific method.

## Schema / Settings Considerations

`platform_settings_list` has these relevant columns:

| Column | Type | Purpose |
|--------|------|---------|
| `bot_chat_provider` | VARCHAR(20) | Selected chat provider (default `openai`) |
| `bot_embedding_provider` | VARCHAR(20) | Selected embedding provider (default `openai`) |
| `bot_chat_model` | VARCHAR(50) | Selected chat model |
| `bot_embedding_model` | VARCHAR(50) | Selected embedding model |
| `bot_ai_enabled` | Boolean | Master switch for bot AI features |
| `bot_embedding_sync_enabled` | Boolean | Whether periodic embedding sync runs |

No new schema columns are needed to add a provider, only the registry and the factory.

## Testing Checklist

- [ ] Provider SDK installed and listed in `apps/api/package.json`
- [ ] Provider class implements `AiProvider` and passes `isAvailable()` checks
- [ ] Provider added to `PROVIDER_MODELS` and `PROVIDER_OPTIONS` with at least one chat model
- [ ] Provider registered in `AiProviderFactory.providers`
- [ ] `pnpm checkapi` passes with zero errors
- [ ] `pnpm checkweb` passes with zero errors
- [ ] Admin AI controls show the new provider in both dropdowns
- [ ] Switching providers updates the model dropdown automatically
- [ ] Chat requests route to the new provider when selected and API key is set
- [ ] Embedding requests route to the new provider when selected (or fall back to OpenAI if unsupported)
- [ ] Quick-start product generation works with the new provider if enabled
- [ ] `OPENAI_API_KEY` fallback works when the new provider is unavailable
- [ ] API key env var documented in `.env.example` and any deployment docs

## File Reference

| File | Purpose |
|------|---------|
| `apps/api/src/services/ai-providers/AiProvider.ts` | Interface, types, model registry |
| `apps/api/src/services/ai-providers/AiProviderFactory.ts` | Provider lifecycle, caching, routing |
| `apps/api/src/services/ai-providers/OpenAiProvider.ts` | OpenAI implementation (reference) |
| `apps/api/src/services/ai-providers/AnthropicProvider.ts` | Claude + Voyage embeddings (reference) |
| `apps/api/src/services/ai-providers/GoogleProvider.ts` | Gemini implementation (reference) |
| `apps/api/src/services/ai-providers/MistralProvider.ts` | Mistral implementation (reference) |
| `apps/api/src/services/ai-providers/index.ts` | Barrel export for consumers |
| `apps/api/src/services/BotRagService.ts` | Uses factory for embeddings |
| `apps/api/src/services/BotDynamicResponseService.ts` | Uses factory for chat completions |
| `apps/api/src/services/AIProviderService.ts` | Uses factory for quick-start product generation |
| `apps/api/src/routes/admin/bot-platform.ts` | GET/PUT settings endpoints + cache invalidation |
| `apps/web/src/components/bot/BotAiControls.tsx` | Frontend provider/model dropdowns |
| `apps/web/src/services/bot/BotPlatformAdminService.ts` | Frontend types for platform settings |

## Related Documents

- `docs/BOT_AI_PLATFORM_CONTROLS.md` — Bot AI controls and layered architecture overview
- `docs/BSAAS_PHASED_PLAN.md` — BSaaS + feature portability plan
