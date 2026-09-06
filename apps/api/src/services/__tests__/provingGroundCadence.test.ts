/**
 * Proving Ground cadence + dedup tests — Migration 262 (spec §4.7–§4.9)
 *
 * Covers:
 * - ProvingGroundCadenceService.logTouch: not_seeded guard, cadence map
 *   (dead-channel no-slot, business-day waits, in_thread/dismissed exits,
 *   ladder advance, ladder-exhausted hold), touch cap, hold re-entry
 * - ProvingGroundDedupService.recordVerdict: group-keyed upsert, merge_into
 *   validation, name_variants merge
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueue,
  mockTouches,
  mockSeeds,
  mockVerdicts,
  mockCampaigns,
  mockOutreachLog,
  mockQueryRaw,
  mockExecuteRaw,
} = vi.hoisted(() => ({
  mockQueue: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  mockTouches: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  mockSeeds: { findUnique: vi.fn(), update: vi.fn() },
  mockVerdicts: { upsert: vi.fn(), findMany: vi.fn() },
  mockCampaigns: { findUnique: vi.fn() },
  mockOutreachLog: { create: vi.fn() },
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_prospect_queue: mockQueue,
    directory_seed_outreach_touches: mockTouches,
    directory_presence_seeds: mockSeeds,
    mkt_prospect_dedup_verdicts: mockVerdicts,
    mkt_campaigns_list: mockCampaigns,
    mkt_outreach_log: mockOutreachLog,
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDedupVerdictId: () => 'mpv-test-001',
  generateOutreachLogId: () => 'mol-test-001',
}));

vi.mock('../DirectoryPresenceSeedService', () => ({
  default: {
    addOutreachTouch: vi.fn().mockResolvedValue({ id: 'touch-001' }),
    setOutreachState: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../audit', () => ({ audit: vi.fn() }));

import ProvingGroundCadenceService from '../ProvingGroundCadenceService';
import ProvingGroundDedupService from '../ProvingGroundDedupService';
import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

const seedTouchMock = vi.mocked(DirectoryPresenceSeedService.addOutreachTouch);

// ====================
// CADENCE — logTouch
// ====================

const LADDER = [
  { channel: 'call', contact: '+1608…', evidence: 'yelp listing', status: 'unverified' },
  { channel: 'sms', contact: '+1608…', evidence: 'yelp listing', status: 'unverified' },
  { channel: 'email', contact: 'owner@x.com', evidence: 'website footer', status: 'unverified' },
];

const queueEntry = (overrides: Record<string, any> = {}) => ({
  id: 'pque-001',
  status: 'queued',
  seed_id: 'seed-001',
  channel_sequence: LADDER,
  current_channel_index: 0,
  next_touch_at: null,
  processed_campaign_id: null,
  dismissed_reason: null,
  ...overrides,
});

describe('ProvingGroundCadenceService.logTouch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue.update.mockResolvedValue({});
    mockTouches.count.mockResolvedValue(0);           // no prior consuming touches
    mockTouches.findMany.mockResolvedValue([]);        // no-answer retry counter
    mockSeeds.findUnique.mockResolvedValue({ outreach_state: 'not_started' });
    mockCampaigns.findUnique.mockResolvedValue(null);
    mockOutreachLog.create.mockResolvedValue({});
  });

  it('rejects with not_seeded when the queue row has no seed (409 path)', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry({ seed_id: null }));
    await expect(
      ProvingGroundCadenceService.logTouch('pque-001', { channel: 'call', outcome: 'no_answer' }),
    ).rejects.toThrow(/not_seeded/);
    expect(seedTouchMock).not.toHaveBeenCalled();
  });

  it('bad_number marks the rung dead, advances, and does not consume a slot', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'bad_number',
    });

    // Canonical touch written to the seed.
    expect(seedTouchMock).toHaveBeenCalledWith(
      'seed-001',
      expect.objectContaining({ channel: 'call', outcome: 'bad_number' }),
      undefined,
    );
    // Rung 0 dead, advanced to rung 1 (sms).
    expect(res.currentChannelIndex).toBe(1);
    expect(res.channelSequence[0].status).toBe('dead');
    expect(res.status).toBe('queued');
    // Same-day (0d) — nextTouchAt ~= now.
    expect(res.nextTouchAt).toBeTruthy();
  });

  it('voicemail advances the ladder and waits +3 business days', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'voicemail',
    });

    expect(res.currentChannelIndex).toBe(1);
    const days = Math.round((res.nextTouchAt!.getTime() - Date.now()) / 86400000);
    // 3 business days spans 3–5 calendar days depending on the day of week.
    expect(days).toBeGreaterThanOrEqual(3);
    expect(days).toBeLessThanOrEqual(5);
  });

  it('no_answer stays on the same rung at +1 day', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'no_answer',
    });

    expect(res.currentChannelIndex).toBe(0);
    const days = Math.round((res.nextTouchAt!.getTime() - Date.now()) / 86400000);
    expect(days).toBe(1);
  });

  it('advances after the second consecutive no_answer on the same channel', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());
    // Two consecutive no-answers on 'call' (the just-logged touch + prior).
    mockTouches.findMany.mockResolvedValue([{ outcome: 'no_answer' }, { outcome: 'no_answer' }]);

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'no_answer',
    });

    expect(res.currentChannelIndex).toBe(1);
  });

  it('connected exits cadence to in_thread', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'connected',
    });

    expect(res.status).toBe('in_thread');
    expect(res.nextTouchAt).toBeNull();
  });

  it('not_interested dismisses the prospect', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'not_interested',
    });

    expect(res.status).toBe('dismissed');
    expect(mockQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dismissed_reason: 'bad_fit' }) }),
    );
  });

  it('holds +60d when the ladder is exhausted', async () => {
    mockQueue.findUnique.mockResolvedValue(
      queueEntry({ current_channel_index: 2 }),
    );

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'email', outcome: 'no_reply',
    });

    expect(res.status).toBe('hold');
    const days = Math.round((res.nextTouchAt!.getTime() - Date.now()) / 86400000);
    expect(days).toBe(60);
  });

  it('holds +60d at the 3-touch cap (dead-channel signals excluded)', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());
    mockTouches.count.mockResolvedValue(3); // already 3 consuming touches incl. this one

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'no_answer',
    });

    expect(res.status).toBe('hold');
    const days = Math.round((res.nextTouchAt!.getTime() - Date.now()) / 86400000);
    expect(days).toBe(60);
  });

  it('rejects a hold row whose date has not passed', async () => {
    mockQueue.findUnique.mockResolvedValue(
      queueEntry({ status: 'hold', next_touch_at: new Date(Date.now() + 30 * 86400000) }),
    );

    await expect(
      ProvingGroundCadenceService.logTouch('pque-001', { channel: 'call', outcome: 'no_answer' }),
    ).rejects.toThrow(/on_hold/);
  });

  it('re-enters cadence when a hold row is due', async () => {
    mockQueue.findUnique.mockResolvedValue(
      queueEntry({ status: 'hold', next_touch_at: new Date(Date.now() - 86400000) }),
    );

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'no_answer',
    });

    expect(res.status).toBe('queued');
  });

  it('mail touches wait +10 days and stay on the rung', async () => {
    mockQueue.findUnique.mockResolvedValue(
      queueEntry({ current_channel_index: 2, channel_sequence: [...LADDER, { channel: 'mail', status: 'unverified' }] }),
    );

    const res = await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'mail',
    });

    const days = Math.round((res.nextTouchAt!.getTime() - Date.now()) / 86400000);
    expect(days).toBe(10);
    expect(res.status).toBe('queued');
  });

  it('writes through to the seed outreach_state machine', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());

    await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'connected',
    });

    expect(DirectoryPresenceSeedService.setOutreachState).toHaveBeenCalledWith(
      'seed-001',
      'owner_contacted',
      expect.anything(),
    );
  });

  it('mirrors to mkt_outreach_log when processed_campaign_id exists', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry({ processed_campaign_id: 'mcamp-biz-001' }));
    mockCampaigns.findUnique.mockResolvedValue({ stage: 'seek' });

    await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'connected',
    });

    expect(mockOutreachLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaign_id: 'mcamp-biz-001',
          contact_channel: 'phone',
          outcome: 'reached',
        }),
      }),
    );
  });

  it('does not mirror pre-graduation (no processed_campaign_id)', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());

    await ProvingGroundCadenceService.logTouch('pque-001', {
      channel: 'call', outcome: 'no_answer',
    });

    expect(mockOutreachLog.create).not.toHaveBeenCalled();
  });
});

// ====================
// DEDUP — recordVerdict
// ====================

describe('ProvingGroundDedupService.recordVerdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerdicts.upsert.mockImplementation(({ create }: any) => Promise.resolve(create));
    mockSeeds.findUnique.mockResolvedValue({ name_variants: ['Old Name'] });
    mockQueryRaw.mockResolvedValue([
      { id: 'seed-002', business_name: 'Alt Name', name_variants: ['Alt Name'] },
    ]);
    mockSeeds.update.mockResolvedValue({});
  });

  it('upserts a group-keyed verdict with sorted seed_ids', async () => {
    const row = await ProvingGroundDedupService.recordVerdict({
      seedIds: ['seed-b', 'seed-a'],
      matchKey: 'phone',
      verdict: 'distinct',
      rationale: 'different owners',
    });

    expect(mockVerdicts.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seed_ids_match_key: { seed_ids: ['seed-a', 'seed-b'], match_key: 'phone' } },
      }),
    );
    expect((row as any).verdict).toBe('distinct');
  });

  it('same_entity requires merge_into to be one of the group seeds', async () => {
    await expect(
      ProvingGroundDedupService.recordVerdict({
        seedIds: ['seed-a', 'seed-b'],
        matchKey: 'address_city',
        verdict: 'same_entity',
        mergeInto: 'seed-other',
      }),
    ).rejects.toThrow(/merge_into/);
    expect(mockVerdicts.upsert).not.toHaveBeenCalled();
  });

  it('same_entity merges the other seeds\u2019 identity into the survivor\u2019s name_variants', async () => {
    await ProvingGroundDedupService.recordVerdict({
      seedIds: ['seed-a', 'seed-002'],
      matchKey: 'phone',
      verdict: 'same_entity',
      mergeInto: 'seed-a',
    });

    expect(mockSeeds.update).toHaveBeenCalledWith({
      where: { id: 'seed-a' },
      data: expect.objectContaining({
        name_variants: expect.arrayContaining(['Old Name', 'Alt Name']),
      }),
    });
  });

  it('rejects groups smaller than 2 seeds', async () => {
    await expect(
      ProvingGroundDedupService.recordVerdict({
        seedIds: ['seed-a'],
        matchKey: 'phone',
        verdict: 'distinct',
      }),
    ).rejects.toThrow(/at least 2/);
  });
});
