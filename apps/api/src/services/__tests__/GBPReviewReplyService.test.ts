/**
 * GBPReviewReplyService tests — Tier A AI draft generation.
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §10 quality gate #4
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE2.md Task 9
 *
 * Test cases:
 * 1. Owner voice profile is the primary tone source
 * 2. Category tone preset augments
 * 3. Tier A produces exactly 3 drafts (entitled)
 * 4. Drafts have distinct angles
 * 5. Drafts are review-grounded (prompt includes reviewer name + comment)
 * 6. Sentiment-aware: 5★ no-comment → genuine thanks + business name
 * 7. Sentiment-aware: 1-2★ → offline redirect present in prompt
 * 8. Category guardrails: medical → no health details publicly
 * 9. gbp_ai_response entitlement gates draft generation (unentitled → preview)
 * 10. Drafts stored in gbp_reviews.ai_drafts as JSONB
 * 11. reply_status set to AI_DRAFTED after generation
 * 12. runAutopilot exists but is NOT invoked by any Phase 2 job
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockHasFeature,
  mockGbpReviewsFindFirst,
  mockGbpReviewsFindMany,
  mockGbpReviewsUpdate,
  mockGbpLocationsFindFirst,
  mockMktCampaignsFindFirst,
  mockOwnerVoiceGetProfile,
  mockCategoryToneGetPreset,
  mockAiGenerateChatCompletion,
  mockReplyToReview,
  mockTenantGbpOptionsFindUnique,
} = vi.hoisted(() => ({
  mockHasFeature: vi.fn(),
  mockGbpReviewsFindFirst: vi.fn(),
  mockGbpReviewsFindMany: vi.fn(),
  mockGbpReviewsUpdate: vi.fn(),
  mockGbpLocationsFindFirst: vi.fn(),
  mockMktCampaignsFindFirst: vi.fn(),
  mockOwnerVoiceGetProfile: vi.fn(),
  mockCategoryToneGetPreset: vi.fn(),
  mockAiGenerateChatCompletion: vi.fn(),
  mockReplyToReview: vi.fn(),
  mockTenantGbpOptionsFindUnique: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    gbp_reviews: {
      findFirst: mockGbpReviewsFindFirst,
      findMany: mockGbpReviewsFindMany,
      update: mockGbpReviewsUpdate,
    },
    gbp_locations_list: {
      findFirst: mockGbpLocationsFindFirst,
    },
    mkt_campaigns_list: {
      findFirst: mockMktCampaignsFindFirst,
    },
    tenant_gbp_options_settings: {
      findUnique: mockTenantGbpOptionsFindUnique,
    },
  },
}));

vi.mock('../GBPAdvancedSync', () => ({
  replyToReview: mockReplyToReview,
}));

// Mutable config double — the autopilot activation flag is flipped per test.
vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: { gbpAutopilotEnabled: false, gbpAutopilotBatchLimit: 5 },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../permissions/PermissionServiceFactory', () => ({
  permissionServiceFactory: {
    hasFeature: mockHasFeature,
  },
}));

vi.mock('../ai-providers', () => ({
  default: {
    generateChatCompletion: mockAiGenerateChatCompletion,
  },
}));

vi.mock('../deliverable/OwnerVoiceService', () => ({
  OwnerVoiceService: {
    getInstance: () => ({
      getProfile: mockOwnerVoiceGetProfile,
    }),
  },
}));

vi.mock('../MarketingCategoryToneService', () => ({
  MarketingCategoryToneService: {
    getInstance: () => ({
      getPresetByCategory: mockCategoryToneGetPreset,
    }),
  },
}));

// Import after mocks are set up
import { GBPReviewReplyService, selectBestAutopilotDraft } from '../GBPReviewReplyService';
import { buildGbpReviewReplyPrompt, buildGbpReviewReplyPreviewPrompt } from '../gbp/prompts';
import { unifiedConfig } from '../../config/unifiedConfig';

// ── Test constants ───────────────────────────────────────────────────────

const TENANT_ID = 'tenant_001';
const REVIEW_ID = 'review_001';
const CAMPAIGN_ID = 'camp_001';

const BASE_REVIEW = {
  id: REVIEW_ID,
  tenant_id: TENANT_ID,
  google_review_id: 'accounts/123/locations/456/reviews/789',
  reviewer_name: 'Jane Smith',
  reviewer_photo_url: null,
  star_rating: 4,
  comment: 'Great service and friendly staff!',
  review_reply: null,
  reply_update_time: null,
  google_create_time: new Date('2026-08-01'),
  google_update_time: new Date('2026-08-01'),
  is_replied: false,
  location_id: 'loc_001',
  reply_status: 'NONE',
  ai_drafts: null,
  sentiment: 'positive',
};

const BASE_LOCATION = {
  id: 'loc_001',
  tenant_id: TENANT_ID,
  business_name: 'Test Business',
  location_name: 'Test Business',
  category: 'restaurant',
};

const BASE_CAMPAIGN = {
  id: CAMPAIGN_ID,
  category: 'gbp_optimization',
  tone: 'warm',
};

const OWNER_VOICE = {
  id: 'voice_001',
  campaignId: CAMPAIGN_ID,
  person: 'first_person',
  formality: 'casual',
  humor: 'light',
  apologyStyle: 'fix_first',
  signoffStyle: 'first_name',
  signature: '- Sarah, Owner',
  inferredFromCount: 5,
  inferredSample: null,
  operatorOverrides: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const CATEGORY_TONE = {
  id: 'tone_001',
  category: 'restaurant',
  tone: 'warm and welcoming',
  description: 'Friendly, food-loving, community-oriented',
  is_active: true,
};

const THREE_DRAFTS_RESPONSE = {
  content: JSON.stringify([
    { angle: 'warm_direct', text: 'Hi Jane, thanks so much for the kind words!' },
    { angle: 'professional_concise', text: 'Thank you for your review, Jane.' },
    { angle: 'empathetic_detailed', text: 'Dear Jane, we truly appreciate your feedback...' },
  ]),
};

const PREVIEW_DRAFT_RESPONSE = {
  content: JSON.stringify({ angle: 'preview', text: 'Thanks for the review!' }),
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: entitled, review exists, location exists, campaign exists
  mockHasFeature.mockResolvedValue(true);
  mockGbpReviewsFindFirst.mockResolvedValue(BASE_REVIEW);
  mockGbpLocationsFindFirst.mockResolvedValue(BASE_LOCATION);
  mockMktCampaignsFindFirst.mockResolvedValue(BASE_CAMPAIGN);
  mockOwnerVoiceGetProfile.mockResolvedValue(OWNER_VOICE);
  mockCategoryToneGetPreset.mockResolvedValue(CATEGORY_TONE);
  mockAiGenerateChatCompletion.mockResolvedValue(THREE_DRAFTS_RESPONSE);
  mockGbpReviewsUpdate.mockResolvedValue({});
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('GBPReviewReplyService.generateDrafts', () => {
  it('1. Owner voice profile is the primary tone source (prompt includes owner voice content)', async () => {
    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const callArg = mockAiGenerateChatCompletion.mock.calls[0][0];
    const userPrompt = callArg.messages.find((m: any) => m.role === 'user').content;
    expect(userPrompt).toContain('first_person');
    expect(userPrompt).toContain('casual');
    expect(userPrompt).toContain('light');
    expect(userPrompt).toContain('fix_first');
    expect(userPrompt).toContain('- Sarah, Owner');
  });

  it('2. Category tone preset augments the prompt', async () => {
    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const callArg = mockAiGenerateChatCompletion.mock.calls[0][0];
    const userPrompt = callArg.messages.find((m: any) => m.role === 'user').content;
    expect(userPrompt).toContain('warm and welcoming');
    expect(userPrompt).toContain('Friendly, food-loving, community-oriented');
  });

  it('3. Tier A produces exactly 3 drafts (entitled)', async () => {
    const svc = GBPReviewReplyService.getInstance();
    const result = await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    expect(result.previewMode).toBe(false);
    expect(result.drafts).toHaveLength(3);
  });

  it('4. Drafts have distinct angles (warm_direct, professional_concise, empathetic_detailed)', async () => {
    const svc = GBPReviewReplyService.getInstance();
    const result = await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const angles = result.drafts.map((d) => d.angle);
    expect(angles).toContain('warm_direct');
    expect(angles).toContain('professional_concise');
    expect(angles).toContain('empathetic_detailed');
    expect(new Set(angles).size).toBe(3);
  });

  it('5. Drafts are review-grounded (prompt includes reviewer name + comment text)', async () => {
    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const callArg = mockAiGenerateChatCompletion.mock.calls[0][0];
    const userPrompt = callArg.messages.find((m: any) => m.role === 'user').content;
    expect(userPrompt).toContain('Jane Smith');
    expect(userPrompt).toContain('Great service and friendly staff!');
  });

  it('6. Sentiment-aware: 5★ no-comment → genuine thanks + business name (not generic)', async () => {
    mockGbpReviewsFindFirst.mockResolvedValue({
      ...BASE_REVIEW,
      star_rating: 5,
      comment: null,
    });

    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const callArg = mockAiGenerateChatCompletion.mock.calls[0][0];
    const userPrompt = callArg.messages.find((m: any) => m.role === 'user').content;
    // Should mention the business name and category, not be generic
    expect(userPrompt).toContain('Test Business');
    expect(userPrompt).toContain('restaurant');
    // Should include the 5★ no-comment sentiment rule
    expect(userPrompt).toContain('5★ no comment');
  });

  it('7. Sentiment-aware: 1-2★ → offline redirect present in prompt', async () => {
    mockGbpReviewsFindFirst.mockResolvedValue({
      ...BASE_REVIEW,
      star_rating: 1,
      comment: 'Terrible experience, would not recommend.',
    });

    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const callArg = mockAiGenerateChatCompletion.mock.calls[0][0];
    const userPrompt = callArg.messages.find((m: any) => m.role === 'user').content;
    expect(userPrompt).toMatch(/redirect/i);
    expect(userPrompt).toMatch(/offline|reach us|private channel/i);
  });

  it('8. Category guardrails: medical → no health details publicly in prompt', async () => {
    mockGbpLocationsFindFirst.mockResolvedValue({
      ...BASE_LOCATION,
      category: 'medical_clinic',
    });

    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const callArg = mockAiGenerateChatCompletion.mock.calls[0][0];
    const userPrompt = callArg.messages.find((m: any) => m.role === 'user').content;
    expect(userPrompt).toContain('Medical/Health');
    expect(userPrompt).toContain('health details');
    expect(userPrompt).toContain('publicly');
  });

  it('9. gbp_ai_response entitlement gates draft generation (unentitled → preview mode)', async () => {
    mockHasFeature.mockResolvedValue(false);
    mockAiGenerateChatCompletion.mockResolvedValue(PREVIEW_DRAFT_RESPONSE);

    const svc = GBPReviewReplyService.getInstance();
    const result = await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    expect(result.previewMode).toBe(true);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].angle).toBe('preview');
    expect(result.upgradeCta).toBeDefined();
    // Should NOT update the review row in preview mode
    expect(mockGbpReviewsUpdate).not.toHaveBeenCalled();
  });

  it('10. Drafts stored in gbp_reviews.ai_drafts as JSONB', async () => {
    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    expect(mockGbpReviewsUpdate).toHaveBeenCalledWith({
      where: { id: REVIEW_ID },
      data: expect.objectContaining({
        ai_drafts: expect.any(Array),
        reply_status: 'AI_DRAFTED',
      }),
    });
    const updateCall = mockGbpReviewsUpdate.mock.calls[0][0];
    expect(updateCall.data.ai_drafts).toHaveLength(3);
  });

  it('11. reply_status set to AI_DRAFTED after generation', async () => {
    const svc = GBPReviewReplyService.getInstance();
    await svc.generateDrafts(TENANT_ID, REVIEW_ID);

    const updateCall = mockGbpReviewsUpdate.mock.calls[0][0];
    expect(updateCall.data.reply_status).toBe('AI_DRAFTED');
  });

  it('12. runAutopilot is inert while GBP_AUTOPILOT_ENABLED is off (no-op + no writes)', async () => {
    const svc = GBPReviewReplyService.getInstance();
    const result = await svc.runAutopilot(TENANT_ID);
    expect(result).toEqual({ activated: false, reason: 'not_activated', scanned: 0, published: 0, skipped: 0, failed: 0 });
    // Should NOT call any AI or DB update (no draft generation, no reply publishing)
    expect(mockAiGenerateChatCompletion).not.toHaveBeenCalled();
    expect(mockGbpReviewsUpdate).not.toHaveBeenCalled();
  });
});

// ── Tier B autopilot ─────────────────────────────────────────────────────

const THREE_DRAFTS = {
  drafts: [
    { angle: 'grateful', text: 'Thank you so much for the kind words — it means a lot to our whole team!' },
    { angle: 'brief', text: 'Thanks!' },
    { angle: 'placeholder', text: 'Dear {reviewer}, TODO: personalise this reply about our business.' },
  ],
  previewMode: false,
};

describe('selectBestAutopilotDraft', () => {
  it('picks a natural-length thank-you over a stub and a placeholder', () => {
    const best = selectBestAutopilotDraft(THREE_DRAFTS.drafts);
    expect(best?.angle).toBe('grateful');
  });

  it('returns null when every draft is empty', () => {
    expect(selectBestAutopilotDraft([{ angle: 'a', text: '   ' }])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(selectBestAutopilotDraft([])).toBeNull();
  });
});

describe('runAutopilot gates', () => {
  const svc = GBPReviewReplyService.getInstance();

  beforeEach(() => {
    mockReplyToReview.mockReset();
    mockGbpReviewsFindMany.mockReset();
    mockTenantGbpOptionsFindUnique.mockReset();
    mockGbpReviewsUpdate.mockReset();
    unifiedConfig.gbpAutopilotEnabled = false;
  });

  it('does not run when the platform flag is off', async () => {
    const result = await svc.runAutopilot(TENANT_ID);
    expect(result.reason).toBe('not_activated');
    expect(mockGbpReviewsFindMany).not.toHaveBeenCalled();
  });

  it('does not run without the gbp_ai_response entitlement', async () => {
    unifiedConfig.gbpAutopilotEnabled = true;
    mockHasFeature.mockResolvedValue(false);
    const result = await svc.runAutopilot(TENANT_ID);
    expect(result.reason).toBe('not_entitled');
    expect(mockGbpReviewsFindMany).not.toHaveBeenCalled();
  });

  it('does not run when the merchant has not opted in', async () => {
    unifiedConfig.gbpAutopilotEnabled = true;
    mockHasFeature.mockResolvedValue(true);
    mockTenantGbpOptionsFindUnique.mockResolvedValue({ gbp_autopilot_enabled: false, gbp_autopilot_min_rating: 5 });
    const result = await svc.runAutopilot(TENANT_ID);
    expect(result.reason).toBe('merchant_opt_out');
    expect(mockGbpReviewsFindMany).not.toHaveBeenCalled();
  });

  it('publishes the best draft and marks the review PUBLISHED when all gates pass', async () => {
    unifiedConfig.gbpAutopilotEnabled = true;
    mockHasFeature.mockResolvedValue(true);
    mockTenantGbpOptionsFindUnique.mockResolvedValue({ gbp_autopilot_enabled: true, gbp_autopilot_min_rating: 5 });
    mockGbpReviewsFindMany.mockResolvedValue([BASE_REVIEW]);

    // generateDrafts() path
    mockGbpReviewsFindFirst.mockResolvedValue(BASE_REVIEW);
    mockGbpLocationsFindFirst.mockResolvedValue(BASE_LOCATION);
    mockMktCampaignsFindFirst.mockResolvedValue(BASE_CAMPAIGN);
    mockOwnerVoiceGetProfile.mockResolvedValue(null);
    mockCategoryToneGetPreset.mockResolvedValue(null);
    mockAiGenerateChatCompletion.mockResolvedValue({ content: JSON.stringify(THREE_DRAFTS.drafts) });
    mockGbpReviewsUpdate.mockResolvedValue({});
    mockReplyToReview.mockResolvedValue({ success: true });

    const result = await svc.runAutopilot(TENANT_ID);

    expect(result).toMatchObject({ activated: true, scanned: 1, published: 1, failed: 0 });
    // Publishes the 'grateful' draft, not the stub or the placeholder
    expect(mockReplyToReview).toHaveBeenCalledWith(
      TENANT_ID,
      BASE_REVIEW.google_review_id,
      expect.stringContaining('Thank you so much'),
    );
    expect(mockGbpReviewsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REVIEW_ID },
        data: expect.objectContaining({ reply_status: 'PUBLISHED', is_replied: true }),
      }),
    );
  });

  it('counts a failed publish without writing a reply', async () => {
    unifiedConfig.gbpAutopilotEnabled = true;
    mockHasFeature.mockResolvedValue(true);
    mockTenantGbpOptionsFindUnique.mockResolvedValue({ gbp_autopilot_enabled: true, gbp_autopilot_min_rating: 5 });
    mockGbpReviewsFindMany.mockResolvedValue([BASE_REVIEW]);

    mockGbpReviewsFindFirst.mockResolvedValue(BASE_REVIEW);
    mockGbpLocationsFindFirst.mockResolvedValue(BASE_LOCATION);
    mockMktCampaignsFindFirst.mockResolvedValue(BASE_CAMPAIGN);
    mockOwnerVoiceGetProfile.mockResolvedValue(null);
    mockCategoryToneGetPreset.mockResolvedValue(null);
    mockAiGenerateChatCompletion.mockResolvedValue({ content: JSON.stringify(THREE_DRAFTS.drafts) });
    mockReplyToReview.mockResolvedValue({ success: false, error: 'API error: 403' });

    const result = await svc.runAutopilot(TENANT_ID);

    expect(result).toMatchObject({ activated: true, scanned: 1, published: 0, failed: 1 });
    // Tier A still stored the drafts (reply_status = AI_DRAFTED), but nothing
    // was published — no PUBLISHED write must appear.
    const publishedWrites = mockGbpReviewsUpdate.mock.calls.filter(
      (call) => call[0]?.data?.reply_status === 'PUBLISHED',
    );
    expect(publishedWrites).toHaveLength(0);
  });
});

// ── Prompt builder unit tests (no mocks needed) ──────────────────────────

describe('buildGbpReviewReplyPrompt', () => {
  it('includes owner voice profile content before category tone (PRIMARY > SECONDARY)', () => {
    const prompt = buildGbpReviewReplyPrompt({
      reviewerName: 'John Doe',
      starRating: 4,
      comment: 'Good experience',
      reviewTime: '2026-08-01',
      businessName: 'Cafe Test',
      businessCategory: 'restaurant',
      ownerVoiceProfile: {
        person: 'we',
        formality: 'professional',
        humor: 'none',
        apologyStyle: 'direct_apology',
        signoffStyle: 'team',
        signature: '- The Cafe Team',
      },
      categoryTonePreset: { tone: 'warm', description: 'Be warm' },
      campaignTone: null,
    });

    const voiceIdx = prompt.indexOf('Owner voice profile (PRIMARY');
    const categoryIdx = prompt.indexOf('Category tone preset (SECONDARY');
    expect(voiceIdx).toBeGreaterThan(-1);
    expect(categoryIdx).toBeGreaterThan(-1);
    expect(voiceIdx).toBeLessThan(categoryIdx);
  });

  it('falls back to campaign tone when no owner voice profile', () => {
    const prompt = buildGbpReviewReplyPrompt({
      reviewerName: 'John Doe',
      starRating: 3,
      comment: 'Okay',
      reviewTime: null,
      businessName: 'Shop Test',
      businessCategory: 'retail',
      ownerVoiceProfile: null,
      categoryTonePreset: null,
      campaignTone: 'friendly',
    });

    expect(prompt).toContain('Campaign tone (FALLBACK');
    expect(prompt).toContain('friendly');
  });
});

describe('buildGbpReviewReplyPreviewPrompt', () => {
  it('produces a single-draft preview prompt (not 3-draft)', () => {
    const prompt = buildGbpReviewReplyPreviewPrompt({
      reviewerName: 'Jane',
      starRating: 5,
      comment: 'Loved it',
      reviewTime: null,
      businessName: 'Test Biz',
      businessCategory: 'retail',
      ownerVoiceProfile: null,
      categoryTonePreset: null,
      campaignTone: null,
    });

    expect(prompt).toContain('ONE warm, genuine draft');
    expect(prompt).toContain('preview');
  });
});
