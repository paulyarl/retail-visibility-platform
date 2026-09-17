# QR Outreach Pipeline Integration — Specification

Status: Draft (2026-09-17)
Owner: Platform team
Surface: platform admin — `Settings → Admin → Marketing Ops` (Openers, Campaign Checklist, Playbooks) + `Settings → Admin → Directory → Presence Seeds`
Related docs:
- `docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md` (§13.5 claim handoff, §13.6 report delivery by channel)
- `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` (§4.7 cadence, §4.10 preflight, §4.11 gap-map)
- `docs/LocalBiz/marketing_ops_manual_play_lane_guide.md`
- `docs/LocalBiz/MANUAL_PLAY_TEMPLATE_AUTHORING_SPEC.md`
- `.devin/skills/qr-analytics-guide.md`

> **Scope note.** QR generation and presentation already ship (claim-invite kit, report-delivery kit, styled-QR designer, admin routes, report-PDF claim QR). This spec covers **wiring QR into the outreach pipeline** — playbooks, checklists, call scripts, pitch construction, manual play templates, delivery lifecycle, cadence, and analytics.
>
> - **Track A (§5):** direct integration — QR becomes a first-class pipeline artifact.
> - **Track B (§6):** lighter alternatives (copy-only, deep-link-only, analytics-only, QR-as-deliverable).
> - **§7** lists non-goals. **§11** gives the recommended sequencing.

---

## 1. Summary

Two tracked QR artifact families exist today and are invisible to everything that tells an operator what to do:

1. **Claim-invite QR kit** (`ClaimInviteQrKitService.ts`) — PNG + 4×6" postcard, variants `mail | walkin | social | email`, tracked short URLs `/q/ /qw/ /qs/ /qe/`, surfaces `claim_invite*`.
2. **Report-delivery QR kit** (`SeedReportDeliveryService.ts`) — PNG + 4×6" postcard, channels `phone | email | social | in_person | text`, tracked short URLs `/r/ /rt/ /re/ /rs/ /rp/`, surfaces `report_delivery_*`.

Both encode a **tracked redirect** (never the destination), record a `qr_scan_events` row, then 302 to the claim page or the report preview. Generation, admin routes, and the seed-detail designer UI are complete.

What is missing is the pipeline layer:

- playbooks do not declare which delivery artifacts they ship;
- checklists have no step to generate, print, or deliver a kit (the PG-01 preflight playbook omits the step its own spec requires);
- call scripts and pitch construction never mention the card/QR or carry a tracked link;
- manual play templates cannot resolve `{{report_url}}` or any `{{qr_*}}` variable;
- a delivered report has no `viewed` / `claimed` / `declined` lifecycle — and the one outcome it does write (`report_delivered`) is silently rejected by a DB CHECK (G12);
- report-delivery scans are absent from the QR analytics taxonomy and the seed funnel;
- the cadence's "check `qr_scan_events`" mail-rung action is manual by design.

**Goal:** an operator working a campaign or proving-ground prospect sees, at each step, which QR artifact to generate and deliver, on which channel, with the tracked link already resolved into every script and pitch — and the resulting scan feeds the funnel, the checklist, and the cadence automatically.

---

## 2. Current state (verified)

| Piece | Location | Behavior |
|---|---|---|
| Claim-invite kit | `apps/api/src/services/ClaimInviteQrKitService.ts` | `resolveClaimInviteKit` (L95–190), variants `mail/walkin/social/email` (L64–79), URLs `/q/ /qw/ /qs/ /qe/` (L152–167). Requires an active `directory_claim_tokens` row; lazily back-fills `short_code`. |
| Report-delivery kit | `apps/api/src/services/intelligence/SeedReportDeliveryService.ts` | `resolveReportDeliveryKit` (L131–238), channels (L64–84), URLs `/r/ /rt/ /re/ /rs/ /rp/` (L202–220), `generateReportQrPng` (L246–267), `generateReportPostcard` (L409–529), `recordDeliveryEvent` (L330–383). Requires a published report + active claim token. |
| Report PDF claim QR | `apps/api/src/services/intelligence/SeedReportPdfService.ts` | §9 Claim Summary embeds a claim QR (L501–520); `generateClaimQrPng` prefers `/q/{shortCode}` (L617–639). |
| Scan redirect (report) | `apps/api/src/routes/seed-report-qr.ts` | `/api/public/r/seed/:seedId/:channel` + `/api/public/r/report-scan/:shortCode`; surfaces `report_delivery_{phone,email,social,in_person,text}` (L43–53). Records the scan even when resolution fails. |
| Scan redirect (claim) | `apps/api/src/routes/directory-claim-qr.ts` | Long-token `/api/public/qr/claim/{token}[/walkin|/social]`; short-code pages `/q/ /qw/ /qs/ /qe/`. |
| Admin routes | `apps/api/src/routes/directory-presence-admin.ts` | `GET .../qr-kit`, `.../qr-kit/png`, `.../qr-kit/postcard` (GET+POST styled) (L1781–1893); `.../report-qr-kit`, `.../report-qr-kit/png`, `.../report-qr-kit/postcard` (GET+POST styled) (L1905–2008). |
| Designer UI | `apps/web/.../presence-seeds/[id]/ReportQrDesignerModal.tsx` (+ claim counterpart) | Client-rendered styled QR posted as `qrDataUrl` into the same postcard layout. |
| QR analytics | `apps/api/src/services/QrAnalyticsService.ts` | `QrSurfaceType` (L22), `SURFACE_LABELS` (L132–144), `trackQrScanEvent` (L183–216). `qr_scan_events.surface` has **no CHECK constraint** (added by migration `117_qr_analytics.sql`; `072_qr_scan_events.sql` predates the column). |
| Seed funnel scans | `apps/api/src/services/SeedFunnelAnalyticsService.ts` | `invite_scans` + per-channel counts filter `surface IN ('claim_invite','claim_invite_walkin','claim_invite_social')` (L444–478). |
| Cadence | `apps/api/src/services/ProvingGroundCadenceService.ts` | Channel ladder + signal→wait map (L89–103); `mail` rung waits +10d and leaves the QR-scan check to the operator (L28–29). |
| Delivery touches | `directory_seed_outreach_touches` | Only outcome written by delivery is `report_delivered` (`SeedReportDeliveryService` L355). **CHECK constraints (verified):** `outcome` ∈ `connected/no_response/no_answer/no_reply/voicemail/bad_number/bounce/unread/read_no_reply/form_submitted/referral_asked/claimed/not_interested` (migration `262_proving_ground.sql` L84–90); `channel` ∈ `call/email/sms/mail/form/referral/visit/other` (migration `273_seed_outreach_visit_channel.sql` L16–20). The delivery insert writes `outcome='report_delivered'` and `channel ∈ {phone,email,social,in_person,text}` → **both violate the CHECKs (see G12).** Read by `SeedIntelligenceReportService` (L436, L449) to gate refresh. |
| Legacy claim route | `apps/web/src/app/directory/claim/[token]/page.tsx` | Client redirect to `/place/claim/[token]` (L5–13) — a live alias, not dead code. |
| Checklist steps | `apps/api/src/services/PlaybookChecklistService.ts` | Permanent step IDs (L124–137); seed-first wedge steps (L158–294); outreach-access steps (L296–339). Only `mintClaimToken` mentions the kit (L270). |
| Outreach bridge | `apps/api/src/services/OutreachChecklistBridgeService.ts` | `OutreachArtifactKind = opener \| follow_up \| pitch \| contact_log` (L34); `checkStepSatisfaction` (L126–195); deep links (L201–226); auto-complete (L234–298). |
| Outreach state | `apps/api/src/services/triage/outreach-state-extractor.ts` | `OX_OPENER_SENT / OX_FOLLOWUP_SENT / OX_PITCH_ASSEMBLED / OX_NO_REPLY_* / OX_CONTACT_LOGGED` (L140–147). |
| Call scripts | `apps/api/src/services/CallScriptService.ts` | Seed script merges `report_url` + `claim_url`/`claim_short_url` (L402–445, L503–533). Cold-call script merges `claim_url` + `gallery_short_url` (L226–253). |
| Manual play templates | `apps/api/src/services/outreach-openers/manual-play-templates.ts` | Catalog (L57–160); merge keys documented at L18–21. |
| Manual merge context | `apps/api/src/services/ManualOutreachScriptService.ts` | `buildMergeContext` (L730–779) now spreads `buildOutreachLinkVars` (report_url, claim_url, claim_short_url, qr_url_*); legacy `resolveClaimUrl` deleted. Shared resolver: `apps/api/src/services/outreach-openers/outreach-link-vars.ts`. |
| Shared link resolver | `apps/api/src/services/outreach-openers/outreach-link-vars.ts` | `resolveCampaignSeedId` / `resolveClaimUrlForSeed` / `resolveClaimUrlForCampaign` / `buildOutreachLinkVars`. Kit services loaded lazily (module-load `unifiedConfig.get()` hazard). |
| Pitch format | `apps/api/src/services/outreach-pitch/pitch-renderer.ts` | `FootprintFocusAttribute` incl. `claim_status` (L51–56); render order (L170–229). No QR/CTA slot. |
| PG-01 preflight playbook | `apps/api/src/scripts/seed-proving-ground-preflight.ts` | 14 seeded steps (L75–275); no "generate QR kit" step. |
| Playbook catalog | `mkt_playbook_catalog` (migration `157_mkt_playbook_catalog.sql`) | `fitd_offer_title`, `fitd_default_fee_cents`, `retainer_pitch_title`, `retainer_fee_cents`, `opener_prompt_template_id`, `preview_deliverable_type`. No delivery-artifact field. |

---

## 3. Gap analysis

**G1 — Playbook catalog has no delivery-artifact concept.** `mkt_playbook_catalog` describes the offer and the preview deliverable type, but never which QR artifacts a play ships (mailed claim postcard, walk-in card, report postcard, social link). The checklist builder therefore cannot materialize channel-appropriate QR steps.

**G2 — PG-01 omits its own required step.** `PROVING_GROUND_CAMPAIGN_SPEC.md` §4.10 lists "Generate claim-invite QR kits" as preflight step 3, but the seeded PG-01 checklist (`seed-proving-ground-preflight.ts`) has no such step. The spec's §4.10 acceptance ("kit downloadable per prospect") is unreachable from the checklist.

**G3 — Checklist steps barely mention QR.** The only reference is inside `mintClaimToken`'s instructions. There is no permanent step to generate/download the claim kit, no step to deliver a report QR, and `pitchFreeClaim` says "share the claim link" without the card/QR alternative.

**G4 — The outreach bridge cannot see a kit.** `OutreachArtifactKind` has no QR kind, so a QR step can never auto-complete or render status, and `OutreachState` carries no QR-derived signal for the triage/overview cards.

**G5 — Call scripts never mention the card.** `assembleForSeed` resolves the report + claim URLs but the close only offers text/email; there is no walk-in-card language and no `qr_url_*` merge field. The cold-call path has `gallery_short_url` for the SMS handoff but no report QR.

**G6 — Manual play templates cannot reference the report or a QR.** The merge context has no `report_url`, no `claim_short_url`, and no `qr_*` keys. An operator who types `{{report_url}}` gets a raw unresolved placeholder (the documented "unresolvable stays visible" contract, which here masks a missing key rather than an unknown one).

**G7 — Claim URL drift (verified: cosmetic, not a break).** `ManualOutreachScriptService.resolveClaimUrl` builds `/directory/claim/{token}`, while the claim kit, `SeedReportDeliveryService`, and `CallScriptService.assembleForSeed` all use `/place/claim/{token}`. `/directory/claim/[token]` is a live client-side redirect to `/place/claim/[token]`, so the link resolves — but it adds a hop and keeps two canonical forms in circulation. Unify on `/place/claim/{token}`.

**G8 — Pitch has no QR/CTA slot.** The pitch format ends at closer → contact; `claim_status` is only a footprint focus attribute. There is no block carrying the tracked short link or a "scan to view your report / claim" CTA.

**G9 — Report scans are invisible to analytics.** `report_delivery_*` are not in `QrSurfaceType`/`SURFACE_LABELS` (the redirect casts `surface as any`), and `SeedFunnelAnalyticsService` counts only `claim_invite*`. Report-QR performance never reaches the funnel or the dashboards' human-readable labels.

**G10 — No view/claimed/declined lifecycle.** Spec §13.6 requires each delivery event to record "whether the report was viewed, claimed, or declined." Only `report_delivered` is written; nothing maps a `qr_scan_events` row back to the delivery touch.

**G11 — Cadence defers QR to the operator.** The mail rung's next action is a manual "check `qr_scan_events`" decision, and `ProvingGroundCadenceService` has no QR-derived outcome to advance or hold on.

**G12 — Report-delivery touches never persist (live bug, verified).** `SeedReportDeliveryService.recordDeliveryEvent` (L336–368) inserts `outcome = 'report_delivered'` and `channel ∈ {phone, email, social, in_person, text}`. Against the live CHECK constraints — `outcome` (migration `262_proving_ground.sql` L84–90) and `channel` (migration `273_seed_outreach_visit_channel.sql` L16–20) — neither value set contains `report_delivered`, and only `email` overlaps the channel set. Every insert raises `23514 check constraint violated`, is swallowed by the method's best-effort `catch`, and the touch is silently dropped. Consequences: the cadence `touches` numerator never counts report deliveries; the report-refresh gate on `outcome = 'report_delivered'` (`SeedIntelligenceReportService` L436) never fires; and `SeedReportDeliveryService.test.ts` L73 only asserts the SQL *text*, so the suite stays green. This must be fixed before §5.3's lifecycle work, since the same constraint gates the new outcomes.

---

## 4. Design principles

1. **One kit resolver, many consumers.** Every surface resolves URLs through `getClaimInviteKitMeta` / `getReportKitMeta`. Never hand-build a QR URL outside those services (that is how G7 happened).
2. **Unresolved placeholders stay visible.** Extend the merge contract; never fabricate a link. A missing key must remain `{{key}}` so the operator sees the gap.
3. **Tracked URL, never the destination.** The QR always encodes the redirect that records the scan first.
4. **The scan is the signal, not the claim.** A scan records a warm lead even when resolution fails (existing behavior — preserve it).
5. **No CHECK-constraint coupling.** `qr_scan_events.surface` is unconstrained; adding surfaces is a code-only change. Do not introduce a CHECK on it (enum-drift rule, migrations 256/264/270).
6. **Best-effort write-back.** Delivery/scan recording must never block the redirect or the send.

---

## 5. Track A — Direct integration

### 5.1 Merge-field contract — SHIPPED

Extend the merge contexts so every script/pitch/template can reference the report and the tracked QR URLs. Resolution is best-effort; a null/absent key leaves the placeholder visible.

**Shipped as `apps/api/src/services/outreach-openers/outreach-link-vars.ts`** — the single resolver (`resolveCampaignSeedId`, `resolveClaimUrlForSeed`, `resolveClaimUrlForCampaign`, `buildOutreachLinkVars`). Both kit services are loaded lazily (`import type` + dynamic `import()`), because `ClaimInviteQrKitService` evaluates `unifiedConfig.get()` at module load — a static import broke any test with a partial config mock.

| Key | Resolves to | Source |
|---|---|---|
| `report_url` | `{WEB}/seed-report/{seedId}` | seed id (always present for a seed) |
| `claim_url` | `{WEB}/place/claim/{token}` | kit `claimUrl` — **fixes G7** |
| `claim_short_url` | `{WEB}/c/{shortCode}` | kit `shortClaimUrl` |
| `qr_url_mail` | `{WEB}/q/{shortCode}` | claim kit `qrUrl` |
| `qr_url_walkin` | `{WEB}/qw/{shortCode}` | claim kit `qrUrlWalkin` |
| `qr_url_claim_social` | `{WEB}/qs/{shortCode}` | claim kit `qrUrlSocial` |
| `qr_url_claim_email` | `{WEB}/qe/{shortCode}` | claim kit `qrUrlEmail` |
| `qr_url_report_in_person` | `{WEB}/r/{shortCode}` | report kit `qrUrlInPerson` |
| `qr_url_report_text` | `{WEB}/rt/{shortCode}` | report kit `qrUrlText` |
| `qr_url_report_email` | `{WEB}/re/{shortCode}` | report kit `qrUrlEmail` |
| `qr_url_report_social` | `{WEB}/rs/{shortCode}` | report kit `qrUrlSocial` |
| `qr_url_report_phone` | `{WEB}/rp/{shortCode}` | report kit `qrUrlPhone` |

- **`ManualOutreachScriptService.buildMergeContext`** — ✅ wired: `claim_url: null, ...linkVars`; private `resolveClaimUrl` deleted.
- **`CallScriptService`** — ✅ wired: `PhoneMergeContext` gained all keys; `resolveMerge` is now a generic `{{key}}` replacer (was a hand-maintained 6-key chain); `assembleForCampaign` uses `linkVars`; `assembleForSeed` spreads `linkVars` (explicit `report_url`/`claim_url` keep seed-side precedence) and exposes `qr_url_walkin` / `qr_url_report_in_person` / `qr_url_report_text` on `callContext`.
- **Construction Variables panel** — still open: the panel detects `{{...}}` dynamically, so the new keys appear automatically, but they are not yet badged as server-resolved vs operator-entered.

### 5.2 Claim URL unification (G7) — SHIPPED

Pick `/place/claim/{token}` as canonical (used by the kit, the report service, and the seed call script). **All three legacy producers now delegate to `resolveClaimUrlForCampaign` / `buildOutreachLinkVars`:**
- `ManualOutreachScriptService.resolveClaimUrl` — deleted
- `CallScriptService.resolveClaimUrl` — deleted
- `HookSuggestionService.resolveClaimUrl` — kept public (called by `SeedOutreachTriggerService`), now a one-line delegate

`apps/web/src/app/directory/claim/[token]/` is **confirmed a live client redirect** to `/place/claim/[token]` — kept as a compatibility alias (existing shared links depend on it) and documented as legacy in its header comment.

### 5.3 Delivery lifecycle (G10, G12)

> **Prerequisite (G12):** the existing `report_delivered` insert already violates both CHECK constraints and silently drops. Fix the constraint set and the writer first, or every new outcome inherits the same failure.

**5.3.1 Fix the constraint set + the writer (G12). — SHIPPED (migration 289)**

Shipped as `database/migrations/289_seed_outreach_touch_report_outcomes.sql`:

- `directory_seed_outreach_touches_outcome_check` re-added with the full set (262's values + `report_delivered, report_viewed, report_claimed, report_declined, claim_qr_generated`). Guarded `DO $$ … to_regclass` pattern (mirrors 262/273).
- **Channel is not extended** — the writer now maps onto the canonical set instead:
  `phone → call`, `text → sms`, `social → other`, `in_person → visit`, `email → email` (`TOUCH_CHANNELS` in `SeedReportDeliveryService`). The human-readable channel name stays in the delivery note.
- Regression guard: `apps/api/src/services/__tests__/SeedReportDeliveryService.test.ts` now asserts the emitted channel/outcome against the **effective CHECK value set parsed from `database/migrations/*.sql`** — this is the DB-level parity check (the repo has no live-DB test harness; the old test only grepped SQL text, which is why G12 shipped). It resolves the real migrations dir by walking ancestors and picking the candidate with the most numbered files (there is a decoy `apps/api/database/migrations`).

Remaining for §5.3.2: the lifecycle write-back that emits `report_viewed` / `report_claimed` / `report_declined`.

**5.3.2 Add the lifecycle. — SHIPPED**

State machine on `directory_seed_outreach_touches.outcome`:

```text
report_delivered  (send side — exists)
      ↓ scan recorded
report_viewed     (qr_scan_events row mapped back)
      ↓ claim consumed
report_claimed    (claim token consumed)  |  report_declined (explicit not_interested)
```

- ✅ Outcomes added to the seed-touch taxonomy **and the outcome CHECK** (§5.3.1).
- ✅ `SeedReportDeliveryService.recordViewFromScan(seedId, channel)` — idempotent per (seed, canonical channel) `report_viewed` touch; called best-effort from both `seed-report-qr.ts` routes (seed-id + short-code) after the scan is recorded.
- ✅ `SeedReportDeliveryService.recordClaimed(seedId)` — idempotent `report_claimed` touch; called best-effort from both claim paths (`DirectoryClaimService.acceptClaim`, `approveClaimRequest`) next to the existing report refresh.
- ⬜ `report_declined` — the outcome is permitted by the CHECK but no producer writes it yet (would hook the explicit `not_interested` outcome).

### 5.4 Outreach artifact kind + checklist steps (G3, G4) — SHIPPED

- ✅ `OutreachArtifactKind` extended with `qr_kit` and `report_delivery`.
- ✅ `checkStepSatisfaction`:
  - `qr_kit` — satisfied by a `claim_qr_generated` touch on the campaign's linked seed (`resolveCampaignSeedId` helper).
  - `report_delivery` — satisfied by any of `report_delivered` / `report_viewed` / `report_claimed`.
- ✅ New permanent steps in `PlaybookChecklistService`: `_permanent_generate_claim_qr_kit` (stage `seed`, order 9) and `_permanent_deliver_report_qr` (stage `preview_built`, order 5). Seed wedge is now 10 steps; outreach-access is 4.
- ✅ `ClaimInviteQrKitService.recordClaimQrKitGenerated(seedId)` writes the idempotent `claim_qr_generated` touch from both artifact producers (PNG + postcard) — the satisfaction signal.
- ✅ `resolveStepDeepLink` returns the campaign overview for both QR kinds. **Deviation from §5.4.1:** the deep link resolver is synchronous, so the seed-detail `seed_qr_kit` target is not wired — both QR steps land on the campaign overview (seed link is one click away). Deferred.
- ⬜ Auto-complete: `onOutreachArtifactCreated` is not called for QR kinds (the steps are `isRequired: false` guidance); satisfaction still renders via `enrichStepViews`.
- ⬜ PG-01 preflight QR step — covered by §5.5.

#### 5.4.1 Deep-link targets

Add a target in `OutreachChecklistBridgeService.resolveInternalLinkUrl`:

- `seed_qr_kit` → the seed detail page's QR section (`/settings/admin/directory/presence-seeds/{seedId}`), resolved from the campaign's linked seed via `directory_seed_campaign_links`.

Reuse the existing `proving_ground_section` target for PG-scoped steps.

### 5.5 Playbook delivery artifacts (G1, G2) — PARTIALLY SHIPPED

- ✅ Migration `290_mkt_playbook_delivery_artifacts.sql` adds `mkt_playbook_catalog.delivery_artifacts` jsonb NOT NULL DEFAULT `'[]'` and seeds PG-01's declaration inline (the PG-01 seed script does not set the column, so a re-run will not clobber it):
  ```json
  [{"kind":"claim_qr","variants":["mail","walkin"]},{"kind":"report_qr","channels":["in_person","text"]}]
  ```
- ✅ PG-01 preflight gained step 13 "Generate claim-invite QR kits" (`seed-proving-ground-preflight.ts`), matching `PROVING_GROUND_CAMPAIGN_SPEC.md` §4.10 step 3; reconcile/enrich shifted to 14/15.
- ⬜ **Deferred:** the checklist builder does not yet materialize QR steps *from* `delivery_artifacts` — the QR steps are the fixed permanent steps from §5.4. The column is declarative until that lands.
- Apply: `psql $DATABASE_URL -f database/migrations/290_mkt_playbook_delivery_artifacts.sql` against `local` + `prd`, then `prisma db pull && pnpm prisma generate`, then re-run `seed-proving-ground-preflight.ts` against `local` + `prd`.

### 5.6 Content (G5, G8)

- **Pitch renderer:** add an optional CTA/QR block after the closer (before/with `My Contact`) carrying the tracked short URL and a "Scan to view your report" / "Scan to claim" line. Add the fields to `PitchRenderInput` (`ctaUrl`, `ctaLabel`) so legacy pitches render unchanged when absent.
- **Manual play templates:** add catalog entries:
  - `walkin_card_handoff` — fields referencing `{{qr_url_walkin}}` / `{{claim_short_url}}`; script body for an in-person leave-behind.
  - `report_qr_followup` — fields referencing `{{qr_url_report_text}}` / `{{report_url}}`; body for a post-call text/email with the tracked report link.
  - Update `whatsapp_availability_upsell`'s script to offer the report link/card as the delivery step.
- **Call scripts:** add walk-in-card language to `assembleForSeed`'s `claim_ask`/`close` ("I can leave a card with a code, or text you the link") and expose the QR URLs on `callContext` so the UI can render a copy button.

### 5.7 Analytics + funnel (G9) — SHIPPED

- ✅ Added `report_delivery_phone|email|social|in_person|text` to `QrSurfaceType` + `SURFACE_LABELS` in both `apps/api/src/services/QrAnalyticsService.ts` and `apps/web/src/services/QrAnalyticsService.ts` (the web mirror also gained the previously-missing `claim_invite_email`).
- ✅ Removed the `surface as any` casts in `seed-report-qr.ts` — `SURFACE_MAP` / `validSurfaces` are now typed `QrSurfaceType`.
- ✅ Added `reportScans` + `reportScanRate` + per-channel (phone/email/social/in_person/text) to `SeedFunnelAnalyticsService`, mirroring the `invite_scans*` block with `surface LIKE 'report_delivery_%'`; zero-state and web mirror (`DirectoryPresenceAdminService.ts`) updated; funnel admin page renders a report-scan panel.
- ✅ No DB migration required (no CHECK on `surface`).

### 5.8 Cadence automation (G11)

- Derive a QR outcome from the delivery lifecycle: `report_viewed` → scan-without-claim branch; no scan at due → advance rung or `hold`.
- Replace the manual mail-rung note in `ProvingGroundCadenceService` with the derived rule; add `OX_QR_SCANNED` / `OX_QR_NO_SCAN_AFTER_MAIL` to `outreach-state-extractor` for the triage/overview display.
- Keep the operator override (the rung may still be manually advanced).

---

## 6. Track B — Alternatives

| Option | Scope | Cost | Fixes |
|---|---|---|---|
| **B1 Copy-only** | §5.1 + updated instruction/template copy only | Lowest | G5 (partial), G6, G7 |
| **B2 Deep-link-only** | §5.1 + checklist `internal_link` steps that open the existing seed QR section | Low | G3 (partial) |
| **B3 Analytics-only** | §5.7 | Low | G9 |
| **B4 QR-as-deliverable** | Generate the kit at triage-accept and surface it as a deliverable row (like the Diagnostic Gallery) instead of a checklist step | Medium | G1–G3 (differently) |

B1 and B3 are self-contained and low-risk. B2 unblocks operator discovery without an artifact model. B4 avoids the checklist/bridge work by reusing the deliverable surface, but loses the cadence/funnel feedback unless §5.3 and §5.7 also land.

---

## 7. Non-goals

- No new claim mechanism — the report CTA and QR continue to use `directory_claim_tokens` + `DirectoryClaimService` (spec §13.5).
- No QR-encoded destination URLs (always the tracked redirect).
- No new CHECK constraint on `qr_scan_events.surface`.
- No changes to the report DTO, PDF layout, or the styled-QR designer.
- No fabrication of links — unresolved placeholders stay visible.
- No WhatsApp/QR convergence in this spec (the WhatsApp channel has its own CTA provenance rules).

---

## 8. Data + migration notes

- `mkt_playbook_catalog.delivery_artifacts` jsonb nullable default `[]` — additive, existing rows unaffected.
- **`directory_seed_outreach_touches` (G12 — migration `289_seed_outreach_touch_report_outcomes.sql` SHIPPED):**
  - `directory_seed_outreach_touches_outcome_check` — **re-added by 289** with 262's set + `report_delivered, report_viewed, report_claimed, report_declined, claim_qr_generated`.
  - `directory_seed_outreach_touches_channel_check` — unchanged (migration `273_seed_outreach_visit_channel.sql` L16–20): `call, email, sms, mail, form, referral, visit, other`. The report-delivery writer maps onto this set (`TOUCH_CHANNELS` in `SeedReportDeliveryService`) rather than extending it.
  - Both use the guarded `DO $$ ... IF to_regclass(...) $$` pattern from 262/273. `schema.prisma` is db-pulled and **does not** reflect CHECKs — the migration is the source of truth (AGENTS.md enum-sync rule, migrations 256/264/270).
  - **Apply runbook:** `psql $DATABASE_URL -f database/migrations/289_seed_outreach_touch_report_outcomes.sql` against `local` and `prd` (Doppler-provided URL). No Prisma regeneration needed (no column change).
  - Regression guard: constraint-parity tests in `apps/api/src/services/__tests__/SeedReportDeliveryService.test.ts` parse the effective CHECK sets from the migration files.
- Seed scripts: `seed-proving-ground-preflight.ts` must be re-run against `local` and `prd` after adding steps; bump its marker check per AGENTS.md.
- After any column addition: `pnpm prisma db pull && pnpm prisma generate` (or `pnpm prisma:generate`).

---

## 9. Verification

- `pnpm checkapi`, `pnpm checkweb`.
- **Constraint parity (G12 — shipped):** `SeedReportDeliveryService.test.ts` asserts every emitted touch channel is a member of the effective `..._channel_check` set and that `report_delivered` is a member of the effective `..._outcome_check` set, parsing both from `database/migrations/*.sql`. Plus per-channel mapping tests (`phone→call`, `text→sms`, `social→other`, `in_person→visit`, `email→email`).
- Unit: `outreach-link-vars.test.ts` (12) — kit-preferred `/place/claim`, token fallback, absent keys stay absent, no legacy `/directory/claim` in any value.
- Unit: `ManualOutreachScriptService` merge resolves the new keys (`ManualPlayTemplateAuthoring.test.ts`); `CallScriptService` exposes `qr_url_walkin` / report QR keys on `callContext`; generic `resolveMerge` still resolves the original 6 keys.
- Unit: `OutreachChecklistBridgeService` satisfies a `qr_kit` step from a generation touch and a `report_delivery` step from a `report_delivered` touch; auto-completes only when `auto_complete=true`.
- Unit: `SeedFunnelAnalyticsService` counts `report_delivery_*` scans and per-channel splits.
- Route: `GET /api/public/r/seed/:seedId/in_person` records a `report_delivery_in_person` scan and 302s to `/seed-report/{seedId}`; short-code `/r/{shortCode}` path records and redirects.
- Manual: operator sees the new checklist steps on a business-scope campaign and on PG-01; the call-script workspace shows a copyable walk-in QR link; the pitch renders the CTA block; the QR analytics admin dashboard labels report surfaces.
- Regression: existing claim-invite funnel counts (`invite_scans*`) unchanged; widget + WhatsApp pipeline tests stay green.

---

## 10. Open questions

1. ~~Is `/directory/claim/[token]` a live route or dead code?~~ **Resolved:** live client redirect to `/place/claim/[token]` — keep as a compatibility alias; G7 is a consistency cleanup, not a break.
2. Should `qr_kit` generation be recorded as a touch outcome (`claim_qr_generated`) or a dedicated `directory_seed_qr_artifacts` row? Touch is simpler and cadence-visible (and now needs an outcome-CHECK entry either way); a row is more queryable.
3. ~~Does `directory_seed_outreach_touches.outcome` carry a CHECK constraint?~~ **Resolved:** yes — see G12; the existing `report_delivered` write is rejected. Migration required before §5.3.
4. Should the report-delivery kit require a published report, or degrade to a claim-kit-only delivery when no report exists? (Current: `no_published_report` → 404.)
5. Cadence: on scan-without-claim at the mail rung, prefer a second postcard or advance? (Spec §4.7 leaves it to the operator today.)
6. `ProvingGroundCadenceService.TouchChannel` omits `visit` (added to the DB CHECK by migration 273 and to the app enums in `DirectoryPresenceSeedService` + the admin route zod) — sync it while touching the channel taxonomy.

---

## 11. Recommended sequencing

1. **G12 fix — extend the outcome CHECK + correct `recordDeliveryEvent`'s channel mapping + constraint-parity test. ✅ SHIPPED + applied** (migration `289_seed_outreach_touch_report_outcomes.sql` verified live in prod; `SeedReportDeliveryService.TOUCH_CHANNELS`; parity tests in `SeedReportDeliveryService.test.ts`).
2. **§5.1 merge fields + §5.2 claim-URL unification. ✅ SHIPPED** (`outreach-openers/outreach-link-vars.ts`; three legacy `/directory/claim` producers unified; 563 tests green).
3. **§5.7 analytics + funnel** — code-only, makes QR performance measurable.
4. **§5.3.2 delivery lifecycle** — the `report_viewed`/`claimed`/`declined` write-back (unblocked by step 1; the CHECK already admits the values).
5. **§5.4 artifact kind + steps** and **§5.5 playbook `delivery_artifacts`** — the structural wiring.
6. **§5.6 content** (pitch CTA, manual templates, call-script copy) and **§5.8 cadence automation**.
7. **§5.1 Construction Variables badge** — remaining sub-item (server-resolved vs operator-entered).

Steps 1–2 are the first PR (done). Step 3 is the next code-only increment; step 4 is the second structural PR. Step 6 is incremental content.
