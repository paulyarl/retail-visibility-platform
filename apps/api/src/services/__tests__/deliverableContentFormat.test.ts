import { describe, it, expect } from 'vitest';
import { formatFulfillContent } from '../deliverable/deliverable-content-format';

// The fulfill executions store raw_json — the structured artifact. The PDF
// body must render document copy, not the blob (the W6b defect the citation
// package composer special-cases). formatFulfillContent is the
// presentational bridge: JSON objects → labeled sections, everything else
// passes through byte-identical.

const BUILD_PACKAGE_JSON = JSON.stringify({
  site_map: [
    {
      page: 'Home',
      purpose: 'Introduce the store and its mission, highlight unique offerings.',
      key_content: ['Store name and branding', "Brief description of the store's focus on Ethiopian and African groceries"],
    },
    {
      page: 'Contact',
      purpose: 'Provide ways for customers to reach the store.',
      key_content: ['Store address with full details', 'Phone number'],
    },
  ],
  nav_and_cta: {
    nav_order: ['Home', 'Products', 'Contact'],
    primary_cta: 'Inquire',
    cta_placements: ['Contact page for inquiries', 'Home page for product orders'],
  },
  domain_hosting: {
    domain_recommendation: 'arsemafoodmart.com',
    ownership_state: 'Not owned',
    platform_recommendation: 'Managed small-business website builder',
  },
  asset_requirements: ['High-quality images of the store', 'Company logo'],
  launch_checklist: ['Verify mobile rendering across devices', 'Ensure HTTPS is active'],
  profile_cutover: ['Google Business Profile', 'Yelp', 'Apple Maps'],
});

describe('formatFulfillContent', () => {
  it('renders website_build_package JSON as labeled sections — no raw JSON keys', () => {
    const out = formatFulfillContent('website_build_package', BUILD_PACKAGE_JSON);

    expect(out).toContain('## Site Map & Page Spec');
    expect(out).toContain('1. Home');
    expect(out).toContain('Purpose: Introduce the store');
    expect(out).toContain('• Store name and branding');
    expect(out).toContain('## Navigation & CTA');
    expect(out).toContain('Nav order: Home · Products · Contact');
    expect(out).toContain('## Domain & Hosting');
    expect(out).toContain('Recommended domain: arsemafoodmart.com');
    expect(out).toContain('## QA & Launch Checklist');
    expect(out).toContain('## Profile Cutover');

    // No JSON syntax or snake_case keys leak into the document
    expect(out).not.toContain('"site_map"');
    expect(out).not.toContain('"nav_and_cta"');
    expect(out).not.toContain('{');
    expect(out).not.toContain('}');
  });

  it('numbers object-array items and strips their title field from the sub-fields', () => {
    const out = formatFulfillContent('website_build_package', BUILD_PACKAGE_JSON);
    expect(out).toContain('1. Home');
    expect(out).toContain('2. Contact');
    // "page" is the title field — it must not repeat as a sub-label
    expect(out).not.toContain('Page:');
  });

  it('renders qa items with Q/A labels', () => {
    const out = formatFulfillContent('gbp_audit', JSON.stringify({
      qa: [{ question: 'Do you carry teff?', answer: 'Yes, in the grains aisle.' }],
    }));
    expect(out).toContain('## Q&A');
    expect(out).toContain('1. Do you carry teff?');
    expect(out).toContain('A: Yes, in the grains aisle.');
  });

  it('passes non-JSON output through unchanged', () => {
    const prose = 'Plain markdown deliverable body\n\nSecond paragraph';
    expect(formatFulfillContent('website_mockup', prose)).toBe(prose);
  });

  it('passes empty input through unchanged', () => {
    expect(formatFulfillContent('nap_report', '')).toBe('');
  });

  it('unwraps fenced JSON', () => {
    const fenced = '```json\n{"launch_checklist": ["Check HTTPS"]}\n```';
    const out = formatFulfillContent('website_build_package', fenced);
    expect(out).toContain('## QA & Launch Checklist\nCheck HTTPS');
    expect(out).not.toContain('```');
  });

  it('drops a claim_cta field inside the JSON — the CTA is render-appended by the caller', () => {
    const out = formatFulfillContent('website_build_package', JSON.stringify({
      profile_cutover: ['Google Business Profile'],
      claim_cta: 'Claim your listing and correct it here: https://example.com/claim/abc — it takes about two minutes and there is no cost.',
    }));
    expect(out).toContain('## Profile Cutover\nGoogle Business Profile');
    expect(out).not.toContain('claim_cta');
    expect(out).not.toContain('example.com/claim');
  });

  it('preserves prose appended after the JSON (e.g. a claim CTA)', () => {
    const raw = '{"sections": [{"title": "Hero", "content": "Big photo"}]}\n\nClaim your listing at https://example.com/claim — it takes two minutes.';
    const out = formatFulfillContent('website_mockup', raw);
    expect(out).toContain('## Homepage Mockup');
    expect(out).toContain('1. Hero');
    expect(out).toContain('Content: Big photo');
    expect(out).toContain('Claim your listing at https://example.com/claim');
  });

  it('humanizes unknown keys instead of dropping them', () => {
    const out = formatFulfillContent('seo_content', JSON.stringify({
      pages: [{ h1: 'Injera Wholesale', meta_title: 'Wholesale Injera | Shop' }],
      surprise_field: 'kept, not dropped',
    }));
    expect(out).toContain('## Service Pages');
    expect(out).toContain('1. Injera Wholesale');
    expect(out).toContain('Meta title: Wholesale Injera | Shop');
    expect(out).toContain('kept, not dropped');
  });

  it('falls back to generic labels for types without a section map', () => {
    const out = formatFulfillContent('review_responses' as any, JSON.stringify({
      responses: [{ platform: 'Google', text: 'Thank you for visiting.' }],
    }));
    expect(out).toContain('## Responses');
    expect(out).toContain('1. Google');
    expect(out).toContain('Text: Thank you for visiting.');
  });

  it('returns raw text when the JSON is malformed', () => {
    const broken = '{"site_map": [{"page": "Home"';
    expect(formatFulfillContent('website_build_package', broken)).toBe(broken);
  });
});
