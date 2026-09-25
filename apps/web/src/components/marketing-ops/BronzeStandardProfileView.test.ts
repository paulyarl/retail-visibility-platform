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
    expect(html).toContain('physical retail business with walk-in customer shelves');
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

  it('renders suggested discovery blind spots with category family signal and Add to Catalog button', () => {
    const profileWithSuggestions = {
      ...PROFILE,
      configuration_json: {
        ...(PROFILE.configuration_json as any),
        suggested_reasons: [
          {
            reason_key: 'ethnic_community_classifieds_only',
            proposed_label: 'Exclusively visible on community-specific classifieds',
            proposed_definition: 'Business bypasses mainstream directories; operations exist only in diaspora bulletin boards.',
            observed_signals: ['no platform presence', 'listed in local diaspora directory archive'],
            expected_vectors: ['diaspora business registry'],
            scope_level: 'category_family',
            category_family_applicable: true,
            suggested_category_scope: 'grocery',
            exemplar_lead: {
              business_name: 'Afro-Indy Market',
              discovery_vector: 'diaspora business registry',
              notes: 'Verified operational through community classifieds scan',
            },
          },
        ],
      },
    } as unknown as IntelligenceProfile;

    const rendered = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(BronzeStandardProfileView, { profile: profileWithSuggestions })),
    );

    expect(rendered).toContain('Suggested Discovery Blind Spots');
    expect(rendered).toContain('Exclusively visible on community-specific classifieds');
    expect(rendered).toContain('Category Family: grocery');
    expect(rendered).toContain('Add to Catalog');
    expect(rendered).toContain('Afro-Indy Market');
    expect(rendered).toContain('diaspora business registry');
    expect(rendered).toContain('Suggested Blind Spots');
  });

  it('disables the catalog button when the suggested reason_key already exists', () => {
    // Keys are immutable and never reused — a suggestion whose key collides
    // with a catalog row (here via the embedded snapshot / coverage, and via
    // the not-applicable list) must not offer an "Add to Catalog" POST that
    // can only 409.
    const profileWithCollisions = {
      ...PROFILE,
      configuration_json: {
        ...(PROFILE.configuration_json as any),
        suggested_reasons: [
          {
            reason_key: 'no_mainstream_profile',
            proposed_label: 'No platform profile at all (re-suggested)',
            proposed_definition: 'Analyst re-suggested a reason already in the catalog.',
            scope_level: 'universal',
          },
          {
            reason_key: 'wholesale_or_hybrid_role',
            proposed_label: 'Wholesale or hybrid role (re-suggested)',
            proposed_definition: 'Collides with a key in the not-applicable list.',
            scope_level: 'universal',
          },
        ],
      },
    } as unknown as IntelligenceProfile;

    const rendered = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(BronzeStandardProfileView, { profile: profileWithCollisions })),
    );

    expect(rendered).toContain('Already in Catalog');
    expect(rendered).not.toContain('Add to Catalog');
  });

  it('renders suggested discovery signals with register action and exemplar leads', () => {
    const profileWithSignals = {
      ...PROFILE,
      configuration_json: {
        ...(PROFILE.configuration_json as any),
        suggested_signals: [
          {
            code: 'INT_SEASONAL_OPERATION',
            proposed_label: 'Seasonal Operation',
            proposed_definition: 'Business operates only during part of the year.',
            exemplar_leads: ['Raja Bazaar', 'Mei Hua Market'],
            seen_count: 2,
            source: 'unmatched_signal',
            primary_playbook: 'PB-01',
            secondary_playbook: 'PB-03',
          },
        ],
      },
    } as unknown as IntelligenceProfile;

    const rendered = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(BronzeStandardProfileView, { profile: profileWithSignals })),
    );

    expect(rendered).toContain('Suggested Discovery Signals');
    expect(rendered).toContain('INT_SEASONAL_OPERATION');
    expect(rendered).toContain('Seasonal Operation');
    expect(rendered).toContain('operates only during part of the year');
    expect(rendered).toContain('Raja Bazaar');
    expect(rendered).toContain('Emitted but unregistered');
    expect(rendered).toContain('seen in 2 scans');
    // Proposed playbook wiring renders as review badges (migration 308 pre-wiring).
    expect(rendered).toContain('primary → PB-01');
    expect(rendered).toContain('fallback → PB-03');
    expect(rendered).toContain('Register Signal');
    expect(rendered).toContain('Suggested Signals');
  });

  it('labels reason suggestions synthesized from invented attribution keys', () => {
    const profileWithUnmatched = {
      ...PROFILE,
      configuration_json: {
        ...(PROFILE.configuration_json as any),
        suggested_reasons: [
          {
            reason_key: 'rename_residue_splits_the_discovery_trace',
            proposed_label: 'Rename residue splits the discovery trace',
            proposed_definition: 'Emitted as a bronze_attribution reason_key by a discovery scan — not a catalog reason.',
            source: 'unmatched_attribution',
            seen_count: 1,
          },
        ],
      },
    } as unknown as IntelligenceProfile;

    const rendered = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(BronzeStandardProfileView, { profile: profileWithUnmatched })),
    );

    expect(rendered).toContain('Invented attribution key — not in catalog');
    expect(rendered).toContain('rename_residue_splits_the_discovery_trace');
    expect(rendered).toContain('Add to Catalog');
  });
});
