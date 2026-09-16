/**
 * Widget bot-pipeline characterization tests (§4.4 of the WhatsApp sprint spec)
 *
 * Pins the CURRENT behavior of POST /api/public/bot/conversations/:sessionId/messages
 * so the BotTurnPipeline extraction (§8.2) can be proven behavior-neutral:
 *
 * - session validation (403 session_expired)
 * - guardrail block before lazy creation (persist iff conversation exists)
 * - lazy conversation creation with source='widget'
 * - skill intent → "Here's what I found:" + skillCard/skillData
 * - handshake layer (greetings/gratitude/farewells)
 * - dynamic (GPT) vs static (FAQ + channel steering) tier routing
 * - BERT guardrail + BERT intent inside the dynamic path
 * - CRM escalation on fallback/channel_steering (once per conversation)
 * - capability_disabled on lazy creation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ──────────────────────────────────────────────────────────────

const {
  mockConfigService,
  mockConversationService,
  mockStaticResponseService,
  mockGuardrailService,
  mockIntentService,
  mockSkillService,
  mockCrmIntegrationService,
  mockBusinessHoursService,
  mockDynamicResponseService,
  mockChannelSteeringService,
  mockCrmAssistantService,
  mockBertGuardrailService,
  mockBertIntentService,
  mockProductCatalogService,
  mockPolicyService,
  mockResolveEffectiveCapabilities,
} = vi.hoisted(() => ({
  mockConfigService: { getOrCreate: vi.fn(), getPublicConfig: vi.fn(), getContextualGreeting: vi.fn() },
  mockConversationService: {
    prepareConversation: vi.fn(),
    createConversation: vi.fn(),
    getConversationBySession: vi.fn(),
    isSessionValid: vi.fn(),
    appendMessage: vi.fn(),
    getMessages: vi.fn(),
    getContextWindow: vi.fn(),
    addFeedback: vi.fn(),
  },
  mockStaticResponseService: { findResponse: vi.fn() },
  mockGuardrailService: { checkMessage: vi.fn(), getBlockResponse: vi.fn() },
  mockIntentService: { detectIntent: vi.fn() },
  mockSkillService: { executeSkill: vi.fn() },
  mockCrmIntegrationService: { isEscalated: vi.fn(), escalateToTicket: vi.fn() },
  mockBusinessHoursService: { checkBusinessHours: vi.fn() },
  mockDynamicResponseService: {
    isPlatformAiEnabled: vi.fn(),
    isAvailable: vi.fn(),
    generateResponse: vi.fn(),
  },
  mockChannelSteeringService: { steer: vi.fn() },
  mockCrmAssistantService: { lookupTickets: vi.fn(), createTicket: vi.fn() },
  mockBertGuardrailService: { isAvailable: vi.fn(), isToxic: vi.fn() },
  mockBertIntentService: { isAvailable: vi.fn(), classify: vi.fn() },
  mockProductCatalogService: { searchProducts: vi.fn() },
  mockPolicyService: { getPolicies: vi.fn() },
  mockResolveEffectiveCapabilities: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/BotConfigurationService', () => ({
  default: { getInstance: () => mockConfigService },
}));
vi.mock('../services/BotConversationService', () => ({
  default: { getInstance: () => mockConversationService },
}));
vi.mock('../services/BotStaticResponseService', () => ({
  default: { getInstance: () => mockStaticResponseService },
}));
vi.mock('../services/BotGuardrailService', () => ({
  default: { getInstance: () => mockGuardrailService },
}));
vi.mock('../services/BotIntentService', () => ({
  default: { getInstance: () => mockIntentService },
}));
vi.mock('../services/BotSkillService', () => ({
  default: { getInstance: () => mockSkillService },
}));
vi.mock('../services/BotCrmIntegrationService', () => ({
  default: { getInstance: () => mockCrmIntegrationService },
}));
vi.mock('../services/BotBusinessHoursService', () => ({
  default: { getInstance: () => mockBusinessHoursService },
}));
vi.mock('../services/BotDynamicResponseService', () => ({
  default: { getInstance: () => mockDynamicResponseService },
}));
vi.mock('../services/BotChannelSteeringService', () => ({
  default: { getInstance: () => mockChannelSteeringService },
}));
vi.mock('../services/BotCrmAssistantService', () => ({
  default: { getInstance: () => mockCrmAssistantService },
}));
vi.mock('../services/BotBertGuardrailService', () => ({
  default: { getInstance: () => mockBertGuardrailService },
}));
vi.mock('../services/BotBertIntentService', () => ({
  default: { getInstance: () => mockBertIntentService },
}));
vi.mock('../services/BotProductCatalogService', () => ({
  default: { getInstance: () => mockProductCatalogService },
}));
vi.mock('../services/StorefrontPolicyService', () => ({
  StorefrontPolicyService: { getInstance: () => mockPolicyService },
}));
vi.mock('../services/EffectiveCapabilityResolver', () => ({
  resolveEffectiveCapabilities: mockResolveEffectiveCapabilities,
}));
vi.mock('../middleware/embed-key-validation', () => ({
  resolveEmbedKey: (_req: any, _res: any, next: any) => next(),
  getTenantIdFromRequest: (req: any) => req.body?.tenantId || req.query?.tenantId || null,
}));

import botPublicRoutes from '../routes/bot-public';

// ── Fixtures ───────────────────────────────────────────────────────────

const CONVERSATION = {
  id: 'conv-1',
  tenantId: 'tid-demo',
  sessionId: 'sess-1',
  customerEmail: null,
  customerPhone: null,
  source: 'widget',
  status: 'active',
  resolvedBy: null,
  pageContext: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
};

const CONFIG = {
  status: 'active',
  botName: 'Selly',
  tone: 'friendly',
  greeting: 'Hi! How can I help you today?',
  fallbackMessage: 'Sorry, I cannot help with that.',
  escalationEnabled: true,
  afterHoursEnabled: false,
};

const CAPS = {
  effective: {
    chatbot: {
      enabled: true,
      widget_enabled: true,
      dynamic_enabled: false,
      skills_enabled: true,
      allowed_skill_types: [],
    },
  },
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/bot', botPublicRoutes);
  return app;
}

function postMessage(app: express.Express, body: Record<string, any> = {}) {
  return request(app)
    .post('/api/public/bot/conversations/sess-1/messages')
    .send({ message: 'do you have rice?', tenantId: 'tid-demo', ...body });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('bot-public message pipeline — characterization', () => {
  let msgSeq = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    msgSeq = 0;

    mockConversationService.isSessionValid.mockResolvedValue(true);
    mockConversationService.getConversationBySession.mockResolvedValue(CONVERSATION);
    mockConversationService.appendMessage.mockImplementation(async (params: any) => ({
      id: `msg-${++msgSeq}`,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
    }));
    mockConversationService.createConversation.mockResolvedValue({
      conversation: CONVERSATION,
      greeting: CONFIG.greeting,
    });
    mockConfigService.getOrCreate.mockResolvedValue(CONFIG);
    mockGuardrailService.checkMessage.mockImplementation(async (_t: string, msg: string) => ({
      action: 'pass',
      modifiedMessage: msg,
      triggeredRules: [],
    }));
    mockGuardrailService.getBlockResponse.mockReturnValue(CONFIG.fallbackMessage);
    mockIntentService.detectIntent.mockResolvedValue({ intent: null, confidence: 0, mappedSkill: null });
    mockResolveEffectiveCapabilities.mockResolvedValue(CAPS);
    mockDynamicResponseService.isPlatformAiEnabled.mockResolvedValue(true);
    mockDynamicResponseService.isAvailable.mockReturnValue(false);
    mockBertGuardrailService.isAvailable.mockReturnValue(false);
    mockBertIntentService.isAvailable.mockReturnValue(false);
    mockStaticResponseService.findResponse.mockResolvedValue({
      reply: 'Our FAQ answer',
      responseType: 'faq',
      matchedFaqId: 'faq-1',
    });
    mockChannelSteeringService.steer.mockResolvedValue({
      reply: 'You can reach us via phone or email.',
      channels: [{ type: 'phone', label: 'Call us' }],
    });
    mockCrmIntegrationService.isEscalated.mockResolvedValue(false);
    mockCrmIntegrationService.escalateToTicket.mockResolvedValue(undefined);
  });

  it('returns 403 session_expired for an invalid/expired session', async () => {
    mockConversationService.isSessionValid.mockResolvedValue(false);
    const res = await postMessage(buildApp());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('session_expired');
    expect(mockConversationService.appendMessage).not.toHaveBeenCalled();
  });

  it('guardrail block + existing conversation → persists blocked user + assistant rows', async () => {
    mockGuardrailService.checkMessage.mockResolvedValue({
      action: 'block',
      modifiedMessage: 'spam text',
      triggeredRules: ['rule-1'],
    });

    const res = await postMessage(buildApp(), { message: 'spam text' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe(CONFIG.fallbackMessage);
    expect(res.body.responseType).toBe('fallback');
    expect(res.body.guardrailResult).toBe('blocked');
    expect(res.body.messageId).toBeTruthy();

    const calls = mockConversationService.appendMessage.mock.calls.map((c: any[]) => c[0]);
    expect(calls[0]).toMatchObject({ role: 'user', content: 'spam text', guardrailResult: 'blocked' });
    expect(calls[1]).toMatchObject({
      role: 'assistant',
      content: CONFIG.fallbackMessage,
      responseType: 'fallback',
      guardrailResult: 'blocked',
    });
    expect(mockConversationService.createConversation).not.toHaveBeenCalled();
  });

  it('guardrail block + no conversation → block response, nothing persisted, no conversation created', async () => {
    mockConversationService.getConversationBySession.mockResolvedValue(null);
    mockGuardrailService.checkMessage.mockResolvedValue({
      action: 'block',
      modifiedMessage: 'spam text',
      triggeredRules: ['rule-1'],
    });

    const res = await postMessage(buildApp(), { message: 'spam text' });

    expect(res.status).toBe(200);
    expect(res.body.guardrailResult).toBe('blocked');
    expect(res.body.messageId).toBeNull();
    expect(mockConversationService.createConversation).not.toHaveBeenCalled();
    expect(mockConversationService.appendMessage).not.toHaveBeenCalled();
  });

  it('lazy creation: first passing message creates conversation (source=widget) then stores user message', async () => {
    mockConversationService.getConversationBySession.mockResolvedValue(null);

    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(mockConversationService.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tid-demo', sessionId: 'sess-1', source: 'widget' })
    );
    const calls = mockConversationService.appendMessage.mock.calls.map((c: any[]) => c[0]);
    expect(calls[0]).toMatchObject({ role: 'user', content: 'do you have rice?', guardrailResult: 'pass' });
  });

  it('lazy creation blocked by capability → 403 capability_disabled, nothing persisted', async () => {
    mockConversationService.getConversationBySession.mockResolvedValue(null);
    mockResolveEffectiveCapabilities.mockResolvedValue({ effective: { chatbot: { enabled: false } } });

    const res = await postMessage(buildApp());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('capability_disabled');
    expect(mockConversationService.createConversation).not.toHaveBeenCalled();
    expect(mockConversationService.appendMessage).not.toHaveBeenCalled();
  });

  it('skill intent → "Here\'s what I found:" reply + skillCard + persisted skill metadata', async () => {
    mockIntentService.detectIntent.mockResolvedValue({
      intent: 'product_search',
      confidence: 0.92,
      mappedSkill: 'product_search',
    });
    mockSkillService.executeSkill.mockResolvedValue({
      success: true,
      cardSchema: { type: 'product_list' },
      data: { items: [{ name: 'Basmati Rice', price: 12.99 }] },
    });

    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe(`Here's what I found:`);
    expect(res.body.responseType).toBe('skill');
    expect(res.body.skillName).toBe('product_search');
    expect(res.body.skillCard).toEqual({ type: 'product_list' });

    const calls = mockConversationService.appendMessage.mock.calls.map((c: any[]) => c[0]);
    const assistant = calls.find((c: any) => c.role === 'assistant');
    expect(assistant).toMatchObject({
      responseType: 'skill',
      skillName: 'product_search',
      metadata: {
        skillCard: { type: 'product_list' },
        skillData: { items: [{ name: 'Basmati Rice', price: 12.99 }] },
      },
    });
  });

  it('handshake: greeting message → handshake reply, no FAQ/dynamic call', async () => {
    const res = await postMessage(buildApp(), { message: 'hi' });

    expect(res.status).toBe(200);
    expect(res.body.responseType).toBe('handshake');
    expect(res.body.reply).toContain('Selly');
    expect(mockStaticResponseService.findResponse).not.toHaveBeenCalled();
    expect(mockDynamicResponseService.generateResponse).not.toHaveBeenCalled();

    const calls = mockConversationService.appendMessage.mock.calls.map((c: any[]) => c[0]);
    const assistant = calls.find((c: any) => c.role === 'assistant');
    expect(assistant).toMatchObject({ responseType: 'handshake', intent: 'handshake' });
  });

  it('dynamic path: uses GPT response with matchedFaqId, ragChunksUsed metadata, channels passthrough', async () => {
    mockResolveEffectiveCapabilities.mockResolvedValue({
      effective: { chatbot: { enabled: true, dynamic_enabled: true } },
    });
    mockDynamicResponseService.isAvailable.mockReturnValue(true);
    mockDynamicResponseService.generateResponse.mockResolvedValue({
      reply: 'Dynamic answer about rice',
      responseType: 'dynamic',
      matchedFaqId: 'faq-9',
      ragChunksUsed: 3,
      channels: undefined,
    });

    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Dynamic answer about rice');
    expect(res.body.responseType).toBe('dynamic');
    expect(res.body.matchedFaqId).toBe('faq-9');
    expect(res.body.escalated).toBe(false);

    const calls = mockConversationService.appendMessage.mock.calls.map((c: any[]) => c[0]);
    const assistant = calls.find((c: any) => c.role === 'assistant');
    expect(assistant.metadata).toMatchObject({ ragChunksUsed: 3 });
  });

  it('dynamic path + BERT toxic → blocked fallback assistant message', async () => {
    mockResolveEffectiveCapabilities.mockResolvedValue({
      effective: { chatbot: { enabled: true, dynamic_enabled: true } },
    });
    mockDynamicResponseService.isAvailable.mockReturnValue(true);
    mockBertGuardrailService.isAvailable.mockReturnValue(true);
    mockBertGuardrailService.isToxic.mockResolvedValue({ toxic: true, score: 0.99 });

    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(res.body.responseType).toBe('fallback');
    expect(res.body.guardrailResult).toBe('blocked');
    expect(mockDynamicResponseService.generateResponse).not.toHaveBeenCalled();

    const calls = mockConversationService.appendMessage.mock.calls.map((c: any[]) => c[0]);
    const assistant = calls.find((c: any) => c.role === 'assistant');
    expect(assistant.metadata).toMatchObject({ bert_toxicity_score: 0.99 });
  });

  it('static path: FAQ match → static reply, no steering, no escalation', async () => {
    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Our FAQ answer');
    expect(res.body.responseType).toBe('faq');
    expect(res.body.matchedFaqId).toBe('faq-1');
    expect(mockChannelSteeringService.steer).not.toHaveBeenCalled();
    expect(mockCrmIntegrationService.escalateToTicket).not.toHaveBeenCalled();
  });

  it('static fallback → channel steering reply + channels + CRM escalation once', async () => {
    mockStaticResponseService.findResponse.mockResolvedValue({
      reply: 'fallback',
      responseType: 'fallback',
      matchedFaqId: null,
    });

    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(res.body.responseType).toBe('channel_steering');
    expect(res.body.reply).toBe('You can reach us via phone or email.');
    expect(res.body.channels).toEqual([{ type: 'phone', label: 'Call us' }]);
    expect(res.body.escalated).toBe(true);
    expect(mockCrmIntegrationService.escalateToTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tid-demo',
        conversationId: 'conv-1',
        sessionId: 'sess-1',
      })
    );

    const calls = mockConversationService.appendMessage.mock.calls.map((c: any[]) => c[0]);
    const assistant = calls.find((c: any) => c.role === 'assistant');
    expect(assistant.metadata).toMatchObject({ channels: [{ type: 'phone', label: 'Call us' }] });
  });

  it('static fallback + already escalated → no second ticket, escalated=false', async () => {
    mockStaticResponseService.findResponse.mockResolvedValue({
      reply: 'fallback',
      responseType: 'fallback',
      matchedFaqId: null,
    });
    mockCrmIntegrationService.isEscalated.mockResolvedValue(true);

    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(res.body.escalated).toBe(false);
    expect(mockCrmIntegrationService.escalateToTicket).not.toHaveBeenCalled();
  });

  it('static fallback + escalation disabled → steering reply without ticket', async () => {
    mockStaticResponseService.findResponse.mockResolvedValue({
      reply: 'fallback',
      responseType: 'fallback',
      matchedFaqId: null,
    });
    mockConfigService.getOrCreate.mockResolvedValue({ ...CONFIG, escalationEnabled: false });

    const res = await postMessage(buildApp());

    expect(res.status).toBe(200);
    expect(res.body.escalated).toBe(false);
    expect(mockCrmIntegrationService.escalateToTicket).not.toHaveBeenCalled();
  });
});
