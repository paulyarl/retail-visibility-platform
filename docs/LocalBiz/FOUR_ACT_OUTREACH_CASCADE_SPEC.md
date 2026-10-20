# Four-Act Outreach Cascade Spec

Status: DRAFT (revised 2026-10-19: source verification §10; operator decisions logged §9; gap-fix decisions §11; execution surfaces + VAST add-on §11.6)
Date: 2026-10-19
Scope: Operator outreach to directory-presence seed prospects and marketing-ops campaign prospects — multi-channel cascade design, gating rules, and platform touchpoints. This is a strategy/ops spec, not an implementation spec; §7 maps each act to existing machinery and names the routing change needed for channel attribution, without prescribing new schema.

## 1. Insight & Goal

Walk-in is the highest-leverage outreach channel for local retail prospects — the
pitch demos in fifteen seconds on a phone because the product (a live directory
listing) is physical and visual. But it is also the most expensive channel:
drive-time, cold-open risk, and owner-absent failure modes make it unsuitable as
a spray channel across a prospect batch.

The cascade resolves this by treating outreach as a **funnel with gates**, not a
message sequence. Each act has one job and one exit gate; a prospect either
advances or disqualifies. The remote acts run cheap across the whole batch —
the expensive act (walk-in) fires only on verified, warmed prospects, scheduled
from engagement signal and owner floor-hours collected upstream.

**Goal:** claims per walk-in, not touches per prospect. The cascade exists to
make face-time conditional on signal.

**Publish is an asset with two yield streams; announce is the one-shot
harvest.** A published seed earns passively — shelf value for shoppers,
indexing, and the organic path: an owner who discovers the listing and files a
`directory_claim_requests` self-converts at zero operator spend, the cheapest
conversion in the system. The controlled path spends a different,
non-renewable asset — announce novelty: "we built a listing for you" can be
said exactly once, and it lands as gift only while the owner hasn't already
found it. The two paths interact in one direction only: a *late* announce —
one that arrives after organic discovery — spends the reveal awkwardly ("we
see you found it" instead of "we built this for you").

The publish→announce gap is therefore not waste to eliminate — it is the
organic window, and its cost is a platform burden, not a prospect cost: the
queue management and the occasional post-discovery announce are the price of
keeping the cheapest conversion channel open. Publish stays early and free
(after QC); never hold a seed in draft to protect announce novelty — that
trades away shelf value and the organic path to protect narrative control. The
queue's job (§2.0) is keeping the *controlled* path timely, not ledgering the
gap as loss. The same timing logic governs the claim surface: the token mints
at publish, but the link is not distributed until announce (§2.0; revised
2026-10-19 — see §11 B2), so no claim link reaches the owner before the owner
is being told.

**Core sequencing principle:** the opener's job is not conversion — it is to
create a reference point that makes the *next* touch feel like a follow-up
instead of a cold contact. Awareness → show → tell.

**Intelligence context is the differentiator.** The channel sequence is
commodity — any cadence tool orders touches. What a context-free cascade
cannot do is arm each touch with prospect-specific evidence (the triad below):
C3 exists because an audit ran — "your Google listing shows a different phone
than your Yelp page, still accurate?" is a question a competitor literally
cannot ask; the archetype picks which pain leads for this business type; the
briefing writes what the operator says; and the gallery's own telemetry
(`screenshot_index`, `dwell_ms`, sibling attribution) tells act 4 which
diagnostic the owner actually studied. A context-free walk-in is a cold
conversation; this one continues a dialogue the prospect already had with
their own data. The intelligence also compounds — logged outcomes and gallery
events sharpen each subsequent touch and the next `engagement_cycle`, so
context accrues instead of resetting per send.

## 2. Act Structure

| Act | Name | Primary channel | Job | Exit gate |
|---|---|---|---|---|
| 1 | Verification | Phone call (batched or standalone components, §2.1). Precondition: seed published (§2.0) | Operational + contact channel on record + ≥1 confirmed or desk-confirmed pain |
| 2 | Awareness | Mail (QR-coded) or email | Name the pain — no pitch | Artifact delivered |
| 3 | Show | Email + gallery link | Show the pain — their actual diagnostic | Gallery event fired (or tagged QR scan, once §7 tagging lands) |
| 4 | Tell | Walk-in | Consultation + live claim demo | — |
| — | Residual | Text / phone / DM | Nudges for engaged-but-unclaimed | — |

**Operator shorthand — VAST.** The four acts are surfaced to the operator as
**VAST**: **V**erification → **A**wareness → **S**how → **T**ell. VAST is a
presentation/placement name for the act strip and cards; it does not change the
act definitions, gates, or sequencing. The execution surfaces are in §7 and
§11.6.

### Required inputs — the decisiveness triad

Each act executes from a prepared dossier, not improvisation. Three upstream
artifacts must exist before the cascade runs on a prospect; together they make
every act decisive — the operator never invents the fact, the framing, or the
follow-up on the spot.

| Input | Artifact | Feeds |
|---|---|---|
| **Business audit** | The campaign's `business_analysis` audit + discovery evidence (`business_snapshot`, `discovery_provenance`) | The C3 fact + desk pre-check (act 1); the one-stat teaser (act 2); the gallery diagnostics (act 3); the demo talking points (act 4) |
| **Archetype campaign** | The campaign record — `campaign_category`, `repair_track`, resolved archetype, siblings, triage priority | Which pain leads each touch (act-2 mail ordering, §2.2); the archetype-aware opener copy (`OutreachOpenerService`); the chip/log anchor; the multi-gallery composition (act 3) |
| **Playbook briefing** | The briefing family — engagement brief, archetype/issue briefing templates, the generated call script (`CallScriptService`), archetype openers/closers | What the operator says at every act: C1–C4 phrasing, the postcard copy, the follow-up framing, the walk-in consult |

A prospect missing any leg is not cascade-ready:

- **No audit** → no verifiable pain → C3 has nothing to ask and act 3 nothing
  to show.
- **No campaign** → no logging anchor, no archetype for copy, no gallery —
  the queue's chips degrade to verify-only (§2.0).
- **No briefing** → the operator improvises the pitch, which is exactly how
  the micro-ask rule and the honest-framing rules get broken.

The §2.0 publish precondition sits on top of this triad — a published listing
with no audit behind it announces a hollow page.

### 2.0 Precondition — the seed must be published

Act 1 only works if the owner can see the listing it is verifying. A draft seed
is a private record, so a call that asks the owner to confirm it has nothing to
point to. The precondition is explicit:

**Gate:** at call time, seed `status` is `published`, or `invited` with an
active claim token the call can reference. A seed in `draft`, `suppressed`, or
`claimed` does not run act 1. A `claimed` seed has an owner already and goes
down the claimed path instead.

The seed status values are `draft`, `published`, `invited`, `claimed`, and
`suppressed`. The schema default is `draft`, so every new seed starts unpublished.

**What publish does (verified in source):**
- `publishSeed` sets the listing `is_published`, sets the seed to `published`,
  and writes the tenant's directory settings. The listing goes public.
- `approveAndInvite` publishes and mints a claim token in one call. A seed can
  reach `invited` without a separate invite step.
- Publishing a campaign-linked seed fires `SeedOutreachTriggerService`. It
  resolves a claim URL (minting a token if none is active), composes the
  announcement, and writes a scheduled outreach row (`outreach_state` →
  `outreach_scheduled`). **It does not send anything.** Delivery is operator-
  driven. Its channel is chosen phone, then email, then other (§2.0 announce
  routing below).
- Idempotent per seed: a seed with an existing announcement row is skipped, so
  a re-publish does not re-announce.

**Claim-token policy (revised 2026-10-19, Q3/Q20).** The token mints at
publish, as the trigger already does. The *distribution* rule is the load-
bearing one: the announce is the first time the link is put in front of the
owner. Mint-at-announce was considered and rejected for cohort 1 because the
claim-kit cards require an active token, the PG preflight path mints at
seeding, and keeping the publish-time mint avoids a second mint path and the
successor-seed publish-state regression (a live `invited` seed would otherwise
birth a draft successor on category promotion). The announce SOP below still
requires the tracked `/qe/{code}` link and QR; it uses the token minted at
publish. See §11 B2 for the decision record and the rejected alternative.

**Announce is the SOP for every publish.** Every publish is announced. Publish is
the trigger, and the announce is the first act 1 contact for that seed. Its
channel depends on what is on file:
- **Phone (most common):** the announce is a call. It runs as Variant A (§2.1),
  so C2 is the announcement and C1, C3, and C4 are asked on the same call.
- **Email:** the announce is an email, and it is trackable only if it uses the
  tracked link. The trigger's default message contains the long, tokenized
  `/place/claim/{token}` URL as plain text, with no QR. The claim kit provides a
  tracked `/qe/{code}` QR link and a `/c/{code}` short link. Announce emails
  must use the tracked link and embedded QR under the policy below. Email signals engagement and conversion. It
  cannot verify C1 (status), so the prospect still needs a call or a confirm
  response before the gate can clear.
- **Other (no phone or email):** the trigger notes that the operator must find a
  contact. Act 1 falls through to the confirm-postcard fallback (§2.1).

**Announce is cold by design.** Its purpose is signal gathering (operating status,
contact channel, pain response, claim interest), not consent. Routing order:
1. **Phone**, if the number reaches the owner: the announce call (Variant A or B).
2. **Email**, if on file: the tracked announce (SOP below). A *tracked signal* is
   a `claim_invite_email` QR scan on the seed's token, or a claim request on the
   seed. No tracked signal within a window (§9, Q16) moves the prospect to the follow-up step.
3. **Text**, excluded from cold announce and follow-up. A marketing text to a
   wireless number needs prior express written consent (§8), which cold contact
   cannot obtain. Text is available only after an owner opt-in through a
   documented channel.
4. **DM**, announce-capable, the same as mail. The DM carries the tracked social
   QR (`qrUrlSocial`, `/qs/{code}`, surface `claim_invite_social`) and the claim
   link. The QR is the DM's telemetry, as it is for mail. DM sending is manual
   (no DM send path in the platform), and the handle comes from the listing's
   `social_instagram` or the seed's social profiles.

**Announce content standard.** Every announce, on every channel, carries:
- platform identification (who is sending, and that it is a directory platform)
- a platform phone number and email the owner can reach
- the platform's social handle
- the tracked claim link, with its QR where the channel supports images (mail, email, DM)

The platform commits to the same reachability it expects of prospects: the
contacts in the announce must be staffed.

**Identification source (verified).** The block reads from the platform settings
record, `platform_settings_list`, through `loadPlatformBranding()`. That is the
same source the receipt PDFs use. It provides the platform name, logo, contact
email, contact phone, contact address, and social handles (`social_facebook`,
`social_twitter`, `social_instagram`, `social_linkedin`, `social_youtube`).
Fallback is a static, dated snapshot of the contact surfaces active on the day it
is implemented. "Active" means the same channels a live contact would use that day.
The snapshot is honest capture, not a guarantee over time. Platform settings are
database-driven and can drift, but they are expected to always resolve, so the
fallback path should be rarely used. That makes drift easy to miss, so each
announce records the values it used and the snapshot date. A required field with
no active surface blocks the announce. The receipt defaults in
`loadPlatformBranding()` count only if they were active on the snapshot day (§9,
Q17).
The operator's sign-off (`{{sender_name}}`) sits under this block and does not
replace it (§9, Q17).

**The `owner_contact_consent` flag does not gate announce.** It defaults to
`false` for mined seeds, which is the normal state for cold contact. The admin UI
labels `false` as "Not given — do not contact," which contradicts the cold-contact
design. The announce trigger does not read the flag. Decided 2026-10-19: the flag
is relabeled as owner-initiated opt-in only — it records an owner opt-in, never a
permission to cold-contact; counsel reviews the cold-contact basis separately
(§9, Q11, Q14).

**Verification workload is in the announce.** The trigger takes the seed's
`owner_phone` first, then the campaign phone, with no check that the number
reaches the owner. Phone-channel announce calls therefore carry contact
verification too (C4): wrong numbers, main lines, and screeners are found on the
announce call, not before it.

**Announce queue (decided 2026-10-19, Q1; refined in sweep; gap-fixed §11
B1/B3).** Announce is status-driven, but `outreach_state` is not a delivery
signal: `owner_contacted` means "any contact attempt" (including voicemail and
no-answer), and `freshness_verified` can be entered without C2. The queue
therefore reads a dedicated marker on the seed's canonical touch ledger:
`directory_seed_outreach_touches` with outcome `announce_scheduled` (written
at publish) and `announce_delivered` (written when the operator records the
actual announce). The queue is every `published`/`invited` seed with **no**
`announce_delivered` marker. An `announce_scheduled` marker is optional: it
supplies the pre-composed channel/claim context, but legacy or manually
published seeds without one still appear in the queue (channel falls back to
the seed/listing contact). The queue therefore cannot silently drop a
published seed just because the publish-time marker is missing.
`outreach_state` continues to track the courtesy-window/verification
lifecycle; it is not the queue predicate. Each row carries its **age** — days
since `dps.published_at` (verified) — sorted oldest-first so the worst
unannounced gaps are identifiable at a glance. Publish stays continuous;
announce runs in daily call blocks, so publish volume sets queue volume. The
queue surfaces in the cascade-aware panel (§7; §9, Q19). The marker rows are
system-generated (never counted as operator contacts), and the courtesy job's
`no_response` transition no longer removes a seed from the queue.

**Aging rule.** The queue tracks controlled-path coverage, not a decay ledger
(§1): publish volume is paced to announce capacity, and seeds aging past the
announce window are flagged — the longer the gap, the likelier the announce
lands after organic discovery and spends the reveal awkwardly (§9, Q22).

**Row actions reuse the existing comms modals.** Each queue row carries the
same action chips the prospect communications worklist (`ProspectCommsPanel`,
the PG cockpit's Communications tab) already renders by lifecycle:

- **Resolve** — `ResolveVerificationModal`, the shared verification modal that
  doubles as the call log for gated prospects.
- **Log touch** — `ProspectTouchLogModal`, the canonical `logProspectTouch`
  for seeded, pre-campaign prospects (advances the cadence ladder).
- **Log contact** — `LogContactModal`, the full method/message/outcome capture
  on the campaign outreach log, for campaign-backed prospects.
- **Channel chips** — the resolved contact channels inline (verified NAP
  first, then discovery evidence, via `resolveProspectChannels`), so the
  operator dials or copies without leaving the row.

The chip set resolves per seed through its campaign/queue anchor, then falls
back to the seed's `owner_phone`/`owner_email` and the listing's phone/email;
a seed with no resolvable anchor still has a dialable listing number. For a
campaign-less seed, "Log contact" has no campaign log anchor and "Log touch"
has no queue entry: use the seed's own touch route
(`POST /presence-seeds/:id/touches`) with the C1–C4 capture described in §2.1,
or render the row verification-only. The shared modals' entry shapes must be
adapted for seed rows; they are not reusable verbatim (§11 B4).

**Announce email SOP (policy).** Every announce email for a seed uses the tracked
claim link and the embedded QR. The steps below are an operator policy, not
automation. Nothing in the platform embeds the QR today.
0. If the seed has no active claim token (the "No active claim token" notice
   on the seed page), click **Generate Claim Invite** first. The card does not
   mint on open; publish-time mint covers campaign-linked and PG-preflight
   seeds, not every manual seed.
1. Open the seed detail page and go to the claim **Email link** card. It opens the
   claim QR designer for the `email` variant.
2. Confirm the QR encodes the email variant URL (`qrUrlEmail`, `/qe/{code}`).
   Do not use the trigger's `/place/claim/{token}` link.
3. Click **PNG** and download `claim-qr-email-{size}px.png`. Use the shared
   design the seed has saved, if any.
4. Embed the PNG in the announce email, and link the text to the same `/qe/{code}`
   URL the QR encodes. Every click then goes through the tracked redirect.
5. Log the send in the outreach log with the channel (`email`) and the link type
   (`qe_tracked`). Without this, a later review cannot separate tracked sends
   from default ones.
6. If the claim token is re-issued, the QR and link change. A QR from an earlier
   send is stale. Re-download before any resend. (Re-issue voids prior unclaimed
   tokens, per the `PostalMailerService` note.)

Scan and conversion signals then come from `qr_scan_events` (`claim_invite_email`)
and the claim outcome (§10).
- Revoking the last active claim token flips `invited` back to `published`.

**Pre-call checks (every prospect, same day as the call):**
1. Status is `published` or `invited` with a live token.
2. The announcement row: has the owner already heard about the listing by
   another channel? If so, the call acknowledges it instead of acting as a cold
   first contact.
3. Desk pain re-check (§2.1) passed on the published listing's data.

**Publish QC:** the listing's mined data (hours, attributes, categories, SEO,
NAP) is QC'd before publish. The seed detail "Publish Listing" step is where
that happens. Publish is not a shortcut around QC.

**Publish-path coverage (corrected in gap fix §11 B3).** The sweep's claim
that `onSeedCreated` fires only from `createFromCampaign` is stale: the single
`POST /presence-seeds/:id/publish` route already fires it when the seed has a
primary campaign link. The actual matrix is:

| Path | Fires trigger? | Mints at publish? | Announce anchor |
|---|---|---|---|
| `createFromCampaign(publish:true)` | yes | yes | campaign log + seed marker |
| `POST /presence-seeds/:id/publish` (primary link) | yes | yes | campaign log + seed marker |
| `POST /presence-seeds/:id/publish` (no link) | no | no | seed touch ledger |
| `createSeedsForProvingGround` (PG preflight) | no (add) | yes | campaign log (if source campaign) + seed marker |
| `publishBatch` | no | no | seed touch ledger; batch stays operator-composed |
| `approveAndInvite` (suggestion/owner submit) | no | yes + email | owner-initiated; exempt from cold announce |

Every published seed gets an `announce_scheduled` marker in
`directory_seed_outreach_touches`; campaign-linked seeds additionally keep the
`mkt_outreach_log` row the trigger writes. Batch-publish remains outside the
scheduled-announce path by decision (volume + no audit corpus); its seeds
still appear in the queue as unannounced and are operator-composed.

**Re-check before the walk-in (§2.4):** status can change after the call
(suppression, claim, or token revocation). Confirm it again on the day.

Publish schedules the announcement, and the announce channel decides how act 1
runs. See §9, Q1.

### 2.1 Act 1 — Verification

Act 1 is four components. Each is one question and produces its own record.
It runs only when §2.0 holds.

| # | Component | Question | Record |
|---|---|---|---|
| C1 | Status | Is the business operating? | operational / closed / unknown |
| C2 | Announce | Tell them the listing is published | delivered / not delivered |
| C3 | Pain | Is this specific fact still true? (one fact, chosen in the desk pre-check) | confirmed / disputed / not asked |
| C4 | Channels | Owner's name, a direct contact (not `info@`), permission to send a follow-up | channel(s) + permission yes/no |

**Order is fixed: C1 → C2 → C3 → C4.**
- Status comes first. A closed business ends the sequence before anything is
  announced.
- Announce comes before pain. The owner can check the published listing while
  answering the pain question.
- Channels come last. The permission ask is the exit.

**C2 opener** (draft, for a seed the owner has not heard about):

> "We've published a listing for your business on our local retail directory.
> I'm calling to confirm it's accurate before we follow up with you about it."

If the owner already heard about the listing by another channel (for example an
earlier email), the opener acknowledges it:

> "You may have seen a message from us about a listing we've published for
> your business. I'm calling to confirm it's accurate before we follow up."

Either version is a true description of the call and discloses that follow-up
is coming.

**Variants**

- **A — batched.** All four components on one call, in order. Used when the
  owner is reached and has the time. The call exits on C4 permission, or stops
  at the first component the owner declines. The remaining components are
  recorded as not asked.
- **B — standalone.** Components run as separate contacts, each recording its
  own result. Use when the owner won't take the full call. Examples:
  - *C1 + C4:* status and contact only. This clears the record portion of the
    gate without C2; it clears the full act 1 gate only when a desk-confirmed
    pain already exists. If pain stays "not asked" and there is no desk
    confirmation, act 3 waits for C3.
  - *C2 alone:* the announcement goes by email or mail on a second touch. The
    act 2 artifact can carry it, so no call is needed.
  - *C3 alone:* only when status and contact are already on file and a pain
    still needs confirming.

  The order still holds across contacts. C1 precedes C2 in every variant, so a
  standalone C2 is never sent for a business not yet confirmed operational.
- **C — no answer.** Falls through to the fallback path below.

**Pain outcomes (C3)**
- *Confirmed (owner):* clears the pain requirement. The gallery shows it.
- *Disputed:* the owner says the fact is wrong or fixed. That pain is dropped,
  and the gallery must not show it.
- *Desk-confirmed:* the owner was not asked about this fact, and the desk check
  still holds. This clears the gate but is flagged as unconfirmed.
- *Not asked:* no pain status yet. It does not clear the gate.

**Gate (act 1 exit):** C1 operational, and at least one C4 contact channel on
record, and at least one pain that is confirmed or desk-confirmed.

**Component records map to existing machinery** (corrected in gap fix §11 B4):
- C1 → `callDetails.operating_status_confirmed` → `freshness_verified` (or a
  wrong-number outcome → `freshness_failed`).
- C2 delivered → an `announce_delivered` row on
  `directory_seed_outreach_touches` (the delivery marker; not
  `owner_contacted`, which also covers voicemail/no-answer).
- C3/C4 → the existing structured `verification_results` array on the
  campaign outreach log (`fact_confirmed` / `fact_disputed` /
  `pain_confirmed` / `pain_not_present` / `follow_up_requested`), and the same
  shape in the seed touch metadata for campaign-less prospects.
- `call_details` is a closed object and is not the place to add new keys.

**Permission rule (gap fix).** A C4 channel on record clears the *record*
gate, but acts 2–3 are permissioned follow-ups: a `permission: no` (or a
declined ask) blocks email/DM follow-ups for that prospect. Mail remains
available only where counsel has cleared cold mail for the cohort. Record the
permission outcome in `verification_results` (`follow_up_requested` or the
absence of it) so the panel can enforce the block.

Byproduct: the call manufactures a name. "I spoke with Maria last week"
converts act 4 from cold to warm on arrival.

**Micro-ask rule:** one question per component. A batched call is at most four
questions, in the order above. No pitch content — awareness belongs to act 2.

**Desk pre-check (before any component):** re-verify the diagnostic against the
originating scan/audit, and pick the one fact C3 will ask about. Re-run the
check again before the walk-in. A pain the desk check cannot confirm is not
asked as if it were settled.

**Not collected on the call:** texting consent (§8 — verbal consent is not
sufficient) and floor hours. Take floor hours only if the owner offers them.
If they are missing, the walk-in is scheduled by the operator after the owner
replies to the follow-up.

**Fallback path:** unreachable by phone (screening, no listed number, owner
never answers) does not disqualify. The gate is *record verified by any
channel*. DM and mail are peers in the fallback (decided 2026-10-19, Q15):
when a social handle exists, DM goes first — it carries the tracked social QR
(`/qs/{code}`) so it has its own telemetry — and mail follows if no DM response
within the window (§4). With no DM handle, mail is first. The mail fallback is
a "confirm your listing" postcard with a QR code (or short URL) to a confirm
page; a scan or a form submit counts as verification. A postcard with no
response path cannot verify anything and does not clear the gate.

#### 2.1.1 Verification call script (draft)

Batched Variant A — roughly 60–90 seconds. Standalone variants lift the
relevant component verbatim. Every line is either a required disclosure or one
of the four component questions; nothing else is said unless the owner asks.

**Pre-dial:** number cleared against the Do Not Call registry (§8); §2.0
pre-call checks pass; desk pre-check has picked the one C3 fact.

**Identity** (required disclosure, not a component):

> "Hi — this is [sender name] calling from [platform name]. We run the local
> retail directory for [city/region]."

**C1 — Status** (one question):

> "Just to confirm — is [business name] still open at [street address]?"

If the owner reached is on the business's listed number during business hours,
"operating" is nearly self-evident; the question confirms the record rather
than interrogating them. A "we closed" answer ends the call here — record
`closed`, nothing is announced.

**C2 — Announce** (statement; the §2.1 openers):

> "We've published a listing for your business on our local retail directory.
> I'm calling to confirm it's accurate before we follow up with you about it."

Or the already-heard variant when the announcement row shows a prior touch.
Record `delivered` once said — the owner does not need to respond for the
announce to count.

**C3 — Pain** (one question, the desk-picked fact):

> "While I have you — our records show [one specific fact]. Is that still
> accurate?"

The fact is stated, not pitched: "your Google listing shows a different phone
number than your Yelp page," not "your online presence is hurting you."
Outcomes per §2.1: confirmed → the gallery may show it; disputed → drop it
and never show it; not reached → record `not asked`.

**C4 — Channels + permission** (one question — the exit ask):

> "Before I let you go — could I send a short follow-up to you directly, and
> what's the best email for that?"

One ask that collects the three C4 fields: the right person ("to you
directly"), the channel, and the permission. If the owner gives a counter
email instead, record it — the permission was still granted. A declined ask
records `permission: no` and the call ends.

**Decline and exit rules:** the call exits on C4 permission, or at the first
component the owner declines — remaining components record `not asked`. No
component is re-asked on the same call; a declined C3 stays declined.

**Owner not in:** staff can answer C1 (it is factual) but C3/C4 wait for the
owner or manager — pain and permission are owner decisions. "Is the owner or
manager around? I'll keep it under a minute."

**Voicemail** (the common case — discloses listing and follow-up, per the
honest-framing rule):

> "Hi, this is [sender name] from [platform name] — we run the local retail
> directory, and we've published a listing for [business name]. I'm calling to
> confirm it's accurate, and we'll follow up by [mail/email]. You can reach us
> at [platform phone] any time. Thank you."

A voicemail is not a delivered announce — C2 counts only when spoken to a
person — but it is a logged touch and names the follow-up honestly.

**Not asked, ever:** texting consent (verbal does not qualify, §8) and floor
hours unless the owner volunteers them (§2.1).

### 2.2 Act 2 — Awareness

One provocative, data-backed fact about *their* business — "your Google listing
says X, Yelp says Y," "you're invisible for [category] searches." No pitch, no
offer, no ask. It plants a question; act 3 answers it.

**Mail-first for this market.** A physical postcard with one damning stat is
unmissable and on-brand for a platform selling physical shelf presence — email
teasers get deleted, postcards sit on the counter. Email is the alternate when
postage/turnaround matters or the prospect's data quality favors it.

**The postcard carries a QR code, so it is a link.** Every mailer from
`PostalMailerService` embeds one (§7). That QR is also the mail channel's
telemetry: a scan is a recorded signal. Mail is therefore not silent when it
carries a QR. A scan records that someone engaged; it does not prove the
recipient read the card.

**QR destination (decided 2026-10-19, Q5):** a confirm page that serves both
roles — it names the one fact (the confirm/awareness role) and leads onward to
the gallery (the show role). The prospect sees one targeted, organized
destination instead of two artifacts; acts 2 and 3 stay separate in the funnel
even though the page serves both. Build item: §9, Q18.

**The postcard needs a CTA.** Naming a fact with no next step leaves the
artifact mute — the QR is the action ("confirm your listing is accurate" or
equivalent). A CTA is required even though the artifact carries no pitch.

**Mail has a per-piece cost, so send order is triage-driven.** The postcard
budget follows the campaign's playbook triage priority — the strongest pain
signal mails first — rather than batch order.

Acts 2 and 3 may still compress into one touch for thin-data prospects or
compressed timelines; that is an operator call, not the default.

**Non-salesy is load-bearing.** If acts 1–2 feel like spam, the walk-in
inherits "oh, it's that guy" instead of "oh, it's *you*." The awareness
artifact names a fact and offers nothing beyond the QR destination.

### 2.3 Act 3 — Show (the gallery)

Email carries the multi-diagnostic gallery link — screenshots of the
confirmed pain(s): review gap, listing drift, product invisibility, whatever
act 1 verified. This is the act with telemetry: `mkt_gallery_events` records
who looked, at which diagnostics, and how long, with `sibling_campaign_id`
attribution for multi-archetype prospects.

**Telemetry limit (verified in source):**
- Postcard QRs resolve through `/g/{short_code}`, which redirects to
  `/preview/{token}` (with `?prospect=true` for multi-gallery tokens). The
  redirect adds no channel marker.
- `mkt_gallery_events` has no channel or QR-source column. A postcard scan and
  an email click on the same token therefore produce the same kind of row.
- Until the act 2 QR gets its own tag (§7), the act 3 gate means "gallery
  viewed by any channel." The spec should not claim more than that.

The gate event is a `gallery_opened` on the campaign's token or a tagged scan
of the **gallery** artifact (once §7 tagging lands) — either clears it
(decided 2026-10-19, Q10); operator overrides are recorded (§2.4). No event →
residual follow-up, not face-time.

**Which scan counts (gap fix §11).** The act-2 postcard QR points at the
confirm page, not the gallery. A scan of that QR is act-2 delivery (and, if
the page's form is submitted, act-1 verification), but it is **not** by itself
an act-3 gate event. The act-3 gate clears when the prospect subsequently
opens the gallery (`gallery_opened`, whether reached from the confirm page's
CTA or the act-3 email) or scans a QR that is tagged to the gallery artifact.
This keeps the "12 aware → 7 cleared" step meaningful; a confirm-page scan
without a gallery view is awareness, not show.

### 2.4 Act 4 — Tell (the walk-in)

A consultation, not a cold open: "I'm the one who sent the report." The live
demo — their published seed listing and the claim flow — lands on primed
ground.

**Gate rule (single rule):** a walk-in is booked only for prospects who cleared
the act 3 gate, or who replied to the follow-up asking for a visit. An operator
override on a Cluster A prospect with a strong desk-verified pain is allowed,
and must be recorded as an override.

**Pre-visit check:** the §2.0 precondition holds on the day of the visit, and the
claim link has been tested. A walk-in to a draft or suppressed seed fails at the
demo.

The walk-in demo does not depend on upstream acts — the content of the visit
works without them — but the visit itself is scheduled on signal. Exit line
converts the visit into a trackable next step: "I'll send you the claim link"
— the token (`/directory/claim/:token`) goes out same-day by the permissioned
channel.

### 2.5 Residual channels

- **Text** — the bump. Highest open rate; written permission only (see §8).
  "Link got buried?" nudges for engaged-but-unclaimed prospects.
- **Phone** — the conversation converter for engaged non-claimers; voicemail
  references the visit and the email.
- **DM** — announce-capable with a tracked social QR, like mail (§2.0). Manual
  sending. Outside the act sequence it remains a residual channel for owners who
  are socially active.
- **Re-engagement** — a prospect who goes cold stays claimable; the next round
  is a new `engagement_cycle` on the campaign, not a new cascade from scratch.

## 3. Channel Triage Rationale

| Channel | Role | Strength | Cost/risk |
|---|---|---|---|
| Walk-in | Tell (act 4) | Highest trust per touch; the demo IS the product | Most expensive per touch; owner-absent risk; cold-open if unprimed |
| Email | Artifact carrier (acts 2–3) | Carries claim + gallery links; referenceable; trackable | Most ignorable cold channel |
| Mail (QR-coded) | Awareness (act 2) | Unmissable; on-brand physicality; QR gives scan telemetry | A scan is not a read; slow; postal transit adds days; channel attribution needs tagging (§7) |
| Phone | Verification (act 1) + residual | Reaches owner directly; lowest-ask opener | Screening; gatekeepers |
| Text | Excluded from cold announce; available only after owner opt-in | ~98% open rate | Cold marketing texts to wireless numbers need prior express written consent (FCC). Announce is cold by design, so text is out |
| DM (tracked social QR) | Announce, like mail; residual | Carries the QR and claim link; the QR is telemetry | Manual sending (no platform send path); inbox noise; requires the identification block |

Two guardrails fall out of the triage:

- **Channel availability dictates the per-prospect cascade.** Each prospect's
  cascade is "my ordered list of available channels," not the full ladder.
- **Pair non-trackable touches with a trackable follower within 48h.** A
  walk-in fails silently if the owner was out, and mail without a QR is
  silent. Mail with a QR is trackable and does not need a follower under this
  rule.

## 4. Cadence

| Day | Act | Notes |
|---|---|---|
| Pre-batch | Publish (§2.0) | Each seed published after its QC. Publish stays continuous; announce runs in daily blocks from the announce queue (§2.0). Confirm the status before dialing |
| 0 | 1 — Verification call | Batch-callable; all 20 in a morning, each only if §2.0 holds. Desk pain re-check done beforehand |
| 0–1 | 2 — Awareness postcard | Postmark day 0–1. Email alternate sent same day |
| 5–7 | 3 — Gallery email | After expected postal arrival. Sent only to verified prospects |
| 8–12 | 4 — Walk-in window | Route built from gate-cleared prospects and owner replies |
| No tracked signal within 5 days | Announce follow-up | Email re-send, or DM with the tracked social QR, per §2.0. Text only after an owner opt-in |
| 12+ | Residual nudges | Text/phone/DM on engaged-but-unclaimed, where permitted |

The earlier draft put the awareness postcard on day 2–3 (while its notes said
postmark day 0–1) and the walk-in on days 7–10. That sent the gallery email
ahead of the postcard's likely arrival, reversing the intended order. The
timings above are assumptions until measured against actual postal transit.

Momentum decays — the prospect should still remember the postcard when you walk
in. Compress, don't stretch.

## 5. Segmentation

Twenty prospects is not one bucket. Triage before act 1:

- **Cluster A — drivable + reachable:** full 4-act cascade.
- **Cluster B — strong digital footprint, not drivable:** acts 1–3 run remote;
  act 4 degrades to the highest-bandwidth available channel (phone/video call).
  The structure survives distance; the walk-in doesn't.
- **Cluster C — thin data (name/address, no working phone):** the mail QR is
  the verification path. The confirm-your-listing postcard (§2.1) doubles as
  act 2; a scan verifies the record; the gallery follows; the walk-in happens
  only if the gate clears.

## 6. Funnel Model (illustrative, 20 prospects)

```
20 prospects
 └─ 14 verified (operational, contact on record, ≥1 confirmed or desk-confirmed pain)  ← act 1 gate
     └─ 12 aware (artifact delivered)                                 ← act 2 gate
         └─ 7 cleared the gate (gallery opened or tagged QR scan)     ← act 3 gate
             └─ 4–5 walk-ins scheduled                                ← face-time on signal
                 └─ 2–3 claims
```

The economics: acts 1–3 cost days and postage across the whole batch. Act 4
costs a half-day of driving, spent on the 4–5 walk-ins scheduled from the 7
prospects (35% of the batch) who cleared the gate. Walk-in-first would spend
the same half-day blind on all twenty.

All numbers are hypotheses to measure, not results. The 12→7 step in particular
is an assumption about gallery engagement that the first cohort should test.

**VAST ↔ funnel.** The operator shorthand maps directly to the measured
stages: **V** = verified (act-1 gate), **A** = aware (act-2 artifact), **S** =
gate-cleared (act-3), **T** = walk-in scheduled/done (act-4). The cohort report
(`SeedCascadeCohortService`) reports these stages directly, so the VAST board
and the funnel cannot drift.

## 7. Platform Touchpoints

| Act | Existing machinery (verified in source) |
|---|---|
| 1 — Verification | `mkt_prospect_queue` (`business_snapshot`, `verified_nap`, `discovery_provenance`); `ResolveVerificationModal`; desk pain re-check against the originating scan/audit |
| 2 — Awareness | `OutreachOpenerService` archetype-aware opener copy. `PostalMailerService` generates a 4x6" postcard PDF with a QR code. The QR destination is operator-selectable: auto (claim → portal → gallery → site), gallery, claim, portal, site, or a custom URL. The QR can be a styled PNG from the QR designer. No automated email surface |
| 3 — Show | Multi-diagnostic gallery token (`POST /prospects/:prospectId/multi-gallery-token` → `/preview/[token]?prospect=true`); short code `/g/{code}` redirects to `/preview/{token}`; `mkt_gallery_events` (has `sibling_campaign_id`; no channel column) |
| QR scan telemetry (model) | Seed mail already tracks scans: `/r/seed/{seedId}/{channel}` records to `qr_scan_events` under the channel's surface. `ProvingGroundCadenceService.getMailScanOutcomes` reads `qr_scan_events` for `claim_invite*` / `report_delivery*` surfaces. `/r/pr/{code}` is the tracked-short-code model for prospect reports. Campaign mailer QRs do not yet use a tagged route |
| 4 — Tell | Published seed listing (live demo surface); claim token mint (`POST /presence-seeds/:id/invite` → `/directory/claim/:token`), sent same-day |
| Residual / re-run | `engagement_cycle` + `POST /:campaignId/cycle` for next-round outreach |

**Routing change for act 2 attribution (decided 2026-10-19, Q6; corrected in
gap fix §11).** The DB accepts any surface string up to 30 chars, but the
TypeScript surface union is closed and the table has no campaign/seed column.
The tag therefore carries the per-prospect identity in `product_id`
(`business_prospect_id` or campaign id, mirroring `/r/pr-scan`), records a new
`QrSurfaceType` (e.g. `cascade_postcard`, `cascade_confirm`), and resolves
through a short code. The `/r/pr/{code}` model is the pattern, not a literal
reuse: `mkt_prospect_report_links` is report-specific. Prefer the existing
`mkt_deliverable_preview_tokens.short_code` + `resolveShortCode` path, which
already re-routes dead codes to the live successor and needs no new table.

**Cascade state (decided 2026-10-19, Q9; corrected in gap fix §11).** Act 1
position rides `outreach_state` plus the `announce_scheduled` /
`announce_delivered` touch markers; acts 2–4 ride the seed touch ledger and
`mkt_gallery_events`. `outreach_state` alone cannot carry act 2/3/4 — it is a
single-valued announce/verification state. The panel shows the announce queue
at a glance and derives act position: act 1 = verification fields/state,
act 2 = a mail/email touch after the announce, act 3 = a `gallery_opened`
event, act 4 = a `visit` touch. Build item: §9, Q19.

**The contact log is the per-act ledger, split by lifecycle (corrected in gap
fix §11).** Post-campaign touches land in `mkt_outreach_log` via
`LogContactModal`; pre-campaign seed touches land in
`directory_seed_outreach_touches` via the seed touch route / `Log touch`. The
two are merged into one prospect timeline by `ProspectCommunicationService`,
which is the panel's read model. Channels already map the cascade (`phone`
act 1; `mail`/`other` for the postcard; `email` for the gallery; `social` for
DM; `in_person`/`visit` for the walk-in). `mkt_outreach_log.call_details`
carries `seed_id` + `seed_outreach='true'` on trigger rows; operator-logged
campaign rows are campaign-anchored, so a seed-only prospect's ledger is the
touch table, not the campaign log.

**Execution surfaces (implemented 2026-10-19).** VAST is the operator-facing
name for the four acts. The same act derivation is surfaced in three places,
each scoped to where the operator is working:

| Surface | Scope | Where | Behavior |
|---|---|---|---|
| **Campaign → Project Plan → Execution** | Campaign-backed prospect | Campaign detail (`#execution`) | `CampaignExecutionPanel`: announce status + Log announce / Mark announced, VAST cards, walk-in gate, recent activity. Resolves the campaign's primary seed via `GET /campaigns/:id/cascade`. |
| **PG cockpit → VAST** | PG-scope queued prospects | Proving Ground cockpit (`#vast`) | `VastPanel`: PG-level act counts, per-prospect V/A/S/T chips, next action, Log announce / Seed / Cascade. Resolves `seed_id` first, then the campaign's primary seed via `GET /campaigns/cascade-batch`; campaign-linked unseeded rows show “No seed (campaign)”; unseeded rows show “Promote to listings.” |
| **Seed detail → Cascade (VAST) card** | Single seed | Seed detail page | `SeedCascadeCard`: announce state + Log announce / Mark announced, VAST act cards, walk-in gate, Full cascade link. This is the seed's own display surface — cascade awareness without a navigation hop. |
| **Seeds admin → Announce queue / Cohort** | Cross-prospect and seed-only | Seeds admin | The announce queue is the delivery worklist (age, channel, Log announce / Mark announced); the cohort page reports the VAST stages as the funnel. |

The existing review-pipeline **Cascade** tab is a different feature
(`ReviewCascadeService`, `cascade_enabled`). The Four-Act surface is deliberately
named **Execution/VAST** to avoid that collision. The “enriched” chip on the PG
Promote tab is shelf-market enrichment, not seed status.

**Act 3 (Show) gate actions.** The execution surfaces do not leave a blocked
Show card inert. The Campaign Execution card and the seed card show the gate
reason and link to the owning surface with the matching action: **Advance to
Preview Built** / **Upload screenshots** / **Generate gallery link** → the
campaign's **Outreach Kit** tab (`?tab=gallery`); **Run business analysis** /
**Resolve archetype** → the **Prompts** tab (`?tab=prompts`). The VAST row
carries the same **Gallery** link when the row has a campaign and Show is not
done. The link is navigation, not a duplicate gallery control — the Outreach
Kit remains the owner of screenshots, eligibility, and token minting.

**Stage advice (implemented 2026-10-20).** The same surfaces also answer the
orthogonal pipeline question — *is the next stage true yet* — without becoming
a second gate. `StageAdviceService` derives a `stageAdvice` block on the
campaign cascade payload (so the campaign Execution tab, the VAST rows, and the
seed card all read one derivation) from the predicates the transition route
already enforces: the archetype hard gate, the checklist soft gate, gallery
eligibility, and the act 1 / act 3 gates. Readiness is `ready` /
`ready_with_ack` / `blocked` / `terminal`; a blocker marked `hard` is a 409 the
operator cannot acknowledge away, so the banner disables the advance and links
the owning surface. The only mutation is the existing
`POST /:id/transition` — the 409 `checklist_incomplete` payload becomes the
acknowledgement list. Two mechanics are encoded because they make the ordering
non-obvious: the mailer is only available up to `preview_built` (§2.2), so the
act-2 postcard must ship before `shown`; and the act-2 confirm page leads
onward to the gallery, so the gallery has to exist before the postcard is
mailed. Advice covers the first four stages and stops at `shown` — what remains
after it (the visit, payment) is not a stage predicate the cascade can observe.
The seek edge resolves with no seed, because that edge is about the audit. Per
§8 this remains a view: no new state store, no new gate.

## 8. Guardrails & Failure Modes

- **Published precondition (act 1).** No call goes out for a seed that is not
  `published` (or `invited` with a live token). The check runs at call time,
  not only at planning time. Publishing is gated on QC.
- **Micro-ask rule (act 1).** One question per component (C1–C4, §2.1). A batched call is at most four questions, and it exits on permission or at the first component the owner declines. Standalone components keep the C1-before-C2 order.
  A verification call that pitches destroys the structure's cheapest advantage.
- **Honest framing (act 1).** The call discloses the listing and the follow-up.
  It does not present itself as only a data check when a sales sequence follows.
- **Non-salesy awareness (act 2).** Names a fact, offers nothing beyond the QR
  destination. Salesy acts 1–2 poison the walk-in's reception.
- **Pain recency.** Desk re-check before act 1 and again before act 4. Stale
  diagnostics are unrecoverable at the walk-in. Never assert a pain without a
  sourced signal — same provenance discipline as seed fields (no inferred
  SNAP/hours/etc.).
- **Attribution honesty.** Until the act 2 QR is tagged, the gate means
  "gallery viewed by any channel," and mail scans count only as gallery
  views. Report funnel numbers with that limit stated.
- **Gate discipline.** Walk-ins are booked from gate-cleared prospects or
  replies. Overrides are recorded.
- **Standalone demo, gated visit.** The demo content does not depend on
  upstream acts. The visit itself is scheduled on signal.
- **VAST is a view, not a gate.** The VAST board and the campaign Execution tab
  derive position from the same seed-touch / campaign-log / gallery ledger.
  They add no new gate and no separate state store; the act gates remain §2.1
  and §2.3.
- **Campaign-linked seed resolution.** For a PG row without a queue-row
  `seed_id`, the campaign's primary seed link is authoritative. Never infer a
  seed from a business name, and never present an unseeded prospect as
  cascade-ready — show “Promote to listings.”
- **Cold text is out.** Announce contact is cold by design. Marketing texts to
  wireless numbers require prior express written consent, which cold contact
  cannot obtain. Text is used only after an owner opt-in through a documented
  channel.
- **Text consent detail.** Marketing texts require prior express written consent.
  Seeds have no SMS consent field. `sms_consent` exists only on customers (default
  `false`), and `owner_contact_consent` is general contact consent, not written
  SMS consent. No SMS send path was found in the API.
  Per FCC consumer guidance, commercial texts require written consent, and
  verbal consent on a call does not qualify. Collect consent through a web form
  checkbox with disclosure language, not verbally. Keep the residual text
  channel off until counsel signs off on the form language and opt-out
  handling. Cold calls also require checking numbers against the Do Not Call
  registry. This is a compliance flag, not legal advice; confirm with counsel.
  Decided 2026-10-19: the opt-in path is a written SMS checkbox on the claim
  page (§9, Q13); the build item is §9, Q21, gated on counsel's language.
- **Announce identification (standard).** Every announce carries platform
  identification, a staffed phone number and email, the platform's social handle,
  and the tracked claim link. The platform is reachable on the same channels it
  asks prospects to use. Values come from `platform_settings_list`; the
  receipt loader (`loadPlatformBranding`) currently returns no social handles,
  so the announce path needs a dedicated branding reader that returns them
  (gap fix §11). The fallback is a static, dated snapshot; the announce logs
  the values it used and the snapshot date. A required field with no active
  surface blocks the announce. The `POST /api/platform-settings` writer is
  admin-authenticated (gap fix §11 B5) so the block cannot be changed by an
  anonymous caller.
- **Tracked announce link (policy).** Announce emails use the tracked `/qe/{code}`
  link and the embedded PNG QR (§2.0 SOP). The trigger's default
  `/place/claim/{token}` text is not sent as-is. Sends are logged with the link
  type. The token is minted at publish (revised Q3); the link is not
  distributed until the announce.
- **Walk-in readiness.** Published seed and tested claim link before every visit.
- **Honest artifacts.** No fabricated stats in awareness copy; the postcard's
  one stat must come from the prospect's own diagnostic data.

## 9. Open Questions

1. **Publish-day announcements vs. batch cadence.** SOP: every publish is
   announced. The trigger schedules one announcement row per seed and sends
   nothing itself, so publish volume sets announce volume. Decide whether
   publishes are held to the cascade's day 0 batch, or announced as they publish.
   **Decided 2026-10-19:** hybrid — publish continuous, announce in daily call
   blocks from the announce queue; the operator sets announce status on delivery
   (§2.0, §7).
2. **Announce channel and act 1 workload.** The trigger picks phone, then email,
   then other. Phone is the usual channel, so most announces are calls that carry
   C1–C4. Two checks follow:
   - The trigger takes `owner_phone` first, then the campaign phone, unverified.
     Decide how a wrong number or a main line is caught on the announce call.
   - Email cannot verify C1. Decide whether email-channel prospects get a call,
     a confirm response, or a hold.
   - Resolved by policy (§2.0 SOP): announce emails use the tracked `/qe/{code}`
     link and the embedded PNG. Remaining check: whether the operator's sending
     tool renders an inline image (the SOP depends on it).
3. **Claim token at publish.** Per the trigger's header comment (not re-read in
   code), it mints a claim token at publish when none is active, which moves the
   seed to `invited`. Decide whether a live claim link should exist before the
   owner has been announced.
   **Revised 2026-10-19 (Q3/Q20, gap fix §11 B2):** mint stays at publish. The
   announce is the first *distribution* of the link. Mint-at-announce was
   rejected for cohort 1 because the claim-kit cards require an active token,
   the PG preflight mints at seeding, and the successor-seed publish-state
   mirror keys on `published` (an `invited` live seed would otherwise birth a
   draft successor).
4. **Verification call script** — drafted in §2.1.1 (C1–C4, one question each,
   identity disclosure, voicemail block). Pending team review and counsel note
   on DNC screening.
5. **Act 2 QR destination:** a claim/confirm page (recommended, keeps acts 2
   and 3 separate) or the gallery (merges them). Operator decision.
   **Decided 2026-10-19:** a dual-role confirm page — names the act-2 fact and
   leads onward to the gallery; postcard carries a CTA; send order follows
   playbook triage priority (§2.2). Build item Q18.
6. **Campaign-mailer QR tagging:** build a tagged short link that mirrors
   `/r/seed`. Confirm whether `qr_scan_events` accepts campaign-prospect surfaces.
   **Decided 2026-10-19:** reuse the `/r/pr/{code}` proving-ground short-code
   model for campaign surfaces; still confirm `qr_scan_events` accepts them (§7).
7. **Gallery email link form:** does the email use `/preview/{token}` or
   `/g/{code}`? Not verified. If the forms differ, the URL alone could separate
   channels, but only if the QR gets its own tag.
   **Verified 2026-10-19 (sweep):** outbound gallery links use
   `/preview/{token}` (`CallScriptService`, token-mint routes); `/g/{code}` is
   the mailer-QR form, and its resolver (`/api/gallery-code/:shortCode`)
   returns token + type only — no scan row. The forms differ but nothing
   records the `/g/` hit, so attribution still needs Q6's tagging.
8. **Postal transit assumption:** measure actual delivery times on the first
   batch and adjust §4.
9. **Cascade state persistence:** does per-prospect act position need a table,
   or are campaign stage, gallery events, and operator notes enough?
   **Decided 2026-10-19:** act position rides the trigger's outreach rows
   (`outreach_state` transitions), surfaced in a cascade-aware panel (§7).
   Build item Q19.
10. **Walk-in gate definition:** gallery opened, tagged QR scan, or either?
    **Decided 2026-10-19:** either, plus recorded operator overrides (§2.3).
11. **Consent form and opt-out language:** counsel review before any text
    residual.
12. **Cadence automation:** reminders vs. fully manual pacing for the first cohort.
    **Decided 2026-10-19:** fully manual for cohort 1.
13. **Owner opt-in path for text (optional).** Text stays excluded unless an
    owner opts in through a documented channel, such as a written SMS checkbox on
    the claim page. Decide whether to build that path at all. Counsel reviews the
    form language and opt-out handling.
    **Decided 2026-10-19:** build the claim-page SMS checkbox — build item Q21,
    gated on counsel (Q11).
14. **Meaning of `owner_contact_consent`.** Cold contact is the design, so the flag
    cannot gate it. The admin UI labels `false` as "do not contact," which
    contradicts cold announce. Decide whether to relabel the flag as owner-initiated
    opt-in only. Then get counsel review of cold email and cold calls to mined
    seeds (CAN-SPAM, TCPA, and Do Not Call considerations).
    **Decided 2026-10-19:** relabel as owner-initiated opt-in only (§2.0);
    counsel review of the cold-contact basis remains.
15. **Operator sequencing for an announce with no contact channel.** Confirm the
    fallback order when the trigger finds neither phone nor email.
    **Decided 2026-10-19:** DM and mail are peers — DM first when a handle
    exists, mail on no DM response (Q16 window); mail first with no DM (§2.1).
16. **Tracked-signal window.** How many days after a tracked announce before the
    follow-up (email re-send or DM). Set the window and an owner for DM sends.
    **Decided 2026-10-19:** 5 days (§4); revisit after Q8 transit data.
17. **Platform identification values.** The source is `platform_settings_list`
    (§2.0). Confirm three things: the admin branding page writes that record
    (I verified the reader, not the writer), the phone and email in it are staffed
    for announce replies, and the social handles are the ones the platform will
    actually answer on. Also decide how the operator sign-off sits under the block.
    Confirm the snapshot: the static fallback values, taken on the implementation
    day, using the channels a live contact would use that day. Decide whether the
    receipt defaults (the billing email and the 913 phone number) are in the
    snapshot. Set a review cadence for it. The fallback is rarely used, so drift
    would otherwise go unnoticed.
18. **Dual-role confirm page (from Q5).** Spec and build the confirm page that
    names the act-2 fact and leads onward to the gallery. It is the destination
    of the act-2 postcard QR and the DM/mail verification fallback (§2.1, §2.2).
    The page needs the prospect's fact bound to it — sourced from the
    campaign/seed's desk-picked C3 fact (§2.1); a per-prospect selected-pain
    field does not exist yet and is part of this item.
19. **Cascade-aware panel + announce queue (from Q1/Q9).** Admin surface showing
    published-but-unannounced seeds at a glance and per-prospect act position
    read from `outreach_state` transitions; the operator sets announce status on
    delivery (§2.0, §7). Queue rows carry age since `dps.published_at`
    (verified in sweep), oldest-first; the flag threshold is Q22.
    Row action chips reuse the comms worklist's modals
    (`ResolveVerificationModal` / `ProspectTouchLogModal` / `LogContactModal`)
    plus resolved channel chips; the set resolves through each seed's
    campaign/queue anchor — a seed with none is verify-only (§2.0).
20. **Trigger mint-policy change (from Q3).** **Withdrawn 2026-10-19 (gap fix
    §11 B2):** the mint stays at publish; no trigger change. The announce SOP
    uses the publish-time token and the tracked `/qe/{code}` link.
21. **Claim-page SMS checkbox (from Q13).** Written-consent capture on the claim
    page; the form language and opt-out handling come from counsel (Q11) before
    any build.
22. **Announce-queue aging threshold.** How many days a published-unannounced
    seed may sit before it flags — the post-discovery announce risk grows with
    the gap, while the organic path keeps earning meanwhile (§1, §2.0). Tied
    to the same pacing question as the daily announce block size. Verified in
    sweep: the mechanism partially exists — `seed-outreach-no-response` flips
    `outreach_scheduled` older than `SEED_OUTREACH_NO_RESPONSE_DAYS` (default
    14) to `no_response`, but it cannot distinguish never-announced from
    delivered-no-reply (Q23).
23. **Courtesy-window collision.** The `seed-outreach-no-response` job flips
    stale `outreach_scheduled` seeds to `no_response` after the window
    regardless of whether the announce was ever delivered — a never-announced
    seed exits the queue definition mislabeled as no-reply. Decide: include
    never-contacted `no_response` seeds in the queue, gate the job on
    delivered state, or treat the window itself as the aging threshold.
    **Resolved 2026-10-19 (gap fix §11 B1/B3):** the queue no longer reads
    `outreach_state`. It reads the `announce_delivered` marker on
    `directory_seed_outreach_touches`; a `no_response` seed without that
    marker stays in the queue. The job is unchanged (it still ages the
    courtesy window).
24. **Manual-seed announce coverage.** The trigger fires only from
    `createFromCampaign`; seeds created via the manual form or queue load
    publish without a scheduled announce row (§2.0 coverage hole). Decide
    whether every publish — any creation path — schedules the announce row,
    or whether `not_started` seeds rely on operator-composed announces.
    **Resolved 2026-10-19 (gap fix §11 B3):** every single-seed publish writes
    an `announce_scheduled` marker to `directory_seed_outreach_touches`.
    Campaign-linked seeds also keep the `mkt_outreach_log` row; campaign-less
    seeds use the seed touch ledger. Batch-publish remains operator-composed.
25. **Execution surface placement / VAST.** Where does the operator actually
    run the four acts? The seed admin page was the first home, but it is a
    seed-management surface and gets crowded; the campaign detail page already
    holds the audit/archetype/briefing triad, and the PG cockpit holds the
    pre-campaign queue.
    **Decided 2026-10-19 (addendum §11.6):** campaign-backed execution lives in
    **Campaign → Project Plan → Execution** (`#execution`); PG-scope execution
    lives in the **PG cockpit → VAST** tab; the seeds admin **Announce queue**
    remains the cross-prospect worklist and the only home for seed-only
    prospects. **VAST** (Verification, Awareness, Show, Tell) is the operator
    shorthand for the act strip. The review-pipeline **Cascade** tab is a
    different feature and is untouched.
26. **Dismissal propagation policy.** `MarketingProspectQueueService.dismiss`
    is queue-local: it writes the dismissal and syncs the linked public
    suggestion, nothing downstream. An operator can dismiss `bad_fit` while a
    published+invited seed and live campaign exist for the same business and
    never be told — verified live 2026-10-20: `pque-fzou7k14` (Garaya African
    Market) was dismissed `bad_fit` on 9/16, five days after its seed
    `dps-5CQK-rrxi9fjm` published and went `invited`; the queue row's
    `processed_campaign_id` is null because the campaign was created outside
    queue graduation. The seed stayed public with a live claim token.
    The reason enum (`already_customer | bad_fit | duplicate |
    unverified_closed | other`) implies different blast radii:
    `unverified_closed` is a data-quality defect that argues for suppressing
    the published listing; `bad_fit` argues only for ending the controlled
    path (the organic listing may still earn shelf value, but the live claim
    token is spend the platform opted out of). Decide: warn-on-dismiss with a
    live-children listing (seeds/campaigns resolved via
    `directory_seed_campaign_links` + `seed_batch`), auto-suppress only on
    `unverified_closed`, or some hybrid.
27. **Dismissed-history guard.** `bad_fit` is a per-row verdict, not a
    business verdict: the queue dedup covers only `status='queued'`, so a
    dismissed business is re-queued by the very next intelligence scan; and
    `Spawn Campaign` / queue graduation do not read dismissal history either —
    verified live 2026-10-20 when a fresh `seek` campaign (`mcamp-s97mviop`)
    was spawned for the business dismissed in Q26 with no surface flag.
    Decide whether prior dismissals surface as context (a badge on the
    prospect/campaign/seed, recommended — one intake's `bad_fit` should not
    hard-veto another) or as a re-queue cool-down window. Related: the
    prospect-queue entry never learned that a campaign existed for the same
    business (`processed_campaign_id` stayed null) — queue rows and
    out-of-band campaigns share no reconciliation path, so verdicts split-brain.
    `seed_batch` is a fossil string stamped at creation and is not validated
    against `directory_seed_campaign_links`; the announce queue (Q19) must
    not trust the batch label as evidence of a live campaign anchor.

## 10. Verification Record (2026-10-19)

Checked in source or external sources:

- Postcards carry QR codes: `PostalMailerService` (`generate`,
  `resolveQrDestination`, styled `qrImageDataUrl`).
- QR destinations: claim `/marketing/claim/{token}`; gallery `/g/{short_code}`
  or `/preview/{token}`; portal `/account/marketing`; site `/`; custom URL.
- `/g/[shortCode]` redirects to `/preview/{token}` (with `?prospect=true` for
  multi-gallery) with no channel parameter.
- `mkt_gallery_events` columns include `referrer`, `user_agent`, `surface`,
  `artifact`, and `sibling_campaign_id`. There is no channel or QR-source column.
- Seed-mail scan telemetry: `/r/seed/[seedId]/[channel]` → `qr_scan_events`;
  `getMailScanOutcomes` reads it.
- Contact consent (verified): `directory_presence_seeds.owner_contact_consent`
  (migration 275) defaults to `false`. Owner and suggestion submissions set it
  from the submitter's opt-in. The admin seed page reads `false` as "do not
  contact." `SeedOutreachTriggerService` does not read it.
- SMS: `directory_presence_seeds` has no SMS consent field. `customers` has
  `sms_consent` (default `false`). No SMS or DM send path was found in
  `apps/api`. `directory_listings_list` carries `social_instagram`.
- Seed status values and default: `updateStatus` allowed list
  (`draft`, `published`, `invited`, `claimed`, `suppressed`); schema default `draft`.
- `publishSeed` writes the listing `is_published`, the seed `published` status,
  and directory settings. `approveAndInvite` publishes and invites in one call.
  `revoke` flips `invited` back to `published`.
- Publish fires `SeedOutreachTriggerService.onSeedCreated` for campaign-linked
  seeds. It mints a claim token when none is active (per the header comment),
  writes a scheduled outreach row, and sets `outreach_scheduled`. It does not
  send. Channel is chosen phone, then email, then other, from `owner_phone` then
  the campaign phone, then `owner_email` then the campaign email. Idempotent per
  seed (step 2 skips seeds with an existing log).
- Publish QC: the "Publish the listing" playbook step runs after QC.
- Not verified in code, taken from the project's AGENTS.md rules: public surfaces
  gate on `status IN ('published','invited','claimed')`. Re-verify before relying on it.
- Announce email links (verified in source):
  - The trigger's message is text only: `Claim your listing: {claimUrl}`, with no
    QR. `claimUrl` resolves to the claim kit's `claimUrl`, which is
    `/place/claim/{token}`. That is tokenized but not tracked.
  - The claim kit (`ClaimInviteQrKitService`) provides `qrUrlEmail` =
    `/qe/{shortCode}` (surface `claim_invite_email`, recorded to
    `qr_scan_events`) and `shortClaimUrl` = `/c/{shortCode}`. The `/qe/` redirect
    page exists in the web app.
  - Conversion signals: `directory_claim_requests` (`status`, `reviewed_at`,
    approved or rejected) and `directory_presence_seeds.claimed_at`.
  - The seed detail page has a claim **Email link** card (`variant: 'email'`,
    `url: qrKit.qrUrlEmail`). Its designer's **PNG** button downloads
    `claim-qr-email-{size}px.png`, and the QR encodes the tracked URL.
  - DM announce (verified): the QR kit's `qrUrlSocial` encodes `/qs/{shortCode}`
  (surface `claim_invite_social`). The seed-page designer accepts a `social`
  variant. No DM send path was found in the platform.
- Announce identification (verified): `platform_settings_list` has `platform_name`,
  `contact_email`, `contact_phone`, `contact_address`, and `social_facebook`,
  `social_twitter`, `social_instagram`, `social_linkedin`, `social_youtube`.
  `loadPlatformBranding()` (`MarketingReceiptPdfService`) reads it for receipt PDFs
  and falls back to hardcoded defaults. The admin branding page's writer is not
  verified. `mkt_branding_config` is a separate, operator-level record for
  deliverables.
- Cold-contact legal basis for announce email and calls to mined seeds: not
  verified. The CAN-SPAM, TCPA, and Do Not Call points in §9 Q14 are general
  considerations for counsel, not a legal analysis.
- Not verified: whether a plain click on `/place/claim/{token}` is recorded
    anywhere; whether `/c/{code}` records a scan; whether the operator's sending
    tool renders an inline PNG.
- Corrected: an earlier draft said publish can send an automatic message. The
  trigger in source does not send. Its output is a scheduled row.
- TCPA: FCC consumer guidance states that commercial texts require written
  consent. A 2025 FCC notice records a court vacating the first paragraph of a
  2023 revision to the written-consent rule in 47 CFR 64.1200(f)(9), which
  appears to be the one-to-one consent provision (inferred from the notice, not
  confirmed against the order). Counsel should confirm the current rule.

Sweep additions (verified 2026-10-19, second pass):

- `outreach_state` machine: states include `not_started`, `outreach_scheduled`,
  `owner_contacted`, `freshness_verified`, `freshness_failed`, `no_response`;
  `DirectoryPresenceSeedService.setOutreachState` writes transitions with
  `outreach_state_entered_at` / `outreach_scheduled_at` timestamps.
- `SeedOutreachStateSync.syncFromLog` (called after `logContact` on the
  campaign outreach route) auto-maps outcomes: reached / no_answer /
  left_message / callback_scheduled / interested / not_interested / other →
  `owner_contacted`; `reached` + `callDetails.operating_status_confirmed` →
  `freshness_verified`; wrong_number / disconnected_number →
  `freshness_failed`. Terminal `claimed`/`suppressed` states are not
  overridden. Only fires for campaigns with a primary-linked seed.
- Courtesy window: `seed-outreach-no-response` daily job flips
  `outreach_scheduled` older than `SEED_OUTREACH_NO_RESPONSE_DAYS` (default
  14) to `no_response`; kill switch `DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB`.
- `dps.published_at` is set by `publishSeed` — queue age source confirmed.
- Trigger scope: `onSeedCreated` is invoked only from `createFromCampaign` —
  manual-form and queue-load publishes produce no announce row.
- `mkt_outreach_log.call_details` carries `seed_id` + `seed_outreach='true'`
  on trigger rows.
- Gallery link form: outbound links use `/preview/{token}`
  (`CallScriptService`, token-mint routes). `/g/{code}` resolves via
  `/api/gallery-code/:shortCode` → returns token + tokenType, writes no scan
  row. Dead tokens resolve to the campaign's live successor, so printed QRs
  survive reissue.
- `gallery_opened` fires on mount in both the single gallery and
  `MultiGalleryPage`; expired tokens still record `gallery_opened`
  (re-activation analytics).

Not verified (flagged in §9):

- `qr_scan_events` schema and whether it accepts campaign-prospect surfaces.
- Whether the gallery email uses `/preview/` or `/g/`.
- Whether the gallery page reliably fires `gallery_opened`.
- Postal transit times.
- Whether `referrer` is populated for QR scans. Treat it as unreliable until checked.

Gap-fix corrections (verified 2026-10-19, third pass):

- **Trigger scope corrected.** `onSeedCreated` fires from `createFromCampaign`
  **and** from `POST /presence-seeds/:id/publish` when the seed has a primary
  campaign link (`directory-presence-admin.ts`). It does **not** fire from
  `publishBatch`, `createSeedsForProvingGround`, or `approveAndInvite`.
- **Mint paths corrected.** The trigger mints at publish; so does
  `createSeedsForProvingGround` (unconditionally) and `approveAndInvite`
  (publish + mint + email). `publishBatch` does not mint. Removing the trigger
  mint alone would not have implemented Q3.
- **Claim kit corrected.** `resolveClaimInviteKit` returns `null` without an
  active token; the seed page's **Generate Claim Invite** button is the mint,
  not the Email link card.
- **`loadPlatformBranding()` corrected.** It returns platform name, logo,
  primary color, contact email/phone/address, and website — **no social
  handles**, despite the table having them. It also lives in a module that
  imports `sharp`.
- **`POST /api/platform-settings` is public.** The route is mounted
  `authLevel: 'public'` with no auth middleware. This is a security defect
  because the announce identification block reads that record.
- **`qr_scan_events` corrected.** `surface` is `VarChar(30)`; `QrSurfaceType`
  is a closed union; the table has no campaign/seed/token column. Per-prospect
  attribution must use `product_id` (as `/r/pr-scan` does).
- **State semantics corrected.** `owner_contacted` means "any contact
  attempt," not "announce delivered"; `freshness_verified` can be entered
  without C2. The queue cannot use `outreach_state` as its predicate.
- **`/c/{code}` corrected.** It resolves without recording a scan; `/qe/{code}`
  records. The announce SOP's `/qe/` requirement is load-bearing.
- **Successor mirror risk.** `marketing-ops.ts` passes
  `publish: linked.some(s => s.status === 'published')` when birthing a
  successor. Mint-at-announce would have made live seeds `invited` and birthed
  draft successors. Mint-at-publish avoids the regression; the condition
  should still be widened to `published` **or** `invited` as a guard.

## 11. Gap-fix decisions (2026-10-19)

These are the operator decisions taken after the source-verification gap
analysis. They are binding for cohort 1.

### B1 — Announce queue signal: marked seed touch

The queue is `published`/`invited` seeds with an `announce_scheduled` marker
and **no** `announce_delivered` marker on
`directory_seed_outreach_touches`. The marker outcomes are added to the
table's CHECK constraint; the touch's `metadata` JSONB carries the composed
message, channel, claim URL, identification values, and snapshot date.
`outreach_state` remains the courtesy/verification lifecycle and is not the
queue predicate. The courtesy job is unchanged; a `no_response` seed without
`announce_delivered` stays in the queue.

### B2 — Claim token: mint at publish retained

Q3/Q20 are reversed. The token mints at publish as it does today; the
announce is the first distribution of the link. Reasons: the claim-kit cards
require an active token; the PG preflight mints at seeding; and keeping
`published`/`invited` stable avoids the successor-seed publish-state
regression. The SOP's step 0 covers the manual-seed case where no token
exists.

### B3 — Campaign-less announce anchor: seed touch ledger

Campaign-linked seeds keep the `mkt_outreach_log` row (campaign anchor) and
also get the seed marker. Campaign-less seeds use
`directory_seed_outreach_touches` only. A synthetic campaign is explicitly
rejected: `mkt_outreach_log.campaign_id` is NOT NULL/FK, and a placeholder
would pollute funnel analytics.

### B4 — Act-1 C3/C4 capture: `verification_results` + UI

C3 (pain confirmed/disputed/not asked) and C4 (permission yes/no) are recorded
in the existing structured `verification_results` array for campaign-backed
prospects, and in the seed touch `metadata.verification_results` for
campaign-less prospects. `call_details` stays closed. The UI adds the fields
to `LogContactModal` (campaign) and `ProspectTouchLogModal` (seed). No new
modals.

### B5 — Platform settings write: admin-authenticated POST

`POST /api/platform-settings` gains `authenticateToken` +
`requirePlatformAdmin`; `GET` stays public. The announce branding reader
returns social handles and records the values used. A required field with no
active surface blocks the announce.

### B6 — Execution surfaces and the VAST add-on (2026-10-19)

**VAST** = **V**erification → **A**wareness → **S**how → **T**ell. It is the
operator-facing name for the four-act strip; the act definitions, gates, and
sequencing are unchanged.

Placement:

- **Campaign-backed prospects** run the acts on the campaign detail page's
  **Project Plan → Execution** tab (`#execution`, `CampaignExecutionPanel`).
  The campaign already holds the audit, archetype, briefing, and siblings; the
  panel resolves the campaign's primary seed via `GET /campaigns/:id/cascade`
  and shows announce status/actions, VAST cards, the walk-in gate, and recent
  activity.
- **PG-scope queued prospects** run the acts on the PG cockpit's **VAST** tab
  (`VastPanel`). It resolves a queue row's `seed_id` first, then the campaign's
  primary seed via `GET /campaigns/cascade-batch` (campaign_created rows often
  carry the link on the campaign, not the queue row). Campaign-linked unseeded
  rows show “No seed (campaign)” and a Campaign link; genuinely unseeded rows
  show “Promote to listings.” The “enriched” chip on the Promote tab is
  shelf-market enrichment, not seed status.
- **Seeds admin** keeps the **Announce queue** (cross-prospect delivery
  worklist, seed-only prospects) and the **Cohort** page (the same VAST stages
  as the measured funnel).
- The existing review-pipeline **Cascade** tab (`ReviewCascadeService`,
  `cascade_enabled`) is a different feature. The Four-Act surface is named
  **Execution/VAST** to avoid the collision.

Data path: `SeedCascadeService.getSummary` is the single derivation;
`getSummaries(seedIds)` and `CampaignCascadeService.getForCampaigns(campaignIds)`
batch it for the PG. The cohort report (`SeedCascadeCohortService`) maps
V/A/S/T to verified/aware/gate-cleared/walk-in, so the board and the funnel
cannot drift.

This add-on changes presentation and placement only; it does not change the
announce marker contract (§11 B1/B3), the mint policy (§11 B2), or the act-1
capture (§11 B4).
