-- Migration 317: Discovery attribution child rows — mkt_discovery_attributions.
--
-- Discovery attribution (bronze reason attribution, competitive weaknesses,
-- INT_* signals, provenance) is prospect-level provenance, but it was only
-- stored as a point-in-time snapshot on the promoted campaign's
-- discovery_context — stamped once at queue promotion / derive time. Two
-- failure modes resulted:
--   1. Sibling campaigns (createSiblingCampaign) don't copy discovery_context,
--      so a PB-xx sibling renders {{discovery_attribution}} empty even though
--      the prospect carries attribution.
--   2. Attribution that arrives AFTER promotion (a second discovery scan
--      attributing an already-queued/converted prospect) never propagates —
--      mergeAttributionOnDedup only fires on an addToQueue dedup hit.
--
-- This table stores attribution as CHILD ROWS (one row per prospect target ×
-- source scan), resolvable by business_prospect_id / campaign_id /
-- queue_entry_id — the same grouping model audits inherit through. Late
-- attribution appends a row; every consumer (prompt renders, seeds, audit
-- fills) resolves the union instead of a stale snapshot.
--
--   business_prospect_id — sibling grouping key (nullable: attribution can be
--                          recorded before the prospect groups)
--   campaign_id          — the business-scope campaign this attribution
--                          promoted into / propagated to
--   queue_entry_id       — the mkt_prospect_queue row that carried it
--                          (pre-promotion propagation target)
--   source_campaign_id   — the discovery scan campaign (scope='intelligence')
--   source_audit_id      — the intelligence_discovery audit the candidate rode
--   source_execution_id  — the prompt execution that produced the scan output
--
-- Merge semantics live in ProspectAttributionService (union-by-key on
-- reason_key / weakness_key / signal / provenance source+url). Repeat imports
-- of the same scan update the existing row rather than duplicating.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_discovery_attributions (
  id                     VARCHAR(60)   PRIMARY KEY,
  business_prospect_id   VARCHAR(255),
  campaign_id            VARCHAR(255),
  queue_entry_id         VARCHAR(255),
  source_campaign_id     VARCHAR(255),
  source_audit_id        VARCHAR(255),
  source_execution_id    VARCHAR(255),
  focus                  VARCHAR(30),
  source_category        VARCHAR(255),
  business_seek_priority VARCHAR(20),
  category_fit           VARCHAR(20),
  identity_confidence    VARCHAR(20),
  location_status        VARCHAR(50),
  discovery_signals      JSONB,
  discovery_provenance   JSONB,
  bronze_attribution     JSONB,
  competitive_weaknesses JSONB,
  discovered_at          TIMESTAMPTZ(6),
  created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dattr_prospect ON mkt_discovery_attributions (business_prospect_id);
CREATE INDEX IF NOT EXISTS idx_dattr_campaign ON mkt_discovery_attributions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_dattr_queue ON mkt_discovery_attributions (queue_entry_id);
CREATE INDEX IF NOT EXISTS idx_dattr_source ON mkt_discovery_attributions (source_campaign_id);

COMMIT;
