/**
 * Delivery-mode recommendation — DFY vs DIY, from the prospect's team signal.
 *
 * The profile-repair lane's `repair_fulfillment.mode` (which A8 rides) and
 * PB-08's `playbook_decision.delivery_mode` are the same fork:
 *
 *   DFY — the operator/platform executes (delegated access, fix sheets)
 *   DIY — the owner or their team executes from the same benchmarked blueprint
 *
 * Which lane fits is a capacity question: does the prospect have anyone to
 * execute with? That is exactly what the Outreach Prep worksheet's
 * `team_signal` records, settled during the walk-in or call. So the mode does
 * not have to be a blank field the operator guesses at — it can be *suggested*.
 *
 * Advisory only. The operator sets the mode; this never writes one.
 *
 * Pure — no I/O, no clock.
 */

export type DeliveryMode = 'dfy' | 'diy';

/** The worksheet's team-signal vocabulary (`mkt_outreach_intelligence`). */
export type TeamSignal = 'sole_owner' | 'family_team' | 'small_staff' | 'unknown';

export interface DeliveryModeRecommendation {
  mode: DeliveryMode;
  /**
   * `strong` — capacity decides it (a sole owner has nobody to delegate to).
   * `lean` — both lanes are genuinely viable and the team is the lean, not the
   * verdict; the owner's preference settles it.
   */
  strength: 'strong' | 'lean';
  /** One line the operator can read aloud or act on. */
  reason: string;
}

/**
 * What each lane means for the REVIEW lane (PB-02 / A1 review responses).
 *
 * The dfy/diy vocabulary is shared with the repair and website lanes, but the
 * division of labour differs per lane — so each lane names its own split rather
 * than assuming the repair package's.
 *
 *   DIY — the platform obtains the reviews and drafts the responses (with an
 *         analyst), then hands them to the prospect, who posts them.
 *   DFY — the platform posts the responses on the owner's behalf, on delegated
 *         access.
 */
export const REVIEW_DELIVERY_LANES: Record<DeliveryMode, string> = {
  diy:
    'diy — the platform obtained the reviews and drafted the responses; the OWNER posts them. '
    + 'Write each response as finished copy the owner can paste in, with no platform-side action implied.',
  dfy:
    'dfy — the platform posts the responses on the OWNER\'S behalf on delegated access. '
    + 'Write each response as ready-to-publish copy; the owner takes no action.',
};

/**
 * The one-line lane brief for the review lane's drafting prompt, or '' when the
 * lane is unsettled (the draft then carries no delivery instruction).
 */
export function reviewDeliveryBrief(mode?: string | null): string {
  return mode === 'dfy' || mode === 'diy' ? REVIEW_DELIVERY_LANES[mode] : '';
}

/**
 * What each lane means for the RECOVERY lane (PB-04 / A2 — BBB complaints,
 * suspensions, ownership disputes, reinstatement appeals).
 *
 * Same shape as the review lane, one step further along the same road: the
 * platform produces the written case either way, and the fork is who *files* it.
 *
 *   DIY — the platform drafted the resolution / appeal; the OWNER submits it.
 *   DFY — the platform files it on the owner's behalf, on delegated access.
 */
export const RECOVERY_DELIVERY_LANES: Record<DeliveryMode, string> = {
  diy:
    'diy — the platform drafted the resolution and appeal; the OWNER submits them. '
    + 'Write the package as finished copy the owner can send, with no platform-side action implied.',
  dfy:
    'dfy — the platform files the resolution and appeal on the OWNER\'S behalf on delegated access. '
    + 'Write the package as ready-to-file copy; the owner takes no action.',
};

/** The one-line lane brief for the recovery lane's drafting prompt, or ''. */
export function recoveryDeliveryBrief(mode?: string | null): string {
  return mode === 'dfy' || mode === 'diy' ? RECOVERY_DELIVERY_LANES[mode] : '';
}

/**
 * Recommend a delivery lane from the team signal.
 *
 *   sole_owner                → DFY  (strong — no one to execute in-house)
 *   family_team | small_staff → DIY  (lean — the blueprint can be run in-house)
 *   unknown | null            → null (not settled — ask in the meeting)
 */
export function recommendDeliveryMode(
  teamSignal?: string | null,
): DeliveryModeRecommendation | null {
  switch (teamSignal) {
    case 'sole_owner':
      return {
        mode: 'dfy',
        strength: 'strong',
        reason: 'Sole owner — no one to execute the fixes in-house, so the platform should.',
      };
    case 'family_team':
      return {
        mode: 'diy',
        strength: 'lean',
        reason: 'Family team — the blueprint can be run in-house; DFY stays available.',
      };
    case 'small_staff':
      return {
        mode: 'diy',
        strength: 'lean',
        reason: 'Small staff — someone can run the blueprint in-house; DFY stays available.',
      };
    default:
      return null;
  }
}
