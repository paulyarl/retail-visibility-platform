# Proving Ground Campaign — Sprint Plan (Phased Implementation)

**Status:** Ready to build · **Companion spec:** `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` (design authority — section refs below point there)
**Owner:** Platform Eng · **Date:** 2026-09-06

---

## 0. Why phases

The spec consolidates six separable systems: schema, campaign-kind plumbing, checklist attachment, cadence engine, dedup verdicts, and operator surfaces. Phasing keeps each merge independently testable and lets Phases 2–4 run in parallel once the schema lands.

**Dependency graph:**

```
Phase 1  Schema + campaign kind
   ├─▶ Phase 2  Preflight (checklist + seeding)
   ├─▶ Phase 3  Cadence engine
   └─▶ Phase 4  Identity ledger (dedup)
         └─▶ Phase 5  Operator surfaces (frontend)
               └─▶ Phase 6  Validation spike + rollout
```

Phases 2, 3, 4 require only Phase 1. Phase 5 requires all API surfaces. Phase 6 is the rollout gate.

---

## Phase 1 — Schema + Campaign-Kind Plumbing

**Goal:** every downstream build has its columns, constraints, and creation path.

| Item | Spec ref | Files |
|---|---|---|
| Migration `262_proving_ground.sql`: queue cols (`channel_sequence`, `current_channel_index`, `next_touch_at`, `seed_id` FK→`directory_presence_seeds`, `account_family`), `chk_prospect_queue_status` += `hold`,`in_thread`; `directory_seed_outreach_touches` channel CHECK += `form`,`referral`, outcome CHECK += `no_answer`,`bounce`,`unread`,`read_no_reply`,`form_submitted`; `chk_playbook_category` += `proving_ground`; new table `mkt_prospect_dedup_verdicts` (group-keyed) | §8.1 | `database/migrations/262_proving_ground.sql` |
| Prisma schema sync (`db pull` or hand-add matching migration) | §8.1 | `apps/api/prisma/schema.prisma` |
| `CampaignCategory` type + create-route params (`campaign_category`, `parent_campaign_id`); explicit `transitionsFor('proving_ground') → REVIEW_TRANSITIONS` | §4.1 | `MarketingCampaignService.ts`, `marketing-ops.ts` |
| Attach-children endpoint `POST /:campaignId/children` (parent=proving_ground, child=intelligence, one-parent guard → 409) | §4.2 | `MarketingCampaignService.ts`, `marketing-ops.ts` |
| `ListQueueFilters.source_campaign_ids` + route query param | §5.2 | `MarketingProspectQueueService.ts`, `marketing-ops.ts` |

**Tests:** duplicate proving-ground create → 409 `conflict`; killed parent frees slot; attach-child guards (wrong parent category, wrong child scope, already-parented); list filter returns only tree rows.

**Mergeable alone:** yes — additive schema, no behavior change for existing campaigns.

---

## Phase 2 — Preflight (Checklist + Playbook + Seeding)

**Goal:** the proving ground gets its `PG-01` checklist and queue rows become seeded prospects.

| Item | Spec ref | Files |
|---|---|---|
| `resolveEffectivePlaybook` direct-assignment branch (city/category scope + `campaign_category='proving_ground'` → `PG-01`, no triage row) | §4.3 | `PlaybookChecklistService.ts` |
| Triage candidate exclusion — `loadSignalsAndPlaybooks` filters `category='proving_ground'` | §4.3 | `CampaignTriageService.ts` |
| New `INTERNAL_LINK_TARGETS` (`proving_ground_worklist`, `seed_claim_kit`) | §4.3 | `PlaybookChecklistService.ts` + web resolver |
| `createSeedsForProvingGround` (create + publish + `linkCampaign` to intelligence campaign + `inviteSeed` token + stamp `seed_id`, leave `status='queued'`); route `POST /prospect-queue/seed-batch` | §4.4 | `DirectoryPresenceSeedService.ts`, `marketing-ops.ts` |
| Seed script `seed-proving-ground-preflight.ts` + package.json entry; marker-presence idempotency | §8.3 | `apps/api/src/scripts/`, `apps/api/package.json` |

**Tests:** proving-ground checklist resolves `PG-01` without a triage row; `assertBusinessScope` still rejects city scope; PG playbooks absent from triage candidates; seeding stamps `seed_id`, links the intelligence campaign, keeps `queued`.

**Note:** `chk_playbook_category` from Phase 1 must be applied *before* the seed script runs (constraint precedes the row insert — same ordering discipline as migration 178).

---

## Phase 3 — Cadence Engine

**Goal:** the authoritative signal→wait table (spec §4.7) becomes the single owner of "when next."

| Item | Spec ref | Files |
|---|---|---|
| `ProvingGroundCadenceService`: cadence map, ladder advance, `no_answer` retry cap (max 2), touch-cap counter (3 consuming touches / rolling 30d, dead-channel excluded → `hold` +60d), `connected` → `in_thread` | §4.6–4.7 | new `apps/api/src/services/ProvingGroundCadenceService.ts` |
| `addOutreachTouch` channel/outcome union types extended to match migration 262 | §4.8 | `DirectoryPresenceSeedService.ts` |
| Write-through to seed machine (`setOutreachState` / `outreach_scheduled_at`) | §4.6 | cadence service → `DirectoryPresenceSeedService` |
| Mirror to `mkt_outreach_log` when `processed_campaign_id` exists | §4.8 | cadence service |
| Route `POST /prospect-queue/:id/log-touch` (requires `seed_id` → 409 `not_seeded` otherwise) | §5.2 | `marketing-ops.ts` |

**Tests:** every §4.7 signal → correct wait + advance; dead-channel excluded from slot count; cap → `hold`; `connected` → `in_thread`; write-through updates `outreach_state`; mirror row appears post-graduation.

**Business-day waits** (`voicemail` +3bd, `no_reply` email +5bd) skip Sat/Sun — implement `addBusinessDays` helper.

---

## Phase 4 — Identity Ledger (Dedup Verdicts)

**Goal:** verdicts persist, the funnel stops re-surfacing annotated groups, identity knowledge accumulates.

| Item | Spec ref | Files |
|---|---|---|
| Verdict service: `listOpenGroups(campaignIds)` (surfaced minus annotated), `recordVerdict({seed_ids, match_key, verdict, merge_into?, rationale})` | §4.9 | new `ProvingGroundDedupService.ts` (or into cadence service — separate file preferred) |
| `same_entity` → merge `name_variants` onto `merge_into` seed | §4.9 | same |
| `getCohortFunnel` exclusion join: filter `potentialDuplicateSeeds` groups matching `(seed_ids, match_key)` | §4.9 | `SeedFunnelAnalyticsService.ts` |
| Routes: `GET /proving-ground/:campaignId/dedup-groups`, `POST /proving-ground/dedup-verdicts` | §4.9 | `marketing-ops.ts` |

**Tests:** verdict → group excluded; `same_entity` merges `name_variants` onto `merge_into`; `distinct` persists without merge; `duplicateSeedCount` drops to 0 for the tree.

---

## Phase 5 — Operator Surfaces (Frontend)

**Goal:** the cockpit + worklist deliver the operator experience.

| Item | Spec ref | Files |
|---|---|---|
| `MarketingOpsService` client methods (attach/detach children, dedup groups/verdicts, log-touch, seed-batch, queue filters) | §5 | `apps/web/src/services/MarketingOpsService.ts` |
| Proving Ground cockpit page (header gate chips, children panel, preflight checklist, funnel dashboard, gap log, due-today mini-list) | §5.1 | new `marketing-ops/proving-grounds/[id]/` |
| Worklist: due-today sort, ladder viz, log-outcome dialog, preflight gate banner, family grouping, per-row actions (QR kit, gap-map PDF, claim link), tree + status filters | §5.2 | `queue/ProspectQueueClient.tsx`, `ProspectQueueBoard` |
| Checklist tab resolution (unchanged component, new resolution branch) | §5.3 | — (server-side only) |
| Campaign list entry point: link proving grounds (category badge `proving_ground` → cockpit) | §5.1 | `campaigns/CampaignListClient.tsx` |
| Playbook builder: PG-01 visible for step editing (catalog UI shows all categories — no triage exposure since exclusion is engine-side) | §4.3 | `playbooks/ChecklistBuilderTab.tsx` (verify only) |

---

## Phase 6 — Validation Spike + Rollout

1. **Local spike (§4.1):** create proving ground twice → confirm 409; attach `mcamp-io0p8470` + `mcamp-n3fb21nq`; run `getCohortFunnel` filtered to the tree → confirm seed links + baseline metrics.
2. **Seed discipline (AGENTS.md):** run `seed-proving-ground-preflight` against `local` **and** `prd`; verify `updated_at` freshness post-run.
3. **Verification:** `pnpm checkapi`, `pnpm checkweb`, `pnpm --filter api test` (vitest suite), plus a manual smoke of the worklist log-outcome → funnel `touches` increment.
4. **AGENTS.md:** append the new surfaces (proving-ground route, cadence service, verdict table, PG-01 seed script entry) to project conventions.

---

## Acceptance summary (what "done" means per phase)

| Phase | Done when |
|---|---|
| 1 | Migration applies clean locally; proving-ground campaign creatable via API; second create 409s; child attach/detach works |
| 2 | Parent campaign shows the 7-step preflight checklist without triage; seeding a queue row stamps `seed_id` + issues a claim token and keeps it `queued` |
| 3 | Logging `bad_number` on a seeded row marks the rung dead, advances the ladder same-day, writes the seed touch, and leaves the row `queued`; `connected` moves it `in_thread` |
| 4 | Verdict recorded on a surfaced group → `duplicateSeedCount` drops; `same_entity` merges variants |
| 5 | Cockpit renders preflight + gates + due-today; worklist rows ladder correctly; gate banner disables actions while preflight is incomplete |
| 6 | Spike confirms guardrail + funnel numbers; seeds re-run clean on local + prd |
