# Outreach Touch Ladder — Recon Scripts, Visit Path, Authority Routing

**Status:** Draft spec
**Origin:** Field-validated during a manual walk-in prospecting visit (Dreamcast African Market, Indianapolis). The pitch-ready reveal landed on authority-less staff; the owner — the only person who could act on the finding — was unreachable from the floor. This spec encodes the doctrine that visit produced: **gather authority intel before spending the reveal.**
**Companion:** `FOUR_ACT_OUTREACH_CASCADE_SPEC.md` — the cascade spec is the campaign-automation view (V/A/S/T acts, gates, dossier inputs); this spec is the field-doctrine view (authority topology, reveal mechanics, presentation flows). §6.1 maps the ladder onto the cascade — the two describe one pipeline from opposite ends.

---

## §1 Problem statement

The five-stage cold-call script (Verify → Hook → Bridge → Ask → Close) assumes the person who answers can be pitched. Its Verify stage asks "am I speaking with the owner or manager?" but has no branch for the common case: **neither is on the floor, neither controls the digital presence, and the finding would be spent on someone who cannot act.**

Three field-observed failures:

1. **Reveal spent below authority.** The evidence-based finding (hijacked website, unanswered reviews) was delivered to a stocker and a manager with zero control over domain/hosting/GBP. The manager escalated verbally; nothing else could happen.
2. **No authority map existed.** Who answers the phone, when the owner is in, whether staff can act — all unknown until discovered in person, the most expensive channel.
3. **Scam-call indistinguishability.** A finding like "your website serves casino spam" is textually identical to SEO-scam telemarketing. Delivered cold by phone it triggers reflexive filtering; delivered in person or by evidence-mail it lands as fact.

## §2 The touch ladder

Outreach becomes an ordered ladder where each rung is a distinct, separately-scripted touch type, and each rung's *outcome* determines the next rung's channel:

| Rung | Touch | Purpose | Cost | Scales? |
|------|-------|---------|------|---------|
| R1 | **Recon call** | Map authority: who answers, staffing structure, owner presence timing, owner contact channel, phone reachability | ~2 min | Yes |
| R2 | **Authority-targeted touch** — visit / evidence-mail / pitch call | Deliver the reveal to whoever can act | Varies | Partially |
| R3 | **Relay artifact** | Card / QR / mailer left behind that carries the pitch up the chain | ~0 | Yes |
| R4 | **Evidence mail** | Owner-lane delivery when authority is gated | ~$1 | Yes |
| R5 | **Relationship cadence** | Scheduled follow-ups, gatekeeper cultivation, revisit timing | Low | Yes |

The ladder's central rule: **the reveal is a resource — spend it only on authority, or bank it for a channel that reaches authority.**

### 2.1 Attributable pains & the credible-target visit requirement

**Attributable pain** — a finding the prospect can *independently verify on their own surface*: pull up the hijacked homepage, scroll the unanswered reviews, check the dead phone. Attribution is what separates evidence from assertion, and it is what makes a cold reveal credible instead of scam-adjacent. It maps to the audit schema's `verified_on_surface` confidence: **only `verified_on_surface` findings are attributable pains** — `inferred` findings stay in the analyst layer and never get walked in.

The audit pipeline's job in this frame is *ammunition manufacture*: the ground-truth data block (§10) exists to produce attributable pains at scan time, so that every credible target arrives with a loaded foot-in-the-door.

**Visit requirement:** for `lead_disposition: HIGH_PRIORITY_OUTREACH` targets within feasible geography, **the walk-in is a required rung — not an optional channel.** Rationale: the evidence-reveal converts best in person (the prospect verifies the pain on their own phone, in real time, in front of you), and no remote channel can replicate the credibility of showing up with provable findings nobody else bothered to surface. Remote channels (R2-call, R4-mail) are the sweep and the fallback for the rest of the list — they cover targets the visit economics can't justify, they don't substitute for it on targets it can.

### 2.2 Finding salience — the exposure path

An attributable pain has a second property beyond verifiability: **how a customer encounters it.** Field observation — on Google Maps mobile, the website button sits 6th in a horizontally-scrolled action row (Directions, Ask, Call, Share, Save, *then* Website). A hijacked website is real but *buried*: most of the listing's 600+ reviewers navigate via directions/call/reviews and never touch the link. Two consequences:

**Letdown risk.** Reveal a buried pain baldly and the response can be "so what — nobody clicks that." The reveal must arrive with its exposure path attached: not just *what* the pain is, but *who sees it and what it costs*. The hijack's real cost isn't the buried click — it's that Google's trust signals can penalize a listing pointing at a compromised domain, and the real storefront (the Maps profile with the rating and reviews) inherits that damage. Framing rule: **lead with surface-visible pains; deploy buried pains as corroboration with the cost spelled out.**

| Salience class | Encounter path | Examples |
|----------------|----------------|----------|
| `surface` | Shown on the profile without interaction | Rating, review count, unanswered-review snippets, photos strip |
| `one_tap` | Primary action row | Call, Directions — a dead phone here is a surface-class pain |
| `buried` | Scrolled/secondary UI | Website link (6th button), posts, Q&A, business description |
| `latent` | Invisible to customers, visible to Google | Hijacked domain trust, NAP inconsistency, duplicate listings |

**Digital-literacy calibration.** The field visit required physically walking the manager through finding *their own listing* in a browser — staff may not be able to self-navigate to the pain. Reveal mechanics must match the contact's literacy: guided walk-through (show it on your phone / their phone) for low-literacy contacts; self-serve links only for demonstrated-comfortable ones. Capture per-touch in `gatekeeper_relationship`'s companion field (§7).

**Product-thesis corroboration.** The buried website button is evidence *for* the platform pitch: for local retail, the Maps profile IS the storefront — the website is an appendix. The dormant-but-loved profile (605 reviews, 0% response, no posts) is the surface-class pain that leads; the hijack is the latent-class proof that the business's unattended digital layer rots silently.

### 2.3 Reveal presentation flows

The reveal is a *navigated* act — someone has to traverse from "your listing" to "the pain." Presentation varies by channel, device, and literacy (§2.2):

| Channel | Device | Mechanic | When |
|---------|--------|----------|------|
| In-person | **Staff's own device** | Guided walk-through — the operator narrates, the staff navigates their own listing | Preferred whenever the contact has a smartphone. Strongest form: they find the pain *themselves*, the path stays in their hands — and in their browser history, a built-in relay artifact they can replay for the owner |
| In-person | **Operator's device** | Show, don't tell — operator drives, staff watches | Fallback when no staff device on hand, or friction (shared device, cracked screen). Faster but the path dies with the visit — pair with a relay artifact |
| Remote | **Desktop browser** | Step-by-step path card or live screenshare | Owner reached by email/phone; literacy moderate+ |
| Remote | **Mobile app** | Path card for the Maps app flow (search → listing → scroll action row → tap) | Same, mobile context |
| Remote | **Video** | Short clip *recording the navigation to the pain* — search the business, open the listing, scroll to the button, watch the casino page load | Embedded in the diagnostic gallery / linked from the mailer QR. The remote equivalent of walking the manager through it — evidence + replayable path in one artifact |

**The verification path is part of the finding.** Refining §2.1: **attributable pain = finding + path to verify it.** A buried-class finding without navigation steps is not yet attributable — the field visit proved it (the manager could not even open their own listing). Every remote reveal ships with its path card; every buried finding in the audit carries a `verification_path` (numbered steps to reproduce it) so the reveal never depends on the prospect's navigation skill.

## §3 Recon call (R1)

### 3.1 Design rules

1. **Carries no finding.** The recon call never reveals the audit's discovery. A hijacked-website claim on a cold phone call is indistinguishable from scam telemarketing and burns the best hook on a non-decision-maker.
2. **Benign, honest cover.** The stated purpose is verification of listing details — true, and it is what the platform is doing. The caller identifies as the platform when directly asked; never impersonates a customer.
3. **~2 minutes, low-friction.** No pitch, no ask beyond a contact channel. Success = intel captured, not interest generated.
4. **Intel-only write-back.** Every answer feeds the Outreach Intelligence worksheet via the existing fill-and-confirm path — never clobbers, conflicts surface.
5. **Phone verification is itself a finding.** Whether the GBP-listed number reaches the business is audit data (see §7.4).

### 3.2 Script structure

Four stages. Like the pitch script, stages are code-defined constants in `hook-library.ts` (`RECON_SCRIPT_*` family) with merge fields resolved server-side; only the operator's improvisation varies.

**Stage 1 — Open (constant)**
```
RECON_SCRIPT_OPEN =
`Hi, is this {{business}}? … Great — I'm verifying some public listing details
for {{business}} to make sure customers can actually reach you. Do you have
a quick second?`
```
No finding, no pitch. Frames the call as *for the business's benefit*, which is true (a verification call catches a dead phone before customers do).

**Stage 2 — Authority probe (constant, branching)**

```
RECON_SCRIPT_AUTHORITY =
`Who's usually the best person to talk to about the store's online presence —
would that be you, a manager, or the owner?`
```

Branches on the answer:

| Answer | Path |
|--------|------|
| "I'm the owner" | **Owner-answers escalation** — transition to a *softened* reveal (§3.3). This is the only branch that may pitch. |
| "Manager handles that" / "the owner" | Continue to Stage 3. |
| "I just work here" / "not sure" | Continue to Stage 3 — captures `can_act_at_floor: false`. |
| Refusal / "take us off your list" | `RECON_SCRIPT_CLOSE` + log `gatekeeper_relationship: 'blocker'`. |

**Stage 3 — Intel asks (constant, pick-up-to-3)**

The operator selects at most three, prioritizing worksheet gaps:

```
RECON_INTEL_ASKS = [
  // Authority map
  `When does the owner usually come in — is there a good time to catch them?`,   // → owner_presence_timing
  `Is there a direct way to reach the owner — an email or number that's theirs?`, // → owner_contact_hint
  `Does anyone at the store handle the website or Google listing, or does that
   all go through the owner?`,                                                   // → can_act_at_floor
  // Contact channel
  `If I put together a one-page summary of what I found in your listing, what's
   the best email or number to send it to?`,                                     // → preferred_contact_channel / business_email
  // Staffing (only if Stage 2 didn't answer it)
  `Is it mostly family running the store, or a bigger team?`,                    // → team_signal
]
```

**Stage 4 — Close (constant)**

```
RECON_SCRIPT_CLOSE =
`That's really helpful, thank you. I'll make sure the listing details get
verified — have a good one.`
```

No callback promise unless the operator intends one (then set `follow_up_date`).

**Objections (`RECON_OBJECTIONS`).** Three anticipated — answered honestly and briefly per §11 (recon never deceives, never pitches on a non-owner line):

| Objection | Response shape |
|-----------|----------------|
| "Who is this / who do you work for?" | Name + platform, plainly — "I run a local retail directory; we verify the listings we publish" — then return to the benign ask |
| "Are you selling something?" | "Not on this call — I'm verifying listing details. If anything looks off I'll flag it properly" — true, and honors the no-finding rule |
| "Take us off your list" | `RECON_SCRIPT_CLOSE` + `gatekeeper_relationship: 'blocker'` — suppresses call/visit rungs (§8) |

### 3.3 Owner-answers escalation

When Stage 2 returns "I'm the owner," the recon call has accidentally reached authority. The script permits a softened bridge — **not** the full pitch hook, because recon prep carries the finding inventory but not the pitch framing:

```
RECON_SCRIPT_OWNER_BRIDGE =
`Since I've got you — the reason I called is that the verification turned up
something specific on {{business}}'s public listing you'd want to see. I put
together a short rundown — where's the best place to send it?`
```

This converges on the pitch script's Ask (evidence-summary ask, not a sales ask) without reciting the finding itself on a cold line. The full reveal travels with the rundown/visit, where it can be shown.

## §4 Visit script (R2-walkin)

The in-person variant for targets that justify the drive. A rapport preamble precedes the five stages:

**Stage 0 — Rapport (field-mandated, not optional).** A direct probe into the pain reads as salesy/pushy/spammy — the in-person version of the scam-call filter. Before any verification question: introduce yourself by name, learn the staffer's name (it is recon data — `gatekeeper_name`, §7), and offer one *genuine* compliment. For this platform's niche (immigrant-owned ethnic retailers), the material is real: the store's selection, products from the home country, the culture it carries, how loved it clearly is — a 4.9-star wholesale grocer makes the compliment true, not flattery. The platform's own thesis makes sincerity cheap: these shelves genuinely deserve celebration. Professional, knowledgeable, friendly — the demeanor is part of the delivery; "person who noticed something about your business" must never curdle into "person selling something."

```
VISIT_SCRIPT_OPEN     = `Hi — I'm {{operator_name}}. Quick question: is the owner
                         or manager around today?`
VISIT_SCRIPT_VERIFY   = // Same authority question as recon — establishes who can act
                        // BEFORE anything is revealed.
VISIT_SCRIPT_REVEAL   = // Evidence-led: pull the finding up on the operator's or
                        // staff's phone ("pull up your site"). Show, don't tell.
VISIT_SCRIPT_ASK      = // Authority-targeted: if owner present → offer walkthrough /
                        // claim link. If not → relay artifact + "who should I send
                        // this to?" (→ owner_contact_hint)
VISIT_SCRIPT_CLOSE    = // Leave relay artifact (§5), thank, exit. Log the touch.
```

Guardrail mirrored from the field: **pitching "I can fix this" to authority-less staff burns the reveal** — it becomes a favor owed to the wrong person and reaches the owner secondhand. When the floor can't act, the visit's Ask reduces to artifact + contact-channel capture.

### 4.1 Visit chaining — touches are a narrative, not episodes

Each subsequent visit explicitly *references the prior one* — the date, who was spoken to, what was found, what was promised. Visit 2 does not open cold; it re-opens a live thread:

> *After rapport:* "I was here last Thursday — I showed [gatekeeper_name] the website issue and you said you'd flag it to the owner. Did they get a chance to see it?"

The promise-check is load-bearing, and branches:

| Status check | Branch |
|--------------|--------|
| Owner was told | "What did they think?" → authority conversation is now *warm* — ask for the direct channel (`owner_contact_hint`) or owner timing for a Tell visit |
| Owner wasn't told | Urgency compounds — "it's still live, let me leave the details so it's easy to pass up" → relay artifact deployment + recapture `owner_presence_timing` |
| Staffer is new / wasn't there | Brief recap re-derives credibility — the prior visit's specifics (date, finding, who was told) prove continuity even to a fresh contact |

Why it works: the operator returns as a **continuing person, not a stranger** — visit 2 is a follow-up on an open commitment, not a second cold call. Time-anchored specifics ("last Thursday", "I showed you the casino page on your phone") are self-verifying — the staff can confirm the operator's account from their own memory, which *is* the credibility mechanism.

**Mechanism note:** the chain is data-backed — `mkt_outreach_log` / seed touches carry the prior visit's date, channel, outcome, and notes; `ProspectCommunicationService` renders them as the prospect timeline. Pre-visit prep = read the timeline and extract the last touch's *promises* — the spec's recon fields (`gatekeeper_name`, finding citations) exist so the next visit's opening line writes itself from the record.

### 4.2 Pain layering — the audit is an inventory, not a single shot

Audits rarely surface *one* pain — a typical dossier carries several attributable findings. Repeat visits should **ration the inventory: introduce a new pain per visit, layered on the original.** The compounding script:

- **Owner was told, pain A landed** → pain A's status drives the conversation; pain B arrives as depth ("that was the first thing — the review response rate is the bigger number")
- **Owner was never told** → pain B *escalates the case* — "that was bad enough; wait until you see this one." Each undelivered layer makes the gatekeeper's bottleneck more visible and the owner's ignorance more actionable — the ally's motivation to carry it up compounds with every finding they can't deliver alone
- **Inventory exhausted** → the visit still earns its trip: **feature the seed claim invite itself.** The published listing flips the frame from pain to asset — "your business is already live on our directory; let me show you what customers see" — and the claim demo *is* the Tell act, no fresh pain required. The pressure it applies is *structural, not manufactured*: the listing exists and is publicly visible whether they claim or not — an unclaimed listing is one more unattended digital layer (the same failure mode as the hijacked site). "Claim it or leave it writing its own story" is honest urgency — the decision-maker's engagement is pushed by reality, not by a sales tactic.

Ordering rule: **hold pains in reserve.** Never spend the full inventory on visit 1 — lead with the highest-salience attributable pain (§2.2), bank the rest. The rationing is what converts a one-shot reveal into a drip cadence with escalating stakes, and the audit's finding inventory + per-visit ground-truth refresh (new reviews surface new material between visits) keep the reserve stocked.

## §5 Relay artifacts (R3)

The leave-behind carries the pitch up the authority chain when the visit/call didn't reach the owner. Four forms:

1. **Walk-in QR** — `ClaimInviteQrKitService` `/qw/{shortCode}` variant (`surface='claim_invite_walkin'`), minted per-target. Printed on a card or shown on the operator's phone for the staff to scan.
2. **Evidence postcard** — `PostalMailerService` 4x6 payload; the QR destination can render the diagnostic gallery (the finding itself).
3. **Handwritten evidence note** — on a generic card: one line citing the verified finding ("your website is currently serving casino ads — told your manager, happy to walk you through it"). Zero prep; often outperforms print because it reads as a person.
4. **Operator business card** — the credibility artifact, distinct from the evidence carriers above. Left after the reveal + escalation promise, its job is not to carry the finding (the staff's memory already does) but to make the verbal moment *durable*: a named, callable person attached to the story the manager relays to the owner. Field lesson: a reveal followed by "I'll escalate to the owner" with nothing left behind dies in the hand-off — the card is what the gatekeeper physically hands up, and it converts the operator from "someone who came by" into a return-path the owner can act on. Deploy it on the way out, not at the door — it should anchor a relationship already seeded by the reveal, not introduce a stranger.

Artifact rule: **a relay artifact must carry the finding or link to it.** A bare contact card is a funnel; a finding-linked card is evidence. *Exception:* the operator card is exempt — it carries credibility, not the finding; pair it with one of forms 1–3 (or a handwritten finding line on its back) whenever the reveal has already been spent.

**Walk-in kit composition** (for route days): batch-printed evidence postcards for the day's targets + a stock of blank/operator cards for improvised leave-behinds. The per-target prep is the postcard; the card is the always-carried fallback — the field retrospective that produced this spec was "should have armed myself with a card before the trip."

## §6 Evidence mail (R4)

**Trigger:** recon or visit establishes `authority_reached: false` — no owner contact obtained, floor can't act — OR the target isn't visit-justified at all (mail sweep).

**Payload:** the audit's top evidence finding + QR → diagnostic gallery or claim link. Business mail lands in the one place the owner reads; in the field case, an alerted manager becomes a motivated courier who hand-delivers it.

**Doctrine worth encoding:** *when floor contact reveals findings but hits the authority wall, evidence-mail is the escalation channel.* This is the triage rule connecting the ladder's rungs.

### 6.1 The unreachable-owner path — remote VAST

Most owners of emerging businesses **cannot be reached before the recon call** — `owner_name`/`owner_contact_hint` are precisely the fields recon exists to collect, and direct-dial owner data is exactly what no data source provides. For the unreachable-owner majority, the remote variants aren't a fallback — **they are the means of reaching the owner at all**, and the chain executes the VAST cascade remotely:

| VAST act | Reachable-owner path | Unreachable-owner path (remote) |
|----------|---------------------|--------------------------------|
| **V**erification | Recon call confirms operational + contact + pain (R1) | Recon call reaches staff only → partial V; authority map filled, owner contact still open |
| **A**wareness | Mail names the pain to a known owner | Evidence-mail names the pain addressed "to the owner" — lands in the owner lane regardless of who sorts it (§6); an alerted gatekeeper becomes the courier |
| **S**how | Gallery link sent to owner contact | **QR scan event IS the Show gate** — the tracked `/q/`-mail or `/qw/`-walkin scan fires `qr_scan_events` / gallery event, proving *someone* opened the diagnostic. The gallery carries the finding + verification path + walkthrough video (§2.3), executing Show without a contact on file |
| **T**ell | Walk-in consultation + claim demo | Scan events signal engagement → the owner is warm and *now reachable* (the gallery's CTA is the claim path itself; the scan also justifies the visit's economics — Tell scheduled inside `owner_presence_timing` when known) |

The load-bearing property: **the tracked QR converts "did the mail reach the owner?" into a measurable event.** For the unreachable-owner cohort, the gallery isn't a deliverable — it's the rendezvous. The scan sequence (mail scan → gallery dwell → claim page) *is* the VAST pipeline running with no human touch on the platform side, and each event re-routes the prospect: scan-without-claim → Tell-worthy (visit armed with the same finding); no-scan → mail cadence or recycle.

**The gallery is the remote venue, not just the remote artifact.** Post-recon with `authority_reached: true` (owner contact on file), the gallery link is the standard remote payload — it carries the entire reveal stack in one tracked URL: the finding, its `verification_path` steps, the walkthrough video (§2.3), and the claim CTA. Every presentation flow in the §2.3 matrix converges on it — email body, text, QR card, mailer, even narrated on a call ("open the link I just sent — I'll walk you through it," the remote cousin of the guided walk-through). And because every visit to it is a tracked event, the gallery doubles as the engagement sensor that feeds §8 routing: dwell time + claim clicks tell you whether the next rung is Tell-scheduling or residual nudges.

## §7 Recon capture schema (worksheet additions)

New sourced fields on `mkt_outreach_intelligence`, all fill-and-confirm via the existing provenance pattern (`<field>`, `<field>_source`, `<field>_confidence`):

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `contact_reached_role` | enum: `owner|manager|staffer|answering_service|none` | recon/visit log | Who answered — the authority map's first node |
| `phone_reachability` | enum: `answered_live|voicemail|dead_air|wrong_number|disconnected` | recon log | Corroborates GBP phone enrichment (§7.4) |
| `owner_presence_timing` | string | recon/visit | "mornings", "rarely in", "weekends" — drives visit scheduling |
| `can_act_at_floor` | boolean | recon/visit | Does anyone on-site control digital presence? |
| `owner_contact_hint` | string | recon/visit | Direct line/email *hint* (free text; may seed `business_email`/`preferred_contact_channel` on confirm) |
| `gatekeeper_relationship` | enum: `ally|neutral|blocker|unknown` | recon/visit | Motivated courier vs wall — the Dreamcast manager was `ally` |
| `gatekeeper_name` | string | recon/visit | The contact's name — personalizes every subsequent touch ("is [name] around?") and identifies the relay path to the owner |
| `contact_digital_literacy` | enum: `low|moderate|high|unknown` | recon/visit | Can they self-navigate to the listing? Drives reveal mechanics (§2.2): guided walk-through vs self-serve link |
| `authority_reached` | boolean | derived | `contact_reached_role === 'owner'` or owner contact obtained — drives §8 routing |
| `recon_completed_at` | timestamp | system | Set on first successful recon write-back |

### 7.1 Write-back mechanics

Extend `applyCallConfirmations` (or a sibling `applyReconConfirmations` sharing its fill-and-confirm core) with `callDetails.recon_*` fields. The existing pipe already fires on `updateWorksheet && callDetails.call_result === 'connected'` in `MarketingOutreachService.logContact` — recon touches reuse it verbatim.

### 7.2 Conflict semantics

Two field classes, matching fill-and-confirm:

- **Identity fields — null-only fill, conflicts surfaced:** `owner_name` (existing), `owner_contact_hint`, `gatekeeper_name`. An obtained fact isn't invalidated by a later touch that didn't re-ask it.
- **Observation fields — latest observation wins with new source stamp:** `contact_reached_role`, `phone_reachability`, `owner_presence_timing`, `can_act_at_floor`, `gatekeeper_relationship`, `contact_digital_literacy`. They describe current-state reality (who answered *this* time), so each touch restamps — no accumulation, no conflicts.

### 7.3 Visit touches

Walk-ins log to `mkt_outreach_log` with `contact_channel: 'in_person'` and `call_details` carrying the same `recon_*` fields — the write-back path doesn't distinguish a call from a visit. `contact_reached_role` and `can_act_at_floor` are often *best* captured on foot.

### 7.4 Phone verification feed-back

`phone_reachability ∈ {dead_air, wrong_number, disconnected}` is a GBP-data finding: the listed phone doesn't reach the business. Emit as a detected signal (`RA_`-family risk alert or `DS_` dead-signal) on the next audit render for that campaign — a dead listed phone is itself an outreach hook ("customers calling your listing don't reach you").

### 7.5 Seed-scope write path (pre-campaign recon)

The worksheet (`mkt_outreach_intelligence`) is campaign-keyed, but recon typically runs *pre-campaign* on seed-stage prospects — the worksheet may not exist yet. The seed touch table carries a `metadata` JSONB column, which becomes the pre-campaign carrier:

- Seed-scoped recon/visit touches write `metadata.recon_*` (same field names as §7) on the `directory_seed_outreach_touches` row — no worksheet needed, intel lands on the touch itself.
- At campaign creation (or first worksheet write-back for a campaign-linked prospect), the service folds the latest `recon_*` observations from the prospect's touch history into the worksheet as initial values, stamped with their original touch sources — continuity preserved, nothing re-asked that was already answered.
- `authority_reached`/`recon_completed_at` derive identically from either carrier.

## §8 Authority routing (who-can-act targeting)

After any touch, `authority_reached` + `gatekeeper_relationship` + `owner_presence_timing` route the next rung:

| State | Route |
|-------|-------|
| `authority_reached: true` | Proceed to pitch path — pitch call, rundown send, or claim link |
| `authority_reached: false` + `owner_presence_timing` known | Schedule visit/call inside the owner window (`follow_up_date`) |
| `authority_reached: false` + timing unknown | Evidence-mail to owner lane (§6) |
| `authority_reached: false` + `gatekeeper_relationship: 'ally'` | Evidence-mail addressed via the ally + revisit; the gatekeeper delivers |
| `gatekeeper_relationship: 'blocker'` | Mail sweep only — visit and call rungs suppressed for the prospect (§11 compliance) |
| `phone_reachability: dead` | Remove call rungs; mail/visit only — and the dead phone becomes the hook |

## §9 Timeline & checklist integration

- All touches write `mkt_outreach_log` (campaign) / `directory_seed_outreach_touches` (seed); `ProspectCommunicationService` already normalizes both into the prospect timeline — **no aggregator changes needed**. Channels are already in vocabulary: `call`/`phone`, `in_person`/`visit`, `mail`.
- `follow_up_date` on log rows covers revisit scheduling; `ProspectCommunicationSummary.next_follow_up_at` surfaces it.
- **Repeat visits are the physical follow-ups.** The follow-up mechanism is channel-agnostic — a `follow_up_date` can schedule a walk-in as naturally as a call. In-person cadence compounds differently than remote: each return visit arrives with fresh evidence (the ground-truth refresh — new reviews, still-hijacked site, response-rate unchanged), advances the authority chain one notch (stocker → manager → owner), and shifts the operator's identity from "someone who came by" to "the listing guy." Marginal cost stays low when visits batch geographically (route days, §5 walk-in kit); the recurring presence is itself the relationship asset being built.
- `OutreachChecklistBridgeService` auto-completes checklist steps on artifact creation — a recon call logged with `call_details.script_kind: 'recon'` can auto-complete a "recon the prospect" checklist step the same way `contact_log` does today.
- Campaign rollups (`last_contacted_at`, `last_contact_channel`) update for free via `recomputeRollups`.

## §10 Integration points

| Component | Change |
|-----------|--------|
| `outreach-openers/hook-library.ts` | New constant family `RECON_SCRIPT_*`, `VISIT_SCRIPT_*`, `RECON_INTEL_ASKS`, `RECON_SCRIPT_OWNER_BRIDGE`, `RECON_OBJECTIONS` |
| `CallScriptService` | `assembleReconForCampaign` + `assembleVisitForCampaign` — same merge-field machinery; `script_kind: 'pitch' | 'recon' | 'visit'` on the returned payload and in `call_details`; `applyReconConfirmations` sharing fill-and-confirm core |
| `OutreachIntelligenceService` / `mkt_outreach_intelligence` | New sourced fields (§7) — migration for columns |
| `MarketingOutreachService` | Pass `recon_*` call_details through to write-back (path exists) |
| `PostalMailerService` | Evidence-mailer trigger on `authority_reached: false` (§6); payload carries finding citation |
| `ClaimInviteQrKitService` | `walkin` surface minted at visit time (exists) |
| Audit pipeline | `phone_reachability: dead` → signal emission on next render (§7.4); attributable findings carry a `verification_path` (§2.3) so remote reveals ship with reproduction steps |
| Ground-truth data (HasData) | The `=== GOOGLE MAPS GROUND TRUTH ===` scan block (fetched Maps packet — rating, reviews, owner-response rate, posts, photos) manufactures attributable pains at scan time (§2.1); recon corroborates its `phone`/`website` fields, and recon intel can't come from data — it *is* the collection path for authority-map fields |

## §11 Non-goals & guardrails

- **Recon never reveals** — except the owner-answers bridge (§3.3), and even that converges on the rundown ask rather than reciting the finding.
- **No deception.** Benign cover is honest (listing verification is literally the platform's job); if directly asked "are you selling something," answer truthfully and briefly. The audit prompt's evidence rules apply to human touches too.
- **Compliance.** Recon calls are still calls — respect existing do-not-contact handling; a `blocker` outcome suppresses future call rungs for that prospect.
- **No contact-data fabrication.** `owner_name`/`owner_contact_hint` write only what was heard on the touch; never inferred from other sources into a confirmed field (matches fill-and-confirm).
- **Mutable fields stamp, not accumulate.** Timing/gatekeeper fields overwrite with fresh source stamps; they are current-state observations, not history.

## §12 Phasing

- **P0** — Recon script constants + `assembleReconForCampaign` + worksheet fields + write-back extension + seed-scope `metadata.recon_*` carrier (§7.5) + `script_kind: 'recon'` checklist auto-complete. Delivers the capture loop for both campaign and pre-campaign prospects.
- **P1** — Visit script constants + `authority_reached` routing + evidence-mailer trigger + `phone_reachability` signal emission.
- **P2** — Routing automation (recon outcome → suggested next touch surfaced on the campaign card), walk-in kit batch generation for route days, owner-window visit scheduling hints.

## §13 Operator surfaces & UX

The ladder lands on **four surfaces, three of which already exist and extend cleanly:**

### 13.1 Script surface — `CallScriptPanel` gains a script-kind switcher

Today the panel renders the pitch script (`getCallScript(campaignId, angle, anchorId)`): anchor picker, dead-number banner, recent-outreach history, call-context header ("Ask for: …"), stage cards, objection accordion. The ladder adds a segmented control — **Pitch | Recon | Visit** — same panel, different stage layout:

- **Recon view:** Open card → Authority-probe card *with the branch table rendered inline* (the operator sees the four answer-paths as they hear them) → Intel-asks checklist — each ask labeled with the worksheet gap it fills ("owner timing: **unknown — ask this**" / "owner contact: **obtained — skip**"), so pick-3 becomes gap-driven instead of generic → Close + the `RECON_OBJECTIONS` accordion (existing accordion pattern reused).
- **Visit view:** Stage-0 rapport checklist → the five stage cards → relay-artifact quick-actions (mint `/qw/` QR, show full-screen for the staff to scan — see 13.4).
- **Seed scope:** the presence-seed detail page already hosts call-script surfaces — recon scripts land there by default (recon is mostly pre-campaign), `assembleReconForSeed` resolving the same merge fields off the seed/listing record.

The call-context header gains one derived badge: **`authority_reached`** — green "Owner reached" when set, gray "Owner unreachable" otherwise — so the operator knows the script's job before dialing.

### 13.2 Debrief — `LogContactModal` gains a recon block

The modal already carries per-channel result options auto-mapping to outcomes and `call_details` → `applyCallConfirmations`. Extension:

- `call_details.script_kind` stamped by which surface launched the modal (pitch script → `'pitch'`, recon → `'recon'`, visit view or seed touch → `'visit'`).
- A collapsible **Recon intel** section, visible for `script_kind ∈ {recon, visit}`: all fields are **single-tap chips, no typing** — `contact_reached_role`, `phone_reachability` (pre-filled from `call_result` on phone calls), `gatekeeper_relationship` (ally/neutral/blocker), `contact_digital_literacy`, `can_act_at_floor` toggle — plus two short text fields (`owner_presence_timing`, `owner_contact_hint`, `gatekeeper_name`). Design constraint: **the whole debrief must complete in ≤15 seconds standing in a parking lot** — that is why every intel field is an enum chip.
- Same block on the **seed touch modal** (`in_person`/`call` channel) writing `metadata.recon_*` per §7.5 — identical component, different write target.

### 13.3 Authority map card — the recon payoff widget

New compact card — **"Who can act"** — placed on campaign detail (Execution tab), seed detail (Cascade card), and expandable from VAST board rows. Renders the §7 state at a glance:

```
┌─────────────────────────────────────────┐
│ WHO CAN ACT                             │
│ Reached: Manager (Rosa)   [ally]        │
│ Floor can act: No                       │
│ Owner: name unknown — in mornings       │
│ Contact: (317) 985-9643 [answered live] │
│ Literacy: low — guide reveals           │
│ ─────────────────────────────────────── │
│ ▸ Next: Evidence-mail via Rosa          │
└─────────────────────────────────────────┘
```

The last line is the §8 routing derivation made visible — the operator doesn't consult the matrix, the card reads it. This widget is why the worksheet fields exist; without it the intel is write-only.

### 13.4 Walk-in kit — the field surface (P2)

Mobile-first panel (the operator is standing in a store, one hand): route-day target list → per-target **dossier card** = last touch (date, outcome, promises — the §4.1 chaining opener writes itself), top pain + its `verification_path` steps, `gatekeeper_name`. Actions per card: **Show QR** (`/qw/` minted, full-screen for staff scan), **Print kit** (batch the day's postcards from a desktop view beforehand), **Log touch** (same debrief block as 13.2).

### 13.5 Timeline — zero new surface

`ProspectCommunicationService`'s normalized timeline already renders `call`/`in_person`/`mail` events with outcomes and notes; recon and visit touches appear automatically — optionally with a `script_kind` badge (`recon`/`visit`) so the operator can tell an intel touch from a pitch touch at a glance.

### 13.6 Placement principle

Recon fields surface **where they're used, not where they're stored** — the worksheet remains the write target, but the authority state renders on the card, the dossier, and the VAST next-action. The operator never opens the worksheet to answer "who can act?"

## §14 Dependencies — ground truth is opt-in

HasData ground-truth enrichment is **optional by directive, not default** — every rung of this ladder must function with `ground_truth: 'none'`. Credits are a managed spend, never a silent tax on every scan.

### 14.1 Directive levels

Scan/directive accepts `ground_truth ∈ { none | latest | deep }`:

- **`none` (default)** — audit runs on existing signals: GBP Places fields, the free direct website fetch (which already catches `hijacked`), NAP checks. Salience ladder degrades gracefully: `surface`/`one_tap`/`buried` pains still render from free signals; review-corpus classes (unanswered rate, topic clusters) mark `not_measured` rather than fabricating.
- **`latest`** — one place resolve + latest-N reviews + details: ~30–40 credits. Produces the full §2.2 pain inventory and the `=== GOOGLE MAPS GROUND TRUTH ===` block.
- **`deep`** — adds posts/photos/contributor history for forensics or high-value targets: ~50+ credits. Operator-initiated only.

### 14.1a Prompt Workspace knob — caller-supplied variable

The knob lands in the Prompt Workspace as a **third option box** beside Interactive verification and Directory profile evidence — same pattern (caller-supplied variable, never a `{{...}}` placeholder in the template body, so no seed or scope-whitelist changes; blank is a byte-identical normal run):

- **Variable:** `google_maps_ground_truth` — `''`/`'off'` → `none`; `'latest'`/`'deep'` → the level. A client-side truthy check mirrors the server gate, same as `interactiveVerificationOn`.
- **UI:** checkbox *"Google Maps ground truth (HasData)"*; when checked, a level select (Latest reviews / Deep forensics) and the **credit cost shown inline** — "cached packet from Oct 15 · 0 credits" when the prospect's packet is fresh, "~35 credits" when a fetch is required. The spend decision is made looking at the number.
- **Server seam:** `hasdata-ground-truth-directive.ts` — mirrors `operator-profile-evidence-directive.ts` (versioned preamble builder, composed once in `MarketingExecutionService.resolvePrompt`), except the gate isn't text-only: truthy → **fetch-or-cache the packet** → inject `=== GOOGLE MAPS GROUND TRUTH ===` + the corpus block + `verification_path` steps.
- **Failure is non-blocking** — same FALLBACK semantics as the evidence file: fetch failure, missing key, or exhausted credits injects a `ground_truth: unavailable` line, never fails the render.

### 14.2 Spend controls

- **Explicit spend action** — packets are fetched by an operator action ("Fetch ground truth — ~35 credits") or an explicit directive flag, never implicitly by opening a campaign or rendering a script.
- **Cache-first** — resolved `placeId`/`dataId` persist on the business record; packet TTL governs refresh (e.g. 30d, or pre-touch refresh when a visit is scheduled). Repeat touches within TTL reuse the packet — the layer effect (§4.2) re-reads the cache, not the API.
- **Latest-N by default** — full review history is `deep`-only. Counts derived from the sample label themselves "observable corpus," never totals.
- **Budget surface** — the packet card shows credit cost before fetching and last-fetched date; a free-tier operator sees the same ladder with corpus fields marked unavailable.
- **Credential wiring** — `HASDATA_API_KEY` env var (Doppler `local`/`prd`), surfaced via a `hasdataApiKey` getter in `unifiedConfig` alongside `googleMapsApiKey`; never in source. Missing key → warn-and-skip, matching `MarketingGbpEnhancerService`'s `GOOGLE_MAPS_API_KEY` behavior — the render proceeds with `ground_truth: unavailable`, the feature simply doesn't exist for unconfigured envs.

### 14.3 Companion spec

The pipeline itself — `HasDataGroundTruthService` (resolve → fetch → cache → format into `=== GOOGLE MAPS GROUND TRUTH ===` + `verification_path` emission) — is specified separately; this document consumes its output and defines the directive contract above.
