/**
 * Unit tests for the Interactive Verification preamble (spec §12 —
 * AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC).
 *
 * Covers the seam gate (isInteractiveVerificationEnabled), the preamble
 * builder (buildInteractiveVerificationPreamble), and the caller-supplied
 * variable's interaction with renderTemplate's out-of-scope check — the
 * property that removes the SCOPE_VARIABLES whitelist requirement.
 */

import { describe, it, expect } from 'vitest';
import {
  INTERACTIVE_VERIFICATION_DIRECTIVE,
  INTERACTIVE_VERIFICATION_DIRECTIVE_VERSION,
  buildInteractiveVerificationPreamble,
  isInteractiveVerificationEnabled,
} from '../interactive-verification-directive';
import { MarketingExecutionService } from '../MarketingExecutionService';

const service = MarketingExecutionService.getInstance();

describe('isInteractiveVerificationEnabled', () => {
  it('enables on truthy values', () => {
    for (const v of ['on', 'true', 'yes', '1', 'interactive', ' operator present ']) {
      expect(isInteractiveVerificationEnabled({ interactive_verification: v })).toBe(true);
    }
  });

  it('disables on blank / absent / explicit-off values', () => {
    expect(isInteractiveVerificationEnabled(undefined)).toBe(false);
    expect(isInteractiveVerificationEnabled(null)).toBe(false);
    expect(isInteractiveVerificationEnabled({})).toBe(false);
    for (const v of ['', '   ', 'off', 'OFF', 'false', '0', 'no', 'none', 'disabled', null, undefined]) {
      expect(isInteractiveVerificationEnabled({ interactive_verification: v })).toBe(false);
    }
  });
});

describe('buildInteractiveVerificationPreamble', () => {
  it('returns empty string when disabled — byte-identical off path', () => {
    expect(buildInteractiveVerificationPreamble({})).toBe('');
    expect(buildInteractiveVerificationPreamble({ interactive_verification: '' })).toBe('');
    expect(buildInteractiveVerificationPreamble({ interactive_verification: 'off' })).toBe('');
    const body = 'You are an analyst.';
    expect(buildInteractiveVerificationPreamble(undefined) + body).toBe(body);
  });

  it('emits the directive as the first content when enabled', () => {
    const preamble = buildInteractiveVerificationPreamble({ interactive_verification: 'on' });
    expect(preamble.startsWith('=== INTERACTIVE VERIFICATION — OPERATOR PRESENT ===')).toBe(true);
    expect(preamble).toContain(INTERACTIVE_VERIFICATION_DIRECTIVE);
    expect(preamble.endsWith('\n\n')).toBe(true);
    const body = 'You are an analyst.';
    expect(preamble + body).toContain(body);
  });

  it('encodes the emit-when bounds, permitted request, visibility condition, and provenance', () => {
    const d = INTERACTIVE_VERIFICATION_DIRECTIVE;
    expect(d).toContain('WHEN TO ASK');
    expect(d).toContain('PERMITTED REQUEST');
    expect(d).toContain('VISIBILITY CONDITION');
    expect(d).toContain('attempted_by: operator');
    expect(d).toContain('render_controls[]');
    expect(d).toContain('business_specific_failure');
    expect(d).toContain('not_attempted');
  });

  it('carries supplied operator_observations inside the preamble', () => {
    const obs = '{"platform":"facebook","url":"https://facebook.com/x","found":true}';
    const preamble = buildInteractiveVerificationPreamble({
      interactive_verification: 'on',
      operator_observations: obs,
    });
    expect(preamble).toContain('=== OPERATOR OBSERVATIONS SUPPLIED FOR THIS RUN ===');
    expect(preamble).toContain(obs);
    expect(preamble).toContain('attempted_by: operator');
  });

  it('ignores operator_observations when interactive mode is off', () => {
    const preamble = buildInteractiveVerificationPreamble({
      interactive_verification: 'off',
      operator_observations: 'should not appear',
    });
    expect(preamble).toBe('');
  });
});

describe('caller-supplied variable vs renderTemplate scope check', () => {
  it('passes through as an unused variable without tripping out-of-scope (city scope)', () => {
    const cityCampaign = { scope: 'city', city: 'Plainfield', state: 'IL' };
    // interactive_verification is NOT declared in the body — the scope check
    // only validates body-referenced vars, so no whitelist entry is needed.
    const rendered = service.renderTemplate('City: {{city}}', { interactive_verification: 'on' }, cityCampaign);
    expect(rendered).toBe('City: Plainfield');
  });

  it('does not leak into the rendered body (no placeholder exists)', () => {
    const businessCampaign = { scope: 'business', city: 'Plainfield', state: 'IL', category: 'HVAC' };
    const rendered = service.renderTemplate(
      'City: {{city}}',
      { interactive_verification: 'on', operator_observations: 'x' },
      businessCampaign,
    );
    expect(rendered).not.toContain('INTERACTIVE VERIFICATION');
  });
});

describe('directive version', () => {
  it('is stamped for execution metadata', () => {
    expect(INTERACTIVE_VERIFICATION_DIRECTIVE_VERSION).toBe('interactive_verification_v1');
  });
});
