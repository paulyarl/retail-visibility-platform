/**
 * ManualPlayTemplateAuthoring tests — "Save as template" (Part 1) +
 * merge-context / free-variable merge (Part 2).
 *
 * Verifies (spec docs/LocalBiz/MANUAL_PLAY_TEMPLATE_AUTHORING_SPEC.md):
 * - resolveTemplate: catalog hit, operator hit, archived hit, miss → null
 * - createTemplate: valid create, key collision vs catalog + vs row → 409,
 *   invalid key/role/anchor_type/hook_angle → 400, auto-slug from label
 * - upsert doc: new doc under archived key → 400; existing doc saves
 * - listTemplatesForCampaign: merge order, source/saved/suggested flags,
 *   archived hidden unless saved
 * - archiveTemplate → status flip; catalog key → 400
 * - mergeContextForCampaign returns global keys; free-var round trip —
 *   extra fields keys resolve {{key}} in resolved_body, empty/missing
 *   keys stay literal; fields shadow globals (pinned, §9.6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockGetCampaign,
  mockGetTriageResult,
  mockGetForCampaign,
  mockQueryRawUnsafe,
  mockExecuteRawUnsafe,
  mockUsersFindUnique,
  mockAudit,
  mockQueryRaw,
  mockGetClaimKitMeta,
  mockGetReportKitMeta,
} = vi.hoisted(() => ({
  mockGetCampaign: vi.fn(),
  mockGetTriageResult: vi.fn(),
  mockGetForCampaign: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockUsersFindUnique: vi.fn(),
  mockAudit: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockGetClaimKitMeta: vi.fn(),
  mockGetReportKitMeta: vi.fn(),
}));

vi.mock('../MarketingCampaignService', () => ({
  default: { getCampaign: mockGetCampaign },
}));

vi.mock('../CampaignTriageService', () => ({
  default: { getTriageResult: mockGetTriageResult },
}));

vi.mock('../OutreachIntelligenceService', () => ({
  default: { getForCampaign: mockGetForCampaign },
  resolveSalutation: () => 'Hi there,',
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    $queryRaw: mockQueryRaw,
    users: { findUnique: mockUsersFindUnique },
  },
}));

// The shared outreach-link resolver (§5.1) resolves claim/report QR URLs
// through these two kit services.
vi.mock('../ClaimInviteQrKitService', () => ({
  getClaimInviteKitMeta: mockGetClaimKitMeta,
}));

vi.mock('../intelligence/SeedReportDeliveryService', () => ({
  default: { getReportKitMeta: mockGetReportKitMeta },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: { frontendUrl: 'https://app.test', webUrl: '' },
}));

vi.mock('../../middleware/errorHandler', () => ({
  HttpError: class HttpError extends Error {},
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

vi.mock('../../lib/id-generator', () => ({
  generateManualScriptId: () => 'mms-test0001',
  generateManualPlayTemplateId: () => 'mptpl-test001',
}));

// Import after mocks
import ManualOutreachScriptService from '../ManualOutreachScriptService';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeCampaign(overrides: Partial<any> = {}) {
  return {
    id: 'mcamp-test01',
    business_name: 'Patel Brothers',
    city: 'Edison',
    service_category: 'Indian Grocery Stores',
    assigned_to: 'Alex Operator',
    address_line1: '100 Oak Tree Ave',
    address_city: 'Edison',
    address_state: 'NJ',
    ...overrides,
  };
}

function makeOperatorRow(overrides: Partial<any> = {}) {
  return {
    id: 'mptpl-row0001',
    key: 'op_indian_grocery_whatsapp',
    label: 'Indian grocery WhatsApp play',
    description: 'Niche-tuned availability upsell',
    anchor_type: 'customer_discovery_problem',
    hook_angle: 'availability_inquiry',
    suggested_when_signal: 'WC_MISSING_AVAILABILITY_INQUIRY',
    fields: [
      { key: 'observed_gap', label: 'Observed gap', role: 'thesis', placeholder: '', defaultValue: 'no stock check' },
      { key: 'opener_text', label: 'Opener', role: 'opener', placeholder: '', defaultValue: 'hi' },
    ],
    script_body: 'Call {{business}} about {{observed_gap}}.',
    status: 'active',
    created_from_campaign_id: 'mcamp-test01',
    created_from_template_key: 'whatsapp_availability_upsell',
    created_by: 'alex',
    updated_by: 'alex',
    created_at: '2026-09-16T00:00:00Z',
    updated_at: '2026-09-16T00:00:00Z',
    ...overrides,
  };
}

const VALID_INPUT = {
  label: 'Indian grocery WhatsApp play',
  description: 'Niche-tuned availability upsell',
  anchor_type: 'customer_discovery_problem',
  hook_angle: 'availability_inquiry',
  fields: [
    { key: 'observed_gap', label: 'Observed gap', role: 'thesis' as const, placeholder: '', defaultValue: 'no stock check' },
  ],
  script_body: 'Call {{business}} about {{observed_gap}}.',
};

// queryRawUnsafe is called for several distinct statements; dispatch on SQL.
function queueSelects(map: { match: string; rows: any[] }[]) {
  mockQueryRawUnsafe.mockImplementation(async (sql: string) => {
    for (const { match, rows } of map) {
      if (sql.includes(match)) return rows;
    }
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCampaign.mockResolvedValue(makeCampaign());
  mockGetTriageResult.mockResolvedValue({
    detectedSignals: [{ code: 'WC_MISSING_AVAILABILITY_INQUIRY' }],
  });
  mockGetForCampaign.mockRejectedValue(new Error('no worksheet'));
  mockUsersFindUnique.mockResolvedValue(null);
  mockExecuteRawUnsafe.mockResolvedValue(0);
  mockQueryRaw.mockResolvedValue([]);
  mockGetClaimKitMeta.mockResolvedValue(null);
  mockGetReportKitMeta.mockResolvedValue(null);
});

// ─── resolveTemplate ─────────────────────────────────────────────────────

describe('resolveTemplate', () => {
  it('returns catalog template with source=catalog without hitting the DB', async () => {
    const t = await ManualOutreachScriptService.resolveTemplate('whatsapp_availability_upsell');
    expect(t?.source).toBe('catalog');
    expect(t?.key).toBe('whatsapp_availability_upsell');
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('returns an operator row mapped to the ManualPlayTemplate shape', async () => {
    queueSelects([{ match: 'FROM mkt_manual_play_templates', rows: [makeOperatorRow()] }]);
    const t = await ManualOutreachScriptService.resolveTemplate('op_indian_grocery_whatsapp');
    expect(t?.source).toBe('operator');
    expect(t?.status).toBe('active');
    expect(t?.anchorType).toBe('customer_discovery_problem');
    expect(t?.hookAngle).toBe('availability_inquiry');
    expect(t?.fields[0].key).toBe('observed_gap');
  });

  it('returns archived operator rows (docs stay resolvable)', async () => {
    queueSelects([
      { match: 'FROM mkt_manual_play_templates', rows: [makeOperatorRow({ status: 'archived' })] },
    ]);
    const t = await ManualOutreachScriptService.resolveTemplate('op_indian_grocery_whatsapp');
    expect(t?.source).toBe('operator');
    expect(t?.status).toBe('archived');
  });

  it('returns null on a miss', async () => {
    queueSelects([{ match: 'FROM mkt_manual_play_templates', rows: [] }]);
    expect(await ManualOutreachScriptService.resolveTemplate('nope')).toBeNull();
  });
});

// ─── createTemplate ──────────────────────────────────────────────────────

describe('createTemplate', () => {
  it('creates with an explicit valid key and audits', async () => {
    queueSelects([
      { match: 'FROM mkt_manual_play_templates WHERE key', rows: [] },
      { match: 'FROM mkt_manual_play_templates WHERE id', rows: [makeOperatorRow()] },
    ]);
    const row = await ManualOutreachScriptService.createTemplate(
      { ...VALID_INPUT, key: 'op_indian_grocery_whatsapp' },
      { userId: 'alex' } as any,
    );
    expect(row.key).toBe('op_indian_grocery_whatsapp');
    const insert = mockExecuteRawUnsafe.mock.calls.find((c) => String(c[0]).includes('INSERT INTO mkt_manual_play_templates'));
    expect(insert).toBeTruthy();
    expect(insert![2]).toBe('op_indian_grocery_whatsapp');
    expect(mockAudit).toHaveBeenCalled();
  });

  it('auto-slugs op_<slug> from the label when key is omitted', async () => {
    queueSelects([
      { match: 'FROM mkt_manual_play_templates WHERE key', rows: [] },
      { match: 'FROM mkt_manual_play_templates WHERE id', rows: [makeOperatorRow({ key: 'op_indian_grocery_whatsapp_play' })] },
    ]);
    await ManualOutreachScriptService.createTemplate(VALID_INPUT);
    const insert = mockExecuteRawUnsafe.mock.calls.find((c) => String(c[0]).includes('INSERT INTO mkt_manual_play_templates'));
    expect(insert![2]).toBe('op_indian_grocery_whatsapp_play');
  });

  it('catalog-key collision is unreachable: the op_ prefix requirement rejects catalog-shaped keys first', async () => {
    // Defense-in-depth: operator keys must match op_<slug>, and catalog
    // keys (e.g. whatsapp_availability_upsell) never do — so a catalog
    // collision can't be expressed. Pinned so a future relaxation of the
    // key pattern is a conscious decision.
    await expect(
      ManualOutreachScriptService.createTemplate({ ...VALID_INPUT, key: 'whatsapp_availability_upsell' }),
    ).rejects.toThrow(/Invalid template key/);
  });

  it('rejects a key colliding with an existing row → 409', async () => {
    queueSelects([
      { match: 'FROM mkt_manual_play_templates WHERE key', rows: [{ id: 'mptpl-dup' }] },
    ]);
    await expect(
      ManualOutreachScriptService.createTemplate({ ...VALID_INPUT, key: 'op_taken' }),
    ).rejects.toThrow(/already in use/);
  });

  it('rejects malformed keys → 400', async () => {
    for (const key of ['no_prefix', 'op_', 'op_-bad', 'OP_upper', 'op_a'.repeat(40)]) {
      await expect(
        ManualOutreachScriptService.createTemplate({ ...VALID_INPUT, key }),
      ).rejects.toThrow(/Invalid template key/);
    }
  });

  it('rejects invalid role / anchor_type / hook_angle → 400', async () => {
    await expect(
      ManualOutreachScriptService.createTemplate({
        ...VALID_INPUT,
        fields: [{ key: 'x', label: 'X', role: 'bogus' as any, placeholder: '', defaultValue: '' }],
      }),
    ).rejects.toThrow(/role/);
    await expect(
      ManualOutreachScriptService.createTemplate({ ...VALID_INPUT, anchor_type: 'not_a_type' }),
    ).rejects.toThrow(/anchor_type/);
    await expect(
      ManualOutreachScriptService.createTemplate({ ...VALID_INPUT, hook_angle: 'not_an_angle' }),
    ).rejects.toThrow(/hook_angle/);
  });
});

// ─── upsert doc under archived keys ─────────────────────────────────────

describe('upsert — archived template rule', () => {
  it('blocks a NEW doc under an archived operator key → 400', async () => {
    queueSelects([
      { match: 'FROM mkt_manual_play_templates', rows: [makeOperatorRow({ status: 'archived' })] },
      { match: 'FROM mkt_campaign_manual_scripts', rows: [] },
    ]);
    await expect(
      ManualOutreachScriptService.upsert('mcamp-test01', {
        template_key: 'op_indian_grocery_whatsapp',
        script_body: 'x',
      }),
    ).rejects.toThrow(/archived/);
  });

  it('allows an EXISTING doc under an archived key to save', async () => {
    const doc = {
      id: 'mms-existing',
      campaign_id: 'mcamp-test01',
      template_key: 'op_indian_grocery_whatsapp',
      title: 'Old doc',
      fields: {},
      script_body: 'old body',
      promoted_opener_id: null,
      promoted_anchor_id: null,
      promoted_header_id: null,
      promoted_closer_id: null,
      created_by: 'a',
      updated_by: 'a',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    queueSelects([
      { match: 'WHERE key = $1', rows: [makeOperatorRow({ status: 'archived' })] },
      { match: 'WHERE campaign_id = $1 AND template_key = $2', rows: [doc] },
      { match: 'WHERE id = $1', rows: [doc] },
    ]);
    const view = await ManualOutreachScriptService.upsert('mcamp-test01', {
      template_key: 'op_indian_grocery_whatsapp',
      script_body: 'new body',
    });
    expect(view.id).toBe('mms-existing');
    const update = mockExecuteRawUnsafe.mock.calls.find((c) => String(c[0]).includes('UPDATE mkt_campaign_manual_scripts'));
    expect(update).toBeTruthy();
  });
});

// ─── listTemplatesForCampaign merge ─────────────────────────────────────

describe('listTemplatesForCampaign', () => {
  it('merges catalog ++ operator (label ASC) with source/saved/suggested flags', async () => {
    queueSelects([
      { match: 'SELECT template_key FROM mkt_campaign_manual_scripts', rows: [{ template_key: 'whatsapp_availability_upsell' }] },
      { match: 'FROM mkt_manual_play_templates', rows: [makeOperatorRow()] },
    ]);
    const list = await ManualOutreachScriptService.listTemplatesForCampaign('mcamp-test01');
    expect(list[0].key).toBe('whatsapp_availability_upsell'); // catalog first
    expect(list[0].source).toBe('catalog');
    expect(list[0].saved).toBe(true);
    expect(list[0].suggested).toBe(true); // WC_MISSING_AVAILABILITY_INQUIRY detected
    const op = list.find((t) => t.source === 'operator');
    expect(op?.key).toBe('op_indian_grocery_whatsapp');
    expect(op?.suggested).toBe(true);
    expect(op?.saved).toBe(false);
  });

  it('hides archived operator templates unless the campaign has a doc under the key', async () => {
    queueSelects([
      { match: 'SELECT template_key FROM mkt_campaign_manual_scripts', rows: [{ template_key: 'op_old' }] },
      // SQL itself filters — simulate by returning only the saved-key row
      { match: 'FROM mkt_manual_play_templates', rows: [makeOperatorRow({ key: 'op_old', status: 'archived' })] },
    ]);
    const list = await ManualOutreachScriptService.listTemplatesForCampaign('mcamp-test01');
    const archived = list.find((t) => t.key === 'op_old');
    expect(archived?.status).toBe('archived');
    expect(archived?.saved).toBe(true);
  });
});

// ─── archive / update guards ─────────────────────────────────────────────

describe('updateTemplate / archiveTemplate', () => {
  it('archives an operator template (status flip)', async () => {
    queueSelects([
      { match: 'FROM mkt_manual_play_templates WHERE key', rows: [makeOperatorRow()] },
      { match: 'FROM mkt_manual_play_templates WHERE id', rows: [makeOperatorRow({ status: 'archived' })] },
    ]);
    const row = await ManualOutreachScriptService.archiveTemplate('op_indian_grocery_whatsapp');
    expect(row.status).toBe('archived');
    const update = mockExecuteRawUnsafe.mock.calls.find((c) => String(c[0]).includes('UPDATE mkt_manual_play_templates'));
    expect(update![9]).toBe('archived');
  });

  it('rejects update/archive of a catalog key → 400', async () => {
    await expect(
      ManualOutreachScriptService.updateTemplate('whatsapp_availability_upsell', { label: 'x' }),
    ).rejects.toThrow(/code-managed/);
    await expect(
      ManualOutreachScriptService.archiveTemplate('whatsapp_availability_upsell'),
    ).rejects.toThrow(/code-managed/);
  });
});

// ─── Part 2: merge context + free variables ─────────────────────────────

describe('mergeContextForCampaign', () => {
  it('returns the global merge keys for the campaign', async () => {
    const ctx = await ManualOutreachScriptService.mergeContextForCampaign('mcamp-test01');
    expect(ctx.business).toBe('Patel Brothers');
    expect(ctx.city).toBe('Edison');
    expect(ctx.category).toBe('indian grocery stores');
    expect(ctx.salutation).toBe('Hi there,');
    expect(ctx.operator_name).toBe('Alex Operator');
  });

  it('resolves tracked link + QR variables from the seed kits (§5.1)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ seed_id: 'seed-1' }]);
    mockGetClaimKitMeta.mockResolvedValue({
      claimUrl: 'https://app.test/place/claim/tok-1',
      shortClaimUrl: 'https://app.test/c/abc123',
      qrUrl: 'https://app.test/q/abc123',
      qrUrlWalkin: 'https://app.test/qw/abc123',
      qrUrlSocial: 'https://app.test/qs/abc123',
      qrUrlEmail: 'https://app.test/qe/abc123',
    });
    mockGetReportKitMeta.mockResolvedValue({
      qrUrlInPerson: 'https://app.test/r/abc123',
      qrUrlText: 'https://app.test/rt/abc123',
      qrUrlEmail: 'https://app.test/re/abc123',
      qrUrlSocial: 'https://app.test/rs/abc123',
      qrUrlPhone: 'https://app.test/rp/abc123',
    });

    const ctx = await ManualOutreachScriptService.mergeContextForCampaign('mcamp-test01');

    expect(ctx.report_url).toBe('https://app.test/seed-report/seed-1');
    expect(ctx.claim_url).toBe('https://app.test/place/claim/tok-1');
    expect(ctx.claim_short_url).toBe('https://app.test/c/abc123');
    expect(ctx.qr_url_walkin).toBe('https://app.test/qw/abc123');
    expect(ctx.qr_url_report_in_person).toBe('https://app.test/r/abc123');
    expect(ctx.claim_url).not.toContain('/directory/claim/');
  });
});

describe('free construction variables (fields keys not in slot schema)', () => {
  it('resolves {{free_var}} from an extra fields key; missing keys stay literal', async () => {
    const doc = {
      id: 'mms-free01',
      campaign_id: 'mcamp-test01',
      template_key: 'whatsapp_availability_upsell',
      title: 't',
      fields: { competitor_name: 'ShopRite' },
      script_body: 'Unlike {{competitor_name}}, you can check stock for {{business}}. {{unknown_key}}',
      promoted_opener_id: null,
      promoted_anchor_id: null,
      promoted_header_id: null,
      promoted_closer_id: null,
      created_by: 'a',
      updated_by: 'a',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    queueSelects([{ match: 'FROM mkt_campaign_manual_scripts', rows: [doc] }]);
    const [view] = await ManualOutreachScriptService.listForCampaign('mcamp-test01');
    expect(view.resolved_body).toBe('Unlike ShopRite, you can check stock for Patel Brothers. {{unknown_key}}');
  });

  it('pins the fields-shadows-globals precedence (fields win, §9.6)', async () => {
    const doc = {
      id: 'mms-shadow',
      campaign_id: 'mcamp-test01',
      template_key: 'whatsapp_availability_upsell',
      title: 't',
      fields: { city: 'Manualville' },
      script_body: 'In {{city}} we say hi to {{business}}.',
      promoted_opener_id: null,
      promoted_anchor_id: null,
      promoted_header_id: null,
      promoted_closer_id: null,
      created_by: 'a',
      updated_by: 'a',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    queueSelects([{ match: 'FROM mkt_campaign_manual_scripts', rows: [doc] }]);
    const [view] = await ManualOutreachScriptService.listForCampaign('mcamp-test01');
    expect(view.resolved_body).toBe('In Manualville we say hi to Patel Brothers.');
  });
});
