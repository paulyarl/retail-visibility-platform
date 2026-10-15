/**
 * LaneDeliveryModePanel — the DFY/DIY delivery lane for the review (PB-02) and
 * recovery (PB-04) motions.
 *
 * Prop-driven, so it renders statically: no fetch, no effect. Asserts the
 * self-gate (business scope + a review/recovery pipeline), the lane-specific
 * copy, and that the current decision prefills the select.
 *
 * Node-environment vitest — no jsdom needed. Uses react-dom/server.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LaneDeliveryModePanel from './LaneDeliveryModePanel';
import type { Campaign } from '@/services/MarketingOpsService';

const campaign = (overrides: Partial<Campaign> = {}): Campaign =>
  ({
    id: 'mcamp-test1',
    scope: 'business',
    pipeline: 'review',
    campaign_category: 'review_management',
    ...overrides,
  } as unknown as Campaign);

const render = (c: Campaign) =>
  renderToStaticMarkup(
    createElement(LaneDeliveryModePanel, { campaign: c, onRefresh: () => {} }),
  );

describe('LaneDeliveryModePanel', () => {
  it('renders the review lane with review-specific copy', () => {
    const html = render(campaign());

    expect(html).toContain('Review response delivery');
    expect(html).toContain('we draft the responses, the owner posts them');
    expect(html).toContain('we post the responses for the owner');
  });

  it('renders the recovery lane with recovery-specific copy', () => {
    const html = render(campaign({ pipeline: 'recovery', campaign_category: 'recovery_management' }));

    expect(html).toContain('Recovery package delivery');
    expect(html).toContain('we draft the resolution and appeal, the owner files them');
    expect(html).toContain('we file the resolution and appeal for the owner');
  });

  it('self-gates outside a business-scope review/recovery lane', () => {
    expect(render(campaign({ scope: 'category' }))).toBe('');
    expect(render(campaign({ pipeline: undefined }))).toBe('');
  });

  it('prefills the select from the campaign’s own decision', () => {
    const html = render(
      campaign({
        playbook_decision: {
          kind: 'review_delivery_mode',
          delivery_mode: 'dfy',
          decided_at: '2026-10-15T00:00:00Z',
          decided_by: 'uid-1',
        },
      }),
    );

    // The dfy option carries `selected`; the current value is also echoed.
    expect(html).toMatch(/value="dfy"[^>]*selected/);
    expect(html).toContain('Current:');
    expect(html).toContain('DFY');
    expect(html).toContain('Update lane');
  });

  it('ignores a decision belonging to another lane’s kind', () => {
    // A PB-08 website decision on the same column must not prefill this panel.
    const html = render(
      campaign({
        playbook_decision: {
          kind: 'website_build_scope',
          confirmed_scope: 'new_build',
          recommended_scope: null,
          diverged_from_audit: null,
          reason: 'x',
          decided_at: '2026-10-15T00:00:00Z',
          decided_by: null,
          audit_id: null,
        },
      }),
    );

    expect(html).not.toContain('Current:');
    expect(html).toContain('Set lane');
  });
});
