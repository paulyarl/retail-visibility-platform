# Claim Verification Signals Spec — Multi-Signal Physical Anchor

Status: draft (v0.1 — not yet built)

## 0. Why this exists

The directory's promise is *physical shelves of independent brick-and-mortar
retailers*. A seed can currently reach `claimed` through phone OTP alone —
proof that the claimant **controls the listed contact**, not that a
storefront exists at the listed address. Ghost stores (dropship storefronts,
service-area businesses hiding their address, mirror-asserted addresses) can
claim and look identical to a real store. The verification signal menu turns
the claim into graduated physicality proof, and the badge tiers publish that
distinction to shoppers. Cheap to fake = cheap to filter; credibility of the
shelf is the moat.

## 1. Model — signals by class, threshold by coverage

Verification is a packet of evidence rows scored by **class coverage**, not
raw count. Two photos of the same storefront are one signal; a license plus
a mail photo is two.

### 1.1 Signal classes

| Class | Proves | Signals |
|---|---|---|
| `control` | The claimant IS the business | `otp_phone` (exists — claim token), `domain_email` (email at the claimed site's domain), `video_call` |
| `physical` | A real location is occupied at the claimed address | `storefront_photo` (signage or legible name text), `mail_photo` (business mail / utility bill at the address), `delivery_photo` (supplier invoice, inbound shipment at the address) — plus **call-side probes** below |
| `documentary` | The legal entity exists | `business_license` (photo/scan, reviewed), `state_registration` (SOS lookup match), `ein_letter` |

### 1.1a Call-side probes (prospect-level `physical` signals)

Two `physical` signals are collected on the **verification call**, before
any claim or upload — assertion-grade (owner-stated / call-observed), so
they feed triage and the operator's read but cannot alone carry a
badge tier:

- **`storefront_asserted`** — "Does the business operate a physical
  storefront at the claimed address?" Recorded as `confirmed |
  online_only | unconfirmed`. Declarative — the owner computes the
  desired answer, so its weight is weak on its own; its real value is
  framing the next question.
- **`pickup_probe`** — the sharper probe: "A customer wanted to know if
  {product} is in stock — can they come pick it up today?" This is a
  *functional* test, not a self-report: a real storefront answers
  in-stock + come-by in one breath; a ghost operation reflexively
  deflects to "order online / we ship." **The deflection is the
  signal.** Recorded as `ready | online_only | unreachable`. Strongest
  call-side signal — it tests operational capability, not intent —
  and it is checkable after the fact: a false "come by" produces a
  `conflicting` evidence row when walk-in fails, so lying degrades the
  seed rather than laundering it.

Both land as `physical`-class evidence rows with
`source = verification_call` — cost: one scripted line on a call that
was already being made. They settle the ghost-store question at
*prospect* triage instead of waiting on a claim the ghost never makes.

### 1.2 Tiers (derived, not stored as truth)

| Tier | Requirement | Public badge |
|---|---|---|
| `claimed` | `control` only (today's OTP path) | `claimed` |
| `verified` | ≥2 distinct classes | `verified` |
| `physical_verified` | `physical` + ≥1 other class | `verified storefront` |
| `org_verified` | `documentary` + `physical` + `control` | future — org-level verification |

Rules:

- **Class coverage, not count.** N rows in one class = one class. The ghost
  store OTPs (control) and has nothing to pair — sits at `claimed` forever,
  which is the honest state.
- **Never a claim blocker.** OTP claim works exactly as today. Verification
  is post-claim and optional — the badge is the incentive, not a gate.
- **Review weight.** Self-reported facts don't count. `physical` and
  `documentary` rows require `evidence_state = operator_confirmed` or
  `owner_confirmed` *after review* — the upload is a submission, the review
  is the signal. `control` signals are self-verifying (OTP proves itself).

## 2. Data model

Evidence lives in the existing ledger — `mkt_identity_evidence` gains a
`signal_class` + `signal_key` pair (additive columns, no new table):

- `signal_class`: `control` | `physical` | `documentary`
- `signal_key`: `otp_phone` | `storefront_photo` | `mail_photo` |
  `delivery_photo` | `business_license` | `state_registration` |
  `ein_letter` | `domain_email` | `video_call` | `storefront_asserted` |
  `pickup_probe`
- `sourceUrl` already carries the uploaded asset (photo/license image).
- `corroborates` continues naming the fields proven (`address`, `business_name`).
- `evidence_state` = the review verdict (`submitted` → `operator_confirmed` /
  `operator_rejected`; new states allowed, reusing the dispute/retraction flow).

Seed scope: claim evidence is seed-scoped, not campaign-scoped — the packet
is resolved via `directory_seed_campaign_links` (the campaign's seed) OR
directly on `directory_presence_seeds` via a `seed_id` column (preferred —
evidence survives campaign regrouping; mirror to the linked campaign for
Identity-tab visibility).

Derived tier: `physical_verified`/`verified`/`claimed` computed on read from
class coverage of confirmed rows — never stored, so retraction degrades
honestly (remove a row, tier drops next read).

## 3. Claim-flow integration

1. **OTP claim (unchanged).** `acceptClaim` → seed `claimed`. This satisfies
   `control`.
2. **Post-claim verification prompt.** The claimed-owner surface gains a
   "Verify your storefront" card: upload menu of the remaining signals with
   one-line guidance per signal ("a photo of your storefront showing the
   business name", "a piece of business mail at this address"). Submission
   writes an evidence row (`evidence_state='submitted'`) + files the asset.
3. **Owner follow-ons.** The card re-appears until `physical_verified`; each
   upload surfaces its review state. Never time-gated — owners verify when
   they want the badge.
4. **Review queue.** `submitted` rows land on a staff surface (cleanup page
   lane or a dedicated verification queue): side-by-side seed fields vs.
   submitted asset, confirm/reject. Model pre-check ("does this image show
   signage reading <business name>?" — the same image-capable analyst
   pattern used elsewhere) pre-labels each row so the human pass is a
   confirm sweep, not an inspection.

5. **Verification-call probes.** The Resolve-verification modal gains two
   structured fields alongside the call outcome — `physical_storefront`
   (`confirmed | online_only | unconfirmed`) and `pickup_probe`
   (`ready | online_only | unreachable`) — which write the call-side
   `physical` evidence rows in §1.1a. `online_only` on either feeds the
   ghost-store read directly (flag the seed "online business — storefront
   unverified", drop reach-first priority); `ready`/`confirmed` plus a
   missing Google address sharpens the repair wedge ("your customers
   can't navigate to your door").

## 4. Public surfaces

- `directory_presence_seeds.verification_tier` is NOT a column — derive on
  read (class coverage). Public query returns `verification_tier` alongside
  `status`; the place page renders `verified storefront` /
  `verified` / `claimed` chips accordingly. Unverified `claimed` shows just
  `claimed` — honest, self-documenting.
- Claim token flow and directory queries are unchanged upstream of the
  badge: a seed stays `claimed` regardless of tier — the tier is display +
  trust metadata, not status.

## 5. Downstream consumers (no new machinery)

- `IdentityPacketService` — the packet gains `verificationTier` +
  `verificationSignals` (class map of confirmed rows) so the Identity tab
  shows the same read as the public page.
- Seed provenance — confirmed physical/documentary rows mirror into
  `directory_field_provenance` as `owner_confirmed`-grade provenance for
  `address` / `business_name` (the same path verification back-fill uses).
- Outreach openers — "verified storefront" is a pitch hook for
  unclaimed-but-verified-able seeds; ghost-store unverified seeds lose
  reach-first priority.
- `SeedFidelityService` — a `physical_verified` seed's address is canonical
  at a higher grade than mirror-asserted.

## 6. The routing layer — presence × aspiration

Verification signals don't just filter — they **route**. Two axes decide
where a prospect belongs: `presence_mode` (what they are, probe-verified)
and `aspiration_mode` (what they want to be, consultative probing). The
platform is an aspirational bridge-builder: the product is the gap
between the two axes, not either axis alone. The tier contract already
packages every destination.

|  | Aspiration: physical | Aspiration: online |
|---|---|---|
| **Presence: physical** | discovery/presence tier — visibility on the shelf they have | omnichannel path — "your store exists; your digital shelf doesn't" |
| **Presence: online-only** | unusual — likely miscategorized, re-probe | ecommerce tier — already operating the model |
| **Presence: none / aspirant** | location/franchise conversation — different product | **done-for-you buildout** — wants the playbook, lacks capacity |

- **`presence_mode`** — `physical | hybrid | online_only`, set by the
  call probes (`pickup_probe`, `storefront_asserted` → §1.1a) and
  provable by the claim menu. `online_only` is honest categorization,
  not exclusion: renders `online — ships` on every surface, asserts no
  address, exits repair-archetype pitches, and routes to the ecommerce
  lane — a legitimate SKU in the tier contract, not a ghost.
- **`aspiration_mode`** — `physical | online | hybrid`, captured by a
  structured consultative question on the verification/outreach call
  ("where do you want customers to find you — walk-in, online, or
  both?"). The probe measures the capacity gap (resources, knowledge,
  budget, intent) which prices the engagement — self-serve tools at the
  low end, done-for-you storefront at the high end.
- **The delta is the pitch.** `physical + wants online` → omnichannel
  upsell; `none + wants online` → done-for-you ecommerce buildout;
  `online + wants online` → already there, expand (multi-market,
  marketplace). The dropship playbook isn't excluded — it's a
  packaged outcome the platform sells to the prospect who can't
  execute it alone.
- **Reference cases.** A complete, successful `online_only` listing
  isn't a lead for repair — it's the demo of the ecommerce outcome.
  Verified-mode + tier-fit examples become the aspirational proof in
  the pitch ("here's what the model looks like — want it?").

### 6a. Pipeline ordering — probing before auditing

The layers above converge on a sequence where each step answers one
question the next can't:

**footprint → identity → truth → intent → diagnosis → campaign**

- **Discovery** = signal gatherer — the footprint scan surfaces
  presence/absence hypotheses and dedup candidates.
- **Dedup/cleanup** = identity resolution — same entity vs distinct vs
  chain; city-label noise separated from real multiplicity.
- **Verification call / probes** = truth + intent — `presence_mode`
  verified operationally, `aspiration_mode` captured consultatively.
  Focused probing *before* focused campaigns is the honest and
  efficient path to conversion: the operator never pitches a lane the
  prospect isn't standing in.
- **Business audit** = diagnosis on a *qualified* prospect — the audit
  prompt consumes the probe outcomes as context (same injection slot
  as `=== CHAIN CONTEXT ===` — a `=== PROSPECT CONTEXT ===` block:
  `presence_mode × aspiration_mode → evaluate for <lane> fit`). The
  audit stops discovering what the business IS and starts evaluating
  what it could BECOME — "physical-presence-complete, digital-shelf-
  absent — the omnichannel build is the gap" rather than generic
  repair findings.
- **Campaign** = minted tier-qualified — the campaign is born knowing
  its shelf, because the probing already decided which shelf the
  pitch belongs on.

Audit-side rendering: probe-derived `presence_mode`/`aspiration_mode`
flow through the VERIFIED EVIDENCE block today; the dedicated
`PROSPECT CONTEXT` directive is the P1 upgrade that frames the lane
decision explicitly for the analyst.

## 7. What this deliberately does NOT do

- **No claim blocking.** OTP claim never requires evidence. Requiring it
  hard-blocks legitimate awkward storefronts (warehouse units, mall kiosks,
  home-pickup) — some of the platform's best-fit independents.
- **No auto-publish changes.** Tier affects badges/trust signals, not
  `is_published` or status lifecycle.
- **No retroactive sweep.** Existing claimed seeds show `claimed` until an
  owner uploads — no backfill, no demotion.
- **No new review pipeline per signal.** One `submitted` queue, one
  confirm/reject, one pre-labeler — the menu is a union of one kind of
  work, not three pipelines.

## 8. Phases

- **P0** — evidence columns (`signal_class`, `signal_key`, `seed_id`),
  upload + submission on the claim flow, review queue + confirm/reject,
  derived `verification_tier` on the public place page (badges only).
- **P1** — model pre-labeling on submissions, `domain_email` control signal,
  Identity tab tier display. Call probes land here too — modal fields for
  `physical_storefront` / `pickup_probe` / `aspiration_mode` writing
  evidence rows + `presence_mode`.
- **P2** — tier-driven outreach hooks (presence × aspiration routing),
  `org_verified` (chains/orgs), feed metrics (`verification_tier` +
  `presence_mode` in funnel reporting).
