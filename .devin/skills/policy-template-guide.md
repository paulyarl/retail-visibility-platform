---
description: Complete guide for implementing and extending the Storefront Policy Templates system — covers data model, storefront-type grouping, compliance alignment, template versioning, bot integration, and patterns from the sprint implementation
---

# Policy Template Guide

> **Read this before working on any policy template feature.** This guide captures patterns, conventions, and architecture decisions from the Storefront Policy Templates analysis and sprint plan.

## Feature Overview

Policy Templates provide pre-defined, customizable policy content (return, shipping, privacy, terms, refund) that merchants can apply to their storefront instead of writing from scratch. Templates are grouped by storefront type as the primary organizational axis and filtered by the merchant's effective capabilities.

**Design docs**: `docs/STOREFRONT_POLICY_TEMPLATES_ANALYSIS.md`, `docs/STOREFRONT_POLICY_TEMPLATES_SPRINT_PLAN.md`

---

## 1. Data Model

### Core Tables

| Table | Purpose |
|---|---|
| `policy_templates` | Admin-managed template definitions with markdown content, placeholders, compliance tags, and storefront-type grouping |
| `tenant_policy_template_usage` | Audit trail of which templates a tenant applied, including version and customization status |
| `tenant_storefront_policies` | Existing table — stores the actual policy content per tenant (unchanged by this feature) |

### Key Columns on `policy_templates`

- `template_key`: Unique identifier (e.g., `online_standard_return`). Prefix follows convention: `{storefront_type}_{policy_focus}_{variant}`
- `storefront_type`: Primary grouping axis — `online` | `retail` | `service` | `social` | `all`. This is the single source of truth for catalog grouping.
- `policy_type`: `return_policy` | `shipping_policy` | `privacy_policy` | `terms_of_service` | `refund_policy` (matches existing `PolicyType`)
- `product_type`: `physical` | `digital` | `hybrid` | `service` | `all` — filters templates by tenant's product types
- `fulfillment_mode`: `pickup` | `delivery` | `shipping` | `service` | `all` — filters templates by tenant's fulfillment settings
- `jurisdiction`: `US` | `EU` | `UK` | `AU` | `CA` | `GLOBAL` — filters by tenant's country
- `platform`: `meta` | `tiktok` | `google` | `generic` — filters by social commerce integrations
- `content_markdown`: Template body with `[BRACKETED_UPPERCASE]` placeholders
- `placeholder_schema`: JSONB array of `{key, label, type, required, default, options?}` for form generation
- `compliance_tags`: Text array (e.g., `['CCPA', 'GDPR', 'FTC_MAIL_ORDER']`) for compliance checklist
- `version`: Semantic versioning for template updates
- `regulatory_effective_date`: When the regulations backing this template take effect

### Key Columns on `tenant_policy_template_usage`

- `template_version`: Version at time of application (for outdated template detection)
- `customized`: Whether merchant modified content after applying (adoption metric)
- `placeholder_values`: JSONB of filled values (audit trail)

---

## 2. Storefront-Type Grouping — Primary Design Principle

The template catalog uses **storefront type as its primary organizational axis**, not policy type. This maximizes adoption ease because merchants identify with their business model first, not their policy types.

### Grouping Hierarchy

```
Template Catalog
├── Online Storefront (pre-selected if effective_type='online')
│   ├── Return Policy templates
│   ├── Shipping Policy templates
│   └── ...
├── Retail Storefront
├── Service Storefront
├── Social Storefront
└── Universal (always visible, cross-cutting)
```

### UX Behavior

- Merchant's effective storefront type tab is auto-selected on page load with "Recommended for your storefront" badge
- Template count badge on each tab (e.g., "Online (8)")
- Templates with `storefront_type='all'` appear in Universal section AND cross-reference in each type section with "Universal" tag
- For `flexible` storefront type: all type-specific tabs shown with equal priority; "Recommended" badge on type best matching product types + fulfillment settings

### API Support

- `GET /api/tenants/:tenantId/storefront-policies/templates?group_by=storefront_type` returns structured response:
  ```json
  {
    "groups": [
      {"storefront_type": "online", "label": "Online Storefront", "recommended": true, "count": 8, "templates": [...]},
      {"storefront_type": "retail", "label": "Retail Storefront", "recommended": false, "count": 0, "templates": []}
    ]
  }
  ```

---

## 3. Backend Services

### `PolicyTemplateService` (extends `BaseService`)

**File**: `apps/api/src/services/PolicyTemplateService.ts`

Key methods:
- `getTemplates(filters?)` — list with optional filters
- `getTemplate(id)` / `getTemplateByKey(key)` — single template lookup
- `getTemplatesForTenant(tenantId)` — resolve effective capabilities, return filtered templates
- `getTemplatesGroupedByStorefrontType(tenantId)` — structured grouped response with `recommended` flag
- `getRecommendedTemplates(tenantId)` — rule-based scoring (storefront type 3pts, fulfillment 2pts, jurisdiction 2pts, platform 1pt)
- `applyTemplate(tenantId, templateId, placeholderValues)` — substitute placeholders, upsert policies, log usage, trigger embeddings
- `detectJurisdiction(tenantId)` — map `country_code` to jurisdiction string
- `getPolicyCompleteness(tenantId)` — score policies as complete/partial/missing per storefront type requirements
- `getOutdatedTemplateUsage(tenantId)` — compare applied version vs current template version

**Caching**: 60s in-memory cache with `STATIC_TEMPLATES` fallback (same pattern as `BadgeRegistryService`).

### `StorefrontPolicyService` Extension

**File**: `apps/api/src/services/StorefrontPolicyService.ts`

The existing service gains an `applyTemplate()` method that:
1. Fetches template from `PolicyTemplateService`
2. Substitutes `[PLACEHOLDERS]` in `content_markdown`
3. Calls existing `upsertPolicies()` with generated content
4. Logs usage via `PolicyTemplateService.logTemplateUsage()`
5. Fire-and-forget `BotKnowledgeEmbeddingService.refreshPolicyEmbeddings()`
6. Calls `invalidateEffectiveCapabilities(tenantId)`

---

## 4. Template Resolution Flow

```
1. Merchant opens Policy Settings
2. Frontend fetches:
   a. Current policies (existing flow)
   b. Effective capabilities (storefront type, fulfillment, product types)
   c. Available templates filtered by:
      - storefront_type matches effective_type OR 'all'
      - product_type matches allowed_types OR 'all'
      - fulfillment_mode matches effective fulfillment OR 'all'
      - jurisdiction from tenant's country_code
      - platform from social commerce integrations
3. UI presents catalog grouped by storefront_type (primary axis)
4. Merchant selects template → preview renders markdown
5. Merchant fills [PLACEHOLDERS] via form (from placeholder_schema)
6. System generates final markdown by substituting placeholders
7. Merchant can further edit generated content
8. On save: policies stored as before, template usage logged
```

---

## 5. Placeholder Convention

All templates use `[BRACKETED_UPPERCASE]` placeholders with corresponding `placeholder_schema` entries:

```json
[
  {"key": "STORE_NAME", "label": "Store Name", "type": "text", "required": true, "default": null},
  {"key": "RETURN_WINDOW_DAYS", "label": "Return Window (days)", "type": "number", "required": true, "default": 30},
  {"key": "RETURN_SHIPPING_RESPONSIBILITY", "label": "Who pays return shipping?", "type": "select", "options": ["customer", "store"], "required": true, "default": "customer"}
]
```

Placeholder types: `text`, `number`, `select`, `textarea`, `date`.

Auto-fill: Some placeholders can be pre-filled from tenant settings:
- `SHIPPING_HANDLING_DAYS` ← `tenant_fulfillment_settings.shipping_handling_days`
- `PICKUP_READY_TIME_MINUTES` ← `tenant_fulfillment_settings.pickup_ready_time_minutes`
- `DELIVERY_RADIUS_MILES` ← `tenant_fulfillment_settings.delivery_radius_miles`
- `STORE_NAME` ← tenant business profile name

---

## 6. Compliance & Regulatory Alignment

### Jurisdiction Mapping

| Country Code | Jurisdiction | Key Frameworks |
|---|---|---|
| US | US | CCPA, FTC Mail Order Rule, state privacy laws |
| EU member states | EU | GDPR, Consumer Rights Directive, Omnibus Directive |
| GB | UK | UK GDPR, Consumer Rights Act 2015 |
| AU | AU | Australian Consumer Law, Privacy Act |
| CA | CA | PIPEDA |
| BR | GLOBAL (with LGPD tag) | LGPD |
| SG | GLOBAL (with PDPA tag) | PDPA |
| Default | GLOBAL | Minimal universal compliance |

### Compliance Tags

Each template carries `compliance_tags` that drive the compliance checklist UI:
- `CCPA` — California Consumer Privacy Act
- `GDPR` — General Data Protection Regulation
- `LGPD` — Brazilian General Data Protection Law
- `DPDP` — India's Digital Personal Data Protection Act
- `PDPA` — Singapore's Personal Data Protection Act
- `FTC_MAIL_ORDER` — FTC Mail Order Rule (US)
- `EU_CONSUMER_RIGHTS` — EU Consumer Rights Directive
- `EU_OMNIBUS` — EU Omnibus Directive (pricing transparency)
- `META_COMMERCE` — Meta Commerce Merchant Quality
- `TIKTOK_SHOP` — TikTok Shop Seller Policies
- `GOOGLE_MERCHANT` — Google Merchant Center policies

### Policy Requirements by Storefront Type

| Policy | Online | Retail | Service | Social |
|---|---|---|---|---|
| Return | Required | Required | Conditional (cancellation) | Required |
| Shipping | Required | Optional | N/A | Required |
| Privacy | Required | Required | Required | Required |
| Terms | Required | Recommended | Required | Required |
| Refund | Required | Required | Required | Required |

---

## 7. Template Versioning

### Version Lifecycle

1. Admin creates template at `version='1.0.0'`
2. Merchant applies template → `tenant_policy_template_usage` records version
3. Regulation changes → admin updates template content, bumps to `version='1.1.0'`, sets `regulatory_effective_date`
4. System detects outdated usage via `getOutdatedTemplateUsage()`
5. Merchant sees "Review Recommended" banner in policy settings
6. `BillingNotificationService` fires `policy_template_updated` notification

### Notification

`policy_template_updated` notification type in `BillingNotificationService`:
- Email: "A policy template you used has been updated due to regulatory changes"
- CRM alert: template key, old version, new version, policy type

---

## 8. Bot Knowledge Integration

- Template content embedded with `source_type='policy_template'` via `BotKnowledgeEmbeddingService.refreshPolicyTemplateEmbeddings()`
- Bot can answer: "Which return policy template should I use?", "What privacy policy do I need for GDPR?", "Do I need a shipping policy?"
- `getRecommendedTemplates()` results can be surfaced in bot responses
- Embedding refresh is fire-and-forget after admin create/update

---

## 9. Frontend Components

### `TemplateGallery`

Storefront-type tabs as primary axis. Cards show:
- Title + description
- Compliance tag badges (CCPA, GDPR, etc.)
- Platform icon (Meta, TikTok, Google) if platform-specific
- Fulfillment compatibility indicator
- "Recommended" badge on top-scoring template per policy type

### `TemplatePreviewModal`

- Left panel: rendered markdown preview
- Right panel: placeholder form fields from `placeholder_schema`
- "Apply Template" and "Apply & Edit" buttons
- Legal disclaimer banner

### `ComplianceChecklist`

- Applicable regulations based on jurisdiction
- Required vs. recommended policies per storefront type
- Red/yellow/green status indicators
- Links to template gallery for missing policies

---

## 10. Key Patterns from the Codebase

### Registry Pattern (from Badge Architecture)

Policy templates follow the same data-driven registry pattern as `featured_type_registry`:
- Hardcoded policy placeholders in `StorefrontPoliciesClient.tsx` → replaced by DB-driven template catalog
- Adding a template = INSERT a row, not a code change
- 60s cache with static fallback for resilience

### Two-Concern Separation (from Badge Architecture)

- **Definition** (policy_templates): What templates exist, their content, placeholders, compliance tags
- **Application** (tenant_policy_template_usage): Which templates a tenant applied, when, with what values
- These evolve on different timelines — definitions change rarely, applications change constantly

### Singleton Service Pattern

`PolicyTemplateService` extends `BaseService` with:
- `protected prisma` — Prisma client
- `protected logger` — structured logger
- `protected handleError()` — error normalization
- `protected validateRequired()` — param validation
- Static `getInstance()` — singleton accessor

### Frontend Singleton Pattern

`PolicyTemplateService` (frontend) extends `TenantApiSingleton`:
- `makeDefaultRequest()` for authenticated API calls
- Cache invalidation on write operations
- Same pattern as `TenantStorefrontPolicyService`, `FeaturedPlacementPurchaseService`

### Navigation

**Database-driven navigation only.** Do not add links to file-based nav arrays. Sync via SQL INSERT or admin API. See `.devin/skills/database-navigation-system.md`.

---

## 11. File Inventory

### New Files

| File | Sprint | Description |
|---|---|---|
| `database/migrations/090_policy_templates.sql` | 1 | Tables + RLS + 15 seed templates |
| `database/migrations/091_policy_templates_compliance.sql` | 3 | 15 compliance/platform-specific templates |
| `database/migrations/092_policy_templates_service_fulfillment.sql` | 4 | 8 service storefront templates |
| `apps/api/src/services/PolicyTemplateService.ts` | 1 | Backend singleton service |
| `apps/api/src/routes/policy-templates.ts` | 1 | Public/tenant/admin routes |
| `apps/web/src/services/PolicyTemplateService.ts` | 2 | Frontend singleton service |
| `apps/web/src/app/t/[tenantId]/settings/policies/TemplateGallery.tsx` | 2 | Storefront-type grouped catalog |
| `apps/web/src/app/t/[tenantId]/settings/policies/TemplatePreviewModal.tsx` | 2 | Preview + placeholder form |
| `apps/web/src/app/t/[tenantId]/settings/policies/ComplianceChecklist.tsx` | 3 | Compliance status indicators |
| `apps/web/src/app/(platform)/settings/admin/policy-templates/page.tsx` | 1 | Admin management page |
| `apps/web/src/app/(platform)/settings/admin/policy-templates/PolicyTemplateAdminClient.tsx` | 1 | Admin CRUD client |

### Modified Files

| File | Sprint | Changes |
|---|---|---|
| `apps/api/prisma/schema.prisma` | 1 | Add `policy_templates` + `tenant_policy_template_usage` models |
| `apps/api/src/lib/id-generator.ts` | 1 | Add `generatePolicyTemplateId()`, `generatePolicyTemplateUsageId()` |
| `apps/api/src/services/StorefrontPolicyService.ts` | 1 | Add `applyTemplate()` method |
| `apps/api/src/index.ts` | 1 | Mount policy-templates routes |
| `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx` | 2 | Template gallery integration, completeness badges |
| `apps/web/src/app/t/[tenantId]/settings/policies/page.tsx` | 2 | Pass effective capabilities |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | 4 | Add `policy_template_updated` type |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | 4 | Add `refreshPolicyTemplateEmbeddings()` |
| `apps/api/src/services/BotDynamicResponseService.ts` | 4 | Add policy template RAG search |
| `apps/web/src/components/settings/TenantSettings.tsx` | 3 | Compliance status badge on policies card |

---

## 12. Anti-Patterns to Avoid

### Don't hardcode template content in code

Template content belongs in the database (`policy_templates.content_markdown`), not in source files. The only exception is the `STATIC_TEMPLATES` fallback array for resilience when the DB is unavailable.

### Don't filter templates client-side

All filtering by storefront type, fulfillment, product type, jurisdiction, and platform should happen server-side in `getTemplatesForTenant()`. The client receives only relevant templates.

### Don't skip the usage log

Every template application must create a `tenant_policy_template_usage` record. This is the audit trail for compliance and the data source for adoption metrics and outdated template detection.

### Don't apply templates without placeholder substitution

Never store raw template content with `[PLACEHOLDERS]` in `tenant_storefront_policies`. Always substitute placeholders first. If a required placeholder is missing, reject the application with a validation error.

### Don't forget the legal disclaimer

Template content is a convenience, not legal advice. The disclaimer must appear in:
- Admin template management UI
- Template preview modal
- Applied policy content (optional footer)

---

## 13. Testing Checklist

- [ ] `getTemplatesForTenant()` filters correctly by storefront type, fulfillment, product types, jurisdiction
- [ ] `getTemplatesGroupedByStorefrontType()` returns correct `recommended` flag
- [ ] `applyTemplate()` substitutes all placeholders, stores content, logs usage
- [ ] `applyTemplate()` rejects if required placeholders are missing
- [ ] `applyTemplate()` triggers `invalidateEffectiveCapabilities` and embedding refresh
- [ ] `detectJurisdiction()` maps country codes correctly
- [ ] `getPolicyCompleteness()` returns correct status per storefront type
- [ ] `getOutdatedTemplateUsage()` detects version mismatches
- [ ] `policy_template_updated` notification fires on template version update
- [ ] Admin can create/edit/deactivate templates
- [ ] Template gallery shows correct tabs with merchant's type pre-selected
- [ ] Template preview renders markdown correctly
- [ ] Placeholder form generates correct field types from `placeholder_schema`
- [ ] Compliance checklist shows correct regulations per jurisdiction
- [ ] Bot can answer template recommendation questions

---

## 14. Sprint 4 Implementation Insights

> **Lessons learned from building the Enrichment sprint.** Read this before extending the template system.

### 14.1 Effective Capabilities — The Single Source for Tenant Filtering

`getTemplatesForTenant()` and `getRecommendedTemplates()` both call `resolveEffectiveCapabilities(tenantId)` to get the tenant's storefront type, fulfillment modes, and product types. This is the **only** correct way to access tenant settings for template filtering.

**Pattern** (from `PolicyTemplateService.ts`):
```typescript
const caps = await resolveEffectiveCapabilities(tenantId);
const storefrontType = caps.effective.storefront?.effective_type ?? 'online';
const fulfillment = caps.effective.fulfillment;
const productTypes = caps.effective.product_types;

const fulfillmentModes: string[] = ['all'];
if (fulfillment?.effective_shows_pickup) fulfillmentModes.push('pickup');
if (fulfillment?.effective_shows_delivery) fulfillmentModes.push('delivery');
if (fulfillment?.effective_shows_shipping) fulfillmentModes.push('shipping');
if (fulfillment?.shows_service) fulfillmentModes.push('service');

const effectiveProductTypes: string[] = ['all'];
if (productTypes?.effective_types) effectiveProductTypes.push(...productTypes.effective_types);
```

**Key fields on `EffectiveCapabilities`**:
- `effective.storefront.effective_type` — `online` | `retail` | `service` | `social`
- `effective.fulfillment.effective_shows_pickup/delivery/shipping` — booleans
- `effective.fulfillment.shows_service` — boolean (note: no `effective_` prefix)
- `effective.product_types.effective_types` — string array like `['physical', 'digital']`

**Gotcha**: Always include `'all'` in the filter arrays. Templates with `fulfillmentMode='all'` or `productType='all'` should always pass the filter.

### 14.2 Auto-Fill Placeholder Defaults — Prisma Field Names Matter

The `autoFillPlaceholderDefaults()` method reads from three Prisma models:
- `tenants` — `name` (store name)
- `tenant_fulfillment_settings` — `shipping_handling_days`, `pickup_ready_time_minutes`, `pickup_instructions`, `delivery_time_hours`, `delivery_radius_miles`
- `tenant_business_profiles_list` — `email` (NOT `contact_email`!), `country_code`

**Critical**: The `tenant_business_profiles_list` model uses `email`, not `contact_email`. Always verify field names against `schema.prisma` before writing Prisma queries.

**Pattern**:
```typescript
const [fulfillment, profile, tenant] = await Promise.all([
  this.prisma.tenant_fulfillment_settings.findUnique({ where: { tenant_id: tenantId } }),
  this.prisma.tenant_business_profiles_list.findFirst({ where: { tenant_id: tenantId } }),
  this.prisma.tenants.findUnique({ where: { id: tenantId }, select: { name: true } }),
]);
```

The method iterates `template.placeholderSchema` and matches `entry.key.toUpperCase()` against known placeholder keys. Always provide a fallback to `entry.default` for unmatched keys.

### 14.3 Template Versioning — Two Distinct Queries

**Tenant-side** (`getOutdatedTemplateUsage`): Fetches the tenant's `tenant_policy_template_usage` records and compares `template_version` against the current `policy_templates.version`. Returns records where they differ.

**Admin-side** (`getTemplatesNeedingReview`): Scans ALL usage records across all tenants (capped at 500) and returns a flat list with tenant ID, template details, and version diff. Uses a local `Map` cache to avoid re-fetching the same template.

**Route ordering matters**: The `/tenants/:tenantId/storefront-policies/templates/outdated` route must be registered BEFORE `/tenants/:tenantId/storefront-policies/templates/:templateId/auto-fill` to avoid Express matching `outdated` as a `templateId` parameter.

### 14.4 BillingNotificationService — Adding a New Notification Type

To add a new notification type to `BillingNotificationService`:

1. **Add to the `BillingNotificationType` union type** (line ~16-47)
2. **Add a `case` in `buildEmailPayload()`** — returns `{ to, subject, html, text }`
3. **Add a `case` in `buildCrmAlertPayload()`** — returns `{ title, body, icon }`
4. **Add `build<Type>Html()` and `build<Type>Text()` private methods** at the end of the class

**Pattern for email HTML**:
```typescript
private buildPolicyTemplateUpdatedHtml(name: string, business: string, data: BillingNotificationData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Hi ${name},</h2>
      ...
    </div>
  `;
}
```

**Metadata convention**: Pass template-specific data via `data.metadata`:
```typescript
{ tenantId, type: 'policy_template_updated', metadata: { templateTitle, appliedVersion, currentVersion, policyType, reason } }
```

### 14.5 Bot Knowledge Integration — Dynamic Import Pattern

When `BotKnowledgeEmbeddingService` needs to call `PolicyTemplateService`, use a **dynamic import** to avoid circular dependency:

```typescript
const { PolicyTemplateService } = await import('./PolicyTemplateService');
const service = PolicyTemplateService.getInstance();
```

**Critical**: Use the **named export** `{ PolicyTemplateService }` (the class), NOT `{ default: PolicyTemplateService }` (which is the singleton instance). The default export is `policyTemplateService` (an instance), so `default.getInstance()` would fail.

**Embedding chunk format**: Each recommended template becomes one chunk with structured text:
```
Policy Template: <title>
Policy Type: <type>
Storefront: <storefrontType>
Version: <version>
Description: <description>
Compliance: <tags>
Jurisdiction: <jurisdiction>
Fulfillment: <mode>
```

**source_type**: Use `'policy_template'` (distinct from `'policy'` which is for applied store policies).

### 14.6 BotDynamicResponseService — RAG Search Block Pattern

Each knowledge source follows the same try/catch block pattern in `BotDynamicResponseService.generateResponse()`:

```typescript
try {
  const hasSource = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'source_type');
  if (hasSource) {
    const result = await knowledgeService.searchKnowledge(tenantId, message, ['source_type'], N);
    if (result.chunks.length > 0) {
      knowledgeContext += '\n\n<Label> context:\n' +
        result.chunks.map(c => c.chunkText).join('\n\n');
      knowledgeContextUsed = true;
    }
  }
} catch (error) {
  logger.warn('[BotDynamicResponseService] <Label> RAG search failed, continuing without it', ...);
}
```

Each block is **independent** — failure in one source doesn't block others. All blocks are nested inside a single outer try/catch for the knowledge section.

### 14.7 TemplateGallery — Recommended Badge Pattern

The gallery fetches recommended template IDs separately from the grouped templates:

```typescript
const [groups, recommendedIds] = await Promise.all([
  policyTemplateService.getTemplatesGrouped(tenantId),
  policyTemplateService.getRecommendedTemplates(tenantId)
    .then(recs => new Set(recs.map(r => r.template?.id).filter(Boolean) as string[]))
]);
```

The `Set<string>` is passed down to `TemplateCard` as `isRecommended` prop. The badge renders as an indigo pill: `AI-Suggested`.

### 14.8 StorefrontPoliciesClient — Outdated Banner Pattern

The outdated templates banner uses a `useEffect` to fetch `getOutdatedUsage()` on mount, storing results in state. The banner only renders when `outdatedTemplates.length > 0`:

- Amber background (`bg-amber-50 border-amber-300`)
- `RefreshCw` icon from lucide-react
- Lists each outdated template with version transition (`v1.0.0 → v1.1.0`)
- Links to template gallery via `setShowTemplates(true)`

### 14.9 Migration SQL — Service Template Seeding

When seeding templates in migration SQL:

- Use `ON CONFLICT (template_key) DO NOTHING` for idempotency
- `placeholder_schema` must be cast as `::jsonb`
- `compliance_tags` must be cast as `text[]` using `ARRAY[...]::text[]`
- Use sequential `sort_order` values (30-37 for Sprint 4 service templates, continuing from Sprint 3's 20-29)
- Escaped apostrophes in content: `Consultant''s` (double single-quote in SQL)
- `regulatory_effective_date` for HIPAA: `'2003-04-14T00:00:00Z'` (HIPAA Privacy Rule effective date)

### 14.10 File Change Summary (Sprint 4)

| File | Change |
|---|---|
| `apps/api/src/services/PolicyTemplateService.ts` | Product type filter + scoring, `autoFillPlaceholderDefaults()`, `getTemplatesNeedingReview()` |
| `apps/api/src/routes/policy-templates.ts` | `GET .../templates/outdated`, `GET .../templates/:templateId/auto-fill`, `GET /admin/policy-templates/needing-review` |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | `policy_template_updated` type + email templates + CRM alert |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | `refreshPolicyTemplateEmbeddings()` + dispatch wiring |
| `apps/api/src/services/BotDynamicResponseService.ts` | Policy template RAG search block |
| `apps/web/src/services/PolicyTemplateService.ts` | `getAutoFillDefaults()`, `getOutdatedUsage()`, `OutdatedUsageRecord` interface |
| `apps/web/src/app/t/[tenantId]/settings/policies/TemplateGallery.tsx` | Fulfillment badge, AI-Suggested badge, recommended IDs fetch |
| `apps/web/src/app/t/[tenantId]/settings/policies/TemplatePreviewModal.tsx` | Auto-fill defaults on mount via `useEffect` |
| `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx` | Outdated templates banner |
| `database/migrations/092_policy_templates_service_fulfillment.sql` | 8 service storefront templates |
