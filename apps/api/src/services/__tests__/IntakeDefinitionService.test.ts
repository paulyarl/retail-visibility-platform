import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockIntakeDefinitions, mockDisputeIntake, mockCampaignsList, mockStageHistory } = vi.hoisted(() => ({
  mockIntakeDefinitions: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  mockDisputeIntake: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  mockCampaignsList: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockStageHistory: { create: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_intake_definitions: mockIntakeDefinitions,
    mkt_dispute_intake: mockDisputeIntake,
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    recoveryIntakeTokenTtlDays: 7,
    recoveryMaxAttachmentBytes: 10 * 1024 * 1024,
    webUrl: 'http://localhost:3000',
  },
}));

vi.mock('../MarketingCategoryToneService', () => ({
  default: { getPresetByCategory: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: { getLabel: vi.fn().mockResolvedValue(null) },
}));

import { intakeDefinitionService, IntakeDefinitionService } from '../intake/IntakeDefinitionService';

// ====================
// FIXTURES
// ====================

const gbpDefinitionRow = {
  intake_kind: 'gbp_optimization',
  label: 'Google Business Profile Optimization',
  description: 'Collect business details for GBP optimization',
  driver: 'registry',
  service_category: null,
  trigger_stages: ['paid', 'delivered'],
  submitted_stage: 'gbp_intake_submitted',
  form_schema: [
    { key: 'business_hours', type: 'hours_grid', label: 'Business Hours', required: true },
    { key: 'services_offered', type: 'chips', label: 'Services Offered', required: true, options: [
      { value: 'repair', label: 'Repair' },
      { value: 'install', label: 'Installation' },
    ]},
    { key: 'service_area', type: 'text', label: 'Service Area', required: false },
  ],
  field_mappings: [],
  owner_copy: { title: 'GBP Optimization Intake', success_message: 'Thanks! We will optimize your profile.' },
  niche_overrides: {},
  downstream_agent: null,
  version: 1,
  is_active: true,
  is_draft: false,
};

const reviewSetupDefinitionRow = {
  intake_kind: 'review_response_setup',
  label: 'Review Response Setup',
  description: 'Collect voice/tone for review responses',
  driver: 'registry',
  service_category: null,
  trigger_stages: ['paid'],
  submitted_stage: 'review_setup_submitted',
  form_schema: [
    { key: 'voice_profile', type: 'object', label: 'Voice Profile', fields: [
      { key: 'tone', type: 'select', label: 'Tone', required: true, options: [
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
      ]},
      { key: 'signature', type: 'text', label: 'Sign-off', required: false },
    ]},
  ],
  field_mappings: [],
  owner_copy: {},
  niche_overrides: {},
  downstream_agent: null,
  version: 1,
  is_active: true,
  is_draft: false,
};

// ====================
// TESTS
// ====================

describe('IntakeDefinitionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton between tests so cache state doesn't leak
    (IntakeDefinitionService as any).instance = null;
  });

  // ─── loadCache + getByKind ──────────────────────────────────────

  describe('getByKind', () => {
    it('returns a definition by intake_kind', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();

      const def = await svc.getByKind('gbp_optimization');

      expect(def).not.toBeNull();
      expect(def?.intake_kind).toBe('gbp_optimization');
      expect(def?.label).toBe('Google Business Profile Optimization');
      expect(def?.driver).toBe('registry');
    });

    it('returns null for an unknown kind', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([]);
      const svc = IntakeDefinitionService.getInstance();

      const def = await svc.getByKind('nonexistent_kind');

      expect(def).toBeNull();
    });

    it('only loads active, non-draft definitions', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();

      await svc.getByKind('gbp_optimization');

      expect(mockIntakeDefinitions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_active: true, is_draft: false },
        }),
      );
    });
  });

  // ─── getDefinitionsForTrigger ───────────────────────────────────

  describe('getDefinitionsForTrigger', () => {
    it('returns registry definitions matching the trigger stage', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow, reviewSetupDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();

      const defs = await svc.getDefinitionsForTrigger('paid');

      expect(defs).toHaveLength(2);
      expect(defs.map((d) => d.intake_kind)).toContain('gbp_optimization');
      expect(defs.map((d) => d.intake_kind)).toContain('review_response_setup');
    });

    it('filters out definitions that do not include the stage', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow, reviewSetupDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();

      const defs = await svc.getDefinitionsForTrigger('delivered');

      // Only gbp_optimization has 'delivered' in trigger_stages
      expect(defs).toHaveLength(1);
      expect(defs[0].intake_kind).toBe('gbp_optimization');
    });

    it('filters by service_category when specified', async () => {
      const nicheScoped = {
        ...gbpDefinitionRow,
        intake_kind: 'gbp_niche',
        service_category: 'plumber',
        trigger_stages: ['paid'],
      };
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow, nicheScoped]);
      const svc = IntakeDefinitionService.getInstance();

      const defs = await svc.getDefinitionsForTrigger('paid', 'plumber');

      // Both match: gbp_optimization (null category = any) + gbp_niche (plumber)
      expect(defs).toHaveLength(2);

      const defsForHVAC = await svc.getDefinitionsForTrigger('paid', 'hvac');
      // Only gbp_optimization (null category = any) matches
      expect(defsForHVAC).toHaveLength(1);
      expect(defsForHVAC[0].intake_kind).toBe('gbp_optimization');
    });

    it('excludes code-driven definitions (dispute, profile_repair)', async () => {
      const codeDriven = {
        ...gbpDefinitionRow,
        intake_kind: 'dispute',
        driver: 'code',
      };
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow, codeDriven]);
      const svc = IntakeDefinitionService.getInstance();

      const defs = await svc.getDefinitionsForTrigger('paid');

      expect(defs).toHaveLength(1);
      expect(defs[0].intake_kind).toBe('gbp_optimization');
    });
  });

  // ─── resolve (niche override) ───────────────────────────────────

  describe('resolve', () => {
    it('returns base definition when no niche override matches', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();

      const def = await svc.resolve('gbp_optimization', 'plumber');

      expect(def?.intake_kind).toBe('gbp_optimization');
      // No niche override applied — form_schema unchanged
      expect(def?.form_schema).toHaveLength(3);
    });

    it('applies niche override add_fields', async () => {
      const withNiche = {
        ...gbpDefinitionRow,
        niche_overrides: {
          plumber: {
            add_fields: [
              { key: 'license_number', type: 'text', label: 'License Number', required: true },
            ],
          },
        },
      };
      mockIntakeDefinitions.findMany.mockResolvedValue([withNiche]);
      const svc = IntakeDefinitionService.getInstance();

      const def = await svc.resolve('gbp_optimization', 'Plumber');

      expect(def?.form_schema).toHaveLength(4);
      expect(def?.form_schema[3].key).toBe('license_number');
    });

    it('applies niche override field_overrides', async () => {
      const withNiche = {
        ...gbpDefinitionRow,
        niche_overrides: {
          plumber: {
            field_overrides: {
              service_area: { label: 'Service Area (city + radius)', help_text: 'e.g. Austin, 25mi' },
            },
          },
        },
      };
      mockIntakeDefinitions.findMany.mockResolvedValue([withNiche]);
      const svc = IntakeDefinitionService.getInstance();

      const def = await svc.resolve('gbp_optimization', 'plumber');

      const serviceAreaField = def?.form_schema.find((f) => f.key === 'service_area');
      expect(serviceAreaField?.label).toBe('Service Area (city + radius)');
      expect(serviceAreaField?.help_text).toBe('e.g. Austin, 25mi');
    });

    it('applies niche override owner_copy_overrides', async () => {
      const withNiche = {
        ...gbpDefinitionRow,
        niche_overrides: {
          plumber: {
            owner_copy_overrides: { title: 'Plumber GBP Intake' },
          },
        },
      };
      mockIntakeDefinitions.findMany.mockResolvedValue([withNiche]);
      const svc = IntakeDefinitionService.getInstance();

      const def = await svc.resolve('gbp_optimization', 'plumber');

      expect(def?.owner_copy.title).toBe('Plumber GBP Intake');
      // Original success_message preserved
      expect(def?.owner_copy.success_message).toBe('Thanks! We will optimize your profile.');
    });
  });

  // ─── buildSubmitSchema (dynamic Zod) ────────────────────────────

  describe('buildSubmitSchema', () => {
    it('builds a schema that validates a valid payload', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();
      const def = await svc.getByKind('gbp_optimization');
      expect(def).not.toBeNull();
      if (!def) return;

      const schema = svc.buildSubmitSchema(def);
      const valid = schema.safeParse({
        token: 'test-token',
        ownerEmail: 'owner@example.com',
        ownerPhone: '+1 (555) 123-4567',
        evidencePayload: {
          business_hours: { monday: { open: '09:00', close: '17:00', closed: false } },
          services_offered: ['repair'],
          service_area: 'Austin, TX',
        },
        attachmentIds: [],
      });

      expect(valid.success).toBe(true);
    });

    it('rejects an invalid email', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();
      const def = await svc.getByKind('gbp_optimization');
      if (!def) return;

      const schema = svc.buildSubmitSchema(def);
      const invalid = schema.safeParse({
        token: 'test-token',
        ownerEmail: 'not-an-email',
        evidencePayload: {},
      });

      expect(invalid.success).toBe(false);
    });

    it('rejects a missing token', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();
      const def = await svc.getByKind('gbp_optimization');
      if (!def) return;

      const schema = svc.buildSubmitSchema(def);
      const invalid = schema.safeParse({
        ownerEmail: 'owner@example.com',
        evidencePayload: {},
      });

      expect(invalid.success).toBe(false);
    });
  });

  // ─── cache invalidation ─────────────────────────────────────────

  describe('invalidateCache', () => {
    it('forces a reload on next access', async () => {
      mockIntakeDefinitions.findMany.mockResolvedValue([gbpDefinitionRow]);
      const svc = IntakeDefinitionService.getInstance();

      await svc.getByKind('gbp_optimization');
      const firstCallCount = mockIntakeDefinitions.findMany.mock.calls.length;

      // Within TTL — no reload
      await svc.getByKind('gbp_optimization');
      expect(mockIntakeDefinitions.findMany.mock.calls.length).toBe(firstCallCount);

      // Invalidate — forces reload
      svc.invalidateCache();
      await svc.getByKind('gbp_optimization');
      expect(mockIntakeDefinitions.findMany.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });
});
