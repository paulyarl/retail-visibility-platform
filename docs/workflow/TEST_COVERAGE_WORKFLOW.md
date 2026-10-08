# Test Coverage Workflow — Prospect Outreach

How a prospect-outreach rollout is proven before it touches a live business, and how it is staged so a
single flawed script cannot burn an entire corridor.

Companion doc: `CAPTURE_SCHEMA.md` defines the fields each contact produces. This doc defines the
procedure that consumes them.

---

## 1. The sequence being tested

**Local (walk-in):**

1. **Call and book** → converts an unannounced interruption into an expected visit.
2. **Visit and show** → the reveal on the owner's own screen, then QR scan + seed page.
3. **Bundle by corridor** → the trip amortizes across the cluster.

**Remote (call):**

1. **Call and book** → an expected call.
2. **Call back, pitch, text the seed link** → and stay on the line while the owner opens it.
3. **Bundle calls into a time block** → batched by *pitch similarity*, not just by clock. A block of
   same-category, same-metro stores reuses the reveal, the shelf vocabulary and the comparator framing.

Remote is the **capacity fallback, not the equivalent.** It loses the evidence harvest (signage name,
counter services, posted hours, shelf photos) and the in-person trust effect, so it needs its own
proof rather than inheriting local results.

### Consent micro-steps — the conversion path

The sequence converts through a chain of small, specific asks. Each is a yes that advances the funnel,
and each is deliberately narrow so that declining one does not end the conversation:

1. *"Can I show you something on your phone?"* — before the reveal.
2. *"Can I text you the link?"* — the channel-viability probe.
3. *"Want to scan it and see it live?"* — the claim.
4. *"May I take three photos — the sign, the front, one shelf — and you pick which go up?"* — the photo step.

Narrow asks convert; broad ones don't. "Mind if I take some photos?" buys a vague yes that does not
cover publishing, and any ask wide enough to swallow the whole sequence collapses it into a single
yes-or-no that a busy owner answers with no.

---

## 2. Ghost run — before any live prospect

Run the entire workflow end to end against a **consented ghost entity** — a friendly business that
agrees, or the operator's own entity — with the claim token pointed at the operator's own phone.

**Do not ghost a reserved prospect.** Seeding a real business you have not contacted publishes an
orphaned artifact about someone who never heard from you, and that becomes their first impression of
the platform.

### Design rules

- **Real device, real network.** Desktop browsers hide every failure mode. Scan from a phone, on
  mobile data, ideally in the corridor — storefront connectivity is not office wifi.
- **Print the QR on the actual stock at the actual size.** Scannability dies on print resolution, a
  missing quiet zone, or glare off glossy card. A 4x6 at counter distance is a different test than
  the same code on screen.
- **Use a logged-out device.** Testing while authenticated as the operator can mask how the claim flow
  behaves for an owner.
- **Have someone else drive it cold.** The builder knows where the buttons are and will unconsciously
  fill the gaps. The finding worth having is the second person's "what am I looking at?" moment in the
  first thirty seconds.
- **Test the failure paths.** Expired token, already-claimed listing, invalid or tampered token. If
  nobody tested them, the first live prospect does.
- **Check the token message doesn't read as spam.** An owner who thinks it is a phishing text never
  taps, and the motion ends there.
- **Time-box it.** A ghost run that takes two days is not a smoke test.
- **Make it repeatable.** It is a regression test, not a demo. Re-run it after every fix, and it should
  pass clean **twice consecutively** before wave 1.

### What it can and cannot prove

It validates the **artifact and the machinery**. It cannot validate the **conversation** — trust,
objection handling, whether the reveal lands. A clean ghost run is not a green light for the pitch.

---

## 3. Coverage matrix

Run against the ghost entity, on a real device, on mobile data, logged out.

| # | Surface | Test case | Severity | Pass |
| --- | --- | --- | --- | --- |
| S1.1 | Seed page | Renders on mobile at real viewport | non_negotiable | |
| S1.2 | Seed page | Shelf label correct (not a generic "Convenience store") | non_negotiable | |
| S1.3 | Seed page | NAP is the storefront address + store line, not the registration pair | non_negotiable | |
| S1.4 | Seed page | Departments / product terms present | recommended | |
| S1.5 | Seed page | Claim CTA above the fold | non_negotiable | |
| S1.6 | Seed page | Loads within target on mobile data | recommended | |
| S1.7 | Seed page | No placeholders, broken images or template copy | recommended | |
| S1.8 | Seed page | "Would an owner be embarrassed by this?" | non_negotiable | |
| S2.1 | Claim flow | Token delivered to the destination | non_negotiable | |
| S2.2 | Claim flow | Link opens the claim page logged out | non_negotiable | |
| S2.3 | Claim flow | Claim completes end to end | non_negotiable | |
| S2.4 | Claim flow | Public page updates post-claim | non_negotiable | |
| S2.5 | Claim flow | Expired token branch behaves sanely | non_negotiable | |
| S2.6 | Claim flow | Already-claimed branch behaves sanely | recommended | |
| S2.7 | Claim flow | Invalid / tampered token rejected cleanly | recommended | |
| S3.1 | QR card | Scans at counter distance on the printed stock | non_negotiable | |
| S3.2 | QR card | Scans under storefront lighting / glare | non_negotiable | |
| S3.3 | QR card | Quiet zone and print resolution adequate | non_negotiable | |
| S3.4 | QR card | Canonical NAP printed legibly | recommended | |
| S3.5 | QR card | Short URL typeable as fallback | recommended | |
| S4.1 | Token message | Arrives on a non-operator handset | non_negotiable | |
| S4.2 | Token message | Arrives via email | recommended | |
| S4.3 | Token message | Does not read as spam; sender identifiable | non_negotiable | |
| S4.4 | Token message | Link tappable and previews correctly | recommended | |
| S5.1 | Token destination | Textable number confirmed by probe reply | non_negotiable | |
| S5.2 | Token destination | Email deliverability confirmed | recommended | |
| S5.3 | Token destination | Email fallback works when SMS is unproven | recommended | |
| S6.1 | Tooling | Pre-flight emits the correct label + NAP for a given input | non_negotiable | |
| S6.2 | Tooling | Reservation ledger blocks double-contact | non_negotiable | |
| S6.3 | Tooling | Capture schema fills without friction | recommended | |
| S7.1 | Script | Read aloud against the live artifact, timed under 2 min | recommended | |
| S8.1 | Photo capture | Capture attempted only when mood **and** moment allow | recommended | |
| S8.2 | Photo capture | Consent asked explicitly and specifically before any shot | non_negotiable | |
| S8.3 | Photo capture | Nothing captured without a clear yes; a decline is recorded, not pushed | non_negotiable | |
| S8.4 | Photo capture | No customer or employee in frame in any publishable shot | non_negotiable | |
| S8.5 | Photo capture | Shots shown to the owner on the phone before publish | non_negotiable | |
| S8.6 | Photo capture | Only owner-approved shots are published | non_negotiable | |
| S8.7 | Photo capture | Shoot list honoured — signage / storefront / one tidy shelf | recommended | |
| S8.8 | Photo capture | Approved photos render correctly on the seed at mobile viewport | recommended | |
| S8.9 | Photo capture | Tooling enforces approve-before-publish (unapproved cannot be pushed) | non_negotiable | |

---

## 4. Gate ladder

Each rung has its own exit criteria. A rung that fails resets; it does not carry forward.

The S8 photo-capture rows are **recorded but never gate a rung** — capture is optional and mood-gated.
The exception is the consent and approval rows (S8.2–S8.6, S8.9): those are non_negotiable on every
attempt, because publishing a photo the owner has not seen and approved is a rights failure, not a
conversion miss.

### Rung 0 — Ghost run

**Pass:** every `non_negotiable` row passes, **twice consecutively**, with a cold driver and zero
operator rescue. Any failure → fix → full re-run.

### Rung 1 — Wave 1 (3 stores)

**Selection:** deliberately favorable conditions — quiet hour, owner present, not mid-restock. You are
validating the machine, not the pitch.

**Pass:** every Stage 0 gate true pre-contact, and `reveal_landed` + `claim_unassisted` true on **3/3**.
Any tooling defect resets the wave — fix, then run three more.

### Rung 2 — Wave 2 (3 stores)

**Selection:** mixed conditions — one store mid-rush, one owner hesitant or dismissive. Now you are
testing the script rather than the machine.

**Pass:** same mechanical gate, plus objection codes captured for at least two of the three.

### Rung 3 — Block

Only after waves 1–2 pass. Work **least-connected → most-connected**, hub last — if the script has a
flaw, the most-connected store is the asset you least want to burn. Reserved stores stay explicitly
reserved until their turn.

### Rung 4 — Remote pilot

**Separate gate. Not inherited.** Local conversion is an upper bound, not a forecast, because the
operator was standing there. The remote pilot tests the *channel*, not the script.

---

## 5. Why staging matters more here than usual

The corridor is a **consumable that is also socially connected**. In a category that runs on
word-of-mouth and community groups, a botched opening in store #1 can reach store #6 before you
arrive. An unvalidated script does not just burn the store you pitched — it pre-poisons the ones
downstream.

Two consequences:

- **Reserve the rest explicitly.** In a multi-operator shop, the casual contact with a reserved store
  is the likeliest way to lose it.
- **Read small samples honestly.** Three favorable visits is consistent with a coin flip. Rungs 0–2
  validate mechanics, not rates.

---

## 6. Roles

| Role | Responsibility |
| --- | --- |
| Builder | builds the seed, the claim flow, the card, the capture form |
| Cold driver | runs the ghost pass — must not be the builder |
| Operator | runs the live waves, owns the capture records |
| Reviewer | checks the gate criteria were met before the next rung opens |

## 7. Defect handling

Every defect gets a row in the rolling defect log (`CAPTURE_SCHEMA.md` § Rolling defect log) with the
surface, severity, fix and the regression run that confirmed it. A defect found in the ghost run must
be traceable through to its verified fix — an untracked defect is indistinguishable from one that was
never found.
