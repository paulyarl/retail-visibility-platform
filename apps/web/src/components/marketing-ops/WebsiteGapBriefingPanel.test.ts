/**
 * WebsiteGapBriefingPanel — static-render tests (no jsdom; see AGENTS.md).
 *
 * The panel is the PB-08 / A7 counterpart of RepairTrackPanel: it gates on
 * isWebsiteGapCampaign, exposes the AI Run / External dual-execution toggle
 * for the website positioning audit, and renders the persisted audit as the
 * briefing body.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WebsiteGapBriefingPanel from './WebsiteGapBriefingPanel';
import type { Audit, CampaignDetail } from '@/services/MarketingOpsService';

function makeCampaign(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'mcamp-test',
    playbook_code: 'PB-08',
    archetype: 'A7',
    campaign_category: 'profile_repair',
    scope: 'business',
    audits: [],
    ...overrides,
  } as unknown as CampaignDetail;
}

const noop = () => {};

describe('WebsiteGapBriefingPanel', () => {
  it('renders nothing on non-website-gap campaigns', () => {
    const campaign = makeCampaign({ playbook_code: 'PB-05', archetype: 'A1' });
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign, onRefresh: noop }),
    );
    expect(html).toBe('');
  });

  it('renders nothing on a repair campaign even with profile_repair category', () => {
    const campaign = makeCampaign({ playbook_code: 'PB-04', archetype: null as any });
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign, onRefresh: noop }),
    );
    expect(html).toBe('');
  });

  it('shows the not-yet-produced state with the dual-execution toggle when no audit exists', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign: makeCampaign(), onRefresh: noop }),
    );
    expect(html).toContain('Website Gap Briefing');
    expect(html).toContain('Briefing not yet produced');
    expect(html).toContain('AI Run');
    expect(html).toContain('External');
    expect(html).toContain('Run Positioning Audit');
  });

  it('gates on archetype A7 even without a playbook_code', () => {
    const campaign = makeCampaign({ playbook_code: null, archetype: 'A7' });
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign, onRefresh: noop }),
    );
    expect(html).toContain('Website Gap Briefing');
  });

  it('renders the persisted website_positioning audit as the briefing body', () => {
    const audit = {
      id: 'maud-wp-1',
      platform: 'website_positioning',
      created_at: '2026-01-15T00:00:00Z',
      audit_data: {
        presence_classification: 'third_party_only',
        ownership: 'none',
        build_scope: { recommended: 'new_build', scope_notes: 'No owned site at all.' },
        detected_signals: ['WC_THIRD_PARTY_DOMAIN'],
      },
    } as unknown as Audit;
    const campaign = makeCampaign({ audits: [audit] });
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign, onRefresh: noop }),
    );
    expect(html).toContain('Positioning audit on file');
    expect(html).toContain('build: new build');
    expect(html).toContain('Re-run Positioning Audit');
    // Embedded audit card content
    expect(html).toContain('Website Positioning Audit');
    expect(html).toContain('third party only');
    expect(html).toContain('WC_THIRD_PARTY_DOMAIN');
  });

  it('offers Confirm Build Scope once an audit exists, prefilled from the audit recommendation', () => {
    const audit = {
      id: 'maud-wp-3',
      platform: 'website_positioning',
      created_at: '2026-01-15T00:00:00Z',
      audit_data: {
        presence_classification: 'no_presence',
        ownership: 'none',
        build_scope: { recommended: 'new_build' },
      },
    } as unknown as Audit;
    const campaign = makeCampaign({ audits: [audit] });
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign, onRefresh: noop }),
    );
    expect(html).toContain('Audit recommends new build');
    expect(html).toContain('Confirm Build Scope');
  });

  it('renders the confirmed decision state with divergence note', () => {
    const audit = {
      id: 'maud-wp-4',
      platform: 'website_positioning',
      created_at: '2026-01-15T00:00:00Z',
      audit_data: { build_scope: { recommended: 'new_build' } },
    } as unknown as Audit;
    const campaign = makeCampaign({
      audits: [audit],
      playbook_decision: {
        kind: 'website_build_scope',
        confirmed_scope: 'rebuild',
        recommended_scope: 'new_build',
        diverged_from_audit: true,
        reason: 'Domain exists but is parked — cheaper to rebuild',
        decided_at: '2026-01-16T00:00:00Z',
        decided_by: 'user-1',
        audit_id: 'maud-wp-4',
      },
    });
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign, onRefresh: noop }),
    );
    expect(html).toContain('Build scope confirmed: rebuild');
    expect(html).toContain('diverged from audit recommendation (new build)');
    expect(html).toContain('Revise');
    // The unconfirmed call-to-action must NOT render once decided
    expect(html).not.toContain('Confirm Build Scope');
  });

  it('shows no decision UI before an audit exists', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign: makeCampaign(), onRefresh: noop }),
    );
    expect(html).not.toContain('Confirm Build Scope');
  });

  it('keeps the dual-execution toggle available after an audit exists (rerun path)', () => {
    const audit = {
      id: 'maud-wp-2',
      platform: 'website_positioning',
      created_at: '2026-01-15T00:00:00Z',
      audit_data: { presence_classification: 'present', ownership: 'owned_domain' },
    } as unknown as Audit;
    const campaign = makeCampaign({ audits: [audit] });
    const html = renderToStaticMarkup(
      createElement(WebsiteGapBriefingPanel, { campaign, onRefresh: noop }),
    );
    expect(html).toContain('AI Run');
    expect(html).toContain('External');
  });
});
