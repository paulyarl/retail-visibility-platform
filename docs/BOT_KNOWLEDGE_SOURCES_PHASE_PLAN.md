# Bot Knowledge Sources Phase Plan

## Goal

Expand the bot's knowledge base beyond FAQs + products to include badge registry metadata, store policies, business info, fulfillment settings, and other tenant data — all capability-aware, product-type-aware, and embedded via pgvector for semantic search.

## Knowledge Source Overview

| Source | Type | Embedding Table | Skill Key | Phase |
|---|---|---|---|---|
| FAQs | Embedded (existing) | `bot_faq_embeddings` | `chatbot_skill_policy_faq` | — |
| Products | Embedded (existing) | `bot_product_embeddings` | `chatbot_skill_product_search` | — |
| Badge registry (enrichment) | Product chunk enrichment | `bot_product_embeddings` (updated) | `chatbot_skill_product_search` | 1 |
| Badge registry (standalone) | Embedded | `bot_knowledge_embeddings` | `chatbot_skill_product_search` | 2 |
| Store policies | Embedded | `bot_knowledge_embeddings` | `chatbot_skill_policy_faq` | 2 |
| Business info + hours | Embedded | `bot_knowledge_embeddings` | `chatbot_skill_store_hours` | 3 |
| Fulfillment settings | Embedded | `bot_knowledge_embeddings` | `chatbot_skill_inventory` | 4 |

## Current State

### Embedded Knowledge (pgvector RAG)
| Source | Table | Embedding Table | Skill Key |
|---|---|---|---|
| FAQs | `faqs` (published) | `bot_faq_embeddings` | `chatbot_skill_policy_faq` (misnamed — covers FAQ RAG) |
| Products | `mv_storefront_discovery` (active, public) | `bot_product_embeddings` | `chatbot_skill_product_search` |

### Runtime Context (keyword-gated, NOT embedded)
| Source | Service | Trigger | Skill Key |
|---|---|---|---|
| Store policies | `StorefrontPolicyService` | `isPolicyQuery()` keyword match | `chatbot_skill_policy_faq` |
| CRM availability | `BotCrmAssistantService` | `isSupportQuery()` keyword match | `chatbot_skill_crm_assistant` |
| Platform guide | `BotPlatformGuideService` | Always injected | (none — platform context) |

### Problems with Current Architecture
1. **Keyword-gated context** — "can I bring it back?" won't trigger policy context because "return policy" isn't in the message
2. **No product-type awareness** — product embeddings don't include `product_type` in the chunk text, so the bot can't distinguish physical/digital/hybrid/service products
3. **No skill gating** — `BotDynamicResponseService` injects all context sources regardless of `allowed_skill_types` from effective capabilities
4. **No embedding status visibility** — tenant knowledge page only shows FAQ + product; no visibility into other sources
5. **Policies not embedded** — full policy text dumped into prompt regardless of relevance; no semantic matching
6. **Badge keys without meaning** — product embeddings include badge keys (`Badges: sale, new_arrival`) but the bot doesn't know what those badges mean. The `featured_type_registry` has `label` and `description` for each badge (including custom tenant badges) that are never injected
7. **Custom badges invisible to bot** — tenant-specific badges like `eco_friendly: "Made from sustainable materials"` appear in product embeddings but the bot can't explain them

## Design Principles

1. **Capability-gated**: Each knowledge source checks `effective.chatbot.allowed_skill_types` before embedding/searching. If `chatbot_skill_store_hours` isn't in the allowed list, the bot won't inject business hours context.
2. **Product-type-aware**: Product embeddings include `product_type` in chunk text. Product search filters by enabled product types from `effective.product_types.effective_types`.
3. **Embed over inject**: Structured text sources (policies, hours, fulfillment) get embedded for semantic search rather than keyword-gated prompt injection. This eliminates the keyword matching fragility.
4. **Unified embedding table**: Single `bot_knowledge_embeddings` table with `source_type` discriminator, rather than one table per source. Scales to N sources without schema changes.
5. **Refresh on change**: Each source has a webhook or job trigger that refreshes embeddings when the underlying data changes.

---

## Phase 1: Product Type Awareness + Skill Gating

**Priority**: High — fixes existing gap where product embeddings ignore product type and context injection ignores capability gates.

### 1A: Product Type + Badge Enrichment in Embeddings

**Changes:**
- `BotRagService.chunkProduct()` — add `product_type` to chunk text: `Type: ${product.product_type}`
- `BotRagService.refreshProductEmbeddings()` — query already selects `product_type` from `mv_storefront_discovery` (field exists in the MV)
- `BotRagService.chunkProduct()` — enrich badge keys with descriptions from `BadgeRegistryService.getTenantBadges(tenantId)`. Replace `Badges: sale, new_arrival` with `Badges: Sale (Products currently on sale), New Arrival (Recently added products)`. Custom tenant badges like `eco_friendly` become `Eco-Friendly (Made from sustainable materials)`.
- `BotProductCatalogService.searchProducts()` — accept optional `productTypes` filter, pass to SQL query
- `BotDynamicResponseService` — resolve `effective.product_types.effective_types` and pass to product search

**Badge enrichment flow:**
```
1. refreshProductEmbeddings(tenantId)
2. Load badge registry: getTenantBadges(tenantId) → [{key:'sale', label:'Sale', description:'Products currently on sale'}, ...]
3. Build badge lookup map: key → "label (description)" or "label" if no description
4. For each product, parse featured_type_array, map each key to enriched label
5. Chunk text: "Badges: Sale (Products currently on sale), New Arrival (Recently added products)"
```

**Why enrichment matters:** Custom badges are tenant-specific. A tenant creates `eco_friendly: "Made from sustainable materials"` — without enrichment, the bot sees `Badges: eco_friendly` and has no idea what it means. With enrichment, it sees `Badges: Eco-Friendly (Made from sustainable materials)` and can explain it to customers.

**Result**: Bot can answer "do you sell digital products?", "is this a service?", "what does your eco-friendly badge mean?", "why is this marked clearance?" because product_type and badge descriptions are in the embedding text and search can filter by type.

### 1B: Skill Gating in Dynamic Response Service

**Changes:**
- `BotDynamicResponseService.generateResponse()` — resolve `effective.chatbot` once at the start
- Gate each context injection on `allowed_skill_types`:
  - FAQ RAG → `chatbot_skill_policy_faq` (or rename to `chatbot_skill_faq_rag`)
  - Product search → `chatbot_skill_product_search`
  - CRM context → `chatbot_skill_crm_assistant`
  - Policy context → `chatbot_skill_policy_faq`
- If skill not allowed, skip that context source entirely

**Result**: Bot only injects context for skills the tenant's tier allows. No more injecting product search when the tier doesn't include `chatbot_skill_product_search`.

### 1C: Update Knowledge Page

**Changes:**
- `BotKnowledgePage.tsx` — show product type breakdown (count per type) in the product embeddings card
- `BotService.getEmbeddingsStatus()` — return `productTypeBreakdown` from API
- `bot-merchant.ts` embeddings status endpoint — query `bot_product_embeddings` joined with `inventory_items.product_type` for counts

---

## Phase 2: Store Policy Embeddings

**Priority**: High — replaces fragile keyword-gated injection with semantic search.

### 2A: Unified Knowledge Embedding Table

**Migration**: `065_bot_knowledge_embeddings.sql`

```sql
CREATE TABLE bot_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- 'policy' | 'badge_registry' | 'business_info' | 'fulfillment' | 'hours'
  source_id VARCHAR(255) NOT NULL,  -- e.g. 'return_policy', 'business_profile', 'pickup_settings'
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  embedding vector(1536),
  model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, source_type, source_id, chunk_index)
);

CREATE INDEX idx_bot_knowledge_tenant ON bot_knowledge_embeddings(tenant_id);
CREATE INDEX idx_bot_knowledge_source ON bot_knowledge_embeddings(tenant_id, source_type);
CREATE INDEX idx_bot_knowledge_embedding ON bot_knowledge_embeddings USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
```

**Prisma**: Add `bot_knowledge_embeddings` model.

### 2B: Badge Registry Embeddings

**New file**: `apps/api/src/services/BotKnowledgeEmbeddingService.ts`

**Badge chunking**: One chunk per badge type (system + custom). Includes label, description, group, and rules summary:
```
Badge: Sale
Label: Sale
Description: Products currently on sale
Group: tenant (store-controlled)
Auto-assign rule: sale_price_cents is not null AND sale_price_cents < price_cents
Conflicts with: (none)
```

For custom badges (tenant-specific), the chunk includes the tenant's custom label and description:
```
Badge: eco_friendly
Label: Eco-Friendly
Description: Made from sustainable materials
Group: tenant (custom badge)
```

**Why standalone embeddings (in addition to Phase 1 enrichment):** Product embeddings tell the bot what badges a specific product has. Badge registry embeddings let the bot answer general questions about the store's badge program: "what kinds of products do you highlight?", "do you have any eco-friendly products?", "what does your staff pick badge mean?" — without needing to match a specific product first.

**Skill gate**: `chatbot_skill_product_search` (badges are product metadata)

### 2C: Policy Embedding Service

**New file**: `apps/api/src/services/BotKnowledgeEmbeddingService.ts`

Methods:
- `refreshBadgeRegistryEmbeddings(tenantId)` — reads `featured_type_registry` (system + tenant custom badges), chunks each badge into text, embeds into `bot_knowledge_embeddings` with `source_type='badge_registry'`
- `refreshPolicyEmbeddings(tenantId)` — reads `tenant_storefront_policies`, chunks each policy type into text, embeds into `bot_knowledge_embeddings` with `source_type='policy'`
- `searchKnowledge(tenantId, query, sourceTypes?, topK=3)` — pgvector similarity search across `bot_knowledge_embeddings`, optionally filtered by `source_type`
- `hasKnowledgeEmbeddings(tenantId, sourceType?)` — check if embeddings exist
- `refreshKnowledgeEmbeddings(tenantId, sourceType?)` — refresh by source type

**Chunking**: Each policy is a single chunk (they're typically short). Label with policy type:
```
Return Policy:
{policy text}
```

### 2D: Wire into Dynamic Response

**Changes in `BotDynamicResponseService`:**
- Remove `isPolicyQuery()` keyword gate
- Add badge registry RAG search: `knowledgeService.searchKnowledge(tenantId, message, ['badge_registry'], 3)` — gated on `chatbot_skill_product_search`
- Add policy RAG search: `knowledgeService.searchKnowledge(tenantId, message, ['policy'], 3)` — gated on `chatbot_skill_policy_faq`
- If results found, inject as context (same pattern as FAQ RAG)

### 2E: Refresh Triggers

**Badge registry refresh:**
- `badge-registry.ts` POST/PUT/DELETE handlers — after any badge CRUD, call `knowledgeService.refreshBadgeRegistryEmbeddings(tenantId)`
- `platform-badge-sync.ts` job — after platform badge assignments update, refresh badge registry embeddings for affected tenants

**Policy refresh:**

- `storefront-policies.ts` PUT handler — after upsert, call `knowledgeService.refreshPolicyEmbeddings(tenantId)`
- `bot-merchant.ts` — add `POST /embeddings/knowledge/refresh` endpoint (refreshes all knowledge sources or by source_type)
- `bot-merchant.ts` — update `GET /embeddings/status` to include `hasBadgeRegistryEmbeddings`, `hasPolicyEmbeddings`, `hasBusinessInfoEmbeddings`, etc.
- Update `BotService.ts` frontend with corresponding methods

### 2F: Update Knowledge Page UI

**Changes:**
- `BotKnowledgePage.tsx` — add cards for Badge Registry Embeddings and Policy Embeddings with status + refresh buttons
- Badge card: show count of system + custom badges embedded
- Policy card: show per-policy-type status (return, shipping, refund, privacy, terms)

---

## Phase 3: Business Info + Hours Embeddings

**Priority**: Medium — high query frequency from customers ("where are you?", "are you open?", "what's your phone number?").

### 3A: Business Info Embeddings

**Sources:**
- `tenant_business_profiles_list` — business_name, description, address, phone, email, website, social_links
- `business_hours_list` — timezone, periods (JSON)
- `business_hours_special_list` — special/holiday hours

**Chunking**: Single chunk per source:
```
Store Information:
Name: {business_name}
Description: {business_description}
Address: {address_line1}, {city}, {state} {postal_code}, {country_code}
Phone: {phone_number}
Website: {website}
Social: {social_links formatted}

Business Hours:
Timezone: {timezone}
{periods formatted as "Monday: 9am-5pm, Tuesday: closed, ..."}

Special Hours:
{special hours formatted as "Dec 25: Closed, Dec 31: 9am-2pm, ..."}
```

**Skill gate**: `chatbot_skill_store_hours`

### 3B: Wire into Dynamic Response

- Remove hardcoded `isPolicyQuery()` for hours-related queries (already handled by policy embeddings in Phase 2)
- Add business info RAG: `knowledgeService.searchKnowledge(tenantId, message, ['business_info', 'hours'], 3)`
- Gate on `chatbot_skill_store_hours` in allowed skills

### 3C: Refresh Triggers

- `ShopManagementService.updateShop()` — after business profile update, call `knowledgeService.refreshKnowledgeEmbeddings(tenantId, 'business_info')`
- Business hours update endpoints — after hours update, call `knowledgeService.refreshKnowledgeEmbeddings(tenantId, 'hours')`
- Add to periodic sync job (run alongside product embedding sync)

### 3D: Update Knowledge Page

- Add Business Info + Hours cards to `BotKnowledgePage.tsx`
- Show "configured" vs "not configured" status per source

---

## Phase 4: Fulfillment Settings Embeddings

**Priority**: Medium — "do you offer pickup?", "do you deliver?", "how much is shipping?"

### 4A: Fulfillment Embeddings

**Source**: `tenant_fulfillment_settings`

**Chunking**: Single chunk:
```
Fulfillment Options:
Pickup: {enabled} {instructions if enabled} (ready in {pickup_ready_time_minutes} minutes)
Delivery: {enabled} {radius} miles, fee ${delivery_fee}, free over ${delivery_min_free} (estimated {delivery_time_hours} hours)
Shipping: {enabled} flat rate ${shipping_flat_rate}, handling time {shipping_handling_days} days, provider: {shipping_provider}
```

**Skill gate**: `chatbot_skill_inventory` (closest existing skill — or add `chatbot_skill_fulfillment` as new skill type)

### 4B: Wire + Refresh

- Add to `BotDynamicResponseService` knowledge RAG with `source_type='fulfillment'`
- Refresh trigger: fulfillment settings PUT handler
- Add to periodic sync job
- Update knowledge page UI

---

## Phase 5: Consolidation + Admin Enhancements

**Priority**: Low — polish and cross-tenant visibility.

### 5A: Unified Refresh Endpoint

- Single `POST /api/tenants/:tenantId/bot/knowledge/refresh` that refreshes ALL knowledge sources
- Optional `source_type` query param to refresh specific source
- Update admin endpoint `POST /api/admin/bot/knowledge/refresh` to support all source types

### 5B: Admin Knowledge Dashboard Enhancement

- `admin/bot/knowledge/page.tsx` — add columns for policy, business_info, hours, fulfillment embedding counts
- Per-source refresh actions in admin table

### 5C: Knowledge Source Registry

- `bot_knowledge_sources` table (or config in `platform_settings_list`) — declarative registry of knowledge sources
- Each source declares: `source_type`, `skill_key`, `refresh_trigger`, `enabled_by_default`
- `BotKnowledgeEmbeddingService` reads registry to know which sources to embed per tenant
- Admin can enable/disable knowledge sources globally

### 5D: Embedding Sync Job Unification

- Merge `bot-product-embedding-sync.ts` into a unified `bot-knowledge-sync.ts` job
- Single job refreshes all knowledge source embeddings on configurable schedule
- Per-source refresh intervals (products: 12h, policies: on-change, hours: on-change, fulfillment: on-change)

---

## Phase Summary

| Phase | Sources Added | Embedding Table | Skill Gating | Est. Effort |
|---|---|---|---|---|
| 1 | Product type + badge enrichment | `bot_product_embeddings` (updated) | Yes | 1-2 days |
| 2 | Badge registry + store policies | `bot_knowledge_embeddings` (new) | Yes | 2-3 days |
| 3 | Business info + hours | `bot_knowledge_embeddings` | Yes | 1-2 days |
| 4 | Fulfillment settings | `bot_knowledge_embeddings` | Yes | 1 day |
| 5 | Consolidation + admin | — | — | 1-2 days |

**Total**: 7-11 days

## New Skill Keys (proposed)

Current `ChatbotSkillType` has 7 skills. Add:

```typescript
| 'chatbot_skill_fulfillment'    // fulfillment settings knowledge
| 'chatbot_skill_business_info'  // business profile + hours knowledge
```

`chatbot_skill_store_hours` already exists and covers hours. `chatbot_skill_policy_faq` already exists and covers policies + FAQ RAG.

These map to the `ChatbotOptionsResolver` which gates them by tier features.

## Capability Flow

```
Customer message
  → BotDynamicResponseService.generateResponse()
    → resolveEffectiveCapabilities(tenantId)
    → effective.chatbot.allowed_skill_types → ['chatbot_skill_product_search', 'chatbot_skill_policy_faq', ...]
    → For each knowledge source:
      → Check if corresponding skill is in allowed_skill_types
      → If yes: RAG search via pgvector
      → If no: skip
    → Build system prompt with matched context
    → GPT generates response
```

## Product Type Awareness Flow

```
Customer: "do you have any digital downloads?"
  → BotDynamicResponseService
    → resolveEffectiveCapabilities(tenantId)
    → effective.product_types.effective_types → ['physical', 'digital']
    → RAG search: bot_product_embeddings WHERE product_type IN ('physical', 'digital')
    → Product chunks include "Type: digital" in text
    → GPT can answer: "Yes, you have digital downloads available..."
```

## Badge Knowledge Flow

### Enrichment (Phase 1 — product-level)
```
Customer: "tell me about this product"
  → RAG search returns product chunk:
    "Product: Bamboo Toothbrush
     Type: physical
     Badges: Eco-Friendly (Made from sustainable materials), Staff Pick (Recommended by store staff)
     Price: $4.99"
  → GPT can explain: "This is an eco-friendly bamboo toothbrush, staff-recommended, priced at $4.99."
```

### Standalone (Phase 2 — store-level)
```
Customer: "what kinds of products do you highlight?"
  → Badge registry RAG: knowledgeService.searchKnowledge(tenantId, message, ['badge_registry'], 3)
  → Returns chunks: "Badge: Sale (Products currently on sale)", "Badge: Eco-Friendly (Made from sustainable materials)", "Badge: Staff Pick (Recommended by store staff)"
  → GPT can answer: "We highlight products with several badges: Sale items, Eco-Friendly products made from sustainable materials, and Staff Picks recommended by our team."

Customer: "what does your clearance badge mean?"
  → Badge registry RAG matches "clearance" → "Badge: Clearance (Final sale, while supplies last)"
  → GPT answers: "Our Clearance badge means final sale items, available while supplies last."
```
