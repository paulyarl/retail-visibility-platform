import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────
// The aggregator is read-only: it reads mkt_prospect_queue (the prospect
// anchor), mkt_campaigns_list (processed + sibling resolution), mkt_outreach_log
// (post-campaign rows), and directory_seed_outreach_touches (pre-campaign
// rows, reached via the DirectoryPresenceSeedService singleton).

const { mockQueue, mockCampaigns, mockOutreachLog, mockSeedTouches, mockListOutreachTouches } =
  vi.hoisted(() => ({
    mockQueue: { findUnique: vi.fn(), findMany: vi.fn() },
    mockCampaigns: { findUnique: vi.fn(), findMany: vi.fn() },
    mockOutreachLog: { findMany: vi.fn(), groupBy: vi.fn() },
    mockSeedTouches: { groupBy: vi.fn() },
    mockListOutreachTouches: vi.fn(),
  }));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_prospect_queue: mockQueue,
    mkt_campaigns_list: mockCampaigns,
    mkt_outreach_log: mockOutreachLog,
    directory_seed_outreach_touches: mockSeedTouches,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../DirectoryPresenceSeedService', () => ({
  default: { listOutreachTouches: mockListOutreachTouches },
}));

import ProspectCommunicationService, { normalizeChannel } from '../ProspectCommunicationService';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const QUEUE_ID = 'pque-001';
const CAMPAIGN_ID = 'mcamp-001';
const SIBLING_ID = 'mcamp-002';
const SEED_ID = 'seed-001';

const queueEntry = (overrides: Partial<any> = {}) => ({
  id: QUEUE_ID,
  business_name: 'Joe Pizza',
  title: 'Joe Pizza',
  category: 'restaurant',
  city: 'Austin',
  state: 'TX',
  status: 'campaign_created',
  priority: 'normal',
  assigned_to: 'uid-1',
  seed_id: SEED_ID,
  processed_campaign_id: CAMPAIGN_ID,
  ...overrides,
});

const campaignRow = (id: string, overrides: Partial<any> = {}) => ({
  id,
  title: id === CAMPAIGN_ID ? 'Joe Pizza — Review' : 'Joe Pizza — Recovery',
  business_name: 'Joe Pizza',
  stage: 'preview_built',
  business_prospect_id: 'bp-001',
  scope: 'business',
  ...overrides,
});

const outreachLog = (overrides: Partial<any> = {}) => ({
  id: 'olog-001',
  campaign_id: CAMPAIGN_ID,
  stage_at_time: 'preview_built',
  contact_channel: 'phone',
  contact_date: new Date('2026-09-10T00:00:00Z'),
  outcome: 'reached',
  follow_up_date: null,
  follow_up_completed_at: null,
  notes: 'Owner interested',
  contacted_by: 'uid-1',
  message_snapshot: null,
  message_subject: null,
  delivery_status: 'sent',
  call_details: { call_result: 'connected' },
  anchor_snapshot: null,
  verification_results: null,
  ...overrides,
});

const seedTouch = (overrides: Partial<any> = {}) => ({
  id: 'touch-001',
  seed_id: SEED_ID,
  channel: 'call',
  outcome: 'connected',
  notes: 'Verified NAP',
  operator_id: 'uid-2',
  occurred_at: new Date('2026-09-01T00:00:00Z'),
  recording_url: null,
  recording_duration_seconds: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCampaigns.findMany.mockResolvedValue([]);
  mockOutreachLog.findMany.mockResolvedValue([]);
  mockListOutreachTouches.mockResolvedValue([]);
});

// ─── Channel normalization ────────────────────────────────────────────────

describe('normalizeChannel', () => {
  it('maps seed-touch channels onto the ecosystem vocabulary', () => {
    expect(normalizeChannel('call')).toBe('phone');
    expect(normalizeChannel('visit')).toBe('in_person');
  });

  it('passes through channels that are already canonical', () => {
    expect(normalizeChannel('email')).toBe('email');
    expect(normalizeChannel('sms')).toBe('sms');
    expect(normalizeChannel('phone')).toBe('phone');
  });

  it('falls back to other for null/undefined', () => {
    expect(normalizeChannel(null)).toBe('other');
    expect(normalizeChannel(undefined)).toBe('other');
  });
});

// ─── getTimeline ──────────────────────────────────────────────────────────

describe('ProspectCommunicationService.getTimeline', () => {
  it('throws NotFoundError when the prospect does not exist', async () => {
    mockQueue.findUnique.mockResolvedValue(null);
    await expect(ProspectCommunicationService.getTimeline(QUEUE_ID)).rejects.toThrow(/not found/i);
  });

  it('merges seed touches and campaign outreach into one descending timeline', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());
    mockCampaigns.findUnique.mockResolvedValue(campaignRow(CAMPAIGN_ID));
    mockCampaigns.findMany.mockResolvedValue([campaignRow(CAMPAIGN_ID)]);
    mockOutreachLog.findMany.mockResolvedValue([outreachLog()]);
    mockListOutreachTouches.mockResolvedValue([seedTouch()]);

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(timeline.events).toHaveLength(2);
    // Newest first — campaign log (Sep 10) before seed touch (Sep 1).
    expect(timeline.events[0].source).toBe('campaign_outreach');
    expect(timeline.events[1].source).toBe('seed_touch');
    // Seed touch channel 'call' is normalized to 'phone'.
    expect(timeline.events[1].channel).toBe('phone');
    expect(timeline.events[1].raw_channel).toBe('call');
    expect(timeline.events[1].outcome_label).toBe('Connected');
  });

  it('folds sibling campaigns sharing a business_prospect_id into the timeline', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());
    mockCampaigns.findUnique.mockResolvedValue(campaignRow(CAMPAIGN_ID));
    mockCampaigns.findMany.mockResolvedValue([
      campaignRow(CAMPAIGN_ID),
      campaignRow(SIBLING_ID),
    ]);
    mockOutreachLog.findMany.mockResolvedValue([
      outreachLog(),
      outreachLog({ id: 'olog-002', campaign_id: SIBLING_ID, outcome: 'no_answer' }),
    ]);

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(mockOutreachLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaign_id: { in: expect.arrayContaining([CAMPAIGN_ID, SIBLING_ID]) } },
      }),
    );
    expect(timeline.campaigns).toHaveLength(2);
    expect(timeline.summary.by_source.campaign_outreach).toBe(2);
  });

  it('computes the summary — last contact, channel breakdown, next open follow-up', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());
    mockCampaigns.findUnique.mockResolvedValue(campaignRow(CAMPAIGN_ID));
    mockCampaigns.findMany.mockResolvedValue([campaignRow(CAMPAIGN_ID)]);
    mockOutreachLog.findMany.mockResolvedValue([
      outreachLog({
        follow_up_date: new Date('2026-09-20T00:00:00Z'),
        follow_up_completed_at: null,
      }),
    ]);
    mockListOutreachTouches.mockResolvedValue([seedTouch()]);

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(timeline.summary.total_events).toBe(2);
    expect(timeline.summary.last_outcome).toBe('Reached');
    expect(timeline.summary.by_channel).toEqual({ phone: 2 });
    expect(timeline.summary.next_follow_up_at).toBe('2026-09-20T00:00:00.000Z');
  });

  it('flags system-generated events (auto follow-ups) and ignores completed follow-ups', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry());
    mockCampaigns.findUnique.mockResolvedValue(campaignRow(CAMPAIGN_ID));
    mockCampaigns.findMany.mockResolvedValue([campaignRow(CAMPAIGN_ID)]);
    mockOutreachLog.findMany.mockResolvedValue([
      outreachLog({
        outcome: 'auto_follow_up_scheduled',
        follow_up_date: new Date('2026-09-05T00:00:00Z'),
        follow_up_completed_at: new Date('2026-09-06T00:00:00Z'),
      }),
    ]);

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(timeline.events[0].system_generated).toBe(true);
    // Completed follow-up does not surface as the next open one.
    expect(timeline.summary.next_follow_up_at).toBeNull();
  });

  it('returns a seed-only timeline for a prospect with no campaign yet', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry({ status: 'queued', processed_campaign_id: null }));
    mockListOutreachTouches.mockResolvedValue([seedTouch()]);

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(mockCampaigns.findUnique).not.toHaveBeenCalled();
    expect(mockOutreachLog.findMany).not.toHaveBeenCalled();
    expect(timeline.events).toHaveLength(1);
    expect(timeline.campaigns).toEqual([]);
  });

  it('surfaces the raw queue snapshot + verification for the resolve modal', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry({
      business_snapshot: { verified_nap: { name: 'Joe Pizza', phone: '512-555-0100' } },
      verification: { requested_at: '2026-09-02T00:00:00.000Z' },
    }));

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(timeline.prospect.business_snapshot).toEqual({
      verified_nap: { name: 'Joe Pizza', phone: '512-555-0100' },
    });
    expect(timeline.prospect.verification).toEqual({ requested_at: '2026-09-02T00:00:00.000Z' });
  });

  // Migration 295 — pre-campaign call recordings live on the seed touch.
  it('surfaces a seed-touch recording url + duration on the timeline event', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry({ status: 'queued', processed_campaign_id: null }));
    mockListOutreachTouches.mockResolvedValue([
      seedTouch({
        recording_url: 'https://recordings.example.com/touch-001.mp3',
        recording_duration_seconds: 143,
      }),
    ]);

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(timeline.events[0].recording_url).toBe('https://recordings.example.com/touch-001.mp3');
    expect(timeline.events[0].recording_duration_seconds).toBe(143);
  });

  it('leaves recording fields null when no recording is attached', async () => {
    mockQueue.findUnique.mockResolvedValue(queueEntry({ status: 'queued', processed_campaign_id: null }));
    mockListOutreachTouches.mockResolvedValue([seedTouch()]);

    const timeline = await ProspectCommunicationService.getTimeline(QUEUE_ID);

    expect(timeline.events[0].recording_url).toBeNull();
    expect(timeline.events[0].recording_duration_seconds).toBeNull();
  });
});

// ─── listProspects ────────────────────────────────────────────────────────

describe('ProspectCommunicationService.listProspects', () => {
  it('rolls up contact counts and last-contact across seed touches and outreach logs', async () => {
    mockQueue.findMany.mockResolvedValue([
      {
        ...queueEntry(),
        mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list: {
          id: CAMPAIGN_ID,
          title: 'Joe Pizza — Review',
          business_name: 'Joe Pizza',
          stage: 'preview_built',
          business_prospect_id: 'bp-001',
        },
      },
    ]);
    mockSeedTouches.groupBy.mockResolvedValue([
      { seed_id: SEED_ID, _count: { _all: 1 }, _max: { occurred_at: new Date('2026-09-01T00:00:00Z') } },
    ]);
    mockOutreachLog.groupBy.mockResolvedValue([
      { campaign_id: CAMPAIGN_ID, _count: { _all: 3 }, _max: { contact_date: new Date('2026-09-10T00:00:00Z') } },
    ]);

    const [prospect] = await ProspectCommunicationService.listProspects({});

    expect(prospect.contact_count).toBe(4);
    expect(prospect.last_contact_at).toBe('2026-09-10T00:00:00.000Z');
    expect(prospect.campaign_id).toBe(CAMPAIGN_ID);
    expect(prospect.business_prospect_id).toBe('bp-001');
  });

  it('returns an empty list without running roll-up queries when there are no entries', async () => {
    mockQueue.findMany.mockResolvedValue([]);
    const result = await ProspectCommunicationService.listProspects({});
    expect(result).toEqual([]);
    expect(mockSeedTouches.groupBy).not.toHaveBeenCalled();
    expect(mockOutreachLog.groupBy).not.toHaveBeenCalled();
  });
});
