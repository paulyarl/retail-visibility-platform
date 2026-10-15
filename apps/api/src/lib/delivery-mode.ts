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
