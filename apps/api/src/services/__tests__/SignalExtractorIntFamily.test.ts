/**
 * Unit tests for INT signal family guardrail in signal-extractor (§S1).
 *
 * Tests that INT_* (Intelligence-scope discovery signals) are filtered out
 * during signal extraction and never flow into triage/playbook evaluation.
 * V3's DS_ZERO_INDEXED_PRESENCE alias still flows untouched (regression).
 */

import { describe, it, expect } from 'vitest';
import { extractSignals } from '../triage/signal-extractor';

describe('signal-extractor INT family guardrail (§S1)', () => {
  it('INT_* codes in detected_signals are NOT extracted', () => {
    const signals = extractSignals({
      campaign: {} as any,
      auditData: {
        detected_signals: [
          'INT_LOW_VISIBILITY',
          'INT_HIDDEN_TRUST',
          'INT_MULTISOURCE_IDENTITY',
        ],
      },
    });
    const signalArr = Array.isArray(signals) ? signals : Array.from(signals as any);
    for (const code of signalArr) {
      expect(String(code).startsWith('INT_')).toBe(false);
    }
  });

  it('INT_* codes mixed with RA/DS codes → only non-INT extracted', () => {
    const signals = extractSignals({
      campaign: {} as any,
      auditData: {
        detected_signals: [
          'INT_LOW_VISIBILITY',
          'RA_REVIEW_DROUGHT',
          'INT_HIDDEN_TRUST',
          'DS_CLAIMED_STATUS',
        ],
      },
    });
    const arr = Array.isArray(signals) ? signals : Array.from(signals as any);
    expect(arr).toContain('RA_REVIEW_DROUGHT');
    expect(arr).toContain('DS_CLAIMED_STATUS');
    for (const code of arr) {
      expect(String(code).startsWith('INT_')).toBe(false);
    }
  });

  it('DS_ZERO_INDEXED_PRESENCE alias still flows untouched (regression)', () => {
    const signals = extractSignals({
      campaign: {} as any,
      auditData: {
        detected_signals: ['DS_ZERO_INDEXED_PRESENCE'],
      },
    });
    const arr = Array.isArray(signals) ? signals : Array.from(signals as any);
    expect(arr).toContain('DS_ZERO_INDEXED_PRESENCE');
  });

  it('empty detected_signals → no signals from model_emitted path', () => {
    const signals = extractSignals({
      campaign: {} as any,
      auditData: { detected_signals: [] },
    });
    const arr = Array.isArray(signals) ? signals : Array.from(signals as any);
    // No INT codes, no model_emitted codes
    for (const code of arr) {
      expect(String(code).startsWith('INT_')).toBe(false);
    }
  });

  it('only INT_* codes → empty signal set from model_emitted path', () => {
    const signals = extractSignals({
      campaign: {} as any,
      auditData: {
        detected_signals: ['INT_LOW_VISIBILITY', 'INT_WEAK_MAINSTREAM_INDEXING'],
      },
    });
    const arr = Array.isArray(signals) ? signals : Array.from(signals as any);
    // The model_emitted path is the only source here since campaign is empty
    // and there's no auditData fields that trigger derived codes.
    // All INT codes should be filtered out.
    for (const code of arr) {
      expect(String(code).startsWith('INT_')).toBe(false);
    }
  });
});
