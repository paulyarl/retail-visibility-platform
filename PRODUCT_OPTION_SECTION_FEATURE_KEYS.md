# Product Page Section Feature Keys

## For Admin Capability UI Configuration

The following feature keys control tier-gated access to product page sections. Configure these via the Admin Capability UI under the `product_options` capability type.

### New Section Feature Keys (11 total)

| Feature Key | Section Controlled | Description |
|---|---|---|
| `product_opt_recently_viewed` | Recently Viewed Products | Show recently browsed products on product pages |
| `product_opt_qr_codes` | QR Code Sharing | Display scannable QR codes on product pages |
| `product_opt_recommended` | Recommended Products | Show "You might also like" recommendations |
| `product_opt_map_display` | Map Display | Show store map in product actions area |
| `product_opt_location_display` | Location Display | Show store address and location info |
| `product_opt_hours_display` | Hours Display | Show store hours and open/closed status |
| `product_opt_enhanced_seo` | Enhanced SEO | Structured data and meta tags for product pages |
| `product_opt_reviews` | Product Reviews | Display customer reviews on product pages |
| `product_opt_fulfillment` | Fulfillment Options | Show pickup, delivery, and shipping options |
| `product_opt_categories` | Category Display | Show product categories and navigation |
| `product_opt_location_availability` | Location Availability | Show nearby store availability for products |

### Existing Product Options Keys (for reference)

| Feature Key | Controls |
|---|---|
| `product_enabled` | Master enable for product options |
| `product_disabled` | Master disable (overrides enabled) |
| `product_flexible` | Grants all product options (super-tier) |
| `product_physical` | Physical product type |
| `product_digital` | Digital product type |
| `product_hybrid` | Hybrid product type |
| `product_service` | Service product type |
| `product_variant` | Product variants feature |
| `product_gallery` | Product image gallery |
| `product_video` | Product video |
| `product_layout_classic` | Classic product page layout |
| `product_layout_editorial` | Editorial product page layout |
| `product_layout_immersive` | Immersive product page layout |

### Database Columns

Each feature key corresponds to a boolean column on `tenant_product_options_settings`:

```sql
product_opt_recently_viewed    BOOLEAN DEFAULT true
product_opt_qr_codes             BOOLEAN DEFAULT true
product_opt_recommended          BOOLEAN DEFAULT true
product_opt_map_display          BOOLEAN DEFAULT true
product_opt_location_display     BOOLEAN DEFAULT true
product_opt_hours_display        BOOLEAN DEFAULT true
product_opt_enhanced_seo         BOOLEAN DEFAULT true
product_opt_reviews              BOOLEAN DEFAULT true
product_opt_fulfillment          BOOLEAN DEFAULT true
product_opt_categories           BOOLEAN DEFAULT true
product_opt_location_availability BOOLEAN DEFAULT true
```

### Notes

- All new section features default to `true` (enabled) at the merchant preference level.
- Tier gating is enforced by the `product_options` capability features. If a tenant's tier does not have a feature key enabled, the section is hidden regardless of merchant preference.
- `product_flexible` bypasses all individual gates (same pattern as other capabilities).
- Sections are now decoupled from `storefront_options` and controlled independently via `product_options`.
