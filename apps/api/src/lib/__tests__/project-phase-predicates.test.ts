/**
 * Project-phase predicate seed — coverage invariant (sprint 3.3, spec §5).
 *
 * Every KNOWN_SIGNAL_CODES entry is either referenced by a predicate row or
 * in the explicit unmapped list — no silently unmapped codes. Also pins the
 * reverse direction: every predicate signal must be a real known code (a
 * typo'd trigger would silently never fire), and OX_* never triggers.
 */
import { describe, expect, it } from 'vitest';
import { KNOWN_SIGNAL_CODES } from '../../services/triage/signal-taxonomy';
import {
  PHASE_PREDICATE_UNMAPPED_SIGNALS,
  PROJECT_PHASE_CATALOG_ORDER,
  PROJECT_PHASE_PREDICATES_V1,
  PROJECT_PHASE_PREDICATES_VERSION,
} from '../project-phase-predicates';
import { assertSignalCoverage } from '../../scripts/seed-project-phase-predicates';

const KNOWN = new Set<string>(KNOWN_SIGNAL_CODES);
const allTriggerSignals = () =>
  new Set(PROJECT_PHASE_PREDICATES_V1.flatMap((row) => row.signals));

describe('project-phase predicate seed (v1)', () => {
  it('covers every known signal: in a predicate or the unmapped list', () => {
    const triggers = allTriggerSignals();
    const unmapped = new Set(PHASE_PREDICATE_UNMAPPED_SIGNALS);
    const uncovered = (KNOWN_SIGNAL_CODES as readonly string[]).filter(
      (code) => !triggers.has(code) && !unmapped.has(code),
    );
    expect(uncovered).toEqual([]);
  });

  it('assertSignalCoverage passes for the v1 data', () => {
    expect(() => assertSignalCoverage()).not.toThrow();
  });

  it('every predicate trigger is a known signal code', () => {
    const unknown = [...allTriggerSignals()].filter((code) => !KNOWN.has(code));
    expect(unknown).toEqual([]);
  });

  it('every unmapped entry is a known signal code', () => {
    const unknown = PHASE_PREDICATE_UNMAPPED_SIGNALS.filter((code) => !KNOWN.has(code));
    expect(unknown).toEqual([]);
  });

  it('no signal appears in both a trigger set and the unmapped list', () => {
    const triggers = allTriggerSignals();
    const conflict = PHASE_PREDICATE_UNMAPPED_SIGNALS.filter((code) => triggers.has(code));
    expect(conflict).toEqual([]);
  });

  it('OX_* codes never trigger a phase', () => {
    const triggers = allTriggerSignals();
    expect([...triggers].filter((code) => code.startsWith('OX_'))).toEqual([]);
    expect(
      PHASE_PREDICATE_UNMAPPED_SIGNALS.filter((code) => code.startsWith('OX_')).length,
    ).toBe((KNOWN_SIGNAL_CODES as readonly string[]).filter((c) => c.startsWith('OX_')).length);
  });

  it('INT_* codes never trigger a phase — rank modifiers only', () => {
    const triggers = allTriggerSignals();
    expect([...triggers].filter((code) => code.startsWith('INT_'))).toEqual([]);
    for (const row of PROJECT_PHASE_PREDICATES_V1) {
      expect(row.intRankModifiers.every((code) => code.startsWith('INT_'))).toBe(true);
    }
  });

  it('spec table: deliberately excluded codes stay out', () => {
    const triggers = allTriggerSignals();
    expect(triggers.has('VP_STALE_SOCIAL_ACTIVITY')).toBe(false);
    expect(triggers.has('RA_UNADDRESSED_POSITIVE_BACKLOG')).toBe(false);
  });

  it('all five catalog phases seeded at v1 with copy keys', () => {
    expect(PROJECT_PHASE_PREDICATES_V1.map((r) => r.phaseKey)).toEqual([
      ...PROJECT_PHASE_CATALOG_ORDER,
    ]);
    for (const row of PROJECT_PHASE_PREDICATES_V1) {
      for (const slot of ['name', 'goal', 'evidence', 'actions', 'exit_criterion'] as const) {
        expect(row.copyKeys[slot]).toBe(`project_phase.${row.phaseKey}.${slot}`);
      }
    }
  });

  it('v1 ships no min_severity floors (D10)', () => {
    expect(PROJECT_PHASE_PREDICATES_V1.every((r) => r.minSeverity === null)).toBe(true);
    expect(PROJECT_PHASE_PREDICATES_VERSION).toBe(1);
  });
});
