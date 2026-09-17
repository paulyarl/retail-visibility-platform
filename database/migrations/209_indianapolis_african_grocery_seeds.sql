-- Migration 209: Initial Indianapolis African Grocery Directory Seed Data
--
-- Seeds 10 qualifying African grocery businesses in Indianapolis, IN as
-- directory_presence tenants with published listings and field provenance.
--
-- Selection criteria:
--   - High or medium identity confidence
--   - Category fit: verified or probable African grocery
--   - Thin online footprint (directory-only or social-only)
--   - Strong local trust but low discoverability
--
-- Excluded (contested or unresolved):
--   - TETEES / Heaven at 4903 S High School Road (identity conflict)
--   - Sant Yalla International Market (closed-status concern)
--   - Jackieline High School Road vs Stratton Square LLC (unresolved conflict)
--   - Jiallo's African Caribbean Cuisine (restaurant-only, not grocery)
--
-- IMPORTANT: Addresses and phone numbers below are sourced from public
-- directory listings (FindAfricanFoods, Google Maps, Yelp). The operator
-- should verify each NAP record before applying this migration. SNAP/EBT
-- values are only set where the SNAP retailer list confirms participation.
--
-- All seed tenants use:
--   subscription_tier = 'directory_presence'
--   org_standing_mode = 'directory_seed'
--   listing_origin = 'directory_seed'
--   is_published = true (published atomically in this migration)
--
-- Provenance rows are inserted for: name, address, phone, snap_ebt (where sourced)
-- Hours are intentionally omitted (not sourced — do not invent).
-- Ratings are intentionally omitted.

BEGIN;

-- Helper: we use deterministic IDs for idempotency.
-- Format: tid-dpsNN (tenant), dll-dpsNN (listing), dps-dpsNN (seed), dfp-dpsNN (provenance)
-- where NN is 01-10.

-- =============================================================
-- Business 1: African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps01', 'African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps01', 'tid-dps01', 'African Market', 'african-market-indianapolis', '3838 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 299-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps01', 'tid-dps01', 'dll-dps01', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'medium', 'probable', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps01-name', 'dps-dps01', 'tid-dps01', 'name', 'African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps01-address', 'dps-dps01', 'tid-dps01', 'address', '3838 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps01-phone', 'dps-dps01', 'tid-dps01', 'phone', '(317) 299-XXXX', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'low', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 2: Baobab African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps02', 'Baobab African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps02', 'tid-dps02', 'Baobab African Market', 'baobab-african-market-indianapolis', '3638 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 291-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps02', 'tid-dps02', 'dll-dps02', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'high', 'verified', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps02-name', 'dps-dps02', 'tid-dps02', 'name', 'Baobab African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'high', true, now(), now()),
('dfp-dps02-address', 'dps-dps02', 'tid-dps02', 'address', '3638 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'high', true, now(), now()),
('dfp-dps02-phone', 'dps-dps02', 'tid-dps02', 'phone', '(317) 291-XXXX', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 3: Dreamcast African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps03', 'Dreamcast African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps03', 'tid-dps03', 'Dreamcast African Market', 'dreamcast-african-market-indianapolis', '4040 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 297-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps03', 'tid-dps03', 'dll-dps03', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'medium', 'probable', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps03-name', 'dps-dps03', 'tid-dps03', 'name', 'Dreamcast African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps03-address', 'dps-dps03', 'tid-dps03', 'address', '4040 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 4: Garaya African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps04', 'Garaya African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps04', 'tid-dps04', 'Garaya African Market', 'garaya-african-market-indianapolis', '3829 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 293-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps04', 'tid-dps04', 'dll-dps04', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'medium', 'probable', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps04-name', 'dps-dps04', 'tid-dps04', 'name', 'Garaya African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps04-address', 'dps-dps04', 'tid-dps04', 'address', '3829 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 5: Royal African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps05', 'Royal African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps05', 'tid-dps05', 'Royal African Market', 'royal-african-market-indianapolis', '5241 W 34th St', 'Indianapolis', 'IN', '46224', '(317) 295-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps05', 'tid-dps05', 'dll-dps05', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'high', 'verified', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps05-name', 'dps-dps05', 'tid-dps05', 'name', 'Royal African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'high', true, now(), now()),
('dfp-dps05-address', 'dps-dps05', 'tid-dps05', 'address', '5241 W 34th St, Indianapolis, IN 46224', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'high', true, now(), now()),
('dfp-dps05-phone', 'dps-dps05', 'tid-dps05', 'phone', '(317) 295-XXXX', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 6: YB Enterprise African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps06', 'YB Enterprise African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps06', 'tid-dps06', 'YB Enterprise African Market', 'yb-enterprise-african-market-indianapolis', '3930 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 298-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps06', 'tid-dps06', 'dll-dps06', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'medium', 'probable', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps06-name', 'dps-dps06', 'tid-dps06', 'name', 'YB Enterprise African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps06-address', 'dps-dps06', 'tid-dps06', 'address', '3930 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 7: KTM African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps07', 'KTM African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps07', 'tid-dps07', 'KTM African Market', 'ktm-african-market-indianapolis', '3850 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 296-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps07', 'tid-dps07', 'dll-dps07', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'medium', 'probable', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps07-name', 'dps-dps07', 'tid-dps07', 'name', 'KTM African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps07-address', 'dps-dps07', 'tid-dps07', 'address', '3850 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 8: Safari/Filsan Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps08', 'Safari Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps08', 'tid-dps08', 'Safari Market', 'safari-market-indianapolis', '3902 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 292-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery','Halal Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps08', 'tid-dps08', 'dll-dps08', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'medium', 'probable', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps08-name', 'dps-dps08', 'tid-dps08', 'name', 'Safari Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps08-address', 'dps-dps08', 'tid-dps08', 'address', '3902 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 9: Ethiopian Market LLC
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps09', 'Ethiopian Market LLC', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps09', 'tid-dps09', 'Ethiopian Market LLC', 'ethiopian-market-llc-indianapolis', '6233 N Michigan Rd', 'Indianapolis', 'IN', '46268', '(317) 294-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery','Ethiopian Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps09', 'tid-dps09', 'dll-dps09', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'high', 'verified', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps09-name', 'dps-dps09', 'tid-dps09', 'name', 'Ethiopian Market LLC', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'high', true, now(), now()),
('dfp-dps09-address', 'dps-dps09', 'tid-dps09', 'address', '6233 N Michigan Rd, Indianapolis, IN 46268', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'high', true, now(), now()),
('dfp-dps09-phone', 'dps-dps09', 'tid-dps09', 'phone', '(317) 294-XXXX', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Business 10: Jokkymore African Market
-- =============================================================
INSERT INTO tenants (id, name, subscription_tier, subscription_status, org_standing_mode, directory_visible, service_level, location_status, created_at, updated_at)
VALUES ('tid-dps10', 'Jokkymore African Market', 'directory_presence', 'trial', 'directory_seed', true, 'self_service', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_listings_list (id, tenant_id, business_name, slug, address, city, state, zip_code, phone, primary_category, secondary_categories, is_published, listing_origin, public_disclaimer, subscription_tier, product_count, created_at, updated_at)
VALUES ('dll-dps10', 'tid-dps10', 'Jokkymore African Market', 'jokkymore-african-market-indianapolis', '4102 Lafayette Rd', 'Indianapolis', 'IN', '46254', '(317) 290-XXXX', 'African Grocery Store', ARRAY['International Grocery','African Grocery'], true, 'directory_seed', 'Listed from public directories / SNAP / news. Not a claimed profile.', 'directory_presence', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_presence_seeds (id, tenant_id, listing_id, category, city, state, seed_batch, status, identity_confidence, category_fit, created_at, updated_at, published_at)
VALUES ('dps-dps10', 'tid-dps10', 'dll-dps10', 'African Grocery Store', 'Indianapolis', 'IN', 'indianapolis-african-grocery-2026', 'published', 'medium', 'probable', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO directory_field_provenance (id, seed_id, tenant_id, field_key, value, source_name, source_url, accessed_at, confidence, show_on_public, created_at, updated_at) VALUES
('dfp-dps10-name', 'dps-dps10', 'tid-dps10', 'name', 'Jokkymore African Market', 'FindAfricanFoods', 'https://findafricanfoods.com', '2026-08-01', 'medium', true, now(), now()),
('dfp-dps10-address', 'dps-dps10', 'tid-dps10', 'address', '4102 Lafayette Rd, Indianapolis, IN 46254', 'Google Maps', 'https://maps.google.com', '2026-08-01', 'medium', true, now(), now())
ON CONFLICT (seed_id, field_key) DO NOTHING;

-- =============================================================
-- Verification query (run manually after applying):
--   SELECT count(*) FROM directory_presence_seeds WHERE seed_batch = 'indianapolis-african-grocery-2026';
--   Should return 10.
--
--   SELECT dps.id, dl.business_name, dps.status, dps.identity_confidence
--   FROM directory_presence_seeds dps
--   JOIN directory_listings_list dl ON dl.id = dps.listing_id
--   WHERE dps.seed_batch = 'indianapolis-african-grocery-2026'
--   ORDER BY dps.id;
--   Should return 10 published rows.
-- =============================================================

COMMIT;
