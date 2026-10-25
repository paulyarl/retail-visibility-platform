# Capability Value Anchor — Spec

**Status:** Draft · **Date:** 2026-10-25 · **Scope:** `capability_features` (32 modules) → per-module value anchors → module pricing

> The pricing that exists today (`bsaas_catalog`) predates the capability architecture and reads as
> hand-set round numbers. This spec defines the value layer the prices should derive from: every
> module gets a **value**, every value-bearing feature inside it gets an **anchor in [0,1]**, and
> prices follow the anchors instead of the other way round.

---

## 1. Why anchors, not prices

Three problems the current catalog can't express:

1. **Key count ≠ value.** `storefront_qr` has 34 keys; ~5 carry value and the rest are corner/dot
   styles and resolutions. Counting keys made `professional` look 4× bigger than it is.
2. **State keys dominate the bag.** `_enabled` / `_disabled` / `_flexible` / `_on` / `_off` are the
   control plane, not capabilities. They must never enter a value comparison.
3. **No module has a value, only a price.** With no value, a price can't be checked, compared, or
   derived — which is why the ladder is non-monotonic today.

The anchor is a **relative value weight on an absolute 0–1 scale**, comparable across modules, so a
0.7 in `funnel_options` means the same as a 0.7 in `crm_options`.

---

## 2. Filters — what enters the anchor table

Applied in order to every module's key list:

| # | Filter | Rule | Example |
|---|---|---|---|
| 1 | **Drop state keys** | keys ending `_enabled`, `_disabled`, `_flexible`, `_on`, `_off`, `_frozen` | `coupon_enabled`, `funnel_options_off` |
| 2 | **Drop presence markers** | a key identical to the module name, or the bare module noun | `storefront`, `storefront_gallery`, `storefront_qr` |
| 3 | **Collapse enumerated choices** | mutually exclusive options of one capability become **one family**, anchored once; breadth is scored into that anchor, never multiplied | `storefront_qr_resolution_512/1024/2048` → family `resolution`, anchor 0.2 |
| 4 | **Route quantity keys to the capacity axis** | item counts and durations are not features | `flyer_items_5/10/20`, `flyer_live_3/5`, `storefront_gallery_limit_5/10/15` |
| 5 | **Score what remains** | each surviving family gets one anchor | — |

250 raw keys → **~140 anchor rows**.

---

## 3. The 0–1 rubric

Anchors are absolute, not per-module. The question for each family: *if this were the only thing you
got, how much of the module's job would be done?*

| Anchor | Band | Test |
|---|---|---|
| **1.0** | Load-bearing | the module doesn't function without it; it is the reason to buy |
| **0.7** | Major | materially changes the outcome on an existing path |
| **0.4** | Supporting | improves a path that already works |
| **0.2** | Presentation | cosmetic, layout, style, format choice |
| **0.1** | Variant | pure styling enumeration |

Rules of thumb:

- A module must have **at least one 1.0** — if nothing is load-bearing, the module is a feature of
  another module and should be folded into it.
- **Two 1.0s are allowed** only when both are independently sufficient (`commerce_deposit_only` and
  `commerce_full_payment`; `integration_clover` and `integration_square`).
- **Breadth never multiplies.** A family with 3 layout choices is one 0.4, not three.
- Anchors are judgments under this rubric — tunable, but every change must keep the band test above.

---

## 4. Aggregation

```
value(module) = Σ anchor(family)                    ← comparable across modules
share(family) = anchor(family) / value(module)      ← feeds feature pricing
```

**Tier pricing is a single-parameter fit, not a per-delta solve.** Because tiers may be unbalanced
(§5.2), a tier can add one module and drop another, so `Δ_t` cannot be attributed to "newly included
modules". Solve for `k` — the price of one anchor point — across every tier at once:

```
V_t = Σ value(m)  for the modules priced in tier t
k   = Σ(P_t · V_t) / Σ(V_t²)          ← least squares through the origin
w_m = k · value(m)                    ← module price
p_f = w_m · share(f)                  ← feature price
```

Delta attribution survives only where tiers are genuinely nested (a strict superset chain); it is a
special case, not the default.

The fit residual is the audit: **if `R²` is low, the prices are not value-ordered and the rungs — not
the anchors — are what needs fixing.**

---

## 5. Two axes

**Axis A — how it's sold**

| Sold as | Pricing basis | Notes |
|---|---|---|
| **Configuration** (soft-gated) | **none — never priced, never tier-differentiating** | the appearance of flexibility and control; every tenant can shape it |
| **Separation-controlled** | **none — the tier separates, the capability architecture enforces** | modules that must not mix: the tier is the boundary, `_disabled` is the enforcement |
| Tier-included | tier delta → module weight | standing capabilities only |
| Discretionary | its own perceived-value anchor | any tier may buy; **excluded from tier pricing** |

Revenue comes **only** from the two non-configuration buckets. Configuration modules exist so a tenant
can shape their own surface — layout, gallery, hours, map, product types — which buys perceived
control without a pricing tax. Charging for them (as the catalog does today, $15–29 each) sells a
tenant the anatomy of a storefront they already bought.

> **The boundary that matters:** a config option that *differs by tier* is a hard gate wearing
> configuration's clothes. Soft gating is only honest if the option set is the same at every tier, or
> the differences are cosmetic and documented. Anything else is a tier differentiator and belongs in
> the tier delta, priced.

## 5.1 Separation is the tier's job; compliance is the architecture's job

Some modules are **operating models, not features** — they don't mix. A physical retail storefront and
an online-only storefront have different fulfillment, different tax, different order semantics. The
tier exists to *separate* them; the capability architecture (the `_disabled` veto, resolved before any
grant) exists to *enforce* the separation at resolution time.

That gives the veto a meaning beyond "locked until you pay":

| Lever | Legitimate use | Illegitimate use |
|---|---|---|
| `_disabled` veto | **incompatibility** — the module cannot coexist with this tier's model | **upgrade wall** — the module *could* coexist, but is withheld to force a tier move |
| tier difference | **separation** — this tier runs a different operating model | **dressing** — a cosmetic gap used as a sales hook |

They are mirror images of the same failure: one hides a price inside a gate, the other hides a gate
inside a price. Both are prevented the same way — **every veto and every tier difference carries a
declared reason** (`incompatibility` or `separation`), and a reason of `price_wall` is not permitted.

Practically: the six vetoes the triad currently carries (`chatbot`, `coupon`, `funnel`, `social
commerce`, `wholesale`, `organization`) must each be justified as incompatibility. If any of them can
coexist with a storefront, it is an upgrade wall and should become discretionary instead.

**Axis B — what value it creates** (`reach` exposure · `revenue` influenced GMV · `operation` labor)
justifies the anchor; it does not select the formula. Dual-axis modules carry a split (§6).

## 5.2 Unbalanced tiers are allowed

Tiers are **bundles serving a goal**, not nested sets. A tier may carry less of one module and more of
another to satisfy the business model it targets — `commitment` is deposit-heavy, `ecommerce` is
full-payment-heavy, and neither is a superset of the other. That unbalance is the point: it is how a
tier acquires an aspiration instead of being a quantity of features.

So subset-monotonicity is **not** an invariant. The invariants are:

| Invariant | Statement |
|---|---|
| **Goal** | every tier declares the operating model / aspiration it serves |
| **Coherence** | every module in the tier serves that goal; no orphan modules |
| **Unbalance** | incomparable module sets are legal — a tier can trade one module for another |
| **Value ordering** | `Σ anchors` is non-decreasing along the display order (value, not subset) |
| **Price ordering** | price is non-decreasing in value — `Δvalue` and `Δprice` share a sign |

This is what makes a resolution possible at all: the three sibling branches (triad, money modes, scale
modes) stay unbalanced and each declares its goal, while the *value totals* still order correctly and
the fit in §4 stays tight.

---

## 6. Anchors by category

### 6.1 Configuration — soft-gated, never priced, never tier-differentiating

Anchors are kept here only to document the option surface and to compare what a tenant can shape.
**They do not enter any price.** The value of this bucket is perceived control, not revenue.

| Module | Families (anchor) | Σ |
|---|---|---|
| `storefront_layouts` | layout choice (classic/editorial/immersive) 0.7 | **0.7** |
| `storefront_gallery` | gallery 1.0 · carousel 0.7 · magazine 0.7 | **2.4** |
| `storefront_hours` | display 1.0 · status 0.7 · animated 0.2 | **1.9** |
| `storefront_maps` | display 1.0 · interactive 0.7 · location 0.7 | **2.4** |
| `storefront_options` | actions 0.7 · contact 0.7 · categories 0.7 · enhanced_seo 0.7 · recommendations 0.7 · info 0.4 · layout 0.4 · recently_viewed 0.4 · recommend_store 0.4 · social 0.4 | **5.5** |
| `product_types` | physical 1.0 · digital 0.7 · service 0.7 · hybrid 0.4 | **2.8** |

**Catalog consequence:** six of these carry paid SKUs in `bsaas_catalog` (`storefront_layouts` $15,
`storefront_gallery` $15, `storefront_maps` $15, `storefront_hours` $15, `storefront_options` $29,
`product_types` $15). Under this spec those SKUs retire — the options remain, the charge does not.

### 6.1a Separation-controlled — the tier is the boundary

| Module | State | Treatment | Lands on |
|---|---|---|---|
| `storefront_types` | `_enabled` + one type | **separation-controlled, unpriced** — the tier defines which operating model a tenant runs | base tiers |
| `storefront_types` | `_flexible` (all four models at once) | **tier-included, priced** — multi-model operation | `professional`, `omnichannel`, `organization`, `enterprise`, `chain_professional` |

Retail, online, service and social are four **operating models** — different fulfillment, tax and order
semantics. At `_enabled` a tenant runs one, and the tier separates them. At `_flexible` a tenant runs
**all four simultaneously**, which is a different business: a chain that sells in-store, ships online,
takes service bookings and runs social shops. That is a genuine premium capability and belongs in the
tier delta — not in discretionary, and not in configuration.

**This is the first module where the state decides the economics**, and the rule generalizes:

> Economic treatment attaches to **(module, state)**, not to the module. `_enabled` can be separation,
> `_flexible` can be a priced capability, and the same module can be both at once.

Option anchors, for documentation only (they price nothing in the separation state):
`retail 1.0 · online 1.0 · service 0.7 · social 0.7` → **Σ 3.4**.

### 6.1b Observed anomalies in the current `storefront_types` distribution

The witness shows four defects that the anchor model would catch:

| Tier | Carries | Problem |
|---|---|---|
| `storefront` ($59) | `_enabled` + **service** only | the platform storefront tier permits fewer models than `presence` ($39), which carries online + retail + service — **monotonicity violated** |
| `chain_enterprise` | bare `storefront` only | **less** than `chain_professional` (`_enabled` + `_flexible`) — the top chain tier has the weakest model set |
| `omnichannel`, `organization` | `_flexible` **and** all four type keys | the four type rows are dead weight under `_flexible`; they resolve to nothing |
| `discovery` | none | correct — SWIS has no hosted storefront |

### 6.2 Discretionary — any tier, feature or flexible, outside tier pricing

| Module | Families (anchor) | Σ | Composition |
|---|---|---|---|
| `funnel_options` | upsell 1.0 · order_bump 1.0 · downsell 0.7 · oto 0.7 · coupon_offer 0.4 | **3.8** | 100 revenue |
| `coupon_options` | percent_off 1.0 · bogo 0.7 · fixed_amount 0.7 · free_shipping 0.7 · limited_redemption 0.4 · targeted 0.4 · spotlight 0.4 · qr_sharing 0.4 · analytics 0.2 | **4.9** | 30 reach · 60 revenue · 10 operation |
| `storefront_qr` | content 1.0 · directory 0.7 · product 0.7 · store 0.7 · analytics 0.4 · styled 0.4 · logo 0.2 · gradients 0.2 · colors 0.2 · corner_styles 0.2 · dot_styles 0.2 · resolution 0.2 | **5.1** | 80 reach · 20 operation |
| `flyer` | image 0.7 · recurring 0.7 · *(+ capacity: items 5/10/20, live 3/5)* | **1.4** | 70 reach · 30 operation |
| `flyer_gbp` | publish 1.0 | **1.0** | 100 reach |

`funnel` is the most revenue-concentrated module in the catalog (5/5 families) — it should price
**above** `coupon` per unit of value, the inverse of today, where funnel has no flexible SKU at all.

**Candidates to join this bucket** (currently tier-gated): `directory_promotion` (paid placement,
campaign-shaped) and `featured_options` (placement, currently in `professional`'s bag). Both are
episodic, so both fit the discretionary test; moving them shrinks the tier-included set further.

### 6.3 Reach — tier-included, priced on exposure

| Module | Families (anchor) | Σ |
|---|---|---|
| `directory_entry` | layouts 0.4 · hours_status 0.7 · hours_animated 0.2 · external_link 0.2 · visibility_attributes 0.4 · snap_ebt 0.7 | **2.6** |
| `directory_promotion` | promotion level 1.0 | **1.0** |
| `featured_options` | featured 1.0 · bestseller 0.7 · new_arrival 0.7 · sale 0.7 · recommended 0.7 · store_selection 0.7 · seasonal 0.4 · staff_pick 0.4 · trending 0.4 · clearance 0.4 · custom_badge_slots 0.4 · random 0.2 · expiry_monitor 0.2 | **6.9** |
| `gbp_management` | posts_scheduler 1.0 · attributes 0.7 · media_upload 0.7 · directory_content 0.7 · directory_reviews 0.7 · ai_response 0.4 | **4.2** |
| `integration_options` | gmc_sync 1.0 · google_shopping 1.0 · clover 1.0 · square 1.0 · google_merchant_center 0.7 · gbp 0.7 · propagation_gbp 0.7 | **6.1** |
| `storefront_domains` | platform_subdomain 1.0 · custom_domain 1.0 | **2.0** |
| `social_commerce_options` | meta_shop 1.0 · tiktok_shop 1.0 · abandoned_cart 1.0 · meta_catalog 0.7 · tiktok_catalog 0.7 · meta_pixel 0.7 · tiktok_pixel 0.7 · social_proof 0.7 · share_buttons 0.4 | **6.9** |

`integration_options` carries four 1.0s because each connector is independently sufficient — the
anchor sums them, which is correct for a module whose value *is* breadth of connection.

### 6.4 Revenue — tier-included, priced on influenced GMV

| Module | Families (anchor) | Σ |
|---|---|---|
| `commerce_types` | deposit_only 1.0 · full_payment 1.0 | **2.0** |
| `payment_gateway_options` | stripe 1.0 · paypal 0.7 · square 0.7 | **2.4** |
| `fulfillment_options` | pickup 1.0 · delivery 1.0 · shipping 0.7 · service 0.4 | **3.1** |
| `wholesale_matching_options` | search 1.0 · full 1.0 | **2.0** |

### 6.5 Operation — tier-included, priced on labor saved

| Module | Families (anchor) | Σ |
|---|---|---|
| `barcode_scan_options` | scan 1.0 · camera 0.7 · usb 0.4 · manual 0.4 | **2.5** |
| `chatbot_options` | product_search 1.0 · rag_retrieval 1.0 · embed 1.0 · inventory 0.7 · order_tracking 0.7 · crm_assistant 0.7 · product_scoped 0.7 · auto_sync 0.7 · dedicated 0.7 · store_hours 0.4 · cross_merchant 0.4 · static_faq 0.4 · gap_report 0.4 · skill_cards 0.4 · after_hours 0.4 · shared_dynamic 0.4 · static_lookup 0.4 · external_embed 0.4 · custom_theme 0.2 · lora_finetuned 0.2 | **11.2** |
| `crm_options` | contact_management 1.0 · requests_hub 0.7 · contact_import 0.7 · contact_sync 0.7 · customer_tickets 0.7 · inquiry_anonymous 0.4 · inquiry_assignment 0.4 · inquiry_auto_response 0.4 · inquiry_customer 0.4 · message_templates 0.4 · ticket_assignment 0.4 · ticket_escalation 0.4 · ticket_priority 0.4 · dashboard_analytics 0.4 · message_attachments 0.2 · message_rich_text 0.2 · ticket_templates 0.2 | **8.0** |
| `faq_options` | display_storefront_accordion 0.7 · display_product_accordion 0.7 · kb_auto_sync 0.7 · management_hub 0.7 · chatbot_knowledge_base 0.7 · bulk_actions 0.4 · import 0.4 · coverage_metrics 0.4 · bot_handoff 0.4 · reorder 0.2 · search 0.2 · feedback 0.2 · preview_bot 0.2 · gap_report 0.2 | **6.1** |
| `marketing_ops` | revenue_tracking 1.0 · prompt_execution 0.7 · filter_review 0.4 | **2.1** |
| `organization_options` | locations 1.0 · products_propagation 1.0 · capabilities 0.7 · commerce 0.7 · propagation 0.7 · team 0.7 · categories_propagation 0.7 · business_info_propagation 0.7 · settings_propagation 0.7 · branding_control 0.7 · bot_management 0.4 · crm_summary 0.4 · recommendations 0.4 · quick_links 0.2 · system_status 0.2 · task_checklist 0.2 | **9.4** |
| `platform_services` | store_setup 1.0 · profile_setup 1.0 · seo_optimization 1.0 · logo_design 0.7 · banner_design 0.7 · social_kit 0.7 | **5.1** |
| `product_options` | variants 1.0 · creation_gallery 0.7 · creation_video 0.7 · supplier_catalog 0.7 · sections_categories 0.7 · enhanced_seo 0.7 · fulfillment 0.7 · location_availability 0.7 · qr_codes 0.7 · recommended 0.7 · reviews 0.7 · layouts 0.4 · hours_display 0.4 · location_display 0.4 · map_display 0.4 · qr_logo 0.4 · recently_viewed 0.4 | **10.4** |
| `quickstart_options` | wizard 1.0 · wizard_ai 1.0 · category_generator 0.7 · image_gen 0.7 · image_hd 0.4 · ai_openai 0.4 · ai_gemini 0.4 | **4.6** |

`chatbot_options` (11.2) and `product_options` (10.4) are the heaviest modules in the catalog. Both
are operation, which is why a GMV-only anchor prices them at zero — the category dispatch exists
precisely to stop that.

---

## 7. What the table implies

**The revenue base is 25 modules.** The 6 configuration modules plus the separation-controlled
`storefront_types` carry anchors for documentation only — they are never priced as bundles. Everything
the platform earns comes from the 5 discretionary + 20 tier-included modules, and `storefront_types`
`_flexible` is priced as part of the tier delta, not as a module.

| | Σ anchors | note |
|---|---|---|
| `chatbot_options` | 11.2 | heaviest; currently $49 flexible |
| `product_options` | 10.4 | currently $29 flexible |
| `organization_options` | 9.4 | currently $49 flexible |
| `crm_options` | 8.0 | currently $39 flexible |
| `featured_options` | 6.9 | currently $19 flexible |
| `social_commerce_options` | 6.9 | currently $39 flexible |
| `funnel_options` | 3.8 | **no flexible SKU at all** |

The current prices are uncorrelated with value: `featured_options` at 6.9 anchors sells for $19 while
`funnel_options` at 3.8 sells for nothing (parts only), and the two heaviest modules — chatbot and
product options — are the ones a GMV-only anchor would price at zero. Any price set from this column
would be more defensible than the current one.

### The ladder measured against value

Fitting `k` over the nine displayed tiers, with depth weighting (`_flexible` = full module value,
`_enabled` = half, partial options = share present):

| tier | value | price | implied at k |
|---|---|---|---|
| presence | 29.7 | $39 | $90 |
| discovery | 32.5 | $29 | $98 |
| storefront | 38.9 | $59 | $118 |
| commitment | 65.6 | $79 | $198 |
| ecommerce | 69.6 | $99 | $210 |
| omnichannel | 74.4 | $149 | $225 |
| professional | 81.1 | $199 | $245 |
| organization | 96.1 | $399 | $290 |
| enterprise | 86.7 | $500 | $262 |

`k = $3.02 / anchor` · **`R² = 0.495`**. Value grows 3.2× across the ladder; price grows 12.8×.

Two readings:

- **The upper rungs price scale, not capability.** organization and enterprise sit 2–2.5× above
  professional on ~1.2× the value. That may be deliberate — locations and throughput are worth more
  than modules — but it means those tiers are priced on a **band**, not on this table. The two models
  have to be composed deliberately, not silently.
- **`enterprise` is worth less than `organization`** (86.7 vs 96.1) and costs $101 more. That is the
  organization/enterprise sibling split surfacing as a value inversion — exactly what §5.2's value
  ordering invariant forbids.

`R² = 0.495` is the honest score for the current ladder: roughly half the price variance is explained
by capability value, and the other half is scale, history and guesswork.

> **Caveat that limits this table:** it is computed from the **DB witness**. The capability
> architecture does not validate that witness against tier structure (§8), so this measures
> *configured* bags — not necessarily what a tenant experiences. Treat it as config-drift measurement.

---

## 8. Precondition — the capability architecture has no tier structure

The capability layer resolves **what a tenant has**. It has no notion of what a tier *should* have:
order, inheritance and closure exist only as assertions in the codebase (`TIER_FEATURES` /
`TIER_HIERARCHY`, the fixture, the contract suites). The DB stores bags per tier with no relationship
between them, and the capability admin UI edits them freely — a tier can be emptied there and the
architecture will not object.

That yields **two authorities today**:

| Path | Reads | Consequence |
|---|---|---|
| Web gating — `checkTierFeature`, `getTierFeatures` | static `TIER_FEATURES` + `TIER_HIERARCHY` | a tier emptied in the admin UI still behaves as before |
| API resolver — `resolveEffectiveCapabilities` | `mv_tenant_effective_capabilities` → `tier_features_list` | the same tier resolves to nothing |

So capability resolution is **split-brained**: a tier's structure is enforced only by whichever path is
asked, and neither path knows the other exists.

**This must be settled before any price derives from anchors**, because the anchor table is only as
good as the bag it reads:

1. Declare one authority (code or DB), and make the other a witness.
2. Add a guard that fails when they disagree — the contract suites compare fixture↔DB today, but
   nothing compares *runtime* behaviour across the two paths.
3. Only then price from anchors, and re-run the §7 fit against the authoritative source.

---

## 9. Open items

1. **Anchor owner.** Anchors are judgments; they need a named owner and a review cadence, or they rot
   like the prices did.
2. **Perceived value for discretionary modules.** The anchor sets *relative* feature shares; the
   module's absolute price still needs a market input (campaign return, competitor reference).
3. **Capacity axis** (`flyer_items_*`, `gallery_limit_*`, `maxSkus`) is deliberately excluded here and
   needs its own spec — it prices on quantity, not value.
4. **`platform_services`** is one-off services in a monthly catalog; it should probably leave this
   model entirely.
5. **Separation boundary.** Configuration is only honest if the option set is identical at every tier.
   If any config option is meant to differ by tier, it is a separation (or a hard gate) and must be
   declared as such — `incompatibility` or `separation`, never `price_wall`. `storefront_types` is
   the one module already ruled separation-controlled (§6.1a).
6. **Veto audit.** Each of the triad's six vetoes (`chatbot`, `coupon`, `funnel`, `social commerce`,
   `wholesale`, `organization`) needs a declared reason. Any that can coexist with a storefront is an
   upgrade wall and should move to discretionary rather than stay gated.
