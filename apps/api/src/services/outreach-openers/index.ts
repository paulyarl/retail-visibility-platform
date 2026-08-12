/**
 * Outreach Opener — barrel export for the core logic modules.
 *
 * Re-exports the deterministic archetype selection, field extraction,
 * prompt building, and quality gate so consumers can import from a
 * single path:
 *   import { selectArchetype, extractFields, buildArchetypePrompt, runQualityGate } from './outreach-openers';
 */

export {
  selectArchetype,
  type ArchetypeCode,
  type ArchetypeSelection,
  type BusinessAnalysisAuditData,
  type NegativeReviewTheme,
  type CombinedReviewMetrics,
  type NapConsistency,
  type WebsiteAudit,
  type PlatformAudit,
} from './archetype-selection';

export {
  extractFields,
  extractA1Fields,
  extractA2Fields,
  extractA3Fields,
  extractA4Fields,
  extractA5Fields,
  type CommonFields,
  type ArchetypeFields,
  type A1Fields,
  type A2Fields,
  type A3Fields,
  type A4Fields,
  type A5Fields,
} from './field-extractors';

export {
  buildArchetypePrompt,
  CLOSE_VARIANTS,
  DEFAULT_CLOSE_VARIANT,
  type CloseVariant,
} from './archetype-prompts';

export { runQualityGate, type QualityGateResult } from './quality-gate';

export {
  HOOK_LIBRARY,
  HOOK_ANGLE_KEYS,
  getHook,
  isValidHookAngle,
  CALL_SCRIPT_VERIFY,
  CALL_SCRIPT_BRIDGE,
  CALL_SCRIPT_ASK,
  CALL_SCRIPT_ASK_DECLINE_FALLBACK,
  CALL_SCRIPT_CLOSE,
  CALL_SCRIPT_OBJECTIONS,
  type HookAngle,
  type HookTemplate,
  type ObjectionRow,
} from './hook-library';
