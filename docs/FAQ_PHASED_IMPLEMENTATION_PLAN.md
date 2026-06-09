# FAQ — Phased Implementation Plan

This document breaks the full FAQ build into 4 deliverable phases. Each phase produces a working, testable increment. No phase is "design only" — every phase ships code.

---

## Phase 1: Foundation — Schema, Services, Capability, Merchant Hub

**Goal**: Database schema, base services, FAQ capability resolution, and the merchant FAQ Hub (Storefront + Product tabs with CRUD) are live. Merchants can create, edit, and manage FAQs.

**Duration**: 1–1.5 weeks

### 1.1 Database Schema (Prisma)

```prisma
model faq_categories {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id     String   @db.VarChar(255)
  name          String   @db.VarChar(100)
  display_order Int      @default(0)
  is_global     Boolean  @default(false)  // true = platform template
  template_id   String?  @db.Uuid         // link to global template
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  updated_at    DateTime @default(now()) @db.Timestamptz(6)

  faqs          faqs[]
  tenants       tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id])
  @@index([display_order])
}

model faqs {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  category_id     String   @db.Uuid
  question        String   @db.VarChar(500)
  answer          String   @db.Text
  scope           String   @default("storefront") @db.VarChar(20)  // storefront, product
  status          String   @default("draft") @db.VarChar(20)       // draft, active, archived
  tags            String[] @db.VarChar(50)
  display_order   Int      @default(0)
  view_count      Int      @default(0)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  tenant          tenants          @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  category        faq_categories   @relation(fields: [category_id], references: [id], onDelete: Cascade)
  product_links   faq_product_links[]

  @@index([tenant_id, scope, status])
  @@index([tenant_id, category_id])
  @@index([status])
  @@index([display_order])
}

model faq_product_links {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  faq_id     String   @db.Uuid
  product_id String   @db.VarChar(255)
  inherit_storefront Boolean @default(false)
  created_at DateTime @default(now()) @db.Timestamptz(6)

  faq        faqs     @relation(fields: [faq_id], references: [id], onDelete: Cascade)

  @@unique([faq_id, product_id])
  @@index([product_id])
}

model faq_templates {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String   @db.VarChar(100)
  description String?  @db.Text
  category    String   @db.VarChar(50)
  status      String   @default("active") @db.VarChar(20)  // active, draft
  pairs       Json     @default("[]")  // [{question, answer, tags}]
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @default(now()) @db.Timestamptz(6)

  @@index([status])
  @@index([category])
}
```

**Tasks:**
- [ ] Write Prisma migration for `faq_categories`, `faqs`, `faq_product_links`, `faq_templates`
- [ ] Run migration against staging DB
- [ ] Verify indexes (tenant_id + scope + status, category_id, display_order)
- [ ] Seed 3 global templates (Grocery Essentials, Restaurant Basics, Retail Standard)

### 1.2 FAQ Capability

Add `faq_options` capability type following the same pattern as `featured_options`, `quickstart_options`, and `chatbot_options`.

**Tasks:**
- [ ] Create `docs/FAQ_CAPABILITY_SPEC.md` — feature keys, tier assignment, resolution logic
- [ ] Create `apps/api/src/services/FaqOptionsService.ts` — resolves `FaqOptionsState`
- [ ] Create `apps/web/src/services/FaqCapabilityResolutionService.ts` — frontend resolution
- [ ] Create `apps/web/src/hooks/tenant-access/useFaqCapability.ts` — React hook
- [ ] Update `apps/api/src/routes/tenant-capabilities.ts` — add `faq_` prefix
- [ ] Update `CapabilityResolutionService.ts` — add `FaqOptionsState`

### 1.3 Backend Services

| Service | Responsibility |
|---|---|
| `FaqService` | CRUD for FAQs and categories |
| `FaqTemplateService` | Browse and apply global templates |
| `FaqPublicService` | Read-only public FAQ display (storefront, product page) |

**Tasks:**
- [ ] Create `apps/api/src/services/FaqService.ts` — CRUD, search, reorder
- [ ] Create `apps/api/src/services/FaqTemplateService.ts` — list templates, apply to tenant
- [ ] Create `apps/api/src/services/FaqPublicService.ts` — public read-only endpoints
- [ ] Write unit tests for each service

### 1.4 Frontend Service Singleton

Create `FaqService.ts` extending `TenantApiSingleton`:

**Tasks:**
- [ ] Create `apps/web/src/services/FaqService.ts`
- [ ] Cache patterns: `faq-storefront-list`, `faq-product-list`, `faq-categories`, `faq-templates`
- [ ] `invalidateServiceCaches()` for mutations

### 1.5 Merchant FAQ Hub — Storefront & Product Tabs

**Route**: `/t/[tenantId]/settings/faq`

**Tasks:**
- [ ] Tab bar: Storefront (default) | Product | Templates | Import | Bot Preview | Gap Report
- [ ] **Storefront Tab**: Searchable table (question, category badge, status badge, actions). Category filter pills. "+ Add FAQ" dialog.
- [ ] **Product Tab**: Product selector dropdown → show FAQs for selected product. "+ Add FAQ" scoped to product.
- [ ] **FAQ Create/Edit Dialog**: Scope radio (Storefront/Product), category dropdown, question input, answer textarea (markdown toolbar), tags, status toggle. Inline bot preview on blur.
- [ ] **Templates Tab**: Grid of global templates. Click → see Q&A checklist → "Apply Selected" → creates draft FAQs.
- [ ] Loading skeletons, empty states, reorder drag handles

**Acceptance Criteria:**
- Merchant can create, edit, and delete FAQs
- Storefront and Product scopes work correctly
- Templates can be browsed and applied
- Categories can be created inline
- FAQ Hub respects capability gates (locked tabs hidden if not in tier)

---

## Phase 2: Public Display, Import, Bot Preview, and Gap Report

**Goal**: Customer-facing FAQ display on storefront and product pages. CSV import wizard. Bot preview sandbox. Gap report with unanswered queries.

**Duration**: 1.5–2 weeks

### 2.1 Public API Routes

- `GET /api/public/tenants/:tenantId/faqs?scope=storefront` — Storefront FAQs (public, no auth)
- `GET /api/public/tenants/:tenantId/faqs?scope=product&productId=` — Product FAQs (public)
- `GET /api/public/tenants/:tenantId/faq-categories` — Categories for display
- `POST /api/public/tenants/:tenantId/faqs/:faqId/feedback` — Thumbs up/down (anonymous)
- `POST /api/public/tenants/:tenantId/faqs/:faqId/suggest-edit` — Suggest edit (optional email)

### 2.2 Public FAQ Display — Storefront Page

**Tasks:**
- [ ] Accordion component grouped by category (`shadcn Accordion type="single"`)
- [ ] Category order respects `display_order`
- [ ] Deep-linkable via URL hash (`#faq-shipping-delivery`)
- [ ] "Ask our bot" CTA at bottom (always shown, tier-gated response type)
- [ ] Feedback micro-actions: 👍 / 👎 / "Suggest Edit" per answer
- [ ] Search overlay: debounced search across question + answer + tags
- [ ] Responsive: desktop 2-column if >6 categories, mobile single accordion
- [ ] Empty state: section hidden entirely if no active FAQs

### 2.3 Public FAQ Display — Product Page

**Tasks:**
- [ ] Two-tier accordion: "About This Product" (product-scoped) + "From [Merchant]" (relevant storefront)
- [ ] Selection logic: inherit flag → category match → top 3 most-viewed fallback
- [ ] "Ask about this product" CTA with `data-product-id` context
- [ ] Scope-aware search (product-scoped + inherited storefront)

### 2.4 Import Tab

**Tasks:**
- [ ] 4-step wizard: Upload → Map Columns → Preview → Import
- [ ] CSV template download
- [ ] Column mapping dropdowns with validation
- [ ] Preview first 5 rows
- [ ] Progress bar + summary toast ("24 imported, 2 duplicates skipped")
- [ ] Per-row error display with fix-and-re-import

### 2.5 Bot Preview Tab

**Tasks:**
- [ ] Two-pane layout: left = question input + history; right = matched result + customer-facing render
- [ ] Static match for Free tier (exact/keyword lookup)
- [ ] RAG match for Starter+ (semantic retrieval + confidence score)
- [ ] Color-coded confidence (green >90, yellow 70-90, red <70)
- [ ] "Other matches" expandable section
- [ ] Feedback buttons: "Correct" / "Flag for review"
- [ ] "No match" state with "Create FAQ" CTA

### 2.6 Gap Report Tab

**Tasks:**
- [ ] Time range selector (7d, 30d, 90d)
- [ ] Ranked table: query text, frequency, inferred intent, "Create" button
- [ ] Intent filter pills
- [ ] Coverage score header stat
- [ ] Export to CSV
- [ ] Auto-suggest button (Pro+, gated by AI capability)
- [ ] Empty state: "No unanswered queries yet"

**Acceptance Criteria:**
- Customer sees clean FAQ accordion on storefront and product pages
- Merchant can import FAQs via CSV
- Bot Preview shows matched FAQ with confidence
- Gap Report surfaces unanswered queries from bot interactions
- All public display respects capability gates

---

## Phase 3: Dashboard Control Panel, Coverage Metrics, and Bulk Actions

**Goal**: Platform admin has a global FAQ control dashboard. Coverage metrics are computed and visible. Bulk actions and reordering are functional.

**Duration**: 1–1.5 weeks

### 3.1 FAQ Dashboard Control Panel (Platform Admin)

**Route**: `/settings/admin/faq-control`

**Backend:**
- [ ] `GET /api/admin/faq-control` — global config, stats, templates
- [ ] `PUT /api/admin/faq-control/tiers` — update tier configuration
- [ ] `GET /api/admin/faq-control/templates` — list global templates
- [ ] `POST /api/admin/faq-control/templates` — create template
- [ ] `PUT /api/admin/faq-control/templates/:id` — update template
- [ ] `DELETE /api/admin/faq-control/templates/:id` — delete template
- [ ] `GET /api/admin/faq-control/adoption` — tenant adoption stats
- [ ] `GET /api/admin/faq-control/coverage` — global coverage report

**Frontend:**
- [ ] **Stats row**: Active Tenants, Total FAQs, Average Coverage Score
- [ ] **Tier Config tab**: Toggle matrix of FAQ features per tier. Validates dependencies. Saves to `tier_features_list`.
- [ ] **Templates tab**: CRUD for global template categories. Inline Q&A pair management.
- [ ] **Tenant Adoption tab**: Table of tenants (FAQ count, coverage score, last activity). Drill-down to tenant detail.
- [ ] **Coverage Report tab**: Global coverage distribution, top unanswered intents, tenants needing attention. Export CSV.

### 3.2 Coverage Metrics Service

**Tasks:**
- [ ] `FaqCoverageService.ts` — computes coverage per tenant
- [ ] Overall coverage: % of bot conversations answered from FAQ
- [ ] Category coverage: % of intents per category with matching FAQ
- [ ] Product coverage: % of products with at least one product-scoped FAQ
- [ ] Freshness: time since last embedding index rebuild
- [ ] Low-usage flag: FAQ not matched in 90 days → "review or archive" warning

### 3.3 Bulk Actions

**Tasks:**
- [ ] Checkbox multi-select on Storefront and Product tabs
- [ ] Bulk toolbar: Activate, Deactivate, Delete, Change Category
- [ ] Confirmation modal for destructive actions
- [ ] Shift-click range selection (v2)

### 3.4 Reorder

**Tasks:**
- [ ] Drag-and-drop handle on FAQ rows
- [ ] Updates `display_order` on drop
- [ ] Affects customer-facing accordion order

### 3.5 Wizard Inline Steps

**Tasks:**
- [ ] Product wizard step 4: compact FAQ table (max 5 rows) + "+ Add More" link
- [ ] Storefront wizard step N: same pattern for storefront-scoped FAQs
- [ ] Dialog pre-scoped to correct scope + pre-selected product

**Acceptance Criteria:**
- Platform admin can configure FAQ features per tier
- Global template library is manageable
- Tenant adoption and coverage are visible globally
- Bulk actions work across multiple FAQs
- FAQ order in hub controls storefront display order

---

## Phase 4: Chatbot Knowledge Base, Auto-Sync, and Feedback Loop

**Goal**: FAQ feeds the chatbot RAG pipeline. Embeddings auto-sync. Feedback from public display feeds gap report. Full closed loop.

**Duration**: 1.5–2 weeks

### 4.1 FAQ as Chatbot Knowledge Base

**Tasks:**
- [ ] `FaqEmbeddingService.ts` — chunks FAQ entries, generates embeddings (OpenAI text-embedding-3-small)
- [ ] Per-tenant vector index (pgvector or Pinecone)
- [ ] `FaqRagService.ts` — top-k retrieval with re-ranking by confidence
- [ ] Auto-rebuild on FAQ mutation webhooks (Starter+)
- [ ] Free tier: exact-match / keyword lookup (no embeddings)

### 4.2 Bot Integration

**Tasks:**
- [ ] Bot widget queries FAQ index before falling back to generic response
- [ ] Product-scoped retrieval: prioritize product FAQs on product pages
- [ ] Bot → FAQ handoff: "Read full answer" button scrolls to matching accordion
- [ ] Gap loop: unanswered bot queries logged to `faq_bot_interactions` → Gap Report

### 4.3 Auto-Sync

**Tasks:**
- [ ] Webhook trigger on FAQ create/update/delete
- [ ] Async embedding rebuild job (Celery/RQ)
- [ ] Progress indicator in Bot Knowledge Base (`/t/[tenantId]/bot/knowledge`)
- [ ] Free tier: no auto-sync needed (static lookup)

### 4.4 Feedback Loop

**Tasks:**
- [ ] 👍 / 👎 on public FAQ → soft signal in Gap Report
- [ ] "Suggest Edit" → creates a task for merchant (or CRM ticket for platform admin)
- [ ] Low-confidence bot matches flagged in Gap Report
- [ ] 90-day orphan FAQ detection → warning banner

### 4.5 Bot Knowledge Base Page

**Route**: `/t/[tenantId]/bot/knowledge`

**Tasks:**
- [ ] FAQ coverage score with target indicator
- [ ] Freshness badge ("Synced 2 min ago" / "Stale — rebuild needed")
- [ ] Retrieval latency chart
- [ ] Category coverage breakdown
- [ ] Product coverage list
- [ ] Quick links to FAQ Hub tabs
- [ ] Free tier: shows static FAQ metrics (entry count, match rate), no embedding sync

### 4.6 Final Polish

**Tasks:**
- [ ] Keyboard shortcuts (`/` search in hub, `n` new FAQ)
- [ ] Mobile responsiveness for public FAQ display
- [ ] Performance audit: N+1 queries, cache hit rates
- [ ] E2E tests: create FAQ → verify public display → bot query → verify gap report

**Acceptance Criteria:**
- Bot widget retrieves answers from FAQ index
- Embeddings auto-rebuild on FAQ changes
- Gap report captures bot no-matches and low-confidence matches
- Public feedback feeds into merchant dashboard
- Bot Knowledge Base page shows real coverage metrics
- E2E tests pass in CI

---

## Cross-Phase Dependencies

| Dependency | Source Phase | Consumer Phase |
|---|---|---|
| Prisma schema (all tables) | Phase 1 | All subsequent phases |
| `FaqService` CRUD | Phase 1 | Phase 2 (public display), Phase 3 (bulk actions), Phase 4 (bot integration) |
| Public API routes | Phase 2 | Phase 4 (bot widget calls public FAQ endpoints) |
| Coverage metrics service | Phase 3 | Phase 4 (bot knowledge base page) |
| Embedding / RAG service | Phase 4 | None (terminal) |
| Capability resolution | Phase 1 | All phases (gates UI features) |

---

## Testing Strategy

| Phase | Test Coverage |
|---|---|
| Phase 1 | Unit tests for `FaqService`, `FaqTemplateService`; FAQ Hub renders and CRUD works |
| Phase 2 | E2E for public FAQ display, import wizard, bot preview, gap report |
| Phase 3 | E2E for dashboard control panel, bulk actions, reorder, coverage metrics |
| Phase 4 | E2E for bot → FAQ retrieval → gap report → create FAQ → verify bot answer |

---

## Rollback Plan

Each phase is additive. If a phase needs rollback:

- **Phase 4**: Disable embedding sync, revert bot to generic responses. FAQ core remains.
- **Phase 3**: Hide FAQ Control Panel from admin sidebar. Bulk actions and reorder disabled. Core hub remains.
- **Phase 2**: Hide public FAQ display sections from storefront/product pages. Import, Bot Preview, and Gap Report tabs hidden. Core CRUD remains.
- **Phase 1**: Revert Prisma migration. FAQ module disappears.

---

## Files Created / Modified Summary

### New Files (by Phase)

**Phase 1:**
- `apps/api/prisma/migrations/..._faq_tables/migration.sql`
- `apps/api/src/services/FaqService.ts`
- `apps/api/src/services/FaqTemplateService.ts`
- `apps/api/src/services/FaqPublicService.ts`
- `apps/api/src/services/FaqOptionsService.ts`
- `apps/web/src/services/FaqService.ts`
- `apps/web/src/services/FaqCapabilityResolutionService.ts`
- `apps/web/src/hooks/tenant-access/useFaqCapability.ts`
- `apps/web/src/app/t/[tenantId]/settings/faq/page.tsx`
- `apps/web/src/app/t/[tenantId]/settings/faq-options/page.tsx`
- `apps/web/src/components/faq/FaqHub.tsx`
- `apps/web/src/components/faq/FaqCreateDialog.tsx`

**Phase 2:**
- `apps/api/src/routes/faq-public.ts` (public read-only routes)
- `apps/api/src/routes/faq.ts` (merchant CRUD routes)
- `apps/web/src/components/faq/FaqStorefrontDisplay.tsx`
- `apps/web/src/components/faq/FaqProductDisplay.tsx`
- `apps/web/src/components/faq/FaqImportWizard.tsx`
- `apps/web/src/components/faq/FaqBotPreview.tsx`
- `apps/web/src/components/faq/FaqGapReport.tsx`

**Phase 3:**
- `apps/api/src/services/FaqCoverageService.ts`
- `apps/api/src/routes/faq-control.ts` (admin routes)
- `apps/web/src/app/settings/admin/faq-control/page.tsx`
- `apps/web/src/components/faq/FaqControlPanel.tsx`
- `apps/web/src/components/faq/FaqTemplateLibrary.tsx`
- `apps/web/src/components/faq/FaqCoverageDashboard.tsx`

**Phase 4:**
- `apps/api/src/services/FaqEmbeddingService.ts`
- `apps/api/src/services/FaqRagService.ts`
- `apps/web/src/app/t/[tenantId]/bot/knowledge/page.tsx`
- `apps/web/src/components/faq/FaqBotKnowledgeBase.tsx`

### Modified Files (all phases)

- `apps/api/src/routes/tenant-capabilities.ts` — add `faq_` prefix
- `apps/web/src/services/CapabilityResolutionService.ts` — add `FaqOptionsState`
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — add `useFaqOptionsCapability`
- `apps/web/src/components/layout/DynamicTenantSidebar.tsx` — add "FAQ" nav item
- `apps/web/src/components/layout/AdminNavContent.tsx` — add "FAQ Control" nav item
- `apps/web/src/app/t/[tenantId]/quick-start/products/page.tsx` — add FAQ wizard step
- `apps/web/src/app/t/[tenantId]/page.tsx` — embed FAQ display or link

---

## Success Criteria (End of Phase 4)

- [ ] Merchant can create, edit, and manage FAQs via the FAQ Hub
- [ ] Customer sees clean FAQ accordion on storefront and product pages
- [ ] Merchant can import FAQs via CSV wizard
- [ ] Bot Preview shows matched FAQ with confidence score
- [ ] Gap Report surfaces unanswered queries with ranked frequency
- [ ] Platform admin can configure FAQ features per tier via Dashboard Control Panel
- [ ] FAQ feeds chatbot RAG pipeline with auto-sync embeddings
- [ ] Public feedback (thumbs, suggest edit) feeds into merchant insights
- [ ] Bot Knowledge Base page shows real coverage metrics and freshness
- [ ] E2E tests cover create → display → bot query → gap → create → verify flow
