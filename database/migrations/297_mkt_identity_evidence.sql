-- Migration 297: mkt_identity_evidence — operator-entered ledger sources
--
-- The Identity tab (campaign detail → IdentityPacketCard) renders a source
-- ledger behind the seed decision. Every ledger row is DERIVED from an audit,
-- the owner website, audit corroboration sources, attribute chips, or
-- directory_field_provenance — so a business with no audit yet scores 0 on
-- both axes with an empty ledger (common right after the prospect call).
--
-- This table is the missing write path: the operator records a source as
-- evidence becomes available ("called the owner, they confirmed the address";
-- "found the GBP page"; "checked the SNAP retailer list") and the Identity
-- Packet picks it up on the next assembly.
--
-- Scope: business_prospect_id when the campaign belongs to a prospect group
-- (siblings for the same business share one ledger), else campaign_id. At
-- least one must be set — the packet resolves the same scope at read time.
--
-- Owner identity: a row may also carry the owner's name / phone / email. The
-- owner is NOT an identity-scoring field (it does not corroborate NAP), but it
-- is the source for owner outreach and is expensive to re-gather — so it is
-- captured on the same row (provenance comes free: which source produced the
-- contact, when, and how confident we are) and reused: the Identity Packet
-- returns the newest owner contact, and IdentityEvidenceService back-fills the
-- prospect group's campaign records (owner_names / phones / email / phone)
-- when they are empty — never overwriting a value already on file.
--
-- Mirror: on write, when the campaign has a linked primary seed, the
-- corroborated fields are mirrored into directory_field_provenance
-- (INSERT ... ON CONFLICT DO NOTHING — never clobbers stronger evidence) so
-- the public listing and the seed intelligence report inherit the source.
--
-- Enum-sync discipline (migrations 256/264/270/289): tier, evidence_state and
-- corroborates are CHECK-constrained. IdentitySourceTier / IdentityEvidenceState
-- / IdentityFieldKey live in apps/api/src/services/directory/identityScoring.ts;
-- adding a member there requires dropping + re-adding the CHECK here.
-- apps/api/src/services/__tests__/IdentityEvidenceService.test.ts asserts parity.
--
-- Idempotent and self-healing: the columns are also declared as
-- ADD COLUMN IF NOT EXISTS and each constraint is added inside a guarded DO
-- block, so re-running this file repairs a table created by an earlier
-- revision of it (CREATE TABLE IF NOT EXISTS alone would not).

CREATE TABLE IF NOT EXISTS mkt_identity_evidence (
  id                    varchar(60)  PRIMARY KEY,        -- idev-{nanoid8}
  campaign_id           varchar(255),                    -- campaign it was captured on
  business_prospect_id  varchar(255),                    -- sharing scope when known
  source_name           varchar(200) NOT NULL,
  source_url            text,
  tier                  varchar(40)  NOT NULL DEFAULT 'secondary_aggregator',
  independence_group    varchar(120),                    -- echo-discount group; defaults to a slug of source_name
  evidence_state        varchar(40)  NOT NULL DEFAULT 'observed',
  corroborates          text[]       NOT NULL DEFAULT '{}',  -- IdentityFieldKey[]
  owner_name            varchar(255),                       -- owner contact (not scored; reused for outreach)
  owner_phone           varchar(40),
  owner_email           varchar(255),
  accessed_at           date,
  notes                 text,
  created_by            varchar(255),
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

-- Repair path for a table created by an earlier revision of this migration.
ALTER TABLE mkt_identity_evidence
  ADD COLUMN IF NOT EXISTS campaign_id          varchar(255),
  ADD COLUMN IF NOT EXISTS business_prospect_id varchar(255),
  ADD COLUMN IF NOT EXISTS source_url           text,
  ADD COLUMN IF NOT EXISTS tier                 varchar(40)  NOT NULL DEFAULT 'secondary_aggregator',
  ADD COLUMN IF NOT EXISTS independence_group   varchar(120),
  ADD COLUMN IF NOT EXISTS evidence_state       varchar(40)  NOT NULL DEFAULT 'observed',
  ADD COLUMN IF NOT EXISTS corroborates         text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_name           varchar(255),
  ADD COLUMN IF NOT EXISTS owner_phone          varchar(40),
  ADD COLUMN IF NOT EXISTS owner_email          varchar(255),
  ADD COLUMN IF NOT EXISTS accessed_at          date,
  ADD COLUMN IF NOT EXISTS notes                text,
  ADD COLUMN IF NOT EXISTS created_by           varchar(255),
  ADD COLUMN IF NOT EXISTS created_at           timestamptz  NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz  NOT NULL DEFAULT now();

-- Constraints (guarded — ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_identity_evidence_scope') THEN
    ALTER TABLE mkt_identity_evidence
      ADD CONSTRAINT chk_identity_evidence_scope CHECK (
        campaign_id IS NOT NULL OR business_prospect_id IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_identity_evidence_tier') THEN
    ALTER TABLE mkt_identity_evidence
      ADD CONSTRAINT chk_identity_evidence_tier CHECK (
        tier IN (
          'authoritative',
          'first_party',
          'major_aggregator',
          'secondary_aggregator',
          'inferred'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_identity_evidence_state') THEN
    ALTER TABLE mkt_identity_evidence
      ADD CONSTRAINT chk_identity_evidence_state CHECK (
        evidence_state IN (
          'confirmed',
          'observed',
          'probable',
          'conflicting',
          'not_found_during_discovery',
          'not_checked',
          'owner_confirmed',
          'owner_corrected',
          'owner_disputed'
        )
      );
  END IF;

  -- A source must carry something: a corroborated field, or owner contact
  -- (the "I have the owner's cell but haven't confirmed the NAP yet" case).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_identity_evidence_content') THEN
    ALTER TABLE mkt_identity_evidence
      ADD CONSTRAINT chk_identity_evidence_content CHECK (
        array_length(corroborates, 1) >= 1
        OR owner_name IS NOT NULL
        OR owner_phone IS NOT NULL
        OR owner_email IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_identity_evidence_corroborates') THEN
    ALTER TABLE mkt_identity_evidence
      ADD CONSTRAINT chk_identity_evidence_corroborates CHECK (
        corroborates <@ ARRAY[
          'name',
          'address',
          'phone',
          'website',
          'hours',
          'primary_category',
          'snap_ebt',
          'attributes'
        ]::text[]
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mkt_identity_evidence_campaign
  ON mkt_identity_evidence (campaign_id);

CREATE INDEX IF NOT EXISTS idx_mkt_identity_evidence_prospect
  ON mkt_identity_evidence (business_prospect_id);
