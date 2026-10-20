/**
 * Render tests for the Four-Act announce queue table.
 *
 * Node-environment vitest — no jsdom. The table is presentational; the page
 * owns the fetch and the mark-delivered call.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AnnounceQueueTable, { ageTone } from './AnnounceQueueTable';
import type { DirectoryAnnounceQueueRow } from '@/services/DirectoryPresenceAdminService';

const row = (overrides: Partial<DirectoryAnnounceQueueRow> = {}): DirectoryAnnounceQueueRow => ({
  seedId: 'seed-001',
  tenantId: 'tenant-001',
  status: 'published',
  businessName: 'Maria’s Market',
  category: 'grocery',
  city: 'Indianapolis',
  state: 'IN',
  publishedAt: '2026-10-01T00:00:00.000Z',
  ageDays: 21,
  announceScheduledAt: '2026-10-01T00:00:00.000Z',
  channel: 'call',
  claimUrl: 'https://example.com/place/claim/TOKEN',
  placeUrl: 'https://example.com/place/marias-market',
  ownerPhone: '317-555-0100',
  ownerEmail: null,
  listingPhone: '317-555-0100',
  listingEmail: null,
  ...overrides,
});

const render = (rows: DirectoryAnnounceQueueRow[]) =>
  renderToStaticMarkup(
    createElement(AnnounceQueueTable, { rows, onMarkAnnounced: () => {} }),
  );

describe('AnnounceQueueTable', () => {
  it('renders the seed, age, channel, links, and action', () => {
    const html = render([row()]);

    expect(html).toContain('Maria’s Market');
    expect(html).toContain('grocery');
    expect(html).toContain('Indianapolis, IN');
    expect(html).toContain('21d');
    expect(html).toContain('call');
    expect(html).toContain('href="https://example.com/place/claim/TOKEN"');
    expect(html).toContain('href="https://example.com/place/marias-market"');
    expect(html).toContain('Mark announced');
  });

  it('renders the empty state', () => {
    const html = render([]);
    expect(html).toContain('No published seeds are awaiting an announce.');
  });

  it('flags a seed with no claim token', () => {
    const html = render([row({ claimUrl: null })]);
    expect(html).toContain('No claim token');
    expect(html).not.toContain('href="https://example.com/place/claim/TOKEN"');
  });
});

describe('ageTone', () => {
  it('escalates at the 14-day and 21-day thresholds', () => {
    expect(ageTone(13)).toContain('text-gray-700');
    expect(ageTone(14)).toContain('text-amber-600');
    expect(ageTone(21)).toContain('text-red-600');
    expect(ageTone(null)).toContain('text-gray-500');
  });
});
