-- Directory Implementation - Phase 1
-- Auto-sync directory listings from existing tenant data
-- Leverages existing tenant_business_profile for NAP data

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Main directory listings table
CREATE TABLE directory_listings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES "Tenant"(id) ON DELETE CASCADE,
  
  -- NAP Data (synced from tenant_business_profile)
  business_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(2) DEFAULT 'US',
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  
  -- Geolocation (PostGIS for distance queries)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geolocation GEOGRAPHY(POINT, 4326),
  
  -- Categories (GMB-aligned, synced from tenant_business_profile)
  primary_category VARCHAR(100),
  secondary_categories VARCHAR(100)[] DEFAULT '{}',
  gbp_category_id TEXT REFERENCES gbp_categories(id),
  
  -- Metadata
  logo_url TEXT,
  description TEXT,
  business_hours JSONB,
  features JSONB DEFAULT '{}', -- {delivery: true, pickup: true, etc}
  
  -- Stats (computed from related tables)
  rating_avg DECIMAL(2,1) DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count INT DEFAULT 0 CHECK (rating_count >= 0),
  product_count INT DEFAULT 0 CHECK (product_count >= 0),
  
  -- Premium features
  is_featured BOOLEAN DEFAULT false,
  featured_until TIMESTAMP,
  
  -- Privacy settings (from tenant_business_profile)
  map_privacy_mode VARCHAR(20) DEFAULT 'precise' CHECK (map_privacy_mode IN ('precise', 'neighborhood', 'hidden')),
  display_map BOOLEAN DEFAULT true,
  
  -- Tier-based features (from tenants)
  subscription_tier VARCHAR(50),
  use_custom_website BOOLEAN DEFAULT false,
  
  -- Status
  is_published BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_directory_tenant_id ON directory_listings(tenant_id);
CREATE INDEX idx_directory_slug ON directory_listings(slug);
CREATE INDEX idx_directory_geolocation ON directory_listings USING GIST(geolocation);
CREATE INDEX idx_directory_category ON directory_listings(primary_category);
CREATE INDEX idx_directory_city_state ON directory_listings(city, state);
CREATE INDEX idx_directory_rating ON directory_listings(rating_avg DESC);
CREATE INDEX idx_directory_featured ON directory_listings(is_featured, featured_until) WHERE is_featured = true;
CREATE INDEX idx_directory_published ON directory_listings(is_published, published_at) WHERE is_published = true;

-- Full-text search index
CREATE INDEX idx_directory_search ON directory_listings 
  USING GIN(to_tsvector('english', 
    COALESCE(business_name, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(city, '') || ' ' || 
    COALESCE(state, '')
  ));

-- Function to sync directory listing from tenant
CREATE OR REPLACE FUNCTION sync_directory_listing()
RETURNS TRIGGER AS $$
DECLARE
  v_profile RECORD;
  v_product_count INT;
  v_slug VARCHAR(255);
BEGIN
  -- Only sync if storefront is enabled
  IF NEW.storefront_enabled = true THEN
    -- Get business profile data
    SELECT 
      business_name,
      CONCAT_WS(', ', address_line1, address_line2) as address,
      city,
      state,
      postal_code,
      country_code,
      phone_number,
      email,
      website,
      latitude,
      longitude,
      logo_url,
      hours,
      map_privacy_mode,
      display_map,
      gbp_category_id
    INTO v_profile
    FROM tenant_business_profile
    WHERE tenant_id = NEW.id;
    
    -- Get product count
    SELECT COUNT(*) INTO v_product_count
    FROM "InventoryItem"
    WHERE "tenantId" = NEW.id;
    
    -- Generate slug from business name
    v_slug := LOWER(REGEXP_REPLACE(v_profile.business_name, '[^a-zA-Z0-9]+', '-', 'g'));
    
    -- Insert or update directory listing
    INSERT INTO directory_listings (
      tenant_id,
      business_name,
      slug,
      address,
      city,
      state,
      zip_code,
      country,
      phone,
      email,
      website,
      latitude,
      longitude,
      geolocation,
      logo_url,
      business_hours,
      map_privacy_mode,
      display_map,
      subscription_tier,
      product_count,
      gbp_category_id,
      updated_at
    )
    VALUES (
      NEW.id,
      v_profile.business_name,
      v_slug,
      CONCAT_WS(', ', v_profile.address_line1, v_profile.address_line2),
      v_profile.city,
      v_profile.state,
      v_profile.postal_code,
      COALESCE(v_profile.country_code, 'US'),
      v_profile.phone_number,
      v_profile.email,
      v_profile.website,
      v_profile.latitude,
      v_profile.longitude,
      CASE 
        WHEN v_profile.latitude IS NOT NULL AND v_profile.longitude IS NOT NULL 
        THEN ST_SetSRID(ST_MakePoint(v_profile.longitude, v_profile.latitude), 4326)::geography
        ELSE NULL
      END,
      v_profile.logo_url,
      v_profile.hours,
      COALESCE(v_profile.map_privacy_mode, 'precise'),
      COALESCE(v_profile.display_map, true),
      NEW.subscription_tier,
      v_product_count,
      v_profile.gbp_category_id,
      NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      slug = EXCLUDED.slug,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip_code = EXCLUDED.zip_code,
      country = EXCLUDED.country,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      website = EXCLUDED.website,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      geolocation = EXCLUDED.geolocation,
      logo_url = EXCLUDED.logo_url,
      business_hours = EXCLUDED.business_hours,
      map_privacy_mode = EXCLUDED.map_privacy_mode,
      display_map = EXCLUDED.display_map,
      subscription_tier = EXCLUDED.subscription_tier,
      product_count = EXCLUDED.product_count,
      gbp_category_id = EXCLUDED.gbp_category_id,
      updated_at = NOW();
  ELSE
    -- If storefront is disabled, unpublish the listing
    UPDATE directory_listings
    SET is_published = false, updated_at = NOW()
    WHERE tenant_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-sync on tenant changes
CREATE TRIGGER trigger_sync_directory_on_tenant
  AFTER INSERT OR UPDATE OF "subscriptionTier" ON "Tenant"
  FOR EACH ROW
  EXECUTE FUNCTION sync_directory_listing();

-- Trigger to auto-sync on business profile changes
CREATE OR REPLACE FUNCTION sync_directory_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger the tenant sync function
  PERFORM sync_directory_listing() FROM "Tenant" WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_directory_on_profile
  AFTER INSERT OR UPDATE ON tenant_business_profile
  FOR EACH ROW
  EXECUTE FUNCTION sync_directory_from_profile();

-- Function to update product count
CREATE OR REPLACE FUNCTION update_directory_product_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE directory_listings
  SET 
    product_count = (SELECT COUNT(*) FROM "InventoryItem" WHERE "tenantId" = COALESCE(NEW."tenantId", OLD."tenantId")),
    updated_at = NOW()
  WHERE tenant_id = COALESCE(NEW."tenantId", OLD."tenantId");
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update product count on item changes
CREATE TRIGGER trigger_update_directory_product_count
  AFTER INSERT OR DELETE ON "InventoryItem"
  FOR EACH ROW
  EXECUTE FUNCTION update_directory_product_count();

-- Backfill existing tenants with storefronts
INSERT INTO directory_listings (
  tenant_id,
  business_name,
  slug,
  address,
  city,
  state,
  zip_code,
  country,
  phone,
  email,
  website,
  latitude,
  longitude,
  geolocation,
  logo_url,
  business_hours,
  map_privacy_mode,
  display_map,
  subscription_tier,
  product_count,
  gbp_category_id
)
SELECT 
  t.id,
  tbp.business_name,
  LOWER(REGEXP_REPLACE(tbp.business_name, '[^a-zA-Z0-9]+', '-', 'g')),
  CONCAT_WS(', ', tbp.address_line1, tbp.address_line2),
  tbp.city,
  tbp.state,
  tbp.postal_code,
  COALESCE(tbp.country_code, 'US'),
  tbp.phone_number,
  tbp.email,
  tbp.website,
  tbp.latitude,
  tbp.longitude,
  CASE 
    WHEN tbp.latitude IS NOT NULL AND tbp.longitude IS NOT NULL 
    THEN ST_SetSRID(ST_MakePoint(tbp.longitude, tbp.latitude), 4326)::geography
    ELSE NULL
  END,
  tbp.logo_url,
  tbp.hours,
  COALESCE(tbp.map_privacy_mode, 'precise'),
  COALESCE(tbp.display_map, true),
  t."subscriptionTier",
  (SELECT COUNT(*) FROM "InventoryItem" WHERE tenant_id = t.id),
  tbp.gbp_category_id
FROM "Tenant" t
JOIN tenant_business_profile tbp ON tbp.tenant_id = t.id
WHERE tbp.business_name IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- Create helper function for distance queries
CREATE OR REPLACE FUNCTION calculate_distance_miles(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  RETURN ST_Distance(
    ST_SetSRID(ST_MakePoint(lon1, lat1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)::geography
  ) * 0.000621371; -- Convert meters to miles
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment for documentation
COMMENT ON TABLE directory_listings IS 'Auto-synced directory of all merchant storefronts. Syncs from tenants and tenant_business_profile tables.';
COMMENT ON COLUMN directory_listings.geolocation IS 'PostGIS geography point for distance queries. Auto-synced from tenant_business_profile.';
COMMENT ON COLUMN directory_listings.map_privacy_mode IS 'Privacy mode: precise (exact location), neighborhood (fuzzy), hidden (no map)';
COMMENT ON COLUMN directory_listings.use_custom_website IS 'Professional+ tier feature: link to custom website instead of platform storefront';
