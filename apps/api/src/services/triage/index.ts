/**
 * Triage Engine — barrel export.
 *
 * Consumers import from a single path:
 *   import { extractSignals, evaluateTriage } from '../services/triage';
 */

export {
  extractSignals,
  signalPredicates,
  SIGNAL_THRESHOLDS,
} from './signal-extractor';

export {
  evaluateTriage,
  CONFIDENCE,
} from './TriageEngineService';

export type {
  NormalizedSignals,
  TriageRecommendation,
  DetectedSignal,
  PlaybookCode,
  PlaybookCategory,
  ArchetypeCodeWithA5,
  SignalExtractorInput,
  PlaybookCatalogRow,
} from './types';

export {
  PLAYBOOK_CODES,
  PLAYBOOK_CATEGORIES,
  ARCHETYPE_LABELS,
} from './types';
