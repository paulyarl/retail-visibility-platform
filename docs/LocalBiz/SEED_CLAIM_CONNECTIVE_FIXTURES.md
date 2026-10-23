# Seed → Claim Connective Fixtures

**Status:** Reference (drafted 2026-10-22). Captures the verified fixture
chain that connects a directory seed to a paying tenant, and the claim
benefits + promotions that are *derivable from the fixtures themselves* —
every owner-facing claim in §3 and every upsell in §4 traces to a real
mechanism, not copy.

Related specs: `FOUR_ACT_OUTREACH_CASCADE_SPEC.md` (VAST execution),
`ENTRY_PRESENCE_TRIAD_REDESIGN_SPEC.md` (post-claim modes),
`directory_presence_claim_handoff_spec.md` (claim UX),
`marketing_ops_project_phase_spec.md` (plan projection).

---

## 1. The chain — one paragraph

A seed is not a giveaway; it is the **load-bearing artifact** that carries a
prospect from anonymous audit data to an authenticated owner relationship.
Each fixture in the chain exists to make the *next* fixture possible or
cheaper: the audit produces the diagnosis → the seed embodies the fix → the
claim converts identity → the grants sweeten the conversion → the storefront
is the free website → the subdomain is the self-named address → the
SWIS-shaped surface is the pre-positioned product → the feed is the paid
switch. Nothing in the chain is decoration — remove a link and the
conversion story breaks at that point.

## 2. Connective fixtures (verified mechanics)

### 2.1 The seed

- Real tenant row: `org_standing_mode = 'directory_seed'`,
  `subscription_tier = 'directory_presence'`, `subscription_status =
  'active'` (free-forever — never `trial`, which would enter 14-day
  auto-expiry machinery). `directory_visible = true`.
- Zero-price, invite-only tier. `max_skus: 5`, `max_locations: 1`. No Stripe
  customer, no billing flow.
- **Thin by design:** migration 319's trigger forces operator-written
  products on *unclaimed* seed tenants to `item_status='inactive'` — the 5
  free product slots are the claim incentive, not a giveaway.
- **Provenance-gated rendering:** no public field renders without a
  `directory_field_provenance` row (`show_on_public`). Hours omitted unless
  sourced. SNAP/EBT never inferred from category labels — sourced evidence
  only. The QC cost and the trust moat are the same constraint.
- **Hours depth — two layers.** The seed carries the regular weekly grid
  (`business_hours_list`, sourced at seed or owner-verified at claim).
  `business_hours_special_list` adds per-date overrides — holiday closures,
  seasonal dates, split-day windows the flat grid can't express — each with
  `date`, `isClosed`, `open`/`close`, `note`. Owner-managed post-claim
  (`PUT /tenant/:id/business-hours/special`), rendered publicly
  (`GET /public/tenants/:id/business-hours/special`), and pushed to the
  linked GBP `specialHours` by `GBPBusinessInfoSync.syncSpecialHours`.
- SEO packet composed deterministically by `SeedSeoComposer` (meta title,
  description, keywords, `same_as`) — identical output on the automated
  `createFromCampaign` path and the manual form's seo-preview. Zero
  per-seed model/operator cost.
- Batch economics: `seed_batch` cohorts (e.g.
  `indianapolis-african-grocery-2026`) amortize research across a
  geographic/vertical route — the same batching that amortizes sourcing
  amortizes visits.

### 2.2 Publish → invite (the artifact goes live)

- `publishSeed` / `approveAndInvite`: listing `is_published`, seed →
  `published`/`invited`, claim token minted (90-day default).
- Publishing a campaign-linked seed fires `SeedOutreachTriggerService` —
  composes the announce and writes a scheduled outreach row. **It does not
  send; delivery is operator-driven** (phone → email → other).
- Claim URL resolution order on the plan: `/c/{short_code}` → active claim
  token → place URL.

### 2.3 Claim (the conversion event)

`DirectoryClaimService.acceptClaim`:

1. Consumes the single-use token.
2. `org_standing_mode`: `directory_seed` → `independent`. Seed → `claimed`.
3. `subscription_status = 'active'` — the free-forever gateway.
4. Owner authenticates with a customer JWT (no platform session needed).
5. Response **embeds the gateway upgrade preview** — the Entry Presence
   triad rendered on the claim success screen (see §2.7).
6. `applySeedClaimGrants` fires — see §2.4.

The claim page already leads with the honest hook: *"Claim the listing to
fix hours or phone and add a photo."*

### 2.4 Claim grants — the promo mechanism

`SEED_CLAIM_PROMO_GRANTS` in `DirectoryClaimService` — capability features
unlocked **by the claim event, not by tier**, so they can never reach an
unclaimed seed:

```
flyer_on, flyer_directory_on, flyer_place_on, flyer_items_5
storefront_qr_classic_on, storefront_qr_directory, storefront_qr_resolution_512
```

Written as `tenant_feature_purchases` rows — `source: 'seed_claim'`,
`complimentary: true`, `granted_by: 'system:seed_claim'`,
`SEED_CLAIM_PROMO_DAYS = 365` expiry — which the effective-capability merge
treats identically to a manual complimentary grant. Properties worth
reusing:

- **Taste-scoped by design** — `flyer_items_5` not full flyer,
  `storefront_qr_classic_on` not `storefront_qr_on`: the flexible key stays
  the upsell.
- **`PAID_PURCHASE_SOURCES` guard** — a promo never demotes a paid row;
  safe to fire automatically.
- **One-year fuse** — every grant is a scheduled re-engagement at year 1.
- Extensible: "extend this list to add future claim promos."

### 2.5 Storefront render (the free website — literal)

`directory_presence` grants `storefront_enabled` + `storefront_retail`, so
the claimed tenant renders a **real platform storefront** — their page,
their products, individual product pages, capped at 5 SKUs. "Free website"
is mechanically true; "free online store" is not (checkout, policies,
coupons, product types/options are withheld).

### 2.6 Addressing — three levels (migration 331)

| Level | Surface | Key | Who has it |
|---|---|---|---|
| 1 | Platform path | `storefront_domains_enabled` | `directory_presence` baseline |
| 2 | `{slug}.visibleshelf.com` | `storefront_domains_platform_subdomain` | All three triad modes natively; for seeds, a claim-grant candidate |
| 3 | Tenant-owned custom domain | `storefront_domains_custom_domain` | Flexible BSaaS purchase ($10/mo) — **never a tier key** |

Entitlement (the feature key) and state (`tenants.subdomain`, mirroring
`slug`) are separate: the grant opens the gate; the **tenant chooses their
own slug** on the domain-management page
(`/t/[tenantId]/settings/admin/subdomain`). Subdomain-enabled reads the
assignment, so it only counts after owner opt-in — which is why an
`invited` seed's plan flags `needs subdomainEnabled`: it marks the thing
only the owner can do next.

### 2.7 The triad — embedded at claim

The claim accept response embeds `buildTenantUpgradeOptions`, which for
`directory_presence` tenants returns the Entry Presence triad (migration
352) as **peer modes, not a ladder**:

| Mode | Tier | Surface | Price |
|---|---|---|---|
| **Storefront+** (primary) | `presence` | Platform storefront + deposit checkout (Stripe) | $39/mo |
| **SWIS** | `discovery` | Products → Google surfaces (Merchant Center feed, Shopping, local inventory), no commerce | $29/mo |
| **Storefront** | `storefront` | Browsable hosted catalog, no commerce | $59/mo |

All three grant `storefront_domains_platform_subdomain` natively — *"SWIS
needs a hosted surface for Google's product links"* — and all sit at SKU
parity 200. The subdomain-hosted seed storefront with product pages is
therefore **SWIS-shaped by construction**: the free surface is
Google-compliant, and the feed is the paid switch.

SWIS feed infrastructure (paid signature): `integration_google_*` /
`integration_gmc_sync` keys, `GMCProductSync`, `google-merchant-oauth`
routes, `gmc-scheduled-sync` job.

**Scope rule (352):** `directory_presence` stays constrained — claimed
seeds buy only engagement-seeded modules; surfaces require a triad tier.
`maxSkus` is the one dimension no flexible key can buy — capacity is
tier-exclusive, which preserves the upgrade motion by design.

### 2.8 Execution wrapper — VAST

The four-act outreach cascade sequences human effort around the fixtures:
**V**erification (phone call; exits on operational + contact channel +
confirmed pain) → **A**wareness (QR postcard/email; name the pain, no
pitch) → **S**how (gallery email; exits on `gallery_opened`) → **T**ell
(walk-in; gated on act-3 or owner reply). Cheap acts first; the expensive
visit is earned by demonstrated engagement — `SeedCascadeService`
hard-blocks act 4 until then.

### 2.9 Plan integration

`findability` is the only phase with a capability gate
(`subdomainEnabled`); its `seed_status` exit holds at
published/invited/claimed — so the phase can read `complete` while the
capability chip still flags the un-assigned subdomain. The §11 gate flags
an owner-facing phase referencing a disabled capability, which for an
unclaimed seed is the funnel working as designed.

---

## 3. Claim benefits — derivable from the fixtures

Every benefit below traces to a fixture in §2. Nothing is asserted that
the schema can't back.

| # | Benefit | Fixture |
|---|---|---|
| B1 | **Your online presence already exists** — claim is a signature, not a project | Seed live at publish (2.2); listing pre-built from audit data |
| B2 | **Free website** — storefront render, 5 products on real product pages | `storefront_enabled`/`storefront_retail` + 5-SKU unlock at claim (2.5, 2.1) |
| B3 | **Products browsable within days, not months** — no construction at claim; the artifact is live | Claim grants capability instantly; SKU cap is a config limit, not a build (2.5) |
| B4 | **Your own address** — `{slug}.visibleshelf.com`, self-named | Level-2 grant + tenant self-serve slug (2.6) |
| B5 | **Fix the record** — correctable gaps (hours, phone, photo) are the claim hooks | Provenance-gated fields; omission renders as a visible, fixable absence (2.1) |
| B6 | **You are the authority** — cross-platform drift surfaced, owner adjudicates | `CP_NAP_*_DRIFT`/`DS_*` signals detect real conflicts; sourced values carry honest provenance (2.1) |
| B7 | **Taste bundle** — flyer + storefront QR, one year | `SEED_CLAIM_PROMO_GRANTS` (2.4) |
| B8 | **Proof of work, not a pitch** — "the work is done, come see it" | The seed pre-fixes findability before first contact (2.2) |
| B9 | **Free forever** — not a trial, no clock | `subscription_status='active'`, never trial machinery (2.1) |
| B10 | **Shoppers see what you carry before they visit** | 5-SKU browsable shelf + SWIS-shaped surface (2.5, 2.7) |
| B11 | **Special hours, not just regular hours** — holidays, seasonal dates, split-day schedules the weekly grid can't express | `business_hours_special_list` per-date overrides + GBP `specialHours` push (2.1) |

### Hook archetypes — the audit knows which sale before first touch

- **Drift prospects** (foundation/claim signals): *"the internet disagrees
  about you — only you can set the record."* Conflict screenshots are the
  act-3 artifact; urgency is owner-felt.
- **Clean-but-invisible prospects** (findability signals, consistent NAP):
  *"the internet can't find you — we already built your shelf."* The seed
  itself is the demo; visibility is the sale. (Garaya pattern: foundation
  `not_triggered`, findability critical.)

## 4. Promotions — derivable from the fixtures

Each promotion is a held-back capability edge, reachable exactly where the
owner feels the free version's limit.

| # | Promotion | Trigger surface | Fixture |
|---|---|---|---|
| P1 | **SWIS feed** ($29 `discovery` mode / `integration_flexible`) — products pushed to Google Shopping + local inventory | The free storefront is already SWIS-shaped; the feed is the switch | 2.7; GMC infra |
| P2 | **Storefront+ commerce** ($39 `presence`) — deposit checkout via Stripe | "When you want customers to order, not just browse" — primary triad card on the claim success screen | 2.7 |
| P3 | **Storefront mode** ($59) — full catalog browsing | 5-SKU cap felt: `maxSkus` is tier-exclusive — no flexible key buys capacity | 2.7, 2.1 |
| P4 | **`flyer_flexible`** — beyond the 5-item taste | Claim-grant expiry + the flexible key deliberately withheld | 2.4 |
| P5 | **`storefront_qr_flexible`** — styled renderer, logo, colors, hi-res, analytics | `qr_classic`/`512` taste hits its ceiling | 2.4 |
| P6 | **Custom domain** ($10 BSaaS) — owned address | `storefront_domains_custom_domain`, never a tier key | 2.6 |
| P7 | **Renewal conversations** — every claim grant expires at 365 days | `SEED_CLAIM_PROMO_DAYS` fuse | 2.4 |

**The clean line for copy:** *everything on our platform is the claim;
everything pushed into Google's surfaces is the subscription.*

## 5. Honesty boundaries — the constraints that make it work

- **Omission, never error.** A visible absence says "we need you"; a wrong
  fact says "we're sloppy." Provenance blocks the dark version
  structurally — no field renders without a sourced row.
- **Surface real disagreements; never plant them.** Sourced cross-source
  conflict (Yelp vs Google hours) is legitimate leverage — both the fact
  and its provenance are true. Fabricated mismatch corrupts the trust
  model the listing's value sits on.
- **"Free website," never "free online store."** Storefront render + 5
  product pages is true; checkout/policies/custom domain are the paid
  shape. Oversell at the claim moment is the most expensive place to lose
  trust.
- **Thin, but worth claiming.** Fidelity is a dial: thin enough to create
  upgrade pull, rich enough to be obviously worth the signature.
- **Depth is withheld until claim** — the 319 trigger caps investment in
  prospects who may never engage; the owner supplies the data they alone
  can author (hours, products).

## 6. Open items

- **`storefront_domains_platform_subdomain` is not yet in
  `SEED_CLAIM_PROMO_GRANTS`.** Adding it is a one-line list extension (the
  mechanism is built for it) plus slug assignment at claim or tenant
  opt-in — it would close the `subdomainEnabled` gate flag on every
  claimed prospect's findability phase.
- **Conflict-as-display.** Fields are single-value; a first-class
  "sources disagree" rendering (Yelp: X · Google: Y) needs a
  secondary-value store or a conflict annotation. Interim: the audit
  evidence row + claim CTA already carry it.
- **Propensity axis on the queue.** Signals measure pain; nothing yet
  scores means/willingness. Hook-strength weighting (authority threats >
  conflicts > absences) and visit ratings are candidate inputs — see the
  VAST pre-seed discussion.

## 7. Competitive frame — why the loop is the offering

No directory-claim service offers the full loop, and the reason is
structural, not executional:

- **Google owns every surface and none of the journey.** Business Profile
  (directory + claim), Merchant Center/SWIS (the feed destination), even
  in-store inventory (the Pointy acquisition) — but Google sells ads
  *about* these businesses; it doesn't run a services funnel *to* them.
  Auto-generating storefronts would also compete on the very surface it
  ranks.
- **Yelp/TripAdvisor own claim-flows but stop at the listing.** No
  storefront, no products, no feed — the claim is the ceiling, not the
  on-ramp.
- **Shopify/Square own storefronts but wait for merchants.** No
  prospecting loop, no seeds, no diagnosis — inbound-only.

The differentiation is **one identity flowing through every layer**:
tenant + NAP + provenance carried from directory entry → storefront →
product pages → Google feed. Each incumbent owns exactly one layer and
treats the adjacent ones as someone else's problem. The real moat is
being *small enough* to do the per-business work — QC judgment, visits,
provenance — that platform economics structurally can't.

**Caveat that disciplines the strategy:** the loop is only as valuable as
its entry surface. If `/place` pages don't rank or pull shopper traffic,
the chain is plumbing to nowhere — geographic batch density is therefore
dual-purpose: it builds directory inventory *and* the prospect funnel at
the same time.

## 8. Prioritization model (selection layer)

Derived from the same fixtures — the pre-seed ordering problem:

| Axis | Measures | Instrument | Cost |
|---|---|---|---|
| Pain severity | How broken | Audit → signals → plan severity | amortized |
| Hook strength | Will the pitch land | Signal-class weighting (authority threats > conflicts > absences) | ~zero, derived |
| Means/propensity | Can they act | Visit rating (batched, routed) | expensive — reserved for high-severity/high-hook candidates |

Mass-seed the block (batch-amortized) → visit with a forked script
(decision-maker present → pain pitch + live claim demo; absent → contact
capture + claim-kit leave-behind) → every outcome leaves a live claimable
asset plus logged intelligence → VAST executes on what the visit started.
The seed is the floor under every visit outcome; the visit is an
accelerant, not a gate.
