import { describe, it, expect } from 'vitest';
import {
  isStubBusinessAnalysisAudit,
  STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES,
} from '../marketing-audits';

// Stub detection — placeholder audit rows carry audit_metadata.source from a
// known stub family and must never be read as a real business_analysis audit.
// City-scan spawn-pre-triaged stubs (derived_from_city_scan) are the same
// signals-only shape as derived_from_parent — partial-lane sensitivity, not
// full-pull authority.

const audit = (platform: string, source?: string) => ({
  platform,
  audit_data: source === undefined
    ? {}
    : { audit_metadata: { source } },
});

describe('isStubBusinessAnalysisAudit', () => {
  it('treats every registered stub source as a stub', () => {
    for (const source of STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES) {
      expect(isStubBusinessAnalysisAudit(audit('business_analysis', source))).toBe(true);
    }
  });

  it('detects the city-scan spawn-pre-triaged stub', () => {
    expect(
      isStubBusinessAnalysisAudit(audit('business_analysis', 'derived_from_city_scan')),
    ).toBe(true);
  });

  it('does not flag a real business_analysis audit', () => {
    expect(isStubBusinessAnalysisAudit(audit('business_analysis'))).toBe(false);
    expect(
      isStubBusinessAnalysisAudit(audit('business_analysis', 'operator_import')),
    ).toBe(false);
  });

  it('does not flag other platforms', () => {
    expect(
      isStubBusinessAnalysisAudit(audit('category_identification', 'derived_from_city_scan')),
    ).toBe(false);
  });

  it('handles null/missing audit data', () => {
    expect(isStubBusinessAnalysisAudit(null)).toBe(false);
    expect(isStubBusinessAnalysisAudit(undefined)).toBe(false);
    expect(isStubBusinessAnalysisAudit({ platform: 'business_analysis' })).toBe(false);
  });
});
