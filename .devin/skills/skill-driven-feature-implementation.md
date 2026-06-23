---
description: How to implement a full-stack per-tenant feature using skill documents as a guided playbook
---

# Skill-Driven Feature Implementation: Storefront Policies Case Study

## Overview

This document captures how six existing skill documents were used as a guided playbook to implement per-tenant storefront policies (Phase 1B of the Social Commerce Integration Plan). Each skill contributed a specific piece of the implementation, from database schema to frontend services to chatbot integration.

## Skills Used and Their Contributions

### 1. `deploy-service-extending-base-singleton.md`

**What it provided:** The two-tier singleton infrastructure pattern for frontend services.

**How it was applied:**
- Created `PublicStorefrontPolicyService` extending `PublicApiSingleton` for public storefront policy reads (used by public policy pages and `StorefrontFooter`).
- Created `TenantStorefrontPolicyService` extending `TenantApiSingleton` for merchant-scoped policy CRUD (used by the merchant policy editor).
- Both services implement the cache contract (`getServiceCachePatterns`, `invalidateServiceCaches`) and use `makeDefaultRequest` for API calls.

**Key takeaway:** Always use the singleton service pattern instead of direct `fetch` calls in frontend components. This ensures caching, authentication, and error handling are handled consistently.

### 2. `tenant-scoped-id-generation.md`

**What it provided:** The ID format convention and generator pattern for tenant-scoped resources.

**How it was applied:**
- Added `generateStorefrontPolicyId` to `apps/api/src/lib/id-generator.ts` using the pattern `{prefix}-{tenantKey}-{nanoid}`.
- The `StorefrontPolicyService` uses this generator when creating new policy records.

**Key takeaway:** Use tenant-scoped IDs (not raw UUIDs) for traceability and correlation across logs, URLs, and database records.

### 3. `link-features-to-capability-type.md`

**What it provided:** The SQL pattern for linking feature keys to a capability type and enabling them for tiers.

**How it was applied:**
- Migration `043_storefront_policies.sql` inserts the `storefront_policies` feature key into `features_list`.
- Links it to the `storefront_types` capability type via `capability_features_list`.
- Enables it for all tiers via `tier_features_list`.

**Pitfall discovered:** The `tier_features_list` table requires both `id` (use `gen_random_uuid()::text`) and `feature_name` columns in INSERTs. Omitting these causes a NOT NULL constraint violation. This was corrected in the migration and in the skill document itself.

### 4. `verify-capability-deployment.md`

**What it provided:** The end-to-end verification checklist for capability-gated features.

**How it was applied:**
- Verified database seeds (feature key, capability link, tier assignments).
- Verified backend resolver includes the new feature in capability resolution.
- Verified frontend capability mapping includes the new feature key.
- Verified `invalidateEffectiveCapabilities` is called after policy updates to refresh cached capabilities.

### 5. `add-chatbot-skill.md`

**What it provided:** The pattern for adding a new bot skill — database seed, capability type, resolver integration, and endpoint.

**How it was applied:**
- Added `chatbot_skill_policy_faq` to `ChatbotSkillType` union in three locations (backend `types.ts`, backend `ChatbotOptionsResolver.ts`, frontend `CapabilityResolutionService.ts`).
- Added `policy-faq` skill and `policy.inquiry` intent to `seed-bot-data.ts`.
- Added `GET /api/public/bot/policies` endpoint in `bot-public.ts`.
- Extended `BotDynamicResponseService` with policy context injection (keyword detection → fetch policies → inject into GPT prompt).
- Created migration `044_chatbot_skill_policy_faq.sql` for the feature key + tier assignments.

### 6. `database-navigation-system.md`

**What it provided:** The critical insight that navigation is database-driven, not file-based, and the SQL pattern for inserting links.

**How it was applied:**
- Created migration `045_nav_storefront_policies.sql` to insert a "Storefront Policies" link into `navigation_links` under the "My Settings" parent (`custom-1776276917946`).
- Used `{tenantId}` template variable in the href (not `${tenantId}`).
- Updated parent's `childrenKeys` metadata to include the new child.
- Verified the icon name (`settings`) exists in the admin `IconComponents` map.

**Key takeaway:** Never add links to file-based fallback arrays — they won't appear in the UI. Always insert into the `navigation_links` table.

## Implementation Flow

```
1. Database (migration 043)
   ├── tenant_storefront_policies table
   ├── features_list entry
   ├── capability_features_list link
   └── tier_features_list assignments

2. Backend
   ├── Prisma schema model
   ├── StorefrontPolicyService (extends BaseService, uses id-generator)
   ├── Express routes (public GET + merchant GET/PUT)
   ├── invalidateEffectiveCapabilities after update
   └── Routes wired in index.ts

3. Frontend
   ├── PublicStorefrontPolicyService (extends PublicApiSingleton)
   ├── TenantStorefrontPolicyService (extends TenantApiSingleton)
   ├── Merchant policy editor page (uses tenant service)
   ├── Public policy page (uses public service)
   └── StorefrontFooter policy links (uses public service)

4. Chatbot Integration
   ├── ChatbotSkillType union updated (3 locations)
   ├── ChatbotOptionsResolver updated
   ├── seed-bot-data.ts: policy-faq skill + policy.inquiry intent
   ├── BotDynamicResponseService: policy context injection
   ├── bot-public.ts: GET /policies endpoint
   └── Migration 044: chatbot_skill_policy_faq feature + tier assignments

5. Navigation
   └── Migration 045: navigation_links entry under "My Settings"
```

## Lessons Learned

1. **Read skill docs before starting** — They encode platform conventions that prevent rework. The singleton service pattern, ID generation format, and capability linking SQL were all documented and ready to follow.

2. **Fix bugs in skill docs too** — When the `tier_features_list` INSERT bug was found, correcting the skill documents prevented future agents from repeating the mistake.

3. **Verify icon names exist** — Before using an icon name in a navigation link SQL, check the `IconComponents` map in the admin navigation page. Unsupported icons render as blank.

4. **Update all type union locations** — `ChatbotSkillType` exists in three files (backend `types.ts`, backend `ChatbotOptionsResolver.ts`, frontend `CapabilityResolutionService.ts`). All must be updated in sync.

5. **Use named exports for singleton classes** — `StorefrontPolicyService` exports both a named class and a default instance. Import the named class when you need `getInstance()`, not the default export.

6. **Navigation links use `{tenantId}` template** — Not `${tenantId}`. The reconciliation migration fixed this across the codebase; new links must use the correct format.
