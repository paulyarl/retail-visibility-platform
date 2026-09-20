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
import { sourceGroupSlug } from '../directory/identityScoring';
import type { IdentityEvidenceRow } from '../IdentityEvidenceService';

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

/** Operator-entered evidence row (mkt_identity_evidence) for assembly tests. */
const manualRow = (over: Partial<IdentityEvidenceRow> = {}): IdentityEvidenceRow => ({
  id: 'idev-1',
  campaignId: 'camp-1',
  businessProspectId: 'pros-1',
  sourceName: 'Owner phone call',
  sourceUrl: null,
  tier: 'first_party',
  independenceGroup: 'owner-phone-call',
  evidenceState: 'owner_confirmed',
  corroborates: ['name', 'address'],
  ownerName: null,
  ownerPhone: null,
  ownerEmail: null,
  accessedAt: '2026-09-18',
  notes: null,
  createdBy: 'user-1',
  createdAt: '2026-09-18T10:00:00.000Z',
  shared: false,
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

  it('classifies the business audit snake_case slugs correctly', () => {
    // `apple_maps` — the trailing underscore defeats a `\bapple\b` word-boundary.
    expect(inferSourceTier('apple_maps')).toBe('major_aggregator');
    // The owner's own site discovered by the audit is first-party, not an
    // aggregator — falling through to the default mislabels the ledger tier.
    expect(inferSourceTier('official_website')).toBe('first_party');
    expect(inferSourceTier('owner_website')).toBe('first_party');
    // Authoritative slugs must still win over the website/first-party rule.
    expect(inferSourceTier('usda_fns_snap_retailer_listing')).toBe('authoritative');
  });
});

describe('sourceGroupSlug', () => {
  it('maps platform names onto the audit platform keys', () => {
    // A hand-entered "Google Business Profile" must land in the same
    // independence group as the audit's own Google block.
    expect(sourceGroupSlug('Google Business Profile')).toBe('google');
    expect(sourceGroupSlug('Google')).toBe('google');
    expect(sourceGroupSlug('Apple Maps')).toBe('apple');
    expect(sourceGroupSlug('Yelp')).toBe('yelp');
    expect(sourceGroupSlug('Facebook page')).toBe('facebook');
    expect(sourceGroupSlug('Better Business Bureau')).toBe('bbb');
  });

  it('slugs everything else', () => {
    expect(sourceGroupSlug('Indiana Secretary of State')).toBe('indiana-secretary-of-state');
    expect(sourceGroupSlug('Owner phone call')).toBe('owner-phone-call');
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

  it('resolves addressCity/addressState for the Verify record prefill', () => {
    // Structured campaign address wins over audit metadata and market scope.
    const structured = assembleIdentityPacket(
      base({
        campaign: { ...campaign, address_city: 'Carmel', address_state: 'IN' },
        audit: {
          ...strongAudit,
          audit_metadata: {
            ...strongAudit.audit_metadata,
            matched_business: { business_name: 'Arsema Market', city: 'Indianapolis', state: 'IN' },
            requested_business: { business_name: 'Arsema Market', city: 'Indianapolis', state: 'IN' },
          },
        },
      }),
    );
    expect(structured.addressCity).toBe('Carmel');
    expect(structured.addressState).toBe('IN');

    // Audit matched_business fills in when the structured columns are empty.
    const fromAudit = assembleIdentityPacket(
      base({
        audit: {
          ...strongAudit,
          audit_metadata: {
            ...strongAudit.audit_metadata,
            matched_business: { business_name: 'Arsema Market', city: 'Carmel', state: 'IN' },
            requested_business: { business_name: 'Arsema Market', city: 'Indianapolis', state: 'IN' },
          },
        },
      }),
    );
    expect(fromAudit.addressCity).toBe('Carmel');
    expect(fromAudit.addressState).toBe('IN');

    // requested_business when matched is absent; market scope last; null when
    // nothing knows the business's city.
    const fromRequested = assembleIdentityPacket(
      base({
        campaign: { ...campaign, city: null, state: null },
        audit: {
          ...strongAudit,
          audit_metadata: {
            ...strongAudit.audit_metadata,
            requested_business: { business_name: 'Arsema Market', city: 'Gary', state: 'IN' },
          },
        },
      }),
    );
    expect(fromRequested.addressCity).toBe('Gary');

    const fromScope = assembleIdentityPacket(base());
    expect(fromScope.addressCity).toBe('Indianapolis');
    expect(fromScope.addressState).toBe('IN');

    const unknown = assembleIdentityPacket(
      base({ campaign: null, audit: null }),
    );
    expect(unknown.addressCity).toBeNull();
    expect(unknown.addressState).toBeNull();
  });

  it('scores an unaudited business from operator evidence alone', () => {
    // The Identity tab's zero-state: no audit, so nothing is sourced yet.
    const empty = assembleIdentityPacket(base({ audit: null }));
    expect(empty.score.identityScore).toBe(0);
    expect(empty.score.band).toBe('blocked');
    expect(empty.ledger).toHaveLength(0);

    const p = assembleIdentityPacket(
      base({
        audit: null,
        manualEvidence: [
          manualRow({
            sourceName: 'State business registry',
            tier: 'authoritative',
            evidenceState: 'confirmed',
            corroborates: ['name', 'address'],
          }),
        ],
      }),
    );
    expect(p.score.identityScore).toBe(100);
    // A registry alone satisfies only the IDENTITY dimension — but its depth
    // (weight 4) clears the strength bar, so a single strong signal seeds.
    expect(p.score.gate.satisfiedCount).toBe(1);
    expect(p.score.gate.decision).toBe('guaranteed');
    expect(p.score.band).toBe('ready');
    expect(p.ledger.map((l) => l.name)).toEqual(['State business registry']);
    expect(p.ledger[0].manual).toBe(true);
  });

  it('rescues an unaudited business when the operator captures owner confirmation', () => {
    // One weak directory capture (short of earning AND below the strength
    // bar) + an owner_confirmed capture — the owner is the fifth axis, so the
    // seed is rescued.
    const p = assembleIdentityPacket(
      base({
        audit: null,
        manualEvidence: [
          manualRow({
            id: 'idev-dir',
            sourceName: 'Some Directory',
            tier: 'secondary_aggregator',
            evidenceState: 'observed',
            corroborates: ['name', 'address'],
          }),
          manualRow({ id: 'idev-owner', evidenceState: 'owner_confirmed', corroborates: ['name'] }),
        ],
      }),
    );
    expect(p.score.gate.satisfiedCount).toBe(1);
    expect(p.score.gate.guaranteed).toBe(false);
    expect(p.score.gate.ownerOverRule).toBe(true);
    expect(p.score.gate.decision).toBe('rescued');
    expect(p.score.band).toBe('review');
    expect(p.score.pushRecommended).toBe(true);
  });

  it('discounts a manual source that echoes a platform the audit already read', () => {
    // Google-only audit — the manual row below restates what the audit already
    // read, so it must not add a second independent corroboration.
    const googleOnlyAudit = {
      ...strongAudit,
      audit_metadata: { identity_status: 'confirmed' },
    };
    const withEcho = assembleIdentityPacket(
      base({
        audit: googleOnlyAudit,
        manualEvidence: [
          manualRow({
            sourceName: 'Google Business Profile',
            tier: 'major_aggregator',
            // Blank group → the assembler derives it from the source name, and
            // a platform name maps onto the audit's own platform key.
            independenceGroup: '',
            corroborates: ['name', 'address', 'phone'],
          }),
        ],
      }),
    );
    // Same independence group as the audit's Google block → one ledger row,
    // marked as operator-touched, and no extra independent corroboration.
    expect(withEcho.ledger.filter((l) => l.name === 'Google Business Profile')).toHaveLength(1);
    expect(withEcho.ledger.find((l) => l.name === 'Google Business Profile')!.manual).toBe(true);
    const name = withEcho.score.fields.find((f) => f.field === 'name')!;
    expect(name.independentSources).toBe(1);
    // 2 (Google, first in group) + 2 × 0.3 (the echo) — not 2 + 2.
    expect(name.agreementWeight).toBe(2.6);
    expect(name.score).toBe(65);
  });

  it('surfaces the newest captured owner contact without scoring it', () => {
    const p = assembleIdentityPacket(
      base({
        audit: null,
        manualEvidence: [
          manualRow({ id: 'idev-new', ownerName: 'Maria Daree', ownerPhone: '608-555-0100', corroborates: [] }),
          manualRow({ id: 'idev-old', ownerName: 'Old Owner', corroborates: [] }),
        ],
      }),
    );
    expect(p.ownerContact).toEqual({
      name: 'Maria Daree',
      phone: '608-555-0100',
      email: null,
      sourceName: 'Owner phone call',
      evidenceId: 'idev-new',
      capturedAt: '2026-09-18',
    });
    // Owner identity is not an identity field — it never inflates the score.
    expect(p.score.identityScore).toBe(0);
    expect(p.score.fields.every((f) => f.sources.length === 0)).toBe(true);
  });

  it('ignores manual evidence that corroborates nothing', () => {
    const p = assembleIdentityPacket(
      base({ audit: null, manualEvidence: [manualRow({ corroborates: [] })] }),
    );
    expect(p.ledger).toHaveLength(0);
    expect(p.manualEvidence).toHaveLength(1);
  });

  it('treats an operator dispute (owner_disputed) as a disagreement, not agreement', () => {
    // The old `agrees: true` hardcode made every operator row agree. A dispute
    // must count as a disagreement — and owner is an authority for identity, so
    // it is a conflict, not drift.
    const p = assembleIdentityPacket(
      base({
        audit: null,
        manualEvidence: [manualRow({ evidenceState: 'owner_disputed', corroborates: ['name'] })],
      }),
    );
    const name = p.score.fields.find((f) => f.field === 'name')!;
    const manual = name.sources.find((s) => s.manual)!;
    expect(manual.agrees).toBe(false);
    expect(name.conflictWeight).toBeGreaterThan(0);
  });

  it('applies resolved signal weights to platform sources — and leaves others unweighted', () => {
    const p = assembleIdentityPacket(base({ signalWeights: { google: 0.5 } }));
    const google = p.score.fields
      .find((f) => f.field === 'name')!
      .sources.find((s) => s.name === 'Google Business Profile')!;
    expect(google.signalWeight).toBe(0.5);
    // Google 2 × 0.5 = 1 — the operational dimension's strength reflects it.
    const op = p.score.gate.dimensions.find((d) => d.dimension === 'operational')!;
    expect(op.strength).toBe(1);
    // A non-platform source (the registry) gets no weight → scores at 1.
    const registry = p.score.fields
      .flatMap((f) => f.sources)
      .find((s) => s.name === 'Indiana Secretary of State')!;
    expect(registry.signalWeight).toBeUndefined();
  });
});
