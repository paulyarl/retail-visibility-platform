/**
 * Unit tests for DeliverableSourceService signal-gating mapping + tone directives.
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md §3.2, §5.4
 */

import { describe, it, expect } from 'vitest';
import {
  TYPE_GOVERNING_SIGNALS,
  DELIVERABLE_RELEVANT_FAMILIES,
  FULFILL_TEMPLATE_BY_TYPE,
} from '../DeliverableSourceService';
import { KNOWN_SIGNAL_CODES } from '../../triage/signal-taxonomy';
import {
  DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE,
  DELIVERABLE_FULFILL_TONE_DIRECTIVE,
} from '../../intelligence/report-directives';

const MODAL_TYPES = [
  'review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards',
  'nap_report', 'seo_content', 'lead_magnet', 'product_visibility_preview',
];

describe('signal → deliverable type mapping (§3.2)', () => {
  it('covers all eight modal deliverable types', () => {
    for (const t of MODAL_TYPES) {
      expect(TYPE_GOVERNING_SIGNALS[t], `missing governing signals for ${t}`).toBeDefined();
      expect(TYPE_GOVERNING_SIGNALS[t].length).toBeGreaterThan(0);
    }
  });

  it('every governing signal is a known signal code', () => {
    const known = new Set<string>(KNOWN_SIGNAL_CODES as readonly string[]);
    for (const [type, signals] of Object.entries(TYPE_GOVERNING_SIGNALS)) {
      for (const s of signals) {
        expect(known.has(s), `${type} references unknown signal ${s}`).toBe(true);
      }
    }
  });

  it('excludes the OX (outreach state) family — G-12', () => {
    expect(DELIVERABLE_RELEVANT_FAMILIES).not.toContain('OX');
    for (const signals of Object.values(TYPE_GOVERNING_SIGNALS)) {
      for (const s of signals) {
        expect(s.startsWith('OX_')).toBe(false);
      }
    }
  });

  it('maps every modal type to a fulfill template', () => {
    for (const t of MODAL_TYPES) {
      expect(FULFILL_TEMPLATE_BY_TYPE[t], `no fulfill template for ${t}`).toBeTruthy();
    }
  });
});

describe('tone directives (§5.4)', () => {
  it('Register A is the analyst voice (never dry, never dull)', () => {
    expect(DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE).toMatch(/never dry/i);
    expect(DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE).toMatch(/never dull/i);
    expect(DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE).toMatch(/absence is not a negative/i);
  });

  it('Register B is the owner-facing voice (no superlatives, no hype)', () => {
    expect(DELIVERABLE_FULFILL_TONE_DIRECTIVE).toMatch(/no superlatives/i);
    expect(DELIVERABLE_FULFILL_TONE_DIRECTIVE).toMatch(/claim your profile and/i);
  });

  it('the two registers are distinct', () => {
    expect(DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE).not.toBe(DELIVERABLE_FULFILL_TONE_DIRECTIVE);
    expect(DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE).not.toContain(DELIVERABLE_FULFILL_TONE_DIRECTIVE);
  });
});
