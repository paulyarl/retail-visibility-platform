-- Migration 288: mkt_manual_play_templates — operator-authored play templates
--
-- "Save as template" on the Manual tab (outreach openers workspace): an
-- operator can promote a tuned campaign doc (field values + script body)
-- into a reusable dropdown template without a code deploy. The code
-- catalog (manual-play-templates.ts) remains the source of truth for
-- platform-shipped templates; rows here are merged into the template
-- list at read time by ManualOutreachScriptService.
--
-- Spec: docs/LocalBiz/MANUAL_PLAY_TEMPLATE_AUTHORING_SPEC.md
--
-- No CHECK constraints — anchor_type, status, and field roles are
-- validated in code (MANUAL_ANCHOR_TYPES, ManualFieldRole) — same
-- discipline as template_key on mkt_campaign_manual_scripts
-- (enum-drift rule, migrations 256/264/270).

CREATE TABLE IF NOT EXISTS mkt_manual_play_templates (
  id                        varchar(40)  PRIMARY KEY,           -- mptpl-{nanoid8}
  key                       varchar(80)  NOT NULL,              -- op_<slug>, immutable
  label                     varchar(255) NOT NULL,
  description               text         NOT NULL DEFAULT '',
  anchor_type               varchar(40)  NOT NULL DEFAULT 'custom',
  hook_angle                varchar(80),
  suggested_when_signal     varchar(80),
  fields                    jsonb        NOT NULL,              -- ManualPlayField[] snapshot
  script_body               text         NOT NULL,
  status                    varchar(20)  NOT NULL DEFAULT 'active',  -- active | archived
  created_from_campaign_id  varchar(255),
  created_from_template_key varchar(80),
  created_by                varchar(255),
  updated_by                varchar(255),
  created_at                timestamptz  NOT NULL DEFAULT now(),
  updated_at                timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_manual_play_template_key UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS idx_mkt_manual_play_templates_status
  ON mkt_manual_play_templates (status);
