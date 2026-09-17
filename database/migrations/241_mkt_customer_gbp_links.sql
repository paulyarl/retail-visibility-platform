-- Migration 241: Marketing Customer GBP Links (Identity Bridge)
--
-- Creates the customer↔tenant identity bridge table for the GBP Management
-- Suite. This is the Subsystem 0 foundation: it links a marketing customer
-- to the tenant whose GBP location they are authorized to manage.
--
-- v3 design (per spec §4 Subsystem 0):
--   - Bridge is customer↔tenant only (NO gbp_location_id).
--   - Location resolution is delegated to gbp_locations_list.tenant_id.
--   - This preserves a future 1:N multi-location model without schema change
--     (only portal UX work is needed for multi-location).
--
-- Provisioning: rows are created when a customer claims a GBP-scoped campaign
-- (MarketingCustomerService claim flow). The origin_campaign_id records which
-- campaign created the link for audit purposes.
--
-- Uniqueness: one row per (customer_id, tenant_id). A customer linked to
-- multiple tenants (multi-tenant org) would have multiple rows.

CREATE TABLE IF NOT EXISTS mkt_customer_gbp_links (
  id                 VARCHAR PRIMARY KEY,
  customer_id        VARCHAR NOT NULL,
  tenant_id          VARCHAR NOT NULL,
  origin_campaign_id VARCHAR,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One link per (customer, tenant) pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_customer_gbp_links
  ON mkt_customer_gbp_links (customer_id, tenant_id);

-- Tenant-scoped queries (e.g. "which customers manage this tenant's GBP?").
CREATE INDEX IF NOT EXISTS idx_mkt_customer_gbp_links_tenant
  ON mkt_customer_gbp_links (tenant_id);

-- Customer-scoped queries (e.g. "which tenants does this customer manage?").
CREATE INDEX IF NOT EXISTS idx_mkt_customer_gbp_links_customer
  ON mkt_customer_gbp_links (customer_id);
