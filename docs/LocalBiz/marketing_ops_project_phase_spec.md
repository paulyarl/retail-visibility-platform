# Marketing Ops — Project Phase Spec

Status: Draft for team review — v7 (subdomain architecture audited; capability source pinned to tenants.subdomain; storefront-path repair scoped into rollout)
Owner: Marketing Ops
Related: `docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md`, `docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md`, `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md`, `.agents/skills/multi-archetype-campaigns/SKILL.md`, `apps/api/src/services/triage/signal-taxonomy.ts`, `apps/api/src/services/triage/signal-extractor.ts`

v2 changes: triggers re-anchored from sibling archetypes to the triage signal set; `painTier` sourced from `estimated_tier`; exit criteria made evaluable; stage sets enumerated; tier_3 cap contradiction fixed; operator surface + legacy endpoint fallback added.
v3 changes: seed claim elevated to the plan's entry CTA — the engagement wedge for the whole project, independent of phase capability gating. Wedge gated on seed fidelity: the seed must faithfully mirror the prospect's public footprint to invite completion.
v4 changes: full signal→phase coverage map; sibling attribution fixed to playbook signal pools (inherited signals collapse raw intersection); operator-input signals unioned into re-extraction; `audit` + `operatorInputs` added to selector input; cap-trim order defined; `fidelity: 'unknown'` added; claim-link resolution pinned to the read-only path.
v5 changes: dynamic predicates from a versioned seed; lane-based confidence (`verified`/`suggested`); generic fixtures replace the single-prospect example.
v6 changes: per-signal lane provenance (`signalLanes`); `INT_*` input channel; deterministic cap-protection rule; `mkt_project_phase_predicates` table + `min_severity` floors; contract completion (plan-level `predicateSeedVersion`, suggested-phase projection filter); design premise added to §1; Plan cockpit layout/flow/UX specified in §13.
v7 changes: subdomain architecture audited — wildcard-backed (`tenants.subdomain` + host-header proxy, no per-tenant Vercel work); `subdomainEnabled` source corrected to slug-assignment + wildcard health (no API flag exists); proxy drift documented (redirects to `/t/` app root instead of `/tenant/[id]` storefront) with repair scoped into §17 rollout and sprint 0.2/0.4.

---

## 1. Purpose

A prospect can have several sibling campaigns, each with its own archetype (A1–A7) and its own pipeline. Today the operator sees these as separate campaigns, and the owner sees them as separate diagnostics in the multi-gallery.

This spec defines a **project phase plan**: one cohesive, presentable plan per prospect. Phases are assigned dynamically from the prospect's signal set, so the plan reflects what the audit or scan shows rather than a fixed archetype bundle. The plan is what the operator presents to the owner as a turnkey project, with each phase tied to evidence from the audit.

The phase plan is a **presentation and planning layer**. It does not drive sibling pipelines.

**Design premise.** The plan follows the Proving Ground cockpit pattern — pull disparate artifacts into one cohesive surface — with one sharpening: the cockpit organizes entities that already exist, while the plan organizes **signals**. A phase is not an entity with a lifecycle; it is a computed projection over the prospect's canonical signal set. Signals are the common currency, and every artifact finds its place as a view of that currency: sibling campaigns contribute evidence and status, archetypes serve as attribution fallback, deliverables become phase actions and exit predicates, narratives become gated phase copy, and priorities become confidence/severity ranking under tier caps. The aggregation is non-destructive — the plan is computed on read, owns nothing, and can be removed without touching what sits beneath it. It is a cockpit with two audiences: the operator sees the raw internals (suppressed phases, signal lineage, lane provenance, gate results); the owner sees a curated projection of the same object. One plan, two fidelity levels — the surfaces never diverge.

## 2. Scope

In scope:
- Deterministic selection of phases from the prospect's triage signal set and sibling campaign stages.
- Ordering and dependency rules between phases.
- Derivation of phase status from sibling campaign stages and evaluable exit criteria.
- Owner-facing copy constraints and a quality gate.
- Capability gating for phases the platform cannot yet deliver.
- Surfacing the plan in the multi-gallery as a project view, and internally as an operator panel.

Out of scope:
- Changing sibling stage machines or triage outcomes.
- Creating additional seeds. Only the primary sibling graduates to a seed (see section 6).
- Pricing, fee estimates, or tier recommendations in owner-facing output.
- Automatic outreach sends.
- Plan persistence. v1 computes the plan on read (see section 13 for snapshot rationale).

## 3. Current state

- `business_prospect_id` groups sibling campaigns. The primary sibling has `is_primary_sibling = true`.
- Each sibling runs its own stage machine (`REVIEW_TRANSITIONS`, `RECOVERY_TRANSITIONS`).
- Archetypes are defined in `apps/api/src/services/outreach-openers/archetype-selection.ts`: A1 review response gap, A2 recurring-theme negatives, A3 listing inconsistency, A4 conversion/CTA gap, A5 dual triage (triage engine only), A6 product visibility gap, A7 website gap.
- Selection priority is A2 > A1 > A6 > A3 > A7 > A4, and `selectArchetype` returns one archetype per audit.
- **Signal taxonomy** (`apps/api/src/services/triage/`): `extractSignals` is a pure function that emits `SignalCode[]` from campaign columns, the latest `business_analysis` audit, and operator BBB pre-flight inputs. Extraction precedence:
  1. `auditData.detected_signals[]` (model-emitted) is canonical when present — derived extraction does not run.
  2. The derived path (raw fields + thresholds) runs only for legacy audits that lack `detected_signals[]`.
  3. BBB crisis codes (`RA_BBB_GRADE_SUPPRESSION`, `RA_UNANSWERED_COMPLAINTS`) come only from operator pre-flight input.
  Detected signals persist on `mkt_campaign_triage_results.detected_signals` with `source_audit_id` lineage; triage-driven siblings inherit the source campaign's signal set (`BusinessProspectService.createSiblingTriageResult`). `OX_*` codes are outreach-execution state — display-only, excluded from playbook evaluation, and excluded from phase triggers.
- Audits attach per-campaign on `mkt_audits_list` (`platform = 'business_analysis'`). `BusinessContextService.getLatestAuditData` resolves the latest real (non-stub) audit with sibling fallback: a non-primary sibling inherits the primary sibling's audit. The prospect-level audit is the primary sibling's latest `business_analysis`.
- `GalleryMultiService` and `MultiGalleryPage` present sibling diagnostics on a single prospect-level page, including completed work.
- The subdomain storefront is served at `{tenant-slug}.visibleshelf.com`. Owner-facing control is at `/t/[tenantId]/settings/subdomain`. `/settings/admin/subdomain` is platform-admin plumbing and is never owner-facing.
- Two lanes feed the plan. The **full lane** is a `business_analysis` with `detected_signals[]` that travels with the business audit. The **partial lane** is discovery scan and stub audits, with `audit_metadata.source` in `STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES`. The partial lane is intentional: it is the accelerated path from discovery scan to seed. Full-lane signals carry verified confidence, and partial-lane signals carry suggested confidence.
- Campaign columns synced from audit data (and copied to siblings at creation) include `estimated_tier` (from audit `recommended_tier`), `pain_score`, `gbp_claimed`, `nap_consistent`, `unaddressed_reviews`, and `has_website`.

Known selector issues that this spec depends on (see section 10):
- A1 fires when `observable_unanswered_rate_percent >= 15` **or** `observable_unanswered_reviews > 15` — either branch alone triggers, even when the owner responds to most reviews.
- A3 counts formatting-only name variants as listing inconsistency. The derived-path `CP_NAP_NAME_DRIFT` signal (`signal-extractor.ts`) has the same defect: it fires on `name_variations.length > 0` regardless of materiality.

## 4. Concepts

**Project phase plan.** An ordered list of phases for one prospect, derived from the prospect's canonical triage signal set. Keyed on `business_prospect_id`. A legacy campaign with a null prospect ID is its own group. The internal plan always contains all five catalog phases; `suppressedReason` marks the ones excluded from owner-facing output.

**Phase.** A named stage of work with a goal, the signals that triggered it, the evidence behind those signals, the actions it contains, a capability state, and an evaluable exit criterion.

**Phase catalog.** The fixed set of five phases below.

| Key | Name | Purpose |
|---|---|---|
| `foundation` | Foundation | Make the business's name, address, phone and hours the same everywhere customers look |
| `claim` | Claim | Confirm the owner controls the primary Google profile |
| `findability` | Findability | Make products and the store discoverable before the visit |
| `trust` | Trust | Respond to reviews and address recurring themes |
| `expansion` | Expansion | Optional extensions: owned domain, conversion path, additional directories |

Naming note: `claim` means Google profile ownership. It is unrelated to directory seed claim (`dps.status = 'claimed'`, the `directory_claim` deliverable type); keep the two senses distinct on operator surfaces.

**Engagement wedge (seed claim).** The primary sibling's published seed listing is the plan's entry CTA — the foot in the door. Claiming a VisibleShelf listing costs the owner nothing, is already live the moment the seed publishes, and converts an anonymous prospect into an identified, engaged contact with an owner relationship on the platform. The plan treats the seed claim as a *plan-level* call to action, not a phase: it precedes and survives the phases, and it is the conversation starter the operator hangs the whole project on. `dps.status` is therefore an engagement signal for the plan (`published`/`invited` = wedge available, `claimed` = owner activated) — it never triggers a phase, though it doubles as Findability's exit predicate (section 8).

The wedge is only as strong as the seed's **fidelity to the prospect's real public footprint**. A seed that mirrors the business as it actually exists — canonical name, address, phone, the right category, real hours and products — shows the owner a working end-state of the pipeline they didn't know existed: claiming it is completing something already built, not buying a promise. A thin or misaligned seed is a broken wedge — it asks the owner to vouch for sparse or wrong data and burns the trust the wedge exists to create. The plan therefore evaluates seed fidelity against the canonical audit footprint (section 6) and suppresses the claim CTA while the seed misrepresents the business; the internal plan flags the fidelity gap for the operator to repair first.

## 5. Phase selection rules

Selection is a **pure function**: no LLM, no I/O, no side effects. It takes the prospect's canonical signal set, sibling metadata, and capability state, and returns a plan.

```
selectProjectPhases(input: ProjectPhaseInput): ProjectPhasePlan
```

Input:
- `signals`: `SignalCode[]` — the prospect's canonical signal set, resolved by the caller via `resolveProspectSignals` (section 13). `OX_*` codes are stripped before selection.
- `signalLanes`: `Partial<Record<SignalCode, 'full' | 'partial'>>` — per-signal provenance from the same resolver. Phase confidence is derived per signal: a phase is `verified` when any triggering signal is full-lane or operator-input; otherwise `suggested` (section 15). A signal with no entry defaults to the plan's `lane`.
- `discoverySignals`: `string[]` — `INT_*` codes from the prospect's latest discovery scan or stub `discovery_signal_map`. Never trigger a phase; they may only raise a triggered phase's cap rank when an audit-derived signal for the same gap is present.
- `lane`: `'full' | 'partial' | 'none'` — the lane of `sourceAuditId`'s audit: `full` = real `business_analysis`, `partial` = stub audit or scan-only, `none` = nothing to evaluate (every phase `not_triggered`).
- `predicateSeedVersion`: the predicate version evaluated; recorded on the plan for traceability.
- `sourceAuditId`: the audit the signals derive from — recorded on the plan for traceability.
- `audit`: `BusinessAnalysisAuditData | null` — the canonical audit payload. Evidence rows, the Claim veto, and the `estimatedTier` fallback read it; it never feeds triggers (signals do). It is `null` on the partial lane — the stub shape differs, and the absence of citable full-lane evidence is exactly what makes a phase `suggested`.
- `siblings`: array of `{ campaignId, isPrimary, playbookCode, archetype, stage, detectedSignals }` — used for phase attribution and status derivation, **never for triggering**.
- `capabilities`: `{ storefrontEnabled, subdomainEnabled, qrPrintEnabled, domainEnabled }` — see section 7.
- `estimatedTier`: `tier_1 | tier_2 | tier_3 | null` — `mkt_campaigns_list.estimated_tier` on the primary sibling (synced from audit `recommended_tier`; fall back to the audit value when the column is null). Note the direction: `tier_1` is the widest digital opportunity, `tier_3` the narrowest.
- `operatorInputs`: `{ domainRequested?: boolean }` — read from the structured campaign field (decision 16.2), not a free-text note. Feeds the Expansion domain trigger.

Trigger rules. Each phase is assigned by a **predicate** evaluated against `signals` on every read. Predicates are versioned definitions held in a predicate seed (section 13), not hardcoded per archetype or per prospect. A predicate is an `any_of` signal set with an optional per-signal `min_severity` floor — a signal that fired but sits below the floor does not trigger that phase (illustrative for a later predicate version; seed v1 has no floors, §16.8). A phase is included when its predicate matches. The table below is the initial contents of the seed (version 1), not a fixed mapping.

Severity (via `computeSignalSeverity` in `signal-magnitude.ts`) ranks phases and floors individual signals; it never assigns a phase on its own. Signals whose severity cannot be computed — no audit data on the partial lane — default to `borderline` for ranking. Lane sets confidence, not assignment: a phase triggered by full-lane signals is `verified`, one triggered only by partial-lane signals is `suggested`, and operator-input signals count as full-lane provenance. Both lanes can assign phases.

`INT_*` discovery codes are never in `signals` and never trigger. They arrive via `discoverySignals` and may raise a triggered phase's cap rank only when an audit-derived signal for the same gap is present — a scan hint with no audit confirmation changes nothing.

| Phase | Trigger signals | Notes |
|---|---|---|
| Foundation | any of `CP_NAP_NAME_DRIFT`, `CP_NAP_ADDRESS_DRIFT`, `CP_NAP_PHONE_DRIFT`, `CP_MISSING_CONTACT_INFO`, `DS_OUTDATED_HOURS`, `DS_OUTDATED_HOLIDAY_HOURS`, `DS_BROKEN_PROFILE_LINK` | Signals already encode materiality for model-emitted audits; the derived path needs the section 10 fix. `overall_status = 'unable_to_verify'` alone cannot produce these signals. The hours/link codes widen the phase to listing accuracy — a wrong hours field or dead profile link is the same defect class as a wrong phone. |
| Claim | `DS_CLAIMED_STATUS` | When the signal fired from `campaign.gbp_claimed === false` but the audit's `platforms.google.profile_status` is `claimed` or `likely_claimed`, the audit verdict wins and the phase does not trigger. `unable_to_verify` never triggers — it asserts nothing, so it also does not veto a column-fired signal (see open question 6). |
| Findability | any of `WC_MISSING_WEBSITE`, `WC_THIRD_PARTY_DOMAIN`, `WC_BUILDER_SUBDOMAIN`, `WC_PARKED_DOMAIN`, `WC_UNFINISHED_SITE`, `WC_BROKEN_WEBSITE`, `WC_URL_MISMATCH`, `WC_MISSING_PRODUCT_BROWSING`, `DS_MISSING_PRODUCT_CATALOG`, `DS_MISSING_PROFILE`, `DS_MISSING_SERVICE_MENU`, `DS_PHOTO_DEFICIT`, `VP_MISSING_PRODUCT_PHOTOS`, `VP_MISSING_STOREFRONT_PHOTOS`, `VP_MISSING_PROJECT_PHOTOS` | Included even when capability is missing; capability state controls how it renders (section 7). |
| Trust | any of `RA_UNADDRESSED_NEGATIVE_BACKLOG`, `RA_BBB_GRADE_SUPPRESSION`, `RA_UNANSWERED_COMPLAINTS`, `RA_REVIEW_DROUGHT`, `RA_LOW_REVIEW_VOLUME` | `RA_UNADDRESSED_POSITIVE_BACKLOG` is deliberately excluded — a positive-only backlog is review hygiene, not a reputation-repair project. A prospect with no negative backlog, BBB, drought, or volume signal must not produce a Trust phase. |
| Expansion | any of `WC_MISSING_CTA`, `WC_MISSING_AVAILABILITY_INQUIRY`, `WC_MISSING_PICKUP_DELIVERY`, `WC_MISSING_SERVICE_PAGES`, `WC_MOBILE_FRICTION`, `WC_UNSECURED_WEBSITE`, `WC_LEGACY_BUILDER_SITE`, `WC_STALE_WEBSITE`, `WC_POOR_SITE_QUALITY`, `WC_CATEGORY_MISMATCH` — or an owner-requested domain | The quality/conversion codes describe defects on an existing owned site. For `tier_3` plans, only the owner domain request triggers Expansion; conversion signals alone do not include it. |

Explicitly unmapped (never trigger a phase): `OX_*` (outreach state), `VP_STALE_SOCIAL_ACTIVITY` (social cadence is retainer-marketing, not a project phase), `RA_UNADDRESSED_POSITIVE_BACKLOG` (hygiene — see Trust). Any future admin-registered signal code is unmapped until added to the predicate seed with a version bump — unknown codes must not silently join a phase.

Sibling attribution. A sibling **contributes** to a phase when the signals its accepted playbook actually matched — `detectedSignals(sibling) ∩ matchingRuleSignals(sibling.playbookCode)` — intersect the phase's trigger set. Do **not** intersect the sibling's raw `detected_signals` directly: triage-driven siblings inherit the source campaign's full signal set verbatim (`createSiblingTriageResult`), so a raw intersection marks every sibling as contributing to every phase. For siblings without a triage result or playbook, attribute by resolved archetype: A3 → Foundation, A1/A2 → Trust, A6/A7 → Findability, A4 → Expansion, A5 → the union of its component signals' phases. Contributing siblings supply evidence rows and drive status derivation (section 8).

Caps:
- `tier_3`: at most two phases shown in owner-facing output.
- `tier_2`: at most three.
- `tier_1`: up to all five.
- `null` tier: treat as `tier_2` (conservative middle) until the audit supplies a value.

When a cap binds, keep the highest-ranked phases. Rank by confidence (`verified` above `suggested`), then by maximum trigger severity, then by catalog order as the tie-break. Fill the cap by trimming in ascending rank order with one protection rule: a phase that a retained phase depends on (section 6) is skipped, and the next unprotected phase is trimmed instead. If protection still leaves the shown count above the cap, suppress the dependent phases in ascending rank order — a phase is never shown without its dependency, and the shown count never exceeds the cap. The trimmed phase stays on the internal plan with `suppressedReason: 'pain_tier_cap'`. It is never shown to the owner.

## 6. Ordering and dependencies

Phases always render in catalog order, which is dependency order:

1. Foundation. Other phases reference the canonical name, address and phone.
2. Claim. Required before any profile-level change can be made or verified.
3. Findability. Depends on Foundation, because a storefront or QR shows the canonical address.
4. Trust.
5. Expansion.

Dependencies:
- Findability is blocked on `subdomainEnabled` for display — `storefrontEnabled` gates only the product-browsing items inside the phase. The phase is shown as "pending platform setup" internally and omitted from owner-facing output until enabled.
- Expansion's owned-domain item is blocked on `domainEnabled`.
- A dependency phase absent from the plan — not triggered, or suppressed — counts as satisfied. Blocking applies only when the dependency phase is present and incomplete.

Single-seed rule: the plan may describe a Findability phase on the primary sibling's seed. It must not propose a second public listing. Non-primary siblings contribute evidence and actions to phases, not seeds.

The same seed carries the plan's entry CTA (section 4, engagement wedge): while a primary-linked seed is `published` or `invited`, unclaimed, **and not misaligned**, the plan-level CTA is "claim your listing". Once `claimed`, the CTA graduates to the plan's next conversion step. The wedge is independent of phase gating — a published seed is live today, so the claim CTA is renderable even when every phase is capability-blocked, provided the CTA copy promises nothing the disabled capability would deliver.

Seed fidelity is judged against the canonical footprint in the audit (`nap_consistency.canonical_*`, `platforms.google.displayed_*`, categories) using the same material-variance rule as the section 10 A3 fix — formatting-only differences are not misalignment:

- `aligned` — every material field on the live seed matches the canonical footprint.
- `thin` — material fields match but the seed is sparse (missing products, photos, or hours). Still renderable as a wedge, but the internal plan flags the enrichment gap.
- `misaligned` — any material field differs (wrong name, phone, or address vs. canonical). The claim CTA is suppressed and the internal plan flags a `seed_fidelity_gap` for operator repair — the Findability phase's first action becomes fixing the seed, not inviting a claim on bad data.
- `unknown` — no canonical footprint to compare (no usable audit). Renderable as a wedge — publish QC already gates the listing — but flagged internally so the operator knows fidelity was never verified.

Within Findability, the seed is also the phase's first deliverable and its end-state preview: the action chain runs publish/repair the footprint-faithful seed → owner claim → enrichment → storefront.

## 7. Capability gating

Capabilities resolve per prospect, in this anchor order: the wedge seed's tenant (a real `directory_presence` tenant) when a live seed exists → the prospect's demo tenant (`mkt_campaigns_list.demo_tenant_id`) → the platform-level flag state.

| Capability | Source | Effect when disabled |
|---|---|---|
| `subdomainEnabled` | The anchor tenant has an assigned platform subdomain (`tenants.subdomain`, set via `/t/[tenantId]/settings/subdomain`) and the wildcard host is healthy — no `subdomainEnabled` feature flag exists API-side; platform-level availability when no anchor tenant exists | Findability renders as pending; no owner-facing subdomain claim |
| `storefrontEnabled` | Storefront capability on the same tenant scope (capability resolution service / effective flags) | Product browsing items are omitted |
| `qrPrintEnabled` | QR tier features (print templates) on the same tenant scope | QR signage item is omitted; digital QR may still show |
| `domainEnabled` | Owned domain integration (not yet built) — hardcode `false` in v1 | Owned-domain item is omitted; never promised |

The turnkey promise in owner-facing output covers only phases whose capabilities are enabled. Items behind disabled capabilities are not described.

Note — subdomain architecture (audited during pre-flight): platform subdomains are wildcard-backed — `tenants.subdomain` + host-header resolution in `proxy.ts`, no per-tenant Vercel work. Two drifted pieces need repair before Findability is shown as available (sprint 0.2/0.4): the proxy 302-redirects to `/t/{tenantId}` — the authenticated app root — instead of rewriting to the `/tenant/[id]` public storefront, so a subdomain today lands on a login wall; and `*.visibleshelf.com` must be confirmed as a live wildcard domain on the Vercel project (one-time infra, not verifiable from the repo). Owner-owned custom domains are a separate, designed-but-unbuilt feature (`docs/CUSTOM_DOMAINS_FOR_STOREFRONTS.md` — Vercel Domains API automation, `domainEnabled`).

## 8. Status derivation

Phase status is derived from contributing sibling stages and evaluable exit criteria. It never advances a pipeline.

Stage sets (exported constants alongside the selector; per `REVIEW_TRANSITIONS` / `RECOVERY_TRANSITIONS`):

- **Active (review):** `seed`, `preview_built`, `shown`, `paid`, `retainer_pitched`, `gbp_intake_submitted`, `review_setup_submitted`, `repair_access_submitted`
- **Active (recovery):** `framework_preview_generated`, `outreach_dispatched`, `awaiting_owner_intake`, `intake_submitted`, `final_resolution_drafted`, `owner_approved`
- **Terminal-complete (review):** `delivered`, `closed`, `retainer_won`, `tenant_onboarded`
- **Terminal-complete (recovery):** `resolved_and_closed`
- **Stalled:** `lost`, `dead` — neither active nor complete. Both have resurrection edges (`lost → seek`, `dead → seek` / `dead → audit_identified`), so they mean "stalled", never "done". A stalled sibling does not count toward progress or completion.

| Phase status | Rule |
|---|---|
| `not_started` | No contributing sibling is in an active stage, no contributing sibling is terminal-complete, and the exit predicate does not hold |
| `in_progress` | At least one contributing sibling is in an active stage |
| `complete` | At least one contributing sibling exists and all are in terminal-complete stages — or the phase's exit predicate holds on current data |
| `blocked` | Capability disabled, or a present dependency phase is not complete |

Suppression and status compose: a capability-blocked phase carries `status: 'blocked'` **and** `suppressedReason: 'capability_disabled'` — internal visibility plus owner-hidden. A `not_triggered` phase always reports `not_started`.

General exit rule: a signal-driven phase completes when its trigger set is empty on the next signal evaluation — the table below gives the concrete per-phase predicates. Findability and Expansion keep platform-delivery/manual predicates instead, because their trigger signals describe the gap rather than the platform's answer to it.

Exit criteria (evaluable predicates where data exists; otherwise stage-derived only):

| Phase | Exit predicate |
|---|---|
| Foundation | Latest audit `nap_consistency.overall_status = 'consistent'`, or campaign `nap_consistent = true` |
| Claim | Campaign `gbp_claimed = true` (operator-verified), or re-audit `profile_status ∈ {claimed, likely_claimed}` |
| Findability | Primary sibling's seed is `published`/`invited`/`claimed`, or storefront live on the demo tenant |
| Trust | Re-extracted signals no longer contain `RA_UNADDRESSED_NEGATIVE_BACKLOG` |
| Expansion | Owner action recorded — manual/operator-confirmed in v1 |

A phase with signals but no contributing siblings can complete only through its exit predicate (typically via re-audit) — the evidence stands even when no pipeline was ever run against it.

Cycling: `engagement_cycle` is per-sibling and can diverge. The plan's `engagementCycle` is the **primary sibling's** cycle; when it increments, the plan is recomputed for the new cycle and completed phases from earlier cycles appear in history, not as current status.

Overlap: when two siblings trigger the same action (for example, a listing fix from a review sibling and a repair sibling), the plan lists the action once under one phase, with both siblings as evidence.

## 9. Owner-facing output

Required:
- Plain language. Name the phase, the goal, the evidence, and the next step.
- Every claim traces to an audit field or a review quote.
- Length: a single page, at most two phases shown for `tier_3`.
- Only `verified` phases appear in owner-facing output. `suggested` phases (partial lane) stay internal until a full-lane audit confirms them. The seed wedge CTA is exempt because it follows the seed, not a phase.
- One plan-level CTA. While an unclaimed published seed exists it is "claim your listing" — free, immediate, and the wedge for everything that follows. After the seed is claimed (or none exists), the CTA is the next step of the earliest incomplete unsuppressed `verified` phase — `suggested` phases are never CTA targets; when no such phase exists, the CTA defers to the gallery's conversion action (pricing).

Forbidden in owner-facing text:
- Archetype codes (A1–A7), signal codes (`RA_*`, `DS_*`, `WC_*`, `CP_*`, `VP_*`, `OX_*`), and internal labels such as "review response gap" or "triage".
- Tier names, pricing, fee estimates, and the "digital opportunity score".
- Internal terms: pipeline, stage, sibling, seed, cycle, scan.
- Claims about capabilities that are disabled.
- Verdicts about the business itself. Frame gaps as findability opportunities.
- Scan-claimed exposures stated as verified facts.

Scoping note: the forbidden-term rules apply to **generated narrative only**. Verbatim review quotes used as evidence are exempt — quoted customer text may naturally contain words on the forbidden list, and it must be rendered unedited with attribution.

## 10. Prerequisite fixes

These must land before the phase selector is built on them.

1. **A1 threshold.** `selectArchetype` fires when `observable_unanswered_rate_percent >= 15` **or** `observable_unanswered_reviews > 15` — the fix covers both branches: fire only when the unanswered rate is **≥ 25%** **and** the unanswered count is **≥ 5** (decided — section 16). The derived `RA_UNADDRESSED_*_BACKLOG` thresholds (currently a flat ≥5 unanswered) get the same treatment — materiality evaluated through the fix-2 shared helper, not a raw count. Note the plan itself no longer consumes A1 — Trust keys on the `RA_*` signal set — but the opener/archetype fallback path still needs this fix.
2. **A3 / `CP_NAP_NAME_DRIFT` materiality.** Two emission sites share the formatting-variant defect: `selectArchetype`'s A3 branch and `deriveSignals`' `CP_NAP_NAME_DRIFT` (both fire on `name_variations.length > 0`). Fix both to require material variance — evaluate `nap_consistency.material_issues` (already populated by the audit prompt) or a shared formatting-normalization helper that strips case, punctuation, and legal suffixes ("Inc", "LLC"). `overall_status = 'unable_to_verify'` must not count as inconsistency in either site. Phone and address variants always count when they differ from canonical.
3. **Documentation drift.** The multi-archetype skill doc lists A1–A6. The code defines A1–A7. The skill doc should be updated to match the code.

## 11. Quality gate

A plan fails the gate if any of the following hold:
- A phase is unsuppressed with no trigger signals.
- An owner-facing phase references a disabled capability.
- Generated owner-facing narrative contains a forbidden term from section 9 (attributed review quotes exempt).
- Owner-facing phase count exceeds the tier cap.
- A plan includes a second public listing or a second seed.
- Two phases describe the same action.
- The claim CTA renders while the wedge seed is `misaligned` with the canonical footprint — the owner must never be invited to vouch for wrong data.
- A `verified` phase has no full-lane evidence, or a `suggested` phase appears in owner-facing output.

## 12. Data contract

```ts
type ProjectPhaseKey = 'foundation' | 'claim' | 'findability' | 'trust' | 'expansion';
type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked';

type PhaseExitPredicate =
  | 'signal_set_empty'   // trigger set empty on re-extraction
  | 'nap_consistent'     // audit overall_status = 'consistent' or campaign nap_consistent
  | 'gbp_claimed'        // campaign gbp_claimed = true, or re-audit claimed/likely_claimed
  | 'seed_status'        // wedge seed in published/invited/claimed
  | 'manual';            // operator-confirmed

interface ProjectPhaseInput {
  predicateSeedVersion: number;                       // version of the predicate seed used for evaluation
  lane: 'full' | 'partial' | 'none';                  // lane of the source audit or scan; 'none' = empty plan
  signals: SignalCode[];                              // canonical set — via resolveProspectSignals (§5)
  signalLanes: Partial<Record<SignalCode, 'full' | 'partial'>>;
                                                    // per-signal provenance; missing = plan's lane
  discoverySignals: string[];                         // INT_* scan codes — rank modifier only, never a trigger
  sourceAuditId: string | null;
  audit: BusinessAnalysisAuditData | null;            // evidence + veto input; never a trigger source.
                                                    // null on the partial lane (stub shape)
  siblings: {
    campaignId: string;
    isPrimary: boolean;
    playbookCode: string | null;
    archetype: ArchetypeCode | null;
    stage: string;
    detectedSignals: SignalCode[];                    // used only via playbook-pool intersection (§5)
  }[];
  capabilities: {
    storefrontEnabled: boolean;
    subdomainEnabled: boolean;
    qrPrintEnabled: boolean;
    domainEnabled: boolean;
  };
  estimatedTier: 'tier_1' | 'tier_2' | 'tier_3' | null;
  operatorInputs?: { domainRequested?: boolean };
}

interface ProjectPhase {
  key: ProjectPhaseKey;
  name: string;
  goal: string;
  confidence: 'verified' | 'suggested';               // verified if any trigger signal is full-lane or
                                                    // operator-input; else suggested (§15)
  severity: number;                                   // severityRank of the strongest trigger signal
                                                    // (computeSignalSeverity); 0 when uncomputable
  triggerSignals: SignalCode[];                       // the signals that fired this phase
  contributingCampaignIds: string[];                  // siblings attributed to this phase
  evidence: { campaignId: string; field: string; value: string; signalCode?: SignalCode }[];
  actions: { text: string; ownerAction: boolean }[];
  capability: { required: string[]; enabled: boolean };
  status: PhaseStatus;
  exitCriterion: { copy: string; predicate?: PhaseExitPredicate };
  suppressedReason?: 'pain_tier_cap' | 'capability_disabled' | 'not_triggered';
}

interface ProjectPhasePlan {
  businessProspectId: string | null;
  engagementCycle: number;                            // primary sibling's cycle
  estimatedTier: 'tier_1' | 'tier_2' | 'tier_3' | null;
  predicateSeedVersion: number;                       // predicate version the plan was evaluated with
  signals: SignalCode[];                              // canonical set used for selection
  sourceAuditId: string | null;
  seedClaim: {                                        // engagement wedge — plan-level CTA
    seedId: string;
    status: 'draft' | 'published' | 'invited' | 'claimed' | 'suppressed';
    placeUrl: string | null;                          // /place/{slug} — the always-live wedge entry
    claimUrl: string | null;                          // resolved via the shared claim-link order (§13)
    fidelity: 'aligned' | 'thin' | 'misaligned' | 'unknown';
                                                    // seed vs canonical audit footprint (§6);
                                                    // 'unknown' = no canonical footprint to compare —
                                                    // renderable as a wedge, flagged internally
  } | null;
  publicSurfaces: {                                   // cockpit awareness of the family's
                                                      // public-facing artifacts — read-only links
    campaignId: string;
    seed: {
      seedId: string;
      status: 'draft' | 'published' | 'invited' | 'claimed' | 'suppressed';
      placeUrl: string;
      fidelity?: 'aligned' | 'thin' | 'misaligned' | 'unknown';
    } | null;
    demoStorefrontUrl: string | null;                 // {tenant-slug}.visibleshelf.com — from demo_tenant_id
  }[];
  phases: ProjectPhase[];                             // all five catalog entries; suppressedReason marks owner-facing exclusion
  generatedAt: string;
}
```

The owner-facing payload is a projection: phases with `suppressedReason` set **or** `confidence: 'suggested'` are removed, `triggerSignals`/`signalCode`/`signalLanes`/internal evidence fields are stripped, and statuses stay as computed.

## 13. Integration

- Evaluator (`selectProjectPhases`), types, and stage constants (`ACTIVE_STAGES`, `TERMINAL_COMPLETE_STAGES`): new `apps/api/src/services/outreach-openers/project-phases.ts`, exported from `outreach-openers/index.ts`, following the archetype-selection pattern. The evaluator is pure code. Predicate definitions are data.
- Predicate seed: a versioned seed following the repo's existing pattern, where `SEED_VERSION_MARKER` bumps re-sync rows without a code deploy. Rows live in a new `mkt_project_phase_predicates` table (a schema migration — added to rollout, and not "plan persistence" under section 2), keyed by phase key and predicate version, carrying the `any_of` signal set, optional `min_severity` floors, `INT_*` rank-modifier map, and phase copy keys — named `project_phase.<phase_key>.<slot>` with slots `name`, `goal`, `evidence`, `actions`, `exit_criterion` (a new convention; no prior copy-key scheme exists). A new predicate version is a seed bump, not an evaluator change. The seed script is `apps/api/src/scripts/seed-project-phase-predicates.ts`, with `PROJECT_PHASE_PREDICATES_VERSION`. The plan records the predicate version it used. The seed script and the table are new deliverables of this spec and do not exist yet.

Predicate seed governance: changes are expected to be ongoing, as requirements evolve with growth and business realignments. No formal approval is required at present. Formal review may be introduced as the platform scales, and this section will be updated when it is.
- Signal resolution: a `resolveProspectSignals` helper (in the same file or `services/triage`) returning `{ signals, signalLanes, lane, sourceAuditId, discoverySignals }`. Full lane: re-extract via `extractSignals` from the primary sibling's latest real `business_analysis` audit (`getLatestAuditData` sibling fallback) — `getLatestAuditData` skips stubs by design. Partial lane: when no real audit exists, take the latest stub audit's `detected_signals` (`audit_metadata.source ∈ STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES`) plus `extractSignals`' derive tier where cat-id `digital_footprint` data exists — all tagged `partial`. Operator-input codes (`RA_BBB_*`) unioned from the persisted `mkt_campaign_triage_results.detected_signals` always carry `full` provenance — they are human-entered, not scan-derived. The persisted snapshot is the fallback when neither lane has an audit; its lane is inherited from the audit that produced it. `discoverySignals` comes from the prospect's latest discovery scan or the stub's `discovery_signal_map`.
- Field extraction: reuse the common field extractors. Add a phase extractor for the evidence block.
- Prompt builder: one owner-facing template per phase, using the fixed anatomy of goal, evidence, actions, and exit criterion. Follows `archetype-prompts.ts`.
- Quality gate: a `runProjectPhaseGate` in the same pattern as `quality-gate.ts`.
- Operator surface: the internal plan renders on campaign detail as a "Plan" panel beside the Siblings tab. Layout, flow, and UX conventions are specified under **Operator surface — the Plan cockpit** below.
- Seed claim: resolve the primary sibling's live seed via the existing campaign↔seed linkage (`DirectorySeedCampaignLinkService` / `createFromCampaign`'s shelf-aware idempotency) and surface `dps.status` + the claim URL on the plan. `claimed` seeds render the graduated CTA; `suppressed` seeds are ignored (post-Promote replacement already births a successor). Fidelity is computed by comparing the live seed's material fields against the audit's canonical footprint with the §10 material-variance helper; NAP verification data from the seed's verification flow, when present, is authoritative.
- Claim CTA architecture (reconciling the existing link layer):
  - **Link resolution** reuses `outreach-link-vars.ts`'s order — `/c/{short_code}` → active `/place/claim/{token}` → `placeUrl` fallback. The plan **never mints** a token on read (no-write rule); minting stays the invite/outreach trigger's job. Resolution must use the read-only path — a plain `directory_claim_tokens` + `short_code` lookup. Do **not** route through `getClaimInviteKitMeta`/`resolveClaimInviteKit` from the plan endpoint: it lazily backfills `short_code` via `ensureClaimShortCode` on legacy tokens — a write hidden inside a read resolver. A `published` seed with no live token still renders the wedge — `placeUrl` is always live, and the place page itself owns the token/`#claim-inquiry` fallback and click tracking.
  - **Fidelity lives on the seed, not just the plan.** The verdict is persisted (e.g. a `seed_fidelity` field refreshed at publish and at plan resolution) so every claim surface — place page, outreach merge vars, QR kits, seed reports — consults the same flag. A `misaligned` seed degrades its claim CTAs to the inquiry path rather than a token flow, on every surface, not just the plan's.
  - **CTA precedence in the project view:** plan-level CTA (claim or next-step) > per-sibling CTA buttons > global "View Pricing". Sibling CTAs keep their deep links; the plan header owns the primary action.
  - **Post-claim graduation:** after `claimed`, the claim-accept flow's embedded upgrade triad owns the tier-upgrade ask; the plan's graduated CTA points at the project's next step — the two must not stack as competing asks on the same surface.
  - **Attribution:** the plan CTA emits the gallery event with a plan-level identifier (alongside `siblingCampaignId`) so the wedge's claim-rate is measurable separately from sibling CTA clicks.
- Gallery: extend `GalleryMultiService` to attach the owner-facing projection and render it in `MultiGalleryPage` as a project view above the sibling accordion. The plan-level CTA (seed claim first, then next-step) renders in the project-view header; the existing global "View Pricing" CTA stays below it. Completed work stays in its existing section.
- Routes: `GET /api/admin/marketing-ops/prospects/:prospectId/project-plan` (mirroring the multi-gallery-token route shape), plus a `?campaignId=` fallback that treats a null-prospect campaign as a singleton group — that campaign is the primary. A prospect with no audit, no triage result, and no signals returns **200 with an all-`not_triggered` plan**, not 404 — an empty plan is a valid answer. No write path in v1 — resolving a plan must not call `initializeProspectFromCampaign`.
- Snapshot semantics: v1 recomputes on read; the owner sees the current plan, which may differ from what was presented at token issuance. If that drift becomes a problem, snapshot the owner-facing projection into the multi-gallery token's `metadata` at issuance (deferred decision, not v1).

### Operator surface — the Plan cockpit

The operator surface follows the Proving Ground cockpit's read order — summary band → distribution → worklist — adapted to the plan's object model (header → wedge → phase board → history). Its goal is one-glance project state: what fired, how confident it is, what is blocked and why, what comes next, and whether the wedge is live.

**Layout** (top-down, in catalog order):

- **Plan header band.** Prospect identity, `estimatedTier`, `engagementCycle`, lane, `predicateSeedVersion`, `sourceAuditId` (linked to the audit view), gate-result badge, `generatedAt`. The cockpit's campaign-header equivalent — provenance is always visible.
- **Wedge card.** The plan's funnel-metrics slot: seed status chip (`draft`/`published`/`invited`/`claimed`), fidelity badge (`aligned`/`thin`/`misaligned`/`unknown`), the resolved claim URL with a copy action, and plan-CTA click counts. A `misaligned` or `unknown` fidelity badge carries a repair hint — this is where the operator learns the wedge needs work before it can be shared.
- **Public surfaces strip.** The cockpit's awareness of the family's public-facing artifacts — `publicSurfaces` from the contract. Every sibling's linked seeds (status chip, place URL, fidelity badge where known — `suppressed` seeds render as retired history, not live surfaces) and demo storefront URL when `demo_tenant_id` is set (`{tenant-slug}.visibleshelf.com`). Entries link out to the public surface or its admin — read-only, same rule as the board.
- **Phase board.** One row per catalog phase — all five always render internally, including `not_triggered` and suppressed rows. Each row carries: phase name, status chip, confidence badge (`verified`/`suggested`), severity indicator, trigger-signal chips, suppression badge (`pain_tier_cap`/`capability_disabled`/`not_triggered`), a dependency marker when a §6 dependency applies, and contributing-sibling links. `suggested` rows are visually distinct — pending full-audit confirmation — and `not_triggered`/cap-suppressed rows collapse by default but expand on demand.
- **Drill-down.** Every chip is a link, not a label: a signal chip opens its evidence popover (field, value, source audit, contributing sibling); a sibling link opens campaign detail; the seed opens the place page or seed admin; the source audit opens the audit view.
- **History.** Prior-cycle completions render below the board, matching the multi-gallery's completed-work semantics.

**Flow** — the read order answers four questions in sequence:

1. *Is the wedge live?* Seed published and fidelity-aligned → copy/share the claim link. Misaligned or unknown → the repair path is one click from the wedge card.
2. *What are the verified phases and their statuses?* The board reads as the project's worklist — `in_progress` shows which sibling is driving it, `not_started` shows what outreach would activate.
3. *What is blocked and why?* `capability_disabled` points at the platform fix; an incomplete dependency points at the prerequisite phase; `pain_tier_cap` is a deliberate scope decision, not a defect.
4. *What is suggested pending verification?* The partial-lane rows double as the audit/verification worklist — they tell the operator which confirmations a full audit would settle.

**UX conventions** inherited from the cockpit:

- Chips and badges carry all state; colors match the existing stage/status chip semantics. Counts appear on collapsed regions.
- Deep-linkable: `#plan` selects the panel, the same hash-tab pattern the cockpit uses for `#communications`.
- **Read-only.** Navigation only — no stage transitions, no writes. Actions (create a sibling, mint a claim invite, repair the seed, run an audit) link out to their owning surfaces, the same rule as the cockpit's pipeline band.
- Scope and placement: the cockpit is a **business-scope surface keyed on `business_prospect_id`** — one cockpit per prospect group, not per campaign. Awareness is bidirectional: every sibling's campaign detail renders the same Plan panel beside its Siblings tab (the cockpit is reachable from any member — sibling campaigns already know they belong to the prospect via `business_prospect_id`), and the cockpit links out to every sibling under the prospect, whether or not it contributes to a phase. A legacy campaign with a null `business_prospect_id` is a singleton group — the same cockpit works with one member. The natural upgrade path is a dedicated prospect route (`/settings/admin/marketing-ops/prospects/[id]`, mirroring `proving-grounds/[id]`) when the surface grows past a panel into a full prospect dossier (scan → queue → seed → siblings → plan); the endpoint is already prospect-keyed, so that is a UI placement change, not a contract change.
- The gallery project view is this board's curated twin — same phase order and statuses, internals stripped. Operator and owner never see divergent plans.

### Plan lifecycle

- **Materialization.** The plan has no creation step — it materializes on first read whenever the endpoint resolves a prospect group. There is nothing to provision and nothing to initialize: resolving a plan must never call `initializeProspectFromCampaign`. A singleton legacy campaign yields a one-member cockpit the same way. `generatedAt` stamps each evaluation.
- **Retirement.** Nothing is persisted, so nothing is deleted. Membership and contents track live inputs on every read: a detached or reattached sibling, a re-audit, a stage transition, a seed replacement, or a capability change all appear on the next read — there is no stale state to expire. A dissolved or emptied prospect returns the 200 all-`not_triggered` plan, not an error. A predicate version bump retires old evaluations implicitly — plans are never stored, so there is nothing to migrate; `predicateSeedVersion` on each response is provenance, not state.
- **Management.** The only managed surface is the predicate seed itself — versioned rows under the §13 governance note; a bump is a change. Everything else self-manages from inputs: tiers, stages, signals, capability flags, seed status, and fidelity flow through without operator action on the plan. All operator actions live on the owning surfaces (campaign detail, seed admin, queue) — the cockpit stays read-only, and there is no per-prospect plan configuration to maintain. If caching or token snapshots land later (deferred), they key on the input tuple — `businessProspectId` + `sourceAuditId` + `predicateSeedVersion` — never on the plan object itself.

## 14. Testing

- Unit tests for `selectProjectPhases` covering each trigger-signal set, each cap, and each capability state.
- Coverage invariant test: every `KNOWN_SIGNAL_CODES` entry is either referenced by a predicate in the seed or in the explicit unmapped list — no silently unmapped codes.
- Signal-resolution tests: re-extract path, persisted-snapshot fallback, operator-input union, `OX_*` stripping.
- Attribution tests: sibling playbook-pool intersection (two siblings sharing an inherited signal set must not both claim every phase).
- Regression tests for the A1 and A3 fixes using a small set of generic full-lane `business_analysis` fixtures and one partial-lane stub fixture. Cover review-only, website-only, multi-sibling overlap and claimed-only prospects. Fixtures are test data, not business-specific expectations.
- Lane tests: a partial-lane trigger yields `suggested` confidence, a full-lane trigger yields `verified`, and a phase with both is `verified`. Operator-input codes unioned into a partial-lane plan carry `full` provenance. The owner-facing projection excludes `suggested` phases and never points the CTA at one.
- Cap-protection tests: a retained phase's dependency is never trimmed (a shown Findability protects Foundation); dependent phases are trimmed last when protection alone can't meet the cap.
- `INT_*` tests: discovery codes never trigger a phase, and only adjust cap rank when the audit-derived signal for the same gap is present.
- `min_severity` floor tests: a signal below its predicate floor does not trigger that phase.
- Predicate seed tests: a version bump re-syncs rows, and the plan records the predicate version it was evaluated with.
- Gate tests for forbidden terms (narrative vs. quote exemption), the single-seed rule, and claim-CTA suppression on `misaligned` seeds (including formatting-only differences that must *not* count as misalignment).
- Status derivation tests across sibling stage combinations, including `lost`/`dead` exclusion and a cycle increment.

## 15. Confidence by lane

- **Full lane** (`business_analysis` with `detected_signals[]`, travelling with the business audit): supports `verified` phases and owner-facing output.
- **Partial lane** (discovery scan, or a stub audit with `audit_metadata.source` in `STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES`): assigns `suggested` phases, drives the accelerated seed path, and stays internal for phase copy.
- **Seed wedge** is lane-independent. The seed claim CTA follows the section 4 and section 6 rules, whichever lane produced the seed.
- A phase can be triggered from both lanes. Its status is `verified` if any triggering signal comes from the full lane.
- A partial-lane `suggested` phase becomes `verified` when a full-lane audit confirms its trigger signal.
- There is no canonical plan shape. The emerging pool arrives with every combination of signals, lanes, tiers, and sibling layouts — a plan with only `suggested` phases, a capability-blocked plan carried by the seed wedge, or an empty plan are all valid configurations, not degenerate cases.

## 16. Decisions and open questions

Settled (2026-10, sprint-plan D-table):

1. **A1 thresholds** — unanswered rate **≥ 25%** and unanswered count **≥ 5**, both required, applied to both OR-branches. The derived `RA_UNADDRESSED_*_BACKLOG` thresholds get the same materiality treatment via the shared helper (section 10).
2. **Owner-requested domain trigger** — a structured campaign field, surfaced to the evaluator via `operatorInputs.domainRequested`. Not a free-text note.
3. **Owner-facing copy approval** — automated gate only (`runProjectPhaseGate`). The operator reviews the internal plan on the Plan panel before sharing the gallery link; no explicit sign-off step in v1.
4. **`tier_3` visibility** — shown, capped at two phases. A sparse plan plus the seed wedge is a valid emerging-pool configuration.
5. **`DS_CLAIMED_STATUS`** — the section 5 audit-verdict-wins rule is sufficient; no extractor refinement.
6. **`seed_fidelity`** — persisted on the seed; computed at publish (authoritative for public surfaces) and lazily refreshed at plan resolution when the source audit is newer than the stored verdict. `misaligned` degrades all claim CTAs to the `#claim-inquiry` path on every surface — never a token flow.
7. **Cap protection** — trim in ascending rank order; dependencies of retained phases are skipped; dependent phases are trimmed last. The shown count never exceeds the cap and no phase shows without its dependency.
8. **`min_severity` floors** — predicate seed v1 ships **no floors**: every `any_of` signal triggers its phase at any severity. Floors are introduced later as a predicate version bump, not a code change — the mechanism ships in the evaluator from day one.

9. **Domain cost ownership** — settled. The prospect owns domain registration and hosting cost, since a domain is typically their own requirement. The platform analyzes the technical requirements and absorbs implementation cost.

Still open:

10. Which signals deserve `min_severity` floors and at what level (seed v2+ decision — unblocked by 16.8).

## 17. Rollout

1. Land the A1 and A3 fixes (both emission sites) with tests.
2. Repair the subdomain storefront path (§7 note): repoint the proxy from `/t/{tenantId}` to a `/tenant/{tenantId}` rewrite, enforce the `subdomainResolve` rate limit, confirm the `*.visibleshelf.com` wildcard domain/cert in Vercel, and quarantine `SubdomainService`'s unimplemented custom-domain methods.
3. Persist `seed_fidelity` on `directory_presence_seeds` (seed-side migration — this is not "plan persistence" under section 2) and wire misaligned-seed CTA degradation on the claim surfaces.
4. Migrate `mkt_project_phase_predicates`, seed the initial predicate version, then build `selectProjectPhases`, `resolveProspectSignals`, the seed coverage check, lane confidence, types, and tests.
5. Add the plan endpoint, operator Plan panel, and gallery project view behind a flag.
6. Review with the operator team on two live prospects before enabling for all.
