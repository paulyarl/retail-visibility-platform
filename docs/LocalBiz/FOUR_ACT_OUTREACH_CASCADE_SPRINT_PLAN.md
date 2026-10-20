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
| Q14 consent relabel | `owner_contact_consent` false is not "do not contact" | Relabel to "owner-initiated opt-in only"; one-line UI copy change in Phase 2. |
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
- **Announce queue view** — a tab/section on `settings/admin/directory/presence-seeds` (decided placement; the PG cockpit is per-PG and the communications page is read-only). Rows show age, channel, last touch, and the claim/place links.
- **Row actions** — lifecycle-mapped chips, but adapted for seeds: `ResolveVerificationModal` needs a seed-shaped `VerificationEntryLike` and a seed-scoped submit; `ProspectTouchLogModal` needs a seed/queue adapter; `LogContactModal` is campaign-only. For campaign-less seeds use the seed touch route with the C3/C4 fields. `resolveProspectChannels` needs a seed/listing adapter (owner phone/email + listing phone/email).
- **Per-prospect cascade view** — use `ProspectCommunicationService.getProspectTimeline` for the merged seed-touch + campaign-log timeline, plus `qr_scan_events` and `mkt_gallery_events`. Derive act position: act 1 = verification fields/state, act 2 = mail/email touch after announce, act 3 = `gallery_opened`, act 4 = `visit` touch.
- **C3/C4 UI** — add the cascade fields to `LogContactModal` (campaign) and `ProspectTouchLogModal` (seed); the API already accepts the shape after Phase 1. Relabel `owner_contact_consent` per Q14.

**Exit:** operator can see every published-but-unannounced seed, its age, channel, and act position; announce delivery writes the marker; the modals capture C3/C4; `pnpm checkweb` + vitest green.

### Phase 3 — Tagged QR attribution (`apps/api`)

- **Q6 — tagged short link.** Add `cascade_postcard` / `cascade_confirm` (and, if needed, `cascade_gallery`) to `QrSurfaceType` and `SURFACE_LABELS`; keep each ≤30 chars. Record `product_id` = `business_prospect_id` or campaign id (the per-prospect join key), tenant resolved as `/r/pr-scan` does. Prefer `mkt_deliverable_preview_tokens.short_code` + `resolveShortCode` over `mkt_prospect_report_links` (report-specific).
- **Mailer wiring.** Add a `confirm_page` destination to `MailerQrDestination`, `MAILER_DESTINATION_OPTIONS`, `ctaLabelForDestination`, and `MailerPanel`/`MailerQrDesignerModal`. The private `resolveQrDestination` is not the only edit. Check `assertMailerAllowed` (seek/seed/preview_built) and the mailing-address requirement for the cohort.
- **Two postcard generators.** Decide which one act 2 uses: `PostalMailerService` (campaign) or `ClaimInviteQrKitService` (seed claim postcard). If the latter, its QR must point at the confirm page, not the claim page.
- **Act-3 gate input.** Implement the gate query: `mkt_gallery_events` (`gallery_opened`, campaign/sibling) OR a tagged **gallery** scan (`product_id` + surface). A confirm-page scan alone is act-2 delivery, not act 3 (spec §2.3).

**Exit:** a postcard scan and an email click produce distinguishable signals; a confirm-page scan and a gallery view are distinguishable; the funnel can attribute act-3 events.

### Phase 4 — Dual-role confirm page (`apps/web` + api)

- **Q18 — token + route.** Mint a `confirm_page` token type via `generateCampaignToken` (extend the closed union), reuse `mkt_deliverable_preview_tokens.short_code`, add a `/cf/[code]` redirect page and `/confirm/[token]` page. Token-gated, expiring, noindex.
- **Fact binding.** No `selected_pain` exists; `cascade_config` is owned by the review cascade and `seo_enrichment` is seed-level. Store the desk-picked fact in the token `metadata.fact` (structured: field, expected, actual, sources) and, for the campaign record, a dedicated `repair_triage_briefing`-adjacent slot or a new `cascade_fact` JSON — decide at build; prefer the token metadata so the printed artifact and the page cannot drift.
- **Form + write path.** The form collects the confirm action and the missing gate fields: C1 operational, C3 pain confirmed/disputed, C4 channel + permission. Submit writes `verification_results` (campaign) or touch `metadata.verification_results` (seed) and a `qr_scan_events` row. A scan alone is not a full act-1 gate.
- **Disputed fact.** If the act-1 call disputes the fact, the postcard must not mail; if a printed postcard still resolves, the page suppresses the fact and shows the corrected/neutral confirm copy.
- **Gallery onward link.** Use the campaign's live gallery token (mint if none); for seed-only prospects, link the seed's report/place page instead.

**Exit:** postcard QR → named-fact page → gallery; a scan/form submit clears the record gate for non-phone prospects; a disputed fact is suppressed.

### Phase 5 — Cohort 1 pilot (ops; no code)

Run the manual cadence (spec §4) on the 20-prospect list:

1. Publish seeds post-QC (continuous); announce in daily call blocks off the queue.
2. Act 2 postcards in triage-priority order; act 3 gallery email; act 4 walk-ins on gate-cleared prospects only.
3. Measure the hypotheses: postal transit (Q8), funnel conversion at each gate, 5-day tracked-signal window validity (Q16), organic claim requests during the organic window (§1). Define the six stages up front: verified, aware, gate-cleared, walk-in scheduled, claim, organic claim.
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

On phase completion, mark the resolved §9 items in `FOUR_ACT_OUTREACH_CASCADE_SPEC.md` (Q3/Q20 reversed; Q6, Q18–Q24 by phase) and append new findings to §10. The spec is the contract; the plan executes it.
