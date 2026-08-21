# VISIBLE SHELF
## Platform Strategy V3.1 Addendum — Capability Depth Rungs
*Confidential Working Document*

> **Status:** Addendum to `PLATFORM_STRATEGY_V3.md` — extends, does not supersede.
> **Date:** 2026-08-21
> **Companion:** `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` (v3.1 implementation)
> **Code hierarchy skill:** `.devin/skills/tier-hierarchy.md` (must stay in sync)

---

# Why this addendum exists

V3 introduced the **Entry Presence triad** (Starter / Discovery / Storefront) as *mode* choices — *which visibility surface* a merchant rents. That doctrine is correct and stays.

What V3 did not exploit is that the underlying **capability architecture is orthogonal to the mode axis**. The `tier_features_list` join allows any tier to activate any capability type. V3 uses this flexibility only to assign a flat capability set per mode. The result is one paid rung per surface, then a cliff into Commerce.

This addendum unlocks a **second axis — capability depth** — *within* each surface mode, without re-smearing modes. A merchant on the directory surface can go deeper on directory (Plus, Premium) without being forced into Google or platform browse. A merchant on the platform surface can go deeper on platform (Plus, Premium) without being forced into checkout.

**One-line doctrine:**

> *V3 chose which hall you rent. V3.1 lets you furnish the hall — without renting a different one.*

---

# The two-axis model

| Axis | Question | Set by |
|------|----------|--------|
| **Surface mode** (V3) | *Where* is the business visible? | Mode triad: directory / Google / platform |
| **Capability depth** (V3.1) | *How much* can the business do on that surface? | Depth rung: base / Plus / Premium |

```
                        Depth →
              base      Plus      Premium
            ┌────────┬────────┬────────┐
directory   │  $0    │  —     │  —     │   ← gateway (free, single rung)
surface     ├────────┼────────┼────────┤
            │ $19    │ $29    │ $39    │   ← Presence ladder
            ├────────┼────────┼────────┤
Google      │ $29    │ $39    │ $49    │   ← Discovery ladder
surface     ├────────┼────────┼────────┤
            │ $59    │ $69    │ $79    │   ← Storefront ladder
platform    │        │        │        │
surface     └────────┴────────┴────────┘
                        │
                        ▼
                  Commerce triad
                  (separate axis:
                   how money moves)
```

**Key invariants:**

1. **Depth rungs never change the surface mode.** Presence Premium is still directory surface — it never silently adds Google SWIS or platform product browse. Storefront Premium is still platform surface — it never silently adds checkout.
2. **Depth is operator-curated, not self-serve.** Platform staff define which capability types each rung activates. Merchants pick a rung; they do not assemble capability bundles. This is the primary smear-risk mitigation (see §3).
3. **Mode purity is enforced per rung, not just per mode.** Each depth rung has a mode-locked capability allowlist. A capability type that belongs to a different surface mode cannot appear in this mode's rungs.
4. **Commerce is a separate axis.** Depth rungs do not open a till. A merchant on Storefront Premium ($79) and a merchant on Commitment ($79) pay the same but get different products: deeper presence vs. opened commerce. Price collision across axes is intentional and clarifying.

---

# Smear-risk mitigation — operator-curated, mode-locked

V3's strongest warning is the legacy `starter` failure: a tier that mixed storefront + Clover + SEO + category quickstart into one undifferentiated feature bag. V3.1 does not repeat that failure.

## Mitigation: operator curation, not self-serve mixing

| Control | Mechanism |
|---------|-----------|
| **Who defines rungs** | Platform staff via the existing Capability Management admin (`/api/admin/tier-capabilities`). No merchant-facing bundle builder. |
| **What defines a rung's capability set** | A fixed, curated set of capability types assigned to the tier row in `tier_features_list`. Documented in this addendum and enforced by tests. |
| **What prevents cross-mode smear** | A per-mode capability allowlist (§5). A rung may only activate capability types whose `mode_affinity` matches its surface. |
| **What prevents commerce smear** | Commerce-only capability types (`commerce_types`, `fulfillment_options`, `payment_gateway_options`, `product_types`) are excluded from all presence/storefront depth rungs. They appear only on Commerce triad tiers. |
| **What prevents scale smear** | Org/chain capability types (`organization`) are excluded from depth rungs. They appear only on Scale tiers (Professional / Org / Enterprise). |

## Mode-affinity table (capability type → surface mode)

This is the allowlist that governs which capability types may appear in which mode's depth rungs. Capability types not listed here are **mode-agnostic infrastructure** (available to all paid tiers) or **excluded from depth rungs** (Commerce/Scale/admin-only).

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
| `product_options` | ❌ | ✅ (SEO product pages) | ✅ core |
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

> **Note on `chatbot_options` mode affinity:** the capability type is allowed on all three surfaces, but the *feature subset* differs by mode. Directory and Google surfaces get static FAQ engine + widget embed + CRM assistant + store hours skill only. Platform surface gets the full set (dynamic GPT, RAG, dedicated engine, all skills). This subset discipline is enforced at the feature-assignment level, not the capability-type level.

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

Directory surface + engagement. Adds promotion, FAQ, featured, CRM inquiries, richer QR/gallery.

| Capability type | Feature subset (additive over Presence) |
|-----------------|------------------------------------------|
| `directory_promotion` | enabled, level_basic |
| `faq_options` | display_enabled, display_on, storefront_accordion, management_enabled, management_on, preview_enabled, preview_on |
| `featured_options` | enabled, featured, new_arrival, sale, staff_pick, recommended |
| `storefront_qr` | styled renderer, custom_colors, dot_styles, corner_styles |
| `storefront_gallery` | magazine, 10-image limit |
| `crm_options` | enabled, inquiry_directory_enabled, inquiry_directory_on, inquiry_customer, inquiry_auto_response, inquiry_assignment, message_templates, customer_tickets, ticket_priority |

### Rung 3 — Presence Premium — $39/mo (new)

Directory surface + automation. Adds chatbot, knowledge base, platform services, quickstart, premium promotion, full gallery.

| Capability type | Feature subset (additive over Presence Plus) |
|-----------------|-----------------------------------------------|
| `chatbot_options` | enabled, static_lookup, static_enabled, static_on, widget_embed, widget_enabled, widget_on, skill_crm_assistant, skill_store_hours, skills_enabled, skills_on |
| `faq_options` | kb_enabled, kb_on, kb_auto_sync, chatbot_knowledge_base, display_bot_handoff, preview_bot, preview_gap_report, kb_coverage_metrics |
| `platform_services` | enabled, logo_design, profile_setup, seo_optimization, social_media_kit, store_setup, banner_design |
| `quickstart_options` | enabled, wizard, product_enabled, product_on, category_enabled, category_on, category_generator, ai_enabled, ai_on, image_gen |
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
| "Do not smear modes" rule | **Unchanged and strengthened.** Mode-affinity allowlist (§3) enforces it per rung. |
| Commerce triad (Commitment / Ecommerce / Omnichannel) as separate axis | **Unchanged.** Depth rungs do not open a till. |
| Storefront inherits Discovery-class Google by default | **Unchanged.** Storefront depth rungs inherit the same Google baseline. |
| Legacy `starter` tier stays inactive | **Unchanged.** `presence` is the active directory-mode key; `presence_plus` / `presence_premium` extend it. |
| One-time website / listing_plus packs are not peer presence modes | **Unchanged.** Depth rungs are subscription tiers, not one-time packs. |
| Scale tiers (Professional / Org / Enterprise) for multi-location | **Unchanged.** `organization` capability type excluded from depth rungs. |

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
  Commerce triad (separate axis — open a till)
     Commitment / Ecommerce / Omnichannel
                    │
                    ▼
                  Scale
```

**Lateral moves (operator-only v1):**
- Within a mode: base → Plus → Premium (self-serve upgrade)
- Within a mode: Premium → Plus → base (downgrade — operator-only v1)
- Across modes: any mode/depth → any other mode/base (lateral — operator-only v1, preserves V3 §3.2)
- To Commerce: any Entry Presence mode/depth → Commerce triad (self-serve upgrade)

---

# Implementation implications (strategy → build)

These are strategic requirements for engineering alignment. Detail lives in a follow-on implementation spec.

1. **New tier keys:** `presence_plus`, `presence_premium`, `discovery_plus`, `discovery_premium`, `storefront_plus`, `storefront_premium`. Six new tier rows.
2. **Migration:** Next free after 231 (`232_depth_rungs.sql`). Inserts tier rows + `tier_features_list` rows per §4 capability sets. Does NOT modify existing base tier rows.
3. **`billing_type`:** All six new tiers = `subscription`.
4. **Sort order:** Cluster depth rungs under their mode (e.g. presence=10, presence_plus=11, presence_premium=12, discovery=20, discovery_plus=21, ...). Tight spacing within mode, gap between modes.
5. **Upgrade-options API:** Must return depth rungs *within the current mode* separately from peer mode options. Two queries: `GET /api/tenant/:id/upgrade/depth` (within-mode) and `GET /api/tenant/:id/upgrade/modes` (across-mode). Do not merge into one `sort_order > current` list.
6. **Mode-affinity enforcement:** Tests must verify that no depth rung has a capability type outside its mode's allowlist (§3). Add a test suite `depth-rung-mode-purity.test.ts`.
7. **Capability Management admin:** Existing `/api/admin/tier-capabilities` already supports assigning any capability type to any tier. No new admin endpoints required for v1 — operator curates via existing UI.
8. **Tier-hierarchy skill:** Update `.devin/skills/tier-hierarchy.md` to document the two-axis model and depth rung keys.
9. **FEATURE_TIER_MAP / TIER_FEATURES / TIER_HIERARCHY:** Add depth rung entries. Depth rungs inherit their mode's base tier, then add their curated capability set.
10. **Growth tips / next-steps:** Mode-aware. A merchant on Presence Plus sees "Go Premium" (depth) and "Add Google" (mode) as distinct CTAs, not a single ladder.
11. **Public render gating:** Logo/about/gallery already gate on Presence+. Depth-rung features (FAQ, chatbot, featured, coupons, funnels) need their own gates keyed to the appropriate depth rung.
12. **No merchant-facing bundle builder.** Merchants pick a rung; they do not assemble capability bundles. This is a product decision, not a technical limitation.

---

# Open questions (deferred)

| Question | Notes |
|----------|-------|
| Commerce depth rungs? | Commitment Plus / Ecommerce Plus / Omnichannel Plus could add featured, funnels, social commerce, wholesale matching on top of commerce modes. Out of scope for this addendum. Natural V3.2 extension. |
| Scale depth rungs? | Professional Plus / Enterprise Plus. Probably not — Scale is already the top and is custom-contract territory. |
| Trials on depth rungs? | V3 gives 14-day trial on paid modes. Extend to depth rungs? Likely yes for consistency, but confirm. |
| Storefront without Google (pure platform)? | V3 defers this. V3.1 does not address it — depth rungs inherit V3's Storefront-includes-Google default. |
| Depth rung downgrades? | Premium → Plus → base within a mode. Operator-only v1 per V3 §3.2. Self-serve later? |
| Cross-mode depth transfer? | If a merchant goes Presence Premium → Discovery, do they drop to Discovery base or map to Discovery Plus? v1: drop to base. Future: prorated lateral mapping. |
| One-time packs vs. depth rungs? | V3 defers one-time packs (logo pack, etc.). Depth rungs are subscription and supersede the pack idea for directory polish. Packs may still make sense for platform_services (one-time logo design) vs. subscription depth. |

---

# Success metrics (V3.1 additions)

| Metric | Signal |
|--------|--------|
| Depth attach rate by mode | % of base-tier merchants who upgrade to Plus/Premium within 90 days |
| Depth ARPU lift | Revenue delta from depth rungs vs. V3 base-only model |
| Mode purity incidents | Count of capability assignments that violate the mode-affinity allowlist (target: 0) |
| Depth → Commerce conversion | % of Premium-tier merchants who later open a till vs. base-tier merchants |
| Lateral mode switch rate | % of merchants who switch surface modes (vs. going deeper in current mode) — indicates whether depth reduces mode churn or delays it |

---

# Document control

| Version | Date | Summary |
|---------|------|---------|
| V3 | 2026-08-18 | Entry Presence triad + Directory Presence gateway; mode-based tiers |
| **V3.1** | 2026-08-21 | Capability depth rungs within each surface mode; two-axis model (surface × depth); operator-curated, mode-locked capability sets |

*This addendum extends V3 with a second pricing/product axis (capability depth) while preserving V3's mode-purity doctrine. All future development should align with both the layer model (Gateway → Entry Presence → Commerce → Scale) and the two-axis model (surface mode × capability depth).*

---

**End of PLATFORM_STRATEGY_V3.1_DEPTH_RUNGS addendum**
