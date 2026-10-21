-- 350_storefront_qr_bsaas_pricing.sql
-- Reprice the storefront_qr module around the seed-claim funnel: a claimed
-- seed holds a thin QR taste (classic renderer, directory target, 512px).
-- Individual design options sell à la carte and storefront_qr_flexible is
-- the full-access bundle — repriced to $25/mo because the module is rich
-- in options (styled renderer, logo, dot/corner styles, colors, gradients,
-- hi-res, analytics). Sum-of-parts (~$35) keeps flexible the bundle win.

UPDATE bsaas_catalog
SET price_cents    = 2500,
    marketing_name = 'QR Code - Full Access',
    description    = 'Every QR option: styled renderer, logo embed, all dot/corner styles, custom colors, gradients, all content targets, hi-res downloads, scan analytics.',
    updated_at     = NOW()
WHERE feature_key = 'storefront_qr_flexible';

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, is_private, sort_order)
VALUES
  ('storefront_qr_styled',          'QR Styled Renderer',    'Unlock the styled QR renderer — shaped dots and corner markers instead of the classic grid.',        500, 'monthly', 0, true, false, 10),
  ('storefront_qr_logo',            'QR Logo Embed',         'Embed your business logo inside generated QR codes.',                                                400, 'monthly', 0, true, false, 11),
  ('storefront_qr_custom_colors',   'QR Custom Colors',      'Brand-color QR codes instead of the default palette.',                                               300, 'monthly', 0, true, false, 12),
  ('storefront_qr_gradients',       'QR Gradients',          'Gradient fills for QR dots and corner markers.',                                                     300, 'monthly', 0, true, false, 13),
  ('storefront_qr_dot_styles',      'QR Dot Styles',         'All dot shapes: rounded, dots, classy, classy-rounded, extra-rounded, square.',                      300, 'monthly', 0, true, false, 14),
  ('storefront_qr_corner_styles',   'QR Corner Styles',      'All corner-marker styles for styled QR codes.',                                                      300, 'monthly', 0, true, false, 15),
  ('storefront_qr_analytics',       'QR Scan Analytics',     'See when and how often your QR codes get scanned.',                                                  500, 'monthly', 0, true, false, 16),
  ('storefront_qr_resolution_1024', 'QR 1024px Download',    'Print-quality 1024px QR downloads.',                                                                 200, 'monthly', 0, true, false, 17),
  ('storefront_qr_resolution_2048', 'QR 2048px Download',    'High print-quality 2048px QR downloads.',                                                            300, 'monthly', 0, true, false, 18),
  ('storefront_qr_product',         'QR Product Target',     'Generate QR codes that link to individual products.',                                                200, 'monthly', 0, true, false, 19),
  ('storefront_qr_store',           'QR Storefront Target',  'Generate QR codes that link to your storefront.',                                                    200, 'monthly', 0, true, false, 20)
ON CONFLICT (feature_key) DO UPDATE SET
  price_cents    = EXCLUDED.price_cents,
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  is_active      = EXCLUDED.is_active,
  is_private     = EXCLUDED.is_private,
  updated_at     = NOW();
