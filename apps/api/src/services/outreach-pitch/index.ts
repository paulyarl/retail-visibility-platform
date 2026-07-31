/**
 * Outreach Pitch — barrel export for the pitch construction modules.
 *
 * Re-exports prompt builders, quality gates, and shared types so consumers
 * can import from a single path:
 *   import { buildHeaderPrompt, runHeaderQualityGate, type ReviewPair } from './outreach-pitch';
 *
 * See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md
 */

export { buildHeaderPrompt, buildCloserPrompt, buildReviewResponsePrompt } from './prompts';

export { runHeaderQualityGate, runCloserQualityGate, type QualityGateResult } from './quality-gates';

export {
  type ReviewPair,
  type AssemblePitchInput,
  type PitchRenderInput,
  renderPitchText,
} from './pitch-renderer';
