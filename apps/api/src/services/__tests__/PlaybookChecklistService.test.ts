import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────
// Prisma is mocked at the model level — each model gets the methods the
// service calls (findMany, findUnique, create, update, delete, count, upsert,
// updateMany, $transaction). $transaction accepts either an array of
// operations or an async callback (the accept-suggestion path uses the
// callback form for atomic step + suggestion updates).

const {
  mockSteps,
  mockProgress,
  mockSuggestions,
  mockTriage,
  mockPlaybook,
  transactionOps,
} = vi.hoisted(() => ({
  mockSteps: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateMany: vi.fn(),
  },
  mockProgress: {
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  mockSuggestions: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockTriage: {
    findUnique: vi.fn(),
  },
  mockPlaybook: {
    findUnique: vi.fn(),
  },
  transactionOps: { updates: [] as any[] },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_playbook_checklist_steps: mockSteps,
    mkt_campaign_checklist_progress: mockProgress,
    mkt_playbook_checklist_suggestions: mockSuggestions,
    mkt_campaign_triage_results: mockTriage,
    mkt_playbook_catalog: mockPlaybook,
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') {
        // Callback form — pass a tx that proxies to the model mocks
        return arg({
          mkt_playbook_checklist_steps: mockSteps,
          mkt_playbook_checklist_suggestions: mockSuggestions,
        });
      }
      // Array form — resolve each operation
      return Promise.all(arg.map((op: any) => op));
    }),
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generatePlaybookChecklistStepId: () => 'pbcs-test-001',
  generateCampaignChecklistProgressId: () => 'cckp-test-001',
  generatePlaybookChecklistSuggestionId: () => 'pbsg-test-001',
}));

import PlaybookChecklistService from '../PlaybookChecklistService';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const PLAYBOOK_ID = 'pbk-001';
const CAMPAIGN_ID = 'mcamp-001';
const STEP_ID = 'pbcs-existing-001';

const stepRow = (overrides: Partial<any> = {}) => ({
  id: STEP_ID,
  playbook_id: PLAYBOOK_ID,
  step_order: 1,
  title: 'Verify GBP listing is claimed',
  instructions: 'Open the GBP listing URL and confirm the "Owned' + "'" + ' by" line shows the business name',
  step_type: 'url_check',
  action_config: { url: 'https://google.com/maps/place/example' },
  is_required: true,
  is_active: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  ...overrides,
});

const triageAcceptedRow = (overrides: Partial<any> = {}) => ({
  id: 'trg-001',
  campaign_id: CAMPAIGN_ID,
  recommended_playbook_id: PLAYBOOK_ID,
  overridden_playbook_id: null,
  is_operator_accepted: true,
  playbook: {
    id: PLAYBOOK_ID,
    code: 'PB-01',
    name: 'Review Drought Recovery',
    category: 'review_management',
  },
  overridden_playbook: null,
  ...overrides,
});

const triageOverriddenRow = (overrides: Partial<any> = {}) => ({
  id: 'trg-002',
  campaign_id: CAMPAIGN_ID,
  recommended_playbook_id: 'pbk-other',
  overridden_playbook_id: PLAYBOOK_ID,
  is_operator_accepted: true,
  playbook: {
    id: 'pbk-other',
    code: 'PB-02',
    name: 'Other Playbook',
    category: 'review_management',
  },
  overridden_playbook: {
    id: PLAYBOOK_ID,
    code: 'PB-01',
    name: 'Review Drought Recovery',
    category: 'review_management',
  },
  ...overrides,
});

const suggestionRow = (overrides: Partial<any> = {}) => ({
  id: 'pbsg-existing-001',
  playbook_id: PLAYBOOK_ID,
  campaign_id: CAMPAIGN_ID,
  step_id: STEP_ID,
  suggestion_kind: 'add',
  position: 'after',
  proposed_step: { title: 'Check NAP consistency', stepType: 'manual' },
  rationale: 'NAP drift was missed on three campaigns this month',
  status: 'pending',
  submitted_by: 'uid-operator-001',
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  created_at: new Date('2026-01-10'),
  updated_at: new Date('2026-01-10'),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockProgress.count.mockResolvedValue(0);
});

// ====================
// Step CRUD
// ====================

describe('PlaybookChecklistService — step CRUD', () => {
  describe('listSteps', () => {
    it('returns only active steps ordered by step_order', async () => {
      mockSteps.findMany.mockResolvedValue([stepRow(), stepRow({ id: 'pbcs-2', step_order: 2, is_active: true })]);

      const result = await PlaybookChecklistService.listSteps(PLAYBOOK_ID);

      expect(result).toHaveLength(2);
      expect(mockSteps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playbook_id: PLAYBOOK_ID, is_active: true },
          orderBy: [{ step_order: 'asc' }, { created_at: 'asc' }],
        }),
      );
    });

    it('listAllSteps includes inactive steps', async () => {
      mockSteps.findMany.mockResolvedValue([stepRow(), stepRow({ id: 'pbcs-2', is_active: false })]);

      const result = await PlaybookChecklistService.listAllSteps(PLAYBOOK_ID);

      expect(result).toHaveLength(2);
      expect(mockSteps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playbook_id: PLAYBOOK_ID },
        }),
      );
    });
  });

  describe('createStep', () => {
    it('appends a new step at the end (next step_order = max + 1)', async () => {
      mockSteps.findMany.mockResolvedValue([{ step_order: 3 }]); // existing max
      mockSteps.create.mockResolvedValue(stepRow({ step_order: 4, title: 'New step' }));

      const result = await PlaybookChecklistService.createStep(PLAYBOOK_ID, {
        title: 'New step',
        stepType: 'manual',
      });

      expect(result.stepOrder).toBe(4);
      expect(mockSteps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'pbcs-test-001',
            playbook_id: PLAYBOOK_ID,
            step_order: 4,
            title: 'New step',
            step_type: 'manual',
            is_required: true,
            is_active: true,
          }),
        }),
      );
    });

    it('first step gets step_order = 1 when no existing steps', async () => {
      mockSteps.findMany.mockResolvedValue([]);
      mockSteps.create.mockResolvedValue(stepRow({ step_order: 1 }));

      const result = await PlaybookChecklistService.createStep(PLAYBOOK_ID, {
        title: 'First step',
        stepType: 'manual',
      });

      expect(result.stepOrder).toBe(1);
    });

    it('rejects invalid step_type', async () => {
      await expect(
        PlaybookChecklistService.createStep(PLAYBOOK_ID, {
          title: 'Bad step',
          stepType: 'invalid_type' as any,
        }),
      ).rejects.toThrow(/Invalid step_type/);
    });

    it('validates url_check action_config.url is http(s)', async () => {
      await expect(
        PlaybookChecklistService.createStep(PLAYBOOK_ID, {
          title: 'Bad URL step',
          stepType: 'url_check',
          actionConfig: { url: 'ftp://example.com' },
        }),
      ).rejects.toThrow(/must be a valid http\(s\) URL/);
    });

    it('rejects credential configs that look like secrets (key name)', async () => {
      await expect(
        PlaybookChecklistService.createStep(PLAYBOOK_ID, {
          title: 'Bad creds step',
          stepType: 'credentials',
          actionConfig: { password: 'vault-path' },
        }),
      ).rejects.toThrow(/looks like a secret/);
    });

    it('rejects credential configs that look like secrets (value pattern)', async () => {
      await expect(
        PlaybookChecklistService.createStep(PLAYBOOK_ID, {
          title: 'Bad creds step',
          stepType: 'credentials',
          actionConfig: { credential_ref: 'sk_live_abc123secretkey' },
        }),
      ).rejects.toThrow(/looks like a secret/);
    });

    it('accepts credential configs with reference labels (not secrets)', async () => {
      mockSteps.findMany.mockResolvedValue([]);
      mockSteps.create.mockResolvedValue(stepRow({ step_type: 'credentials' }));

      await PlaybookChecklistService.createStep(PLAYBOOK_ID, {
        title: 'Good creds step',
        stepType: 'credentials',
        actionConfig: { credential_ref: '1Password › LocalBiz › GBP vault', username_hint: 'admin@biz.com' },
      });

      expect(mockSteps.create).toHaveBeenCalled();
    });
  });

  describe('deleteStep', () => {
    it('blocks deletion when completed progress exists (409 step_has_progress)', async () => {
      mockProgress.count.mockResolvedValue(3);

      await expect(PlaybookChecklistService.deleteStep(STEP_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: 'step_has_progress',
      });
      expect(mockSteps.delete).not.toHaveBeenCalled();
    });

    it('deletes when no progress exists', async () => {
      mockProgress.count.mockResolvedValue(0);
      mockSteps.delete.mockResolvedValue({});

      await PlaybookChecklistService.deleteStep(STEP_ID);

      expect(mockSteps.delete).toHaveBeenCalledWith({ where: { id: STEP_ID } });
    });
  });

  describe('reorderSteps', () => {
    it('swaps step_order values in a transaction', async () => {
      mockSteps.update.mockImplementation(({ where, data }) =>
        Promise.resolve(stepRow({ id: where.id, step_order: data.step_order })),
      );

      const result = await PlaybookChecklistService.reorderSteps(PLAYBOOK_ID, [
        { id: 'pbcs-1', stepOrder: 2 },
        { id: 'pbcs-2', stepOrder: 1 },
      ]);

      expect(result).toHaveLength(2);
      expect(mockSteps.update).toHaveBeenCalledTimes(2);
    });
  });
});

// ====================
// Campaign checklist (effective playbook resolution)
// ====================

describe('PlaybookChecklistService — campaign checklist resolution', () => {
  describe('getCampaignChecklist', () => {
    it('returns empty view when no triage result exists', async () => {
      mockTriage.findUnique.mockResolvedValue(null);

      const result = await PlaybookChecklistService.getCampaignChecklist(CAMPAIGN_ID);

      expect(result.playbook).toBeNull();
      expect(result.steps).toEqual([]);
      expect(result.requiredTotal).toBe(0);
    });

    it('returns empty view when triage exists but no operator decision', async () => {
      mockTriage.findUnique.mockResolvedValue(
        triageAcceptedRow({ is_operator_accepted: null, overridden_playbook_id: null }),
      );

      const result = await PlaybookChecklistService.getCampaignChecklist(CAMPAIGN_ID);

      expect(result.playbook).toBeNull();
    });

    it('resolves to recommended playbook when accepted', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSteps.findMany.mockResolvedValue([
        stepRow({ is_required: true }),
        stepRow({ id: 'pbcs-2', step_order: 2, is_required: false }),
      ]);
      mockProgress.findMany.mockResolvedValue([
        { step_id: STEP_ID, completed_at: new Date(), completed_by: 'uid-1', note: null },
      ]);

      const result = await PlaybookChecklistService.getCampaignChecklist(CAMPAIGN_ID);

      expect(result.playbook).toMatchObject({ id: PLAYBOOK_ID, isOverride: false });
      expect(result.steps).toHaveLength(2);
      expect(result.completedCount).toBe(1);
      expect(result.requiredTotal).toBe(1);
      expect(result.requiredCompleted).toBe(1);
    });

    it('resolves to overridden playbook when overridden (isOverride = true)', async () => {
      mockTriage.findUnique.mockResolvedValue(triageOverriddenRow());
      mockSteps.findMany.mockResolvedValue([stepRow()]);
      mockProgress.findMany.mockResolvedValue([]);

      const result = await PlaybookChecklistService.getCampaignChecklist(CAMPAIGN_ID);

      expect(result.playbook).toMatchObject({ id: PLAYBOOK_ID, isOverride: true });
      expect(result.requiredCompleted).toBe(0);
    });
  });

  describe('setStepProgress', () => {
    it('throws 409 no_effective_playbook when no triage decision', async () => {
      mockTriage.findUnique.mockResolvedValue(null);

      await expect(
        PlaybookChecklistService.setStepProgress(CAMPAIGN_ID, STEP_ID, true, null, 'uid-1'),
      ).rejects.toMatchObject({ code: 'no_effective_playbook', statusCode: 409 });
    });

    it('throws 409 stale_step when step does not belong to effective playbook', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSteps.findUnique.mockResolvedValue(stepRow({ playbook_id: 'pbk-different' }));

      await expect(
        PlaybookChecklistService.setStepProgress(CAMPAIGN_ID, STEP_ID, true, null, 'uid-1'),
      ).rejects.toMatchObject({ code: 'stale_step', statusCode: 409 });
    });

    it('throws 409 stale_step when step is inactive', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSteps.findUnique.mockResolvedValue(stepRow({ is_active: false }));

      await expect(
        PlaybookChecklistService.setStepProgress(CAMPAIGN_ID, STEP_ID, true, null, 'uid-1'),
      ).rejects.toMatchObject({ code: 'stale_step', statusCode: 409 });
    });

    it('upserts progress and returns updated view on success', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSteps.findUnique.mockResolvedValue(stepRow());
      mockProgress.upsert.mockResolvedValue({});
      // Second call to getCampaignChecklist (after upsert):
      mockSteps.findMany.mockResolvedValue([stepRow()]);
      mockProgress.findMany.mockResolvedValue([
        { step_id: STEP_ID, completed_at: new Date(), completed_by: 'uid-1', note: 'done' },
      ]);

      const result = await PlaybookChecklistService.setStepProgress(CAMPAIGN_ID, STEP_ID, true, 'done', 'uid-1');

      expect(mockProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaign_id_step_id: { campaign_id: CAMPAIGN_ID, step_id: STEP_ID } },
          create: expect.objectContaining({ completed_by: 'uid-1', note: 'done' }),
        }),
      );
      expect(result.steps[0].progress?.completedBy).toBe('uid-1');
    });

    it('unchecking clears completed_at and completed_by', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSteps.findUnique.mockResolvedValue(stepRow());
      mockProgress.upsert.mockResolvedValue({});
      mockSteps.findMany.mockResolvedValue([stepRow()]);
      mockProgress.findMany.mockResolvedValue([
        { step_id: STEP_ID, completed_at: null, completed_by: null, note: 'done' },
      ]);

      const result = await PlaybookChecklistService.setStepProgress(CAMPAIGN_ID, STEP_ID, false, undefined, 'uid-1');

      expect(mockProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ completed_at: null, completed_by: null }),
        }),
      );
      expect(result.steps[0].progress?.completedAt).toBeNull();
    });
  });

  describe('getIncompleteRequiredSteps', () => {
    it('returns empty array when no effective playbook', async () => {
      mockTriage.findUnique.mockResolvedValue(null);

      const result = await PlaybookChecklistService.getIncompleteRequiredSteps(CAMPAIGN_ID);

      expect(result).toEqual([]);
    });

    it('returns only required steps with no completed progress', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSteps.findMany.mockResolvedValue([
        stepRow({ id: 'req-1', is_required: true }),
        stepRow({ id: 'req-2', is_required: true }),
        stepRow({ id: 'opt-1', is_required: false }),
      ]);
      mockProgress.findMany.mockResolvedValue([
        { step_id: 'req-1', completed_at: new Date(), completed_by: 'uid-1', note: null },
      ]);

      const result = await PlaybookChecklistService.getIncompleteRequiredSteps(CAMPAIGN_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('req-2');
    });
  });
});

// ====================
// Suggestions
// ====================

describe('PlaybookChecklistService — suggestions', () => {
  describe('submitSuggestion', () => {
    it('throws 409 no_effective_playbook when no triage decision', async () => {
      mockTriage.findUnique.mockResolvedValue(null);

      await expect(
        PlaybookChecklistService.submitSuggestion(
          CAMPAIGN_ID,
          { suggestionKind: 'add', proposedStep: { title: 'New' }, rationale: 'because' },
          'uid-1',
        ),
      ).rejects.toMatchObject({ code: 'no_effective_playbook', statusCode: 409 });
    });

    it('rejects empty rationale', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());

      await expect(
        PlaybookChecklistService.submitSuggestion(
          CAMPAIGN_ID,
          { suggestionKind: 'add', proposedStep: { title: 'New' }, rationale: '   ' },
          'uid-1',
        ),
      ).rejects.toThrow(/Rationale is required/);
    });

    it('rejects modify without step_id anchor', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());

      await expect(
        PlaybookChecklistService.submitSuggestion(
          CAMPAIGN_ID,
          { suggestionKind: 'modify', proposedStep: { title: 'Changed' }, rationale: 'because' },
          'uid-1',
        ),
      ).rejects.toThrow(/requires a step_id anchor/);
    });

    it('rejects remove without step_id anchor', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());

      await expect(
        PlaybookChecklistService.submitSuggestion(
          CAMPAIGN_ID,
          { suggestionKind: 'remove', proposedStep: {}, rationale: 'because' },
          'uid-1',
        ),
      ).rejects.toThrow(/requires a step_id anchor/);
    });

    it('rejects add with position but no step_id anchor', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());

      await expect(
        PlaybookChecklistService.submitSuggestion(
          CAMPAIGN_ID,
          { suggestionKind: 'add', position: 'after', proposedStep: { title: 'New' }, rationale: 'because' },
          'uid-1',
        ),
      ).rejects.toThrow(/requires a step_id anchor/);
    });

    it('rejects step_id anchor that belongs to a different playbook', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSteps.findUnique.mockResolvedValue(stepRow({ playbook_id: 'pbk-different' }));

      await expect(
        PlaybookChecklistService.submitSuggestion(
          CAMPAIGN_ID,
          { stepId: STEP_ID, suggestionKind: 'modify', proposedStep: { title: 'Changed' }, rationale: 'because' },
          'uid-1',
        ),
      ).rejects.toThrow(/does not belong to the campaign effective playbook/);
    });

    it('creates a pending suggestion on valid add', async () => {
      mockTriage.findUnique.mockResolvedValue(triageAcceptedRow());
      mockSuggestions.create.mockResolvedValue(suggestionRow());

      const result = await PlaybookChecklistService.submitSuggestion(
        CAMPAIGN_ID,
        { suggestionKind: 'add', proposedStep: { title: 'New step' }, rationale: 'Missing NAP check' },
        'uid-1',
      );

      expect(result.status).toBe('pending');
      expect(mockSuggestions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'pbsg-test-001',
            playbook_id: PLAYBOOK_ID,
            campaign_id: CAMPAIGN_ID,
            suggestion_kind: 'add',
            status: 'pending',
            submitted_by: 'uid-1',
          }),
        }),
      );
    });
  });

  describe('acceptSuggestion', () => {
    it('throws NotFoundError when suggestion does not exist', async () => {
      mockSuggestions.findUnique.mockResolvedValue(null);

      await expect(PlaybookChecklistService.acceptSuggestion('pbsg-missing', null, 'uid-admin')).rejects.toThrow(
        /Suggestion not found/,
      );
    });

    it('throws when suggestion is already accepted', async () => {
      mockSuggestions.findUnique.mockResolvedValue(suggestionRow({ status: 'accepted' }));

      await expect(PlaybookChecklistService.acceptSuggestion('pbsg-001', null, 'uid-admin')).rejects.toThrow(
        /already accepted/,
      );
    });

    it('accept — add + after: inserts adjacent and shifts later steps', async () => {
      const anchor = stepRow({ step_order: 3 });
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({ suggestion_kind: 'add', position: 'after', step_id: STEP_ID }),
      );
      mockSteps.findUnique.mockResolvedValueOnce(anchor); // anchor lookup in tx
      mockSteps.updateMany.mockResolvedValue({ count: 1 });
      mockSteps.create.mockResolvedValue(stepRow({ id: 'pbcs-new', step_order: 4 }));
      mockSuggestions.update.mockResolvedValue({});
      // Final findUnique for the return value
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({ status: 'accepted', suggestion_kind: 'add', position: 'after' }),
      );

      const result = await PlaybookChecklistService.acceptSuggestion(
        'pbsg-001',
        { title: 'Check NAP', stepType: 'manual' },
        'uid-admin',
      );

      // Shift steps at step_order >= 4 (anchor.order + 1)
      expect(mockSteps.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playbook_id: PLAYBOOK_ID, step_order: { gte: 4 } },
          data: { step_order: { increment: 1 } },
        }),
      );
      // Insert at step_order 4
      expect(mockSteps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ step_order: 4, title: 'Check NAP' }),
        }),
      );
      expect(result.status).toBe('accepted');
    });

    it('accept — add + supersede: inserts at anchor order and deactivates anchor', async () => {
      const anchor = stepRow({ step_order: 3 });
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({ suggestion_kind: 'add', position: 'supersede', step_id: STEP_ID }),
      );
      mockSteps.findUnique.mockResolvedValueOnce(anchor);
      mockSteps.create.mockResolvedValue(stepRow({ id: 'pbcs-new', step_order: 3 }));
      mockSteps.update.mockResolvedValue({});
      mockSuggestions.update.mockResolvedValue({});
      mockSuggestions.findUnique.mockResolvedValueOnce(suggestionRow({ status: 'accepted' }));

      await PlaybookChecklistService.acceptSuggestion('pbsg-001', { title: 'Replacement', stepType: 'manual' }, 'uid-admin');

      // New step at anchor's step_order (3)
      expect(mockSteps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ step_order: 3 }),
        }),
      );
      // Anchor deactivated
      expect(mockSteps.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STEP_ID },
          data: { is_active: false },
        }),
      );
    });

    it('accept — add + null position: appends at end', async () => {
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({ suggestion_kind: 'add', position: null, step_id: null }),
      );
      mockSteps.findMany.mockResolvedValue([{ step_order: 5 }]); // existing max
      mockSteps.create.mockResolvedValue(stepRow({ id: 'pbcs-new', step_order: 6 }));
      mockSuggestions.update.mockResolvedValue({});
      mockSuggestions.findUnique.mockResolvedValueOnce(suggestionRow({ status: 'accepted' }));

      await PlaybookChecklistService.acceptSuggestion('pbsg-001', { title: 'End step', stepType: 'manual' }, 'uid-admin');

      expect(mockSteps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ step_order: 6 }),
        }),
      );
    });

    it('accept — modify: applies patch to target step', async () => {
      const target = stepRow({ step_order: 2, updated_at: new Date('2026-01-01') });
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({
          suggestion_kind: 'modify',
          step_id: STEP_ID,
          updated_at: new Date('2026-01-01'),
        }),
      );
      mockSteps.findUnique.mockResolvedValueOnce(target);
      mockSteps.update.mockResolvedValue(stepRow({ title: 'Updated title' }));
      mockSuggestions.update.mockResolvedValue({});
      mockSuggestions.findUnique.mockResolvedValueOnce(suggestionRow({ status: 'accepted' }));

      await PlaybookChecklistService.acceptSuggestion(
        'pbsg-001',
        { title: 'Updated title' },
        'uid-admin',
      );

      expect(mockSteps.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STEP_ID },
          data: expect.objectContaining({ title: 'Updated title' }),
        }),
      );
    });

    it('accept — modify: throws 409 suggestion_stale when target changed since submission', async () => {
      const submittedAt = new Date('2026-01-10');
      const targetUpdatedAt = new Date('2026-01-15'); // target edited AFTER submission
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({ suggestion_kind: 'modify', step_id: STEP_ID, updated_at: submittedAt }),
      );
      mockSteps.findUnique.mockResolvedValueOnce(stepRow({ updated_at: targetUpdatedAt }));

      await expect(
        PlaybookChecklistService.acceptSuggestion('pbsg-001', { title: 'Updated' }, 'uid-admin'),
      ).rejects.toMatchObject({ code: 'suggestion_stale', statusCode: 409 });
    });

    it('accept — modify: throws 409 suggestion_stale when target is deactivated', async () => {
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({ suggestion_kind: 'modify', step_id: STEP_ID }),
      );
      mockSteps.findUnique.mockResolvedValueOnce(stepRow({ is_active: false }));

      await expect(
        PlaybookChecklistService.acceptSuggestion('pbsg-001', { title: 'Updated' }, 'uid-admin'),
      ).rejects.toMatchObject({ code: 'suggestion_stale', statusCode: 409 });
    });

    it('accept — remove: deactivates target (never deletes)', async () => {
      mockSuggestions.findUnique.mockResolvedValueOnce(
        suggestionRow({ suggestion_kind: 'remove', step_id: STEP_ID }),
      );
      mockSteps.findUnique.mockResolvedValueOnce(stepRow());
      mockSteps.update.mockResolvedValue(stepRow({ is_active: false }));
      mockSuggestions.update.mockResolvedValue({});
      mockSuggestions.findUnique.mockResolvedValueOnce(suggestionRow({ status: 'accepted' }));

      await PlaybookChecklistService.acceptSuggestion('pbsg-001', null, 'uid-admin');

      expect(mockSteps.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STEP_ID },
          data: { is_active: false },
        }),
      );
      // Never deleted
      expect(mockSteps.delete).not.toHaveBeenCalled();
    });
  });

  describe('rejectSuggestion', () => {
    it('rejects a pending suggestion with a review note', async () => {
      mockSuggestions.findUnique.mockResolvedValue(suggestionRow({ status: 'pending' }));
      mockSuggestions.update.mockResolvedValue(
        suggestionRow({ status: 'rejected', reviewed_by: 'uid-admin', review_note: 'Already covered by step 2' }),
      );

      const result = await PlaybookChecklistService.rejectSuggestion('pbsg-001', 'Already covered by step 2', 'uid-admin');

      expect(result.status).toBe('rejected');
      expect(result.reviewedBy).toBe('uid-admin');
      expect(result.reviewNote).toBe('Already covered by step 2');
      expect(mockSuggestions.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            reviewed_by: 'uid-admin',
            review_note: 'Already covered by step 2',
          }),
        }),
      );
    });

    it('throws when suggestion is already rejected', async () => {
      mockSuggestions.findUnique.mockResolvedValue(suggestionRow({ status: 'rejected' }));

      await expect(PlaybookChecklistService.rejectSuggestion('pbsg-001', null, 'uid-admin')).rejects.toThrow(
        /already rejected/,
      );
    });
  });

  describe('listPlaybookSuggestions', () => {
    it('filters by status when provided', async () => {
      mockSuggestions.findMany.mockResolvedValue([suggestionRow({ status: 'pending' })]);

      const result = await PlaybookChecklistService.listPlaybookSuggestions(PLAYBOOK_ID, 'pending');

      expect(result).toHaveLength(1);
      expect(mockSuggestions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playbook_id: PLAYBOOK_ID, status: 'pending' },
        }),
      );
    });

    it('returns all statuses when no filter', async () => {
      mockSuggestions.findMany.mockResolvedValue([
        suggestionRow({ status: 'pending' }),
        suggestionRow({ id: 'pbsg-2', status: 'accepted' }),
      ]);

      const result = await PlaybookChecklistService.listPlaybookSuggestions(PLAYBOOK_ID);

      expect(result).toHaveLength(2);
      expect(mockSuggestions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playbook_id: PLAYBOOK_ID },
        }),
      );
    });
  });
});
