# Madison Proving Ground — Operator Playbook

**Scope:** All remote outreach for two live discovery campaigns:
- `mcamp-io0p8470` — Middle Eastern Grocery, **competitive** focus (`maud-57ht79sc`)
- `mcamp-n3fb21nq` — Indian Grocery, **emerging** focus (`maud-st6wppaz` + `maud-pnksoe9o`)

**Source docs:**
- Narrative frame: `madison-east-washington-leadership-pitch.md`
- Competitive priorities: `madison-middle-eastern-grocery-prospect-priority.md`
- Emerging priorities: `madison-indian-grocery-emerging-prospect-priority.md`

**Constraint:** 100% remote. No walk-ins. Madison proves the remote motion before Milwaukee / Twin Cities expansion.

---

## The Funnel (what "done" looks like at each stage)

Every prospect moves through the same ladder. Each rung has an entry action, an exit gate, and a measurement.

| Rung | Prospect action | Operator action | Gate to advance | Metric |
|------|----------------|-----------------|-----------------|--------|
| 0. Seeded | — | Seed place entry from audit provenance | Entry exists in directory | `seeds` count |
| 1. Contacted | Receives touch | Touch 1 (channel per contact path below) | Any reply / QR scan | `contactable`, `inviteScans` |
| 2. Claimed | Claims free place entry, fixes NAP | Send claim link / walk them through on a call | `claimed` within 30 days | `claimed30d`, `inviteScanRate` |
| 3. Verified | Confirms NAP corrections | Record owner-correction diff | `nap_owner_corrected` flag | `napVerified` |
| 4. Presence ($19/mo) | Pays for enriched listing | Pitch with their gap-map screenshot | First payment | `converted` |
| 5. Discovery ($29/mo) | Google/Maps visibility | Same call or follow-up | — | ARR |
| 6. Storefront ($59/mo) | Shoppable presence + 10 free product slots | Deliver + activate | — | ARR |
| 7. Commerce / Retainer | Owned ordering, cuts marketplace commission | Retainer pitch post-delivery | `retainer_won` | `retention_90d` |

Stage names in the system: `seek → preview_built → shown → paid → delivered → retainer_pitched → retainer_won`.

---

## Phase 0 — Pre-Flight Checklist (before any touch)

Do these once, in order. Each blocks the next.

- [ ] **Reconcile cross-campaign duplicates.** Four entities appear in both audits:
  - Istanbul Super Market / "Istanbul Market" (745 S Gammon) → owned by **competitive** campaign, Tier 1 #3
  - Halal & Hijab Market = Amal Halal Market (807 S Gammon) → **competitive**, Tier 2 #4
  - India House (709 S Gammon) → `insufficient` in Middle Eastern audit, `verified` in Indian audits → **emerging** campaign owns it
  - Maharaja (1701 Thierer) → `verified` both places → benchmark in emerging; do not pitch twice
  - Also dedupe *within* emerging: **Swagat = Krishna Foods** (same phone/address, 6717 Odana)
- [ ] **Seed unclaimed place entries** for all 13 contactable prospects (10 competitive + 6 emerging − 3 overlaps − holds). Verify each entry's NAP against the audit's `discovery_provenance` before seeding — do not propagate name variants into the canonical record.
- [ ] **Generate claim-invite QR links** per prospect (surface = `claim_invite`) so scans attribute correctly in `inviteScans`.
- [ ] **Build per-prospect gap-map one-pagers** (the leave-behind / textable link): their gate failures side-by-side with the gold-standard exemplar (Sahadi's/Phoenicia for Middle Eastern; Krishna/Maharaja for Indian).
- [ ] **Resolve open verifications** (see Gap Log below): Little Tibet phone, Apne Bazaar owner name, Madison International Market open/closed status.
- [ ] **Sequence each prospect's channel ladder before Touch 1.** For every prospect, write down the ordered channel list derived *only from audited evidence* — never assume a channel exists because it's common. Each channel must have a provenance source in the audit or a Phase-0 verification:
  - Phone → which number, from which source, and are there variants (Amal has two; Go/Gooh confusion means verify the 284-7277 line is the store's, not the marketplace's)
  - Text/WhatsApp → only if the phone is a mobile line (unknown for landline-looking 608 numbers — mark "try, watch for unread")
  - Email / website contact form → only if a live owned site was verified in `discovery_provenance` (Namaste's `business.site` and Go Grocer's Grubhub link do **not** count — no owned form exists)
  - Postal QR mailer → storefront address confirmed in provenance (Apne, Madison Halal Meat)
  - Referral/community path → anchor named (UW list for India House, FCI for Little Tibet, Cap Times owner names for Apne/Little Tibet)
  
  Output per prospect: `channel_sequence = [call → text → form → mailer → referral]` with any dead/absent channels already removed, so the cadence table never routes into a channel that doesn't exist. This is also where cross-campaign ordering is set — prospects sharing an owner (Tairov family) share one sequence and one thread.
- [ ] **Assign a single operator owner per account family.** The Tairov/Tairova family (Istanbul + both Fresh Marts) is ONE account — one operator, one thread, three storefront gap-maps.

### Gap Log — assumptions in the current docs that need filling

| Gap | Why it matters | Action |
|-----|----------------|--------|
| **No email addresses for any prospect** | The remote model assumes text/WhatsApp follow-up; for no-phone prospects the only digital path is a website contact form or social page — none verified | Treat email/form discovery as part of Touch 1 research, not a given |
| Apne Bazaar: no phone, owner name only in press | The postal QR test needs an addressee | Pull owner name from Cap Times article before printing mailer |
| Little Tibet: phone from audit 1 only; audit 2 found website but no phone | Unverified contact | Verify (608) 284-9190 + littletibetmadison.com contact form |
| Madison International Market: open/closed status conflict | Could waste a touch on a dead business | Phone lookup or secondary-source check before any outreach |
| Claim-invite QR scan attribution assumes `qr_scan_events.tenant_id` is set pre-claim | If scans pre-claim don't attribute, `inviteScans` reads zero and the postal test looks like a failure | Verify redirect flow stamps tenant/seed before sending mailers |
| Go Grocer "website" = Grubhub link | GBP website field may be marketplace-controlled, not owner-set | Confirm who controls the GBP before pitching "fix your website field" |
| Gold-standard exemplars are national (Sahadi's, Phoenicia) | Local owners may not know them; "national benchmark" framing may land weaker than "your neighbor has 260 reviews" | Lead with the **local** benchmark (Krishna 260, Fresh Mart SP 126) in gap-maps; use national names only as ceiling context |

---

## Phase 1 — Touch 1 (Days 1–7)

**Batch order** (by likelihood, merged across both campaigns):

| Order | Prospect | Campaign | Channel | Touch 1 content |
|-------|----------|----------|---------|-----------------|
| 1 | Go Grocer Madison | emerging | Call (608) 284-7277 | "Your Google website button goes to Grubhub — every order loses 15–30%. We built your free listing; want the link?" |
| 2 | Fresh Mart Madison | competitive | Call (608) 621-7428 | "Your site, homepage, and Isthmus list three different closing times. Can I text you the screenshot?" |
| 3 | Namaste India | emerging | Call (608) 422-5263 | "You're correctly categorized and EBT-certified but Google shows a generated page with a 3.7. Krishna has 260 reviews — want your gap-map?" |
| 4 | Fresh Mart Sun Prairie | competitive | Call (608) 318-0116 | "126 reviews exist on a site you don't control. You have no website and no verified Google profile." |
| 5 | Istanbul Super Market | competitive | Call (608) 277-1771 | "You're the benchmark — and even you have no verified GBP plus three names in circulation. Same family as Fresh Mart — one conversation covers all three." |
| 6 | Apne Bazaar | emerging | **Postal QR mailer** → 6704 Watts Rd | Seeded place entry + gap-map + claim QR. No phone exists; mailer is the channel. |
| 7 | Bombay Bazaar | emerging | Call (608) 237-1377 | "Google says 105 reviews; Yelp says 3.5 stars. Your category is wrong/missing." |
| 8 | India House | emerging | Call (608) 268-0240 | "Halal-certified and UW-listed, but no hours, wrong category, no website." |
| 9 | Little Tibet | emerging | Call (608) 284-9190 (verify first) | "New opening, FCI-backed — no hours published anywhere." |
| 10 | Amal Halal Market | competitive | Call (608) 405-5885 | "Two names, two phones, 3.6 stars, no site." |
| 11 | Madison Halal Meat | competitive | Postal QR mailer → 6701 Seybold Rd | USDA/halal credentials invisible; malformed hours on sole listing |
| 12 | Swagat/Krishna + Maharaja | emerging (benchmarks) | Call — **upsell frame, not pain frame** | "You're the market benchmark. One gap: owned ordering / name-split." |

**Touch 1 rules:**
- One channel per touch, but channels **sequence on signal, not on a fixed calendar**. Each outcome has its own wait-before-next-channel (below).
- Every touch ends with the same CTA: *"Claim your free listing"* — never a paid tier on Touch 1.
- Log each touch in `outreach_log` with channel + script variant + **outcome signal**; this feeds `touches` → `cacEstimate` and drives the cadence table.
- **Send window:** grocery owners answer mid-morning (9:30–11:30) and mid-afternoon (2–4), never at lunch/dinner rush or Friday afternoon (halal-community prayer window).

### Channel Escalation Cadence

Each prospect's channel order was fixed in Phase 0 (`channel_sequence` checklist item) — this table says *when* to advance down that pre-built ladder, never which channel to improvise. The signal — not elapsed days — determines the wait. A hard-negative signal means the *channel* is wrong, so don't wait at all; a soft/no-signal means the prospect may simply not have seen it, so give it a real window.

| Outcome signal | What it means | Wait before next touch | Next channel |
|---|---|---|---|
| Wrong number / disconnect | Channel is dead — never retry it | **0 days** — escalate same day | Alternate phone from audit (e.g., Amal's second number), else text/website form |
| No answer (rings, no VM) | Possibly right number, wrong time | **Next day**, different send window | Retry call once (max 2 no-answers), then text |
| Voicemail left | Delivered but unproven | **3 business days** | Text/WhatsApp with gap-map link |
| Text/DM **read**, no reply | Seen and deferred — mild interest or low urgency | **5 days** | Second text naming a local competitor, or email if address found |
| Text/DM **unread** | Wrong channel or wrong contact | **2 days** then abandon channel | Phone call (if number differs) or referral/mailer path |
| Email sent, no reply | Delivered, unproven | **5 business days** | Call or text; email alone never gets a second wait |
| Email bounce | Channel is dead | **0 days** | Phone; drop email from the record |
| Website contact form submitted | Unproven — no read receipt | **7 days** | Phone call referencing the form submission |
| Mailer sent (postal QR) | Only channel for no-phone prospects | **10 days**, then check `qr_scan_events` | Scan-without-claim → second postcard ("you checked your listing…"); no scan → referral chain or hold |
| Referral ask made | Third-party delivery, unproven | **14 days** | Mark `hold`, +60-day follow-up |

**Escalation caps:**
- Max **3 touches per prospect per 30 days** regardless of channel mix — after that it's `hold` + `next_follow_up_at` +60d, per Phase 3.
- A dead-channel signal (wrong number, bounce) **never consumes a touch slot** — the prospect hasn't been touched yet.
- One **live conversation** (answered call or replied message) resets the cadence: that prospect is now in a thread, and the ladder — not this table — drives the next move.
- Record the outcome signal in `outreach_log` (`delivery_status` / `last_delivery_error` fields exist for this) so the cadence is auditable, not operator memory.

## Phase 2 — Touch 2 (Days 8–14, non-responders only)

Timing is governed by the **Channel Escalation Cadence** above — a prospect may reach Touch 2 on day 2 (dead channel) or day 10 (unanswered voicemail), not on a fixed schedule.

- Channel escalation: call → **text/WhatsApp** with the gap-map link (these operators' primary business channel).
- Mailer prospects: day 10 check `qr_scan_events` for the `claim_invite` surface. A scan without a claim = warm lead → follow up with a second postcard naming the scan ("you checked your listing — here's what finishing the claim takes").
- Script change: lead with the *local* competitor, not the abstract audit. "Fresh Mart Sun Prairie has 126 reviews and no website — shoppers can't find their hours. You're in the same corridor."

## Phase 3 — Touch 3 / Nurture (Days 15–30)

- Non-responders after 3 touches → move to `hold`, schedule `next_follow_up_at` +60 days. Do not burn the list.
- Partial engagers (scanned/replied but didn't claim) → 15-minute screen-share offer: "I'll fix the listing with you live."
- Claimed prospects → NAP verification call (Phase-0 checklist item 3 metric: `napVerified`), then the Presence pitch using their own before/after.

## Gates & Kill Criteria (when to stop, not just when to push)

| Gate | Threshold | If failed |
|------|-----------|-----------|
| G1 Contact rate | ≥40% of Tier-1 prospects reached within 14 days | Revisit channels — if phones stall, expand postal QR to Tier-2 no-phone prospects |
| G2 Claim rate | ≥25% of contacted claim within 30 days | Claim flow friction — audit the landing experience before blaming list quality |
| G3 Attribution | `inviteScans` > 0 within 10 days of mailer drop | Fix QR→claim attribution before spending on mailers elsewhere |
| G4 Convert | ≥1 paid Presence within 60 days | Pitch timing — move paid ask to the NAP-verification call |
| Postal test verdict | Apne or Madison Halal Meat: scan OR claim within 30 days of mailer | If neither scans, postal QR is dead for this segment — don't ship it to expansion cities |

## Measurement

All funnel metrics already exist in `SeedFunnelAnalyticsService.getCohortFunnel`: `seeds`, `contactable`, `invited`, `claimed`, `claimed30d`, `napVerified`, `converted`, `touches`, `cacEstimate`, `inviteScans`, `inviteScanRate`, `potentialDuplicateSeeds` (watch this — the Swagat/Krishna and Amal/Halal & Hijab name variants will surface there).

Weekly review: pull the cohort report filtered to both campaign IDs, check gates G1–G4, update the Gap Log.

## What this playbook deliberately defers

- **Benchmarks (Krishna, Maharaja, Bombay-established) are not Touch-1 pain prospects.** Their only gaps are owned ordering and the Krishna/Swagat name split — that's a retainer/upsell conversation in Phase 3, not a fix-it pitch.
- **Hold-list businesses** (restaurants, Woodman's, out-of-category markets, unresolved-status Madison International) get no touches this cycle.
- **Retainer pitches** wait until `delivered` — selling retainer to an unclaimed prospect inverts the ladder.
