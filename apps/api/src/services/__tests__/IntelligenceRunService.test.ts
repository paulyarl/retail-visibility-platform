/**
 * Unit tests for IntelligenceRunService (Sprint 2 — Seek Intelligence Scope).
 *
 * Tests the run tracking service with mocked Prisma:
 *   - createRun — stamps all §41 fields
 *   - listRunsForCampaign — returns runs ordered by created_at
 *   - getRun — returns a single run or null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks that are available inside vi.mock factories
const { mockPrisma, mockLogger } = vi.hoisted(() => {
  const mockPrisma = {
    mkt_intelligence_runs: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { mockPrisma, mockLogger };
});

// Mock id-generator
vi.mock('../../lib/id-generator', () => ({
  generateIntelligenceRunId: vi.fn(() => 'run-test-001'),
}));

// Mock BaseService to inject our prisma mock
vi.mock('../BaseService', () => ({
  BaseService: class {
    protected prisma = mockPrisma;
    protected logger = mockLogger;
    protected handleError(error: any, _ctx?: any) { return error; }
    protected logOperation = vi.fn();
  },
}));

// Mock logger
vi.mock('../../logger', () => ({
  logger: mockLogger,
}));

// Import after mocks are set up
import { IntelligenceRunService } from '../intelligence/IntelligenceRunService';

describe('IntelligenceRunService', () => {
  let service: IntelligenceRunService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = IntelligenceRunService.getInstance();
  });

  it('createRun — stamps all §41 fields', async () => {
    const mockRun = {
      id: 'run-test-001',
      campaign_id: 'camp-1',
      execution_id: 'exec-1',
      profile_id: 'auto_repair_us',
      profile_version: 1,
      intelligence_mode: 'profile',
      focus: 'emerging',
      prompt_version: 3,
      prompt_body_hash: 'abc123',
      candidate_count: 10,
      qualifying_count: 7,
      hold_count: 1,
      metadata: { key: 'value' },
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockPrisma.mkt_intelligence_runs.create.mockResolvedValueOnce(mockRun);

    const run = await service.createRun({
      campaignId: 'camp-1',
      executionId: 'exec-1',
      resolution: { profile_id: 'auto_repair_us', profile_version: 1, intelligence_mode: 'profile' },
      focus: 'emerging',
      promptVersion: 3,
      promptBodyHash: 'abc123',
      candidateCount: 10,
      qualifyingCount: 7,
      holdCount: 1,
      metadata: { key: 'value' },
    });

    expect(run.id).toBe('run-test-001');
    expect(run.campaign_id).toBe('camp-1');
    expect(run.profile_id).toBe('auto_repair_us');
    expect(run.profile_version).toBe(1);
    expect(run.intelligence_mode).toBe('profile');
    expect(run.focus).toBe('emerging');
    expect(run.candidate_count).toBe(10);
    expect(run.qualifying_count).toBe(7);
    expect(run.hold_count).toBe(1);

    // Verify prisma.create was called with the right data
    expect(mockPrisma.mkt_intelligence_runs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'run-test-001',
        campaign_id: 'camp-1',
        execution_id: 'exec-1',
        profile_id: 'auto_repair_us',
        profile_version: 1,
        intelligence_mode: 'profile',
        focus: 'emerging',
        prompt_version: 3,
        prompt_body_hash: 'abc123',
        candidate_count: 10,
        qualifying_count: 7,
        hold_count: 1,
      }),
    });
  });

  it('createRun — intelligence_mode none when no profile', async () => {
    mockPrisma.mkt_intelligence_runs.create.mockResolvedValueOnce({
      id: 'run-test-001',
      intelligence_mode: 'none',
      profile_id: null,
      profile_version: null,
    });

    const run = await service.createRun({
      campaignId: 'camp-1',
      resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      focus: 'competitive',
    });

    expect(run.intelligence_mode).toBe('none');
    expect(run.profile_id).toBeNull();
  });

  it('listRunsForCampaign — returns runs ordered by created_at desc', async () => {
    const mockRuns = [
      { id: 'run-2', campaign_id: 'camp-1', created_at: new Date('2024-01-02') },
      { id: 'run-1', campaign_id: 'camp-1', created_at: new Date('2024-01-01') },
    ];
    mockPrisma.mkt_intelligence_runs.findMany.mockResolvedValueOnce(mockRuns);

    const runs = await service.listRunsForCampaign('camp-1');

    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe('run-2');
    expect(mockPrisma.mkt_intelligence_runs.findMany).toHaveBeenCalledWith({
      where: { campaign_id: 'camp-1' },
      orderBy: { created_at: 'desc' },
    });
  });

  it('getRun — returns run when found', async () => {
    const mockRun = { id: 'run-1', campaign_id: 'camp-1' };
    mockPrisma.mkt_intelligence_runs.findUnique.mockResolvedValueOnce(mockRun);

    const run = await service.getRun('run-1');
    expect(run).not.toBeNull();
    expect(run?.id).toBe('run-1');
  });

  it('getRun — returns null when not found', async () => {
    mockPrisma.mkt_intelligence_runs.findUnique.mockResolvedValueOnce(null);

    const run = await service.getRun('nonexistent');
    expect(run).toBeNull();
  });
});
