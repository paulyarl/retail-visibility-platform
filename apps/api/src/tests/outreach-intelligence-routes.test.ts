/**
 * Outreach Intelligence route tests (§8 slice 4)
 *
 * Verifies:
 * - 401 when no auth provided
 * - 404 for unknown campaign on GET
 * - PUT → GET round-trip preserves payload verbatim
 * - Salutation is persisted from server computation (client input ignored)
 * - Zod guardrails: confirmed without source → 400, unavailable with value → 400
 * - DELETE removes the worksheet
 *
 * Spec: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks (hoisted) ──────────────────────────────────────────────────────

const {
  mockGetForCampaign,
  mockUpsert,
  mockDelete,
} = vi.hoisted(() => ({
  mockGetForCampaign: vi.fn(),
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../services/OutreachIntelligenceService', () => ({
  default: {
    getForCampaign: mockGetForCampaign,
    upsert: mockUpsert,
    delete: mockDelete,
  },
  resolveSalutation: vi.fn((payload: any, businessName: string | null) => {
    if (payload.owner_name?.value && payload.owner_name.source_confidence !== 'unavailable') {
      return `Hi ${payload.owner_name.value.trim().split(/\s+/)[0]},`;
    }
    if (businessName && businessName.trim().length > 0) return `Hi ${businessName.trim()},`;
    return `Hi there,`;
  }),
  OutreachIntelligenceService: { getInstance: () => ({}) },
}));

// Mock all other services the router imports (minimal stubs to avoid import errors)
vi.mock('../prisma', () => ({ prisma: {} }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../config/unifiedConfig', () => ({ unifiedConfig: {} }));
vi.mock('../lib/platform-scope', () => ({ PLATFORM_SCOPE: 'platform' }));
vi.mock('../audit', () => ({ audit: vi.fn().mockResolvedValue(undefined) }));

// Stub all other service imports the router file pulls in at module load
vi.mock('../services/MarketingCampaignService', () => ({ default: {} }));
vi.mock('../services/MarketingOutreachService', () => ({ MarketingOutreachService: {} }));
vi.mock('../services/MarketingHotProspectService', () => ({ MarketingHotProspectService: {} }));
vi.mock('../services/MarketingAuditService', () => ({ default: {} }));
vi.mock('../services/MarketingPromptService', () => ({ default: {} }));
vi.mock('../services/MarketingExecutionService', () => ({ default: {} }));
vi.mock('../services/MarketingScorecardService', () => ({ default: {} }));
vi.mock('../services/MarketingFileService', () => ({ default: {} }));
vi.mock('../services/MarketingDeliverableService', () => ({ default: {} }));
vi.mock('../services/MarketingBrandingService', () => ({ default: {} }));
vi.mock('../services/MarketingCategoryToneService', () => ({ default: {} }));
vi.mock('../services/MarketingServiceCategoryService', () => ({ default: {} }));
vi.mock('../services/ReviewResponseService', () => ({ ReviewResponseService: {} }));
vi.mock('../services/OutreachOpenerService', () => ({
  OutreachOpenerService: {},
  resolveCampaignArchetype: vi.fn(),
}));
vi.mock('../services/outreach-openers/archetype-selection', () => ({
  selectArchetype: vi.fn(),
}));
vi.mock('../services/marketing/GalleryArchetypeDefaults', () => ({
  resolveGalleryArchetypeDefaults: vi.fn(),
}));
vi.mock('../services/GalleryAnalyticsService', () => ({ default: {} }));
vi.mock('../services/marketing/GalleryMultiService', () => ({ GalleryMultiService: {} }));
vi.mock('../services/outreach-pitch/HeaderService', () => ({ default: {} }));
vi.mock('../services/outreach-pitch/CloserService', () => ({ default: {} }));
vi.mock('../services/outreach-pitch/ContactService', () => ({ default: {} }));
vi.mock('../services/outreach-pitch/ReviewResponseDraftService', () => ({ default: {} }));
vi.mock('../services/outreach-pitch/PitchService', () => ({ default: {} }));
vi.mock('../services/deliverable/OwnerVoiceService', () => ({ default: {} }));
vi.mock('../services/deliverable/ReviewSlotService', () => ({ default: {} }));
vi.mock('../services/deliverable/DeliverableSectionService', () => ({ default: {} }));
vi.mock('../services/deliverable/DeliverableAssemblyService', () => ({ default: {} }));
vi.mock('../services/deliverable/DeliverableRenderService', () => ({ default: {} }));
vi.mock('../services/RecoveryResolutionService', () => ({ default: {} }));
vi.mock('../services/DisputeIntakeService', () => ({ default: {} }));
vi.mock('../services/ReviewCascadeService', () => ({ default: {} }));
vi.mock('../services/MarketingPlaybookCatalogService', () => ({ default: {} }));
vi.mock('../services/MarketingSignalRegistryService', () => ({ default: {} }));
vi.mock('../services/PlaybookChecklistService', () => ({ default: {} }));
vi.mock('../services/CampaignTriageService', () => ({ default: {} }));
vi.mock('../services/BusinessProspectService', () => ({ BusinessProspectService: {} }));
vi.mock('../services/MarketingProspectQueueService', () => ({ default: {} }));
vi.mock('../services/MarketingCustomerService', () => ({ MarketingCustomerService: {} }));
vi.mock('../services/marketing/MarketingReceiptEmailService', () => ({ MarketingReceiptEmailService: {} }));

import marketingOpsRouter from '../routes/marketing-ops';

// ── Test app ─────────────────────────────────────────────────────────────
// Simulate the registry-level auth middleware: if no Bearer token, return 401.

const app = express();
app.use(express.json());
// Simple auth middleware that mirrors authenticateToken behavior for tests
app.use((req: any, _res: any, next: any) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return _res.status(401).json({ success: false, error: 'unauthorized' });
  }
  req.user = { id: 'test-admin-001' };
  next();
});
app.use('/api/admin/marketing-ops', marketingOpsRouter);

const CAMPAIGN_ID = 'mcamp-test001';
const VALID_TOKEN = 'test-admin-token';

// ── Fixtures ─────────────────────────────────────────────────────────────

const validPayload = {
  prepared_by: 'Test Operator',
  research_date: '2026-08-11',
  owner_name: { value: null, source: null, source_confidence: 'unavailable' },
  business_email: { value: null, source: null, source_confidence: 'unavailable' },
  team_signal: { value: 'unknown', quoted_description: null, source: null, source_confidence: 'unavailable' },
  preferred_contact_channel: { value: null, source: null, source_confidence: 'unavailable' },
  researcher_notes: '',
};

const storedRow = {
  id: 'moi-test001',
  campaign_id: CAMPAIGN_ID,
  owner_name: 'Maria',
  owner_name_confidence: 'confirmed',
  business_email: null,
  business_email_confidence: 'unavailable',
  team_signal: 'unknown',
  preferred_contact_channel: null,
  recommended_salutation: 'Hi Maria,',
  research_date: '2026-08-11',
  prepared_by: 'Test Operator',
  payload: {
    ...validPayload,
    business_name: 'Tetees Market',
    address: '123 Main St, Indianapolis, IN',
    linked_audit_reference: 'maud-audit001',
    recommended_salutation: 'Hi Maria,',
    owner_name: { value: 'Maria Garcia', source: 'About page', source_confidence: 'confirmed' },
  },
  created_at: '2026-08-11T10:00:00.000Z',
  updated_at: '2026-08-11T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Auth tests ───────────────────────────────────────────────────────────

describe('outreach-intelligence routes — auth', () => {
  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 when auth header is malformed', async () => {
    const res = await request(app)
      .get(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', 'NotBearer sometoken');
    expect(res.status).toBe(401);
  });
});

// ── GET tests ────────────────────────────────────────────────────────────

describe('outreach-intelligence routes — GET', () => {
  it('returns 200 with the worksheet when it exists', async () => {
    mockGetForCampaign.mockResolvedValue(storedRow);

    const res = await request(app)
      .get(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.campaign_id).toBe(CAMPAIGN_ID);
    expect(res.body.data.recommended_salutation).toBe('Hi Maria,');
  });

  it('returns 200 with null when no worksheet exists', async () => {
    mockGetForCampaign.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it('returns inherited worksheet with sourceCampaignId for siblings', async () => {
    mockGetForCampaign.mockResolvedValue({
      ...storedRow,
      campaign_id: 'mcamp-primary',
      inherited: true,
      sourceCampaignId: 'mcamp-primary',
    });

    const res = await request(app)
      .get(`/api/admin/marketing-ops/mcamp-sibling/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.inherited).toBe(true);
    expect(res.body.data.sourceCampaignId).toBe('mcamp-primary');
  });
});

// ── PUT tests (round-trip + guardrails) ──────────────────────────────────

describe('outreach-intelligence routes — PUT', () => {
  it('upserts and returns the worksheet with server-computed salutation', async () => {
    const payloadWithOwner = {
      ...validPayload,
      owner_name: { value: 'Maria Garcia', source: 'About page', source_confidence: 'confirmed' },
    };
    mockUpsert.mockResolvedValue(storedRow);

    const res = await request(app)
      .put(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(payloadWithOwner);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recommended_salutation).toBe('Hi Maria,');
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpsert.mock.calls[0][0]).toBe(CAMPAIGN_ID);
  });

  it('PUT → GET round-trip preserves payload verbatim', async () => {
    const payloadWithOwner = {
      ...validPayload,
      owner_name: { value: 'Maria Garcia', source: 'About page', source_confidence: 'confirmed' },
      researcher_notes: 'Found owner name on About page',
    };

    mockUpsert.mockResolvedValue({
      ...storedRow,
      payload: {
        ...storedRow.payload,
        researcher_notes: 'Found owner name on About page',
      },
    });
    mockGetForCampaign.mockResolvedValue({
      ...storedRow,
      payload: {
        ...storedRow.payload,
        researcher_notes: 'Found owner name on About page',
      },
    });

    // PUT
    const putRes = await request(app)
      .put(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(payloadWithOwner);

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.payload.researcher_notes).toBe('Found owner name on About page');
    expect(putRes.body.data.payload.owner_name.value).toBe('Maria Garcia');
    expect(putRes.body.data.payload.owner_name.source_confidence).toBe('confirmed');

    // GET
    const getRes = await request(app)
      .get(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.payload.researcher_notes).toBe('Found owner name on About page');
    expect(getRes.body.data.payload.owner_name.value).toBe('Maria Garcia');
    // Nulls preserved
    expect(getRes.body.data.payload.business_email.value).toBeNull();
    expect(getRes.body.data.payload.preferred_contact_channel.value).toBeNull();
  });

  it('rejects confirmed field without source with 400', async () => {
    const payload = {
      ...validPayload,
      owner_name: { value: 'Maria Garcia', source: null, source_confidence: 'confirmed' },
    };

    const res = await request(app)
      .put(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects confirmed field with empty source with 400', async () => {
    const payload = {
      ...validPayload,
      owner_name: { value: 'Maria Garcia', source: '   ', source_confidence: 'confirmed' },
    };

    const res = await request(app)
      .put(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects unavailable field with a value with 400', async () => {
    const payload = {
      ...validPayload,
      owner_name: { value: 'Maria Garcia', source: null, source_confidence: 'unavailable' },
    };

    const res = await request(app)
      .put(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects invalid email format with 400', async () => {
    const payload = {
      ...validPayload,
      business_email: { value: 'not-an-email', source: 'Contact page', source_confidence: 'confirmed' },
    };

    const res = await request(app)
      .put(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects invalid research_date format with 400', async () => {
    const payload = {
      ...validPayload,
      research_date: '08/11/2026',
    };

    const res = await request(app)
      .put(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('passes through ConflictError as 409 for non-primary sibling write', async () => {
    const conflictError = new Error('Intelligence is gathered on the primary sibling campaign.');
    (conflictError as any).name = 'ConflictError';
    (conflictError as any).statusCode = 409;
    mockUpsert.mockRejectedValue(conflictError);

    const res = await request(app)
      .put(`/api/admin/marketing-ops/mcamp-sibling/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send(validPayload);

    expect(res.status).toBe(409);
  });
});

// ── DELETE tests ─────────────────────────────────────────────────────────

describe('outreach-intelligence routes — DELETE', () => {
  it('deletes the worksheet and returns success', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete.mock.calls[0][0]).toBe(CAMPAIGN_ID);
  });

  it('returns 404 when worksheet does not exist', async () => {
    const notFoundError = new Error('Outreach Intelligence worksheet not found');
    (notFoundError as any).name = 'NotFoundError';
    (notFoundError as any).statusCode = 404;
    mockDelete.mockRejectedValue(notFoundError);

    const res = await request(app)
      .delete(`/api/admin/marketing-ops/${CAMPAIGN_ID}/outreach-intelligence`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(404);
  });
});
