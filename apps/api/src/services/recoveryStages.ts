/**
 * recoveryStages — Recovery Management stage literals + Zod enum
 *
 * The recovery track runs parallel to the review track on the same
 * mkt_campaigns_list.stage column (VARCHAR(50), no DB enum). This module
 * centralizes the 9 recovery stage strings so no caller ever inlines them
 * (R5 in the integration analysis). The category-aware transition table
 * lives in MarketingCampaignService.transitionsFor().
 *
 * Sprint 1 — Recovery Management Engine.
 */

import { z } from 'zod';

// ====================
// STAGE LITERALS
// ====================

export const RECOVERY_STAGES = [
  'audit_identified',
  'framework_preview_generated',
  'outreach_dispatched',
  'awaiting_owner_intake',
  'intake_submitted',
  'final_resolution_drafted',
  'owner_approved',
  'resolved_and_closed',
  'dead',
] as const;

export type RecoveryStage = (typeof RECOVERY_STAGES)[number];

export const recoveryStageSchema = z.enum(RECOVERY_STAGES);

// ====================
// STAGE LABELS (for admin UI + logs)
// ====================

export const RECOVERY_STAGE_LABELS: Record<RecoveryStage, string> = {
  audit_identified: 'Audit Identified',
  framework_preview_generated: 'Framework Preview Generated',
  outreach_dispatched: 'Outreach Dispatched',
  awaiting_owner_intake: 'Awaiting Owner Intake',
  intake_submitted: 'Intake Submitted',
  final_resolution_drafted: 'Final Resolution Drafted',
  owner_approved: 'Owner Approved',
  resolved_and_closed: 'Resolved & Closed',
  dead: 'Dead',
};

// ====================
// GUARD
// ====================

export function isRecoveryStage(value: string): value is RecoveryStage {
  return (RECOVERY_STAGES as readonly string[]).includes(value);
}
