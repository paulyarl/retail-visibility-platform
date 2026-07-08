# Storefront Policy Templates — Sprint Plan

## Status: Draft
## Date: July 2026
## Source: `STOREFRONT_POLICY_TEMPLATES_ANALYSIS.md`

---

## Sprint Overview

The analysis document defines 6 phases. We organize them into 4 sprints, prioritizing the template infrastructure and merchant-facing gallery first (critical path for social commerce onboarding), then compliance awareness, then enrichment features.

| Sprint | Phases | Duration | Goal |
|--------|--------|----------|------|
| **Sprint 1** | Phase 1 — Template Infrastructure | 5-7 days | Database tables, backend service, admin CRUD, seed 15 high-priority templates (online + universal) |
| **Sprint 2** | Phase 2 — Frontend Template Gallery | 4-5 days | Merchant-facing template catalog grouped by storefront type, preview, placeholder fill, apply flow |
| **Sprint 3** | Phase 3 — Compliance & Jurisdiction | 4-5 days | Jurisdiction detection, compliance checklist, multi-jurisdiction + platform-specific templates, completeness scoring |
| **Sprint 4** | Phases 4 + 5 + 6 — Enrichment | 5-7 days | Fulfillment/product-type awareness, template versioning + notifications, bot knowledge + AI recommendations |

**Total estimated duration:** 18-24 days
**Critical path (Sprints 1-2):** 9-12 days to merchant-usable template system
**Critical path (Sprints 1-3):** 13-17 days to compliance-aware templates

---

## Dependency Graph

```
Sprint 1 (Infrastructure)
  └→ Sprint 2 (Frontend Gallery)
       └→ Sprint 3 (Compliance & Jurisdiction)
            └→ Sprint 4 (Enrichment)
```

Sprints 1-3 are sequential. Sprint 4 can begin after Sprint 2 (fulfillment awareness and bot knowledge only need the core infra + gallery), but versioning benefits from Sprint 3's compliance tags. The recommended sequence is sequential.

---

## Sprint 1: Template Infrastructure

**Goal:** Database tables, backend service with storefront-type grouping, admin CRUD, and seed data for online + universal templates.

### Tasks

#### 1.1 — Database Migration: `policy_templates` + `tenant_policy_template_usage`

- **File**: `database/migrations/090_policy_templates.sql`
- **Table**: `policy_templates`
  - `id VARCHAR(255) PRIMARY KEY`
  - `template_key VARCHAR(100) UNIQUE` — e.g. `online_standard_return`
  - `policy_type VARCHAR(50) NOT NULL` — `return_policy` | `shipping_policy` | `privacy_policy` | `terms_of_service` | `refund_policy`
  - `storefront_type VARCHAR(50) NOT NULL DEFAULT 'all'` — `online` | `retail` | `service` | `social` | `all`
  - `product_type VARCHAR(50) NOT NULL DEFAULT 'all'` — `physical` | `digital` | `hybrid` | `service` | `all`
  - `fulfillment_mode VARCHAR(50) NOT NULL DEFAULT 'all'` — `pickup` | `delivery` | `shipping` | `service` | `all`
  - `jurisdiction VARCHAR(10) NOT NULL DEFAULT 'GLOBAL'` — `US` | `EU` | `UK` | `AU` | `CA` | `GLOBAL`
  - `platform VARCHAR(50) NOT NULL DEFAULT 'generic'` — `meta` | `tiktok` | `google` | `generic`
  - `title VARCHAR(200) NOT NULL`
  - `description TEXT`
  - `content_markdown TEXT NOT NULL`
  - `placeholder_schema JSONB DEFAULT '[]'`
  - `compliance_tags TEXT[] DEFAULT '{}'`
  - `version VARCHAR(20) NOT NULL DEFAULT '1.0.0'`
  - `regulatory_effective_date TIMESTAMPTZ`
  - `is_active BOOLEAN DEFAULT true`
  - `sort_order INT DEFAULT 0`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
- **Indexes**: `(storefront_type, policy_type, is_active)`, `(jurisdiction, is_active)`, `(platform, is_active)`
- **RLS**: Public can read active templates; admin-only write
- **Table**: `tenant_policy_template_usage`
  - `id VARCHAR(255) PRIMARY KEY`
  - `tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
  - `template_id VARCHAR(255) NOT NULL REFERENCES policy_templates(id) ON DELETE CASCADE`
  - `policy_type VARCHAR(50) NOT NULL`
  - `template_version VARCHAR(20) NOT NULL`
  - `applied_at TIMESTAMPTZ DEFAULT NOW()`
  - `customized BOOLEAN DEFAULT false`
  - `placeholder_values JSONB DEFAULT '{}'`
- **Indexes**: `(tenant_id)`, `(template_id)`, `(tenant_id, policy_type)`
- **RLS**: Tenant-scoped read; admin read-all

#### 1.2 — Prisma Schema Update

- **File**: `apps/api/prisma/schema.prisma`
- **Changes**: Add `policy_templates` and `tenant_policy_template_usage` models. Add relations from `tenants` to `tenant_policy_template_usage`.

#### 1.3 — ID Generator

- **File**: `apps/api/src/lib/id-generator.ts`
- **Add**: `generatePolicyTemplateId()` → `polcat-{nanoid}`
- **Add**: `generatePolicyTemplateUsageId(tenantKey: string)` → `poltu-{tk}-{nanoid}`

#### 1.4 — Backend `PolicyTemplateService`

- **File**: `apps/api/src/services/PolicyTemplateService.ts` (new)
- **Extends**: `BaseService` (singleton pattern)
- **Methods**:
  - `getTemplates(filters?)` — list templates with optional filters (storefront_type, policy_type, jurisdiction, platform, is_active)
  - `getTemplate(id)` — single template by ID
  - `getTemplateByKey(key)` — single template by template_key
  - `getTemplatesForTenant(tenantId)` — resolve tenant's effective capabilities, return filtered templates
  - `getTemplatesGroupedByStorefrontType(tenantId)` — returns structured response grouped by storefront type with `recommended` flag
  - `applyTemplate(tenantId, templateId, placeholderValues)` — substitute placeholders into content, upsert into `tenant_storefront_policies`, log usage
  - `logTemplateUsage(tenantId, templateId, policyType, version, customized, placeholderValues)` — insert into `tenant_policy_template_usage`
  - `getRecommendedTemplates(tenantId)` — rule-based scoring: storefront type match (3pts), fulfillment match (2pts), jurisdiction match (2pts), platform match (1pt); return top template per policy type
- **Caching**: 60s in-memory cache for `getTemplates()` (same pattern as `BadgeRegistryService`)
- **Static fallback**: `STATIC_TEMPLATES` array with 5 universal templates for resilience when DB is unavailable

#### 1.5 — Backend Routes

- **File**: `apps/api/src/routes/policy-templates.ts` (new)
- **Endpoints**:
  - `GET /api/public/policy-templates` — public list (active only, no auth)
  - `GET /api/public/policy-templates/:id` — public single template
  - `GET /api/public/policy-templates?storefront_type=online` — filter by storefront type
  - `GET /api/tenants/:tenantId/storefront-policies/templates` — tenant-filtered templates (auth)
  - `GET /api/tenants/:tenantId/storefront-policies/templates?group_by=storefront_type` — grouped response (auth)
  - `POST /api/tenants/:tenantId/storefront-policies/templates/apply` — apply template (auth, requireTenantAdmin)
  - `GET /api/admin/policy-templates` — admin list all (auth, admin)
  - `POST /api/admin/policy-templates` — admin create (auth, admin)
  - `PUT /api/admin/policy-templates/:id` — admin update (auth, admin)
  - `DELETE /api/admin/policy-templates/:id` — admin deactivate (auth, admin)
- **Zod schemas**: `templateCreateSchema`, `templateUpdateSchema`, `applyTemplateSchema`

#### 1.6 — Route Mounting

- **File**: `apps/api/src/index.ts`
- **Changes**: Import and mount `policy-templates` router

#### 1.7 — `StorefrontPolicyService` Extension

- **File**: `apps/api/src/services/StorefrontPolicyService.ts`
- **Changes**: Add `applyTemplate(tenantId, templateId, placeholderValues)` method that:
  1. Calls `PolicyTemplateService.getTemplate(templateId)`
  2. Substitutes `[PLACEHOLDERS]` in `content_markdown` with `placeholderValues`
  3. Calls existing `upsertPolicies()` with the generated content for the template's `policy_type`
  4. Calls `PolicyTemplateService.logTemplateUsage()`
  5. Triggers `BotKnowledgeEmbeddingService.refreshPolicyEmbeddings()` (fire-and-forget)
  6. Calls `invalidateEffectiveCapabilities(tenantId)`

#### 1.8 — Admin Template Management Page

- **File**: `apps/web/src/app/(platform)/settings/admin/policy-templates/page.tsx` (new)
- **File**: `apps/web/src/app/(platform)/settings/admin/policy-templates/PolicyTemplateAdminClient.tsx` (new)
- **Features**: Table of all templates with filters (storefront_type, policy_type, jurisdiction, platform, active). Create/edit modal with markdown editor, placeholder schema builder, compliance tags input. Activate/deactivate toggle.

#### 1.9 — Seed Data: 15 High-Priority Templates

- **File**: `database/migrations/090_policy_templates.sql` (same migration, seed section)
- **Templates to seed**:
  - **Online (8)**: `online_standard_return`, `online_shipping_domestic`, `online_privacy_ccpa`, `online_terms_standard`, `online_refund_standard`, `online_digital_refund`, `online_privacy_gdpr`, `online_privacy_comprehensive`
  - **Universal (4)**: `universal_privacy_minimal`, `universal_terms_minimal`, `universal_return_minimal`, `universal_refund_minimal`
  - **Social (3)**: `social_return_meta`, `social_return_tiktok`, `social_privacy_social`
- **Content**: Each template includes `content_markdown` with `[BRACKETED]` placeholders and `placeholder_schema` JSON
- **Legal review note**: Template content is drafted by engineering; legal review required before production deployment. Mark with `regulatory_effective_date` when legally reviewed.

#### 1.10 — Verification

- `pnpm checkapi` passes
- `pnpm checkweb` passes
- `GET /api/public/policy-templates` returns 15 seeded templates
- `GET /api/tenants/:tenantId/storefront-policies/templates?group_by=storefront_type` returns grouped response with `recommended` flag
- Admin can create/edit/deactivate templates via admin UI
- `POST /api/tenants/:tenantId/storefront-policies/templates/apply` applies a template and updates `tenant_storefront_policies`

---

## Sprint 2: Frontend Template Gallery

**Goal:** Merchant-facing template catalog with storefront-type grouping, preview, placeholder fill, and apply flow integrated into the existing policy settings page.

### Tasks

#### 2.1 — Frontend `PolicyTemplateService`

- **File**: `apps/web/src/services/PolicyTemplateService.ts` (new)
- **Extends**: `TenantApiSingleton`
- **Methods**: `getTemplates(tenantId)`, `getTemplatesGrouped(tenantId)`, `getRecommendedTemplates(tenantId)`, `applyTemplate(tenantId, templateId, placeholderValues)`
- **Cache invalidation**: On `applyTemplate`, invalidate policy cache (same pattern as `TenantStorefrontPolicyService`)

#### 2.2 — `TemplateGallery` Component

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/TemplateGallery.tsx` (new)
- **Props**: `tenantId`, `effectiveStorefrontType`, `policyType` (optional filter), `onApply(template)`
- **Layout**: Storefront-type tabs as primary axis (Online | Retail | Service | Social | Universal)
  - Merchant's effective storefront type tab auto-selected with "Recommended for your storefront" badge
  - Template count badge on each tab (e.g., "Online (8)")
  - Within each tab, templates sub-grouped by policy_type
  - Cards show: title, description, compliance tags (badges), platform icon, fulfillment compatibility indicator
  - "Preview" button opens `TemplatePreviewModal`
  - "Apply" button triggers apply flow

#### 2.3 — `TemplatePreviewModal` Component

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/TemplatePreviewModal.tsx` (new)
- **Features**:
  - Left panel: rendered markdown preview (using existing markdown renderer)
  - Right panel: placeholder form fields generated from `placeholder_schema`
  - "Apply Template" button → calls `PolicyTemplateService.applyTemplate()` → closes modal → refreshes policies
  - "Apply & Edit" button → applies template then switches to textarea editor with generated content
  - Legal disclaimer banner: "Templates are starting points, not legal advice. Consult your attorney."

#### 2.4 — Integrate Gallery into `StorefrontPoliciesClient`

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx`
- **Changes**:
  - Add "Browse Templates" button per policy tab (next to existing textarea editor)
  - Add `TemplateGallery` as collapsible section or modal when "Browse Templates" clicked
  - Add completeness badge per policy: green "Configured", yellow "Not configured", red "Required for your storefront type"
  - Add "Applied from template" indicator if `tenant_policy_template_usage` record exists
  - Fetch effective capabilities to pass `effectiveStorefrontType` to gallery

#### 2.5 — Pass Effective Capabilities from Page

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/page.tsx`
- **Changes**: Fetch effective capabilities server-side, pass `effectiveStorefrontType` to `StorefrontPoliciesClient`

#### 2.6 — Verification

- `pnpm checkapi` passes
- `pnpm checkweb` passes
- Merchant opens policy settings → sees "Browse Templates" button
- Template gallery opens with storefront-type tabs, merchant's type pre-selected
- Merchant previews a template, fills placeholders, applies it
- Applied template content appears in the textarea editor
- Completeness badges show correct status per policy

---

## Sprint 3: Compliance & Jurisdiction Awareness

**Goal:** Jurisdiction detection, compliance checklist, multi-jurisdiction and platform-specific templates, policy completeness scoring.

### Tasks

#### 3.1 — Jurisdiction Detection

- **File**: `apps/api/src/services/PolicyTemplateService.ts`
- **Changes**: Add `detectJurisdiction(tenantId)` method:
  - Query `tenant_business_profiles_list.country_code` for tenant
  - Map country codes to jurisdictions: `US` → `US`, `GB` → `UK`, `EU member states` → `EU`, `AU` → `AU`, `CA` → `CA`, default → `GLOBAL`
  - Return jurisdiction string
- **File**: `apps/api/src/routes/policy-templates.ts`
- **Changes**: `GET /api/tenants/:tenantId/storefront-policies/templates` auto-filters by detected jurisdiction

#### 3.2 — Compliance Checklist Component

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/ComplianceChecklist.tsx` (new)
- **Features**:
  - Shows applicable regulations based on jurisdiction (CCPA for US, GDPR for EU, etc.)
  - Lists required vs. recommended policies per storefront type
  - Red/yellow/green status indicators per policy
  - "Missing required policy" warnings
  - Platform compliance section (Meta Commerce, TikTok Shop, Google Shopping) if integrations are enabled
  - Links to template gallery for missing policies

#### 3.3 — Multi-Jurisdiction Templates

- **File**: `database/migrations/091_policy_templates_compliance.sql` (new)
- **Seed additional templates**:
  - `online_privacy_gdpr` (EU full, with DPO contact placeholder)
  - `online_privacy_uk` (UK post-Brexit, with ICO registration)
  - `online_privacy_lgpd` (Brazil)
  - `online_privacy_pdpa` (Singapore)
  - `online_privacy_pipeda` (Canada)
  - `online_terms_eu_consumer_rights` (EU Consumer Rights Directive compliant)
  - `online_return_eu_14_day` (EU 14-day withdrawal right)
  - `retail_privacy_ccpa_pos` (CCPA with POS data collection)
  - `service_privacy_hipaa_aware` (HIPAA-aware for medical/spa services)
- **Total new templates**: 9

#### 3.4 — Platform-Specific Templates

- **File**: `database/migrations/091_policy_templates_compliance.sql` (same migration)
- **Seed additional templates**:
  - `online_return_meta_commerce` (Meta Commerce compliant return policy)
  - `online_shipping_meta_commerce` (Meta Commerce compliant shipping policy)
  - `online_privacy_meta_commerce` (Meta Commerce compliant privacy policy)
  - `online_terms_tiktok_shop` (TikTok Shop Seller Policy compliant terms)
  - `online_return_tiktok_shop` (TikTok Shop return window compliant)
  - `online_return_google_shopping` (Google Merchant Center compliant return)
- **Total new templates**: 6

#### 3.5 — Policy Completeness Scoring

- **File**: `apps/api/src/services/PolicyTemplateService.ts`
- **Add**: `getPolicyCompleteness(tenantId)` method:
  - Returns `{ policy_type, status: 'complete' | 'partial' | 'missing', required: boolean, recommendations: string[] }` per policy type
  - Required policies determined by storefront type (from analysis §2.1 matrix)
  - "Partial" = policy exists but missing key sections (placeholder detection, min length check)
  - "Complete" = policy exists and passes section checks
- **File**: `apps/api/src/routes/policy-templates.ts`
- **Add**: `GET /api/tenants/:tenantId/storefront-policies/completeness` endpoint

#### 3.6 — Compliance Checklist Integration

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx`
- **Changes**: Add `ComplianceChecklist` component above policy editor. Fetch completeness score on page load.

#### 3.7 — Dashboard Compliance Widget

- **File**: `apps/web/src/components/settings/TenantSettings.tsx`
- **Changes**: Add compliance status badge to the "Storefront Policies" settings card (green/yellow/red based on completeness score)

#### 3.8 — Verification

- `pnpm checkapi` passes
- `pnpm checkweb` passes
- Tenant in EU sees GDPR-compliant template recommendations
- Tenant with Meta Commerce integration sees Meta-compliant templates
- Compliance checklist shows gaps for missing required policies
- Dashboard settings card shows compliance status badge
- `GET /api/tenants/:tenantId/storefront-policies/completeness` returns correct scoring

---

## Sprint 4: Enrichment (Fulfillment Awareness + Versioning + Bot AI)

**Goal:** Templates auto-adapt to fulfillment settings and product types, template versioning with merchant notifications, and bot knowledge integration for AI-assisted template recommendations.

### Tasks

#### 4.1 — Fulfillment & Product Type Awareness

- **File**: `apps/api/src/services/PolicyTemplateService.ts`
- **Changes**:
  - `getTemplatesForTenant()` now filters by `EffectiveFulfillment` (pickup-only tenant doesn't see shipping templates)
  - `getRecommendedTemplates()` scoring adds fulfillment match (2pts) and product type match (2pts)
  - Add `autoFillPlaceholderDefaults(tenantId, template)` — pre-fills placeholders from fulfillment settings (e.g., `SHIPPING_HANDLING_DAYS` from `tenant_fulfillment_settings.shipping_handling_days`, `PICKUP_READY_TIME_MINUTES` from `pickup_ready_time_minutes`)
- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/TemplateGallery.tsx`
- **Changes**: Show fulfillment compatibility badge on cards (e.g., "Pickup" / "Shipping" / "Service")

#### 4.2 — Service-Specific Templates

- **File**: `database/migrations/092_policy_templates_service_fulfillment.sql` (new)
- **Seed**: 8 service storefront templates from analysis §6.2 (cancellation policy, sliding refund, appointment terms, etc.)

#### 4.3 — Template Versioning

- **File**: `apps/api/src/services/PolicyTemplateService.ts`
- **Changes**:
  - `getTemplate(id)` returns `version` and `regulatory_effective_date`
  - Add `getOutdatedTemplateUsage(tenantId)` — compares `tenant_policy_template_usage.template_version` against current `policy_templates.version`, returns list of outdated applications
  - Add `getTemplatesNeedingReview()` (admin) — returns templates where `regulatory_effective_date` is approaching or passed and merchants haven't updated
- **File**: `apps/api/src/routes/policy-templates.ts`
- **Add**: `GET /api/admin/policy-templates/needing-review` endpoint

#### 4.4 — Merchant Notifications for Template Updates

- **File**: `apps/api/src/services/subscription/BillingNotificationService.ts`
- **Add**: `policy_template_updated` notification type
  - Email template: "A policy template you used has been updated due to regulatory changes"
  - CRM alert payload: template key, old version, new version, policy type
- **File**: `apps/api/src/services/PolicyTemplateService.ts`
- **Changes**: When admin updates a template's version, fire `policy_template_updated` notification to all tenants with `tenant_policy_template_usage` records for that template

#### 4.5 — Merchant "Review Recommended" Banner

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx`
- **Changes**: Fetch `getOutdatedTemplateUsage()` on page load. If any templates are outdated, show banner: "A policy template you used has been updated — review recommended" with link to template gallery.

#### 4.6 — Bot Knowledge Integration

- **File**: `apps/api/src/services/BotKnowledgeEmbeddingService.ts`
- **Add**: `refreshPolicyTemplateEmbeddings()` method — embeds all active template content with `source_type='policy_template'`
- **File**: `apps/api/src/services/PolicyTemplateService.ts`
- **Changes**: After admin create/update, fire-and-forget `refreshPolicyTemplateEmbeddings()`

#### 4.7 — Bot Template Recommendations

- **File**: `apps/api/src/services/BotDynamicResponseService.ts`
- **Changes**: Add policy template RAG search — bot can answer "which return policy template should I use?" by searching template embeddings
- **File**: `apps/api/src/services/PolicyTemplateService.ts`
- **Changes**: `getRecommendedTemplates()` results embedded in bot response context

#### 4.8 — "AI-Suggested" Badge in Gallery

- **File**: `apps/web/src/app/t/[tenantId]/settings/policies/TemplateGallery.tsx`
- **Changes**: Show "Recommended" badge on top-scoring template per policy type (from `getRecommendedTemplates()`)

#### 4.9 — Verification

- `pnpm checkapi` passes
- `pnpm checkweb` passes
- Tenant with pickup-only fulfillment doesn't see shipping policy templates
- Placeholder defaults pre-filled from fulfillment settings
- Admin updates template version → merchant sees "review recommended" banner
- `policy_template_updated` notification fires via `BillingNotificationService`
- Bot can answer template recommendation questions
- Gallery shows "Recommended" badge on best-matching template

---

## Sprint 1 Start Criteria

- [ ] Analysis document (`STOREFRONT_POLICY_TEMPLATES_ANALYSIS.md`) reviewed and approved
- [ ] Sprint plan reviewed and approved
- [ ] No blocking TS errors on `pnpm checkapi` or `pnpm checkweb`
- [ ] Legal review of seed template content initiated (can run in parallel with Sprint 1 engineering)

## Sprint 1 Done Criteria

- [ ] Migration `090_policy_templates.sql` created and idempotent
- [ ] Prisma schema updated with `policy_templates` + `tenant_policy_template_usage` models
- [ ] `PolicyTemplateService.ts` — singleton with all methods, 60s cache, static fallback
- [ ] `policy-templates.ts` routes — all endpoints functional with Zod validation
- [ ] `StorefrontPolicyService.ts` — `applyTemplate()` method added
- [ ] `index.ts` — policy-templates routes mounted
- [ ] Admin template management page functional
- [ ] 15 templates seeded (8 online, 4 universal, 3 social)
- [ ] `pnpm checkapi` passes
- [ ] `pnpm checkweb` passes

## Sprint 2 Done Criteria

- [ ] `PolicyTemplateService.ts` (frontend) — singleton extending `TenantApiSingleton`
- [ ] `TemplateGallery.tsx` — storefront-type tabs, pre-selected, cards with compliance badges
- [ ] `TemplatePreviewModal.tsx` — markdown preview, placeholder form, apply flow
- [ ] `StorefrontPoliciesClient.tsx` — "Browse Templates" button, gallery integration, completeness badges
- [ ] `page.tsx` — passes effective capabilities to client
- [ ] `pnpm checkapi` passes
- [ ] `pnpm checkweb` passes

## Sprint 3 Done Criteria

- [ ] `detectJurisdiction()` method functional
- [ ] `ComplianceChecklist.tsx` — shows applicable regulations, required/recommended policies, status indicators
- [ ] 15 additional templates seeded (9 multi-jurisdiction + 6 platform-specific)
- [ ] `getPolicyCompleteness()` endpoint functional
- [ ] Dashboard settings card shows compliance status badge
- [ ] `pnpm checkapi` passes
- [ ] `pnpm checkweb` passes

## Sprint 4 Done Criteria

- [ ] Fulfillment/product-type filtering in `getTemplatesForTenant()`
- [ ] Placeholder auto-fill from fulfillment settings
- [ ] 8 service storefront templates seeded
- [ ] Template versioning with `getOutdatedTemplateUsage()` and `getTemplatesNeedingReview()`
- [ ] `policy_template_updated` notification type in `BillingNotificationService`
- [ ] "Review recommended" banner in policy settings
- [ ] `refreshPolicyTemplateEmbeddings()` in `BotKnowledgeEmbeddingService`
- [ ] Bot can answer template recommendation questions
- [ ] "Recommended" badge in gallery
- [ ] `pnpm checkapi` passes
- [ ] `pnpm checkweb` passes

---

## Key Patterns to Follow

- **Singleton pattern**: `PolicyTemplateService` extends `BaseService` (same as `StorefrontPolicyService`, `BadgeRegistryService`)
- **Cache pattern**: 60s in-memory cache with static fallback (same as `BadgeRegistryService`)
- **Route pattern**: Public + tenant + admin endpoints in single router (same as `badge-registry.ts`)
- **Frontend singleton**: Extend `TenantApiSingleton` (same as `TenantStorefrontPolicyService`)
- **Migration pattern**: Tables + RLS + seeds in single migration file (same as `060_featured_type_registry.sql`)
- **ID generation**: Use `id-generator.ts` with tenant-scoped format (same as `generateStorefrontPolicyId`)
- **Notification pattern**: Add to `BillingNotificationService` (same as Featured Placement notifications)
- **Bot embedding pattern**: Fire-and-forget `refreshPolicyTemplateEmbeddings()` (same as `refreshPolicyEmbeddings`)
- **Navigation**: Database-driven nav — sync via SQL INSERT or admin API (see `.devin/skills/database-navigation-system.md`)

---

## Risk Register

| Risk | Mitigation | Sprint |
|---|---|---|
| Legal review delays seed content | Engineering drafts templates; legal reviews in parallel with Sprint 1; templates marked `regulatory_effective_date` when approved | Sprint 1 |
| Template content creates legal obligations | Disclaimer in admin UI, preview modal, and applied policies; "Consult your attorney" callout | Sprint 2 |
| Social commerce platform policy changes | Platform-specific templates versioned; `regulatory_effective_date` tracks platform policy updates | Sprint 3+4 |
| Low template adoption | Storefront-type grouping for discoverability; "Recommended" badge; bot assistance; completeness scoring creates urgency | Sprint 2+4 |
| Template DB performance | 60s cache + static fallback; indexes on `(storefront_type, policy_type, is_active)` | Sprint 1 |
