import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProspectReportView from './ProspectReportView';
import type { ProspectReport } from '@/services/ProspectReportPublicService';

// Raja-shaped fixture — the trap fields (`detected_signals`,
// `outreach_problems`) are baked into payload strings to prove they never
// reach the rendered markup.
const TRAP = 'XXX_INTERNAL_TRAP_XXX';

const report: ProspectReport = {
  report_kind: 'business_visibility',
  business_prospect_id: 'bpr-raja',
  business_name: 'Raja Bazaar',
  prepared_at: '2026-09-30T00:00:00Z',
  website_url: 'https://rajabazaar.example',
  tier: 'free',
  short_version: {
    lead: 'Your site works, but a stale ordering banner is costing you orders.',
    bullets: ['Reachable storefront', 'Ordering banner stale'],
  },
  chapters: [
    {
      chapter_id: 'website',
      title: 'Your website',
      audited_at: '2026-09-29T00:00:00Z',
      category: 'Middle Eastern Grocery Store',
      summary: 'Trap-safe summary',
      verdict: 'Your website is live on your own domain.',
      already_working: ['Clear product categories'],
      costing_customers: [
        {
          headline: 'Stale ordering schedule',
          cost: 'Customers think you are not taking orders',
          evidence: 'Banner on homepage',
          tier: 'now',
        },
        {
          headline: 'HMS certification not prominent',
          cost: null,
          evidence: null,
          tier: 'worth_fixing',
        },
      ],
      expectations: [
        {
          field: 'hours',
          expected_text: 'today\u2019s hours',
          actual_text: 'a week-old widget',
          note: 'Customers call instead',
        },
      ],
      competitive_frame: ['Leading grocers show a live ordering window'],
      fix: {
        headline: 'A focused refresh of your existing site',
        scope_notes: 'Keep the domain; fix the ordering surface.',
        page_plan: ['Home', 'Departments', 'Ordering'],
      },
    },
  ],
  locked_chapters: [
    {
      chapter_id: 'repair',
      title: 'Your public profiles',
      finding_count: 4,
      teaser: 'Your public profiles — 4 findings inside',
    },
  ],
  data_quality: {
    verified: ['Site reachable over HTTPS'],
    couldnt_check: [`${TRAP} internal-only field`],
    limitations: ['Audit reflects public storefront only'],
  },
  cta: { kind: 'claim', label: 'Claim your listing', url: 'https://visibleshelf.example/q/ABC123' },
};

function render(r: ProspectReport = report) {
  return renderToStaticMarkup(createElement(ProspectReportView, { report: r }));
}

describe('ProspectReportView', () => {
  it('renders header, short version, and website chapter content', () => {
    const html = render();
    expect(html).toContain('Business Visibility Report');
    expect(html).toContain('Raja Bazaar');
    expect(html).toContain('The short version');
    expect(html).toContain('Reachable storefront');
    expect(html).toContain('Your website is live on your own domain.');
    expect(html).toContain('Already working');
    expect(html).toContain('Clear product categories');
    expect(html).toContain('Stale ordering schedule');
    expect(html).toContain('What it costs you');
    expect(html).toContain('Where we saw it');
    expect(html).toContain('Costing you customers now');
    expect(html).toContain('Worth fixing');
    expect(html).toContain('HMS certification not prominent');
    expect(html).toContain('Leading grocers show a live ordering window');
    expect(html).toContain('A focused refresh of your existing site');
  });

  it('renders the page plan when signed in', () => {
    const html = render();
    expect(html).toContain('What the new site includes');
    expect(html).toContain('Departments');
  });

  it('omits the page plan when the flag was off (page_plan null)', () => {
    const noPlan = structuredClone(report);
    noPlan.chapters[0].fix.page_plan = null;
    const html = render(noPlan);
    expect(html).not.toContain('What the new site includes');
    expect(html).not.toContain('Departments');
    // the rest of the fix still renders
    expect(html).toContain('A focused refresh of your existing site');
  });

  it('renders locked chapters as teasers with the claim CTA, no content', () => {
    const html = render();
    expect(html).toContain('Your public profiles — 4 findings inside');
    expect(html).toContain('Claim to unlock');
    expect(html).toContain('https://visibleshelf.example/q/ABC123');
  });

  it('renders no teaser scaffolding when there are no locked chapters', () => {
    const solo = structuredClone(report);
    solo.locked_chapters = [];
    const html = render(solo);
    expect(html).not.toContain('findings inside');
    expect(html).not.toContain('Claim to unlock');
    // footer CTA still present
    expect(html).toContain('Claim your listing');
  });

  it('renders the honesty footer', () => {
    const html = render();
    expect(html).toContain('How this report was made');
    expect(html).toContain('Site reachable over HTTPS');
    expect(html).toContain('Audit reflects public storefront only');
  });

  it('renders the repair (business_analysis) chapter with the same shape', () => {
    const withRepair = structuredClone(report);
    withRepair.tier = 'full';
    withRepair.chapters = [
      {
        chapter_id: 'repair',
        title: 'Your online listings',
        audited_at: '2026-09-21T00:00:00Z',
        category: 'Middle Eastern Grocery Store',
        summary: 'Confirmed across public sources.',
        verdict: 'We confirmed this business is Raja Bazaar across public sources. We found your business on 2 major listing platforms.',
        already_working: ['Your Google Business Profile listing is claimed — 4.6★ across 38 reviews.'],
        costing_customers: [
          { headline: 'Your Yelp listing is unclaimed', cost: 'Customers see a profile nobody is managing.', evidence: null, tier: 'worth_fixing' },
        ],
        expectations: [
          { field: 'Google Business Profile — Photo count', expected_text: '12', actual_text: '4', note: 'Only 4 photos observed' },
        ],
        competitive_frame: ['Sharaf Market — 4.8★ across 210 Google reviews'],
        fix: { headline: 'A cleanup of your public listings — claimed, consistent, and every review answered.', scope_notes: null, page_plan: null },
      },
    ];
    withRepair.locked_chapters = [];
    const html = render(withRepair);
    expect(html).toContain('Your online listings');
    expect(html).toContain('Google Business Profile listing is claimed');
    expect(html).toContain('Your Yelp listing is unclaimed');
    expect(html).toContain('Photo count');
    expect(html).toContain('Sharaf Market');
    expect(html).toContain('A cleanup of your public listings');
  });

  it('never renders internal-field trap strings', () => {
    // couldnt_check legitimately renders (owner-safe list) — but a trap
    // string smuggled into it would surface; the DTO contract forbids it.
    const clean = structuredClone(report);
    clean.data_quality.couldnt_check = ['WhatsApp response time'];
    const html = render(clean);
    expect(html).not.toContain(TRAP);
    expect(html).not.toContain('detected_signals');
    expect(html).not.toContain('outreach_problems');
  });
});
