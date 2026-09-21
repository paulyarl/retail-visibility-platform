# Physical Retail Playbook & Outreach Alignment — Sprint Plan

> **Companion Document:** `docs/LocalBiz/BRONZE_STANDARD_SPEC.md`, `docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md`, and `docs/LocalBiz/ONLINE_GROCERY_STOREFRONT_APP_SPEC.md`.  
> **Strategic Focus:** Unifying the platform's Marketing Ops engine around the **"Physical Store as Fulfillment Center"** thesis: making physical shelves visible to local searchers, driving walk-in foot traffic, and eliminating the 25%–30% delivery app marketplace tax.
>
> **Status:** Gap-analyzed against code + live DB (`nbwsiobosqawrugnqddo`) on 2026-09-21. Corrections from that pass are folded inline and summarized in the [Gap Register](#gap-register). **Not yet implemented.**

---

## Executive Summary & Core Strategic Insight

### 1. The Strategic Breakthrough: Inherited Fulfillment Freedom
Our audit of the quick-commerce and delivery ecosystem revealed a foundational economic truth:
- **Delivery apps (DoorDash, Uber Eats, Gopuff)** charge retailers a punitive 25%–30% commission because they must maintain complex driver fleets, dark stores, and cold-chain packaging.
- **Physical retailers already have fulfillment solved:** They pay rent on a storefront, electricity for refrigeration, and wages for staff. The customer walks through the door, picks up their items, and transports them home for free.
- **The Only Missing Link:** To Google, Apple Maps, and local search algorithms, **their physical shelves are completely invisible**. A search engine only sees a static pin labeled "Grocery Store" or "Retailer." It cannot index what is actually inside the store.

### 2. Marketing Ops Audit Findings
An audit of the live database (`nbwsiobosqawrugnqddo`), playbooks, prompt templates, and outreach scripts revealed three actionable misalignments:

1. **`PB-07` (Archetype A6) is Under-Framed in `mkt_playbook_catalog`:**
   Currently titled *"Product Visibility & Catalog Refresh"* ($199 FITD / $399 Retainer). It reads like an IT data-entry task rather than a foot-traffic and margin-protection engine. It must be reframed as **Physical Shelf Visibility & Counter Fulfillment**.
   *Verified live:* `code=PB-07`, `archetype=A6`, `archetype_label=A6_PRODUCT_VISIBILITY_GAP`, `category=triage_management`, `priority_rank=5`, `fitd_default_fee_cents=19900`, `retainer_fee_cents=39900`, `preview_deliverable_type=product_visibility_preview`, `is_active=true`.
2. **Missing High-Converting Manual Outreach Plays in `manual-play-templates.ts`:**
   The operator playground currently only contains 3 plays (`whatsapp_availability_upsell`, `walkin_card_handoff`, `report_qr_followup`). It lacks:
   - A dedicated **"Physical Shelf Visibility & 5 Free Slots"** play.
   - A dedicated **"Delivery App Margin Recapture"** play.
3. **`mpt-seed-fulfill-008` (Product Visibility Preview Deliverable):**
   The deliverable prompt instructs sections for catalog structure, GBP photos, and pickup/delivery, but does not explicitly direct the AI to frame the **physical store register as the fulfillment counter** (0% commissions, customer transports for free, basket expansion).
   *Gap G-4:* this is only one of **two** prompt surfaces that produce this deliverable. The section-level prompts that actually build the preview live in `apps/api/src/services/deliverable/prompts.ts` and are **not touched** by this plan as originally written. See Phase 4.
4. **The analyst's personalized hook never reaches the outreach lane:**
   The business-analysis audit already emits `alignment_scoring.primary_outreach_hook` (schema field at `business-analysis.schema.ts`; models fill it today — quality ranges from evidence-specific to generic filler), and the triage/per-issue briefings emit `pitch.opener_hook`. But **nothing carries any of them downstream** — `primary_outreach_hook` has zero consumers (dead data), and the Manual tab's `opener_text` field cannot see either. The operator rewrites the pitch by hand instead of reviewing the analyst's evidence-grounded line. Phase 2.3 closes this with an `{{analyst_hook}}` merge variable — dual-mode for free, since externally-imported audits land in `audit_data` identically.

### Dual-Mode Execution Note

Every prompt surface this plan touches is already dual-mode: the **same prompt body** feeds the internal AI lane (`MarketingExecutionService.executeSingle`) and the external lane (operator copies the resolved prompt to an external agent, pastes back through `MarketingPromptService.importExternalResult` / `POST /openers/import` / `importFollowUp` / `DeliverableSectionService.updateSection`). One edit propagates to both lanes — but until now nothing verified the external lane sees the new copy. Phase 5.11/5.12 make the round-trip explicit. The Manual plays are external-by-design (the operator *is* the executor); their personalization comes from merge-context injection, not AI generation.

---

## Decisions to Settle Before Implementation

| # | Question | Decision / Recommendation |
|---|---|---|
| **D1** | Should we create a new playbook code (e.g. `PB-09`) or sharpen `PB-07`? | **Sharpen `PB-07`.** `PB-07` is already mapped to Archetype `A6` (`A6_PRODUCT_VISIBILITY_GAP`) and wire-compatible with triage rules (`DS_MISSING_PRODUCT_CATALOG`, `WC_MISSING_PRODUCT_BROWSING`). Sharpening its title, description, and offer titles in-place preserves existing triage cascade ordering (priority rank 5). |
| **D2** | Should the new manual plays be code-defined or database-stored? | **Code-defined in `manual-play-templates.ts`.** Follows the exact pattern of the existing 3 plays (`MANUAL_PLAY_TEMPLATES`), requiring zero runtime DB queries, fully typed, and instantly available in the Manual outreach tab. |
| **D3** | How should the deliverable template be updated? | **Update `seed-deliverable-source-material-templates.ts` AND `services/deliverable/prompts.ts`.** The seed bumps `SEED_VERSION_MARKER`; the section prompts are edited in place. Both must ship. |
| **D4** | New `shelf_visibility` hook angle, or reuse `product_category_pages`? | **Reuse `product_category_pages` for the plays; treat a new `shelf_visibility` angle as optional Phase 3 work.** `product_category_pages` already carries `archetypes:['A6']` and is the A6 product-listing angle. Adding a 24th angle forces updates to a hard-coded count test (`hook-library.test.ts` asserts 23) and the stale web `HOOK_ANGLES` mirror. If the new angle is kept, the play's `hookAngle` must be `'shelf_visibility'`, not `'product_category_pages'` (the two are currently inconsistent — G-7). |
| **D5** | Are the checklist-step bodies that quote the old offer title in scope? | **Out of scope for this sprint, but recorded (G-11).** Migrations 174/175 hard-code "Monthly Product Visibility & Local Discovery Retainer" in `mkt_playbook_checklist_steps` copy. Renaming `retainer_pitch_title` leaves that copy stale; a follow-up migration (307) should re-word it. |
| **D6** | How does the analyst's observed gap reach the operator's opener without hand-copying? | **Emit upstream, carry via merge variable (Phase 2.3).** Add `{{analyst_hook}}` to `ManualOutreachScriptService.buildMergeContext` resolving triage `pitch.opener_hook` → per-issue `pitch.opener_hook` → audit `alignment_scoring.primary_outreach_hook`; default `shelf_visibility_claim`'s `opener_text` to `{{analyst_hook}}`. A dedicated `product_visibility` per-issue briefing (2.3d) is optional — `issueType` is `z.string()` and `repair_issue_type` is free varchar, so it needs no schema or CHECK-constraint work. |

---

## Phase 0 — Pre-flight & Verification

| # | Task | Target Files | Verification Notes |
|---|---|---|---|
| **0.1** | Verify database migration numbering | `database/migrations/` | **Confirmed:** highest committed migration is `305_mkt_pb08_preview_deliverable_type.sql`; `306` is free. The Supabase project records no conflicting migration. Use **`306_mkt_playbook_pb07_retail_alignment.sql`**. |
| **0.2** | Verify Archetype & Signal Taxonomy exports | `apps/api/src/services/triage/types.ts` | **Confirmed:** `PLAYBOOK_CODES` already includes `'PB-07'`; `ArchetypeCodeWithA6` includes `'A6'`; `ARCHETYPE_LABELS.A6 = 'A6_PRODUCT_VISIBILITY_GAP'`. **No code change is required here** — the PB-07 *title* lives only in the DB row, not in this file. (The original Phase 1.2 "ensure labels match" had no concrete target; removed.) |
| **0.3** | Confirm Doppler CLI access | Shell / Doppler | Ensure `doppler run --config local` and `--config prd` execute cleanly. |
| **0.4** | Verify the A6 signal codes used by the plays exist and are active | DB `mkt_signal_registry` | **Confirmed active:** `DS_MISSING_PRODUCT_CATALOG`, `WC_MISSING_PRODUCT_BROWSING`, `WC_MISSING_AVAILABILITY_INQUIRY`, `WC_MISSING_PICKUP_DELIVERY`. `WC_THIRD_PARTY_DOMAIN` is also active but is an **A7/PB-08** website signal — see G-8. |

---

## Phase 1 — Playbook Catalog Alignment (`PB-07` Modernization)

Update `PB-07` in `mkt_playbook_catalog` to reflect the physical retail shelf visibility breakthrough.

### 1.1 DDL Migration: `306_mkt_playbook_pb07_retail_alignment.sql`
```sql
-- Migration 306: Modernize PB-07 Playbook to Physical Shelf Visibility
-- Data-only UPDATE — no schema change, no `prisma db pull` required.
UPDATE mkt_playbook_catalog
SET 
  name = 'Physical Shelf Visibility & Counter Fulfillment',
  description = 'For independent physical retail stores and specialty markets whose shelves are invisible online. Delivers a 5-product shelf activation, mobile catalog preview, GBP photo optimization, and counter pickup workflow — driving in-store foot traffic with 0% marketplace commission.',
  fitd_offer_title = '5-Product Shelf Activation + GBP In-Stock Preview',
  retainer_pitch_title = 'Monthly Physical Shelf Visibility & Counter Discovery Retainer',
  updated_at = now()
WHERE code = 'PB-07';
```
- `category` deliberately stays `triage_management` (the app-layer `PLAYBOOK_CATEGORIES` union does not add a category). Do **not** add a new category value without also extending `PLAYBOOK_CATEGORIES` in `triage/types.ts`.
- `matching_rules` and `priority_rank` are unchanged — no cascade renumbering needed.
- Apply to `local` and `prd` in tandem (migration SOP). `psql $DATABASE_URL -f …` works, or `apply_migration` via the Supabase MCP.

### 1.2 Code Sync
- **No code change required.** `triage/types.ts` carries the *archetype* label (`A6_PRODUCT_VISIBILITY_GAP`), not the playbook title, and the archetype label is not being renamed. `MarketingPlaybookCatalogService` reads the row live.
- Test fixtures that hard-code the old name (`DeliverableSectionServiceSprint2.test.ts:164`, `ArchetypeResolverSprint2.test.ts:120`) use it as an opaque mock string and do not break; update opportunistically for clarity only.

---

## Phase 2 — New Manual Outreach Play Templates (`manual-play-templates.ts`)

Add two code-defined manual outreach play templates into `apps/api/src/services/outreach-openers/manual-play-templates.ts`.

> **Model constraint (G-4/G-5):** `ManualPlayTemplate` is `{ key, label, description, anchorType, hookAngle?, suggestedWhenSignal?, fields: ManualPlayField[], scriptBody }`. There is **no `targetArchetype` field** — archetype affinity is expressed only indirectly through `hookAngle` (which maps to `HOOK_LIBRARY[].archetypes`) and `suggestedWhenSignal`. Each play must ship a full `fields[]` slot list (mirroring the existing plays) plus a single `scriptBody`; the "Opener (Text/Email)" text belongs in a field with `role: 'opener'`.

### 2.1 Play 1: `shelf_visibility_claim` ("Physical Shelf Visibility & 5 Free Slots")
- **Key:** `'shelf_visibility_claim'`
- **Anchor Type:** `'customer_discovery_problem'` (valid `MANUAL_ANCHOR_TYPES` member)
- **Hook Angle:** `'product_category_pages'` (A6 affinity already). Use `'shelf_visibility'` **only** if Phase 3.1 is kept.
- **Suggested When Signal:** `'DS_MISSING_PRODUCT_CATALOG'` (single value — `suggestedWhenSignal` is a string, not an array)
- **Fields (`fields[]`):** `subject` (header), `opener_text` (opener), `closer_text` (closer), `operator_thesis` (thesis), `verification_question` (thesis), `pain_question` (thesis), `recommended_transition` (thesis), `observed_gap` (note), **`signature_item` (note)** — see G-6. `{{signature_item}}` is **not** a global merge key; it must be a declared field slot or it renders literally.
- **`opener_text` prefill (Phase 2.3b):** `defaultValue` opens with `{{analyst_hook}}` — the analyst's evidence-grounded hook lands in the opener slot automatically once a briefing/audit hook exists, and stays a visible placeholder when none does (never fabricated — same contract as `{{lead_platform}}`). The narrative below remains the fallback the operator edits into place.
- **Core Narrative:**
  - *Opener (Text/Email) → `opener_text`:*
    > *"{{salutation}} I was looking at {{category}} stores in {{city}} and noticed {{business}} has a verified address on Google, but no products listed online. When nearby shoppers search for specialty items like {{signature_item}}, Google sends them to Amazon or supermarket chains because your shelves are invisible online. We set up your store page with 5 free shelf slots so local searchers see what you have in stock and walk into your store to buy. I put together a quick preview for {{business}} — want me to send it over? — {{sender_name}}"*
  - *Spoken Script (Call / Walk-In) → `scriptBody`:*
    > *"Hi, are you the owner or manager of {{business}}? I work with local {{category}} retailers in {{city}}. We ran a visibility scan on {{business}} and noticed something specific: Google knows your building, but it has no idea what's on your shelves. When someone nearby searches for items you actually carry, they get sent to a big-box chain. We set up your listing with 5 free product slots so shoppers see your stock and walk through your door. Can I text or email you the preview?"*

### 2.2 Play 2: `delivery_app_margin_recapture` ("Delivery App Margin Recapture")
- **Key:** `'delivery_app_margin_recapture'`
- **Anchor Type:** `'customer_discovery_problem'`
- **Hook Angle:** `'availability_inquiry'` (A6/A4 affinity)
- **Suggested When Signal:** `'WC_MISSING_PICKUP_DELIVERY'` **or** `'WC_MISSING_AVAILABILITY_INQUIRY'` — **pick one** (string field). **Do not use `WC_THIRD_PARTY_DOMAIN`** — that is an A7/PB-08 website signal and would mark the play "suggested" on campaigns routed to A7, not A6 (G-8).
- **Fields (`fields[]`):** same slot set as Play 1 (subject, opener_text, closer_text, operator_thesis, verification_question, pain_question, recommended_transition, observed_gap, note).
- **Core Narrative:**
  - *Opener (Text/Email):*
    > *"{{salutation}} Love what you've built at {{business}} in {{city}}. I noticed you're active on delivery apps, which means you're giving up 20% to 30% of your basket on every order. For a physical shop, your store is already the fulfillment hub — customers would gladly pick up at your counter if they had a 1-click mobile menu. We set up your private ordering app with 0% commission so you keep 100% of your retail margin. Here's a preview of how your counter pickup app looks: {{report_url}}. Want to chat for 2 minutes? — {{sender_name}}"*
  - *Spoken Script (Call / Walk-In):*
    > *"Hi, is this {{business}}? Quick question for the owner: on a typical $60 grocery basket ordered through DoorDash, you lose $15 to $18 in commission fees. Your physical store already has the stock and staff — why pay a delivery fleet for local customers who can pick up at your counter? We build direct mobile ordering apps for local retailers with zero commission cuts. I have a preview of your store menu ready — what's the best email or cell to send it to?"*

> **Quality-gate hazard (G-12):** the spoken script contains literal dollar amounts (`$60`, `$15 to $18`). The outreach quality gate's `FORBIDDEN_PATTERNS` reject `$[\d,]+` ("pricing ($ amount)") for **all** archetypes, and A6 additionally rejects review/booking vocabulary. If these plays are promoted into the pitch pipeline via `POST /openers/import`, either (a) keep the `$` figures only in the operator-spoken `scriptBody` (not promoted as an opener), or (b) reword to "20–30% of every basket" without dollar signs. Decide before authoring.

### 2.3 Analyst `opener_hook` Handoff — Evidence → Personalized Opener (D6)

**The gap:** upstream artifacts already emit personalized hooks, but nothing carries them into the Manual tab — the operator rewrites the pitch from memory. This phase closes the loop so the gap the analyst observed during the scan **becomes the play's opener** without re-authoring.

Existing emission points — all dual-mode (internal run and `importExternalResult` paste produce identical persisted shapes):

| Source | Field | Status today |
|---|---|---|
| Business-analysis audit | `audit_data.alignment_scoring.primary_outreach_hook` | Emitted, **zero consumers** — dead data (G-17); quality unconstrained (ranges from evidence-specific to filler) |
| Triage briefing | `repair_triage_briefing.pitch.opener_hook` (campaign JSONB, migration 232) | Emitted; promoted only via "Create Opener from Hook" → `createFromBriefing` |
| Per-issue briefings | `pitch.opener_hook` + `outreach_problems[].hook` | Emitted for `nap_drift` / `unclaimed_profile` / `platform_gap` — **no product-visibility issue exists** |

#### 2.3a `{{analyst_hook}}` merge variable — `ManualOutreachScriptService.buildMergeContext`
Add a best-effort resolution block (mirrors the `{{lead_platform}}` pattern — try/catch, unresolved leaves a visible placeholder):
1. `campaign.repair_triage_briefing.pitch.opener_hook` (accepted triage pitch)
2. Latest `profile_repair_audit` seek execution's `pitch.opener_hook`
3. Latest business-analysis audit's `audit_data.alignment_scoring.primary_outreach_hook`
4. Unresolved → `{{analyst_hook}}` stays visible (never fabricated)

Surfaces automatically in `GET /:campaignId/manual-script-merge-context` (the Construction Variables panel), so the operator can *see* what the analyst wrote before using it.

#### 2.3b Play wiring — `shelf_visibility_claim`
`opener_text` field `defaultValue` opens with `{{analyst_hook}}` (see Phase 2.1). The placeholder stores literally in `mkt_campaign_manual_scripts.fields` and resolves at read time (`toView` → `resolveMerge`), so a doc created before the briefing exists **self-heals** once a hook lands. `ManualScriptPanel.promoteOpener` already ships `resolved_fields.opener_text` to `importOpener` — the promoted opener carries the analyst's words and passes through `runQualityGate` like any external import. **Zero frontend change required.**

#### 2.3c Hook-quality directive — `seed-business-audit-v2-templates.ts`
`primary_outreach_hook` is emitted but unconstrained — observed live outputs range from evidence-specific to generic filler (*"General local marketing & reputation management baseline audit"*). Add an `OPENER_HOOK_DIRECTIVE` to both V2 variants:
- 1–2 sentences, specific to THIS business: name the observed platform + the concrete gap + a signature item/category evidence — e.g. *"When customers search for berbere and injera near {city}, Google sends them to the chain across town — your shelves are invisible."*
- For physical-retail categories with product-visibility gaps, lead with the shelf/blind-spot framing: store as fulfillment center, counter pickup, 5 free shelf slots.
- No `$` amounts, tier/package names, or jargon — `FORBIDDEN_PATTERNS` rejects them on downstream promotion.
- **Seed-discipline caution (AGENTS.md):** the two V2 variants use different formats; guard the `insertAfter` anchor (`if (out.includes(anchor))`) or use a format-aware helper; bump the marker.
- **Cheap complement:** one paragraph in `seed-profile-repair-triage-briefing.ts` — when product-visibility signals dominate, `pitch.opener_hook` leads with the shelf-visibility gap (the Bronze attribution block is already injected there).

#### 2.3d (OPTIONAL) Dedicated `product_visibility` per-issue briefing — `seed-profile-repair-issue-briefings.ts`
Add a 4th `TEMPLATES` entry `mpt-profile-repair-shelf-visibility-seek`, `issueType: 'product_visibility'`, same `profile_repair_audit` output shape — emits `pitch.opener_hook` + `outreach_problems[]` bound to shelf/discovery gaps.
- Cheap because: `issueType` is `z.string()` in `profile-repair-output.schema.ts` (no schema change); `repair_issue_type` is free varchar (no CHECK constraint).
- Requires: `PROFILE_REPAIR_SHELF_VISIBILITY_TEMPLATE_ID` const + a `resolveSeekTemplateId` case in `ProfileRepairPromptService.ts`, and the option in the `repair_issue_type` select in `CampaignFormClient.tsx`.
- Dual-mode free: external analysts import through `importExternalResult` under the same `profile_repair_audit` schema.

**Deferred (record, don't build):** a per-prospect `suggested_hook` on the Bronze discovery scan itself. Bronze output feeds prospect seeding; the campaign-level hooks above fire at seek stage where the audit evidence exists. Revisit if operators want the hook visible on the prospect-queue card.

---

## Phase 3 — Hook Library & Archetype Prompt Alignment

### 3.1 Hook Library (`apps/api/src/services/outreach-openers/hook-library.ts`) — **OPTIONAL (see D4)**

If a dedicated angle is kept:
- Add `'shelf_visibility'` to the `HookAngle` union **and** a full `HookTemplate` entry. The entry requires: `label`, `archetypes: ['A6']`, `signals[]` (e.g. `['DS_MISSING_PRODUCT_CATALOG','WC_MISSING_PRODUCT_BROWSING']`), `subject`, `body`, `shape` (5 beats), and `phone_hook`. The 5-beat anatomy alone is **not** sufficient.
  - *Score Hook:* Nowhere online that lists what is physically on your shelves.
  - *Reassurance:* That's the norm for independent shops, so you're not behind.
  - *Quantified Upside:* Shoppers searching for specific items walk into your store instead of ordering online.
  - *Audit Offer:* 5 free shelf slots activated on your claimed directory listing.
  - *Soft CTA:* Want me to show you a preview?
- **Test update required (G-2):** `apps/api/src/services/__tests__/hook-library.test.ts` asserts `HOOK_LIBRARY` has **exactly 23 entries** and `HOOK_ANGLE_KEYS` length 23 (and "`zero_footprint` is the 13th angle"). Bump to 24.
- **Web mirror update required (G-3):** `apps/web/src/services/MarketingOpsService.ts` duplicates the `HookAngle` union and a runtime `HOOK_ANGLES` array used by the Save-as-template modal / call-script select. That mirror is already stale (15 of 23 angles). Add `shelf_visibility` there too, or the new angle is unselectable in the UI.
- Note the overlap with the existing `product_category_pages` angle (A6, product-listing) — if the copy is near-identical, prefer reuse and skip 3.1 entirely.

### 3.2 Archetype Prompt: `A6_PROMPT` (`apps/api/src/services/outreach-openers/archetype-prompts.ts`)
- Update `PRODUCT_VISIBILITY_PREAMBLE` and hook options in `A6_PROMPT`:
  - Weave in the **in-store counter pickup** and **free 5-slot activation** options into the hook selections.
  - Ensure the AI never frames the solution as distant parcel shipping.
  - **Align the preview line with the offer (G-16):** `A6_PROMPT` currently mandates *"Three previews attached — the mobile catalog mockup, the GBP photo optimization, and the availability-inquiry flow."* If the FITD offer becomes "5-Product Shelf Activation + GBP In-Stock Preview", reconcile this line so the opener's promise matches `preview_deliverable_type = product_visibility_preview`.

### 3.3 Propagate the framing to the rest of the A6 surface (G-16)
The plan originally stopped at the opener. The same "counter fulfillment / 0% commission" framing should propagate to these co-owned A6 surfaces or the campaign reads inconsistently:
- `apps/api/src/services/outreach-pitch/prompts.ts` — A6 persona preamble, header, closer, and `PRODUCT_VISIBILITY_FIX_PROMPT`.
- `apps/api/src/services/outreach-followups/followup-prompts.ts` — `DOING_TEMPLATE_A6` / telling template.
- `apps/api/src/services/outreach-pitch/quality-gates.ts` — `ARCHETYPE_KEYWORDS.A6.itch` regex set (add "counter"/"pickup" vocabulary if the pitch leans on it; keep reviews/booking in `offTopic`).

---

## Phase 4 — Deliverable Prompt Template Update

> **Corrected (G-1/G-4):** the "Product Visibility Preview" is produced by **two** prompt surfaces. Both must be updated; the section names in the original plan (`pickup_delivery_pathway`, `mobile_catalog_structure`) **do not exist anywhere in the codebase**.

### 4.1 Section-level prompts — `apps/api/src/services/deliverable/prompts.ts` **(primary target)**
The A6 preview is generated section-by-section by `DeliverableSectionService.generateAllSections` (`archetype === 'A6'` → `['mobile_catalog_preview','gbp_photo_optimization','availability_inquiry_flow','fulfillment_pathway','hours_sync_plan']`). The two sections this sprint cares about:
- **`fulfillment_pathway`** → `FULFILLMENT_PATHWAY_PROMPT` (via `buildFulfillmentPathwayPrompt`):
  > *"Frame the physical retail counter as the primary fulfillment center. Emphasize that in-store counter pickup costs the retailer $0.00 in delivery logistics, avoids the 30% delivery app commission, and drives 2–3 additional impulse items per customer visit."*
- **`mobile_catalog_preview`** → `MOBILE_CATALOG_PROMPT` (via `buildMobileCatalogPrompt`):
  > *"Structure the first 5 product slots around high-velocity signature items and specialty goods that customers frequently call to verify in stock."*

### 4.2 Source-material prompt — `mpt-seed-fulfill-008` (`seed-deliverable-source-material-templates.ts`) **(secondary target)**
- Edit the `FULFILL_008` constant body (the section list is prose: "mobile catalog structure, GBP photo shot list + captions, availability-inquiry flow, pickup/delivery pathway, and an hours/holiday-hours sync plan") to add the counter-fulfillment framing.
- Bump `SEED_VERSION_MARKER` (currently `<!-- DELIVERABLE_SOURCE_MATERIAL_SEED_V5 -->`) to `V6`.
- **Note:** the seed performs an **unconditional update-in-place** of every template (no marker comparison), so the bump is documentation, not a functional gate. No fingerprint/`insertAfter` risk here — the whole body is written.

### 4.3 Seed Script Re-run Discipline
- Re-run against both `local` and `prd` Doppler configs (Phase 5).
- Verify live `mpt-seed-fulfill-008.updated_at` is newer than the seed file's commit (regenerate `docs/api-response/seek-prompt-templates.md` if that dump is the review surface).

---

## Phase 5 — Verification, Tests & Database Sync

| # | Step | Command | Success Criteria |
|---|---|---|---|
| **5.1** | Apply Migration 306 | `psql $DATABASE_URL -f database/migrations/306_mkt_playbook_pb07_retail_alignment.sql` | `mkt_playbook_catalog` updated for PB-07 (data-only; no `prisma db pull`/`generate`) |
| **5.2** | Run opener/hook tests | `cd apps/api && npx vitest run src/services/outreach-openers/__tests__/` | All pass |
| **5.3** | Run hook-library test | `cd apps/api && npx vitest run src/services/__tests__/hook-library.test.ts` | Passes — **update the hard-coded `23` counts to `24` if Phase 3.1 is kept** (G-2) |
| **5.4** | Run manual-play test | `cd apps/api && npx vitest run src/services/__tests__/ManualPlayTemplateAuthoring.test.ts` | Passes (new catalog plays must satisfy `anchor_type`/`hook_angle` validation) |
| **5.5** | Run Triage tests | `cd apps/api && npx vitest run src/services/triage/__tests__/TriageEngineService.test.ts` | PB-07 triage matching passes. **Corrected path** — the file is under `services/triage/__tests__/`, not `services/__tests__/` (G-10) |
| **5.6** | TypeScript Check API | `pnpm checkapi` | Zero errors (`tsc --noEmit`) |
| **5.7** | TypeScript Check Web | `pnpm checkweb` | Zero errors — **fails if the web `HookAngle`/`HOOK_ANGLES` mirror drifts** (G-3) |
| **5.8** | Re-run Deliverable Seed (local) | `doppler run --config local -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts` | `mpt-seed-fulfill-008` updated in DB |
| **5.9** | Repeat Seed for Prod | `doppler run --config prd -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts` | Production DB synchronized |
| **5.10** | Re-run briefing seeds (local + prd) | `doppler run --config <cfg> -- npx tsx src/scripts/seed-business-audit-v2-templates.ts` (+ `seed-profile-repair-triage-briefing.ts` / `seed-profile-repair-issue-briefings.ts` if 2.3c/2.3d kept) | `OPENER_HOOK_DIRECTIVE` marker present; new briefing template row exists if 2.3d kept |
| **5.11** | External-lane render check | Prompt Workspace: resolve the A6 opener prompt, `mpt-seed-fulfill-008`, and a `fulfillment_pathway`/`mobile_catalog_preview` section prompt | The text an operator copies to an external agent carries the new counter-pickup / 5-slot framing — the shared prompt body is the single source for both lanes (G-18) |
| **5.12** | External round-trip smoke test | (a) Paste an externally-written A6 opener through `POST /openers/import`; (b) import an external `profile_repair_audit`/business-analysis payload via `importExternalResult`; (c) open the Manual tab on that campaign | `source='external'` stamped; quality-gate issues surface (incl. `$` rejection — G-12); imported `primary_outreach_hook`/`pitch.opener_hook` resolves into `{{analyst_hook}}` in `shelf_visibility_claim`'s `opener_text` (G-18) |

---

## Gap Register

Findings from the 2026-09-21 gap-analysis pass (code + live DB), each now folded into the phases above.

| ID | Severity | Gap | Resolution |
|---|---|---|---|
| **G-1** | **High** | Phase 4 named deliverable sections `pickup_delivery_pathway` / `mobile_catalog_structure` — neither string exists. Real section keys are `fulfillment_pathway` / `mobile_catalog_preview`. | Phase 4.1 rewritten with real keys. |
| **G-4** | **High** | Plan patched only `mpt-seed-fulfill-008`, but the section content is generated by `services/deliverable/prompts.ts` (`FULFILLMENT_PATHWAY_PROMPT`, `MOBILE_CATALOG_PROMPT`) — untouched. | Phase 4 now targets both surfaces; `prompts.ts` added to appendix. |
| **G-5** | **High** | New manual plays specified only narrative — missing the required `fields[]` slot list and `scriptBody` mapping. | Phase 2 adds explicit field sets. |
| **G-2** | **High** | `hook-library.test.ts` hard-asserts `HOOK_LIBRARY.length === 23`. A 24th angle breaks it; plan didn't mention tests. | Phase 3.1 + Phase 5.3. |
| **G-3** | **Med** | `apps/web/src/services/MarketingOpsService.ts` duplicates `HookAngle` + `HOOK_ANGLES` (already stale). New angle unselectable in UI without a mirror update. | Phase 3.1 + Phase 5.7. |
| **G-7** | **Med** | Internal inconsistency: Phase 2.1 sets play1 `hookAngle = 'product_category_pages'` while Phase 3.1 adds `'shelf_visibility'`. | Resolved via **D4** (reuse `product_category_pages`; new angle optional). |
| **G-8** | **Med** | `delivery_app_margin_recapture` (A6) suggested `WC_THIRD_PARTY_DOMAIN`, an A7/PB-08 signal → would surface on A7 campaigns. | Phase 2.2 restricts to A6-owned signals. |
| **G-6** | **Med** | Play 1 used `{{signature_item}}`, which is not a documented merge key → would render literally. | Phase 2.1 declares it as a `note` field slot. |
| **G-9** | **Med** | Phase 3.1 specified only the 5-beat `shape`; `HookTemplate` also requires `label`, `archetypes`, `signals`, `subject`, `body`, `phone_hook`. | Phase 3.1 enumerates the full shape. |
| **G-10** | **Low** | Phase 5 test path `src/services/__tests__/TriageEngineService.test.ts` is wrong. | Corrected to `src/services/triage/__tests__/`. |
| **G-11** | **Low** | Renaming `retainer_pitch_title` leaves stale copy in migrations 174/175 checklist steps. | Recorded as **D5**; follow-up migration 307. |
| **G-12** | **Med** | Play 2 spoken copy contains `$` amounts; quality gate `FORBIDDEN_PATTERNS` rejects `$[\d,]+` for all archetypes. | Flagged in Phase 2.2; decide before authoring. |
| **G-13** | **Low** | Original Phase 1.2 "ensure labels match in `triage/types.ts`" had no target — the PB-07 title is DB-only. | Phase 1.2 rewritten to "no code change". |
| **G-16** | **Med** | "Counter fulfillment" framing not propagated to A6 pitch/header/closer/follow-up prompts or the `A6_PROMPT` preview line; `preview_deliverable_type` still says "Product Visibility". | Phase 3.2/3.3. |
| **G-14** | **Info** | `mkt_prompt_templates_list` is the real table (plan implied otherwise); `mpt-seed-fulfill-008` is live with `V5` marker. | Phase 4.2 note. |
| **G-15** | **Info** | `SEED_VERSION_MARKER` bump is cosmetic — the seed upserts unconditionally. | Phase 4.2 note. |
| **G-17** | **Med** | `alignment_scoring.primary_outreach_hook` is emitted by every business-analysis audit but has **no consumer** — dead data; observed live outputs range from evidence-specific to generic filler, and no directive constrains it. | Phase 2.3a (merge-var fallback) + 2.3c (hook-quality directive). |
| **G-18** | **Med** | Dual-mode propagation was assumed, not verified: the external lane reads the same prompt bodies, but no step covered the render → paste → import round-trip, and no step confirmed an imported hook reaches the Manual tab. | Phase 5.11/5.12. |

---

## Appendix: Summary of Impacted Files

```
database/migrations/
  └── 306_mkt_playbook_pb07_retail_alignment.sql (New)

apps/api/src/
  ├── services/
  │   ├── outreach-openers/
  │   │   ├── manual-play-templates.ts (Add shelf_visibility_claim & delivery_app_margin_recapture;
  │   │   │                            opener_text defaultValue opens with {{analyst_hook}} — 2.3b)
  │   │   ├── hook-library.ts (OPTIONAL — add shelf_visibility angle)
  │   │   └── archetype-prompts.ts (A6_PROMPT: counter fulfillment, 5 free slots, preview-line alignment)
  │   ├── ManualOutreachScriptService.ts (buildMergeContext: {{analyst_hook}} resolution)  ← ADDED (2.3a)
  │   ├── ProfileRepairPromptService.ts (template const + resolveSeekTemplateId case)      ← ADDED (2.3d, optional)
  │   ├── deliverable/
  │   │   └── prompts.ts (FULFILLMENT_PATHWAY_PROMPT + MOBILE_CATALOG_PROMPT)   ← ADDED (G-4)
  │   ├── outreach-pitch/
  │   │   ├── prompts.ts (A6 persona/header/closer + PRODUCT_VISIBILITY_FIX_PROMPT)  ← ADDED (G-16)
  │   │   └── quality-gates.ts (A6 itch keyword set)                                 ← ADDED (G-16)
  │   └── outreach-followups/
  │       └── followup-prompts.ts (A6 doing/telling templates)                       ← ADDED (G-16)
  └── scripts/
      ├── seed-deliverable-source-material-templates.ts (FULFILL_008 body + SEED_VERSION_MARKER V6)
      ├── seed-business-audit-v2-templates.ts (OPENER_HOOK_DIRECTIVE + marker bump — 2.3c)  ← ADDED
      ├── seed-profile-repair-triage-briefing.ts (A6 shelf clause — 2.3c, optional)         ← ADDED
      └── seed-profile-repair-issue-briefings.ts (mpt-profile-repair-shelf-visibility-seek) ← ADDED (2.3d, optional)

apps/web/src/
  ├── app/(platform)/settings/admin/marketing-ops/campaigns/
  │   └── CampaignFormClient.tsx (repair_issue_type option — 2.3d only)                     ← ADDED
  └── services/
      └── MarketingOpsService.ts (HookAngle union + HOOK_ANGLES mirror)              ← ADDED (G-3, only if Phase 3.1)

apps/api/src/services/__tests__/
  └── hook-library.test.ts (23 → 24 if Phase 3.1)                                    ← ADDED (G-2)
```
