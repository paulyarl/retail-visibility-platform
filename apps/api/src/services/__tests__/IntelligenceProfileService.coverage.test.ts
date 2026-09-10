/**
 * IntelligenceProfileService.getCoverage — 7-state slot model tests
 *
 * The coverage map tracks two orthogonal dimensions per slot position:
 *   Establishment: pending → inflight → draft → active   (states 1-4)
 *   Discovery:     pending → inflight → executed         (states 5-7)
 *
 * Regression context: the old model conflated the discovery dimension into
 * the establishment chip (an active profile + discovery campaign rendered
 * "green with an in-flight arrow" forever, even after the campaign executed
 * and imported its audit), and gold-standards platform discovery used a
 * separate 'discovered' status. The new model keeps both dimensions
 * independent so the UI can render the full 7-state flow.
 *
 * Uses the mocked-Prisma pattern from the gold-standard tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  mkt_intelligence_profiles: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  mkt_campaigns_list: {
    findMany: vi.fn(),
  },
  mkt_prompt_executions_list: {
    findMany: vi.fn(),
  },
  mkt_audits_list: {
    findMany: vi.fn(),
  },
};

vi.mock('../BaseService', () => {
  class MockBaseService {
    get prisma() {
      return mockPrisma;
    }
    handleError(error: any, _ctx?: any) {
      return error;
    }
  }
  return { BaseService: MockBaseService };
});

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { IntelligenceProfileService } from '../intelligence/IntelligenceProfileService';

// ─── Fixture data (reset in beforeEach) ─────────────────────────────────

const activeProfiles: any[] = [];
const draftProfiles: any[] = [];
const intelligenceCampaigns: any[] = [];
const provingGrounds: any[] = [];
const pgChildren: any[] = [];
const executedCampaignIds = new Set<string>();
const auditedCampaignIds = new Set<string>();

const makeProfile = (over: Record<string, any> = {}) => ({
  id: 'prof-1',
  version: 1,
  category_key: 'indian_grocery',
  category_name: 'Indian Grocery',
  intelligence_focus: 'emerging',
  reference_city: 'austin',
  reference_state: 'TX',
  reference_platform: null,
  status: 'active',
  ...over,
});

const makeCampaign = (over: Record<string, any> = {}) => ({
  id: 'camp-1',
  category: 'Indian Grocery',
  city: 'austin',
  state: 'TX',
  stage: 'seek',
  intelligence_focus: 'emerging',
  intelligence_platform: null,
  intelligence_campaign_kind: 'discovery',
  ...over,
});

const findSlots = (
  result: any,
  focus: string,
  city: string | null = 'austin',
  platform: string | null = null,
) =>
  result.categories
    .flatMap((c: any) => c.slots)
    .filter((s: any) =>
      s.focus === focus &&
      (s.city ?? '') === (city ?? '') &&
      (s.platform ?? '') === (platform ?? ''));

const findSlot = (
  result: any,
  focus: string,
  city: string | null = 'austin',
  platform: string | null = null,
) => findSlots(result, focus, city, platform)[0];

describe('IntelligenceProfileService.getCoverage — 7-state slot model', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    activeProfiles.length = 0;
    draftProfiles.length = 0;
    intelligenceCampaigns.length = 0;
    provingGrounds.length = 0;
    pgChildren.length = 0;
    executedCampaignIds.clear();
    auditedCampaignIds.clear();

    // getCoverage queries (dispatched by where-clause shape):
    //   mkt_intelligence_profiles.findMany — active + draft profile pulls
    //   mkt_campaigns_list.findMany — intelligence campaigns, PGs, PG children
    //   mkt_prompt_executions_list / mkt_audits_list — execution detection
    mockPrisma.mkt_intelligence_profiles.findMany.mockImplementation(async ({ where }: any) => {
      if (where.status === 'active') return activeProfiles;
      if (where.status === 'draft') return draftProfiles;
      return [];
    });
    mockPrisma.mkt_campaigns_list.findMany.mockImplementation(async ({ where }: any) => {
      if (where.parent_campaign_id) return pgChildren;
      if (where.scope === 'intelligence') return intelligenceCampaigns;
      if (where.scope === 'city') return provingGrounds;
      return [];
    });
    mockPrisma.mkt_prompt_executions_list.findMany.mockImplementation(async ({ where }: any) =>
      (where.campaign_id.in as string[])
        .filter((id) => executedCampaignIds.has(id))
        .map((campaign_id) => ({ campaign_id })));
    mockPrisma.mkt_audits_list.findMany.mockImplementation(async ({ where }: any) =>
      (where.campaign_id.in as string[])
        .filter((id) => auditedCampaignIds.has(id))
        .map((campaign_id) => ({ campaign_id })));

    service = IntelligenceProfileService.getInstance();
  });

  // ─── Establishment dimension (states 1-4) ─────────────────────────────

  it('state 1 — establishment pending: no slot for a position with no campaign and no profile', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-austin' }));
    // A dead campaign still seeds the city dimension, but produces no slot.
    intelligenceCampaigns.push(makeCampaign({
      id: 'camp-h', city: 'houston', intelligence_campaign_kind: 'establishment', stage: 'lost',
    }));
    const result = await service.getCoverage();
    expect(findSlot(result, 'emerging', 'houston')).toBeUndefined();
    expect(result.cities).toContain('houston');
  });

  it('state 2 — establishment in-flight: campaign underway, no profile yet', async () => {
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-est', intelligence_campaign_kind: 'establishment' }));
    const slot = findSlot(await service.getCoverage(), 'emerging');
    expect(slot).toBeDefined();
    expect(slot.status).toBe('inflight');
    expect(slot.profile_id).toBe('camp-est');
    expect(slot.discovery_status).toBe('pending');
    expect(slot.discovery_campaign_id).toBeNull();
  });

  it('state 3 — establishment draft: draft profile awaits activation', async () => {
    draftProfiles.push(makeProfile({ id: 'prof-d', status: 'draft', version: 2 }));
    const slot = findSlot(await service.getCoverage(), 'emerging');
    expect(slot.status).toBe('draft');
    expect(slot.profile_id).toBe('prof-d');
    expect(slot.version).toBe(2);
  });

  it('state 4 — establishment activated: active profile, dormant discovery dimension', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a', version: 3 }));
    const slot = findSlot(await service.getCoverage(), 'emerging');
    expect(slot.status).toBe('active');
    expect(slot.profile_id).toBe('prof-a');
    expect(slot.discovery_status).toBe('pending');
    expect(slot.discovery_campaign_id).toBeNull();
  });

  it('establishment campaign is skipped when a profile already covers the position', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a' }));
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-est', intelligence_campaign_kind: 'establishment' }));
    const slots = findSlots(await service.getCoverage(), 'emerging');
    expect(slots).toHaveLength(1);
    expect(slots[0].status).toBe('active');
    expect(slots[0].profile_id).toBe('prof-a');
  });

  // ─── Discovery dimension (states 5-7) ─────────────────────────────────

  it('state 6 — discovery in-flight: campaign exists, not yet executed (regression: was conflated into the green chip)', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a' }));
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-disc', intelligence_campaign_kind: 'discovery' }));
    const result = await service.getCoverage();
    const slots = findSlots(result, 'emerging');
    expect(slots).toHaveLength(1); // attaches to the active slot — no duplicate slot
    expect(slots[0].status).toBe('active');
    expect(slots[0].discovery_status).toBe('inflight');
    expect(slots[0].discovery_campaign_id).toBe('camp-disc');
  });

  it('state 7 — discovery executed via completed prompt execution', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a' }));
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-disc', intelligence_campaign_kind: 'discovery' }));
    executedCampaignIds.add('camp-disc');
    const slot = findSlot(await service.getCoverage(), 'emerging');
    expect(slot.status).toBe('active');
    expect(slot.discovery_status).toBe('executed');
    expect(slot.discovery_campaign_id).toBe('camp-disc');
  });

  it('state 7 — discovery executed via imported audit (intelligence_discovery)', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a' }));
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-disc', intelligence_campaign_kind: 'discovery' }));
    auditedCampaignIds.add('camp-disc');
    const slot = findSlot(await service.getCoverage(), 'emerging');
    expect(slot.discovery_status).toBe('executed');
  });

  it('competitive discovery execution is detected (detection is not gold-only)', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-c', intelligence_focus: 'competitive' }));
    intelligenceCampaigns.push(makeCampaign({
      id: 'camp-c', intelligence_focus: 'competitive', intelligence_campaign_kind: 'discovery',
    }));
    executedCampaignIds.add('camp-c');
    const slot = findSlot(await service.getCoverage(), 'competitive');
    expect(slot.discovery_status).toBe('executed');
  });

  it('newest discovery campaign claims the position (campaigns arrive created_at desc)', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a' }));
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-new', intelligence_campaign_kind: 'discovery' }));
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-old', intelligence_campaign_kind: 'discovery' }));
    const result = await service.getCoverage();
    const slots = findSlots(result, 'emerging');
    expect(slots).toHaveLength(1);
    expect(slots[0].discovery_campaign_id).toBe('camp-new');
  });

  it('terminal discovery campaigns are not attached', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a' }));
    intelligenceCampaigns.push(makeCampaign({
      id: 'camp-disc', intelligence_campaign_kind: 'discovery', stage: 'closed',
    }));
    auditedCampaignIds.add('camp-disc');
    const slot = findSlot(await service.getCoverage(), 'emerging');
    expect(slot.discovery_status).toBe('pending');
    expect(slot.discovery_campaign_id).toBeNull();
  });

  it('establishment campaign upgrades a pending slot created for a discovery campaign', async () => {
    // Newer discovery campaign processed first creates the pending slot;
    // the older establishment campaign then upgrades it to in-flight.
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-disc', intelligence_campaign_kind: 'discovery' }));
    intelligenceCampaigns.push(makeCampaign({ id: 'camp-est', intelligence_campaign_kind: 'establishment' }));
    const result = await service.getCoverage();
    const slots = findSlots(result, 'emerging');
    expect(slots).toHaveLength(1);
    expect(slots[0].status).toBe('inflight');
    expect(slots[0].profile_id).toBe('camp-est');
    expect(slots[0].discovery_campaign_id).toBe('camp-disc');
  });

  // ─── Gold standards platform slots ────────────────────────────────────

  it('gold — platform discovery executed with no platform profile: pending establishment + executed discovery (replaces old "discovered" status)', async () => {
    activeProfiles.push(makeProfile({
      id: 'prof-all',
      intelligence_focus: 'gold_standards',
      reference_city: null,
      reference_state: null,
      reference_platform: null,
    }));
    intelligenceCampaigns.push(makeCampaign({
      id: 'camp-gold-disc',
      intelligence_focus: 'gold_standards',
      intelligence_campaign_kind: 'discovery',
      intelligence_platform: 'google',
      city: null,
      state: null,
    }));
    auditedCampaignIds.add('camp-gold-disc');
    const result = await service.getCoverage();
    // The google campaign attaches to the google position — the All
    // Platforms slot keeps a dormant discovery dimension.
    const allSlot = findSlot(result, 'gold_standards', null, null);
    expect(allSlot.status).toBe('active');
    expect(allSlot.discovery_status).toBe('pending');
    expect(allSlot.discovery_campaign_id).toBeNull();
    const googleSlot = findSlot(result, 'gold_standards', null, 'google');
    expect(googleSlot.status).toBe('pending');
    expect(googleSlot.discovery_status).toBe('executed');
    expect(googleSlot.discovery_campaign_id).toBe('camp-gold-disc');
  });

  it('gold — platform discovery in-flight with no platform profile: pending establishment + in-flight discovery', async () => {
    intelligenceCampaigns.push(makeCampaign({
      id: 'camp-gold-disc',
      intelligence_focus: 'gold_standards',
      intelligence_campaign_kind: 'discovery',
      intelligence_platform: 'google',
      city: null,
      state: null,
    }));
    const googleSlot = findSlot(await service.getCoverage(), 'gold_standards', null, 'google');
    expect(googleSlot.status).toBe('pending');
    expect(googleSlot.discovery_status).toBe('inflight');
    expect(googleSlot.discovery_campaign_id).toBe('camp-gold-disc');
  });

  // ─── Proving grounds ──────────────────────────────────────────────────

  it('proving-ground slots render as active workspaces with a dormant discovery dimension', async () => {
    activeProfiles.push(makeProfile({ id: 'prof-a' }));
    provingGrounds.push({
      id: 'pg-1', category: 'Indian Grocery', city: 'austin', state: 'TX',
      stage: 'active', title: 'Austin PG',
    });
    const slot = findSlot(await service.getCoverage(), 'proving_ground');
    expect(slot).toBeDefined();
    expect(slot.status).toBe('active');
    expect(slot.profile_id).toBe('pg-1');
    expect(slot.discovery_status).toBe('pending');
    expect(slot.discovery_campaign_id).toBeNull();
  });
});
