-- 048: Add per-user CRM read states for persistent unread tracking
-- Replaces localStorage-only activity read tracking in the tenant CRM widget.
-- Scope: activity_feed initially; extensible to alerts, tickets, tasks, inquiries.
-- Apply: execute this SQL against the database, then run prisma db pull && prisma generate.

CREATE TABLE IF NOT EXISTS crm_user_read_states (
  id           TEXT PRIMARY KEY,  -- crmurs-{nanoid}
  user_id      VARCHAR(255) NOT NULL,
  tenant_id    VARCHAR(255) NOT NULL,
  scope        VARCHAR(50) NOT NULL, -- 'activity_feed' | 'alert_feed' | ...
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_user_read_states_unique
  ON crm_user_read_states(user_id, tenant_id, scope);

CREATE INDEX IF NOT EXISTS idx_crm_user_read_states_user_tenant
  ON crm_user_read_states(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_crm_user_read_states_tenant_scope
  ON crm_user_read_states(tenant_id, scope);

ALTER TABLE crm_user_read_states
  ADD CONSTRAINT fk_crm_user_read_states_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_crm_user_read_states_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Verification queries:
-- SELECT * FROM crm_user_read_states LIMIT 1;
-- SELECT tablename FROM pg_tables WHERE tablename = 'crm_user_read_states';
