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
  TYPE_PLAYBOOK_OWNERSHIP,
  gateTypesByOwnership,
} from '../DeliverableSourceService';
import { buildClaimCta } from '../deliverable-cta';
import { KNOWN_SIGNAL_CODES } from '../../triage/signal-taxonomy';
import {
  DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE,
  DELIVERABLE_FULFILL_TONE_DIRECTIVE,
} from '../../intelligence/report-directives';

const MODAL_TYPES = [
  'review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards',
  'nap_report', 'seo_content', 'lead_magnet', 'product_visibility_preview',
  'website_mockup', 'website_build_package',
];

describe('signal → deliverable type mapping (§3.2)', () => {
  it('covers all modal deliverable types', () => {
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

describe('archetype ownership gate (playbook routing)', () => {
  const ALL = [...MODAL_TYPES];

  it('only gates types that name an owning playbook', () => {
    for (const t of Object.keys(TYPE_PLAYBOOK_OWNERSHIP)) {
      expect(MODAL_TYPES).toContain(t);
    }
  });

  it('unrouted campaigns (no playbook, no triage) keep every type', () => {
    const { kept, gated } = gateTypesByOwnership(ALL, { playbookCode: null, archetype: null });
    expect(kept).toEqual(ALL);
    expect(gated).toEqual([]);
  });

  it('a PB-05 campaign drops the PB-08 website types (the reported bug)', () => {
    const { kept, gated } = gateTypesByOwnership(
      ['nap_report', 'lead_magnet', 'website_mockup', 'website_build_package', 'review_responses'],
      { playbookCode: 'PB-05', archetype: 'A5' },
    );
    expect(kept).toEqual(['nap_report', 'lead_magnet', 'review_responses']);
    expect(gated.map((g) => g.type)).toEqual(['website_mockup', 'website_build_package']);
    expect(gated.every((g) => g.owner_playbook === 'PB-08')).toBe(true);
  });

  it('a PB-08 campaign keeps its website deliverables', () => {
    const { kept, gated } = gateTypesByOwnership(
      ['website_mockup', 'website_build_package', 'lead_magnet'],
      { playbookCode: 'PB-08', archetype: 'A7' },
    );
    expect(kept).toEqual(['website_mockup', 'website_build_package', 'lead_magnet']);
    expect(gated).toEqual([]);
  });

  it('triage-only routing gates on archetype when playbook_code is absent', () => {
    const { gated } = gateTypesByOwnership(
      ['website_build_package', 'product_visibility_preview', 'nap_report'],
      { playbookCode: null, archetype: 'A3' },
    );
    expect(gated.map((g) => g.type)).toEqual(['website_build_package', 'product_visibility_preview']);
  });

  it('generic types are never gated regardless of archetype', () => {
    const generic = ['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet'];
    for (const archetype of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']) {
      const { kept } = gateTypesByOwnership(generic, { playbookCode: null, archetype });
      expect(kept).toEqual(generic);
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

describe('buildClaimCta', () => {
  it('carries the claim URL when one resolves', () => {
    const cta = buildClaimCta('https://example.com/place/claim/abc123');
    expect(cta).toContain('https://example.com/place/claim/abc123');
    expect(cta).toContain('no cost');
  });

  it('falls back to a link-less variant and never leaks a placeholder', () => {
    const cta = buildClaimCta(null);
    expect(cta).not.toContain('{{claim_url}}');
    expect(cta).not.toContain('http');
    expect(cta).toMatch(/claim this listing/i);
  });
});
