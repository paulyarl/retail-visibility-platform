# Multi-Archetype Outreach Playbook

**Derived from a single real prospect — Arsema G Food Mart LLC, Indianapolis — generalized so the sequence, channels, QR system and follow-ups can be run against any prospect the discovery scan surfaces.**

The worked example runs throughout as the reference case. Every mechanism named here is a platform capability, not a proposal; where something is a recommendation rather than a built feature, it is marked **[recommendation]**.

---

## 0. How to use this

1. Run (or import) a fresh business audit — see §10 for why the audit must be fresh.
2. Let triage resolve the playbook, then accept or override it.
3. Read the **sibling set** — one prospect routinely qualifies for two to five playbooks (§1).
4. Pick the **opening lane** (§2) and the **channel with evidence of owner response** (§4).
5. Run the **sequence** (§6) with the **QR system** (§5) doing the attribution.
6. Log every touch — the cadence and the QR scans are two halves of the same funnel.

### 0.1 The audit setup — operator-supplied evidence

An audit run with no operator input sees only what the analyst can render. Two operator-supplied channels close that gap, and both are rendered **into the audit prompt**:

#### (a) The directory-profile evidence file (`operator_profile_evidence_file`)

A workstation path to an operator-prepared markdown/text file of the prospect's directory profile pages — **profile fields and, where present, review text**.

**The capture:** open each profile in a browser, Ctrl+A / Ctrl+C, paste into a text file. **One section per platform with a one-line header — platform, profile URL, logged-in or logged-out.** Raw DOM-order text with page furniture mixed in is a legitimate capture; the analyst is instructed to extract the profile content from the noise and not to penalise the evidence for being unstructured.

**What the block instructs:**

| Rule | Effect |
|---|---|
| **READ FIRST** | the file is the intended *primary* evidence source for the platforms it covers — it sidesteps login walls and bot defenses, and its review text is legitimate input for sentiment and reputation findings |
| **NOT IN FILE = MISSING** | a platform the audit is expected to verify that is **absent from the file** is recorded `business_specific_failure` / verified absent **+ the missing-profile signal** — *not* `unable_to_verify`. The operator's sweep substitutes for the analyst's render attempt |
| **HIDDEN ≠ MISSING** | an authenticated-only capture is *existence* evidence. The verdict is `restricted` / `DS_PROFILE_NOT_PUBLIC` — a visibility defect to repair, not a profile to create |
| **PROVENANCE** | anything taken from the file records `attempted_by: operator` plus the platform and URL, and the capture condition where stated |
| **FALLBACK** | absent, unreadable, or no file access → proceed exactly as without it. Never blocks |

**Two failure modes to plan around:**

1. **A partial file manufactures absences.** NOT IN FILE = MISSING is assertive by design. A Google-only capture would mark Yelp, Facebook **and** BBB verified absent. **Cover every platform in the audit's verification scope** — or give each an explicit section stating the sweep outcome (*"swept logged-out, no listing found"*) so the absence is *evidenced* rather than inferred from omission.
2. **The file only works if the execution environment can read it.** The render emits the **path** and tells the analyst to open it — the file is **not** read server-side. A cloud AI provider cannot read `C:\…`, so an internal run silently falls through to the fallback and produces exactly the same output as no file at all. **Run it through the external lane** (an agent with filesystem access, importing the result) **or inline the capture into the prompt**.

#### (b) The verified-evidence ledger (Identity tab → operator evidence)

Structured rows — source name, URL, evidence state, tier, the fields they corroborate, and owner contact — rendered into the audit as a **VERIFIED EVIDENCE — OPERATOR / OWNER** block.

The block's instruction is the important part: `owner_confirmed` / `owner_corrected` facts are the strongest evidence available for those fields — **treat them as ground truth when platform data or scan-claimed leads disagree, and do not re-derive a verdict the evidence already settles.** This is where an owner phone call, a corrected phone number, or a captured social profile **outranks the audit's own read**.

#### Why the setup matters more than it looks

In the reference case, **the operator capture is what produced the review-response signal.** The audit's first pass left every response and unanswered count **null**, so `RA_UNADDRESSED_POSITIVE_BACKLOG` never fired and the review lane was unreachable. Supplying the reviews page populated the counts, the signal fired, and the prospect moved **from PB-09 to PB-05** — a different primary playbook, a different offer, and a different sibling set.

**A capture is not a convenience. It changes the routing.**

And note the sequencing: **prompt and body changes are forward-only** — an existing audit keeps its snapshot. New signals, structured alternate-listing facts and cross-platform checks exist only on audits run *after* the change. **Run the fresh audit before outreach.**

---

## 1. The funnel: signals → triage → playbook → siblings

```
discovery scan → business audit (fresh) → triage evaluate → accept/override
      → primary playbook + alternatives → create siblings → per-lane deliverables
```

### 1.1 One prospect, many playbooks

Triage evaluates **every** playbook's matching rule against the prospect's canonical signal set and returns a ranked winner plus alternatives. A prospect with a rich signal set qualifies for several lanes at once — that is the design, not a quirk.

| Playbook | Archetype | Rank | Owns |
|---|---|---|---|
| PB-04 Recovery | A2 | 1 | BBB complaints, suspensions, ownership disputes |
| **PB-05 Multi-Signal Footprint Triage** | **A5** | **2** | **the compounding case: footprint problem AND review problem** |
| **PB-09 Profile Presence & Creation** | **A8** | **3** | missing / unclaimed / integrity-broken profiles |
| **PB-01 Profile Repair & Listing Drift** | **A3** | **4** | name / address / phone drift across directories |
| **PB-02 Review Gap & Stagnation** | **A1** | **5** | review volume, drought, **review response** |
| PB-07 Product Visibility | A6 | 6 | shelves invisible online |
| **PB-08 Website Acquisition & Build** | **A7** | **8** | no site / builder subdomain / broken site |
| PB-03 (fallback) | — | 9 | — |

**Rank decides the winner.** PB-05 outranks PB-09, so the moment PB-05's rule matches, it takes the primary.

### 1.2 The dual rule — why PB-05 appears and disappears

PB-05 is the only playbook with an **empty `any` list**. Its sole path is `dual`:

```
groupA (22 codes): CP_NAP_*_DRIFT, WC_* site defects, DS_* presence codes
groupB (4 codes):  RA_REVIEW_DROUGHT, RA_LOW_REVIEW_VOLUME,
                   RA_UNADDRESSED_NEGATIVE_BACKLOG, RA_UNADDRESSED_POSITIVE_BACKLOG
```

**A groupA signal AND a groupB signal are both required.** No review signal → no PB-05, and the lane falls to PB-09 (rank 3).

### 1.3 The `none` guards — why a lane can vanish

A `none` guard excludes a playbook when any listed signal is present. Two matter constantly:

- **PB-01's `none` includes `RA_UNADDRESSED_POSITIVE_BACKLOG`** — so an unanswered-review signal *excludes* the drift lane.
- **PB-02's `none` includes the NAP drift codes** — so a business with **both** drift and a review-response gap can **never** get the review playbook. **PB-05 is that combination's home, by design.**

Consequence to plan for: **fixing one signal can move the winner.** Adding the review signal took the reference prospect from PB-09 to PB-05 and dropped PB-01 out of the alternatives entirely.

### 1.4 Siblings

Siblings are independent campaigns sharing a `business_prospect_id`, one per archetype. Two invariants:

- **One primary sibling** (`is_primary_sibling = true`); all others reference the same prospect.
- **One seed per prospect.** Only the primary sibling graduates to a directory seed — a second seed would split the claim surface. Secondaries attach with `link_role = 'sibling'`.

**Sibling creation order** (when several are worth running): A2 > A8 > A1 > A6 > A3 > A4 > A7 > A5.

---

## 2. Archetype → offer → deliverable

| Lane | Offer | Flagship deliverable | Gate |
|---|---|---|---|
| **PB-05 / A5** | FITD **$249**, retainer **$299** | triage briefing + the combined pitch | — |
| **PB-09 / A8** | FITD **$149**, retainer **$199** | `profile_presence_plan` — presence map, build plan, claim guide, **keyword surface plan** | **sections generate only when the resolved archetype is `A8`** |
| PB-08 / A7 | website scope decision | `website_mockup` / `website_build_package` | scope confirmed after the conversation |
| PB-01 / A3 | repair package | listing-drift briefing | standard repair lane |

**Two rules that catch people out:**

1. **The A8 deliverable gate is archetype-based.** If the winner is A5, none of the A8 sections generate on the primary — the keyword surface plan included. **Create the PB-09 sibling to get them.** The lanes are complementary, not duplicative.
2. **The repair track decides the pipeline.** `profile_repair` + `standard` → the review pipeline; `escalated` → the recovery pipeline (evidence intake, appeal letter). The track is set by the repair-triage prompt, not by the playbook triage — they are separate decisions.

### 2.1 Delivery lane (DFY / DIY) — decide it in the meeting

Every lane carries a done-for-you / do-it-yourself fork, and **the division of labour is lane-specific**:

| Lane | DIY | DFY |
|---|---|---|
| Repair (A3/A5/A8) | owner executes the fix sheet | operator executes on delegated access |
| Review response (A1) | platform drafts, **owner posts** | platform posts on the owner's behalf |
| Recovery (A2) | platform drafts, **owner files** | platform files on delegated access |
| Website (A7) | owner's developer builds from the package | operator builds |

**The decision input already exists: `team_signal`** (`sole_owner` / `family_team` / `small_staff`), confirmed during the walk-in or call. Sole owner → DFY (no capacity). Family team or small staff → DIY viable. Unsettled → ask, don't guess.

---

## 3. The FitD ladder — lead with the finding, not the listing

The instinct is to open with "claim your listing." **That is the close, not the open** — and in a corridor already dense with directory listings it reads as commodity.

```
1. THE FINDING        free, specific, verifiable in 30 seconds by the owner
2. THE CORRECTED RECORD   the platform's listing is MORE correct than Google's
3. THE REPAIR         the paid lane, standing on its own evidence
```

**Why it works:** the finding needs nothing from the owner but curiosity. In the reference case the finding is *"Google lists your store twice at 6667 W Washington — one filed as a convenience store, and most of your reviews sit on the one that doesn't say Arsema."* One search, undeniable.

**The reframe that fixes the "just another seed" objection:** the platform's record carries the **legal name**, the **correct address**, and files the business on the **right category shelf** — while Google carries two wrong listings. It is not another listing; it is *the corrected one*.

**And the repair pitch is independent of the listing.** Duplicate identity, split reviews, zero owner responses, wrong category, absent second sources — none of it requires the owner to care about the directory. If the claim never lands, the offer still does.

---

## 4. Communication channels

### 4.1 The rule: use the channel with evidence of owner response

Do not rank channels by effort or by convention. Rank them by **what the prospect's own record shows about how they communicate.**

In the reference case the platform's evidence was decisive:

| Channel | Evidence | Verdict |
|---|---|---|
| **Walk-in** | open daily 10:00–21:30; owner-operated counter; the finding is *visual* | **the opener** |
| **Phone** | **owner answered two platform verification calls** (10/01, 10/15) — the only channel with evidence of owner response | timing the visit + the fallback |
| Email | published (`africanmerkato@gmail.com` on the Facebook About) | follow-up trail |
| Messenger DM | published on the Facebook page | follow-up trail |
| Mail | — | last-resort drop |

**The insight generalizes:** an owner with 30 reviews and **zero responses** over four years is not an online-engagement prospect. Email and DM are delivery mechanisms, not first touches. Find the channel where the record shows a human answering — often it is the counter or the phone.

### 4.2 Walk-in first, because the finding is visual

A walk-in lets you hand the owner their own phone with the duplicate on screen. That is the highest-conversion opening available and it costs one drive. Use the phone **before** the visit to confirm the owner is on site, and as the fallback when they are not.

---

## 5. The QR system

### 5.1 Three kits, per-surface variants

There are **three** QR families, deliberately kept separate so their scans never inflate each other's funnels:

| Kit | Scope | Variants | Records as |
|---|---|---|---|
| **Claim kit** | one seed | `mail` / **`walkin`** / `social` / `email` | `claim_invite_mail`, `claim_invite_walkin`, `claim_invite_social`, `claim_invite_email` |
| **Seed report kit** | one seed's intelligence report | `in_person` / `text` / `email` / `social` / `phone` | `report_delivery_in_person`, `report_delivery_text`, `report_delivery_email`, `report_delivery_social`, `report_delivery_phone` |
| **Prospect report kit** | the whole prospect (all sibling chapters) | `email` / `text` / `phone` / `social` / `in_person` / `banner` | `prospect_report_{email,text,phone,social,in_person,banner}` |

Each variant encodes a **tracked redirect**, so the scan is recorded *before* the owner lands. Outreach signals `OX_QR_SCANNED` and `OX_QR_NO_SCAN_AFTER_MAIL` already exist, so **a drop that never scans is visible**.

**The third kit is the multi-archetype artifact.** The **prospect report** assembles one chapter per sibling — the sibling set *is* the chapter list — and its share token carries a **signed, ordered chapter list**, so a link is a *permission scope*, not a snapshot. `tier=free` renders the pitcher chapter plus locked teasers. **Report codes are not claim codes**: the report mints its own code per share action and channel, so a report scan is never attributed to the claim funnel.

### 5.2 Which kit to leave

- **Claim QR →** the claim page → the corrected profile. The FitD ask.
- **Seed report QR →** one seed's intelligence report. The evidence for a single lane.
- **Prospect report QR →** the **multi-archetype report**, every sibling's chapter in one place. **The strongest leave-behind for a prospect with several lanes** — it shows the whole opportunity rather than one facet, and it carries a free tier so an anonymous owner can read the first chapter without a commitment.

**For a cold drop with no prior conversation, the report cards are often the stronger lead** — the claim page asks for commitment before the owner knows why. On a multi-lane prospect, reach for the **prospect report** card first.

### 5.3 Logo embedding — four practical rules

1. **It is off by default** (`qr_logo`), so it must be enabled per artifact.
2. **A centre logo eats error-correction headroom** — the single most common way printed QR dies.
3. **Test-scan every variant after embedding, at the actual print size.** Not on screen, not at 100% zoom.
4. **Use the platform mark, not the business's logo.** The business's mark on a card they didn't produce implies an endorsement you do not have; the platform mark matches the page they land on. Make it feel *theirs* with the business name and address set in type.

### 5.4 Attribution: parallel channels, one destination

The variants are **not** sequential stages — a walk-in scan does not lead to a DM. They are **N channels → 1 destination, attributed per channel.** The "funnel" is the cadence *you* run; the QR variants are the instrument that tells you **which channel earned the scan**. Do not expect the variants to hand off to each other.

---

## 6. The sequence and follow-ups

### 6.1 The cadence

```
DAY 0   walk-in  ── owner present? → the conversation, finding first
                    owner absent?  → leave the 4×6 (§7) and log a `visit` touch
DAY 1   phone    ── the proven channel; reference the card if one was left
DAY 3   DM       ── Messenger / social variant
DAY 5   email    ── email variant; the finding, one number, one ask
DAY 10  mail     ── postcard variant, last-resort drop
```

De-escalating effort: a drive, then a call, then a tap, then a stamp. **Because attribution is separate, reorder empirically** — if the DM outperforms the email for a prospect, that is data, not opinion.

### 6.2 The success metric differs by stage

| Stage | What tells you it worked |
|---|---|
| **walk-in** | the **`visit` touch you log** — you were there. A scan is a bonus; many owners keep the card without scanning. |
| **phone** | the call outcome (`connected` / `no_answer` / `voicemail`) on the touch log |
| **DM / email / mail** | **the scan** — there is no other way to know |

**Log every touch.** Channels: `call`, `email`, `sms`, `mail`, `form`, `referral`, `visit`, `other`. Outcomes include `claim_qr_generated`, `report_delivered`, `report_viewed`, `report_claimed`, `report_declined`. The QR scans give you the **engagement** half; the touch log gives you the **cadence** half. Together they are the whole funnel.

### 6.3 Follow-up triggers

- **Card scanned, nothing claimed** → the owner is interested and stuck. Call, and walk them through the claim.
- **Report viewed but not claimed** (`report_viewed`, no `report_claimed`) → the evidence landed and the ask did not. Follow with the phone, which is the proven channel.
- **Card never scanned after the mail drop** → `OX_QR_NO_SCAN_AFTER_MAIL`. The sequence failed at the last stage; close the loop or stop.
- **DM/email read, no reply** → escalate to the phone, which is the proven channel.
- **Owner engaged but the lane is unsettled** → settle `team_signal`, then set the delivery lane (§2.1).

---

## 7. The 4×6 leave-behind

**Conditional artifact: leave it when the owner is unreachable.** It must work with no conversation, so it has to explain itself.

**Spec:**
- 4×6, single-sided. **QR code** (platform mark embedded). **On a multi-lane prospect, point it at the prospect report** (`in_person` surface) — it carries every sibling's chapter, and its free tier lets the owner read the first chapter without a commitment. Use the **claim** variant only when the ask is specifically the listing claim.
- The **finding** in one line, in plain language — not a generic "claim your listing" prompt. This is the whole card. Four channels delivering a commodity prompt is four chances to be ignored.
- The business **name and address** set in type — that is what makes it feel theirs.
- One action. Not three.
- **Numbers must match the operator's record**, not an older audit's. A wrong count on a leave-behind cannot be corrected in conversation.

---

## 8. Scaling to many prospects

The reference case is not special — it is a **class**: independent, immigrant-owned, multi-name storefronts whose real-world identity does not fit a single platform name field.

### 8.1 The signal clusters that recur

| Cluster | Signals | Lanes it opens |
|---|---|---|
| **Identity fragmentation** | `DS_DUPLICATE_LISTING`, `CP_NAP_*_DRIFT`, `DS_MISSING_PROFILE` | PB-09, PB-01, PB-05 |
| **Review silence** | `RA_UNADDRESSED_POSITIVE_BACKLOG` | PB-02, PB-05 |
| **Hosted storefront** | `WC_BUILDER_SUBDOMAIN`, empty catalog | PB-08 |
| **Underexposed credentials** | SNAP/EBT, direct imports, cultural events | pitch material across all lanes |

### 8.2 The reusable checks

- **Does the prospect have a second listing at the same address and phone under a different name?** Address + phone alone is the tell; a matching name is not required.
- **Which listing is older, and which is stronger?** Review age is the age proxy (the audit cannot read a creation date). In the reference case the **older** listing carried the real name and the **newer** carried the better category, more reviews, a description and the social link — which is exactly why the survivor needs the owner.
- **Are the reviews answered?** Zero responses across a healthy review base is a full lane, and it is invisible unless the audit captures the response counts.
- **Where is the owner actually reachable?** Check the record for a channel with evidence of response.
- **Does the owner's own surface contradict the listing?** A storefront that says *"items aren't available for sale yet"* settles the website question before you ask it.

### 8.3 Two sequencing rules that catch people out

- **The audit must be fresh** — see §0.1. Prompt and body changes are forward-only, so new signals and structured facts exist only on audits run *after* the change.
- **Re-evaluating triage resets the operator's acceptance by design.** The campaign keeps its stamped playbook, category and fee, but the decision must be **re-accepted** — and until it is, archetype resolution falls back to the deterministic selector. Re-accept after every re-evaluate.

---

## 9. Guardrails

- **Never overstate severity.** An owner who checks and finds the claim false dismisses everything else. A category-normal absence is not a crisis.
- **Never assert absence on a platform you could not verify.** A render blocked on both the business and the control is `unable_to_verify` — not missing.
- **Never lead with a category-normal absence.** Zero Yelp presence is the *norm* for independent African grocers in Indianapolis (0 of 55 observed) — it carries no information. Lead with the finding that is specific to *this* business.
- **Never promise review transfer on a merge.** Google *can* consolidate duplicates, but review transfer is inconsistent. Promise the work, not the date, and never "you keep all 30 reviews."
- **Never claim a platform the business is not on.** If the opener says "you show up differently across Yelp, Google and Facebook," the owner will search Yelp.
- **Never name the platform, the goal, or internal signal codes to the owner.** Signal codes and scores are operator-facing.
- **Do not fix a registry address to the storefront address.** A registered principal office differing from the trading address is category-standard, not an error.

---

## 10. The worked example — Arsema G Food Mart LLC

**Business:** Ethiopian / Eritrean grocery, 6667 W Washington St, Indianapolis. Verified physical storefront, active LLC, USDA SNAP authorized, direct importer of record.

### The chain

| Stage | Outcome |
|---|---|
| Discovery scan | surfaced via registry, USDA SNAP locator and customs manifests; bronze `alternate_identity` flagged the second profile |
| Fresh business audit | emitted `DS_DUPLICATE_LISTING`, `DS_MISSING_PROFILE`, `CP_NAP_NAME_DRIFT`, `DS_OUTDATED_HOURS`, `WC_BUILDER_SUBDOMAIN`, `RA_UNADDRESSED_POSITIVE_BACKLOG` |
| Triage | **PB-05 / A5** accepted — dual trigger satisfied (5 footprint signals ∩ 1 review signal), confidence 90% |
| Alternatives | PB-09 / A8 (create sibling), PB-08 / A7 (sibling exists) |
| Operator-verified corrections | review split **22 / 8** (not the mirror-sourced 18 / 3); owner email + Facebook page captured |

### The findings that drive the pitch

- **Two live Google listings at one address and phone** — "Arsema Food Mart" (Convenience store, 4.5 / 8) and "Ethiopian Eritrean Store" (Grocery store, 5.0 / 22). Plus codes differ in the final character: the same map point.
- **30 reviews, zero owner responses** — 100% unanswered rate.
- **The wrong category is on the listing that carries the store's own name.**
- **The social asset hangs off the duplicate name** — the Facebook page is "Ethiopian Eritrean Store." Consolidation must reattach it, not orphan it.
- **No Yelp and no BBB record.**
- **The storefront states its own catalog is not for sale yet.**
- **Three phone numbers in circulation; two addresses; five name variants.**

### The sequence for this prospect

```
walk-in  → finding on the owner's phone; owner absent → leave the 4×6
phone    → the proven channel (owner answered twice)
DM       → Messenger, published on the Facebook page
email    → africanmerkato@gmail.com
mail     → postcard variant
```

**The leave-behind for this prospect points at the prospect report** (`in_person` surface), not the claim page. With three live lanes — presence, drift and the website — the report's chapter list is the sibling set, so one card carries the duplicate identity, the listing drift and the empty storefront. The claim variant would show one facet of a three-lane opportunity.

The sibling set to create: **PB-09 / A8** (which is what unlocks the presence plan and the keyword surface plan — the A8 sections only generate on an A8-resolved archetype) and **PB-08 / A7** if the website conversation lands. Note that **PB-01 / A3** no longer matches this prospect — the review signal that fired excludes it via PB-01's `none` guard.

### Why the numbers matter

Every figure spoken to the owner must come from the **operator's verified record**, not the audit's mirror-sourced pass. In this case the audit read 18 / 3 from third-party mirrors while the live listings read 22 / 8 — and the operator's note carried the correct pair. A pitch built on the audit's numbers would have been wrong on the first sentence.

---

## 11. The founding-tenant cohort

Everything above is the **per-prospect** motion. This is the **cohort** motion — how the first tenants arrive, and what they are for.

The platform is deployed and functioning; what it has not yet been tested against is an owner who did not build it. A founding cohort is the instrument for that, and it compounds: twenty real storefronts owned by real businesses become the proof the claim motion needs, which is an asset that cannot be bought later.

### 11.1 Two roles, not one

A founding cohort is often asked to do two jobs. They are different experiments and should stay separate:

| Role | Tests | Interface |
|---|---|---|
| **Beta tenant** | the product — claim flow, catalog enrichment, hours, whether an owner understands a page they didn't build | owner-facing |
| **Second operator** | the operator system — audit, triage, campaigns, capability resolution | the docs + admin surfaces |

**A tenant never touches triage or the campaign system.** So a tenant cohort does **not** substitute for the docs-only operator run (§8.3): that instrument is still needed, and it needs a different incentive — a contractor or a partner, not a free storefront.

The tenant cohort is nonetheless the **better beta of the two**, because it tests the one thing that cannot be simulated: what an owner does when handed a page they did not build.

### 11.2 Trade, not discount

*"Free storefront"* reads as a discount, and does two unwanted things: it selects for owners who want free things, and it anchors a price that tenant #21 will then argue with.

The same economics, framed as a trade:

> *"Founding tenant — we build your storefront, you tell us what's wrong with it."*

This selects for owners who **engage**, creates a feedback obligation both sides can hold to, and leaves the price intact. It is also structurally identical to the FitD (§3) — the platform does the work, the owner participates — so it reinforces the motion rather than contradicting it.

### 11.3 Sequence: reconcile, then invite

**The cohort raises the cost of the exact class of defect this playbook keeps finding.** Six owner-facing false claims were found on 2026-10-15 alone — a business told it shows up differently on Yelp when it has no Yelp listing; a presence map reporting the two platforms a business is *missing from* as platforms it is *on*; a storefront link described as "not looking like yours" when the URL says `arsemamart`.

Those go to **owners**, and a founding cohort is a group of owners who will check. So the contract tests and the doc sync are **not parallel workstreams — they are the precondition** for inviting real businesses. Invite after the claims on the page are true, not before.

### 11.4 Cohort size

**Five to ten, not fifty.** Each tenant costs a domain decision, a catalog enrichment and claim support; the enrichment chain is designed for it but unproven at volume. At fifty the operation becomes a support desk, which teaches nothing about the product.

The consent mechanism already exists, which is what makes this safe to run: an unclaimed page carries *"this business has not claimed this page yet"* and *"ask us to take it down."* Publishing a page about a real business before they arrive is already handled honestly — the cohort is viable once the claims **on** that page are true.

### 11.5 The pitch

**The ladder still applies (§3): finding → corrected record → the ask.** The offer is the **close**, not the open.

The failure mode to avoid is a founding-tenant pitch that could be sent unchanged to any business in any category — which violates the platform's own opener rule (*"a hook that could be sent unchanged to any business in any category is a failure"*). The owner's first question is **"why me?"**, and *"we build this for businesses like yours"* answers it categorically rather than personally. Lead with the finding, and the storefront offer lands as the answer to something the owner can verify in thirty seconds.

Three rules for the copy:

1. **One feedback line.** "Tell us what's wrong and what's working" is the trade — don't restate it as "tell us what's wrong" and drop half of it.
2. **Separate the two clocks.** The **feedback window** (three months, when you check in) and the **commitment** (none) are different things. Saying them together makes the owner wonder what happens at month three.
3. **Name the exit.** *"You are free to leave at any time"* leaves the real question unanswered — **what happens to my page?** Say it: *"if it isn't for you, we take the page down."* That is more reassuring than "free to leave", because it answers what they are actually thinking.

**The copy:**

> [The finding, specific to this business — §3. For Arsema: *"Google lists your store twice at your Washington Street address, and most of your reviews sit on the one that doesn't say Arsema."*]
>
> We build this platform for businesses like yours — to make your shelves visible to the customers who already trust you. Your storefront is already built, and as a founding tenant it's yours to claim.
>
> In exchange, tell us what's wrong and what's working. We'll check in at three months — no contract either way. If it isn't for you, we take the page down.

*"Trusted customers"* is the load-bearing phrase: it says **your regulars**, not strangers — true to the walk-in mission and disarming to an owner who has been pitched "get more customers" before.

**Optional, if it is true:** name the cohort size — *"one of the first ten."* Real scarcity does more for the pioneer feeling than the word "founding" does.

---

*Playbook derived from the Arsema G Food Mart case. Mechanisms referenced are platform capabilities as of 2026-10-15; recommendations are marked.*
