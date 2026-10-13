# Audit Channel Scan & Opportunity Collection — Functional Spec

**Injects into:** `apps/api/src/scripts/business-audit-default-body.md` (canonical body asset, template `mpt-seed-seek-001`, output schema `business_analysis`)
**Status:** Implemented — Pass 1 shipped 2026-10-13 (evidence collection: `channels_scanned`, `observed_assets`, `{field}_observed_on`, §A2 gate). Pass 2 landed 2026-10-13 (engagement-brief template + `engagement_brief` schema/audit row + `classifyFootprintSide` side classifier + import stamp). OQ1/OQ5 shipped 2026-10-13 (migration 337 — first-class fulfillment columns + public filters + seed `observed_assets`). Judgment migration (OQ7) remains open.
**Date:** October 2026 (revised 2026-10-13 — review gaps folded in)
**Triggering incident:** Dreamcast African Market audit (2026-10-13). The business's live delivery offer — verified on three public surfaces (Instagram bio, Apple Maps `Delivery` chip, MapQuest `Offers delivery`) — emitted as `unable_to_verify`, because the field definition is channel-scoped while its evidence rule is website-scoped.

---

## Problem Statement

The business audit is a deficit ledger. It is very good at establishing what a business is missing, and structurally unable to record what a business already does well. That asymmetry is not a prompt-quality problem — it is baked into the directive text and the output schema in four places.

### Defect 1: The field is channel-scoped, its evidence rule is website-scoped (root cause)

`business-audit-default-body.md`, `### Product Visibility & Ordering`:

> **L480** — `has_delivery_option` — does the business offer delivery surfaced online (own site **or marketplace**)?

> **L483** — Record true/false only when the website content was verified per the Website Accessibility Verification standard — a directory snippet or cached page is not proof.

The field asks about marketplaces and any online surface. The rule forbids crediting anything but the verified website. For a business with a dead website — the population with the most to gain from this audit — the field is unreachable. It cannot be satisfied by evidence that exists, only by evidence that doesn't.

Two adjacent lines reinforce the same scoping:

- **L389** (`Recommended Attribute Suggestions`): *"…verified audit evidence (e.g. a delivery page observed on the business website)."*
- **L393**: *"Evidence-gated attributes (e.g. SNAP/EBT, delivery) recommend verification"* — delivery is treated as unproven by default, alongside SNAP/EBT.

The current rule correctly refuses to treat a search snippet as proof the *website works*. It incorrectly extends that refusal into proof that *nothing exists anywhere*.

### Defect 2: Channels are "consulted sources," not evidence fields

**L219** directs the analyst to consult delivery marketplaces, social platforms (Instagram, TikTok, WhatsApp), vertical directories, importer/wholesaler locators, and registration records — and then names the only place to record them: `specialized_sources_audited`.

That field is `{source, tier, source_type, consulted, findings, url, accessed_date}` — `findings` is free text. So a verified, monetizable operational fact ("free delivery within Indianapolis on orders over $200") lands as a sentence in a string nobody reads, rather than a field something can act on. The channel is scanned; the nugget is discarded at the schema boundary.

### Defect 3: There is no collection for observed assets

`market_opportunities` is explicitly *synthesized from* `gap_analysis`, `market_gaps`, and `website.conversion_opportunities` — all three gap-shaped. `outreach_problems` (L119) is grounded in pains, with an asset admissible only as a *solution ingredient*.

No field in `business_analysis` can hold "they already run free delivery over $200." The schema has no shape for a strength. This is why the delivery offer nearly missed entirely: it had no landing zone, so it was demoted to narrative.

### Defect 4: Opportunity emission is gated on an optional input block

`market_opportunities` and `signal_checklist` are emitted only when Market Context is present, and `signal_checklist` is omitted entirely when the *category* block is absent. In the triggering audit the CITY MARKET CONTEXT block was present but the CATEGORY MARKET CONTEXT block was not, so `signal_checklist` had to be dropped.

A nugget channel that disappears when an optional upstream enrichment is missing is not a reliable channel.

### Defect 5: Schema asymmetry — SNAP/EBT got a contract, fulfillment got nothing

The prompt explicitly carves SNAP/EBT out of the generic attribute inventory (L380) because it has *"dedicated fields (snap_ebt_reported) and a stricter regulatory contract."* That contract is real and complete:

| Layer | SNAP/EBT | Delivery / fulfillment |
|---|---|---|
| Prompt field | carve-out at L380 | none |
| DB column | `directory_listings_list.snap_ebt_reported`, `snap_ebt_as_of`, `snap_ebt_source`, `snap_ebt_source_name` | none |
| Migration | `207_directory_visibility_snap_ebt.sql` | none |
| Public filter | `?snap=true`, `sort=snap` in `directory-presence-public.ts` | none |
| Provenance | `directory_field_provenance` (`field_key: snap_ebt`) | none |
| Owner confirmation path | settings UI checkbox | none |

Two discovery classes with the same evidentiary status, landing in wildly different places. The class with a home gets captured; the class without one gets narrated.

### Incident example

| Step | What happened |
|---|---|
| Discovery | Instagram profile rendered: *"Free delivery within Indianapolis IN on orders of $200"* |
| Corroboration | Apple Maps Good to Know chips: `Delivery`, `Accepts Apple Pay`, `Accepts Contactless Payments`; MapQuest: `Offers delivery` |
| Emission | `website.has_delivery_option: "unable_to_verify"` |
| Disposition | Fact survived only as prose inside `website.issues` and `specialized_sources_audited.findings` |
| Downstream impact | The audit's own `outreach_problems[2]` was written around a weaker "show the shelves" angle, and the platform's BOPIS/omnichannel offer had no evidentiary hook in the output |

The business was described as having no ordering channel at all, when in fact it runs one.

---

## Design Principles

1. **Confidence comes from provenance, not assertion.** "Emit confidently" must not mean "assert harder." The audit's binding constraint is that findings surface *verbatim on a public listing* and *spoken aloud by an operator*. The fix is to give each nugget a citation and a confidence tier so the downstream writer does not have to hedge — not to relax the evidence standard.
2. **Collection is separate from judgment.** Evidence has a long life and is platform-agnostic. Fit-to-offering has a short life and changes whenever the platform's product changes. Do not couple them in one artifact.
3. **"Absence is not a negative" needs its positive twin.** The Category Intelligence block guards the false negative (an unfound asset is not an absent asset). There is no matching rule for *found-and-underexposed* — the case that is actually monetizable.
4. **Goals live in the audit; offerings live in the opportunity pass.** Goals shape *what evidence you collect* and are stable. Offerings shape *what you pitch* and are volatile.
5. **Collect before you classify.** The audit cannot know in advance which observed fact is monetizable — a shipping-promo post, a review nugget, a credential buried in a profile, a delivery claim on a marketplace card. Presence-level detail is collected as evidence first; fit-to-offering is judged downstream. The evidence is the gold mine.
6. **Thin footprints need capture, not silence.** Emerging prospects in this category often have no owned surface and only scattered traces — a social profile, a locator record, a single review. Every verified presence fact is worth capturing for a follow-up, even when no gap signal fires. A gate that suppresses evaluation because the one field it trusts is missing works against the prospects the platform most wants to reach. This is the rationale for the §A2 decision.

---

## Proposed Changes

### A. Rescope the product-visibility evidence rule (L483)

Highest leverage, smallest diff. This edit alone would have emitted `has_delivery_option: true` for the triggering audit.

The fields are tri-state today (`true|false` when verified, `null`/`unable_to_verify` otherwise — the validator stores unable-to-verify as `null` via `coercedBooleanNullableTolerant`). The rescope must preserve that contract: **`false` is a verified negative and downstream consumers are armed on it.** `has_pickup_ordering === false && has_delivery_option === false` fires `WC_MISSING_PICKUP_DELIVERY` in `signal-extractor.ts`; `=== false` feeds the costing-customers band of `ProspectReportService.buildProductsChapter` (the `missing:` strings at L1183–1190 — including "No delivery option on the site") and the fulfillment copy in `DeliverableSectionService` (L498 "No delivery option", plus a catch-all at L500). Emitting `false` for "didn't see it" would mass-produce verified-absence claims — the exact "absence is not a negative" violation this template guards elsewhere.

**Both binding lines move, not just L483.** L475's preamble — "Record on `website` (each true/false/null — *null when there is no website or the page content cannot be verified*)" — independently forces the wrong outcome on a dead site. Amend L475 to keep the fields in the `website` object (schema stability) while deferring evidence scope to the new rule, and **replace L483 with:**

> Record each field as **true** when the offer is observed on **any verified public surface** — the owned site, a social profile or post, a delivery or ordering marketplace, or a directory attribute chip — and name the surface in the field's companion `{field}_observed_on` entry. A directory snippet alone is not proof of website *content*; it is proof of a *stated offer*.
>
> Record **false** only on an explicit negative statement on a rendered surface (e.g. "in-store pickup only," "no shipping"). When no rendered surface addresses the question, emit `unable_to_verify` — absence of an observed offer is never a verified absence.
>
> The website-quality fields (`mobile_friendly`, `https`, `contact_information_visible`, `click_to_call_available`, `call_to_action_present`, `service_information_present`, `location_information_present`, `category_specific_content_present`) remain **website-scoped** and require verified site content per the Website Accessibility Verification standard.
>
> When `business_type` is `service`, the product-visibility fields are null.
>
> Each product-visibility field carries a `{field}_observed_on` companion (channel value or null) — the surface the determination came from. The fields stay under `website.*` for schema stability; `observed_on` is what makes a non-site attribution honest.

**Also update the two reinforcing lines:** L389's parenthetical should read *"(e.g. a delivery offer observed on the business's Instagram, Apple Maps card, or site)"*; L393 should stop treating delivery as evidence-gated-by-default and instead gate it on the observed surface.

**Companion consumer change (required, not optional).** Code that speaks `website.*` facts to the owner attributes them to the site: `ProspectReportService` renders "Your site offers a delivery option" and "Customers can order for pickup online" off `=== true`; `DeliverableSectionService` writes "No delivery option" off `=== false`; archetype opener prompts phrase pickup/delivery as site capabilities. Once these fields can be sourced from Instagram or Apple Maps, that copy becomes false. The same change must read `{field}_observed_on` and name the real surface — or rephrase to "found online." Tracked as a rollout step below.

### A2. Downstream gate: the signal is suppressed before it reads the fields (new finding — resolved: option A)

The tri-state contract above is necessary but not sufficient. `signal-extractor.ts` L470–472 computes a suppression flag before any conversion-friction signal is evaluated:

```
const thirdParty = status === 'social_media_only' || isSocialPlatformHost(website.url);
const builderSubdomain = !thirdParty && isBuilderSubdomainHost(website.url);
const frictionSuppressed = thirdParty || builderSubdomain;
```

L486 then opens the block with `if (websiteExists)`, and the pickup/delivery check sits inside `!frictionSuppressed` (the gate closes at L572).

**Consequence:** when the recorded website is a social page or a builder subdomain, `WC_MISSING_PICKUP_DELIVERY` — along with `WC_MISSING_PRODUCT_BROWSING` and `WC_MISSING_AVAILABILITY_INQUIRY` — never fires, whatever the product-visibility fields say. That is precisely the `WC_THIRD_PARTY_DOMAIN` population the category intelligence describes as the norm in this market.

The incident business is **not** affected — `website.url` is `dreamcastmarket.com`, an owned domain, so `thirdParty` is false. But the general case is, and this decides whether change A does anything downstream: for a social-URL business, correcting the fields to `true` or an explicit `false` would move no signal, no archetype, and no outreach hook.

The gate's original rationale was sound. With only a URL field to reason from, a social URL genuinely means *we cannot judge friction on a website that may not exist*. The channel scan changes the evidence available — a verified fulfillment determination no longer depends on the website at all.

| Option | Behavior | Trade-off |
|---|---|---|
| **A. Channel evidence unlocks the gate** | A verified fulfillment determination from `channels_scanned` (any surface) evaluates the signal even when `frictionSuppressed` | Best evidence wins; changes firing rates for the social/builder population — the largest one here |
| **B. Gate stays closed** | Channel data flows to `observed_assets` / Pass 2 only | Zero risk to existing signal semantics; change A moves nothing downstream for that population |
| **C. Narrow the gate** | Keep suppression for the website-content signals (browsing, availability inquiry); exclude the fulfillment signal, which is channel-sourced by design | Middle path — makes the gate signal-specific rather than block-level |
| **D. Defer** | Land A–E; record this as an open question | Ships the collection without touching the signal layer |

**Resolved 2026-10-13 — option A: channel evidence unlocks the gate.**

Rationale: for emerging, thin-footprint prospects any verified signal is worth capturing for a follow-up, and a blanket suppression keyed on a single URL field is the wrong instrument once the channel scan exists. A social-URL business that explicitly states "in-store pickup only" should fire the signal; today it cannot. See Principle 6.

**A is only safe because of the tri-state rule in change A. The two ship together or not at all.** With `false` reachable only on an explicit rendered negative, unlocking the gate *evaluates* the signal rather than manufacturing it — a thin-footprint business with no rendered fulfillment information still emits `null` and fires nothing. Unlocking the gate while reverting the tri-state rule would mass-produce verified-absence claims for exactly the population this decision is meant to serve.

**Scope of what A changes: suppression → conditional evaluation.** It does not make the gap signal fire more often for thin footprints; it makes it *possible* to fire on verified evidence. The capture need is carried by `channels_scanned` and `observed_assets` (presence-level facts) plus the existing `INT_*` family — `INT_ACTIVE_OPERATIONAL_EVIDENCE`, `INT_UNDEREXPOSED_CREDENTIAL`, `INT_HIDDEN_TRUST`, `INT_LOW_VISIBILITY` — all of which emit independently of this gate. Do not expect A to be the capture mechanism.

### B. New block: `Channel & Offer Scan — REQUIRED`

Gives Instagram-class evidence a structured home — offers, postings, review and presence nuggets alike. Emits top-level `channels_scanned[]`:

```
{
  "channel": "instagram|facebook|tiktok|whatsapp|google|yelp|apple_maps|bbb|owned_site|marketplace|order_ahead_platform|directory|locator|registry|third_party|other",
  "url": "<string|null>",
  "rendered": true|false,
  "access_barrier": "none|js_required|bot_defense|captcha|login_wall|rate_limit|timeout|not_attempted",
  "offers_observed": ["<offer, promotion, or stated capability the surface itself states — a shipping-promo post IS a stated offer>"],
  "notable_activity": ["<observed fact — posting cadence, review counts, engagement, community presence>"],
  "fulfillment_modes": ["delivery|pickup|curbside|shipping|in_store"],
  "payment_modes": ["card|contactless|apple_pay|cash|online_payment"],
  "availability_channel": "whatsapp|dm|phone|web_form|none",
  "last_activity": "<ISO date|null>",
  "confidence": "verified_on_surface|inferred|verify_with_owner"
}
```

Rules:
- One entry per channel **actually attempted**, whether or not it rendered — a login-walled channel is a recorded channel — **plus** one `access_barrier: "not_attempted"` entry for each channel the audit was directed to consult (Category Intelligence specialized sources, discovery leads) but skipped. The sweep boundary becomes explicit data rather than an omission — and this is how the sweep budget (Open Question 4) gets measured.
- `rendered`/`access_barrier` for the four primary platforms (google, yelp, facebook, bbb) duplicate `platforms.{platform}`/`render_controls` and **must agree** when both are emitted. The two ledgers answer different questions: `render_controls` is the attribution ledger (whose fault a non-render is); `channels_scanned` is the evidence ledger (what the surface contains). For non-primary channels, `channels_scanned` is the only ledger.
- Channel vocabulary: `marketplace` = an intermediary where the merchant has a storefront/order page (DoorDash, Uber Eats, Grubhub); `order_ahead_platform` = the business's own ordering surface hosted by a provider (Square Online, Toast, Clover); `directory` = attribute-bearing listing surfaces beyond the primary four (MapQuest); `locator` = registry/authorization locators (USDA FNS retailer locator, importer/wholesaler directories); `registry` = official records (SOS filings, permits); `other` for the rest.
- `offers_observed` records only what the surface itself states — including stated promotions in posts. `notable_activity` records observed activity facts (posts, review counts, engagement, following). Never infer either from the business's category or name. A channel that did not render contributes neither — but its attempt is still recorded.
- Every monetizable offer or asset fact in these arrays MUST also land in `observed_assets` — `channels_scanned` is the per-surface raw record; `observed_assets` is the deduplicated cross-surface roll-up. Facts that are only observations stay here and are not promoted.
- SNAP/EBT is never recorded in `payment_modes` — it keeps its dedicated `snap_ebt_*` contract (the same carve-out as platform attributes at L380). Its underexposure may still be an `observed_assets` entry (below).
- Division of labor with `specialized_sources_audited` and `sources`: channel surfaces go in `channels_scanned`; non-channel sources consulted (community lists, case studies, records without a per-business public page) stay in `specialized_sources_audited`; `sources` remains the flat URL log. The binding text at L55/L219 ("record every consulted source in `specialized_sources_audited` and `sources`") must be amended to name this split, or sources get double-counted.
- Channel-level `confidence` states how the entry's facts stand; per-fact nuance lives on `observed_assets[].confidence`.
- `availability_channel` is single-valued (the primary way a customer checks stock); `none` means no observed channel. This block is where the platform's own channels become visible: a business already answering stock questions in Instagram DMs has an `availability_channel: "dm"` that no current field captures.

### C. New block: `Observed Assets — REQUIRED`

The opportunities collector. Emits top-level `observed_assets[]`:

```
{
  "asset": "<short label>",
  "evidence": "<the observed fact>",
  "source_url": "<string|null>",
  "observed_on": "<channel>",
  "also_seen_on": ["<channel>", ...],
  "confidence": "verified_on_surface|inferred|verify_with_owner",
  "underexposed": true|false,
  "underexposure_note": "<string|null>"
}
```

`observed_on` names the primary surface; `also_seen_on` records corroborating surfaces. The incident's delivery fact stood on three (Instagram bio + Apple Maps chip + MapQuest) — multi-surface agreement is what makes `verified_on_surface` defensible, so the shape must be able to hold it.

Scope — assets, not gaps. Candidates include: fulfillment offers and their terms, payment modes, SNAP/EBT authorization, supply-chain relationships (direct import, wholesale partners), certifications (halal, kosher), community/social following, photo inventory, tenure, languages served, and counter services (butchery, remittance, money transfer).

`underexposed` is an **observable check, not a judgment**: the asset was verified on at least one surface AND is absent from every surface the business controls (owned site, claimed/active profiles). Whether it is worth pitching is Pass 2's call — the flag only records that the business's own surfaces don't carry it; `underexposure_note` names which.

Dedup rules — `observed_assets` overlaps existing structured homes on purpose; these rules keep the overlap consistent rather than contradictory:
- Facts with dedicated contracts keep those fields as fact-of-record: `snap_ebt_reported` and friends remain the SNAP home — an `observed_assets` entry for SNAP records the *underexposure finding* and cites the dedicated field; it does not restate the authorization.
- Platform attribute chips stay in `platforms.{p}.attributes` (the raw sourced inventory); a chip that is a monetizable asset is *also* rolled into `observed_assets`. The duplication is intentional — different consumers — not drift.
- `operational_status.last_activity_*` remains the canonical business-activity field; `channels_scanned[].last_activity` is per-channel evidence feeding it, not a second source of truth.
- Emit `observed_assets: []` when nothing qualifies — the block is REQUIRED, so an empty array is a real answer (the conditional-field omit rule at Output Rules L938 does not apply to it).

Worked examples from the triggering audit:

| asset | evidence | observed_on | underexposed |
|---|---|---|---|
| Free delivery over $200 | Instagram bio; Apple Maps + MapQuest delivery chips | instagram | `true` — no owned surface carries it |
| SNAP/EBT authorization | USDA FNS retailer locator (fact-of-record: `snap_ebt_*` fields) | locator | `true` — no chip on any rendered profile |
| Direct Lagos import supply chain | public case study; partner list | third_party | `true` — appears nowhere the business controls |
| Active social following | Instagram public profile, 9,320 followers, posts through 2026-10-10 | instagram | `true` — bio carries no website link |

`underexposed: false` is a legitimate and useful result — it means the asset is already doing its job and the operator should not pitch fixing it.

### D. Widen `market_opportunities` inputs

Amend the Market Intelligence Output Fields directive so `market_opportunities` is synthesized from `gap_analysis` + `market_gaps` + `website.conversion_opportunities` **+ `observed_assets` where `underexposed` is true**. The current input set is all-deficit, which forces every opportunity to be framed as a repair.

This widening is deliberately one clause — if `market_opportunities` later migrates to Pass 2 (below), the clause dies with it. Cheap enough to do for the interim rather than leave the field all-deficit until then.

### E. Ungate opportunity emission from Market Context

`market_opportunities` should emit whenever it can be grounded — Market Context enriches it, but its absence should not suppress the field when audit findings and `observed_assets` give it material.

`signal_checklist` cannot be ungated — it is defined as one entry per `category_signals` item, and with no Category block there are literally no signals to evaluate. The honest fix for both fields is the same: **whenever a gated field is suppressed by a missing upstream block, record the suppression in `data_quality.limitations`**, so a downstream consumer can tell "no opportunity" from "opportunity field not evaluated." The bindings already do this at block level (L60/L75/L111); extend it to name the suppressed field explicitly.

### F. Positive sentiment — reviews as a context source, not an audience metric

**The gap.** The audit's review capture is asymmetrically negative. It collects `negative_review_themes` (body L772, schema L759) and `unanswered_negative_review_examples` (schema L758), but the positive side exists only as *counts* — `observable_unanswered_positive_reviews` — with no content collection anywhere. `reviewThemeSchema` is used for negative themes alone.

**Why it matters.** Sentiment is not audience volume — it is **context**. It is frequently the only public surface that establishes how a business actually operates: what it is known for, what customers expect of it, which channel drives its traffic, where its physical constraints are. Excluding review *volume* from the density score (above) does not exclude review *content* from the audit. Those are different inputs, and only the first was the problem.

What the triggering audit's reviews established, against where each fact could land today:

| What sentiment revealed | Structured home today |
|---|---|
| Known for fufu flour specifically (assortment identity) | none — no positive-theme collection |
| Same-day delivery is expected and praised | `observed_assets` only if the analyst promotes it out of prose |
| Instagram ads drive store traffic | none |
| Owner-vs-counter service split (a regular withdrew over it) | `negative_review_themes` — the negative half only |
| Needs a wheelchair ramp at the entrance | none — a physical constraint, not a review theme |

Four of five have no home. That is precisely the failure mode this spec exists to fix: a verified, useful fact demoted to narrative.

**Proposed shape (Pass 1).**

```
"positive_review_themes": [
  { "theme": "<string>", "observed_frequency": "<low|medium|high|null>",
    "supporting_review_count": <number|null>, "summary": "<string|null>" }
],
"sentiment_context": [
  { "observation": "<what the reviews establish about how this business operates>",
    "source": "<platform>" }
]
```

`positive_review_themes` reuses the existing `reviewThemeSchema` verbatim — no new type. `sentiment_context` is deliberately not a theme list: it carries the operational facts sentiment establishes (assortment identity, fulfillment expectations, traffic channel, physical constraints, service dynamics) that are neither a strength nor a defect yet shape how the business should be approached. Each entry cites its platform so it stays evidence rather than impression.

**Directive rules.** Positive sentiment establishing a strength is promoted into `observed_assets` (`observed_on: "reviews"`), not left sitting in the theme list. Sentiment establishing a defect stays in `negative_review_themes` / `gap_analysis`. `sentiment_context` is for the residue that is neither, but still shapes outreach. Absence of positive themes is not evidence of poor sentiment — record "not verified" per the standing absence rule.

**What consumes it.** Pass 2: `sentiment_context` informs `engagement_shape` (what to lead with, what to avoid claiming) and can seed `assets`; `positive_review_themes` is the evidence source for a "customers already value X" beat.

**This does not route the side.** The side remains surface-only (see above). This section reads "reviews play a role" as *context*, not as a routing input — if sentiment should also influence routing, that is a separate decision and the density model would need revisiting.

**Cost.** Body asset + embedded schema + validator + marker bump + reseed (local and prd) — the same rollout shape as A–E.

---

## Two-Pass Architecture: Gather, Then Judge

The system is two prompts with a hard boundary between them.

- **Pass 1 — Business Audit.** Collects evidence. No judgment. Emits observations, channel scans, observed assets, and benchmark deltas.
- **Pass 2 — Engagement Brief.** Consumes Pass 1's evidence, applies judgment, and emits one structured deliverable that downstream artifacts project from.

**Recommendation: do not put platform offerings into the audit body.** Keep the platform *goal* there — the existing `PLATFORM GOAL: PHYSICAL SHELVES` block is precisely why the shelf framing worked — and move the *offerings* to Pass 2.

### Why separate

- **Lifetime mismatch.** Offerings change constantly; audits are stored artifacts with `template_body_snapshot` on every past execution. Baking offerings in means every offering change invalidates every stored audit and re-runs a channel sweep to answer a question that changed for commercial rather than evidentiary reasons.
- **Publishability separation.** The audit feeds public listings and `public_narrative`. The template already fights to keep tier names, scores, and package language out of public output. Pitch-fit content sitting one field away from public output is an avoidable leak surface.
- **Cost asymmetry.** The channel sweep is expensive and render-bound. Fit evaluation is cheap and text-only. Re-running fit against a stored audit should not require re-sweeping channels.
- **One spine, many projections.** Project plan, proposal, pitch, call script, report, and narrative all need the same underlying decisions — what is the top pain, what does the business already do well, what is blocked, what must not be claimed. Deciding those once and projecting many times keeps the artifacts from contradicting each other.

### Pass 1 is not currently judgement-free — this is the honest gap

The principle above is not yet true of the audit as written. `business_analysis` already emits a substantial amount of judgment:

| Field | Nature | Belongs in |
|---|---|---|
| `gap_analysis`, `quality_gate_results` | benchmark deltas — deterministic rule application against the Gold Standard block | **Pass 1** (keep) |
| `digital_opportunity_score`, `alignment_scoring`, `high_attention` | rubric-scored indices — deterministic from evidence | **Pass 1** (keep) |
| `action_classification`, `lead_disposition` | triage output, already wired downstream | **Pass 1** (keep) |
| `market_opportunities` | interpretation — what to do about it | **Pass 2** (migrate) |
| `outreach_problems`, `primary_outreach_hook` | pitch copy | **Pass 2** (migrate) |
| `recommended_services`, `recommended_tier`, `tier_rationale`, `estimated_monthly_service_fee` | commercial positioning | **Pass 2** (migrate) |

The line to draw: **rule application stays in Pass 1; interpretation and pitching move to Pass 2.** A rubric score computed from evidence is reproducible from that evidence, so it is a fact about the evidence, not a judgment about the business. A hook line is not.

This is a real migration with downstream consumers (`lead_disposition`, triage), so it may need to be staged — but it should be named as the target, or the boundary will erode the first time someone needs a hook quickly.

### Pass 2 emits a spine, not a document

Two rules make the projections trustworthy:

1. **Evidence references, not restatements.** Every pain and asset carries a `ref_id` into an `evidence_index` that maps to an audit field path. Pass 2 must not paraphrase the underlying fact into a new sentence — otherwise facts drift between the audit and the pitch, and the provenance chain that makes the audit publishable-standard is broken at exactly the point where it is spoken aloud to an owner.
2. **Rank once, project many.** The call script and the proposal must not independently decide what the top pain is. Ranking happens once, in the brief; projections render it.

### Brief shape

```
{
  "brief_version": 1,
  "source_audit_id": "<mkt_audits_list.id>",  // the audit this brief cites — audits and executions are different tables; cite the audit
  "business": { "name": "", "category": "", "store_format": "" },

  "side": {
    "value": "emerging|competitive",
    "density_score": 0,                      // the computed score — boundary is auditable and tunable
    "inputs_used": [],                       // which audit evidence produced it (uncapped ledger)
    "density_breakdown": {},                 // per-component { observed, awarded, cap } — score is reproducible
    "classifier_version": 1
  },

  "evidence_index": { "<ref_id>": "<audit field path>" },

  "pains": [{
    "ref_id": "",
    "severity": "high|medium|low",
    "business_consequence": "",              // the customer-facing cost, not the technical label
    "evidence_ref": "",                      // a ref_id key into evidence_index — never a paraphrased fact
    "confidence": "verified_on_surface|inferred|verify_with_owner",
    "visibility": "internal|client_safe|public_safe"
  }],

  "assets": [{
    "ref_id": "",
    "asset": "",
    "underexposure": true|false,
    "how_to_use": "",                        // lead with it / leverage it / leave alone
    "evidence_ref": "",
    "confidence": "verified_on_surface|inferred|verify_with_owner",
    "visibility": "internal|client_safe|public_safe"
  }],

  "capability_fits": [{
    "capability": "",
    "addresses_ref": "",                     // -> pains[].ref_id | assets[].ref_id
    "why_it_fits": "",
    "confidence": "high|medium|low",
    "visibility": "internal|client_safe|public_safe"
  }],

  "verification_gates": [{
    "gate": "",                              // what must be confirmed before it can be claimed
    "blocks": "",                            // which pain, asset, or capability_fit it gates
    "who_can_answer": "owner|operator|public_source",
    "visibility": "internal|client_safe|public_safe"
  }],

  "engagement_shape": {
    "primary_hook_ref": "",                  // -> pains[].ref_id
    "lead_with": "",                         // pain or asset first
    "do_not_claim": []                       // affirmative prohibitions
  }
}
```

Two confidence vocabularies, on purpose: evidence-backed items carry the audit's tri-state (`verified_on_surface|inferred|verify_with_owner`); pure-judgment items (`capability_fits`) carry `high|medium|low`.

`verification_gates` and `do_not_claim` are the load-bearing additions. The EBT/deposit question and the "don't say the domain was hijacked" caution are not footnotes — they are constraints that change what an operator is allowed to say. Putting them in the spine means every projection inherits them instead of each one rediscovering them (or not).

### Projections

Each consumer reads the same spine and renders a different slice:

| Consumer | Reads | Renders |
|---|---|---|
| Project plan / execution | `capability_fits`, `verification_gates` | sequenced work items, dependencies, confirm-before-build gates |
| Proposal | `capability_fits`, `pains`, `verification_gates` | scope, deliverables, explicit exclusions |
| Pitch / call script | `pains[0..2]`, `assets`, `engagement_shape` | opener, pain-evidence lines, the "you already do this" beat, `do_not_claim` guardrails |
| Reports | Pass 1 `digital_opportunity_score`, `alignment_scoring`, `gap_analysis` | verified baseline and movement over time |
| Narratives | Pass 1 `observed_assets`, `public_narrative` inputs | public-safe asset and category facts only |

The Reports and Narratives rows are deliberate: those two consumers read **Pass 1 directly**, not the brief. Reports need the rubric indices (facts), and narratives must stay inside the publishable-standard boundary that the brief — being internal — is not required to respect.

These consumers are not hypothetical — they are existing services that each read `audit_data` directly and independently decide the top pain today: `CallScriptService`, `OutreachOpenerService`, `HeaderService`/`CloserService`, `OutreachFollowUpService`, `DeliverableSectionService`/`DeliverableSourceService`, `ProspectReportService`, archetype selection, `ManualOutreachScriptService`, `IdentityPacketService`. "Rank once, project many" is therefore a migration across ~10 readers, not a greenfield — that migration surface is the real cost of Pass 2, and the reason the judgment migration (Open Question 7) is staged rather than big-bang.

### Visibility tagging

Because the spine is internal and some projections are public or client-facing, every spine item carries a `visibility` tag (`internal | client_safe | public_safe` — now in the brief shape above) so a renderer cannot leak a tier name or an `underexposure` note into a public narrative. This is the same guardrail the audit template already enforces for its own output, applied one layer up. Since Narratives read Pass 1 `observed_assets` directly (not the spine), the same boundary applies one layer down: `asset`/`evidence` facts are public-safe material — the `public_narrative` directive already invites verified services — while `underexposed`, `underexposure_note`, and `confidence` never render publicly. One directive line in the Observed Assets block should state this explicitly.

### Contract between the passes

Pass 1 **emits channel leads, assets, and evidence**; Pass 2 **consumes them and judges fit**. One-directional. Pass 2 never re-sweeps, never re-renders, and never introduces a fact Pass 1 did not observe — a fact it needs but does not have becomes a `verification_gate`, not an assumption.

### The side: emerging vs competitive (prompt emits inputs, code stamps)

Two executions, one routing decision:

| | Primary — Business Audit | Secondary — Engagement Brief |
|---|---|---|
| Role | Visits the channels; gathers evidence | Consumes evidence **+ the side**; shapes its focus |
| Emits | Countable footprint evidence | The focused deliverable (plan, pitch, proposal, script spine) |
| Decides | Nothing about posture | Everything downstream of the side |

**Naming — three axes, three names.** Call it the **side**, on the **footprint density** axis. Do not call it an archetype: `ArchetypeCode` (`A1`–`A8`, `archetype-selection.ts` L27) is an existing and different concept in the same subsystem. Do not call it magnitude: `SignalSeverity` (`crisis | material | cosmetic | borderline`, `signal-magnitude.ts` L33) owns that word. Do not call it a lane: `PlanLane` / `SignalLane` (`project-phases.ts` L44–45) own that.

| Axis | Values | Question it answers | Owned by |
|---|---|---|---|
| Severity | `crisis \| material \| cosmetic \| borderline` | How bad is this gap? | `signal-magnitude.ts` |
| Lane | `full \| partial` | How well-evidenced is it? | `project-phases.ts` |
| **Footprint density** | **`emerging \| competitive`** | **Is there a surface to measure at all?** | **the side classifier (new)** |

**What the prompt emits — the inputs.** No new audit field is required: change B already delivers the countable inputs the classifier needs.

- `channels_scanned[]` — rendered channels, `last_activity`, `notable_activity`
- `platforms.{p}.profile_status`, `platforms.{p}.rating`, `platforms.{p}.total_reviews`
- `combined_review_metrics.observable_total_reviews`
- `website.status`, `website.url`

That the inputs arrive through the channel scan rather than a bespoke self-assessment field is deliberate — the classifier should read evidence, not the audit's opinion of the business.

**What code stamps.** A pure, versioned function — shaped like `selectArchetype`, so it is deterministic and unit-testable — consumes the audit evidence and returns:

```
{ side: 'emerging' | 'competitive',
  density_score: number,
  inputs_used: string[],
  classifier_version: number }
```

Stored on the brief beside `source_audit_id`. Persisting `inputs_used` and `classifier_version` is what makes the boundary auditable and the threshold tunable: a later reclassification is visible rather than silently contradicting a pitch already in the field.

**It must read activity, not just channel count.** A 9,320-follower Instagram posting last week and a dormant Facebook page with 12 followers are both "one social channel." A presence count alone would classify them identically. Weigh `last_activity` and `notable_activity`, not only rendered-channel count.

**Audience is not a routing input (decided 2026-10-13).** The side routes on **surface** density — whether the business owns or controls a surface it can be measured on. Review volume, follower counts, and traffic are deliberately excluded from the score: the platform's priorities are surface/presence, so audience volume would only decide the side if those priorities were audience/traffic-aligned.

This matters concretely. The triggering prospect carries ~600 observable reviews and **zero owned surface** — no website, no catalog, no ordering. Scoring audience (+3, the largest non-anchor input) routed it to `competitive` and away from the presence work it actually needs. Under the surface rule it lands `emerging`, which is also what the exemplar framing called for. Worth naming the shape: **high audience, low surface** is one of the platform's best prospect types — demand already exists, presence does not — not a competitive signal.

Nothing is lost by excluding audience from the score: the brief embeds the full source audit, so Pass 2 still sees `combined_review_metrics` and can use it as context without it deciding the route.

**The side is a precondition, not a peer.** It gates which signals are reachable at all. An emerging prospect has nothing to measure, so its focus is presence — build the surface, capture what exists, invite the claim. A competitive prospect has surfaces, so its focus is deficiency and optimization. The secondary's `capability_fits` will therefore look structurally different per side; design for that rather than forcing one shape with different emphasis.

**Default when unclassifiable: `emerging` (recommended — see Open Question 8).** In this category the intelligence measured 0 of 55 businesses with any Yelp presence and most with no owned site, so the thin case is the norm, not the exception. Defaulting the other way applies instruments that cannot read the majority of the market.

**Never public.** The side is a routing input; it never reaches `public_narrative` or any owner-facing surface.

Lands with Pass 2 — the classifier has no consumer until the brief exists.

### The brief must be stored to be a spine

"Rank once" is only enforceable if the brief is a persisted, versioned artifact — otherwise every projection re-derives ranking and the spine exists only in theory. Options: a dedicated table keyed to `source_audit_id`, a new `mkt_audits_list` platform row (`engagement_brief`), or execution metadata on the Pass-2 run. Decided with Pass-2 identity (Open Question 3) — a storage decision, not a naming detail.

### Inputs

Pass 1 `business_analysis` output + a `PLATFORM CAPABILITIES` block (custom domain, hosted storefront, product catalog, deposit + full payment, BOPIS, directory listing, claim service, review response).

### Worked example from the triggering audit

- `pains[0]`: no owned web surface — `evidence_ref` → `evidence_index["w1"] = "website.issues[1]"`, severity high.
- `assets[0]`: free delivery over $200 — `evidence_ref` → `evidence_index["a1"] = "observed_assets[0]"`, `underexposure: true`, `how_to_use: "leverage — the store already fulfils; the offer is just invisible"`.
- `capability_fits[0]`: hosted storefront + BOPIS + deposit — addresses `assets[0]` and `pains[0]`.
- `verification_gates[0]`: EBT/payment-mode mix — blocks the deposit-first framing, `who_can_answer: owner`.
- `verification_gates[1]`: product catalog data absent — blocks a stocked storefront, `who_can_answer: owner`.
- `engagement_shape.do_not_claim`: "the old domain was hijacked" (the archive cannot distinguish lapse from compromise); "we'll recover dreamcastmarket.com" (the domain is gone, not dormant).

---

## Schema & Persistence Changes

1. **`business_analysis` validator** — declare `channels_scanned[]` and `observed_assets[]` as `.optional()` (`business_analysis` is a *shared* schema — the review-response template also emits it, so nothing may be required). Correction to an earlier claim in this section: undeclared keys are **not** dropped on import — `importExternalResult` persists the raw parsed JSON (`audit_data: parsedJson`) and every level of the schema is `.passthrough()`, so undeclared keys land in `audit_data` anyway (precedent: `social_activity`, read by `signal-extractor` but declared nowhere). What they don't get is coercion, enum validation, or a slot on the `BusinessAnalysisAuditData` type — so declare first anyway, or the new arrays ingest unvalidated and stay invisible to typed consumers. `business_analysis` also sits in `LEGACY_NO_SUFFIX_SCHEMAS`, so `BUSINESS_ANALYSIS_PROMPT_SUFFIX` is never appended to rendered prompts — update it anyway to prevent drift, but the embedded body schema is the operative output contract.
2. **Body schema block** — the embedded JSON schema (around **L1103**, where `has_delivery_option` is declared) must gain the new arrays **and** the `{field}_observed_on` companions **before** the directives land: Output Rules L932 ("Do not add properties outside the schema") otherwise forbids the model from emitting them at all. Also state the empty-vs-omit contract: `channels_scanned`/`observed_assets` are REQUIRED blocks — `[]` is a valid emission, not a conditional-field omission.
3. **Template columns** — `output_schema` must remain `{ name: 'business_analysis' }`; the seeder already force-applies this even when the body marker is present.
4. **Persistence.** DECIDED + SHIPPED (2026-10-13): see Open Questions 1 and 5 — fulfillment facts became first-class listing columns (migration 337); underexposed assets land on the seed as internal metadata, not listing chips.
5. **Consumer copy pass (blocking, small).** `ProspectReportService` ("Your site offers a delivery option" L1438, "Customers can order for pickup online" L1435, and the `missing:` strings at L1183–1190 — "No delivery option on the site", "No way to order for pickup online"), `DeliverableSectionService` fulfillment copy ("No delivery option" L498, catch-all L500), and archetype opener phrasing all attribute `website.*` facts to the site. Once `{field}_observed_on` exists these must name the real surface — or the owner-facing report states something false. Gate "your site" phrasing on `observed_on === 'owned_site'`; otherwise say "found online" / name the surface.

---

## Rollout

1. Edit `business-audit-default-body.md` — the asset is the source of truth. This includes the L475 preamble **and** L483 (both bind the product-visibility fields to the website), the L55/L219 `specialized_sources_audited` binding lines (name the `channels_scanned` split), the §F sentiment blocks (`positive_review_themes` + `sentiment_context`), and the embedded schema.
2. Bump `DEFAULT_AUDIT_MARKER` in `seed-business-audit-v2-templates.ts` (**L1906**) so the body transform re-applies. Bump `SEED_VERSION_MARKER` (**L57**) only if the seeder's binding-section transforms change.
3. Land the validator and body schema-block changes **first** — the embedded schema is the model's only output contract (`business_analysis` is in `LEGACY_NO_SUFFIX_SCHEMAS`), and "Do not add properties outside the schema" would forbid the new fields outright.
4. Land the downstream code changes in the same release: the consumer copy pass (item 5 above) — the report/deliverable attribution bug ships the moment `observed_on` can be non-`owned_site` — and the §A2 gate change in `signal-extractor.ts` (exclude the fulfillment signal from `frictionSuppressed`), which is inert until the fields can carry channel-sourced determinations.
5. Reseed local, verify against the triggering business, then reseed prd.
6. Past executions are unaffected: they retain `template_body_snapshot`. Decide whether to re-run audits for in-flight prospects.

---

## Acceptance Criteria / Test Plan

**Positive (the incident, replayed — manual verification, not a deterministic test; the audit path is render → external agent → import, so the live re-run is non-repeatable)**
- Re-running the Dreamcast African Market audit yields `website.has_delivery_option: true` with `has_delivery_option_observed_on` naming the surface, not `unable_to_verify`.
- `channels_scanned` contains an `instagram` entry with `rendered: true` and `offers_observed` naming the delivery offer, and an `apple_maps` entry carrying the delivery chip.
- `observed_assets` contains the free-delivery offer with `underexposed: true` and `also_seen_on` carrying the corroborating surfaces, and the SNAP underexposure finding with `underexposed: true`.
- `market_opportunities` gains an order-ahead/BOPIS entry grounded in the observed delivery offer rather than in a gap.

**Negative (guardrails must survive)**
- A business with no website and no rendered channels emits no `offers_observed`/`notable_activity` and no fabricated `observed_assets` — `observed_assets: []` is the honest emission, not omission.
- A business whose rendered surfaces never address delivery emits `has_delivery_option` as `null`/`unable_to_verify` — **not** `false` — and `WC_MISSING_PICKUP_DELIVERY` does NOT fire. `false` is reachable only via an explicit negative statement on a rendered surface ("pickup only," "no shipping"); the verified-negative contract the signal layer keys on is preserved. Note the signal is also suppressed upstream by `frictionSuppressed` (`signal-extractor.ts` L470–472, L486) whenever the recorded website is a social page or builder subdomain — see **A2**; this criterion holds under either resolution of that fork.
- An asset that is *not found* is still recorded as not verified — the new positive path must not become a license to infer.
- A login-walled channel records the attempt with its barrier and contributes nothing else; a skipped channel records `not_attempted`.
- `channels_scanned` entries for primary platforms agree with `render_controls`/`platforms.{p}` on `rendered`/`access_barrier` — no contradictions between the two ledgers.
- `underexposed: false` is reachable — assets that are already surfaced must not be flagged for pitching.
- A monetizable offer in `offers_observed`/`notable_activity` also appears in `observed_assets`; a non-monetizable observation does not.
- Gate (§A2): a social-URL or builder-subdomain business whose rendered surfaces state an explicit negative ("pickup only", "no shipping") now fires `WC_MISSING_PICKUP_DELIVERY`; the same business with no rendered fulfillment information emits `null` and still does not fire. The gate changes suppression into evaluation — it never manufactures a signal.
- Sentiment (§F): positive themes are collected and reuse `reviewThemeSchema`; a positive theme establishing a strength also appears in `observed_assets`; every `sentiment_context` entry cites a platform; an absent positive theme records "not verified" and never reads as poor sentiment; neither `positive_review_themes` nor `sentiment_context` influences the side.
- Side (§"The side"): the side is stamped in code and carries `inputs_used` + `classifier_version`; an unclassifiable footprint resolves to `emerging`; a single social channel with recent activity does not classify identically to a dormant one; the side never renders publicly.
- Public-safety: no tier, package, score, or pitch language reaches `public_narrative` via the new fields; `underexposed`, `underexposure_note`, and `confidence` never render publicly. And no owner-facing copy attributes a non-`owned_site` fact to "your site" — the `observed_on` companion is respected in `ProspectReportService`, deliverable copy, and opener prompts.

**Test placement**
- Prompt-body assertions belong with the existing `ResolvePrompt` tests (`apps/api/src/services/__tests__/ResolvePrompt.test.ts`) for marker/binding-section coverage.
- Emitted-shape assertions belong with the `business_analysis` validator tests — a fixture built from the incident's emitted audit, amended per the new rules, is the deterministic stand-in for the non-repeatable live re-run.
- The `=== false` cases are already pinned: `signal-extractor-sprint1.test.ts` L191–224 covers false/false (fires), true/false and false/true (do not). **Extend that block with the `null` case** rather than adding a file — `null` is the one combination the new contract introduces and the existing tests do not cover. `TriageEngineService.test.ts` and `ProspectReportService.test.ts` carry the integration-level `null` and `observed_on`-aware copy assertions.

---

## Known Minor Issues — classifier & stamp (review findings 3–5)

Findings against **shipped** code, recorded for team review. None is a correctness bug; all three are legibility or consistency issues. Finding 2 (the `source_audit_id` trust boundary) is closed — the stamp no longer preserves a model- or operator-emitted id, and OQ8 is decided. Line numbers are current as of 2026-10-13.

### F3 — `inputs_used` is uncapped while the score is capped

**Location.** `apps/api/src/services/engagement-brief/footprint-side.ts` §2 L152–157, §3 L166–173, §4 L179–184.

**Mechanism.** Each component awards a capped number of points but pushes **every** contributing entry:

```ts
score += Math.min(renderedChannels.length * POINTS_RENDERED_CHANNEL, CAP_RENDERED_CHANNELS);
inputs.push(...renderedChannels.map((c) => `channels_scanned[${c.channel}].rendered`));
```

**Reproduction.** 16 rendered channels → awarded 6 points (the cap), 16 input strings pushed. Same shape for recent activity (cap 3) and notable activity (cap 2). No current test pins `inputs_used.length` — they all use `toContain`.

**Why it matters.** `side.inputs_used` is persisted on every brief and is the artifact the spec calls *"what makes the boundary auditable and tunable."* As written it over-reports: a reviewer reading 16 `rendered` entries would reasonably infer all 16 scored. Anyone tuning the threshold off `inputs_used`, or reading it to explain why a business landed `emerging`, gets inflated component counts. The array is also unbounded — roughly `3N + 10` entries for `N` rendered channels.

**Options.**
1. Push only what earned points (slice each group to its cap). Cheapest; loses the raw observed count.
2. Push all entries **and** add a `density_breakdown` object recording per-component `{ observed, awarded, cap }`. Makes the score fully reproducible and the caps visible.
3. Leave as-is; document `inputs_used` as "inputs observed," not "inputs scored."

**Recommendation: option 2.** The reason to persist the score at all is explainability — a breakdown makes `emerging` vs `competitive` defensible without re-running the classifier, and it preserves the raw counts the distribution script wants.

**Test to add.** A fixture with more channels than the cap (e.g. 6 rendered) asserting both `density_score` and the breakdown, so the cap behaviour is pinned rather than incidental.

**Status: closed 2026-10-13** — option 2 implemented. `FootprintSideResult.density_breakdown` records `{ observed, awarded, cap }` per component (`owned_site` / `rendered_channels` / `recent_channel_activity` / `notable_channel_activity` / `claimed_platforms` / `rated_platforms`); `inputs_used` stays the uncapped observed ledger, and the sum of `awarded` equals `density_score`. Persisted on the stamped `side` block; pinned in `footprint-side.test.ts` and `engagement-brief-stamp.test.ts`.

### F4 — one platform contributes across three inputs; `owned_site` is guarded, platforms are not

**Location.** The `owned_site` guard at `footprint-side.ts` L128–135 versus the platform scoring at L145–202.

**Mechanism.** `owned_site` is deliberately excluded from `renderedChannels` — *"one surface, one contribution."* A primary platform is not: `channels_scanned[google].rendered` (+2), `platforms.google.profile_status` (+1), and `platforms.google.rating` (+1) can all fire for the same surface — up to 4 points.

**Is it double-counting?** Arguably not — three distinct facts (the surface rendered; the profile is claimed; it carries a rating). But the code guards one form of double-counting and not the other, and nothing states which behaviour is intended. A reviewer cannot distinguish design from oversight.

**Consequence worth confirming explicitly.** With **zero owned surface**, four rendered primaries plus two claimed and two rated scores exactly `6 + 2 + 2 = 10` — precisely `COMPETITIVE_DENSITY_THRESHOLD`. So `competitive` is reachable on primary-platform evidence alone.

That is defensible under "surface is the priority" **if a claimed profile counts as a controlled surface** — which is the difference between *surface = owned site* and *surface = owned or claimed*. The scoring already assumes the second reading; it just never says so.

**Recommendation.** State the equivalence in the module docstring (a `claimed`/`likely_claimed` profile is a controlled surface, and therefore anchors density the way an owned site does) and add a test pinning the intended per-platform maximum. No scoring change unless the team decides claimed profiles should **not** count as surface — in which case the claimed cap needs revisiting, since it can carry a business to the threshold unaided.

**Status: closed 2026-10-13** — DECIDED: "surface = owned OR claimed" is confirmed. A `claimed`/`likely_claimed` primary profile is a controlled surface (the business can post, respond, update — and for claimed businesses the emerging playbook's claim-invitation step is already moot). The module docstring states the semantics explicitly, and tests pin both the per-platform maximum (+4: rendered + claimed + rated) and the claimed-only path to the threshold (4 rendered primaries + 2 claimed + 2 rated = exactly 10 → `competitive`). No scoring change.

### F5 — `buildEngagementBriefVariables` omits `inputs_used` from the injected variable

**Location.** `engagement-brief-stamp.ts` L74–82 injects `{ value, density_score, classifier_version }`; `applyEngagementBriefStamp` writes `{ value, density_score, inputs_used, classifier_version }`.

**Assessment.** Almost certainly deliberate and correct. The model does not need the input list — it reads the raw evidence directly from `{{source_audit}}`, and `inputs_used` can run to dozens of entries, which would be prompt bloat for no gain. The only cost is that the two shapes diverge, so a reader comparing them cannot tell which is canonical.

**Recommendation.** Keep the omission and name it deliberate in a one-line comment: `inputs_used` is the persisted audit record, not prompt material — the model sees the evidence itself via `{{source_audit}}`. Note this interacts with F3: if option 2 is taken there, the breakdown belongs on the persisted stamp only, not the render variable.

**Status: closed 2026-10-13** — the injected `footprint_side` variable carries a comment naming the omission deliberate; `inputs_used` and `density_breakdown` persist on the stamped `side` only.

---

## Open Questions

1. **Fulfillment persistence.** DECIDED (2026-10-13): first-class listing columns + public filters, mirroring migration 207's SNAP/EBT contract. Migration `337_listing_fulfillment_and_seed_assets.sql` adds `delivery_offered`/`pickup_offered` (tri-state: NULL = unobserved, false = explicit rendered negative, true = observed/owner-confirmed — only `= true` matches a public filter) plus `fulfillment_as_of`/`fulfillment_source`/`fulfillment_source_name` provenance to `directory_listings_list`, with partial `= true` indexes. The fact-of-record is the audit's any-verified-surface rollup — `website.has_delivery_option`/`has_pickup_ordering` + the `*_observed_on` companions — not `channels_scanned[].fulfillment_modes` (the raw per-surface record). Extraction lives in `services/directory/fulfillmentFacts.ts` (`extractFulfillmentFromAuditData` returns null when the audit addressed neither field, so a "didn't look" audit can't erase prior evidence). Two write paths: `createFromCampaign` at seed birth, and `syncFulfillmentForCampaign` (best-effort from `importExternalResult` after a real `business_analysis` import, same lane as `resharpenSeedsForCampaign`) for seeds that predate the audit — per-field COALESCE keeps a prior sourced value when the new audit left that field null, and `fulfillment_source='owner_confirmed'` outranks audit writes. Operator edits via the seed editor default to `fulfillment_source='ops_review'`. Public surface: `delivery=true`/`pickup=true` params on `/api/public/directory/places/search`, `deliveryOffered`/`pickupOffered` on the search/category/city payloads, and chips on the `/place` cards. Deliberately NO `features_list`/tier wiring — these are directory-seed filter columns, not a claimed-merchant badge (207's tier machinery gated the owner-facing SNAP badge toggle; no equivalent exists for fulfillment).
2. **EBT and the deposit flow.** The store is a SNAP-authorized retail point. EBT generally cannot fund deposits or delivery fees, and online EBT requires separate FNS approval. If a meaningful share of a store's customers pay with EBT, a deposit-first BOPIS flow excludes them. Does the offering need an EBT-aware path, and is that a product question or an outreach-caveat question?
3. **Pass 2 identity.** New prompt job name, template id, seed script, and output schema? Does it reuse `mpt-seed-seek-001`'s pattern (single default template, marker-gated seed) or take a different shape? The brief's storage home is part of this question — dedicated table keyed to `source_audit_id`, a new `mkt_audits_list` platform row, or execution metadata — and it is load-bearing: "rank once" is unenforceable without a persisted spine.
4. **Sweep budget.** How many channels per audit, and what is the latency/cost ceiling? The render-control discipline (business + control per platform) does not scale to a dozen channels without a budget. The `not_attempted` entry type makes the boundary self-recording — every channel the audit was directed to consult but skipped shows up as data, so the budget can be tuned off real sweeps rather than guessed.
5. **Asset → listing flow.** DECIDED (2026-10-13): internal seed metadata, not public chips. `extractSeedObservedAssets` (same module) gates to `confidence === 'verified_on_surface'`, caps at 20, and stores the entries — `underexposed`/`underexposure_note`/`confidence` included — on `directory_presence_seeds.observed_assets` (migration 337). Written at `createFromCampaign` birth and refreshed by `syncFulfillmentForCampaign` on audit import. Operator-visible on the seed detail page ("Observed Assets" section); never rendered publicly — these entries are intentionally NOT `attributes[]` chips: a public listing chip needs owner-facing copy, which an asset's `evidence`/underexposure note doesn't carry.
6. **Backfill.** Do existing stored audits get a re-run, or does the new collection apply only going forward?
7. **Judgment migration sequencing.** Moving `market_opportunities`, `outreach_problems`, `primary_outreach_hook`, `recommended_services`, `recommended_tier`, and `estimated_monthly_service_fee` from Pass 1 to Pass 2 is the correct target, but `lead_disposition` and triage already consume Pass 1 output. Stage it (dual-emit during transition, then remove) or accept a breaking change?
8. **Side-classifier boundary and default.** DECIDED (2026-10-13): unclassifiable → `emerging`; `COMPETITIVE_DENSITY_THRESHOLD = 10` in `footprint-side.ts`. Measured via `apps/api/src/scripts/footprint-side-distribution.ts` (doppler, classifier v2): local 35 audits max score 8, prd 32 audits max score 5 — nothing has crossed 10 because pre-Pass-2 audits carry no `channels_scanned`/activity inputs (website + claimed/rated platforms alone cap at 8). `competitive` is therefore reachable only on rendered-channel evidence, which is the intended semantics — a real measured surface, not mere existence. Re-run the script once channel-scan audits accumulate; bump `FOOTPRINT_SIDE_CLASSIFIER_VERSION` if the boundary moves.

---

## Non-Goals

- Changing the render-control or platform-absence machinery. It works and the new blocks depend on it.
- Adding platforms to the four primary audited platforms. The channel scan is additive and does not create platform objects for non-primary channels.
- Automating the channel sweep at discovery-scan time. Discovery leads stay hypotheses; verification stays in the audit.
- Relaxing the evidence standard. Every new field carries provenance and a confidence tier; nothing in this spec permits inference to be emitted as observation.
- Generating the downstream artifacts (project plan, proposal, call script, report, narrative) inside Pass 2. Pass 2 emits the spine; the projections are separate, cheap renders over it. A single prompt asked to produce a plan *and* a proposal *and* a call script does all three mediocrely and lets each one decide the top pain independently.
