# VISIBLE SHELF
## Platform Strategy V3.1 Addendum — Capability Depth Rungs & App-Store Overlay
*Confidential Working Document*

> **Status:** Addendum to `PLATFORM_STRATEGY_V3.md` — extends, does not supersede.
> **Date:** 2026-08-21
> **Companion:** `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` (v3.1 implementation)
> **Code hierarchy skill:** `.devin/skills/tier-hierarchy.md` (must stay in sync)
> **Capability resolver:** `apps/api/src/services/EffectiveCapabilityResolver.ts` (three-source model — source of truth)

---

# Why this addendum exists

V3 introduced the **Entry Presence triad** (Starter / Discovery / Storefront) as *mode* choices — *which visibility surface* a merchant rents. That doctrine is correct and stays.

What V3 did not exploit is that the underlying **capability architecture is orthogonal to the mode axis**. The `tier_features_list` join allows any tier to activate any capability type. V3 uses this flexibility only to assign a flat capability set per mode. The result is one paid rung per surface, then a cliff into Commerce.

This addendum unlocks two things V3 left on the table:

1. **Capability depth rungs** — *within* each surface mode, a base / Plus / Premium ladder that goes deeper on the same surface without switching modes.
2. **App-store overlay** — the capability architecture already resolves features from three independent sources (tier bundle, BSaaS purchase, admin grant). A merchant can buy a capability bundle in the app store — including commerce — on top of any tier, without changing tier. The tier is the *baseline*; the app store is the *à la carte overlay*.

**One-line doctrine:**

> *V3 chose which hall you rent. V3.1 lets you furnish the hall — and open a till in it — without renting a different one.*

---

# The three-source capability resolution model

The platform's capability resolver (`EffectiveCapabilityResolver.ts`) merges features from three independent sources into one **effective capability set**. The source doesn't matter — if a feature is resolved by any of the three paths, it's unlocked.

| Source | Table | How it works | Who controls it |
|--------|-------|--------------|-----------------|
| **1. Tier bundle** | `tier_features_list` | Features assigned to the tenant's subscription tier (and org-tier, most-permissive-wins). This is the *baseline* — what the tier includes. | Platform staff (Capability Management admin) |
| **2. BSaaS purchase** (app store) | `tenant_feature_purchases` | À la carte feature purchases. Status `active` / `past_due` / `trial`. Purchased = always enabled. `_flexible` keys expand to all features in a capability type. | Merchant (self-serve app-store checkout) |
| **3. Admin grant** | `tenant_feature_overrides_list` | Platform staff can grant any feature to any tenant, including `_flexible` expansion. Operator override for custom deals, partnerships, trials. | Platform staff (admin tooling) |

**Resolution is most-permissive-wins.** If a feature is enabled by any source, it's in the effective set. There is no "source precedence" — a BSaaS-purchased feature and a tier-bundled feature are indistinguishable in the resolved output.

**What this means for V3.1:**

- The tier is the **baseline** — what you get for your subscription.
- The app store is the **overlay** — what you add on top, à la carte.
- Admin grants are the **override** — operator-side, for edge cases.
- A Presence Premium merchant ($39/mo) who buys a Commerce Bundle in the app store gets commerce on the directory surface — without switching to a Commerce tier. The tier stays `presence_premium`; the commerce features come from `tenant_feature_purchases`.
- A Discovery merchant who buys a Platform Browse Bundle gets storefront product browse on the Google surface — without switching to Storefront tier.

**The tier-bundle is mode-locked. The app-store overlay is not.** This is the key distinction that prevents re-smearing while unlocking full flexibility:

- The tier-bundle assignments follow the mode-affinity allowlist (§5). A directory-surface tier will never silently bundle Google SWIS or platform browse.
- The app-store overlay is merchant-chosen. A merchant CAN buy Google integration on top of a Presence tier — that's not smear, that's *choice*. The merchant is explicitly adding a cross-surface capability, not having it bundled into their tier by default.

---

# The model: tier-bundle baseline × app-store overlay

| Layer | Question | Set by | Mode-locked? |
|-------|----------|--------|:---:|
| **Surface mode** (V3) | *Where* is the business visible? | Tier choice: directory / Google / platform | ✅ |
| **Capability depth** (V3.1) | *How much* does the tier-bundle include on that surface? | Depth rung: base / Plus / Premium | ✅ |
| **App-store overlay** (V3.1) | *What else* does the merchant add on top? | BSaaS purchases: commerce, Google, platform, any capability bundle | ❌ merchant-chosen |

```
TIER-BUNDLE BASELINE (mode-locked)          APP-STORE OVERLAY (merchant-chosen)
                        Depth →
              base      Plus      Premium         (any bundle, any tier)
            ┌────────┬────────┬────────┐
directory   │  $0    │  —     │  —     │   gateway   +   Commerce Bundle
surface     ├────────┼────────┼────────┤              +   Google Bundle
            │ $19    │ $29    │ $39    │   Presence   +   Platform Browse Bundle
            ├────────┼────────┼────────┤              +   CRM Bundle
Google      │ $29    │ $39    │ $49    │   Discovery  +   ...any capability type
surface     ├────────┼────────┼────────┤
            │ $59    │ $69    │ $79    │   Storefront
platform    │        │        │        │
surface     └────────┴────────┴────────┘
                        │
                        ▼
              Commerce triad (tier-bundle path)
              OR app-store Commerce Bundle (overlay path)
              — both resolve to the same effective capability
```

**Key invariants:**

1. **Depth rungs never change the surface mode.** Presence Premium is still directory surface — its tier-bundle never silently includes Google SWIS or platform product browse. Storefront Premium is still platform surface — its tier-bundle never silently includes checkout.
2. **The tier-bundle is operator-curated and mode-locked.** Platform staff define which capability types each rung's tier-bundle includes, following the mode-affinity allowlist (§5). Merchants pick a rung; they do not assemble tier bundles.
3. **The app-store overlay is merchant-chosen and NOT mode-locked.** A merchant can buy any capability bundle on top of any tier. This is not smear — it's explicit merchant choice. The merchant is adding a cross-surface capability, not having it bundled into their tier by default.
4. **Commerce is a separate tier-bundle axis AND an app-store bundle.** A merchant can get commerce either by subscribing to a Commerce tier (Commitment / Ecommerce / Omnichannel) OR by buying a Commerce Bundle in the app store on top of any presence tier. Both paths resolve to the same effective commerce capability. The tier path bundles commerce with a surface; the app-store path lets the merchant keep their current surface and add commerce à la carte.
5. **Admin grants are the operator override.** Platform staff can grant any feature to any tenant for custom deals, partnerships, extended trials. Same resolution — source doesn't matter.

---

# Smear-risk mitigation — tier-bundle is mode-locked, app-store overlay is not

V3's strongest warning is the legacy `starter` failure: a tier that mixed storefront + Clover + SEO + category quickstart into one undifferentiated feature bag. V3.1 does not repeat that failure — but it also doesn't prevent merchants from *choosing* to add cross-surface capabilities via the app store.

The distinction: **smear is when a tier bundles capabilities from multiple modes by default.** Smear is NOT when a merchant explicitly buys a cross-surface bundle in the app store. The first is a product-clarity failure (the merchant didn't ask for it); the second is a product-flexibility win (the merchant chose it).

## Mitigation: tier-bundle is curated and mode-locked; app-store overlay is merchant-chosen

| Control | Tier-bundle (mode-locked) | App-store overlay (merchant-chosen) | Admin grant (operator override) |
|---------|---------------------------|--------------------------------------|---------------------------------|
| **Who controls it** | Platform staff (Capability Management admin) | Merchant (self-serve app-store checkout) | Platform staff (admin tooling) |
| **What defines the set** | Fixed, curated capability types per tier row in `tier_features_list` | Merchant picks from available bundles in the app store | Per-tenant feature grants in `tenant_feature_overrides_list` |
| **Mode purity** | ✅ Enforced. A tier-bundle may only include capability types from its mode's allowlist (§5). | ❌ Not enforced. A merchant CAN buy a Google Bundle on top of a Presence tier. This is choice, not smear. | ❌ Not enforced. Admin can grant any feature for custom deals. |
| **Commerce in bundle** | ❌ Commerce capability types excluded from all presence/storefront tier-bundles. Commerce only appears in Commerce triad tier-bundles. | ✅ Commerce Bundle available for purchase on any tier. A Presence Premium merchant can buy commerce à la carte. | ✅ Admin can grant commerce features to any tenant. |
| **Scale in bundle** | ❌ `organization` excluded from depth rungs. Scale only. | Future: Org Bundle could be sold à la carte (deferred). | ✅ Admin can grant org features for custom deals. |

## Mode-affinity table (capability type → surface mode)

This is the allowlist that governs which capability types may appear in which mode's **tier-bundle** depth rungs. It does NOT restrict app-store purchases or admin grants — those are merchant-chosen / operator-granted and can cross modes by design.

Capability types not listed here are **mode-agnostic infrastructure** (available to all paid tier-bundles) or **excluded from depth rung tier-bundles** (Commerce/Scale/admin-only — but available via app-store overlay).

| Capability type | Directory surface | Google surface | Platform surface |
|-----------------|:---:|:---:|:---:|
| `directory_entry` | ✅ core | ✅ thin chrome | ✅ inherited |
| `directory_promotion` | ✅ | ❌ | ❌ |
| `storefront_hours` | ✅ | ✅ | ✅ |
| `storefront_maps` | ✅ | ✅ | ✅ |
| `storefront_gallery` | ✅ | ❌ | ✅ |
| `storefront_layouts` | ✅ | ❌ | ✅ |
| `storefront_qr` | ✅ | ✅ (Google Maps QR) | ✅ |
| `storefront_options` | ❌ | ❌ | ✅ core |
| `storefront_types` | ❌ | ❌ | ✅ core |
| `product_options` | ✅ (display-only, capped) | ✅ (SEO product pages) | ✅ core (full catalog) |
| `featured_options` | ✅ | ✅ (feed curation) | ✅ |
| `faq_options` | ✅ | ✅ (Google Q&A) | ✅ |
| `crm_options` | ✅ (directory inquiries) | ✅ (Google inquiries) | ✅ (storefront inquiries) |
| `chatbot_options` | ✅ (static FAQ + widget) | ✅ (static FAQ + widget) | ✅ (full) |
| `integration_options` | ❌ | ✅ core | ✅ inherited |
| `platform_services` | ✅ | ✅ | ✅ |
| `quickstart_options` | ✅ | ❌ | ✅ |
| `coupon_options` | ❌ | ❌ | ✅ |
| `funnel_options` | ❌ | ❌ | ✅ |
| `social_commerce_options` | ❌ | ❌ | ✅ |
| `wholesale_matching` | ❌ | ❌ | ✅ |
| `barcode_scan_options` | ❌ | ❌ | ❌ (Commerce only) |
| `commerce_types` | ❌ | ❌ | ❌ (Commerce only) |
| `fulfillment_options` | ❌ | ❌ | ❌ (Commerce only) |
| `payment_gateway_options` | ❌ | ❌ | ❌ (Commerce only) |
| `product_types` | ❌ | ❌ | ❌ (Commerce only) |
| `organization` | ❌ | ❌ | ❌ (Scale only) |
| `marketing_ops` | ❌ | ❌ | ❌ (admin-only module) |

> **The ❌ marks above are tier-bundle restrictions only.** Every ❌ capability type is still available via the app-store overlay (BSaaS purchase) or admin grant. A merchant on any tier can buy a Commerce Bundle, a Barcode Scan Bundle, an Org Bundle, etc. in the app store. The ❌ means "not in the tier-bundle by default" — not "not available at all." The three-source resolution model (§2) ensures purchased/granted features are indistinguishable from tier-bundled features in the effective capability set.

> **Note on `chatbot_options` mode affinity:** the capability type is allowed on all three surfaces, but the *feature subset* differs by mode. Directory and Google surfaces get static FAQ engine + widget embed + CRM assistant + store hours skill only. Platform surface gets the full set (dynamic GPT, RAG, dedicated engine, all skills). This subset discipline is enforced at the feature-assignment level, not the capability-type level. A merchant who buys a Chatbot Bundle in the app store gets the full feature set regardless of surface — the overlay is not subset-restricted.

> **Note on `product_options` — product visibility vs. product commerce:** A product page is a *visibility surface*, not a commerce rail. `product_options` governs product creation, product page layouts, and display sections (gallery, reviews, QR, SEO, recommendations). It is available on all three surface modes — including directory — because a merchant can display products for visibility without opening a till. What makes it commerce is the *separate* capability types: `commerce_types` (deposit/full/both), `fulfillment_options` (delivery/pickup/shipping as money rails), `payment_gateway_options` (Stripe/Square/PayPal), and `product_types` (physical/digital/hybrid/service as sellable classifications). Those are Commerce-only in the tier-bundle, but available via app-store Commerce Bundle on any tier. On the directory surface, `product_options` is display-only with a capped product count (limited product access); on the platform surface, it's a full catalog with browse/search/filter. The cap is the differentiator, not the capability type itself.
>
> **`max_skus` by rung:** Directory surface uses capped product counts — Presence base = 0 (no products, pure directory), Presence Plus = ~20 (featured display), Presence Premium = ~50 (richer curated display). Platform surface (Storefront+) = full catalog (existing `max_skus` values). The cap enforces "limited product access" on directory without making it a commerce tier. **Note:** if a merchant buys a Commerce Bundle via app store on top of a directory-surface tier, the `max_skus` cap should lift to commerce-tier levels — the commerce overlay implies full product catalog capability. This is a resolver-level concern: when commerce capability types are resolved (from any source), `max_skus` should reflect the commerce-tier value, not the presence-tier value.

---

# Depth rungs by surface mode

## 1. Directory surface ladder

The directory surface has a free gateway rung and three paid depth rungs. This is the natural paid path from the free listing — going deeper on directory, not jumping to Google or platform.

### Rung 0 — Directory Presence (gateway) — $0

Existing V3 gateway. Unchanged.

| Capability type | Feature subset |
|-----------------|----------------|
| `directory_entry` | classic layout, hours_on, map_on, contact_on, qr_on, snap_ebt badge |
| `storefront_hours` | basic hours display, status |
| `storefront_maps` | basic map display, location |

**No depth rungs above the gateway within the free tier.** The gateway is a single free rung. Paid depth begins at Presence.

### Rung 1 — Presence / Starter — $19/mo (existing V3 tier)

Existing V3 Presence tier. Unchanged. The first paid directory-surface rung.

| Capability type | Feature subset (additive over gateway) |
|-----------------|----------------------------------------|
| `directory_entry` | logo_on, about_on, gallery_on, layout_editorial, layout_immersive, social_on, seo_on |
| `storefront_gallery` | carousel, 5-image limit |
| `storefront_layouts` | editorial, immersive |
| `storefront_qr` | classic renderer, basic styling |

### Rung 2 — Presence Plus — $29/mo (new)

Directory surface + engagement + limited product display. Adds promotion, FAQ, featured, CRM inquiries, richer QR/gallery, and capped product access for featured product display on the directory surface. Products get product pages — visibility only, no checkout.

| Capability type | Feature subset (additive over Presence) |
|-----------------|------------------------------------------|
| `directory_promotion` | enabled, level_basic |
| `faq_options` | display_enabled, display_on, storefront_accordion, management_enabled, management_on, preview_enabled, preview_on |
| `featured_options` | enabled, featured, new_arrival, sale, staff_pick, recommended |
| `product_options` | creation_enabled, creation_on, creation_gallery, sections_enabled, sections_on, sections_categories, sections_qr_codes, sections_enhanced_seo, sections_reviews, layout_classic — **display-only, max_skus ~20** |
| `storefront_qr` | styled renderer, custom_colors, dot_styles, corner_styles |
| `storefront_gallery` | magazine, 10-image limit |
| `crm_options` | enabled, inquiry_directory_enabled, inquiry_directory_on, inquiry_customer, inquiry_auto_response, inquiry_assignment, message_templates, customer_tickets, ticket_priority |

### Rung 3 — Presence Premium — $39/mo (new)

Directory surface + automation + richer product display. Adds chatbot, knowledge base, platform services, quickstart, premium promotion, full gallery, and expanded product display (variants, video, editorial layouts, recommendations). Still visibility only — no checkout.

| Capability type | Feature subset (additive over Presence Plus) |
|-----------------|-----------------------------------------------|
| `chatbot_options` | enabled, static_lookup, static_enabled, static_on, widget_embed, widget_enabled, widget_on, skill_crm_assistant, skill_store_hours, skills_enabled, skills_on |
| `faq_options` | kb_enabled, kb_on, kb_auto_sync, chatbot_knowledge_base, display_bot_handoff, preview_bot, preview_gap_report, kb_coverage_metrics |
| `platform_services` | enabled, logo_design, profile_setup, seo_optimization, social_media_kit, store_setup, banner_design |
| `quickstart_options` | enabled, wizard, product_enabled, product_on, category_enabled, category_on, category_generator, ai_enabled, ai_on, image_gen |
| `product_options` | creation_variants, creation_video, layout_editorial, sections_recommended, sections_recently_viewed, sections_location_display, sections_map_display, sections_hours_display — **max_skus ~50** |
| `storefront_gallery` | 15-image limit |
| `directory_promotion` | level_premium |

---

## 2. Google surface ladder

The Google surface is about visibility integration onto Google's wave. Depth rungs add richer product feeds, deeper integration, and automation for Google-side inquiry handoff.

### Rung 1 — Discovery — $29/mo (existing V3 tier)

Existing V3 Discovery tier. Unchanged.

| Capability type | Feature subset |
|-----------------|----------------|
| `integration_options` | enabled, google_enabled, google_on, gbp_integration, integration_gbp, google_merchant_center, google_merchant_center, google_shopping, google_shopping_feed, google_sync, propagation_gbp_sync, integration_propagation_gbp |
| `directory_entry` | thin chrome — classic layout, hours_on, map_on, contact_on |
| `storefront_hours` | basic hours display, status |
| `storefront_maps` | basic map display, location |
| `product_options` | sections_enhanced_seo, sections_location_display, sections_map_display, sections_hours_display, layout_classic |
| `storefront_qr` | classic renderer (Google Maps listing QR) |

### Rung 2 — Discovery Plus — $39/mo (new)

Google surface + richer product feed. Adds deeper GMC sync, product gallery/variants/video, feed curation.

| Capability type | Feature subset (additive over Discovery) |
|-----------------|-------------------------------------------|
| `integration_options` | gmc_sync, integration_gmc_sync, google_merchant_center (full), propagation_gbp_sync (full) |
| `product_options` | creation_enabled, creation_on, creation_gallery, creation_variants, creation_video, sections_categories, sections_fulfillment, sections_location_availability, sections_qr_codes, sections_reviews, sections_recommended, sections_recently_viewed, layout_editorial |
| `featured_options` | enabled, recommended, trending, featured |
| `storefront_qr` | styled renderer, custom_colors |

### Rung 3 — Discovery Premium — $49/mo (new)

Google surface + automation. Adds chatbot for Google-side inquiry handoff, FAQ knowledge base for Google Q&A, CRM for Google inquiries, platform services.

| Capability type | Feature subset (additive over Discovery Plus) |
|-----------------|------------------------------------------------|
| `chatbot_options` | enabled, static_lookup, static_enabled, static_on, widget_embed, widget_enabled, widget_on, skill_crm_assistant, skill_store_hours, skill_product_search, skills_enabled, skills_on |
| `faq_options` | kb_enabled, kb_on, kb_auto_sync, chatbot_knowledge_base, product_enabled, product_on, display_bot_handoff, preview_bot, preview_gap_report, kb_coverage_metrics |
| `crm_options` | enabled, inquiry_customer, inquiry_auto_response, inquiry_assignment, message_templates, customer_tickets, ticket_priority |
| `platform_services` | enabled, seo_optimization, profile_setup, store_setup |
| `product_options` | layout_immersive, sections_qr_logo |

---

## 3. Platform surface ladder

The platform surface is about in-house marketplace presence and product browse. Depth rungs add conversion tools (funnels, coupons, social commerce), then automation and scale-adjacent capabilities — without opening a till.

### Rung 1 — Storefront — $59/mo (existing V3 tier)

Existing V3 Storefront tier. Unchanged. Inherits Discovery-class Google per V3.

| Capability type | Feature subset |
|-----------------|----------------|
| `storefront_types` | enabled, storefront, retail, online, service, social, policies |
| `storefront_options` | enabled, info, info_enabled, info_on, layout, category_enabled, category_on, category_product, category_store, recommend_enabled, recommend_on, recommend_products, recommend_store, recently_viewed, storefront_actions, storefront_contact, storefront_social_media, enhanced_seo, qr_enabled, advanced_enabled, advanced_on |
| `product_options` | enabled, creation_enabled, creation_on, creation_gallery, creation_variants, sections_enabled, sections_on, sections_categories, sections_enhanced_seo, sections_fulfillment, sections_hours_display, sections_location_display, sections_location_availability, sections_map_display, sections_qr_codes, sections_reviews, sections_recommended, sections_recently_viewed, layout_classic, layout_editorial, layout_immersive |
| `directory_entry` | full (inherited) |
| `integration_options` | Google inherited (per V3 Storefront default) |
| `storefront_qr` | classic, basic styling, store_qr, product_qr, directory_qr |
| `storefront_gallery` | carousel, 10-image limit |
| `storefront_layouts` | classic, editorial, immersive |
| `storefront_hours` | full — display, animated, status |
| `storefront_maps` | full — interactive, location |
| `crm_options` | enabled, inquiry_storefront_enabled, inquiry_storefront_on, inquiry_customer, inquiry_auto_response, inquiry_assignment, message_templates, message_attachments, message_rich_text, customer_tickets, ticket_priority, ticket_assignment, ticket_templates |
| `faq_options` | display_enabled, display_on, storefront_accordion, product_enabled, product_on |

### Rung 2 — Storefront Plus — $69/mo (new)

Platform surface + conversion tools. Adds featured, full FAQ, funnels, social commerce, coupons, styled QR, magazine gallery.

| Capability type | Feature subset (additive over Storefront) |
|-----------------|--------------------------------------------|
| `featured_options` | enabled, featured, bestseller, clearance, new_arrival, sale, seasonal, staff_pick, trending, recommended, custom_badge_slots, platform_enabled, platform_on, tenant_enabled, tenant_on, store_selection, random_featured, expiry_monitor |
| `faq_options` | kb_enabled, kb_on, kb_auto_sync, chatbot_knowledge_base, management_enabled, management_on, management_hub, management_bulk_actions, management_import, management_search, management_reorder, preview_enabled, preview_on, preview_bot, preview_gap_report, kb_coverage_metrics, templates_enabled, templates_on |
| `funnel_options` | enabled, builder_on, builder_order_bump, builder_upsell, builder_downsell, builder_oto, builder_coupon_offer |
| `social_commerce_options` | enabled, share_buttons, social_proof |
| `coupon_options` | enabled, percent_off, fixed_amount, bogo, free_shipping, targeted, limited_redemption, qr_sharing, spotlight, analytics |
| `storefront_gallery` | magazine, magazine_on, 15-image limit |
| `storefront_qr` | styled, styled_on, custom_colors, gradients, logo_qr, dot_styles, dot_styles_on, corner_styles, corner_styles_on, resolution_1024, resolution_2048 |

### Rung 3 — Storefront Premium — $79/mo (new)

Platform surface + automation + scale-adjacent. Adds full chatbot, wholesale matching, full social commerce, platform services, quickstart. Note: $79 collides with Commitment — intentional (different axis: deeper presence vs. opened till).

| Capability type | Feature subset (additive over Storefront Plus) |
|-----------------|--------------------------------------------------|
| `chatbot_options` | enabled, dynamic_enabled, dynamic_on, shared_dynamic, dedicated, lora_finetuned, kb_enabled, kb_on, kb_auto_sync, kb_rag_retrieval, kb_product_scoped, kb_gap_report, skills_enabled, skills_on, skill_crm_assistant, skill_product_search, skill_inventory, skill_order_tracking, skill_store_hours, skill_cross_merchant, widget_embed, widget_enabled, widget_on, widget_custom_theme, widget_after_hours, widget_skill_cards, external_embed |
| `wholesale_matching` | enabled, search, full, flexible |
| `social_commerce_options` | meta_enabled, meta_on, meta_shop, meta_catalog, meta_pixel, tiktok_enabled, tiktok_on, tiktok_shop, tiktok_catalog, tiktok_pixel, abandoned_cart |
| `platform_services` | enabled, logo_design, banner_design, profile_setup, store_setup, seo_optimization, social_media_kit |
| `quickstart_options` | enabled, wizard, wizard_ai, product_enabled, product_on, category_enabled, category_on, category_generator, ai_enabled, ai_on, ai_gemini, ai_openai, image_gen, image_hd |
| `storefront_qr` | resolution_512 (production-fast), all corner/dot variants |

---

# Pricing philosophy for depth rungs

| Principle | Rationale |
|-----------|-----------|
| **$10 spacing within a mode** | Plus adds ~$10 over base; Premium adds ~$10 over Plus. Predictable, low-friction. |
| **Price collision across modes is intentional** | Presence Plus ($29) = Discovery base ($29). Same price, different surface. The merchant is choosing *which hall to furnish*, not climbing a single ladder. |
| **Price collision with Commerce is intentional** | Storefront Premium ($79) = Commitment ($79). Same price, different axis (deeper presence vs. opened till). Forces a clear product conversation, not a price comparison. |
| **Depth never exceeds Commerce entry** | No depth rung prices above $79. Commerce ($79+) is always the next economic conversation after maxing out presence depth. |
| **Gateway stays free** | Directory Presence gateway ($0) has no paid depth rungs. Paid depth begins at Presence ($19). |

## Full pricing table (V3 + V3.1)

| Tier | Mode | Depth | Price | Layer |
|------|------|-------|-------|-------|
| Directory Presence | directory | gateway | $0 | Gateway |
| Presence (Starter) | directory | base | $19/mo | Entry Presence |
| Presence Plus | directory | plus | $29/mo | Entry Presence |
| Presence Premium | directory | premium | $39/mo | Entry Presence |
| Discovery | Google | base | $29/mo | Entry Presence |
| Discovery Plus | Google | plus | $39/mo | Entry Presence |
| Discovery Premium | Google | premium | $49/mo | Entry Presence |
| Storefront | platform | base | $59/mo | Entry Presence |
| Storefront Plus | platform | plus | $69/mo | Entry Presence |
| Storefront Premium | platform | premium | $79/mo | Entry Presence |
| Commitment | — | — | $79/mo | Commerce |
| E-commerce | — | — | $99/mo | Commerce |
| Omnichannel | — | — | $149/mo | Commerce |
| Professional | — | — | $199/mo | Scale |
| Organisation / Enterprise | — | — | $499/mo+ | Scale |

---

# Naming conventions

| Element | Convention | Example |
|---------|------------|---------|
| Tier key | `{mode}_{depth}` for depth rungs; `{mode}` for base | `presence_plus`, `presence_premium`, `discovery_plus`, `storefront_premium` |
| Display name | `{Mode} {Depth}` | "Starter Plus", "Starter Premium", "Discovery Plus", "Storefront Premium" |
| Base tier display name | Unchanged from V3 | "Starter", "Discovery", "Storefront" |
| Gateway | Unchanged | "Directory Presence" |
| Sort order | `{base_sort} + {depth * 5}` | presence=10, presence_plus=15, presence_premium=20... but see note below |

**Sort order note:** Depth rungs within a mode should be spaced tightly (e.g. +5) so they cluster under their mode, but the upgrade-options API must present them as *depth choices within the current mode*, not as a linear ladder that includes other modes. The mode picker (V3 §6.4) and the depth picker are separate UX surfaces. Do not collapse them into one `sort_order > current` list — that would re-introduce the V3 gateway bug (peer modes hidden by sort order).

---

# What does NOT change about V3

| V3 doctrine | V3.1 status |
|-------------|-------------|
| Directory Presence is the free gateway, never a paid acquisition SKU | **Unchanged.** Gateway has no paid depth rungs. |
| Entry Presence triad (Starter / Discovery / Storefront) as peer mode choices | **Unchanged.** Depth rungs exist *within* modes, not across them. |
| "Do not smear modes" rule | **Reframed, not weakened.** The tier-bundle is mode-locked (no cross-mode capabilities bundled by default). The app-store overlay is merchant-chosen and CAN cross modes — but that's explicit choice, not smear. Smear = tier bundles capabilities from multiple modes without the merchant asking. Choice = merchant buys a cross-surface bundle in the app store. |
| Commerce triad (Commitment / Ecommerce / Omnichannel) as separate axis | **Reframed.** Commerce is a separate *tier-bundle axis* — presence tier-bundles don't include commerce. But commerce is also an *app-store bundle* — a merchant can buy commerce on top of any presence tier without switching to a Commerce tier. Both paths resolve to the same effective commerce capability. The tier path bundles commerce with a surface; the app-store path lets the merchant keep their surface and add commerce à la carte. |
| Storefront inherits Discovery-class Google by default | **Unchanged.** Storefront depth rung tier-bundles inherit the same Google baseline. |
| Legacy `starter` tier stays inactive | **Unchanged.** `presence` is the active directory-mode key; `presence_plus` / `presence_premium` extend it. |
| One-time website / listing_plus packs are not peer presence modes | **Unchanged.** Depth rungs are subscription tiers, not one-time packs. App-store bundles are separate from both. |
| Scale tiers (Professional / Org / Enterprise) for multi-location | **Unchanged in tier-bundle.** `organization` excluded from depth rung tier-bundles. Future: Org Bundle could be sold via app store (deferred). |
| Product display ≠ product commerce | **Clarified.** `product_options` (product creation + product page display) is a visibility capability available on all surfaces. Commerce capability types (`commerce_types`, `fulfillment_options`, `payment_gateway_options`, `product_types`) are Commerce-only in the tier-bundle, but available via app-store Commerce Bundle on any tier. Directory surface gets capped product display; platform surface gets full catalog. |
| Three-source capability resolution (tier / BSaaS / admin) | **Already implemented.** `EffectiveCapabilityResolver.ts` merges all three sources into one effective capability set. V3.1 documents and leverages this; no resolver changes needed for the depth-rung tier-bundles. App-store bundles use the existing `tenant_feature_purchases` path. |

---

# Upgrade graph (V3.1 extended)

```
[Directory Presence — free gateway]
           │
     ┌─────┴─────┐
     ▼           ▼
  mode picker   (claim → dashboard)
     │
     ├─────────── directory surface ───────────┐
     │     Presence → Presence Plus → Presence Premium
     │                                           │
     ├─────────── Google surface ───────────────┤
     │     Discovery → Discovery Plus → Discovery Premium
     │                                           │
     ├─────────── platform surface ─────────────┤
     │     Storefront → Storefront Plus → Storefront Premium
     │                                           │
     ▼                                           ▼
  Commerce triad (tier-bundle path — switch tier)    App-store overlay (stay on tier)
     Commitment / Ecommerce / Omnichannel    ←→     Commerce Bundle, Google Bundle,
                    │                                Platform Browse Bundle, etc.
                    ▼                                (merchant-chosen, any tier)
                  Scale
```

**Three upgrade paths from any tier:**
1. **Go deeper (depth):** base → Plus → Premium within current mode. Self-serve tier upgrade.
2. **Switch surface (mode):** any mode/depth → different mode/base. Operator-only v1 (preserves V3 §3.2).
3. **Add overlay (app store):** any tier + any bundle. Self-serve BSaaS purchase. No tier change. Bundles persist across tier changes.

**Lateral moves (operator-only v1):**
- Within a mode: base → Plus → Premium (self-serve upgrade)
- Within a mode: Premium → Plus → base (downgrade — operator-only v1)
- Across modes: any mode/depth → any other mode/base (lateral — operator-only v1, preserves V3 §3.2)
- To Commerce: any Entry Presence mode/depth → Commerce triad (self-serve tier upgrade) OR buy Commerce Bundle in app store (self-serve overlay, no tier change)
- App-store overlay purchases persist across all tier changes — they're tied to the tenant, not the tier

---

# Implementation implications (strategy → build)

These are strategic requirements for engineering alignment. Detail lives in a follow-on implementation spec.

1. **New tier keys:** `presence_plus`, `presence_premium`, `discovery_plus`, `discovery_premium`, `storefront_plus`, `storefront_premium`. Six new tier rows.
2. **Migration:** Next free after 234 (`235_depth_rungs.sql`). Inserts tier rows + `tier_features_list` rows per §4 capability sets. Does NOT modify existing base tier rows.
3. **`billing_type`:** All six new tiers = `subscription`.
4. **Sort order:** Cluster depth rungs under their mode (e.g. presence=10, presence_plus=11, presence_premium=12, discovery=20, discovery_plus=21, ...). Tight spacing within mode, gap between modes.
5. **Upgrade-options API:** Must return depth rungs *within the current mode* separately from peer mode options. Two queries: `GET /api/tenant/:id/upgrade/depth` (within-mode) and `GET /api/tenant/:id/upgrade/modes` (across-mode). Do not merge into one `sort_order > current` list.
6. **Mode-affinity enforcement:** Tests must verify that no depth rung has a capability type outside its mode's allowlist (§3). Add a test suite `depth-rung-mode-purity.test.ts`.
7. **Capability Management admin:** Existing `/api/admin/tier-capabilities` already supports assigning any capability type to any tier. No new admin endpoints required for v1 — operator curates via existing UI.
8. **Tier-hierarchy skill:** Update `.devin/skills/tier-hierarchy.md` to document the two-axis model and depth rung keys.
9. **FEATURE_TIER_MAP / TIER_FEATURES / TIER_HIERARCHY:** Add depth rung entries. Depth rungs inherit their mode's base tier, then add their curated capability set.
10. **Growth tips / next-steps:** Mode-aware. A merchant on Presence Plus sees "Go Premium" (depth) and "Add Google" (mode) as distinct CTAs, not a single ladder.
11. **Public render gating:** Logo/about/gallery already gate on Presence+. Depth-rung features (FAQ, chatbot, featured, coupons, funnels) need their own gates keyed to the appropriate depth rung.
12. **No merchant-facing tier-bundle builder.** Merchants pick a depth rung; they do not assemble tier-bundles. This is a product decision, not a technical limitation. The app-store overlay IS merchant-facing — merchants buy à la carte bundles there.
13. **`max_skus` per rung:** Presence base = 0 (pure directory, no products). Presence Plus = ~20 (capped featured product display). Presence Premium = ~50 (richer curated display). Storefront+ = existing full catalog values. The cap enforces "limited product access" on directory without making it a commerce tier. Product pages render for visibility only — no checkout, no deposit, no fulfillment rail. Gate the checkout/deposit UI on Commerce capability types (`commerce_types`, `fulfillment_options`), not on `product_options` or product existence. **If a merchant buys a Commerce Bundle via app store on top of a directory-surface tier, `max_skus` should lift to commerce-tier levels** — the commerce overlay implies full product catalog capability. The resolver should check effective commerce capability (from any source) when determining `max_skus`, not just the tier.
14. **Product page render gating:** Product pages must render in two modes — *visibility mode* (no commerce capability resolved: display only, no cart, no checkout, no deposit button) and *commerce mode* (commerce capability resolved from any source: full checkout/deposit rails). The mode is determined by whether the tenant has any Commerce capability type in their **effective** set (resolved from tier-bundle OR app-store purchase OR admin grant), not by which surface mode or tier they're on. A Presence Premium merchant without a Commerce Bundle sees product pages with inquiry/QR/share but no "Add to cart." The same merchant after buying a Commerce Bundle sees full checkout rails — same tier, same surface, overlay added.
15. **App-store bundles (BSaaS purchases):** The existing `tenant_feature_purchases` table and `routes/bsaas-purchases.ts` already support à la carte feature purchases. V3.1 defines the *product* bundles to sell in the app store — the *plumbing* already exists. **Bundle names are job-framed, not capability-framed.** Merchants browse by what they want to *do*, not by internal capability type keys. Initial bundles to define:

    | Store name (merchant-facing) | Capability types unlocked | What it lets the merchant do |
    |------------------------------|--------------------------|------------------------------|
    | **Accept Deposits** | `commerce_types` (deposit), `fulfillment_options` (pickup), `payment_gateway_options`, `product_types` | Let shoppers reserve with a deposit and pick up in store |
    | **Sell Online** | `commerce_types` (full pay), `fulfillment_options` (delivery/shipping), `payment_gateway_options`, `product_types` | Full online checkout with delivery or shipping |
    | **Sell Everywhere** | `commerce_types` (both), `fulfillment_options` (all), `payment_gateway_options`, `product_types` | Both deposit and full pay — shopper chooses |
    | **Get Found on Google** | `integration_options` (Google SWIS, GMC, Shopping, GBP) | Show up in Google Search, Shopping, and Maps |
    | **Open a Platform Store** | `storefront_options`, `storefront_types` | Branded store page with product browse on Visible Shelf |
    | **Manage Customer Conversations** | `crm_options` (full) | Ticket assignment, escalation, templates, rich text, attachments |
    | **Add a Chatbot** | `chatbot_options` (full — dynamic GPT, RAG, all skills) | AI chatbot with product search, inventory, order tracking skills |
    | **Spotlight Products** | `featured_options` (full) | Bestseller, sale, seasonal, staff pick, trending badges |
    | **Sell on Instagram & TikTok** | `social_commerce_options` (full) | Meta + TikTok catalog sync, shop setup, pixel tracking, abandoned cart |
    | **Build Sales Funnels** | `funnel_options` (full) | Order bumps, upsells, downsells, one-time offers |
    | **Find Wholesale Suppliers** | `wholesale_matching` (full) | Supplier matching, Faire search, brand partner discovery |
    | **Scan Barcodes** | `barcode_scan_options` (full) | Camera, USB, and manual barcode scanning |

    **Naming convention:** Store names use verb + outcome ("Accept Deposits," "Get Found on Google," "Sell on Instagram & TikTok"). Capability type keys appear only in admin tooling and internal docs — never in the store UI. Sub-bundles (e.g. "Accept Deposits" vs "Sell Online" vs "Sell Everywhere") mirror the Commerce triad money modes but are framed as what the merchant wants to *do*, not which capability subset they're buying.

    Bundles can be subscription (recurring) or one-time (lifetime/per-period). Pricing TBD — separate from depth rung pricing.
16. **`_flexible` purchases:** The existing `_flexible` purchase expansion (buying `{capability_key}_flexible` unlocks ALL features in that capability type) is the "all features in this capability" app-store bundle. This is already implemented in the resolver. In store terms, this is the "Everything in [capability]" tier of each bundle — e.g. "Sell Everywhere" is the `_flexible` version of the commerce bundle (all commerce features) vs. "Accept Deposits" (deposit-only subset).
17. **Capability resolver — no changes needed for depth rungs.** The three-source resolution model in `EffectiveCapabilityResolver.ts` already merges tier features, BSaaS purchases, and admin overrides. Depth rung tiers just add more rows to `tier_features_list` — the resolver picks them up automatically. App-store bundles just add rows to `tenant_feature_purchases` — same. The resolver is source-agnostic by design.
18. **Upgrade UX — three paths, not one.** A merchant on Presence base has three upgrade paths, presented as distinct options:
    - **Go deeper (depth):** Presence Plus / Presence Premium — same surface, more capability. Tier upgrade.
    - **Switch surface (mode):** Discovery / Storefront — different surface. Tier upgrade.
    - **Add overlay (app store):** Commerce Bundle, Google Bundle, etc. — keep current tier, add à la carte. BSaaS purchase.
    The dashboard should present all three paths, not just the tier ladder. The app-store path is often the lowest-friction (no tier change, no migration, just add a bundle).

---

# Open questions (deferred)

| Question | Notes |
|----------|-------|
| Commerce depth rungs? | Commitment Plus / Ecommerce Plus / Omnichannel Plus could add featured, funnels, social commerce, wholesale matching on top of commerce modes. Out of scope for this addendum. Natural V3.2 extension. |
| Scale depth rungs? | Professional Plus / Enterprise Plus. Probably not — Scale is already the top and is custom-contract territory. |
| Trials on depth rungs? | V3 gives 14-day trial on paid modes. Extend to depth rungs? Likely yes for consistency, but confirm. |
| Storefront without Google (pure platform)? | V3 defers this. V3.1 does not address it — depth rungs inherit V3's Storefront-includes-Google default. A merchant who wants pure platform could buy a "Platform Browse Bundle" in the app store on top of a Presence tier instead — that path doesn't carry Google. |
| Depth rung downgrades? | Premium → Plus → base within a mode. Operator-only v1 per V3 §3.2. Self-serve later? |
| Cross-mode depth transfer? | If a merchant goes Presence Premium → Discovery, do they drop to Discovery base or map to Discovery Plus? v1: drop to base. Future: prorated lateral mapping. Note: app-store overlay purchases (Commerce Bundle, Google Bundle, etc.) persist across tier changes — they're not tier-bound. |
| One-time packs vs. depth rungs vs. app-store bundles? | Three product shapes now: (1) depth rungs = subscription tier-bundle, (2) app-store bundles = subscription or one-time à la carte overlay, (3) one-time packs = legacy deferred. Depth rungs supersede packs for directory polish. App-store bundles handle à la carte. Packs may still make sense for `platform_services` (one-time logo design). |
| `product_types` on directory surface? | Directory-surface product display (Presence Plus/Premium) uses `product_options` for creation + display. Should `product_types` (physical/digital/hybrid/service classification) also be available on directory surface for display purposes, or do directory products default to "physical" implicitly? v1: leave `product_types` as Commerce-only in tier-bundle; directory products are untyped (display-only). Available via app-store Commerce Bundle if merchant wants product type classification. |
| Product page sections on directory surface | `product_options_sections_fulfillment` is a display section (shows fulfillment info on the page), not a commerce rail. Should it appear on directory-surface product pages? v1: no — fulfillment info implies commerce readiness. Keep it off directory product pages unless the merchant has a Commerce Bundle (effective commerce capability resolved). |
| App-store bundle pricing? | Depth rung pricing is defined (§6). App-store bundle pricing is TBD — separate exercise. Key question: is the Commerce Bundle a monthly subscription (e.g. $30/mo on top of any tier) or a one-time purchase? Likely subscription (recurring Stripe billing via existing `tenant_feature_purchases`). |
| App-store bundle UX? | Where does the merchant browse/buy bundles? Dedicated app-store page in the dashboard? Inline "Add commerce" CTAs on product pages when commerce isn't resolved? Both? |
| Tier upgrade vs. app-store bundle — which to surface first? | A Presence base merchant could go to Presence Plus ($29, depth) OR buy a Commerce Bundle ($X/mo, overlay) OR switch to Storefront ($59, mode). Which CTA is primary? Likely: depth first (cheapest, same surface), then overlay (add commerce), then mode switch (biggest change). But confirm with product. |
| `max_skus` resolution with commerce overlay | If a Presence Premium merchant (max_skus ~50) buys a Commerce Bundle, does max_skus lift to commerce-tier levels (e.g. unlimited)? The resolver should check effective commerce capability (any source) when determining max_skus, not just the tier. Implementation detail for the resolver. |

---

# Success metrics (V3.1 additions)

| Metric | Signal |
|--------|--------|
| Depth attach rate by mode | % of base-tier merchants who upgrade to Plus/Premium within 90 days |
| Depth ARPU lift | Revenue delta from depth rungs vs. V3 base-only model |
| App-store bundle attach rate | % of merchants who buy at least one app-store bundle within 90 days of tier activation |
| App-store ARPU lift | Revenue delta from app-store bundles (overlay) vs. tier subscription alone |
| Commerce-via-overlay vs. commerce-via-tier | % of merchants with commerce capability who got it via app-store bundle vs. Commerce tier subscription — indicates whether the overlay path is the preferred entry to commerce |
| Mode purity incidents (tier-bundle only) | Count of tier-bundle capability assignments that violate the mode-affinity allowlist (target: 0). App-store overlay crossings are NOT incidents — they're merchant choice. |
| Depth → Commerce conversion | % of Premium-tier merchants who later open a till (via tier upgrade OR app-store Commerce Bundle) vs. base-tier merchants |
| Lateral mode switch rate | % of merchants who switch surface modes (vs. going deeper in current mode or adding overlay) — indicates whether depth + overlay reduces mode churn |
| Overlay retention | % of app-store bundle purchases still active at 6 months — indicates whether bundles are sticky or churn-prone |

---

# Document control

| Version | Date | Summary |
|---------|------|---------|
| V3 | 2026-08-18 | Entry Presence triad + Directory Presence gateway; mode-based tiers |
| **V3.1** | 2026-08-21 | Capability depth rungs within each surface mode (tier-bundle baseline) + app-store overlay (BSaaS purchases on any tier) + admin grants; three-source capability resolution model (tier / app-store / admin); tier-bundle is mode-locked, app-store overlay is merchant-chosen |

*This addendum extends V3 with two product concepts: (1) capability depth rungs — the tier-bundle baseline goes deeper within each surface mode; (2) app-store overlay — merchants buy capability bundles à la carte on top of any tier, including commerce on a presence tier. The tier-bundle stays mode-locked (no smear); the app-store overlay is merchant-chosen (choice, not smear). All three capability sources (tier / BSaaS / admin) resolve to one effective capability set via the existing `EffectiveCapabilityResolver`. All future development should align with the layer model (Gateway → Entry Presence → Commerce → Scale), the tier-bundle depth model (base / Plus / Premium per mode), and the app-store overlay model (any bundle on any tier).*

---

**End of PLATFORM_STRATEGY_V3.1_DEPTH_RUNGS addendum**
