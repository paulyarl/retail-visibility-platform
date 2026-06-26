# NIL Youth Sports Platform — Unified Project Sequence

**Document Version:** 1.0
**Purpose:** Merges `MIGRATION_DESIGN.md` (M0–M4) and `IMPLEMENTATION_PLAN.md` (Phase 0–4) into a single, non-redundant execution timeline. This is the master build order — every task appears exactly once, in dependency order.

**Guiding rules (from `IMPLEMENTATION_PLAN.md` §0):**
- Work top-to-bottom; stages gate on each other.
- Every task points to a skill in `.devin/skills/`. Do not improvise a pattern that a skill already defines.
- **Definition of Done:** `pnpm checkapi` + `pnpm checkweb` pass (zero TS errors), skill checklist passes, no raw `fetch` / no `randomUUID` / no `Date.now()` IDs.
- **P0 safety/legal gates are blocking.** A stage cannot ship if any P0 acceptance check is red.

---

## Dependency Graph (Master Build Order)

```
Stage A (infra)          ──►  Stage B (schema)         ──►  Stage C (API core)        ──►  Stage D (web core)     ──►  Stage E (shell)
  M0 infra setup              M1 schema transform          M2 API cleanup + bases        M3 web cleanup + bases     Impl Phase 1
  new git/supabase/           strip commerce models        delete commerce routes        delete commerce routes     landing + leads
  auth0/vercel/railway/       add NIL models               add NIL ID generators         add NIL web singletons     nil_landing capability
  doppler                     RLS + triggers               add NIL base singletons       rebrand UI
                              seed base data               replace resolvers             update proxy/auth
                                                           repurpose checkout→deals

  Stage E ──►  Stage F (native pipeline)  ──►  Stage G (unified service)  ──►  Stage H (enterprise mesh)
              Impl Phase 2                    Impl Phase 3                     Impl Phase 4
              athlete-as-tenant               remaining singletons             RLS audit
              firewall + consent              memberships                      automated compliance
              P0 safety gates                 persona capabilities             finance + escrow
              nil_roster capability           dashboards                       erasure + age-out
                                              CRM + bots
```

---

## Stage A — Infrastructure Setup (Migration M0)

**Objective:** New git repo, new cloud accounts, new Doppler configs. Empty but building-ready project.

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| A.1 | Create new git repo; clone source files (no .git history). | — | Clean repo with single initial commit. | `git log` shows one commit. |
| A.2 | Create new Supabase project; enable pgvector. | — | Supabase project provisioned. | Dashboard accessible; `CREATE EXTENSION vector` succeeds. |
| A.3 | Create new Auth0 tenant; configure 8 NIL roles (athlete, guardian, institution_admin, coach, sponsor, fan, platform_admin, compliance_auditor). | — | Auth0 application + roles. | All roles visible in Auth0 dashboard. |
| A.4 | Create new Vercel project (web). | — | Vercel project linked to repo. | Preview deploy succeeds (even if blank). |
| A.5 | Create new Railway service (api). | — | Railway service linked to repo. | Service deploys (even if DB empty). |
| A.6 | Configure Doppler (local, dev, prd configs) with all secrets (DATABASE_URL, DIRECT_URL, AUTH0_*, STRIPE_*, SENDGRID_*, OPENAI_API_KEY, NEXT_PUBLIC_API_URL). | — | Three Doppler configs. | `doppler secrets` lists all required keys. |
| A.7 | Update package names (`@rvp/*` → `@nil/*`); update all brand strings, `PLATFORM_DOMAINS`, `API_BASE_URL` defaults. | — | Renamed packages; no "visibleshelf" or "rvp" references. | `pnpm install` succeeds; grep finds zero old-brand references. |

**Gate:** Stage B does not start until A.1–A.7 are green.

---

## Stage B — Database Schema Transform (Migration M1 + Impl Phase 0 decisions)

**Objective:** Clean Prisma schema with NIL-only models, RLS policies, triggers, seeded base data. This stage absorbs Implementation Plan Phase 0 decisions (0.2–0.4) since they're schema-configuration questions.

### B.1 Pre-flight decisions (blocking)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| B.1.1 | Confirm `tenants.tenant_type` is alterable (athlete/institution/sponsor). If not, design side-table fallback. | `database-navigation-system.md` | Decision note. | No assumption left open. |
| B.1.2 | Map RLS GUC mechanism — confirm how `app.current_tenant` is set in this codebase. | `database-navigation-system.md` | Note confirming exact `set_config` call site. | Reference query runs under RLS with athlete-tenant set. |
| B.1.3 | Legal review of P0 constraints (COPPA/FERPA/state-NIL/erasure). | — | Compliance sign-off doc. | Legal confirms §12.1/§12.2 design is sufficient for MVP. |
| B.1.4 | Confirm fee parameters (§12.10): platform transaction fee %, guardian-payout split, non-profit pool slice, payer-keyed tier matrix. | `bsaas-purchase-flow.md` | Fee config values recorded. | Numbers signed off; tier payer matrix confirmed. |

### B.2 Schema transformation

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| B.2.1 | Strip commerce models from `schema.prisma` (MIGRATION_DESIGN §2.2 DROP list: products, inventory, storefronts, directory, barcode, GBP, GMC, digital downloads, cart, shipments, business hours, feed, store reviews, featured products, etc.). | — | Cleaned `schema.prisma`. | `prisma validate` passes. |
| B.2.2 | Rename/repurpose models (MIGRATION_DESIGN §3.2: orders→nil_deals, order_items→nil_deal_milestones, payments→nil_payments, bot_product_embeddings→bot_athlete_embeddings, mv_storefront_discovery→mv_athlete_discovery). Add `tenant_type` column to `tenants`. | — | Renamed `schema.prisma`. | `prisma validate` passes. |
| B.2.3 | Add all NIL models from TECHNICAL_SPEC §14 (athlete_profiles_list, guardians_list, guardian_athlete_links_list, athlete_tenant_memberships_list, consent_records_list, highlight_media_list, athlete_metrics_list, athlete_achievements_list, recruiting_boards_list, scout_ratings_list, sponsorship_deals_list, escrow_milestones_list, nonprofit_allocation_pools_list, nil_eligibility_rules_list, moderation_cases_list, message_threads_list, fan_badges_list, nil_leads_list, data_erasure_requests_list, payout_schedules_list, sponsor_spend_limits_list, nil_offers_list, nil_events_list, tenant_nil_*_options_settings tables, **nil_invitations_list**, **nil_onboarding_sessions_list** (§18 invitation + onboarding tables)). | `tenant-scoped-id-generation.md`, `database-navigation-system.md` | Full NIL schema. | `prisma validate` passes. |
| B.2.4 | Generate + run initial migration on new Supabase. | — | Migration `nil_initial_schema`. | `prisma migrate dev` succeeds; all tables created. |
| B.2.5 | Create RLS policies per athlete-tenant (TECHNICAL_SPEC §14.10) + dual-visibility policies for cross-tenant tables (sponsorship_deals_list). | `database-navigation-system.md` | RLS policies applied. | Cross-athlete query returns 0 rows; deal visible to sponsor+guardian only. |
| B.2.6 | Create guardian-required trigger (`nil_require_guardian_for_minor`) on CRM tables. | `database-navigation-system.md` | Trigger applied. | Minor-subject CRM record without guardian → DB error. |
| B.2.7 | Create `mv_athlete_discovery` materialized view (replaces `mv_storefront_discovery`). | — | Materialized view + refresh function. | View queryable; returns athlete profiles. |
| B.2.8 | Seed base data: tiers (payer-keyed), features (NIL keys), capability types (nil_landing/roster/guardian/recruiting/sponsorship/achievements/fan_network/compliance/finance/crm/bot), eligibility rules, navigation links, bot guardrails (child-safety). | — | Seed scripts. | All base data present in DB. |

**Gate:** Stage C does not start until B.1.1–B.1.4 (blocking decisions) and B.2.1–B.2.8 are green.

---

## Stage C — API Code Cleanup + NIL Core Services (Migration M2 + Impl Phase 2 services)

**Objective:** Commerce routes/services deleted, NIL ID generators + base singletons + core services + NIL resolvers in place. API compiles clean.

### C.1 Strip commerce code

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| C.1.1 | Delete all commerce API routes (MIGRATION_DESIGN §2.2 DROP list: products, inventory, storefronts, shops, directory, GBP, GMC, barcode, scan, digital downloads, cart, shipments, business hours, feed, store reviews, featured products, social commerce, recommendations, image enrichment, clone, etc.). | — | Commerce routes removed. | No broken imports from `index.ts`. |
| C.1.2 | Delete all commerce API services (MIGRATION_DESIGN §2.2 DROP list). | — | Commerce services removed. | No broken imports. |
| C.1.3 | Delete commerce-specific middleware (`image-search-limits.ts`, `sku-limits.ts`). | — | Middleware cleaned. | No broken imports. |
| C.1.4 | Delete commerce-specific test/doc files in `routes/`. | — | Clean routes directory. | No commerce .md/.bat/.ps1/.sh test files remain. |

### C.2 Add NIL ID generators

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| C.2.1 | Add all NIL ID generators to `id-generator.ts` (TECHNICAL_SPEC §6): `generateAthleteTenantId`, `generateGuardianId`, `generateGuardianAthleteLinkId`, `generateAthleteMembershipId`, `generateHighlightId`, `generateAthleteMetricsId`, `generateAchievementId`, `generateConsentRecordId`, `generateSponsorshipDealId`, `generateNilOfferId`, `generateEscrowId`, `generateNilEventId`, `generateBadgeAwardId`, `generateThreadId`, `generateModerationCaseId`, `generateRecruitingBoardId`, `generateNilLeadId`, `generateNilInvitationId`, `generateOnboardingSessionId`. | `tenant-scoped-id-generation.md` | `id-generator.ts` entries. | All formats match spec §6; collision check done. |

### C.3 NIL base singleton classes (API side — no API-side bases needed; these are web-only)

> Note: The NIL base singleton classes (§13 of TECHNICAL_SPEC) are web-side only. The API side uses `UniversalSingleton` directly for backend services. No API-side action needed here.

### C.4 Replace commerce resolvers with NIL resolvers

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| C.4.1 | Delete commerce resolvers: `CommerceResolver`, `StorefrontTypeResolver`, `FulfillmentResolver`, `BarcodeScanResolver`, `ProductOptionsResolver`, `FeaturedOptionsResolver`, `QuickstartOptionsResolver`, `StorefrontOptionsResolver`, `DirectoryEntryOptionsResolver`, `SocialCommerceOptionsResolver`. | — | Commerce resolvers removed. | No broken imports from `resolvers/index.ts`. |
| C.4.2 | Keep shared resolvers: `PaymentGatewayResolver` (for deal payments), `FaqOptionsResolver` (for NIL bot KB), `OrgOptionsResolver` (for org structures). Update `CrmOptionsResolver` → `NilCrmOptionsResolver`, `ChatbotOptionsResolver` → `NilBotOptionsResolver`. | — | Shared resolvers retained; NIL options resolvers created. | Resolvers compile. |
| C.4.3 | Add NIL resolvers: `NilLandingResolver`, `NilRosterResolver`, `NilGuardianResolver`, `NilRecruitingResolver`, `NilSponsorshipResolver`, `NilAchievementsResolver`, `NilFanNetworkResolver`, `NilComplianceResolver`, `NilFinanceResolver`. | `add-capability-feature.md`, `capability-deployment-flow.md` | NIL resolver files. | Each resolver returns correct capability shape. |
| C.4.4 | Update `EffectiveCapabilityResolver.ts`: replace commerce resolver imports with NIL resolvers; update `MerchantSettingsBundle` type for NIL settings tables. | `capability-system-integration.md` | Updated orchestrator. | `resolveEffectiveCapabilities()` dispatches to NIL resolvers. |

### C.5 Add NIL backend services

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| C.5.1 | `AthleteProfileService` (CRUD + status transitions, guardian-authorized). | `deploy-service-extending-base-singleton.md` | Backend service. | Non-`consent_authority` write → 403. |
| C.5.2 | `GuardianConsentService` (scoped consent grant/revoke, ownership checks). | `deploy-service-extending-base-singleton.md` | Backend service. | Consent ledger writable; revocation cascade works. |
| C.5.3 | `MediaModerationService` (queue + allowlist validation). | — | Backend service + allowlist. | Non-allowlisted host rejected; media can't publish unmoderated. |
| C.5.4 | `NilRosterService` (public approved roster reads, cached per-atk). | `troubleshooting-public-page-api-leaks.md` | Public read route; DTO mappers strip PII. | PII projection test passes; GPA only with consent. |
| C.5.5 | `NilLeadService` (pre-tenant lead capture). | `deploy-service-extending-base-singleton.md` | Backend service + public route. | Lead writes succeed; no PII publicly readable. |
| C.5.6 | `InvitationService` (bidirectional invitation CRUD, lifecycle, guardian consent gate, anti-spam, connection establishment — TECHNICAL_SPEC §18). | `deploy-service-extending-base-singleton.md` | Backend service + routes. | Invitation create/accept/reject/withdraw works; guardian gate blocks minor self-accept. |
| C.5.7 | `OnboardingService` (actor-aware onboarding state machine, step tracking, completion %). | `deploy-service-extending-base-singleton.md` | Backend service + routes. | Per-actor step sequences return correct completion %. |

### C.6 Repurpose commerce services for NIL

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| C.6.1 | Repurpose checkout/payment services for deal-as-purchase flow (sponsor=buyer, athlete-tenant=storefront, guardian=payee). | `bsaas-purchase-flow.md` | Modified checkout routes/services. | Deal payment flow compiles; escrow milestone logic present. |
| C.6.2 | Repurpose subscription billing for institution/sponsor tier billing. | — | Modified billing routes. | Tier subscription flow compiles for payer-keyed model. |
| C.6.3 | Update CRM services for NIL actor types + athlete/guardian scoping. | `alerts-and-notifications.md` | Modified CRM services. | CRM services compile with NIL columns; `actor_type` extended. |
| C.6.4 | Update bot services for NIL personas + child-safety guardrails. | `add-chatbot-skill.md` | Modified bot services. | Bot services compile with NIL scoping; guardrails seeded. |

### C.7 Update auth + middleware

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| C.7.1 | Update auth middleware (`auth.ts`, `role-validation.ts`, `permissions.ts`) for NIL roles. | — | Updated middleware. | All 8 NIL roles validate correctly. |
| C.7.2 | Update `index.ts` route mounting: remove commerce route mounts, add NIL route mounts. | — | Updated server entry. | Server starts without errors. |
| C.7.3 | `pnpm checkapi` — zero TS errors. | — | Clean build. | Build passes. |

**Gate:** Stage D does not start until C.1–C.7 are green.

---

## Stage D — Web Code Cleanup + NIL Core Frontend (Migration M3)

**Objective:** Commerce frontend deleted, NIL base singletons + web services + rebranded UI in place. Web compiles clean.

### D.1 Strip commerce frontend

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| D.1.1 | Delete commerce routes: `/products/*`, `/shops/*`, `/directory/*`, `/items/*`, `/cart/*`, `/carts/*`, `/checkout/*`, `/orders/*`, `/my-orders/*`, `/downloads/*`, `/catalog/*`, `/category-discovery/*`, `/cross-tenant/*`, `/test-*`, `/debug/*`, `/sentry-example-page/*`. | — | Commerce routes removed. | No broken imports. |
| D.1.2 | Delete commerce API route handlers in `apps/web/src/app/api/` (strip commerce, keep auth/health/CRM/bot). | — | Clean API route handlers. | No broken imports. |
| D.1.3 | Delete commerce web services, components, hooks. | — | Clean web src. | No broken imports. |

### D.2 Add NIL base singleton classes (web side)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| D.2.1 | `NilPublicApiSingleton` (extends `PublicApiSingleton`, TTL 5–15 min, no auth headers). | `deploy-service-extending-base-singleton.md` | Base class. | TTL/isolation defaults set; singleton enforced. |
| D.2.2 | `AthleteApiSingleton` (extends `TenantApiSingleton`, TTL 0, `X-Tenant-ID` = athlete-tenant). | `deploy-service-extending-base-singleton.md`, `server-resolved-context-delegator.md` | Base class. | TTL/headers/isolation defaults set; singleton enforced. |
| D.2.3 | `GuardianApiSingleton` (extends `CustomerApiSingleton`, TTL 0, `X-Guardian-ID`). | `deploy-service-extending-base-singleton.md` | Base class. | TTL/headers set; singleton enforced. |
| D.2.4 | `ComplianceApiSingleton` (extends `AdminApiSingleton`, TTL 0, `X-Audit-ID`). | `deploy-service-extending-base-singleton.md` | Base class. | TTL/headers set; singleton enforced. |
| D.2.5 | `InstitutionApiSingleton` (extends `TenantApiSingleton`, TTL 0, `X-Tenant-ID` = institution). | `deploy-service-extending-base-singleton.md` | Base class. | TTL/headers set; singleton enforced. |
| D.2.6 | `SponsorApiSingleton` (extends `TenantApiSingleton`, TTL 0, `X-Tenant-ID` = sponsor). | `deploy-service-extending-base-singleton.md` | Base class. | TTL/headers set; singleton enforced. |
| D.2.7 | `FanApiSingleton` (extends `AuthenticatedApiSingleton`, short TTL, `X-User-ID`). | `deploy-service-extending-base-singleton.md` | Base class. | TTL/headers set; singleton enforced. |

### D.3 Add NIL web services

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| D.3.1 | `NilPublicRosterService` (extends `NilPublicApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.2 | `AthleteService` (extends `AthleteApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.3 | `GuardianService` (extends `GuardianApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.4 | `InstitutionService` (extends `InstitutionApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.5 | `SponsorService` (extends `SponsorApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.6 | `FanService` (extends `FanApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.7 | `ComplianceService` (extends `ComplianceApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.8 | `NilLeadService` web side (extends `NilPublicApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.9 | `NilInvitationService` web side (extends appropriate actor base — `GuardianApiSingleton`/`InstitutionApiSingleton`/`SponsorApiSingleton`/`FanApiSingleton`). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |
| D.3.10 | `NilOnboardingService` web side (extends appropriate actor base). | `deploy-service-extending-base-singleton.md` | Web service. | Service compiles; singleton enforced. |

### D.4 Update core infra

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| D.4.1 | Update `proxy.ts` with new `PLATFORM_DOMAINS` for NIL brand domain. | — | Updated proxy. | Proxy routes correctly for NIL domain. |
| D.4.2 | Update `AuthContext.tsx` / `ServerResolvedContextProvider` for NIL actor types. | `server-resolved-context-delegator.md` | Updated auth context. | Auth flow works with new Auth0 tenant. |
| D.4.3 | Update `UnifiedCapabilityService` for NIL capability keys. | `capability-system-integration.md` | Updated service. | Service requests NIL capabilities. |
| D.4.4 | Update `rbac.ts` config with NIL roles/permissions. | — | Updated RBAC config. | All NIL roles have correct permissions. |
| D.4.5 | Update navigation links in database for NIL sidebar. | `database-navigation-system.md` | Reseeded nav links. | All sidebar items correct for NIL. |

### D.5 Rebrand

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| D.5.1 | Rebrand UI: colors, logo, fonts, email templates, Sentry project name. | — | Rebranded UI. | No VisibleShelf branding remains. |

### D.6 Build verification

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| D.6.1 | `pnpm checkweb` — zero TS errors. | — | Clean build. | Build passes. |

**Gate:** Stage E does not start until D.1–D.6 are green.

---

## Stage E — The Credibility Shell (Impl Phase 1)

**Objective (spec §4 Phase 1):** Static, edge-routed marketing presence + lead capture. No private data. This is the first NIL feature built on the clean platform foundation.

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| E.1 | Marketing landing route + NIL brand domain in `proxy.ts` env config. | `add-storefront-type.md` | Next.js marketing segment; domain config. | TLS handshake + 200 on landing (spec §10 item 1). |
| E.2 | Lead intake form (athlete/parent vs sponsor vs investor) via `NilPublicApiSingleton` → `NilLeadService`. | `deploy-service-extending-base-singleton.md`, `troubleshooting-public-page-api-leaks.md` | Public route; Zod schema. | No PII publicly readable; lead writes succeed; no raw `fetch`. |
| E.3 | Register `nil_landing` capability (tier-only, all tiers, full 8-phase pipeline). | `add-capability-feature.md`, `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `link-features-to-capability-type.md`, `capability-system-integration.md`, `verify-capability-deployment.md` | Feature def + seed + resolver + route + mapper + hook + dashboard rows. | `verify-capability-deployment.md` checklist passes. |

**Milestone:** Investor-ready public shell live; leads captured; zero private surfaces.

**Gate:** Stage F does not start until E.1–E.3 are green.

---

## Stage F — The Native Pipeline (Impl Phase 2)

**Objective (spec §4 Phase 2):** Secure data loop: intake → pending → review → approved public roster. Athlete-as-tenant + firewall + P0 safety gates.

### F.1 Data foundations (schema already created in Stage B — verify + extend)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| F.1.1 | Verify enums + athlete-tenant extension (`tenant_type`, `athlete_profiles_list`) from Stage B.2.3 are correct. | `tenant-scoped-id-generation.md`, `database-navigation-system.md` | Verification note. | Athlete provisions as a `tenant`; RLS enabled. |
| F.1.2 | Verify guardianship + consent tables from Stage B.2.3 are correct. | `database-navigation-system.md` | Verification note. | Versioned/scoped consent ledger writable. |
| F.1.3 | Verify media/metrics/achievement tables from Stage B.2.3 are correct. | `product-video.md` (facade), `database-navigation-system.md` | Verification note. | Media defaults `pending`; allowlist column present. |
| F.1.4 | Verify RLS policies from Stage B.2.5 are correct. | `database-navigation-system.md` | Verification note. | Cross-athlete query returns zero rows (spec §10 RLS test). |

### F.2 Services (already created in Stage C.5 — verify + wire)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| F.2.1 | Verify `AthleteProfileService` (CRUD + status transitions, guardian-authorized) + `GuardianConsentService` from Stage C.5.1–C.5.2. | `deploy-service-extending-base-singleton.md` | Wired services. | Non-`consent_authority` write → 403 (spec §8 hard rule). |
| F.2.2 | Verify `MediaModerationService` from Stage C.5.3. | — | Wired service. | Non-allowlisted host rejected; media can't publish unmoderated. |
| F.2.3 | Verify `NilRosterService` + public roster route from Stage C.5.4. | `troubleshooting-public-page-api-leaks.md` | Public read route; DTO mappers strip PII. | PII projection test passes (spec §10); GPA only with consent. |

### F.3 Capability + firewall + cache

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| F.3.1 | Register `nil_roster` capability (master toggle + tier row caps) end-to-end (all 8 phases). | `add-capability-feature.md`, `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `link-features-to-capability-type.md`, `capability-system-integration.md`, `verify-capability-deployment.md` | Resolver `resolveNilRoster`, route, mapper, hook, dashboard rows. | `verify-capability-deployment.md` passes; R13 expired-manifest works. |
| F.3.2 | Register `nil_compliance` as a Phase-2 prerequisite (manual verdict initially). | `add-capability-feature.md` | Compliance status gate. | No profile reaches `approved` without verdict. |
| F.3.3 | Visibility state machine + per-athlete cache eviction on status/consent change. | `cross-context-cache-invalidation.md` | Cache contract on `AthleteApiSingleton`. | Approve → roster reflects within one request; full namespace eviction. |

### F.4 P0 safety gates (blocking)

| # | Task | Skill | Deliverables | Acceptance (spec §12.12) |
|---|---|---|---|---|
| F.4.1 | COPPA guardian-initiated intake for under-13. | — | Age-band logic; guardian-only registration. | Athlete-initiated under-13 intake → 403. |
| F.4.2 | Consent revocation cascade → `archived` + full cache eviction. | `cross-context-cache-invalidation.md` | Revocation flow. | Revoke removes profile+media within one request. |
| F.4.3 | Media moderation gate + host allowlist. | — | Moderation enforcement. | Unmoderated/non-allowlisted media never public. |

**Milestone:** A guardian can create an athlete-tenant, grant scoped consent, pass moderation+compliance, and see the athlete on the public roster — with every P0 negative-path test green.

**Gate:** Stage G does not start until F.1–F.4 are green (P0 gates are hard blockers).

---

## Stage G — The Unified Service (Impl Phase 3)

**Objective (spec §4 Phase 3):** Authenticated portals, cross-platform engagement (CRM + bot), distinct privacy rules.

### G.1 Memberships

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| G.1.1 | `athlete_tenant_memberships_list` + `AthleteMembershipService` (transfers). Schema from Stage B.2.3. | `tenant-scoped-id-generation.md` | Service + routes. | Transfer preserves history; cross-tenant row visible to both. |

### G.2 Persona capabilities (each full 8-phase)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| G.2.1 | `nil_guardian` (dashboard, scoped consent, financial routing). | `add-capability-feature.md`, `capability-deployment-flow.md` | Full capability. | `verify-capability-deployment.md` passes. |
| G.2.2 | `nil_recruiting` (boards, ratings) — guardian-gated contact. | `add-capability-feature.md` | Full capability. | Adult→minor contact impossible (spec §12.2). |
| G.2.3 | `nil_sponsorship` (cross-tenant deals). | `add-capability-feature.md`, `add-org-capability.md` | Full capability + deal RLS (spec §12.4). | Deal visible to sponsor+guardian only. |
| G.2.4 | `nil_achievements` (verified milestones). | `add-capability-feature.md` | Full capability. | Achievements feed profile only when `approved`. |
| G.2.5 | `nil_fan_network` (**always-free, not tier-gated**, spec §12.9). | `add-capability-feature.md` | Platform-default resolver. | Resolves from platform default, never `tier_features_list`. |

### G.3 Per-actor dashboards (spec §15)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| G.3.1 | Guardian, Athlete, Institution, Sponsor, Fan, Compliance dashboards. | `fix-tenant-dashboard-load-loop.md`, `dashboard-performance-audit.md`, `server-resolved-context-delegator.md`, `debug-infinite-render-loops.md` | Dashboards reusing `CrmPageShell`/`CrmNavPanel`. | No polling loop; unread via `getReadState`; scoped per base. |

### G.4 Internal CRM (spec §16)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| G.4.1 | CRM deltas: verify `athlete_tenant_id`/`guardian_id` columns + guardian-required trigger from Stage B.2.6. Add `tenant_nil_crm_options_settings` if not already created. | `database-navigation-system.md`, `alerts-and-notifications.md` | Verification + any missing migration. | Minor-subject ticket without guardian → DB error. |
| G.4.2 | NIL CRM surfaces (Compliance/Institution+Sponsor/Guardian) mirroring 3-surface CRM. | `alerts-and-notifications.md`, `deploy-service-extending-base-singleton.md` | Services + routes + `actor_type` extension. | PII never projected without consented relationship. |
| G.4.3 | Register `nil_crm` capability. | `add-capability-feature.md` | Full capability. | `requireFeature(tenantId, 'nil_crm')` gates services. |

### G.5 Bot infrastructure (spec §17)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| G.5.1 | Bot deltas: verify conversation athlete/guardian scoping + `is_minor_safe` + `tenant_nil_bot_options_settings` from Stage C.6.4. | `database-navigation-system.md` | Verification. | Conversations scoped to athlete-tenant. |
| G.5.2 | NIL bot personas (Compliance/Eligibility, Guardian Onboarding, Recruiting/Sponsor FAQ, Fan). | `add-chatbot-skill.md`, `add-ai-provider.md`, `bot-widget-troubleshooting.md` | Bot configs + RAG sources. | Eligibility bot RAG over `nil_eligibility_rules_list`. |
| G.5.3 | Seed `bot_guardrail_rules` for §17.2 child-safety. | `add-chatbot-skill.md` | `seed-nil-bot-guardrails.ts`. | No minor PII in responses; unanswered → CRM escalation. |
| G.5.4 | Register `nil_bot` capability. | `add-capability-feature.md` | Full capability. | Gated; merchant prefs persisted. |

### G.6 Invitation & Onboarding System (spec §18)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| G.6.1 | Invitation routes: `POST /api/:scope/invitations`, `GET /api/:scope/invitations`, `GET /api/:scope/invitations/pending`, `GET /api/invitations/:token`, `POST /api/invitations/:token/accept`, `POST /api/invitations/:token/reject`, `POST /api/:scope/invitations/:id/withdraw`, `POST /api/guardian/invitations/:id/approve`, `POST /api/guardian/invitations/:id/reject`. | `deploy-service-extending-base-singleton.md` | Invitation routes wired to `InvitationService` from C.5.6. | Create/accept/reject/withdraw/guardian-approve all work; anti-spam 30-day block enforced. |
| G.6.2 | Onboarding routes: `GET /api/:scope/onboarding`, `POST /api/:scope/onboarding/step/:step`, `POST /api/:scope/onboarding/step/:step/skip`. | `deploy-service-extending-base-singleton.md` | Onboarding routes wired to `OnboardingService` from C.5.7. | Step completion advances state; skip works for non-blocking steps. |
| G.6.3 | Invitation frontend: `InvitationWidgetPanel` (dashboard right rail), `InvitationModal`, `InvitationAcceptancePage` (`/invite/:token`), `InvitationManagementPage`, `InviteButton` (contextual). | `deploy-service-extending-base-singleton.md` | Frontend components. | Pending invitations render on all dashboards; invite modal sends; acceptance page works for unregistered users. |
| G.6.4 | Onboarding frontend: `OnboardingWizard` (multi-step modal), `OnboardingProgressBanner` (dashboard). | `deploy-service-extending-base-singleton.md` | Frontend components. | Wizard shows correct steps per actor type; progress banner appears for incomplete onboarding. |
| G.6.5 | Email templates for invitations: `nil-invitation-membership`, `nil-invitation-sponsorship`, `nil-invitation-coaching`, `nil-invitation-co-guardian`, `nil-invitation-follow`, `nil-invitation-deal-inquiry`. | — | Email templates in `email-service.ts`. | All templates render with correct CTA link to `/invite/:token`. |
| G.6.6 | Connection establishment side effects: membership → `athlete_tenant_memberships_list` + roster cache eviction; sponsorship → relationship + `nil_deals` consent scope; coaching → following + `messaging` consent scope; co_guardianship → `guardian_athlete_links_list`; follow → `fan_follows_list` + badge check; deal_inquiry → relationship + draft deal. | `cross-context-cache-invalidation.md` | Side effect handlers in `InvitationService.establishConnection()`. | Each connection type creates correct row + fires cache invalidation + triggers Next Steps update. |

**Milestone:** All personas have scoped portals; cross-platform engagement (CRM + bots) live; every adult↔minor interaction guardian-gated; bidirectional invitations drive network-effect growth; actor-aware onboarding guides every user to completion.

**Gate:** Stage H does not start until G.1–G.6 are green.

---

## Stage H — Full Multi-Tenant Mesh (Impl Phase 4)

**Objective (spec §4 Phase 4):** High-volume isolation, automated compliance, finance.

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| H.1 | Advanced RLS audit across all athlete-owned + cross-tenant tables. | `database-navigation-system.md` | Policy review. | Isolation + dual-visibility tests pass. |
| H.2 | `ComplianceVettingService` (automated state/association eligibility) + `nil_eligibility_rules_list` seed. | `add-capability-feature.md` | Service + rules data. | Deal blocked where `deals_allowed=false` (spec §12.12). |
| H.3 | Financial infra: deal-as-purchase transaction fee (§12.10) + `EscrowLedgerService` (double-entry) + guardian KYC/W-9 + payout routing + non-profit pool slice. | `bsaas-purchase-flow.md`, `deploy-service-extending-base-singleton.md` | Escrow + ledger + finance tables (spec §14.8); fee deducted at `settled`. | Payout requires guardian KYC; ledger balances; platform fee + pool slice recorded per deal. |
| H.4 | Register `nil_compliance` (auto) + `nil_finance` capabilities (highest tier, hard gate). | `add-capability-feature.md`, `add-org-capability.md` | Full capabilities. | Expired tenant → 200 disabled manifest (R13). |
| H.5 | `DataErasureService` (right-to-erasure cascade + certificate). | `cross-context-cache-invalidation.md` | Erasure workflow (spec §14.9). | Cascade archives→anonymizes→deletes + evicts all caches. |
| H.6 | Age-out job (18 → athlete gains financial scope, ledger retained). | `structured-logging.md` | Scheduled job. | Control transfers; consent ledger preserved. |

**Milestone:** Enterprise-grade isolation, automated compliance, and compliant money movement.

---

## Cross-Cutting Workstreams (every stage)

| Concern | Skill | Standing requirement |
|---|---|---|
| Observability | `structured-logging.md`, `correlation-id-troubleshooting.md` | Every status/consent/deal/payout transition emits `X-Audit-ID` (spec §12.11). |
| Cache correctness | `cross-context-cache-invalidation.md` | Every minor-data mutation enumerates ALL cache namespaces (spec §3.3). |
| Public leak prevention | `troubleshooting-public-page-api-leaks.md` | CI grep gate: no PII fields on `/api/public/*`. |
| No raw fetch / no UUID ids | `deploy-service-extending-base-singleton.md`, `tenant-scoped-id-generation.md` | CI grep gate in every PR. |
| Capability correctness | `verify-capability-deployment.md` | Run after every capability task. |
| i18n | (PR template `pr-fe-i18n.md`) | All compliance/bylaw copy localizable per state. |

---

## Verification & Test Strategy

Translated from `TECHNICAL_SPEC.md` §10 + §12.12. **All P0 negative-path tests are release-blocking.**

- **Build gates (every task):** `pnpm checkapi`, `pnpm checkweb` → zero TS errors.
- **P0 negative paths (Stage F+):** under-13 self-register → 403; no adult↔minor thread without guardian; consent revocation cascade; deal blocked by state rule; media moderation gate.
- **P1 paths (Stage G+):** conflicting-guardian most-restrictive-wins; cross-tenant deal isolation; payout KYC gate; age-out lifecycle; invitation guardian consent gate (minor cannot self-accept); re-invitation 30-day block after rejection; onboarding step completion advances state correctly per actor type.
- **Infra:** RLS cross-athlete isolation; cache TTL split (public 5–15m, private 0); cache eviction on approve; tenant-scoped-id grep gate.
- **Capability:** per-capability `tierState` + R13 expired manifest via `verify-capability-deployment.md`.

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Prisma schema breaks after stripping 100+ models | High | Do schema cleanup in one pass; run `prisma validate` after each batch of removals. |
| Broken imports after deleting commerce routes/services | High | Delete in dependency order (routes → services → models); run `pnpm checkapi`/`checkweb` after each batch. |
| State NIL law changes mid-build | High | `nil_eligibility_rules_list` is data-driven; no code change to update rules. |
| Partial cache eviction leaks minor data | High (safety) | `cross-context-cache-invalidation.md` + enumerate-all-namespaces rule (§3.3). |
| Bot reveals non-consented data | High (safety) | Guardrails at RAG retrieval filter (§17.2), not just prompt; seeded in G.5.3. |
| Auth0 role mapping breaks | Medium | Test all NIL roles end-to-end in Stage D.4.2. |
| RLS policies not applied correctly on new Supabase | High | Run RLS isolation test in B.2.5 before any code deployment. |
| CRM guardian-required trigger blocks legitimate operations | Medium | Test with both minor and adult athlete-tenants in G.4.1. |
| Missing env vars on new infrastructure | Medium | Use Doppler checklist from Stage A.6; verify all vars present before deployment. |
| Dashboard request storms | Medium | `fix-tenant-dashboard-load-loop.md` + server-resolved context. |

---

## First Executable Slice (when Stage F is greenlit)

The smallest end-to-end vertical that proves the architecture (recommended first build target after Stage E):

1. `generateAthleteTenantId` + `athlete_profiles_list` + RLS (Stage B.2.3 + B.2.5 — verify).
2. `AthleteApiSingleton` + `GuardianApiSingleton` + `GuardianConsentService` (Stage D.2.2–D.2.3 + Stage C.5.1–C.5.2 — verify).
3. `nil_roster` capability + public roster route with consent filtering (Stage F.3.1 + F.2.3).
4. P0 tests F.4.1–F.4.3.

This slice exercises athlete-as-tenant, the firewall, scoped consent, capability gating, and the P0 safety gates in one thin path — validating the entire blueprint before breadth is added.

---

## Stage-to-Source Mapping

For traceability, each stage maps back to the source documents:

| Stage | Migration Design | Implementation Plan | TECHNICAL_SPEC |
|---|---|---|---|
| A (infra) | §1 (M0) | — | — |
| B (schema) | §3 (M1) | Phase 0 (0.1–0.4) | §14 (DDL), §12.10 (fees), §18 (invitations DDL) |
| C (API core) | §4 (M2) | Phase 2 §3.1–3.2 (services) | §9 (services), §13 (bases), §6 (IDs), §18 (invitation/onboarding services) |
| D (web core) | §4 (M3) | — | §13 (bases) |
| E (shell) | §5 (M5→Phase 1) | Phase 1 (1.1–1.4) | §4 Phase 1 |
| F (native pipeline) | — | Phase 2 (2.1–2.15) | §4 Phase 2, §8, §12.12 |
| G (unified service) | — | Phase 3 (3.1–3.15) | §4 Phase 3, §15, §16, §17, §18 (invitation/onboarding frontend) |
| H (enterprise mesh) | — | Phase 4 (4.1–4.6) | §4 Phase 4, §14.8–14.9 |
