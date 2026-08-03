/**
 * Stage transition maps — mirrors the backend `transitionsFor(category, repair_track)`
 * in `MarketingCampaignService.ts:107`. Exported so the board can compute
 * valid next stages client-side without a round-trip. The backend remains
 * authoritative; if these drift, the transition endpoint will reject and
 * the card snaps back.
 */

export type PipelineMode = 'review' | 'recovery';

export const REVIEW_TRANSITIONS: Record<string, string[]> = {
  seek:             ['preview_built', 'dead'],
  preview_built:    ['shown', 'dead'],
  shown:            ['paid', 'lost', 'tenant_onboarded'],
  paid:             ['delivered', 'tenant_onboarded'],
  delivered:        ['retainer_pitched', 'closed', 'tenant_onboarded'],
  retainer_pitched: ['retainer_won', 'closed'],
  retainer_won:     ['lost', 'tenant_onboarded'],
  lost:             ['seek', 'tenant_onboarded'],
  dead:             ['seek', 'tenant_onboarded'],
};

export const RECOVERY_TRANSITIONS: Record<string, string[]> = {
  audit_identified:            ['framework_preview_generated', 'dead'],
  framework_preview_generated: ['outreach_dispatched', 'dead'],
  outreach_dispatched:         ['awaiting_owner_intake', 'dead'],
  awaiting_owner_intake:       ['intake_submitted', 'outreach_dispatched', 'dead'],
  intake_submitted:            ['final_resolution_drafted'],
  final_resolution_drafted:    ['owner_approved'],
  owner_approved:              ['resolved_and_closed'],
  resolved_and_closed:         [],
  dead:                        ['audit_identified'],
};

/** Column order for each pipeline (excludes Queued, which is always first). */
export const REVIEW_COLUMNS = [
  'seek', 'preview_built', 'shown', 'paid', 'delivered',
  'retainer_pitched', 'retainer_won', 'tenant_onboarded',
] as const;

export const RECOVERY_COLUMNS = [
  'audit_identified', 'framework_preview_generated', 'outreach_dispatched',
  'awaiting_owner_intake', 'intake_submitted', 'final_resolution_drafted',
  'owner_approved', 'resolved_and_closed',
] as const;

/** Terminal/closed stages collapsed behind "Show closed" by default. */
export const CLOSED_STAGES = ['lost', 'dead', 'closed', 'resolved_and_closed'];

/**
 * Returns the transition map for the given pipeline mode. Mirrors the
 * backend's `transitionsFor` dispatch rule (review_management / recovery /
 * profile_repair+escalated → recovery).
 */
export function transitionsForPipeline(mode: PipelineMode): Record<string, string[]> {
  return mode === 'recovery' ? RECOVERY_TRANSITIONS : REVIEW_TRANSITIONS;
}

/**
 * Determines which pipeline a campaign belongs to, mirroring the backend's
 * `pipelineFor(category, repair_track)`.
 */
export function pipelineForCampaign(category: string | null | undefined, repairTrack: string | null | undefined): PipelineMode {
  if (category === 'recovery_management') return 'recovery';
  if (category === 'profile_repair' && repairTrack === 'escalated') return 'recovery';
  return 'review';
}
