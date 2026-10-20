/**
 * VAST board tests — PG-scope act positions.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VastBoard, buildVastRow, countVast, type VastRow } from './VastPanel';
import type { ProspectQueueEntry } from '@/services/MarketingOpsService';
import type { SeedCascadeSummary } from '@/services/DirectoryPresenceAdminService';

const entry = (overrides: Partial<ProspectQueueEntry> = {}): ProspectQueueEntry =>
  ({
    id: 'queue-1',
    business_name: 'Maria’s Market',
    title: null,
    status: 'queued',
    seed_id: 'seed-1',
    ...overrides,
  } as unknown as ProspectQueueEntry);

const summary = (acts: Array<'done' | 'in_progress' | 'not_started' | 'blocked'>): SeedCascadeSummary =>
  ({
    seedId: 'seed-1',
    businessName: 'Maria’s Market',
    seedStatus: 'published',
    outreachState: 'owner_contacted',
    publishedAt: '2026-10-01T00:00:00.000Z',
    announceScheduledAt: '2026-10-01T00:00:00.000Z',
    announceDeliveredAt: '2026-10-02T00:00:00.000Z',
    announceChannel: 'call',
    acts: acts.map((status, i) => ({
      act: (i + 1) as 1 | 2 | 3 | 4,
      name: ['Verification', 'Awareness', 'Show', 'Tell'][i],
      status,
      detail: '',
      lastEventAt: null,
    })),
    gate: {
      act1Cleared: acts[0] === 'done',
      act3Cleared: acts[2] === 'done',
      gateCleared: acts[2] === 'done',
      reason: '',
      galleryOpenedAt: null,
      galleryTaggedScanAt: null,
      confirmScanAt: null,
      missing: [],
    },
    linkedCampaigns: [],
    timeline: [],
  } as unknown as SeedCascadeSummary);

const rows: VastRow[] = [
  buildVastRow(entry(), summary(['done', 'in_progress', 'not_started', 'blocked'])),
  buildVastRow(
    entry({
      id: 'queue-2',
      business_name: 'Second Market',
      seed_id: null,
      processed_campaign_id: 'camp-1',
    }),
    null,
  ),
];

describe('buildVastRow', () => {
  it('maps the seeded act statuses and next action', () => {
    const row = buildVastRow(entry(), summary(['done', 'in_progress', 'not_started', 'blocked']));
    expect(row.v).toBe('done');
    expect(row.a).toBe('in_progress');
    expect(row.s).toBe('not_started');
    expect(row.t).toBe('blocked');
    expect(row.nextAction).toBe('Send act-2 postcard');
  });

  it('marks an unseeded prospect as promote-first', () => {
    const row = buildVastRow(entry({ seed_id: null }), null);
    expect(row.v).toBeNull();
    expect(row.nextAction).toBe('Promote to listings');
  });

  it('advances the next action through the acts', () => {
    expect(buildVastRow(entry(), summary(['in_progress', 'not_started', 'not_started', 'blocked'])).nextAction)
      .toBe('Log announce / verify');
    expect(buildVastRow(entry(), summary(['done', 'done', 'in_progress', 'blocked'])).nextAction)
      .toBe('Send gallery email');
    expect(buildVastRow(entry(), summary(['done', 'done', 'done', 'in_progress'])).nextAction)
      .toBe('Schedule walk-in');
    expect(buildVastRow(entry(), summary(['done', 'done', 'done', 'done'])).nextAction)
      .toBe('Complete');
  });
});

describe('countVast', () => {
  it('counts seeded and completed acts', () => {
    expect(countVast(rows)).toEqual({
      total: 2,
      seeded: 1,
      v: 1,
      a: 0,
      s: 0,
      t: 0,
    });
  });
});

describe('VastBoard', () => {
  it('renders the act cards, rows, and unseeded state', () => {
    const html = renderToStaticMarkup(
      createElement(VastBoard, { rows, onLogAnnounce: () => {} }),
    );

    expect(html).toContain('Verification');
    expect(html).toContain('Awareness');
    expect(html).toContain('Show');
    expect(html).toContain('Tell');
    expect(html).toContain('Maria’s Market');
    expect(html).toContain('Second Market');
    expect(html).toContain('No seed (campaign)');
    expect(html).toContain('Promote to listings');
    expect(html).toContain('Log announce');
    expect(html).toContain('Campaign');
    expect(html).toContain('of 1 seeded');
  });

  it('explains the no-seeded state', () => {
    const html = renderToStaticMarkup(
      createElement(VastBoard, { rows: [rows[1]], onLogAnnounce: () => {} }),
    );
    expect(html).toContain('No prospects have been promoted to listings yet.');
    expect(html).toContain('none seeded yet');
  });

  it('renders the empty state', () => {
    const html = renderToStaticMarkup(
      createElement(VastBoard, { rows: [], onLogAnnounce: () => {} }),
    );
    expect(html).toContain('No PG prospects yet.');
  });
});
