-- 110_crm_task_messages.sql
-- Adds threaded conversation messages to CRM tasks, mirroring crm_ticket_messages.
-- Enables platform staff and tenant users to communicate about tasks until completion.

CREATE TABLE IF NOT EXISTS crm_task_messages (
  id           VARCHAR(255) PRIMARY KEY,
  task_id      VARCHAR(255) NOT NULL,
  author_id    VARCHAR(255) NOT NULL,
  author_type  VARCHAR(20)  NOT NULL DEFAULT 'platform',
  author_name  VARCHAR(255) NOT NULL,
  content      TEXT         NOT NULL,
  is_internal  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Foreign key to crm_tasks with cascade delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_crm_task_messages_task'
  ) THEN
    ALTER TABLE crm_task_messages
      ADD CONSTRAINT fk_crm_task_messages_task
      FOREIGN KEY (task_id) REFERENCES crm_tasks(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK constraint skipped: %', SQLERRM;
END $$;

-- Index for listing messages by task, ordered by creation time
CREATE INDEX IF NOT EXISTS idx_crm_task_messages_task_created
  ON crm_task_messages (task_id, created_at);

-- Enable Row Level Security
ALTER TABLE crm_task_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (mirror crm_ticket_messages pattern)
-- Platform admins can do everything
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'crm_task_messages_admin_all'
  ) THEN
    CREATE POLICY crm_task_messages_admin_all ON crm_task_messages
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()::text
          AND u.role IN ('PLATFORM_ADMIN', 'ADMIN', 'PLATFORM_SUPPORT')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()::text
          AND u.role IN ('PLATFORM_ADMIN', 'ADMIN', 'PLATFORM_SUPPORT')
        )
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Admin policy skipped: %', SQLERRM;
END $$;

-- Tenant users can read messages for their tenant's tasks and create messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'crm_task_messages_tenant_all'
  ) THEN
    CREATE POLICY crm_task_messages_tenant_all ON crm_task_messages
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM crm_tasks t
          JOIN user_tenant_memberships utm ON utm.tenant_id = t.tenant_id
          WHERE t.id = crm_task_messages.task_id
          AND utm.user_id = auth.uid()::text
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM crm_tasks t
          JOIN user_tenant_memberships utm ON utm.tenant_id = t.tenant_id
          WHERE t.id = crm_task_messages.task_id
          AND utm.user_id = auth.uid()::text
        )
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Tenant policy skipped: %', SQLERRM;
END $$;

-- Updated_at trigger (not needed — messages are append-only, no updates expected)
-- But add a basic trigger for consistency with other CRM tables
CREATE OR REPLACE FUNCTION update_crm_task_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = COALESCE(NEW.created_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_task_messages_updated_at ON crm_task_messages;
CREATE TRIGGER trg_crm_task_messages_updated_at
  BEFORE INSERT ON crm_task_messages
  FOR EACH ROW EXECUTE FUNCTION update_crm_task_messages_updated_at();
