-- 056: Add per-customer CRM read states for persistent unread tracking
-- Mirrors crm_user_read_states but keyed on customer_id instead of user_id+tenant_id.
-- Scopes: 'ticket_feed', 'inquiry_feed', 'activity_feed', 'alert_feed'
-- Apply: execute this SQL against the database, then run prisma db pull && prisma generate.

CREATE TABLE IF NOT EXISTS crm_customer_read_states (
  id           TEXT PRIMARY KEY,  -- crmcrs-{nanoid}
  customer_id  VARCHAR(255) NOT NULL,
  scope        VARCHAR(50) NOT NULL, -- 'ticket_feed' | 'inquiry_feed' | 'activity_feed' | 'alert_feed'
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_customer_read_states_unique
  ON crm_customer_read_states(customer_id, scope);

CREATE INDEX IF NOT EXISTS idx_crm_customer_read_states_customer
  ON crm_customer_read_states(customer_id);

ALTER TABLE crm_customer_read_states
  ADD CONSTRAINT fk_crm_customer_read_states_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Verification queries:
-- SELECT * FROM crm_customer_read_states LIMIT 1;
-- SELECT tablename FROM pg_tables WHERE tablename = 'crm_customer_read_states';
