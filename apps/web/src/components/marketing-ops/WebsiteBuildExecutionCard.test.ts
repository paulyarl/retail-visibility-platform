/**
 * WebsiteBuildExecutionCard — static-render tests (no jsdom; see AGENTS.md).
 *
 * The card is the PB-08 / A7 post-decision tracker — the counterpart of
 * RepairExecutionCard for the website-gap motion. It gates on
 * isWebsiteGapCampaign AND a confirmed playbook_decision, and renders the
 * scope-aware delivery mode (dfy/diy), linked seed / sibling-attach path,
 * preview storefront, website_build intake, and checklist progress from the
 * GET /campaigns/:id/website-build-execution read model.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WebsiteBuildExecutionCard from './WebsiteBuildExecutionCard';
import type {
  Campaign, WebsiteBuildExecutionReadModel, WebsiteGapDecision,
} from '@/services/MarketingOpsService';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'mcamp-t4jj2t82',
    playbook_code: 'PB-08',
    archetype: 'A7',
    campaign_category: 'profile_repair',
    scope: 'business',
    ...overrides,
  } as unknown as Campaign;
}

const DECISION: WebsiteGapDecision = {
  kind: 'website_build_scope',
  confirmed_scope: 'new_build',
  recommended_scope: 'new_build',
  diverged_from_audit: false,
  reason: 'third party domain',
  decided_at: '2026-10-09T12:00:00Z',
  decided_by: 'uid-1',
  audit_id: 'maud-1',
};

function makeExecution(overrides: Partial<WebsiteBuildExecutionReadModel> = {}): WebsiteBuildExecutionReadModel {
  return {
    campaign_id: 'mcamp-t4jj2t82',
    stage: 'seek',
    decision: DECISION,
    confirmed_scope: 'new_build',
    delivery_mode: null,
    scope_modes: ['dfy', 'diy'],
    seed: null,
    linkable_seeds: [],
    preview: null,
    intake: null,
    checklist: null,
    ...overrides,
  };
}

const noop = () => {};

describe('WebsiteBuildExecutionCard', () => {
  it('renders nothing on non-website-gap campaigns', () => {
    const campaign = makeCampaign({ playbook_code: 'PB-05', archetype: 'A1' });
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, { campaign, onRefresh: noop, initialExecution: null }),
    );
    expect(html).toBe('');
  });

  it('renders nothing on a PB-08 campaign with no confirmed decision', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, { campaign: makeCampaign(), onRefresh: noop, initialExecution: null }),
    );
    expect(html).toBe('');
  });

  it('renders the scope chip and dfy/diy mode picker on a confirmed decision', () => {
    const campaign = makeCampaign({ playbook_decision: DECISION });
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, { campaign, onRefresh: noop, initialExecution: makeExecution() }),
    );
    expect(html).toContain('Website Build Execution');
    expect(html).toContain('New build');
    expect(html).toContain('Delivery mode');
    expect(html).toContain('DFY — we execute the build');
    expect(html).toContain('DIY — hand off scope + mockup to owner/dev');
    expect(html).toContain('choose who executes the build');
  });

  it('shows the chosen mode in the header chip', () => {
    const campaign = makeCampaign({ playbook_decision: { ...DECISION, delivery_mode: 'dfy' } });
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, {
        campaign,
        onRefresh: noop,
        initialExecution: makeExecution({ delivery_mode: 'dfy' }),
      }),
    );
    expect(html).toContain('New build · DFY');
    expect(html).not.toContain('choose who executes the build');
  });

  it('renders the linked seed state', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, {
        campaign: makeCampaign({ playbook_decision: DECISION }),
        onRefresh: noop,
        initialExecution: makeExecution({
          seed: {
            seed_id: 'dps-329R-nf8nmoao',
            link_role: 'sibling',
            nap_match_confidence: 'high',
            nap_match_summary: null,
            seed_status: 'invited',
            seed_claimed: false,
            claimed_at: null,
          },
        }),
      }),
    );
    expect(html).toContain('Seed linked · sibling · invited');
    expect(html).toContain('unclaimed');
    expect(html).toContain('NAP match: high');
    expect(html).toContain('/settings/admin/directory/presence-seeds/dps-329R-nf8nmoao');
  });

  it('offers the sibling-attach CTA when a prospect-shared seed exists but is not linked', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, {
        campaign: makeCampaign({ playbook_decision: DECISION }),
        onRefresh: noop,
        initialExecution: makeExecution({
          linkable_seeds: [{
            seed_id: 'dps-329R-nf8nmoao',
            linked_via_campaign_id: 'mcamp-uvcasj3e',
            linked_via_role: 'primary',
            seed_status: 'invited',
            business_name: 'Arsema G Food Mart LLC',
            city: 'Indianapolis',
            state: 'IN',
          }],
        }),
      }),
    );
    expect(html).toContain('Shared prospect seed found');
    expect(html).toContain('Arsema G Food Mart LLC');
    expect(html).toContain('Attach (sibling link)');
  });

  it('offers Generate preview when the linked seed is eligible with no live preview', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, {
        campaign: makeCampaign({ playbook_decision: DECISION }),
        onRefresh: noop,
        initialExecution: makeExecution({
          seed: {
            seed_id: 'dps-1', link_role: 'sibling', nap_match_confidence: 'high',
            nap_match_summary: null, seed_status: 'published', seed_claimed: false, claimed_at: null,
          },
          preview: {
            eligible: true, storefront_url: null, tenant_id: null,
            expires_at: null, extensions_used: 0, page_views: 0,
          },
        }),
      }),
    );
    expect(html).toContain('Preview storefront');
    expect(html).toContain('Generate preview');
  });

  it('renders the live preview URL, expiry, and extension count', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, {
        campaign: makeCampaign({ playbook_decision: DECISION }),
        onRefresh: noop,
        initialExecution: makeExecution({
          seed: {
            seed_id: 'dps-1', link_role: 'sibling', nap_match_confidence: 'high',
            nap_match_summary: null, seed_status: 'published', seed_claimed: false, claimed_at: null,
          },
          preview: {
            eligible: true, storefront_url: '/shops/sample-mart', tenant_id: 'tid-demo',
            expires_at: '2027-01-01T00:00:00Z', extensions_used: 1, page_views: 7,
          },
        }),
      }),
    );
    expect(html).toContain('/shops/sample-mart');
    expect(html).toContain('Extend +7d (1/2)');
    expect(html).toContain('7 views');
  });

  it('notes the intake auto-offer before paid', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, {
        campaign: makeCampaign({ playbook_decision: DECISION }),
        onRefresh: noop,
        initialExecution: makeExecution(),
      }),
    );
    expect(html).toContain('Website build intake');
    expect(html).toContain('reaches');
  });

  it('renders checklist progress and next steps', () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteBuildExecutionCard, {
        campaign: makeCampaign({ playbook_decision: DECISION }),
        onRefresh: noop,
        initialExecution: makeExecution({
          checklist: {
            steps_total: 8,
            steps_completed: 2,
            required_total: 7,
            required_completed: 2,
            next_steps: [
              { id: 'pbcs-pb08-003', title: 'Owner interview - domain, assets, category content', step_order: 3 },
              { id: 'pbcs-pb08-004', title: 'Run the Website Positioning Audit and build the deliverable', step_order: 4 },
            ],
          },
        }),
      }),
    );
    expect(html).toContain('2 of 8 complete');
    expect(html).toContain('2 of 7 required');
    expect(html).toContain('Owner interview - domain, assets, category content');
  });
});
