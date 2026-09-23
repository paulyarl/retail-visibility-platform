/**
 * Tests for IdentityPacketCard's verification bridge (buildVerificationEntryFromPacket).
 *
 * Verifies the contract between IdentityPacket and ResolveVerificationModal:
 *   - The synthesized business_snapshot must carry directory_profiles and
 *     social_profiles so the modal prefills them and does not drop them on save.
 *   - Email and owner contact (phone, email) are carried onto the snapshot.
 *   - Captured opening hours are carried onto the snapshot for the hours editor.
 *   - End-to-end integration: the synthesized entry passed to ResolveVerificationModal
 *     renders the stored directory profiles in static markup.
 *
 * Node-environment vitest — no jsdom needed. Uses react-dom/server.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildVerificationEntryFromPacket } from './IdentityPacketCard';
import ResolveVerificationModal from './ResolveVerificationModal';
import type { IdentityPacket } from '@/services/DirectoryPresenceAdminService';

const mockPacket: IdentityPacket = {
  campaignId: 'mcamp-f3rhh2un',
  businessName: 'Baraka Market',
  addressCity: 'Kansas City',
  addressState: 'MO',
  addressZip: '64106',
  businessHours: {
    monday: { open: '10:00', close: '21:00', closed: false },
    timezone: 'America/Chicago',
  },
  email: 'baraka@example.com',
  socialProfiles: [
    { platform: 'Facebook', url: 'https://facebook.com/barakamarket' },
  ],
  directoryProfiles: [
    {
      platform: 'MapQuest',
      url: 'https://www.mapquest.com/us/missouri/baraka-market-264557172',
      claim_status: 'unknown',
    },
  ],
  identityStatus: 'ambiguous',
  operationalStatus: 'unable_to_verify',
  callConfirmed: null,
  snapSourced: true,
  fields: [
    {
      field: 'name',
      value: 'Baraka Market',
      sources: [],
    },
    {
      field: 'address',
      value: '1447 Independence Ave',
      sources: [],
    },
    {
      field: 'phone',
      value: '(816) 666-4170',
      sources: [],
    },
    {
      field: 'website',
      value: 'https://baraka.example',
      sources: [],
    },
    {
      field: 'primary_category',
      value: 'African Grocery Store',
      sources: [],
    },
  ],
  ledger: [],
  manualEvidence: [],
  ownerContact: {
    name: 'Somali Entrepreneur',
    phone: '(816) 555-0100',
    email: 'owner@baraka.example',
    sourceName: 'Owner phone call',
    evidenceId: 'idev-1',
    capturedAt: '2026-09-23T09:16:20.828Z',
  },
  score: {
    identityScore: 88,
    operationalScore: 0,
    band: 'review',
    pushRecommended: true,
    vetoes: [],
    qcSignals: [],
    fields: [],
  },
  seed: null,
  seedDecision: null,
  generatedAt: '2026-09-23T09:16:28.759Z',
};

describe('IdentityPacketCard — Verification Bridge', () => {
  it('synthesizes business_snapshot with directory profiles, social profiles, email, and owner contact', () => {
    const entry = buildVerificationEntryFromPacket('mcamp-f3rhh2un', mockPacket);

    expect(entry.id).toBe('mcamp-f3rhh2un');
    expect(entry.business_name).toBe('Baraka Market');
    expect(entry.category).toBe('African Grocery Store');
    expect(entry.city).toBe('Kansas City');
    expect(entry.state).toBe('MO');

    const snap = entry.business_snapshot;
    expect(snap).toBeDefined();

    // Critical: profile lists carried so the modal prefill is non-empty
    expect(snap?.directory_profiles).toEqual([
      {
        platform: 'MapQuest',
        url: 'https://www.mapquest.com/us/missouri/baraka-market-264557172',
        claim_status: 'unknown',
      },
    ]);
    expect(snap?.social_profiles).toEqual([
      { platform: 'Facebook', url: 'https://facebook.com/barakamarket' },
    ]);
    expect(snap?.email).toBe('baraka@example.com');

    // Verified NAP prefilled
    const nap = snap?.verified_nap;
    expect(nap?.name).toBe('Baraka Market');
    expect(nap?.address).toBe('1447 Independence Ave');
    expect(nap?.phone).toBe('(816) 666-4170');
    expect(nap?.website).toBe('https://baraka.example');
    expect(nap?.category).toBe('African Grocery Store');
    expect(nap?.owner_name).toBe('Somali Entrepreneur');
    expect(nap?.owner_phone).toBe('(816) 555-0100');
    expect(nap?.owner_email).toBe('owner@baraka.example');
    expect(nap?.hours).toEqual(mockPacket.businessHours);
  });

  it('end-to-end: synthesized entry renders MapQuest profile in ResolveVerificationModal enrichment tab', () => {
    const entry = buildVerificationEntryFromPacket('mcamp-f3rhh2un', mockPacket);

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: () => {},
        onResolved: () => {},
        mode: 'campaign',
        initialTab: 'enrichment',
      }),
    );

    // MapQuest platform & URL must be present in the modal inputs
    expect(html).toContain('value="MapQuest"');
    expect(html).toContain(
      'value="https://www.mapquest.com/us/missouri/baraka-market-264557172"',
    );

    // Social profile & owner contact must also be present
    expect(html).toContain('value="Facebook"');
    expect(html).toContain('value="https://facebook.com/barakamarket"');
    expect(html).toContain('value="baraka@example.com"');
    expect(html).toContain('value="Somali Entrepreneur"');
    expect(html).toContain('value="(816) 555-0100"');
    expect(html).toContain('value="owner@baraka.example"');
  });
});
