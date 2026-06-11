# Chatbot Platform — Full-Spectrum Gap Analysis

Audited against: `CHATBOT_PHASED_IMPLEMENTATION_PLAN.md`, `CHATBOT_CAPABILITY_SPEC.md`, `CHATBOT_PLATFORM_ADMIN_UIUX.md`, `CHATBOT_MERCHANT_UIUX.md`, and the live codebase.

---

## 1. Codebase Reality Check

### What Already Exists

| Component | Status | Location |
|---|---|---|
| `chatbot_` prefix in `CAPABILITY_TYPE_PREFIXES` | ✅ Registered | `apps/api/src/routes/tenant-capabilities.ts:32` |
| `chatbot_options` prefix-to-type mapping | ✅ Registered | `apps/web/src/services/CapabilityResolutionService.ts:578` |
| `faq_chatbot_knowledge_base` field | ✅ In schema + routes | `schema.prisma:3436`, `faq-options-settings.ts` |
| `FaqBotPreview.tsx` (client-side static FAQ matcher) | ✅ Exists | `apps/web/src/components/faq/FaqBotPreview.tsx` |
| FAQ Hub "Bot Preview" + "Gap Report" tabs | ✅ Gated by `faq_chatbot_knowledge_base` | `apps/web/src/components/faq/FaqHub.tsx:126-127` |
| CRM system (Phase 1+2 complete) | ✅ Fully implemented | Services, routes, admin/tenant/customer pages |
| Capability resolution pattern (Featured, Quickstart, CRM, FAQ, etc.) | ✅ Established | 7 `*OptionsService.ts` files in `apps/api/src/services/` |

### What Does NOT Exist

| Component | Design Doc Reference | Status |
|---|---|---|
| 6 bot Prisma tables (`bot_configurations`, `bot_conversations`, `bot_messages`, `bot_guardrail_rules`, `bot_intents`, `bot_skills`) | Phase 1 §1.1 | ❌ Not in schema |
| `tenant_chatbot_options_settings` table | Capability Spec | ❌ Not in schema (pattern: `tenant_crm_options_settings`, `tenant_faq_options_settings`) |
| `ChatbotOptionsService.ts` (backend) | Phase 1 §1.2 | ❌ Not created |
| `ChatbotCapabilityResolutionService.ts` (frontend) | Phase 1 §1.2 | ❌ Not created |
| `useChatbotCapability.ts` hook | Phase 1 §1.2 | ❌ Not created |
| All 6 bot backend services | Phase 1 §1.3 | ❌ None created |
| All bot API routes (public, merchant, admin) | Phase 1–4 | ❌ None created |
| All merchant bot pages (`/t/[tenantId]/bot/*`) | Phase 2 | ❌ None created |
| `/t/[tenantId]/settings/chatbot-options` page | Phase 2 §2.7 | ❌ Not created |
| All admin bot-platform pages (`/settings/admin/bot-platform/*`) | Phase 3–4 | ❌ None created |
| `BotService.ts` (merchant frontend service) | Merchant UIUX doc | ❌ Not created |
| `PublicBotService.ts` (customer widget service) | Merchant UIUX doc | ❌ Not created |
| `BotPlatformAdminService.ts` (admin frontend service) | Admin UIUX doc | ❌ Not created |
| Vanilla JS widget bundle | Phase 1 §1.4 | ❌ Not created |
| FastAPI model serving infrastructure | Phase 3 §3.2 | ❌ Not created |
| pgvector extension / vector store | Phase 3 §3.1 | ❌ Not provisioned |
| Sidebar nav items ("Bot", "Bot Platform") | Phase 1–2 modified files | ❌ Not added |
| `DynamicTenantSidebar.tsx` "Bot" nav item | Phase 2 modified files | ❌ Not added |
| `AdminNavContent.tsx` "Bot Platform" nav section | Phase 3 modified files | ❌ Not added |

**Summary: 0% of the chatbot platform is implemented.** The only chatbot-adjacent code is the `faq_chatbot_knowledge_base` toggle (a FAQ options flag) and the client-side `FaqBotPreview.tsx` (a static keyword matcher that doesn't use any bot API).

---

## 2. Phase Structure Gaps

### 2.1 Phase 1 Is Overloaded

Phase 1 packs **6 database tables + 6 backend services + capability system integration + public API routes + vanilla JS widget + merchant dashboard panel** into "1.5–2 weeks". Realistic estimate: **4–5 weeks** for a single developer.

**Problems:**
- The widget cannot function without the public API routes, but both are in the same phase with no internal ordering.
- BERT-powered guardrails and intent classification are listed as Phase 1 services, but no model serving infrastructure exists until Phase 3. Where does BERT run in Phase 1?
- `BotSkillService.ts` is a Phase 1 task, but the skill registry (which defines what skills exist) is Phase 3. The service has nothing to execute against.

### 2.2 Phase 2 Depends on Undeliverable Phase 1 Items

Phase 2's merchant dashboard shows "Model Tier Card (LoRA badge, training status, next threshold)" and "AI Powered" indicators. These require the AI model layer from Phase 3. The dashboard would show empty/placeholder data until Phase 3 ships.

### 2.3 Phase 3 Combines Two Unrelated Concerns

Phase 3 bundles **RAG pipeline + shared dynamic model** (AI infrastructure) with **5 platform admin screens** (guardrails, intents, knowledge, assignments, skills). These are separate workstreams that should be parallelized or sequenced independently.

### 2.4 Phase 4 Is ML-Infrastructure-Heavy

LoRA fine-tuning, dedicated model provisioning, GPU allocation, Kubernetes Jobs, auto-scaling — this requires ML infrastructure that doesn't exist and isn't scoped in any prior phase. The 2–2.5 week estimate is unrealistic.

### 2.5 No Infrastructure Prerequisite Phase

The plan assumes FastAPI, Celery/RQ, Kubernetes, GPU clusters, and pgvector are all available. None of these exist. There is no phase for provisioning or configuring this infrastructure.

---

## 3. Schema Gaps

### 3.1 Missing Fields in `bot_configurations`

The schema in Phase 1 §1.1 is missing fields that the merchant UI wireframes require:

| Missing Field | UI Reference | Type |
|---|---|---|
| `bot_name` | Config → General: "Bot Name" input | `VarChar(100)` |
| `response_length` | Config → General: "Concise / Balanced / Detailed" radio | `VarChar(20)` |
| `pre_chat_email` | Config → General: "Collect email" toggle | `Boolean` |
| `pre_chat_phone` | Config → General: "Collect phone number" toggle | `Boolean` |
| `pre_chat_order` | Config → General: "Ask for order number" toggle | `Boolean` |
| `widget_offset_x` | Widget Setup → Position: "Horizontal offset" | `Int` |
| `widget_offset_y` | Widget Setup → Position: "Vertical offset" | `Int` |
| `widget_font` | Widget Setup → Appearance: "Font selector" | `VarChar(50)` |
| `widget_avatar_url` | Widget Setup → Appearance: "Avatar upload" | `VarChar(500)` |
| `auto_open` | Widget Setup → Behavior: "Auto-open toggle" | `Boolean` |
| `auto_open_delay` | Widget Setup → Behavior: "Delay slider" | `Int` (seconds) |
| `business_hours_source` | After-hours mode needs to know which hours | `VarChar(20)` |

### 3.2 Missing `tenant_chatbot_options_settings` Table

Every capability type (`featured_options`, `quickstart_options`, `faq_options`, `crm_options`) has a corresponding `tenant_*_options_settings` table for merchant preference toggles. The chatbot capability spec describes a merchant options page but no settings table is defined. This breaks the established pattern.

### 3.3 Missing `bot_training_jobs` Table

Phase 4 describes a training queue with job IDs, tenant, model type, status, progress, GPU allocation, etc. No schema is defined for this. The `BotTrainingService.ts` has no table to write to.

### 3.4 Missing `bot_model_assignments` Table

Phase 3 §3.6 and Phase 4 §4.3 describe tenant model assignments with auto-scale toggles, override policies, and volume tracking. No schema is defined.

### 3.5 Missing `bot_deployment_instances` Table

Phase 4 §4.6 describes per-model-instance metrics (health, latency, GPU utilization). No schema is defined.

### 3.6 Missing `bot_auto_scaling_policies` Table

Phase 4 §4.3 and the admin UI doc describe auto-scaling policy configuration. No schema is defined.

### 3.7 Missing `bot_conversation_feedback` Table

The merchant UI wireframe shows thumbs up/down on bot responses. No feedback/rating table is defined.

### 3.8 Missing `bot_skill_configurations` Table

Phase 2 §2.3 describes per-skill inline configuration panels (e.g., "Enable fuzzy matching", "Max results: 5"). No table for per-tenant skill configuration overrides.

---

## 4. Backend Service & Route Gaps

### 4.1 BERT Services Have No Serving Infrastructure

`BotGuardrailService.ts` and `BotIntentService.ts` are Phase 1 services that require BERT model inference. But:
- No FastAPI server is defined until Phase 3.
- No model hosting is defined until Phase 3.
- Phase 1 has no infrastructure to run BERT.

**Resolution needed:** Either (a) defer guardrails/intent to Phase 3 when FastAPI exists, or (b) implement Phase 1 guardrails/intent as rule-based (regex/keyword) and upgrade to BERT in Phase 3.

### 4.2 Skill Service Has No Registry

`BotSkillService.ts` is a Phase 1 service, but `bot_skills` table rows (the skill registry) aren't seeded until Phase 1 task "Seed bot skills registry." The service design assumes skills exist, but skill CRUD and the admin registry UI are Phase 3. This creates a chicken-and-egg problem.

### 4.3 Missing Routes

The phased plan lists route files but doesn't define their endpoints in detail. The UI/UX docs define frontend service methods that imply specific API contracts. Cross-referencing reveals these undocumented routes:

| Route | Source | Not in Phase Plan |
|---|---|---|
| `GET /api/admin/bot-platform/dashboard` | Admin UIUX `getDashboard()` | ❌ Not listed |
| `GET /api/admin/bot-platform/autoscaling` | Admin UIUX `getAutoScalingPolicy()` | ❌ Not listed |
| `PUT /api/admin/bot-platform/autoscaling` | Admin UIUX `updateAutoScalingPolicy()` | ❌ Not listed |
| `POST /api/admin/bot-platform/guardrails` | Admin UIUX `createGuardrailRule()` | ❌ Not listed |
| `PUT /api/admin/bot-platform/intents/:intentId` | Admin UIUX `updateIntent()` | ❌ Not listed |
| `POST /api/admin/bot-platform/training/:jobId/cancel` | Admin UIUX `cancelTrainingJob()` | ❌ Not listed |
| `PUT /api/admin/bot-platform/assignments/:tenantId` | Admin UIUX `updateTenantAssignment()` | ❌ Not listed |
| `POST /api/admin/bot-platform/skills` | Admin UIUX `registerSkill()` | ❌ Not listed |
| `GET /api/tenants/:tenantId/bot/dashboard` | Merchant UIUX `getDashboard()` | ❌ Not listed |
| `PUT /api/tenants/:tenantId/bot/config` | Merchant UIUX `updateConfig()` | ❌ Not listed |
| `PUT /api/tenants/:tenantId/bot/skills/:skillId` | Merchant UIUX `updateSkill()` | ❌ Not listed |
| `GET /api/tenants/:tenantId/bot/analytics` | Merchant UIUX `getAnalytics()` | ❌ Not listed |
| `GET /api/tenants/:tenantId/bot/widget` | Merchant UIUX `getWidgetSetup()` | ❌ Not listed |
| `PUT /api/tenants/:tenantId/bot/widget` | Merchant UIUX `updateWidgetSetup()` | ❌ Not listed |
| `GET /api/tenants/:tenantId/bot/model` | Merchant UIUX `getModelStatus()` | ❌ Not listed |
| `POST /api/public/tenants/:tenantId/bot/chat` | Merchant UIUX `sendMessage()` | ❌ Not listed |

### 4.4 Route Path Inconsistency

The phased plan defines public routes as `/api/public/bot/conversations/:sessionId/messages`, but the merchant UIUX doc's `PublicBotService.ts` sends to `/api/public/tenants/:tenantId/bot/chat`. These are different URL patterns and different request shapes.

---

## 5. Frontend Service Gaps

### 5.1 Missing Frontend Services

| Service | Base Class | Status |
|---|---|---|
| `ChatbotCapabilityResolutionService.ts` | `CustomerApiSingleton` | ❌ Not created |
| `BotService.ts` (merchant) | `TenantApiSingleton` | ❌ Not created |
| `PublicBotService.ts` (customer widget) | `PublicApiSingleton` | ❌ Not created |
| `BotPlatformAdminService.ts` (admin) | `AdminApiSingleton` | ❌ Not created |

### 5.2 Missing Hook

`useChatbotOptionsCapability` is not in `useCapabilityAccess.ts`. The capability spec requires it for the merchant options page.

---

## 6. UI/UX Gaps

### 6.1 Missing Pages (Merchant)

| Route | Purpose | Status |
|---|---|---|
| `/t/[tenantId]/bot` | Bot Dashboard | ❌ |
| `/t/[tenantId]/bot/config` | Bot Configuration | ❌ |
| `/t/[tenantId]/bot/skills` | Bot Skills | ❌ |
| `/t/[tenantId]/bot/knowledge` | Bot Knowledge Base | ❌ |
| `/t/[tenantId]/bot/analytics` | Bot Analytics | ❌ |
| `/t/[tenantId]/bot/widget` | Widget Setup | ❌ |
| `/t/[tenantId]/settings/chatbot-options` | Chatbot Options | ❌ |

### 6.2 Missing Pages (Admin)

| Route | Purpose | Status |
|---|---|---|
| `/settings/admin/bot-platform` | Bot Platform Dashboard | ❌ |
| `/settings/admin/bot-platform/guardrails` | Guardrail Rules | ❌ |
| `/settings/admin/bot-platform/intents` | Intent Registry | ❌ |
| `/settings/admin/bot-platform/knowledge` | Knowledge Base Registry | ❌ |
| `/settings/admin/bot-platform/models` | Model Registry | ❌ |
| `/settings/admin/bot-platform/training` | Training Queue | ❌ |
| `/settings/admin/bot-platform/assignments` | Tenant Assignments | ❌ |
| `/settings/admin/bot-platform/skills` | Skill Registry | ❌ |
| `/settings/admin/bot-platform/deployments` | Deployment Monitor | ❌ |
| `/settings/admin/bot-platform/auto-scale` | Auto-Scaling Policy | ❌ |

### 6.3 Missing Navigation Entries

- `DynamicTenantSidebar.tsx` needs "Bot" nav item under tenant section
- `AdminNavContent.tsx` needs "Bot Platform" nav section under admin settings

---

## 7. Widget Gaps

### 7.1 No Widget Bundle

The vanilla JS shadow-DOM widget is the primary customer-facing interface. It doesn't exist. Key missing details:

| Concern | Status | Notes |
|---|---|---|
| Build tooling (Vite? Rollup? esbuild?) | ❌ Undefined | No `apps/widget/` or `apps/web/public/bot-widget/` directory |
| Bundle size budget | ❌ Undefined | No performance target |
| Authentication model | ❌ Undefined | How does the widget identify the tenant? `data-tenant-id` attribute only? No API key? |
| Session management | ❌ Undefined | How are sessions created, expired, resumed? |
| Offline/disconnected state | ❌ Undefined | What happens when API is unreachable? |
| Accessibility (WCAG) | ❌ Undefined | No a11y requirements specified |
| Multi-language | ❌ Undefined | No i18n strategy for widget |
| Mobile responsiveness | ❌ Mentioned but not specified | Phase 4 "Mobile widget responsiveness" — too late |
| Rate limiting | ❌ Undefined | No protection against widget API abuse |
| Conversation resume | ❌ Undefined | Can users return to a previous conversation? |

### 7.2 Widget ↔ API Contract Undefined

The widget needs to: (1) fetch config, (2) start a session, (3) send messages, (4) receive responses. The API endpoints and response shapes are defined differently in the phased plan vs. the merchant UIUX doc.

---

## 8. AI Infrastructure Gaps

### 8.1 No Model Serving Infrastructure

| Component | Status | Notes |
|---|---|---|
| FastAPI server | ❌ | Not provisioned, no Dockerfile, no deployment config |
| ModernBERT-base model | ❌ | Not downloaded, no model registry |
| GPU infrastructure | ❌ | No GPU nodes provisioned |
| Celery/RQ workers | ❌ | No task queue for training jobs |
| Kubernetes cluster | ❌ | Referenced for training jobs but not provisioned |
| pgvector extension | ❌ | Not installed in database |
| Pinecone account | ❌ | Alternative to pgvector, not provisioned |
| OpenAI API key | ❌ | Needed for text-embedding-3-small, not configured |

### 8.2 BERT in Phase 1 Without Infrastructure

The plan claims BERT-powered guardrails and intent classification in Phase 1, but there is no model serving infrastructure until Phase 3. This is a fundamental sequencing error.

---

## 9. Integration Gaps

### 9.1 CRM Integration

Phase 4 §4.8 mentions "Chatbot → CRM integration: bot conversations create CRM activities, escalations create tickets." But:
- No API contract defined for bot → CRM event flow
- No webhook/event system defined for bot events
- No escalation protocol defined (when does a bot hand off to a human? what data is passed?)
- CRM Phase 5A (from `CRM_ADMIN_ACTIONS_PHASE_PLAN.md`) includes ticket creation from tenant — this could be the escalation target, but no design connects them.

### 9.2 Business Hours Integration

After-hours mode requires knowing the merchant's business hours. The `tenant_business_profiles_list` table exists, but no integration design connects business hours to the bot's after-hours behavior.

### 9.3 FAQ Integration

The bot's knowledge base depends on FAQ data. The FAQ system is fully implemented, but:
- No webhook defined for FAQ mutations to trigger RAG index rebuilds
- No API for the bot to query FAQ data (the `FaqBotPreview.tsx` uses the FAQ service client-side, but the backend `BotStaticResponseService.ts` needs a server-side FAQ query path)
- The `faq_chatbot_knowledge_base` toggle gates the FAQ Hub's Bot Preview tab but doesn't gate any bot API behavior

### 9.4 Featured Products Integration

Skills are "featured-aware" and query `mv_featured_products`. No design specifies how the skill MVs join with the featured products MV, or how capability gates filter featured types in skill responses.

---

## 10. Missing Cross-Cutting Concerns

| Concern | Status | Impact |
|---|---|---|
| Rate limiting on public bot API | ❌ Undefined | Widget API is unprotected against abuse |
| Conversation retention policy | ❌ Undefined | GDPR risk, storage cost unbounded |
| Data deletion / right to erase | ❌ Undefined | GDPR compliance gap |
| Session expiry | ❌ Undefined | Stale sessions accumulate |
| Conversation archival | ❌ Undefined | Old conversations never pruned |
| Observability / logging | ❌ Undefined | No structured logging, no tracing |
| Error handling for model failures | ❌ Partially defined | "Failover to shared model" but no retry/backoff strategy |
| Cost monitoring | ❌ Undefined | GPU costs, OpenAI API costs untracked |
| A/B testing framework | ❌ Undefined | No way to test different model tiers on same traffic |
| Conversation handoff protocol | ❌ Undefined | Bot → human agent transition undefined |
| Multi-turn conversation context | ❌ Undefined | No context window or history management design |
| Ambiguous intent resolution | ❌ Undefined | What happens when multiple intents match above threshold? |
| PII handling in guardrails | ❌ Partially defined | "PII detection" exists but behavior (mask? block? warn?) is undefined per rule |
| Widget authentication | ❌ Undefined | No API key, no signed requests, no CSRF protection |
| Skill card rendering contract | ❌ Undefined | No JSON schema for skill card data format |
| Conversation feedback loop | ❌ Undefined | Thumbs up/down in UI but no backend storage or analytics |

---

## 11. Internal Inconsistencies Across Design Docs

| # | Inconsistency | Doc A | Doc B |
|---|---|---|---|
| 1 | Public API route pattern | Phased Plan: `/api/public/bot/conversations/:sessionId/messages` | Merchant UIUX: `/api/public/tenants/:tenantId/bot/chat` |
| 2 | Skill gating model | Phased Plan `bot_skills`: `tier_gates` + `capability_gates` as separate arrays | Capability Spec: `required_capabilities` only |
| 3 | BERT availability | Phase 1 §1.3: BERT-powered guardrails + intent | Phase 3: FastAPI model serving infrastructure |
| 4 | `bot_configurations` fields | Schema: `widget_color` (single hex) | Merchant UI: color picker + font + avatar + offset |
| 5 | Bot skill service timing | Phase 1: `BotSkillService.ts` created | Phase 3: Skill registry (source of skill definitions) |
| 6 | Auto-scaling route | Admin UIUX: `/api/admin/bot-platform/autoscaling` | Phased Plan files: `bot-platform-auto-scale` route not listed but not in Phase 4 route list |
| 7 | `resolved_by` vs `response_type` | `bot_conversations.resolved_by`: "faq, skill, human, fallback" | `bot_messages.response_type`: "static, dynamic, skill, fallback" — "human" has no message type |
| 8 | Free tier skill behavior | Capability Spec: "None (skills disabled)" | Merchant UI: "Upgrade to Starter to enable Product Search" — but what does the bot say when a Free user asks a product question? |
| 9 | Bot name field | Merchant UI Config: "Bot Name" input | `bot_configurations` schema: no `bot_name` field |
| 10 | Response length field | Merchant UI Config: "Concise / Balanced / Detailed" | `bot_configurations` schema: no `response_length` field |
| 11 | Fallback tab | Merchant UI Config: "Fallback" tab with escalation settings | `bot_configurations` schema: only `fallback_message` — no escalation config |
| 12 | Context-aware greeting | Phase 2 §2.8: "Bot greeting adapts to context (product page)" | No mechanism defined for page-context injection into widget |

---

## 12. Summary of Gap Categories

| Category | Gap Count | Severity |
|---|---|---|
| Missing Prisma tables / fields | 8 tables + 12 fields | 🔴 Critical |
| Missing backend services | 10 services | 🔴 Critical |
| Missing API routes | 16+ routes | 🔴 Critical |
| Missing frontend services | 4 services | 🔴 Critical |
| Missing frontend hooks | 1 hook | 🟡 Medium |
| Missing merchant pages | 7 pages | 🔴 Critical |
| Missing admin pages | 10 pages | 🟡 Medium (Phase 3-4) |
| Missing widget | 1 bundle + 9 concerns | 🔴 Critical |
| Missing AI infrastructure | 8 components | 🟠 High (Phase 3-4) |
| Missing integration designs | 4 integrations | 🟡 Medium |
| Missing cross-cutting concerns | 16 concerns | 🟠 High |
| Internal inconsistencies | 12 conflicts | 🟠 High |
| Phase structure issues | 5 issues | 🔴 Critical |

**Total gaps identified: ~100+**

The existing phased plan underestimates scope by approximately 2–3x and contains sequencing errors that would block delivery. The improved plan below restructures phases to be incremental, properly sequenced, and realistic.
