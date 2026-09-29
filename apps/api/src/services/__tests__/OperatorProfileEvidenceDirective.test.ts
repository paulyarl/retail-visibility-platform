/**
 * Unit tests for the Operator Profile Evidence preamble — the
 * operator-supplied directory-profile file path companion to
 * InteractiveVerificationDirective.test.ts.
 *
 * Covers the seam gate (blank path → byte-identical off path), the block
 * builder, independence from interactive_verification, and the
 * caller-supplied variable's interaction with renderTemplate's
 * out-of-scope check — the property that removes the SCOPE_VARIABLES
 * whitelist requirement.
 */

import { describe, it, expect } from 'vitest';
import {
  OPERATOR_PROFILE_EVIDENCE_DIRECTIVE_VERSION,
  OPERATOR_PROFILE_EVIDENCE_VARIABLE,
  buildOperatorProfileEvidencePreamble,
} from '../operator-profile-evidence-directive';
import { MarketingExecutionService } from '../MarketingExecutionService';

const service = MarketingExecutionService.getInstance();
const PATH = 'C:\\audits\\acme-plumbing-profiles.md';

describe('buildOperatorProfileEvidencePreamble', () => {
  it('returns empty string when no path is supplied — byte-identical off path', () => {
    expect(buildOperatorProfileEvidencePreamble(undefined)).toBe('');
    expect(buildOperatorProfileEvidencePreamble(null)).toBe('');
    expect(buildOperatorProfileEvidencePreamble({})).toBe('');
    expect(buildOperatorProfileEvidencePreamble({ [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: '' })).toBe('');
    expect(buildOperatorProfileEvidencePreamble({ [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: '   ' })).toBe('');
    const body = 'You are an analyst.';
    expect(buildOperatorProfileEvidencePreamble(undefined) + body).toBe(body);
  });

  it('emits the evidence block carrying the supplied path', () => {
    const preamble = buildOperatorProfileEvidencePreamble({
      [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: PATH,
    });
    expect(preamble.startsWith('=== OPERATOR-SUPPLIED DIRECTORY PROFILE EVIDENCE ===')).toBe(true);
    expect(preamble).toContain(`FILE: ${PATH}`);
    expect(preamble).toContain('=== END OPERATOR PROFILE EVIDENCE ===');
    expect(preamble.endsWith('\n\n')).toBe(true);
  });

  it('trims surrounding whitespace on the path', () => {
    const preamble = buildOperatorProfileEvidencePreamble({
      [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: `  ${PATH}  `,
    });
    expect(preamble).toContain(`FILE: ${PATH}`);
    expect(preamble).not.toContain('FILE:  ');
  });

  it('encodes read-first framing, provenance, conflict, and fallback rules', () => {
    const preamble = buildOperatorProfileEvidencePreamble({
      [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: PATH,
    });
    expect(preamble).toContain('READ FIRST');
    expect(preamble).toContain('attempted_by: operator');
    expect(preamble).toContain('visibility_condition: unknown');
    expect(preamble).toContain('public render evidence');
    expect(preamble).toContain('live render wins');
    expect(preamble).toContain('render_controls[]');
    expect(preamble).toContain('must never block or worsen');
    expect(preamble).toContain('BEYOND PRESENCE');
    expect(preamble).toContain('category identification');
  });

  it('is independent of interactive_verification — emits with the toggle off', () => {
    const preamble = buildOperatorProfileEvidencePreamble({
      interactive_verification: 'off',
      [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: PATH,
    });
    expect(preamble).toContain('OPERATOR-SUPPLIED DIRECTORY PROFILE EVIDENCE');
  });
});

describe('caller-supplied variable vs renderTemplate scope check', () => {
  it('passes through as an unused variable without tripping out-of-scope (city scope)', () => {
    const cityCampaign = { scope: 'city', city: 'Plainfield', state: 'IL' };
    // operator_profile_evidence_file is NOT declared in the body — the scope
    // check only validates body-referenced vars, so no whitelist entry is
    // needed.
    const rendered = service.renderTemplate(
      'City: {{city}}',
      { [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: PATH },
      cityCampaign,
    );
    expect(rendered).toBe('City: Plainfield');
  });

  it('does not leak into the rendered body (no placeholder exists)', () => {
    const businessCampaign = { scope: 'business', city: 'Plainfield', state: 'IL', category: 'HVAC' };
    const rendered = service.renderTemplate(
      'City: {{city}}',
      { [OPERATOR_PROFILE_EVIDENCE_VARIABLE]: PATH },
      businessCampaign,
    );
    expect(rendered).not.toContain('OPERATOR-SUPPLIED');
    expect(rendered).not.toContain(PATH);
  });
});

describe('directive version', () => {
  it('is stamped for execution metadata', () => {
    expect(OPERATOR_PROFILE_EVIDENCE_DIRECTIVE_VERSION).toBe('operator_profile_evidence_v2');
  });
});
