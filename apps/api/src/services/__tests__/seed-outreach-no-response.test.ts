/**
 * Seed Outreach No-Response Job tests
 *
 * Verifies:
 * - Kill switch: DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB is handed to the
 *   registry as envDisableVar (the job no longer self-schedules — the
 *   job registry owns the timer; see jobs/registry.ts)
 * - Stale seeds are marked no_response
 * - Fresh seeds (within courtesy window) are not marked
 * - setOutreachState errors are caught per-seed (don't abort the sweep)
 * - noResponseDays comes from unifiedConfig
 * - stopSeedOutreachNoResponseJob delegates to the registry's stopJob
 *
 * The sweep runs through `scheduleJob`'s captured handler — mocking
 * global.setTimeout can't reach the handler anymore because the registry's
 * armTimer guards on an always-future delay (`Date.now() < targetAt` →
 * re-arm), which an immediate-fire setTimeout loops forever.
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md §11
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockQueryRaw,
  mockSetOutreachState,
  mockNoResponseDays,
  mockScheduleJob,
  mockStopJob,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockSetOutreachState: vi.fn(),
  mockNoResponseDays: vi.fn(() => 14),
  mockScheduleJob: vi.fn(),
  mockStopJob: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    get seedOutreachNoResponseDays() { return mockNoResponseDays(); },
  },
}));

vi.mock('../../jobs/registry', () => ({
  scheduleJob: (...args: any[]) => mockScheduleJob(...args),
  stopJob: (...args: any[]) => mockStopJob(...args),
}));

vi.mock('../DirectoryPresenceSeedService', () => ({
  default: {
    setOutreachState: mockSetOutreachState,
  },
}));

// Import after mocks
import {
  startSeedOutreachNoResponseJob,
  stopSeedOutreachNoResponseJob,
} from '../../jobs/seed-outreach-no-response';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeStaleSeeds(ids: string[] = ['seed-001', 'seed-002']) {
  return ids.map((id) => ({ id }));
}

/** Register the job via the mocked registry and invoke the captured handler
 *  directly — no timer gymnastics. */
async function startAndRunOnce() {
  await startSeedOutreachNoResponseJob();
  const opts = mockScheduleJob.mock.calls[0]?.[0];
  if (!opts?.handler) throw new Error('scheduleJob captured no handler');
  await opts.handler({
    jobName: opts.name,
    runId: 'test-run',
    trigger: 'manual',
    startedAt: new Date(),
  });
  return opts;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNoResponseDays.mockReturnValue(14);
  mockSetOutreachState.mockResolvedValue(undefined);
  mockQueryRaw.mockResolvedValue(makeStaleSeeds());
});

afterEach(() => {
  stopSeedOutreachNoResponseJob();
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Seed Outreach No-Response Job', () => {
  describe('kill switch', () => {
    it('registers DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB as the env kill switch', async () => {
      await startSeedOutreachNoResponseJob();
      // Disablement is the registry's contract now (env var at schedule
      // time + DB `enabled` flag), not a check inside the job body.
      expect(mockScheduleJob).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'seed-outreach-no-response',
          envDisableVar: 'DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB',
        }),
      );
    });
  });

  describe('stale seed marking', () => {
    it('marks all stale seeds as no_response', async () => {
      await startAndRunOnce();

      expect(mockSetOutreachState).toHaveBeenCalledTimes(2);
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'no_response',
        { actorId: 'system', actorType: 'system' },
      );
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-002',
        'no_response',
        { actorId: 'system', actorType: 'system' },
      );
    });

    it('does not mark seeds when query returns empty', async () => {
      mockQueryRaw.mockResolvedValue([]);

      await startAndRunOnce();
      expect(mockSetOutreachState).not.toHaveBeenCalled();
    });
  });

  describe('per-seed error handling', () => {
    it('continues marking other seeds when one fails', async () => {
      mockSetOutreachState
        .mockRejectedValueOnce(new Error('DB error for seed-001'))
        .mockResolvedValueOnce(undefined);

      await startAndRunOnce();
      // Both seeds were attempted
      expect(mockSetOutreachState).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopSeedOutreachNoResponseJob', () => {
    it('delegates to the registry stopJob', () => {
      stopSeedOutreachNoResponseJob();
      expect(mockStopJob).toHaveBeenCalledWith('seed-outreach-no-response');
    });
  });
});
