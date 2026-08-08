/**
 * Triage Engine — barrel export (Sprint 2A pivot).
 *
 * Consumers import from a single path:
 *   import { extractSignals, evaluateTriage, ruleMatches } from '../services/triage';
 *
 * The engine input is SignalCode[] (Sprint 2A). NormalizedSignals is
 * extractor-internal only.
 */

// Signal taxonomy (Sprint 2A §2A.1)
export {
  KNOWN_SIGNAL_CODES,
  SIGNAL_FAMILIES,
  FAMILY_LABELS,
  SIGNAL_LABELS,
  DETECTION_SOURCES,
  signalFamily,
  isRepairSignal,
  isReviewSignal,
  isCrisisSignal,
  isVisualSignal,
  isKnownSignalCode,
  signalLabel,
  invalidateSignalRegistryCache,
  getSignalRegistryCache,
  setSignalRegistryCache,
} from './signal-taxonomy';

export type {
  SignalCode,
  SignalFamily,
  DetectionSource,
  SignalRegistryRow,
} from './signal-taxonomy';

// Signal extractor (emits SignalCode[])
export {
  extractSignals,
  labelSignals,
  filterKnownSignals,
} from './signal-extractor';

// Triage engine (generic DSL evaluator)
export {
  evaluateTriage,
  evaluateAllMatchingPlaybooks,
  ruleMatches,
  fallbackRecommendation,
} from './TriageEngineService';

export type {
  NormalizedSignals,
  TriageRecommendation,
  DetectedSignal,
  PlaybookCode,
  PlaybookCategory,
  ArchetypeCodeWithA5,
  ArchetypeCodeWithA6,
  SignalExtractorInput,
  PlaybookCatalogRow,
  MatchingRules,
  MultiArchetypeTriageResult,
} from './types';

export {
  PLAYBOOK_CODES,
  PLAYBOOK_CATEGORIES,
  ARCHETYPE_LABELS,
} from './types';
