-- Directory Phase 1: Foundation Schema
-- Adds directory settings, featured listings, and support notes

-- Directory settings per tenant
CREATE TABLE IF NOT EXISTS directory_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

-- Featured listings management (separate table for audit trail)
CREATE TABLE IF NOT EXISTS directory_featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  featured_from TIMESTAMP NOT NULL,
  featured_until TIMESTAMP NOT NULL,
  placement_priority INT DEFAULT 5 CHECK (placement_priority BETWEEN 1 AND 10),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Support notes for directory listings
CREATE TABLE IF NOT EXISTS directory_support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_directory_settings_tenant ON directory_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directory_settings_published ON directory_settings(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_directory_settings_featured ON directory_settings(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_directory_settings_slug ON directory_settings(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_directory_featured_active ON directory_featured_listings(tenant_id, featured_until);
CREATE INDEX IF NOT EXISTS idx_directory_featured_priority ON directory_featured_listings(placement_priority DESC, featured_from DESC);
CREATE INDEX IF NOT EXISTS idx_directory_support_notes_tenant ON directory_support_notes(tenant_id, created_at DESC);

-- Update directory_listings view to include new fields
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
WHERE t.subscription_tier != 'google_only'; -- Google-only tier doesn't get directory access

-- Comments for documentation
COMMENT ON TABLE directory_settings IS 'Directory listing settings and SEO configuration per tenant';
COMMENT ON TABLE directory_featured_listings IS 'Audit trail for featured listing placements';
COMMENT ON TABLE directory_support_notes IS 'Internal support notes for directory listings';
COMMENT ON COLUMN directory_settings.is_published IS 'Whether the listing is visible in public directory';
COMMENT ON COLUMN directory_settings.is_featured IS 'Whether the listing has featured placement (derived from active featured_listings)';
COMMENT ON COLUMN directory_featured_listings.placement_priority IS 'Priority for featured placement (1-10, higher = more prominent)';
