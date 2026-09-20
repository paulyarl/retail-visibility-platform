import type { Campaign } from '@/services/MarketingOpsService';

/**
 * True when a campaign belongs to the website-gap playbook (PB-08 / A7).
 *
 * PB-08 reuses `campaign_category = 'profile_repair'` (spec §2 — no new CHECK
 * value), but it has NO repair track and NO repair fulfillment: it is a
 * website acquisition/build motion. The profile-repair surfaces
 * (RepairTrackPanel, RepairExecutionCard, the repair-only deliverable types)
 * gate on the category alone, so without this guard they would render on
 * website-gap campaigns — offering a track/package UI that is semantically
 * wrong and that the backend rejects (`repair_track !== 'standard'` →
 * ValidationError).
 *
 * `playbook_code` is the definitive signal (set on sibling creation and on
 * triage acceptance, migration 184); `archetype === 'A7'` is the belt-and-
 * braces fallback for campaigns whose triage resolved to A7.
 */
export function isWebsiteGapCampaign(
  campaign: Pick<Campaign, 'archetype'> & { playbook_code?: string | null } | null | undefined,
): boolean {
  if (!campaign) return false;
  return campaign.playbook_code === 'PB-08' || campaign.archetype === 'A7';
}
