/**
 * OutreachIntelligenceService tests (§8 slice 2)
 *
 * Verifies:
 * - resolveSalutation: all 3 tiers + confidence gating + edge cases
 * - upsert: idempotency, snapshots business_name/address, defaults
 *   linked_audit_reference, server computes salutation (client input ignored)
 * - upsert guardrails: non-business scope → 400, non-primary sibling → 409,
 *   unknown campaign → 404
 * - getForCampaign: direct lookup, sibling inheritance, null when nothing exists
 * - delete: removes row, 404 when not found
 *
 * Spec: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockOi,
  mockCampaigns,
  mockAudit,
} = vi.hoisted(() => ({
  mockOi: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockCampaigns: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_outreach_intelligence: mockOi,
    mkt_campaigns_list: mockCampaigns,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../../lib/id-generator', () => ({
  generateOutreachIntelligenceId: () => 'moi-test001',
}));

vi.mock('../../middleware/errorHandler', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
  },
  ConflictError: class ConflictError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ConflictError'; }
  },
  ValidationError: class ValidationError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ValidationError'; }
  },
}));

// Import after mocks are set up
import { resolveSalutation, OutreachIntelligenceService } from '../OutreachIntelligenceService';
import type { SourcedField } from '../OutreachIntelligenceService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const unavailableField: SourcedField = { value: null, source: null, source_confidence: 'unavailable' };

function makePayload(overrides: Partial<any> = {}) {
  return {
    linked_audit_reference: null,
    prepared_by: 'Test Operator',
    research_date: '2026-08-11',
    owner_name: unavailableField,
    business_email: unavailableField,
    team_signal: { value: 'unknown', quoted_description: null, source: null, source_confidence: 'unavailable' },
    preferred_contact_channel: unavailableField,
    researcher_notes: '',
    ...overrides,
  };
}

function makeCampaign(overrides: Partial<any> = {}) {
  return {
    id: 'mcamp-test001',
    business_name: 'Tetees African Food Market',
    address_line1: '123 Main St',
    address_city: 'Indianapolis',
    address_state: 'IN',
    business_prospect_id: null,
    is_primary_sibling: false,
    scope: 'business',
    mkt_audits_list: [{ id: 'maud-audit001' }],
    ...overrides,
  };
}

function makeOiRow(overrides: Partial<any> = {}) {
  return {
    id: 'moi-test001',
    campaign_id: 'mcamp-test001',
    owner_name: null,
    owner_name_confidence: 'unavailable',
    business_email: null,
    business_email_confidence: 'unavailable',
    team_signal: 'unknown',
    preferred_contact_channel: null,
    recommended_salutation: 'Hi there,',
    research_date: new Date('2026-08-11'),
    prepared_by: 'Test Operator',
    payload: makePayload(),
    created_at: new Date('2026-08-11T10:00:00Z'),
    updated_at: new Date('2026-08-11T10:00:00Z'),
    ...overrides,
  };
}

// ─── resolveSalutation (pure function) ───────────────────────────────────

describe('resolveSalutation', () => {
  describe('Tier 1: owner name', () => {
    it('uses confirmed owner first name', () => {
      const payload = {
        owner_name: { value: 'Maria Garcia', source: 'About page', source_confidence: 'confirmed' },
      };
      expect(resolveSalutation(payload, 'Tetees Market')).toBe('Hi Maria,');
    });

    it('uses inferred_low_risk owner first name', () => {
      const payload = {
        owner_name: { value: 'John Smith', source: 'BBB contact field', source_confidence: 'inferred_low_risk' },
      };
      expect(resolveSalutation(payload, 'Some Business')).toBe('Hi John,');
    });

    it('takes first whitespace-delimited token as first name', () => {
      const payload = {
        owner_name: { value: '  Maria del Carmen  ', source: 'About', source_confidence: 'confirmed' },
      };
      expect(resolveSalutation(payload, null)).toBe('Hi Maria,');
    });

    it('falls through when confidence is unavailable', () => {
      const payload = {
        owner_name: { value: 'Maria Garcia', source: null, source_confidence: 'unavailable' },
      };
      // Should NOT use the name — falls to tier 2 (business name)
      expect(resolveSalutation(payload, 'Tetees Market')).toBe('Hi Tetees Market,');
    });

    it('falls through when value is null', () => {
      const payload = {
        owner_name: { value: null, source: null, source_confidence: 'confirmed' },
      };
      expect(resolveSalutation(payload, 'Tetees Market')).toBe('Hi Tetees Market,');
    });

    it('falls through when value is empty string', () => {
      const payload = {
        owner_name: { value: '   ', source: 'About', source_confidence: 'confirmed' },
      };
      expect(resolveSalutation(payload, 'Tetees Market')).toBe('Hi Tetees Market,');
    });
  });

  describe('Tier 2: business name', () => {
    it('uses business name when owner name is unavailable', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, 'Tetees African Food Market')).toBe('Hi Tetees African Food Market,');
    });

    it('uses business name when owner name is null', () => {
      const payload = {
        owner_name: { value: null, source: null, source_confidence: 'confirmed' },
      };
      expect(resolveSalutation(payload, 'Tetees African Food Market')).toBe('Hi Tetees African Food Market,');
    });

    it('trims business name before greeting', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, '  Spicy Grill  ')).toBe('Hi Spicy Grill,');
    });

    it('rejects business name > 60 chars', () => {
      const payload = { owner_name: unavailableField };
      const longName = 'A'.repeat(61);
      expect(resolveSalutation(payload, longName)).toBe('Hi there,');
    });

    it('rejects business name with no letters (all digits)', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, '1234567890')).toBe('Hi there,');
    });

    it('rejects business name with no letters (all punctuation)', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, '!!!...---')).toBe('Hi there,');
    });

    it('rejects empty business name', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, '')).toBe('Hi there,');
    });

    it('rejects whitespace-only business name', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, '   ')).toBe('Hi there,');
    });

    it('accepts business name at exactly 60 chars', () => {
      const payload = { owner_name: unavailableField };
      const name = 'A'.repeat(59) + 'b'; // 60 chars, has a letter
      expect(resolveSalutation(payload, name)).toBe(`Hi ${name},`);
    });

    it('accepts business name with letters and digits', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, '7-Eleven')).toBe('Hi 7-Eleven,');
    });
  });

  describe('Tier 3: fallback', () => {
    it('returns Hi there, when owner unavailable and business name null', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, null)).toBe('Hi there,');
    });

    it('returns Hi there, when owner unavailable and business name undefined', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, undefined)).toBe('Hi there,');
    });

    it('returns Hi there, when owner unavailable and business name unusable', () => {
      const payload = { owner_name: unavailableField };
      expect(resolveSalutation(payload, '!!!')).toBe('Hi there,');
    });
  });
});

// ─── OutreachIntelligenceService.upsert ──────────────────────────────────

describe('OutreachIntelligenceService.upsert', () => {
  let service: OutreachIntelligenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get a fresh instance via getInstance (singleton, but mocks are reset)
    service = OutreachIntelligenceService.getInstance();
  });

  it('creates a new worksheet with server-computed salutation', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign());
    mockOi.findUnique.mockResolvedValue(null); // no existing row
    mockOi.create.mockResolvedValue(makeOiRow({
      recommended_salutation: 'Hi Maria,',
      owner_name: 'Maria',
      owner_name_confidence: 'confirmed',
    }));

    const result = await service.upsert('mcamp-test001', {
      payload: makePayload({
        owner_name: { value: 'Maria Garcia', source: 'About page', source_confidence: 'confirmed' },
      }),
    });

    expect(result.recommended_salutation).toBe('Hi Maria,');
    expect(mockOi.create).toHaveBeenCalledOnce();
    expect(mockOi.update).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledOnce();
  });

  it('updates an existing worksheet (idempotent upsert)', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign());
    mockOi.findUnique.mockResolvedValue(makeOiRow()); // existing row
    mockOi.update.mockResolvedValue(makeOiRow({ recommended_salutation: 'Hi Maria,' }));

    await service.upsert('mcamp-test001', {
      payload: makePayload({
        owner_name: { value: 'Maria Garcia', source: 'About page', source_confidence: 'confirmed' },
      }),
    });

    expect(mockOi.update).toHaveBeenCalledOnce();
    expect(mockOi.create).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledOnce();
  });

  it('snapshots business_name from the campaign row into payload', async () => {
    const campaign = makeCampaign({ business_name: 'Spicy Grill' });
    mockCampaigns.findUnique.mockResolvedValue(campaign);
    mockOi.findUnique.mockResolvedValue(null);
    mockOi.create.mockResolvedValue(makeOiRow());

    await service.upsert('mcamp-test001', { payload: makePayload() });

    const createCall = mockOi.create.mock.calls[0][0];
    expect(createCall.data.payload.business_name).toBe('Spicy Grill');
  });

  it('snapshots address from the campaign row into payload', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign());
    mockOi.findUnique.mockResolvedValue(null);
    mockOi.create.mockResolvedValue(makeOiRow());

    await service.upsert('mcamp-test001', { payload: makePayload() });

    const createCall = mockOi.create.mock.calls[0][0];
    expect(createCall.data.payload.address).toBe('123 Main St, Indianapolis, IN');
  });

  it('defaults linked_audit_reference to the latest business_analysis audit id', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign());
    mockOi.findUnique.mockResolvedValue(null);
    mockOi.create.mockResolvedValue(makeOiRow());

    await service.upsert('mcamp-test001', {
      payload: makePayload({ linked_audit_reference: undefined }),
    });

    const createCall = mockOi.create.mock.calls[0][0];
    expect(createCall.data.payload.linked_audit_reference).toBe('maud-audit001');
  });

  it('defaults linked_audit_reference to null when no business_analysis audit exists', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({ mkt_audits_list: [] }));
    mockOi.findUnique.mockResolvedValue(null);
    mockOi.create.mockResolvedValue(makeOiRow());

    await service.upsert('mcamp-test001', {
      payload: makePayload({ linked_audit_reference: undefined }),
    });

    const createCall = mockOi.create.mock.calls[0][0];
    expect(createCall.data.payload.linked_audit_reference).toBeNull();
  });

  it('ignores client-supplied recommended_salutation — server value wins', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign());
    mockOi.findUnique.mockResolvedValue(null);
    mockOi.create.mockResolvedValue(makeOiRow());

    // Client tries to inject a salutation — it's not in the UpsertInput type
    // and the service computes it from owner_name + business_name
    await service.upsert('mcamp-test001', {
      payload: makePayload({
        owner_name: { value: 'Maria', source: 'About', source_confidence: 'confirmed' },
      }),
    });

    const createCall = mockOi.create.mock.calls[0][0];
    expect(createCall.data.recommended_salutation).toBe('Hi Maria,');
    expect(createCall.data.payload.recommended_salutation).toBe('Hi Maria,');
  });

  it('derives denormalized columns from the payload', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign());
    mockOi.findUnique.mockResolvedValue(null);
    mockOi.create.mockResolvedValue(makeOiRow());

    await service.upsert('mcamp-test001', {
      payload: makePayload({
        owner_name: { value: 'Maria Garcia', source: 'About', source_confidence: 'confirmed' },
        business_email: { value: 'maria@spicygrill.com', source: 'Contact page', source_confidence: 'confirmed' },
        team_signal: { value: 'sole_owner', quoted_description: 'Solo owner-operator', source: 'About', source_confidence: 'inferred_low_risk' },
        preferred_contact_channel: { value: 'email', source: 'Contact page', source_confidence: 'confirmed' },
      }),
    });

    const createCall = mockOi.create.mock.calls[0][0];
    expect(createCall.data.owner_name).toBe('Maria Garcia');
    expect(createCall.data.owner_name_confidence).toBe('confirmed');
    expect(createCall.data.business_email).toBe('maria@spicygrill.com');
    expect(createCall.data.business_email_confidence).toBe('confirmed');
    expect(createCall.data.team_signal).toBe('sole_owner');
    expect(createCall.data.preferred_contact_channel).toBe('email');
  });

  // ── Guardrails ──────────────────────────────────────────────────────

  it('throws NotFoundError for unknown campaign', async () => {
    mockCampaigns.findUnique.mockResolvedValue(null);

    await expect(
      service.upsert('unknown-campaign', { payload: makePayload() }),
    ).rejects.toThrow('Campaign not found');
  });

  it('throws ValidationError for non-business scope campaigns', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({ scope: 'category' }));

    await expect(
      service.upsert('mcamp-test001', { payload: makePayload() }),
    ).rejects.toThrow('only available for business-scope');
  });

  it('throws ConflictError for non-primary sibling with siblings', async () => {
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({
      business_prospect_id: 'bp-test001',
      is_primary_sibling: false,
    }));
    mockCampaigns.count.mockResolvedValue(1); // has siblings
    mockCampaigns.findMany.mockResolvedValue([
      { id: 'mcamp-primary', is_primary_sibling: true, created_at: new Date() },
    ]);

    await expect(
      service.upsert('mcamp-sibling', { payload: makePayload() }),
    ).rejects.toThrow('primary sibling');
  });

  it('allows write on sole campaign with business_prospect_id but no siblings', async () => {
    // Edge case: business_prospect_id set, is_primary_sibling=false (default),
    // but no other siblings exist → NOT a non-primary sibling, write allowed.
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({
      business_prospect_id: 'bp-test001',
      is_primary_sibling: false,
    }));
    mockCampaigns.count.mockResolvedValue(0); // no siblings
    mockOi.findUnique.mockResolvedValue(null);
    mockOi.create.mockResolvedValue(makeOiRow());

    const result = await service.upsert('mcamp-test001', { payload: makePayload() });
    expect(result).toBeDefined();
    expect(mockOi.create).toHaveBeenCalledOnce();
  });
});

// ─── OutreachIntelligenceService.getForCampaign ──────────────────────────

describe('OutreachIntelligenceService.getForCampaign', () => {
  let service: OutreachIntelligenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = OutreachIntelligenceService.getInstance();
  });

  it('returns the worksheet directly when it exists for the campaign', async () => {
    mockOi.findUnique.mockResolvedValue(makeOiRow());

    const result = await service.getForCampaign('mcamp-test001');

    expect(result).not.toBeNull();
    expect(result!.inherited).toBeUndefined();
    expect(result!.campaign_id).toBe('mcamp-test001');
  });

  it('returns inherited worksheet for non-primary sibling without its own row', async () => {
    // No own worksheet
    mockOi.findUnique
      .mockResolvedValueOnce(null) // own campaign lookup
      .mockResolvedValueOnce(makeOiRow({ campaign_id: 'mcamp-primary' })); // primary's worksheet

    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({
      id: 'mcamp-sibling',
      business_prospect_id: 'bp-test001',
      is_primary_sibling: false,
    }));
    mockCampaigns.findMany.mockResolvedValue([
      { id: 'mcamp-primary', is_primary_sibling: true, created_at: new Date() },
    ]);

    const result = await service.getForCampaign('mcamp-sibling');

    expect(result).not.toBeNull();
    expect(result!.inherited).toBe(true);
    expect(result!.sourceCampaignId).toBe('mcamp-primary');
    expect(result!.campaign_id).toBe('mcamp-primary');
  });

  it('returns null when no worksheet exists and campaign is not a sibling', async () => {
    mockOi.findUnique.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({
      business_prospect_id: null,
    }));

    const result = await service.getForCampaign('mcamp-test001');
    expect(result).toBeNull();
  });

  it('returns null when campaign does not exist', async () => {
    mockOi.findUnique.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue(null);

    const result = await service.getForCampaign('unknown');
    expect(result).toBeNull();
  });

  it('returns null when non-primary sibling but primary has no worksheet either', async () => {
    mockOi.findUnique.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({
      business_prospect_id: 'bp-test001',
      is_primary_sibling: false,
    }));
    mockCampaigns.findMany.mockResolvedValue([
      { id: 'mcamp-primary', is_primary_sibling: true, created_at: new Date() },
    ]);
    // Second findUnique for primary's worksheet returns null
    mockOi.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await service.getForCampaign('mcamp-sibling');
    expect(result).toBeNull();
  });

  it('does not attempt sibling inheritance for category-scope campaigns', async () => {
    mockOi.findUnique.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue(makeCampaign({
      scope: 'category',
      business_prospect_id: 'bp-test001',
      is_primary_sibling: false,
    }));

    const result = await service.getForCampaign('mcamp-test001');
    expect(result).toBeNull();
    // Should not have queried for siblings
    expect(mockCampaigns.findMany).not.toHaveBeenCalled();
  });
});

// ─── OutreachIntelligenceService.delete ──────────────────────────────────

describe('OutreachIntelligenceService.delete', () => {
  let service: OutreachIntelligenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = OutreachIntelligenceService.getInstance();
  });

  it('deletes the worksheet when it exists', async () => {
    mockOi.findUnique.mockResolvedValue(makeOiRow());
    mockOi.delete.mockResolvedValue(makeOiRow());

    await service.delete('mcamp-test001');

    expect(mockOi.delete).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledOnce();
  });

  it('throws NotFoundError when worksheet does not exist', async () => {
    mockOi.findUnique.mockResolvedValue(null);

    await expect(service.delete('mcamp-test001')).rejects.toThrow('not found');
    expect(mockOi.delete).not.toHaveBeenCalled();
  });
});
