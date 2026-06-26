# NIL Youth Sports Platform — Implementation Plan

> **Status:** Execution playbook derived from `TECHNICAL_SPEC.md` (analysis/design complete). This document turns the spec into an ordered, skill-anchored backlog a junior agent can execute one task at a time.
>
> **Guiding force:** Every task points to an existing project skill in `.devin/skills/`. **Do not improvise a pattern that a skill already defines.** When a step says "follow `X.md`", read that skill first and mirror it exactly.
>
> **Scope discipline:** No code is written until the relevant phase is explicitly greenlit. This plan is the contract; the spec is the reference.

---

## 0. How to Use This Plan

- Work **top-to-bottom**; phases gate on each other. Within a phase, complete tasks in listed order.
- Each task has: **Skill** (the playbook to follow), **Deliverables** (files/artifacts), **Acceptance** (how "done" is proven).
- **Definition of Done for every task:** `pnpm checkapi` + `pnpm checkweb` pass (zero TS errors), the skill's own checklist passes, and no raw `fetch` / no `randomUUID`/`Date.now()` ids were introduced.
- **P0 safety/legal gates are blocking.** A phase cannot ship if any P0 acceptance check (from `TECHNICAL_SPEC.md` §12) is red — even if functionally "working".

### 0.1 Skill index (the guiding force)

| Concern | Skill to follow |
|---|---|
| Tenant-scoped IDs (incl. athlete-as-tenant) | `tenant-scoped-id-generation.md` |
| Singleton base services (NIL §13 bases) | `deploy-service-extending-base-singleton.md`, `server-resolved-context-delegator.md` |
| New capability (the 8-phase pipeline) | `add-capability-feature.md`, `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `link-features-to-capability-type.md` |
| Capability wiring + verification | `capability-system-integration.md`, `verify-capability-deployment.md` |
| Org/tenant-type capability | `add-org-capability.md` |
| Larger feature scaffold | `add-bsaas-feature.md`, `skill-driven-feature-implementation.md` |
| Storefront / public surfaces | `add-storefront-type.md`, `troubleshooting-public-page-api-leaks.md` |
| Sport-agnostic typed entities | `add-product-type.md` (pattern reference) |
| CRM / alerts / engagement | `alerts-and-notifications.md` |
| Bot / RAG / AI | `add-chatbot-skill.md`, `add-ai-provider.md`, `bot-widget-troubleshooting.md` |
| Dashboards (no load loops) | `fix-tenant-dashboard-load-loop.md`, `dashboard-performance-audit.md`, `debug-infinite-render-loops.md` |
| Caching correctness | `cross-context-cache-invalidation.md` |
| Observability | `structured-logging.md`, `correlation-id-troubleshooting.md` |
| DB exploration | `database-navigation-system.md` |
| Media facade | `product-video.md` |

---

## 1. Pre-Flight (Phase 0) — Decisions & Foundations

Blocking prerequisites before any feature code.

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 0.1 | **Confirm fee parameters** (`TECHNICAL_SPEC.md` §12.10 — model RESOLVED: deal = purchase, platform transaction fee). Set the fee %, guardian-payout split, and non-profit pool slice; confirm payer-keyed tier matrix. | `bsaas-purchase-flow.md` | Fee config values recorded in spec §12.10. | Numbers signed off; tier payer matrix confirmed (model itself is settled). |
| 0.2 | **Confirm `tenants.tenant_type` is alterable** (athlete/institution/sponsor). If not, design the side-table fallback. | `database-navigation-system.md` | Decision note in spec §14.2. | Migration approach chosen; no assumption left open. |
| 0.3 | **Map RLS GUC mechanism** — confirm how `app.current_tenant` is set in this codebase. | `database-navigation-system.md` | Note in spec §14.10 confirming the exact `set_config` call site. | A reference query runs under RLS with the athlete-tenant set. |
| 0.4 | **Legal review of P0 constraints** (COPPA/FERPA/state-NIL/erasure). | — | Compliance sign-off doc. | Legal confirms §12.1/§12.2 design is sufficient for MVP. |

> **Gate:** Phase 1 does not start until 0.2–0.4 are green (0.4 is a hard legal gate). 0.1 is now a parameter-tuning task, not a blocker — the monetization *model* is resolved (§12.10).

> **Capability build shortcut (spec §7.1):** Every `nil_*` capability has a commerce counterpart. When you build one, open its existing analog first (e.g. `nil_crm` ⇐ `crm_options`, `nil_bot` ⇐ `chatbot_options`, `nil_finance` ⇐ checkout/escrow + `bsaas-purchase-flow.md`) and copy its resolver/route/mapper structure. The NIL-specific work is the child-safety/consent overlay (§12), not the plumbing.

---

## 2. Phase 1 — The Credibility Shell (Investor Validation)

**Objective (spec §4 Phase 1):** Static, edge-routed marketing presence + lead capture. No private data.

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 1.1 | Add `generateNilLeadId()` + `nil_leads_list` table. | `tenant-scoped-id-generation.md` | `id-generator.ts` entry; migration. | ID format `nillead-{nanoid}`; `pnpm checkapi` green. |
| 1.2 | Marketing landing route + NIL brand domain in `proxy.ts` env config. | `add-storefront-type.md` | Next.js marketing segment; domain config. | TLS handshake + 200 on landing (spec §10 item 1). |
| 1.3 | Lead intake form (athlete/parent vs sponsor vs investor) via `NilPublicApiSingleton`. | `deploy-service-extending-base-singleton.md`, `troubleshooting-public-page-api-leaks.md` | `NilLeadService`; public route; Zod schema. | No PII publicly readable; lead writes succeed; no raw `fetch`. |
| 1.4 | Register `nil_landing` capability (tier-only, all tiers). | `add-capability-feature.md`, `capability-deployment-flow.md` | Feature def + seed + resolver stub. | `verify-capability-deployment.md` checklist passes. |

**Milestone M1:** Investor-ready public shell live; leads captured; zero private surfaces.

---

## 3. Phase 2 — The Native Pipeline (Core Ingestion & Display)

**Objective (spec §4 Phase 2):** Secure data loop intake → pending → review → approved public roster. **This is where athlete-as-tenant + the firewall + P0 safety gates land.**

### 3.1 Data foundations

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 2.1 | Enums + athlete-tenant extension (`tenant_type`, `athlete_profiles_list`). | `tenant-scoped-id-generation.md`, `database-navigation-system.md` | Migration from spec §14.1–14.2. | Athlete provisions as a `tenant`; RLS enabled. |
| 2.2 | `generateAthleteTenantId`, `generateGuardianId`, `generateGuardianAthleteLinkId`, `generateConsentRecordId`, `generateHighlightId`, `generateAthleteMetricsId`, `generateModerationCaseId`. | `tenant-scoped-id-generation.md` | `id-generator.ts` entries. | All formats match spec §6; collision check done. |
| 2.3 | Guardianship + consent tables (`guardians_list`, `guardian_athlete_links_list`, `consent_records_list`). | `database-navigation-system.md` | Migrations from spec §14.3, §14.5. | Versioned/scoped consent ledger writable. |
| 2.4 | Media/metrics/achievement tables (`highlight_media_list`, `athlete_metrics_list`, `athlete_achievements_list`, `moderation_cases_list`). | `product-video.md` (facade), `database-navigation-system.md` | Migrations from spec §14.6, §14.9. | Media defaults `pending`; allowlist column present. |
| 2.5 | RLS policies per athlete-tenant. | `database-navigation-system.md` | Policies from spec §14.10. | Cross-athlete query returns zero rows (spec §10 RLS test). |

### 3.2 Services & singleton bases

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 2.6 | NIL base singletons: `NilPublicApiSingleton`, `AthleteApiSingleton`, `GuardianApiSingleton`, `ComplianceApiSingleton`. | `deploy-service-extending-base-singleton.md`, `server-resolved-context-delegator.md` | Base classes from spec §13. | TTL/headers/isolation defaults set; singletons enforced. |
| 2.7 | `AthleteProfileService` (CRUD + status transitions, guardian-authorized) + `GuardianConsentService`. | `deploy-service-extending-base-singleton.md` | Backend services (spec §9). | Non-`consent_authority` write → 403 (spec §8 hard rule). |
| 2.8 | `MediaModerationService` (queue + allowlist validation). | — | Backend service + allowlist (`parseVideoUrl`). | Non-allowlisted host rejected; media can't publish unmoderated. |
| 2.9 | `NilRosterService` + public roster route (`approved` + consent-filtered). | `troubleshooting-public-page-api-leaks.md` | Public read route; DTO mappers strip PII. | PII projection test passes (spec §10); GPA only with consent. |

### 3.3 Capability + firewall + cache

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 2.10 | Register `nil_roster` (master toggle + tier row caps) end-to-end (all 8 phases). | `add-capability-feature.md`, `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `link-features-to-capability-type.md`, `capability-system-integration.md` | Resolver `resolveNilRoster`, route, mapper, hook, dashboard rows. | `verify-capability-deployment.md` passes; R13 expired-manifest works. |
| 2.11 | Register `nil_compliance` as a **Phase-2 prerequisite** (manual verdict initially). | `add-capability-feature.md` | Compliance status gate. | No profile reaches `approved` without verdict. |
| 2.12 | Visibility state machine + per-athlete cache eviction on status/consent change. | `cross-context-cache-invalidation.md` | Cache contract on `AthleteApiSingleton`. | Approve → roster reflects within one request; full namespace eviction. |

### 3.4 P0 safety gates (blocking)

| # | Task | Skill | Deliverables | Acceptance (spec §12.12) |
|---|---|---|---|---|
| 2.13 | COPPA guardian-initiated intake for under-13. | — | Age-band logic; guardian-only registration. | Athlete-initiated under-13 intake → 403. |
| 2.14 | Consent revocation cascade → `archived` + full cache eviction. | `cross-context-cache-invalidation.md` | Revocation flow. | Revoke removes profile+media within one request. |
| 2.15 | Media moderation gate + host allowlist. | — | Moderation enforcement. | Unmoderated/non-allowlisted media never public. |

**Milestone M2:** A guardian can create an athlete-tenant, grant scoped consent, pass moderation+compliance, and see the athlete on the public roster — with every P0 negative-path test green.

---

## 4. Phase 3 — The Unified Service (Persona Specialization & Engagement)

**Objective (spec §4 Phase 3):** Authenticated portals, cross-platform engagement (CRM + bot), distinct privacy rules.

### 4.1 Remaining singleton bases + memberships

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 3.1 | `InstitutionApiSingleton`, `SponsorApiSingleton`, `FanApiSingleton`. | `deploy-service-extending-base-singleton.md` | Base classes (spec §13). | Bases configured; singletons enforced. |
| 3.2 | `athlete_tenant_memberships_list` + `AthleteMembershipService` (transfers). | `tenant-scoped-id-generation.md` | Migration §14.4 + service. | Transfer preserves history; cross-tenant row visible to both. |

### 4.2 Persona capabilities (each full 8-phase)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 3.3 | `nil_guardian` (dashboard, scoped consent, financial routing). | `add-capability-feature.md`, `capability-deployment-flow.md` | Full capability. | `verify-capability-deployment.md` passes. |
| 3.4 | `nil_recruiting` (boards, ratings) — guardian-gated contact. | `add-capability-feature.md` | Full capability. | Adult→minor contact impossible (spec §12.2). |
| 3.5 | `nil_sponsorship` (cross-tenant deals). | `add-capability-feature.md`, `add-org-capability.md` | Full capability + deal RLS (spec §12.4). | Deal visible to sponsor+guardian only. |
| 3.6 | `nil_achievements` (verified milestones). | `add-capability-feature.md` | Full capability. | Achievements feed profile only when `approved`. |
| 3.7 | `nil_fan_network` (**always-free, not tier-gated**, spec §12.9). | `add-capability-feature.md` | Platform-default resolver. | Resolves from platform default, never `tier_features_list`. |

### 4.3 Per-actor dashboards (spec §15)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 3.8 | Guardian, Athlete, Institution, Sponsor, Fan, Compliance dashboards. | `fix-tenant-dashboard-load-loop.md`, `dashboard-performance-audit.md`, `server-resolved-context-delegator.md`, `debug-infinite-render-loops.md` | Dashboards reusing `CrmPageShell`/`CrmNavPanel`. | No polling loop; unread via `getReadState`; scoped per base. |

### 4.4 Internal CRM (spec §16)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 3.9 | CRM deltas: `athlete_tenant_id`/`guardian_id` columns + guardian-required trigger + `tenant_nil_crm_options_settings`. | `database-navigation-system.md`, `alerts-and-notifications.md` | Migration spec §14.11. | Minor-subject ticket without guardian → DB error. |
| 3.10 | NIL CRM surfaces (Compliance/Institution+Sponsor/Guardian) mirroring 3-surface CRM. | `alerts-and-notifications.md`, `deploy-service-extending-base-singleton.md` | Services + routes + `actor_type` extension. | PII never projected without consented relationship. |
| 3.11 | Register `nil_crm` capability. | `add-capability-feature.md` | Full capability. | `requireFeature(tenantId, 'nil_crm')` gates services. |

### 4.5 Bot infrastructure (spec §17)

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 3.12 | Bot deltas: conversation athlete/guardian scoping + `is_minor_safe` + `tenant_nil_bot_options_settings`. | `database-navigation-system.md` | Migration spec §14.12. | Conversations scoped to athlete-tenant. |
| 3.13 | NIL bot personas (Compliance/Eligibility, Guardian Onboarding, Recruiting/Sponsor FAQ, Fan). | `add-chatbot-skill.md`, `add-ai-provider.md`, `bot-widget-troubleshooting.md` | Bot configs + RAG sources. | Eligibility bot RAG over `nil_eligibility_rules_list`. |
| 3.14 | Seed `bot_guardrail_rules` for §17.2 child-safety. | `add-chatbot-skill.md` | `seed-nil-bot-guardrails.ts`. | No minor PII in responses; unanswered → CRM escalation. |
| 3.15 | Register `nil_bot` capability. | `add-capability-feature.md` | Full capability. | Gated; merchant prefs persisted. |

**Milestone M3:** All personas have scoped portals; cross-platform engagement (CRM + bots) live; every adult↔minor interaction guardian-gated.

---

## 5. Phase 4 — Full Multi-Tenant Mesh (Enterprise Scale)

**Objective (spec §4 Phase 4):** High-volume isolation, automated compliance, finance.

| # | Task | Skill | Deliverables | Acceptance |
|---|---|---|---|---|
| 4.1 | Advanced RLS audit across all athlete-owned + cross-tenant tables. | `database-navigation-system.md` | Policy review. | Isolation + dual-visibility tests pass. |
| 4.2 | `ComplianceVettingService` (automated state/association eligibility) + `nil_eligibility_rules_list` seed. | `add-capability-feature.md` | Service + rules data. | Deal blocked where `deals_allowed=false` (spec §12.12). |
| 4.3 | Financial infra: deal-as-purchase transaction fee (§12.10) + `EscrowLedgerService` (double-entry) + guardian KYC/W-9 + payout routing + non-profit pool slice. | `bsaas-purchase-flow.md`, `deploy-service-extending-base-singleton.md` | Escrow + ledger + finance tables (spec §14.8); fee deducted at `settled`. | Payout requires guardian KYC; ledger balances; platform fee + pool slice recorded per deal. |
| 4.4 | Register `nil_compliance` (auto) + `nil_finance` capabilities (highest tier, hard gate). | `add-capability-feature.md`, `add-org-capability.md` | Full capabilities. | Expired tenant → 200 disabled manifest (R13). |
| 4.5 | `DataErasureService` (right-to-erasure cascade + certificate). | `cross-context-cache-invalidation.md` | Erasure workflow (spec §14.9). | Cascade archives→anonymizes→deletes + evicts all caches. |
| 4.6 | Age-out job (18 → athlete gains financial scope, ledger retained). | `structured-logging.md` | Scheduled job. | Control transfers; consent ledger preserved. |

**Milestone M4:** Enterprise-grade isolation, automated compliance, and compliant money movement.

---

## 6. Cross-Cutting Workstreams (every phase)

| Concern | Skill | Standing requirement |
|---|---|---|
| Observability | `structured-logging.md`, `correlation-id-troubleshooting.md` | Every status/consent/deal/payout transition emits `X-Audit-ID` (spec §12.11). |
| Cache correctness | `cross-context-cache-invalidation.md` | Every minor-data mutation enumerates ALL cache namespaces (spec §3.3). |
| Public leak prevention | `troubleshooting-public-page-api-leaks.md` | CI grep gate: no PII fields on `/api/public/*`. |
| No raw fetch / no UUID ids | `deploy-service-extending-base-singleton.md`, `tenant-scoped-id-generation.md` | CI grep gate in every PR. |
| Capability correctness | `verify-capability-deployment.md` | Run after every capability task. |
| i18n | (PR template `pr-fe-i18n.md`) | All compliance/bylaw copy localizable per state. |

---

## 7. Verification & Test Strategy

Translated from `TECHNICAL_SPEC.md` §10 + §12.12. **All P0 negative-path tests are release-blocking.**

- **Build gates (every task):** `pnpm checkapi`, `pnpm checkweb` → zero TS errors.
- **P0 negative paths (Phase 2+):** under-13 self-register → 403; no adult↔minor thread without guardian; consent revocation cascade; deal blocked by state rule; media moderation gate.
- **P1 paths (Phase 3+):** conflicting-guardian most-restrictive-wins; cross-tenant deal isolation; payout KYC gate; age-out lifecycle.
- **Infra:** RLS cross-athlete isolation; cache TTL split (public 5–15m, private 0); cache eviction on approve; tenant-scoped-id grep gate.
- **Capability:** per-capability `tierState` + R13 expired manifest via `verify-capability-deployment.md`.

---

## 8. Dependency Graph (build order)

```
Phase 0 (decisions)  ──►  Phase 1 (shell + leads)
                              │
                              ▼
Phase 2 ── 2.1 IDs/enums/athlete-tenant ─► 2.6 bases ─► 2.7–2.9 services ─► 2.10–2.12 capability+firewall ─► 2.13–2.15 P0 gates
                              │
                              ▼
Phase 3 ── 3.1 bases ─► 3.2 memberships ─► 3.3–3.7 persona capabilities ─► 3.8 dashboards ─► 3.9–3.11 CRM ─► 3.12–3.15 bots
                              │
                              ▼
Phase 4 ── 4.1 RLS audit ─► 4.2 compliance ─► 4.3 finance ─► 4.4 capabilities ─► 4.5 erasure ─► 4.6 age-out
```

---

## 9. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| State NIL law changes mid-build | High | `nil_eligibility_rules_list` is data-driven; no code change to update rules. |
| Partial cache eviction leaks minor data | High (safety) | `cross-context-cache-invalidation.md` + enumerate-all-namespaces rule (§3.3). |
| Monetization payer undecided blocks tiers | Medium | Gate task 0.1 before Phase 1; tiers keyed to payer (spec §12.10). |
| `tenants` table not alterable for `tenant_type` | Medium | Side-table fallback decided in task 0.2. |
| Dashboard request storms | Medium | `fix-tenant-dashboard-load-loop.md` + server-resolved context. |
| Bot reveals non-consented data | High (safety) | Guardrails at RAG retrieval filter (§17.2), not just prompt; seeded in 3.14. |

---

## 10. First Executable Slice (when greenlit)

The smallest end-to-end vertical that proves the architecture (recommended first build target after Phase 0):

1. `generateAthleteTenantId` + `athlete_profiles_list` + RLS (tasks 2.1–2.2, 2.5).
2. `AthleteApiSingleton` + `GuardianApiSingleton` + `GuardianConsentService` (tasks 2.6–2.7).
3. `nil_roster` capability + public roster route with consent filtering (tasks 2.9–2.10).
4. P0 tests 2.13–2.15.

This slice exercises athlete-as-tenant, the firewall, scoped consent, capability gating, and the P0 safety gates in one thin path — validating the entire blueprint before breadth is added.
