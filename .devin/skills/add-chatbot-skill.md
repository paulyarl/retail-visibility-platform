---
description: How to add a new bot skill to the chatbot platform (capability key, DB row, service, intent, dynamic response)
---

# Add a New Chatbot Bot Skill

Use this skill when extending the chatbot with a new capability that the bot can execute in response to user messages (e.g., shipping calculator, loyalty rewards lookup, appointment booking).

**Full reference:** `docs/CHATBOT_SKILL_EXTENSION_GUIDE.md` — read this before starting. It contains the complete architecture diagram, step-by-step worked example, skill card schema reference, capability gate documentation, and testing checklist.

## Prerequisites

- Understand the capability system (see `.devin/skills/add-capability-feature.md` and `.devin/skills/link-features-to-capability-type.md`)
- Understand capability-type integration (see `.devin/skills/capability-system-integration.md`)

## Quick Reference: The 7 Components

Every skill has **3 required** and **4 conditional** components:

| # | Component | Required? | Location |
|---|---|---|---|
| 1 | `bot_skills` DB row | Yes | `apps/api/prisma/seed-bot-data.ts` or admin API |
| 2 | Capability feature key | Yes | `features_list` + `capability_features_list` + `tier_features_list` |
| 3 | `ChatbotSkillType` union member | Yes | `types.ts` + `ChatbotOptionsResolver.ts` + frontend mirrors |
| 4 | Dedicated backend service | If skill queries data | `apps/api/src/services/Bot<Name>Service.ts` |
| 5 | Intent mapping | If intent-triggered | `bot_intents` row with `mapped_skill` |
| 6 | Dynamic response integration | If skill data enriches GPT prompts | `BotDynamicResponseService.ts` |
| 7 | Public API endpoint | If skill needs custom endpoint | `apps/api/src/routes/bot-public.ts` |

## Steps (Summary)

1. **SQL migration** — Insert `chatbot_skill_<name>` into `features_list`, link to `chatbot_options` capability type, enable for target tiers in `tier_features_list`
2. **TypeScript types** — Add to `ChatbotSkillType` in `apps/api/src/services/resolvers/types.ts` and `ChatbotOptionsResolver.ts` (both flexible block + conditional check)
3. **Seed skill row** — Add to `SKILLS` array in `seed-bot-data.ts` with name, endpoint, gates, `skill_card_schema`, `default_config`
4. **Seed intent** — Add to `INTENTS` array with example phrases and `mapped_skill` pointing to the skill name
5. **Backend service** — Create `Bot<Name>Service.ts` following the `BotProductCatalogService` singleton pattern
6. **Public endpoint** — Add route to `bot-public.ts` with capability gate check via `resolveEffectiveCapabilities()`
7. **Dynamic response** — If applicable, add keyword detection + context injection in `BotDynamicResponseService.ts`
8. **Frontend mirrors** — Update `ChatbotSkillType` in `CapabilityResolutionService.ts` and `UnifiedCapabilityService.ts`
9. **Verify** — Zero TS errors on both `apps/api` and `apps/web`

## Naming Convention

- Skill name (kebab-case): `shipping-calculator`
- Capability key (snake_case): `chatbot_skill_shipping_calculator`
- Intent name (dot notation): `shipping.inquiry`

## Key Files to Touch

- `database/migrations/04X_<description>.sql` — feature key + tier assignments
- `apps/api/src/services/resolvers/types.ts` — `ChatbotSkillType` union
- `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts` — resolver logic
- `apps/api/prisma/seed-bot-data.ts` — skill + intent seed data
- `apps/api/src/services/Bot<Name>Service.ts` — dedicated service (if needed)
- `apps/api/src/routes/bot-public.ts` — public endpoint (if needed)
- `apps/api/src/services/BotDynamicResponseService.ts` — GPT context injection (if needed)
- `apps/web/src/services/CapabilityResolutionService.ts` — frontend type mirror
- `apps/web/src/services/UnifiedCapabilityService.ts` — frontend type mirror

## Verification

```bash
# Backend type check
cd apps/api && npx tsc --noEmit

# Frontend type check
cd apps/web && npx tsc --noEmit

# Seed the new skill
cd apps/api && npx tsx prisma/seed-bot-data.ts
```

See the **Testing Checklist** section in `docs/CHATBOT_SKILL_EXTENSION_GUIDE.md` for the full verification matrix (database, backend, frontend, widget, dynamic response).

---

## Adding a Knowledge Source (RAG Embeddings)

A **distinct pattern** from skill capabilities above. Knowledge sources are structured data (badges, policies, business info, hours, fulfillment settings) embedded into the `bot_knowledge_embeddings` table for pgvector semantic search. The bot retrieves relevant chunks via RAG instead of keyword matching.

**Design doc:** `docs/BOT_KNOWLEDGE_SOURCES_PHASE_PLAN.md`

### Existing Knowledge Sources

| Source type | Skill gate | Table read | Refresh trigger route |
|---|---|---|---|
| `badge_registry` | `chatbot_skill_product_search` | BadgeRegistryService | `badge-registry.ts` POST/PUT/DELETE |
| `policy` | `chatbot_skill_policy_faq` | StorefrontPolicyService | `storefront-policies.ts` PUT |
| `business_info` | `chatbot_skill_store_hours` | `tenant_business_profiles_list` | `shop-management.ts` POST/PUT |
| `hours` | `chatbot_skill_store_hours` | `business_hours_list` + `business_hours_special_list` | `business-hours.ts` PUT (regular + special) |
| `fulfillment` | `chatbot_skill_inventory` | `tenant_fulfillment_settings` | `fulfillment-settings.ts` PUT |

### The 6 Steps to Add a New Knowledge Source

#### 1. Embedding method in `BotKnowledgeEmbeddingService.ts`

Add `refresh[Source]Embeddings(tenantId)` and a private `chunk[Source](data)` helper:

```typescript
async refreshFulfillmentEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
  const settings = await prisma.<table>.findUnique({ where: { tenant_id: tenantId } });
  const pool = getDirectPool();
  // Delete existing embeddings for this source_type
  await pool.query("DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = '<source_type>'", [tenantId]);
  if (!settings) return { processed: 0, chunks: 0 };
  const text = this.chunkFulfillment(settings);
  if (!text) return { processed: 0, chunks: 0 };
  const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
  const embeddings = await this.generateEmbeddings([text]);
  const embeddingStr = `[${embeddings[0].join(',')}]`;
  await pool.query(
    `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
     VALUES ($1, '<source_type>', '<source_id>', $2, 0, $3::vector, $4)
     ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
       chunk_text = EXCLUDED.chunk_text, embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = now()`,
    [tenantId, text, embeddingStr, embeddingModel]
  );
  return { processed: 1, chunks: 1 };
}
```

**Chunking rules:**
- Single-record sources (business info, hours, fulfillment): one chunk, `source_id` = descriptive name (e.g. `'business_profile'`, `'fulfillment_settings'`)
- Multi-record sources (badges, policies): one chunk per record, `source_id` = record key (e.g. badge key, policy type)
- Format as human-readable text with labeled fields — the LLM reads this directly
- Return `null` from chunker if no meaningful data exists

**Also extend `refreshKnowledgeEmbeddings` union type** to include the new source type, and add it to the "refresh all" branch.

#### 2. Wire RAG search into `BotDynamicResponseService.ts`

In the knowledge RAG section (step 2.6 of `generateResponse`), add a skill-gated block:

```typescript
if (hasSkill('<skill_key>')) {
  const hasEmb = await knowledgeService.hasKnowledgeEmbeddings(tenantId, '<source_type>');
  if (hasEmb) {
    const result = await knowledgeService.searchKnowledge(tenantId, message, ['<source_type>'], 3);
    if (result.chunks.length > 0) {
      knowledgeContext += '\n\n<label> context:\n' + result.chunks.map(c => c.chunkText).join('\n\n');
      knowledgeContextUsed = true;
    }
  }
}
```

**Skill gating:** Use the closest existing `ChatbotSkillType`. Don't create a new skill key unless no existing one fits. Current mappings: `chatbot_skill_product_search` (badges), `chatbot_skill_policy_faq` (policies), `chatbot_skill_store_hours` (business info + hours), `chatbot_skill_inventory` (fulfillment).

#### 3. Refresh trigger on data update route

Add fire-and-forget refresh after the data mutation in the relevant route file:

```typescript
import BotKnowledgeEmbeddingService from '../services/BotKnowledgeEmbeddingService';
// After upsert/update/delete:
BotKnowledgeEmbeddingService.getInstance().refresh<Source>Embeddings(tenantId).catch(() => {});
```

Use `.catch(() => {})` — refresh failures should not block the user's API response.

#### 4. Extend embeddings status endpoint in `bot-merchant.ts`

Add `has<Source>Embeddings` to the `GET /embeddings/status` response:

```typescript
const has<Source>Embeddings = await knowledgeService.hasKnowledgeEmbeddings(tenantId, '<source_type>');
// Include in res.json({ ..., has<Source>Embeddings, ... })
```

#### 5. Extend frontend `BotService.ts`

- Add `has<Source>Embeddings: boolean` to `getEmbeddingsStatus` return type
- Add `result.data.has<Source>Embeddings ?? false` to the return object
- Extend `refreshKnowledgeEmbeddings` sourceType union to include the new type

#### 6. Add card to `BotKnowledgePage.tsx`

Add state (`refreshing<Source>`), handler (`handleRefresh<Source>`), and a card with:
- Status badge (Ready/Empty)
- Embedding count from `knowledgeEmbeddingCounts` filtered by source type
- Refresh button calling `botService.refreshKnowledgeEmbeddings(tenantId, '<source_type>')`
- Explanatory text in the "How It Works" section

### Key Files

| File | What to change |
|---|---|
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | `refresh[Source]Embeddings` + `chunk[Source]` + extend `refreshKnowledgeEmbeddings` |
| `apps/api/src/services/BotDynamicResponseService.ts` | Skill-gated RAG search block |
| `apps/api/src/routes/<source>-settings.ts` | Fire-and-forget refresh trigger on PUT/POST |
| `apps/api/src/routes/bot-merchant.ts` | `has<Source>Embeddings` in status endpoint |
| `apps/web/src/services/BotService.ts` | Return type + `refreshKnowledgeEmbeddings` union |
| `apps/web/src/components/bot/BotKnowledgePage.tsx` | Status card + refresh button + explanatory text |

### Verification

```bash
pnpm checkapi   # zero TS errors
pnpm checkweb   # zero TS errors
```

### Design Principles

1. **Semantic over keyword** — RAG replaces fragile keyword-gated context injection. The bot finds relevant knowledge by meaning, not exact word matches.
2. **Skill-gated** — Each knowledge source is gated by an existing `ChatbotSkillType`. No new skill key needed unless no existing one fits.
3. **Fire-and-forget refresh** — Embedding refresh never blocks API responses. Use `.catch(() => {})`.
4. **Single chunk for single-record sources** — Business info, hours, and fulfillment are one embedding each. Badges and policies get one embedding per record.
5. **Human-readable chunk text** — The LLM reads this directly. Use labeled fields (e.g. `Pickup: Available, Ready in 120 minutes`), not JSON.
