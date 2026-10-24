# Market Launch Playbook Spec — "A Business in a Box"

**Status:** draft (v0.1 — consolidation spec; every stage cited is existing
machinery or an existing draft spec. This doc invents nothing new — it orders
what already exists into a repeatable market-launch kit.)

**Purpose:** One market launch = one declarative kit, not N bespoke campaigns.
Madison is the proving ground, Indianapolis the reference instantiation,
Milwaukee the expansion precedent. The next market is configuration.

**Canonical funnel** (from `seed_funnel_benchmark_gates_and_analytics_spec.md`):
**discover → seed → invite → claim → verify → paid** — with **index** now a
first-class stage between publish and invite (sitemap/indexing shipped
2026-10-24, see `SEARCH_CONSOLE_OPERATOR_GUIDE.md`).

## Companion specs (the workflow sources)

| Spec | Supplies |
|---|---|
| `PROVING_GROUND_CAMPAIGN_SPEC.md` | City-Launch Runbook (§7), PG umbrella model, checklist machinery, funnel gates G1–G4 |
| `seed_funnel_benchmark_gates_and_analytics_spec.md` | The canonical funnel, metric formulas, benchmark gates |
| `INTELLIGENCE_DISCOVERY_METRO_SCOPE_SPEC.md` | Metro fan-out — discovery campaigns sweep the ring around the anchor city |
| `BRONZE_STANDARD_SPEC.md` + `bronze-reason-catalog` skill | Blind-spot hunt lists (establishment + discovery stages) |
| `gold_standard_sprint_plan.md` | Gold benchmark scans (national stage-1 + market stage-2) |
| `PLACE_SEED_SEO_ENRICHMENT_SPEC.md` + `SeedSeoComposer` | Seed creation from campaigns with SEO packets |
| `marketing_ops_prospect_queue_sprint_plan.md` | Queue discovery — `mkt_prospect_queue` operator surface |
| `CHAIN_PROSPECTING_FEED_SPEC.md` | Cleanup-time chain catch — dedup verdicts become prospecting feed |
| `SEARCH_CONSOLE_OPERATOR_GUIDE.md` + `PLACES_SEO_INDEXING_SPEC.md` | Indexing runbook — sitemap, URL inspection, baseline tracking |
| `directory_presence_claim_handoff_spec.md` | Claim accept + gateway upgrade triad |
| `CLAIM_VERIFICATION_SIGNALS_SPEC.md` | Physicality proof — control/physical/documentary signal classes (**draft, unbuilt**) |
| `CONSULTATIVE_CALL_SPEC.md` | The seven-beat call — opener through pitch (**draft, unbuilt**) |
| `directory_presence-seed-claim` skill | Seed/claim invariants — statuses, provenance, SNAP/EBT contract |

---

## 1. The Market Kit (the box)

A market launch is one bundle:

```json
{
  "market": { "city": "Milwaukee", "state": "WI", "metro": true },
  "categories": [
    { "key": "african grocery store", "focuses": ["emerging", "competitive"] }
  ],
  "benchmarks": ["gold_standards", "bronze_standards"],
  "targets": {
    "seeds_published_min": 20,
    "claim_rate_target": 0.15,
    "first_paid_within_days": 60
  }
}
```

The kit *derives* the campaign tree — it does not create campaigns ad hoc:

```
market kit
└── proving_ground campaign (scope=city, umbrella category)     ← workspace
    ├── intelligence campaign (kind=establishment, per focus)   ← benchmark
    │     └── mkt_intelligence_profiles (the active profile)
    ├── intelligence campaign (kind=discovery, focus=emerging)
    ├── intelligence campaign (kind=discovery, focus=competitive)
    │     └── audits → candidates → mkt_prospect_queue rows
    └── business-scope campaigns (derived per claimed prospect)
```

Constraints inherited from existing machinery — the kit must obey them, not
bypass them:

- **Establishment before discovery.** `MarketingCampaignService` rejects a
  discovery campaign with no active establishment profile for the category —
  the kit sequences benchmark first, never parallel.
- **One active PG per city/category** — the structural-duplicate guardrail.
  `promote-to-proving-ground` merges into an existing PG rather than 409ing;
  the kit uses the same path.
- **Discovery-kind gate** — only `emerging`/`competitive` discovery campaigns
  attach as PG children (§4.2 kind/focus gate). Establishment runs stay
  unattached.
- **`metro: true`** fans discovery out to the ring (metro-scope spec) —
  establishment scans are never fanned.

## 2. The staged pipeline

Each stage lists **inputs → workflow → deliverables → exit gate**. Every
deliverable is a real artifact in the system today, not a hoped-for one.

### Stage 1 — Benchmark

| | |
|---|---|
| In | kit `{market, categories[].focuses, benchmarks[]}` |
| Workflow | For each category: `establishment` campaign per focus (`gold_standards` national + market, `bronze_standards` national + market per `BRONZE_STANDARD_SPEC` stage-1/2 split). Run scans → audits → profile activation. |
| Out | **Active `mkt_intelligence_profiles` row per category** — the benchmark the discovery scans consume. Bronze reason coverage report; gold platform baseline. |
| Gate | Profile `status='active'` per category. Discovery cannot start without it — the service enforces this at create time; the kit treats it as the first hard gate. |

### Stage 2 — Discovery

| | |
|---|---|
| In | Active profile per category |
| Workflow | `discovery` campaigns per focus × category (metro ring when `metro: true`). Audits return structured per-business JSON → `candidates` → `mkt_prospect_queue` rows (`source_campaign_id`, `source_audit_id`). |
| Out | **Queue rows** — one per contactable prospect, with identity-confidence + category-fit columns, `discovery_provenance` evidence. |
| Gate | Queue populated ≥ kit `seeds_published_min` (headroom for dedup loss), or an explicit "thin market" verdict recorded — a real outcome, not an error. |

### Stage 3 — Proving ground assembly

| | |
|---|---|
| In | The discovery campaigns of stage 2 |
| Workflow | `POST /:campaignId/promote-to-proving-ground` on one discovery campaign → creates the PG + attaches it; `mergeCampaignIds` folds sibling focus runs; stragglers attach via cockpit dropdown. PG-01 checklist instantiates. |
| Out | **PG workspace** — one operator surface aggregating every discovery run for the market; instantiated preflight checklist. |
| Gate | Preflight complete: channel ladders scaffolded, dedup groups have verdicts, queue rows carry `seed_id` links. |

### Stage 4 — Seed (batch promote)

| | |
|---|---|
| In | Queue rows with clean verdicts |
| Workflow | Batch promote: queue → seed via the `from-queue-<entryId>` path (provenance rows + `SeedSeoComposer` packet + `source_campaign_id` preserved); or `createFromCampaign` where a business campaign exists. `ensureCampaignSeedLink` heals the campaign↔seed link at promote. Chain groups promote via `buildCampaignsForGroup` (one `business_prospect_id`, sibling campaigns). |
| Out | **`directory_presence_seeds` rows** — tenant + listing + provenance, `status='published'` after publish, seed batch tagged per market (e.g. `milwaukee-african-grocery-2026`). |
| Gate | Published seed count ≥ kit minimum; every public field has a provenance row with `show_on_public=true`. |

### Stage 5 — Publish & index

| | |
|---|---|
| In | Published seeds |
| Workflow | `POST /presence-seeds/:id/publish` per seed → listing `is_published=true` → the sitemap's `places.xml` picks the seed up on next read → Search Console tracks discovery. Sustained crawl needs no action; new markets optionally request indexing on 2–3 representative `/place/{slug}` + the new `/place/city/{slug}` page (operator guide §3 — rate-limited, spend it on representatives). |
| Out | **Indexed shelf pages** — `/place/{slug}` seeds + a filled `/place/city/{city}-{state}` shelf + category shelves. The sitemap is the crawl contract; indexing is measured, not assumed. |
| Gate | City shelf live (`/place/city/…` 200), sitemap `Discovered pages` count rises by ≈ the published-seed count at next read. |

### Stage 6 — Cleanup

| | |
|---|---|
| In | Published seeds coexisting with real-world duplicates/chains |
| Workflow | `DirectorySeedCleanupService` dedup verdicts: `same_entity` → merge + suppress the weaker record; `distinct` → keep both; **chain catch** — distinct entities that are one business → chain groups feed `buildCampaignsForGroup`. Retire smoke-test/invalid tenants via `location_status` (learned 2026-10-24 — bare tenants with no listing read as real storefronts in the sitemap gate). |
| Out | **Verdict ledger** (suppressed/merged/kept), chain campaigns under one `business_prospect_id`, a sitemap that only advertises real inventory. |
| Gate | Zero unresolved same-entity groups in the market; chain verdicts recorded even when no campaign is built. |

### Stage 7 — Invite & outreach

| | |
|---|---|
| In | Published, deduped seeds |
| Workflow | `POST /presence-seeds/:id/invite` mints claim tokens (bound → OTP; unbound → operator approval + claimant email verification, migration 358). Outreach runs the channel ladder (four-act cascade, QR kits) off the PG worklist; consultative calls run the seven beats (`CONSULTATIVE_CALL_SPEC`) including the call-side probes (`storefront_asserted`, `pickup_probe`). |
| Out | **Minted tokens + logged touches** — funnel-visible touch records, call probe outcomes feeding triage. |
| Gate | Cadence signals observed: invited ≥ target %, first claim within the courtesy window, touches logged per funnel spec (not parallel books). |

### Stage 8 — Claim & verify

| | |
|---|---|
| In | Owners clicking claim links |
| Workflow | Claim accept (`DirectoryClaimService.acceptClaim`) flips `org_standing_mode` → `independent`, embeds the upgrade triad. Verification (**draft — `CLAIM_VERIFICATION_SIGNALS_SPEC`**) layers physicality proof: `control`/`physical`/`documentary` classes scored by coverage, badge tiers published to shoppers. |
| Out | **Claimed seeds** + verification evidence packets (when built); badge tier on the listing. |
| Gate | Claim rate trending to kit target; verified-badge share tracked once the signal spec lands. |

### Stage 9 — Convert

| | |
|---|---|
| In | Claimed owners |
| Workflow | Gateway upgrade triad (`presence`/`discovery`/`storefront`) → paid presence modes → deliverable pipeline → sibling campaigns for additional pain dimensions (multi-archetype machinery). |
| Out | **Paid conversions** — `mkt_revenue` rows, tier upgrades, retainer candidates. |
| Gate | Weekly verdict: G1–G4 + postal test per funnel spec. Pass → ship the motion to the next market. Fail → the failing gate names the layer to fix (channels, claim flow, attribution, pitch timing) before spending elsewhere. |

## 3. Market-state rollup (the "is this market ready" query)

Per market, one read — the stage counters are all stored today:

```
market_stage := min gate satisfied across the pipeline:

benchmarked   := every category has an active intelligence profile
discovered    := queue rows ≥ threshold per category
assembled     := active PG exists for city+category signature
seeded        := published seeds ≥ kit minimum
indexed       := city shelf + seeds in sitemap (Discovered pages delta)
invited       := tokens minted ≥ target % of published seeds
claimed       := claim rate within courtesy window
verified      := badge coverage (once signals land)
converting    := paid conversions ≥ kit target
```

The cockpit already reports G-gates per PG; the rollup is the same read
across categories in one market — a view, not a service.

## 4. What the kit does NOT do

- **Does not auto-claim, auto-verify, or auto-outreach.** The operator model
  is human-executed; agents propose, humans check off (PG spec §1).
- **Does not bypass the dedup machinery.** Batch promote never skips
  identity resolution — thin-verdict rows stay out of `published`.
- **Does not relax evidence rules.** No invented hours/ratings/EBT;
  provenance rows remain the publish gate (seed-claim skill, non-goals).
- **Does not make verification live.** `CLAIM_VERIFICATION_SIGNALS_SPEC` is
  draft — Stage 8's verify half is aspirational until built.

## 5. Open seams (the honest gap list)

1. **No kit object exists.** The bundle above is the spec for one; today a
   launch is N manual campaign creates + a PG promote. The kit's job is to
   derive the tree and the expected-count assertions in one call.
2. **Market rollup is a doc, not a query.** §3 is assembled by the operator
   from the cockpit + sitemap today.
3. **Verification unbuilt** — signal classes, call probes, badge tiers all
   draft (`CLAIM_VERIFICATION_SIGNALS_SPEC` v0.1).
4. **`/shops` index is a client-rendered shell** — advertised in the sitemap
   with zero SSR content; SSR rebuild is deferred work (operator guide log,
   2026-10-24).
5. **Retired storefronts still serve 200 self-canonical** — inactive tenants
   should 404/410 or `noindex` (operator guide log, 2026-10-24).

## 6. The one-line test

A market launch is done being "configured" when the kit record answers: the
profile is active, the queue is populated, the PG is assembled, seeds are
published and indexed, invites are minted, and the weekly verdict has a gate
to cite. Everything before that sentence is plumbing that already exists.
