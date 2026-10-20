/**
 * SeedCascadeService tests — four-act position + act-3 gate.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));

vi.mock('../../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

import cascadeService from '../SeedCascadeService';

function sqlText(sql: any): string {
  return Array.isArray(sql) ? sql.join('?') : String(sql);
}

const seed = {
  id: 'seed-001',
  tenant_id: 'tenant-001',
  status: 'published',
  outreach_state: 'freshness_verified',
  published_at: new Date('2026-10-01T00:00:00Z'),
  nap_verified_at: new Date('2026-10-02T00:00:00Z'),
  contact_status: 'contactable',
  category: 'grocery',
  city: 'Indianapolis',
  state: 'IN',
  owner_phone: '317-555-0100',
  owner_email: null,
  listing_phone: '317-555-0100',
  listing_email: null,
  business_name: 'Maria’s Market',
};

const announceTouch = {
  id: 'touch-announce',
  channel: 'call',
  outcome: 'announce_delivered',
  notes: null,
  occurred_at: new Date('2026-10-02T00:00:00Z'),
  metadata: {},
};

const painTouch = {
  id: 'touch-pain',
  channel: 'call',
  outcome: 'connected',
  notes: null,
  occurred_at: new Date('2026-10-01T12:00:00Z'),
  metadata: { verification_results: [{ type: 'pain_confirmed' }] },
};

const mailTouch = {
  id: 'touch-mail',
  channel: 'mail',
  outcome: 'no_reply',
  notes: 'postcard',
  occurred_at: new Date('2026-10-03T00:00:00Z'),
  metadata: {},
};

const visitTouch = {
  id: 'touch-visit',
  channel: 'visit',
  outcome: 'connected',
  notes: 'walk-in',
  occurred_at: new Date('2026-10-10T00:00:00Z'),
  metadata: {},
};

const link = {
  campaign_id: 'camp-001',
  link_role: 'primary',
  display_id: 'C-001',
  business_name: 'Maria’s Market',
  stage: 'shown',
};

const gallery = {
  id: 'gallery-001',
  campaign_id: 'camp-001',
  sibling_campaign_id: null,
  event_type: 'gallery_opened',
  screenshot_index: null,
  dwell_ms: null,
  created_at: new Date('2026-10-05T00:00:00Z'),
};

function wire(options: {
  touches?: any[];
  gallery?: any[];
  scans?: any[];
  logs?: any[];
  links?: any[];
}) {
  mockQueryRaw.mockImplementation((sql: any) => {
    const s = sqlText(sql);
    if (s.includes('FROM directory_presence_seeds dps')) return Promise.resolve([seed]);
    if (s.includes('FROM directory_seed_outreach_touches')) {
      return Promise.resolve(options.touches ?? []);
    }
    if (s.includes('FROM directory_seed_campaign_links')) {
      return Promise.resolve(options.links ?? [link]);
    }
    if (s.includes('FROM mkt_outreach_log')) return Promise.resolve(options.logs ?? []);
    if (s.includes('FROM mkt_gallery_events')) return Promise.resolve(options.gallery ?? []);
    if (s.includes('FROM qr_scan_events')) return Promise.resolve(options.scans ?? []);
    return Promise.resolve([]);
  });
}

describe('SeedCascadeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for an unknown seed', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(cascadeService.getSummary('missing')).resolves.toBeNull();
  });

  it('derives all four acts as done when the evidence is present', async () => {
    wire({
      touches: [visitTouch, mailTouch, announceTouch, painTouch],
      gallery: [gallery],
      scans: [],
    });

    const summary = await cascadeService.getSummary('seed-001');
    expect(summary).not.toBeNull();
    expect(summary!.acts.map((a) => a.status)).toEqual(['done', 'done', 'done', 'done']);
    expect(summary!.gate.act1Cleared).toBe(true);
    expect(summary!.gate.act3Cleared).toBe(true);
    expect(summary!.gate.gateCleared).toBe(true);
    expect(summary!.announceDeliveredAt).toBe('2026-10-02T00:00:00.000Z');
    expect(summary!.linkedCampaigns[0].id).toBe('camp-001');
    expect(summary!.timeline.length).toBeGreaterThan(0);
  });

  it('does not clear act 3 on a confirm-page scan alone', async () => {
    wire({
      touches: [mailTouch, announceTouch, painTouch],
      gallery: [],
      scans: [{
        id: 'scan-confirm',
        surface: 'cascade_confirm',
        product_id: 'camp-001',
        created_at: new Date('2026-10-04T00:00:00Z'),
      }],
    });

    const summary = await cascadeService.getSummary('seed-001');
    expect(summary!.gate.act3Cleared).toBe(false);
    expect(summary!.gate.gateCleared).toBe(false);
    expect(summary!.gate.confirmScanAt).toBe('2026-10-04T00:00:00.000Z');
    expect(summary!.gate.reason).toContain('confirm-page');
    expect(summary!.acts[2].status).toBe('in_progress');
    expect(summary!.acts[3].status).toBe('blocked');
  });

  it('flags a missing C3 pain on the act-1 gate', async () => {
    wire({
      touches: [announceTouch],
      gallery: [],
      scans: [],
    });

    const summary = await cascadeService.getSummary('seed-001');
    expect(summary!.gate.act1Cleared).toBe(false);
    expect(summary!.gate.missing.join(' ')).toContain('pain');
    expect(summary!.acts[0].status).toBe('in_progress');
  });
});
