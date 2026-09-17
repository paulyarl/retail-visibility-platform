-- Migration 232: Profile Repair Triage Briefing Column
--
-- Stores the AI-produced triage briefing (scope, viability, pitch, risks,
-- track recommendation) directly on the campaign row so it survives track
-- confirmation and page refreshes. Follows the existing pattern of
-- gbp_lookup_cache, cascade_config, directory_profiles — structured AI/lookup
-- output stored as JSONB on mkt_campaigns_list.
--
-- The briefing is written by ProfileRepairPromptService.executeSeekSync and
-- importExternalResult (when targeting the triage template). It includes
-- provenance metadata (_execution_id, _validated) so the "Create Opener from
-- Hook" button can pass the execution ID even after refresh, and the UI can
-- badge best-effort (unvalidated) output.
--
-- Only profile_repair campaigns populate this column; all other campaigns
-- leave it NULL.

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS repair_triage_briefing JSONB;
