import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockPipelines,
  mockPipelineLog,
  mockCampaigns,
} = vi.hoisted(() => ({
  mockPipelines: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockPipelineLog: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  mockCampaigns: { findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
    mkt_review_response_pipeline: mockPipelines,
    mkt_review_response_log: mockPipelineLog,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateReviewResponsePipelineId: () => 'mrrp-test-001',
  generateReviewResponseLogId: () => 'mrrl-test-001',
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    marketingOpsReviewResponseGateUnansweredThreshold: 16,
    marketingOpsReviewResponseGateResponseRateTarget: 90,
    marketingOpsReviewResponseFollowUpCadenceDays: 7,
    marketingOpsReviewResponseStaleThreadCutoffDays: 90,
    marketingOpsReviewResponseSchedulerIntervalHours: 6,
    marketingOpsReviewResponsePlatformPriority: { google: 1, yelp: 2, facebook: 3, other: 4 },
  },
}));

vi.mock('../../middleware/errorHandler', () => ({
  NotFoundError: class NotFoundError extends Error {},
}));

import { ReviewResponseService } from '../ReviewResponseService';

const basePipeline = (overrides: Partial<any> = {}) => ({
  id: 'mrrp-1',
  campaign_id: 'mcamp-1',
  platform: 'google',
  stage: 'responding',
  priority: 1,
  total_reviews: 580,
  unanswered_count: 158,
  response_rate: 72,
  average_rating: 4.7,
  follow_ups_open: 0,
  follow_ups_completed: 0,
  gate_met: false,
  gate_met_at: null,
  next_follow_up_at: null,
  last_activity_at: new Date(),
  stale_thread_cutoff_at: new Date(),
  metadata: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('ReviewResponseService.checkGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelines.update.mockImplementation(({ where, data }: any) =>
      Promise.resolve({ ...basePipeline(), id: where.id, ...data }));
  });

  it('fails gate when unanswered_count exceeds threshold', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ unanswered_count: 158, response_rate: 95, follow_ups_open: 0 }));
    const result = await ReviewResponseService.getInstance().checkGate('mrrp-1');
    expect(result.gateMet).toBe(false);
    expect(result.reasons).toContainEqual(expect.stringContaining('unanswered_count 158'));
  });

  it('fails gate when follow_ups_open > 0', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ unanswered_count: 5, response_rate: 95, follow_ups_open: 3 }));
    const result = await ReviewResponseService.getInstance().checkGate('mrrp-1');
    expect(result.gateMet).toBe(false);
    expect(result.reasons).toContainEqual(expect.stringContaining('follow_ups_open 3'));
  });

  it('fails gate when response_rate below target', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ unanswered_count: 5, response_rate: 72, follow_ups_open: 0 }));
    const result = await ReviewResponseService.getInstance().checkGate('mrrp-1');
    expect(result.gateMet).toBe(false);
    expect(result.reasons).toContainEqual(expect.stringContaining('response_rate 72'));
  });

  it('passes gate when all criteria met', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ unanswered_count: 5, response_rate: 92, follow_ups_open: 0 }));
    const result = await ReviewResponseService.getInstance().checkGate('mrrp-1');
    expect(result.gateMet).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('persists gate_met transition from false to true', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ unanswered_count: 5, response_rate: 92, follow_ups_open: 0, gate_met: false }));
    await ReviewResponseService.getInstance().checkGate('mrrp-1');
    expect(mockPipelines.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mrrp-1' },
        data: expect.objectContaining({ gate_met: true }),
      })
    );
  });
});

describe('ReviewResponseService.advanceStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelines.update.mockImplementation(({ where, data }: any) =>
      Promise.resolve({ ...basePipeline(), id: where.id, ...data }));
  });

  it('advances from backlog to responding when gate met', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ stage: 'backlog', unanswered_count: 5, response_rate: 92, follow_ups_open: 0 }));
    const updated = await ReviewResponseService.getInstance().advanceStage('mrrp-1', false);
    expect(updated.stage).toBe('responding');
  });

  it('refuses to advance when gate not met (no force)', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ stage: 'backlog', unanswered_count: 158, response_rate: 72, follow_ups_open: 5 }));
    await expect(ReviewResponseService.getInstance().advanceStage('mrrp-1', false)).rejects.toThrow();
  });

  it('advances when force=true even if gate not met', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ stage: 'responding', unanswered_count: 158, response_rate: 72, follow_ups_open: 5 }));
    const updated = await ReviewResponseService.getInstance().advanceStage('mrrp-1', true);
    expect(updated.stage).toBe('follow_up');
  });

  it('does not advance past monitoring (terminal)', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ stage: 'monitoring' }));
    const result = await ReviewResponseService.getInstance().advanceStage('mrrp-1', true);
    expect(result.stage).toBe('monitoring');
    expect(mockPipelines.update).not.toHaveBeenCalled();
  });

  it('resets gate_met to false after advancing', async () => {
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ stage: 'backlog', gate_met: true, unanswered_count: 5, response_rate: 92, follow_ups_open: 0 }));
    const updated = await ReviewResponseService.getInstance().advanceStage('mrrp-1', false);
    expect(updated.gate_met).toBe(false);
    expect(updated.gate_met_at).toBeNull();
  });
});

describe('ReviewResponseService.createPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaigns.findUnique.mockResolvedValue({ id: 'mcamp-1' });
    mockPipelines.findUnique.mockResolvedValue(null); // no existing
    mockPipelines.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'mrrp-test-001' }));
  });

  it('creates a new pipeline with platform priority', async () => {
    const pipeline = await ReviewResponseService.getInstance().createPipeline({
      campaignId: 'mcamp-1',
      platform: 'google',
      totalReviews: 580,
      unansweredCount: 158,
      responseRate: 72,
      averageRating: 4.7,
    });
    expect(pipeline.platform).toBe('google');
    expect(pipeline.priority).toBe(1);
    expect(pipeline.stage).toBe('backlog');
    expect(mockPipelines.create).toHaveBeenCalled();
  });

  it('returns existing pipeline if (campaign, platform) already exists (idempotent)', async () => {
    const existing = basePipeline({ id: 'mrrp-existing' });
    mockPipelines.findUnique.mockResolvedValue(existing);
    const pipeline = await ReviewResponseService.getInstance().createPipeline({
      campaignId: 'mcamp-1',
      platform: 'google',
    });
    expect(pipeline.id).toBe('mrrp-existing');
    expect(mockPipelines.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundError if campaign does not exist', async () => {
    mockCampaigns.findUnique.mockResolvedValue(null);
    await expect(ReviewResponseService.getInstance().createPipeline({
      campaignId: 'nope',
      platform: 'google',
    })).rejects.toThrow();
  });
});

describe('ReviewResponseService.logResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelines.findUnique.mockResolvedValue(basePipeline({ unanswered_count: 10 }));
    mockPipelineLog.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'mrrl-test-001' }));
    mockPipelineLog.findFirst.mockResolvedValue(null);
    mockPipelineLog.count.mockResolvedValue(0);
    mockPipelines.update.mockImplementation(({ where, data }: any) => Promise.resolve({ ...basePipeline(), id: where.id, ...data }));
  });

  it('logs a first_response and decrements unanswered_count', async () => {
    await ReviewResponseService.getInstance().logResponse({
      pipelineId: 'mrrp-1',
      responseType: 'first_response',
      responseText: 'Thanks for your review!',
      respondedBy: 'op-1',
    });
    // update should have been called with unanswered_count = 10 - 1 = 9
    const updateCall = mockPipelines.update.mock.calls[0][0];
    expect(updateCall.data.unanswered_count).toBe(9);
  });

  it('does not decrement unanswered_count for follow_up type', async () => {
    await ReviewResponseService.getInstance().logResponse({
      pipelineId: 'mrrp-1',
      responseType: 'follow_up',
    });
    const updateCall = mockPipelines.update.mock.calls[0][0];
    expect(updateCall.data.unanswered_count).toBe(10); // no delta
  });
});

describe('ReviewResponseService.markCustomerReply / closeThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('markCustomerReply increments follow_ups_open', async () => {
    mockPipelineLog.findUnique.mockResolvedValue({ id: 'mrrl-1', pipeline_id: 'mrrp-1', customer_replied: false });
    mockPipelineLog.update.mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data }));
    mockPipelines.update.mockResolvedValue({});
    await ReviewResponseService.getInstance().markCustomerReply('mrrl-1');
    expect(mockPipelines.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mrrp-1' },
        data: expect.objectContaining({ follow_ups_open: { increment: 1 } }),
      })
    );
  });

  it('markCustomerReply is idempotent (already replied)', async () => {
    mockPipelineLog.findUnique.mockResolvedValue({ id: 'mrrl-1', pipeline_id: 'mrrp-1', customer_replied: true });
    const result = await ReviewResponseService.getInstance().markCustomerReply('mrrl-1');
    expect(result.customer_replied).toBe(true);
    expect(mockPipelines.update).not.toHaveBeenCalled();
  });

  it('closeThread decrements follow_ups_open and increments completed', async () => {
    mockPipelineLog.findUnique.mockResolvedValue({ id: 'mrrl-1', pipeline_id: 'mrrp-1', thread_closed: false });
    mockPipelineLog.update.mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data }));
    mockPipelines.update.mockResolvedValue({});
    await ReviewResponseService.getInstance().closeThread('mrrl-1');
    expect(mockPipelines.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          follow_ups_open: { increment: -1 },
          follow_ups_completed: { increment: 1 },
        }),
      })
    );
  });

  it('closeThread is idempotent (already closed)', async () => {
    mockPipelineLog.findUnique.mockResolvedValue({ id: 'mrrl-1', pipeline_id: 'mrrp-1', thread_closed: true });
    const result = await ReviewResponseService.getInstance().closeThread('mrrl-1');
    expect(result.thread_closed).toBe(true);
    expect(mockPipelines.update).not.toHaveBeenCalled();
  });
});
