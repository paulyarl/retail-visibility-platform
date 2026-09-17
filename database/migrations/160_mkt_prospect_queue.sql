-- Migration 160: Prospect Queue ("Add to Queue")
--
-- Adds the mkt_prospect_queue table that backs the operator-facing Prospect
-- Queue feature: capture businesses from audit surfaces without navigating
-- away, then create campaigns from the queue at the start of the day.
--
-- Per docs/LocalBiz/marketing_ops_prospect_queue_sprint_plan.md
-- Sprint — Phase 1 (Data Layer).
--
-- Notes:
--   * No RLS: mkt_* tables are platform-admin scoped global tables (same as
--     mkt_playbook_catalog / mkt_signal_registry / mkt_playbook_checklist_*).
--     See manual-sql-migration-policy.md §4 "Marketing Ops (mkt_*) namespace
--     exception".
--   * No DB triggers: updated_at is managed by Prisma @updatedAt in app code.
--   * IDs are generated at the app layer via id-generator.ts (pque- prefix,
--     no tenant key — matches the mkt_* global-ID family).
--   * The partial unique index (uq_mkt_prospect_queue_active_business) is a
--     DB-level-only expression/partial index — Prisma does not support these
--     (prisma db pull warns, same as idx_navigation_links_metadata_parent_key).
--     Dedup is mirrored by an app-layer check in MarketingProspectQueueService.
--   * After running: cd apps/api && npx prisma db pull && npx prisma generate.

-- ─── mkt_prospect_queue ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mkt_prospect_queue (
  id                    VARCHAR(255)   PRIMARY KEY,
  business_name         VARCHAR(255)   NOT NULL,
  category              VARCHAR(255),
  city                  VARCHAR(255),
  state                 VARCHAR(255),
  source_kind           VARCHAR(30)    NOT NULL,
  source_scope          VARCHAR(20),
  source_campaign_id    VARCHAR(255),
  source_audit_id       VARCHAR(255),
  source_execution_id   VARCHAR(255),
  audit_date            TIMESTAMPTZ,
  business_snapshot     JSONB          NOT NULL DEFAULT '{}',
  detected_signals      JSONB          NOT NULL DEFAULT '[]',
  signal_count          INT            NOT NULL DEFAULT 0,
  rating                NUMERIC(2,1),
  review_count          INT,
  status                VARCHAR(20)    NOT NULL DEFAULT 'queued',
  priority              VARCHAR(10)    NOT NULL DEFAULT 'normal',
  note                  TEXT,
  queued_by             VARCHAR(255),
  assigned_to           VARCHAR(255),
  assigned_at           TIMESTAMPTZ,
  processed_campaign_id VARCHAR(255),
  processed_at          TIMESTAMPTZ,
  dismissed_reason      VARCHAR(255),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_prospect_queue_source_campaign
    FOREIGN KEY (source_campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE SET NULL,
  CONSTRAINT fk_prospect_queue_processed_campaign
    FOREIGN KEY (processed_campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE SET NULL
);

-- Guards: status, priority, source_kind, source_scope enums
ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_status;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_status
  CHECK (status IN ('queued', 'campaign_created', 'dismissed'));

ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_priority;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_priority
  CHECK (priority IN ('high', 'normal'));

ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_source_kind;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_source_kind
  CHECK (source_kind IN ('category_analysis', 'city_category_audit', 'scan_unmatched', 'manual'));

ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_source_scope;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_source_scope
  CHECK (source_scope IS NULL OR source_scope IN ('category', 'city'));

-- Dedup: one ACTIVE queue entry per business+city+category.
-- Partial unique index — NOT visible to Prisma (expression/partial indexes
-- unsupported by prisma db pull); mirrored by an app-layer check in
-- MarketingProspectQueueService.addToQueue (same approach as AC84).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_prospect_queue_active_business
  ON mkt_prospect_queue (lower(trim(business_name)), lower(trim(city)), lower(trim(coalesce(category, ''))))
  WHERE status = 'queued';

-- List-page sort: status → priority DESC → signal_count DESC → created_at ASC
CREATE INDEX IF NOT EXISTS idx_mkt_prospect_queue_status_sort
  ON mkt_prospect_queue (status, priority DESC, signal_count DESC, created_at ASC);

-- Filter lookups
CREATE INDEX IF NOT EXISTS idx_mkt_prospect_queue_assigned
  ON mkt_prospect_queue (assigned_to);
CREATE INDEX IF NOT EXISTS idx_mkt_prospect_queue_processed_campaign
  ON mkt_prospect_queue (processed_campaign_id);

COMMENT ON TABLE  mkt_prospect_queue IS 'Operator-facing prospect queue — businesses captured from audit surfaces for later campaign creation (pre-campaign, not in pipeline metrics)';
COMMENT ON COLUMN mkt_prospect_queue.source_kind IS 'category_analysis | city_category_audit | scan_unmatched | manual — drives which derive service replays the snapshot at create-campaign time';
COMMENT ON COLUMN mkt_prospect_queue.source_scope IS 'Denormalized parent campaign scope (category | city) captured at queue time — survives parent deletion (FK is SET NULL) and drives the card scope badge';
COMMENT ON COLUMN mkt_prospect_queue.source_campaign_id IS 'Parent (category/city-scope) campaign the prospect was discovered from. ON DELETE SET NULL so parent deletion never wipes the queue entry';
COMMENT ON COLUMN mkt_prospect_queue.source_audit_id IS 'Provenance only — plain column, no FK (audit cleanup must not break the queue)';
COMMENT ON COLUMN mkt_prospect_queue.audit_date IS 'Denormalized created_at of the source audit/execution at queue time. Distinct from created_at (when it was queued). Drives the card audit-date chip and stale-audit tinting';
COMMENT ON COLUMN mkt_prospect_queue.business_snapshot IS 'Full business JSON for scan-derived entries; thin {business_name, rating, review_count, location, detected_signals} for category-analysis entries. This is the runtime payload for create-campaign';
COMMENT ON COLUMN mkt_prospect_queue.detected_signals IS 'Denormalized signal-code array for card badges (crisis vs standard coloring) and filtering — avoids unpacking business_snapshot per row render';
COMMENT ON COLUMN mkt_prospect_queue.signal_count IS 'Denormalized len(detected_signals) for default sort + badges';
COMMENT ON COLUMN mkt_prospect_queue.status IS 'queued | campaign_created | dismissed — queued is the only active state; campaign_created and dismissed are retained for audit trail';
COMMENT ON COLUMN mkt_prospect_queue.priority IS 'high | normal — toggle on the queue page; sort = priority DESC, signal_count DESC, created_at ASC';
COMMENT ON COLUMN mkt_prospect_queue.queued_by IS 'req.user.id at queue time — who captured the prospect (attribution, immutable)';
COMMENT ON COLUMN mkt_prospect_queue.assigned_to IS 'User id of the operator who owns working the prospect. Null = unclaimed. Claim semantics: Assign to me sets req.user.id; reassign/unassign via PATCH. Seeded onto the campaign assigned_to at create-campaign time';
COMMENT ON COLUMN mkt_prospect_queue.processed_campaign_id IS 'Set when a campaign is created from this entry. ON DELETE SET NULL keeps the entry if the campaign is deleted';
