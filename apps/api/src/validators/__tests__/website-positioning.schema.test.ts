/**
 * Website Positioning Audit schema tests (PB-08 / A7)
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §6.2
 */

import { describe, it, expect } from 'vitest';
import {
  websitePositioningAuditSchema,
  WEBSITE_POSITIONING_SCHEMA_NAME,
} from '../website-positioning.schema';
import { resolveOutputSchema } from '../market-analysis.schema';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    summary: 'No owned site; a Facebook page stands in.',
    presence_classification: 'third_party_only',
    ownership: 'platform_hosted',
    issues: [
      {
        issue: 'The website field points at a Facebook page',
        evidence: 'https://facebook.com/mybusiness',
        severity: 'non_negotiable',
        conversion_implication: "customers land on a social page and leave to find a real site",
      },
    ],
    positioning_gaps: [
      { platform: 'website', field: 'service_pages', expected: true, actual: false, gap_description: 'No service pages', severity: 'non_negotiable' },
    ],
    build_scope: { recommended: 'new_build', scope_notes: 'Own domain + homepage + services', must_have_pages: ['Home', 'Services', 'Contact'] },
    detected_signals: ['WC_THIRD_PARTY_DOMAIN'],
    competitive_frame: ['Exemplar sites lead with the service list and a quote form.'],
    outreach_problems: [
      {
        problem: 'Customers searching for you find a Facebook page instead of a website',
        regular: 'I went looking for your website and the only thing that came up was your Facebook page.',
        hook: 'Try searching your own business name — see what a new customer lands on.',
        solution: 'A real site on your own domain, with your services and a way to get in touch.',
        evidence: 'website.url resolves to facebook.com; no owned domain found',
        outreach_use: 'cold-call opener',
      },
    ],
    data_quality: { verified_fields: ['website.url'], limitations: [] },
    ...overrides,
  };
}

describe('websitePositioningAuditSchema', () => {
  it('accepts a well-formed payload', () => {
    const parsed = websitePositioningAuditSchema.safeParse(validPayload());
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown presence_classification', () => {
    const parsed = websitePositioningAuditSchema.safeParse(validPayload({ presence_classification: 'social' }));
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown ownership value', () => {
    const parsed = websitePositioningAuditSchema.safeParse(validPayload({ ownership: 'rented' }));
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown build_scope.recommended', () => {
    const parsed = websitePositioningAuditSchema.safeParse(
      validPayload({ build_scope: { recommended: 'buy_a_website' } }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects an empty outreach_problems array (.min(1))', () => {
    const parsed = websitePositioningAuditSchema.safeParse(validPayload({ outreach_problems: [] }));
    expect(parsed.success).toBe(false);
  });

  it('omits outreach_problems entirely without error', () => {
    const payload = validPayload();
    delete (payload as any).outreach_problems;
    expect(websitePositioningAuditSchema.safeParse(payload).success).toBe(true);
  });

  it('requires every outreach_problem field', () => {
    const parsed = websitePositioningAuditSchema.safeParse(
      validPayload({ outreach_problems: [{ problem: 'x', regular: 'y' }] }),
    );
    expect(parsed.success).toBe(false);
  });

  it('is registered in OUTPUT_SCHEMA_REGISTRY with auditPlatform website_positioning', () => {
    const entry = resolveOutputSchema(WEBSITE_POSITIONING_SCHEMA_NAME);
    expect(entry).not.toBeNull();
    expect(entry!.auditPlatform).toBe('website_positioning');
  });
});
