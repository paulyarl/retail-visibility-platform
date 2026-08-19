/**
 * Profile Repair Prompt Routes Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Hoisted mocks ───────────────────────────────────────────────────────────
const { mockPromptService } = vi.hoisted(() => ({
  mockPromptService: {
    executeSeekSync: vi.fn(),
    renderPromptText: vi.fn(),
    importExternalResult: vi.fn(),
    enqueueResolution: vi.fn(),
  },
}));

vi.mock('../services/ProfileRepairPromptService', () => ({
  default: mockPromptService,
  ProfileRepairPromptService: { getInstance: () => mockPromptService },
  PROFILE_REPAIR_TRIAGE_TEMPLATE_ID: 'mpt-profile-repair-triage-default',
  PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID: 'mpt-profile-repair-resolution-default',
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
    mkt_dispute_intake: {
      findFirst: vi.fn().mockResolvedValue({ id: 'intake-123', intake_kind: 'profile_repair' }),
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import marketingOpsRouter from '../routes/marketing-ops';

const app = express();
app.use(express.json());
app.use('/api/admin/marketing-ops', marketingOpsRouter);

describe('Profile Repair Prompt Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /campaigns/:id/repair-triage', () => {
    it('executes triage synchronously and returns parsed recommendation', async () => {
      mockPromptService.executeSeekSync.mockResolvedValueOnce({
        executionId: 'exec-123',
        recommendation: {
          severity_score: 8,
          recommended_track: 'escalated',
          issue_type_confirmed: 'suspension',
          rationale: 'Google Business Profile is suspended.',
          escalation_signals: ['suspension'],
          standard_signals: [],
        },
      });

      const res = await request(app)
        .post('/api/admin/marketing-ops/campaigns/camp-1/repair-triage')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.executionId).toBe('exec-123');
      expect(res.body.data.recommendation.severity_score).toBe(8);
      expect(res.body.data.recommendation.recommended_track).toBe('escalated');
      expect(mockPromptService.executeSeekSync).toHaveBeenCalledWith('camp-1', undefined, expect.anything());
    });
  });

  describe('POST /campaigns/:id/repair-triage/render', () => {
    it('renders triage prompt text for copy-paste bridge', async () => {
      mockPromptService.renderPromptText.mockResolvedValueOnce({
        renderedPrompt: 'Rendered prompt content with {{audit_signals}} filled',
        templateId: 'mpt-profile-repair-triage-default',
        variablesUsed: { audit_signals: 'nap_drift', issue_type: 'nap_drift' },
      });

      const res = await request(app)
        .post('/api/admin/marketing-ops/campaigns/camp-1/repair-triage/render')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.renderedPrompt).toContain('Rendered prompt content');
    });
  });

  describe('POST /campaigns/:id/repair-triage/import', () => {
    it('imports external triage JSON and validates output', async () => {
      mockPromptService.importExternalResult.mockResolvedValueOnce({
        executionId: 'exec-ext-1',
        passed: true,
      });

      const res = await request(app)
        .post('/api/admin/marketing-ops/campaigns/camp-1/repair-triage/import')
        .send({
          raw_output: '{"profile_repair_triage":{"severity_score":5,"recommended_track":"standard","issue_type_confirmed":"nap_drift","rationale":"NAP inconsistency"}}',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passed).toBe(true);
    });

    it('rejects too short raw_output (min 10 chars)', async () => {
      const res = await request(app)
        .post('/api/admin/marketing-ops/campaigns/camp-1/repair-triage/import')
        .send({ raw_output: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /campaigns/:id/repair-resolution', () => {
    it('enqueues Track B resolution execution', async () => {
      mockPromptService.enqueueResolution.mockResolvedValueOnce({
        executionId: 'exec-res-1',
        campaignId: 'camp-1',
      });

      const res = await request(app)
        .post('/api/admin/marketing-ops/campaigns/camp-1/repair-resolution')
        .send({ intakeId: 'intake-123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.executionId).toBe('exec-res-1');
    });
  });
});
