# Audit Doctrine & Unsolicited-Audit Funnel Spec

> Status: **pre-proof** — doctrine + product spec for the audit-driven
> acquisition funnel. Split out of `NRS_INTEGRATION_PARTNERSHIP_SPEC.md`
> 2026-11-01: the audit intelligence work is its own artifact, independent of
> the (future-vision) NRS partnership track — though the same doctrine is what
> surfaced NRS as competitive intel in the first place.

## 1. Signal doctrine — all audits are good audits

The seed→enrichment→audit pipeline produces no waste; every outcome is
routable signal:

- **Deep profiles** → competitive/emerging intel. Platform dependencies fall
  out of rich data — this is literally how NRS was discovered (a seeded
  profile's tech/site signals exposed the register behind it).
- **Thin, broken, unclaimed profiles** → the invisible set. The gap IS the
  finding: "this merchant is undiscoverable" is itself the sales narrative
  that drives claims.
- **Even apparently complete profiles** → hidden surfaces still emerge under
  audit (chains, platform ties, stale signals). "Invisible" describes what
  hasn't been looked at yet, not just what looks thin.

Bronze-standard triage therefore isn't a filter that discards — it's a
classifier that routes every profile into either the product pitch
(*"your profile is invisible — claim it"*) or the intel map (*"this store
runs NRS"*). Every signal traces back to a **narrative** (who the store is,
who serves it, who can't find it) and **discoverability** (the measurable
gap between shelf and searcher).

POS-provider detection note: public/photo signals cover only the
*branded-hardware incumbent* set (NRS registers, Clover stations, Toast,
Square stands). Software-native/emerging POS is invisible in public data by
definition — the real per-merchant dataset requires an explicit probe at
claim time (optional "which POS do you run?" + add-on chip clicks + OAuth
connect as ground truth). The two layers cover disjoint populations.

## 2. Worked audit — Enerem African Food Store (Fort Wayne seed)

One seed, one pass, seven distinct findings — proof the taxonomy is real:

| Signal | Evidence | Implication | Prescription |
|---|---|---|---|
| Platform fingerprint | Footer branding resolves to **Ecwid** (Lightspeed's embedded-commerce product), not Lightspeed POS — `www.eneremfoods.company.site` cited on-site | Webstore-layer stack, not register-layer | Ecwid connector candidate (public OAuth API — Clover-tier, no BD gate) |
| Chronology (RDAP) | `eneremafricanfoods.com` reg. 2022-08-02; `eneremfoods.com` reg. 2024-06-30 | The Shopify build is the *newer* parallel attempt, not the original | Migration direction = old→new, in flight |
| Migration state | Lightspeed/Ecwid store fully operational (real catalog, reviews, sales, gift cards); Shopify shows `660x600` placeholders + "Example title product" stubs after ~16 months + parked Hostinger NS | Likely **stalled/abandoned paid build** — proven spend, unmet intent | Hottest prospect class: "you paid for a storefront that never shipped" |
| Broken canonical | Merchant-published URL `www.eneremfoods.company.site` → `SSL_ERROR_NO_CYPHER_OVERLAP` (`www.` on a hosted subdomain isn't cert-covered) | Self-published website field dead-ends — Google sees it too (trust demotion) | Free diagnostic finding — "your own site link doesn't load" |
| Archetype | Indexed product pages list `17189 Delancey Court, Huntertown IN` — residential address; About copy is delivery-native | `storefront_online` merchant, not pickup retail | Online storefront type; GBP service-area, not walk-in pitch |
| Geo-broken pin | Discovery audit (maud-2sd3zzqh): GBP pin resolves to `51.207, -121.988` — **British Columbia, Canada** — while the business serves Fort Wayne | The map card is useless for local discovery *and* poisons Google's location trust; invisible without opening place details | Claim + correct pin — one-field repair with immediate local-search effect |
| Channel sprawl | Competitive audit review-corpus read: "shipped orders **and an Amazon channel**" | Fourth storefront surface (own site + stalled Shopify + GBP + Amazon) — merchant already runs multi-channel catalog ops | Catalog-sync pitch lands on a proven workflow, not a new behavior |

Aggregate read: **stack sprawl** (2 domains + Ecwid subdomain + GBP + broken
canonical + geo-broken pin) — the consolidated pitch writes itself. The seed
listing is often the cleanest URL in a merchant's footprint.

## 3. What the discovery engine already emits (field-name alignment)

The production intelligence-discovery audits (`intelligence_discovery` platform,
`audit_data.report_evidence` / `discovered_businesses`) already produce most of
the funnel's raw material — the unsolicited report is a render/delivery layer
over existing output, not new detection machinery:

- **Per-candidate evidence** — `observations` (state/confidence/source),
  `discovery_provenance` (URL-keyed), `category_assessment`, `suggested_categories`,
  `gold_standard_gate_results` — the defect → evidence backbone.
- **A defect vocabulary in production** — `competitive_weaknesses[]` keys:
  `website_gap`, `nap_drift`, `unclaimed_secondary_profiles`, `no_conversion_path`,
  `single_platform_concentration`, `thin_service_surface`, `thin_media_surface`,
  `stale_content_surface`, `category_drift`. These map 1:1 onto
  preview-vs-full-report defect slots.
- **Self-proposed signal codes** — the scans themselves emit `suggested_signals`
  (`INT_GEO_BROKEN_PROFILE`, `INT_LABEL_PREMISES_MISMATCH`,
  `INT_VARIANT_NAME_SECONDARY_LISTING`, `INT_ECOMMERCE_CATEGORY_FIT`,
  `INT_COLLOCATED_RENAME_RESIDUE`, `INT_SHARED_PREMISES_IDENTITY`) — the
  taxonomy grows from the field, not the spec.
- **Enerem surfaced in both scans** — emerging (obs7 cites the second domain
  `eneremfoods.com` as corroborating evidence) and competitive (excluded at
  the premises gate with `ecommerce_label_masking` as a `suggested_reason`).
  The engine grabbed both sites and classified the archetype correctly before
  the manual dig ever happened.

The residual deep-dive layer the discovery pass does *not* cover: platform
fingerprint (Ecwid/Shopify/"Powered by" footers), canonical health probes
(TLS/resolve/www-variant), RDAP chronology, stall/placeholder diffing over
recrawls, and `reach_channels` extraction.

## 4. Analyst gap pass — folded into the existing business audit

Not a new workload. The seams already exist:
`intelligence/report-directives.ts` and the `*-directive.ts` family
(`hasdata-ground-truth`, `interactive-verification`,
`operator-profile-evidence`) are the established mechanism for tasking a
deeper analysis; `mkt_audits_list` already stores discovery rows
(`platform: 'intelligence_discovery'`) in the same table a business audit
lands in; business-audit v2 templates render through
`BusinessAnalysisAuditCard`. So the gap pass is **one directive + one audit
row type on existing machinery** — a business audit invoked with the
prospect's discovery `audit_data` as input and a directive tasking the new
depth checks (gap scoring, webstack forensics, canonical probes,
reach_channels). No new pipeline, no new workload — the deep dive is a
business audit with a discovery-input payload and a forensic directive.

**Twin awareness — the BA's input resolver must see siblings.** A single
prospect can appear in *multiple* discovery audits across sibling campaigns
(same `business_prospect_id` / shared `parent_campaign_id` — e.g., Enerem
sits in both the emerging scan `mcamp-i5biri6s` and the competitive scan
`mcamp-ehve59tt`). Each twin carries *different* evidence: the emerging audit
recorded the second domain `eneremfoods.com`; the competitive audit caught
the geo-broken pin, the Amazon channel, and emitted `ecommerce_label_masking`
as a `suggested_reason`. A BA fed only one audit sees half the footprint. So
the discovery-input step resolves **all** `intelligence_discovery` rows naming
the candidate (across sibling campaigns and scans), merges observations/
weaknesses/suggested_signals per candidate key, and treats divergent twins as
corroboration — the twin set *is* the input, not a single audit row.

**Market-scoped narrowing.** The twin pool is resolved *within* the prospect's
market — same city/market and category context (e.g., Fort Wayne × African
Grocery), keyed on candidate_key/`business_prospect_id` and sibling-campaign
edges — not a global name match. Names collide across markets; only
same-market audits are true twins.

**Scoring dimensions the pass emits:**

1. **Gap diversity** — how many *independent* gap classes the candidate carries.
   Enerem is the exemplar: premises/label mismatch (ecommerce masking +
   geo-broken pin) AND footprint sprawl (2 domains + hosted subdomain) AND a
   flagged `INT_ECOMMERCE_CATEGORY_FIT` — three independent classes on one
   prospect. Multi-class candidates are the richest report material.
2. **Gap severity** — non-negotiable gate failures outrank recommended ones.
3. **Gap actionability** — defects the platform can fix (claim + correct pin +
   live storefront) outrank observation-only findings.
4. **Evidence depth** — obs count and confidence backing each gap (a teaser
   needs citations, not vibes).

The pass's output decides routing: which candidates enter the deep-forensic
queue, which defect leads each teaser, which pitch shape fits (service vs.
conversion vs. consolidation). Full architecture: **discovery audit (broad,
cheap, market-wide) → analyst gap pass (scored gap bundles, routing) → deep
forensic audit (per-prospect webstack forensics) → unsolicited report (render
+ delivery)**.

**The hold bucket IS the unsolicited-audit pool.** The engine marked Enerem
`business_seek_recommended: false` / hold — "recorded for completeness" —
because the premises gate disqualifies it for the Business Seek pitch. Under
the audit doctrine that same record is the *richest* prospect in the scan
(seven gap classes on one merchant). Seek-pipeline disqualification and
audit-funnel prioritization are different rankings over the same data: the
gap pass routes holds to the audit funnel instead of discarding them.

## 5. The unsolicited-audit funnel (product spec)

The audit IS the outreach — "here's what I found about your storefront."

1. **Teaser (unsolicited, email/print)**: 1–2 damning defects with implications
   only — e.g., *"the website URL on your business listing fails to load (SSL
   error) — Google notices."* Enough to create urgency, not enough to
   self-serve.
2. **Preview page**: branded audit preview (exists: `/prospect-report`,
   `/seed-report` surfaces) showing the teaser defects + "N more findings"
   count.
3. **Full report**: every defect → implication → prescription (per the table
   format above), gated behind claim/engagement.
4. **Deliverable fork**: prescriptions route to **DFY** (platform does it —
   claim → connect → storefront live) or **DIY** (merchant fixes their own
   footprint — still a claim driver because the report lives on-platform).
5. **Channel map from the audit itself**: the footprint that produces findings
   also produces delivery channels — published emails in site footers
   (`eneremfoods@gmail.com` appears on every Enerem product page), social
   profiles (FB/IG/TikTok DM), site contact forms, GBP messaging. The audit
   should emit a `reach_channels` list alongside defects so outreach picks the
   channel the merchant actually monitors.

Design rules: prescriptions always have a platform-adjacent path (even DIY
mentions the free claim); defects cite evidence (screenshots/URLs), never
accusation — service-first tone, not "your store is broken."

**If the funnel proves out, the audit template moves upstream** — from
post-publish outreach artifact to pre-publish discovery filter. The same
signal taxonomy (platform fingerprint, canonical health, footprint sprawl,
stall detection, archetype, reach_channels) runs during prospect ingestion,
so each seed enters the queue already scored: is this merchant worth
publishing, which storefront type fits, which defect leads the teaser, which
channel carries it. The audit becomes the front door of the entire
seed→claim pipeline, not a downstream add-on.
