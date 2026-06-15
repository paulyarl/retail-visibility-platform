-- Insert product option feature keys
-- These control storefront product-page display options.

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('product_opt_recently_viewed',     'Recently Viewed Products',    'Show recently browsed products on product pages',       NULL, true, 0, NOW(), NOW()),
  ('product_opt_qr_codes',            'QR Code Sharing',             'Display scannable QR codes on product pages',           NULL, true, 0, NOW(), NOW()),
  ('product_opt_recommended',         'Recommended Products',        'Show "You might also like" recommendations',            NULL, true, 0, NOW(), NOW()),
  ('product_opt_map_display',         'Map Display',                 'Show store map in product actions area',                NULL, true, 0, NOW(), NOW()),
  ('product_opt_location_display',    'Location Display',            'Show store address and location info',                  NULL, true, 0, NOW(), NOW()),
  ('product_opt_hours_display',       'Hours Display',                 'Show store hours and open/closed status',               NULL, true, 0, NOW(), NOW()),
  ('product_opt_enhanced_seo',        'Enhanced SEO',                  'Structured data and meta tags for product pages',       NULL, true, 0, NOW(), NOW()),
  ('product_opt_reviews',             'Product Reviews',               'Display customer reviews on product pages',             NULL, true, 0, NOW(), NOW()),
  ('product_opt_fulfillment',         'Fulfillment Options',           'Show pickup, delivery, and shipping options',           NULL, true, 0, NOW(), NOW()),
  ('product_opt_categories',          'Category Display',              'Show product categories and navigation',                NULL, true, 0, NOW(), NOW()),
  ('product_opt_location_availability', 'Location Availability',       'Show nearby store availability for products',           NULL, true, 0, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at  = NOW();
