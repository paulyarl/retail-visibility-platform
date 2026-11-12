/**
 * Render tests for EngagementBriefAuditCard — the Pass-2 spine card.
 *
 * The engagement_brief platform used to fall through to the generic audit
 * shell (Reviews / Unaddressed / Photos = 0). These tests pin the real
 * render: ranked pains with severity/confidence/visibility badges, assets,
 * capability fits, verification gates, and the do-not-claim guardrail, with
 * ref_ids resolved through the evidence_index.
 *
 * Node-environment vitest — no jsdom. renderToStaticMarkup renders the
 * client component's initial pass (hooks run, no effects needed).
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EngagementBriefAuditCard from './EngagementBriefAuditCard';

// Fixture mirrors a real persisted brief (ALEN STORE, competitive side).
const BRIEF = {
  brief_version: 1,
  source_audit_id: '',
  business: { name: 'ALEN STORE', category: 'Asian Grocery Store', store_format: 'grocery' },
  side: {
    value: 'competitive',
    density_score: 10,
    inputs_used: ['platforms.google.data_status', 'gap_analysis.gaps'],
    classifier_version: 2,
  },
  evidence_index: {
    p1: 'platforms.google.category_fit_assessment',
    p3: 'gap_analysis.gaps[2]',
    a1: 'observed_assets[1]',
    w1: 'platforms.facebook.profile_url',
  },
  pains: [
    {
      ref_id: 'p1',
      severity: 'high',
      business_consequence:
        "Shoppers searching 'Asian grocery Madison Ave' never see the store",
      evidence_ref: 'p1',
      confidence: 'verified_on_surface',
      visibility: 'public_safe',
    },
    {
      ref_id: 'p3',
      severity: 'medium',
      business_consequence: 'No surface publishes the store hours',
      evidence_ref: 'p3',
      confidence: 'inferred',
      visibility: 'internal',
    },
  ],
  assets: [
    {
      ref_id: 'a1',
      asset: 'SNAP/EBT authorization',
      underexposure: true,
      how_to_use: 'leverage it',
      evidence_ref: 'a1',
      confidence: 'verified_on_surface',
      visibility: 'internal',
    },
  ],
  capability_fits: [
    {
      capability: 'claim_service',
      addresses_ref: 'p1',
      why_it_fits: 'The Google listing is unclaimed and mislabeled',
      confidence: 'high',
      visibility: 'client_safe',
    },
  ],
  verification_gates: [
    {
      gate: "Confirm the store's actual operating hours — no public surface publishes them",
      blocks: 'p3',
      who_can_answer: 'owner',
      visibility: 'internal',
    },
  ],
  engagement_shape: {
    primary_hook_ref: 'p1',
    lead_with: 'pain',
    do_not_claim: ['Do not claim operating hours — none are published anywhere'],
  },
};

const auditOf = (audit_data: any, id = 'audit-1') =>
  ({
    id,
    platform: 'engagement_brief',
    audit_data,
    created_at: '2026-11-12T00:00:00Z',
  }) as any;

const render = (audit: any) =>
  renderToStaticMarkup(
    createElement(EngagementBriefAuditCard, { audit, campaignId: 'camp-1' }),
  );

describe('EngagementBriefAuditCard', () => {
  it('renders the header with business, side, and density score', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('Engagement Brief');
    expect(html).toContain('ALEN STORE');
    expect(html).toContain('Asian Grocery Store');
    expect(html).toContain('competitive');
    expect(html).toContain('density 10');
  });

  it('renders ranked pains with severity, confidence, and visibility badges', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('Pains (2)');
    expect(html).toContain('never see the store');
    expect(html).toContain('verified on surface');
    expect(html).toContain('public safe');
    expect(html).toContain('internal');
    // evidence_ref resolves through evidence_index to the audit field path
    expect(html).toContain('platforms.google.category_fit_assessment');
  });

  it('marks the primary hook pain per engagement_shape', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('primary hook');
    expect(html).toContain('Lead with:');
    expect(html).toContain('pain');
  });

  it('renders assets with underexposure and how_to_use', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('SNAP/EBT authorization');
    expect(html).toContain('underexposed');
    expect(html).toContain('leverage it');
  });

  it('renders capability fits with the addressed spine ref', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('claim service');
    expect(html).toContain('unclaimed and mislabeled');
    expect(html).toContain('p1');
  });

  it('renders verification gates with blocks and who_can_answer', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('Verification Gates (1)');
    expect(html).toContain('operating hours');
    expect(html).toContain('blocks p3');
    expect(html).toContain('ask owner');
  });

  it('renders do-not-claim prohibitions', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('Do Not Claim (1)');
    expect(html).toContain('Do not claim operating hours');
  });

  it('exposes the evidence index ledger', () => {
    const html = render(auditOf(BRIEF));
    expect(html).toContain('Evidence index (4 refs)');
    expect(html).toContain('gap_analysis.gaps[2]');
  });

  it('degrades gracefully on an empty spine', () => {
    const html = render(
      auditOf({
        brief_version: 1,
        business: { name: 'EMPTY BIZ' },
        evidence_index: {},
        pains: [],
        assets: [],
        capability_fits: [],
        verification_gates: [
          { gate: 'No Pass-1 audit exists', blocks: '', who_can_answer: 'operator', visibility: 'internal' },
        ],
        engagement_shape: { primary_hook_ref: '', lead_with: 'pain', do_not_claim: [] },
      }),
    );
    expect(html).toContain('EMPTY BIZ');
    expect(html).toContain('no ranked spine items');
    expect(html).toContain('No Pass-1 audit exists');
  });
});
