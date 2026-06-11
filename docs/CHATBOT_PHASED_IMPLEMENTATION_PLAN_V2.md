# Chatbot — Improved Phased Implementation Plan (v2)

> Replaces `CHATBOT_PHASED_IMPLEMENTATION_PLAN.md`. Based on gap analysis in `CHATBOT_GAP_ANALYSIS.md`.
>
> Key changes from v1:
> - Split Phase 1 into 3 incremental sub-phases (1A → 1B → 1C)
> - Deferred BERT guardrails/intent to Phase 3 (no model infrastructure in Phase 1)
> - Added missing schema fields, tables, and settings table
> - Added infrastructure prerequisite phase (Phase 0)
> - Fixed route inconsistencies (unified to `/api/public/bot/` pattern)
> - Added cross-cutting concerns (rate limiting, session management, GDPR, observability)
> - Separated AI infrastructure from admin UI in Phase 3
> - Made Phase 4 ML-infra incremental instead of monolithic
> - Added explicit CRM/FAQ/business-hours integration designs

---

## Phase 0: Infrastructure Prerequisites

**Goal**: Provision and configure all infrastructure that later phases depend on.

**Duration**: 1 week (can run in parallel with Phase 1A)

### 0.1 Database Extensions

- [ ] Install `pgvector` extension on staging and production DBs: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Verify extension availability in Prisma (raw query test)
- [ ] Add `vector(1536)` column type support verification

### 0.3 Environment & Secrets

- [ ] Provision OpenAI API key for `text-embedding-3-small` (Phase 3 RAG)
- [ ] Add `OPENAI_API_KEY` to `.env.example` and Vercel environment
- [ ] Add `BOT_API_KEY` (widget authentication) to `.env.example`
- [ ] Document GPU infrastructure requirements for Phase 4 (A100 nodes, Kubernetes)

### 0.4 Observability Foundation

- [ ] Add structured logging helper for bot services (correlation ID per conversation)
- [ ] Add bot-specific log namespace: `logger.child({ module: 'bot' })`
- [ ] Add bot API request metrics middleware (latency, error rate, conversation count)

**Acceptance Criteria:**
- pgvector extension is available and tested
- Environment variables are documented and provisioned
- Logging infrastructure is ready for bot services

---

## Phase 1A: Schema, Capability System, Static Response Engine

**Goal**: Database tables exist, capability resolution works end-to-end, and the static FAQ response engine returns answers via API. No widget, no UI — just backend data layer + API.

**Duration**: 1.5 weeks

### 1A.1 Database Schema (Prisma)

```prisma
model bot_configurations {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id           String   @unique @db.VarChar(255)
  bot_name            String   @default("Store Assistant") @db.VarChar(100)
  tone                String   @default("friendly") @db.VarChar(20)  // friendly, professional, playful
  response_length     String   @default("balanced") @db.VarChar(20)  // concise, balanced, detailed
  fallback_message    String   @default("I'm not sure about that. Let me connect you with support.") @db.Text
  greeting            String   @default("Hi! How can I help you today?") @db.Text
  widget_position     String   @default("bottom-right") @db.VarChar(20)
  widget_color        String   @default("#3b82f6") @db.VarChar(7)
  widget_offset_x     Int      @default(24)
  widget_offset_y     Int      @default(24)
  widget_font         String   @default("system-ui") @db.VarChar(50)
  widget_avatar_url   String?  @db.VarChar(500)
  auto_open           Boolean  @default(false)
  auto_open_delay     Int      @default(0)  // seconds
  after_hours_enabled Boolean  @default(false)
  after_hours_message String?  @db.Text
  business_hours_source String @default("business_profile") @db.VarChar(20) // business_profile, custom, disabled
  pre_chat_enabled    Boolean  @default(false)
  pre_chat_email      Boolean  @default(true)
  pre_chat_phone      Boolean  @default(false)
  pre_chat_order      Boolean  @default(false)
  status              String   @default("active") @db.VarChar(20)  // active, paused, disabled
  escalation_enabled  Boolean  @default(false)
  escalation_message  String?  @db.Text  // message shown before handoff
  created_at          DateTime @default(now()) @db.Timestamptz(6)
  updated_at          DateTime @default(now()) @db.Timestamptz(6)

  tenants             tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
}

model bot_conversations {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  session_id      String   @db.VarChar(255)
  customer_email  String?  @db.VarChar(255)
  customer_phone  String?  @db.VarChar(50)
  source          String   @default("widget") @db.VarChar(20)  // widget, web, api
  status          String   @default("active") @db.VarChar(20)  // active, closed, archived
  resolved_by     String?  @db.VarChar(20)  // faq, skill, human, fallback, abandoned
  page_context    String?  @db.VarChar(100)  // product:slug, category:slug, storefront, general
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)
  closed_at       DateTime? @db.Timestamptz(6)

  messages        bot_messages[]
  feedback        bot_conversation_feedback[]
  tenants         tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, created_at])
  @@index([session_id])
  @@index([status])
  @@index([tenant_id, status])
}

model bot_messages {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  conversation_id String   @db.Uuid
  role            String   @db.VarChar(20)  // user, assistant, system
  content         String   @db.Text
  intent          String?  @db.VarChar(50)
  confidence      Float?
  matched_faq_id  String?  @db.Uuid
  response_type   String   @default("static") @db.VarChar(20)  // static, dynamic, skill, fallback, handoff
  guardrail_result String? @db.VarChar(20)  // pass, blocked, masked, flagged
  skill_name      String?  @db.VarChar(50)
  metadata        Json?    // skill card data, FAQ source, etc.
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  conversation    bot_conversations @relation(fields: [conversation_id], references: [id], onDelete: Cascade)

  @@index([conversation_id, created_at])
}

model bot_conversation_feedback {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  message_id      String   @db.Uuid
  conversation_id String   @db.Uuid
  rating          String   @db.VarChar(10)  // positive, negative
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  conversation    bot_conversations @relation(fields: [conversation_id], references: [id], onDelete: Cascade)

  @@index([message_id])
  @@index([conversation_id])
}

model bot_guardrail_rules {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String?  @db.VarChar(255)  // null = global rule
  rule_type       String   @db.VarChar(50)  // banned_phrase, pii_detection, moderation, competitor
  pattern         String   @db.VarChar(500)  // regex or keyword list
  action          String   @default("block") @db.VarChar(20)  // block, flag, mask, replace
  replacement     String?  @db.VarChar(255)
  response_template String? @db.Text  // message shown when rule triggers
  severity        String   @default("medium") @db.VarChar(20)  // low, medium, high, critical
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, is_active])
  @@index([rule_type])
}

model bot_intents {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name            String   @unique @db.VarChar(50)
  category        String   @db.VarChar(50)
  description     String?  @db.Text
  examples        String[] @db.VarChar(255)
  confidence_threshold Float @default(0.85)
  mapped_skill    String?  @db.VarChar(50)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  @@index([category])
}

model bot_skills {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name                  String   @unique @db.VarChar(50)
  version               String   @default("1.0.0") @db.VarChar(10)
  description           String?  @db.Text
  endpoint              String   @db.VarChar(255)
  required_capabilities String[] @db.VarChar(50)
  tier_gates            String[] @db.VarChar(20)  // Free, Starter, Pro, Enterprise
  capability_gates      String[] @db.VarChar(50)
  tenant_status_gates   String[] @db.VarChar(20)
  featured_aware        Boolean  @default(false)
  refresh_cadence_minutes Int    @default(15)
  status                String   @default("active") @db.VarChar(20)  // active, beta, deprecated
  skill_card_schema     Json?    // JSON schema for skill card rendering in widget
  default_config        Json?    // default per-tenant config overrides
  created_at            DateTime @default(now()) @db.Timestamptz(6)
  updated_at            DateTime @default(now()) @db.Timestamptz(6)
}

model bot_skill_configurations {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  skill_id        String   @db.Uuid
  enabled         Boolean  @default(false)
  config          Json?    // per-tenant config overrides (max_results, fuzzy_matching, etc.)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  skill           bot_skills @relation(fields: [skill_id], references: [id], onDelete: Cascade)

  @@unique([tenant_id, skill_id])
  @@index([tenant_id])
}

model tenant_chatbot_options_settings {
  id                          String    @id @db.VarChar(255)
  tenant_id                   String    @unique @db.VarChar(255)
  chatbot_enabled             Boolean?  @default(true)
  chatbot_static_enabled      Boolean?  @default(true)
  chatbot_dynamic_enabled     Boolean?  @default(false)
  chatbot_skills_enabled      Boolean?  @default(false)
  chatbot_kb_enabled          Boolean?  @default(false)
  chatbot_widget_enabled      Boolean?  @default(true)
  chatbot_widget_custom_theme Boolean?  @default(false)
  chatbot_widget_skill_cards  Boolean?  @default(false)
  chatbot_widget_after_hours  Boolean?  @default(false)
  created_at                  DateTime? @default(now()) @db.Timestamp(6)
  updated_at                  DateTime? @default(now()) @db.Timestamp(6)

  tenants                     tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@index([tenant_id])
}
```

**Tasks:**
- [ ] Write Prisma migration for all 10 tables
- [ ] Run migration against staging DB
- [ ] Verify indexes
- [ ] Seed global guardrail rules (banned phrases, PII patterns, moderation keywords) — **rule-based only, no BERT**
- [ ] Seed bot intents (product.search, inventory.check, order.status, store.hours, general.inquiry) — **keyword-based examples only**
- [ ] Seed bot skills registry (product-search, inventory, order-tracking, store-hours) with tier gates and capability gates
- [ ] Add `tenant_chatbot_options_settings` relation to `tenants` model
- [ ] Add `bot_configurations`, `bot_conversations` relations to `tenants` model

### 1A.2 Chatbot Capability System

Following the exact pattern of `FeaturedOptionsService`, `QuickstartOptionsService`, `CrmOptionsService`.

- [ ] Create `apps/api/src/services/ChatbotOptionsService.ts` — resolves `ChatbotOptionsState` from `tier_features_list`
- [ ] Create `apps/web/src/services/ChatbotCapabilityResolutionService.ts` — frontend resolution
- [ ] Create `apps/web/src/hooks/tenant-access/useChatbotCapability.ts` — React hook
- [ ] Update `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — add `useChatbotOptionsCapability`
- [ ] Update `apps/web/src/services/CapabilityResolutionService.ts` — add `ChatbotOptionsState`, `resolveChatbotOptionsState`, `getChatbotOptionsState`
- [ ] Create `apps/api/src/routes/chatbot-options-settings.ts` — GET/PUT merchant preference toggles (same pattern as `faq-options-settings.ts`, `crm-options-settings.ts`)

### 1A.3 Backend Services (Static Engine Only)

| Service | Responsibility |
|---|---|
| `BotConfigurationService` | CRUD for bot config |
| `BotConversationService` | Create/read/close conversations, append messages, session management |
| `BotStaticResponseService` | Free tier: exact-match / keyword lookup against FAQ table. No AI. |
| `BotGuardrailService` | **Rule-based only** (Phase 1A): regex/keyword matching against `bot_guardrail_rules`. BERT upgrade in Phase 3. |
| `BotIntentService` | **Keyword-based only** (Phase 1A): match user input against `bot_intents.examples`. BERT upgrade in Phase 3. |
| `BotSkillService` | Execute skills against public API endpoints with capability/tier/status gating. Reads from `bot_skills` + `bot_skill_configurations`. |

**Tasks:**
- [ ] Create `apps/api/src/services/BotConfigurationService.ts`
- [ ] Create `apps/api/src/services/BotConversationService.ts` — includes session creation, expiry (24h default), conversation archival
- [ ] Create `apps/api/src/services/BotStaticResponseService.ts` — queries FAQ table directly (exact match then keyword fallback)
- [ ] Create `apps/api/src/services/BotGuardrailService.ts` — rule-based: regex matching, keyword matching, action execution (block/flag/mask/replace)
- [ ] Create `apps/api/src/services/BotIntentService.ts` — keyword matching against intent examples, confidence scoring via Jaccard similarity
- [ ] Create `apps/api/src/services/BotSkillService.ts` — skill execution with tier/capability/status gating
- [ ] Write unit tests for all services

### 1A.4 Public API Routes

Unified route pattern: `/api/public/bot/*`

```
POST   /api/public/bot/conversations              — Start conversation (returns session_id)
POST   /api/public/bot/conversations/:sessionId/messages — Send message
GET    /api/public/bot/config?tenantId=            — Fetch widget config
GET    /api/public/bot/skills/:skillName            — Execute skill (public, MV-backed)
POST   /api/public/bot/conversations/:sessionId/feedback — Submit thumbs up/down
```

**Request/Response Contract:**

```ts
// POST /api/public/bot/conversations
Request:  { tenantId: string, customerEmail?: string, customerPhone?: string, pageContext?: string }
Response: { sessionId: string, greeting: string }

// POST /api/public/bot/conversations/:sessionId/messages
Request:  { message: string }
Response: { reply: string, responseType: "static"|"fallback"|"skill", matchedFaqId?: string, skillCard?: object, guardrailResult?: "pass"|"blocked"|"masked" }

// GET /api/public/bot/config?tenantId=
Response: { botName, greeting, widgetPosition, widgetColor, widgetOffsetX, widgetOffsetY, widgetFont, widgetAvatarUrl, afterHoursEnabled, afterHoursMessage, preChatEnabled, preChatEmail, preChatPhone, preChatOrder, status }
```

**Tasks:**
- [ ] Create `apps/api/src/routes/bot-public.ts` — all public routes above
- [ ] Rate limiting: 60 requests/minute per session, 100 conversations/day per tenant
- [ ] Input validation: message max 1000 chars, sanitize HTML
- [ ] Session validation: reject messages for expired/closed sessions
- [ ] Register routes in `apps/api/src/routes/index.ts`

### 1A.5 Merchant Bot API Routes

```
GET    /api/tenants/:tenantId/bot/config           — Get bot configuration
PUT    /api/tenants/:tenantId/bot/config           — Update bot configuration
GET    /api/tenants/:tenantId/bot/conversations    — List conversations (paginated)
GET    /api/tenants/:tenantId/bot/conversations/:id — Get conversation with messages
GET    /api/tenants/:tenantId/bot/skills            — List skills with tenant config
PUT    /api/tenants/:tenantId/bot/skills/:skillId   — Update skill config (enable/disable, overrides)
GET    /api/tenants/:tenantId/bot/dashboard         — Dashboard stats
GET    /api/tenants/:tenantId/bot/analytics         — Analytics data
GET    /api/tenants/:tenantId/bot/widget            — Widget setup config
PUT    /api/tenants/:tenantId/bot/widget            — Update widget setup
GET    /api/tenants/:tenantId/bot/model             — Model status (Phase 1A: always "static")
GET    /api/tenants/:tenantId/chatbot-options        — Chatbot options (capability-gated)
PUT    /api/tenants/:tenantId/chatbot-options        — Update chatbot options
```

**Tasks:**
- [ ] Create `apps/api/src/routes/bot-merchant.ts` — all merchant routes above
- [ ] Create `apps/api/src/routes/bot.ts` — route aggregator
- [ ] Register routes in `apps/api/src/routes/index.ts`

**Acceptance Criteria:**
- All 10 tables exist in staging DB with correct indexes
- `ChatbotOptionsService` resolves capability state correctly for all tiers
- Static FAQ response engine returns answers via public API
- Rule-based guardrails block/flag/mask messages matching patterns
- Keyword-based intent classification assigns intents with confidence scores
- Skill execution gates by tier, capability, and tenant status
- Rate limiting protects public API
- Sessions expire after 24h

---

## Phase 1B: Universal Bot Widget

**Goal**: The bot widget is live for all merchants. Free tier gets static FAQ responses. Widget is shadow-DOM isolated, themeable, and functional.

**Duration**: 1.5–2 weeks

### 1B.1 Widget Bundle

**Location**: `apps/web/public/bot-widget/` (served as static assets)

**Build**: Vite library mode → single `widget.js` + `widget.css` (injected into shadow DOM)

**Bundle size budget**: < 50KB gzipped

**Tasks:**
- [ ] Create `apps/web/public/bot-widget/` directory with Vite config
- [ ] Shadow DOM isolation (`closed` shadow root)
- [ ] Configurable via `data-tenant-id` + `data-theme` attributes on `<script>` tag
- [ ] Collapsed state (floating pill with merchant color)
- [ ] Expanded state (chat panel with message bubbles)
- [ ] Pre-chat form (email/phone/order — conditional based on config)
- [ ] Message threading with user/assistant bubbles
- [ ] Typing indicator (3-dot animation, 1.5s display)
- [ ] After-hours offline message + leave-a-note input
- [ ] Skill cards rendering (JSON schema-driven from `skill_card_schema` field)
- [ ] Thumbs up/down feedback buttons on assistant messages
- [ ] Auto-refresh conversation every 60s (long-poll or polling)
- [ ] Conversation resume: store `sessionId` in `localStorage`, resume on page reload
- [ ] Offline state: queue messages in memory, retry on reconnect
- [ ] Mobile responsive (full-width on mobile, fixed panel on desktop)
- [ ] WCAG 2.1 AA compliance: keyboard navigation, screen reader labels, focus management
- [ ] Widget authentication: `data-tenant-id` + HMAC-signed timestamp (prevent spoofing)
- [ ] Context injection: read `data-page-context` attribute for context-aware greetings
- [ ] Free tier upgrade nudge: after 2 unanswered queries, show "Want smarter answers? Upgrade to Starter."

### 1B.2 Widget Embed Script

```html
<script src="https://cdn.visibleshelf.com/bot/v1/widget.js"
        data-tenant-id="tid-abc123"
        data-page-context="product:organic-milk"
        data-theme="auto"></script>
```

**Tasks:**
- [ ] CDN deployment config (Vercel edge or CloudFront)
- [ ] Script loader: injects shadow DOM container, fetches config, renders widget
- [ ] Cache config response for 15 minutes (matching `PublicBotService` TTL)

### 1B.3 PublicBotService (Frontend)

```ts
// apps/web/src/services/bot/PublicBotService.ts
class PublicBotService extends PublicApiSingleton {
  async getBotConfig(tenantId: string): Promise<PublicBotConfig>
  async startConversation(tenantId: string, data: StartConversationInput): Promise<ConversationStart>
  async sendMessage(sessionId: string, message: string): Promise<BotResponse>
  async submitFeedback(sessionId: string, messageId: string, rating: "positive"|"negative"): Promise<void>
}
```

**Tasks:**
- [ ] Create `apps/web/src/services/bot/PublicBotService.ts`
- [ ] Create `apps/web/src/services/bot/BotService.ts` (merchant hub, extends `TenantApiSingleton`)
- [ ] Create `apps/web/src/services/bot/types.ts` (shared type definitions)

### 1B.4 Merchant Dashboard Widget Panel

- [ ] `BotTenantWidget.tsx` on merchant dashboard (`/t/[tenantId]/`)
- [ ] Shows: "Bot Active — Static Mode" (Free) or "Bot Active — AI Powered" (Starter+)
- [ ] Quick stats: conversations today, FAQ match rate, upgrade CTA
- [ ] Deep-link to Bot Dashboard

**Acceptance Criteria:**
- Bot widget renders on every merchant's storefront and product pages
- Free tier bot responds with static FAQ lookup (exact match / keyword)
- All messages pass rule-based guardrails + keyword intent classification
- Widget is shadow-DOM isolated — no CSS leakage
- Widget is mobile responsive
- Widget handles offline state gracefully
- Session persists across page reloads
- Bundle size < 50KB gzipped

---

## Phase 1C: Merchant Bot Dashboard & Configuration

**Goal**: Merchant-facing Bot Dashboard, Configuration, Skills, and Chatbot Options pages are functional. Merchants can configure their bot and view analytics.

**Duration**: 1.5–2 weeks

### 1C.1 Navigation

- [ ] Add "Bot" nav item to `DynamicTenantSidebar.tsx` (under tenant section)
- [ ] Add "Bot" icon to sidebar with badge showing bot status (active/paused)

### 1C.2 Merchant Bot Dashboard

**Route**: `/t/[tenantId]/bot`

- [ ] **Free tier**: "Static Mode" dashboard — widget conversations count, static FAQ response rate, top unmatched questions, gap report link, upgrade CTA
- [ ] **Starter+ tier**: "AI Powered" dashboard — conversations, resolution rate, top intents, model tier badge, FAQ coverage score, revenue lift estimate
- [ ] Stats cards: Conversations (30d), Avg Duration, Handoff Rate, FAQ Coverage
- [ ] Top Intents This Week chart
- [ ] Model Tier Card (Phase 1C: always shows "Static Mode" or "AI Ready — Upgrade to Activate")
- [ ] Action buttons: Edit Configuration, Manage Skills, View Analytics, Preview Widget

### 1C.3 Bot Configuration

**Route**: `/t/[tenantId]/bot/config`

- [ ] **General tab**: Bot name, tone selector, response length, greeting text, pre-chat toggles (email/phone/order), after-hours toggle + message
- [ ] **Guardrails tab**: View rule-based rules (read-only for merchant). Shows "Safety rules are managed by the platform."
- [ ] **Intents tab**: View intent list (read-only). Shows "Intent classification is universal."
- [ ] **Model tab**: View current model tier. Phase 1C: shows "Static Mode (Free)" or "AI Ready — Upgrade to Starter" for all tiers. Phase 3 will add real model status.
- [ ] **Fallback tab**: Fallback message, escalation toggle, escalation message
- [ ] All tabs respect capability gates

### 1C.4 Bot Skills

**Route**: `/t/[tenantId]/bot/skills`

- [ ] Skill table: name, description, status toggle, required tier
- [ ] Above-tier skills locked with tooltip: "Upgrade to Pro to enable Order Tracking"
- [ ] Inline configuration panel per skill (reads/writes `bot_skill_configurations`)
- [ ] Data freshness indicator per skill ("Last updated 5 min ago")

### 1C.5 Bot Knowledge Base

**Route**: `/t/[tenantId]/bot/knowledge`

- [ ] **Free tier**: FAQ entry count, static match rate, coverage score (static-only). No embedding sync.
- [ ] **Starter+ tier**: FAQ coverage score, freshness badge, embedding sync status (Phase 3 will add real sync)
- [ ] Category coverage breakdown
- [ ] Product coverage list with "+ Add FAQ" links
- [ ] Quick links to FAQ Hub tabs
- [ ] Gap report: top unmatched queries with "Create FAQ" action

### 1C.6 Bot Analytics

**Route**: `/t/[tenantId]/bot/analytics`

- [ ] Overview tab: conversations, resolution rate, handoff rate
- [ ] Conversations tab: list with duration, intent, resolution, transcript view
- [ ] Intents tab: distribution chart
- [ ] Skills tab: skill usage counts
- [ ] Gaps tab: top unanswered queries, coverage trend
- [ ] Date range selector (7d, 30d, 90d)
- [ ] Feedback tab: thumbs up/down aggregate per intent/skill

### 1C.7 Widget Setup

**Route**: `/t/[tenantId]/bot/widget`

- [ ] Position selector + offset controls
- [ ] Appearance: color picker, font selector, avatar upload
- [ ] Behavior: auto-open toggle, delay slider, pre-chat form toggle
- [ ] Embed script display with copy-to-clipboard
- [ ] Dual preview: desktop + mobile mocks, real-time update

### 1C.8 Chatbot Options (Capability Page)

**Route**: `/t/[tenantId]/settings/chatbot-options`

- [ ] Plan badge at top with upgrade CTA
- [ ] Section groups: Response Engine, Skills, Knowledge Base, Widget
- [ ] Locked options grayed with lock icon
- [ ] Active options checked and editable
- [ ] Uses `useChatbotOptionsCapability` hook — no hard-coded tier checks

**Acceptance Criteria:**
- Merchant can configure bot name, tone, greeting, widget appearance
- Skills show as locked/unlocked based on tier
- Knowledge Base shows FAQ coverage and gap report
- Analytics show real conversation data from Phase 1A
- Widget setup generates embeddable script tag
- Chatbot Options page mirrors capability spec exactly
- "Bot" nav item appears in tenant sidebar

---

## Phase 2: CRM Integration, Business Hours, Context-Aware Features

**Goal**: Bot conversations integrate with CRM, after-hours mode uses real business hours, and the widget supports context-aware greetings.

**Duration**: 1.5–2 weeks

### 2.1 Bot → CRM Integration

- [ ] `BotCrmIntegrationService.ts` — creates CRM activities for bot conversations, creates tickets for escalations
- [ ] When bot escalates (fallback + escalation_enabled): create CRM ticket with conversation transcript
- [ ] CRM activity log: "Bot conversation resolved (FAQ match)" / "Bot conversation escalated to ticket #123"
- [ ] Bot widget CTA in CRM engagement widget on merchant dashboard
- [ ] "Ask our bot" link in customer support portal

### 2.2 Business Hours Integration

- [ ] `BotBusinessHoursService.ts` — reads from `tenant_business_profiles_list` or custom hours in `bot_configurations`
- [ ] After-hours detection: compare current time against merchant's business hours (timezone-aware)
- [ ] Widget shows offline message during after-hours
- [ ] After-hours leave-a-note creates a conversation with `status: "after_hours"` that gets processed during business hours

### 2.3 Context-Aware Greetings

- [ ] Widget reads `data-page-context` attribute from embed script
- [ ] Context types: `product:{slug}`, `category:{slug}`, `storefront`, `general`
- [ ] Greeting templates: product page → "Ask me anything about {product name}", category → "Looking for {category} products?", storefront → default greeting
- [ ] Product/category name resolved from `data-page-context` + tenant catalog lookup

### 2.4 Conversation Management

- [ ] Conversation retention policy: auto-archive after 90 days, hard delete after 1 year
- [ ] GDPR right-to-erase: `DELETE /api/tenants/:tenantId/bot/conversations/:id` for data deletion requests
- [ ] Session expiry: 24h inactive → auto-close conversation
- [ ] Conversation export: `GET /api/tenants/:tenantId/bot/conversations/export?format=csv`

### 2.5 FAQ ↔ Bot Integration

- [ ] FAQ mutation webhook: when FAQ is created/updated/deleted, trigger bot knowledge base refresh
- [ ] `faq_chatbot_knowledge_base` toggle now gates: (1) Bot Preview tab in FAQ Hub, (2) Gap Report tab, (3) Bot Knowledge Base page visibility
- [ ] Replace client-side `FaqBotPreview.tsx` with server-side `BotStaticResponseService` call for consistent behavior

**Acceptance Criteria:**
- Bot escalations create CRM tickets with conversation context
- After-hours mode uses real business hours from merchant profile
- Widget greeting adapts to page context (product, category, storefront)
- Conversations auto-archive after 90 days
- FAQ changes trigger bot knowledge base refresh
- GDPR data deletion works for bot conversations

---

## Phase 3A: AI Infrastructure — RAG Pipeline, Shared Dynamic Model

**Goal**: FastAPI model serving infrastructure is provisioned. FAQ RAG retrieval works. Starter tier gets AI-powered responses via shared dynamic model.

**Duration**: 2–3 weeks

### 3A.1 FastAPI Model Serving Infrastructure

- [ ] Create `apps/model-server/` directory with FastAPI app
- [ ] Dockerfile for model server (Python 3.11, PyTorch, ModernBERT-base)
- [ ] Health check endpoint: `GET /health`
- [ ] Tenant-aware request handling via `tenant_id` in request header
- [ ] Deploy to staging (single instance, CPU-only for initial testing)
- [ ] Configuration: `MODEL_SERVER_URL` environment variable

### 3A.2 BERT-Powered Guardrails Upgrade

- [ ] Upgrade `BotGuardrailService.ts` to call FastAPI for BERT-based PII detection and content moderation
- [ ] Fallback: if FastAPI is unreachable, fall back to rule-based guardrails (Phase 1A)
- [ ] PII handling: mask PII in message content before storage, log detection event
- [ ] Content moderation: block/flag based on BERT classification score

### 3A.3 BERT-Powered Intent Classification Upgrade

- [ ] Upgrade `BotIntentService.ts` to call FastAPI for BERT-based intent classification
- [ ] Fallback: if FastAPI is unreachable, fall back to keyword-based classification (Phase 1A)
- [ ] Ambiguous intent handling: if top-2 intents are within 0.1 confidence, return both and let skill router decide
- [ ] Intent confidence logging for continuous improvement

### 3A.4 RAG Pipeline (Starter+)

- [ ] `BotRagService.ts` — chunks FAQ entries, embeds with OpenAI `text-embedding-3-small`
- [ ] Per-tenant vector index using pgvector (add `embedding vector(1536)` column to a new `bot_faq_embeddings` table)
- [ ] Top-k retrieval (k=3 default) with re-ranking by confidence
- [ ] Auto-rebuild on FAQ mutation webhooks (from Phase 2.5)
- [ ] Free tier: no RAG — static lookup only

```prisma
model bot_faq_embeddings {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id   String   @db.VarChar(255)
  faq_id      String   @db.Uuid
  chunk_text  String   @db.Text
  embedding   Unsupported("vector(1536)")
  chunk_index Int      // order within FAQ entry
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id])
  @@index([faq_id])
}
```

### 3A.5 Shared Dynamic Model (Starter)

- [ ] FastAPI endpoint: `POST /v1/chat/completions` — ModernBERT-base + shared dynamic response generation
- [ ] Tenant-aware via `tenant_id` in request header
- [ ] FAQ context injection: retrieved FAQ chunks prepended to prompt
- [ ] Response formatting: conversational, brand-aligned (respects `tone` and `response_length` from config)
- [ ] Fallback to static FAQ if RAG confidence < threshold (0.7 default)
- [ ] Conversation context window: last 10 messages for multi-turn coherence

### 3A.6 Message Pipeline Update

Updated pipeline: Guardrails (BERT) → Intent Classification (BERT) → Tier Router → Response Engine

```
Free:       Guardrails → Intent → Static FAQ Lookup → Response
Starter+:   Guardrails → Intent → RAG Retrieval → Dynamic Model → Response
```

- [ ] Update `POST /api/public/bot/conversations/:sessionId/messages` to route by tier
- [ ] Update `BotConversationService` to track `resolved_by` correctly (faq, dynamic, skill, fallback, handoff)
- [ ] Update `response_type` in `bot_messages` to include "dynamic"

**Acceptance Criteria:**
- FastAPI model server is deployed and healthy
- BERT guardrails detect PII and moderate content (with rule-based fallback)
- BERT intent classification assigns intents with higher accuracy than keyword matching
- Starter tier gets AI-powered responses via shared dynamic model + FAQ RAG
- FAQ embedding index auto-rebuilds on FAQ changes
- Free tier still gets static FAQ responses (no regression)
- Multi-turn conversations maintain context (last 10 messages)

---

## Phase 3B: Platform Admin — Guardrails, Intents, Knowledge, Skills, Assignments

**Goal**: Platform admin can manage guardrails, intents, knowledge base, skills, and tenant assignments. This phase is parallelizable with Phase 3A (admin UI can be built while AI infra is being provisioned).

**Duration**: 2–2.5 weeks

### 3B.1 Navigation

- [ ] Add "Bot Platform" nav section to `AdminNavContent.tsx`

### 3B.2 BotPlatformAdminService (Frontend)

- [ ] Create `apps/web/src/services/bot/BotPlatformAdminService.ts` (extends `AdminApiSingleton`, per `CHATBOT_PLATFORM_ADMIN_UIUX.md` pattern)

### 3B.3 Admin API Routes

```
GET    /api/admin/bot-platform/dashboard          — Global stats
GET    /api/admin/bot-platform/guardrails          — List guardrail rules
POST   /api/admin/bot-platform/guardrails          — Create rule
PUT    /api/admin/bot-platform/guardrails/:id       — Update rule
DELETE /api/admin/bot-platform/guardrails/:id       — Delete rule
POST   /api/admin/bot-platform/guardrails/test      — Test runner
GET    /api/admin/bot-platform/intents              — List intents
POST   /api/admin/bot-platform/intents              — Create intent
PUT    /api/admin/bot-platform/intents/:id           — Update intent
POST   /api/admin/bot-platform/intents/:id/retrain   — Retrain classifier
GET    /api/admin/bot-platform/knowledge            — KB registry
POST   /api/admin/bot-platform/knowledge/rebuild/:tenantId — Trigger rebuild
PUT    /api/admin/bot-platform/knowledge/config      — Update RAG config
GET    /api/admin/bot-platform/skills                — List skills
POST   /api/admin/bot-platform/skills                — Register skill
PUT    /api/admin/bot-platform/skills/:id             — Update skill
GET    /api/admin/bot-platform/assignments            — List tenant assignments
PUT    /api/admin/bot-platform/assignments/:tenantId  — Update assignment
POST   /api/admin/bot-platform/assignments/:tenantId/force-training — Force LoRA training
```

- [ ] Create `apps/api/src/routes/bot-platform.ts` — route aggregator
- [ ] Create `apps/api/src/routes/bot-platform-guardrails.ts`
- [ ] Create `apps/api/src/routes/bot-platform-intents.ts`
- [ ] Create `apps/api/src/routes/bot-platform-knowledge.ts`
- [ ] Create `apps/api/src/routes/bot-platform-skills.ts`
- [ ] Create `apps/api/src/routes/bot-platform-assignments.ts`

### 3B.4 Admin Pages

| Route | Purpose |
|---|---|
| `/settings/admin/bot-platform` | Dashboard: global stats, tier distribution, alerts, top intents |
| `/settings/admin/bot-platform/guardrails` | CRUD rules, test runner, tenant scoping |
| `/settings/admin/bot-platform/intents` | Taxonomy, training examples, retrain button |
| `/settings/admin/bot-platform/knowledge` | Per-tenant FAQ indexes, RAG config, rebuild triggers |
| `/settings/admin/bot-platform/skills` | Skill registry, register new skill, gate configuration |
| `/settings/admin/bot-platform/assignments` | Tenant → model tier mapping, auto-scale toggles |

- [ ] Create all 6 admin pages with wireframes from `CHATBOT_PLATFORM_ADMIN_UIUX.md`

### 3B.5 Merchant Dashboard Updates

- [ ] Update Model Tier Card to show real model status (from Phase 3A)
- [ ] Update Bot Knowledge Base to show embedding sync status and RAG coverage
- [ ] Update Bot Configuration Model tab to show shared dynamic model status for Starter+

**Acceptance Criteria:**
- Platform admin can CRUD guardrail rules and test them
- Platform admin can manage intent taxonomy and trigger retraining
- Platform admin can view per-tenant FAQ index status and trigger rebuilds
- Platform admin can register skills with full gate configuration
- Platform admin can view and override tenant model assignments
- "Bot Platform" nav section appears in admin sidebar
- Merchant dashboard shows real model status for Starter+ tiers

---

## Phase 4A: LoRA Fine-Tuning (Pro)

**Goal**: Pro tier gets LoRA fine-tuned model after volume threshold. Training queue is visible and actionable.

**Duration**: 2–3 weeks (includes ML infra setup)

### 4A.1 Training Infrastructure

- [ ] Set up Celery/RQ worker (or Kubernetes Jobs) for LoRA training
- [ ] GPU node provisioning (at least 1x A100 40GB for staging)
- [ ] Training job queue: `bot_training_jobs` table

```prisma
model bot_training_jobs {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  model_type      String   @db.VarChar(20)  // lora, dedicated
  status          String   @default("queued") @db.VarChar(20)  // queued, running, complete, failed, cancelled
  progress        Float    @default(0)  // 0.0 to 1.0
  base_model      String   @default("modernbert-base") @db.VarChar(50)
  adapter_path    String?  @db.VarChar(500)
  dataset_range   String?  @db.VarChar(100)  // "3200-4100 conversations"
  gpu_node        String?  @db.VarChar(50)
  error_message   String?  @db.Text
  started_at      DateTime? @db.Timestamptz(6)
  completed_at    DateTime? @db.Timestamptz(6)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id])
  @@index([status])
}
```

### 4A.2 BotTrainingService

- [ ] Create `apps/api/src/services/BotTrainingService.ts` — queues LoRA training jobs
- [ ] Training data: merchant's FAQ entries + conversation history + skill interactions
- [ ] Progress tracking: worker updates `progress` field every 10%
- [ ] Model adapter deployment: dynamic LoRA adapter swapping per request in FastAPI
- [ ] Training complete notification: create CRM activity, show toast on merchant dashboard

### 4A.3 Training Queue Admin Page

**Route**: `/settings/admin/bot-platform/training`

- [ ] Queue table: job ID, tenant, model type, status, progress bar, ETA
- [ ] Real-time progress with 10s refresh
- [ ] Log stream in detail panel
- [ ] Retry and cancel actions for failed/queued jobs
- [ ] Bulk actions: cancel queued, retry failed

### 4A.4 Model Registry Admin Page

**Route**: `/settings/admin/bot-platform/models`

- [ ] Model table: name, type (base/shared/LoRA/dedicated), status, serving endpoint, GPU
- [ ] Detail panel: base model, training job link, dataset range, accuracy metrics
- [ ] Actions: deploy, pause, deprecate

### 4A.5 Merchant Dashboard Updates

- [ ] Model Tier Card shows LoRA badge for Pro tier
- [ ] Training progress banner: "LoRA training in progress — 75% complete"
- [ ] Training complete toast: "New LoRA model deployed. Responses are now fine-tuned."
- [ ] Bot Configuration Model tab shows LoRA adapter details

**Acceptance Criteria:**
- Pro tier gets LoRA fine-tuned model after volume threshold (2,000 conversations/30d)
- Training queue is visible and actionable in admin UI
- Model registry tracks all deployed models
- Merchant dashboard shows training progress and completion
- LoRA adapter swapping works per request in FastAPI

---

## Phase 4B: Dedicated Models, Auto-Scaling, Deployment Monitor

**Goal**: Enterprise tier gets dedicated model instances. Auto-scaling policies train and provision models. Deployment monitor shows real-time metrics.

**Duration**: 2–3 weeks

### 4B.1 Dedicated Models (Enterprise)

- [ ] Separate FastAPI instances with warm-loaded full models
- [ ] Tenant-specific DNS or path prefix routing
- [ ] Provisioning triggered at volume threshold (10K conversations/30d)
- [ ] GPU allocation and capacity management
- [ ] Failover to shared model if dedicated instance unhealthy

### 4B.2 Auto-Scaling Policy

**Route**: `/settings/admin/bot-platform/auto-scale`

- [ ] `bot_auto_scaling_policies` table (or config in existing table)
- [ ] Threshold configuration: Starter → Shared (500), Shared → LoRA (2K), LoRA → Dedicated (10K)
- [ ] Toggles: auto-queue LoRA, auto-provision dedicated, require admin approval
- [ ] Tenant volume tracking (rolling 30-day window)
- [ ] Alert banners: "3 tenants approaching LoRA threshold"
- [ ] Per-tenant policy override

### 4B.3 Deployment Monitor

**Route**: `/settings/admin/bot-platform/deployments`

- [ ] Real-time serving status: health, latency (p50/p95/p99), error rate, GPU utilization
- [ ] Per-model-instance metrics
- [ ] Alerts: "gpu-04 at 96% — new dedicated model provisioning blocked"
- [ ] Auto-failover status: replica count, failover events
- [ ] Historical metrics: 24h, 7d, 30d charts

### 4B.4 Bot Platform Dashboard

**Route**: `/settings/admin/bot-platform`

- [ ] Stats row: conversations/day, active models, training queue depth, skill usage
- [ ] Model tier distribution donut chart (Static | Shared | LoRA | Dedicated)
- [ ] Training queue status (progress bars)
- [ ] Alerts: tenants approaching thresholds
- [ ] Top intents (global, 24h)

### 4B.5 Final Integration & E2E Tests

- [ ] Chatbot → CRM integration: bot conversations create CRM activities, escalations create tickets
- [ ] Email notifications: new ticket from bot, training complete
- [ ] In-app notification bell for platform users
- [ ] Performance audit: widget bundle size, API latency, cache hit rates
- [ ] E2E tests:
  - Free tier: widget → static FAQ response → gap report
  - Starter: widget → RAG retrieval → shared dynamic response → verify coverage
  - Pro: volume threshold crossed → LoRA training queued → model deployed → fine-tuned response
  - Enterprise: dedicated model provisioned → sub-second latency

**Acceptance Criteria:**
- Enterprise tier gets dedicated model instance with sub-second latency
- Auto-scaling trains and provisions models without manual intervention (unless approval required)
- Deployment monitor shows real-time GPU, latency, and error rates
- Training queue is visible and actionable
- Model registry tracks all deployed models
- Full E2E tests pass in CI for all tiers

---

## Cross-Phase Dependencies

| Dependency | Source Phase | Consumer Phase |
|---|---|---|
| Prisma schema (all tables) | Phase 1A | All subsequent phases |
| `ChatbotOptionsService` | Phase 1A | Phase 1C (options page), Phase 3B (admin assignments) |
| `BotConfigurationService` | Phase 1A | Phase 1B (widget config), Phase 1C (merchant config), Phase 3B (admin overrides) |
| `BotConversationService` | Phase 1A | Phase 1B (widget messaging), Phase 1C (analytics), Phase 2 (CRM), Phase 3A (RAG context), Phase 4A (training data) |
| `BotStaticResponseService` | Phase 1A | Phase 1B (Free tier), Phase 3A (fallback) |
| `BotGuardrailService` + `BotIntentService` (rule-based) | Phase 1A | Phase 1B (widget pipeline), Phase 3A (BERT upgrade) |
| Public API routes | Phase 1A | Phase 1B (widget), Phase 2 (CRM integration) |
| Widget bundle | Phase 1B | Phase 1C (widget setup page), Phase 2 (context-aware greetings) |
| Merchant bot pages | Phase 1C | Phase 3B (model status updates), Phase 4A (training progress) |
| CRM integration | Phase 2 | Phase 4B (final integration) |
| Business hours integration | Phase 2 | Phase 1B (after-hours mode was stubbed) |
| FastAPI model server | Phase 3A | Phase 3B (admin model registry), Phase 4A (LoRA training), Phase 4B (dedicated models) |
| RAG pipeline | Phase 3A | Phase 4A (LoRA training data) |
| BERT guardrails/intent | Phase 3A | Phase 3B (admin intent registry, guardrail test runner) |
| Admin pages | Phase 3B | Phase 4A (training queue, model registry), Phase 4B (auto-scale, deployments) |
| LoRA training infra | Phase 4A | Phase 4B (auto-scaling triggers) |

---

## Phase Duration Summary

| Phase | Scope | Duration | Cumulative |
|---|---|---|---|
| Phase 0 | Infrastructure prerequisites | 1 week | 1 week |
| Phase 1A | Schema + capability + static engine + API | 1.5 weeks | 2.5 weeks |
| Phase 1B | Universal widget | 1.5–2 weeks | 4–4.5 weeks |
| Phase 1C | Merchant dashboard + config + analytics | 1.5–2 weeks | 5.5–6.5 weeks |
| Phase 2 | CRM integration + business hours + context | 1.5–2 weeks | 7–8.5 weeks |
| Phase 3A | AI infra + RAG + shared dynamic model | 2–3 weeks | 9–11.5 weeks |
| Phase 3B | Platform admin UI (parallel with 3A) | 2–2.5 weeks | 9–11.5 weeks (parallel) |
| Phase 4A | LoRA fine-tuning + training queue | 2–3 weeks | 11–14.5 weeks |
| Phase 4B | Dedicated models + auto-scale + monitor | 2–3 weeks | 13–17.5 weeks |

**Total estimated: 13–17.5 weeks** (vs. v1's 8–10 weeks). More realistic given the scope.

Phases 3A and 3B can run in parallel with separate developers, reducing wall-clock time.

---

## Rollback Plan

Each phase is additive. If a phase needs rollback:

- **Phase 4B**: Disable dedicated provisioning and auto-scaling. Revert to LoRA/shared model. Monitor page remains.
- **Phase 4A**: Disable LoRA training. Revert Pro tier to shared dynamic model. Training queue page shows "disabled".
- **Phase 3B**: Hide "Bot Platform" from admin sidebar. Admin routes return 404. Core bot functionality unaffected.
- **Phase 3A**: Disable RAG and dynamic model. Revert Starter+ to static FAQ responses. Merchant dashboard shows "AI unavailable". Widget and config remain.
- **Phase 2**: Disable CRM integration and business hours. After-hours mode reverts to always-online. Widget remains.
- **Phase 1C**: Hide "Bot" from merchant sidebar. Widget remains (Phase 1B) with static responses only.
- **Phase 1B**: Remove widget script from storefront. API routes remain (Phase 1A) but unused.
- **Phase 1A**: Revert Prisma migration. Bot API routes return 404. All bot data removed.
- **Phase 0**: Remove pgvector extension. No bot code depends on it until Phase 3A.

---

## Files Created / Modified Summary

### New Files (by Phase)

**Phase 0:**
- (Infrastructure only — no application files)

**Phase 1A:**
- `apps/api/prisma/migrations/..._bot_tables/migration.sql`
- `apps/api/src/services/BotConfigurationService.ts`
- `apps/api/src/services/BotConversationService.ts`
- `apps/api/src/services/BotStaticResponseService.ts`
- `apps/api/src/services/BotGuardrailService.ts` (rule-based)
- `apps/api/src/services/BotIntentService.ts` (keyword-based)
- `apps/api/src/services/BotSkillService.ts`
- `apps/api/src/services/ChatbotOptionsService.ts`
- `apps/api/src/routes/bot-public.ts`
- `apps/api/src/routes/bot-merchant.ts`
- `apps/api/src/routes/bot.ts` (aggregator)
- `apps/api/src/routes/chatbot-options-settings.ts`
- `apps/web/src/services/ChatbotCapabilityResolutionService.ts`
- `apps/web/src/hooks/tenant-access/useChatbotCapability.ts`
- `apps/web/src/services/bot/types.ts`

**Phase 1B:**
- `apps/web/public/bot-widget/` — vanilla JS widget bundle (Vite project)
- `apps/web/src/services/bot/PublicBotService.ts`
- `apps/web/src/services/bot/BotService.ts`
- `apps/web/src/components/bot/BotTenantWidget.tsx`

**Phase 1C:**
- `apps/web/src/app/t/[tenantId]/bot/page.tsx` — Bot Dashboard
- `apps/web/src/app/t/[tenantId]/bot/config/page.tsx` — Bot Configuration
- `apps/web/src/app/t/[tenantId]/bot/skills/page.tsx` — Bot Skills
- `apps/web/src/app/t/[tenantId]/bot/knowledge/page.tsx` — Bot Knowledge Base
- `apps/web/src/app/t/[tenantId]/bot/analytics/page.tsx` — Bot Analytics
- `apps/web/src/app/t/[tenantId]/bot/widget/page.tsx` — Widget Setup
- `apps/web/src/app/t/[tenantId]/settings/chatbot-options/page.tsx` — Chatbot Options

**Phase 2:**
- `apps/api/src/services/BotCrmIntegrationService.ts`
- `apps/api/src/services/BotBusinessHoursService.ts`
- `apps/api/prisma/migrations/..._bot_faq_embeddings/migration.sql`

**Phase 3A:**
- `apps/model-server/` — FastAPI model serving application
- `apps/api/src/services/BotRagService.ts`
- `apps/api/src/services/BotDynamicModelService.ts`
- `apps/api/prisma/migrations/..._bot_faq_embeddings/migration.sql` (if not Phase 2)

**Phase 3B:**
- `apps/api/src/routes/bot-platform.ts`
- `apps/api/src/routes/bot-platform-guardrails.ts`
- `apps/api/src/routes/bot-platform-intents.ts`
- `apps/api/src/routes/bot-platform-knowledge.ts`
- `apps/api/src/routes/bot-platform-skills.ts`
- `apps/api/src/routes/bot-platform-assignments.ts`
- `apps/web/src/services/bot/BotPlatformAdminService.ts`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/guardrails/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/intents/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/knowledge/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/skills/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/assignments/page.tsx`

**Phase 4A:**
- `apps/api/src/services/BotTrainingService.ts`
- `apps/api/prisma/migrations/..._bot_training_jobs/migration.sql`
- `apps/api/src/routes/bot-platform-training.ts`
- `apps/api/src/routes/bot-platform-models.ts`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/training/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/models/page.tsx`

**Phase 4B:**
- `apps/api/src/services/BotDeploymentService.ts`
- `apps/api/src/services/BotAutoScaleService.ts`
- `apps/api/src/routes/bot-platform-deployments.ts`
- `apps/api/src/routes/bot-platform-auto-scale.ts`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/deployments/page.tsx`
- `apps/web/src/app/(platform)/settings/admin/bot-platform/auto-scale/page.tsx`

### Modified Files (all phases)

- `apps/api/prisma/schema.prisma` — add 10 bot tables + `tenant_chatbot_options_settings` + relations on `tenants`
- `apps/api/src/config/role-groups.ts` — add bot platform permissions
- `apps/web/src/config/rbac.ts` — add bot platform permissions
- `apps/api/src/routes/index.ts` — register bot routes
- `apps/api/src/routes/tenant-capabilities.ts` — `chatbot_` prefix already registered ✅
- `apps/web/src/services/CapabilityResolutionService.ts` — add `ChatbotOptionsState`, `resolveChatbotOptionsState`, `getChatbotOptionsState` (prefix already registered ✅)
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — add `useChatbotOptionsCapability`
- `apps/web/src/components/layout/DynamicTenantSidebar.tsx` — add "Bot" nav item
- `apps/web/src/components/layout/AdminNavContent.tsx` — add "Bot Platform" nav section
- `apps/web/src/app/t/[tenantId]/page.tsx` — embed BotTenantWidget
- `apps/web/src/components/faq/FaqBotPreview.tsx` — migrate to server-side `BotStaticResponseService` call (Phase 2)

---

## Testing Strategy

| Phase | Test Coverage |
|---|---|
| Phase 1A | Unit tests for all 6 services; API route integration tests; capability resolution tests for all tiers |
| Phase 1B | Widget E2E: renders, sends message, receives response, shadow DOM isolation, mobile responsive, offline handling |
| Phase 1C | E2E for merchant dashboard, config, skills, KB, analytics, widget setup, options page |
| Phase 2 | E2E for CRM ticket creation from escalation; after-hours mode; context-aware greeting; GDPR deletion |
| Phase 3A | E2E for RAG retrieval, shared model responses, BERT guardrail/intent; fallback to rule-based when FastAPI down |
| Phase 3B | E2E for admin CRUD on guardrails, intents, knowledge, skills, assignments |
| Phase 4A | E2E for LoRA training flow, training queue, model registry |
| Phase 4B | E2E for dedicated provisioning, auto-scaling triggers, deployment monitor metrics; full 4-tier E2E |

---

## Success Criteria (End of Phase 4B)

- [ ] Bot widget is live for **all merchants** regardless of tier
- [ ] Free tier gets static FAQ lookup responses (exact match / keyword)
- [ ] Starter tier gets AI-powered responses via shared dynamic model + FAQ RAG
- [ ] Pro tier gets LoRA fine-tuned model after volume threshold
- [ ] Enterprise tier gets dedicated model instance with sub-second latency
- [ ] Rule-based guardrails + intent classification run for all messages (Phase 1A), upgraded to BERT (Phase 3A)
- [ ] Merchant can configure bot name, tone, greeting, widget appearance, skills
- [ ] Platform admin can manage guardrails, intents, models, training, deployments
- [ ] Auto-scaling trains and provisions models at volume thresholds
- [ ] Skills are featured-aware, capability-aware, and tenant-status-aware
- [ ] Bot conversations integrate with CRM (escalations create tickets)
- [ ] After-hours mode uses real business hours
- [ ] Context-aware greetings adapt to product/category pages
- [ ] GDPR data deletion works for bot conversations
- [ ] E2E tests cover all 4 tiers: Free (static) → Starter (shared) → Pro (LoRA) → Enterprise (dedicated)
