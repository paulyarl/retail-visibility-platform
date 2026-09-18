/**
 * DirectoryPresenceSeedService — pre-campaign touch recording tests (migration 295)
 *
 * Verifies the call-recording capture on directory_seed_outreach_touches:
 * - addOutreachTouch writes the recording columns + stamps attached_at/by
 *   when a recording is supplied, and leaves them NULL otherwise
 * - the INSERT targets the recording columns (guards against a column typo
 *   silently dropping the recording — the table is CHECK-guarded, so a bad
 *   column or value fails at runtime, not at compile time)
 * - attachTouchRecording updates an existing touch scoped by seed_id
 * - listOutreachTouches selects the recording columns
 *
 * See: database/migrations/295_directory_seed_outreach_touch_recording.sql
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const { mockExecuteRaw, mockQueryRaw, mockAudit } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $executeRaw: mockExecuteRaw, $queryRaw: mockQueryRaw },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({ audit: mockAudit }));

vi.mock('../email-service', () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../DirectorySeedCampaignLinkService', () => ({
  default: { linkSeedToCampaign: vi.fn(), findPrimaryForCampaign: vi.fn() },
}));

vi.mock('../SeedOutreachTriggerService', () => ({
  SeedOutreachTriggerService: { getInstance: () => ({ onSeedCreated: vi.fn() }) },
}));

vi.mock('../../utils/slug', () => ({ isReservedPlaceSlug: vi.fn(() => false) }));

vi.mock('../../lib/id-generator', () => ({
  generateDirectoryListingId: vi.fn(() => 'lst-test'),
  generateDirectoryPresenceSeedId: vi.fn(() => 'seed-test'),
  generateDirectoryFieldProvenanceId: vi.fn(() => 'prov-test'),
  generateDirectoryClaimTokenId: vi.fn(() => 'ct-test'),
  generateDirectoryClaimTokenString: vi.fn(() => 'token-string'),
  generateDirectoryEnrichmentTokenId: vi.fn(() => 'et-test'),
  generateDirectoryEnrichmentTokenString: vi.fn(() => 'enrich-token'),
  generateTenantId: vi.fn(() => 'tnt-test'),
}));

vi.mock('../directory/SeedSeoComposer', () => ({
  buildSeedSeoPacket: vi.fn(() => ({})),
  buildSeoEnrichmentJson: vi.fn(() => ({})),
}));

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  default: { getInstance: () => ({}) },
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

/** Join a tagged-template call's static SQL fragments for substring asserts. */
function sqlOf(call: any[]): string {
  const strings = call[0] as unknown as TemplateStringsArray;
  return Array.isArray(strings) ? strings.join('?') : String(strings);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(undefined);
  mockQueryRaw.mockResolvedValue([{ tenant_id: 'tnt-1' }]);
  mockAudit.mockResolvedValue(undefined);
});

// ─── addOutreachTouch ────────────────────────────────────────────────────

describe('addOutreachTouch — recording capture', () => {
  it('targets the recording columns in the INSERT', async () => {
    await DirectoryPresenceSeedService.addOutreachTouch('seed-001', {
      channel: 'call',
      outcome: 'connected',
      recordingUrl: 'https://recordings.example.com/a.mp3',
      recordingDurationSeconds: 143,
      recordingProvider: 'twilio',
    });

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const sql = sqlOf(mockExecuteRaw.mock.calls[0]);
    expect(sql).toContain('recording_url');
    expect(sql).toContain('recording_duration_seconds');
    expect(sql).toContain('recording_provider');
    expect(sql).toContain('recording_attached_at');
    expect(sql).toContain('recording_attached_by');
  });

  it('flags hasRecording on the audit payload when a recording is supplied', async () => {
    await DirectoryPresenceSeedService.addOutreachTouch(
      'seed-001',
      { channel: 'call', outcome: 'connected', recordingUrl: 'https://r.example.com/a.mp3' },
      { actorId: 'user-9', actorType: 'user' },
    );

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'directory_presence_seed.touch_logged',
        payload: expect.objectContaining({ seedId: 'seed-001', hasRecording: true }),
      }),
    );
  });

  it('leaves the recording columns NULL when no recording is supplied', async () => {
    await DirectoryPresenceSeedService.addOutreachTouch(
      'seed-001',
      { channel: 'call', outcome: 'no_answer' },
      { actorId: 'user-9', actorType: 'user' },
    );

    // Column list is always present (static SQL) — the null-ness is in the
    // bound values, so assert on the interpolated params instead.
    const params = mockExecuteRaw.mock.calls[0].slice(1);
    expect(params).toContain(null);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ hasRecording: false }) }),
    );
  });

  it('throws seed_not_found when the seed does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(
      DirectoryPresenceSeedService.addOutreachTouch('missing', { channel: 'call' }),
    ).rejects.toThrow('seed_not_found');
  });
});

// ─── attachTouchRecording ────────────────────────────────────────────────

describe('attachTouchRecording', () => {
  it('updates the touch scoped by seed_id and returns the id', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'touch-1' }]);

    const result = await DirectoryPresenceSeedService.attachTouchRecording(
      'seed-001',
      'touch-1',
      { recordingUrl: 'https://r.example.com/a.mp3', recordingDurationSeconds: 90, recordingProvider: 'manual' },
      { actorId: 'user-9', actorType: 'user' },
    );

    expect(result).toEqual({ id: 'touch-1' });
    const sql = sqlOf(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('UPDATE directory_seed_outreach_touches');
    expect(sql).toContain('recording_url');
    // Scoped so a touch can't be edited across seeds.
    expect(sql).toContain('seed_id');
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory_presence_seed.touch_recording_attached' }),
    );
  });

  it('throws touch_not_found when the update matches nothing', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(
      DirectoryPresenceSeedService.attachTouchRecording('seed-001', 'nope', { recordingUrl: 'x' }),
    ).rejects.toThrow('touch_not_found');
  });
});

// ─── listOutreachTouches ─────────────────────────────────────────────────

describe('listOutreachTouches', () => {
  it('selects the recording columns', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await DirectoryPresenceSeedService.listOutreachTouches('seed-001');

    const sql = sqlOf(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('recording_url');
    expect(sql).toContain('recording_duration_seconds');
  });
});
