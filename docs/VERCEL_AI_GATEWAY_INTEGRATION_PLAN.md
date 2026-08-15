# Sprint Plan: Vercel AI Gateway Alignment & Integration

## 1. Overview & Problem Statement

The platform currently leverages AI models across multiple core functions:
- **Quickstart Catalog Wizard** (`AIProviderService.ts`): Automated product creation, descriptions, pricing, and category structures.
- **Storefront & CRM Assistants** (`ai-providers/`, `BotConversationService.ts`, `BotKnowledgeEmbeddingService.ts`): Dynamic intent detection, RAG search, and embeddings.
- **Marketing Ops Intelligence** (`MarketingPromptService.ts`, `PromptComposerService.ts`): Multi-LLM variant testing and audit prompt generation.
- **Image Generation** (`AIImageSingletonService.ts`, `AIImageService.ts`): DALL-E & Imagen generation.

### Current Architecture Pain Points:
1. **Vendor Lock-in & Fragmented Clients**: Multiple SDKs (`openai`, `@google/generative-ai`, `@anthropic-ai/sdk`) are installed and maintained independently.
2. **Fragile Fallback & Rate-Limit Logic**: `AIProviderService.ts` contains hardcoded throttle limits (e.g. `GEMINI_RATE_LIMIT = 10`), fixed sleep delays (`GEMINI_RETRY_DELAY = 2000`), and nested try-catch blocks that manually swap providers when an API error occurs.
3. **No Centralized Edge Caching**: Identical catalog requests and marketing prompts pay full LLM token costs on every call.
4. **Lack of Per-Tenant Spend Governance**: Multi-tenant token attribution and budget capping require manual code instrumentation rather than edge-level governance.

---

## 2. Target Architecture

By aligning with **Vercel AI Gateway** (with the web app hosted on Vercel and API communicating through standard OpenAI-compatible gateway endpoints):
- **Unified Gateway Routing**: All text and embedding requests route via `https://gateway.ai.vercel.com/v1` (or local Vercel AI SDK runtime) using a single Gateway secret.
- **Zero-Code Edge Failovers**: Gateway handles model failovers (e.g., `google/gemini-2.0-flash` $\rightarrow$ `openai/gpt-4o-mini` $\rightarrow$ `anthropic/claude-3-5-haiku`) on rate-limits (429) or upstream downtime.
- **Zero-Cost Edge Caching**: Repeated queries return in milliseconds with \$0 in model fees.
- **Multi-Tenant Attribution**: Outgoing requests send `x-tenant-id`, `x-campaign-id`, and `x-customer-id` headers for granular cost analytics.

---

## 3. Multi-Sprint Roadmap

| Sprint | Scope | Key Deliverables |
| :--- | :--- | :--- |
| **Sprint 1 (Current)** | **Foundation, Config & Gateway Provider** | Gateway env config, `VercelGatewayProvider` in `ai-providers/`, `AiProviderFactory` integration, unit tests, and feature-flagged routing. |
| **Sprint 2** | **Core Service Migration & Cleanup** | Modernize `AIProviderService` (remove manual sleep/throttle hacks), wire `BotKnowledgeEmbeddingService` / RAG through Gateway, enable automatic failover. |
| **Sprint 3** | **Marketing Ops Prompt Expansion & Spend Tracking** | Enable unified model IDs in Marketing Prompt Workspace (`PromptWorkspaceClient.tsx`), pass tenant/campaign metadata headers, configure edge caching rules. |
| **Sprint 4** | **Frontend Edge Streaming (Optional UI Polish)** | Next.js App Router streaming endpoints with `@ai-sdk/react` for conversational bot and interactive pitch generators. |

---

# Sprint 1: Foundation, Configuration & Gateway Provider

### Goal:
Build the core `VercelGatewayProvider` adapter, integrate it with `AiProviderFactory`, add Doppler / environment configuration, and ensure 100% backward compatibility with existing direct provider keys.

---

### Task 1.1: Configuration & Environment Management
1. Update `apps/api/src/config/unifiedConfig.ts` to include:
   ```ts
   aiGateway: {
     url: process.env.AI_GATEWAY_URL || 'https://gateway.ai.vercel.com/v1',
     apiKey: process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_TOKEN || '',
     enabled: process.env.AI_GATEWAY_ENABLED === 'true',
     defaultChatModel: process.env.AI_GATEWAY_DEFAULT_CHAT_MODEL || 'openai/gpt-4o-mini',
     defaultEmbeddingModel: process.env.AI_GATEWAY_DEFAULT_EMBEDDING_MODEL || 'openai/text-embedding-3-small',
   }
   ```
2. Ensure secrets are documented for Doppler (`local`, `staging`, `production`).

---

### Task 1.2: Implement `VercelGatewayProvider`
**File:** `apps/api/src/services/ai-providers/VercelGatewayProvider.ts`
- Implement the existing `AiProvider` interface:
  - `readonly name = 'vercel-gateway'`
  - `isAvailable(): boolean` (checks if `AI_GATEWAY_API_KEY` is present)
  - `generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult>`
  - `generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult>`
- Supports metadata headers:
  - `x-tenant-id` (from execution context / request)
  - `x-campaign-id` (if present)
- Supports universal model IDs:
  - `openai/gpt-4o-mini`
  - `anthropic/claude-3-5-sonnet`
  - `google/gemini-2.0-flash`

---

### Task 1.3: Update `AiProviderFactory` & Provider Registration
**File:** `apps/api/src/services/ai-providers/AiProviderFactory.ts`
1. Register `VercelGatewayProvider` in `this.providers`.
2. Update `ProviderType` in `AiProvider.ts` to include `'vercel-gateway'`.
3. Update `getChatConfig()` and `getEmbeddingConfig()`:
   - If `unifiedConfig.aiGateway.enabled` is true and gateway is available, route to `'vercel-gateway'` with configured model.
   - Gracefully fallback to direct `'openai'`, `'anthropic'`, or `'google'` if gateway is disabled or unavailable.

---

### Task 1.4: Unit Tests & Verification
1. Create `apps/api/src/services/ai-providers/__tests__/VercelGatewayProvider.test.ts`:
   - Verify chat completion formatting and token usage parsing.
   - Verify embedding request handling.
   - Verify fallback behavior when gateway is unconfigured.
2. Verify `AiProviderFactory` resolution tests.
3. Run `pnpm checkapi` and `pnpm checkweb` to ensure zero compilation or typing regressions.

---

## 4. Verification Commands

- **API TypeScript Check**: `pnpm checkapi`
- **Web TypeScript Check**: `pnpm checkweb`
- **Test Suite**: `pnpm --filter api test apps/api/src/services/ai-providers/__tests__/VercelGatewayProvider.test.ts`
