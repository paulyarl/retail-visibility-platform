/**
 * Outreach Follow-Up — barrel export for the core logic modules.
 *
 * Re-exports the prompt builder, quality gate, and types so consumers
 * can import from a single path:
 *   import { buildFollowUpPrompt, runFollowUpQualityGate } from './outreach-followups';
 */

export {
  buildFollowUpPrompt,
  type FollowUpType,
  type FollowUpDataDiff,
} from './followup-prompts';

export {
  runFollowUpQualityGate,
  type FollowUpQualityGateResult,
} from './followup-quality-gate';
