-- Migration 162: mkt_customer_branding table (§5.6)
-- Marketing ops customer receipt/QR branding parity with tenants.
-- One row per customer: logo_url, asset_url (QR destination), brand_color.

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_customer_branding (
  id           VARCHAR(255)   NOT NULL,
  customer_id  VARCHAR(255)   NOT NULL,
  logo_url     VARCHAR(500),
  asset_url    VARCHAR(500),
  brand_color  VARCHAR(7),
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_mkt_customer_branding PRIMARY KEY (id),
  CONSTRAINT fk_mkt_customer_branding_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS mkt_customer_branding_customer_id_unique
  ON mkt_customer_branding(customer_id);

CREATE INDEX IF NOT EXISTS idx_mkt_customer_branding_customer
  ON mkt_customer_branding(customer_id);

COMMIT;
