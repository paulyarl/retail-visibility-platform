# Storefront Policy Templates — Analysis & Development Plan

**Status**: Draft — Analysis & Design
**Date**: 2026-07-07
**Scope**: Policy template system for all storefront types (online, retail, service, social) with compliance, regulatory, and risk alignment

---

## 1. Current State Assessment

### 1.1 What Exists Today

**Policy Storage**: `tenant_storefront_policies` table — one row per tenant with 5 free-text markdown fields:

| Field | Description |
|---|---|
| `return_policy` | How/when customers can return items |
| `shipping_policy` | Shipping methods, timeframes, costs |
| `privacy_policy` | How merchant collects/uses customer data |
| `terms_of_service` | Terms governing storefront use |
| `refund_policy` | Refund process and timelines |

**Policy Service**: `apps/api/src/services/StorefrontPolicyService.ts` — singleton with `getPolicies()`, `getPublicPolicy()`, `upsertPolicies()`. No template awareness.

**Policy Routes**: `apps/api/src/routes/storefront-policies.ts` — public read, merchant read, merchant update (PUT with Zod validation). Triggers `BotKnowledgeEmbeddingService.refreshPolicyEmbeddings()` on update.

**Policy UI**: `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx` — tabbed textarea editor with static placeholder text per policy type. No template selection, no storefront-type awareness, no compliance guidance.

**Capability Gate**: `storefront_policies` feature key in `storefront_types` capability group. `EffectiveStorefront.policies_enabled` flag controls whether the policies feature is available for a tier.

**Storefront Types**: `online`, `retail`, `service`, `social`, `flexible` — resolved via `StorefrontTypeService` + `StorefrontTypeResolver`. Each type has distinct fulfillment, product, and compliance implications.

**Fulfillment Settings**: `tenant_fulfillment_settings` table with pickup/delivery/shipping configuration. Resolved via `FulfillmentResolver` with tier-gated `shows_pickup`, `shows_delivery`, `shows_shipping`, `shows_service` flags.

**Cross-Capability Constraints**: 8 declarative constraints in `CapabilityConstraintRegistry.ts` linking storefront types to product types, fulfillment, and social commerce. Enforced via `CapabilityConstraintResolver` as Step 5.5 in the effective capability pipeline.

**Compliance Infrastructure**:
- `docs/GOVERNANCE_COMPLIANCE_FRAMEWORK.md` — covers CCPA, GDPR, LGPD, DPDP, PDPA with compliance registry schema
- `apps/api/src/services/gdpr-compliance.ts` + `apps/api/src/routes/gdpr.ts` — GDPR data subject access requests
- `apps/api/src/services/CcpaComplianceService.ts` — CCPA compliance service
- `docs/SOCIAL_COMMERCE_INTEGRATION_PLAN.md` Phase 1B identified per-tenant storefront policies as a P0 gap

### 1.2 What's Missing

| Gap | Impact |
|---|---|
| **No template library** | Merchants write policies from scratch — high friction, inconsistent quality |
| **No storefront-type awareness** | A service business gets the same placeholder as an online retailer — irrelevant content |
| **No fulfillment-aware templates** | Shipping policy placeholder doesn't reflect actual fulfillment settings (pickup-only vs. shipping-enabled) |
| **No compliance guidance** | Privacy policy doesn't reference CCPA/GDPR requirements or data handling specifics |
| **No regulatory jurisdiction detection** | No awareness of merchant's country/region — can't tailor privacy policy to applicable law |
| **No policy completeness scoring** | No indication of whether policies are adequate for the merchant's storefront type |
| **No template versioning** | No way to update templates when regulations change and notify affected merchants |
| **No policy preview** | Merchants can't see how policies render on their storefront before saving |

---

## 2. Storefront Type Taxonomy & Policy Implications

### 2.1 Storefront Type → Policy Requirements Matrix

| Policy | Online | Retail | Service | Social |
|---|---|---|---|---|
| **Return Policy** | Required — return window, shipping responsibility, condition requirements | Required — in-store return process, receipt requirements | Conditional — cancellation/refund policy for services | Required — return window for physical goods, digital goods policy |
| **Shipping Policy** | Required — methods, timeframes, costs, international scope | Optional — may offer ship-to-store | Not applicable typically | Required — shipping from social commerce orders |
| **Privacy Policy** | Required — data collection for checkout, analytics, marketing | Required — in-store + online data | Required — customer data for scheduling | Required — social platform data sharing disclosures |
| **Terms of Service** | Required — order acceptance, pricing, liability | Recommended — in-store policies | Required — service agreement, cancellation terms | Required — social platform-specific terms |
| **Refund Policy** | Required — refund method, timeline, partial refunds | Required — cash vs. card refund, store credit | Required — cancellation refund sliding scale | Required — refund method for social orders |

### 2.2 Fulfillment Modality → Policy Content Variations

| Fulfillment Mode | Shipping Policy Impact | Return Policy Impact | Refund Policy Impact |
|---|---|---|---|
| **Pickup only** | N/A — no shipping section needed | Pickup location return process | Refund at pickup location |
| **Delivery only** | Local delivery zone, fees, timeframes | Return at delivery or designated location | Refund to original payment |
| **Shipping only** | Carrier, rates, handling time, international | Return shipping responsibility, RMA process | Refund to original payment method |
| **Pickup + Shipping** | Both sections | Both return paths | Both refund paths |
| **Service fulfillment** | N/A | Cancellation/rescheduling policy | Sliding scale refund based on completion |

### 2.3 Product Type → Policy Content Variations

| Product Type | Return Policy Impact | Shipping Policy Impact | Refund Policy Impact |
|---|---|---|---|
| **Physical** | Condition requirements, return window, restocking fees | Standard shipping sections | Standard refund timeline |
| **Digital** | No physical return — download revocation | No shipping — delivery method (email, portal) | Access revocation, no physical return |
| **Hybrid** | Physical component return + digital access revocation | Shipping for physical component | Partial refund for digital portion |
| **Service** | Cancellation window, rescheduling policy | N/A | Sliding scale — full refund if cancelled >48h, 50% if <24h |

---

## 3. Compliance & Regulatory Landscape

### 3.1 Privacy Policy Requirements by Jurisdiction

| Jurisdiction | Framework | Key Requirements for Storefront Privacy Policy |
|---|---|---|
| **United States (California)** | CCPA / CPRA | Right to know, delete, opt-out of data sale; privacy policy must disclose categories of PII collected, purpose, and third-party sharing |
| **United States (other states)** | State-by-state | Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA — varying disclosure requirements; 14+ states with privacy laws as of 2026 |
| **European Union** | GDPR | Lawful basis for processing, data subject rights (access, rectification, erasure, portability), DPO contact, data retention periods, cross-border transfer mechanisms |
| **Brazil** | LGPD | Explicit consent, data subject rights, DPO designation, data processing purpose |
| **India** | DPDP Act 2023 | Consent for data processing, right to access/correct/erase, data fiduciary obligations |
| **Singapore** | PDPA | Consent, purpose limitation, data retention, breach notification |
| **Canada** | PIPEDA | Consent, purpose identification, data minimization, individual access |

### 3.2 E-Commerce Consumer Protection Regulations

| Regulation | Scope | Policy Impact |
|---|---|---|
| **FTC Mail Order Rule (US)** | Online/remote sales | Must ship within stated timeframe; if not, must notify customer and offer refund |
| **EU Consumer Rights Directive** | EU online sales | 14-day withdrawal right for distance sales; pre-contract information requirements |
| **EU Omnibus Directive** | EU all commerce | Pricing transparency — mandatory dual pricing during sales (was/now), unit pricing |
| **UK Consumer Rights Act 2015** | UK retail/online | Goods must be of satisfactory quality, fit for purpose, as described; 30-day return right for faulty goods |
| **Australian Consumer Law** | Australia | Consumer guarantees, no-exclusion clauses for faulty goods, refund/repair/replace rights |
| **Payment Card Industry (PCI-DSS)** | All card-accepting merchants | Privacy policy must disclose card data handling; merchants must not store CVV/full card numbers |

### 3.3 Social Commerce Platform Requirements

| Platform | Policy Requirement |
|---|---|
| **Instagram/Meta Commerce** | Merchant must have published return policy, shipping policy, and privacy policy meeting Meta Commerce Merchant Quality guidelines |
| **TikTok Shop** | Seller must comply with TikTok Shop Seller Policies; return/refund policy must align with TikTok Shop return windows |
| **Google Shopping** | Merchant must have accessible return and refund policy; Google Merchant Center policy compliance required |

### 3.4 Digital Goods & Service-Specific Regulations

| Regulation | Scope | Policy Impact |
|---|---|---|
| **EU Digital Content Directive** | EU digital goods | Must disclose compatibility, functionality, interoperability; 14-day withdrawal (with exceptions for digital content with consent) |
| **US UETA / ESIGN Act** | US digital contracts | Electronic contract validity; terms of service must include electronic consent acknowledgment |
| **State service contract laws** | US services | Cancellation rights vary by state and service type; auto-renewal disclosure required in many states |

---

## 4. Risk Assessment

### 4.1 Risk Matrix

| Risk | Likelihood | Impact | Severity | Mitigation |
|---|---|---|---|---|
| **Merchant uses generic template without customization** | High | Medium | **Medium** | Template includes clearly marked `[BRACKETED]` placeholders that must be filled; completeness score warns on unfilled placeholders |
| **Template becomes outdated after regulatory change** | Medium | High | **High** | Template versioning with regulatory-effective dates; admin notification when templates are updated; merchant dashboard shows "policy may need review" |
| **Merchant operates in multiple jurisdictions** | Medium | High | **High** | Jurisdiction selector in policy settings; templates auto-include required clauses per jurisdiction; multi-jurisdiction compliance checklist |
| **Template language creates unintended legal obligations** | Medium | High | **High** | Legal review of all template content; disclaimer that templates are starting points, not legal advice; "Consult your attorney" callout |
| **Policy doesn't match actual fulfillment settings** | High | Medium | **Medium** | Auto-detect fulfillment settings and pre-fill shipping policy sections; warn if shipping policy references shipping but `shipping_enabled` is false |
| **Social commerce platform rejects merchant for non-compliant policy** | Low | High | **Medium** | Platform-specific template variants meeting Meta/TikTok/Google policy requirements |
| **Privacy policy doesn't disclose all data collection practices** | Medium | High | **High** | Template includes data collection inventory checklist; auto-detect enabled features (analytics, bot, CRM) and include relevant disclosures |
| **Refund policy conflicts with payment gateway terms** | Low | Medium | **Low** | Template aligned with Stripe/Square/PayPal merchant agreement requirements |
| **Policy not displayed on storefront** | Low | Medium | **Low** | Storefront footer policy links; completeness check in dashboard; warning if policies are empty but storefront is published |

### 4.2 Platform Liability Considerations

- **Platform as intermediary**: VisibleShelf provides templates but is not the merchant's legal advisor. Terms of service must clarify that policy templates are convenience tools, not legal recommendations.
- **Audit trail**: Template application should be logged (which template, which version, when applied) for compliance audit purposes.
- **Merchant attestation**: When applying a template, merchant should acknowledge they reviewed and accepted the policy content.

---

## 5. Proposed Architecture

### 5.1 Template Data Model

```
policy_templates
├── id                  VARCHAR(255) PK
├── template_key        VARCHAR(100) UNIQUE  -- e.g. 'online_standard_return'
├── policy_type         VARCHAR(50)          -- return_policy | shipping_policy | etc.
├── storefront_type     VARCHAR(50)          -- online | retail | service | social | all
├── product_type        VARCHAR(50)          -- physical | digital | hybrid | service | all
├── fulfillment_mode    VARCHAR(50)          -- pickup | delivery | shipping | service | all
├── jurisdiction        VARCHAR(10)          -- US | EU | UK | AU | CA | GLOBAL
├── platform            VARCHAR(50)          -- meta | tiktok | google | generic
├── title               VARCHAR(200)
├── description         TEXT
├── content_markdown    TEXT                 -- Template body with [PLACEHOLDERS]
 ├──── placeholder_schema    JSONB          -- [{key, label, type, required, default, validation}]
├── compliance_tags     TEXT[]               -- ['CCPA', 'GDPR', 'FTC_MAIL_ORDER']
├── version             VARCHAR(20)          -- Semantic versioning
├── regulatory_effective_date  TIMESTAMPTZ   -- When regulations backing this template take effect
├── is_active           BOOLEAN DEFAULT true
├── sort_order          INT
├── created_at          TIMESTAMPTZ
├── updated_at          TIMESTAMPTZ
```

```
tenant_policy_template_usage
├── id                  VARCHAR(255) PK
├── tenant_id           VARCHAR(255) FK
├── template_id         VARCHAR(255) FK
├── policy_type         VARCHAR(50)
├── template_version    VARCHAR(20)
├── applied_at          TIMESTAMPTZ
├── customized          BOOLEAN              -- Whether merchant modified after applying
├── placeholder_values  JSONB                -- Filled placeholder values
```

### 5.2 Template Resolution Flow

```
1. Merchant opens Policy Settings page
2. Frontend fetches:
   a. Current policies (existing flow)
   b. Effective capabilities (storefront type, fulfillment, product types)
   c. Available templates filtered by:
      - storefront_type matches effective_type OR 'all'
      - product_type matches allowed_types OR 'all'
      - fulfillment_mode matches effective fulfillment OR 'all'
      - jurisdiction from tenant's country_code
      - platform from social commerce integrations
3. UI presents template catalog grouped by storefront_type as the primary axis:
   - Top-level tabs/sections: Online | Retail | Service | Social | Universal
   - The merchant's effective storefront type is pre-selected and highlighted
   - Within each storefront-type group, templates are sub-grouped by policy_type
   - Universal templates appear in a cross-cutting section available to all types
4. Merchant selects template → preview renders markdown
5. Merchant fills [PLACEHOLDERS] via form fields (from placeholder_schema)
6. System generates final markdown by substituting placeholders
7. Merchant can further edit the generated content
8. On save: policies stored as before, template usage logged
```

### 5.3 Backend Components

**New files**:
- `apps/api/src/services/PolicyTemplateService.ts` — singleton: `getTemplates()`, `getTemplate()`, `getTemplatesForTenant()`, `getTemplatesGroupedByStorefrontType()`, `applyTemplate()`, `logTemplateUsage()`, `getRecommendedTemplates()`
- `apps/api/src/routes/policy-templates.ts` — public template list, merchant template list + apply endpoint, admin CRUD
- `database/migrations/0XX_policy_templates.sql` — `policy_templates` + `tenant_policy_template_usage` tables with RLS, seeds

**Modified files**:
- `apps/api/src/services/StorefrontPolicyService.ts` — add `applyTemplate(tenantId, templateId, placeholderValues)` method
- `apps/api/src/routes/storefront-policies.ts` — add `GET /:tenantId/storefront-policies/templates` endpoint (tenant-filtered templates)
- `apps/api/src/index.ts` — mount policy-templates routes

### 5.4 Frontend Components

**New files**:
- `apps/web/src/services/PolicyTemplateService.ts` — singleton extending `TenantApiSingleton`: `getTemplates()`, `getRecommendedTemplates()`, `applyTemplate()`
- `apps/web/src/app/t/[tenantId]/settings/policies/TemplateGallery.tsx` — template catalog with storefront-type as primary grouping axis (Online | Retail | Service | Social | Universal tabs), sub-grouped by policy_type within each tab; merchant's effective storefront type pre-selected and highlighted with a badge; cards show compliance tags, fulfillment compatibility, and platform-specific icons
- `apps/web/src/app/t/[tenantId]/settings/policies/TemplatePreviewModal.tsx` — markdown preview + placeholder form
- `apps/web/src/app/t/[tenantId]/settings/policies/ComplianceChecklist.tsx` — per-jurisdiction compliance status indicators

**Modified files**:
- `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx` — add "Browse Templates" button per policy tab, template gallery integration, completeness score badge
- `apps/web/src/app/t/[tenantId]/settings/policies/page.tsx` — pass effective capabilities to client component

### 5.5 Catalog Grouping by Storefront Type

The template catalog uses **storefront type as its primary organizational axis** to maximize adoption ease. Merchants see templates relevant to their business model first, without needing to understand the underlying capability taxonomy.

**Grouping hierarchy**:
```
Template Catalog
├── Online Storefront (pre-selected if effective_type='online')
│   ├── Return Policy templates
│   ├── Shipping Policy templates
│   ├── Privacy Policy templates
│   ├── Terms of Service templates
│   └── Refund Policy templates
├── Retail Storefront (pre-selected if effective_type='retail')
│   ├── Return Policy templates
│   ├── Shipping Policy templates
│   └── ...
├── Service Storefront (pre-selected if effective_type='service')
│   ├── Cancellation/Return templates
│   └── ...
├── Social Storefront (pre-selected if effective_type='social')
│   ├── Platform-specific (Meta, TikTok) templates
│   └── ...
└── Universal (always visible)
    ├── Minimal privacy policy
    ├── Minimal terms of service
    └── ...
```

**UX behavior**:
- The merchant's effective storefront type tab is auto-selected on page load with a "Recommended for your storefront" badge
- A template count badge appears on each storefront-type tab (e.g., "Online (12)")
- Templates with `storefront_type='all'` appear in the Universal section AND cross-reference in each type section with a "Universal" tag
- If the merchant has a `flexible` storefront type, all type-specific tabs are shown with equal priority, and the "Recommended" badge appears on the type that best matches their product types and fulfillment settings
- The `storefront_type` field on `policy_templates` is the single source of truth for grouping — no client-side filtering logic needed beyond reading this field

**API support**:
- `GET /api/tenants/:tenantId/storefront-policies/templates` returns templates pre-filtered by the tenant's effective storefront type, with a `group` field indicating the storefront-type group
- `GET /api/public/policy-templates?storefront_type=online` returns all templates for a given storefront type (for admin/catalog browsing)
- `GET /api/tenants/:tenantId/storefront-policies/templates?group_by=storefront_type` returns templates grouped by storefront type in a structured response:
  ```json
  {
    "groups": [
      {"storefront_type": "online", "label": "Online Storefront", "recommended": true, "count": 12, "templates": [...]},
      {"storefront_type": "retail", "label": "Retail Storefront", "recommended": false, "count": 8, "templates": [...]},
      ...
    ]
  }
  ```

### 5.6 Capability Integration

The template system integrates with the existing capability architecture without new feature keys:

| Existing Capability | Template Use |
|---|---|
| `EffectiveStorefront.effective_type` | Filter templates by storefront type |
| `EffectiveStorefront.policies_enabled` | Gate template access (same as policy access) |
| `EffectiveFulfillment.shows_*` | Filter shipping policy templates by fulfillment mode |
| `EffectiveProductType.effective_types` | Filter templates by product types |
| `EffectiveSocialCommerceOptions` | Filter templates by social platform (Meta/TikTok) |
| `EffectiveIntegrations` | Include Google Merchant Center compliance templates |

No new capability type, feature keys, or constraints needed — templates are a convenience layer on top of existing policy infrastructure.

### 5.7 Bot Knowledge Integration

Following the established pattern from `BotKnowledgeEmbeddingService`:
- Template content gets embedded with `source_type='policy_template'`
- Bot can answer "what policy template should I use?" questions
- Template application triggers embedding refresh for the tenant's actual policies (already wired)

---

## 6. Template Content Design

### 6.1 Placeholder Convention

All templates use `[BRACKETED_UPPERCASE]` placeholders with a corresponding `placeholder_schema` entry:

```json
[
  {"key": "STORE_NAME", "label": "Store Name", "type": "text", "required": true, "default": null},
  {"key": "RETURN_WINDOW_DAYS", "label": "Return Window (days)", "type": "number", "required": true, "default": 30},
  {"key": "RETURN_SHIPPING_RESPONSIBILITY", "label": "Who pays return shipping?", "type": "select", "options": ["customer", "store"], "required": true, "default": "customer"},
  {"key": "REFUND_PROCESSING_DAYS", "label": "Refund Processing (days)", "type": "number", "required": true, "default": 7}
]
```

### 6.2 Template Inventory by Storefront Type

#### Online Storefront (12 templates)

| Template Key | Policy Type | Variants |
|---|---|---|
| `online_standard_return` | return_policy | Physical-only, Digital-only, Hybrid |
| `online_shipping_domestic` | shipping_policy | Flat-rate, Free-over-threshold, Calculated |
| `online_shipping_international` | shipping_policy | With customs, Without customs |
| `online_privacy_ccpa` | privacy_policy | US-CA, US-federal-only |
| `online_privacy_gdpr` | privacy_policy | EU full, UK post-Brexit |
| `online_terms_standard` | terms_of_service | Generic, With subscriptions |
| `online_refund_standard` | refund_policy | Full-refund, Partial-refund, Store-credit |
| `online_digital_refund` | refund_policy | Digital goods specific |
| `online_privacy_meta_commerce` | privacy_policy | Meta Commerce compliant |
| `online_terms_tiktok_shop` | terms_of_service | TikTok Shop compliant |
| `online_return_google_shopping` | return_policy | Google Merchant Center compliant |
| `online_privacy_comprehensive` | privacy_policy | Multi-jurisdiction (CCPA + GDPR + LGPD) |

#### Retail Storefront (8 templates)

| Template Key | Policy Type | Variants |
|---|---|---|
| `retail_return_instore` | return_policy | With receipt, Without receipt, Store-credit-only |
| `retail_privacy_standard` | privacy_policy | US-only, Multi-jurisdiction |
| `retail_terms_standard` | terms_of_service | In-store, With online presence |
| `retail_refund_instore` | refund_policy | Cash, Card, Store-credit |
| `retail_shipping_optional` | shipping_policy | Ship-to-store, Local delivery |
| `retail_privacy_pos` | privacy_policy | With POS data collection |
| `retail_return_holiday` | return_policy | Extended holiday return window |
| `retail_terms_loyalty` | terms_of_service | With loyalty program terms |

#### Service Storefront (8 templates)

| Template Key | Policy Type | Variants |
|---|---|---|
| `service_cancellation_policy` | return_policy | 48h-full, 24h-50%, No-refund |
| `service_privacy_standard` | privacy_policy | US-only, Multi-jurisdiction |
| `service_terms_standard` | terms_of_service | Generic, With deposits, With auto-renewal |
| `service_refund_sliding` | refund_policy | Sliding scale, Flat cancellation fee |
| `service_terms_appointment` | terms_of_service | Appointment-based, Subscription-based |
| `service_privacy_scheduling` | privacy_policy | With scheduling data collection |
| `service_cancellation_medical` | return_policy | Medical/spa services (HIPAA-aware) |
| `service_terms_consultation` | terms_of_service | Professional consultation services |

#### Social Storefront (6 templates)

| Template Key | Policy Type | Variants |
|---|---|---|
| `social_return_meta` | return_policy | Meta Commerce compliant |
| `social_return_tiktok` | return_policy | TikTok Shop compliant |
| `social_privacy_social` | privacy_policy | Social platform data sharing disclosures |
| `social_terms_social` | terms_of_service | Social commerce specific |
| `social_shipping_social` | shipping_policy | Social commerce fulfillment |
| `social_refund_social` | refund_policy | Social commerce refund process |

#### Universal Templates (4 templates)

| Template Key | Policy Type | Notes |
|---|---|---|
| `universal_privacy_minimal` | privacy_policy | Bare-minimum privacy disclosure for trial tier |
| `universal_terms_minimal` | terms_of_service | Bare-minimum terms for trial tier |
| `universal_return_minimal` | return_policy | Simple 7-day return |
| `universal_refund_minimal` | refund_policy | Simple refund-to-original-payment |

**Total: 38 base templates** (with variants expanding to ~60 rendered templates)

### 6.3 Compliance Tag System

Each template carries `compliance_tags` that drive the compliance checklist UI:

```
compliance_tags: ['CCPA', 'GDPR', 'FTC_MAIL_ORDER']
```

The compliance checklist cross-references:
- Tenant's `country_code` → applicable jurisdiction
- Enabled integrations (Meta, TikTok, Google) → platform compliance requirements
- Product types (digital → EU Digital Content Directive)
- Fulfillment modes (shipping → FTC Mail Order Rule)

---

## 7. Implementation Phases

### Phase 1: Template Infrastructure (5-7 days)

**Goal**: Database, backend service, basic admin CRUD

- [ ] Migration: `policy_templates` + `tenant_policy_template_usage` tables with RLS
- [ ] Prisma schema: both models introspected
- [ ] `PolicyTemplateService.ts` — singleton with CRUD, `getTemplatesForTenant()` (filters by storefront type, fulfillment, product types, jurisdiction)
- [ ] `policy-templates.ts` routes — public list, merchant list+apply, admin CRUD
- [ ] Route mounting in `index.ts`
- [ ] Admin template management page (basic CRUD table)
- [ ] Seed 10 universal + online templates

**Verification**: API returns filtered templates for a test tenant. Admin can create/edit/deactivate templates.

### Phase 2: Frontend Template Gallery (4-5 days)

**Goal**: Merchant-facing template selection and application

- [ ] `PolicyTemplateService.ts` (frontend singleton)
- [ ] `TemplateGallery.tsx` — card grid with filters, compliance badges, storefront-type icons
- [ ] `TemplatePreviewModal.tsx` — markdown preview, placeholder form, apply button
- [ ] Modify `StorefrontPoliciesClient.tsx` — add "Browse Templates" per policy tab, template application flow, "Applied from template" indicator
- [ ] Pass effective capabilities from `page.tsx` to client component
- [ ] Completeness score badge per policy (configured/empty/partially-configured)

**Verification**: Merchant can browse templates filtered by their storefront type, preview, fill placeholders, and apply. Applied template content appears in policy editor.

### Phase 3: Compliance & Jurisdiction Awareness (4-5 days)

**Goal**: Jurisdiction detection, compliance checklist, multi-jurisdiction templates

- [ ] Auto-detect tenant jurisdiction from `tenant_business_profiles_list.country_code`
- [ ] `ComplianceChecklist.tsx` — shows applicable regulations, required vs. recommended policies, compliance gaps
- [ ] Multi-jurisdiction privacy policy template (CCPA + GDPR combined)
- [ ] Platform-specific templates for Meta Commerce, TikTok Shop, Google Shopping
- [ ] Policy completeness scoring algorithm (checks for required sections per storefront type + jurisdiction)
- [ ] Dashboard widget: "Policy Compliance Status" with red/yellow/green indicator

**Verification**: Tenant in EU sees GDPR-compliant template recommendations. Tenant with Meta Commerce integration sees Meta-compliant templates. Compliance checklist shows gaps.

### Phase 4: Fulfillment & Product Type Awareness (3-4 days)

**Goal**: Templates auto-adapt to fulfillment settings and product types

- [ ] Shipping policy templates filtered by `EffectiveFulfillment` (pickup-only → no shipping template needed)
- [ ] Return policy templates filtered by `EffectiveProductType` (digital-only → digital return template)
- [ ] Auto-fill placeholder defaults from fulfillment settings (e.g., `SHIPPING_HANDLING_DAYS` from `tenant_fulfillment_settings.shipping_handling_days`)
- [ ] Cross-capability constraint warnings in template gallery (e.g., "Your shipping policy references shipping but shipping is not enabled")
- [ ] Service-specific templates for service storefront + service product type

**Verification**: Tenant with pickup-only fulfillment doesn't see shipping policy templates. Digital-only merchant sees digital-specific return/refund templates. Placeholder defaults pre-filled from fulfillment settings.

### Phase 5: Template Versioning & Notifications (3-4 days)

**Goal**: Template updates propagate to affected merchants

- [ ] Template version field with semantic versioning
- [ ] `regulatory_effective_date` field — templates can be pre-loaded before regulations take effect
- [ ] Admin notification: "3 templates have pending regulatory updates"
- [ ] Merchant notification: "A policy template you used has been updated due to regulatory changes — review recommended"
- [ ] `BillingNotificationService` integration: `policy_template_updated` notification type
- [ ] Template diff viewer in admin (compare versions)
- [ ] Merchant "Review recommended" banner in policy settings when template version is outdated

**Verification**: Admin updates a template version. Merchants who previously applied it see a review banner. Notification fires via billing notification service.

### Phase 6: Bot Knowledge & AI Assistance (2-3 days)

**Goal**: Bot can recommend and explain policy templates

- [ ] `BotKnowledgeEmbeddingService.refreshPolicyTemplateEmbeddings()` — embed template content with `source_type='policy_template'`
- [ ] `BotDynamicResponseService` — policy template RAG search, bot can answer "which return policy template should I use?"
- [ ] Template recommendation engine: `getRecommendedTemplates()` — scores templates by storefront type match, fulfillment alignment, jurisdiction compliance, platform requirements
- [ ] "AI-suggested template" badge in gallery for top recommendation per policy type
- [ ] Refresh trigger: when templates are created/updated by admin, fire-and-forget embedding refresh

**Verification**: Bot widget can answer template recommendation questions. Gallery shows "Recommended" badge on best-matching template.

---

## 8. Cross-Cutting Concerns

### 8.1 Legal Disclaimer

All templates must include a visible disclaimer in the admin UI and in the template preview:

> **Policy templates are provided as a convenience and do not constitute legal advice.** Templates are starting points based on common e-commerce practices and general regulatory awareness. Your specific business circumstances may require additional or different provisions. Consult with a qualified attorney to ensure compliance with applicable laws and regulations in your jurisdiction.

### 8.2 Audit Trail

- `tenant_policy_template_usage` table records: which template, which version, when applied, whether customized
- Policy changes already trigger `invalidateEffectiveCapabilities()` — template application follows same pattern
- Admin actions (template create/update/deactivate) should be logged via existing audit infrastructure

### 8.3 Internationalization

- Template `content_markdown` stored in primary language (English)
- Future: `policy_template_translations` table for multi-language templates
- Placeholder labels should be translation-ready (use existing i18n infrastructure if present)
- Jurisdiction-specific templates may need native-language legal terms (e.g., GDPR templates in German for German merchants)

### 8.4 Performance

- Template list cached with 5-minute TTL (same pattern as `TenantStorefrontPolicyService`)
- Template filtering by tenant capabilities done server-side (avoid sending full template catalog to client)
- Template content markdown is text — no performance concern for storage/retrieval
- Embedding refresh is fire-and-forget (existing pattern)

### 8.5 Security

- Template CRUD: admin-only (platform admin role)
- Template application: tenant admin (same `requireTenantAdmin` as policy updates)
- Public template list: no auth (templates are not secret — they're convenience content)
- RLS on `policy_templates`: admin can write, tenants can read, public can read
- RLS on `tenant_policy_template_usage`: tenant-scoped, only own tenant's usage records

---

## 9. Testing Strategy

### 9.1 Unit Tests

- `PolicyTemplateService.getTemplatesForTenant()` — verify filtering by storefront type, fulfillment, product types, jurisdiction
- `PolicyTemplateService.applyTemplate()` — verify placeholder substitution, content generation, usage logging
- Completeness scoring algorithm — verify scoring for various policy states

### 9.2 Integration Tests

- Apply template → verify policies updated in DB → verify `invalidateEffectiveCapabilities` called → verify bot embedding refresh triggered
- Admin CRUD → verify cache invalidation → verify template availability changes for merchants
- Template versioning → verify merchant notification fires on template update

### 9.3 E2E Test Path

1. Create test tenant with online storefront, shipping fulfillment, physical products, US jurisdiction
2. Navigate to policy settings → verify template gallery shows online + shipping + physical + US templates
3. Select return policy template → fill placeholders → apply → verify content in editor
4. Save → verify public storefront displays policy
5. Admin updates template version → verify merchant sees "review recommended" banner
6. Switch tenant to service storefront → verify different templates appear

---

## 10. Dependencies & Prerequisites

| Dependency | Status | Notes |
|---|---|---|
| `tenant_storefront_policies` table | ✅ Exists | No schema changes needed to policies table |
| `StorefrontPolicyService` | ✅ Exists | Extended with `applyTemplate()` method |
| `StorefrontTypeService` / `StorefrontTypeResolver` | ✅ Exists | Used for template filtering |
| `FulfillmentResolver` | ✅ Exists | Used for template filtering |
| `EffectiveCapabilityResolver` | ✅ Exists | Provides all capability state for filtering |
| `BotKnowledgeEmbeddingService` | ✅ Exists | Extended with template embedding refresh |
| `BillingNotificationService` | ✅ Exists | Extended with `policy_template_updated` type |
| `GOVERNANCE_COMPLIANCE_FRAMEWORK.md` | ✅ Exists | Reference for jurisdiction requirements |
| GDPR / CCPA services | ✅ Exists | Reference for compliance tag mapping |
| Legal review of template content | ❌ Required | Must be completed before Phase 3 seed data |
| `tenant_business_profiles_list.country_code` | ✅ Exists | Used for jurisdiction detection |

---

## 11. Estimated Timeline

| Phase | Duration | Dependencies |
|---|---|---|
| Phase 1: Template Infrastructure | 5-7 days | None |
| Phase 2: Frontend Template Gallery | 4-5 days | Phase 1 |
| Phase 3: Compliance & Jurisdiction | 4-5 days | Phase 2, Legal review |
| Phase 4: Fulfillment & Product Awareness | 3-4 days | Phase 2 |
| Phase 5: Template Versioning | 3-4 days | Phase 1, Phase 3 |
| Phase 6: Bot Knowledge & AI | 2-3 days | Phase 1, Phase 2 |
| **Total** | **21-28 days** | |

Phase 4 can run in parallel with Phase 3. Phase 5 can run in parallel with Phase 4. Phase 6 can run in parallel with Phase 5.

**Critical path**: Phase 1 → Phase 2 → Phase 3 = 13-17 days to compliance-aware templates.

---

## 12. Open Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Template content authoring | A: Legal team writes all content, B: Engineering writes with legal review, C: Third-party legal service integration | **B** — Engineering drafts, legal reviews before seeding |
| 2 | Template customization depth | A: Fill placeholders only, B: Placeholder fill + free-text edit, C: Section-by-section template builder | **B** — Placeholder fill then free-text edit (matches current textarea UX) |
| 3 | Multi-language templates | A: English only for v1, B: Top 5 languages, C: All supported languages | **A** — English only for v1, add translations in future phase |
| 4 | Template recommendation engine | A: Rule-based scoring, B: AI-powered (GPT), C: Hybrid | **A** — Rule-based for v1 (storefront type + fulfillment + jurisdiction match scoring) |
| 5 | Compliance checklist enforcement | A: Advisory only (warnings), B: Hard gates (can't publish without required policies), C: Tier-based (trial=advisory, paid=hard gate) | **A** — Advisory only for v1; hard gates risk blocking legitimate merchants |
| 6 | Template marketplace | A: Platform-only templates, B: Third-party template authors, C: Community templates | **A** — Platform-only for v1; marketplace is a future expansion |
| 7 | Policy rendering on storefront | A: Plain markdown, B: Styled markdown with merchant branding, C: PDF download option | **A** — Plain markdown for v1 (matches current rendering); styled rendering is a separate UX improvement |

---

## 13. File Inventory

### New Files (Phase 1-6)

| File | Phase | Description |
|---|---|---|
| `database/migrations/0XX_policy_templates.sql` | 1 | Tables + RLS + seed data |
| `apps/api/src/services/PolicyTemplateService.ts` | 1 | Backend singleton service |
| `apps/api/src/routes/policy-templates.ts` | 1 | Public/merchant/admin routes |
| `apps/web/src/services/PolicyTemplateService.ts` | 2 | Frontend singleton service |
| `apps/web/src/app/t/[tenantId]/settings/policies/TemplateGallery.tsx` | 2 | Template card grid |
| `apps/web/src/app/t/[tenantId]/settings/policies/TemplatePreviewModal.tsx` | 2 | Preview + placeholder form |
| `apps/web/src/app/t/[tenantId]/settings/policies/ComplianceChecklist.tsx` | 3 | Compliance status indicators |
| `apps/web/src/app/(platform)/settings/admin/policy-templates/page.tsx` | 1 | Admin template management |
| `apps/web/src/app/(platform)/settings/admin/policy-templates/PolicyTemplateAdminClient.tsx` | 1 | Admin CRUD client |

### Modified Files (Phase 1-6)

| File | Phase | Changes |
|---|---|---|
| `apps/api/prisma/schema.prisma` | 1 | Add `policy_templates` + `tenant_policy_template_usage` models |
| `apps/api/src/services/StorefrontPolicyService.ts` | 1 | Add `applyTemplate()` method |
| `apps/api/src/routes/storefront-policies.ts` | 1 | Add template list endpoint |
| `apps/api/src/index.ts` | 1 | Mount policy-templates routes |
| `apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx` | 2 | Template gallery integration, completeness badge |
| `apps/web/src/app/t/[tenantId]/settings/policies/page.tsx` | 2 | Pass effective capabilities |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | 6 | Add `refreshPolicyTemplateEmbeddings()` |
| `apps/api/src/services/BotDynamicResponseService.ts` | 6 | Add policy template RAG search |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | 5 | Add `policy_template_updated` notification type |
| `apps/web/src/components/settings/TenantSettings.tsx` | 2 | Add compliance status badge to policies card |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | 2 | No new link needed (existing policies link) |

---

## 14. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Template adoption rate | 60% of new merchants apply at least one template within 7 days of storefront creation | `tenant_policy_template_usage` records |
| Policy completeness | 80% of merchants with published storefronts have all required policies configured | Policy completeness scoring |
| Time to configure policies | < 5 minutes from template selection to save (vs. 30+ minutes from scratch) | Template application timestamp vs. policy save timestamp |
| Compliance gap reduction | 50% reduction in "missing required policy" warnings after template system launch | Compliance checklist before/after comparison |
| Template customization rate | 70% of applied templates are customized (indicates merchants are reviewing content) | `tenant_policy_template_usage.customized` flag |
| Bot template assistance | 20% of template applications originate from bot recommendation | Bot analytics tracking |
