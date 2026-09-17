-- Migration 159: Operator Playbook Checklists
--
-- Adds three tables that back the Operator Playbook Checklists feature:
--   * mkt_playbook_checklist_steps    — per-playbook ordered step template
--   * mkt_campaign_checklist_progress — per-campaign check-off state (lazy rows)
--   * mkt_playbook_checklist_suggestions — operator feedback queue (add/modify/remove)
--
-- Per docs/LocalBiz/marketing_ops_operator_checklist_sprint_plan.md
-- Sprint — Phase 1 (Data Layer).
--
-- Notes:
--   * No RLS: mkt_* tables are platform-admin scoped global tables (same as
--     mkt_playbook_catalog / mkt_signal_registry). See manual-sql-migration-policy.md
--     §4 "Marketing Ops (mkt_*) namespace exception".
--   * No DB triggers: updated_at is managed by Prisma @updatedAt in app code.
--   * IDs are generated at the app layer via id-generator.ts (pbcs-/cckp-/pbsg- prefixes).
--   * After running: cd apps/api && npx prisma db pull && npx prisma generate.

-- ─── mkt_playbook_checklist_steps (template) ──────────────────────────────

CREATE TABLE IF NOT EXISTS mkt_playbook_checklist_steps (
  id            VARCHAR(255) PRIMARY KEY,
  playbook_id   VARCHAR(255) NOT NULL,
  step_order    INT          NOT NULL,
  title         VARCHAR(255) NOT NULL,
  instructions  TEXT,
  step_type     VARCHAR(30)  NOT NULL DEFAULT 'manual',
  action_config JSONB        NOT NULL DEFAULT '{}',
  is_required   BOOLEAN      NOT NULL DEFAULT true,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_checklist_steps_playbook
    FOREIGN KEY (playbook_id) REFERENCES mkt_playbook_catalog(id) ON DELETE CASCADE
);

-- Guard: step_type must be a known type
ALTER TABLE mkt_playbook_checklist_steps
  DROP CONSTRAINT IF EXISTS chk_checklist_step_type;

ALTER TABLE mkt_playbook_checklist_steps
  ADD CONSTRAINT chk_checklist_step_type
  CHECK (step_type IN ('manual', 'url_check', 'ai_prompt', 'deliverable', 'outreach', 'credentials'));

CREATE INDEX IF NOT EXISTS idx_mkt_playbook_checklist_steps_playbook_order
  ON mkt_playbook_checklist_steps (playbook_id, step_order);
CREATE INDEX IF NOT EXISTS idx_mkt_playbook_checklist_steps_active
  ON mkt_playbook_checklist_steps (playbook_id, is_active);

COMMENT ON TABLE  mkt_playbook_checklist_steps IS 'Per-playbook ordered checklist step template (admin-edited, instantiated implicitly per campaign)';
COMMENT ON COLUMN mkt_playbook_checklist_steps.step_order IS 'Display order; reorder swaps values (same pattern as mkt_playbook_catalog.priority_rank)';
COMMENT ON COLUMN mkt_playbook_checklist_steps.step_type IS 'manual | url_check | ai_prompt | deliverable | outreach | credentials — drives action_config shape and rendered action button';
COMMENT ON COLUMN mkt_playbook_checklist_steps.action_config IS 'Type-specific deep-link config — see sprint plan §5.3. Never stores secret values (credentials type stores a reference label only)';
COMMENT ON COLUMN mkt_playbook_checklist_steps.is_required IS 'Only required steps feed the transition soft gate';
COMMENT ON COLUMN mkt_playbook_checklist_steps.is_active IS 'Deactivate instead of delete to preserve progress history (supersede also deactivates)';

-- ─── mkt_campaign_checklist_progress (per-campaign check-off) ─────────────

CREATE TABLE IF NOT EXISTS mkt_campaign_checklist_progress (
  id           VARCHAR(255) PRIMARY KEY,
  campaign_id  VARCHAR(255) NOT NULL,
  step_id      VARCHAR(255) NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(255),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_checklist_progress_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_checklist_progress_step
    FOREIGN KEY (step_id) REFERENCES mkt_playbook_checklist_steps(id) ON DELETE CASCADE
);

-- One progress row per campaign+step (uncheck sets completed_at = NULL, row kept for audit)
ALTER TABLE mkt_campaign_checklist_progress
  DROP CONSTRAINT IF EXISTS uq_checklist_progress_campaign_step;

ALTER TABLE mkt_campaign_checklist_progress
  ADD CONSTRAINT uq_checklist_progress_campaign_step
  UNIQUE (campaign_id, step_id);

CREATE INDEX IF NOT EXISTS idx_mkt_campaign_checklist_progress_campaign
  ON mkt_campaign_checklist_progress (campaign_id);

COMMENT ON TABLE  mkt_campaign_checklist_progress IS 'Per-campaign check-off state for playbook checklist steps (lazy rows, created on first check-off)';
COMMENT ON COLUMN mkt_campaign_checklist_progress.completed_at IS 'NULL = not completed (or row does not exist). Unchecking sets NULL, row kept for audit trail';
COMMENT ON COLUMN mkt_campaign_checklist_progress.completed_by IS 'Admin user id/email of whoever checked it off';
COMMENT ON COLUMN mkt_campaign_checklist_progress.note IS 'Optional per-completion note (evidence link, result summary)';

-- ─── mkt_playbook_checklist_suggestions (operator feedback queue) ─────────

CREATE TABLE IF NOT EXISTS mkt_playbook_checklist_suggestions (
  id             VARCHAR(255) PRIMARY KEY,
  playbook_id    VARCHAR(255) NOT NULL,
  campaign_id    VARCHAR(255) NOT NULL,
  step_id        VARCHAR(255),
  suggestion_kind VARCHAR(20) NOT NULL,
  position       VARCHAR(20),
  proposed_step  JSONB        NOT NULL,
  rationale      TEXT         NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  submitted_by   VARCHAR(255) NOT NULL,
  reviewed_by    VARCHAR(255),
  reviewed_at    TIMESTAMPTZ,
  review_note    TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_checklist_suggestions_playbook
    FOREIGN KEY (playbook_id) REFERENCES mkt_playbook_catalog(id) ON DELETE CASCADE,
  CONSTRAINT fk_checklist_suggestions_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_checklist_suggestions_step
    FOREIGN KEY (step_id) REFERENCES mkt_playbook_checklist_steps(id) ON DELETE SET NULL
);

-- Guards: suggestion_kind and position enums
ALTER TABLE mkt_playbook_checklist_suggestions
  DROP CONSTRAINT IF EXISTS chk_checklist_suggestion_kind;

ALTER TABLE mkt_playbook_checklist_suggestions
  ADD CONSTRAINT chk_checklist_suggestion_kind
  CHECK (suggestion_kind IN ('add', 'modify', 'remove'));

ALTER TABLE mkt_playbook_checklist_suggestions
  DROP CONSTRAINT IF EXISTS chk_checklist_suggestion_position;

ALTER TABLE mkt_playbook_checklist_suggestions
  ADD CONSTRAINT chk_checklist_suggestion_position
  CHECK (position IS NULL OR position IN ('before', 'after', 'supersede'));

ALTER TABLE mkt_playbook_checklist_suggestions
  DROP CONSTRAINT IF EXISTS chk_checklist_suggestion_status;

ALTER TABLE mkt_playbook_checklist_suggestions
  ADD CONSTRAINT chk_checklist_suggestion_status
  CHECK (status IN ('pending', 'accepted', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_mkt_playbook_checklist_suggestions_queue
  ON mkt_playbook_checklist_suggestions (playbook_id, status);
CREATE INDEX IF NOT EXISTS idx_mkt_playbook_checklist_suggestions_campaign
  ON mkt_playbook_checklist_suggestions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_playbook_checklist_suggestions_step
  ON mkt_playbook_checklist_suggestions (step_id);

COMMENT ON TABLE  mkt_playbook_checklist_suggestions IS 'Operator-submitted suggestions to improve playbook checklist templates (governed feedback loop — operators never edit templates directly)';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.playbook_id IS 'Denormalized from the campaign effective playbook — the review queue is queried per playbook';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.campaign_id IS 'Origin context — reviewers can see the campaign where the efficiency was discovered';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.step_id IS 'Target step for modify/remove, anchor step for add with before/after/supersede. NULL = append-at-end. ON DELETE SET NULL preserves the suggestion if the target step is later deleted';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.suggestion_kind IS 'add | modify | remove';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.position IS 'For add only: before | after | supersede (relative to step_id). NULL = append at end. supersede deactivates the anchor on accept';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.proposed_step IS 'For add: full proposed step { title, instructions, step_type, action_config, is_required }. For modify: sparse field patch (only changed fields). For remove: {}';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.rationale IS 'Operator reasoning — the discovered efficiency. Required: a suggestion without a why is unreviewable';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.status IS 'pending | accepted | rejected';
COMMENT ON COLUMN mkt_playbook_checklist_suggestions.review_note IS 'Reviewer note on accept/reject (esp. rejection reason — visible to submitter)';

-- ─── Verification queries (run manually after applying) ───────────────────
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'mkt_playbook_checklist%' OR tablename = 'mkt_campaign_checklist_progress';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'mkt_playbook_checklist_steps'::regclass;
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'mkt_playbook_checklist_steps';
-- SELECT COUNT(*) FROM mkt_playbook_checklist_steps;  -- expect 0 (no seed data)
