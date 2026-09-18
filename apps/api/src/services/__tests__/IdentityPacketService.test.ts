/**
 * IdentityPacketService — pure assembly tests.
 *
 * Covers:
 *   - tier inference from source names
 *   - platform → field corroboration mapping
 *   - registry corroboration sources boosting required-field scores
 *   - provenance override + SNAP sourcing
 *   - call-verdict override of the audit operational status
 *   - ledger de-duplication
 *   - veto / band behavior with no audit
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../prisma', () => ({ prisma: {} }));
vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  assembleIdentityPacket,
  inferSourceTier,
  type AssembleInput,
} from '../IdentityPacketService';

const campaign = {
  business_name: 'Arsema Market',
  category: 'grocery',
  city: 'Indianapolis',
  state: 'IN',
  address_line1: '123 Main St',
  phone: '317-555-0100',
  website_url: 'https://arsema.example',
};

const strongAudit = {
  created_at: '2026-09-01T00:00:00Z',
  audit_metadata: {
    identity_status: 'confirmed',
    identity_confidence: 'high',
    identity_corroboration_sources: [
      { source: 'Indiana Secretary of State', url: 'https://in.gov/sos' },
      { source: 'USDA SNAP retailer list', url: 'https://usda.gov/snap' },
    ],
  },
  nap_consistency: {
    canonical_name: 'Arsema Market',
    canonical_address: '123 Main St',
    canonical_phone: '317-555-0100',
  },
  platforms: {
    google: {
      displayed_name: 'Arsema Market',
      displayed_address: '123 Main St',
      displayed_phone: '317-555-0100',
      profile_url: 'https://g.page/arsema',
    },
  },
  website: { url: 'https://arsema.example' },
  operational_status: { status: 'active' },
};

const base = (over: Partial<AssembleInput> = {}): AssembleInput => ({
  campaignId: 'camp-1',
  campaign,
  audit: strongAudit,
  ...over,
});

describe('inferSourceTier', () => {
  it('classifies registry/authoritative sources', () => {
    expect(inferSourceTier('Indiana Secretary of State')).toBe('authoritative');
    expect(inferSourceTier('USDA SNAP retailer list')).toBe('authoritative');
    expect(inferSourceTier('SAM.gov')).toBe('authoritative');
  });

  it('classifies aggregators and defaults unknown sources conservatively', () => {
    expect(inferSourceTier('Google Business Profile')).toBe('major_aggregator');
    expect(inferSourceTier('Apple Maps')).toBe('major_aggregator');
    expect(inferSourceTier('Yelp')).toBe('secondary_aggregator');
    expect(inferSourceTier('Some Random Directory')).toBe('secondary_aggregator');
  });
});

describe('assembleIdentityPacket', () => {
  it('recommends push for a registry-corroborated, active business', () => {
    const p = assembleIdentityPacket(base());
    expect(p.identityStatus).toBe('confirmed');
    expect(p.operationalStatus).toBe('active');
    expect(p.score.identityScore).toBe(100);
    expect(p.score.operationalScore).toBe(100);
    expect(p.score.band).toBe('ready');
    expect(p.score.pushRecommended).toBe(true);
  });

  it('de-duplicates the source ledger and lists corroborated fields', () => {
    const p = assembleIdentityPacket(base());
    const google = p.ledger.find((l) => l.name === 'Google Business Profile');
    expect(google).toBeTruthy();
    expect(google!.fields).toContain('name');
    expect(google!.fields).toContain('address');
    expect(google!.fields).toContain('phone');
    // Google appears exactly once in the ledger.
    expect(p.ledger.filter((l) => l.name === 'Google Business Profile')).toHaveLength(1);
  });

  it('lets a call verdict override the audit operational status', () => {
    const p = assembleIdentityPacket(
      base({
        audit: { ...strongAudit, operational_status: { status: 'unable_to_verify' } },
        callConfirmed: true,
      }),
    );
    expect(p.callConfirmed).toBe(true);
    expect(p.score.operationalScore).toBe(100);
  });

  it('blocks on mismatched identity', () => {
    const p = assembleIdentityPacket(
      base({
        audit: {
          ...strongAudit,
          audit_metadata: { ...strongAudit.audit_metadata, identity_status: 'mismatched' },
        },
      }),
    );
    expect(p.score.vetoes.map((v) => v.code)).toContain('identity_mismatch');
    expect(p.score.band).toBe('blocked');
  });

  it('folds provenance rows in and flags unsourced SNAP', () => {
    const p = assembleIdentityPacket(
      base({
        provenance: [
          {
            field_key: 'snap_ebt',
            value: 'yes',
            source_name: 'Category guess',
            evidence_state: 'probable',
          },
        ],
      }),
    );
    expect(p.snapSourced).toBe(false);
    expect(p.score.qcSignals.map((s) => s.code)).toContain('snap_unsourced');
  });

  it('blocks (without vetoing) when there is no audit evidence', () => {
    const p = assembleIdentityPacket(base({ audit: null }));
    expect(p.identityStatus).toBe('ambiguous');
    expect(p.operationalStatus).toBe('unable_to_verify');
    expect(p.score.identityScore).toBe(0);
    expect(p.score.band).toBe('blocked');
  });

  it('carries the linked seed into the packet', () => {
    const p = assembleIdentityPacket(
      base({ seed: { id: 'dps-1', status: 'draft', publicUrl: '/place/arsema-market' } }),
    );
    expect(p.seed).toEqual({ id: 'dps-1', status: 'draft', publicUrl: '/place/arsema-market' });
  });
});
