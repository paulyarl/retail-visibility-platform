-- 127_crm_projects.sql
-- Add crm_projects table and project_id columns to crm_tasks, crm_support_tickets, crm_activities
-- Allows internal cross-functional projects to group CRM tasks/tickets without a fake tenant

BEGIN;

-- 1. Create crm_projects table
CREATE TABLE IF NOT EXISTS crm_projects (
  id          VARCHAR(255) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by  VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_projects_status ON crm_projects(status);
CREATE INDEX IF NOT EXISTS idx_crm_projects_created_at ON crm_projects(created_at);

-- 2. Add project_id to crm_tasks and make tenant_id nullable
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);
ALTER TABLE crm_tasks ALTER COLUMN tenant_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm_tasks
    ADD CONSTRAINT fk_crm_tasks_project
    FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_project_id ON crm_tasks(project_id);

DO $$ BEGIN
  ALTER TABLE crm_tasks
    ADD CONSTRAINT chk_crm_tasks_owner
    CHECK (tenant_id IS NOT NULL OR project_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Add project_id to crm_support_tickets and make tenant_id nullable
ALTER TABLE crm_support_tickets ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);
ALTER TABLE crm_support_tickets ALTER COLUMN tenant_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm_support_tickets
    ADD CONSTRAINT fk_crm_tickets_project
    FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_tickets_project_id ON crm_support_tickets(project_id);

DO $$ BEGIN
  ALTER TABLE crm_support_tickets
    ADD CONSTRAINT chk_crm_tickets_owner
    CHECK (tenant_id IS NOT NULL OR project_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Add project_id to crm_activities and make tenant_id nullable
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);
ALTER TABLE crm_activities ALTER COLUMN tenant_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm_activities
    ADD CONSTRAINT fk_crm_activities_project
    FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_activities_project_id ON crm_activities(project_id);

COMMIT;
