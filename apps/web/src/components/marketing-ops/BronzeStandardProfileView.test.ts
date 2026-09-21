/**
 * Render tests for BronzeStandardProfileView.
 *
 * A bronze profile's configuration_json is the `bronze_standard_scan` shape
 * (spec: docs/LocalBiz/BRONZE_STANDARD_SPEC.md §4) — the shape that
 * CategoryProfileView renders as an empty shell. These assertions pin the
 * sections that must appear so a bronze profile never silently falls back to
 * a header-only render.
 *
 * Server-rendered with react-dom/server (Mantine 9 ships pre-compiled CSS
 * modules, so no jsdom/testing-library is needed — the web vitest project runs
 * in a node environment).
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import BronzeStandardProfileView from './BronzeStandardProfileView';
import type { IntelligenceProfile } from '@/services/MarketingOpsService';

const PROFILE = {
  id: 'mip-gco5kyzp',
  category_key: 'african grocery store',
  category_name: 'African Grocery Store',
  version: 1,
  intelligence_focus: 'bronze_standards',
  reference_city: null,
  reference_state: null,
  reference_platform: null,
  status: 'active',
  created_at: '2026-09-21T00:42:36.933Z',
  updated_at: '2026-09-21T00:42:36.933Z',
  configuration_json: {
    category_key: 'african grocery store',
    category_name: 'African Grocery Store',
    catalog_revision: 1,
    reason_coverage: [
      {
        reason_key: 'no_mainstream_profile',
        status: 'filled',
        slots: [
          {
            business_name: 'Daara Salaam Grocery And Halal Meat Inc',
            address: '620 16th Ave S, Minneapolis, MN 55454',
            observed_platform: null,
            category_fit_evidence: 'SNAP-authorized grocery/halal-meat retailer.',
            operational_evidence: 'Active USDA SNAP retailer authorization.',
            operational_status: 'likely_active',
            discovered_by: 'bronze_establishment_scan',
            discovered_via: 'address-indexed datasets',
            evidence_urls: ['https://www.foodstampbalance.net/daara-salaam'],
            digital_quality: 'very_low',
            platform_presence: { yelp: 'not_verified', google: 'not_verified', facebook: 'not_verified' },
          },
        ],
      },
      {
        reason_key: 'community_only_no_reviews',
        status: 'empty_unproven',
        empty_slot_note: 'No exemplar found in this market during this pass.',
      },
    ],
    not_applicable_reasons: ['wholesale_or_hybrid_role'],
    scope_mix: { universal: 15, category: 2, location: 0, category_location: 0, platform_bound: 0 },
    vector_execution_log: [
      { vector: 'platform-presence audit', executed: true, returned: 4 },
      { vector: 'Street View sweep', executed: false, returned: null },
    ],
    catalog_snapshot: [
      {
        reason_key: 'no_mainstream_profile',
        label: 'No platform profile at all',
        definition: 'The business is confirmed operating but has no profile on any mainstream platform.',
        priority: 2,
        provenance: 'derived',
        expected_vectors: ['address-indexed datasets'],
      },
    ],
    prohibited_inferences: ['Low digital quality describes observable online fields only.'],
  },
} as unknown as IntelligenceProfile;

const html = renderToStaticMarkup(
  createElement(MantineProvider, null, createElement(BronzeStandardProfileView, { profile: PROFILE })),
);

describe('BronzeStandardProfileView', () => {
  it('renders the bronze overview with its coverage counts', () => {
    expect(html).toContain('Bronze Standard Profile');
    expect(html).toContain('African Grocery Store');
    expect(html).toContain('Catalog Revision');
    expect(html).toContain('Reasons Filled');
    expect(html).toContain('Exemplar Slots');
    expect(html).toContain('Vectors Executed');
    expect(html).toContain('A slot is a floor, not a ranking');
  });

  it('renders the scope mix by scope level', () => {
    expect(html).toContain('Scope Mix');
    expect(html).toContain('Universal');
    expect(html).toContain('Category + location');
    expect(html).toContain('Platform-bound');
  });

  it('renders a filled reason with its catalog definition, signals, and slot evidence', () => {
    expect(html).toContain('Reason Coverage');
    expect(html).toContain('no_mainstream_profile');
    expect(html).toContain('No platform profile at all');
    expect(html).toContain('Filled');
    expect(html).toContain('Daara Salaam Grocery And Halal Meat Inc');
    expect(html).toContain('620 16th Ave S, Minneapolis, MN 55454');
    expect(html).toContain('Category fit (assortment evidence)');
    expect(html).toContain('Operational evidence');
    expect(html).toContain('Platform presence');
    expect(html).toContain('Very low digital quality');
    expect(html).toContain('Likely active');
    expect(html).toContain('Bronze establishment scan');
    expect(html).toContain('address-indexed datasets');
    expect(html).toContain('https://www.foodstampbalance.net/daara-salaam');
  });

  it('renders empty reasons and the not-applicable list', () => {
    expect(html).toContain('community_only_no_reviews');
    expect(html).toContain('Empty — unproven');
    expect(html).toContain('Not Applicable Reasons');
    expect(html).toContain('wholesale_or_hybrid_role');
  });

  it('renders the vector execution log, catalog snapshot, and prohibited inferences', () => {
    expect(html).toContain('Vector Execution Log');
    expect(html).toContain('platform-presence audit');
    expect(html).toContain('not executed');
    expect(html).toContain('Catalog Snapshot');
    expect(html).toContain('Low digital quality describes observable online fields only.');
    expect(html).toContain('Prohibited Inferences');
  });

  it('keeps empty-slot notes behind the accordion (filled reasons open by default)', () => {
    // Filled reasons are expanded via Accordion defaultValue, so their panels
    // are in the markup; an empty reason's note only renders once the operator
    // expands that item (Accordion keepMounted defaults to false).
    expect(html).not.toContain('No exemplar found in this market during this pass.');
  });
});
