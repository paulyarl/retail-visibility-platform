# Consultative Call Spec — The Sales Job the Pipeline Builds

Status: draft (v0.1 — not yet built). Companion to
CLAIM_VERIFICATION_SIGNALS_SPEC (§1.1a probes, §6 routing).

## 0. Why this exists

The platform pre-does the sales work no cold caller can copy: the seed
already exists, the signals are already known, the probes are already
scripted. The caller needs two skills — ask the questions on the card and
listen. The methodology below is the scripted version of every insight in
this thread: opener → warm-up → build-up → probe → listen → consult →
pitch. It runs in a market whose sales bar is spam, so the honest call is
the differentiator by itself.

## 1. Pre-call card (what the caller sees before dialing)

Assembled from existing surfaces — no new pipeline:

- Seed/campaign record: name, address, phone, category, seed status,
  claim token state.
- Signals: discovery signals (leads), dedup group state, chain
  membership + pitch hooks, verified evidence rows.
- Probes to run (scripted lines, §3) and the structured fields to fill
  (§4): `physical_storefront`, `pickup_probe`, `aspiration_mode`,
  `aspiration_notes`.
- The opener fact: "your listing is already live on our platform — I
  want to make sure it's telling the truth."

## 2. The call — seven beats

### Beat 1 — Opener (warm, asymmetric)

> "Hi — is this the owner/manager of {name}? I work with {platform} —
> we run a directory for local stores, and yours is already listed on
> it. I'm calling to make sure we have it right — it'll take a couple
> minutes."

The seed is the door-opener: not selling, delivering something they
already own. Competence reads as care.

### Beat 2 — Warm-up (confirm the record)

Walk the verified-NAP fields: "I've got {name} at {address}, {city} —
is that right? And this is the best number?" Corrections go straight
into the record — the first gift: their listing gets *fixed* on the
call. For dedup groups this IS the resolution: who answers, what name
they give, whether the second listing is them.

### Beat 3 — Build-up (the honest observation)

One sentence of what the record says about them — sourced, specific:
"Your Google profile is strong — 52 reviews, 4.9 — but it doesn't show
an address" / "Your website's showing a parked page — Google still
links to it" / "You look like two locations sharing a phone." The
observation proves the caller did homework and frames the gap without
pitching it.

### Beat 4 — Probe (the functional question)

The scripted line that verifies presence mode:

> "Quick one — a customer was asking if {product/category item} is in
> stock at your location. Could they come pick it up today?"

- `ready` → storefront confirmed; physical tier path stays open.
- "We ship / order online" → `online_only` — the deflection IS the
  signal; never push back, record it.
- `unreachable`/evasive → unconfirmed; flag for the evidence menu at
  claim.

Ask about the second location when a chain/dup card is in play: "Are
{name A} and {name B} both yours?" — one call settles merge/distinct/
chain.

### Beat 5 — Listen (the aspiration question)

The consultative beat — open, unscripted answer:

> "How would you like to see your business grow next year?"

The owner names their own lane. Map the natural answer:

| They say | `aspiration_mode` | Lane |
|---|---|---|
| more people through the door | `physical` | discovery / presence |
| online orders, shipping, "a website that works" | `online` | ecommerce / done-for-you |
| another location, expand | `expand` | chain / org / multi-location |
| less fees, less hassle | `consolidate` | owned-domain, platform-consolidation |
| steady as-is | `steady` | deprioritize honestly |

Notes go in `aspiration_notes` — the owner's own words are the pitch
material later ("you told me you wanted X").

### Beat 6 — Consult (mirror, don't pitch yet)

Reflect their answer against what the record showed: "You want more
online orders — and right now Google doesn't know where your store is /
your site shows a parked page / you have no site at all." The gap is
now *their* statement plus *your* evidence — the sale is half-done
because the prospect framed it.

### Beat 7 — Pitch (the tier presents itself)

One lane only — the delta named in §6 of the verification spec:

- physical + wants physical → "your listing's live; let's get it
  claimed and showing what your store actually looks like."
- physical + wants online → "your store exists; your digital shelf
  doesn't. That's exactly the build we do."
- none/online + wants online → the reference case: "here's a store
  running exactly that model — {Enerem-style example}: {reviews},
  zero storefront overhead. We build that."
- online_only honestly stated → categorize, pitch the ecommerce lane,
  never the shelf.

Always leave with ONE next step — claim the listing, verify the
storefront photo, or a booked follow-up. Never the whole menu.

## 3. What the call writes back

Structured — rides the existing verification machinery:

- `verification.outcome` + `verified_nap` (exists)
- `physical_storefront`: confirmed | online_only | unconfirmed →
  `physical`-class evidence row, `source: verification_call`
- `pickup_probe`: ready | online_only | unreachable → same
- `aspiration_mode`: physical | online | expand | consolidate |
  steady + `aspiration_notes` (owner's words)
- `call_notes` free text (exists)
- Dedup answers: "both yours?" → merge/distinct/chain verdict support
- Next action: existing enum + `verify_storefront_photo` follow-up task

## 4. Failure and honesty rules

- Never contradict the probe answer — a deflection is data, record it.
- A false "come by" becomes a `conflicting` evidence row later; the
  ledger is the check on honesty, not the caller's pushback.
- `steady`/`online_only`/`unreachable` are valid outcomes — a
  deprioritized honest prospect beats a pitched wrong one.
- The call never invents pain. If the record shows no gap, the consult
  beat says so — and the pitch becomes the reference-case question or
  a clean exit.

## 5. Where it lands mechanically

- Resolve-verification modal: three new structured fields
  (`physical_storefront`, `pickup_probe`, `aspiration_mode` + notes) —
  writes evidence rows + `presence_mode`/`aspiration_mode` on the entry.
- Call card pre-fill: the card renders the scripted probes + the
  seed's observed gaps (signals → "the honest observation" line).
- Audit context: probe outcomes flow to the `=== PROSPECT CONTEXT ===`
  directive (spec §6a) — the audit diagnoses a qualified prospect.
- Follow-ups: `verify_storefront_photo` tasks land in the review queue
  alongside evidence submissions.
