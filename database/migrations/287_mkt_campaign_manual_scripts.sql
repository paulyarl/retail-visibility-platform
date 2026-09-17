-- Migration 287: mkt_campaign_manual_scripts — manual outreach lane
--
-- Operator-authored "play" documents for the Manual tab on the outreach
-- openers workspace. A manual script is a working doc scoped to a campaign:
-- the operator picks a code-defined template (manual-play-templates.ts),
-- edits the fields + script body, and saves. The doc is reloaded whenever
-- the campaign is selected.
--
-- Promotion columns record which shared pipeline rows the doc produced
-- (opener / header / closer / anchor) so the tab can show in-pipeline state
-- and re-promotion creates fresh rows rather than overwriting.
--
-- No CHECK constraints on template_key — the catalog is code-defined and
-- grows without migrations (enum-drift rule, migrations 256/264/270).

CREATE TABLE IF NOT EXISTS mkt_campaign_manual_scripts (
  id                  varchar(40)  PRIMARY KEY,           -- mms-{nanoid}
  campaign_id         varchar(255) NOT NULL,
  template_key        varchar(80)  NOT NULL,
  title               varchar(255) NOT NULL,
  fields              jsonb        NOT NULL DEFAULT '{}'::jsonb,
  script_body         text         NOT NULL,
  promoted_opener_id  varchar(40),
  promoted_anchor_id  varchar(255),
  promoted_header_id  varchar(40),
  promoted_closer_id  varchar(40),
  created_by          varchar(255),
  updated_by          varchar(255),
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_manual_script_campaign_template UNIQUE (campaign_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_mkt_campaign_manual_scripts_campaign
  ON mkt_campaign_manual_scripts (campaign_id);
