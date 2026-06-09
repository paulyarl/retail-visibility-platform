# FAQ Capability Specification

## Capability Type: `faq_options`

---

## Feature Keys (shared across all layers)

### Global structural

- `faq_enabled` — Global gate. FAQ module is available.
- `faq_disabled` — Global override off.
- `faq_flexible` — All types in all groups.

### Scope structural

- `faq_storefront_enabled` / `faq_storefront_disabled` — Storefront-scoped FAQs
- `faq_product_enabled` / `faq_product_disabled` — Product-scoped FAQs

### Management group structural

- `faq_management_enabled` / `faq_management_disabled`

### Management group types

- `faq_management_hub` — Full FAQ Hub with all tabs (Storefront, Product, Templates, Import, Bot Preview, Gap Report)
- `faq_management_templates` — Template-driven authoring from category templates
- `faq_management_import` — CSV upload, column mapping, preview, import
- `faq_management_wizard_inline` — Inline FAQ step in product and storefront wizards
- `faq_management_bulk_actions` — Bulk activate, deactivate, delete, change category
- `faq_management_reorder` — Drag-and-drop display order control
- `faq_management_search` — Real-time debounced search across question, answer, tags

### Preview group structural

- `faq_preview_enabled` / `faq_preview_disabled`

### Preview group types

- `faq_preview_bot` — Bot Preview tab (test questions, see matched FAQ + confidence)
- `faq_preview_gap_report` — Gap Report tab (unanswered queries, ranked by frequency)
- `faq_preview_auto_suggest` — AI-generated suggested answers from gap report (requires AI capability)

### Display group structural

- `faq_display_enabled` / `faq_display_disabled`

### Display group types

- `faq_display_storefront_accordion` — Customer-facing accordion on storefront page
- `faq_display_product_accordion` — Customer-facing accordion on product detail page
- `faq_display_search_overlay` — Real-time search overlay on FAQ sections
- `faq_display_feedback` — 👍 / 👎 thumbs + "Suggest Edit" on each answer
- `faq_display_bot_handoff` — "Ask our bot" CTA in FAQ sections
- `faq_display_markdown` — Markdown support in answers (bold, links, lists)
- `faq_display_deep_link` — URL hash deep-linking to specific FAQ entries (`#faq-shipping-delivery`)

### Knowledge base structural (chatbot integration)

- `faq_kb_enabled` / `faq_kb_disabled`

### Knowledge base types

- `faq_kb_static_lookup` — Static FAQ exact-match / keyword lookup (Free tier bot responses)
- `faq_kb_rag_retrieval` — Semantic RAG retrieval with embeddings (Starter+ bot responses)
- `faq_kb_product_scoped` — Product-scoped FAQ retrieval in bot context
- `faq_kb_auto_sync` — Auto-rebuild embedding index on FAQ save (Starter+)
- `faq_kb_coverage_metrics` — Coverage score, category coverage, product coverage, freshness

---

## Cross-group dependencies

- `faq_preview_bot` requires `faq_display_storefront_accordion` or `faq_display_product_accordion` (bot preview tests against live FAQ data).
- `faq_preview_gap_report` requires `faq_display_bot_handoff` (gap data comes from bot widget queries).
- `faq_kb_rag_retrieval` requires `faq_kb_auto_sync` (embeddings must be kept in sync).
- `faq_preview_auto_suggest` requires `quickstart_wizard_ai` or `chatbot_dynamic_enabled` (AI-generated suggestions need an AI model).
- `faq_management_import` requires `faq_management_hub` (import is a tab within the hub).
- `faq_display_search_overlay` requires `faq_display_storefront_accordion` or `faq_display_product_accordion`.

---

## Tier Assignment

| Tier | Management | Preview | Display | Knowledge Base |
|---|---|---|---|---|
| Free | `faq_management_hub`, `faq_management_templates`, `faq_management_wizard_inline`, `faq_management_search` | `faq_preview_bot` (static match only), `faq_preview_gap_report` | All display types | `faq_kb_static_lookup`, `faq_kb_coverage_metrics` (static-only metrics) |
| Starter | All Free + `faq_management_import`, `faq_management_bulk_actions`, `faq_management_reorder` | All Free + `faq_preview_bot` (RAG match) | All display types | All Free + `faq_kb_rag_retrieval`, `faq_kb_product_scoped`, `faq_kb_auto_sync`, `faq_kb_coverage_metrics` (full metrics) |
| Pro | All Starter types | All Starter + `faq_preview_auto_suggest` | All display types | All Starter |
| Enterprise | All Pro types | All Pro types | All display types | All Pro types |
| Organization | `faq_flexible` | `faq_flexible` | `faq_flexible` | `faq_flexible` |

---

## Resolution Logic

3-state per group (same as `featured_options`, `quickstart_options`, `chatbot_options`):

- **enabled** → all types in group are available
- **untouched** → only explicitly listed types are available
- **disabled** → none

### Resolution order

1. Global structural gate (`faq_enabled` / `faq_disabled`)
2. Group structural gate (management, preview, display, knowledge base)
3. Specific type key check (flexible OR explicit type key in `allowed_type_keys`)
4. Cross-group dependency validation
5. Tenant subscription status validation (Active, Trial, Suspended, Past-due)

### Frontend Gates

| UI Element | Gate |
|---|---|
| FAQ Hub page | `faq_enabled` |
| Templates tab | `faq_management_templates` in resolved types |
| Import tab | `faq_management_import` in resolved types |
| Bot Preview tab | `faq_preview_bot` in resolved types |
| Gap Report tab | `faq_preview_gap_report` in resolved types |
| Auto-suggest button | `faq_preview_auto_suggest` in resolved types |
| Bulk actions toolbar | `faq_management_bulk_actions` in resolved types |
| Reorder drag handles | `faq_management_reorder` in resolved types |
| Storefront accordion | `faq_display_storefront_accordion` in resolved types |
| Product accordion | `faq_display_product_accordion` in resolved types |
| FAQ search overlay | `faq_display_search_overlay` in resolved types |
| Feedback thumbs | `faq_display_feedback` in resolved types |
| Bot handoff CTA | `faq_display_bot_handoff` in resolved types |
| Static lookup (bot) | `faq_kb_static_lookup` in resolved types |
| RAG retrieval (bot) | `faq_kb_rag_retrieval` in resolved types |
| Auto-sync (embeddings) | `faq_kb_auto_sync` in resolved types |
| Coverage metrics dashboard | `faq_kb_coverage_metrics` in resolved types |

---

## Merchant Options Page

### Route

`/t/[tenantId]/settings/faq-options`

### Page Structure

```
FAQ Options
├── Management
│   ├── FAQ Hub (all tiers)
│   ├── Templates (all tiers)
│   ├── Import (Starter+)
│   ├── Wizard Inline Step (all tiers)
│   ├── Bulk Actions (Starter+)
│   └── Reorder (Starter+)
├── Preview & Analysis
│   ├── Bot Preview (all tiers)
│   ├── Gap Report (all tiers)
│   └── Auto-Suggest Answers (Pro+)
├── Customer Display
│   ├── Storefront Accordion (all tiers)
│   ├── Product Accordion (all tiers)
│   ├── Search Overlay (all tiers)
│   ├── Feedback Thumbs (all tiers)
│   ├── Bot Handoff CTA (all tiers)
│   ├── Markdown Support (all tiers)
│   └── Deep Links (all tiers)
└── Knowledge Base
    ├── Static Lookup (all tiers)
    ├── RAG Retrieval (Starter+)
    ├── Product-Scoped Retrieval (Starter+)
    ├── Auto-Sync Embeddings (Starter+)
    └── Coverage Metrics (all tiers)
```

### Capability-gated UI

- **Free tier**: Management hub, templates, wizard inline, bot preview (static match), gap report, all display types, static lookup, coverage metrics (static-only).
- **Starter tier**: All Free + import, bulk actions, reorder, RAG retrieval, product-scoped retrieval, auto-sync, full coverage metrics.
- **Pro tier**: All Starter + auto-suggest answers.
- **Enterprise tier**: All options unlocked.

---

## Dashboard Control Panel (Platform Admin)

### Route

`/settings/admin/faq-control`

### Purpose

A platform admin dashboard for managing FAQ capabilities globally — controlling which FAQ features are available per tier, monitoring FAQ adoption across tenants, and managing the template library.

### ASCII Wireframe

```
+----------------------------------------------------------------------------------+
|  FAQ Control Panel                                                               |
+----------------------------------------------------------------------------------+
|  Overview | Tier Config | Templates | Tenant Adoption | Coverage Report         |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +---------------------+  +---------------------+  +---------------------+      |
|  |  Active Tenants     |  |  Total FAQs         |  |  Avg Coverage       |      |
|  |  412                |  |  8,247              |  |  71%                |      |
|  +---------------------+  +---------------------+  +---------------------+      |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Tier Configuration                                                          |  |
|  |                                                                              |  |
|  |  Free    [●] Storefront Accordion  [●] Product Accordion  [●] Static Lookup |  |
|  |          [●] Bot Preview (static)  [●] Gap Report        [  ] Import       |  |
|  |          [  ] RAG Retrieval        [  ] Auto-Sync        [  ] Auto-Suggest   |  |
|  |                                                                              |  |
|  |  Starter [●] Storefront Accordion  [●] Product Accordion  [●] Static Lookup |  |
|  |          [●] Bot Preview (RAG)     [●] Gap Report        [●] Import          |  |
|  |          [●] RAG Retrieval         [●] Auto-Sync         [  ] Auto-Suggest   |  |
|  |                                                                              |  |
|  |  Pro     [●] All Starter features  [●] Auto-Suggest                         |  |
|  |                                                                              |  |
|  |  [Save Tier Configuration]  [Reset to Defaults]                               |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Global Template Library                                                     |  |
|  |                                                                              |  |
|  |  [+ New Template Category]                                                   |  |
|  |  | Category          | Q&A Pairs | Tenants Using | Status     | Actions    |  |
|  |  |-------------------|-----------|---------------|------------|------------|  |
|  |  | Grocery Essentials| 12        | 89            | Active     | [Edit] [D] |  |
|  |  | Restaurant Basics | 8         | 34            | Active     | [Edit] [D] |  |
|  |  | Retail Standard   | 15        | 156           | Active     | [Edit] [D] |  |
|  |  | Pharmacy FAQ        | 10        | 23            | Draft      | [Edit] [D] |  |
|  |  |-------------------|-----------|---------------|------------|------------|  |
|  |                                                                              |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

### Panel Sections

- **Stats row**: Active Tenants (with at least 1 FAQ), Total FAQs across all tenants, Average Coverage Score.
- **Tier Configuration**: Toggle matrix of FAQ features per tier. Admins can enable/disable individual features per tier. Changes propagate to `tier_features_list` and invalidate capability caches.
- **Template Library**: CRUD for global FAQ template categories. Each template has a name, a set of Q&A pairs, and a status (Active/Draft). Tenants can browse and apply templates from their FAQ Hub.
- **Tenant Adoption tab**: Table of tenants sorted by FAQ count or coverage score. Drill-down to tenant FAQ detail.
- **Coverage Report tab**: Global view of coverage metrics across all tenants. Shows distribution of coverage scores, top unanswered intents, and tenants needing attention.

### Interactions

- **Tier config save**: Validates cross-group dependencies (e.g., cannot enable RAG without Auto-Sync). Saves to `tier_features_list`. Triggers cache invalidation for all tenants.
- **Template CRUD**: Create/edit template categories with inline Q&A pair management. Templates are global — all tenants can see and apply them.
- **Tenant adoption drill-down**: Click tenant row → view their FAQ list, coverage score, and gap report.
- **Coverage report export**: Export global coverage data as CSV.

---

## Backend Integration

### Service

`FaqOptionsService.ts` — resolves `FaqOptionsState` from `tier_features_list` and `subscription_tiers_list`, same pattern as `FeaturedOptionsService`, `QuickstartOptionsService`, and `ChatbotOptionsService`.

### API Routes

- `GET /api/tenants/:tenantId/faq-options` — Returns resolved capability state for the tenant
- `GET /api/admin/faq-control` — Platform admin view of global FAQ config, templates, adoption stats
- `PUT /api/admin/faq-control/tiers` — Update tier configuration
- `GET /api/admin/faq-control/templates` — List global templates
- `POST /api/admin/faq-control/templates` — Create global template
- `PUT /api/admin/faq-control/templates/:templateId` — Update global template
- `DELETE /api/admin/faq-control/templates/:templateId` — Delete global template
- `GET /api/admin/faq-control/adoption` — Tenant adoption stats
- `GET /api/admin/faq-control/coverage` — Global coverage report

---

## Files to Create / Modify

### New Files

- `docs/FAQ_CAPABILITY_SPEC.md` — This document
- `apps/api/src/services/FaqOptionsService.ts` — Backend resolution service
- `apps/web/src/utils/faqOptions.ts` — Frontend utility with type classification and display helpers
- `apps/web/src/services/FaqCapabilityResolutionService.ts` — Frontend resolution state
- `apps/web/src/hooks/tenant-access/useFaqCapability.ts` — React hook for capability gates
- `apps/web/src/app/t/[tenantId]/settings/faq-options/page.tsx` — Merchant options page
- `apps/web/src/app/settings/admin/faq-control/page.tsx` — Platform admin dashboard control panel

### Modified Files

- `apps/api/src/routes/tenant-capabilities.ts` — Add `faq_` prefix to `CAPABILITY_TYPE_PREFIXES`
- `apps/web/src/services/CapabilityResolutionService.ts` — Add `FaqOptionsState`, `resolveFaqOptionsState`, `getFaqOptionsState`
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — Add `useFaqOptionsCapability` hook

---

## Alignment with Existing Capabilities

This specification follows the exact same pattern as:

- `featured_options` — `docs/FEATURED_CAPABILITY_SPEC.md`
- `quickstart_options` — `apps/api/src/services/QuickstartOptionsService.ts`
- `chatbot_options` — `docs/CHATBOT_CAPABILITY_SPEC.md`

All resolution logic, CTE patterns, tier-features-list joins, and frontend gate patterns are identical. The only difference is the feature key namespace (`faq_`).
