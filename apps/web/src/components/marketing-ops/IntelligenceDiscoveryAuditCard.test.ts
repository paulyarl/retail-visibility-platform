/**
 * Render tests for IntelligenceDiscoveryAuditCard's scan-contract coverage
 * section (Discovery Scan Contract Spec §3/§7.1).
 *
 * Node-environment vitest — no jsdom. renderToStaticMarkup renders the
 * client component's initial pass (hooks run, no effects needed).
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IntelligenceDiscoveryAuditCard from './IntelligenceDiscoveryAuditCard';

const baseAuditData = (overrides: Record<string, any> = {}) => ({
  intelligence_mode: 'profile',
  category: 'African Grocery',
  city: 'Kansas City',
  state: 'MO',
  focus: 'emerging',
  discovered_businesses: [],
  qualifying_businesses: [],
  candidate_count: 0,
  qualifying_count: 0,
  hold_count: 0,
  ...overrides,
});

const auditOf = (audit_data: any, id = 'audit-1') => ({
  id,
  platform: 'intelligence_discovery',
  audit_data,
  created_at: '2026-09-22T00:00:00Z',
}) as any;

const render = (audit: any, siblingAudits?: any[]) =>
  renderToStaticMarkup(
    createElement(IntelligenceDiscoveryAuditCard, {
      audit,
      campaignId: 'camp-1',
      siblingAudits,
    }),
  );

const cleanContract = {
  contract_version: 'discovery-scan-contract-v1',
  sweep_ledger: [
    {
      unit_id: 'zip:64118',
      unit_type: 'zip_label_matrix',
      status: 'executed_with_findings',
      findings_count: 2,
      platforms_swept: ['google'],
      labels_swept: ['Grocery store'],
      candidate_keys: ['universal-african-market--gladstone-mo'],
    },
    {
      unit_id: 'zip:64119',
      unit_type: 'zip_label_matrix',
      status: 'executed_empty',
      findings_count: 0,
      platforms_swept: ['google'],
      labels_swept: ['Grocery store'],
      candidate_keys: [],
    },
  ],
  coverage_attestation: {
    units_total: 2,
    units_executed: 2,
    units_executed_empty: 1,
    units_not_executed: 0,
    units_blocked: 0,
    vectors_total: 0,
    vectors_not_executed: 0,
    completeness_claim: 'verified_full',
    uncovered_municipalities: [],
    unexecuted_vector_list: [],
  },
  municipality_coverage: [
    { municipality: 'Gladstone, MO', shared_zip: '64118', status: 'covered' },
  ],
  reconciliation: null,
};

describe('IntelligenceDiscoveryAuditCard — scan contract section', () => {
  it('renders unverified for a pre-contract audit (no scan_contract)', () => {
    const html = render(auditOf(baseAuditData()));
    expect(html).toContain('unverified');
    expect(html).toContain('Pre-contract audit');
    expect(html).not.toContain('Sweep ledger');
  });

  it('renders verified_full claim, unit counts, and municipality chips', () => {
    const html = render(auditOf(baseAuditData({ scan_contract: cleanContract })));
    expect(html).toContain('verified full');
    expect(html).toContain('2/2 units executed');
    expect(html).toContain('1 empty');
    expect(html).toContain('Gladstone, MO: covered');
  });

  it('renders the sweep ledger with per-row status', () => {
    const html = render(auditOf(baseAuditData({ scan_contract: cleanContract })));
    expect(html).toContain('Sweep ledger (2 units)');
    expect(html).toContain('zip:64118');
    expect(html).toContain('executed with findings');
    expect(html).toContain('executed empty');
  });

  it('renders contract violations stamped by the import gate', () => {
    const data = baseAuditData({
      scan_contract: cleanContract,
      scan_contract_violations: [
        { invariant: 'INV-3', path: 'scan_contract.sweep_ledger', message: 'Expected ZIP 64120 has no zip_label_matrix row — a mandated sweep unit never opened' },
      ],
    });
    const html = render(auditOf(data));
    expect(html).toContain('1 contract violation');
    expect(html).toContain('INV-3');
    expect(html).toContain('64120');
  });

  it('renders unexecuted vectors with reasons (INV-6 visibility)', () => {
    const contract = {
      ...cleanContract,
      coverage_attestation: {
        ...cleanContract.coverage_attestation,
        completeness_claim: 'verified_partial',
        units_not_executed: 1,
        vectors_not_executed: 1,
        unexecuted_vector_list: [
          { vector: 'yelp × "International grocery" × 64118', reason: 'platform login wall' },
        ],
      },
    };
    const html = render(auditOf(baseAuditData({ scan_contract: contract })));
    expect(html).toContain('verified partial');
    expect(html).toContain('Unexecuted vectors');
    expect(html).toContain('yelp × &quot;International grocery&quot; × 64118');
    expect(html).toContain('platform login wall');
  });

  it('renders reconciliation results with unmatched members flagged', () => {
    const contract = {
      ...cleanContract,
      reconciliation: {
        operator_supplied_members: ['Universal African Market', 'Tawakal Market'],
        matched_to_candidates: ['universal-african-market--gladstone-mo'],
        unmatched: ['Tawakal Market'],
      },
    };
    const html = render(auditOf(baseAuditData({ scan_contract: contract })));
    expect(html).toContain('Reconciliation:');
    expect(html).toContain('1/2 operator-supplied members matched');
    expect(html).toContain('unmatched: Tawakal Market');
    expect(html).toContain('scan missed a real business');
  });

  it('renders focus-pair parity when a sibling audit has the opposite focus', () => {
    const emerging = auditOf(baseAuditData({ scan_contract: cleanContract }), 'audit-emerging');
    const siblingData = baseAuditData({
      focus: 'competitive',
      scan_contract: {
        ...cleanContract,
        coverage_attestation: {
          ...cleanContract.coverage_attestation,
          completeness_claim: 'verified_partial',
          units_not_executed: 3,
        },
      },
    });
    const competitive = auditOf(siblingData, 'audit-competitive');
    const html = render(emerging, [emerging, competitive]);
    expect(html).toContain('Focus parity');
    expect(html).toContain('emerging');
    expect(html).toContain('competitive');
    expect(html).toContain('ledgers disagree; market not green-lit');
  });

  it('no parity block when sibling shares the same focus', () => {
    const a = auditOf(baseAuditData({ scan_contract: cleanContract }), 'a1');
    const sameFocus = auditOf(baseAuditData({ scan_contract: cleanContract }), 'a2');
    const html = render(a, [a, sameFocus]);
    expect(html).not.toContain('Focus parity');
  });
});
