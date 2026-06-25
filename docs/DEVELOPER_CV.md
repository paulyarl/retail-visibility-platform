# Paul K Yarl — Senior Full-Stack Platform Engineer

**Location:** Remote / Hybrid
**Role:** Lead Developer & Architect, VisibleShelf Retail Visibility Platform
**Timeline:** 2025 – 2026

---

## Professional Summary

Lead full-stack engineer and architect of a multi-tenant SaaS retail visibility platform serving independent merchants with storefront management, inventory sync, e-commerce checkout, AI chatbot, CRM, and tier-based capability gating. Designed and built a **capability architecture** that serves as the central nervous system of the platform — a 5-layer system that glues together 13+ feature domains and unlocks every downstream feature: micro-component UI composition, payment gateway selection, chatbot tier gating, CRM access control, storefront layout variants, and more. Each feature is built *on top of* the capability system rather than alongside it, creating a coherent platform where tier and merchant preferences flow from database to resolver to API to UI as a single unified signal. Also architected a two-tier singleton service infrastructure, a structured observability stack with distributed correlation IDs, an AI-powered chatbot with RAG and BERT guardrails, and a full CRM system — all built on Next.js 16, React 19, Express 5, TypeScript 6, Prisma 6, and PostgreSQL with Supabase.

---

## Core Technical Skills

### Languages & Frameworks
- **TypeScript 6** (strict mode, zero-error policy across both apps)
- **Node.js + Express 5** (API server, middleware pipeline, route composition)
- **Next.js 16 + React 19** (App Router, SSR, server components, client components)
- **TailwindCSS 4 + Radix UI + Mantine** (design system, accessible components)
- **Prisma 6 ORM** (schema modeling, migrations, raw SQL for pgvector)

### Data & Infrastructure
- **PostgreSQL (Supabase)** — primary datastore, Row Level Security, materialized views
- **Redis** — session storage, permission caching, hot-data cache
- **pgvector** — vector similarity search for RAG embeddings
- **Vercel + Railway** — deployment (web + API)
- **GitHub Actions** — CI/CD pipelines
- **Doppler** — secrets management

### Integrations & External APIs
- **Stripe, Square, PayPal, Clover** — multi-gateway payment processing
- **Google Merchant Center, Google Business Profile** — OAuth, catalog feed sync, NAP data
- **Auth0** — authentication, session management, RBAC
- **OpenAI, Google Gemini, Anthropic, Mistral** — LLM provider abstraction
- **HuggingFace Transformers.js** — BERT toxicity detection & intent classification (client-side inference)
- **Sentry** — error tracking (server + client)
- **SendGrid** — transactional email

### Architecture & Patterns
- Multi-tenant SaaS with organization hierarchy
- Tier-based capability gating system (5-layer architecture)
- Singleton service pattern with context-isolated caching
- Distributed tracing via correlation IDs
- RAG (Retrieval-Augmented Generation) with pgvector
- Shadow DOM embeddable widget
- Micro-component refactor methodology
- Database-driven navigation system

---

## Project: VisibleShelf — Retail Visibility Platform

**Description:** A multi-tenant SaaS platform that gives independent retailers visibility across Google Shopping, Google Business Profile, and their own storefront. Merchants manage inventory, categories, business hours, e-commerce checkout, customer support, and AI-powered chat — all gated by a subscription tier system with per-merchant capability toggles.

### Role: Lead Developer & Architect
Sole developer driving the platform from concept to production, working with AI coding agents as pair programmers. Designed and implemented every major subsystem.

---

## Key Accomplishments

### 1. Tier-Based Capability Architecture

Designed and built a 5-layer capability gating system that controls feature access across 13+ domains (commerce, payment gateway, storefront, fulfillment, barcode scan, product options, featured products, integrations, CRM, chatbot, FAQ, social commerce, organization).

**Architecture:**
- **Definition Layer** — canonical feature definitions + tier hierarchy with cascading feature inheritance
- **Database Layer** — `capability_type_list`, `features_list`, `tier_features_list`, `capability_features_list` tables
- **Resolver Layer** — per-domain pure-function resolvers (e.g., `CrmOptionsResolver`, `ChatbotOptionsResolver`) that merge tier hard gates with merchant soft toggles
- **Route Layer** — settings PUT endpoints with tier-gate enforcement (reject enabling features not in tier) and automatic cache invalidation
- **Frontend Layer** — `UnifiedCapabilityService` singleton that fetches pre-resolved effective state; zero client-side resolution logic

**Key innovations:**
- **Most-permissive-wins merging** — when a tenant belongs to an organization with a higher tier, features merge as a union
- **Flexible-tier pattern** — `*_flexible` feature key unlocks all sub-types for org/chain tiers without enumerating each
- **BSaaS à la carte purchases** — individual feature purchases override tier gates with active/past_due/trial status tracking
- **Subscription-status-aware overrides** — frozen/canceled tiers get capabilities disabled; maintenance/past_due tiers get write-heavy capabilities disabled while keeping read-only ones active
- **Single DB round-trip** — `EffectiveCapabilityResolver` fetches tier features + all merchant settings in parallel, dispatches to 15+ resolvers concurrently, caches result in-memory for 60 seconds

**Platform-wide impact — the capability system as platform glue:**

The capability architecture is not a standalone feature — it is the connective tissue that makes every other subsystem possible. Without it, the platform would be a collection of disconnected features with ad-hoc permission checks. With it, tier and merchant preferences flow as a single unified signal through every layer:

- **Micro-component UI composition** — each section component receives only the capability flags it needs and gates its own rendering. A product gallery shows video only if `product_options.video_enabled` is true; a purchase panel shows cart buttons only if `commerce.enabled` and `payment_gateway.checkout_available` are both true. The refactor into 12+ shared sections was only possible because the capability system provides a consistent, typed control plane that each component can consume independently.
- **Payment gateway selection** — `PaymentGatewayResolver` merges tier hard gates (which gateways the tier allows) with merchant soft toggles (which the merchant enabled) to produce `effectiveGateways`. The checkout flow trusts this single resolved value rather than re-checking tier rules.
- **Chatbot tier gating** — the bot's 13 services all call `resolveEffectiveCapabilities` at runtime. Static vs dynamic response engine, skill types, widget customization, knowledge base types — all gated by the capability manifest. A free-tier tenant gets keyword matching; a professional-tier tenant gets GPT + RAG + product catalog awareness.
- **CRM access control** — `CrmOptionsResolver` determines whether CRM is enabled, which ticket categories are allowed, and whether the merchant can manage tasks. The admin CRM dashboard, merchant widget, and customer portal all read from the same resolved state.
- **Storefront layout variants** — the product page renders showcase, quick-commerce, or classic layout based on `storefront_type.effectiveType` from the capability resolver. Each layout variant is a thin composition layer that passes capability flags to shared section components.
- **Navigation visibility** — sidebar links filter by target (all/tenant/admin), but individual links also check capability state to show or hide (e.g., CRM link only appears if `crm.enabled` is true in the resolved manifest).
- **Scheduled jobs** — background jobs call the unified endpoint to check capabilities before executing (e.g., product embedding sync skips tenants without chatbot capability).
- **Public API routes** — unauthenticated endpoints (bot widget, storefront) call `resolveEffectiveCapabilities` server-side as the security boundary — the tier gate is the gate, not a separate auth check.

This design means adding a new feature domain follows a predictable 5-step pattern (define → seed → resolve → route → map) and automatically gets tier gating, merchant toggles, cache invalidation, and UI visibility. The capability system is the reason the platform can scale to 13+ feature domains without becoming an unmanageable tangle of ad-hoc permission checks.

**Technologies:** TypeScript, Express, Prisma, PostgreSQL, React, Next.js

---

### 2. Two-Tier Singleton Service Infrastructure

Architected a reusable singleton class hierarchy for both frontend (client-side API services) and backend (server-side data services) that enforces consistent caching, authentication, context isolation, and metrics collection.

**Frontend hierarchy (8 domain base classes):**
- `UniversalSingleton` → `EnhancedFlexibleApiSingleton` → `FlexibleApiSingleton` → domain bases:
  - `PublicApiSingleton` (no auth, 15-min TTL, slug→ID resolver)
  - `TenantApiSingleton` (auth cookies, 10-min TTL, cache contract with `getServiceCachePatterns` / `invalidateServiceCaches`)
  - `AdminApiSingleton` (audit ID generation, `X-Admin-Roles` header)
  - `OrganizationApiSingleton` (authorization-group validation, platform-role hierarchy)
  - `CustomerApiSingleton` (JWT via localStorage, `X-Customer-ID` header)
  - `ExternalApiSingleton` (timeout/abort, batch requests, health checks)
  - `SystemSingleton` (cross-target: web port 3000 + API port 4000)
  - `ApiSystemSingleton` (trusted system-to-admin requests)

**Backend hierarchy:**
- `UniversalSingleton` — in-memory + persistent cache, metrics, auth context, encryption, retry with exponential backoff
- `BaseService` — lightweight Prisma + logger base for stateless CRUD
- `PermissionEnhancedBaseService` — capability-gated service mixin (`requireFeature`, `requireLimit`, `requireAccess`)
- `BasePermissionService` — Redis-backed permission caching with tenant-isolated keys

**Cross-context cache invalidation:**
- Identified and solved the cache isolation problem where merchant writes (TENANT context) don't auto-invalidate public reads (PUBLIC context)
- Built explicit cross-service invalidation patterns for 15+ write→read scenarios

**Technologies:** TypeScript, Redis, Express, Next.js, React

---

### 3. Observability & Structured Logging

Built a full-stack observability stack with distributed tracing, error persistence, and admin triage tooling.

**Server-side logging (4 transports):**
- **Console** — colorized in dev, JSON in production
- **File** — async writes via `fs.createWriteStream`, daily rotation, 30-day retention
- **Database** — ERROR-level logs persisted to `application_error_log` PostgreSQL table with tenant ID, correlation ID, stack trace, request context, Sentry event ID
- **Sentry** — ERROR-level forwarding with tenant/correlation scope tags

**Client-side logging:**
- Parallel logger with Sentry integration + batched POST to `/api/client-errors`
- Rate limiting (10 errors/min client-side, 10/min per IP server-side)
- Deduplication (60s window for identical messages)
- `GlobalErrorHandler` component captures `window.onerror`, `unhandledrejection`, and `beforeunload` (flush via `navigator.sendBeacon`)

**Distributed correlation IDs:**
- Client generates `corr-CL-{nanoid}` on first API call, stored in sessionStorage
- Server generates `corr-{tenantKey}-{nanoid}` or honors incoming header
- Server is authoritative — client adopts server's ID from response header
- Correlation ID flows through: client console → Sentry tag → DB column → server file logs
- All `FlexibleApiSingleton` fetch calls automatically inject the header

**Admin error triage API:**
- `GET /api/admin/errors` with filters (tenant, level, resolved, date range, correlation ID)
- `GET /api/admin/errors/:id` for full detail including stack trace
- `GET /api/admin/errors/stats` for aggregate counts
- `POST /api/admin/errors/:id/resolve` for triage workflow
- Automated daily purge job (resolved > 90 days, unresolved > 180 days)

**Technologies:** TypeScript, Express, PostgreSQL, Sentry, Winston-style custom logger

---

### 4. AI Chatbot Platform (Phases 0–3B) — Capability-Gated AI

Built a complete AI chatbot platform with 13 backend services, an embeddable widget, merchant dashboard, and platform admin UI. Every layer of the chatbot is gated by the **capability architecture** — the bot's response engine (static vs dynamic), skill types, widget customization, knowledge base types, and product catalog awareness are all unlocked or locked based on the tenant's resolved capability manifest. A free-tier tenant gets keyword FAQ matching; a professional-tier tenant gets GPT-powered RAG with product catalog awareness. This tier-aware behavior is not hardcoded — it flows from `ChatbotOptionsResolver` through the unified endpoint to every bot service at runtime.

**Backend services:**
- `BotConfigurationService` — per-tenant bot config (name, tone, greeting, widget appearance)
- `BotConversationService` — session management, 24h expiry, message storage, archival, GDPR erase
- `BotStaticResponseService` — free-tier FAQ keyword matching (exact → Jaccard similarity → fallback)
- `BotDynamicResponseService` — GPT-powered responses with RAG context injection + multi-turn history
- `BotGuardrailService` — rule-based safety filtering (banned phrases, PII, moderation, competitor mentions)
- `BertGuardrailService` — BERT toxicity detection via Transformers.js with rule-based fallback
- `BotIntentService` — keyword-based intent detection with Jaccard similarity
- `BertIntentService` — BERT zero-shot intent classification with keyword fallback
- `BotSkillService` — skill execution with tier/capability/status gating
- `BotRagService` — FAQ + product chunking, OpenAI embeddings, pgvector cosine similarity search
- `BotProductCatalogService` — product search via materialized view with badge/stock filtering
- `BotCrmIntegrationService` — bot conversation → CRM ticket escalation with conversation log
- `BotCrmAssistantService` — BSaaS skill: ticket lookup, ticket creation, inquiry status from bot
- `BotBusinessHoursService` — after-hours detection from business hours data

**Embeddable widget:**
- Shadow DOM encapsulation (no CSS/JS conflicts with host page)
- `data-tenant-id` auto-init from script attributes (no build step for merchants)
- localStorage session resume with 24h TTL
- Progressive enhancement: fetches config first, renders only if `status === 'active'`
- Capability-gated rendering via server-side `resolveEffectiveCapabilities` check

**Merchant dashboard:**
- Bot configuration CRUD (name, avatar, tone, greeting, widget theme)
- Conversation list with analytics (message count, resolution rate, escalation rate)
- Skills management (enable/disable per skill type)
- Knowledge base management (FAQ embedding refresh, product embedding sync)
- Widget setup guide with embed code generation

**Platform admin UI:**
- Dashboard with tenant overview, conversation volume, guardrail triggers
- Guardrail rule management (banned phrases, PII patterns, moderation thresholds)
- Intent management (keyword mappings, confidence thresholds)
- Skill management (global skill catalog)
- Knowledge base audit (embedding coverage, gap reports)
- Tenant CRUD with bot capability gating

**Product catalog awareness (Phase 3A):**
- `BotProductCatalogService` queries `mv_storefront_discovery` materialized view
- Keyword search, badge filtering (sale, new_arrival, clearance, seasonal), stock filtering
- Product embeddings via `BotRagService` (chunks from product name, description, marketing, features, tags, badges, SKU)
- Dynamic response service injects product context into GPT prompt with rule: "Only mention products that are in the context. Do not invent products, prices, or availability."
- Periodic job syncs product embeddings every 12 hours for all tenants with active chatbot

**Technologies:** TypeScript, OpenAI API, HuggingFace Transformers.js, pgvector, Express, React, Shadow DOM

---

### 5. CRM System (Phases 1–2) — Capability-Gated Support

Built a complete CRM system with admin platform views, tenant merchant tools, and customer-facing support portal. CRM access is gated by the **capability architecture** — `CrmOptionsResolver` determines whether CRM is enabled for a tenant, which ticket categories are allowed, and whether task management is available. The admin CRM dashboard, merchant widget, and customer portal all read from the same resolved capability state, ensuring consistent access control across every surface.

**Backend:**
- 6 core services: Ticket, Task, Contact, Activity, Inquiry, Message
- Admin routes (global ticket list, global task Kanban, tenant detail with 6 tabs)
- Tenant routes (merchant ticket creation, task management, contact CRUD)
- Customer routes (public support portal — ticket list, detail, reply)
- Sort order + reorder for Kanban task columns
- Role-validation permissions (admin vs tenant vs customer)

**Frontend:**
- Admin CRM dashboard with analytics
- Global tickets table with filtering
- Global tasks Kanban board (drag-drop status columns)
- Tenant detail page with 6 tabs (tickets, tasks, contacts, activities, inquiries, alerts)
- Requests hub for cross-tenant inquiry management
- Customer support portal (ticket list + detail + reply)
- Merchant CRM widget on TenantDashboard
- Merchant support page at `/t/[tenantId]/support`

**Bot-CRM integration:**
- Bot conversations escalate to CRM tickets with conversation log attached
- `BotCrmAssistantService` provides BSaaS skill: ticket lookup by email, ticket creation from chat, inquiry status check
- Conversation context (last 10 messages) included in ticket description

**Technologies:** TypeScript, Express, Prisma, React, Next.js, Mantine

---

### 6. Multi-Gateway Payment System — Capability-Gated Checkout

Integrated four payment gateways with tier-based capability gating and merchant preference toggles. The **capability architecture** is the gatekeeper: `PaymentGatewayResolver` merges tier hard gates (which gateways the subscription level allows) with merchant soft toggles (which the merchant chose to enable) to produce `effectiveGateways`. The checkout flow trusts this single resolved value — no scattered permission checks. Product display cards check only gateway existence (not OAuth health), keeping display concerns separate from checkout-flow validation.

- **Stripe** — checkout sessions, webhooks, subscription billing, Stripe Tax (planned)
- **Square** — OAuth integration, Web SDK checkout
- **PayPal** — server SDK + client-side PayPal JS
- **Clover** — POS connector (in progress)
- Tier gate controls which gateways each subscription level can access
- Merchant settings page with per-gateway enable/disable toggles
- `PaymentGatewayResolver` merges tier hard gates with merchant soft preferences
- Architectural principle: product display cards check gateway existence, not OAuth health — checkout flow validates connection status

**Technologies:** Stripe SDK, Square SDK, PayPal SDK, Express, React

---

### 7. Google Integrations

- **Google Merchant Center** — OAuth flow, product feed generation, feed push jobs with retry logic
- **Google Business Profile** — location sync, business hours mirroring, category alignment
- **OAuth pattern** — `google_oauth_accounts` + `google_oauth_tokens` tables, token refresh, multi-account support
- **Feed sync pattern** — `GMCProductSync.ts` + `feed-generator.ts` with scheduled push jobs

**Technologies:** Google APIs, Express, Prisma, PostgreSQL

---

### 8. Micro-Component Refactor Methodology (Enabled by Capability Architecture)

Developed and documented a reusable 6-step refactor pattern for decomposing monolithic page layouts into composable micro-components. This refactor was only possible because the **capability architecture** provides a consistent, typed control plane that each component can consume independently — instead of page-level if/else chains, each micro-component receives only the capability flags it needs and gates its own rendering.

- **Step 1:** Audit monolith — identify duplicated blocks, layout-unique blocks, shared logic
- **Step 2:** Extract shared layout hook — centralize state, refs, handlers, derived values
- **Step 3:** Extract shared section components — each self-contained with typed props, layout-variant-aware, **capability-flag-gated**
- **Step 4:** Extract post-page sections from page root — preserve wrapper boundaries
- **Step 5:** Extract type-safe sub-components — mini compositor pattern for entity-type-specific UI
- **Step 6:** Rewrite layout files as thin composition layers — target under 250 lines

Applied to product page refactor: 3 layout variants (classic, showcase, quick-commerce) decomposed into 12+ shared section components with zero behavioral regressions. Each section component (gallery, purchase panel, FAQ, reviews, recommendations, inquiry form, business info) receives capability flags as props and independently decides what to render — a gallery shows video only if the capability allows, a purchase panel shows cart only if commerce + payment gateway are both enabled. The capability system is the glue that lets these components be truly self-contained while remaining tier-aware and merchant-aware.

**Technologies:** React, TypeScript, Next.js

---

### 9. Database-Driven Navigation System (Capability-Aware)

- `navigation_links` PostgreSQL table stores all sidebar links
- Admin UI at `/settings/admin/navigation` for CRUD management
- `NavigationLinksService` singleton with 5-min cache
- `useNavLinks` hook fetches, decodes flat→nested, filters by target (all/tenant/admin)
- 3 sidebar systems: UniversalNavContent, AdminNavContent, DynamicTenantSidebar
- Dynamic templates for tenant-locations and organization-locations (client-side generated, not stored in DB)
- Icon component map with 20+ lucide-react icons
- **Capability-aware rendering** — navigation links check the resolved capability manifest to show or hide themselves (e.g., CRM link only appears if `crm.enabled`, chatbot link only if `chatbot.enabled`), so the sidebar automatically reflects what the merchant's tier and preferences actually unlock

**Technologies:** TypeScript, React, PostgreSQL, Next.js

---

### 10. Tenant-Scoped ID Generation

Designed a tenant-scoped ID system replacing raw UUIDs with visually traceable, URL-safe identifiers.

- Format: `{prefix}-{tenantKey}-{nanoid}` (e.g., `order-A3K9-CUA3K9M-x7y2z9`)
- 60-70% shorter than UUIDs
- Tenant key (4-char deterministic hash) enables visual identification in logs, URLs, support tickets
- Cross-system correlation: order, payment, and shipment IDs for the same tenant share the same key
- Collision-safe: nanoid with 8+ chars has ~1 in 2.8 trillion collision probability
- Restricted alphabet (no ambiguous chars like 0/O, 1/I)

**Technologies:** TypeScript, nanoid

---

## Additional Features Delivered

- **Business hours management** — weekly schedule editor, special/holiday hours, timezone picker, GBP sync, real-time open/closed status on storefront
- **Product video player** — reusable component supporting YouTube (including /shorts/, /embed/, playlists), Vimeo, with facade pattern for lazy iframe loading
- **Storefront layouts** — multiple layout variants (showcase, quick-commerce, classic) selected by `storefront_type.effectiveType` from the capability resolver; each layout is a thin composition layer passing capability flags to shared micro-components
- **Directory system** — merchant directory with category filtering, featured products, map view (Leaflet)
- **Feature flag system** — platform-level and tenant-level flags with admin UI
- **i18n** — full internationalization with i18next + react-i18next
- **PWA support** — next-pwa for installable web app
- **Barcode scanning** — capability-gated barcode scan for inventory management
- **Social commerce plan** — architectural plan for TikTok Shop, Instagram Shopping, Meta Commerce integration (25-35 day estimate, 11 new tables)
- **Abandoned cart recovery** — planned as part of social commerce phase
- **Store reviews system** — customer review submission and display
- **Organization hierarchy** — multi-tenant organizations with chain tiers, role-based access

---

## Development Methodology

### Agent Skill Engineering & AI-Assisted Development

Actively engineered a reusable **agent skill system** — a library of 25+ structured skill documents (`.devin/skills/`) that encode architectural decisions, working patterns, and step-by-step procedures for recurring task types. Each skill is authored during real implementation work, then deployed as a reusable resource that any future task can invoke to ensure consistency, reduce errors, and accelerate delivery.

**Skill creation process:**
- Skills are authored **during** feature implementation, not after — capturing decisions, patterns, and pitfalls while context is fresh
- Each skill distills a complex architectural pattern into a repeatable procedure: architecture overview, step-by-step instructions, code examples, common pitfalls, and file references
- Skills are versioned alongside the codebase, so they evolve as patterns mature
- New tasks invoke existing skills rather than re-deriving the approach from scratch

**Skill deployment in practice:**
- When implementing a new capability domain, the `capability-system-integration` skill provides the 5-layer checklist (define → seed → resolve → route → map) — ensuring no layer is missed
- When deploying a new service, the `deploy-service-extending-base-singleton` skill specifies exactly which base class to extend, the cache contract to implement, and the authentication headers to inject
- When debugging production issues, the `correlation-id-troubleshooting` skill provides the step-by-step trace methodology (browser → API → DB → Sentry)
- When refactoring monolithic pages, the `monolith-to-micro-component-refactor` skill provides the 6-step decomposition pattern with type safety checklist
- When adding cross-context cache invalidation, the `cross-context-cache-invalidation` skill lists all 15+ write→read scenarios and the correct invalidation pattern for each

**Outcomes:**
- **Pattern reuse** — new features follow proven patterns instead of ad-hoc design; the 5-step capability integration pattern has been applied 13+ times across domains
- **Consistency** — every singleton service follows the same class hierarchy, cache contract, and authentication pattern because the skill enforces it
- **Error reduction** — common pitfalls (wrapper boundary mistakes, ref type strictness, cache isolation gaps, hydration mismatches) are documented in skills and avoided before they occur
- **Efficiency** — tasks that would take hours of context-gathering are reduced to invoking a skill that points directly at the relevant files, patterns, and gotchas
- **Onboarding** — new sessions (or new contributors) can be productive immediately by reading the relevant skill instead of reverse-engineering architecture from code

**Skill library coverage (25+ skills):**
- Architecture: capability system integration, singleton deployment, monolith-to-micro-component refactor, database navigation system
- Observability: structured logging, correlation ID troubleshooting, dashboard performance audit
- Caching: cross-context cache invalidation, context-aware cache management
- Features: add capability feature, add BSaaS feature, add org capability, add chatbot skill, add AI provider
- Debugging: debug infinite render loops, bot widget troubleshooting, troubleshooting public page API leaks, auth0 session revival
- Data: tenant-scoped ID generation, link features to capability type, verify capability deployment
- Patterns: skill-driven feature implementation, replicate image carousel layout picker, product video

### Quality Discipline
- **Zero TypeScript errors** policy — enforced via `pnpm checkapi` and `pnpm checkweb` before any merge
- **Behavioral parity** on refactors — refactored pages must render identically to originals
- **Capability-gated everything** — no feature ships without proper tier gating
- **Structured logging** — no `console.*` in production code; all logging through centralized logger
- **Correlation IDs** — every request traceable from browser through API to database

### CI/CD
- GitHub Actions for automated testing and deployment
- Vercel deployment for web app, Railway for API server
- Doppler for secrets management across environments (local, dev, production)
- Prisma migrate for database schema management

---

## Technical Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 6, TailwindCSS 4, Radix UI, Mantine |
| Backend | Node.js, Express 5, TypeScript 6 |
| Database | PostgreSQL (Supabase), Prisma 6, pgvector |
| Cache | Redis, in-memory LRU |
| Auth | Auth0 (NextJS SDK, server-side sessions) |
| Payments | Stripe, Square, PayPal, Clover |
| AI/ML | OpenAI, Google Gemini, Anthropic, Mistral, HuggingFace Transformers.js |
| Observability | Sentry, custom structured logger, correlation IDs |
| External APIs | Google Merchant Center, Google Business Profile, SendGrid |
| Testing | Vitest, Playwright, Supertest |
| CI/CD | GitHub Actions, Vercel, Railway, Doppler |
| Package Manager | pnpm |

---

## Employable Skills Summary

### Architecture & System Design
- **Capability-driven platform architecture** — designed a unified capability system that serves as the connective tissue across 13+ feature domains, enabling every downstream feature (UI composition, payment gating, AI tier selection, CRM access, navigation visibility) to consume a single resolved manifest
- Multi-tenant SaaS architecture with organization hierarchy and most-permissive-wins tier merging
- Service-oriented architecture with singleton pattern and context-isolated caching
- Cross-context cache invalidation patterns for multi-tenant write→read scenarios
- Distributed tracing and observability with bidirectional correlation IDs
- Micro-component refactor methodology — only possible with capability flags as the control plane
- Database-driven configuration systems with admin CRUD management

### Backend Engineering
- Express 5 API design with middleware composition
- Prisma 6 ORM with complex schema modeling (50+ models)
- PostgreSQL advanced features (materialized views, pgvector, RLS)
- Redis caching strategies
- Webhook handling (Stripe, Google)
- OAuth integration patterns (Google, Square, Auth0)
- Scheduled job systems
- Rate limiting and security middleware (Helmet, express-rate-limit)

### Frontend Engineering
- Next.js 16 App Router with server/client component composition
- React 19 with hooks, context, and state management
- TailwindCSS 4 + Radix UI + Mantine component libraries
- Shadow DOM widget development
- PWA configuration
- i18n implementation
- Map integration (Leaflet)
- Performance optimization (facade pattern, lazy loading, cache management)

### AI/ML Engineering
- RAG pipeline design (chunking, embeddings, vector search, context injection)
- Multi-provider LLM abstraction (OpenAI, Gemini, Anthropic, Mistral)
- BERT model deployment (Transformers.js, toxicity detection, intent classification)
- Guardrail systems (rule-based + ML-based)
- Product catalog awareness via materialized views + vector embeddings

### DevOps & Tooling
- CI/CD pipeline design (GitHub Actions)
- Secrets management (Doppler)
- Deployment (Vercel, Railway)
- Database migration management (Prisma Migrate)
- Error monitoring and triage (Sentry, custom admin API)
- **Agent skill engineering** — systematic creation and deployment of reusable skill documents that encode working patterns, reduce errors, and enable efficient AI-assisted development

### Leadership & Process
- Sole ownership of architecture decisions for a production platform
- **Agent skill library stewardship** — actively authored and maintained 25+ reusable skill documents during feature implementation, promoting pattern reuse, consistency, and error reduction across all development tasks
- Documentation-driven development — skills are written during implementation (not after), versioned alongside code, and invoked by future tasks to skip context-gathering and follow proven patterns
- Quality enforcement (zero TS errors, behavioral parity, capability gating)
- Feature planning and phased delivery (CRM 5 phases, Chatbot 4 phases, Social Commerce 5 phases)
- Risk assessment (API review timelines, compliance requirements, infrastructure cost analysis)
