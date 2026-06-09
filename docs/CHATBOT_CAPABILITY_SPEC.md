# Chatbot Capability Specification

## Capability Type: `chatbot_options`

---

## Feature Keys (shared across all layers)

### Global structural

- `chatbot_enabled` — Global gate. Bot widget is active for all merchants.
- `chatbot_disabled` — Global override off.
- `chatbot_flexible` — All types in all groups.

### Response engine structural

- `chatbot_static_enabled` / `chatbot_static_disabled` — Static FAQ lookup responses
- `chatbot_dynamic_enabled` / `chatbot_dynamic_disabled` — Dynamic AI-powered responses

### Response engine types

- `chatbot_static_lookup` — Exact-match / keyword FAQ lookup (Free tier)
- `chatbot_shared_dynamic` — Shared dynamic model (Starter)
- `chatbot_lora_finetuned` — LoRA fine-tuned model (Pro)
- `chatbot_dedicated` — Dedicated model instance (Enterprise)

### Skill group structural

- `chatbot_skills_enabled` / `chatbot_skills_disabled`

### Skill group types

- `chatbot_skill_product_search` — Natural language product search
- `chatbot_skill_inventory_lookup` — Real-time inventory check
- `chatbot_skill_order_tracking` — Order status by number/email
- `chatbot_skill_store_hours` — Hours, pickup slots, booking
- `chatbot_skill_cross_merchant` — Cross-merchant comparison (Pro+)

### Knowledge base structural

- `chatbot_kb_enabled` / `chatbot_kb_disabled`

### Knowledge base types

- `chatbot_kb_faq_rag` — FAQ RAG retrieval (semantic search, embeddings)
- `chatbot_kb_product_scoped` — Product-scoped FAQ support
- `chatbot_kb_gap_report` — Gap analysis and unanswered query tracking
- `chatbot_kb_auto_sync` — Auto-rebuild embedding index on FAQ save

### Widget group structural

- `chatbot_widget_enabled` / `chatbot_widget_disabled`

### Widget group types

- `chatbot_widget_embed` — Embeddable shadow-DOM widget
- `chatbot_widget_custom_theme` — Custom colors, avatar, greeting
- `chatbot_widget_skill_cards` — Rich interactive skill cards in chat stream
- `chatbot_widget_after_hours` — After-hours offline message + leave-a-note

---

## Cross-group dependencies

- `chatbot_dynamic_enabled` requires `chatbot_static_enabled = true` (dynamic builds on static FAQ as the knowledge base).
- `chatbot_kb_faq_rag` requires `chatbot_dynamic_enabled = true` (embeddings are only needed for AI-powered tiers).
- `chatbot_skill_cross_merchant` requires `chatbot_lora_finetuned` or `chatbot_dedicated` (cross-merchant needs stronger model context).
- `chatbot_widget_skill_cards` requires at least one skill group type enabled.

---

## Tier Assignment

| Tier | Response Engine | Skills | Knowledge Base | Widget |
|---|---|---|---|---|
| Free | `chatbot_static_lookup` | None (skills disabled) | Static FAQ display only (no RAG) | `chatbot_widget_embed` |
| Starter | `chatbot_static_lookup`, `chatbot_shared_dynamic` | `chatbot_skill_product_search`, `chatbot_skill_inventory_lookup`, `chatbot_skill_store_hours` | `chatbot_kb_faq_rag`, `chatbot_kb_product_scoped`, `chatbot_kb_gap_report` | All widget types |
| Pro | `chatbot_static_lookup`, `chatbot_shared_dynamic`, `chatbot_lora_finetuned` | All Starter skills + `chatbot_skill_order_tracking` | All Starter KB + `chatbot_kb_auto_sync` | All widget types |
| Enterprise | `chatbot_static_lookup`, `chatbot_shared_dynamic`, `chatbot_lora_finetuned`, `chatbot_dedicated` | All Pro skills + `chatbot_skill_cross_merchant` | All Pro KB + `chatbot_kb_auto_sync` | All widget types |
| Organization | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` |

---

## Resolution Logic

3-state per group (same as `featured_options` and `quickstart_options`):

- **enabled** → all types in group are available
- **untouched** → only explicitly listed types are available
- **disabled** → none

### Resolution order

1. Global structural gate (`chatbot_enabled` / `chatbot_disabled`)
2. Group structural gate (response engine, skills, knowledge base, widget)
3. Specific type key check (flexible OR explicit type key in `allowed_type_keys`)
4. Cross-group dependency validation
5. Tenant subscription status validation (Active, Trial, Suspended, Past-due)

### Frontend Gates

| UI Element | Gate |
|---|---|
| Bot Dashboard | `chatbot_enabled` |
| Bot Configuration page | `chatbot_enabled` |
| AI Model selector | `chatbot_dynamic_enabled` + at least one dynamic type key |
| Shared Dynamic option | `canUseSharedDynamic` = `chatbot_shared_dynamic` in resolved types |
| LoRA option | `canUseLoRA` = `chatbot_lora_finetuned` in resolved types |
| Dedicated option | `canUseDedicated` = `chatbot_dedicated` in resolved types |
| Product Search skill | `chatbot_skill_product_search` in resolved types |
| Inventory skill | `chatbot_skill_inventory_lookup` in resolved types |
| Order Tracking skill | `chatbot_skill_order_tracking` in resolved types |
| Cross-Merchant skill | `chatbot_skill_cross_merchant` in resolved types |
| FAQ RAG (Knowledge Base) | `chatbot_kb_faq_rag` in resolved types |
| Gap Report | `chatbot_kb_gap_report` in resolved types |
| Auto-sync (embeddings) | `chatbot_kb_auto_sync` in resolved types |
| Widget custom theme | `chatbot_widget_custom_theme` in resolved types |
| Widget skill cards | `chatbot_widget_skill_cards` in resolved types |
| After-hours mode | `chatbot_widget_after_hours` in resolved types |

---

## Merchant Options Page

### Route

`/t/[tenantId]/settings/chatbot-options`

### Page Structure

```
Chatbot Options
├── Response Engine
│   ├── Static FAQ Lookup (always on, Free tier)
│   ├── Shared Dynamic Model (Starter+)
│   ├── LoRA Fine-tuned (Pro+)
│   └── Dedicated Model (Enterprise)
├── Skills
│   ├── Product Search (Starter+)
│   ├── Inventory Lookup (Starter+)
│   ├── Store Hours & Booking (Starter+)
│   ├── Order Tracking (Pro+)
│   └── Cross-Merchant Comparison (Enterprise)
├── Knowledge Base
│   ├── FAQ RAG Retrieval (Starter+)
│   ├── Product-Scoped FAQ (Starter+)
│   ├── Gap Report (Starter+)
│   └── Auto-Sync Embeddings (Pro+)
└── Widget
    ├── Embeddable Widget (all tiers)
    ├── Custom Theme (all tiers)
    ├── Skill Cards (Starter+)
    └── After-Hours Mode (Starter+)
```

### Capability-gated UI

- **Free tier**: Response Engine shows only "Static FAQ Lookup" (checked, disabled). All other options show as locked with upgrade CTA.
- **Starter tier**: Static + Shared Dynamic enabled. Skills up to Store Hours enabled. KB up to Gap Report enabled. Widget fully enabled.
- **Pro tier**: All except Dedicated model and Cross-Merchant skill.
- **Enterprise tier**: All options unlocked.

---

## Backend Integration

### Service

`ChatbotOptionsService.ts` — resolves `ChatbotOptionsState` from `tier_features_list` and `subscription_tiers_list`, same pattern as `FeaturedOptionsService` and `QuickstartOptionsService`.

### API Routes

- `GET /api/tenants/:tenantId/chatbot-options` — Returns resolved capability state for the tenant
- `GET /api/admin/chatbot-options` — Platform admin view of global capability config

### Database

Uses existing `capability_type_list`, `features_list`, `capability_features_list`, and `tier_features_list` tables. Add `chatbot_` prefix to `CAPABILITY_TYPE_PREFIXES` in `tenant-capabilities.ts`.

---

## Files to Create / Modify

### New Files

- `docs/CHATBOT_CAPABILITY_SPEC.md` — This document
- `apps/api/src/services/ChatbotOptionsService.ts` — Backend resolution service
- `apps/web/src/utils/chatbotOptions.ts` — Frontend utility with type classification and display helpers
- `apps/web/src/services/ChatbotCapabilityResolutionService.ts` — Frontend resolution state
- `apps/web/src/hooks/tenant-access/useChatbotCapability.ts` — React hook for capability gates
- `apps/web/src/app/t/[tenantId]/settings/chatbot-options/page.tsx` — Merchant options page

### Modified Files

- `apps/api/src/routes/tenant-capabilities.ts` — Add `chatbot_` prefix to `CAPABILITY_TYPE_PREFIXES`
- `apps/web/src/services/CapabilityResolutionService.ts` — Add `ChatbotOptionsState`, `resolveChatbotOptionsState`, `getChatbotOptionsState`
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — Add `useChatbotOptionsCapability` hook

---

## Alignment with Existing Capabilities

This specification follows the exact same pattern as:

- `featured_options` — `docs/FEATURED_CAPABILITY_SPEC.md` (if exists) or `docs/SLUG_FORMAT_MIGRATION_PLAN.md`
- `quickstart_options` — `apps/api/src/services/QuickstartOptionsService.ts`

All resolution logic, CTE patterns, tier-features-list joins, and frontend gate patterns are identical. The only difference is the feature key namespace (`chatbot_` instead of `featured_` or `quickstart_`).
