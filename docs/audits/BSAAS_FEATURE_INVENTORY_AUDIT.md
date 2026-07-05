# BSaaS Feature Inventory Audit — Standalone Sale Candidates

**Date**: 2026-07-04  
**Purpose**: Inventory all features within each capability type and identify candidates for à la carte standalone sale via the BSaaS catalog.  
**Context**: The "Active Capability Engagement" rule requires a tenant's tier to already have ≥1 feature in the same capability type before purchasing. Only features within capability types that tiers are already engaged with are viable standalone sale candidates.

---

## Key Insight: Flexible Toggles as Premium BSaaS Purchases

Every capability type has a `{capability}_flexible` feature key. When present in the merged features map, the resolver unlocks **all sub-features** within that capability type. For example:

```ts
// ChatbotOptionsResolver.ts
const flexible = !!feat.chatbot_flexible;
const staticTier = flexible || !!feat.chatbot_static_enabled;
const dynamicTier = flexible || !!feat.chatbot_dynamic_enabled;
// ... all sub-features unlocked when flexible is true
```

**Selling flexible toggles à la carte is the highest-value BSaaS offering** because:

1. **Full domain unlock** — Instead of buying individual features one by one, the merchant gets everything in the capability domain
2. **Zero code changes** — The `EffectiveCapabilityResolver` already merges `tenant_feature_purchases` into `mergedFeatures`, so purchasing `crm_flexible` automatically sets `feat.crm_flexible = true` in the resolver
3. **Perfect engagement fit** — The merchant must already be engaged in the capability (has ≥1 feature from their tier), so flexible is a natural vertical upgrade
4. **Compelling pricing** — Priced below a full tier upgrade but above any individual feature price within the domain, making it a bargain vs. buying features separately

### Flexible Toggle Sale Candidates

| Capability Type | Flexible Key | Suggested Price | Rationale |
|---|---|---|---|
| Chatbot | `chatbot_flexible` | $49/mo | Unlocks all 27 chatbot features (skills, KB, widget, engines) |
| CRM | `crm_flexible` | $39/mo | Unlocks all 22 CRM features (tickets, inquiries, templates, analytics) |
| FAQ | `faq_flexible` | $19/mo | Unlocks all 23 FAQ features (KB, management, preview, display) |
| Storefront Options | `storefront_opt_flexible` | $29/mo | Unlocks all 37 storefront option features (layouts, gallery, QR, maps) |
| Product Options | `product_options_flexible` | $29/mo | Unlocks all 51 product option features (layouts, sections, creation) |
| Featured | `featured_flexible` | $19/mo | Unlocks all 17 featured types (badges, trending, seasonal, etc.) |
| Social Commerce | `social_commerce_flexible` | $39/mo | Unlocks all 13 social commerce features (Meta, TikTok, cart recovery) |
| Directory Entry | `directory_entry_flexible` | $19/mo | Unlocks all 16 directory features (gallery, layouts, map, SEO) |
| Integration | `integration_flexible` | $29/mo | Unlocks all 18 integration features (Clover, Square, GBP, GMC) |
| Fulfillment | `fulfillment_flexible` | $15/mo | Unlocks all 6 fulfillment methods (pickup, delivery, shipping, service) |
| Payment Gateway | `payment_gateway_flexible` | $25/mo | Unlocks all 3 gateways (Stripe, PayPal, Square) |
| Barcode Scan | `barcode_flexible` | $12/mo | Unlocks all 4 scan methods (camera, USB, manual, scan) |
| Quickstart | `quickstart_flexible` | $19/mo | Unlocks all 12 quickstart features (wizard, AI, image gen) |
| Commerce Types | `commerce_both_options` | $15/mo | Unlocks both deposit + full payment modes |
| Storefront Types | `storefront_both_options` | $15/mo | Unlocks all 4 storefront types (online, retail, service, social) |
| Product Types | `product_types_flexible` | $15/mo | Unlocks all 4 product types (physical, digital, hybrid, service) |
| Organization | `org_flexible` | $49/mo | Unlocks all 18 org features (tabs, panels, propagation) |

**Implementation**: Add each flexible key to `bsaas_catalog` via migration. No resolver or purchase-flow code changes needed — the `EffectiveCapabilityResolver` already merges purchases into `mergedFeatures`, and `checkCapabilityEngagement` will pass because the merchant's tier must already have ≥1 feature in the capability type.

---

## Currently in BSaaS Catalog (7 items)

| Feature Key | Marketing Name | Price | Cycle | Trial | Migration |
|---|---|---|---|---|---|
| `chatbot_skill_crm_assistant` | CRM Assistant Skill | $19/mo | monthly | 0 | 047 |
| `chatbot_external_embed` | External Bot Embed | $9/mo | monthly | 0 | 047 |
| `chatbot_skill_order_tracking` | Order Tracking Skill | $12/mo | monthly | 0 | 047 |
| `chatbot_skill_cross_merchant` | Cross-Merchant Search Skill | $24/mo | monthly | 0 | 047 |
| `featured_custom_badge_slots` | Custom Badge Slots | $5/mo | monthly | 14 | 080 |
| `product_options_creation_supplier_catalog` | Supplier Catalog Import | $15/mo | monthly | 14 | 083 |
| `social_commerce_social_proof` | Social Proof & UGC | $15/mo | monthly | 14 | 084 |

---

## Exclusion Criteria

Features **not** suitable for standalone sale:

- **Master gates** (e.g., `chatbot_enabled`, `crm_enabled`) — auto-created as zero-cost companion purchases via `ensureCompanionPurchase`
- **Disabled/negative flags** (e.g., `storefront_disabled`, `product_options_disabled`) — absence-of-feature markers
- **Group/section toggles** (e.g., `storefront_opt_advanced_enabled`, `product_options_sections_enabled`) — internal resolver grouping, not user-facing
- **Layout variants** (e.g., `storefront_opt_layout_classic`, `product_layout_editorial`) — tier-differentiated display modes, not premium add-ons
- **Flexible toggles** — sold as the premium domain-unlock (see above), not individual features
- **Tier-defining features** (e.g., `storefront`, `physical_product`) — fundamental capability, not add-on

---

## Full Capability Type Inventory

### 1. Barcode Scan Options (6 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `barcode_enabled` | Barcode Scanner Enabled | ❌ Master gate | Companion-purchased |
| `barcode_flexible` | Flexible Barcode Options | ✅ **Flexible** | Domain unlock — $12/mo |
| `barcode_camera` | Camera Barcode Scan | ✅ **High** | Premium scan method — mobile camera |
| `barcode_manual` | Manual Barcode Scan | ❌ Basic | Entry-level, tier-bundled |
| `barcode_scan` | Barcode Scan | ❌ Legacy | Superseded by specific methods |
| `barcode_usb` | USB Barcode Scan | ✅ **Medium** | Hardware-integrated scanning |

**Individual feature candidates**: `barcode_camera` ($8/mo), `barcode_usb` ($6/mo)

---

### 2. Commerce Types (4 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `commerce_enabled` | Commerce Enabled | ❌ Master gate | Companion-purchased |
| `commerce_both_options` | Flexible Commerce (Both Options) | ✅ **Flexible** | Domain unlock — $15/mo |
| `commerce_deposit_only` | Commerce Deposit Only | ✅ **Medium** | Deposit-based selling — niche |
| `commerce_full_payment` | Commerce Full Payment | ❌ Core | Standard commerce flow |

**Individual feature candidates**: `commerce_deposit_only` ($12/mo) — low priority, small TAM

---

### 3. CRM Options (22 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `crm_enabled` | Enable CRM | ❌ Master gate | Companion-purchased |
| `crm_flexible` | Flexible CRM | ✅ **Flexible** | Domain unlock — $39/mo |
| `crm_contact_management` | Contact Management | ❌ Core CRM | Basic function |
| `crm_contact_import` | Contact Import | ✅ **High** | Bulk import from CSV/external |
| `crm_contact_sync` | Contact Sync | ✅ **High** | Sync across systems |
| `crm_customer_tickets` | Customer Support Tickets | ❌ Core CRM | Basic ticketing |
| `crm_dashboard_analytics` | CRM Dashboard Analytics | ✅ **High** | Advanced reporting |
| `crm_inquiry_anonymous` | Anonymous Inquiries | ✅ **Medium** | Guest inquiry capture |
| `crm_inquiry_assignment` | Inquiry Assignment | ✅ **Medium** | Route to team members |
| `crm_inquiry_auto_response` | Inquiry Auto-Response | ✅ **High** | Automated response |
| `crm_inquiry_customer` | Customer Inquiries | ❌ Core CRM | Basic inquiry handling |
| `crm_inquiry_directory_enabled` | Directory Inquiries | ✅ **Medium** | From directory listing |
| `crm_inquiry_product_enabled` | Product Page Inquiries | ✅ **Medium** | From product pages |
| `crm_inquiry_storefront_enabled` | Storefront Inquiries | ❌ Core CRM | Basic storefront inquiry |
| `crm_message_attachments` | Message Attachments | ✅ **High** | File sharing in messages |
| `crm_message_rich_text` | Rich Text Messages | ✅ **Low** | Nice-to-have |
| `crm_message_templates` | Message Templates | ✅ **High** | Saved response templates |
| `crm_requests_hub` | Requests Hub (Tenant-Facing) | ✅ **High** | Self-service portal |
| `crm_ticket_assignment` | Ticket Assignment | ✅ **Medium** | Route tickets |
| `crm_ticket_escalation` | Ticket Escalation | ✅ **Medium** | SLA workflows |
| `crm_ticket_priority` | Ticket Priority | ✅ **Low** | Basic priority levels |
| `crm_ticket_templates` | Ticket Templates | ✅ **Medium** | Pre-configured templates |

**Top individual candidates**: `crm_contact_import` ($8/mo), `crm_dashboard_analytics` ($12/mo), `crm_message_templates` ($6/mo), `crm_message_attachments` ($5/mo), `crm_requests_hub` ($15/mo), `crm_inquiry_auto_response` ($8/mo)

---

### 4. Directory Entry (16 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `directory_entry_enabled` | Directory Entry — Enabled | ❌ Master gate | Companion-purchased |
| `directory_entry_flexible` | Directory Entry — Flexible | ✅ **Flexible** | Domain unlock — $19/mo |
| `directory_entry_contact_enabled` | Contact Info | ❌ Basic | Core directory feature |
| `directory_entry_hours_enabled` | Hours Display | ❌ Basic | Core directory feature |
| `directory_entry_hours_status` | Hours Status | ❌ Basic | Open/closed indicator |
| `directory_entry_hours_animated` | Animated Hours | ✅ **Low** | Visual enhancement |
| `directory_entry_gallery_enabled` | Gallery | ✅ **High** | Photo gallery — premium |
| `directory_entry_layout_classic` | Classic Layout | ❌ Layout variant | Tier-differentiated |
| `directory_entry_layout_editorial` | Editorial Layout | ❌ Layout variant | Tier-differentiated |
| `directory_entry_layout_enabled` | Layout Group Enabled | ❌ Group toggle | Internal grouping |
| `directory_entry_layout_immersive` | Immersive Layout | ❌ Layout variant | Tier-differentiated |
| `directory_entry_layout_premium` | Premium Layout | ✅ **High** | Premium layout — clear upsell |
| `directory_entry_map_enabled` | Map Display | ✅ **Medium** | Interactive map on listing |
| `directory_entry_qr_enabled` | Directory QR | ✅ **Medium** | QR code for directory listing |
| `directory_entry_seo_enabled` | SEO Enhanced | ✅ **High** | SEO optimization for listing |
| `directory_entry_social_enabled` | Social Links | ✅ **Medium** | Social media links on listing |

**Top individual candidates**: `directory_entry_gallery_enabled` ($8/mo), `directory_entry_layout_premium` ($10/mo), `directory_entry_seo_enabled` ($8/mo), `directory_entry_map_enabled` ($5/mo)

---

### 5. FAQ Options (23 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `faq_enabled` | Enable FAQ | ❌ Master gate | Companion-purchased |
| `faq_flexible` | Flexible FAQ | ✅ **Flexible** | Domain unlock — $19/mo |
| `faq_display_enabled` | FAQ Display Enabled | ❌ Core FAQ | Basic display |
| `faq_display_bot_handoff` | Bot Handoff CTA | ✅ **High** | Handoff to live chat — premium |
| `faq_display_feedback` | Feedback & Suggest Edit | ✅ **Medium** | User feedback on FAQs |
| `faq_display_product_accordion` | Product Accordion | ❌ Core display | Standard product FAQ |
| `faq_display_storefront_accordion` | Storefront Accordion | ❌ Core display | Standard storefront FAQ |
| `faq_kb_enabled` | FAQ Knowledge Base Enabled | ✅ **High** | Structured KB — premium |
| `faq_kb_auto_sync` | Sync Inquiry to FAQ | ✅ **High** | Auto-expand KB from inquiries |
| `faq_kb_coverage_metrics` | Coverage Metrics Dashboard | ✅ **Medium** | Analytics on KB gaps |
| `faq_chatbot_knowledge_base` | Chatbot Knowledge Base | ✅ **High** | Bot uses FAQ as KB |
| `faq_management_enabled` | FAQ Management Enabled | ❌ Core FAQ | Basic management |
| `faq_management_bulk_actions` | Bulk Actions | ✅ **Medium** | Bulk edit/delete FAQs |
| `faq_management_hub` | FAQ Hub | ✅ **Medium** | Centralized FAQ management |
| `faq_management_import` | CSV Import Wizard | ✅ **High** | Bulk import FAQs |
| `faq_management_reorder` | Drag-and-Drop Reorder | ✅ **Low** | Nice-to-have |
| `faq_management_search` | Debounced Search | ✅ **Low** | Nice-to-have |
| `faq_preview_enabled` | FAQ Preview Enabled | ❌ Core FAQ | Basic preview |
| `faq_preview_bot` | Bot Preview | ✅ **Medium** | Preview how bot uses FAQ |
| `faq_preview_gap_report` | Gap Report | ✅ **Medium** | Identify missing FAQs |
| `faq_product_enabled` | Product FAQ Enabled | ❌ Core FAQ | Standard product FAQ |
| `faq_storefront_enabled` | Storefront FAQ Enabled | ❌ Core FAQ | Standard storefront FAQ |
| `faq_templates_enabled` | Templates FAQ Enabled | ✅ **Medium** | Pre-built FAQ templates |

**Top individual candidates**: `faq_chatbot_knowledge_base` ($10/mo), `faq_kb_auto_sync` ($8/mo), `faq_management_import` ($6/mo), `faq_display_bot_handoff` ($8/mo)

---

### 6. Featured Options (17 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `featured_enabled` | Enable Featured | ❌ Master gate | Companion-purchased |
| `featured_flexible` | Flexible Featured | ✅ **Flexible** | Domain unlock — $19/mo |
| `featured_custom_badge_slots` | Custom Badge Slots | ✅ **In catalog** | $5/mo, 14-day trial |
| `featured_featured` | Featured | ❌ Core | Basic featured placement |
| `featured_platform_enabled` | Platform Featured Enabled | ❌ Platform-level | Admin-controlled |
| `featured_tenant_enabled` | Tenant Featured Enabled | ❌ Core | Basic tenant featured |
| `featured_bestseller` | Bestseller | ✅ **Medium** | Badge type |
| `featured_clearance` | Clearance | ✅ **Medium** | Badge type |
| `featured_new_arrival` | New Arrival | ✅ **Medium** | Badge type |
| `featured_sale` | Sale | ✅ **Medium** | Badge type |
| `featured_seasonal` | Seasonal | ✅ **Medium** | Badge type |
| `featured_staff_pick` | Staff Pick | ✅ **Medium** | Badge type |
| `featured_trending` | Trending | ✅ **Medium** | Badge type |
| `featured_recommended` | Recommended | ✅ **Medium** | Badge type |
| `featured_random_featured` | Random Featured | ✅ **Low** | Badge type |
| `featured_store_selection` | Store Selection | ✅ **Low** | Badge type |
| `featured_expiry_monitor` | Featured Expiration Monitor | ✅ **High** | Auto-expiry management — premium |

**Note**: Individual featured badge types (bestseller, clearance, etc.) are lower priority since `featured_custom_badge_slots` already covers custom badging. `featured_expiry_monitor` ($8/mo) is the strongest individual candidate.

---

### 7. Fulfillment Options (6 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `fulfillment_enabled` | Fulfillment Enabled | ❌ Master gate | Companion-purchased |
| `fulfillment_flexible` | Flexible Fulfillment | ✅ **Flexible** | Domain unlock — $15/mo |
| `fulfillment_pickup` | Pickup Fulfillment | ❌ Core | Basic fulfillment method |
| `fulfillment_delivery` | Delivery Fulfillment | ✅ **High** | Local delivery — premium |
| `fulfillment_shipping` | Shipping Fulfillment | ✅ **High** | Shipping — premium |
| `fulfillment_service` | Service Fulfillment | ✅ **Medium** | Service-based fulfillment |

**Top individual candidates**: `fulfillment_delivery` ($8/mo), `fulfillment_shipping` ($8/mo), `fulfillment_service` ($6/mo)

---

### 8. Integration Options (18 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `integration_enabled` | Enable Integration | ❌ Master gate | Companion-purchased |
| `integration_flexible` | Integration Flexible | ✅ **Flexible** | Domain unlock — $29/mo |
| `integration_clover` | Clover POS Sync | ✅ **High** | Clover integration |
| `integration_square` | Square POS Sync | ✅ **High** | Square integration |
| `integration_gbp` | Google Business Profile | ✅ **High** | GBP integration |
| `integration_gmc_sync` | GMC Product Sync | ✅ **High** | Advanced Google Merchant Center |
| `integration_google_enabled` | Google Integrations Enabled | ❌ Group toggle | Internal grouping |
| `integration_google_shopping` | Google Shopping Feed | ✅ **Medium** | Google Shopping |
| `integration_google_merchant_center` | Google Merchant Center | ✅ **Medium** | GMC integration |
| `integration_pos_enabled` | POS Integrations Enabled | ❌ Group toggle | Internal grouping |
| `integration_propagation_gbp` | GBP Propagation | ✅ **Medium** | Org-level GBP propagation |
| `clover_sync` | Clover Sync (legacy) | ❌ Legacy | Supeded by `integration_clover` |
| `square_sync` | Square Sync (legacy) | ❌ Legacy | Superseded by `integration_square` |
| `google_sync` | Google Sync (legacy) | ❌ Legacy | Superseded |
| `google_shopping` | Google Shopping (legacy) | ❌ Legacy | Superseded by `integration_google_shopping` |
| `google_merchant_center` | GMC (legacy) | ❌ Legacy | Superseded |
| `gbp_integration` | GBP Integration (legacy) | ❌ Legacy | Superseded by `integration_gbp` |
| `propagation_gbp_sync` | Propagation GBP Sync (legacy) | ❌ Legacy | Superseded |

**Top individual candidates**: `integration_clover` ($12/mo), `integration_square` ($12/mo), `integration_gbp` ($10/mo), `integration_gmc_sync` ($15/mo)

---

### 9. Payment Gateway Options (5 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `payment_gateway_enabled` | Payment Gateway Enabled | ❌ Master gate | Companion-purchased |
| `payment_gateway_flexible` | Flexible Payment Gateway | ✅ **Flexible** | Domain unlock — $25/mo |
| `payment_gateway_stripe` | Stripe Payment Gateway | ✅ **High** | Stripe — most popular |
| `payment_gateway_paypal` | PayPal Payment Gateway | ✅ **High** | PayPal — widely expected |
| `payment_gateway_square` | Square Payment Gateway | ✅ **High** | Square — retail merchants |

**Top individual candidates**: `payment_gateway_paypal` ($10/mo), `payment_gateway_square` ($10/mo). Stripe is likely tier-bundled for most tiers.

---

### 10. Product Options (51 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `product_options_enabled` | Product Options Enabled | ❌ Master gate | Companion-purchased |
| `product_options_flexible` | Product Options Flexible | ✅ **Flexible** | Domain unlock — $29/mo |
| `product_enabled` | Product Enabled | ❌ Master gate (legacy) | Companion-purchased |
| `product_flexible` | Flexible Product (legacy) | ❌ Legacy flexible | Use `product_options_flexible` |
| `product_options_disabled` | Product Options Disabled | ❌ Negative flag | Absence marker |
| `product_options_creation_disabled` | Creation Group Disabled | ❌ Negative flag | Absence marker |
| `product_options_creation_enabled` | Creation Group Enabled | ❌ Group toggle | Internal grouping |
| `product_options_creation_gallery` | Product Gallery (creation) | ✅ **High** | Gallery creation tool |
| `product_options_creation_supplier_catalog` | Supplier Catalog Import | ✅ **In catalog** | $15/mo, 14-day trial |
| `product_options_creation_variants` | Product Variants | ✅ **High** | Variant creation — premium |
| `product_options_creation_video` | Product Video | ✅ **High** | Video upload — premium |
| `product_options_layout_classic` | Classic Product Page | ❌ Layout variant | Tier-differentiated |
| `product_options_layout_editorial` | Editorial Product Page | ❌ Layout variant | Tier-differentiated |
| `product_options_layout_immersive` | Immersive Product Page | ❌ Layout variant | Tier-differentiated |
| `product_options_layout_enabled` | Layout Group Enabled | ❌ Group toggle | Internal grouping |
| `product_options_layout_disabled` | Layout Group Disabled | ❌ Negative flag | Absence marker |
| `product_options_sections_enabled` | Sections Group Enabled | ❌ Group toggle | Internal grouping |
| `product_options_sections_disabled` | Sections Group Disabled | ❌ Negative flag | Absence marker |
| `product_options_sections_*` (10 keys) | Section sub-toggles | ❌ Group toggles | Internal grouping |
| `product_opt_*` (13 keys) | Legacy option keys | ❌ Legacy | Superseded by sections/creation |
| `product_physical` | Physical Product | ❌ Tier-defining | Fundamental capability |
| `product_digital` | Digital Product | ✅ **Medium** | Digital product type |
| `product_hybrid` | Hybrid Product | ✅ **Medium** | Hybrid product type |
| `product_variant` | Product Variant | ✅ **High** | Variants — premium |
| `product_video` | Product Video | ✅ **High** | Video — premium |
| `product_gallery` | Product Gallery | ✅ **Medium** | Gallery display |

**Top individual candidates**: `product_options_creation_variants` ($12/mo), `product_options_creation_video` ($8/mo), `product_options_creation_gallery` ($6/mo)

---

### 11. Quickstart Options (12 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `quickstart_enabled` | Quickstart Enabled | ❌ Master gate | Companion-purchased |
| `quickstart_flexible` | Quickstart Flexible | ✅ **Flexible** | Domain unlock — $19/mo |
| `quickstart_product_enabled` | Quickstart Product Enabled | ❌ Core | Basic product wizard |
| `quickstart_category_enabled` | Quickstart Category Enabled | ❌ Core | Basic category generator |
| `quickstart_wizard` | Quickstart Wizard | ❌ Core | Standard wizard |
| `quickstart_wizard_ai` | Quickstart Wizard AI | ✅ **High** | AI-powered wizard — premium |
| `quickstart_ai_enabled` | Quickstart AI Enabled | ❌ Group toggle | Internal grouping |
| `quickstart_ai_gemini` | Quickstart AI Gemini | ✅ **Medium** | Gemini model access |
| `quickstart_ai_openai` | Quickstart AI OpenAI | ✅ **Medium** | OpenAI model access |
| `quickstart_image_gen` | Quickstart Image Generation | ✅ **High** | AI image generation — premium |
| `quickstart_image_hd` | Quickstart Image HD | ✅ **High** | HD image generation — premium |
| `quickstart_category_generator` | Quickstart Category Generator | ❌ Core | Basic category gen |

**Top individual candidates**: `quickstart_wizard_ai` ($12/mo), `quickstart_image_gen` ($10/mo), `quickstart_image_hd` ($8/mo)

---

### 12. Chatbot Options (27 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `chatbot_enabled` | Enable Chatbot | ❌ Master gate | Companion-purchased |
| `chatbot_flexible` | Flexible Chatbot | ✅ **Flexible** | Domain unlock — $49/mo |
| `chatbot_skills_enabled` | Bot Skills | ❌ Core | Basic skills toggle |
| `chatbot_skill_crm_assistant` | CRM Assistant Skill | ✅ **In catalog** | $19/mo |
| `chatbot_skill_cross_merchant` | Cross-Merchant Skill | ✅ **In catalog** | $24/mo |
| `chatbot_skill_order_tracking` | Order Tracking Skill | ✅ **In catalog** | $12/mo |
| `chatbot_skill_product_search` | Product Search Skill | ✅ **High** | Product search in bot |
| `chatbot_skill_inventory` | Inventory Check Skill | ✅ **High** | Real-time inventory in bot |
| `chatbot_skill_store_hours` | Store Hours Skill | ✅ **Medium** | Hours lookup in bot |
| `chatbot_external_embed` | External Bot Embed | ✅ **In catalog** | $9/mo |
| `chatbot_static_enabled` | Static FAQ Responses | ❌ Core | Basic response engine |
| `chatbot_static_lookup` | Static Lookup Engine | ❌ Core | Basic lookup |
| `chatbot_dynamic_enabled` | Dynamic GPT Responses | ✅ **High** | AI-powered responses — premium |
| `chatbot_shared_dynamic` | Shared Dynamic Engine | ❌ Infra | Platform-managed |
| `chatbot_dedicated` | Dedicated Model Engine | ✅ **High** | Dedicated model — premium |
| `chatbot_lora_finetuned` | LoRA Fine-Tuned Engine | ✅ **Future** | Phase 4 — deferred |
| `chatbot_kb_enabled` | Knowledge Base | ✅ **High** | Structured KB — premium |
| `chatbot_kb_auto_sync` | Auto-Sync Knowledge Base | ✅ **High** | Auto-expand KB |
| `chatbot_kb_gap_report` | Gap Report | ✅ **Medium** | Identify KB gaps |
| `chatbot_kb_product_scoped` | Product-Scoped Knowledge | ✅ **Medium** | Per-product KB |
| `chatbot_kb_rag_retrieval` | RAG Retrieval | ✅ **High** | Semantic search — premium |
| `chatbot_kb_static_faq` | Static FAQ Knowledge Base | ❌ Core | Basic KB |
| `chatbot_widget_enabled` | Widget Embed | ❌ Core | Basic widget |
| `chatbot_widget_embed` | Widget Embed (alt) | ❌ Duplicate | Same as widget_enabled |
| `chatbot_widget_custom_theme` | Widget Custom Theme | ✅ **High** | Custom branding — premium |
| `chatbot_widget_after_hours` | Widget After Hours | ✅ **Medium** | After-hours mode |
| `chatbot_widget_skill_cards` | Widget Skill Cards | ✅ **Medium** | Skill card display |

**Top individual candidates**: `chatbot_dynamic_enabled` ($15/mo), `chatbot_dedicated` ($25/mo), `chatbot_kb_rag_retrieval` ($12/mo), `chatbot_widget_custom_theme` ($8/mo), `chatbot_skill_product_search` ($10/mo), `chatbot_skill_inventory` ($10/mo)

---

### 13. Social Commerce Options (13 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `social_commerce_enabled` | Social Commerce Enabled | ❌ Master gate | Companion-purchased |
| `social_commerce_flexible` | Social Commerce Flexible | ✅ **Flexible** | Domain unlock — $39/mo |
| `social_commerce_social_proof` | Social Proof / UGC | ✅ **In catalog** | $15/mo, 14-day trial |
| `social_commerce_meta_enabled` | Meta Commerce | ✅ **High** | Instagram/Facebook commerce |
| `social_commerce_meta_catalog` | Meta Catalog Sync | ✅ **High** | Sync catalog to Meta |
| `social_commerce_meta_shop` | Meta Shop Setup | ✅ **High** | Setup Meta shop |
| `social_commerce_meta_pixel` | Meta Pixel Tracking | ✅ **Medium** | Pixel tracking |
| `social_commerce_tiktok_enabled` | TikTok Commerce | ✅ **High** | TikTok Shop |
| `social_commerce_tiktok_catalog` | TikTok Catalog Sync | ✅ **High** | Sync catalog to TikTok |
| `social_commerce_tiktok_shop` | TikTok Shop Setup | ✅ **High** | Setup TikTok shop |
| `social_commerce_tiktok_pixel` | TikTok Pixel Tracking | ✅ **Medium** | Pixel tracking |
| `social_commerce_share_buttons` | Social Share Buttons | ✅ **Low** | Basic share buttons |
| `social_commerce_abandoned_cart` | Abandoned Cart Recovery | ✅ **High** | Cart recovery — high value |

**Top individual candidates**: `social_commerce_abandoned_cart` ($15/mo), `social_commerce_meta_enabled` ($20/mo), `social_commerce_tiktok_enabled` ($20/mo), `social_commerce_meta_catalog` ($10/mo), `social_commerce_tiktok_catalog` ($10/mo)

---

### 14. Storefront Options (37 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `storefront_opt_enabled` | Storefront Options Enabled | ❌ Master gate | Companion-purchased |
| `storefront_opt_flexible` | Storefront Options Flexible | ✅ **Flexible** | Domain unlock — $29/mo |
| `storefront_opt_advanced_enabled` | Advanced Group Enabled | ❌ Group toggle | Internal grouping |
| `storefront_opt_category_enabled` | Category Group Enabled | ❌ Group toggle | Internal grouping |
| `storefront_opt_category_product` | Product Categories | ❌ Core | Basic category display |
| `storefront_opt_category_store` | Store Categories | ❌ Core | Basic category display |
| `storefront_opt_enhanced_seo` | Enhanced SEO | ✅ **Medium** | SEO enhancement |
| `storefront_opt_gallery_enabled` | Gallery Group Enabled | ❌ Group toggle | Internal grouping |
| `storefront_opt_hours_enabled` | Hours Group Enabled | ❌ Group toggle | Internal grouping |
| `storefront_opt_hours_display` | Hours Display | ❌ Core | Basic hours |
| `storefront_opt_hours_animated` | Animated Hours | ✅ **Low** | Visual enhancement |
| `storefront_opt_hours_status` | Hours Status | ❌ Core | Open/closed indicator |
| `storefront_opt_image_gallery_5` | 5 Image Gallery | ❌ Tier-differentiated | Gallery limit |
| `storefront_opt_image_gallery_10` | 10 Image Gallery | ✅ **Medium** | More images — upsell |
| `storefront_opt_image_gallery_15` | 15 Image Gallery | ✅ **High** | Most images — premium |
| `storefront_opt_info_enabled` | Info Group Enabled | ❌ Group toggle | Internal grouping |
| `storefront_opt_interactive_maps` | Interactive Maps | ✅ **Medium** | Map display |
| `storefront_opt_layout_classic` | Classic Layout | ❌ Layout variant | Tier-differentiated |
| `storefront_opt_layout_editorial` | Editorial Layout | ❌ Layout variant | Tier-differentiated |
| `storefront_opt_layout_immersive` | Immersive Layout | ❌ Layout variant | Tier-differentiated |
| `storefront_opt_location_display` | Location Display | ❌ Core | Basic location |
| `storefront_opt_map_display` | Map Display | ❌ Core | Basic map |
| `storefront_opt_qr_enabled` | QR Group Enabled | ❌ Group toggle | Internal grouping |
| `storefront_opt_qr_codes_512` | QR 512px | ❌ Tier-differentiated | Basic QR |
| `storefront_opt_qr_codes_1024` | QR 1024px | ✅ **Medium** | Higher resolution |
| `storefront_opt_qr_codes_2048` | QR 2048px | ✅ **High** | Highest resolution — premium |
| `storefront_opt_qr_directory` | Directory QR | ✅ **Medium** | QR for directory |
| `storefront_opt_qr_logo` | Logo QR | ✅ **Medium** | Logo embedding in QR |
| `storefront_opt_qr_product` | Product QR | ✅ **Medium** | QR for products |
| `storefront_opt_qr_store` | Store QR | ✅ **Medium** | QR for store |
| `storefront_opt_recently_viewed` | Recently Viewed | ✅ **Medium** | Recently viewed products |
| `storefront_opt_recommend_enabled` | Recommend Group Enabled | ❌ Group toggle | Internal grouping |
| `storefront_opt_recommend_products` | Product Recommendations | ✅ **High** | AI recommendations — premium |
| `storefront_opt_recommend_store` | Store Recommendations | ✅ **Medium** | Store-level recommendations |
| `storefront_opt_storefront_actions` | Storefront Actions | ✅ **Medium** | Action buttons |
| `storefront_opt_storefront_contact` | Contact Info | ❌ Core | Basic contact |
| `storefront_opt_storefront_social_media` | Social Media Links | ✅ **Medium** | Social links display |

**Top individual candidates**: `storefront_opt_image_gallery_15` ($8/mo), `storefront_opt_qr_codes_2048` ($6/mo), `storefront_opt_recommend_products` ($10/mo), `storefront_opt_interactive_maps` ($5/mo)

---

### 15. Storefront Types (8 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `storefront` | Storefront | ❌ Tier-defining | Fundamental capability |
| `storefront_enabled` | Storefront Enabled | ❌ Master gate | Companion-purchased |
| `storefront_disabled` | Storefront Disabled | ❌ Negative flag | Absence marker |
| `storefront_both_options` | Flexible Storefront Type | ✅ **Flexible** | Domain unlock — $15/mo |
| `storefront_online` | Online Storefront | ❌ Core | Basic storefront type |
| `storefront_retail` | Retail Storefront | ✅ **Medium** | Retail-specific features |
| `storefront_service` | Service Storefront | ✅ **Medium** | Service-specific features |
| `storefront_social` | Social Storefront | ✅ **High** | Social commerce storefront |

**Top individual candidates**: `storefront_social` ($12/mo), `storefront_retail` ($8/mo), `storefront_service` ($8/mo)

---

### 16. Product Types (7 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `product_types_enabled` | Product Types Enabled | ❌ Master gate | Companion-purchased |
| `product_types_disabled` | Product Types Disabled | ❌ Negative flag | Absence marker |
| `product_types_flexible` | Product Types Flexible | ✅ **Flexible** | Domain unlock — $15/mo |
| `product_types_physical` | Physical Products | ❌ Tier-defining | Fundamental capability |
| `product_types_digital` | Digital Products | ✅ **High** | Digital product type |
| `product_types_hybrid` | Hybrid Products | ✅ **Medium** | Hybrid product type |
| `product_types_service` | Service Products | ✅ **Medium** | Service product type |

**Top individual candidates**: `product_types_digital` ($8/mo), `product_types_hybrid` ($6/mo), `product_types_service` ($6/mo)

---

### 17. Organization Options (18 features)

| Feature Key | Name | Sale Candidate | Notes |
|---|---|---|---|
| `org_enabled` | Org Dashboard Enabled | ❌ Master gate | Companion-purchased |
| `org_flexible` | Org Flexible | ✅ **Flexible** | Domain unlock — $49/mo |
| `org_bot_management` | Org Bot Management | ✅ **Medium** | Manage bots across locations |
| `org_branding_control` | Org Branding Control | ✅ **High** | Centralized branding |
| `org_panel_crm_summary` | Org Panel: CRM Summary | ✅ **Low** | Dashboard panel |
| `org_panel_quick_links` | Org Panel: Quick Links | ✅ **Low** | Dashboard panel |
| `org_panel_recommendations` | Org Panel: Recommendations | ✅ **Low** | Dashboard panel |
| `org_panel_system_status` | Org Panel: System Status | ✅ **Low** | Dashboard panel |
| `org_panel_task_checklist` | Org Panel: Task Checklist | ✅ **Low** | Dashboard panel |
| `org_propagation_business_info` | Org Propagation: Business Info | ✅ **Medium** | Propagate info |
| `org_propagation_categories` | Org Propagation: Categories | ✅ **Medium** | Propagate categories |
| `org_propagation_products` | Org Propagation: Products | ✅ **Medium** | Propagate products |
| `org_propagation_settings` | Org Propagation: Settings | ✅ **Medium** | Propagate settings |
| `org_tab_capabilities` | Org Tab: Capabilities | ✅ **Low** | Dashboard tab |
| `org_tab_commerce` | Org Tab: Commerce | ✅ **Low** | Dashboard tab |
| `org_tab_locations` | Org Tab: Locations | ✅ **Low** | Dashboard tab |
| `org_tab_propagation` | Org Tab: Propagation | ✅ **Low** | Dashboard tab |
| `org_tab_team` | Org Tab: Team | ✅ **Low** | Dashboard tab |

**Note**: Org features are primarily relevant for chain/organization tiers. Individual feature sales are lower priority — `org_flexible` is the main offering. `org_branding_control` ($15/mo) is the strongest individual candidate.

---

## Summary: Recommended BSaaS Catalog Expansion

### Tier 1: Flexible Toggles (17 items — highest value, zero code changes)

These unlock all features within a capability domain. Implementation is just adding rows to `bsaas_catalog`.

| Feature Key | Marketing Name | Price | Cycle |
|---|---|---|---|
| `chatbot_flexible` | Chatbot — Full Access | $49/mo | monthly |
| `crm_flexible` | CRM — Full Access | $39/mo | monthly |
| `org_flexible` | Organization — Full Access | $49/mo | monthly |
| `social_commerce_flexible` | Social Commerce — Full Access | $39/mo | monthly |
| `storefront_opt_flexible` | Storefront Options — Full Access | $29/mo | monthly |
| `product_options_flexible` | Product Options — Full Access | $29/mo | monthly |
| `integration_flexible` | Integrations — Full Access | $29/mo | monthly |
| `payment_gateway_flexible` | Payment Gateways — Full Access | $25/mo | monthly |
| `faq_flexible` | FAQ — Full Access | $19/mo | monthly |
| `featured_flexible` | Featured — Full Access | $19/mo | monthly |
| `directory_entry_flexible` | Directory Entry — Full Access | $19/mo | monthly |
| `quickstart_flexible` | Quick Start — Full Access | $19/mo | monthly |
| `fulfillment_flexible` | Fulfillment — Full Access | $15/mo | monthly |
| `commerce_both_options` | Commerce — Full Access | $15/mo | monthly |
| `storefront_both_options` | Storefront Types — Full Access | $15/mo | monthly |
| `product_types_flexible` | Product Types — Full Access | $15/mo | monthly |
| `barcode_flexible` | Barcode Scan — Full Access | $12/mo | monthly |

### Tier 2: High-Value Individual Features (top 20)

| Feature Key | Marketing Name | Price | Cycle | Capability |
|---|---|---|---|---|
| `chatbot_dedicated` | Dedicated Model Engine | $25/mo | monthly | Chatbot |
| `social_commerce_meta_enabled` | Meta Commerce (Instagram/Facebook) | $20/mo | monthly | Social Commerce |
| `social_commerce_tiktok_enabled` | TikTok Commerce | $20/mo | monthly | Social Commerce |
| `social_commerce_abandoned_cart` | Abandoned Cart Recovery | $15/mo | monthly | Social Commerce |
| `integration_gmc_sync` | Advanced GMC Sync | $15/mo | monthly | Integration |
| `chatbot_dynamic_enabled` | Dynamic GPT Responses | $15/mo | monthly | Chatbot |
| `crm_requests_hub` | Requests Hub | $15/mo | monthly | CRM |
| `chatbot_kb_rag_retrieval` | RAG Knowledge Retrieval | $12/mo | monthly | Chatbot |
| `integration_clover` | Clover POS Sync | $12/mo | monthly | Integration |
| `integration_square` | Square POS Sync | $12/mo | monthly | Integration |
| `quickstart_wizard_ai` | AI Quick Start Wizard | $12/mo | monthly | Quickstart |
| `product_options_creation_variants` | Product Variants | $12/mo | monthly | Product Options |
| `storefront_social` | Social Storefront | $12/mo | monthly | Storefront Types |
| `chatbot_skill_product_search` | Product Search Skill | $10/mo | monthly | Chatbot |
| `chatbot_skill_inventory` | Inventory Check Skill | $10/mo | monthly | Chatbot |
| `social_commerce_meta_catalog` | Meta Catalog Sync | $10/mo | monthly | Social Commerce |
| `social_commerce_tiktok_catalog` | TikTok Catalog Sync | $10/mo | monthly | Social Commerce |
| `storefront_opt_recommend_products` | Product Recommendations | $10/mo | monthly | Storefront Options |
| `payment_gateway_paypal` | PayPal Payment Gateway | $10/mo | monthly | Payment Gateway |
| `payment_gateway_square` | Square Payment Gateway | $10/mo | monthly | Payment Gateway |

### Tier 3: Medium-Value Individual Features (top 20)

| Feature Key | Marketing Name | Price | Cycle | Capability |
|---|---|---|---|---|
| `crm_contact_import` | Contact Import | $8/mo | monthly | CRM |
| `crm_dashboard_analytics` | CRM Dashboard Analytics | $12/mo | monthly | CRM |
| `crm_message_templates` | Message Templates | $6/mo | monthly | CRM |
| `crm_message_attachments` | Message Attachments | $5/mo | monthly | CRM |
| `crm_inquiry_auto_response` | Inquiry Auto-Response | $8/mo | monthly | CRM |
| `faq_chatbot_knowledge_base` | Chatbot Knowledge Base | $10/mo | monthly | FAQ |
| `faq_kb_auto_sync` | Auto-Sync Knowledge Base | $8/mo | monthly | FAQ |
| `directory_entry_gallery_enabled` | Directory Gallery | $8/mo | monthly | Directory Entry |
| `directory_entry_layout_premium` | Premium Directory Layout | $10/mo | monthly | Directory Entry |
| `directory_entry_seo_enabled` | Directory SEO | $8/mo | monthly | Directory Entry |
| `fulfillment_delivery` | Delivery Fulfillment | $8/mo | monthly | Fulfillment |
| `fulfillment_shipping` | Shipping Fulfillment | $8/mo | monthly | Fulfillment |
| `barcode_camera` | Camera Barcode Scan | $8/mo | monthly | Barcode Scan |
| `chatbot_widget_custom_theme` | Widget Custom Theme | $8/mo | monthly | Chatbot |
| `quickstart_image_gen` | AI Image Generation | $10/mo | monthly | Quickstart |
| `product_options_creation_video` | Product Video | $8/mo | monthly | Product Options |
| `storefront_opt_image_gallery_15` | 15-Image Gallery | $8/mo | monthly | Storefront Options |
| `storefront_opt_qr_codes_2048` | QR Codes (2048px) | $6/mo | monthly | Storefront Options |
| `product_types_digital` | Digital Products | $8/mo | monthly | Product Types |
| `featured_expiry_monitor` | Featured Expiration Monitor | $8/mo | monthly | Featured |

---

## Implementation Notes

### Flexible Toggle Purchases

**Zero code changes required.** The flow:

1. Add flexible key (e.g., `crm_flexible`) to `bsaas_catalog` via migration
2. Merchant purchases it via the existing `POST /feature-purchase` endpoint
3. `checkCapabilityEngagement` passes (merchant's tier must already have ≥1 CRM feature)
4. `ensureCompanionPurchase` creates zero-cost `crm_enabled` companion if needed
5. `EffectiveCapabilityResolver` merges the purchase into `mergedFeatures`
6. `CrmOptionsResolver` sees `feat.crm_flexible = true` → unlocks all CRM sub-features
7. `invalidateEffectiveCapabilities` ensures immediate effect

### Individual Feature Purchases

Same flow as existing catalog items. Each feature key must:
1. Exist in `features_list`
2. Be linked to `capability_features_list`
3. Be added to `bsaas_catalog` with pricing metadata
4. Pass `checkCapabilityEngagement` (tenant's tier must have ≥1 feature in the same capability type)

### Pricing Strategy

#### Flexible Toggle Pricing Rules

Flexible toggle prices must satisfy **three constraints**:

1. **Above every individual feature price in the same domain** — Flexible is the premium option; no single feature in the domain may cost more. This makes flexible the clear "best value" for merchants who want multiple features.
2. **Below the cost of buying all individual features** — The discount vs. buying everything separately is what makes flexible a bargain. Target 40-60% off the sum of all individual feature prices in the domain.
3. **Below the cheapest tier upgrade that grants flexible for that domain** — The merchant should feel they're getting a deal vs. upgrading their entire tier.

**Example — Chatbot domain**:
- Most expensive individual feature: `chatbot_skill_cross_merchant` at $24/mo
- Sum of all individual chatbot features (if sold separately): ~$120/mo
- Cheapest tier with `chatbot_flexible`: Professional at $199/mo
- **Flexible price: $49/mo** — above the $24/mo max individual, well below $120/mo sum, well below $199/mo tier upgrade

#### Individual Feature Pricing Rule

No individual feature within a domain may be priced higher than that domain's flexible toggle. If an individual feature's standalone value exceeds the flexible price, the flexible price must be raised.

#### Cross-Domain Bundles

Bundles group features across multiple capability types into a single purchasable product at a discount vs. buying each separately. Bundles are a **new product type** in the BSaaS store.

**Bundle types**:

1. **Flexible Bundles** — Multiple flexible toggles packaged together at a steep discount
2. **Feature Bundles** — Curated groups of individual features across domains that solve a specific merchant need
3. **Mixed Bundles** — A flexible toggle + individual features from other domains

**Flexible Bundle Candidates**:

| Bundle Name | Includes | Sum of Individual Flexibles | Bundle Price | Discount | Target Merchant |
|---|---|---|---|---|---|
| Customer Engagement Suite | `chatbot_flexible` + `crm_flexible` + `faq_flexible` | $107/mo | $79/mo | 26% | Merchants who want full bot + CRM + FAQ |
| Commerce Power Pack | `social_commerce_flexible` + `storefront_opt_flexible` + `product_options_flexible` | $97/mo | $69/mo | 29% | Merchants investing in storefront + social selling |
| Operations Bundle | `integration_flexible` + `fulfillment_flexible` + `payment_gateway_flexible` | $69/mo | $49/mo | 29% | Merchants who need all operational integrations |
| Growth Bundle | `featured_flexible` + `directory_entry_flexible` + `quickstart_flexible` | $57/mo | $39/mo | 32% | Merchants focused on visibility and onboarding |
| Storefront Pro Bundle | `storefront_both_options` + `storefront_opt_flexible` + `product_types_flexible` | $59/mo | $39/mo | 34% | Merchants building a full storefront experience |
| Everything Pack | All 17 flexible toggles | $434/mo | $299/mo | 31% | Merchant who wants full platform without Enterprise tier |

**Feature Bundle Candidates** (curated cross-domain):

| Bundle Name | Includes | Sum of Individual Prices | Bundle Price | Discount | Target Merchant |
|---|---|---|---|---|---|
| Social Seller | `social_commerce_meta_enabled` + `social_commerce_tiktok_enabled` + `social_commerce_abandoned_cart` + `storefront_social` | $67/mo | $49/mo | 27% | Merchants selling via Instagram/TikTok |
| AI Assistant | `chatbot_dynamic_enabled` + `chatbot_kb_rag_retrieval` + `quickstart_wizard_ai` + `quickstart_image_gen` | $47/mo | $35/mo | 26% | Merchants who want AI across bot + onboarding |
| POS Pro | `integration_clover` + `integration_square` + `payment_gateway_square` + `fulfillment_shipping` | $38/mo | $29/mo | 24% | Retail merchants with physical + online sales |
| Premium Listings | `directory_entry_gallery_enabled` + `directory_entry_layout_premium` + `directory_entry_seo_enabled` + `featured_expiry_monitor` | $34/mo | $25/mo | 26% | Merchants investing in directory + featured visibility |

**Bundle Pricing Rules**:

1. **Below sum of parts** — Bundle price must be lower than buying each item separately (typically 20-35% discount)
2. **Above the most expensive single item** — Bundle must still be a premium product
3. **Engagement check per domain** — Each feature/flexible in the bundle must pass `checkCapabilityEngagement` for the merchant's tier. If any item fails, the entire bundle is blocked with an upgrade prompt for the specific capability type(s) the merchant isn't engaged in.
4. **Prorated refunds on cancellation** — If a bundle is cancelled, each component is deactivated. No partial bundle persistence.

**Bundle Implementation**:

Bundles require a new `bsaas_bundles` table and purchase-flow changes:

```sql
CREATE TABLE IF NOT EXISTS bsaas_bundles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_key      TEXT        NOT NULL UNIQUE,
  marketing_name  TEXT        NOT NULL,
  description     TEXT,
  price_cents     INTEGER     NOT NULL CHECK (price_cents > 0),
  billing_cycle   VARCHAR(20) NOT NULL DEFAULT 'monthly',
  trial_days      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bsaas_bundle_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       UUID        NOT NULL REFERENCES bsaas_bundles(id) ON DELETE CASCADE,
  feature_key     TEXT        NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (bundle_id, feature_key)
);
```

The purchase flow for bundles would:
1. Validate all `feature_key`s in the bundle exist in `features_list`
2. Run `checkCapabilityEngagement` for each feature — all must pass
3. Charge the bundle price (single Stripe charge)
4. Create one `tenant_feature_purchases` row per feature in the bundle (all linked to the same charge)
5. Call `ensureCompanionPurchase` for each feature's parent gate
6. `invalidateEffectiveCapabilities` once after all purchases are created

The catalog API (`GET /feature-catalog`) would return bundles alongside individual features, with a `type: 'bundle' | 'feature'` field. The frontend would render bundles as grouped cards with their component features listed.

### Migration Template

```sql
-- Add flexible toggles to bsaas_catalog
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES
  ('chatbot_flexible', 'Chatbot — Full Access', 'Unlock all chatbot features: AI responses, dedicated engine, RAG knowledge base, all skills, custom widget themes, and external embed.', 4900, 'monthly', 14, true, 100),
  ('crm_flexible', 'CRM — Full Access', 'Unlock all CRM features: contact import/sync, dashboard analytics, message templates, attachments, ticket management, inquiries, and requests hub.', 3900, 'monthly', 14, true, 101),
  -- ... etc
ON CONFLICT (feature_key) DO NOTHING;
```
