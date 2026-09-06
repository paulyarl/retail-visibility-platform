# Madison Indian Grocery (Emerging): Prospect Contact Priority

**Source audits:** `mcamp-n3fb21nq` / `maud-st6wppaz` + `maud-pnksoe9o` — Emerging discovery, Indian Grocery Store, Madison WI (run 2026-09-04)
**Companion doc:** `madison-east-washington-leadership-pitch.md` (competitive frame) — this is the **emerging frame**: same corridor, but the pains are thin footprints, unclaimed profiles, and commission leakage, not benchmark gaps.
**Headline finding:** 0–1 of qualifying candidates meet all gold-standard gates. The emerging set's pain is uniform and simple: **no owned ordering, no produce-arrival broadcast, weak or missing GBP presence**. Meanwhile the three established benchmarks (Krishna, Maharaja, Bombay) already pass most gates — they are reference context and conversion anchors, not targets.

## How Priority Is Scored

Emerging-frame weights differ from the competitive frame:

1. **Reachability** — verified phone/website.
2. **Pain clarity** — a defect that is provable in one screenshot (third-party delivery links as "website," generated `business.site` subdomain, missing GBP).
3. **`business_seek_priority` / `business_seek_recommended`** — the audit's own triage.
4. **Urgency signal** — `INT_RECENT_BUSINESS_EVIDENCE` = new business with no established habits; the window to shape their digital stack is now, before a delivery marketplace becomes their default.
5. **Identity confidence** — `medium` confidence + no phone = verify before spending outreach effort.

**Cross-audit reconciliation note:** The two audits disagree on two entities. `Swagat Indian Grocery` and `Krishna Foods` share phone (608) 831-4642 and address (6717 Odana Rd) — one business with a name-variant NAP failure, not two stores. `Little Tibet` is `verified` in audit 1 and `probable` in audit 2, but audit 2 surfaces its owned website (littletibetmadison.com) and a Forward Community Investments borrower profile. Dedup accordingly.

---

## Tier 1 — Contact First

### 1. Go Grocer Madison — *the sharpest single pain in the pool*

- **Contact:** (608) 284-7277 · 3554 E Washington Ave, Madison WI 53704 · **"website" is a Grubhub delivery link**
- **Signals:** `INT_RECENT_BUSINESS_EVIDENCE`, `INT_LOW_VISIBILITY`, `INT_POSSIBLE_CATEGORY_MISALIGNMENT`, `INT_CATEGORY_SPECIALIZATION` · identity_confidence: high · seek_priority: **high** · rating 4.8 (11 reviews)
- **Gate failures:** `website_live`, `specialty_assortment_described`, `fresh_produce_schedule_noted`, `photos_15_plus`, `reviews_50_plus` — every recommended gate except ordering, and its only ordering channel is a 15–30% commission marketplace.
- **Why first:** This is the exact cautionary tale from the leadership pitch — the former Gooh Grocery address, now operating under a new name with no owned web presence and Grubhub listed as its website. It is the best-rated emerging prospect (4.8) and the easiest demo: *"your website field on Google sends customers to Grubhub, which takes a quarter of every delivery order."* Reachable by phone, physically verified storefront.
- **Pitch angle:** "Your GBP's website button routes to Grubhub. Every order through that link costs you 15–30%. You have an unclaimed place entry — claim it, fix the name/NAP confusion with the prior tenant, and own your ordering before the commission becomes habit."

### 2. Namaste India — *reachable, verified, and nearly invisible*

- **Contact:** (608) 422-5263 · 805 S Gammon Rd, Suite A · `namasteindiamadison.business.site` (generated subdomain, not an owned site) · rating 3.7
- **Signals:** `INT_LOW_VISIBILITY`, `INT_WEAK_MAINSTREAM_INDEXING`, `INT_CATEGORY_SPECIALIZATION`, `INT_MULTISOURCE_IDENTITY` · identity_confidence: high · seek_priority: **high**
- **Gate failures:** `website_live`, `photos_15_plus`, `reviews_50_plus`, `online_ordering_or_delivery_linked` (audit 1 also fails it on `specialty_assortment_described` and `fresh_produce_schedule_noted`; audit 2 credits produce-delivery info via The Madison Guide — either way, it isn't visible where shoppers look)
- **Why second:** Already has the correct `Indian grocery store` primary category and published hours — the hard part is done. What remains is pure upside: an owned website, photo depth, review growth, ordering. SNAP/EBT certified (a trust credential with zero visibility). Reachable by phone — a fully remote-convertible prospect.
- **Pitch angle:** "You did the hard part — right category, right hours, EBT certified — and Google still shows a generated business.site page with a 3.7 rating and almost no photos. Krishna Foods down the road has 260 reviews. Here's the gap map."

### 3. Apne Bazaar — *newest entrant, cleanest blank slate*

- **Contact:** **no phone found** · 6704 Watts Rd, Madison WI 53719 · no website
- **Signals:** `INT_RECENT_BUSINESS_EVIDENCE`, `INT_VERTICAL_SOURCE_DISCOVERY`, `INT_ACTIVE_OPERATIONAL_EVIDENCE` · identity_confidence: **medium** · seek_priority: **high** (audit 2)
- **Gate failures:** no GBP at all (`primary_category_correct`, `photos_15_plus`, `reviews_50_plus`), `website_live`, `nap_phone_consistent`, `online_ordering_or_delivery_linked`
- **Why third despite high priority:** Just opened (Cap Times owner interview, named opening date) — the single best moment to set up a digital presence, and the audit flags it `business_seek_recommended: true`. It has no phone and no web presence, which makes it the **designated proving-ground case for the postal QR mailer** (see below): the only inbound channel is a physical letter, so any scan or claim is unambiguously attributable. Zero incumbent digital debt to unwind.
- **Pitch angle:** "You opened this month. Right now nothing on Google says you exist. We'll claim your place entry and get your category, hours, and produce arrivals live before your first weekly vegetable delivery."

---

## Tier 2 — Verify, Then Contact

### 4. Little Tibet Market & Café

- **Contact:** (608) 284-9190 (audit 1) / none (audit 2) · 1113 N Sherman Ave · littletibetmadison.com exists but wasn't surfaced in audit 1
- **Signals:** `INT_RECENT_BUSINESS_EVIDENCE`, `INT_VERTICAL_SOURCE_DISCOVERY`, `INT_POSSIBLE_CATEGORY_MISALIGNMENT` · confidence: medium→high · seek_priority: medium
- **Gate failures:** `hours_published` (non-negotiable), no verified GBP, `photos_15_plus`, `reviews_50_plus`, `online_ordering_or_delivery_linked`
- **Why Tier 2:** Press-documented new opening with community-development financing (Forward Community Investments) — a motivated, mission-aligned owner. Category fit is `probable` (café + grocery hybrid; may misclassify as restaurant). Verify the phone and confirm the grocery component is primary before pitching.

### 5. India House

- **Contact:** (608) 268-0240 (audit 2; audit 1 had none) · 709 S Gammon Rd · no website
- **Signals:** `INT_VERTICAL_SOURCE_DISCOVERY`, `INT_LOW_VISIBILITY`, `INT_ACTIVE_OPERATIONAL_EVIDENCE` · confidence: high · seek_priority: medium
- **Gate failures:** `hours_published` + `primary_category_correct` (non-negotiables), `website_live`, `photos_15_plus`, `reviews_50_plus`, `online_ordering_or_delivery_linked`
- **Why Tier 2:** HMS halal-certified and on UW's community-resource list — real credentials, zero mainstream surface. Note: the Middle Eastern audit held this as `insufficient` fit; the Indian audits verify it. Cross-campaign, it belongs here. Gammon Rd cluster again — same trip as Namaste (805) and Amal (807).

### 6. Bombay Bazaar

- **Contact:** (608) 237-1377 · 753 S Gammon Rd · bombaybazarmadison.com (audit 1) — audit 2 found no website and a 3.5-star Yelp listing
- **Signals:** `INT_MULTISOURCE_IDENTITY`, `INT_WEAK_MAINSTREAM_INDEXING` (audit 2) · confidence: high · seek_priority: low (audit 1) / medium (audit 2)
- **Gate failures (merged):** `primary_category_correct` (non-negotiable, audit 2), `fresh_produce_schedule_noted`, `online_ordering_or_delivery_linked`, `reviews_50_plus` / `photos_15_plus` on Yelp
- **Why Tier 2:** The audits disagree on how established it is (105 Google reviews vs. 14 Yelp reviews, 3.5 stars — different surfaces tell different stories). SNAP-authorized via legal entity Mumbai LLC. A mid-pack candidate: real store, real reviews on Google, but wrong/missing primary category and no ordering. Verified phone — remote-ready.

---

## Tier 3 — Benchmarks & Holds

### Reference benchmarks (do not pitch as emerging pain)

| Business | Status | Note |
|---|---|---|
| Krishna Foods / Swagat (6717 Odana Rd) | `gold_standard_match` (audit 1) | **One business, two names** — `nap_name_consistent` failed in audit 2. The single fix worth pitching if contacted: resolve the Krishna/Swagat name split and add owned ordering (its only failed gate in audit 1). 260 reviews, strongest corpus in market. |
| Maharaja Grocery & Liquor (1701 Thierer Rd) | `gold_standard_match` | Passes 11/12 gates; only `fresh_produce_schedule_noted` fails. Also `gold_standard_match` in the Middle Eastern audit's adjacent set — its name variant appears in both campaigns. Upgrade/retainer candidate, not a fix-it prospect. |
| IGS Wauwatosa / Patel Brothers Greenfield / India Bazaar Milwaukee | `outside_market` | Regional context only; Patel Brothers is a national chain (excluded). |

### Holds (out of category for this campaign)

Swagat Indian Restaurant (480 reviews — dining, not grocery), Woodman's (mass supermarket), Amber, Mirch Masala (restaurants), Madison Oriental Market (pan-Asian), Istanbul Market / Halal & Hijab / African Market (Middle Eastern/African — these belong to the competitive Middle Eastern campaign's Gammon Rd cluster; Istanbul = the `mcamp-io0p8470` Tier-1 leader under a name variant).

---

## Call Order Summary

| # | Business | Phone | Seek | Primary hook |
|---|----------|-------|------|--------------|
| 1 | Go Grocer Madison | (608) 284-7277 | **high** | GBP "website" routes to Grubhub — 15–30% commission on every order |
| 2 | Namaste India | (608) 422-5263 | **high** | Correct category + EBT certified, but invisible (business.site, 3.7★, no photos/ordering) |
| 3 | Apne Bazaar | none — **postal QR mailer** | **high** | Brand-new store, zero Google presence; postal QR proving-ground case |
| 4 | Little Tibet Market & Café | (608) 284-9190* | medium | New café+grocery hybrid, no hours published, FCI-backed owner |
| 5 | India House | (608) 268-0240 | medium | Halal-certified, UW-listed — no hours, wrong category, no website |
| 6 | Bombay Bazaar | (608) 237-1377 | medium | Wrong/missing primary category; 3.5★ Yelp vs 105 Google reviews split |
| — | Krishna/Swagat, Maharaja | — | low | Benchmarks: only ordering + name-drift fixes; retainer/upsell frame |
| — | 7 restaurants / supermarkets / cross-category | — | hold | Out of category or belong to the Middle Eastern campaign |

*Phone from audit 1 only — verify.

---

## Remote Engagement Model

This campaign is conducted **fully remote** — no walk-in sweep. That is deliberate: Madison is the proving ground for a remote-first motion that must work before expansion to Milwaukee, the Twin Cities, and beyond, where field visits aren't an option.

Why remote works for this segment:

1. **These operators already collaborate remotely.** Family-run international grocers coordinate suppliers, remittances, and family across countries — WhatsApp, phone, and email are their default business channels. A remote pitch is not a compromise; it meets them on familiar rails.
2. **The product is remote-native.** Claiming a seeded place entry, fixing NAP, and powering up surfaces are all done on a screen — the demo is a screen-share or a sent link, not a site visit. The prospect can see their own audit gap-map from their phone behind the register.
3. **Every hook in this doc is remotely demonstrable.** "Your website button goes to Grubhub," "your hours are missing on Google," "your competitor has 260 reviews" — each is a link or screenshot, deliverable by text or email before the first call.

**Remote contact paths, in order of preference:**

| Path | Prospects |
|---|---|
| Phone → WhatsApp/text follow-up with gap-map link | Go Grocer, Namaste, Little Tibet*, India House, Bombay Bazaar |
| Press-referenced owner outreach (Cap Times interviews name owners) | Little Tibet |
| **Postal QR mailer to the storefront address** | **Apne Bazaar (6704 Watts Rd) — designated proving-ground case** |
| Referral chains (mosque/community anchors, UW community lists) | India House, Little Tibet |

### The Apne Bazaar Postal QR Test

Apne Bazaar is the ideal postal-QR proving ground precisely because it has *no other channel*: no phone, no website, no GBP. A mailed letter to 6704 Watts Rd is the only inbound path, so attribution is clean:

- **Mailer contents:** the seeded place entry, the audit gap-map (zero Google presence vs. Krishna's 260-review benchmark), and a QR code pointing to the claim flow.
- **Signal chain:** `qr_scan_events` (claim_invite surface) → place-entry claim → first funnel conversion with zero phone/email touches. A scan that doesn't convert still proves the mailer was opened and read — a measurable warm-lead signal no other no-phone prospect can provide this cleanly.
- **Why it generalizes:** if a postal QR converts a merchant with zero digital surface in Madison, the same playbook reaches no-phone prospects in any expansion city — it's the channel that doesn't depend on the merchant having *any* existing digital presence.

**What remote does *not* change:** the ranking. Reachability was already weighted first — four of six Tier-1/2 prospects have verified phones. The two without (Apne, partially Little Tibet) stay ranked on pain clarity, with a concrete non-visit contact path noted.

**Cross-campaign overlap:** India House, Maharaja, Istanbul, and Halal & Hijab appear in both audits under different category verdicts. The Middle Eastern campaign owns Istanbul/Halal & Hijab; this campaign owns India House and Maharaja. Reconcile before outreach so no merchant gets pitched twice under two categories.
