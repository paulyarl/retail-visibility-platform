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
  type CommonFields,
  type ArchetypeFields,
  type A1Fields,
  type A2Fields,
  type A3Fields,
  type A4Fields,
} from './field-extractors';

export { buildArchetypePrompt } from './archetype-prompts';

export { runQualityGate, type QualityGateResult } from './quality-gate';
