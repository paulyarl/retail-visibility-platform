# Chatbot Platform — Implementation Analysis & Phase Plan

> Consolidated analysis of all 6 chatbot design docs, verified against the live codebase.
> Updated June 2026 to reflect the unified resolver architecture and actual tier structure.

---

## 1. Doc Inventory

| Doc | Purpose | Status |
|---|---|---|
| `CHATBOT_CAPABILITY_SPEC.md` | Feature keys, tier assignments, resolution logic | **Needs update** — references obsolete tier names and old OptionsService pattern |
| `CHATBOT_MERCHANT_UIUX.md` | Merchant-facing wireframes (9 screens + widget UX) | Complete — no architecture dependencies |
| `CHATBOT_PLATFORM_ADMIN_UIUX.md` | Admin wireframes (9 screens + auto-scaling config) | Complete |
| `CHATBOT_PHASED_IMPLEMENTATION_PLAN.md` (V1) | Original 4-phase plan | **Superseded** — sequencing errors, scope underestimated 2-3x |
| `CHATBOT_GAP_ANALYSIS.md` | Audit of V1 vs codebase (~100+ gaps) | Findings still valid; architecture references outdated |
| `CHATBOT_PHASED_IMPLEMENTATION_PLAN_V2.md` | Improved 9-phase plan (0, 1A, 1B, 1C, 2, 3A, 3B, 4A, 4B) | **Adopted as baseline** — requires architecture updates (see below) |

---

## 2. Architecture Shift: Unified Resolver (Since V2 Was Written)

The V2 plan and capability spec were written against the **old `*OptionsService` singleton pattern** (e.g., `FaqOptionsService.ts`, `CrmOptionsService.ts`). The platform has since migrated to a **unified resolver architecture**:

### Old Pattern (Deprecated)
```
*OptionsService.ts (singleton class) → queries DB directly → resolves features → returns state
```

### Current Pattern (5 Layers)
```
1. Definition Layer  → canonical-features.ts + tier-hierarchies.ts
2. Database Layer     → capability_type_list + features_list + tier_features_list + capability_features_list
3. Resolver Layer     → pure-function resolvers in resolvers/ called by EffectiveCapabilityResolver.ts
4. Route Layer        → *-options-settings.ts (GET/PUT merchant gates) + unified endpoint
5. Frontend Layer     → UnifiedCapabilityService.ts maps (no resolution) + use*Capability hooks
```

### Key Files to Update for Chatbot Capability

| Layer | File | What to Add |
|---|---|---|
| **Types** | `apps/api/src/services/resolvers/types.ts` | `ChatbotOptionsMerchantSettings`, `EffectiveChatbot`, add `chatbot` to `MerchantSettingsBundle` and `EffectiveCapabilities` |
| **Resolver** | `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts` | Pure function `resolveChatbotOptions(features, capabilityEnabled)` |
| **Resolver barrel** | `apps/api/src/services/resolvers/index.ts` | Export `resolveChatbotOptions` |
| **Orchestrator** | `apps/api/src/services/EffectiveCapabilityResolver.ts` | Import + dispatch `resolveChatbotOptions`, fetch `tenant_chatbot_options_settings` in `fetchMerchantSettings()` |
| **Route** | `apps/api/src/routes/chatbot-options-settings.ts` | GET/PUT merchant gate (follows `faq-options-settings.ts` pattern) |
| **Route mount** | `apps/api/src/routes/index.ts` | `app.use('/api/tenants', chatbotOptionsSettingsRoutes)` |
| **Frontend mapper** | `apps/web/src/services/UnifiedCapabilityService.ts` | `BackendEffectiveChatbot` interface + `mapChatbot()` function + add to `mapAll()` |
| **Frontend types** | `apps/web/src/services/CapabilityResolutionService.ts` | `ChatbotOptionsState` interface (type source for frontend) |
| **Frontend hook** | `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | `useChatbotCapability()` hook |
| **Seed script** | `apps/api/prisma/seed-chatbot-capabilities.ts` | Follows `seed-crm-capabilities.ts` pattern exactly |
| **Prisma schema** | `apps/api/prisma/schema.prisma` | `tenant_chatbot_options_settings` model + 10 bot tables |

### Already Registered (No Action Needed)

| Component | Location | Status |
|---|---|---|
| `chatbot_` prefix in `CAPABILITY_TYPE_PREFIXES` | `apps/api/src/routes/tenant-capabilities.ts` | ✅ |
| `chatbot_` → `chatbot_options` mapping | `apps/web/src/services/CapabilityResolutionService.ts:789` | ✅ |
| `chatbot_` → `chatbotOptions` mapping | `apps/web/src/services/UnifiedCapabilityService.ts:892` | ✅ |

---

## 3. Actual Tier Structure (Verified June 2026)

The chatbot spec docs assumed tiers: "Free, Starter, Pro, Enterprise, Organization". The **actual active tiers** are:

### Individual Tiers

| Tier Key | Display Name | Level | Price | Max SKUs | Max Locations |
|---|---|---|---|---|---|
| `discovery` | Discovery | 1 | $29 | 75 | 1 |
| `storefront` | Storefront | 3 | $59 | 200 | 1 |
| `commitment` | Commitment | 4 | $79 | 500 | 2 |
| `ecommerce` | E-commerce | 4 | $99 | 1,000 | 2 |
| `omnichannel` | Omnichannel | 5 | $149 | 1,500 | 5 |
| `professional` | Professional | 5 | $199 | 2,000 | 7 |
| `enterprise` | Enterprise | 6 | $499 | 10,000 | 20 |

### Organization Tiers

| Tier Key | Display Name | Level | Price | Max SKUs | Max Locations |
|---|---|---|---|---|---|
| `chain_starter` | Chain Starter | 7 | $299 | 3,000 | 5 |
| `chain_professional` | Chain Professional | 8 | $399 | 5,000 | 10 |
| `organization` | Organization | 9 | $499 | 7,000 | 15 |

### Tier Hierarchy (from `tier-hierarchies.ts`)

```
discovery (1) → starter (2) → storefront (3) → commitment (4) / ecommerce (4)
  → professional (5) / omnichannel (5) → enterprise (6)
```

Organization tiers (`chain_starter`, `chain_professional`, `organization`) are separate — they use `crm_flexible` for full feature access (see `seed-crm-capabilities.ts` pattern).

### Recommended Chatbot Tier Assignment (Updated)

| Tier | Response Engine | Skills | Knowledge Base | Widget |
|---|---|---|---|---|
| `discovery` | `chatbot_static_lookup` | None | Static FAQ only | `chatbot_widget_embed` |
| `storefront` | `chatbot_static_lookup` | None | Static FAQ only | `chatbot_widget_embed` |
| `commitment` | + `chatbot_shared_dynamic` | Product search, inventory, store hours | + RAG, product-scoped, gap report | All widget types |
| `ecommerce` | + `chatbot_shared_dynamic` | Product search, inventory, store hours | + RAG, product-scoped, gap report | All widget types |
| `omnichannel` | + `chatbot_shared_dynamic` | + Order tracking | + Auto-sync | All widget types |
| `professional` | + `chatbot_lora_finetuned` | + Order tracking | + Auto-sync | All widget types |
| `enterprise` | + `chatbot_dedicated` | + Cross-merchant | + Auto-sync | All widget types |
| `chain_starter` | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` |
| `chain_professional` | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` |
| `organization` | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` | `chatbot_flexible` |

**Rationale**: `discovery` and `storefront` are low-tier with limited SKUs — static FAQ lookup is sufficient. `commitment`/`ecommerce` unlock the shared dynamic model (AI-powered). `omnichannel`/`professional` unlock LoRA fine-tuning. `enterprise` gets dedicated models. Organization tiers get `flexible` (all features) matching the CRM pattern.

---

## 4. Codebase Reality Check (Verified June 2026)

### What Exists

| Component | Location | Verified |
|---|---|---|
| `chatbot_` prefix in capability type prefixes | `apps/api/src/routes/tenant-capabilities.ts` | ✅ |
| `chatbot_` → `chatbot_options` type mapping (frontend) | `apps/web/src/services/CapabilityResolutionService.ts:789` | ✅ |
| `chatbot_` → `chatbotOptions` state mapping (unified) | `apps/web/src/services/UnifiedCapabilityService.ts:892` | ✅ |
| `faq_chatbot_knowledge_base` field in schema + settings | `schema.prisma`, `faq-options-settings.ts` | ✅ |
| `FaqBotPreview.tsx` (client-side static FAQ matcher) | `apps/web/src/components/faq/FaqBotPreview.tsx` | ✅ |
| FAQ Hub "Bot Preview" + "Gap Report" tabs | `apps/web/src/components/faq/FaqHub.tsx` | ✅ |
| CRM system (Phase 1+2 complete) | Services, routes, admin/tenant/customer pages | ✅ |
| 12 existing resolver domains | `apps/api/src/services/resolvers/` | ✅ |
| 8 existing `*options-settings.ts` routes | `apps/api/src/routes/` | ✅ |
| Unified endpoint `GET /api/tenants/:tenantId/effective-capabilities` | `EffectiveCapabilityResolver.ts` | ✅ |

### What Does NOT Exist (0% of bot platform implemented)

- **0 bot Prisma tables** in schema (V2 defines 10 + 1 settings table)
- **0 bot backend services** (V2 defines 6 in Phase 1A + 4 more in later phases)
- **0 bot API routes** (V2 defines 16+ routes)
- **0 bot frontend services** (V2 defines 4)
- **0 bot merchant pages** (V2 defines 7)
- **0 bot admin pages** (V2 defines 10)
- **0 widget bundle** (V2 defines in Phase 1B)
- **0 AI/ML infrastructure** (V2 defines in Phase 3A)
- **0 `ChatbotOptionsResolver.ts`** in resolvers/
- **0 `EffectiveChatbot`** type in `types.ts`
- **0 `chatbot`** in `EffectiveCapabilities` interface
- **0 `chatbotOptions`** in `MerchantSettingsBundle` interface
- **0 `ChatbotOptionsState`** in `CapabilityResolutionService.ts`
- **0 `mapChatbot`** in `UnifiedCapabilityService.ts`
- **0 `useChatbotCapability`** hook
- **0 `seed-chatbot-capabilities.ts`** seed script
- **0 `chatbot-options-settings.ts`** route
- **0 chatbot features** in `canonical-features.ts` or `tier-hierarchies.ts`

---

## 5. Adopted Phase Sequence (Updated for Current Architecture)

### Phase 0: Infrastructure Prerequisites (1 week, parallel with 1A)

- Install `pgvector` extension on staging/production
- Provision `OPENAI_API_KEY` env var
- Add `BOT_API_KEY` env var
- Structured logging helper for bot services
- Bot API request metrics middleware

### Phase 1A: Schema + Capability + Static Engine + API (1.5-2 weeks)

**5-Layer Capability Integration** (follows SKILL docs exactly):

#### Layer 1: Definition
- Add chatbot features to `packages/feature-definitions/src/definitions/canonical-features.ts`
- Add chatbot features to tier arrays in `packages/feature-definitions/src/definitions/tier-hierarchies.ts`

#### Layer 2: Database
- Create `seed-chatbot-capabilities.ts` (follows `seed-crm-capabilities.ts` pattern)
- Define `CHATBOT_FEATURE_KEYS` map
- Define per-tier feature sets: `DISCOVERY`, `STOREFRONT`, `COMMITMENT`, `ECOMMERCE`, `OMNICHANNEL`, `PROFESSIONAL`, `ENTERPRISE`, `FLEX_ALL`
- Seed `capability_type_list` (`chatbot_options`)
- Seed `features_list` (all `chatbot_*` keys)
- Seed `capability_features_list` (link features to capability type)
- Seed `tier_features_list` (enable per tier)

#### Layer 3: Resolver
- Create `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts` — pure function
- Add `ChatbotOptionsMerchantSettings` + `EffectiveChatbot` to `types.ts`
- Add `chatbotOptions` to `MerchantSettingsBundle`
- Add `chatbot: EffectiveChatbot` to `EffectiveCapabilities.effective`
- Export from `resolvers/index.ts`
- Wire into `EffectiveCapabilityResolver.ts`:
  - Import `resolveChatbotOptions`
  - Add to `Promise.all` dispatch block
  - Fetch `tenant_chatbot_options_settings` in `fetchMerchantSettings()`

#### Layer 4: Route
- Create `apps/api/src/routes/chatbot-options-settings.ts` (follows `faq-options-settings.ts`)
- GET `/:tenantId/chatbot-options` — returns tier-gate-filtered settings
- PUT `/:tenantId/chatbot-options` — validates against tier, persists, invalidates cache
- GET `/:tenantId/chatbot-options/capability` — returns resolved capability state
- Mount in `apps/api/src/routes/index.ts`

#### Layer 5: Frontend
- Add `ChatbotOptionsState` to `CapabilityResolutionService.ts`
- Add `BackendEffectiveChatbot` + `mapChatbot()` to `UnifiedCapabilityService.ts`
- Add `chatbotOptions` to `mapAll()` return
- Create `useChatbotCapability()` hook in `useCapabilityAccess.ts`

#### Schema (10 + 1 tables)
1. `bot_configurations` — per-tenant bot config
2. `bot_conversations` — conversation sessions
3. `bot_messages` — individual messages
4. `bot_conversation_feedback` — thumbs up/down
5. `bot_guardrail_rules` — safety rules (rule-based in Phase 1A)
6. `bot_intents` — intent taxonomy
7. `bot_skills` — skill registry with tier/capability gates
8. `bot_skill_configurations` — per-tenant skill overrides
9. `tenant_chatbot_options_settings` — merchant preference toggles
10. `bot_faq_embeddings` — deferred to Phase 3A (schema only)

#### Services (6, all rule-based/keyword-based)
- `BotConfigurationService` — CRUD for bot config
- `BotConversationService` — session management, 24h expiry, archival
- `BotStaticResponseService` — exact-match + keyword FAQ lookup
- `BotGuardrailService` — regex/keyword matching
- `BotIntentService` — keyword matching with Jaccard similarity
- `BotSkillService` — skill execution with tier/capability/status gating

#### Routes
- Public: `POST /api/public/bot/conversations`, `POST /api/public/bot/conversations/:sessionId/messages`, `GET /api/public/bot/config`, `GET /api/public/bot/skills/:skillName`, `POST /api/public/bot/conversations/:sessionId/feedback`
- Merchant: `GET/PUT /api/tenants/:tenantId/bot/config`, `GET /api/tenants/:tenantId/bot/conversations`, `GET /api/tenants/:tenantId/bot/skills`, `PUT /api/tenants/:tenantId/bot/skills/:skillId`, `GET /api/tenants/:tenantId/bot/dashboard`, `GET /api/tenants/:tenantId/bot/analytics`, `GET/PUT /api/tenants/:tenantId/bot/widget`, `GET /api/tenants/:tenantId/bot/model`

#### Seed Data
- Global guardrail rules (banned phrases, PII patterns, moderation keywords)
- Bot intents (product.search, inventory.check, order.status, store.hours, general.inquiry)
- Bot skills registry (product-search, inventory, order-tracking, store-hours) with tier/capability gates

### Phase 1B: Universal Bot Widget (1.5-2 weeks)

- Vanilla JS shadow-DOM widget bundle (`apps/web/public/bot-widget/`)
- Vite library mode, < 50KB gzipped
- Configurable via `data-tenant-id` + `data-page-context` + `data-theme`
- Collapsed/expanded states, pre-chat form, message threading, typing indicator
- After-hours mode, skill cards, thumbs up/down, conversation resume via localStorage
- Mobile responsive, WCAG 2.1 AA, offline state handling
- `PublicBotService.ts` + `BotService.ts` frontend services
- `BotTenantWidget.tsx` on merchant dashboard

### Phase 1C: Merchant Bot Dashboard & Configuration (1.5-2 weeks)

- 7 merchant pages: Dashboard, Config, Skills, Knowledge Base, Analytics, Widget Setup, Chatbot Options
- "Bot" nav item in `DynamicTenantSidebar.tsx`
- Free tier: "Static Mode" dashboard with upgrade CTA
- Starter+: "AI Powered" dashboard (model status shows "AI Ready — Upgrade to Activate" until Phase 3A)

### Phase 2: CRM Integration, Business Hours, Context-Aware Features (1.5-2 weeks)

- `BotCrmIntegrationService.ts` — escalations create CRM tickets
- `BotBusinessHoursService.ts` — after-hours detection from `tenant_business_profiles_list`
- Context-aware greetings (product/category/storefront)
- Conversation retention policy (90-day archive, 1-year hard delete)
- GDPR right-to-erase endpoint
- FAQ mutation webhook → bot knowledge base refresh
- Migrate `FaqBotPreview.tsx` to server-side `BotStaticResponseService` call

### Phase 3A: AI Infrastructure — RAG + Shared Dynamic Model (2-3 weeks)

- FastAPI model server (`apps/model-server/`)
- BERT-powered guardrails upgrade (with rule-based fallback)
- BERT-powered intent classification upgrade (with keyword fallback)
- `BotRagService.ts` — FAQ chunking, OpenAI embeddings, pgvector index
- `bot_faq_embeddings` table (vector(1536) column)
- Shared dynamic model for commitment/ecommerce tier
- Multi-turn context window (last 10 messages)
- Updated message pipeline: Guardrails → Intent → Tier Router → Response Engine

### Phase 3B: Platform Admin UI (2-2.5 weeks, parallel with 3A)

- `BotPlatformAdminService.ts` frontend service
- 6 admin pages: Dashboard, Guardrails, Intents, Knowledge, Skills, Assignments
- "Bot Platform" nav section in `AdminNavContent.tsx`
- Admin API routes for CRUD on all entities
- Merchant dashboard updates (real model status for commitment+)

### Phase 4A: LoRA Fine-Tuning (2-3 weeks)

- `bot_training_jobs` table
- `BotTrainingService.ts` — LoRA training queue
- Celery/RQ worker or Kubernetes Jobs
- GPU node provisioning (A100 40GB)
- Training queue admin page
- Model registry admin page
- Merchant dashboard: LoRA badge, training progress, completion toast

### Phase 4B: Dedicated Models, Auto-Scaling, Deployment Monitor (2-3 weeks)

- Dedicated FastAPI instances for enterprise tier
- `bot_auto_scaling_policies` table (needs schema definition)
- `bot_deployment_instances` table (needs schema definition)
- `bot_model_assignments` table (needs schema definition)
- Auto-scaling policy admin page
- Deployment monitor admin page
- Bot platform dashboard (global stats)
- Full E2E tests across all tiers

---

## 6. Cross-Phase Dependencies

```
Phase 0 (infra) ───────────────────────────────────────────────────┐
                                                                    │
Phase 1A (schema + capability + API) ──┬── Phase 1B (widget) ──┬── Phase 1C (merchant UI)
                                       │                        │
                                       └── Phase 2 (CRM/biz hours/context)
                                                │
                                                ├── Phase 3A (AI infra + RAG) ──┬── Phase 4A (LoRA)
                                                │                               │
                                                ├── Phase 3B (admin UI) ────────┤── Phase 4B (dedicated + auto-scale)
```

---

## 7. Key Decisions Needed

| Decision | Options | Recommendation |
|---|---|---|
| Guardrails/intent in Phase 1A | (a) Rule-based only, (b) Use external API | **Rule-based** — no infra exists, BERT in Phase 3A |
| Widget build tool | (a) Vite library mode, (b) Rollup, (c) esbuild | **Vite** — consistent with existing stack |
| Widget location | (a) `apps/widget/`, (b) `apps/web/public/bot-widget/` | **`apps/web/public/bot-widget/`** — served as static assets |
| Vector store | (a) pgvector, (b) Pinecone | **pgvector** — no external dependency, Postgres already in use |
| Route pattern | (a) `/api/public/bot/*`, (b) `/api/public/tenants/:tenantId/bot/chat` | **`/api/public/bot/*`** — V2 unified pattern |
| Training infrastructure | (a) Celery/RQ, (b) Kubernetes Jobs | **Defer to Phase 4A** — depends on deployment architecture |
| Chatbot on `discovery` tier | (a) Static FAQ only, (b) Not available | **Static FAQ only** — low tier but still gets widget value |
| Chatbot on `storefront` tier | (a) Static FAQ only, (b) Shared dynamic | **Static FAQ only** — no AI infra until commitment |
| `chatbot_flexible` for org tiers | (a) Yes, (b) No | **Yes** — matches CRM pattern, org tiers get everything |

---

## 8. Remaining Gaps Not in V2

| Gap | Phase Needed | Severity |
|---|---|---|
| `bot_model_assignments` table schema | Phase 3B | Medium — admin assignments page needs it |
| `bot_deployment_instances` table schema | Phase 4B | Medium — deployment monitor needs it |
| `bot_auto_scaling_policies` table schema | Phase 4B | Medium — auto-scale config needs it |
| Widget i18n strategy | Phase 1B | Low — can defer to post-MVP |
| Cost monitoring (GPU/OpenAI) | Phase 3A | Medium — budget alerts needed |
| A/B testing framework | Phase 4A | Low — can defer |
| Multi-turn context window management | Phase 3A | Medium — V2 mentions 10-message window but no design |
| `CHATBOT_CAPABILITY_SPEC.md` tier names update | Phase 1A (pre-work) | High — doc references obsolete tier names |
| `CHATBOT_CAPABILITY_SPEC.md` architecture update | Phase 1A (pre-work) | High — doc references old OptionsService pattern |

---

## 9. Estimated Timeline

| Phase | Duration | Cumulative |
|---|---|---|
| Phase 0 | 1 week | 1 week |
| Phase 1A | 1.5-2 weeks | 2.5-3 weeks |
| Phase 1B | 1.5-2 weeks | 4-5 weeks |
| Phase 1C | 1.5-2 weeks | 5.5-7 weeks |
| Phase 2 | 1.5-2 weeks | 7-9 weeks |
| Phase 3A | 2-3 weeks | 9-12 weeks |
| Phase 3B | 2-2.5 weeks (parallel) | 9-12 weeks |
| Phase 4A | 2-3 weeks | 11-15 weeks |
| Phase 4B | 2-3 weeks | 13-18 weeks |
| **Total** | **13-18 weeks** | |

---

## 10. Implementation Order for Phase 1A (Detailed)

1. **Prisma schema** — Add `tenant_chatbot_options_settings` + 10 bot tables to `schema.prisma`, run `prisma migrate dev`
2. **Seed script** — Create `seed-chatbot-capabilities.ts`, run it
3. **Resolver types** — Add `ChatbotOptionsMerchantSettings` + `EffectiveChatbot` to `types.ts`, update `MerchantSettingsBundle` + `EffectiveCapabilities`
4. **Resolver function** — Create `ChatbotOptionsResolver.ts`, export from `index.ts`
5. **Orchestrator** — Wire `resolveChatbotOptions` into `EffectiveCapabilityResolver.ts`
6. **Route** — Create `chatbot-options-settings.ts`, mount in `index.ts`
7. **Frontend types** — Add `ChatbotOptionsState` to `CapabilityResolutionService.ts`
8. **Frontend mapper** — Add `BackendEffectiveChatbot` + `mapChatbot()` to `UnifiedCapabilityService.ts`
9. **Frontend hook** — Add `useChatbotCapability()` to `useCapabilityAccess.ts`
10. **Bot services** — Create 6 backend services (Config, Conversation, StaticResponse, Guardrail, Intent, Skill)
11. **Bot routes** — Create public + merchant API routes
12. **Seed data** — Guardrail rules, intents, skill registry
13. **Verify** — `pnpm checkapi && pnpm checkweb`, test unified endpoint
