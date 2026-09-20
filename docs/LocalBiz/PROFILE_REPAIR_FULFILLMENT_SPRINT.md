# Profile Repair — Fulfillment & Client Intake Sprint

**Status:** Draft for implementation
**Spec covered:** `docs/LocalBiz/PROFILE_REPAIR_PRODUCT_SPEC.md` §5–§7, §10.1, §10.2, §10.5–§10.10
**Sprint goal:** Make the Track A Profile Repair package sellable and fulfillable end-to-end by reusing the existing intake registry, playbook checklist, seed/claim, and deliverable modules rather than building parallel plumbing.

**Product model:** DIY and DFY are two fulfillment *modes* of the same product, not two products. One pipeline produces one artifact — the Citation & Repair Package — and one goal: verified, corrected, claimed external profiles. `repair_fulfillment.mode` only selects **who executes the fix sheet** (customer vs operator), whether delegated access is needed, and the SLA. Everything downstream — per-platform verification, completion report, retainer pitch — is shared.

---

## 1. What this sprint does NOT build

No new tables for intake, no new form renderer, no new execution-tracking table, no new claim flow. Everything below is a column, a definition row, an adapter, a checklist-step seed, or a wiring change on existing modules.

Deferred to a later sprint (called out so nobody reads silence as oversight):

- §10.11 Platform SOP module (operator reference docs per platform)
- §10.12 Retainer automation (`mkt_retainer_activities`, monthly drift scan, `/account/marketing/retainer`)
- Customer-facing tier/mode picker on the pay page (this sprint records tier/mode operator-side; the pay page only displays it)

---

## 2. Reuse map — existing modules → sprint use

| Existing module | Reused for |
|---|---|
| `mkt_intake_definitions` registry + `IntakeFormRenderer` (`/recovery/intake`) | The DFY access + evidence intake — a **definition row**, not a page |
| `submitted_stage` transition + `REVIEW_TRANSITIONS` | New stage `repair_access_submitted` (mirrors `gbp_intake_submitted`) |
| Write-behind adapters (`writeBehindAdapters.ts`) | Two new whitelisted adapters; `evidence_payload` stays source of truth |
| `directory_provenance_write` tenant pattern | Owner-confirmed canonical NAP → `directory_field_provenance` on the linked seed |
| `directory_seed_campaign_links` (tenant_id on link row, `link_role`, `nap_match_*`) | Ownership bridge: seed ↔ repair campaign ↔ tenant |
| Short-code pattern (migrations 183/278: gallery `/g/`, claim `/c/`) | Tracked short URLs for intake links — `mkt_dispute_intake.short_code` + `/i/{code}` |
| `qr_scan_events` + `trackQrScanEvent` (surface is unconstrained `VARCHAR(30)`) | Link-open tracking + channel attribution (`intake_link_sms`/`_email`/`_qr`) |
| `outreach-link-vars.ts` (`buildOutreachLinkVars`) | `{{intake_short_url}}` merge var for opener/pitch templates — per AGENTS.md, never hand-build URLs |
| `DirectoryClaimService.acceptClaim` | Ownership propagation event — claim updates linked campaigns |
| `mkt_playbook_checklist_steps` + `mkt_campaign_checklist_progress` | DFY execution workflow steps (PB-01, `stage_tag='delivered'`) |
| `mkt_prompt_executions_list` (latest `profile_repair_audit` execution) | `seek_briefing` variable for the fulfill prompt |
| `fulfill_target` gold-standard injection (`MarketingExecutionService.resolvePrompt`) | Third fulfill input — already shipped, no plumbing needed |
| `seed-deliverable-layout-templates.ts` | `citation_repair_package` layout row |
| `mkt_dispute_attachments` + `disputes` storage bucket | Evidence uploads (screenshots, utility bill, storefront photos) |
| Sibling campaigns (`business_prospect_id`, `is_primary_sibling`, audit inheritance) | Per-platform escalation — a platform needing Track B spawns an escalated sibling, not a new package |
| Track B import→deliverable block (`ProfileRepairPromptService.importExternalResult` :839) | Mirror for `citation_repair_package`: fulfill import → deliverable + section rows |
| `generateDeliverable` + `extractContentFromExecution` + admin `download`/`send` routes | DIY package PDF render + operator review/send |
| Customer portal projection (`MarketingCustomerProjection`) + `/account/marketing/campaigns/:id` | Customer-facing deliverable download (fixes `file_url`→`storage_path` projection bug) |

---

## 3. The cohesive journey (what "done" looks like)

### 3a. DFY, prospect has an unclaimed seed

1. Operator finds the business via the unclaimed-seed pipeline → `createCampaignFromSeed` (exists) creates the campaign + `primary` link row stamped with the seed's `tenant_id`.
2. Triage → PB-01 → seek runs → customer pays (`paid`) → fulfill runs → `delivered` with the Citation & Repair Package.
3. On entering `delivered`, the auto-gen hook sees the `profile_repair_access` definition (trigger stage `delivered`, `service_category='profile_repair_package'`, `trigger_guard` mode=`dfy`) and mints the tokenized intake link **plus a 6-char short code**. Operator shares `visibleshelf.com/i/{code}` by SMS/email — the channel is baked into the link (`?surface=`) so the open is attributable.
4. Customer taps the short URL → tracked resolve (`qr_scan_events` row, intake `viewed_at`/`viewed_count` stamped) → lands on `/recovery/intake?token=…` → confirms canonical NAP, marks per-platform delegated access (GBP manager invite sent, Facebook editor added, Yelp claimed, …), uploads evidence, acknowledges the no-passwords clause → submits.
5. Campaign transitions `delivered → repair_access_submitted`. Adapters fire:
   - `repair_fulfillment_write` → stamps `access_collected_at`, computes `sla_due_at`, initializes `platform_status` per the customer's answers.
   - `repair_canonical_nap_write` → stores `canonical_nap` + writes `directory_field_provenance` rows (`source_name='owner_intake'`, confidence `high`) onto the seed — the unclaimed listing gets owner-confirmed NAP for free.
6. Operator executes platform corrections; the Execution card tracks per-platform status; the PB-01 delivered-tagged checklist steps gate the workflow. SLA badge counts down from `sla_due_at`.
7. All platforms verified → completion report assembled → `retainer_pitched`.

### 3b. The claim closes the loop

At any point in 3a, the prospect may claim their seed listing (existing token/OTP flow). On `acceptClaim` success, the new propagation step updates every linked campaign:

- `campaign.tenant_id = link.tenant_id` (fill only when NULL)
- `campaign.customer_id` = the claiming customer (resolved via `directory_customers.claimed_user_id`)
- `repair_fulfillment.seed_claimed = true`, `claimed_at`
- Open (unsubmitted) `mkt_dispute_intake` rows for those campaigns get `tenant_id` refreshed so submit-time adapters have tenant context.

The claim is the ownership-verification event: it tells the repair campaign "the person granting access is the verified owner," and it makes the external-profile corrections land on a listing the customer now owns.

### 3c. Campaign first, seed discovered later

`createCampaignFromSeed` covers seed→campaign. The reverse — a repair campaign that later matches a seed — gets a suggestion path: `GET …/campaigns/:id/seed-link-suggestions` runs the existing NAP-match computation against `directory_presence_seeds` and returns ranked candidates; the operator confirms via the existing `linkCampaign` endpoint. No auto-linking — a wrong tenant bond is worse than none.

### 3d. No seed at all

Everything still works: intake collects access + evidence, adapters degrade to payload-only (their existing contract), execution tracking and SLA run off `repair_fulfillment`. The provenance writes just no-op.

### 3e. The shared production loop (both modes)

The Citation & Repair Package is produced identically regardless of mode:

1. `paid` → PB-01 checklist prompts the operator to run the citation-package fulfill prompt (Prompt Workspace renders it with audit + `seek_briefing` + gold standard injected) → external analyst → paste → `importExternalResult` schema-validates and, on the new fulfill branch, creates the `citation_repair_package` deliverable + `deliverable_text`/`submission_guide` section rows.
2. Operator clicks Generate Deliverable → picks the fulfill execution → jsPDF renders the structured content through the `citation_repair_package` layout → reviews → `POST /deliverables/:id/send` marks it delivered.
3. The customer sees it in the portal (`/account/marketing/campaigns/:id`) with a working Download button — after the `file_url`→`storage_path` projection fix.

**Where the modes diverge — and reconverge:**

- **DIY:** the package *is* the deliverable — the customer works the fix sheet themselves. No access intake (`trigger_guard` blocks it). `platform_status` initializes `customer_pending`; the operator spot-verifies at follow-up, and the completion report summarizes verified state + remaining customer actions — that report is itself the retainer pitch ("here's what's still outstanding").
- **DFY:** the same package is the operator's internal fix-sheet. The access intake collects delegated access, the SLA clock runs, the operator works the platforms, and the completion report documents operator-executed + verified changes.
- **Convergence:** both end at the same `platform_status` grid, the same completion-report artifact, and the same `delivered → retainer_pitched` transition. A DFY platform the customer `cannot_grant` simply falls back to the package's DIY section for that platform — same goal, customer executes that row.

### 3f. The escalation boundary — sibling campaigns, not package splits

Per-platform repair stays **inside** the campaign — the package is a bundled sale and `platform_status` already tracks per-platform state. Splitting per-platform would fragment pricing, SLA, intake, and reporting for no benefit.

The exception is a platform whose problem crosses out of Track A scope — suspension, hijack, ownership dispute, verification block. That platform **spawns an escalated sibling campaign** via the existing `POST /:campaignId/siblings` endpoint (`BusinessProspectService.createSiblingCampaign` already accepts `campaign_category`, `repair_track`, `repair_issue_type`):

- Same `business_prospect_id` group, `is_primary_sibling=false` — the sibling **inherits the parent's audit** (no re-diagnosis; the audit-inheritance read path already exists at `MarketingCampaignService.ts:1508`).
- Sibling runs `profile_repair` + `repair_track='escalated'` → `RECOVERY_TRANSITIONS` — which is exactly the pipeline the existing Track-B `profile_repair` intake kind and `mpt-profile-repair-resolution-default` prompt were built for.
- On the parent campaign: `platform_status[platform] = {status:'escalated', escalated_campaign_id}` — the repair campaign continues on the remaining platforms, and the completion report lists that platform as "in escalation — see sibling campaign."
- If the campaign is seed-linked, the sibling link uses `link_role='sibling'` — the seed-campaign link table already models it.
- The sibling is a separate sale — its own `package_price_cents` + pay link (Track B pricing per spec).

**The escalation UX — moment, surface, sequence (W7c):**

*Moment* — three trigger points, all surfacing on the Execution card:
1. Operator marks a platform `blocked` (e.g. "listing suspended") → the row's Escalate affordance appears inline.
2. The audit's signals flag a Track-B issue for a platform (suspension/hijack signals in `repair_triage_briefing`/`detected_signals`) → card shows a suggestion chip "This looks like recovery scope — escalate?" even before the operator touches the row.
3. Customer intake reports `cannot_grant` + notes indicating suspension/ownership issues → operator reviews the intake on the card → escalate from the platform row.

*Surface* — the per-platform row on `RepairExecutionCard` gets an "Escalate to Track B" action (rendered when status ∈ `blocked|awaiting_access|customer_reported` and no `escalated_campaign_id` yet). Click opens a confirm modal: platform (fixed, from the row), issue type select reusing the five `PROFILE_REPAIR_ISSUE_TYPES` (suspension / duplicate_listing / hijacked_listing / ownership_dispute / address_verification_block — prefilled from `repair_issue_type` when it matches), note field. Confirm → `POST /:campaignId/siblings {campaign_category:'profile_repair', repair_track:'escalated', repair_issue_type, notes}` then a second write stamping `platform_status[platform]={status:'escalated', escalated_campaign_id}` (extend the W2 PATCH or a dedicated `POST …/platforms/:platform/escalate` that does both atomically — prefer the dedicated endpoint so the parent stamp can't orphan).

*Sequence after spawn* —
1. Sibling lands at `audit_identified` with the parent's audit inherited; `repair_fulfillment.escalated_from = {campaign_id, platform}` links it back.
2. Operator advances `audit_identified → framework_preview_generated → outreach_dispatched`; at `outreach_dispatched` the **existing** recovery block (`MarketingCampaignService.ts:2862`) auto-mints the Track-B `profile_repair` evidence intake — the suspension-evidence form goes to the customer on a tracked `/i/{code}` link, no new code.
3. Customer submits evidence → `awaiting_owner_intake → intake_submitted` → operator runs the resolution prompt → `final_resolution_drafted` → `owner_approved` → `resolved_and_closed`.
4. **Loop-back:** on the sibling's transition to `resolved_and_closed`, a hook updates the parent's `platform_status[platform]` → `{status:'verified', note:'resolved via escalated campaign {id}'}` — the parent's completion report then reflects the full outcome automatically.

---

## 4. Schema — migration `301_profile_repair_fulfillment.sql`

Additive only (nullable columns, INSERT … WHERE NOT EXISTS). No CHECK constraints touched — `mkt_campaigns_list.stage` and `mkt_dispute_intake.intake_kind` have none.

```sql
-- 1. Fulfillment metadata on the campaign
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS repair_fulfillment jsonb;

COMMENT ON COLUMN mkt_campaigns_list.repair_fulfillment IS
  'Track A profile-repair fulfillment state: {tier, mode, platforms[], sla_hours,
   canonical_nap, access_intake_id, access_collected_at, sla_due_at,
   seed_id, seed_claimed, claimed_at, platform_status{}, completion{}}';

-- 2. Short code + open counter on ALL intake links (not just profile_repair_access)
ALTER TABLE mkt_dispute_intake
  ADD COLUMN IF NOT EXISTS short_code VARCHAR(8),
  ADD COLUMN IF NOT EXISTS viewed_count INT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_intake_short_code
  ON mkt_dispute_intake (short_code)
  WHERE short_code IS NOT NULL;

-- 3. Declarative condition for intake auto-generation
ALTER TABLE mkt_intake_definitions
  ADD COLUMN IF NOT EXISTS trigger_guard jsonb;

COMMENT ON COLUMN mkt_intake_definitions.trigger_guard IS
  'Array of {path, op, value} conditions ANDed against the campaign row before
   auto-minting an intake link. path is a dotted campaign field path
   (e.g. "repair_fulfillment.mode"); op ∈ equals|not_equals|in|exists.';
```

Plus two seed blocks (the `profile_repair_access` definition in W3a, the PB-01 checklist steps in W6a). After applying: `pnpm prisma db pull` → `pnpm prisma generate`. **Tandem staging + prod run required** per AGENTS.md — do not commit the file without flagging that.

### `repair_fulfillment` JSONB shape

```json
{
  "tier": "standard | plus | premium",
  "mode": "diy | dfy",
  "platforms": ["google", "facebook", "yelp", "bbb", "apple_maps", "bing_places"],
  "sla_hours": 48,
  "canonical_nap": { "business_name": "", "address": "", "city": "", "state": "", "zip": "", "phone": "", "website": "" },
  "access_intake_id": "di-…",
  "access_collected_at": "ISO | null",
  "sla_due_at": "ISO | null",
  "seed_id": "dps-… | null",
  "seed_claimed": false,
  "claimed_at": "ISO | null",
  "platform_status": {
    "google": { "status": "awaiting_access | access_granted | blocked | in_progress | verified | done | not_applicable | customer_pending | customer_reported | escalated", "verified_at": null, "note": null, "escalated_campaign_id": null }
  },
  "completion": { "report_deliverable_id": null, "remaining_actions": [] }
}
```

`platforms`/`sla_hours`/`tier`/`mode` are operator-set (§6.1); everything else is written by adapters, the claim-propagation hook, or the execution endpoint. `platform_status` is populated for **both** modes — DFY by the access intake, DIY by seeding `customer_pending` per platform when the package deliverable is generated — because the verification grid and completion report are mode-agnostic.

---

## 5. Work items

### W0 — Migration 301 + `db pull` + `generate`
As above. Blocks everything; land first.

### W1 — Tenant cascade + ownership propagation *(the cohesion backbone)*

**W1a. `DisputeIntakeService.generateIntakeLink` tenant resolution.**
Today: `tenant_id: campaign.tenant_id` — NULL for every seed-linked campaign, which silently disables every tenant-aware adapter. Change to:

```
tenantId = campaign.tenant_id
        ?? (primary directory_seed_campaign_links row for campaign).tenant_id
```

One indexed query (`idx_dscl_campaign`, `link_role='primary'`). This single change is what lets `repair_canonical_nap_write` land provenance on the seed. Apply the cascade in **both** branches — the create path *and* the existing-row reissue path (an intake minted before a link/claim exists has `tenant_id` NULL; backfill it on reissue when the cascade now resolves).

**W1b. `createCampaignFromSeed` — stamp `repair_fulfillment.seed_id` + pass the tenant.**
`CampaignInput.tenantId` already exists (`MarketingCampaignService.ts:363`, written at :863) — `createCampaignFromSeed` just doesn't pass it. Fix: `tenantId: s.tenant_id` in the `createCampaign` call, then after `linkCampaign` succeeds, `UPDATE mkt_campaigns_list SET repair_fulfillment = jsonb_build_object('seed_id', seedId)` (merge-safe). W1a stays as the fallback for campaigns linked before this change or linked via `linkCampaign` directly.

**W1c. Claim propagation in `DirectoryClaimService.acceptClaim`.**
Hook both successful-claim write sites (the OTP-verified path and the operator-approved path — the two `SET status='claimed'` writes around lines 1021/1314). For each `directory_seed_campaign_links` row on that seed:

- `UPDATE mkt_campaigns_list SET tenant_id = link.tenant_id WHERE tenant_id IS NULL` — plain fill, **not** `MarketingCampaignService.linkTenant` (that method is the tenant-prospecting conversion path — it force-transitions the campaign to `tenant_onboarded`, which would yank a mid-fulfillment repair campaign out of the funnel).
- Resolve claiming customer: `customers WHERE linked_user_id = userId` → set `campaign.customer_id` if found (skip + log otherwise; do not block the claim).
- `repair_fulfillment = repair_fulfillment || '{"seed_claimed":true,"claimed_at":now()}'` via `jsonb_set`/concat merge.
- Refresh `tenant_id` on `mkt_dispute_intake` rows for those campaigns where `submitted_at IS NULL`.

Wrap in the claim transaction where possible; failures must not fail the claim (log + continue).

**W1d. Seed-link suggestions endpoint.**
`GET /api/admin/marketing-ops/campaigns/:id/seed-link-suggestions` → reuse the NAP-match computation inside `DirectorySeedCampaignLinkService.linkCampaign` (extract it into a callable helper if it's inlined) against all `directory_presence_seeds`; return top-5 `{seedId, businessName, confidence, napMatchSummary, alreadyLinked}`. Admin UI: a "Linked seed" section on the Execution card (W7b) — shows the link + claim state when present, offers "Find matching seed" when absent. Link itself goes through the existing `POST` campaign-links endpoint — no new write path.

### W2 — `repair_fulfillment` write path (tier/mode recording, §10.6)

- `PATCH /api/admin/marketing-ops/campaigns/:id/repair-fulfillment` — Zod-validated body `{tier, mode, platforms[], sla_hours}`; deep-merges into `repair_fulfillment` (never replaces — adapters own the other keys). Guard: `platforms` ⊆ tier scope (standard/plus = google, facebook, yelp, bbb; premium adds apple_maps, bing_places); `sla_hours` defaults 48 (24 premium). **On tier set, default `platforms` = tier scope ∩ latest audit's `scope.affected_platforms`** (diagnosed-and-covered, not the full tier list) — operator can widen within tier. Reject `mode` changes after `access_collected_at` is set.
- **Opportunistic mint on mode-set:** the `delivered` transition already fired for most live campaigns, so the trigger won't re-run. When the PATCH sets `mode='dfy'` and no `profile_repair_access` intake exists yet, call `generateIntakeLink` directly — deterministic, doesn't depend on re-entering a stage.
- Campaign admin edit UI: a "Profile Repair package" section (only when `category='profile_repair'` and `repair_track='standard'` — `service_category` is operator freeform, don't gate UI on it) — tier select, DIY/DFY radio, platform chips, SLA display. Writes via the PATCH.
- Pricing stays `package_price_cents` as today; the operator picks the price to match the tier. Display-only mapping constant `REPAIR_TIER_CATALOG` in a shared lib (tier → platforms, sla_hours, price cents from spec §4) so UI, validation, and (later) the pay page read one source.

### W3 — The `profile_repair_access` intake (§10.8 + evidence submission)

**W3a. Definition row** (seeded in migration 301, `ON CONFLICT (intake_kind) DO UPDATE` — matches the migration-272 shape exactly; `field_mappings` is an **array** of `{field, adapter, config}`, `owner_copy` keys are `title/subtitle/intro/success_message`, `options` are `{value,label}` pairs):

```jsonc
{
  "intake_kind": "profile_repair_access",
  "label": "Profile Repair — Access & Business Info",
  "driver": "registry",
  // NULL service_category = matches any; the trigger_guard is the real scope
  // (repair_fulfillment.mode only exists on repair campaigns). If the campaign
  // taxonomy later standardizes a 'profile_repair_package' service_category,
  // set it here as a second gate.
  "service_category": null,
  "trigger_stages": ["delivered"],   // see edge case 8 — seed [] first, flip post-deploy
  "trigger_guard": [{ "path": "repair_fulfillment.mode", "op": "equals", "value": "dfy" }],
  "submitted_stage": "repair_access_submitted",
  "downstream_agent": null,
  "owner_copy": {
    "title": "Grant access & confirm your business info",
    "subtitle": "So our team can repair your listings",
    "intro": "We never ask for passwords — you grant us a limited role on each platform and can revoke it any time. Your repair clock starts when you submit this form.",
    "success_message": "Received — our team starts within your package's SLA. You'll get a completion report when each platform is verified."
  },
  "form_schema": [
    { "key": "canonical_nap", "type": "object", "required": true, "label": "Confirm your official business info",
      "fields": [
        { "key": "business_name", "type": "text",  "label": "Business name", "required": true },
        { "key": "address",       "type": "text",  "label": "Street address", "required": true },
        { "key": "city",          "type": "text",  "label": "City", "required": true },
        { "key": "state",         "type": "text",  "label": "State", "required": true },
        { "key": "zip",           "type": "text",  "label": "ZIP", "required": true },
        { "key": "phone",         "type": "phone", "label": "Phone", "required": true },
        { "key": "website",       "type": "url",   "label": "Website (optional)", "required": false }
      ]},
    { "key": "platform_access", "type": "object", "required": true, "label": "Platform access",
      "fields": [
        { "key": "google_gbp",   "type": "select", "required": true, "label": "Google Business Profile",
          "options": [ {"value":"granted","label":"Granted"}, {"value":"pending","label":"I'll do it shortly"}, {"value":"cannot_grant","label":"I can't grant access"}, {"value":"not_applicable","label":"Not applicable"} ],
          "help_text": "Add our team as a Manager: Business Profile → Settings → Managers → Add. Never send us your Google password." },
        { "key": "facebook_page","type": "select", "required": true, "label": "Facebook Page", "options": [ /* same four */ ],
          "help_text": "Page → Settings → Page access → Add our team email with partial access." },
        { "key": "yelp",         "type": "select", "required": true, "label": "Yelp", "options": [ /* same four */ ],
          "help_text": "Claim your free Yelp business page, then tell us it's claimed." },
        { "key": "bbb",          "type": "select", "required": true, "label": "BBB", "options": [ /* same four */ ],
          "help_text": "Only if you're BBB accredited — otherwise mark Not applicable." },
        { "key": "apple_maps",   "type": "select", "required": true, "label": "Apple Maps", "options": [ /* same four */ ],
          "help_text": "Premium tier only — mark Not applicable if not in your package." },
        { "key": "bing_places",  "type": "select", "required": true, "label": "Bing Places", "options": [ /* same four */ ],
          "help_text": "Premium tier only." }
      ]},
    { "key": "no_password_ack", "type": "checkbox", "required": true,
      "label": "I understand I should never send account passwords — only delegated access." },
    { "key": "access_notes", "type": "textarea", "required": false,
      "label": "Anything we should know (logins already shared, platform issues, preferred contact times)" },
    { "key": "evidence_files", "type": "attachments", "required": false,
      "label": "Evidence (optional): screenshots of wrong listings, a utility bill or photo for address verification, storefront photos" }
  ],
  "field_mappings": [
    { "field": "canonical_nap",   "adapter": "repair_canonical_nap_write", "config": { "source": "owner_intake" } },
    { "field": "platform_access", "adapter": "repair_fulfillment_write" }
  ]
}
```

Attachments ride the existing `attachmentIds` envelope → `mkt_dispute_attachments` → `disputes` bucket. The evidence ask doubles as Track-B-adjacent material (address-verification proof) without conflating the flows.

**W3b. `trigger_guard` evaluation.** In the auto-gen hook (`MarketingCampaignService`, where `getDefinitionsForTrigger` results iterate): after stage + service_category pass, evaluate each guard condition against the campaign row — dotted-path read (`repair_fulfillment.mode`), ops `equals | not_equals | in | exists`. Missing path fails `equals`/`in`, passes `not_equals`. ~30 lines + unit tests.

**W3c. New stage `repair_access_submitted`.**
`REVIEW_TRANSITIONS` edges: `delivered → repair_access_submitted`, `repair_access_submitted → delivered`, plus `paid → repair_access_submitted` for operator-minted links before delivery (mirrors the `gbp_intake_submitted` precedent). Update `stageTransitionSchema` and every web stage list (grep `'gbp_intake_submitted'` — `ProvingGroundCockpitClient.tsx` and any stage-label maps).

**W3d. Adapters** (`writeBehindAdapters.ts`):

- `repair_fulfillment_write` — receives the `platform_access` object. Merges into `repair_fulfillment`: `access_collected_at = now()`, `sla_due_at = now() + sla_hours` (only when ≥1 platform is `granted`; otherwise leave null and set `platform_status.* = 'awaiting_access'`), `access_intake_id`, and per-platform `platform_status` initialized from the answers (`granted→access_granted`, `cannot_grant→blocked`, `not_applicable→not_applicable`, `pending→awaiting_access`). Campaign-scoped, not tenant-dependent.
- `repair_canonical_nap_write` — stores `canonical_nap` on `repair_fulfillment` (always), then tenant-aware: resolve the seed via the campaign's **primary `directory_seed_campaign_links` row** (fallback: first `directory_presence_seeds` for `adapterCtx.tenantId`, matching `directory_provenance_write`'s lookup). For each of `business_name, address, phone, website` write a `directory_field_provenance` row (`source_name='owner_intake'`, `confidence='high'`, `evidence_state='owner_confirmed'` — match the migration-271/272 vocabulary). Follows `directory_provenance_write`'s upsert-on-`(seed_id, field_key)` shape.

**W3e. Success state.** The registry submit already returns the campaign stage; confirm the renderer's post-submit screen shows owner-facing next steps ("our team starts within your SLA; you'll get a completion report when each platform is verified") — that's `owner_copy` content, not code.

### W4 — Tracked short links for intake URLs

The canonical intake URL `/recovery/intake?token={32-char}` is too long for SMS and untrackable until the customer lands. The gallery (`/g/{code}`, migration 183) and claim (`/c/{code}`, migration 278) patterns solve exactly this — apply them verbatim to `mkt_dispute_intake` so **every** intake kind (dispute, `gbp_optimization`, `profile_repair_access`, …) gets tracked short links, not just this sprint's.

**W4a. Schema** — `short_code` + `viewed_count` on `mkt_dispute_intake` (in migration 301 above).

**W4b. Code generation** — `generateIntakeShortCode()` in `id-generator.ts`, same curated-alphabet `customAlphabet(..., 6)` pattern as `generateGalleryShortCode`/`generateClaimShortCode`. Mint inside `generateIntakeLink` (and `reissueLink` on token rotation) with the 3-retry collision loop; fall back to no short code if exhausted (long URL still works). `ensureIntakeShortCode(intakeId)` lazy-backfills legacy rows on next admin access — same contract as `ensureShortCode`/`ensureClaimShortCode`.

**W4c. Resolve + track endpoint** — `GET /api/public/intake-scan/:shortCode?surface=sms|email|qr|call` registered `authLevel:'public'` in `routeRegistry`, mirroring `/qr/claim-scan/:shortCode` (`directory-claim-qr.ts:211`): resolves `mkt_dispute_intake.short_code` → `{token, intakeKind}` (+ `tenantId` for attribution — the W1a cascade makes this the seed's tenant), records `trackQrScanEvent({tenantId, surface: 'intake_link_'+channel, consumer:'merchant', source:'intake_link', referrer, userAgent})`, rejects unknown surfaces with `400 invalid_surface` (no silent default — per-surface attribution must stay clean). `qr_scan_events.surface` is unconstrained `VARCHAR(30)`, so no constraint migration is needed. Returns JSON `{success, token}` — the frontend page redirects.

**W4d. Frontend redirect page** — `apps/web/src/app/i/[shortCode]/page.tsx` server component (mirrors `c/[shortCode]/page.tsx`): calls the resolve+track endpoint once, then `redirect('/recovery/intake?token='+token)`. Unresolved code → `/recovery/intake` root, which renders its existing invalid-token state. `apps/web/src/services/IntakeShortCodeService.ts` extending `PublicApiSingleton` with `ttl: 0`.

**W4e. Response + UI wiring** —
- `generateIntakeLink`/`reissueLink` return `{intakeId, token, url, shortUrl, shortCode}`; admin responses that expose intake links include both.
- Intake panel + Execution card: "Copy short link" (channel select: SMS/email/QR — each generates the `?surface=` variant); shows `viewed_at`, `viewed_count`, `submitted_at` so "opened 3× but not submitted" is a visible follow-up signal.
- `LogContactModal`-style "Insert intake link" prefers the short URL, matching the gallery precedent.
- `outreach-link-vars.ts`: add `{{intake_url}}`/`{{intake_short_url}}` resolution per AGENTS.md's tracked-link rule — opener/pitch/manual-play templates get the link via merge var, never hand-built.

**W4f. Funnel** — minted (`generateIntakeLink`) → opened (`qr_scan_events` + `viewed_count`++ in `resolveIntake` — note `viewed_at` only stamps on *first* open today, so the increment is a new unconditional update next to it) → submitted (`submitted_at` + stage). `qr-analytics-sync` aggregates scan events into `qr_analytics` automatically.

### W5 — Fulfill quality (§10.1, §10.2, §10.5)

**W5a. `seek_briefing` injection.** `ProfileRepairPromptService.serializeSeekBriefing(campaignId)`: latest `mkt_prompt_executions_list` row whose `output_schema.name='profile_repair_audit'` → parse `filtered_output` → emit a compact markdown block `{issue_type, scope.specifics, scope.affected_platforms, impact, pitch.value_preview}`. Extend `buildFulfillVariables` (currently returns only `audit_results`, `ProfileRepairPromptService.ts:256`) to add `seek_briefing`, `repair_tier`, `delivery_mode`, `repair_platforms`.

**Platform coupling — campaign-level, not a workspace variable.** The repair scope is derived, not operator-typed per run:

```
repair_platforms = repair_fulfillment.platforms          -- purchased scope (W2, tier-derived)
                 ∩ seek_briefing.scope.affected_platforms -- diagnosed scope (seek output)
                 ?? affected_platforms                    -- fallback when fulfillment.platforms unset
```

Workspace variables (the `interactive_verification` precedent) are per-run operational toggles — the wrong home for a purchase entitlement. One exception worth keeping: allow a caller-supplied `repair_platforms` in `variables` to override for ad-hoc rescope (e.g. regenerate a Google-only fix sheet), same caller-supplied pattern — the body declares `{{repair_platforms}}`, the builder defaults it, the operator can narrow it in the Prompt Workspace.

**W5b. Fulfill prompt v2.** New seed `apps/api/src/scripts/seed-profile-repair-fulfill-template.ts` (marker pattern per AGENTS.md — presence-marker check, bump `SEED_VERSION_MARKER` to re-apply) replacing the body of `mpt-profile-repair-citation-package-fulfill`: declares `{{audit_results}}`, `{{seek_briefing}}`, `{{repair_tier}}`, `{{delivery_mode}}`, `{{repair_platforms}}`; instructs per-platform fix sheets scoped to `affected_platforms ∩ repair_platforms`, canonical-NAP correction entries for drifted fields, claim links for unclaimed profiles, verification checklist, submission guide; branding-aware recommendations (logo/cover/min-photos) with upsell language; tier-conditional expanded-platform sections. Gold standard stays delivered via the existing `fulfill_target` injection — document in the seed header that the body must not re-declare it. Update `output_schema`/`variables` JSON on the template row to match. **Re-run seed on `local` + `prd`; verify `updated_at`.**

**W5c. Deliverable layout.** Add a `citation_repair_package` entry to `seed-deliverable-layout-templates.ts` mirroring §5.1's section order (Canonical NAP → per-platform fix sheet → claim links → verification checklist → submission guide), section-sourced from `deliverableText`/`submissionGuide`. Bump marker; rerun both configs.

### W6 — Package production & customer delivery *(the analyst-assisted loop, both modes)*

The package is produced identically in DIY and DFY — the render/import/portal machinery all exists; four wiring gaps keep it from working end-to-end. For DIY this is the customer deliverable; for DFY it's the operator's fix-sheet (and the fallback for `cannot_grant` platforms).

**W6a. Fulfill import → deliverable** (closes the Track-A sibling of the Track-B block).
Extend `importExternalResult`'s fulfill branch (`ProfileRepairPromptService.ts`, the `prompt_type === 'fulfill'` path): after schema validation, create a `mkt_deliverables_list` row (`deliverable_type='citation_repair_package'`, `status='drafted'`, `mime_type='application/json'`, `storage_path='recovery/{campaignId}/{id}.json'`) + two `mkt_deliverable_section` rows — `deliverable_text` ← `parsedJson.deliverableText`, `submission_guide` ← `parsedJson.submissionGuide` — mirroring the `reinstatement_appeal` block at :839-898. No stage transition on import (operator reviews before `delivered`). Idempotency: skip creation if a non-preview `citation_repair_package` deliverable already exists for the campaign (return its id).

**W6b. Structured content into the PDF.**
`extractContentFromExecution` currently returns `filtered_output` verbatim — for fulfill executions that's the JSON blob, which would print literally. Extend it: `JSON.parse` attempt → if the object has `deliverableText`/`submissionGuide`, compose markdown (`## Citation & Profile Repair Package\n{deliverableText}\n\n## Submission Guide\n{submissionGuide}`); fall back to raw text for non-JSON outputs. Alternative considered and rejected: routing through `DeliverableAssemblyService` — that pipeline is slot/approval-gated and tuned to `review_responses`; the layout-template path is the right weight for this type.

**W6c. Modal wiring.**
- Add `citation_repair_package` to the Generate Deliverable type dropdown (`CampaignDetailClient.tsx` ~:2573) + verify `eligibleTypes` doesn't filter it out.
- Add an **execution picker**: when the selected type is `citation_repair_package`, list the campaign's completed fulfill executions (`GET …/executions?promptType=fulfill&status=completed` — check for an existing executions list endpoint; if absent, add a thin one) → pass `executionId` through `generateDeliverable` (the service input already accepts it — the modal just never sends it).

**W6d. Customer download path** *(fixes a pre-existing bug — today no customer can ever download any deliverable).*
`MarketingCustomerProjection.projectCampaign` reads `d.file_url` — a column that doesn't exist on `mkt_deliverables_list` (the real columns are `storage_path`/`file_name`) → `downloadUrl` is always `null` and the portal's Download button never renders.
- Fix projection: `downloadUrl: '/api/customer/marketing/deliverables/' + d.id + '/download'`.
- New authenticated route `GET /api/customer/marketing/deliverables/:id/download` in `marketing-customer.ts`: verify `deliverable.campaign.customer_id === req.customerId`, gate on `delivery_status='delivered'` (or campaign stage `delivered`/`paid` per the existing projection rule), stream the file from `storage_path` (local uploads dir; Supabase migration is a later infra decision, not this sprint).
- Extend `POST /admin/marketing-ops/deliverables/:id/send` (or add `…/deliver`) to also set `delivery_status='delivered'`, `delivered_at` — the projection gate depends on it; verify what `/send` currently writes (`sent_at`/`sent_method` only, likely).

**W6e. PB-01 DIY production steps** — add to the W7a checklist seed (tag `paid`, so they gate the paid→delivered transition, which is the correct semantic — the package must exist before the stage says it does):

| order | title | step_type | action_config |
|---|---|---|---|
| — | Run citation-package fulfill prompt → import analyst output | `ai_prompt` | link → campaign Prompts tab, template `mpt-profile-repair-citation-package-fulfill` |
| — | Generate + review the Citation & Repair Package PDF | `deliverable` | `deliverable_type: citation_repair_package` |
| — | Mark deliverable sent (customer portal download unlocks) | `manual` | — |

### W7 — Execution & verification tracking (§10.7)

Two layers, both existing machinery. **Both modes share this layer** — the grid tracks platform outcomes (who did the work is just context), so DIY customers' self-executed fixes land in the same `platform_status` structure for operator verification and the completion report.

**W7a. PB-01 delivered-stage checklist steps** (seeded in migration 301, `stage_tag='delivered'`; existing `pbcs-pb01-*` ids run 001–008 and 101–107 — use `pbcs-pb01-009`–`012`, re-verify the max at write time):

| order | title | step_type | action_config |
|---|---|---|---|
| n+1 | Send DFY access-intake short link (auto-mints on `delivered` when mode=dfy) | `internal_link` | href → campaign intakes panel; copy `/i/{code}` |
| n+2 | Confirm delegated access granted (or follow up) | `credentials` | reference label only — never credentials |
| n+3 | Execute corrections on each platform + verify live | `manual` | points at the Execution card |
| n+4 | Generate + deliver completion report | `deliverable` | `deliverable_type: repair_completion_report` (lands with W8) |

**W7b. Per-platform status + SLA card.** `RepairExecutionCard` on the campaign detail page (render when `repair_fulfillment != null`, **both modes**): tier/mode/platform chips, SLA countdown from `sla_due_at` (amber <12h, red past-due — DFY only), per-platform row: status select (`awaiting_access|access_granted|in_progress|verified|done|blocked|not_applicable|customer_pending|customer_reported`) + `verified_at` auto-stamp + note field → `PATCH …/repair-fulfillment` extended to accept `platform_status` updates (operator-only). DIY rows show `customer_pending`/`customer_reported` — operator verifies live listings and marks `verified`. Linked-seed panel from W1d lives on this card: link state, `nap_match_confidence`, `seed_claimed` badge, "Find matching seed" button. Intake state (link sent / submitted / attachments) surfaced read-only from `mkt_dispute_intake` — DFY only.

**W7c. Escalation affordance + loop-back.** Implements §3f's moment/surface/sequence: per-platform "Escalate to Track B" action + confirm modal (issue-type select reusing `PROFILE_REPAIR_ISSUE_TYPES`), dedicated `POST …/platforms/:platform/escalate` endpoint that spawns the sibling *and* stamps `platform_status[platform]={status:'escalated', escalated_campaign_id}` atomically (an orphaned sibling without the parent stamp — or a stamp without a sibling — is the failure mode to prevent), `repair_fulfillment.escalated_from` back-pointer on the sibling, and the `resolved_and_closed` loop-back hook flipping the parent row to `verified`. The Track-B intake auto-mints on the sibling's `outreach_dispatched` transition — existing machinery, no new code.

### W8 — Deferred-adjacent (P2, land if capacity allows)

- `repair_completion_report` in the `DeliverableType` union + assembled content from `platform_status` + checklist progress + attachments (spec §5.3) — **both modes**: DFY documents operator-executed verified changes; DIY documents verified state + remaining customer actions (which doubles as the retainer pitch artifact). Requires the W7b card to be stable first. Rides the W6d download path once fixed.
- Optional DIY progress check-in: a second `trigger_guard`-gated registry kind (`profile_repair_progress`, trigger `delivered` + `mode='diy'`) letting the customer report which platforms they fixed → flips `platform_status` to `customer_reported` for operator verification. Nice retainer-pitch feed; can ship in a follow-up.
- Pay page: display the operator-set tier/mode as a confirmation badge near the price; still no customer picker.

---

## 6. Edge cases & design rules

1. **Idempotent intake** — `(campaign_id, intake_kind)` uniqueness + token reissue already handle re-sends; a second submit is rejected, evidence stays.
2. **Claim after intake submitted** — adapters already ran tenant-less; the claim hook stamps `seed_claimed` and backfills `campaign.tenant_id`, and the operator can reissue the link if provenance needs the tenant (re-submit writes to the same intake row → blocked; instead the Execution card exposes the canonical NAP for manual provenance entry). Document this ordering in the card's help text.
3. **DIY → DFY upgrade mid-campaign** — allowed before `access_collected_at`; the PATCH re-runs the trigger-guard path so the intake mints on the next `delivered` entry (operator can also mint manually via the existing reissue endpoint, which accepts any `intakeKind`).
4. **Never credentials** — the `credentials` checklist step type stores a reference label only; the intake form has no password field anywhere; `no_password_ack` is required.
5. **`evidence_payload` is source of truth** — both new adapters are best-effort; a provenance write failure never blocks submission.
6. **No new CHECK constraints** — but `repair_access_submitted` must be added to every app-layer stage list/enum on both API and web (the silent-drift pattern from AGENTS.md applies to code enums too).
7. **Short code survives token reissue** — `short_code` resolves through the intake row, so `reissueToken` minting a new `access_token` (`DisputeIntakeRepository.ts:226`) does not break a previously texted `/i/{code}` link (it always resolves to the current token). Collision fallback is "no short code" — the long URL remains the always-works path, same as gallery/claim.
8. **Trigger-guard deploy ordering** — prod schema lands before prod code, so for a window `trigger_stages:['delivered']` exists but no code evaluates `trigger_guard` → DIY campaigns would auto-mint a (harmless, unsent) intake row. Ship the definition with `trigger_stages='[]'` in 301 (operator-minted only, the attribute_verification precedent), then flip to `['delivered']` via a tiny follow-up UPDATE migration once the guard code is verified live. Same ordering applies to `submitted_stage`: the `REVIEW_TRANSITIONS` edges must be deployed before a customer submits, or `transitionStage` throws on an invalid edge.
9. **`intake_submitted` reachability caveat** — `intake_submitted` exists only in `RECOVERY_TRANSITIONS` (line 183), not `REVIEW_TRANSITIONS` — so `attribute_verification`'s `submitted_stage='intake_submitted'` likely fails transition validation on review-pipeline campaigns today (pre-existing issue, verify during impl). `repair_access_submitted` avoids this by adding explicit edges to `REVIEW_TRANSITIONS` — which is also what standard-track `profile_repair` campaigns use (`transitionsFor`, line ~211).
10. **`cannot_grant` platforms degrade to DIY, not failure** — a DFY platform the customer can't grant access to keeps its DIY fix-sheet section in the package (same artifact, customer executes that row). `platform_status` → `blocked` + note; the completion report lists it under remaining customer actions.
11. **Escalation is a boundary, not a split** — per-platform work stays in-campaign; only a platform needing Track B scope (suspension/hijack/dispute) spawns an escalated sibling. Never auto-spawn: `escalated` status + `escalated_campaign_id` are operator-set, and the parent's `platform_status` continues tracking the remaining platforms uninterrupted.

---

## 7. Verification

**Unit/API tests:**
- `trigger_guard` evaluator: each op, missing-path behavior, AND semantics.
- `repair_fulfillment_write`: mode/platform_status mapping, `sla_due_at` arithmetic, no-grant case leaves SLA null.
- `repair_canonical_nap_write`: provenance rows written per field; no-tenant → payload-only warn.
- Tenant cascade: seed-linked campaign mints intake with link tenant.
- `acceptClaim` propagation: linked campaign gets `tenant_id`, `seed_claimed`, intake rows refreshed; unlinked campaigns untouched.
- PATCH endpoint: validation, deep-merge doesn't clobber adapter keys, mode-lock after access collected.
- Short code: `generateIntakeShortCode` alphabet/length, mint + collision retry, `ensureIntakeShortCode` backfill, resolve→token round-trip, unknown-surface `400`, expired intake → the intake page's existing `expired` state, not a crash.
- Fulfill import → deliverable: creates `citation_repair_package` + 2 sections; idempotent on re-import; non-fulfill templates untouched.
- `extractContentFromExecution`: JSON fulfill output → composed markdown; non-JSON output passes through unchanged.
- Customer download route: correct-owner streams PDF; wrong customer → 404; `delivery_status` gate enforced.
- Escalation: atomic spawn+stamp (rollback if sibling create fails); sibling audit inheritance visible on its Audits tab; loop-back flips parent `platform_status` to `verified` on `resolved_and_closed`; escalated row hides the Escalate action (no double-spawn).

**Real-DB smoke (the AGENTS.md guardrail — mocked tests don't cover the write path):**
1. Apply 301 to `local`, `db pull`, `generate`, `pnpm checkapi` + `pnpm checkweb`.
2. Seed→campaign via `createCampaignFromSeed` → set `{tier:'plus', mode:'dfy'}` → transition `paid → delivered` → confirm intake link auto-minted **with a `short_code`**.
3. Hit `/i/{code}?surface=sms` → assert 302/redirect chain lands on `/recovery/intake?token=…`, a `qr_scan_events` row exists with `surface='intake_link_sms'`, and `viewed_count` incremented.
4. Submit the form (mix of granted/pending/not_applicable + one attachment) → assert `repair_access_submitted`, `access_collected_at`, `sla_due_at`, `platform_status`, and `directory_field_provenance` rows on the seed with `source_name='owner_intake'`.
5. Claim the seed → assert campaign `tenant_id`/`customer_id`/`seed_claimed` propagation.
6. Update platform statuses → verify card + `verified_at` stamps.
7. Run seek → fulfill → confirm `seek_briefing` lands in `variables_used` and the v2 body renders.
8. **DIY loop end-to-end:** paste a valid fulfill JSON into import → assert deliverable + sections created → Generate Deliverable from the execution → PDF contains the package text (not raw JSON) → mark sent → claim a customer account → portal shows Download → the download streams the PDF.

**Ops run list (post-merge):** migration 301 on staging + prod in tandem; `seed-profile-repair-fulfill-template` + `seed-deliverable-layout-templates` on `local` + `prd` Doppler; verify `updated_at` on both template rows.

---

## 8. Generalization note — revisit after Profile Repair ships

Profile Repair is a playbook-triage workflow, and the primitives built here were deliberately kept generic so the other triage-driven playbooks (review management, directory enrichment, product visibility, …) can follow the same path. **Scoping that generalization is a separate spec, revisited after Profile Repair proves the pattern end-to-end** — not part of this sprint.

What was designed generic on purpose:

- `trigger_guard` — arbitrary JSONB conditions on campaign fields; nothing repair-specific about `{path, op, value}`.
- `mkt_dispute_intake.short_code` + `/i/{code}` + intake-scan tracking — applies to every intake kind from day one.
- The escalation boundary (`platform_status.escalated` + atomic sibling spawn + `resolved_and_closed` loop-back) — the same "in-scope vs escalate" boundary exists for other playbooks (e.g. a review-management campaign discovering a suspended profile).
- Mode-gated intake + `repair_fulfillment`-style JSONB state — the *shape* generalizes; a future spec would define whether each playbook gets its own `*_fulfillment` column or one shared `fulfillment` JSONB keyed by playbook.

What stays repair-specific: the platform taxonomy, the two adapters, the `profile_repair_access` form schema, the PB-01 checklist steps, and `REPAIR_TIER_CATALOG`.

Revisit trigger: after the first few Track A campaigns run the full loop — paid → package → (intake) → verified → completion report → retainer — the friction observed in those runs is the input for the generalization spec.
