-- Migration 285: Market Intel Unlocks
--
-- Per-business (or per-category/city) unlock records for the Market Intel
-- sidebar. A row grants the purchasing tenant full content + PDF download
-- for the surface. Owner-claim unlocks are free (recorded when a claimed
-- owner verifies ownership of a seed).
--
-- See:
--   docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§9.1)
--   apps/api/src/services/MarketIntelAccessService.ts
--
-- surface_key formats:
--   place  → business slug
--   category → {category_key}:{city}:{state} (city '__all__' for national)
--   city   → {city}:{state}
-- owner_claim is only valid on 'place' surfaces.
--
-- tenant_id is the purchasing entity (must be a tenant to buy); customer_id
-- is the auth identity who performed the purchase. Owner-claim unlocks
-- record the seed's tenant_id (claimed owners are tenant owners).
--
-- recordUnlock UPSERTs on the unique key — a second purchase or re-claim
-- updates unlocked_at/payment_intent_id rather than violating the constraint.

CREATE TABLE IF NOT EXISTS market_intel_unlocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(255) NOT NULL REFERENCES tenants(id),
  customer_id       VARCHAR(255) NOT NULL REFERENCES customers(id),
  surface_type      TEXT NOT NULL CHECK (surface_type IN ('place', 'category', 'city')),
  surface_key       TEXT NOT NULL,
  unlock_type       TEXT NOT NULL CHECK (unlock_type IN ('single_report', 'subscription', 'owner_claim')),
  payment_intent_id TEXT,
  unlocked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, surface_type, surface_key, unlock_type)
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_market_intel_unlocks_tenant ON market_intel_unlocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_market_intel_unlocks_customer ON market_intel_unlocks(customer_id);
CREATE INDEX IF NOT EXISTS idx_market_intel_unlocks_surface ON market_intel_unlocks(surface_type, surface_key);

-- Enable RLS per table convention (service-role policy)
ALTER TABLE market_intel_unlocks ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY market_intel_unlocks_service_policy
    ON market_intel_unlocks
    FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
