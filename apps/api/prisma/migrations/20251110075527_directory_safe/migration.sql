-- Directory Safe Migration
-- Only creates directory tables/views if base tables exist
-- Idempotent and safe for any database state

-- Directory settings per tenant (only if tenants table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants') THEN
    CREATE TABLE IF NOT EXISTS directory_settings (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      is_published BOOLEAN DEFAULT false,
      seo_description TEXT,
      seo_keywords TEXT[],
      primary_category TEXT,
      secondary_categories TEXT[],
      is_featured BOOLEAN DEFAULT false,
      featured_until TIMESTAMP,
      slug TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(tenant_id),
      UNIQUE(slug)
    );

    -- Indexes for directory_settings
    CREATE INDEX IF NOT EXISTS idx_directory_settings_tenant ON directory_settings(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_directory_settings_published ON directory_settings(is_published) WHERE is_published = true;
    CREATE INDEX IF NOT EXISTS idx_directory_settings_featured ON directory_settings(is_featured) WHERE is_featured = true;
    CREATE INDEX IF NOT EXISTS idx_directory_settings_slug ON directory_settings(slug) WHERE slug IS NOT NULL;
  END IF;
END $$;

-- Featured listings management (only if tenants and users tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants') 
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    CREATE TABLE IF NOT EXISTS directory_featured_listings (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      featured_from TIMESTAMP NOT NULL,
      featured_until TIMESTAMP NOT NULL,
      placement_priority INT DEFAULT 5 CHECK (placement_priority BETWEEN 1 AND 10),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Indexes for directory_featured_listings
    CREATE INDEX IF NOT EXISTS idx_directory_featured_active ON directory_featured_listings(tenant_id, featured_until);
    CREATE INDEX IF NOT EXISTS idx_directory_featured_priority ON directory_featured_listings(placement_priority DESC, featured_from DESC);
  END IF;
END $$;

-- Support notes for directory listings (only if tenants and users tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants') 
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    CREATE TABLE IF NOT EXISTS directory_support_notes (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Index for directory_support_notes
    CREATE INDEX IF NOT EXISTS idx_directory_support_notes_tenant ON directory_support_notes(tenant_id, created_at DESC);
  END IF;
END $$;

-- Directory listings view (only if all required tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants')
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenant_business_profiles')
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    
    CREATE OR REPLACE VIEW directory_listings AS
    SELECT 
      t.id,
      t.id as tenant_id,
      COALESCE(bp.business_name, t.name) as business_name,
      COALESCE(ds.slug, LOWER(REGEXP_REPLACE(COALESCE(bp.business_name, t.name), '[^a-zA-Z0-9]+', '-', 'g'))) as slug,
      bp.address_line1 as address,
      bp.city,
      bp.state,
      bp.postal_code as zip_code,
      bp.phone_number as phone,
      bp.email,
      bp.website,
      bp.latitude,
      bp.longitude,
      COALESCE(ds.primary_category, 'General') as primary_category,
      ds.secondary_categories,
      bp.logo_url,
      ds.seo_description as description,
      bp.hours as business_hours,
      NULL::NUMERIC as rating_avg,
      0 as rating_count,
      (SELECT COUNT(*) FROM inventory_items WHERE tenant_id = t.id AND item_status = 'active') as product_count,
      COALESCE(ds.is_featured, false) as is_featured,
      t.subscription_tier,
      CASE 
        WHEN bp.website IS NOT NULL AND bp.website != '' THEN true
        ELSE false
      END as use_custom_website,
      COALESCE(bp.map_privacy_mode, 'precise') as map_privacy_mode,
      COALESCE(bp.display_map, false) as display_map,
      COALESCE(ds.is_published, false) as is_published,
      t.created_at,
      COALESCE(ds.updated_at, t.updated_at) as updated_at
    FROM tenants t
    LEFT JOIN tenant_business_profiles bp ON bp.tenant_id = t.id
    LEFT JOIN directory_settings ds ON ds.tenant_id = t.id
    WHERE t.subscription_tier != 'google_only';
  END IF;
END $$;

-- Add comments (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'directory_settings') THEN
    COMMENT ON TABLE directory_settings IS 'Directory listing settings and SEO configuration per tenant';
    COMMENT ON COLUMN directory_settings.is_published IS 'Whether the listing is visible in public directory';
    COMMENT ON COLUMN directory_settings.is_featured IS 'Whether the listing has featured placement (derived from active featured_listings)';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'directory_featured_listings') THEN
    COMMENT ON TABLE directory_featured_listings IS 'Audit trail for featured listing placements';
    COMMENT ON COLUMN directory_featured_listings.placement_priority IS 'Priority for featured placement (1-10, higher = more prominent)';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'directory_support_notes') THEN
    COMMENT ON TABLE directory_support_notes IS 'Internal support notes for directory listings';
  END IF;
END $$;
