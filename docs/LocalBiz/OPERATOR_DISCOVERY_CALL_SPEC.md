# Operator Discovery Call Spec — Post-Verification Intake SOP

Status: draft (v0.1 — SOP, not a built surface yet)

## 0. Why this exists

A claimed and verified tenant is the highest-intent contact the funnel
produces — they proved storefront control, which means they'll answer the
phone. The discovery call is the operator-led step between verification and
the upgrade pitch: a ~15–20 minute phone conversation where the operator
walks a checklist, checking off capabilities, readiness, team structure, and
business health while it stays conversational.

The call has three jobs:

1. **Qualify** — is this tenant a growth-ladder candidate now, later, or
   never (capacity-constrained, winding down, hobby shelf)?
2. **Route** — every answer maps to a pitch variant or a capability flag.
   The POS probe (§3.1) is the sharpest example: a Clover answer routes to
   the POS-sync wedge, not the generic catalog pitch.
3. **Feed verification** — several answers double as physicality signals
   (`CLAIM_VERIFICATION_SIGNALS_SPEC.md`). A live POS at the listed address
   is stronger storefront proof than most rows in the signal table.

## 1. When it happens

- **Trigger:** seed claim reaches `claimed` + verification complete (see
  `directory_presence_claim_handoff_spec.md` for the in-app handoff that
  runs in parallel — the call is the human half of that surface).
- **Not before verification:** the call is expensive; spend it on proven
  claimants only.
- **Cadence:** one call per tenant at claim time; a refresh pass only when a
  tier conversation is already underway.

## 2. Format

- Operator-led phone call, conversational order — the checklist below is a
  reference, not a script read verbatim.
- Operator checks off findings during the call (console/paper for v0; a
  structured intake record is a later build — see §6).
- Keep it under 20 minutes. Questions the audit already answered are
  *confirmed* ("your site lists Saturday hours — still right?"), never
  re-asked cold.

## 3. Question set

### 3.1 POS & checkout systems — the Clover probe

Ask early; it routes everything after it.

- **"What do you ring sales through?"**
  | Answer | Flag | Route |
  |---|---|---|
  | Clover | `pos=clover` | Free POS-sync wedge pitch (catalog → web presence, zero re-entry). If the tenant is engaged and patient — dev-partner candidate for the production-connect loop (see `CLOVER_POS_STRATEGIC_ANALYSIS.md`). |
  | Square | `pos=square` | Same wedge pattern once Square catalog sync is production-proven; today, note it and pitch visibility first. |
  | Lightspeed / Shopify POS / other | `pos=<name>` | Log for integration roadmap demand signal; pitch visibility now. |
  | Cash register / none | `pos=none` | Manual catalog path — camera-scan + template flows; no sync pitch. |
- **"Who set it up, and how's it treating you?"** — gauges technical
  sophistication and surfaces POS pain the pitch can lean on.
- **Signal dividend:** an installed, transacting POS at the claimed address
  is a physicality signal — log `pos_installed=true` in the verification
  packet regardless of which POS.

### 3.2 Digital footprint & readiness

- Website situation — confirm the audit's finding (none / stale / active
  but weak). Never announce the audit's verdict as news; confirm it.
- GBP access — "do you control your Google Business listing?" A merchant
  who *can't* log into GBP has a concrete, solvable first problem — an easy
  early win the platform can frame.
- Photos/hours willingness — "if we build the page, can you get us shelf
  photos?" Tests the lowest-effort enrichment ask.

### 3.3 Team structure

- Owner-operator vs. staffed — who answers for marketing decisions?
- Is the person on the phone the decision-maker? (Claims usually are —
  confirm, don't assume.)
- Any staff who could own weekly tasks (photo uploads, review replies)?
  Determines whether "managed" or "self-serve" is the honest pitch.

### 3.4 Business health & trajectory

- Seasonality — what's their busy quarter? (Timing the upgrade push to a
  pre-season window dramatically improves close rate.)
- Trajectory — growing / steady / winding down. A winding-down tenant is
  not a ladder candidate; log and move on gracefully.
- Capacity posture — do they *want* more foot traffic, or are they
  capacity-constrained? (The presence pitch assumes they want demand; a
  capacity-capped merchant wants different value.)
- "What would make the biggest difference this quarter?" — open question,
  last. Their words become the pitch's language.

### 3.5 Capability checklist (operator checks silently, doesn't read aloud)

While they talk, the operator checks which platform capabilities are live
candidates — catalog/storefront, GBP automation, reviews, social posting,
local delivery/curbside, wholesale/BSaaS. The checklist produces the
capability flag set; it is *not* recited to the merchant.

## 4. Outputs

- **Discovery record** on the tenant/prospect: `pos_type`, `pos_installed`,
  readiness flags, team notes, health posture, capability candidates.
- **Verification feed:** `pos_installed` and any volunteered physicality
  evidence (license mentions, delivery signage) into the claim packet.
- **Pitch routing** for the upgrade surfaces: the handoff screen and the
  outreach ladder read `pos_type` + capability flags to pick the variant
  (POS-wedge vs. generic ladder).
- **Dev-partner list:** Clover tenants who engaged well → the founding-
  partner pitch queue (production-connect closing loop).

## 5. Non-goals

- **Not a form the merchant fills** — v0 is the operator's checklist.
  Asking a busy retailer to complete an intake survey is how answers go
  unanswered.
- **Not a sales call** — the pitch happens *after*, informed by this. If
  the operator is pitching during discovery, discovery isn't happening.
- **Not verification theater** — questions exist to route and qualify;
  evidence classes are the verification spec's job.

## 6. Later builds (parking lot)

- Structured intake surface in marketing-ops (checklist → flags writes the
  discovery record instead of notes).
- `pos_type` as a first-class column on the prospect queue, settable from
  outreach touches too (pre-claim probing during the touch ladder).
- Auto-suggested pitch variant on the claim handoff screen once
  `pos_type` + capability flags exist.
