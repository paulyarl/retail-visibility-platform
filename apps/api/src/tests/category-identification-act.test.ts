/**
 * Category Identification Act Endpoint — vocab backstop tests
 *
 * Covers CATEGORY_IDENTIFICATION_VOCAB_INJECTION_SPEC §4.6: the act endpoint
 * verifies union membership server-side before upsertCategory, so a wrong or
 * stale is_known flag cannot mint a duplicate vocab row.
 *
 * Uses destination='secondary' to keep the destination path a single mocked
 * call (registerIdentifiedCategory on the same campaign).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockCampaignService,
  mockServiceCategoryService,
  mockVocabService,
  mockAuditFindFirst,
} = vi.hoisted(() => ({
  mockCampaignService: {
    getCampaign: vi.fn(),
    registerIdentifiedCategory: vi.fn(),
  },
  mockServiceCategoryService: {
    upsertCategory: vi.fn(async (input: any) => ({ value: input.value, label: input.label })),
  },
  mockVocabService: {
    isKnownLabel: vi.fn(),
    findRegisteredValue: vi.fn(async () => null),
    loadVocabulary: vi.fn(async () => ({ directoryLabels: [], registeredLabels: [] })),
  },
  mockAuditFindFirst: vi.fn(async () => null),
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', email: 'admin@platform.com', role: 'admin' };
    req.ctx = { userId: 'admin-1', tenantId: 'platform' };
    next();
  },
  requirePlatformAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    mkt_audits_list: { findFirst: mockAuditFindFirst },
  },
}));

vi.mock('../services/MarketingCampaignService', () => ({
  default: mockCampaignService,
}));

vi.mock('../services/MarketingServiceCategoryService', () => ({
  default: mockServiceCategoryService,
}));

vi.mock('../services/CategoryVocabularyService', () => ({
  default: mockVocabService,
  CategoryVocabularyService: { getInstance: () => mockVocabService },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import marketingOpsRouter from '../routes/marketing-ops';

const app = express();
app.use(express.json());
app.use('/api/admin/marketing-ops', marketingOpsRouter);

const PARENT = {
  id: 'camp-1',
  scope: 'business',
  business_name: 'Test Business',
  city: 'Indianapolis',
  state: 'IN',
};

function actBody(overrides: Record<string, any> = {}) {
  return {
    category_label: 'Somali Grocery Store',
    is_known: false,
    destination: 'secondary',
    business_name: 'Test Business',
    ...overrides,
  };
}

const ACT_URL = '/api/admin/marketing-ops/camp-1/category-identification/act';

describe('POST /:id/category-identification/act — vocab backstop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignService.getCampaign.mockResolvedValue(PARENT);
    mockCampaignService.registerIdentifiedCategory.mockResolvedValue({ registeredAs: 'secondary' });
    mockServiceCategoryService.upsertCategory.mockImplementation(async (input: any) => ({
      value: input.value,
      label: input.label,
    }));
    mockVocabService.findRegisteredValue.mockResolvedValue(null);
    mockAuditFindFirst.mockResolvedValue(null);
  });

  it('skips upsertCategory when the label is already in the vocabulary union', async () => {
    mockVocabService.isKnownLabel.mockResolvedValue(true);

    const res = await request(app)
      .post(ACT_URL)
      .send(actBody({ is_known: false }));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category_added).toBe(false);
    expect(mockServiceCategoryService.upsertCategory).not.toHaveBeenCalled();
    expect(mockCampaignService.registerIdentifiedCategory).toHaveBeenCalledWith(
      'camp-1', 'Somali Grocery Store', expect.anything(),
    );
  });

  it('upserts when the label is not in the union', async () => {
    mockVocabService.isKnownLabel.mockResolvedValue(false);

    const res = await request(app)
      .post(ACT_URL)
      .send(actBody({ is_known: false }));

    expect(res.status).toBe(201);
    expect(res.body.data.category_added).toBe(true);
    expect(mockServiceCategoryService.upsertCategory).toHaveBeenCalledWith(
      { value: 'somali_grocery_store', label: 'Somali Grocery Store', isActive: true },
      expect.anything(),
    );
  });

  it('never checks or upserts when is_known is true', async () => {
    const res = await request(app)
      .post(ACT_URL)
      .send(actBody({ is_known: true }));

    expect(res.status).toBe(201);
    expect(res.body.data.category_added).toBe(false);
    expect(mockVocabService.isKnownLabel).not.toHaveBeenCalled();
    expect(mockServiceCategoryService.upsertCategory).not.toHaveBeenCalled();
  });

  it('fails open to flag behaviour when the vocabulary lookup throws', async () => {
    mockVocabService.isKnownLabel.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post(ACT_URL)
      .send(actBody({ is_known: false }));

    expect(res.status).toBe(201);
    expect(res.body.data.category_added).toBe(true);
    expect(mockServiceCategoryService.upsertCategory).toHaveBeenCalled();
  });
});
