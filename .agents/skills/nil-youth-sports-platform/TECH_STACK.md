# NIL Youth Sports Platform — Tech Stack & Vendor Context Document

**Document Version:** 1.0
**Date:** 2026-10-20
**Purpose:** Request-for-Proposal (RFP) attachment. Gives bidding development teams the complete technology context for implementing the MVP, derived from the engineering spec set in this folder (`SKILL.md`, `TECHNICAL_SPEC.md`, `MIGRATION_DESIGN.md`, `EXECUTION_PLAN.md`, `FRONTEND_SPEC.md`, `SPINOFF_MVP_ANALYSIS.md`).
**MVP Boundary:** Execution Plan Stages S0–S9 (extraction + Implementation Phases 1–3). Phase 4 (automated compliance, escrow finance, RLS) is **post-MVP**.

---

## 1. What Is Being Built

A multi-tenant NIL (Name, Image, Likeness) marketplace for youth sports — public athlete profiles and rosters on one side, a strictly private guardian/consent/financial core on the other. The system handles **minors' PII and money**, so child-safety controls (COPPA/FERPA/state-NIL) are architectural requirements, not features.

**Build approach — pattern replication, not greenfield.** The platform is a **fork-and-strip extraction** of an existing production codebase (`retail-visibility-platform`, a multi-tenant commerce marketplace). The vendor clones the source repo, deletes the commerce verticals (products, inventory, storefronts, Google integrations, ~90 route/service files), keeps the infrastructure primitives, and builds the NIL domain on top. There is **no data migration** — the new platform starts on a fresh database.

## 2. Repository & Toolchain

| Item | Value |
|---|---|
| Repo layout | pnpm monorepo — `apps/web`, `apps/api`, `packages/shared` |
| Package manager | **pnpm 12.x** (workspaces) |
| Runtime | **Node.js ≥ 22** |
| Language | **TypeScript** everywhere (web ~v7, api ~v6); zero-TS-error builds are the Definition of Done gate |
| Source repo | `github.com/paulyarl/retail-visibility-platform` (cloned depth-1, history stripped) |
| New repo | `nil-youth-sports-platform` (fresh git history) |
| Local dev | `doppler run --config local -- pnpm -r --parallel dev` |
| Verification commands | `pnpm checkapi` (`tsc --noEmit --project apps/api`), `pnpm checkweb` (same for web), `pnpm test` (vitest across both apps) |

## 3. Frontend (`apps/web`)

| Concern | Technology | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router), React 19 | Deployed to Vercel; webpack build (`next build --webpack`) |
| UI library | **Mantine 9** is the primary component system; **Radix UI** primitives + **Tailwind CSS 4** for custom surfaces; lucide-react + tabler icons | Dashboard shells (`CrmPageShell`, `CrmNavPanel`, `CapabilityShowcase`) are Mantine-based and must be **reused, not rebuilt** |
| Auth client | `@auth0/nextjs-auth0` v4 | Session flows through `apps/web/src/proxy.ts` to the API |
| Forms/validation | react-hook-form + **Zod 4** | Zod schemas shared with API layer |
| Data fetching | **Singleton service layer only** (`apps/web/src/providers/base/`) — no raw `fetch` | TanStack Query is available but server data flows through the singleton pipeline |
| i18n | i18next + react-i18next | User-facing copy is translatable |
| Error tracking | `@sentry/nextjs` | New Sentry project for NIL |
| Analytics | `@vercel/analytics` | |
| Video | Third-party embed metadata only (YouTube, Hudl) — **no video hosting/transcoding** | Allowlisted hosts enforced server-side |
| Maps/media | react-leaflet, qr-code-styling, framer-motion (carried over; most are NIL-irrelevant and may be dropped in the web strip) | |

**Critical frontend constraint:** the web test harness has **no jsdom and no React Testing Library**. Component tests are server-rendered via `renderToStaticMarkup` inside `MantineProvider`; `useEffect` never runs; only `src/**/*.test.ts` is collected (use `createElement`, not JSX). This is a deliberate decision (EXECUTION_PLAN D8), not a gap.

## 4. Backend (`apps/api`)

| Concern | Technology | Notes |
|---|---|---|
| Framework | **Express 5** + TypeScript, compiled to `dist/` | helmet, cors, express-rate-limit, morgan, cookie-parser |
| ORM | **Prisma 6** + PostgreSQL | Migrations + `prisma db push` coexist — the live DB may hold out-of-band objects; enumerate from the DB, not just `schema.prisma` |
| AuthN | **Auth0** (Management API `auth0` + `jsonwebtoken` verification) | 8 roles: `ATHLETE`, `GUARDIAN`, `INSTITUTION_ADMIN`, `COACH`, `SPONSOR`, `FAN`, `PLATFORM_ADMIN`, `COMPLIANCE_AUDITOR` |
| Validation | Zod 4 | Route-level input validation |
| Payments | **Stripe** (deal-as-purchase, subscriptions, refunds, tax/1099) | Clover/Square/PayPal integrations are **dropped** in extraction |
| Email | **SendGrid** (`@sendgrid/mail`) | Transactional + 6 new invitation templates |
| AI / RAG bot | **OpenAI** primary; `@anthropic-ai/sdk` and Google GenAI SDKs present | Bot does RAG over `nil_eligibility_rules_list` via pgvector embeddings; child-safety `bot_guardrail_rules` |
| Caching | Context-aware in-process cache services + Redis clients (`ioredis`, `redis`) present | Public 5–15 min TTL / private 0-TTL split (see §5) |
| Media | multer (upload), sharp (image), AWS S3 SDK | Profile images only; highlights are external embeds |
| Observability | `@sentry/node`, structured logging, `X-Audit-ID` correlation IDs | New Relic agent present in source (optional) |
| Secrets | **Doppler** (configs: `local`, `dev`, `prd`) | All env vars flow through Doppler — no `.env` files in repo |
| IDs | `nanoid`-based tenant-scoped generator (`id-generator.ts`) | Prefixed string IDs (`tid-…`, `deal-…`, `consent-…`); **`randomUUID`/`Date.now()` IDs are banned** |

## 5. Core Architecture Invariants (non-negotiable)

These are the patterns the spec set makes mandatory. A proposal that ignores them is non-compliant.

| # | Pattern | Requirement |
|---|---|---|
| 1 | **Two-tier pipeline** | Public reads: anonymous, cached 5–15 min TTL via `NilPublicApiSingleton`. Private/mutations: 0-TTL live proxy via role-specific bases (`GuardianApiSingleton`, `AthleteApiSingleton`, `SponsorApiSingleton`, `InstitutionApiSingleton`, `FanApiSingleton`, `ComplianceApiSingleton`) |
| 2 | **Athlete-as-tenant** | Each student-athlete IS a `tenant` row (`tenant_type='athlete'`) — the data-isolation root. `directory_visible=false` forced; athlete-tenants never appear in any discovery/directory surface |
| 3 | **Centralized service manager** | No raw `fetch`/`axios` anywhere — all calls through the singleton hierarchy. Enforced by CI grep gate |
| 4 | **Tenant-scoped IDs** | All entity IDs from `id-generator.ts` generators; athlete-owned entities prefixed with the athlete tenant key (`atk`) |
| 5 | **Visibility firewall** | `visibility_status` state machine (`draft→pending→approved|rejected→archived`). Public routes return `approved` only. Promotion requires consent + moderation + compliance clearance simultaneously |
| 6 | **Scoped consent ledger** | Versioned `consent_records_list`; public DTO mappers project a field only if its consent scope is granted; revocation cascades to `archived` + full cache eviction in one request |
| 7 | **Tenant isolation** | **MVP (Phase 2):** explicit `WHERE tenant_id` + a repository-level tenant guard that rejects unscoped queries on athlete-owned tables. **Post-MVP (Phase 4):** Postgres RLS designed from scratch — the source platform has **no RLS**; do not inherit or assume it |
| 8 | **Capability gating** | Feature access resolved through tier + merchant resolvers via an 8-phase registration pipeline (9 gated `nil_*` capabilities; `nil_guardian`/`nil_fan_network` are platform-default, never paywalled) |
| 9 | **Cache eviction contract** | Every minor-data mutation must enumerate and evict ALL athlete-namespaced cache keys (`nil-roster-*`, `nil-profile-*`, `nil-feed-*`, sponsor-portfolio). Partial eviction = safety incident; completeness is a release-blocking P0 test |
| 10 | **Guardian-gated minor contact** | All writes to an athlete-tenant require a `consent_authority` guardian match; most-restrictive-wins across multiple guardians; adult→minor direct contact is structurally impossible |

## 6. Infrastructure & Third-Party Accounts (all NEW)

| Service | Purpose | Spec detail |
|---|---|---|
| **Supabase** (Pro plan) | PostgreSQL + pgvector + pooler | New project `nil-youth-sports`; `DATABASE_URL` (pooled, transaction mode) + `DIRECT_URL` (session mode, migrations). **Pooler transaction mode is incompatible with session-level `set_config`** — this constrains the Phase-4 RLS design |
| **Auth0** | Identity | New tenant `nil-youth-sports.us.auth0.com`; Regular Web App; 8 roles; custom domain optional |
| **Vercel** | Web hosting/edge | New project, root `apps/web`, `pnpm install`, 4GB build heap |
| **Railway** | API hosting | New service `nil-youth-sports-api`, `node dist/index.js` |
| **Doppler** | Secrets | New project, three configs (`local`/`dev`/`prd`) |
| **Stripe** | Payments/escrow/KYC payouts | New account; guardian is the KYC subject; deal = purchase with platform transaction fee |
| **SendGrid** | Email | New or existing account; NIL-branded templates |
| **OpenAI** | Bot/RAG | New API key; embeddings into `bot_faq_embeddings`/`bot_athlete_embeddings` via pgvector |
| **Sentry** | Error tracking | New project; **`sendDefaultPii` must be off** — minors' data |
| **GitHub** | Source control | New repo |

## 7. Testing & Quality Gates

| Layer | Tooling | Rule |
|---|---|---|
| API tests | **Vitest 5** + supertest (Jest also present in source) | P0 negative-path tests (COPPA self-registration → 403, adult↔minor messaging impossible, consent-revocation cascade, per-state deal blocks) are **release-blocking** and their harness is built *before* the features they guard |
| Web tests | Vitest, node env, server-render assertions only | No jsdom — see §3 constraint |
| Type safety | `pnpm checkapi` + `pnpm checkweb` | Zero TS errors; enforced in CI from commit 1. **Caution:** source API build (`build-with-selective-errors.js`) tolerates TS errors — the fork must not inherit that masking |
| CI grep gates | grep-based checks | No raw `fetch`; no `randomUUID`/`Date.now()` IDs; no PII fields under `/api/public/*`; concrete services extend NIL bases, never `UniversalSingleton` directly |
| E2E | Playwright (dep present) | Optional for MVP |

## 8. Delivery Model Summary (for proposal scoping)

| Stage | Scope | Estimate (engineer-weeks) |
|---|---|---|
| S0–S3 | Baseline, infra provisioning, schema transform, API extraction | ~17–35 |
| S4–S5 | Safety substrate + vertical slice (athlete-tenant → consent → approved roster) | included below; architecture-validation gate at ~25 ew cumulative |
| S6–S9 | Web extraction, credibility shell, native pipeline, unified service (5 persona capabilities, 6 dashboards, CRM, bots, invitations, onboarding) | balance |
| **Total MVP** | | **39.5–73 ew, likely ~56** (EXECUTION_PLAN §6) |

Calendar scenarios: 1 eng ≈ 9–14 mo · 2 eng ≈ 6–9 mo · **3 eng (backend + web + safety/QA) ≈ 4.5–7 mo — recommended**.

## 9. Known Risks & Constraints (disclosed for bidding)

- **Deletion-repair tax is the dominant cost**, not deletion. ~542 route files / ~361 services / ~88K LOC on the API; ~169K LOC / ~436 pages / ~303 services on web. Estimates for extraction stages are LOW confidence — a measured spike is recommended before committing a fixed price.
- **RLS does not exist in the source.** Any bid claiming "inherited database-level isolation" has misread the specs.
- `tenants` is commerce-shaped (Stripe slots, SKU quotas, GBP tokens); athlete-tenancy requires `tenant_type` + `nil_tenant_profile` side table per decision D2.
- ~509 `.bak`/`.backup` files + abandoned singleton variants (`FlexibleApiSingletonV2/Stable`) must be purged; the canonical chain is `UniversalSingleton → EnhancedFlexibleApiSingleton → FlexibleApiSingleton → role bases`.
- Right-to-erasure vs append-only audit trail is resolved by pseudonymous audit references only (decision D7).
- External lead times: legal sign-off on COPPA/FERPA/state-NIL design (D10) hard-gates the schema freeze; Stripe/Auth0 account setup lead times are excluded from estimates.

## 10. What a Proposal Should Address

1. Fixed-price vs T&M posture given the LOW-confidence extraction stages; whether the bidder proposes the 3–5 day deletion-repair spike first.
2. Team shape vs the recommended 3-engineer composition; who owns the P0 safety harness.
3. Approach to the KEEP/DROP extraction inventory (`MIGRATION_DESIGN.md` §2) and the additive-then-subtractive rule (never drop a Prisma model before its referencing code is gone).
4. Plan for the 8-phase capability pipeline and the commerce⇄NIL equivalency map (`TECHNICAL_SPEC.md` §7.1).
5. Child-safety/compliance implementation approach (§12 gap analysis) — this is the acceptance bar, not a nice-to-have.
6. Assumptions about decisions D1–D11 (EXECUTION_PLAN §1) and which require owner sign-off.

## 11. Source Documents

| Document | Role |
|---|---|
| `SKILL.md` | Functional specification (personas, phases, verification checklist) |
| `TECHNICAL_SPEC.md` | Architecture, schema DDL, capability design, §12 gap analysis (authoritative) |
| `EXECUTION_PLAN.md` | Build order, decisions ledger, estimates (authoritative on conflicts) |
| `MIGRATION_DESIGN.md` | Extraction inventory (KEEP/DROP/EVALUATE) and infra setup |
| `FRONTEND_SPEC.md` | UI surfaces, components, navigation |
| `SPEC_AMENDMENTS.md` | Corrections applied to the spec set |
| `SPINOFF_MVP_ANALYSIS.md` | Verified findings F1–F12 and effort re-baseline |
| `TEAM_BRIEF.md` / `BUDGET.md` | Team composition and budget context |
