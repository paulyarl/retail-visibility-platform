# Local Marketing Ops — Full Spectrum Gap Analysis & Optimized Sprint Plan

**Date:** 2026-07-28  
**Audited Documents:** `docs/LocalBiz/local_marketing_ops_sprint_plan_v2.md` (v2) and `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md` (v3)  
**Status:** Audit Complete — Optimized Plan Ready for Implementation  

> **v3 delta:** v3 adds `marketing_deliverable_templates` and `marketing_deliverables` tables, a document generation engine (HTML→PDF), branding injection, preview/paid watermark logic, and deliverable UI screens. All 16 critical violations from v2 persist in v3. This update adds v3-specific gaps (C17–C22) and integrates deliverables into the optimized plan.  

---

## Part 1: Gap Analysis Against Platform Architecture

### 1.1 Critical Violations (Must Fix Before Implementation)

| # | Gap | Plan Says | Platform Requires | Impact |
|---|-----|-----------|-------------------|--------|
| C1 | **Primary key type** | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `VARCHAR(255)` with tenant-scoped nanoid IDs from `id-generator.ts` | All Prisma models, joins, and foreign keys will be wrong type |
| C2 | **Table naming convention** | `marketing_campaigns`, `marketing_audits`, `marketing_files` | `_list` suffix for entity tables (e.g., `marketing_campaigns_list`, `marketing_audits_list`) | Inconsistent with 100+ existing tables |
| C3 | **No RLS policies** | Zero RLS in any DDL | RLS enabled + isolation policies on all tenant-scoped tables | Security hole — any authenticated user can read cross-tenant data |
| C4 | **No `updated_at` triggers** | Missing entirely | `updated_at` trigger function on all new tables | Stale `updated_at` values break cache invalidation and sync jobs |
| C5 | **No idempotency guards** | Raw `CREATE TABLE` without `IF NOT EXISTS` | `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` on all DDL | Re-running migrations will error |
| C6 | **No singleton service pattern** | Generic "build CRUD endpoints" | Backend services extend `BaseService` with `getInstance()` singleton | Breaks dependency injection, testing, and logging conventions |
| C7 | **No route registry entry** | Not mentioned | Routes registered in `routeRegistry.ts` with path, domain, authLevel, comment | Routes won't be mounted — `mountFromRegistry()` won't know about them |
| C8 | **Direct AI API calls** | "Integrate OpenAI/Anthropic API" | Use existing `AIProviderService` + `AiProviderFactory` + `AiProvider` interface | Duplicates provider abstraction, misses fallback logic, token tracking, rate limiting |
| C9 | **No navigation link DB entry** | Not mentioned | `navigation_links` table INSERT required (database-driven navigation is active) | Sidebar link won't appear in UI — file-based fallbacks are bypassed when DB has links |
| C10 | **No capability system integration** | "Feature flag gate" (generic) | Register `marketing_ops` capability type in `capability_type_list`, seed feature keys in `features_list` + `capability_features_list` + `tier_features_list` | No tier gating, no resolver pipeline, no `buildExpiredCapabilitiesResponse` entry |
| C11 | **No Prisma sync step** | Not mentioned | `npx prisma db pull && npx prisma generate` after SQL migration | Prisma types won't include new tables — all queries will fail to compile |
| C12 | **FK references to `users(id)` as UUID** | `UUID REFERENCES users(id)` | `users.id` is `TEXT` type, not `UUID` | Foreign key constraint will fail at migration time |
| C17 | **v3: New deliverable tables repeat all violations** | `marketing_deliverable_templates` and `marketing_deliverables` use UUID PKs, no RLS, no triggers, no `IF NOT EXISTS`, no `_list` suffix, UUID FKs to `users(id)` | Same fixes as C1–C5, C12, C13 apply to both new tables | Same impact — migration failure, security holes, type mismatches |
| C18 | **v3: Document generation recommends Puppeteer/Gotenberg** | Lists Puppeteer, wkhtmltopdf, Gotenberg, DocRaptor, PDFShift as options | Platform already has `jspdf` (v4.2.1) in `apps/api/package.json` and uses it for invoice PDF generation in `tenant-billing.ts`, `subscription-billing.ts`, `manual-billing.ts` | Introduces heavy new dependency (Puppeteer = Chromium download ~300MB), Docker container (Gotenberg), or external API cost — when jsPDF already works |
| C19 | **v3: HTML template uses Handlebars syntax** | `{{#each responses}}`, `{{#if is_preview}}`, `{{variable}}` | Platform does not use Handlebars. Existing PDF generation uses programmatic jsPDF API (`doc.text()`, `doc.setFont()`, etc.) | Need to either add Handlebars dependency or switch to jsPDF programmatic approach |
| C20 | **v3: No branding config table** | Plan §7.5 describes branding settings (operator_name, logo_url, primary_color, etc.) but no DB table to store them | Either a `mkt_branding_config` table or store in `platform_settings` | Branding settings have nowhere to persist |
| C21 | **v3: No ID generators for new tables** | Not mentioned | Need `generateDeliverableTemplateId()` and `generateDeliverableId()` in `id-generator.ts` | IDs will use UUID default instead of platform nanoid convention |
| C22 | **v3: Sprint 3 overloaded** | Sprint 3 now includes: deliverable template CRUD + document engine + branding + watermark + deliverable UI (5 screens) + dashboard + AI integration + filter review + streaming + export + live updates = 19 tasks, ~72 points | Previous v2 Sprint 3 was already heavy at 12 tasks. Adding ~25 points of deliverable work makes it ~72 points in 2 weeks | Sprint 3 will fail — needs splitting |
| C13 | **Money as DECIMAL** | `DECIMAL(10,2)` for `amount_paid`, `retainer_amount`, `estimated_fee` | Platform convention: store money in cents as `INTEGER` (e.g., `amount_paid_cents INTEGER`) | Inconsistent with all existing financial tables (orders, bsaas_catalog, etc.) |
| C14 | **No Zod validation** | Not mentioned | Platform uses Zod schemas on all route handlers | Unvalidated input — security and data integrity risk |
| C15 | **Python migration script** | `migrate_legacy.py` using pandas | Platform is TypeScript/Node.js — migration scripts use `tsx` | Introduces Python dependency into a Node.js monorepo |
| C16 | **No frontend singleton service** | Not mentioned | Frontend services extend `AdminApiSingleton` / `AuthenticatedApiSingleton` / `TenantApiSingleton` | Breaks caching, auth header injection, and error handling conventions |

### 1.2 Moderate Gaps (Should Fix for Full Compliance)

| # | Gap | Recommendation |
|---|-----|----------------|
| M1 | **No CRM integration** | This is a CRM-adjacent feature (pipeline tracking, contacts, activities, stage history). Should integrate with existing CRM infrastructure (`CrmActivityService`, `CrmContactService`, audit module) rather than creating parallel tables. At minimum, use `crm_activities` for activity logging and the platform `audit` module for stage transitions. |
| M2 | **No skill document** | Platform convention: create `.devin/skills/marketing-ops-guide.md` with patterns, data model, and anti-patterns. |
| M3 | **No E2E batch test** | Platform has `sprint-e2e-batch.test.ts` for regression testing. New features add a section. |
| M4 | **No BillingNotificationService integration** | Revenue tracking (amount_paid, retainer_amount) should fire billing notifications for financial events. |
| M5 | **SSE/WebSocket for live updates** | Platform uses React Query polling patterns. No SSE infrastructure exists. Use `refetchInterval` or manual refresh instead. |
| M13 | **v3: No frontend service methods for deliverables** | `MarketingOpsService` needs `listDeliverableTemplates`, `createDeliverableTemplate`, `generateDeliverable`, `listDeliverables`, `downloadDeliverable`, `sendDeliverable` methods |
| M14 | **v3: No page routes for deliverable template library** | Need `/settings/admin/marketing-ops/deliverable-templates` page route |
| M15 | **v3: No BillingNotificationService for deliverable events** | Fire `marketing_deliverable_sent` and `marketing_deliverable_paid` notifications via existing `BillingNotificationService` |
| M16 | **v3: No deliverable template seed data** | Need 7 default templates matching the 7 deliverable types in §7.2 |
| M17 | **v3: Watermark implementation unclear** | If using jsPDF (not HTML→PDF), watermark must use `doc.text()` with rotation and gray color — different from CSS approach |
| M6 | **No design doc** | Platform convention: design doc in `docs/` directory before sprint plan. |
| M7 | **No `unifiedConfig` usage** | All config must come from `unifiedConfig.ts`, not `process.env` directly. AI provider keys, storage paths, etc. |
| M8 | **No structured logging** | Plan doesn't specify `logger` from `../logger`. New code must use `logger.info/error/warn(message, RequestCtx, meta)` — no `console.*`. |
| M9 | **File storage unspecified** | Platform uses local `UPLOAD_DIR` with `multer`. Plan should specify this. |
| M10 | **Kanban pattern reuse** | Platform already has Kanban for CRM tasks (`CrmTaskService` with `sort_order` + reorder). Should reuse the pattern, not build from scratch. |
| M11 | **No `buildExpiredCapabilitiesResponse` entry** | When capability expires (subscription lapses), platform returns expired state. Marketing ops needs this. |
| M12 | **No constraint metadata** | `capability-constraints.ts` needs `marketing_ops` entry for cross-capability constraint layer (CCL). |

### 1.3 Minor Gaps (Nice to Have)

| # | Gap | Recommendation |
|---|-----|----------------|
| m1 | **Campaign ID format** | `AUS-AD-001` is human-readable. Keep as a secondary `display_id` field; primary `id` uses nanoid pattern `mcamp-{nanoid}`. |
| m2 | **Accessibility audit** | Platform uses shadcn/ui (already WCAG-compliant). Standard audit sufficient. |
| m3 | **Lighthouse >90** | Platform is Next.js with SSR. Standard performance practices apply. |
| m4 | **v1.1 roadmap items** | Batch execution, email integration, calendar — all feasible with existing infra but correctly deferred. |

### 1.4 What the Plan Gets Right

- **Conceptual model** (campaign journey pipeline) is well-designed and domain-appropriate
- **Stage transition rules** with irreversibility constraints and automated advances are solid
- **Prompt management** with versioning, variable injection, and quality filter workflow is comprehensive
- **Risk register** covers realistic scenarios (v3 adds document generation failure risk)
- **Success metrics** are measurable and have baselines (v3 adds deliverable generation time and send rate)
- **Copy-paste bridge** mode for AI execution is a pragmatic fallback
- **v3 Deliverable concept** is the right end-to-end workflow — Seek → Fulfill → Filter → Generate → Show/Send → Paid → Deliver Clean → Retainer
- **v3 Preview vs. paid logic** (watermark, response count, template inclusion, file naming) is well-thought-out
- **v3 Branding injection** (operator logo, colors, name) is a strong UX differentiator
- **v3 Deliverable types** (7 types covering review responses, service menus, GBP audits, etc.) are comprehensive

---

## Part 2: Optimized Sprint Plan

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Table prefix**: `mkt_` (not `marketing_`) | Shorter, consistent with `crm_` prefix pattern |
| **Table suffix**: `_list` for entity tables | Platform convention (e.g., `mkt_campaigns_list`) |
| **Primary keys**: `VARCHAR(255)` with nanoid | Platform convention via `id-generator.ts` |
| **Money storage**: Integer cents | Platform convention (all financial fields use `_cents` suffix) |
| **AI execution**: Via existing `AIProviderService` | Reuse provider abstraction, fallback, token tracking |
| **Document generation**: Extend existing `jsPDF` pattern | Platform already has jsPDF for invoices — no Puppeteer/Gotenberg |
| **Template rendering**: Programmatic jsPDF, not HTML+Handlebars | Platform doesn't use Handlebars; jsPDF is programmatic |
| **Watermark**: jsPDF `doc.text()` with rotation + transparency | Native jsPDF capability, no CSS hacks |
| **Branding storage**: `mkt_branding_config` table | Persist operator branding settings |
| **Route registration**: `routeRegistry.ts` entry | Centralized mounting |
| **Navigation**: SQL INSERT into `navigation_links` | Database-driven nav is active |
| **Capability system**: `marketing_ops` capability type | Tier gating via resolver pipeline |
| **Frontend services**: `AdminApiSingleton` extension | Admin-only feature |
| **Live updates**: React Query `refetchInterval` | No SSE infrastructure in platform |
| **Data migration**: `tsx` script, not Python | Node.js monorepo |
| **CRM integration**: Log activities via `CrmActivityService` | Reuse existing audit trail |
| **Sprint 3 split**: Deliverables → Sprint 3a, Dashboard+AI → Sprint 3b | v3 Sprint 3 is ~72 points — too much for 2 weeks |

---

### Sprint 1: Database + Capability System + Backend Services (Week 1–2)

**Goal:** Migration applied, Prisma synced, backend services operational, routes mounted.

#### 1.1 Database Migration

**File:** `database/migrations/128_marketing_ops.sql`

Tables to create (all with RLS, `updated_at` triggers, `IF NOT EXISTS` guards):

```
mkt_campaigns_list              — Campaign records (pipeline tracking)
mkt_audits_list                 — Per-platform audit data per campaign
mkt_stage_history_list          — Stage transition audit trail
mkt_files_list                  — File attachment metadata
mkt_prompt_templates_list       — Versioned prompt templates
mkt_prompt_executions_list      — AI execution records
mkt_filter_flags_list           — Quality filter flags per execution
mkt_scorecards_list             — Daily scorecard entries
mkt_deliverable_templates_list  — jsPDF layout templates for deliverables (v3)
mkt_deliverables_list           — Generated deliverable records (v3)
mkt_branding_config             — Operator branding settings (v3)
```

Key schema corrections from v3 plan:
- `id VARCHAR(255) PRIMARY KEY` (not UUID)
- `campaign_id VARCHAR(255)` — nanoid-based `mcamp-{nanoid}`, with `display_id VARCHAR(20)` for `AUS-AD-001` format
- `assigned_to TEXT REFERENCES users(id)` (not UUID)
- `created_by TEXT REFERENCES users(id)` (not UUID)
- `amount_paid_cents INTEGER` (not DECIMAL)
- `retainer_amount_cents INTEGER` (not DECIMAL)
- `estimated_fee_cents INTEGER` (not DECIMAL)
- `revenue_collected_cents INTEGER` (not DECIMAL)
- RLS policies: `USING (true)` for admin-only tables (platform admin sees all), or tenant-scoped if multi-tenant
- `updated_at TIMESTAMPTZ DEFAULT NOW()` with trigger
- `created_at TIMESTAMPTZ DEFAULT NOW()`

v3 new tables schema corrections:
- `mkt_deliverable_templates_list`: `id VARCHAR(255)`, `created_by TEXT REFERENCES users(id)`, `layout_spec JSONB` (jsPDF-compatible layout spec, not Handlebars HTML), `is_active BOOLEAN DEFAULT true`, `is_default BOOLEAN DEFAULT false`
- `mkt_deliverables_list`: `id VARCHAR(255)`, `campaign_id VARCHAR(255) REFERENCES mkt_campaigns_list(id)`, `execution_id VARCHAR(255) REFERENCES mkt_prompt_executions_list(id)`, `template_id VARCHAR(255) REFERENCES mkt_deliverable_templates_list(id)`, `generated_by TEXT REFERENCES users(id)`, `branding_applied JSONB`, `is_watermarked BOOLEAN DEFAULT false`, `sent_at TIMESTAMPTZ`, `sent_method VARCHAR(50)`
- `mkt_branding_config`: `id VARCHAR(255)`, `operator_name VARCHAR(255)`, `operator_logo_url TEXT`, `primary_color VARCHAR(20) DEFAULT '#111827'`, `accent_color VARCHAR(20) DEFAULT '#3B82F6'`, `text_color VARCHAR(20) DEFAULT '#1F2937'`, `font_family VARCHAR(100)`, `footer_disclaimer TEXT`, `updated_at TIMESTAMPTZ DEFAULT NOW()` with trigger

Capability system seeding (in same migration):
```sql
-- capability_type_list entry
INSERT INTO capability_type_list (id, name, description, is_active)
VALUES ('marketing_ops', 'Marketing Ops', 'Local marketing campaign management', true)
ON CONFLICT DO NOTHING;

-- features_list entries
INSERT INTO features_list (feature_key, description, is_active) VALUES
  ('marketing_ops_enabled', 'Marketing ops module enabled', true),
  ('marketing_ops_disabled', 'Marketing ops module disabled', false),
  ('marketing_ops_prompt_execution', 'Direct AI prompt execution', true),
  ('marketing_ops_filter_review', 'Quality filter review queue', true),
  ('marketing_ops_batch_execution', 'Batch prompt execution', false),
  ('marketing_ops_revenue_tracking', 'Revenue and retainer tracking', true)
ON CONFLICT DO NOTHING;

-- capability_features_list links
-- tier_features_list assignments (all tiers get _enabled=true, _disabled=false;
--   advanced features gated to Professional+)
```

Navigation link:
```sql
INSERT INTO navigation_links (id, target, label, href, icon, sort_order, parent_id, is_active)
VALUES ('marketing-ops', 'admin', 'Marketing Ops', '/settings/admin/marketing-ops', 'megaphone', 50, NULL, true)
ON CONFLICT DO NOTHING;
```

#### 1.2 ID Generators

**File:** `apps/api/src/lib/id-generator.ts`

Add 11 new generators:
- `generateCampaignId()` → `mcamp-{nanoid}`
- `generateAuditId()` → `maud-{nanoid}`
- `generateStageHistoryId()` → `msh-{nanoid}`
- `generateMarketingFileId()` → `mfile-{nanoid}`
- `generatePromptTemplateId()` → `mpt-{nanoid}`
- `generatePromptExecutionId()` → `mpe-{nanoid}`
- `generateFilterFlagId()` → `mff-{nanoid}`
- `generateScorecardId()` → `msc-{nanoid}`
- `generateDeliverableTemplateId()` → `mdt-{nanoid}` (v3)
- `generateDeliverableId()` → `mdlv-{nanoid}` (v3)
- `generateBrandingConfigId()` → `mbcfg-{nanoid}` (v3)

#### 1.3 Prisma Sync

```bash
npx prisma db pull && npx prisma generate
```

#### 1.4 Backend Services

All services extend `BaseService` with `getInstance()` singleton pattern.

| Service File | Extends | Responsibility |
|-------------|---------|----------------|
| `MarketingCampaignService.ts` | `BaseService` | Campaign CRUD, stage transitions with validation, stage history logging |
| `MarketingAuditService.ts` | `BaseService` | Audit CRUD, pain score calculation |
| `MarketingPromptService.ts` | `BaseService` | Template CRUD, versioning, variable injection |
| `MarketingExecutionService.ts` | `BaseService` | AI execution via `AIProviderService`, token tracking, filter flag creation |
| `MarketingScorecardService.ts` | `BaseService` | Daily scorecard CRUD, aggregation queries |
| `MarketingFileService.ts` | `BaseService` | File upload/download via `multer` + `UPLOAD_DIR` |
| `MarketingDeliverableService.ts` | `BaseService` | Deliverable template CRUD, PDF generation via `jsPDF`, watermark logic (v3) |
| `MarketingBrandingService.ts` | `BaseService` | Branding config CRUD, apply branding to jsPDF docs (v3) |

Stage transition validation:
- Define allowed transitions in a `STAGE_TRANSITIONS` map
- Log every transition via `audit` module + `mkt_stage_history_list` insert
- Automated `shown → lost` after 7 days via scheduled job

#### 1.5 Routes

**File:** `apps/api/src/routes/marketing-ops.ts`

All routes use `authenticateToken` + `requirePlatformAdmin` middleware.
All routes use Zod validation schemas.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/marketing-ops/campaigns` | List campaigns (filters: stage, category, city, assigned_to) |
| POST | `/api/admin/marketing-ops/campaigns` | Create campaign |
| GET | `/api/admin/marketing-ops/campaigns/:id` | Get campaign detail |
| PUT | `/api/admin/marketing-ops/campaigns/:id` | Update campaign |
| DELETE | `/api/admin/marketing-ops/campaigns/:id` | Delete campaign |
| POST | `/api/admin/marketing-ops/campaigns/:id/stage` | Stage transition (validates allowed moves) |
| GET | `/api/admin/marketing-ops/campaigns/:id/history` | Stage history timeline |
| POST | `/api/admin/marketing-ops/campaigns/:id/audits` | Create audit |
| GET | `/api/admin/marketing-ops/campaigns/:id/audits` | List audits |
| POST | `/api/admin/marketing-ops/campaigns/:id/files` | Upload file (multer) |
| GET | `/api/admin/marketing-ops/campaigns/:id/files` | List files |
| GET | `/api/admin/marketing-ops/campaigns/:id/files/:fileId` | Download file |
| GET | `/api/admin/marketing-ops/prompts` | List prompt templates |
| POST | `/api/admin/marketing-ops/prompts` | Create template |
| PUT | `/api/admin/marketing-ops/prompts/:id` | Update template (creates new version) |
| POST | `/api/admin/marketing-ops/prompts/:id/execute` | Execute prompt via `AIProviderService` |
| GET | `/api/admin/marketing-ops/executions/:campaignId` | Execution history per campaign |
| GET | `/api/admin/marketing-ops/filter-flags` | Filter review inbox (paginated) |
| PUT | `/api/admin/marketing-ops/filter-flags/:id` | Update flag status (fixed/approved_as_is) |
| GET | `/api/admin/marketing-ops/scorecards` | List scorecards |
| POST | `/api/admin/marketing-ops/scorecards` | Create/update daily scorecard |
| GET | `/api/admin/marketing-ops/dashboard` | Dashboard metrics (stage counts, revenue, conversion rates) |
| GET | `/api/admin/marketing-ops/export` | CSV export |
| GET | `/api/admin/marketing-ops/deliverable-templates` | List deliverable templates (v3) |
| POST | `/api/admin/marketing-ops/deliverable-templates` | Create deliverable template (v3) |
| PUT | `/api/admin/marketing-ops/deliverable-templates/:id` | Update deliverable template (v3) |
| DELETE | `/api/admin/marketing-ops/deliverable-templates/:id` | Delete deliverable template (v3) |
| POST | `/api/admin/marketing-ops/campaigns/:id/deliverables` | Generate deliverable (preview or paid) via jsPDF (v3) |
| GET | `/api/admin/marketing-ops/campaigns/:id/deliverables` | List deliverables for campaign (v3) |
| GET | `/api/admin/marketing-ops/deliverables/:id/download` | Download deliverable PDF (v3) |
| POST | `/api/admin/marketing-ops/deliverables/:id/send` | Mark deliverable as sent (v3) |
| GET | `/api/admin/marketing-ops/branding` | Get branding config (v3) |
| PUT | `/api/admin/marketing-ops/branding` | Update branding config (v3) |

#### 1.6 Route Registry

**File:** `apps/api/src/routes/routeRegistry.ts`

Add entry:
```typescript
{
  path: '/api/admin/marketing-ops',
  router: marketingOpsRoutes,
  domain: 'admin',
  authLevel: 'admin',
  comment: 'Marketing ops admin module — campaign pipeline, prompts, dashboard',
},
```

#### 1.7 Capability Resolver (Minimal)

Since this is admin-only (not tenant-facing), the capability resolver is lightweight:
- `MarketingOpsResolver.ts` — checks `marketing_ops_enabled` feature key
- Types in `resolvers/types.ts` — `EffectiveMarketingOps` interface
- Wire into `EffectiveCapabilityResolver.ts`
- `buildExpiredCapabilitiesResponse` entry in `public-tenant-capabilities.ts`
- Constraint metadata in `capability-constraints.ts`

#### 1.8 Scheduled Job

**File:** `apps/api/src/jobs/marketing-ops-stage-autoadvance.ts`

- Runs daily
- Moves `shown` campaigns to `lost` after 7 days of no response (configurable)
- Logs automated stage transitions with `trigger_type: 'automated'`
- Wired into server startup in `index.ts`

**Exit Criteria:**
- [ ] Migration applies cleanly with `IF NOT EXISTS` guards
- [ ] `prisma db pull && prisma generate` succeeds
- [ ] All 8 ID generators produce correct format
- [ ] All services follow `BaseService` singleton pattern
- [ ] Routes mounted via `routeRegistry.ts`
- [ ] `requirePlatformAdmin` on all routes
- [ ] Zod validation on all mutation endpoints
- [ ] Stage transitions enforce business rules
- [ ] `pnpm checkapi` passes with zero errors
- [ ] Navigation link visible in admin sidebar

---

### Sprint 2: Frontend — Campaign Tracker + Intake + Prompt Workspace (Week 3–4)

**Goal:** Admin can create campaigns, fill audit forms, execute prompts (copy-paste mode), and manage pipeline stages.

#### 2.1 Frontend Service

**File:** `apps/web/src/services/MarketingOpsService.ts`

Extends `AdminApiSingleton` with:
- `listCampaigns(filters)`, `getCampaign(id)`, `createCampaign(data)`, `updateCampaign(id, data)`
- `transitionStage(id, toStage, notes)`, `getStageHistory(id)`
- `listAudits(campaignId)`, `createAudit(campaignId, data)`
- `uploadFile(campaignId, file)`, `listFiles(campaignId)`, `downloadFile(fileId)`
- `listPrompts(filters)`, `createPrompt(data)`, `updatePrompt(id, data)`
- `executePrompt(id, variables)`, `getExecutions(campaignId)`
- `listFilterFlags(filters)`, `updateFilterFlag(id, status)`
- `listScorecards(filters)`, `createScorecard(data)`
- `getDashboard()`, `exportCsv(filters)`

#### 2.2 Pages

All pages under `apps/web/src/app/(platform)/settings/admin/marketing-ops/`:

| Route | File | Component |
|-------|------|-----------|
| `/settings/admin/marketing-ops` | `page.tsx` | `MarketingOpsDashboard.tsx` — dashboard with metric cards, pipeline summary |
| `/settings/admin/marketing-ops/campaigns` | `page.tsx` | `CampaignListClient.tsx` — sortable/filterable table + Kanban toggle |
| `/settings/admin/marketing-ops/campaigns/[id]` | `page.tsx` | `CampaignDetailClient.tsx` — full journey view, tabs (overview, audits, prompts, files, history) |
| `/settings/admin/marketing-ops/campaigns/new` | `page.tsx` | `CampaignFormClient.tsx` — create/edit form |
| `/settings/admin/marketing-ops/prompts` | `page.tsx` | `PromptLibraryClient.tsx` — template CRUD, versioning |
| `/settings/admin/marketing-ops/prompts/[id]` | `page.tsx` | `PromptWorkspaceClient.tsx` — variable injection, execution, output viewer |
| `/settings/admin/marketing-ops/filter-review` | `page.tsx` | `FilterReviewClient.tsx` — review inbox with batch actions |
| `/settings/admin/marketing-ops/scorecards` | `page.tsx` | `ScorecardClient.tsx` — daily scorecard form + history |

#### 2.3 Components

| Component | Purpose |
|-----------|---------|
| `CampaignKanbanBoard.tsx` | Drag-and-drop Kanban (reuse pattern from CRM tasks Kanban) |
| `StageBadge.tsx` | 9 color-coded stage variants (use Tailwind classes from plan's color mapping) |
| `AuditIntakeForm.tsx` | Multi-section form with platform tabs, auto-scoring |
| `PromptWorkspace.tsx` | Variable editor, output viewer, execution history |
| `FilterReviewItem.tsx` | Flag list, suggested fix, inline editor |
| `MetricCard.tsx` | Dashboard metric cards (reuse existing shadcn Card) |
| `FileAttachmentZone.tsx` | Upload zone (reuse existing file upload pattern) |

#### 2.4 Navigation

- Admin sidebar link via `navigation_links` DB entry (already seeded in Sprint 1)
- File-based fallback in `AdminNavContent.tsx` `buildAdminNavItems()` — add Marketing Ops entry with Megaphone icon
- Icon registration in `useNavLinks.tsx`, `page.tsx`, `NavItemRow.tsx` (Lucide `Megaphone`)

#### 2.5 Settings Card

Add "Marketing Ops" card to admin settings page with link to module.

**Exit Criteria:**
- [ ] Admin can create a campaign from scratch
- [ ] Audit form auto-calculates pain score and recommends tier
- [ ] Prompt workspace generates text with variable injection (copy-paste mode)
- [ ] Kanban board updates stage and logs history
- [ ] Tracker filters by stage, category, city, tier, assignment
- [ ] `pnpm checkweb` passes with zero errors
- [ ] Mobile-responsive (tablet + mobile)

---

### Sprint 3a: Deliverable Generation Engine (Week 5)

**Goal:** In-platform document generation from AI outputs using existing `jsPDF` library, branding injection, preview/paid watermark logic.

#### 3a.1 Document Generation Engine

- `MarketingDeliverableService.generateDeliverable()` — takes campaign ID, template ID, execution ID, and `is_preview` flag
- Uses `jsPDF` (already in `package.json`) — programmatic PDF generation, NOT HTML→PDF
- Template system: templates stored as JSON layout specs (sections, fonts, colors, positioning), not Handlebars HTML
- `MarketingBrandingService.applyBranding()` — injects operator name, logo, colors into jsPDF document
- Watermark: `doc.setTextColor(200, 200, 200); doc.setFontSize(48); doc.text('PREVIEW', x, y, { angle: 30 })`
- Preview vs. paid logic:
  - Preview: watermark, 5–10 sample responses, no reusable templates section
  - Paid: no watermark, all responses, includes reusable templates, operator + business co-branding
- File naming: `{display_id}_preview_{DATE}.pdf` or `{display_id}_paid_{TIER}_{DATE}.pdf`
- Generated PDFs stored via `multer` + `UPLOAD_DIR` (same as existing file uploads)

#### 3a.2 Deliverable Template CRUD

- 7 default deliverable templates seeded (review responses, service menu, GBP audit, testimonial cards, NAP report, SEO content, lead magnet)
- Templates are JSON layout specs, not HTML — each defines sections, styling, variable placeholders
- Versioning: new version on edit, `is_default` flag for active template per type

#### 3a.3 Frontend Deliverable UI

| Route | Component |
|-------|-----------|
| `/settings/admin/marketing-ops/deliverable-templates` | `DeliverableTemplateLibraryClient.tsx` — CRUD, preview rendered output |
| Campaign detail → Deliverables tab | `DeliverablePanel.tsx` — list deliverables, generate new, download, send |
| Modal | `DeliverablePreviewModal.tsx` — PDF viewer, source text toggle, watermark badge, send button |
| Modal | `DeliverableGenerateModal.tsx` — select template → inject content → generate → preview → save |

#### 3a.4 Branding Settings

- `/settings/admin/marketing-ops/branding` page or settings card
- `BrandingConfigClient.tsx` — operator name, logo upload, color pickers, font selector, footer disclaimer
- Preview panel showing branded document sample

**Exit Criteria:**
- [ ] Deliverable generation produces branded PDF from AI output via jsPDF
- [ ] Preview deliverables show diagonal "PREVIEW" watermark; paid deliverables do not
- [ ] 7 default templates seeded and functional
- [ ] Branding config persists and applies to generated documents
- [ ] `pnpm checkapi` + `pnpm checkweb` pass

---

### Sprint 3b: Direct AI Integration + Dashboard + Filter Review (Week 6)

**Goal:** In-platform AI execution via `AIProviderService`, real-time dashboard with polling, quality filter review queue.

#### 3b.1 AI Execution Integration

- `MarketingExecutionService.executePrompt()` calls `AIProviderService.generateChatCompletion()` via `AiProviderFactory`
- Provider selection: uses `unifiedConfig` for API keys, respects `AIConfig.textProvider` setting
- Token usage tracked per execution in `mkt_prompt_executions_list.tokens_used`
- Cost estimation: `tokens_used * cost_per_token` from provider config
- Streaming: use `AIProviderService` streaming if available, otherwise async with loading state
- Rate limiting: respect existing `GEMINI_RATE_LIMIT` pattern in `AIProviderService`

#### 3b.2 Dashboard

- `MarketingOpsService.getDashboard()` returns aggregated metrics
- Frontend uses React Query with `refetchInterval: 30000` (30s polling) for "live" feel
- No SSE/WebSocket — platform doesn't have this infrastructure
- Metric cards: active campaigns, pipeline by stage, weekly revenue, conversion rate
- Pipeline column chart: stage counts
- Weekly summary: revenue, previews built, packages delivered

#### 3b.3 Filter Review Queue

- `FilterReviewClient.tsx` — paginated inbox of `mkt_filter_flags_list` entries
- Batch actions: approve all, fix all
- Inline editor for human fixes
- Pass rate display per template

#### 3b.4 Data Export

- `GET /api/admin/marketing-ops/export?format=csv&filters=...` endpoint
- Returns CSV stream with proper headers
- Frontend triggers download via blob

**Exit Criteria:**
- [ ] Prompt execution calls `AIProviderService` and returns results in-platform
- [ ] Token usage and cost tracked per execution
- [ ] Dashboard loads with real data in <2 seconds (with polling refresh)
- [ ] Filter flags appear in review inbox; batch actions work
- [ ] CSV export produces valid file
- [ ] `pnpm checkapi` + `pnpm checkweb` pass

---

### Sprint 4: Data Migration + Polish + Launch (Week 7–8)

**Goal:** Migrate legacy data, polish UI, QA, deploy.

#### 4.1 Data Migration Script

**File:** `scripts/migrate-marketing-ops.ts` (TypeScript, run with `tsx`)

- Reads legacy CSV/spreadsheet
- Transforms to `mkt_campaigns_list` schema
- Generates nanoid-based IDs
- Maps legacy status → campaign stage
- Calculates pain scores from audit data
- Reconstructs stage history from dates
- Seeds default prompt templates (8 templates from plan §6.1)
- Seeds default deliverable templates (7 templates from plan §7.2) (v3)
- Migrates existing deliverable PDFs → `mkt_deliverables_list` records (v3)
- Transactional inserts with rollback on error

#### 4.2 UI Polish

- Loading skeletons (reuse existing `Skeleton` component)
- Empty states for all list views
- Error handling with toast notifications (reuse existing pattern)
- Stage transition animations (CSS transitions, not animation library)
- Dark mode verified across all screens

#### 4.3 Testing

- Unit tests: `MarketingCampaignService.test.ts` (stage transition validation, pain score calculation)
- Unit tests: `MarketingDeliverableService.test.ts` (PDF generation, watermark, branding injection) (v3)
- Route-coverage test: verify `/api/admin/marketing-ops` entry in `routeRegistry`
- E2E batch test: add section to `sprint-e2e-batch.test.ts`
- Manual QA: all 11 CUJs from v3 plan §10.2

#### 4.4 Skill Document

**File:** `.devin/skills/marketing-ops-guide.md`

Document:
- Data model and relationships
- Stage transition rules and allowed moves
- AI execution patterns (via `AIProviderService`)
- Prompt template versioning pattern
- Filter flag workflow
- Anti-patterns (no direct AI API calls, no UUID keys, no DECIMAL money, no Puppeteer/Gotenberg for PDF, no Handlebars)

#### 4.5 BillingNotificationService Integration

- Fire notification on `stage → paid` transition (`marketing_campaign_paid`)
- Fire notification on `stage → retainer_won` (`marketing_retainer_won`)
- Fire notification on deliverable sent (`marketing_deliverable_sent`) (v3)
- Fire notification on deliverable paid (`marketing_deliverable_paid`) (v3)
- Email + CRM alert payload

**Exit Criteria:**
- [ ] All legacy data migrated with integrity verified
- [ ] Default prompt templates seeded and active
- [ ] Zero critical/high bugs
- [ ] `pnpm checkapi` + `pnpm checkweb` pass
- [ ] E2E batch tests pass
- [ ] Skill document published
- [ ] BillingNotificationService fires on paid/retainer-won/deliverable-sent/deliverable-paid

---

## Part 3: Summary of Changes from v2 Plan

| Area | v2 Plan | Optimized Plan |
|------|---------|----------------|
| Primary keys | `UUID DEFAULT gen_random_uuid()` | `VARCHAR(255)` with nanoid from `id-generator.ts` |
| Table names | `marketing_campaigns` | `mkt_campaigns_list` (platform convention) |
| RLS | Missing | Required on all tables |
| Triggers | Missing | `updated_at` triggers on all tables |
| Idempotency | Missing | `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` |
| Money fields | `DECIMAL(10,2)` | `INTEGER` cents (`_cents` suffix) |
| FK to users | `UUID REFERENCES users(id)` | `TEXT REFERENCES users(id)` |
| Services | Generic | `BaseService` + `getInstance()` singleton |
| Routes | Generic | `routeRegistry.ts` entry, Zod validation, `requirePlatformAdmin` |
| AI execution | "Integrate OpenAI/Anthropic API" | Via `AIProviderService` + `AiProviderFactory` |
| Navigation | Not mentioned | `navigation_links` SQL INSERT + file-based fallback + icon registration |
| Capability system | "Feature flag" | Full capability type registration + resolver + expired response + constraints |
| Prisma sync | Not mentioned | `prisma db pull && prisma generate` after migration |
| Frontend services | Not mentioned | `AdminApiSingleton` extension |
| Live updates | SSE/WebSocket | React Query `refetchInterval` polling |
| Migration script | Python (`pandas`) | TypeScript (`tsx`) |
| Logging | Not mentioned | `logger` from `../logger` (no `console.*`) |
| Config | Not mentioned | `unifiedConfig.ts` (no direct `process.env`) |
| CRM integration | None | Log activities via `CrmActivityService`, stage transitions via `audit` module |
| Billing notifications | None | `BillingNotificationService` on paid/retainer-won events |
| Skill document | Not mentioned | `.devin/skills/marketing-ops-guide.md` |
| E2E tests | Not mentioned | Section in `sprint-e2e-batch.test.ts` |
| Document generation | Puppeteer/Gotenberg/wkhtmltopdf/external API | Extend existing `jsPDF` (already in `package.json`) |
| Template format | HTML + Handlebars (`{{#each}}`, `{{#if}}`) | JSON layout spec for programmatic jsPDF generation |
| Watermark | CSS opacity + rotation | jsPDF `doc.text()` with angle + gray text color |
| Branding storage | Not specified | `mkt_branding_config` table |
| Sprint 3 | Single sprint, ~72 points | Split into Sprint 3a (deliverables) + Sprint 3b (dashboard+AI) |
| Deliverable tables | UUID PKs, no RLS, no triggers | `mkt_deliverable_templates_list` + `mkt_deliverables_list` with all platform conventions |
| Deliverable seed data | Mentioned but not specified | 7 default templates matching §7.2 deliverable types |
| Deliverable notifications | Not mentioned | `marketing_deliverable_sent` + `marketing_deliverable_paid` via `BillingNotificationService` |
| Display ID | `campaign_id` (primary) | `display_id` (secondary, human-readable) + `id` (primary, nanoid) |

---

## Part 4: File Inventory (New Files to Create)

### Database
- `database/migrations/128_marketing_ops.sql`

### Backend Services
- `apps/api/src/services/MarketingCampaignService.ts`
- `apps/api/src/services/MarketingAuditService.ts`
- `apps/api/src/services/MarketingPromptService.ts`
- `apps/api/src/services/MarketingExecutionService.ts`
- `apps/api/src/services/MarketingScorecardService.ts`
- `apps/api/src/services/MarketingFileService.ts`
- `apps/api/src/services/MarketingDeliverableService.ts` (v3)
- `apps/api/src/services/MarketingBrandingService.ts` (v3)
- `apps/api/src/services/resolvers/MarketingOpsResolver.ts`

### Backend Routes
- `apps/api/src/routes/marketing-ops.ts`

### Backend Jobs
- `apps/api/src/jobs/marketing-ops-stage-autoadvance.ts`

### Backend Tests
- `apps/api/src/services/MarketingCampaignService.test.ts`
- `apps/api/src/services/MarketingDeliverableService.test.ts` (v3)

### Backend Modified Files
- `apps/api/src/lib/id-generator.ts` (11 new generators)
- `apps/api/src/routes/routeRegistry.ts` (new entry)
- `apps/api/src/services/resolvers/types.ts` (new interfaces)
- `apps/api/src/services/resolvers/index.ts` (export)
- `apps/api/src/services/EffectiveCapabilityResolver.ts` (wire resolver)
- `apps/api/src/routes/public-tenant-capabilities.ts` (expired response)
- `apps/api/src/routes/admin/capability-constraints.ts` (constraint metadata)
- `apps/api/src/services/subscription/BillingNotificationService.ts` (new notification types)
- `apps/api/src/index.ts` (job startup)
- `apps/api/prisma/schema.prisma` (via `db pull` — NOT manual edit)

### Frontend Services
- `apps/web/src/services/MarketingOpsService.ts` (includes deliverable + branding methods) (v3)

### Frontend Pages
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/MarketingOpsDashboard.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/new/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/new/CampaignFormClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/filter-review/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/filter-review/FilterReviewClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/scorecards/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/scorecards/ScorecardClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/deliverable-templates/page.tsx` (v3)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/deliverable-templates/DeliverableTemplateLibraryClient.tsx` (v3)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/branding/page.tsx` (v3)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/branding/BrandingConfigClient.tsx` (v3)

### Frontend Components
- `apps/web/src/components/marketing-ops/CampaignKanbanBoard.tsx`
- `apps/web/src/components/marketing-ops/StageBadge.tsx`
- `apps/web/src/components/marketing-ops/AuditIntakeForm.tsx`
- `apps/web/src/components/marketing-ops/PromptWorkspace.tsx`
- `apps/web/src/components/marketing-ops/FilterReviewItem.tsx`
- `apps/web/src/components/marketing-ops/MetricCard.tsx`
- `apps/web/src/components/marketing-ops/FileAttachmentZone.tsx`
- `apps/web/src/components/marketing-ops/DeliverablePanel.tsx` (v3)
- `apps/web/src/components/marketing-ops/DeliverablePreviewModal.tsx` (v3)
- `apps/web/src/components/marketing-ops/DeliverableGenerateModal.tsx` (v3)

### Frontend Modified Files
- `apps/web/src/components/navigation/AdminNavContent.tsx` (fallback nav item)
- `apps/web/src/hooks/useNavLinks.tsx` (icon registration)
- `apps/web/src/app/(platform)/settings/admin/page.tsx` (icon registration)
- `apps/web/src/components/navigation/NavItemRow.tsx` (icon registration)

### Scripts
- `scripts/migrate-marketing-ops.ts`

### Skill Document
- `.devin/skills/marketing-ops-guide.md`

### Tests
- `apps/api/src/tests/sprint-e2e-batch.test.ts` (new section)

---

*End of Gap Analysis & Optimized Plan*
