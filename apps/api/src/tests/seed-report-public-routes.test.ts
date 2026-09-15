/**
 * Public Seed Intelligence Report Route Tests
 *
 * Verifies public eligibility gating and claim-token exposure rules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockReportService, mockQueryRaw } = vi.hoisted(() => ({
  mockReportService: {
    getLatestPublishedReport: vi.fn(),
  },
  mockQueryRaw: vi.fn(),
}));

vi.mock('../services/intelligence/SeedIntelligenceReportService', () => ({
  SeedIntelligenceReportService: {
    getInstance: () => mockReportService,
  },
}));

vi.mock('../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import seedReportPublicRouter from '../routes/seed-report-public';

const report = (overrides: Record<string, any> = {}) => ({
  report_id: 'sir-1',
  seed_id: 'seed-1',
  version: 1,
  status: 'complete',
  generated_at: '2026-09-15T12:00:00.000Z',
  business_identity: {
    business_name: { field: 'business_name', value: 'Acme Market', state: 'observed', confidence: 'high', source_observation_ids: ['obs-1'], owner_verified_at: null, display_note: null },
    address: { field: 'address', value: '1 Main St', state: 'observed', confidence: 'high', source_observation_ids: ['obs-2'], owner_verified_at: null, display_note: null },
    phone: { field: 'phone', value: null, state: 'not_found_during_discovery', confidence: 'unknown', source_observation_ids: [], owner_verified_at: null, display_note: null },
    city: { field: 'city', value: 'Fort Wayne', state: 'observed', confidence: 'high', source_observation_ids: ['obs-3'], owner_verified_at: null, display_note: null },
    state: { field: 'state', value: 'IN', state: 'observed', confidence: 'high', source_observation_ids: ['obs-3'], owner_verified_at: null, display_note: null },
    website: { field: 'website', value: null, state: 'not_found_during_discovery', confidence: 'unknown', source_observation_ids: [], owner_verified_at: null, display_note: null },
    owner_name: { field: 'owner_name', value: null, state: 'not_checked', confidence: 'unknown', source_observation_ids: [], owner_verified_at: null, display_note: null },
    ownership_type: { field: 'ownership_type', value: 'unknown', state: 'probable', confidence: 'low', source_observation_ids: ['obs-1'], owner_verified_at: null, display_note: null },
  },
  source_summary: {
    sources_checked_count: 2,
    sources_with_evidence_count: 2,
    source_types: [],
    identity_signals_count: 2,
    name_variants_count: 1,
    address_variants_count: 1,
    unresolved_count: 2,
  },
  identity_reconciliation: {
    canonical_candidate: null,
    alternate_names: [],
    alternate_addresses: [],
    alternate_phones: [],
    conflicts: [],
    identity_confidence: 'high',
  },
  market_classification: {
    category: 'Grocery Store',
    subcategory: null,
    category_fit: 'verified',
    location_status: 'inside_city',
    ownership_type: 'unknown',
    category_profile_context: null,
    operational_signals: [],
  },
  category_fit: { category: 'Grocery Store', subcategory: null, category_fit: 'verified', basis: [], source_observation_ids: [] },
  platform_presence: { platforms: [] },
  intelligence_signals: { signals: [] },
  verification_activity: { events: [] },
  claim_summary: { claim_status: 'unclaimed', claim_url: null, claim_benefits: ['Verify your business record'], owner_confirmation_count: 0, owner_correction_count: 0 },
  next_actions: { primary_cta: 'Claim your free seed', cta_eligible: true, cta_disabled_reason: null, suggested_actions: [] },
  ...overrides,
});

const app = express();
app.use('/api/public', seedReportPublicRouter);

describe('Public seed intelligence report routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([{ token: 'claim-token', short_code: 'abc123' }]);
  });

  it('does not expose an internal-only report', async () => {
    mockReportService.getLatestPublishedReport.mockResolvedValueOnce(
      report({ status: 'requires_identity_review' }),
    );

    const response = await request(app).get('/api/public/marketing/seed/seed-1/report/preview');

    expect(response.status).toBe(404);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('suppresses the claim token when the report CTA is ineligible', async () => {
    mockReportService.getLatestPublishedReport.mockResolvedValueOnce(
      report({ next_actions: { primary_cta: null, cta_eligible: false, cta_disabled_reason: 'owner review required', suggested_actions: [] } }),
    );

    const response = await request(app).get('/api/public/marketing/seed/seed-1/report/preview');

    expect(response.status).toBe(200);
    expect(response.body.data.claim_token).toBeNull();
    expect(response.body.data.claim_short_code).toBeNull();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('exposes the active claim token for an eligible report', async () => {
    mockReportService.getLatestPublishedReport.mockResolvedValueOnce(report());

    const response = await request(app).get('/api/public/marketing/seed/seed-1/report/preview');

    expect(response.status).toBe(200);
    expect(response.body.data.claim_token).toBe('claim-token');
    expect(response.body.data.claim_short_code).toBe('abc123');
  });
});
