-- Migration 164: crm_customer_alert_states table (§5.9)
-- Per-customer read/dismiss state for platform-scope (tenant_id = 'platform')
-- CRM alerts. Needed because broadcast alerts to many marketing customers
-- can't use the shared is_read/is_dismissed on the alert row (one customer
-- reading must not mark it read for all). Only written for alerts with
-- tenant_id = 'platform'; tenant-scope alert behavior is untouched.

BEGIN;

CREATE TABLE IF NOT EXISTS crm_customer_alert_states (
  id           VARCHAR(255)   NOT NULL,
  alert_id     VARCHAR(255)   NOT NULL,
  customer_id  VARCHAR(255)   NOT NULL,
  read_at      TIMESTAMPTZ(6),
  dismissed_at TIMESTAMPTZ(6),
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_crm_customer_alert_states PRIMARY KEY (id),
  CONSTRAINT fk_crm_alert_states_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_alert_states_alert FOREIGN KEY (alert_id)
    REFERENCES crm_alerts(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_customer_alert_states_unique
  ON crm_customer_alert_states(alert_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_crm_alert_states_customer
  ON crm_customer_alert_states(customer_id, dismissed_at);

COMMIT;
