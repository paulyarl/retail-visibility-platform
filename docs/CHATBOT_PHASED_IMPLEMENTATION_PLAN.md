# Chatbot — End-to-End Phased Implementation Plan

This document breaks the full chatbot platform build into 4 deliverable phases. Each phase produces a working, testable increment. The bot widget is universal (all tiers); only the *response engine* is tier-gated.

---

## Phase 1: Foundation — Schema, Widget, Static Mode, Base Services

**Goal**: The bot widget is live for **all merchants** (Free → Enterprise). Free tier responds with static FAQ lookup. Backend schema, base services, capability resolution, and merchant-facing dashboard are functional.

**Duration**: 1.5–2 weeks

### 1.1 Database Schema (Prisma)

```prisma
model bot_configurations {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id         String   @unique @db.VarChar(255)
  tone              String   @default("friendly") @db.VarChar(20)  // friendly, professional, playful
  fallback_message  String   @default("I'm not sure about that. Let me connect you with support.") @db.Text
  greeting          String   @default("Hi! How can I help you today?") @db.Text
  widget_position   String   @default("bottom-right") @db.VarChar(20) // bottom-right, bottom-left, top-right, top-left
  widget_color      String   @default("#3b82f6") @db.VarChar(7)
  after_hours_enabled Boolean @default(false)
  after_hours_message String? @db.Text
  pre_chat_enabled  Boolean @default(false)
  status            String   @default("active") @db.VarChar(20)  // active, paused, disabled
  created_at        DateTime @default(now()) @db.Timestamptz(6)
  updated_at        DateTime @default(now()) @db.Timestamptz(6)

  tenants           tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
}

model bot_conversations {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  session_id      String   @db.VarChar(255)  // widget session
  customer_email  String?  @db.VarChar(255)
  customer_phone  String?  @db.VarChar(50)
  source          String   @default("widget") @db.VarChar(20)  // widget, web, api
  status          String   @default("active") @db.VarChar(20)  // active, closed
  resolved_by     String?  @db.VarChar(20)  // faq, skill, human, fallback
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  messages        bot_messages[]
  tenants         tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, created_at])
  @@index([session_id])
  @@index([status])
}

model bot_messages {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  conversation_id String   @db.Uuid
  role            String   @db.VarChar(20)  // user, assistant, system
  content         String   @db.Text
  intent          String?  @db.VarChar(50)  // classified intent
  confidence      Float?   // intent classifier confidence
  matched_faq_id  String?  @db.Uuid
  response_type     String   @default("static") @db.VarChar(20)  // static, dynamic, skill, fallback
  guardrail_passed  Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  conversation    bot_conversations @relation(fields: [conversation_id], references: [id], onDelete: Cascade)

  @@index([conversation_id, created_at])
}

model bot_guardrail_rules {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String?  @db.VarChar(255)  // null = global rule
  rule_type       String   @db.VarChar(50)  // banned_phrase, pii_detection, moderation
  pattern         String   @db.VarChar(255)  // regex or keyword
  action          String   @default("block") @db.VarChar(20)  // block, flag, replace
  replacement     String?  @db.VarChar(255)  // for replace action
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)
}

model bot_intents {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name            String   @unique @db.VarChar(50)  // product.search, inventory.check
  category        String   @db.VarChar(50)
  description     String?  @db.Text
  examples        String[] @db.VarChar(255)
  confidence_threshold Float @default(0.85)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)
}

model bot_skills {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name            String   @unique @db.VarChar(50)  // product-search, inventory
  version         String   @default("1.0.0") @db.VarChar(10)
  description     String?  @db.Text
  endpoint        String   @db.VarChar(255)  // /api/public/skills/:name
  required_capabilities String[] @db.VarChar(50)
  tier_gates      String[] @db.VarChar(20)  // Starter, Pro, Enterprise
  featured_aware  Boolean  @default(false)
  capability_gates String[] @db.VarChar(50)
  tenant_status_gates String[] @db.VarChar(20)  // Active, Trial, Suspended, Past-due
  refresh_cadence_minutes Int @default(15)
  status          String   @default("active") @db.VarChar(20)  // active, beta, deprecated
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)
}
```

**Tasks:**
- [ ] Write Prisma migration for all 6 tables
- [ ] Run migration against staging DB
- [ ] Verify indexes (tenant_id, session_id, conversation_id, intent name)
- [ ] Seed global guardrail rules (PII, banned phrases) and intents (product.search, inventory.check, etc.)
- [ ] Seed bot skills registry (product-search, inventory, order-tracking, store-hours)

### 1.2 Chatbot Capability

Add `chatbot_options` capability type following the same pattern as `faq_options`, `featured_options`, and `quickstart_options`.

**Tasks:**
- [ ] Verify `docs/CHATBOT_CAPABILITY_SPEC.md` is current — feature keys, tier assignment, resolution logic
- [ ] Create `apps/api/src/services/ChatbotOptionsService.ts` — resolves `ChatbotOptionsState`
- [ ] Create `apps/web/src/services/ChatbotCapabilityResolutionService.ts` — frontend resolution
- [ ] Create `apps/web/src/hooks/tenant-access/useChatbotCapability.ts` — React hook
- [ ] Update `apps/api/src/routes/tenant-capabilities.ts` — add `chatbot_` prefix
- [ ] Update `CapabilityResolutionService.ts` — add `ChatbotOptionsState`, `resolveChatbotOptionsState`, `getChatbotOptionsState`
- [ ] Update `useCapabilityAccess.ts` — add `useChatbotOptionsCapability` hook

### 1.3 Backend Services

| Service | Responsibility |
|---|---|
| `BotConfigurationService` | CRUD for bot config (tone, greeting, widget position, colors) |
| `BotConversationService` | Create/read conversations, append messages |
| `BotStaticResponseService` | Free tier: exact-match / keyword lookup against FAQ. No AI. |
| `BotGuardrailService` | Universal BERT-powered guardrails (safety, PII, moderation) |
| `BotIntentService` | Universal BERT-powered intent classification |
| `BotSkillService` | Execute skills (public API endpoints, MV-backed) |

**Tasks:**
- [ ] Create `apps/api/src/services/BotConfigurationService.ts`
- [ ] Create `apps/api/src/services/BotConversationService.ts`
- [ ] Create `apps/api/src/services/BotStaticResponseService.ts` — queries FAQ table directly (exact match then keyword fallback)
- [ ] Create `apps/api/src/services/BotGuardrailService.ts` — runs BERT classification for safety/PII (platform-hosted, free)
- [ ] Create `apps/api/src/services/BotIntentService.ts` — runs BERT for intent classification (platform-hosted, free)
- [ ] Create `apps/api/src/services/BotSkillService.ts` — executes skill endpoints with capability/tenant/status gating
- [ ] Write unit tests for all services

### 1.4 Universal Bot Widget (All Tiers)

The bot widget is a vanilla JS bundle injected via `<script>` tag. It is **universal** — every merchant gets it. Only the response engine changes by tier.

**Public API Routes:**
- `POST /api/public/bot/conversations` — Start a conversation (returns session_id)
- `POST /api/public/bot/conversations/:sessionId/messages` — Send a message
  - Runs: Guardrails → Intent Classification → FAQ Static Lookup (Free) or Skill Router → Returns response
- `GET /api/public/bot/config?tenantId=` — Fetch merchant widget config (colors, position, greeting)
- `GET /api/public/bot/skills/:skillName` — Execute skill (public endpoint, MV-backed)

**Frontend Widget:**
- [ ] Create `apps/widget/` or `apps/web/public/bot-widget/` — vanilla JS bundle
- [ ] Shadow DOM isolation (`closed` shadow root)
- [ ] Configurable via `data-tenant-id` + `data-theme` attributes
- [ ] Collapsed state (floating pill), expanded state (chat panel)
- [ ] Pre-chat form (optional, configurable)
- [ ] Message threading with user/assistant bubbles
- [ ] Typing indicator
- [ ] After-hours offline message (if enabled)
- [ ] Auto-refresh conversation every 60s

**Merchant Dashboard Widget Panel:**
- [ ] `BotTenantWidget.tsx` on merchant dashboard (`/t/[tenantId]/`)
- [ ] Shows: "Bot Active — Static Mode" (Free) or "Bot Active — AI Powered" (Starter+)
- [ ] Quick stats: conversations today, FAQ match rate, upgrade CTA
- [ ] Deep-link to Bot Dashboard

**Acceptance Criteria:**
- Bot widget renders on every merchant's storefront and product pages
- Free tier bot responds with static FAQ lookup (exact match / keyword)
- All messages pass guardrails + intent classification (universal)
- Merchant can configure widget appearance (colors, position, greeting)
- Widget is shadow-DOM isolated — no CSS leakage

---

## Phase 2: Core Merchant Experience — Dashboard, Config, Skills, KB, Analytics

**Goal**: Merchant-facing Bot Dashboard, Configuration, Skills, Knowledge Base, Analytics, Widget Setup, and Chatbot Options are all functional. Starter+ tiers see AI readiness indicators.

**Duration**: 2–2.5 weeks

### 2.1 Merchant Bot Dashboard

**Route**: `/t/[tenantId]/bot`

**Tasks:**
- [ ] **Free tier**: "Static Mode" dashboard — widget conversations count, static FAQ response rate, top unmatched questions, gap report link, upgrade CTA
- [ ] **Starter+ tier**: "AI Powered" dashboard — conversations, resolution rate, top intents, model tier badge, FAQ coverage score, revenue lift estimate
- [ ] Stats cards: Conversations (30d), Avg Duration, Handoff Rate, FAQ Coverage
- [ ] Top Intents This Week chart
- [ ] Model Tier Card (LoRA badge, training status, next threshold)
- [ ] Action buttons: Edit Configuration, Manage Skills, View Analytics, Preview Widget

### 2.2 Bot Configuration

**Route**: `/t/[tenantId]/bot/config`

**Tasks:**
- [ ] **General tab**: Tone selector, fallback message, greeting text
- [ ] **Guardrails tab**: View universal rules (read-only for merchant). Shows "These safety rules are managed by the platform."
- [ ] **Intents tab**: View intent whitelist (read-only). Shows "Intent classification is universal."
- [ ] **Model tab**: View current model tier. Starter+ sees training status, thresholds. Free sees "Upgrade to unlock AI".
- [ ] All tabs respect capability gates

### 2.3 Bot Skills

**Route**: `/t/[tenantId]/bot/skills`

**Tasks:**
- [ ] Skill table: name, description, status toggle, required tier
- [ ] Above-tier skills locked with tooltip: "Upgrade to Pro to enable Order Tracking"
- [ ] Featured-aware, capability-aware, tenant-status-aware skill execution (documented in capability spec)
- [ ] Inline configuration panel per skill (no page navigation)
- [ ] Skill engine calls public API endpoints (`/api/public/skills/:skillName`) with MV for <100ms response

### 2.4 Bot Knowledge Base

**Route**: `/t/[tenantId]/bot/knowledge`

**Tasks:**
- [ ] **Free tier**: FAQ entry count, static match rate, coverage score (static-only). No embedding sync.
- [ ] **Starter+ tier**: FAQ coverage score, freshness badge, retrieval latency, embedding sync status, RAG coverage
- [ ] Category coverage breakdown
- [ ] Product coverage list
- [ ] Quick links to FAQ Hub tabs
- [ ] "Last synced 2 min ago" / "Stale — rebuild needed" badges

### 2.5 Bot Analytics

**Route**: `/t/[tenantId]/bot/analytics`

**Tasks:**
- [ ] Overview tab: conversations, resolution rate, handoff rate, revenue lift
- [ ] Conversations tab: list with duration, intent, resolution
- [ ] Intents tab: pie chart of intent distribution
- [ ] Skills tab: skill usage counts, conversion rates
- [ ] Gaps tab: top unanswered queries, coverage trend
- [ ] Date range selector (7d, 30d, 90d)

### 2.6 Widget Setup

**Route**: `/t/[tenantId]/bot/widget`

**Tasks:**
- [ ] Position selector (bottom-right, bottom-left, top-right, top-left)
- [ ] Appearance: color picker, font selector, avatar upload
- [ ] Behavior: auto-open toggle, delay slider, pre-chat form toggle
- [ ] Embed script display with copy-to-clipboard
- [ ] Dual preview: desktop + mobile mocks, real-time update

### 2.7 Chatbot Options (Capability Page)

**Route**: `/t/[tenantId]/settings/chatbot-options`

**Tasks:**
- [ ] Plan badge at top with upgrade CTA
- [ ] Section groups: Response Engine, Skills, Knowledge Base, Widget
- [ ] Locked options grayed with lock icon
- [ ] Active options checked and editable
- [ ] Uses `useChatbotOptionsCapability` hook — no hard-coded tier checks

### 2.8 Merchant-Facing Support Page Integration

**Tasks:**
- [ ] Bot widget CTA in CRM engagement widget (from CRM design)
- [ ] "Ask our bot" in FAQ sections always visible
- [ ] Bot greeting adapts to context (product page: "Ask me anything about Organic Milk")

**Acceptance Criteria:**
- Merchant can configure bot tone, greeting, widget appearance
- Skills show as locked/unlocked based on tier
- Knowledge Base shows FAQ coverage and freshness (Starter+)
- Analytics show real conversation data
- Widget setup generates embeddable script tag
- Chatbot Options page mirrors capability spec exactly

---

## Phase 3: AI Layer — RAG Pipeline, Shared Dynamic Model, Platform Admin Basics

**Goal**: FAQ RAG retrieval, shared dynamic AI model, intent registry, guardrail rules, knowledge base registry, and tenant assignments are functional. Starter tier gets AI-powered responses.

**Duration**: 2–2.5 weeks

### 3.1 RAG Pipeline (Starter+)

**Tasks:**
- [ ] `BotRagService.ts` — chunks FAQ entries, embeds with OpenAI text-embedding-3-small
- [ ] Per-tenant vector index (pgvector or Pinecone)
- [ ] Top-k retrieval with re-ranking by confidence
- [ ] Auto-rebuild on FAQ mutation webhooks
- [ ] Free tier: no RAG — static lookup only

### 3.2 Shared Dynamic Model (Starter)

**Tasks:**
- [ ] FastAPI instance with ModernBERT-base + shared dynamic response generation
- [ ] Tenant-aware via `tenant_id` in JWT
- [ ] FAQ context injection: retrieved FAQ chunks prepended to prompt
- [ ] Response formatting: conversational, brand-aligned
- [ ] Fallback to static FAQ if RAG confidence < threshold

### 3.3 Guardrail Rules (Platform Admin)

**Route**: `/settings/admin/bot-platform/guardrails`

**Tasks:**
- [ ] Table: rule type, pattern, action, scope (global/tenant), status
- [ ] CRUD for global rules
- [ ] Per-tenant override capability
- [ ] Test runner: input a message, see guardrail actions taken
- [ ] BERT model inference for PII detection and moderation

### 3.4 Intent Registry (Platform Admin)

**Route**: `/settings/admin/bot-platform/intents`

**Tasks:**
- [ ] Taxonomy table: intent name, category, example count, avg confidence, mapped skill
- [ ] Detail panel: description, confidence threshold, training examples, mapped skill version
- [ ] "Retrain Classifier" button triggers ModernBERT retraining
- [ ] Bulk import/export of training examples

### 3.5 Knowledge Base Registry (Platform Admin)

**Route**: `/settings/admin/bot-platform/knowledge`

**Tasks:**
- [ ] Per-tenant FAQ index status: total chunks, index size, last rebuild
- [ ] Coverage score per tenant
- [ ] RAG configuration: chunk size, overlap, top-k, min confidence
- [ ] "Trigger Rebuild" action per tenant
- [ ] Global stats: total FAQ entries, total chunks, avg coverage

### 3.6 Tenant Model Assignments (Platform Admin)

**Route**: `/settings/admin/bot-platform/assignments`

**Tasks:**
- [ ] Assignment table: tenant, tier, assigned model, conversations/mo, auto-scale toggle
- [ ] Capability column: resolved chatbot capability state per tenant
- [ ] Bulk actions: force training, downgrade, export CSV
- [ ] Assignment detail: subscription tier, auto-scale policy toggles, override radio buttons
- [ ] Free tier shown as "Static" badge (widget active, no AI model)

### 3.7 Skill Registry (Platform Admin)

**Route**: `/settings/admin/bot-platform/skills`

**Tasks:**
- [ ] Skill table: name, version, required capabilities, adoption count, status
- [ ] Detail panel: schema, parameters, tier gates, capability gates, featured awareness, tenant status gates, backing MV/endpoint, refresh policies
- [ ] Register new skill dialog: OpenAPI-like schema, capability gates, featured toggles, tenant-status gates, MV selector, refresh cadence
- [ ] Featured-aware, capability-aware, tenant-status-aware skill configuration

**Acceptance Criteria:**
- Starter tier gets AI-powered responses via shared dynamic model + FAQ RAG
- Guardrails and intent classification are visible and configurable by platform admin
- FAQ embedding index auto-rebuilds on FAQ changes
- Tenant assignments show correct model tier and capability state
- Skills can be registered with full gate configuration

---

## Phase 4: Advanced AI — LoRA, Dedicated Models, Auto-Scaling, Deployment Monitor

**Goal**: Pro and Enterprise tiers get LoRA fine-tuned and dedicated models. Auto-scaling policies train and provision models automatically. Platform admin has full deployment monitoring.

**Duration**: 2–2.5 weeks

### 4.1 LoRA Fine-Tuning (Pro)

**Tasks:**
- [ ] `BotTrainingService.ts` — queues LoRA training jobs
- [ ] Training data: merchant's FAQ entries + conversation history + skill interactions
- [ ] Celery/RQ worker or Kubernetes Job for training run
- [ ] Progress tracking: dashboard banner shows "LoRA training in progress — 75% complete"
- [ ] Model adapter deployment: dynamic LoRA adapter swapping per request
- [ ] Training complete toast: "New LoRA model deployed. Responses are now fine-tuned."

### 4.2 Dedicated Models (Enterprise)

**Tasks:**
- [ ] Separate FastAPI instances with warm-loaded full models
- [ ] Tenant-specific DNS or path prefix routing
- [ ] Provisioning triggered at volume threshold (10K conversations/30d)
- [ ] GPU allocation and capacity management
- [ ] Failover to shared model if dedicated instance unhealthy

### 4.3 Auto-Scaling Policy

**Route**: `/settings/admin/bot-platform/auto-scale`

**Tasks:**
- [ ] Threshold configuration: Starter → Shared (500 convos), Shared → LoRA (2K), LoRA → Dedicated (10K)
- [ ] Toggles: auto-queue LoRA, auto-provision dedicated, require admin approval
- [ ] Tenant volume tracking (rolling 30-day window)
- [ ] Alert banners: "3 tenants approaching LoRA threshold"
- [ ] Policy override per tenant

### 4.4 Model Registry (Platform Admin)

**Route**: `/settings/admin/bot-platform/models`

**Tasks:**
- [ ] Table: model name, type (base/LoRA/dedicated), status, serving endpoint, GPU allocation
- [ ] Detail panel: base model version, training data summary, accuracy metrics
- [ ] Actions: deploy, pause, deprecate
- [ ] Dedicated model provisioning workflow

### 4.5 Training Queue (Platform Admin)

**Route**: `/settings/admin/bot-platform/training`

**Tasks:**
- [ ] Queue table: job ID, tenant, model type, status (queued/running/complete/failed), progress
- [ ] Real-time progress bars with 10s refresh
- [ ] Log stream in detail panel
- [ ] Retry and investigate actions for failed jobs
- [ ] Bulk actions: cancel queued, retry failed

### 4.6 Deployment Monitor (Platform Admin)

**Route**: `/settings/admin/bot-platform/deployments`

**Tasks:**
- [ ] Real-time serving status: health, latency (p50/p95/p99), error rate, GPU utilization
- [ ] Per-model-instance metrics
- [ ] Alert: "gpu-04 at 96% — new dedicated model provisioning blocked"
- [ ] Auto-failover status: replica count, failover events
- [ ] Historical metrics: 24h, 7d, 30d charts

### 4.7 Bot Platform Dashboard

**Route**: `/settings/admin/bot-platform`

**Tasks:**
- [ ] Stats row: conversations/day, active models, training queue depth, skill usage
- [ ] Model tier distribution donut chart (Static | Shared | LoRA | Dedicated)
- [ ] Training queue status (progress bars)
- [ ] Alerts: tenants approaching thresholds
- [ ] Top intents (global, 24h)

### 4.8 Final Integration & Polish

**Tasks:**
- [ ] Chatbot → CRM integration: bot conversations create CRM activities, escalations create tickets
- [ ] Email notifications: new ticket from bot, task assignment, overdue tasks
- [ ] In-app notification bell for platform users
- [ ] Keyboard shortcuts for merchant dashboard
- [ ] Mobile widget responsiveness
- [ ] Performance audit: widget bundle size, API latency, cache hit rates
- [ ] E2E tests:
  - Free tier: widget → static FAQ response → gap report
  - Starter: widget → RAG retrieval → shared dynamic response → verify coverage
  - Pro: volume threshold crossed → LoRA training queued → model deployed → fine-tuned response
  - Enterprise: dedicated model provisioned → sub-second latency

**Acceptance Criteria:**
- Pro tier gets LoRA fine-tuned model after volume threshold
- Enterprise tier gets dedicated model instance
- Auto-scaling trains and provisions models without manual intervention (unless approval required)
- Deployment monitor shows real-time GPU, latency, and error rates
- Training queue is visible and actionable
- Model registry tracks all deployed models
- Full E2E tests pass in CI for all tiers

---

## Cross-Phase Dependencies

| Dependency | Source Phase | Consumer Phase |
|---|---|---|
| Prisma schema (all tables) | Phase 1 | All subsequent phases |
| `BotConfigurationService` | Phase 1 | Phase 2 (merchant config), Phase 3 (admin overrides) |
| `BotConversationService` | Phase 1 | Phase 2 (analytics), Phase 3 (RAG context), Phase 4 (training data) |
| `BotStaticResponseService` | Phase 1 | Phase 2 (Free tier), Phase 3 (fallback) |
| `BotGuardrailService` + `BotIntentService` | Phase 1 | All phases (universal pipeline) |
| FAQ RAG pipeline | Phase 3 | Phase 4 (LoRA training data) |
| Shared dynamic model | Phase 3 | Phase 4 (fallback for dedicated) |
| Tenant assignments | Phase 3 | Phase 4 (auto-scaling) |
| Skill registry | Phase 3 | Phase 4 (adoption metrics) |

---

## Testing Strategy

| Phase | Test Coverage |
|---|---|
| Phase 1 | Unit tests for all 6 services; widget renders on storefront; Free tier static responses work |
| Phase 2 | E2E for merchant dashboard, config, skills, KB, analytics, widget setup, options page |
| Phase 3 | E2E for RAG retrieval, shared model responses, guardrail test runner, intent registry, tenant assignments |
| Phase 4 | E2E for LoRA training flow, dedicated provisioning, auto-scaling triggers, deployment monitor metrics |

---

## Rollback Plan

Each phase is additive. If a phase needs rollback:

- **Phase 4**: Disable LoRA training and dedicated provisioning. Revert to shared dynamic model. Platform admin tools remain.
- **Phase 3**: Disable RAG and shared dynamic model. Revert all tiers to static FAQ responses. Merchant dashboard shows "AI unavailable". Core widget and config remain.
- **Phase 2**: Hide Bot section from merchant sidebar. Widget remains (Phase 1) with static responses only.
- **Phase 1**: Remove widget script from storefront. Revert Prisma migration. Bot disappears.

---

## Files Created / Modified Summary

### New Files (by Phase)

**Phase 1:**
- `apps/api/prisma/migrations/..._bot_tables/migration.sql`
- `apps/api/src/services/BotConfigurationService.ts`
- `apps/api/src/services/BotConversationService.ts`
- `apps/api/src/services/BotStaticResponseService.ts`
- `apps/api/src/services/BotGuardrailService.ts`
- `apps/api/src/services/BotIntentService.ts`
- `apps/api/src/services/BotSkillService.ts`
- `apps/api/src/services/ChatbotOptionsService.ts`
- `apps/web/src/services/ChatbotCapabilityResolutionService.ts`
- `apps/web/src/hooks/tenant-access/useChatbotCapability.ts`
- `apps/widget/` or `apps/web/public/bot-widget/widget.js` — shadow DOM widget bundle
- `apps/web/src/components/bot/BotTenantWidget.tsx` — merchant dashboard panel

**Phase 2:**
- `apps/api/src/routes/bot.ts` (aggregator)
- `apps/api/src/routes/bot-public.ts` (public widget routes)
- `apps/api/src/routes/bot-merchant.ts` (merchant config routes)
- `apps/web/src/app/t/[tenantId]/bot/page.tsx` — Bot Dashboard
- `apps/web/src/app/t/[tenantId]/bot/config/page.tsx` — Bot Configuration
- `apps/web/src/app/t/[tenantId]/bot/skills/page.tsx` — Bot Skills
- `apps/web/src/app/t/[tenantId]/bot/knowledge/page.tsx` — Bot Knowledge Base
- `apps/web/src/app/t/[tenantId]/bot/analytics/page.tsx` — Bot Analytics
- `apps/web/src/app/t/[tenantId]/bot/widget/page.tsx` — Widget Setup
- `apps/web/src/app/t/[tenantId]/settings/chatbot-options/page.tsx` — Chatbot Options

**Phase 3:**
- `apps/api/src/services/BotRagService.ts`
- `apps/api/src/services/BotDynamicModelService.ts`
- `apps/api/src/routes/bot-platform.ts` (admin aggregator)
- `apps/api/src/routes/bot-platform-guardrails.ts`
- `apps/api/src/routes/bot-platform-intents.ts`
- `apps/api/src/routes/bot-platform-knowledge.ts`
- `apps/api/src/routes/bot-platform-assignments.ts`
- `apps/api/src/routes/bot-platform-skills.ts`
- `apps/web/src/app/settings/admin/bot-platform/page.tsx` — Bot Platform Dashboard
- `apps/web/src/app/settings/admin/bot-platform/guardrails/page.tsx`
- `apps/web/src/app/settings/admin/bot-platform/intents/page.tsx`
- `apps/web/src/app/settings/admin/bot-platform/knowledge/page.tsx`
- `apps/web/src/app/settings/admin/bot-platform/assignments/page.tsx`
- `apps/web/src/app/settings/admin/bot-platform/skills/page.tsx`

**Phase 4:**
- `apps/api/src/services/BotTrainingService.ts`
- `apps/api/src/services/BotDeploymentService.ts`
- `apps/api/src/services/BotAutoScaleService.ts`
- `apps/api/src/routes/bot-platform-models.ts`
- `apps/api/src/routes/bot-platform-training.ts`
- `apps/api/src/routes/bot-platform-deployments.ts`
- `apps/web/src/app/settings/admin/bot-platform/models/page.tsx`
- `apps/web/src/app/settings/admin/bot-platform/training/page.tsx`
- `apps/web/src/app/settings/admin/bot-platform/deployments/page.tsx`
- `apps/web/src/app/settings/admin/bot-platform/auto-scale/page.tsx`

### Modified Files (all phases)

- `apps/api/src/config/role-groups.ts` — add bot platform permissions
- `apps/web/src/config/rbac.ts` — add bot platform permissions
- `apps/api/src/routes/index.ts` — register bot routes
- `apps/api/src/routes/tenant-capabilities.ts` — add `chatbot_` prefix
- `apps/web/src/services/CapabilityResolutionService.ts` — add `ChatbotOptionsState`
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — add `useChatbotOptionsCapability`
- `apps/web/src/components/layout/DynamicTenantSidebar.tsx` — add "Bot" nav item
- `apps/web/src/components/layout/AdminNavContent.tsx` — add "Bot Platform" nav section
- `apps/web/src/app/t/[tenantId]/page.tsx` — embed BotTenantWidget

---

## Success Criteria (End of Phase 4)

- [ ] Bot widget is live for **all merchants** regardless of tier
- [ ] Free tier gets static FAQ lookup responses (exact match / keyword)
- [ ] Starter tier gets AI-powered responses via shared dynamic model + FAQ RAG
- [ ] Pro tier gets LoRA fine-tuned model after volume threshold
- [ ] Enterprise tier gets dedicated model instance with sub-second latency
- [ ] Universal guardrails + intent classification run for all messages (BERT-powered, free)
- [ ] Merchant can configure widget appearance, tone, greeting, skills
- [ ] Platform admin can manage guardrails, intents, models, training, deployments
- [ ] Auto-scaling trains and provisions models at volume thresholds
- [ ] Skills are featured-aware, capability-aware, and tenant-status-aware
- [ ] E2E tests cover all 4 tiers: Free (static) → Starter (shared) → Pro (LoRA) → Enterprise (dedicated)
