# Chatbot Skill Extension Guide

> A comprehensive guide for AI agents and developers who want to add new bot skills to the VisibleShelf chatbot platform.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Existing Skills](#existing-skills)
3. [Anatomy of a Skill](#anatomy-of-a-skill)
4. [Step-by-Step: Adding a New Skill](#step-by-step-adding-a-new-skill)
5. [Skill Card Schema Reference](#skill-card-schema-reference)
6. [Capability Gate Reference](#capability-gate-reference)
7. [Intent Mapping](#intent-mapping)
8. [Dynamic Response Integration](#dynamic-response-integration)
9. [Testing Checklist](#testing-checklist)
10. [Common Pitfalls](#common-pitfalls)

---

## Architecture Overview

The chatbot skill system is a multi-layer architecture that spans database, backend services, API routes, and frontend UI. Every skill is gated by the platform's tier/capability system, meaning a merchant on a lower tier may see a skill as locked until they upgrade.

```
┌─────────────────────────────────────────────────────────────┐
│                      WIDGET (Shadow DOM)                     │
│  Renders skill_card_schema as interactive cards in chat      │
└────────────────────────┬────────────────────────────────────┘
                         │ GET /api/public/bot/skills/:skillName
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   PUBLIC API (bot-public.ts)                 │
│  Rate-limited, session-validated skill execution endpoint    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BotSkillService (singleton)                     │
│  1. Look up skill in bot_skills table                        │
│  2. Check isSkillAvailable() — tier + capability + status    │
│  3. Return SkillResult with cardSchema                       │
└────────────────────────┬────────────────────────────────────┘
                         │
           ┌─────────────┴──────────────┐
           ▼                            ▼
┌─────────────────────┐    ┌──────────────────────────┐
│ Dedicated Service   │    │ bot_skills table          │
│ (e.g., BotProduct   │    │ - name (unique)           │
│  CatalogService)    │    │ - endpoint                │
│ - queries data      │    │ - required_capabilities   │
│ - formats results   │    │ - tier_gates              │
│                     │    │ - capability_gates        │
└─────────────────────┘    │ - skill_card_schema       │
                           │ - default_config          │
                           └──────────────────────────┘
```

### Key Design Principles

- **Skills are data-driven, not code-registered.** A skill exists as a row in `bot_skills`. The service layer reads from the database, so adding a skill to the DB makes it discoverable.
- **Capability gates are enforced at two levels.** The `ChatbotSkillType` enum in the capability system controls which tiers can use which skills. The `BotSkillService.isSkillAvailable()` method enforces this at runtime.
- **Skills can feed the dynamic response engine.** Complex skills (like product search) have dedicated services that query data and format context for GPT prompt injection via `BotDynamicResponseService`.
- **Skill cards are JSON-schema-driven.** The `skill_card_schema` field in `bot_skills` tells the widget how to render results. No widget code changes needed for new card types if they reuse existing field patterns.

---

## Existing Skills

| # | Skill Name | Capability Key | Tier Gate | Description |
|---|---|---|---|---|
| 1 | `product-search` | `chatbot_skill_product_search` | storefront+ | Search tenant products by keyword, category, or attributes |
| 2 | `inventory` | `chatbot_skill_inventory` | professional+ | Check inventory for a specific product |
| 3 | `order-tracking` | `chatbot_skill_order_tracking` | professional+ | Track order status by order number |
| 4 | `store-hours` | `chatbot_skill_store_hours` | storefront+ | Get current store hours and open/closed status |
| 5 | `cross-merchant` | `chatbot_skill_cross_merchant` | professional+ | Search across all merchant stores (capability defined, seed pending) |

### Tier Mapping (from migration 042)

| Tier | Product Search | Store Hours | Inventory | Order Tracking | Cross-Merchant |
|---|---|---|---|---|---|
| discovery | - | - | - | - | - |
| storefront | ✓ | ✓ | - | - | - |
| commitment | ✓ | ✓ | - | - | - |
| ecommerce | ✓ | ✓ | - | - | - |
| omnichannel | ✓ | ✓ | - | - | - |
| professional | ✓ | ✓ | ✓ | ✓ | ✓ |
| chain_starter | ✓ | ✓ | ✓ | ✓ | ✓ |
| chain_professional | ✓ | ✓ | ✓ | ✓ | ✓ |
| organization | ✓ | ✓ | ✓ | ✓ | ✓ |
| enterprise | ✓ (flexible) | ✓ (flexible) | ✓ (flexible) | ✓ (flexible) | ✓ (flexible) |

---

## Anatomy of a Skill

Every skill consists of up to 7 components. The first 3 are **required**; the rest are **conditional** based on skill complexity.

### Required Components

1. **Database row in `bot_skills`** — The skill registry entry with name, endpoint, gates, and card schema.
2. **Capability feature key** — A `chatbot_skill_<name>` key registered in `features_list` and linked to `chatbot_options` capability type.
3. **TypeScript type union member** — Added to `ChatbotSkillType` in both `types.ts` and `ChatbotOptionsResolver.ts`.

### Conditional Components

4. **Dedicated backend service** — Needed if the skill queries data (e.g., `BotProductCatalogService` for product search). Simple skills that just call an existing endpoint may skip this.
5. **Intent mapping** — A row in `bot_intents` with `mapped_skill` pointing to the skill name, plus example phrases for keyword-based intent classification.
6. **Dynamic response integration** — If the skill's data should be injected into GPT prompts, extend `BotDynamicResponseService` to detect relevant queries and fetch context.
7. **Public API endpoint** — If the skill needs a custom public endpoint (beyond the generic `GET /api/public/bot/skills/:skillName`), add it to `bot-public.ts`.

---

## Step-by-Step: Adding a New Skill

This section walks through adding a hypothetical `shipping-calculator` skill as a concrete example.

### Step 1: Add Capability Feature Key

**File:** `database/migrations/04X_chatbot_<description>.sql`

```sql
-- 1. Insert the new skill feature key into features_list
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'chatbot_skill_shipping_calculator',
  'Shipping Calculator Skill',
  'Bot can calculate shipping costs based on destination and cart contents',
  'chatbot',
  true,
  25,  -- next available sort_order after existing skills
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 2. Link to chatbot_options capability type
DO $$
DECLARE
  v_cap_type_id TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'chatbot_options';
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type chatbot_options not found';
  END IF;

  INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
  SELECT v_cap_type_id, fl.id, true, 25, NOW(), NOW()
  FROM features_list fl
  WHERE fl.key = 'chatbot_skill_shipping_calculator';
END $$;

-- 3. Enable for target tiers (e.g., ecommerce+)
DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id TEXT;
  v_tier_key TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'chatbot_options' LIMIT 1;

  FOR v_tier_key IN SELECT unnest(ARRAY['ecommerce', 'omnichannel', 'professional', 'chain_starter', 'chain_professional', 'organization', 'enterprise'])
  LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
    VALUES (
      gen_random_uuid()::text,
      v_tier_id,
      v_cap_type_id,
      'chatbot_skill_shipping_calculator',
      'Shipping Calculator Skill',
      true,
      false,
      '{"capability_type": "chatbot_options"}',
      false,
      0,
      NULL
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;
END $$;
```

### Step 2: Update TypeScript Types

**File:** `apps/api/src/services/resolvers/types.ts`

Add the new skill type to the `ChatbotSkillType` union:

```typescript
export type ChatbotSkillType =
  | 'chatbot_skill_product_search' | 'chatbot_skill_inventory'
  | 'chatbot_skill_order_tracking' | 'chatbot_skill_store_hours'
  | 'chatbot_skill_cross_merchant'
  | 'chatbot_skill_shipping_calculator';  // ← ADD THIS
```

**File:** `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts`

Add the new skill type to the local union AND to the resolver logic:

```typescript
export type ChatbotSkillType =
  | 'chatbot_skill_product_search'
  | 'chatbot_skill_inventory'
  | 'chatbot_skill_order_tracking'
  | 'chatbot_skill_store_hours'
  | 'chatbot_skill_cross_merchant'
  | 'chatbot_skill_shipping_calculator';  // ← ADD THIS
```

In the `resolveChatbotOptions` function, add to the flexible block and the conditional check:

```typescript
// In the flexible block:
if (flexible) {
  allowedSkills.push(
    'chatbot_skill_product_search', 'chatbot_skill_inventory',
    'chatbot_skill_order_tracking', 'chatbot_skill_store_hours',
    'chatbot_skill_cross_merchant',
    'chatbot_skill_shipping_calculator'  // ← ADD
  );
} else {
  // ... existing checks ...
  if (feat.chatbot_skill_shipping_calculator) allowedSkills.push('chatbot_skill_shipping_calculator');  // ← ADD
}
```

**File:** `apps/web/src/services/CapabilityResolutionService.ts`

Mirror the same `ChatbotSkillType` union and resolver logic on the frontend. Search for `ChatbotSkillType` and `allowed_skill_types` in this file to find the exact locations.

### Step 3: Seed the Skill in `bot_skills` Table

**File:** `apps/api/prisma/seed-bot-data.ts`

Add to the `SKILLS` array:

```typescript
{
  name: 'shipping-calculator',
  version: '1.0.0',
  description: 'Calculate shipping costs based on destination and cart contents',
  endpoint: '/api/public/bot/skills/shipping-calculator',
  required_capabilities: ['chatbot_skill_shipping_calculator'],
  tier_gates: ['ecommerce', 'omnichannel', 'professional', 'enterprise', 'organization', 'chain_starter', 'chain_professional', 'chain_enterprise'],
  capability_gates: ['chatbot_skills_enabled'],
  tenant_status_gates: ['active', 'trialing'],
  featured_aware: false,
  refresh_cadence_minutes: 30,
  status: 'active',
  skill_card_schema: {
    type: 'shipping_estimate',
    fields: ['method', 'cost', 'estimated_days', 'carrier'],
    max_results: 3,
  },
  default_config: { show_free_shipping_threshold: true },
},
```

Run the seed script: `npx tsx prisma/seed-bot-data.ts`

### Step 4: Add Intent Mapping (if the skill should be triggered by user messages)

**File:** `apps/api/prisma/seed-bot-data.ts`

Add to the `INTENTS` array:

```typescript
{
  name: 'shipping.inquiry',
  category: 'fulfillment',
  description: 'User wants to know shipping costs or options',
  examples: [
    'how much is shipping',
    'what are your shipping options',
    'do you offer free shipping',
    'shipping cost to california',
    'how long does shipping take',
    'delivery options',
  ],
  confidence_threshold: 0.3,
  mapped_skill: 'shipping-calculator',
},
```

### Step 5: Create a Dedicated Backend Service (if the skill queries data)

**File:** `apps/api/src/services/BotShippingService.ts`

Follow the `BotProductCatalogService` pattern:

```typescript
import { prisma } from '../prisma';
import { logger } from '../logger';

export interface ShippingEstimate {
  method: string;
  cost: number;
  estimatedDays: number;
  carrier: string;
}

class BotShippingService {
  private static instance: BotShippingService;
  private constructor() {}
  static getInstance(): BotShippingService {
    if (!BotShippingService.instance) BotShippingService.instance = new BotShippingService();
    return BotShippingService.instance;
  }

  async getShippingEstimates(
    tenantId: string,
    destinationZip: string,
    cartValueCents?: number
  ): Promise<ShippingEstimate[]> {
    // Query tenant fulfillment settings, carrier rates, etc.
    // Return formatted estimates
  }

  formatShippingContext(estimates: ShippingEstimate[]): string {
    if (estimates.length === 0) return '';
    const lines = estimates.map((e, i) =>
      `${i + 1}. ${e.method} — $${(e.cost / 100).toFixed(2)} (${e.estimatedDays} days via ${e.carrier})`
    );
    return '\n\nAvailable shipping options:\n' + lines.join('\n');
  }
}

export default BotShippingService;
```

### Step 6: Add Public API Endpoint (if needed beyond generic skill execution)

**File:** `apps/api/src/routes/bot-public.ts`

```typescript
// GET /api/public/bot/shipping/estimate?tenantId=&zip=&cartValueCents=
router.get('/shipping/estimate', async (req, res) => {
  try {
    const { tenantId, zip, cartValueCents } = req.query;
    if (!tenantId || !zip) {
      return res.status(400).json({ error: 'missing_params', message: 'tenantId and zip are required' });
    }

    // Capability gate check
    const caps = await resolveEffectiveCapabilities(tenantId as string);
    if (!caps?.effective.chatbot.enabled || !caps.effective.chatbot.skills_enabled) {
      return res.status(403).json({ error: 'capability_disabled', message: 'Chatbot skills are not enabled for this tenant' });
    }
    if (!caps.effective.chatbot.allowed_skill_types.includes('chatbot_skill_shipping_calculator' as any)) {
      return res.status(403).json({ error: 'capability_disabled', message: 'Shipping calculator skill is not available for this tier' });
    }

    const estimates = await shippingService.getShippingEstimates(
      tenantId as string,
      zip as string,
      cartValueCents ? parseInt(cartValueCents as string) : undefined
    );
    res.json({ success: true, data: estimates });
  } catch (error) {
    console.error('[BotPublic] Shipping estimate error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get shipping estimates' });
  }
});
```

### Step 7: Integrate with Dynamic Response (optional — if skill data should enrich GPT prompts)

**File:** `apps/api/src/services/BotDynamicResponseService.ts`

Add detection logic and context injection:

```typescript
// In the method that builds the GPT prompt context:

// Check if the user's message relates to shipping
const shippingKeywords = ['shipping', 'delivery', 'ship to', 'how much is shipping', 'free shipping'];
const isShippingQuery = shippingKeywords.some(kw => userMessage.toLowerCase().includes(kw));

if (isShippingQuery) {
  const estimates = await shippingService.getShippingEstimates(tenantId, '00000'); // default or parse from message
  const shippingContext = shippingService.formatShippingContext(estimates);
  if (shippingContext) {
    contextParts.push(shippingContext);
    productContextUsed = true;  // or a new flag like shippingContextUsed
  }
}
```

### Step 8: Update Frontend Type Mirrors

Search for all files that reference `ChatbotSkillType` or `allowed_skill_types` on the frontend and add the new type:

- `apps/web/src/services/CapabilityResolutionService.ts`
- `apps/web/src/services/UnifiedCapabilityService.ts`
- Any UI components that list or render skill types (e.g., skill management pages, capability options pages)

### Step 9: Update the Admin UI (if skill management UI hardcodes skill types)

The admin bot-platform UI at `apps/web/src/services/bot/BotPlatformAdminService.ts` reads skills from the API, so it should pick up new skills automatically. However, if any frontend component hardcodes the skill type list for display purposes, add the new type there.

---

## Skill Card Schema Reference

The `skill_card_schema` JSON field in `bot_skills` tells the widget how to render skill results. The widget reads this schema and renders fields accordingly.

### Existing Card Types

| Card Type | Fields | Used By |
|---|---|---|
| `product_list` | `name`, `price`, `image`, `slug` | product-search |
| `inventory_status` | `in_stock`, `quantity`, `expected_restock` | inventory |
| `order_status` | `status`, `tracking_number`, `estimated_delivery` | order-tracking |
| `store_hours` | `is_open`, `today_hours`, `next_open` | store-hours |

### Schema Structure

```json
{
  "type": "<card_type_name>",
  "fields": ["field1", "field2", "field3"],
  "max_results": 5
}
```

- **`type`**: Identifies the card renderer in the widget. If you introduce a new type, the widget must be updated to handle it. Reuse an existing type if the data shape is similar.
- **`fields`**: The data fields to display in the card. These must match the keys in the `SkillResult.data` returned by `BotSkillService.executeSkill()`.
- **`max_results`**: Maximum number of items to render in a list card.

### Adding a New Card Type

If none of the existing card types fit, you'll need to update the widget's card renderer:

**File:** `apps/web/public/bot-widget/` (widget source)

The widget's card renderer switches on `schema.type`. Add a new case for your card type. Keep the rendering logic simple — the widget bundle must stay under 50KB gzipped.

---

## Capability Gate Reference

Every skill is gated by a three-layer check in `BotSkillService.isSkillAvailable()`:

### Layer 1: Chatbot Master Gates

```typescript
if (!chatbotCaps.enabled || !chatbotCaps.skills_enabled) return false;
```

The tenant must have both `chatbot_enabled` and `chatbot_skills_enabled` in their resolved capabilities.

### Layer 2: Capability Gates (per-skill)

```typescript
if (skill.capabilityGates.length > 0) {
  const hasAllCaps = skill.capabilityGates.every(gate => {
    if (chatbotCaps.is_flexible) return true;
    return (
      chatbotCaps.allowed_skill_types.includes(gate as any) ||
      chatbotCaps.allowed_response_engines.includes(gate as any) ||
      chatbotCaps.allowed_kb_types.includes(gate as any)
    );
  });
  if (!hasAllCaps) return false;
}
```

The skill's `capability_gates` array (e.g., `['chatbot_skills_enabled']`) must all be present in the tenant's resolved capabilities. The `is_flexible` flag (enterprise tier) bypasses all capability checks.

### Layer 3: Tier Gates

```typescript
if (skill.tierGates.length > 0) {
  const tierKey = caps.tier.key;
  if (!skill.tierGates.includes(tierKey) && !chatbotCaps.is_flexible) return false;
}
```

The tenant's tier key must be in the skill's `tier_gates` array. Flexible tenants bypass this check.

### Layer 4: Tenant Status Gates

```typescript
if (skill.tenantStatusGates.length > 0) {
  const tenantStatus = tenant?.subscription_status || 'active';
  if (!skill.tenantStatusGates.includes(tenantStatus)) return false;
}
```

The tenant's subscription status must be in the skill's `tenant_status_gates` array (typically `['active', 'trialing']`).

### Layer 5: Per-Tenant Enable Flag

```typescript
return skill.enabled;
```

The merchant must have enabled the skill via `bot_skill_configurations`. This is the final gate — even if all capability/tier checks pass, the merchant can individually disable a skill.

---

## Intent Mapping

Intents are the bridge between user messages and skills. The `BotIntentService` classifies user input against `bot_intents` examples and returns a `mapped_skill` name.

### How Intent Classification Works (Phase 1A — Keyword-Based)

1. User sends a message (e.g., "how much is shipping to California?")
2. `BotIntentService.classifyIntent()` tokenizes the message
3. For each active intent, it computes Jaccard similarity between the message tokens and the intent's `examples` array
4. The intent with the highest similarity score (above `confidence_threshold`) wins
5. The `mapped_skill` field tells the pipeline which skill to execute

### Adding a New Intent

Add a row to `bot_intents` via the seed script (see Step 4 above). Key fields:

- **`name`**: Unique identifier (e.g., `shipping.inquiry`)
- **`category`**: Grouping for analytics (e.g., `fulfillment`, `product`, `order`, `store`, `general`)
- **`examples`**: Array of example phrases — these are the keyword matching source. Include varied phrasings.
- **`confidence_threshold`**: Minimum Jaccard similarity to match (0.3 is the platform default — lower is more permissive)
- **`mapped_skill`**: The skill name to execute when this intent matches (must match a `bot_skills.name`)

### Intent Best Practices

- **Provide 5-10 varied examples** per intent for better keyword coverage
- **Use natural customer language** — not technical terms
- **Avoid overlapping examples** between intents — if two intents match the same phrase, the higher confidence wins, but this degrades UX
- **Set `confidence_threshold` to 0.3** unless you have a specific reason to change it
- **Map to `null`** for `general.inquiry` — this is the fallback intent when no specific intent matches

---

## Dynamic Response Integration

Skills can optionally feed data into the GPT dynamic response pipeline. This is how `product-search` enriches AI-generated answers with real product data.

### When to Integrate

Integrate with `BotDynamicResponseService` when:
- The skill's data should appear in AI-generated responses (not just as a card)
- The user's question would benefit from contextual data (e.g., "do you have any toys on sale?" → product search results injected into GPT prompt)

Do NOT integrate when:
- The skill returns a simple status (e.g., store hours — the card alone is sufficient)
- The skill is a pure lookup (e.g., order tracking — the card with tracking number is the answer)

### How to Integrate

In `BotDynamicResponseService`, within the method that builds the GPT prompt:

1. **Detect relevant queries** using keyword heuristics
2. **Fetch data** from the dedicated service
3. **Format as context string** using the service's formatter method
4. **Append to the context parts** array that gets prepended to the GPT system prompt
5. **Set a context-used flag** on the response result for analytics

### System Prompt Rules

When injecting skill data into GPT prompts, the system prompt must include a guardrail rule:

> "Only mention [products/shipping options/etc.] that are in the context. Do not invent [products, prices, or availability]."

This prevents the LLM from hallucinating data that doesn't exist in the injected context.

---

## Testing Checklist

After adding a new skill, verify each layer:

### Database
- [ ] `features_list` row exists with the new `chatbot_skill_<name>` key
- [ ] `capability_features_list` links the feature to `chatbot_options` capability type
- [ ] `tier_features_list` rows exist for all target tiers
- [ ] `bot_skills` row exists (via seed script or admin API)
- [ ] `bot_intents` row exists with `mapped_skill` pointing to the skill name (if intent-triggered)

### Backend
- [ ] `ChatbotSkillType` union updated in `apps/api/src/services/resolvers/types.ts`
- [ ] `ChatbotSkillType` union updated in `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts`
- [ ] Resolver logic updated (flexible block + conditional check)
- [ ] `BotSkillService.isSkillAvailable()` passes for a tenant on a target tier
- [ ] `BotSkillService.isSkillAvailable()` fails for a tenant on a non-target tier
- [ ] `BotSkillService.executeSkill()` returns the correct `skill_card_schema`
- [ ] Dedicated service (if created) returns correct data
- [ ] Public API endpoint (if added) returns correct response
- [ ] Capability gate check in public endpoint works (403 for unauthorized tiers)
- [ ] Zero TypeScript errors: `npx tsc --noEmit` in `apps/api`

### Frontend
- [ ] `ChatbotSkillType` union mirrored in `apps/web/src/services/CapabilityResolutionService.ts`
- [ ] `ChatbotSkillType` union mirrored in `apps/web/src/services/UnifiedCapabilityService.ts`
- [ ] Skill appears in merchant skill management page
- [ ] Skill shows as locked for non-target tiers
- [ ] Skill shows as enabled/enabled-able for target tiers
- [ ] Zero TypeScript errors: `npx tsc --noEmit` in `apps/web`

### Widget
- [ ] Skill card renders correctly in widget (if card type is new, update widget renderer)
- [ ] Skill card displays all fields defined in `skill_card_schema`
- [ ] Card respects `max_results` limit

### Dynamic Response (if integrated)
- [ ] Relevant user queries trigger the skill's data fetch
- [ ] GPT response includes data from the injected context
- [ ] GPT does NOT hallucinate data not in the context
- [ ] `productContextUsed` (or equivalent) flag is set on the response result

---

## Common Pitfalls

### 1. Forgetting to Update Both `types.ts` and `ChatbotOptionsResolver.ts`

The `ChatbotSkillType` union is defined in two places — `types.ts` (shared types) and `ChatbotOptionsResolver.ts` (resolver implementation). Both must be updated. The frontend has its own copies in `CapabilityResolutionService.ts` and `UnifiedCapabilityService.ts`.

### 2. Mismatched Skill Name Between `bot_skills` and `bot_intents.mapped_skill`

The `mapped_skill` field in `bot_intents` must exactly match the `name` field in `bot_skills`. A typo here means the intent fires but the skill is never found.

### 3. Missing Tier Features for New Tiers

If a new subscription tier is added to the platform, all existing skill feature keys must be linked to that tier in `tier_features_list`. Otherwise, tenants on the new tier won't have access to any skills.

### 4. Capability Key Naming Convention

Capability keys must follow the pattern `chatbot_skill_<snake_case_name>`. The `<snake_case_name>` portion should match the skill's `bot_skills.name` (converted from kebab-case to snake_case). For example:
- Skill name: `product-search` → Capability key: `chatbot_skill_product_search`
- Skill name: `order-tracking` → Capability key: `chatbot_skill_order_tracking`

### 5. Not Setting `featured_aware` for Product-Related Skills

If a skill's results depend on the tenant's featured product configuration (badges, store selection, etc.), set `featured_aware: true` in the `bot_skills` row. This signals the system to refresh skill data when featured configuration changes.

### 6. Widget Card Type Not Implemented

If you introduce a new `skill_card_schema.type` that the widget doesn't know how to render, the card will silently fail. Either reuse an existing card type or update the widget's card renderer in `apps/web/public/bot-widget/`.

### 7. Forgetting `chatbot_skills_enabled` in `capability_gates`

Every skill should include `'chatbot_skills_enabled'` in its `capability_gates` array. This ensures the skill is disabled if the merchant turns off the skills master toggle, even if the specific skill type is allowed by tier.

### 8. Seed Script vs. Admin API

Skills can be added via the seed script (`seed-bot-data.ts`) or via the admin API (`POST /api/admin/bot-platform/skills`). The seed script is for initial platform bootstrap; the admin API is for runtime management. Use the seed script for skills that ship with the platform; use the admin API for experimental or tenant-specific skills.

---

## File Reference

| File | Purpose |
|---|---|
| `apps/api/src/services/resolvers/types.ts` | Shared TypeScript types including `ChatbotSkillType` |
| `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts` | Resolver that builds `EffectiveChatbot` from tier features |
| `apps/api/src/services/BotSkillService.ts` | Skill execution service with tier/capability/status gating |
| `apps/api/src/services/BotProductCatalogService.ts` | Example dedicated service (product search) |
| `apps/api/src/services/BotDynamicResponseService.ts` | Dynamic GPT response with context injection |
| `apps/api/src/services/BotIntentService.ts` | Keyword-based intent classification |
| `apps/api/src/routes/bot-public.ts` | Public bot API routes (skill execution, product search) |
| `apps/api/src/routes/bot-merchant.ts` | Merchant bot API routes (skill config, embeddings) |
| `apps/api/src/routes/admin/bot-platform.ts` | Admin CRUD for skills, intents, guardrails |
| `apps/api/prisma/seed-bot-data.ts` | Seed script for guardrails, intents, and skills |
| `apps/api/prisma/schema.prisma` | Prisma schema for `bot_skills`, `bot_skill_configurations` |
| `apps/web/src/services/CapabilityResolutionService.ts` | Frontend capability resolution (mirrors backend types) |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Frontend unified capability service |
| `apps/web/src/services/bot/BotPlatformAdminService.ts` | Frontend admin bot platform service |
| `database/migrations/041_chatbot_platform_tables.sql` | Database tables for bot skills and configurations |
| `database/migrations/042_chatbot_capability_features.sql` | Capability feature keys and tier assignments |
| `docs/CHATBOT_CAPABILITY_SPEC.md` | Capability specification for the chatbot system |
| `docs/CHATBOT_PHASED_IMPLEMENTATION_PLAN_V2.md` | Full phased implementation plan |
