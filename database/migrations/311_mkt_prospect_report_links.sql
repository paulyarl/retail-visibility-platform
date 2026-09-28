-- Migration 311: Prospect Report short links — mkt_prospect_report_links.
--
-- Owner-facing Business Visibility Report share links get their OWN short-code
-- namespace (spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md §5.2a).
-- Pattern replicates directory_claim_tokens.short_code (6-char, 32-char
-- alphabet, collision-retry) but is a separate table + /r/pr/{code} route —
-- claim codes stay claim-only so a report click can never register as a
-- claim/seed-delivery scan (false attribution).
--
-- One row per share action per channel: the channel lives on the row, so
-- /api/public/r/pr-scan/:code attributes scans to prospect_report_{channel}
-- surfaces without a channel parameter in the URL.
--
--   code                  — 6-char public code (VARCHAR(8), matches the
--                           claim/gallery/intake short_code convention)
--   token                 — the signed prospect-report token this code resolves
--                           to (prospectId.tier.chapterList.flags + HMAC)
--   tier                  — 'free' | 'full', denormalized for analytics
--   chapters              — signed chapter list, denormalized for analytics
--   channel               — 'email'|'text'|'social'|'phone'|'in_person'|'banner'
--   business_prospect_id  — composite report key (denormalized for rollups)
--   campaign_id           — the sibling campaign that minted the share
--
-- Revocation is row delete — the signed token itself stays valid for other
-- codes minted over the same selection (no exp at v1; rotating
-- PROSPECT_REPORT_TOKEN_SECRET invalidates all issued links).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_prospect_report_links (
  id                    VARCHAR(60)   PRIMARY KEY,
  code                  VARCHAR(8)    NOT NULL,
  business_prospect_id  VARCHAR(255)  NOT NULL,
  campaign_id           VARCHAR(255)  NOT NULL,
  token                 VARCHAR(255)  NOT NULL,
  tier                  VARCHAR(10)   NOT NULL,
  chapters              JSONB         NOT NULL,
  channel               VARCHAR(30)   NOT NULL,
  created_by            VARCHAR(255),
  created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT uq_prl_code UNIQUE (code),
  CONSTRAINT chk_prl_tier CHECK (tier IN ('free', 'full')),
  CONSTRAINT chk_prl_channel CHECK (channel IN (
    'email', 'text', 'social', 'phone', 'in_person', 'banner'
  ))
);

-- (code) is indexed by the UNIQUE constraint; no separate index needed.
CREATE INDEX IF NOT EXISTS idx_prl_prospect ON mkt_prospect_report_links (business_prospect_id);
CREATE INDEX IF NOT EXISTS idx_prl_campaign ON mkt_prospect_report_links (campaign_id);

COMMIT;
