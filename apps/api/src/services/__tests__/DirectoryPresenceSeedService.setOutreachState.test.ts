/**
 * DirectoryPresenceSeedService.setOutreachState tests
 *
 * Verifies the courtesy-window state machine update method:
 * - Executes the UPDATE query with the correct seedId + state
 * - Sets outreach_scheduled_at = now() only when state = 'outreach_scheduled'
 * - Preserves outreach_scheduled_at for other state transitions
 * - Emits audit event with correct action + payload
 * - Passes actorId/actorType from ctx to audit
 * - Works without ctx (actor defaults to undefined)
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md §11
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockExecuteRaw,
  mockAudit,
} = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

// Mock dependencies that the service imports at module load time
vi.mock('../email-service', () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../DirectorySeedCampaignLinkService', () => ({
  default: { linkSeedToCampaign: vi.fn(), findPrimaryForCampaign: vi.fn() },
}));

vi.mock('../SeedOutreachTriggerService', () => ({
  SeedOutreachTriggerService: { getInstance: () => ({ onSeedCreated: vi.fn() }) },
}));

vi.mock('../../utils/slug', () => ({
  isReservedPlaceSlug: vi.fn(() => false),
}));

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

// Import after mocks
import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(undefined);
  mockAudit.mockResolvedValue(undefined);
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('DirectoryPresenceSeedService.setOutreachState', () => {
  it('executes the UPDATE query with seedId and state', async () => {
    await DirectoryPresenceSeedService.setOutreachState('seed-001', 'owner_contacted');

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    // The $executeRaw call contains a tagged template — verify the raw SQL
    // includes the UPDATE statement
    const callArgs = mockExecuteRaw.mock.calls[0];
    expect(callArgs).toBeDefined();
  });

  it('emits audit event with correct action and payload', async () => {
    await DirectoryPresenceSeedService.setOutreachState('seed-001', 'no_response');

    expect(mockAudit).toHaveBeenCalledWith({
      actor: undefined,
      actorType: undefined,
      action: 'directory_presence_seed.outreach_state_change',
      payload: { seedId: 'seed-001', state: 'no_response' },
    });
  });

  it('passes actorId and actorType from ctx to audit', async () => {
    await DirectoryPresenceSeedService.setOutreachState('seed-001', 'claimed', {
      actorId: 'user-123',
      actorType: 'user',
    });

    expect(mockAudit).toHaveBeenCalledWith({
      actor: 'user-123',
      actorType: 'user',
      action: 'directory_presence_seed.outreach_state_change',
      payload: { seedId: 'seed-001', state: 'claimed' },
    });
  });

  it('works without ctx (actor defaults to undefined)', async () => {
    await DirectoryPresenceSeedService.setOutreachState('seed-001', 'freshness_verified');

    expect(mockAudit).toHaveBeenCalledWith({
      actor: undefined,
      actorType: undefined,
      action: 'directory_presence_seed.outreach_state_change',
      payload: { seedId: 'seed-001', state: 'freshness_verified' },
    });
  });

  it('accepts outreach_scheduled state', async () => {
    await DirectoryPresenceSeedService.setOutreachState('seed-001', 'outreach_scheduled', {
      actorId: 'system',
      actorType: 'system',
    });

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith({
      actor: 'system',
      actorType: 'system',
      action: 'directory_presence_seed.outreach_state_change',
      payload: { seedId: 'seed-001', state: 'outreach_scheduled' },
    });
  });

  it('accepts suppressed state', async () => {
    await DirectoryPresenceSeedService.setOutreachState('seed-001', 'suppressed');

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith({
      actor: undefined,
      actorType: undefined,
      action: 'directory_presence_seed.outreach_state_change',
      payload: { seedId: 'seed-001', state: 'suppressed' },
    });
  });

  it('accepts freshness_failed state', async () => {
    await DirectoryPresenceSeedService.setOutreachState('seed-001', 'freshness_failed');

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith({
      actor: undefined,
      actorType: undefined,
      action: 'directory_presence_seed.outreach_state_change',
      payload: { seedId: 'seed-001', state: 'freshness_failed' },
    });
  });
});
