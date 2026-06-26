# Technical Specification: NIL Youth Sports Platform

**Document Version:** 1.0 (derived from Functional Spec v1.0)
**Source Functional Spec:** `.agents/skills/nil-youth-sports-platform/SKILL.md`
**Target Architecture:** `retail-visibility-platform` (multi-tenant, two-tier singleton + capability-gated)
**Project Phase Scope:** MVP Core Integration & Scalable Private Foundation

---

## 0. How This Spec Maps to the Existing Platform

This platform is already a **multi-tenant marketplace with a two-tier singleton infrastructure, a tier/merchant capability-gating system, tenant-scoped ID generation, and a public/private request pipeline split**. The NIL Youth Sports product is implemented as a **vertical on top of these primitives** — not a greenfield build. Every functional requirement below is realized by reusing an existing architectural pattern.

| Functional Concept (Spec §) | Existing Architecture Primitive | Reference Skill |
|---|---|---|
| Two-Tier Architecture (§3) | `PublicApiSingleton` (cached) vs private mutation pipeline via `proxy.ts` + authenticated singletons (0-TTL) | `deploy-service-extending-base-singleton.md` |
| State-driven DB firewall (§3) | `pending`/`approved`/`archived` status columns + `approved`-gated public read routes | `capability-data-flow-rules.md` (R13 pattern), RLS |
| Persona portals (§2) | Auth0 roles + domain singleton bases (`Tenant`, `Customer`, `Admin`, `Public`, `Authenticated`) | `deploy-service-extending-base-singleton.md` §1.1 |
| Phased feature rollout (§4) | Capability types + tier/merchant gates + 8-phase deployment pipeline | `capability-deployment-flow.md` |
| Master Data Tracks (§5) | Tenant-scoped entity tables with tenant-traceable IDs + flexible JSON metadata columns | `tenant-scoped-id-generation.md` |
| RLS isolation per athlete (§4 P4) | Postgres RLS + explicit `WHERE tenant_id = $1` keyed to the **athlete-tenant** + tenant-scoped IDs | `tenant-scoped-id-generation.md` §8 |
| Centralized service manager (§6) | `UniversalSingleton` hierarchy + **NIL context-specific base singletons** (§13) — no raw `fetch` | `deploy-service-extending-base-singleton.md` §3 |

**Core tenancy model — the Athlete IS the tenant.** This is the single most important architectural decision in this spec: **each Student-Athlete is a `tenant`** (`tid-{nanoid}`, `tenant_type='athlete'`). The athlete-tenant is the **data-isolation root** and **every relationship revolves around it**. RLS keyed to the athlete-tenant makes it *structurally impossible* for one athlete's data to leak into another's — the strongest possible privacy guarantee for minors.

All other actors are tenants or accounts that form **explicit relationships with the athlete-tenant**:

| Actor | Modeled As | Relationship to Athlete-Tenant |
|---|---|---|
| **Student-Athlete** | `tenant` (`tenant_type='athlete'`) | **is the tenant** (isolation root) |
| **Legal Guardian** | global account (`guard-{nanoid}`) | **owns/controls** one or more athlete-tenants (`guardian_athlete_links_list`) |
| **School / Club** | `tenant` (`tenant_type='institution'`) | cross-tenant membership (`athlete_tenant_memberships_list`) |
| **Sponsor** | `tenant` (`tenant_type='sponsor'`) | cross-tenant NIL deal (`sponsorship_deals_list`) |
| **Coach / Scout** | account within an institution-tenant | follows/rates athlete-tenants (guardian-gated contact) |
| **Fan** | authenticated account | follows athlete-tenants (public-only) |

> **Why athlete-as-tenant (supersedes the earlier "global identity" idea, see §12.3):** The platform's entire isolation, capability, RLS, cache-namespacing, and tenant-scoped-ID machinery is keyed to `tenant`. Making the athlete a tenant means the athlete inherits all of it for free: per-athlete RLS, per-athlete cache eviction, per-athlete capability gating, and an athlete tenant key (`atk = generateTenantKey(athleteTenantId)`) that prefixes every athlete-owned entity for instant traceability. Multiplicity (an athlete in a school **and** a travel club) is handled by cross-tenant membership rows — the athlete-tenant is the stable root; memberships come and go on transfer.

---

## 1. Actor & Role Model

Map each persona to an Auth0 role + the **NIL context-specific base singleton** (defined in §13) that serves its requests. Each NIL base extends a platform base (`Flexible > {Public, Tenant, Customer, Admin}`) and pre-configures the correct request type, cache TTL, isolation, and headers.

| Persona (Spec §2) | Visibility | Auth Role | NIL Singleton Base (§13) | API Surface |
|---|---|---|---|---|
| Student-Athlete | Public (when `approved`) | `ATHLETE` (minor; no financial scope until age-out) | `NilPublicApiSingleton` (read) · `AthleteApiSingleton` (private, guardian-gated) | `/api/public/athletes/*`, `/api/athletes/:athleteTenantId/*` |
| Sponsor | Public profile + private deal flow | `SPONSOR` | `SponsorApiSingleton` | `/api/sponsors/*`, `/api/nil/deals/*` |
| School / Athletic Dept | Institution-tenant admin | `INSTITUTION_ADMIN` | `InstitutionApiSingleton` | `/api/institutions/:tenantId/roster/*` |
| Coach / Talent Scout | Guarded private | `COACH` | `InstitutionApiSingleton` (coach acts within an institution) | `/api/recruiting/*` |
| Fan | Public + gamified | `FAN` | `FanApiSingleton` | `/api/public/feed/*`, `/api/fans/*` |
| Public Web Tier | Anonymous | none | `NilPublicApiSingleton` | `/api/public/*` |
| **Legal Guardian** | **Zero public visibility** | `GUARDIAN` | `GuardianApiSingleton` (private, 0-TTL) | `/api/guardian/*` |
| Compliance Auditor / Admin | Internal | `PLATFORM_ADMIN` / `COMPLIANCE_AUDITOR` | `ComplianceApiSingleton` | `/api/admin/compliance/*` |

**Rules**
- The `GUARDIAN` role MUST NOT have any `/api/public/*` projection. Guardian data is served exclusively through `GuardianApiSingleton` (JWT + `X-Guardian-ID`) with `cacheTTL = 0`.
- All writes to an athlete-tenant (visibility, media, NIL acceptance, financial routing) MUST be authorized against `guardian_athlete_links_list` — i.e. the caller is a consent-authority guardian of that athlete-tenant (or the athlete themselves after age-out, §12.3). The minor cannot self-publish.
- `AthleteApiSingleton` sets `X-Tenant-ID` to the **athlete-tenant**; all athlete-owned rows are RLS-scoped to it.
- Admin/compliance actions emit an `X-Audit-ID` via `ComplianceApiSingleton` for the legal audit trail.
- Adult roles (`COACH`, `SPONSOR`, `SCOUT`) require identity verification before any contact-adjacent surface (§12.2).

---

## 2. Two-Tier Pipeline Architecture (Technical)

### 2.1 Public Pipeline (Cached, Anonymous Read)

- **Base:** `NilPublicApiSingleton` (extends `PublicApiSingleton`; `credentials=false`, default TTL 10 min). See §13.
- **Use:** Public roster, approved athlete profiles, highlight video metadata, community feed reads, sponsor NIL-portfolio public pages.
- **Caching:** 5–15 min TTL loops per the functional spec. Cache key is namespaced by the athlete tenant key (`atk`) so eviction is per-athlete.
- **Constraint:** Public read routes MUST filter `WHERE visibility_status = 'approved'` AND respect scoped consent (§12.6 — e.g. GPA only if `gpa_display` consent granted). No PII columns (guardian contact, financial routing, DOB, precise location) may ever be projected on public routes (§12.2).

```ts
// apps/web/src/services/NilPublicRosterService.ts — extends the NIL public base (§13)
class NilPublicRosterService extends NilPublicApiSingleton {
  private static instance: NilPublicRosterService;
  private constructor() { super('nil-public-roster'); } // TTL/context/isolation set by base
  public static getInstance() { /* singleton */ }

  async getApprovedRoster(institutionTenantId: string, filters: RosterFilters) {
    return this.makeDefaultRequest(
      `/api/public/institutions/${institutionTenantId}/roster`,
      {}, `nil-roster-${institutionTenantId}-${hash(filters)}`, this.cacheTTL
    );
  }
}
```

### 2.2 Private Pipeline (Zero-Cache Live Proxy, Mutations)

- **Bases (§13):** `GuardianApiSingleton` (guardian session, multi-athlete), `AthleteApiSingleton` (one athlete-tenant), `SponsorApiSingleton` / `InstitutionApiSingleton` (commercial/school tenants), `ComplianceApiSingleton` (vetting/moderation/audit). All set `cacheTTL = 0`.
- **Use:** Profile mutations, NIL deal negotiation/escrow, compliance review, moderation, guardian-gated messaging, financial routing.
- **Caching:** `ttl: 0` — every request hits the live API. No cached read of deal/escrow/PII/consent state.
- **Routing:** All mutations route through `apps/web/src/proxy.ts` (Auth0 session → backend), which attaches the authenticated identity + athlete-tenant context. Backend enforces `authenticateToken` + `checkTenantAccess` (`apps/api/src/middleware/auth.ts`) where tenant = the athlete-tenant.

```ts
// apps/web/src/services/GuardianService.ts — guardian session across all their athletes (§13)
class GuardianService extends GuardianApiSingleton {
  private static instance: GuardianService;
  private constructor() { super('guardian-session'); } // 0-TTL, X-Guardian-ID set by base
  public static getInstance() { /* singleton */ }
  // listMyAthletes, grantScopedConsent, revokeConsent, setFinancialRouting, approveDeal...
}

// apps/web/src/services/AthleteService.ts — scoped to ONE athlete-tenant (§13)
class AthleteService extends AthleteApiSingleton {
  private static instance: AthleteService;
  private constructor() { super('athlete-tenant'); } // 0-TTL, cache contract for roster eviction
  public static getInstance() { /* singleton */ }
  public getServiceCachePatterns() { return ['nil-roster-*', 'nil-profile-*']; }
  public async invalidateServiceCaches(athleteTenantId?: string) { /* evict per atk */ }
  // updateProfile(athleteTenantId), addMedia, setVisibility (guardian-authorized)...
}
```

### 2.3 Centralized Service Manager Mandate (Spec §6, last item)

- **Rule:** No raw `fetch` anywhere. Web → `makeDefaultRequest`; API → `makeAuthenticatedRequest` / `makePublicRequest` from `UniversalSingleton`.
- **Rule:** Every concrete service is a singleton (`private static instance`, `private constructor`, `public static getInstance()`).
- **Rule:** Athlete-tenant services implement the cache contract (`getServiceCachePatterns`, `invalidateServiceCaches`) so a visibility/consent change evicts the public roster + profile cache for that athlete (§3.3).

---

## 3. State-Driven Database Firewall

A workflow-flag column gates every record from public exposure. This is the technical realization of the "no minor goes live without parental + compliance confirmation" requirement.

### 3.1 Visibility State Machine

```
draft ──> pending ──> approved ──> archived
              │            │
              └──> rejected┘   (compliance/guardian denial)
```

- Column: `visibility_status visibility_status_enum NOT NULL DEFAULT 'pending'`
- Allowed public exposure: **only** `approved`.
- Transition `pending → approved` requires **all** gates true (see §8):
  1. `public_profile` consent granted in `consent_records_list` by a `consent_authority` guardian (§12.6)
  2. `compliance_status = 'cleared'` (Phase 2 manual / Phase 4 auto-vetting)
  3. all attached media `moderation_status = 'cleared'` (§12.7)

### 3.2 Enforcement Layers (defense in depth)

1. **API route guard:** Public roster route returns zero records unless `visibility_status = 'approved'`. (Verification §10 item 2.)
2. **RLS policy:** Postgres row-level security on all athlete-owned tables, enforced via `WHERE tenant_id = $1` keyed to the **athlete-tenant**, so one athlete's data can never leak into another's even on a query bug. Cross-tenant relationship rows (memberships, deals) are the *only* rows visible to a second tenant, and only to the explicitly-related one (§12.4).
3. **Consent guard:** Public DTO mappers project a field only if the matching scoped consent is granted (§12.6) and strip all PII regardless of status.

### 3.3 Cache Eviction on State Change

When an admin or guardian toggles visibility/consent, the mutating service calls `invalidateServiceCaches(athleteTenantId)` (the `AthleteApiSingleton` cache contract) → evicts **every** athlete-namespaced key (`nil-roster-*`, `nil-profile-{atk}-*`, `nil-feed-*`, sponsor-portfolio). Partial eviction = stale minor data live = a safety incident (§12.11). On the API, the backend invalidates the effective-capabilities + roster cache keys.

---

## 4. Phased Functional Implementation Roadmap (Technical)

Each phase is delivered as one or more **capability types** registered through the 8-phase capability deployment pipeline (`capability-deployment-flow.md`). NIL features are tier-gated (what the plan permits) and merchant-gated (what the school/sponsor toggles on).

### Phase 1 — The Credibility Shell (Investor Validation)

**Objective:** Static, edge-routed marketing presence + lead capture. No private data.

| Requirement | Technical Implementation |
|---|---|
| World-class static landing page | Next.js public route under `apps/web/src/app/` (marketing segment), served via `PublicApiSingleton` data only |
| Custom agency brand domain | Platform-subdomain + custom-domain routing already handled in `proxy.ts` (`PLATFORM_DOMAINS`, `isPlatformSubdomain`) — add NIL brand domain to env config |
| Edge-routed HTTPS/SSL | Existing Vercel/edge hosting; DNS pointed to edge infra (Verification §10 item 1) |
| Email capture (athlete/parent vs sponsor vs investor) | Single intake table `nil_leads_list` with `lead_type` enum; written via an authenticated/system route; no PII publicly readable |

**Capability:** `nil_landing` (no merchant prefs; enabled at all tiers). Minimal — mostly static.

### Phase 2 — The Native Pipeline (Core Ingestion & Display)

**Objective:** Secure data loop: intake → pending → admin approve → public roster.

| Requirement | Technical Implementation |
|---|---|
| Profile Intake | Zod-validated form. **Guardian-initiated** (COPPA, §12.1): creating an athlete provisions an **athlete-tenant** (`tenant_type='athlete'`) + a `guardian_athlete_links_list` ownership row. Fields: name, position, grade, GPA (consent-gated), physical stats (JSON), highlight URLs (allowlisted hosts only). Persisted via `AthleteProfileService` scoped to the athlete-tenant |
| Data Isolation Layer | New athlete-tenants default `visibility_status='pending'`; readable only by `ComplianceApiSingleton` review routes |
| Public Roster | `GET /api/public/institutions/:institutionTenantId/roster` → `approved` only, cached (`NilPublicApiSingleton`) |
| Admin Roster Controller | `ComplianceApiSingleton`-backed UI; toggle status → PUT route → per-athlete cache eviction (§3.3) |

**Capability:** `nil_roster` (master toggle `nil_roster_enabled`; tier-gated row caps). Resolver `resolveNilRoster(features, merchantPrefs)` returns `{ enabled, is_flexible, allowed_*_types, can_use_*, *_available, merchant_preferences }` per `capability-data-flow-rules.md` R1.

**New IDs (see §6):** `generateAthleteTenantId()` → `tid-{nanoid}` (`tenant_type='athlete'`), `generateHighlightId(athleteTenantId)` → `hl-{atk}-{nanoid}`.

### Phase 3 — The Unified Service (Persona Specialization & Verification)

**Objective:** Authenticated portals with distinct privacy rules.

| Sub-feature | Technical Implementation | Domain Base |
|---|---|---|
| Guardian Dashboard | Link multiple athlete-tenants (`guardian_athlete_links_list`), grant **scoped** consent (§12.6), manage financial routing | `GuardianApiSingleton` (0-TTL) |
| Coach Portal & Recruiting Board | Custom recruitment lists (`recruiting_boards_list`), private star ratings (`scout_ratings_list`); contact is guardian-gated (§12.2) | `InstitutionApiSingleton` |
| Sponsor Portal & NIL Tracking | Offer deals, track escrow, cumulative spend vs. cap | `SponsorApiSingleton` |
| Achievement Aggregation Engine | Verified milestones (`athlete_achievements_list`) submitted by school/club/guardian; feeds public profile when `approved` | `InstitutionApiSingleton` + compliance verify |
| Gamified Fan Network | Follow athletes, public feed, badges (`fan_badges_list`, e.g. `SUPER_FAN`, `NIL_SUPPORTER`) — **always-free, not tier-gated** (§12.9) | `FanApiSingleton` |

**Capabilities:** `nil_guardian`, `nil_recruiting`, `nil_sponsorship`, `nil_achievements`, `nil_fan_network` — each a per-feature-toggle capability (merchant-gated where applicable). Each follows all 8 phases of `capability-deployment-flow.md`.

### Phase 4 — Full Multi-Tenant Mesh (Enterprise Scale)

**Objective:** High-volume, infrastructure-enforced isolation + automated compliance + finance.

| Requirement | Technical Implementation |
|---|---|
| Compliance Automated Vetting | `ComplianceVettingService` (UniversalSingleton, cached bylaw indices) evaluates contract value vs state/association bylaw table; sets `compliance_status` |
| Integrated Financial Infrastructure | Escrow + milestone payouts mirror existing payment/escrow patterns; tenant-scoped `generatePaymentId`, `generateEscrowId`; non-profit allocation pools tracked in Financial Track tables |
| Advanced RLS | Postgres RLS on all athlete-owned tables keyed to the **athlete-tenant**; cross-tenant relationship rows visible only to the explicitly-related second tenant (§12.4); enforced at infra level (`tenant-scoped-id-generation.md` §8) |

**Capability:** `nil_compliance`, `nil_finance` — highest tier only; resolver hard-gates by tier; expired/inactive tenants return 200 with disabled manifest (R13).

---

## 5. Master Data Element Tracks (Schema)

Three structural data groups. Logic is fixed; UI layout stays flexible via JSON metadata columns. All athlete-owned rows are scoped to the **athlete-tenant** (`tenant_id` = athlete-tenant, prefix key `atk`).

### 5.1 The Event Track
- Tables: `nil_events_list` (schedules, tryouts), `media_upload_log_list`, `deal_signature_events_list`.
- IDs: `generateNilEventId(athleteTenantId)` → `nilevt-{atk}-{nanoid}`.
- Pattern: append-only event log; timestamps in UTC; athlete-traceable for audit.

### 5.2 The Financial Track (Private Pipeline only — 0-TTL)
- Tables: `nil_offers_list` (base offer), `escrow_milestones_list` (lock states), `payout_schedules_list`, `nonprofit_allocation_pools_list` (double-entry, §12.5), `sponsor_spend_limits_list` (ROI cap).
- IDs: `generateNilOfferId(athleteTenantId)` → `niloffer-{atk}-{nanoid}`, `generateEscrowId(athleteTenantId)` → `escrow-{atk}-{nanoid}`, reuse `generatePaymentId`.
- Pattern: never cached; never public; RLS-enforced; payout routes to the **guardian's** KYC'd account (§12.5).

### 5.3 The Media & Metrics Track
- Tables: `athlete_metrics_list` (sport-agnostic `stats_blob jsonb` — passing yards, PPG, etc.), `highlight_media_list` (allowlisted third-party stream URLs + moderation state), `fan_badges_list` (badge arrays).
- IDs: `generateHighlightId(athleteTenantId)` → `hl-{atk}-{nanoid}`, `generateBadgeAwardId(athleteTenantId)` → `badge-{atk}-{nanoid}`.
- Pattern: sport-agnostic — stats live in a flexible `jsonb` column so new sports need no migration. Media defaults to `pending` and requires moderation clearance before public display (§12.7). Video URLs are metadata-only facades (existing `ProductVideoPlayer` pattern).

---

## 6. Tenant-Scoped ID Generators to Add

Add to `apps/api/src/lib/id-generator.ts` (follow `tenant-scoped-id-generation.md` §5). Check prefix collisions against the existing catalog. **`atk` = the athlete's tenant key = `generateTenantKey(athleteTenantId)`** — it prefixes every athlete-owned entity. `instTk` / `sponsorTk` are the institution / sponsor tenant keys.

| Generator | Prefix | Format | Scope |
|---|---|---|---|
| `generateAthleteTenantId()` | `tid` | `tid-{nanoid}` (`tenant_type='athlete'`) | **The athlete IS a tenant** — isolation root (§12.3) |
| `generateGuardianId()` | `guard` | `guard-{nanoid}` | **Global** — owns athlete-tenants; KYC subject (§12.5) |
| `generateGuardianAthleteLinkId(athleteTenantId, guardianId)` | `gown` | `gown-{atk}-{guardianId}-{nanoid}` | Ownership link (athlete-tenant ↔ guardian, §12.3) |
| `generateAthleteMembershipId(athleteTenantId, institutionTenantId)` | `amem` | `amem-{atk}-{instTk}-{nanoid}` | **Cross-tenant** (athlete ↔ school/club) |
| `generateHighlightId(athleteTenantId)` | `hl` | `hl-{atk}-{nanoid}` | Athlete-tenant |
| `generateAthleteMetricsId(athleteTenantId)` | `metric` | `metric-{atk}-{nanoid}` | Athlete-tenant |
| `generateAchievementId(athleteTenantId)` | `ach` | `ach-{atk}-{nanoid}` | Athlete-tenant |
| `generateConsentRecordId(athleteTenantId)` | `consent` | `consent-{atk}-{nanoid}` | Athlete-tenant, versioned (§12.6) |
| `generateSponsorshipDealId(athleteTenantId, sponsorTenantId)` | `deal` | `deal-{atk}-{sponsorTk}-{nanoid}` | **Cross-tenant** (§12.4) |
| `generateNilOfferId(athleteTenantId)` | `niloffer` | `niloffer-{atk}-{nanoid}` | Athlete-tenant |
| `generateEscrowId(athleteTenantId)` | `escrow` | `escrow-{atk}-{nanoid}` | Athlete-tenant |
| `generateNilEventId(athleteTenantId)` | `nilevt` | `nilevt-{atk}-{nanoid}` | Athlete-tenant |
| `generateBadgeAwardId(athleteTenantId)` | `badge` | `badge-{atk}-{nanoid}` | Athlete-tenant |
| `generateThreadId(athleteTenantId)` | `thread` | `thread-{atk}-{nanoid}` | Athlete-tenant (guardian-gated messaging, §12.8) |
| `generateModerationCaseId(athleteTenantId)` | `mod` | `mod-{atk}-{nanoid}` | Athlete-tenant (content safety, §12.7) |
| `generateRecruitingBoardId(institutionTenantId)` | `board` | `board-{instTk}-{nanoid}` | Institution-tenant (coach owns) |
| `generateNilLeadId()` | `nillead` | `nillead-{nanoid}` | Global (pre-tenant capture) |
| `generateNilInvitationId()` | `nilinv` | `nilinv-{nanoid}` | Bidirectional actor invitation (§18) |
| `generateOnboardingSessionId()` | `onboard` | `onboard-{actorType}-{nanoid}` | Actor onboarding wizard session (§18) |

**Rules:** DB columns `@db.VarChar(255)` (not `@db.Uuid`); pass ID explicitly from the service layer (no `gen_random_uuid()` default); never use the tenant key as a security boundary. The athlete-tenant uses the standard `generateTenantId()` primitive so it inherits all platform tenant infra (RLS, capabilities, `checkTenantAccess`).

---

## 7. Capability Registration Summary

Each NIL capability follows the 8-phase pipeline (`capability-deployment-flow.md`). Per capability, deliver:

1. **Define:** feature key(s) in `canonical-features.ts` + tier assignment in `tier-hierarchies.ts` (`snake_case`, domain-prefixed e.g. `nil_roster_export`).
2. **Seed DB:** `features_list` → `capability_features_list` → `tier_features_list`.
3. **Store prefs:** `tenant_nil_*_options_settings` table + Prisma model (`generate*OptionsSettingsId`).
4. **Resolve:** `resolveNilXxx(features, merchantPrefs)` in `apps/api/src/services/resolvers/NilXxxResolver.ts` + wire into `EffectiveCapabilityResolver.ts` + add disabled entry to `buildExpiredCapabilitiesResponse`.
5. **Route:** `nil-xxx-options-settings.ts` (GET returns `{ success, settings, tierState }`, PUT tier-validates + `invalidateEffectiveCapabilities`).
6. **Map:** `UnifiedCapabilityService.mapNilXxx()` + state interface in `CapabilityResolutionService.ts` + `useNilXxxCapability` hook.
7. **Display:** `PlanSummaryPanel` entry + `CapabilityShowcase` row (correct group-level `merchantGated` counting).
8. **Verify:** `pnpm checkapi` + `pnpm checkweb` (zero TS errors) + the deployment checklist.

| Capability Key | Phase | Gate Type | Merchant Pref Table |
|---|---|---|---|
| `nil_landing` | 1 | tier-only | — |
| `nil_roster` | 2 | master toggle | `tenant_nil_roster_options_settings` |
| `nil_guardian` | 3 | per-feature | `tenant_nil_guardian_options_settings` |
| `nil_recruiting` | 3 | per-feature | `tenant_nil_recruiting_options_settings` |
| `nil_sponsorship` | 3 | per-feature | `tenant_nil_sponsorship_options_settings` |
| `nil_achievements` | 3 | master toggle | `tenant_nil_achievements_options_settings` |
| `nil_fan_network` | 3 | per-feature | `tenant_nil_fan_options_settings` |
| `nil_compliance` | 4 | tier-only (hard) | — |
| `nil_finance` | 4 | per-feature | `tenant_nil_finance_options_settings` |
| `nil_crm` | 3 | per-feature | `tenant_nil_crm_options_settings` (mirrors `crm-options`, §16) |
| `nil_bot` | 3 | per-feature | `tenant_nil_bot_options_settings` (mirrors `chatbot-options`, §17) |

### 7.1 Capability Equivalency Map (Commerce ⇄ NIL)

The commerce platform and the NIL platform optimize the **same two goals: visibility** (get the product/athlete discovered) and **conversion** (turn discovery into a paid transaction). Because of this, every existing capability domain has a direct NIL analog — the NIL capability is, in most cases, a *re-skin* of an existing one, which is why this platform fits the NIL domain so cleanly. Build each NIL capability by following the existing one's resolver/route/mapper as the template (all per the 8-phase pipeline).

| Commerce capability (existing) | Shared goal | NIL capability (this spec) | What carries over |
|---|---|---|---|
| `storefront_options` | Visibility | `nil_landing` + `nil_roster` | Public storefront → athlete profile / roster page; `NilPublicApiSingleton` mirrors public storefront reads |
| Product types (`add-product-type.md`) | Conversion unit | `nil_roster` (sport-agnostic profile) + `nil_sponsorship` (offerings) | Sport-agnostic `stats_blob jsonb` mirrors flexible product attributes |
| `directory_entry` | Visibility | `nil_roster` directory facet | Discoverability in a public directory → athlete discoverable by coaches/sponsors |
| `social_commerce_options` (Meta catalog/shop) | Visibility | `nil_recruiting` + `nil_fan_network` | Syndicating catalog to external channels → syndicating consented profiles to recruiting/fan channels |
| Checkout + payments + escrow | Conversion + revenue | `nil_finance` | Deal = purchase; sponsor = buyer; **platform transaction fee** at settlement (§12.10) |
| Purchasable BSaaS feature (`bsaas-purchase-flow.md`) | Revenue | `nil_sponsorship` deal lifecycle | À-la-carte purchase → an individual NIL deal as a purchasable transaction |
| `crm_options` | Conversion + retention | `nil_crm` (§16) | Three CRM surfaces re-mapped to Compliance / Institution+Sponsor / Guardian |
| `faq_options` | Conversion support | `nil_bot` KB | FAQ knowledge base → eligibility/onboarding KB (RAG over `nil_eligibility_rules_list`) |
| `chatbot_options` | Conversion | `nil_bot` personas (§17) | RAG chatbot → guardian/compliance/recruiting bots |
| `alerts-and-notifications` | Retention/engagement | `nil_crm` alerts | Engagement nudges → guardian approval nudges, deal alerts |
| Subscription tiers (`tier-hierarchies.ts`) | Revenue | Payer-keyed NIL tiers | Merchant tier breadth → institution/sponsor tier breadth (§12.10 #2) |
| Analytics | Measure conversion | `nil_sponsorship` analytics | Merchant analytics → sponsor ROI + athlete visibility metrics |

**Rule for the junior agent:** when building any `nil_*` capability, open its commerce counterpart first and copy the structure. The NIL-specific work is the **child-safety/consent overlay** (§12), not the capability plumbing — that already exists.

---

## 8. Privacy & Parental Control Loop (Critical Path)

This is the platform's legal core. Technical sequence for publishing an athlete's profile:

1. Guardian provisions the athlete-tenant (COPPA §12.1) → `visibility_status='pending'`; an ownership row exists in `guardian_athlete_links_list`.
2. Guardian authenticates (`GUARDIAN` role, `GuardianApiSingleton`, JWT). Backend verifies the guardian is a `consent_authority` owner of that athlete-tenant.
3. Guardian grants **scoped** consent → rows in `consent_records_list` for `public_profile` (+ optionally `gpa_display`, `media_display`, etc.), private 0-TTL route (§12.6).
4. Media moderation clears (§12.7) and compliance gate sets `compliance_status='cleared'` (Phase 2 manual / Phase 4 auto).
5. Only when **public_profile consent + moderation + compliance** all pass may the system transition `visibility_status → approved`.
6. Transition triggers per-athlete cache eviction → profile appears on the public roster, projecting only consented fields.

**Hard rules:** (a) A caller who is not a `consent_authority` guardian of the athlete-tenant is rejected (403) — the profile can never publish. (b) Any owning guardian may veto/revoke; **most-restrictive-wins** (§12.3). (c) Revocation cascades to `archived` + full cache eviction within one request (§12.6).

---

## 9. Backend Service Layer Plan

Follow `deploy-service-extending-base-singleton.md` §2.

These are **backend (API-side) services**; the **frontend** consumes them through the NIL base singletons in §13.

| Service | Base | Caching | Responsibility |
|---|---|---|---|
| `AthleteProfileService` | `PermissionEnhancedBaseService` | none | CRUD on athlete-tenant profiles, status transitions (guardian-authorized) |
| `NilRosterService` | `UniversalSingleton` | cached | public approved roster reads (per-`atk` namespaced) |
| `GuardianConsentService` | `BaseService` | none | scoped consent grant/revoke, athlete-tenant ownership + `consent_authority` checks |
| `AthleteMembershipService` | `BaseService` | none | athlete ↔ institution cross-tenant memberships (transfers) |
| `RecruitingBoardService` | `BaseService` | none | coach boards, private star ratings (institution-scoped) |
| `SponsorshipService` | `PermissionEnhancedBaseService` | none | cross-tenant deals, escrow state, spend-cap enforcement |
| `EscrowLedgerService` | `BaseService` | none | double-entry escrow + non-profit pool ledger (§12.5) |
| `ComplianceVettingService` | `UniversalSingleton` | cached bylaw indices | state/association eligibility + contract vetting |
| `MediaModerationService` | `BaseService` | none | media moderation queue + allowlist validation (§12.7) |
| `MessagingService` | `BaseService` | none | guardian-gated threads (§12.8) |
| `FanNetworkService` | `BaseService` | none | follows, feed, badge awards (always-free) |
| `DataErasureService` | `BaseService` | none | right-to-erasure cascade + audit certificate (§12.1) |
| `InvitationService` | `BaseService` | none | bidirectional invitation CRUD, lifecycle (sent→viewed→accepted/rejected/expired), connection establishment, guardian consent gate, anti-spam re-invitation block (§18) |
| `OnboardingService` | `BaseService` | none | actor-aware onboarding wizard state machine, step tracking, completion percentage, per-actor flow orchestration (§18) |
| `NilCapabilityResolvers` | resolver functions | — | tier+merchant resolution per §7 / §12.9 |

**Cross-cutting:** capability-gated services extend `PermissionEnhancedBaseService` and call `requireFeature(tenantId, 'nil_xxx')` / `requireLimit(tenantId, 'nil_roster_size', n)` before mutating, where `tenantId` is the **athlete-tenant** (athlete-owned features) or the **institution/sponsor tenant** (their respective features, §12.9).

---

## 10. Functional Verification Checklist (Technical Acceptance Criteria)

Translated from Functional Spec §6 into testable backend/infra assertions.

- [ ] **DNS/Edge:** Brand domain DNS points to edge-hosting infra; HTTPS/SSL validated; custom domain resolved by `proxy.ts` subdomain/custom-domain routing. *(Test: TLS handshake + 200 on landing route.)*
- [ ] **Approved-only roster:** `GET /api/public/tenants/:tenantId/roster` returns zero records when no row has `visibility_status='approved'`. *(Test: seed only `pending` rows → expect empty array.)*
- [ ] **Parental control loop:** Public display blocked until guardian auth token matches the athlete's parent-mapping attribute; mismatched token → 403; consent write only succeeds on match. *(Integration test on `GuardianConsentService`.)*
- [ ] **Centralized pipeline:** No raw `fetch` in `apps/web/src` or `apps/api/src` for NIL code paths — all calls route through `makeDefaultRequest` / `UniversalSingleton` helpers. *(Lint/grep gate in CI.)*
- [ ] **Cache TTL split:** Public roster service TTL is 5–15 min; all private (guardian/escrow/contract) services TTL is 0. *(Assert `cacheTTL` per service.)*
- [ ] **Cache eviction:** Admin status toggle evicts `nil-roster-{tenantId}-*`. *(Test: approve → public roster reflects within one request.)*
- [ ] **PII projection:** No public route projects DOB, parent contact, or financial routing. *(Schema/DTO snapshot test.)*
- [ ] **RLS (Phase 4):** Cross-tenant query returns zero rows under RLS even without explicit `tenant_id` filter. *(DB policy test.)*
- [ ] **Tenant-scoped IDs:** All new NIL entities use generators from `id-generator.ts` (no `randomUUID`/`Date.now()`). *(Grep gate.)*
- [ ] **Capability gates:** Each `nil_*` capability returns `tierState`, tier-filters settings, and returns 200 disabled manifest for expired tenants (R13). *(Per-capability route test.)*
- [ ] **Type safety:** `pnpm checkapi` and `pnpm checkweb` pass with zero TS errors.

---

## 11. Key File Reference (Where Code Lands)

| Layer | Path |
|---|---|
| ID generators | `apps/api/src/lib/id-generator.ts` |
| Resolvers | `apps/api/src/services/resolvers/Nil*Resolver.ts` + `types.ts` |
| Orchestrator | `apps/api/src/services/EffectiveCapabilityResolver.ts` |
| Capability routes | `apps/api/src/routes/nil-*-options-settings.ts` |
| Public read routes | `apps/api/src/routes/public/nil-*.ts` |
| Private mutation routes | `apps/api/src/routes/nil-*.ts` (auth + tenant guarded) |
| Web public services | `apps/web/src/services/Nil*PublicService.ts` (`PublicApiSingleton`) |
| Web private services | `apps/web/src/services/Nil*Service.ts` (`Customer`/`Tenant`/`Admin` singletons) |
| Capability mapping | `apps/web/src/services/UnifiedCapabilityService.ts` |
| Hooks | `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` |
| Dashboard display | `PlanSummaryPanel.tsx`, `CapabilityShowcase.tsx` |
| Routing/proxy | `apps/web/src/proxy.ts` |
| Feature defs | `packages/feature-definitions/src/definitions/{canonical-features,tier-hierarchies}.ts` |

---

## 12. Full-Spectrum Gap Analysis & Resolutions

This section audits the functional spec (and §§1–11 above) across every product dimension. Each gap is rated **[P0]** (legal/safety blocker), **[P1]** (architectural correctness), or **[P2]** (operational hardening). The resolution is folded directly into the design — these are now part of the spec, not open questions.

### 12.1 Legal & Regulatory Compliance — the largest gap class **[P0]**

The functional spec mentions "compliance" only as contract-vs-bylaw vetting (Phase 4). For a platform handling **minors' PII + money**, the legal surface is far larger and must be designed in from Phase 2, not deferred.

| Gap | Severity | Resolution (folded into design) |
|---|---|---|
| **COPPA** (children under 13) | P0 | Verifiable parental consent is REQUIRED *before any data collection* for under-13. Add `age_band` (`under_13`, `13_to_17`, `adult`) resolved from DOB. For `under_13`, the intake form is **guardian-initiated only** — the athlete cannot self-register. Block all data writes until `guardian_consent_granted=true`. Data minimization: collect only what each capability needs. |
| **FERPA** (educational records: GPA, school) | P0 | GPA and school-association data are FERPA-protected when sourced from a school. Public roster MUST treat GPA as opt-in per consent record; default GPA visibility = private. Schools (tenants) acting as the FERPA data source need a signed data-sharing agreement flag (`tenant_ferpa_agreement_signed`). |
| **State high-school NIL law divergence** | P0 | HS NIL is **banned or restricted in many states** and rules change frequently. `ComplianceVettingService` must gate deal creation by the athlete's `state` AND the school's sanctioning body. Model a `nil_eligibility_rules_list` table keyed by `(state, association, age_band)` with `deals_allowed`, `max_deal_value`, `prohibited_categories[]` (alcohol, gambling, etc.). Deal creation is blocked (not just flagged) where `deals_allowed=false`. |
| **Right to erasure (CCPA/GDPR-style)** | P0 | Guardian can request full deletion of a minor's data. Design a `data_erasure_requests_list` workflow that cascades: archive → anonymize → hard-delete across all tracks, evicts every cache namespace, and produces an audit certificate. Mirror the platform's existing CCPA work referenced in `docs/SOCIAL_COMMERCE_INTEGRATION_PLAN.md` (Phase 1C). |
| **Tax / 1099 for NIL income** | P1 | NIL payouts are taxable income. Payouts route to a **guardian-controlled** account; 1099 issuance is to the guardian/athlete per IRS rules. Add `tax_profile_id` on the guardian, W-9 collection before first payout, and a `payout_tax_documents_list`. |
| **Per-tenant storefront/privacy policies** | P1 | Each school/sponsor needs its own posted privacy policy + terms. Reuse the existing `tenant_storefront_policies` pattern (already in the platform) extended with a `minor_data_policy` document type. |

**New capability:** `nil_compliance` is promoted from a Phase-4 "nice to have" to a **Phase-2 hard prerequisite** — no profile may reach `approved` without a compliance verdict, even in MVP (initially a manual admin verdict, automated in Phase 4).

### 12.2 Child-Safety & Anti-Predator Controls — missing entirely **[P0]**

The spec exposes searchable minor profiles to "Coaches / Talent Scouts" and a public "Fan Network," yet defines **no controls preventing adults from contacting minors**. This is the single most dangerous omission.

**Resolutions (now mandatory design constraints):**

- **No direct adult→minor communication.** All Coach/Sponsor/Fan → Athlete messaging routes through the guardian. Messaging threads (`generateThreadId`, §12.8) always include the guardian as a required participant; an athlete-only thread with an adult is structurally impossible.
- **Contact gating.** Coaches/scouts can *follow* and *rate* on private boards, but any outreach creates a guardian-addressed request, never a direct line to the minor.
- **Identity verification for adult roles.** `COACH`, `SPONSOR`, and `SCOUT` roles require KYC/identity verification before they can view contact-adjacent surfaces. Unverified adults get read-only access to already-public, approved data.
- **Discoverability minimization.** Public athlete profiles expose no location precision finer than school/city, no schedule that reveals where the minor will physically be, and no direct contact fields — ever.
- **Abuse reporting + rate limits.** Add a `report_abuse` flow and per-actor rate limits on profile views/follows to detect scraping or stalking patterns.

### 12.3 Data-Model Correctness — the Athlete IS the Tenant **[P1, RESOLVED — see §0]**

The domain requires: an athlete in a **school AND a travel club** at once; an athlete who **transfers** without losing history; a guardian linking **multiple athletes**; and an athlete with **multiple guardians** (split custody).

**Resolution — athlete-as-tenant** (the model adopted across this spec; supersedes the interim "global identity" idea):

- **The athlete IS a `tenant`** (`tid-{nanoid}`, `tenant_type='athlete'`). It is the data-isolation root; every athlete-owned row is RLS-scoped to it and prefixed by its tenant key `atk`. This gives the strongest minor-privacy guarantee and reuses 100% of the platform's tenant infra (RLS, capabilities, cache namespacing, `checkTenantAccess`).
- **`guardian_athlete_links_list`** is **many-to-many** (guardian global account ↔ athlete-tenant) with `relationship_type` (`parent`, `legal_guardian`, `custodial`) and a `consent_authority` flag (which guardian may grant public-consent / financial routing under split custody). Conflicting guardians resolve **most-restrictive-wins** — any owner can veto/revoke publication.
- **`athlete_tenant_memberships_list`** links the athlete-tenant to each **institution-tenant** (school/club) as a cross-tenant row, mirroring `customer_tenant_relationships`. Transferring schools adds/retires a membership; profile, metrics, media, achievements, and NIL history stay on the **athlete-tenant** and are never orphaned.
- **Age-out transition.** When an athlete turns 18, a scheduled job transfers control of the athlete-tenant from guardian to the athlete account (`ATHLETE` gains financial scope), retaining the full consent + audit ledger.

### 12.4 Cross-Tenant Sponsorship — RLS tension unaddressed **[P1]**

§4 Phase 4 mandates "zero data cross-contamination between competing schools, clubs, or external sponsors." But an NIL deal is **inherently cross-tenant**: a sponsor (tenant A) sponsors an athlete who participates in school (tenant B). Strict per-tenant RLS would make deals impossible.

**Resolution:** NIL deals are modeled as **explicit dual-key relationship rows** (`generateSponsorshipDealId(athleteTenantId, sponsorTenantId)` → `deal-{atk}-{sponsorTk}-{nanoid}`), exactly like the platform's `customer_tenant_relationships` (`ctr-{tk}-{ck}`). The RLS policy on `sponsorship_deals_list` allows a row to be visible to **both** the athlete-tenant (its guardian) and the sponsor-tenant — never to unrelated tenants. The "no cross-contamination" rule applies to *bulk roster/PII data*, not to explicitly-consented bilateral deal rows. This distinction MUST be documented in the RLS policy comments.

### 12.5 Financial Infrastructure — KYC/AML & escrow correctness **[P1]**

The spec lists escrow and payouts but omits the controls that make handling minors' money legal.

- **KYC subject is the guardian, not the minor.** `generateGuardianId()` is global precisely so KYC/AML, W-9, and bank verification attach to the adult. Minors cannot hold the payout account.
- **Escrow state machine** is explicit: `proposed → funded → locked → milestone_released → settled` (or `disputed → refunded`). Each transition is an append-only Event-Track row.
- **Non-profit fund accounting.** The "non-profit distribution adjustments" need a ledger: `nonprofit_allocation_pools_list` is double-entry (credit/debit) with an immutable audit trail, not a mutable balance column.
- **Sponsor ROI / spend cap** is enforced server-side at deal-creation time (`requireLimit(sponsorTenantId, 'nil_spend_cap', amount)`), not merely displayed.
- **PCI scope.** Reuse the existing payment-gateway abstraction; never store raw card/bank data — tokenize via the existing gateway pattern (`generatePaymentGatewayId`).

### 12.6 Consent Lifecycle — one-shot boolean is insufficient **[P0/P1]**

§8 models consent as a single `guardian_consent_granted` boolean. Real consent is **versioned, scoped, expirable, and revocable**.

**Resolution — `consent_records_list` (versioned, `consent-{athleteId}-{nanoid}`):**

- **Scoped consent:** separate grants for `public_profile`, `gpa_display`, `media_display`, `nil_deals`, `messaging`. A guardian may allow a public profile but deny GPA display.
- **Versioning:** when the platform's terms or a capability's data use changes, prior consent is invalidated and **re-consent is required** before the affected surface stays live.
- **Revocation cascade:** revoking consent flips `visibility_status → archived`, evicts all public caches for that athlete, and removes the profile from the public roster within one request cycle (reuse §3.3 eviction).
- **Audit ledger:** every grant/revoke is append-only with actor, timestamp, IP, and the exact terms version — this is the legal evidence trail.

### 12.7 Content Safety & Media Moderation — undefined **[P0]**

The spec ingests "highlight media galleries" and third-party video URLs for minors with **no moderation layer**.

- **Pre-publication review:** media defaults to `pending` and requires moderation clearance (`generateModerationCaseId`) before public display — same firewall as profiles (§3).
- **Third-party URL validation:** only allowlisted hosts (YouTube, Hudl, Vimeo) via the existing `parseVideoUrl` pattern; reject arbitrary URLs to prevent linking to unsafe destinations. Render as metadata-only facades (no eager iframe).
- **Automated screening hook:** integration point for image/video safety scanning (CSAM detection is legally mandated for any platform hosting minor imagery — even if media is third-party-hosted, thumbnails/metadata pass through). Flag → human moderation queue.
- **Uploader provenance:** every media row records who submitted it (school/guardian/athlete) for accountability.

### 12.8 Secure Messaging — mentioned but unspecified **[P1]**

§3 references "secure communication streams" with no model. Resolution: a guardian-gated threading model (`generateThreadId`) on the private 0-TTL pipeline. Threads are tenant-scoped, always include the guardian for any thread involving a minor, encrypted at rest, and never cached. No public projection.

### 12.9 Capability-Gating Scope — tenant-tier vs. user-scoped actors **[P1]**

The capability system gates by **tenant tier**, but Guardians, Athletes, and Fans are **user/customer-scoped**, not tenants. The spec (§7) implies fan/guardian features are tier-gated, which is undefined for a non-tenant actor.

**Resolution — explicit gating ownership:**

- **School/Club tenant tier** governs *roster size, achievement verification, recruiting-board access, and which NIL features its athletes may use*. Athlete-facing features inherit from the membership's tenant tier (most-permissive across memberships, then narrowed by the home tenant's policy).
- **Sponsor tenant tier** governs *deal volume, spend caps, analytics*.
- **Guardian & Fan features are platform-level, always-on** (free) — they are the trust/safety and engagement layer and must never be paywalled. They are NOT capability-gated; they are governed by consent + role only.
- Document this in each resolver: `nil_guardian` and `nil_fan_network` resolve from a **platform default**, not from `tier_features_list`.

### 12.10 Monetization Model — RESOLVED: Transaction Fees on Deals **[P1, RESOLVED]**

**Decision: an NIL deal is a commerce transaction, and the platform monetizes exactly like it monetizes a product sale.** A sponsor buying an athlete's NIL is structurally the same as a customer purchasing a product: the **sponsor is the buyer**, the **athlete-tenant is the storefront/product**, the **guardian is the payee** (KYC'd account, §12.5), and the **platform collects a transaction fee** on settlement. This reuses the existing payment/checkout + **BSaaS purchase-flow** infrastructure rather than inventing a billing model.

**Revenue streams (in priority order):**

1. **Transaction fee (primary).** On each settled deal, the platform takes a configurable percentage; the remainder routes to the guardian payout, and a slice routes to the `nonprofit_allocation_pools_list` (§12.5). Mirrors `bsaas-purchase-flow.md` + the existing payment gateway / escrow patterns — a deal moves through the same `proposed → funded → … → settled` machine, with the fee deducted at `settled`.
2. **Institution / Sponsor subscription tiers (secondary).** Tier hierarchy in `tier-hierarchies.ts` is keyed to the **tenant payer** (school/club or sponsor) and gates *capability breadth* (roster size, analytics depth, CRM/bot access) — identical to how commerce tiers gate the merchant. Consistent with §12.9.
3. **Always-free actors.** Athletes, guardians, and fans never pay and are never paywalled (§12.9). The non-profit motivation is satisfied by the allocation-pool slice on every transaction, not by charging families.

> **Why this fits like a glove:** both the commerce platform and the NIL platform optimize the same two things — **visibility** (get the product/athlete discovered) and **conversion** (turn discovery into a paid transaction). So each commerce capability has a direct NIL analog (see **§7.1**), and the deal-as-purchase model means the financial track (§5.2, §14.8) is largely a re-skin of existing checkout/escrow rather than net-new.

### 12.11 Observability, Abuse & Operational Hardening **[P2]**

- **Audit trail everywhere:** every status/consent/deal/payout transition emits an `X-Audit-ID` (existing `AdminApiSingleton` pattern) into an append-only log. Mandatory for legal defensibility.
- **Rate limiting & scraping defense** on public roster and profile-view endpoints (child-safety, §12.2).
- **Polling discipline:** the dashboard's repeated `GET /api/tenants/:id` loop (observed ~1/sec) should be replaced by the server-resolved-context pattern + React Query cache seeding (per the workspace's `fix-tenant-dashboard-load-loop.md` skill) to avoid request storms — applies to any new NIL dashboard.
- **Cache-eviction completeness:** every consent/visibility/media mutation must enumerate ALL cache namespaces to evict (roster, profile, feed, sponsor portfolio). Partial eviction = stale minor data live publicly = a safety incident.
- **i18n & state localization:** the workspace enforces FE i18n (PR template `pr-fe-i18n.md`); compliance copy and bylaw messaging must be localizable per state/region.

### 12.12 Testing & Verification Gaps **[P1]**

§10 covers happy-path infra checks but not the safety-critical negative paths. **Added acceptance criteria:**

- [ ] **[P0]** Under-13 athlete cannot be registered without prior verifiable guardian consent (COPPA). *(Negative test: athlete-initiated under-13 intake → 403.)*
- [ ] **[P0]** No messaging thread between an adult role and a minor can exist without a guardian participant. *(Structural invariant test.)*
- [ ] **[P0]** Consent revocation removes the profile + all media from public surfaces within one request and evicts every cache namespace. *(Cascade test.)*
- [ ] **[P0]** Deal creation is blocked where `nil_eligibility_rules_list.deals_allowed=false` for the athlete's state/association. *(Per-state matrix test.)*
- [ ] **[P0]** Media cannot publish without moderation clearance; non-allowlisted video hosts are rejected. *(Moderation gate test.)*
- [ ] **[P1]** Conflicting guardians: any guardian veto blocks publication ("most restrictive wins"). *(Joint-custody test.)*
- [ ] **[P1]** Cross-tenant deal row is visible to sponsor + guardian only, not to unrelated tenants (RLS). *(Isolation test.)*
- [ ] **[P1]** Payout KYC/W-9 on the guardian is required before first settlement. *(Finance gate test.)*
- [ ] **[P1]** Age-out at 18 transfers financial control to the athlete and preserves the consent ledger. *(Lifecycle test.)*

### 12.13 Gap Summary — Severity Rollup

| # | Gap | Severity | Phase Impact |
|---|---|---|---|
| 12.1 | Legal/regulatory (COPPA, FERPA, state NIL, erasure, tax) | P0 | Pulls compliance into Phase 2 |
| 12.2 | Child-safety / anti-predator controls | P0 | Phase 2–3 design constraint |
| 12.3 | Athlete identity & multiplicity model | P1 | Corrects §0/§6 |
| 12.4 | Cross-tenant sponsorship vs. RLS | P1 | Phase 4 RLS design |
| 12.5 | Financial KYC/AML, escrow, fund accounting | P1 | Phase 4 |
| 12.6 | Versioned/revocable consent lifecycle | P0/P1 | Replaces §8 boolean |
| 12.7 | Content/media moderation | P0 | Phase 2 |
| 12.8 | Secure messaging model | P1 | Phase 3 |
| 12.9 | Capability gating for non-tenant actors | P1 | Corrects §7 |
| 12.10 | Monetization model | P1 | **RESOLVED** — transaction fee on deals (deal = purchase) + payer-keyed tiers |
| 12.11 | Observability/abuse/ops hardening | P2 | Cross-cutting |
| 12.12 | Safety-critical negative-path tests | P1 | Cross-cutting |

**Bottom line:** The original functional spec is sound on *architecture* (two-tier, firewall, phased rollout) but materially under-specified on *legal, child-safety, consent, and financial-control* dimensions — the exact areas that carry the most risk for a platform built around minors and money. **All gaps in §12 are now resolved in-design**, including §12.10 (monetization): an NIL deal is a commerce transaction, the platform collects a transaction fee on settlement, and capability breadth is gated by payer-keyed tiers — reusing the existing payment/BSaaS-purchase infrastructure (see §7.1 for the full commerce⇄NIL capability equivalency).

---

## 13. NIL Context-Specific Base Singleton Classes

Mirroring the platform pattern (`FlexibleApiSingleton > {Public, Tenant, Customer, Admin, Authenticated}`), the NIL vertical adds a thin layer of **context-specific base singletons**. Each pre-configures request type, cache TTL, isolation, and headers so concrete services (and the junior agent) never re-decide these. **Concrete services extend the NIL base, not the platform base directly.**

### 13.1 Hierarchy

```
FlexibleApiSingleton                         (platform root)
├── PublicApiSingleton                       (platform)
│   └── NilPublicApiSingleton                ← approved athlete data, cached 5–15m
├── TenantApiSingleton                       (platform)
│   ├── AthleteApiSingleton                  ← ONE athlete-tenant (the child), 0-TTL private
│   ├── InstitutionApiSingleton              ← school/club tenant
│   └── SponsorApiSingleton                  ← sponsor tenant + cross-tenant deals
├── CustomerApiSingleton                     (platform)
│   └── GuardianApiSingleton                 ← guardian session across all their athletes, 0-TTL
├── AuthenticatedApiSingleton                (platform)
│   └── FanApiSingleton                      ← fan engagement (always-free)
└── AdminApiSingleton                        (platform)
    └── ComplianceApiSingleton               ← vetting, moderation, audit (X-Audit-ID)
```

### 13.2 Base Defaults (the contract each base sets)

| NIL Base | Extends | Request Type | cacheTTL | Key Header | Cache Isolation | Purpose |
|---|---|---|---|---|---|---|
| `NilPublicApiSingleton` | `PublicApiSingleton` | `PUBLIC` | 5–15 min | none | per `atk` (athlete) / `instTk` (roster) | Anonymous reads of `approved` + consented data |
| `AthleteApiSingleton` | `TenantApiSingleton` | `TENANT` | `0` | `X-Tenant-ID` = athlete-tenant | per athlete-tenant | Private mutations on one athlete-tenant; implements cache contract |
| `InstitutionApiSingleton` | `TenantApiSingleton` | `TENANT` | `0` | `X-Tenant-ID` = institution | per institution-tenant | Roster mgmt, coach boards, achievement submission |
| `SponsorApiSingleton` | `TenantApiSingleton` | `TENANT` | `0` | `X-Tenant-ID` = sponsor | per sponsor-tenant | Deals, escrow, spend tracking (cross-tenant rows) |
| `GuardianApiSingleton` | `CustomerApiSingleton` | `CUSTOMER` | `0` | `X-Guardian-ID` | per guardian | Multi-athlete control, scoped consent, financial routing |
| `FanApiSingleton` | `AuthenticatedApiSingleton` | `AUTHENTICATED` | short | `X-User-ID` | per user | Follows, feed, badges — never paywalled (§12.9) |
| `ComplianceApiSingleton` | `AdminApiSingleton` | `ADMIN` | `0` | `X-Audit-ID` | none | Vetting, moderation, status overrides, audit trail |

### 13.3 Reference Implementation (each base)

```ts
// apps/web/src/services/base/NilPublicApiSingleton.ts
export abstract class NilPublicApiSingleton extends PublicApiSingleton {
  protected defaultContext = AppContext.STORE;
  protected defaultIsolation = CacheIsolation.STORE;
  protected constructor(serviceName: string) {
    super(serviceName, { ttl: 10 * 60 * 1000 }); // 5–15m window; concrete may narrow
  }
}

// apps/web/src/services/base/AthleteApiSingleton.ts
// The athlete IS the tenant → reuse TenantApiSingleton, force 0-TTL + cache contract.
export abstract class AthleteApiSingleton extends TenantApiSingleton {
  protected constructor(serviceName: string) {
    super(serviceName, { ttl: 0 }); // private live proxy
  }
  // X-Tenant-ID resolves to the athlete-tenant via the existing tenant-context mechanism.
  // Concrete services MUST implement getServiceCachePatterns()/invalidateServiceCaches()
  // so a visibility/consent change evicts public roster + profile per atk (§3.3).
}

// apps/web/src/services/base/GuardianApiSingleton.ts
export abstract class GuardianApiSingleton extends CustomerApiSingleton {
  protected constructor(serviceName: string) {
    super(serviceName, { ttl: 0 }); // never cache PII/consent/financial state
  }
  // Adds X-Guardian-ID; backend authorizes every athlete-tenant write against
  // guardian_athlete_links_list (consent_authority). MUST NOT expose /api/public/*.
}

// apps/web/src/services/base/ComplianceApiSingleton.ts
export abstract class ComplianceApiSingleton extends AdminApiSingleton {
  protected constructor(serviceName: string) { super(serviceName, { ttl: 0 }); }
  // Every mutation emits X-Audit-ID into the append-only audit log (§12.11).
}
// InstitutionApiSingleton, SponsorApiSingleton, FanApiSingleton follow the same shape.
```

**Junior-agent rules for §13**
- Never extend a platform base directly for NIL code — always extend the matching NIL base.
- Never pass a non-zero TTL to any private base (`Athlete`/`Guardian`/`Sponsor`/`Institution`/`Compliance`).
- Every concrete service stays a singleton (`private static instance`, `private constructor`, `public static getInstance()`).
- Public reads go through `NilPublicApiSingleton` only; if a field needs consent, it is filtered server-side (§3.2 / §12.6).

---

## 14. Database Schema Sketch (DDL)

Implementation-ready sketch for a junior agent. Conventions: table names end in `_list` (platform convention); all IDs are `VARCHAR(255)` (never `uuid`), passed explicitly from the service layer; every athlete-owned table carries `tenant_id` = **athlete-tenant** and an RLS policy keyed to it; timestamps are `timestamptz` UTC. Adjust enum names to match the existing migration style before applying.

> **Apply order:** enums → athlete-tenant extension → guardianship → memberships → consent → profile/media/metrics → achievements → recruiting → sponsorship/finance → moderation/messaging → fan → leads → RLS policies. Wrap in a single migration per phase (Phase 2 covers profile/media/roster; Phase 3 adds guardian/recruiting/sponsorship/fan; Phase 4 adds finance/compliance).

### 14.1 Enums

```sql
CREATE TYPE nil_tenant_type        AS ENUM ('athlete', 'institution', 'sponsor');
CREATE TYPE nil_visibility_status  AS ENUM ('draft', 'pending', 'approved', 'rejected', 'archived');
CREATE TYPE nil_compliance_status  AS ENUM ('not_started', 'in_review', 'cleared', 'blocked');
CREATE TYPE nil_moderation_status  AS ENUM ('pending', 'cleared', 'rejected');
CREATE TYPE nil_age_band           AS ENUM ('under_13', '13_to_17', 'adult');
CREATE TYPE nil_consent_scope      AS ENUM ('public_profile', 'gpa_display', 'media_display', 'nil_deals', 'messaging');
CREATE TYPE nil_relationship_type  AS ENUM ('parent', 'legal_guardian', 'custodial');
CREATE TYPE nil_escrow_state       AS ENUM ('proposed', 'funded', 'locked', 'milestone_released', 'settled', 'disputed', 'refunded');
```

### 14.2 Athlete-Tenant Extension (athlete = tenant)

```sql
-- The athlete IS a row in the existing tenants table with tenant_type='athlete'.
-- Add NIL-specific tenant_type to the platform tenant table (or a side-table if you cannot alter it).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_type nil_tenant_type;

-- Athlete-specific profile attributes (1:1 with the athlete-tenant)
CREATE TABLE athlete_profiles_list (
  id                 VARCHAR(255) PRIMARY KEY,                 -- not used as FK root; tenant_id is the root
  tenant_id          VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id),  -- the athlete-tenant
  display_name       VARCHAR(255) NOT NULL,
  date_of_birth      DATE NOT NULL,                            -- PRIVATE, never projected
  age_band           nil_age_band NOT NULL,
  primary_position   VARCHAR(100),
  grade_level        VARCHAR(50),
  cumulative_gpa     NUMERIC(3,2),                             -- projected only with gpa_display consent
  city               VARCHAR(120),                             -- coarsest public location (§12.2)
  visibility_status  nil_visibility_status NOT NULL DEFAULT 'pending',
  compliance_status  nil_compliance_status NOT NULL DEFAULT 'not_started',
  state_code         CHAR(2),                                  -- drives eligibility rules
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_athlete_profiles_tenant ON athlete_profiles_list(tenant_id);
CREATE INDEX ix_athlete_profiles_visible ON athlete_profiles_list(visibility_status);
```

### 14.3 Guardianship (owns the athlete-tenant)

```sql
CREATE TABLE guardians_list (
  id              VARCHAR(255) PRIMARY KEY,        -- guard-{nanoid}, GLOBAL
  auth0_user_id   VARCHAR(255) NOT NULL UNIQUE,
  email           VARCHAR(255) NOT NULL,
  kyc_status      VARCHAR(50)  NOT NULL DEFAULT 'unverified',  -- KYC subject (§12.5)
  tax_profile_id  VARCHAR(255),                                 -- W-9 before first payout
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guardian_athlete_links_list (
  id                  VARCHAR(255) PRIMARY KEY,    -- gown-{atk}-{guardianId}-{nanoid}
  athlete_tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),
  guardian_id         VARCHAR(255) NOT NULL REFERENCES guardians_list(id),
  relationship_type   nil_relationship_type NOT NULL,
  consent_authority   BOOLEAN NOT NULL DEFAULT false,  -- may grant consent / financial routing
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_tenant_id, guardian_id)
);
CREATE INDEX ix_gal_athlete ON guardian_athlete_links_list(athlete_tenant_id);
CREATE INDEX ix_gal_guardian ON guardian_athlete_links_list(guardian_id);
```

### 14.4 Cross-Tenant Memberships (athlete ↔ school/club)

```sql
CREATE TABLE athlete_tenant_memberships_list (
  id                    VARCHAR(255) PRIMARY KEY,  -- amem-{atk}-{instTk}-{nanoid}
  athlete_tenant_id     VARCHAR(255) NOT NULL REFERENCES tenants(id),
  institution_tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
  team_or_sport         VARCHAR(120),
  status                VARCHAR(50) NOT NULL DEFAULT 'active',  -- active | transferred | inactive
  joined_at             timestamptz NOT NULL DEFAULT now(),
  left_at               timestamptz,
  UNIQUE (athlete_tenant_id, institution_tenant_id, team_or_sport)
);
CREATE INDEX ix_amem_inst ON athlete_tenant_memberships_list(institution_tenant_id);
```

### 14.4a NIL Invitations (Bidirectional Connection Requests, §18)

```sql
CREATE TYPE nil_invitation_status   AS ENUM ('sent', 'viewed', 'accepted', 'rejected', 'expired', 'withdrawn');
CREATE TYPE nil_invitation_type     AS ENUM ('membership', 'sponsorship', 'follow', 'co_guardianship', 'coaching', 'deal_inquiry');
CREATE TYPE nil_actor_type          AS ENUM ('guardian', 'athlete', 'institution', 'coach', 'sponsor', 'fan', 'compliance');

CREATE TABLE nil_invitations_list (
  id                    VARCHAR(255) PRIMARY KEY,   -- nilinv-{nanoid}
  invitation_type       nil_invitation_type NOT NULL,
  status                nil_invitation_status NOT NULL DEFAULT 'sent',

  -- Inviter (who sent the invitation)
  inviter_actor_type    nil_actor_type NOT NULL,
  inviter_tenant_id     VARCHAR(255),               -- institution/sponsor tenant (NULL for guardian/athlete/fan)
  inviter_user_id       VARCHAR(255),               -- auth0 user ID of inviter
  inviter_display_name  VARCHAR(255) NOT NULL,

  -- Invitee (who receives the invitation)
  invitee_actor_type    nil_actor_type NOT NULL,
  invitee_email         VARCHAR(255) NOT NULL,       -- email to send invitation to
  invitee_tenant_id     VARCHAR(255),                -- if invitee already has a tenant (existing actor)
  invitee_user_id       VARCHAR(255),                -- if invitee already has an auth0 account

  -- Subject athlete (the athlete-tenant this connection revolves around)
  athlete_tenant_id     VARCHAR(255) REFERENCES tenants(id),  -- the athlete-tenant at the center

  -- Guardian consent gate (required when athlete is a minor)
  requires_guardian_consent BOOLEAN NOT NULL DEFAULT false,
  guardian_consent_status   VARCHAR(50),             -- pending | approved | rejected | n/a

  -- Metadata
  message               TEXT,                        -- optional personal message from inviter
  token                 VARCHAR(255) NOT NULL UNIQUE, -- secure token for email link
  expires_at            timestamptz NOT NULL DEFAULT (now() + '7 days'::interval),
  viewed_at             timestamptz,
  responded_at          timestamptz,
  responded_by          VARCHAR(255),                -- auth0 user ID of who accepted/rejected
  connection_id         VARCHAR(255),                -- FK to the established connection row (set on accept)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_nilinv_invitee_email ON nil_invitations_list(invitee_email, status);
CREATE INDEX ix_nilinv_athlete ON nil_invitations_list(athlete_tenant_id, status);
CREATE INDEX ix_nilinv_inviter ON nil_invitations_list(inviter_user_id, status);
CREATE INDEX ix_nilinv_token ON nil_invitations_list(token);
```

### 14.4b Actor Onboarding Sessions (§18)

```sql
CREATE TYPE nil_onboarding_step AS ENUM (
  'register', 'verify_email', 'create_tenant', 'coppa_consent', 'complete_profile',
  'grant_consent', 'kyc_verification', 'invite_connections', 'assign_coaches',
  'set_tier', 'business_verification', 'discover_athletes', 'first_deal',
  'follow_athletes', 'identity_verification', 'review_existing', 'accept_transfer',
  'complete'
);

CREATE TABLE nil_onboarding_sessions_list (
  id                VARCHAR(255) PRIMARY KEY,   -- onboard-{actorType}-{nanoid}
  actor_type        nil_actor_type NOT NULL,
  user_id           VARCHAR(255) NOT NULL,       -- auth0 user ID
  tenant_id         VARCHAR(255),                -- tenant ID (if actor is tenant-scoped)
  athlete_tenant_id VARCHAR(255),                -- athlete-tenant (if onboarding is athlete-specific)
  current_step      nil_onboarding_step NOT NULL DEFAULT 'register',
  completed_steps   JSONB NOT NULL DEFAULT '[]',  -- array of completed step names + timestamps
  skipped_steps     JSONB NOT NULL DEFAULT '[]',  -- steps skipped (e.g., KYC if no deals yet)
  completion_pct    INTEGER NOT NULL DEFAULT 0,   -- 0-100
  status            VARCHAR(50) NOT NULL DEFAULT 'in_progress',  -- in_progress | completed | abandoned
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);
CREATE INDEX ix_onboard_user ON nil_onboarding_sessions_list(user_id, status);
CREATE INDEX ix_onboard_actor ON nil_onboarding_sessions_list(actor_type, status);
```

### 14.5 Versioned, Scoped Consent (§12.6)

```sql
CREATE TABLE consent_records_list (
  id                  VARCHAR(255) PRIMARY KEY,   -- consent-{atk}-{nanoid}
  athlete_tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),
  guardian_id         VARCHAR(255) NOT NULL REFERENCES guardians_list(id),
  scope               nil_consent_scope NOT NULL,
  granted             BOOLEAN NOT NULL,
  terms_version       VARCHAR(50) NOT NULL,        -- re-consent when this changes
  actor_ip            INET,
  created_at          timestamptz NOT NULL DEFAULT now()   -- append-only ledger; latest row per (athlete,scope) wins
);
CREATE INDEX ix_consent_athlete_scope ON consent_records_list(athlete_tenant_id, scope, created_at DESC);
```

### 14.6 Media & Metrics (§5.3, §12.7)

```sql
CREATE TABLE highlight_media_list (
  id                  VARCHAR(255) PRIMARY KEY,   -- hl-{atk}-{nanoid}
  tenant_id           VARCHAR(255) NOT NULL REFERENCES tenants(id),  -- athlete-tenant
  provider            VARCHAR(50) NOT NULL,        -- youtube | hudl | vimeo (allowlist)
  source_url          TEXT NOT NULL,
  thumbnail_url       TEXT,
  moderation_status   nil_moderation_status NOT NULL DEFAULT 'pending',
  submitted_by        VARCHAR(255) NOT NULL,       -- guardian/athlete/institution id (provenance)
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE athlete_metrics_list (
  id          VARCHAR(255) PRIMARY KEY,            -- metric-{atk}-{nanoid}
  tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),  -- athlete-tenant
  sport       VARCHAR(80) NOT NULL,
  stats_blob  JSONB NOT NULL DEFAULT '{}',         -- sport-agnostic (passing yards, PPG…)
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE athlete_achievements_list (
  id            VARCHAR(255) PRIMARY KEY,          -- ach-{atk}-{nanoid}
  tenant_id     VARCHAR(255) NOT NULL REFERENCES tenants(id),  -- athlete-tenant
  category      VARCHAR(50) NOT NULL,              -- athletic | academic | community
  title         VARCHAR(255) NOT NULL,
  verified_by   VARCHAR(255),                      -- institution/compliance id
  visibility_status nil_visibility_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### 14.7 Recruiting (institution-scoped)

```sql
CREATE TABLE recruiting_boards_list (
  id                    VARCHAR(255) PRIMARY KEY,  -- board-{instTk}-{nanoid}
  institution_tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
  coach_user_id         VARCHAR(255) NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scout_ratings_list (
  id                 VARCHAR(255) PRIMARY KEY,
  board_id           VARCHAR(255) NOT NULL REFERENCES recruiting_boards_list(id),
  athlete_tenant_id  VARCHAR(255) NOT NULL REFERENCES tenants(id),
  star_rating        SMALLINT CHECK (star_rating BETWEEN 1 AND 5),
  notes              TEXT,                         -- PRIVATE to the institution
  created_at         timestamptz NOT NULL DEFAULT now()
);
```

### 14.8 Sponsorship & Finance (cross-tenant, §12.4/§12.5)

```sql
CREATE TABLE sponsorship_deals_list (
  id                  VARCHAR(255) PRIMARY KEY,    -- deal-{atk}-{sponsorTk}-{nanoid}
  athlete_tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),
  sponsor_tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),
  base_amount_cents   BIGINT NOT NULL,
  status              nil_visibility_status NOT NULL DEFAULT 'pending',  -- reuse for deal lifecycle or add a dedicated enum
  compliance_status   nil_compliance_status NOT NULL DEFAULT 'not_started',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_deal_sponsor ON sponsorship_deals_list(sponsor_tenant_id);

CREATE TABLE escrow_milestones_list (
  id          VARCHAR(255) PRIMARY KEY,            -- escrow-{atk}-{nanoid}
  deal_id     VARCHAR(255) NOT NULL REFERENCES sponsorship_deals_list(id),
  tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),  -- athlete-tenant
  amount_cents BIGINT NOT NULL,
  state       nil_escrow_state NOT NULL DEFAULT 'proposed',
  release_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nonprofit_allocation_pools_list (
  id           VARCHAR(255) PRIMARY KEY,
  deal_id      VARCHAR(255) REFERENCES sponsorship_deals_list(id),
  entry_type   VARCHAR(10) NOT NULL CHECK (entry_type IN ('credit','debit')),  -- double-entry (§12.5)
  amount_cents BIGINT NOT NULL,
  memo         VARCHAR(255),
  created_at   timestamptz NOT NULL DEFAULT now()  -- append-only ledger
);

CREATE TABLE nil_eligibility_rules_list (
  id                  VARCHAR(255) PRIMARY KEY,
  state_code          CHAR(2) NOT NULL,
  association         VARCHAR(120) NOT NULL,
  age_band            nil_age_band NOT NULL,
  deals_allowed       BOOLEAN NOT NULL,
  max_deal_value_cents BIGINT,
  prohibited_categories TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (state_code, association, age_band)
);
```

### 14.9 Moderation, Messaging, Fan, Leads, Erasure

```sql
CREATE TABLE moderation_cases_list (
  id          VARCHAR(255) PRIMARY KEY,            -- mod-{atk}-{nanoid}
  tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),  -- athlete-tenant
  subject_type VARCHAR(50) NOT NULL,               -- media | profile | achievement
  subject_id  VARCHAR(255) NOT NULL,
  status      nil_moderation_status NOT NULL DEFAULT 'pending',
  reviewer_id VARCHAR(255),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE message_threads_list (
  id                VARCHAR(255) PRIMARY KEY,       -- thread-{atk}-{nanoid}
  athlete_tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
  guardian_id       VARCHAR(255) NOT NULL REFERENCES guardians_list(id),  -- REQUIRED participant (§12.2)
  counterparty_id   VARCHAR(255) NOT NULL,          -- coach/sponsor account
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- Invariant (enforce in service + DB check/trigger): no thread involving a minor without guardian_id.

CREATE TABLE fan_badges_list (
  id          VARCHAR(255) PRIMARY KEY,            -- badge-{atk}-{nanoid}
  tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id),  -- athlete-tenant followed
  fan_user_id VARCHAR(255) NOT NULL,
  badge_key   VARCHAR(50) NOT NULL,                -- SUPER_FAN | NIL_SUPPORTER
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nil_leads_list (
  id         VARCHAR(255) PRIMARY KEY,             -- nillead-{nanoid}, pre-tenant
  email      VARCHAR(255) NOT NULL,
  lead_type  VARCHAR(30) NOT NULL,                 -- athlete_parent | sponsor | investor
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE data_erasure_requests_list (
  id                VARCHAR(255) PRIMARY KEY,
  athlete_tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
  requested_by      VARCHAR(255) NOT NULL,          -- guardian id
  status            VARCHAR(30) NOT NULL DEFAULT 'requested',  -- requested|archived|anonymized|deleted
  certificate_url   TEXT,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

### 14.10 RLS Policy Pattern (per athlete-tenant)

```sql
-- Apply to every athlete-owned table (profile, media, metrics, achievements,
-- consent, escrow, moderation, threads, fan, erasure).
ALTER TABLE athlete_profiles_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY athlete_isolation ON athlete_profiles_list
  USING (tenant_id = current_setting('app.current_tenant', true));

-- Cross-tenant tables (sponsorship_deals_list, athlete_tenant_memberships_list):
-- visible to BOTH related tenants only (§12.4).
ALTER TABLE sponsorship_deals_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_dual_visibility ON sponsorship_deals_list
  USING (
    athlete_tenant_id = current_setting('app.current_tenant', true)
    OR sponsor_tenant_id = current_setting('app.current_tenant', true)
  );
```

> **Note for the junior agent:** match `current_setting('app.current_tenant', ...)` to however the existing codebase sets the RLS tenant GUC (grep for `set_config`/`app.current_tenant` — see `ProductQueueService.ts` / `queue-routes.ts`). Do not invent a new mechanism. RLS is **defense in depth**, not a substitute for explicit `WHERE tenant_id = $1` in queries.

### 14.11 CRM Engagement Tables (delta over existing `crm_*`)

**Good news — minimal work.** The existing CRM tables (`crm_support_tickets`, `crm_inquiries`, `crm_contacts`, `crm_tasks`, `crm_activities`, `crm_alerts`) already use `tenant_id VARCHAR(255)`, explicit `VARCHAR` ids, and RLS. So the NIL CRM (§16) **reuses them directly** with `tenant_id` = the relevant tenant (athlete / institution / sponsor). `actor_type` is a `VARCHAR` (app-level enum), so the new values need no schema change. Only two things to add: athlete/guardian linkage columns + the guardian-required invariant + the options table.

```sql
-- Link CRM records to an athlete-tenant + required guardian (child-safety, §16.3).
ALTER TABLE crm_support_tickets
  ADD COLUMN IF NOT EXISTS athlete_tenant_id VARCHAR(255) REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS guardian_id       VARCHAR(255) REFERENCES guardians_list(id);

ALTER TABLE crm_inquiries
  ADD COLUMN IF NOT EXISTS athlete_tenant_id VARCHAR(255) REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS guardian_id       VARCHAR(255) REFERENCES guardians_list(id);

-- Invariant: if a record concerns a minor athlete-tenant, a guardian MUST be attached.
-- Enforce in the service layer AND as a DB trigger (defense in depth, mirrors §12.8 messaging).
CREATE OR REPLACE FUNCTION nil_require_guardian_for_minor() RETURNS trigger AS $$
BEGIN
  IF NEW.athlete_tenant_id IS NOT NULL AND NEW.guardian_id IS NULL
     AND EXISTS (
       SELECT 1 FROM athlete_profiles_list p
       WHERE p.tenant_id = NEW.athlete_tenant_id AND p.age_band <> 'adult'
     )
  THEN RAISE EXCEPTION 'NIL: minor-subject CRM record requires guardian_id';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_guardian   BEFORE INSERT OR UPDATE ON crm_support_tickets
  FOR EACH ROW EXECUTE FUNCTION nil_require_guardian_for_minor();
CREATE TRIGGER trg_inquiry_guardian  BEFORE INSERT OR UPDATE ON crm_inquiries
  FOR EACH ROW EXECUTE FUNCTION nil_require_guardian_for_minor();

-- Merchant prefs for the nil_crm capability (mirror tenant_*_options_settings pattern).
CREATE TABLE tenant_nil_crm_options_settings (
  id          VARCHAR(255) PRIMARY KEY,                       -- generate*OptionsSettingsId
  tenant_id   VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id),
  settings    JSONB NOT NULL DEFAULT '{}',                    -- per-feature toggles
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_crm_ticket_athlete  ON crm_support_tickets(athlete_tenant_id);
CREATE INDEX ix_crm_inquiry_athlete ON crm_inquiries(athlete_tenant_id);
```

> App-level `actor_type` values extend from `'platform'|'tenant'|'customer'` to also accept `'compliance'|'institution'|'sponsor'|'guardian'` (§16.2). No DB enum exists, so this is a type/validation change only (`apps/web/src/types/crm.ts` + Zod schemas).

### 14.12 Bot Tables (delta over existing `bot_*`)

The existing bot stack (`bot_conversations`, `bot_messages`, `bot_faq_embeddings`, `bot_guardrail_rules`, `bot_configurations`) is already tenant-scoped (`tenant_id VARCHAR(255)`) with RLS, and **`bot_guardrail_rules` already exists for exactly the child-safety constraints in §17.2**. Reuse all of it. Deltas: athlete/guardian scoping on conversations + a minor-safety flag + the options table. (Note: existing bot ids are `@db.Uuid` with `gen_random_uuid()` — keep that convention for bot tables; do not switch to VARCHAR here.)

```sql
-- Scope a conversation to an athlete-tenant + guardian; flag minor-safe sessions.
ALTER TABLE bot_conversations
  ADD COLUMN IF NOT EXISTS athlete_tenant_id VARCHAR(255) REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS guardian_id       VARCHAR(255) REFERENCES guardians_list(id),
  ADD COLUMN IF NOT EXISTS is_minor_safe     BOOLEAN NOT NULL DEFAULT true;

-- Merchant prefs for the nil_bot capability.
CREATE TABLE tenant_nil_bot_options_settings (
  id          VARCHAR(255) PRIMARY KEY,
  tenant_id   VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id),
  settings    JSONB NOT NULL DEFAULT '{}',                    -- enabled bot personas, RAG sources
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

**Child-safety guardrails are data, not schema** — seed `bot_guardrail_rules` rows (via a `seed-nil-bot-guardrails.ts`, mirroring `seed-bot-data.ts`) that enforce §17.2: block any response containing minor PII (DOB, precise location, contact); block adult→minor direct conversational intent; force unanswered athlete-subject questions to escalate to the CRM (§16) as a guardian/compliance-routed inquiry rather than answering. The **eligibility knowledge base** for the Compliance bot is `nil_eligibility_rules_list` (§14.8) — index it into `bot_faq_embeddings` for RAG retrieval.

---

## 15. Per-Actor Internal Dashboards (Cross-Platform Engagement)

Every major actor gets a **scoped internal dashboard** that surfaces the items and relationships relevant to them and routes cross-actor coordination through the engagement layer (§16 CRM, §17 bot). These reuse the platform's existing dashboard primitives — do not build new shells.

**Reuse these existing patterns (do not reinvent):**
- Shell + sidebar: `apps/web/src/components/crm/CrmPageShell.tsx` + `CrmNavPanel.tsx` (Mantine; breadcrumbs, badge counts, nav).
- Dashboard composition: `apps/web/src/app/(platform)/settings/admin/crm/page.tsx` (stat cards + "All / My Work" toggle + parallel `Promise.allSettled` loads).
- Tenant dashboard widget pattern: `apps/web/src/components/dashboard/TenantDashboardV2.tsx`, `CapabilityShowcase.tsx`, `PlanSummaryPanel.tsx`.
- Read-state + unread counts: `CrmTenantCrmService.getReadState()/setReadState()` + `CrmTenantCrmStats` (per-scope `unread_count`).
- Proactive nudges: `GrowthTipService`, `NextStepsService`, `apps/web/src/lib/growth-tips/tipEngine.ts`.

### 15.1 Dashboard per actor

| Actor | NIL Base (§13) | Route | Primary Widgets | Cross-platform engagement surfaces |
|---|---|---|---|---|
| **Guardian** | `GuardianApiSingleton` | `/guardian` | My Athletes (multi-tenant switcher), consent status per scope, pending approvals (deals/media/messages), payout/KYC status, alerts | Approve/deny institution & sponsor requests; guardian-gated message threads (§12.8); deal inbox |
| **Athlete** (≥ age-out) | `AthleteApiSingleton` | `/athletes/:athleteTenantId` | Profile completeness, metrics, media moderation state, achievement verification, follower/badge counts | Incoming recruiting interest (guardian-gated until age-out); deal offers |
| **Institution (School/Club + Coach)** | `InstitutionApiSingleton` | `/institutions/:tenantId` | Roster pipeline (pending→approved), achievement verification queue, recruiting boards, membership/transfer requests | Invite athletes, submit/verify achievements, request profile links (guardian-approved) |
| **Sponsor** | `SponsorApiSingleton` | `/sponsors/:tenantId` | Deal pipeline (Kanban), escrow/milestone status, spend-vs-cap, eligible-athlete discovery (consented/public only) | Propose deals, message via guardian-gated threads, ROI analytics |
| **Fan** | `FanApiSingleton` | `/fans` | Followed athletes feed, badges, public achievements | Public engagement only — never any minor PII or contact (§12.2) |
| **Compliance / Admin** | `ComplianceApiSingleton` | `/admin/nil` | Global review queues (profiles, media, deals), eligibility verdicts, audit log, abuse reports | Status overrides, broadcast alerts, erasure requests (§12.1) |

### 15.2 Rules
- Each dashboard is **scoped by its NIL base** — a Guardian dashboard only ever sees athlete-tenants they own (`guardian_athlete_links_list`); an Institution only its roster; a Sponsor only its deals (§12.4 dual-visibility).
- Every dashboard reads through the engagement layer (§16/§17), never raw `fetch`.
- Avoid the polling-loop anti-pattern (§12.11) — seed from server-resolved context + React Query; use `getReadState` for unread badges instead of re-polling lists.
- All cross-actor coordination involving a minor is **guardian-gated**: requests land in the guardian's approval queue, not directly on the athlete.

---

## 16. Internal CRM — Engagement & Relationship Hub

Mirror the platform's existing CRM (a mature, three-surface implementation) rather than building new. The NIL CRM is the connective tissue for cross-platform engagement between guardians, institutions, sponsors, and compliance.

**Existing implementation to mirror (study these first):**
- Backend services: `apps/api/src/services/CrmTicketService.ts` (CRUD + status transitions + **auto-logged activities** + SLA timestamps + Kanban `reorder`), `apps/api/src/routes/crm/tenant/crm-tenant.ts`, `FaqCrmIntegrationService.ts`.
- Web services (three surfaces): `CrmAdminService` (`extends AdminApiSingleton`, `/api/admin/crm/*`), `CrmTenantCrmService` (`extends TenantApiSingleton`, `/api/tenant/crm/*`), and the Customer surface (`/api/.../crm`). Shared types in `apps/web/src/types/crm.ts`.
- Gating: capability `crm-options` (`getOptions/updateOptions` → `unifiedCapabilityService.invalidateTenantCapabilities`) + RBAC perms in `apps/web/src/config/rbac.ts` (`CAN_VIEW_CRM`, `CAN_MANAGE_CRM_SALES/SUPPORT/OPS`).

### 16.1 Surface mapping (NIL ⇄ existing CRM)

| Existing CRM surface | Base | NIL surface | NIL Base (§13) | Scope |
|---|---|---|---|---|
| Admin CRM (`/api/admin/crm/*`) | `AdminApiSingleton` | **Compliance CRM** | `ComplianceApiSingleton` | Global queues, audit, broadcast alerts |
| Tenant CRM (`/api/tenant/crm/*`) | `TenantApiSingleton` | **Institution / Sponsor CRM** | `InstitutionApiSingleton` / `SponsorApiSingleton` | Their roster / deals + contacts/tickets/tasks |
| Customer CRM | `CustomerApiSingleton` | **Guardian CRM** | `GuardianApiSingleton` | Their athlete-tenants, inquiries, deal inbox |

### 16.2 Entities (reuse CRM shapes, scope to athlete-tenant)

Reuse the existing entity model (`CrmContact`, `CrmTicket`, `CrmTask`, `CrmActivity`, `CrmInquiry`, `CrmAlert`, Requests Hub) with NIL scoping:

- **`actor_type`** extends the existing `'platform' | 'tenant' | 'customer'` enum to `'compliance' | 'institution' | 'sponsor' | 'guardian'` (keep platform values for back-compat).
- **Tickets/Inquiries** are scoped to the **athlete-tenant** where they concern an athlete (e.g. a sponsor inquiry about an athlete), otherwise to the institution/sponsor tenant. IDs via `generateCrmTicketId(tenantId)`-style helpers, `tenant_id` = the relevant tenant.
- **Activities** remain **append-only** and double as part of the §12.11 audit trail (status/consent/deal changes auto-log a `crm_activities` row, exactly like `CrmTicketService.update`).
- **Alerts** reuse per-tenant + `broadcastAlert` (e.g. compliance broadcasts an eligibility-rule change to affected institutions).
- **Requests Hub** unifies tickets/tasks/inquiries into one inbox per actor (`CrmRequestItem`), powering the dashboard approval queues in §15.

### 16.3 Child-safety constraints on the CRM
- Any CRM thread/inquiry/ticket whose subject is a minor athlete-tenant **must include the guardian** (mirror the §12.8 messaging invariant); a sponsor↔athlete ticket without the guardian is structurally invalid.
- No CRM surface projects athlete PII to an actor who lacks a consented relationship (§12.6) — enforce in the DTO mappers, same as §3.2.
- Capability: `nil_crm` (per-feature, §7). Gate every CRM service with `requireFeature(tenantId, 'nil_crm')`.

---

## 17. Bot Infrastructure (Assistive Automation)

Mirror the platform's existing **RAG chatbot + FAQ** stack. NIL bots are assistive and compliance-aware — and, critically, **never an unsupervised conversational channel to a minor**.

**Existing implementation to mirror (study these first):**
- RAG + responses: `apps/api/src/services/BotRagService.ts`, `BotDynamicResponseService.ts`.
- Routes: `apps/api/src/routes/bot-public.ts` (anonymous storefront widget), `bot-merchant.ts` (tenant config).
- Web services/widgets: `BotService.ts`, `PublicBotService.ts`, `components/bot/PublicBotWidget.tsx`, `BotTenantWidget.tsx`, `BotOptionsPage.tsx`.
- FAQ knowledge base: `FaqService.ts`, `FaqCoverageService.ts`, `FaqCrmIntegrationService.ts` (bot → unanswered → CRM inquiry/ticket loop).
- Gating + seeds: `chatbot-options-settings.ts`, `ChatbotOptionsResolver.ts`, `seed-chatbot-capabilities.ts`, `seed-bot-data.ts`. Add-a-provider playbook: `.devin/skills/add-ai-provider.md`.

### 17.1 NIL bot personas

| Bot | Audience | Base | RAG knowledge source | Purpose |
|---|---|---|---|---|
| **Compliance / Eligibility Bot** | Institution, Sponsor, Compliance | `ComplianceApiSingleton` | `nil_eligibility_rules_list` (§14.8) + state/association bylaws | Answer "is this deal allowed in state X for age band Y?"; pre-screen before deal creation |
| **Guardian Onboarding Bot** | Guardian | `GuardianApiSingleton` | FAQ + consent docs | Walk guardians through COPPA-compliant setup, scoped consent (§12.6), KYC/payout |
| **Recruiting / Sponsor FAQ Bot** | Coach, Sponsor | `Institution`/`SponsorApiSingleton` | FAQ + public, consented athlete data only | Answer platform/process questions; surface eligible (consented) athletes |
| **Fan Bot** | Fan (public) | `NilPublicApiSingleton` | Public FAQ + approved data | Public engagement; never any minor PII |

### 17.2 Hard child-safety constraints (override convenience)
- **No bot is a direct conversational channel between an adult/anonymous user and a minor.** An athlete-facing assistant is available only to the guardian (or the athlete after age-out), and never solicits or stores PII from a minor.
- The public Fan/Recruiting bot answers only from **approved + consented** data — it must never reveal DOB, precise location, contact, or non-consented fields (§12.2/§12.6); enforce at the RAG retrieval filter, not just the prompt.
- Bot → unanswered question flows into the **CRM** (§16) as a guardian/compliance-routed inquiry (reuse `FaqCrmIntegrationService`), never a back-channel to the athlete.
- Bots are **assistive only** for legal/financial decisions: the Compliance bot *surfaces* the rule but the authoritative gate remains `ComplianceVettingService` + `nil_eligibility_rules_list` (§12.1). A bot answer never auto-approves a deal or a profile.
- Capability: `nil_bot` (per-feature, §7). Gate with `requireFeature(tenantId, 'nil_bot')`; merchant prefs in `tenant_nil_bot_options_settings`.

### 17.3 Data + audit
- Bot conversations involving an athlete-tenant are scoped to it (`tenant_id` = athlete-tenant), 0-TTL, never public-cached.
- Every bot-initiated CRM escalation or compliance lookup emits an `X-Audit-ID` (§12.11), so the full assistive trail is auditable.

---

## 18. Invitation Architecture & Actor-Aware Onboarding

The platform's growth is driven by a **bidirectional invitation system**: the athlete (via guardian) can invite any actor to connect, and any actor can invite the athlete to establish a platform-connected link. This mirrors the existing platform's `invitations` table pattern (email + token + role + tenant_id + accepted_at) but extends it for NIL's multi-actor, guardian-gated, consent-scoped connection model.

### 18.1 Bidirectional Invitation Matrix

| Inviter → Invitee | Invitation Type | Connection Established | Guardian Gate? | Consent Scope Triggered |
|---|---|---|---|---|
| **Guardian/Athlete → School/Club** | `membership` | `athlete_tenant_memberships_list` row | Yes (guardian sends) | `public_profile` (if not already granted) |
| **School/Club → Guardian/Athlete** | `membership` | `athlete_tenant_memberships_list` row | Yes (guardian must accept) | `public_profile` |
| **Guardian/Athlete → Sponsor** | `sponsorship` | Sponsor-athlete relationship (no deal yet) | Yes (guardian sends) | `nil_deals` (on first deal proposal) |
| **Sponsor → Guardian/Athlete** | `deal_inquiry` | Sponsor-athlete relationship + optional deal draft | Yes (guardian must accept) | `nil_deals` |
| **Guardian/Athlete → Coach** | `coaching` | Coach-athlete following link | Yes (guardian sends) | `messaging` (if coach wants to contact) |
| **Coach → Guardian/Athlete** | `coaching` | Coach-athlete following link | Yes (guardian must accept) | `messaging` |
| **Guardian → Guardian** | `co_guardianship` | `guardian_athlete_links_list` co-ownership row | Yes (existing guardian sends, new guardian accepts) | N/A — co-ownership grants `consent_authority` |
| **Athlete → Fan** | `follow` | `fan_follows_list` row | No (if athlete is public/approved) | N/A — public engagement only |
| **Fan → Athlete** | `follow` | `fan_follows_list` row | No (auto-accepted for public profiles) | N/A — public engagement only |
| **Institution → Coach** | `coaching` | Coach assigned to institution-tenant | No (institution admin sends) | N/A — role assignment |

### 18.2 Invitation Lifecycle

```
┌──────┐     ┌───────┐     ┌──────────┐     ┌──────────┐
│ sent │────▶│ viewed │────▶│ accepted │────▶│ connection │
│      │     │       │     │  /rejected│     │ established│
└──────┘     └───────┘     └──────────┘     └──────────┘
    │                            │
    │ (7 days)                   │ (guardian rejects)
    ▼                            ▼
┌────────┐                 ┌──────────┐
│ expired│                 │ rejected │
└────────┘                 └──────────┘
                                │
                                │ (30-day block)
                                ▼
                          ┌──────────────┐
                          │ re-invite    │
                          │ blocked 30d  │
                          └──────────────┘
```

**State transitions:**
- `sent → viewed`: Invitee opens the email link or sees the invitation in their dashboard
- `viewed → accepted`: Invitee accepts; if guardian gate is active, guardian must also accept
- `viewed → rejected`: Invitee or guardian rejects; 30-day re-invitation block applies
- `sent → expired`: 7 days pass with no response; can re-send after 7 days
- `sent/viewed → withdrawn`: Inviter cancels the invitation; no re-invitation block

### 18.3 Guardian Consent Gate

When an invitation involves a minor athlete, the `requires_guardian_consent` flag is `true` and the acceptance flow is two-phase:

1. **Invitee accepts** (e.g., school accepts the membership invitation, or sponsor accepts the connection) → `guardian_consent_status = 'pending'`
2. **Guardian approves** → `guardian_consent_status = 'approved'` → connection row is created → `status = 'accepted'`

If the guardian rejects: `guardian_consent_status = 'rejected'` → `status = 'rejected'` → 30-day block.

For **most-restrictive-wins** (§12.3): if multiple consent-authority guardians exist, all must approve. Any one can reject. The invitation dashboard shows per-guardian approval status.

### 18.4 Connection Establishment Side Effects

When an invitation is accepted and the connection is established, the following side effects fire automatically:

| Invitation Type | Side Effects |
|---|---|
| `membership` | Create `athlete_tenant_memberships_list` row (status='active') → invalidate roster cache → trigger Next Steps update for both actors |
| `sponsorship` | Create sponsor-athlete relationship record → enable deal proposal flow → trigger `nil_deals` consent scope request |
| `coaching` | Create coach-athlete following record → enable guardian-gated messaging → trigger `messaging` consent scope request |
| `co_guardianship` | Create `guardian_athlete_links_list` row (consent_authority = true) → grant new guardian access to athlete dashboard |
| `follow` | Create `fan_follows_list` row → update follower count → check/award fan badges |
| `deal_inquiry` | Create sponsor-athlete relationship + optional `sponsorship_deals_list` draft (status='proposed') → trigger `nil_deals` consent scope + guardian approval queue |

### 18.5 Actor-Aware Onboarding State Machines

Each actor type has a defined onboarding step sequence. The `OnboardingService` tracks progress in `nil_onboarding_sessions_list`.

**Guardian Onboarding:**
```
register → verify_email → create_tenant (athlete) → coppa_consent →
complete_profile → grant_consent → invite_connections → complete
```
- `coppa_consent` is blocking for under-13 athletes (COPPA §12.1)
- `invite_connections` is non-blocking (can do later) but shown as a Next Step
- KYC step is deferred until first deal is accepted (not part of initial onboarding)

**Athlete Onboarding (post age-out):**
```
accept_transfer → identity_verification → review_existing →
accept_transfer → complete
```
- `review_existing` shows the athlete their current profile, consent ledger, active deals, and financial routing
- `accept_transfer` transfers athlete-tenant ownership from guardian to athlete

**Institution Onboarding:**
```
register → verify_email → create_tenant → set_tier →
invite_connections (athletes) → assign_coaches → complete
```
- `set_tier` selects subscription tier (gates capability breadth, §12.9)
- `assign_coaches` sends coaching invitations to coach emails

**Coach Onboarding:**
```
register → verify_email → (accept institution invitation) →
complete_profile → invite_connections (athletes) → complete
```
- Coach must be invited by an institution (no self-registration without institution context)
- `invite_connections` sends coaching invitations to athlete guardians

**Sponsor Onboarding:**
```
register → verify_email → create_tenant → set_tier →
business_verification → discover_athletes → complete
```
- `business_verification` collects business name, EIN, website, logo (required before first deal)
- `discover_athletes` is non-blocking (can do later) but shown as a Next Step

**Fan Onboarding:**
```
register → verify_email → follow_athletes → complete
```
- Minimal flow — fans don't need invitations or tenants
- `follow_athletes` is non-blocking but recommended

**Compliance Onboarding:**
```
register → verify_email → identity_verification → complete
```
- Platform-provisioned account (no self-registration)
- `identity_verification` collects legal name, bar/license number (if applicable)

### 18.6 Invitation Routes

| Route | Method | Actor | Purpose |
|---|---|---|---|
| `POST /api/:scope/invitations` | POST | Any authenticated actor | Send invitation (type, invitee email, athlete-tenant, message) |
| `GET /api/:scope/invitations` | GET | Any authenticated actor | List invitations sent by this actor |
| `GET /api/:scope/invitations/pending` | GET | Any authenticated actor | List pending invitations received by this actor |
| `GET /api/invitations/:token` | GET | Public (token-authenticated) | View invitation details (no auth required — token in URL) |
| `POST /api/invitations/:token/accept` | POST | Public (token) or authenticated | Accept invitation (triggers guardian consent gate if needed) |
| `POST /api/invitations/:token/reject` | POST | Public (token) or authenticated | Reject invitation (triggers 30-day block) |
| `POST /api/:scope/invitations/:id/withdraw` | POST | Inviter | Withdraw sent invitation |
| `POST /api/guardian/invitations/:id/approve` | POST | Guardian | Approve invitation for minor athlete (consent gate) |
| `POST /api/guardian/invitations/:id/reject` | POST | Guardian | Reject invitation for minor athlete (consent gate) |
| `GET /api/:scope/onboarding` | GET | Any authenticated actor | Get onboarding session state |
| `POST /api/:scope/onboarding/step/:step` | POST | Any authenticated actor | Mark onboarding step complete |
| `POST /api/:scope/onboarding/step/:step/skip` | POST | Any authenticated actor | Skip non-blocking onboarding step |

### 18.7 Invitation Service (Backend)

`InvitationService` (extends `BaseService`, 0-TTL — never cache invitation state):

| Method | Purpose |
|---|---|
| `createInvitation(params)` | Create invitation row, generate secure token, send email via `email-service.ts` (reuse platform pattern) |
| `getInvitationByToken(token)` | Fetch invitation by token (public route, no auth) |
| `listSentInvitations(actorUserId)` | List invitations sent by this actor |
| `listPendingInvitations(actorUserId)` | List invitations received and pending |
| `acceptInvitation(token, actorUserId)` | Accept invitation → check guardian gate → establish connection → fire side effects |
| `rejectInvitation(token, actorUserId, reason?)` | Reject invitation → set 30-day block |
| `withdrawInvitation(invitationId, inviterUserId)` | Withdraw invitation (inviter only) |
| `guardianApprove(invitationId, guardianId)` | Guardian approves consent-gated invitation |
| `guardianReject(invitationId, guardianId, reason?)` | Guardian rejects consent-gated invitation |
| `checkReinvitationBlock(inviteeEmail, athleteTenantId)` | Check if re-invitation is blocked (30-day for rejected, 7-day for expired) |
| `establishConnection(invitation)` | Internal: create the appropriate connection row based on invitation type |

**Anti-spam:** `checkReinvitationBlock` queries `nil_invitations_list` for rejected invitations within the last 30 days (or expired within 7 days) for the same `(invitee_email, athlete_tenant_id, invitation_type)` tuple. If found, the new invitation creation is blocked with a 429 response.

### 18.8 Onboarding Service (Backend)

`OnboardingService` (extends `BaseService`):

| Method | Purpose |
|---|---|
| `getOrCreateSession(actorType, userId)` | Get or create onboarding session for this actor |
| `getSession(userId)` | Get current onboarding session state |
| `completeStep(userId, stepName)` | Mark a step complete → advance current_step → recompute completion_pct |
| `skipStep(userId, stepName)` | Skip a non-blocking step → advance current_step |
| `abandonSession(userId)` | Mark session as abandoned (user left without completing) |
| `getCompletionPct(userId)` | Returns 0-100 based on actor-specific step count |
| `getActorSteps(actorType)` | Returns the step sequence for this actor type |

**Step graph per actor** is defined in a static config map (not in DB) — the DB only tracks which steps are completed/skipped for each session.

### 18.9 Frontend Integration

**Invitation UI surfaces:**
- **Dashboard invitation widget**: Shows pending received invitations on every actor's dashboard (in the standard panels rail, §3a of FRONTEND_SPEC)
- **Invite button**: Present on athlete profile (guardian view), institution roster, sponsor discovery, coach recruiting board — opens invitation modal with connection type pre-selected
- **Invitation acceptance page**: Public route `/invite/:token` — shows invitation details, accept/reject buttons, guardian consent notice if applicable
- **Invitation management page**: Per-actor route (`/guardian/invitations`, `/sponsors/:id/invitations`, etc.) — lists sent + received invitations with status

**Onboarding UI surfaces:**
- **Onboarding wizard**: Multi-step modal/flow shown on first login (detected via `nil_onboarding_sessions_list.status = 'in_progress'`)
- **Onboarding progress bar**: Shown in dashboard header or standard panels rail
- **Skip for now**: Non-blocking steps show "Skip for now" link; skipped steps appear as Next Steps (§3a.4)
- **Resume onboarding**: If user leaves mid-onboarding, dashboard shows "Continue setup (60% complete)" banner

### 18.10 Email Integration

Invitation emails are sent via the existing `email-service.ts` (platform pattern). Email templates:

| Template | Trigger | Content |
|---|---|---|
| `nil-invitation-membership` | School/athlete membership invitation | "[Institution] invites [Athlete] to join their roster" / "[Athlete] wants to join [Institution]" |
| `nil-invitation-sponsorship` | Sponsor/athlete connection invitation | "[Sponsor] wants to connect for NIL opportunities" / "[Athlete] invites you to connect" |
| `nil-invitation-coaching` | Coach/athlete connection invitation | "[Coach] wants to follow [Athlete]" / "[Athlete] invites you to connect" |
| `nil-invitation-co-guardian` | Guardian co-ownership invitation | "[Guardian] invites you to co-manage [Athlete]" |
| `nil-invitation-follow` | Fan follow invitation | "[Athlete] invites you to follow their journey" |
| `nil-invitation-deal-inquiry` | Sponsor deal inquiry | "[Sponsor] has a NIL deal opportunity for [Athlete]" |

Each email contains a CTA link to `/invite/:token` with the secure token.

### 18.11 Capability Gating

Invitations and onboarding are **not capability-gated** — they are platform-level features available to all actors regardless of tier. This ensures the network-effect growth model is never blocked by subscription state. However, the **connections established by invitations** may be capability-gated:

- A school with `nil_roster` disabled can still receive membership invitations, but the roster won't be publicly visible until the capability is enabled
- A sponsor with `nil_sponsorship` disabled can still receive connection invitations, but cannot propose deals until the capability is enabled
- Onboarding is always available — even expired tenants can onboard (they just can't use features until renewal)

### 18.12 Audit & Safety

- Every invitation state transition emits an `X-Audit-ID` (§12.11)
- Rejected invitations with a reason are logged for abuse monitoring
- Rate limiting: max 50 invitations per actor per 24 hours (configurable)
- All invitation tokens are 32-byte cryptographic random (same as platform `invitations` table)
- Tokens expire after 7 days (configurable per invitation type)
- Guardian consent gate is a hard block — no invitation involving a minor can be accepted without guardian approval
