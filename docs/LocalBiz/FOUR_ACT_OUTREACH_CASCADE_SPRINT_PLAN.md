# Sprint Plan: Four-Act Outreach Cascade

> Build the announced-path machinery — cascade-aware panel + announce queue, announce-scoped claim minting, tagged QR attribution, and the dual-role confirm page — then run cohort 1 (20 prospects) on the manual cadence.

**Status:** DRAFT — gap-fixed 2026-10-19 (blockers B1–B5 resolved; see spec §11)
**Date:** 2026-10-19
**Source spec:** `docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md` (all section/question refs below point there)
**Predecessor sprint:** `seed_outreach_courtesy_window_sprint_plan.md` — built the `outreach_state` machine, `SeedOutreachTriggerService`, `SeedOutreachStateSync`, and the no-response job this sprint reuses
**Related:** `marketing_ops_prospect_queue_sprint_plan.md` (comms worklist pattern), `proving_ground_sprint_plan.md` (`/r/pr` tracked short codes)

**Latest applied migration:** 347 (on disk in `database/migrations/`; verify the DB's applied set before starting)
**New migrations:** one — `348_seed_announce_markers.sql` (announce marker outcomes + touch `metadata` JSONB + queue index). All other work rides existing schema.

---

## 1. Problem

The spec is decided and source-verified. What does not yet exist:

1. **No announce surface.** `outreach_state` tracks a courtesy/verification lifecycle, not delivery: `owner_contacted` means "any attempt" (including voicemail/no-answer) and `freshness_verified` can be entered without C2. There is no published-but-unannounced view and no delivery marker.
2. **Coverage holes in "every publish is announced."** The single publish route already fires the trigger for primary-linked seeds; `publishBatch`, `createSeedsForProvingGround`, and `approveAndInvite` do not. The 14-day no-response job also flips never-announced seeds to `no_response` (spec Q23).
3. **Claim-kit and act-1 capture gaps.** Mint stays at publish (Q3/Q20 reversed), but the claim-kit cards require an active token — the **Generate Claim Invite** button is the mint, and the SOP needs a step 0. `LogContactModal`/`ProspectTouchLogModal` cannot record C3 (pain confirmed/disputed) or C4 (permission); `call_details` is a closed object.
4. **No act-2/act-3 channel attribution.** `/g/{code}` resolves without recording a scan; `mkt_gallery_events` has no channel column; `qr_scan_events` has no campaign/seed column and a 30-char surface. The walk-in gate ("gallery opened *or* tagged QR scan") needs a tagged route (spec Q6, Q10).
5. **No confirm destination.** The act-2 postcard QR and the DM/mail verification fallback need the dual-role confirm page — names the prospect's verified fact, leads onward to the gallery (spec Q18). Nothing like it exists.
6. **Cohort 1 unrun.** The funnel numbers are hypotheses; cadence is manual by decision (Q12).

## 2. Non-Goals

- **No SMS work.** The claim-page consent checkbox (spec Q21) is counsel-gated (Q11) and deferred entirely — text stays excluded from all cascade channels this sprint.
- **No cadence automation.** Manual pacing for cohort 1 (Q12 decided); reminders and scheduling wait for measured data. Confirm cohort campaigns have `cascade_enabled = false` so the existing review cascade does not fire alongside the manual cadence.
- **No dedicated cascade-state table.** Act position rides `outreach_state` + the seed touch ledger + `mkt_gallery_events` (Q9 decided); the one new migration is the announce-marker extension, not a cascade table.
- **No mint-at-announce change.** Q3/Q20 are reversed: the token mints at publish and the announce is the first distribution (spec §11 B2). No trigger mint change.
- **No DM send path.** DM announce/fallback stays manual-send with the tracked `/qs/{code}` QR.
- **No batch-path announce.** `createSeedsFromBatch` stays excluded — volume makes per-seed outreach impractical and batch seeds lack the audit corpus that makes the announce credible. `publishBatch` stays operator-composed; its seeds still appear in the queue.
- **No new modals.** Queue actions reuse `ResolveVerificationModal` / `ProspectTouchLogModal` / `LogContactModal` + `resolveProspectChannels`, extended with the C3/C4 fields (spec §11 B4).

---

## 3. Phase Plan

### Phase 0 — Decisions & external latency (gate, no code)

These block phases or run on external clocks; start them all on day 1.

| Item | Decision needed | Recommended default |
|---|---|---|
| B1/Q23 queue signal | How the queue distinguishes delivered from attempted | **Resolved 2026-10-19:** `announce_scheduled` / `announce_delivered` markers on `directory_seed_outreach_touches`; queue = `published`/`invited` AND no `announce_delivered`. `outreach_state` is not the predicate. |
| B3/Q24 campaign-less anchor | Where a campaign-less announce row lives | **Resolved 2026-10-19:** seed touch ledger (`directory_seed_outreach_touches`); no synthetic campaign. Every single-seed publish writes `announce_scheduled`. |
| B2/Q3/Q20 mint | Mint at publish or announce | **Resolved 2026-10-19:** mint stays at publish; announce is first distribution. No trigger mint change. |
| Q22 aging threshold | Flag value | `SEED_OUTREACH_NO_RESPONSE_DAYS` (14d) as a UI flag only; queue membership is marker-based, so the job no longer removes seeds. |
| Q2 inline image | Does the operator's sending tool render an inline PNG? | Test before act 2. Fallback: hosted PNG link + tracked `/qe/` text link. |
| Q11 counsel | Cold email/call basis, consent-flag relabel, future text | Start now; **pilot gate is written sign-off**, not "engaged." |
| Q14 consent relabel | `owner_contact_consent` false is not "do not contact" | **Implemented:** seed detail reads "owner-initiated opt-in on record" / "cold-contact basis governed separately." |
| Q4 script review | Team review + counsel note on DNC screening | Approve §2.1.1 before the first call. |
| Q17 identification | Branding writer, staffed contacts, snapshot, sign-off | Build a `PlatformBrandingService` returning socials + dated fallback; record values used; block announce on a missing required surface. |
| B5 settings auth | Secure the platform branding writer | `authenticateToken` + `requirePlatformAdmin` on POST; GET stays public. |
| Cohort ops | DNC record, postcard/confirm copy, cohort selection | Per-prospect DNC clearance record (touch/notes); 20-prospect list by cluster, drivable radius, category, triage priority. |
| Cadence isolation | Existing automation must not fire alongside the manual cadence | Verify `cascade_enabled = false`; confirm no auto-follow-up rows interfere with the cohort. |

**Exit:** counsel sign-off received; Q2/Q4/Q14/Q17 resolved; DNC process + per-prospect record defined; cohort-1 list assembled; B5 auth fix merged.

### Phase 1 — Announce markers, anchors & state semantics (`apps/api`)

- **B1/B3 — one migration + one service.** Add `348_seed_announce_markers.sql`: extend `directory_seed_outreach_touches_outcome_check` with `announce_scheduled` and `announce_delivered`, add a `metadata` JSONB column, and add a `(seed_id, outcome)` index. Extend `DirectoryPresenceSeedService.addOutreachTouch` to accept `metadata` and the two outcomes. New `SeedAnnounceService`:
  - `scheduleForSeed(seedId)` — resolve channel (seed `owner_phone` → listing phone → seed `owner_email` → listing email → `other`), compose the announce (platform identification + place URL + claim URL, no send), write `announce_scheduled` + set `outreach_state='outreach_scheduled'`, idempotent per seed.
  - `markDelivered(seedId, { channel, notes, metadata })` — write `announce_delivered`; optionally set `owner_contacted` (do not overwrite terminal states).
  - `isAnnounced(seedId)` / `listQueue()` — the queue predicate.
- **Publish-path coverage (corrected matrix).** The single publish route already fires the trigger for primary-linked seeds; also write the `announce_scheduled` marker there. Add `scheduleForSeed` for seeds with no primary link. In `createSeedsForProvingGround`, call `onSeedCreated` when `source_campaign_id` exists, else `scheduleForSeed`. `publishBatch` stays operator-composed (documented); `approveAndInvite` stays an owner-initiated exception.
- **B2 — no mint change.** Keep the trigger's publish-time mint. Verify the claim kit's Email link card and add SOP step 0 ("Generate Claim Invite" when no active token). Do not remove the mint.
- **B4 — C3/C4 API capture.** Extend the seed touch route/service and the campaign log path to accept `verification_results` (fact_confirmed / fact_disputed / pain_confirmed / pain_not_present / follow_up_requested). Store on `mkt_outreach_log.verification_results` for campaigns and in touch `metadata.verification_results` for seeds. `call_details` stays closed.
- **Queue semantics.** The queue is marker-based, not `outreach_state`-based. The courtesy job is unchanged; a `no_response` seed without `announce_delivered` remains in the queue. Do not add a delivered check to the job.
- **Tests:** `SeedAnnounceService.test.ts` (new), `DirectoryPresenceSeedService.announceQueue.test.ts` (new), extend `SeedOutreachTriggerService.test.ts` (marker written, mint retained), `seed-outreach-no-response.test.ts` (queue membership unaffected), `DirectoryPresenceSeedService.outreachTouchRecording.test.ts` (metadata), and the CHECK-constraint parity test (new outcomes permitted).

**Exit:** every single-seed publish writes `announce_scheduled`; delivery writes `announce_delivered`; a campaign-less seed has a working anchor; `pnpm checkapi` + vitest green.

### Phase 2 — Cascade-aware panel + announce queue (`apps/web` + thin api)

- **Announce queue endpoint** — `GET /api/admin/directory/presence-seeds/announce-queue`: `status IN ('published','invited')`, `announce_scheduled` present, `announce_delivered` absent, `dps.published_at` age, oldest-first. Do not compose this client-side from the existing single-value `outreachState` filter.
- **Announce queue view** — implemented as a sibling route (`settings/admin/directory/presence-seeds/announce-queue`, `AnnounceQueueTable`) linked from the seeds page header. Rows show age, channel, claim/listing links, and a **Mark announced** action that writes the `announce_delivered` marker. The remaining row-action work is the modal adapter for Resolve/Log touch/Log contact on seed-only rows.
- **Row actions** — implemented for the queue: **Log announce** opens `ProspectTouchLogModal` in seed-scoped mode (`seedId`) with channel/outcome, C2 delivered, C3 pain, and C4 permission; it writes the seed touch and, when C2 is ticked, the `announce_delivered` marker. **Mark announced** is the quick delivery-only path. The campaign-backed Resolve/Log contact actions still use the campaign modals; the seed detail page remains the place for NAP verification and anchors.
- **Per-prospect cascade view** — implemented: `SeedCascadeService.getSummary` + `GET /presence-seeds/:id/cascade` + the `/presence-seeds/[id]/cascade` page. It merges seed touches, linked-campaign logs, gallery events, and tagged scans into a timeline; derives act 1 (operational + channel + pain), act 2 (mail/email after announce), act 3 (`gallery_opened` or a `cascade_gallery` tagged scan), and act 4 (`visit` touch); and exposes the act-3 gate with the confirm-scan caveat. A confirm-page scan alone does **not** clear act 3.
- **C3/C4 UI** — implemented in `LogContactModal` (campaign) and `ProspectTouchLogModal` (seed): C2 announce-delivered, C3 pain confirmed/disputed, C4 permission. The seed detail page's inline Log touch form is unchanged; use the modal for structured capture. `owner_contact_consent` is relabeled per Q14.
- **Campaign execution placement (implemented).** The campaign detail page's **Project Plan → Execution** tab (`#execution`, `CampaignExecutionPanel`) is the campaign-scoped execution home: announce status + actions, act cards, walk-in gate, and recent activity, resolved from the campaign's primary seed via `GET /campaigns/:id/cascade`. The seeds admin announce queue remains the cross-prospect worklist (and the only home for seed-only prospects). This uses the tab slot the project-phase plan already reserved for `#execution`; the existing review-pipeline **Cascade** tab is a different feature and is untouched.
- **PG execution placement (implemented).** The PG cockpit's **VAST** tab (`VastPanel`) is the pre-campaign board for PG-scope queued prospects: Verification → Awareness → Show → Tell, with a PG-level act count, per-prospect chips, and Log announce / Seed / Cascade actions. It resolves a queue row's `seed_id` first, then the campaign's primary seed via `GET /campaigns/cascade-batch` (campaign_created rows often carry the link on the campaign, not the queue row); campaign-linked unseeded rows show "No seed (campaign)" and a Campaign link. Unseeded prospects show "Promote to listings" rather than a false negative. Campaign-backed prospects continue on the campaign `#execution` tab. Note: the Promote tab's "enriched" chip is shelf-market enrichment, not seed status.
- **Seed detail placement (implemented).** `SeedCascadeCard` sits on the seed detail page itself: announce state + Log announce / Mark announced, the four VAST act cards (each linking to the full cascade at that act), the walk-in gate, and a Full cascade link. The seed's own surface now has cascade awareness; the full page remains the drill-down.

**Exit:** operator can see every published-but-unannounced seed, its age, channel, and act position; announce delivery writes the marker; the modals capture C3/C4; `pnpm checkweb` + vitest green.

### Phase 3 — Tagged QR attribution (`apps/api`)

- **Q6 — tagged short link (implemented).** `QrSurfaceType` / `SURFACE_LABELS` now include `cascade_postcard`, `cascade_confirm`, and `cascade_gallery`. `GET /api/public/cascade/scan/:code` resolves a gallery/confirm short code, records `qr_scan_events` with `product_id` = `business_prospect_id` (or campaign id) and the requested surface, and returns the destination; `apps/web/src/app/cf/[code]` redirects. Tenant resolves from the token, then the linked seed, then `platform`.
- **Mailer wiring (implemented).** `cascade_gallery` tags the gallery QR as `/cf/{shortCode}?surface=cascade_gallery`; `cascade_confirm` uses a live `confirm_page` token as `/cf/{shortCode}?surface=cascade_confirm` (or `/confirm/{token}` when no short code). Both are in `MailerQrDestination`, `MAILER_DESTINATION_OPTIONS`, `ctaLabelForDestination`, and the `MailerPanel` picker.
- **Two postcard generators.** Still to decide: `PostalMailerService` (campaign) is wired; if act 2 uses `ClaimInviteQrKitService` (seed claim postcard), its QR must point at the confirm page, not the claim page.
- **Act-3 gate input.** Implemented in `SeedCascadeService` (`gallery_opened` on a linked campaign/sibling OR a `cascade_gallery` tagged scan). A `cascade_confirm` scan is act-2 delivery, not act 3.

**Exit:** a postcard scan and an email click produce distinguishable signals; a confirm-page scan and a gallery view are distinguishable; the funnel can attribute act-3 events.

### Phase 4 — Dual-role confirm page (`apps/web` + api)

- **Q18 — token + route (implemented).** `ConfirmPageService` mints a `confirm_page` token via `generateCampaignToken` (union extended), supersedes prior unconverted confirm tokens, and stores the fact + `business_prospect_id` in `metadata`. Routes: `POST /api/admin/marketing-ops/campaigns/:id/confirm-page-token`, `GET/POST /api/public/marketing/confirm/:token`, `/confirm/[token]` (noindex layout), and `/cf/[code]` (already wired in Phase 3).
- **Fact binding (implemented).** The desk-picked fact rides the token `metadata.fact` (`field`, `label`, `expected`, `actual`, `sources`); the `MailerPanel` has a "Confirm page (act 2)" card to enter the fact and mint the token. No campaign-schema migration.
- **Form + write path (implemented).** The page collects C1 operational, C3 confirmed/disputed, C4 permission, and notes. Submit writes `verification_results` to the primary seed's touch metadata (or `mkt_outreach_log.verification_results` for campaign-only prospects) and records a `cascade_confirm` scan. A scan alone is not a full act-1 gate.
- **Disputed fact (implemented).** The resolver reads recent campaign logs and seed touches; a `fact_disputed` / `pain_not_present` result suppresses the fact and shows neutral confirm copy.
- **Gallery onward link (implemented).** Uses the campaign's live `diagnostic_gallery` token (`/g/{shortCode}` or `/preview/{token}`); the claim link comes from the campaign's primary seed.
- **Seed-only limitation.** `mkt_deliverable_preview_tokens.campaign_id` is NOT NULL, so the confirm page is campaign-scoped. A seed-only prospect (no campaign) has no confirm page; cohort 1 is campaign-backed. A seed-scoped confirm token is deferred.

**Exit:** postcard QR → named-fact page → gallery; a scan/form submit clears the record gate for non-phone prospects; a disputed fact is suppressed.

### Phase 5 — Cohort 1 pilot (ops; measurement surface implemented)

Run the manual cadence (spec §4) on the 20-prospect list:

1. Publish seeds post-QC (continuous); announce in daily call blocks off the queue.
2. Act 2 postcards in triage-priority order; act 3 gallery email; act 4 walk-ins on gate-cleared prospects only.
3. Measure the hypotheses: postal transit (Q8), funnel conversion at each gate, 5-day tracked-signal window validity (Q16), organic claim requests during the organic window (§1). The six stages are defined and reported by `SeedCascadeCohortService` (`GET /presence-seeds/cascade-cohort`, `/presence-seeds/cascade-cohort` UI): verified, aware, gate-cleared, walk-in scheduled/done, claimed, organic claim. Postal transit remains a manual observation.
4. Retro → update spec §6 funnel numbers from hypotheses to measured; adjust thresholds (Q16/Q22) with data.

**Exit:** first real funnel numbers + spec updated to measured baselines.

---

## 4. Dependencies & Order

```
Phase 0 (counsel sign-off + ops prep + B5 auth) ── gates everything
   ├─→ Phase 1 (migration 348 + announce markers/anchors + C3/C4 API)
   │      └─→ Phase 2 (queue endpoint + panel + modal adapters)
   ├─→ Phase 3 (tagged QR)  ─┐
Phase 4 (confirm page)  ────┴─→ needed before act-2 postcards can carry a QR
Phase 5 (pilot) ── needs Phases 1, 2, 4; Phase 3 strongly preferred
```

Phases 3 and 4 are parallelizable; Phase 2 is the panel that makes Phases 1/3 visible to the operator. Phase 1's migration must land before Phase 2's endpoint. Phase 5 cannot start before counsel sign-off and the DNC record.

## 5. Verification

- `pnpm checkapi` / `pnpm checkweb` after each phase
- `cd apps/web && npx vitest run` for touched component tests; api vitest suites for announce/trigger/job changes
- New tests: `SeedAnnounceService`, announce-queue predicate, `announce_scheduled`/`announce_delivered` CHECK parity, C3/C4 `verification_results` round-trip, seed touch metadata, settings POST auth
- Manual: seed → publish (each path in the corrected matrix) → queue membership; announce delivery → `announce_delivered` → queue exit; postcard PDF → tagged QR → `qr_scan_events` (`product_id`) → gallery event → walk-in gate eligibility; confirm page token/expiry/disputed fact

## 6. Spec bookkeeping

On phase completion, mark the resolved §9 items in `FOUR_ACT_OUTREACH_CASCADE_SPEC.md` (Q3/Q20 reversed; Q6, Q18–Q25 by phase) and append new findings to §10. The spec is the contract; the plan executes it.
