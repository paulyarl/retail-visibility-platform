# Bot Skills as a Service (BSaaS) — Phased Implementation Plan

> Enabling à la carte feature purchases, external bot embedding, and cross-capability skill monetization.

---

## Overview

The VisibleShelf platform currently gates features exclusively through subscription tiers. This plan introduces a **purchased-service gate** as a third feature source, flowing through the existing `EffectiveCapabilityResolver` so that the unified capabilities endpoint remains the single source of truth — regardless of whether a feature was delivered by a tier gate, merchant gate, or purchased service.

This enables:
- **Bot Skills as a Service (BSaaS)** — tenants can buy individual bot skills à la carte, outside their tier
- **External Bot Embedding** — tenants can port the bot widget to external sites (WordPress, custom sites) as a purchased service
- **Cross-capability purchases** — any `features_list` key can be sold independently of tier

### Design Principle

The bot, the skill system, and the capability resolvers are **source-agnostic**. They only ask "is this feature in the allowed list?" — not "how did it get there?" The purchase mechanism simply adds feature keys to the same merged features map that tier features populate. No downstream changes needed.

---

## Phase 1: Purchased Feature Infrastructure

**Goal:** Create the `tenant_feature_purchases` table and wire it into `fetchRawCapabilities()` as a third merge source.

### Deliverables

1. **Migration SQL** — `database/migrations/043_tenant_feature_purchases.sql`
   - `tenant_feature_purchases` table with `tenant_id`, `feature_key`, `source`, `status`, `expires_at`, `metadata`
   - Indexes on `tenant_id` + `status` and `tenant_id` + `feature_key` (unique)

2. **Prisma schema** — Add `tenant_feature_purchases` model to `schema.prisma`

3. **EffectiveCapabilityResolver.ts** — Modify `fetchRawCapabilities()` to query `tenant_feature_purchases` and merge active purchases into the `mergedFeatures` map using the same most-permissive-wins pattern

4. **Admin API routes** — `apps/api/src/routes/admin/feature-purchases.ts`
   - `GET /api/admin/feature-purchases` — list all purchases (with tenant + feature filters)
   - `POST /api/admin/feature-purchases` — create a purchase (grant a feature to a tenant)
   - `PUT /api/admin/feature-purchases/:id` — update status (activate/suspend/cancel)
   - `DELETE /api/admin/feature-purchases/:id` — revoke a purchase

5. **Cache invalidation** — `invalidateEffectiveCapabilities()` called on any purchase change

### What Phase 1 Unlocks

- Any `features_list` key can be granted to any tenant via admin API, bypassing tier gates
- The existing resolver pipeline handles it automatically — no per-domain resolver changes
- Frontend `UnifiedCapabilityService` picks it up with zero changes (it reads the unified endpoint)

### Verification

- `npx tsc --noEmit` passes on both `apps/api` and `apps/web`
- Manual test: grant a `chatbot_skill_order_tracking` purchase to a storefront tenant → `resolveEffectiveCapabilities()` returns it in `allowed_skill_types` → `BotSkillService.isSkillAvailable()` returns true

---

## Phase 2: External Bot Embed Licensing

**Goal:** Create the `tenant_bot_embed_licenses` table and add embed key validation to the public bot API, enabling the bot widget to be embedded on external sites.

### Deliverables

1. **Migration SQL** — `database/migrations/044_bot_embed_licenses.sql`
   - `tenant_bot_embed_licenses` table with `embed_key`, `tenant_id`, `allowed_domains`, `status`, `source`, `expires_at`
   - Unique constraint on `embed_key`

2. **Prisma schema** — Add `tenant_bot_embed_licenses` model

3. **Embed key middleware** — `apps/api/src/middleware/embed-key-validation.ts`
   - Validates `x-embed-key` header or `embed_key` query param
   - Resolves tenant ID from embed license
   - Checks `Origin` / `Referer` header against `allowed_domains` (with wildcard support)
   - Returns 403 if key invalid, expired, or domain not allowed

4. **bot-public.ts routes** — Accept embed key as alternative to `tenantId` on public endpoints
   - `GET /api/public/bot/config?embedKey=` — resolves tenant from license
   - `POST /api/public/bot/conversations` — accepts `embedKey` in body instead of `tenantId`
   - All other bot-public endpoints accept embed key as tenant resolver

5. **Widget update** — `apps/web/public/bot-widget/bot-widget.js`
   - Accept `data-embed-key` attribute as alternative to `data-tenant-id`
   - Send `x-embed-key` header on all API calls when embed key is present

6. **Merchant UI** — `apps/web/src/components/bot/BotWidgetSetupPage.tsx`
   - Show embed key when external embedding is available
   - Show domain allowlist management form
   - Show "External Embedding" as a purchasable/upgradeable feature when not available

7. **Feature key** — `chatbot_external_embed` in `features_list` + tier assignments
   - Professional+ tiers: bundled
   - Lower tiers: purchasable via `tenant_feature_purchases`

### Verification

- Bot widget works with `data-embed-key` on an external domain
- Bot widget rejects requests from non-allowlisted domains
- Expired embed keys return 403
- `npx tsc --noEmit` passes on both apps

---

## Phase 3: WordPress Plugin

**Goal:** Create a minimal WordPress plugin that injects the bot widget using an embed key.

### Deliverables

1. **WordPress plugin** — `plugins/wordpress/visibleshelf-bot/`
   - `visibleshelf-bot.php` — main plugin file (~200 lines PHP)
   - Settings page: "VisibleShelf Bot Settings" with embed key input and page context selector
   - Enqueues `bot-widget.js` with `data-embed-key` attribute
   - Optional: map WordPress page types to `data-page-context` (product, category, home)
   - `readme.txt` — WordPress plugin readme format

2. **Plugin packaging** — Build script to zip the plugin for distribution

3. **Documentation** — `docs/WORDPRESS_BOT_PLUGIN_GUIDE.md`
   - Installation instructions
   - Configuration steps
   - Troubleshooting (CORS, domain allowlisting, cache plugins)

### Verification

- Plugin installs on a fresh WordPress instance
- Bot widget renders and functions correctly
- Conversations, product search, and skill cards work through the embed key

---

## Phase 4: CRM Assistant Bot Skill

**Goal:** Implement the first BSaaS skill — a CRM-aware bot skill that lets the bot create support tickets, look up ticket status, and inject CRM context into dynamic responses.

### Deliverables

Follow the skill extension guide (`docs/CHATBOT_SKILL_EXTENSION_GUIDE.md`) for all 7 components:

1. **SQL migration** — `database/migrations/045_crm_assistant_skill.sql`
   - `chatbot_skill_crm_assistant` feature key in `features_list`
   - Linked to `chatbot_options` capability type
   - Tier assignments: professional+ (bundled), lower tiers purchasable

2. **TypeScript types** — Add `chatbot_skill_crm_assistant` to `ChatbotSkillType` in:
   - `apps/api/src/services/resolvers/types.ts`
   - `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts`
   - `apps/web/src/services/CapabilityResolutionService.ts`
   - `apps/web/src/services/UnifiedCapabilityService.ts`

3. **Seed data** — Add to `apps/api/prisma/seed-bot-data.ts`
   - `crm-assistant` skill row in `SKILLS` array
   - `support.ticket_status`, `support.create_ticket`, `support.inquiry_check` intents

4. **BotCrmAssistantService.ts** — `apps/api/src/services/BotCrmAssistantService.ts`
   - `lookupTicket(tenantId, customerEmail)` — finds open tickets by customer
   - `createTicket(tenantId, conversationId, sessionId, customerEmail, issueSummary)` — formalizes `BotCrmIntegrationService.escalateToTicket()` as a skill
   - `lookupInquiry(tenantId, senderEmail)` — checks inquiry status
   - `formatTicketContext(tickets)` — formats ticket data for GPT prompt injection
   - `formatTicketCreatedConfirmation(ticket)` — formats confirmation card data

5. **Public API endpoints** — Add to `apps/api/src/routes/bot-public.ts`
   - `GET /api/public/bot/crm/ticket-status?tenantId=&customerEmail=`
   - `POST /api/public/bot/crm/create-ticket`
   - Capability-gated: requires `chatbot_skill_crm_assistant` in `allowed_skill_types`

6. **Dynamic response integration** — Extend `BotDynamicResponseService.ts`
   - Detect support-related queries via keyword heuristic
   - Inject open ticket count + average response time into GPT context
   - System prompt rule: "Only reference ticket data from the context. Do not invent ticket numbers or statuses."

7. **Skill card schemas**
   - `ticket_status` card: `['ticket_id', 'title', 'status', 'priority', 'last_updated']`
   - `ticket_created` card: `['ticket_id', 'title', 'status', 'estimated_response']`

### Verification

- Storefront tenant without purchase: skill not in `allowed_skill_types`, endpoints return 403
- Storefront tenant with purchase: skill available, bot can create tickets and look up status
- Professional tenant: skill available via tier gate
- `npx tsc --noEmit` passes on both apps

---

## Phase 5: BSaaS Skill Document

**Goal:** Create a skill document for agents to extend the platform with purchased feature offerings, patterned after `.devin/skills/capability-system-integration.md`.

### Deliverables

1. **Skill document** — `.devin/skills/add-bsaas-feature.md`
   - Patterned after `capability-system-integration.md` in structure and depth
   - Covers the full lifecycle: table schema → Prisma model → resolver merge → admin API → cache invalidation → frontend implications
   - References `docs/CHATBOT_SKILL_EXTENSION_GUIDE.md` for skill-specific extensions
   - References `docs/BSAAS_PHASED_PLAN.md` for the overall architecture
   - Includes worked examples (CRM assistant skill, external embed license)
   - Documents the three feature sources (org-tier, tenant-tier, purchases) and the most-permissive-wins merge
   - Testing checklist for verifying purchased features flow through correctly

### Verification

- Document accurately reflects the implemented Phase 1 architecture
- An agent reading the document can grant a new purchased feature without additional guidance

---

## Dependency Chain

```
Phase 1 (Purchased Feature Infrastructure)
  │
  ├──► Phase 2 (External Bot Embed Licensing)
  │       │
  │       └──► Phase 3 (WordPress Plugin)
  │
  ├──► Phase 4 (CRM Assistant Bot Skill)
  │
  └──► Phase 5 (BSaaS Skill Document)
```

Phase 1 is the foundation. Phases 2 and 4 can proceed in parallel after Phase 1. Phase 3 depends on Phase 2. Phase 5 documents the completed work and can be written after Phase 1 is verified.

---

## Architecture: Three Sources, One Truth

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  tier_features   │  │  tier_features   │  │ tenant_feature_      │
│  _list (org)     │  │  _list (tenant)  │  │ purchases (NEW)      │
│                  │  │                  │  │                      │
│  Tier gate       │  │  Tier gate       │  │  Purchased service   │
│  (bundled)       │  │  (bundled)       │  │  (à la carte)        │
└────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘
         │                     │                       │
         └──────────┬──────────┘                       │
                    │  most-permissive-wins            │
                    │  (already exists)                │
                    ▼                                  │
         ┌──────────────────────┐                     │
         │  mergedFeatures Map  │◄────────────────────┘
         │  (OR merge — Phase 1)│
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Per-domain resolvers│
         │  (unchanged)         │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  EffectiveCapabilities│
         │  (single source of   │
         │   truth — unchanged) │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  BotSkillService     │
         │  .isSkillAvailable() │
         │  (unchanged)         │
         └──────────────────────┘
```

The key insight: `fetchRawCapabilities()` already does a most-permissive-wins merge between org-tier and tenant-tier features. Phase 1 adds a third query to that same merge. Everything downstream — resolvers, `EffectiveCapabilities`, `BotSkillService`, frontend — works unchanged.

---

## Revenue Model

| Offering | Source | Who Buys |
|---|---|---|
| Bot on platform storefront | Tier-bundled (all tiers) | Everyone — included |
| External embed (WordPress, custom site) | `chatbot_external_embed` purchase or professional+ tier | Tenants with existing websites |
| CRM assistant skill | `chatbot_skill_crm_assistant` purchase or professional+ tier | Tenants who want bot-handled support |
| Product search skill | Tier-bundled (storefront+) or à la carte | Discovery tier upgrade path |
| Custom skill development | Enterprise/organization | Tenants who need bespoke skills |
| Any `features_list` key | `tenant_feature_purchases` | Any tenant, any feature |

---

## File Reference

| File | Phase | Purpose |
|---|---|---|
| `database/migrations/043_tenant_feature_purchases.sql` | 1 | Purchased features table |
| `apps/api/prisma/schema.prisma` | 1 | Prisma model for purchases |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | 1 | Merge purchases into features map |
| `apps/api/src/routes/admin/feature-purchases.ts` | 1 | Admin CRUD for purchases |
| `database/migrations/044_bot_embed_licenses.sql` | 2 | Embed license table |
| `apps/api/src/middleware/embed-key-validation.ts` | 2 | Embed key validation middleware |
| `apps/api/src/routes/bot-public.ts` | 2 | Accept embed key on public routes |
| `apps/web/public/bot-widget/bot-widget.js` | 2 | Accept `data-embed-key` attribute |
| `plugins/wordpress/visibleshelf-bot/` | 3 | WordPress plugin |
| `database/migrations/045_crm_assistant_skill.sql` | 4 | CRM assistant capability key |
| `apps/api/src/services/BotCrmAssistantService.ts` | 4 | CRM skill service |
| `.devin/skills/add-bsaas-feature.md` | 5 | Skill document for agents |
