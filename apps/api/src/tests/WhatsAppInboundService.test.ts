/**
 * WhatsAppInboundService tests (WHATSAPP_CHANNEL_INTEGRATION_SPEC §17)
 *
 * Covers the synchronous intake contract + detached completion:
 * - payload validation (malformed values acked without processing)
 * - unknown phone_number_id → ignored
 * - status-only payloads → no-op
 * - wa_message_id dedupe (read-path + P2002 race backstop)
 * - session lifecycle (reusable → archive stale → create w/ skipGreeting)
 * - non-text + oversized canned replies (dedupe claim still persisted)
 * - sequential batch processing
 * - per-sender intake mutex serialization
 * - completion failure → configured fallback → dead-letter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockConversationService,
  mockConfigService,
  mockChannelService,
  mockOutboundService,
  mockPreprocessTurn,
  mockCompleteTurn,
  mockPersistAssistantTurn,
} = vi.hoisted(() => ({
  mockConversationService: {
    findMessageByWaMessageId: vi.fn(),
    getReusableConversationBySession: vi.fn(),
    getConversationBySession: vi.fn(),
    updateStatus: vi.fn(),
    createConversation: vi.fn(),
    appendMessage: vi.fn(),
  },
  mockConfigService: { getOrCreate: vi.fn() },
  mockChannelService: { resolveChannel: vi.fn() },
  mockOutboundService: { sendText: vi.fn() },
  mockPreprocessTurn: vi.fn(),
  mockCompleteTurn: vi.fn(),
  mockPersistAssistantTurn: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/BotConversationService', () => ({
  default: { getInstance: () => mockConversationService },
}));
vi.mock('../services/BotConfigurationService', () => ({
  default: { getInstance: () => mockConfigService },
}));
vi.mock('../services/whatsapp/WhatsAppChannelService', () => ({
  default: { getInstance: () => mockChannelService },
}));
vi.mock('../services/whatsapp/WhatsAppOutboundService', () => ({
  default: { getInstance: () => mockOutboundService },
  redactPhone: (p: string) => (typeof p === 'string' ? `***${p.slice(-4)}` : '***'),
}));
vi.mock('../services/bot/BotTurnPipeline', () => ({
  preprocessTurn: mockPreprocessTurn,
  completeTurn: mockCompleteTurn,
  persistAssistantTurn: mockPersistAssistantTurn,
}));

import WhatsAppInboundService from '../services/whatsapp/WhatsAppInboundService';

// ── Fixtures ───────────────────────────────────────────────────────────

const CHANNEL = {
  id: 'wac-test-1',
  tenantId: 'tid-1',
  phoneNumberId: 'pn-1',
  displayPhoneNumber: '+15550001111',
  accessTokenEncrypted: 'enc',
  status: 'active',
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CONFIG = {
  status: 'active',
  botName: 'Selly',
  fallbackMessage: 'Configured fallback.',
  escalationEnabled: false,
};

const CONV = {
  id: 'conv-1',
  tenantId: 'tid-1',
  sessionId: 'wa-pn-1-15551234567',
  customerPhone: '15551234567',
  source: 'whatsapp',
  status: 'active',
};

function waMessage(overrides: Record<string, any> = {}) {
  return {
    id: 'wamid.1',
    from: '15551234567',
    timestamp: '1700000000',
    type: 'text',
    text: { body: 'do you have rice?' },
    ...overrides,
  };
}

function waValue(overrides: Record<string, any> = {}) {
  return {
    metadata: { phone_number_id: 'pn-1', display_phone_number: '+15550001111' },
    contacts: [{ wa_id: '15551234567', profile: { name: 'Sam' } }],
    messages: [waMessage()],
    ...overrides,
  };
}

/** Let the detached completion chain drain. */
async function flush(times = 8) {
  for (let i = 0; i < times; i++) await new Promise(r => setImmediate(r));
}

function freshService(): WhatsAppInboundService {
  (WhatsAppInboundService as any).instance = undefined;
  return WhatsAppInboundService.getInstance();
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('WhatsAppInboundService.handleChange', () => {
  let service: WhatsAppInboundService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = freshService();

    mockChannelService.resolveChannel.mockResolvedValue(CHANNEL);
    mockConfigService.getOrCreate.mockResolvedValue(CONFIG);
    mockConversationService.findMessageByWaMessageId.mockResolvedValue(null);
    mockConversationService.getReusableConversationBySession.mockResolvedValue(CONV);
    mockConversationService.getConversationBySession.mockResolvedValue(CONV);
    mockConversationService.appendMessage.mockResolvedValue({ id: 'msg-1' });
    mockPreprocessTurn.mockResolvedValue({
      rawText: 'do you have rice?',
      userText: 'do you have rice?',
      guardrailAction: 'pass',
      guardrailPersist: 'pass',
      userPersisted: true,
    });
    mockCompleteTurn.mockResolvedValue({
      kind: 'static',
      reply: 'Our FAQ answer',
      responseType: 'faq',
      guardrailResult: 'pass',
    });
    mockPersistAssistantTurn.mockResolvedValue({ id: 'msg-2' });
    mockOutboundService.sendText.mockResolvedValue({ success: true });
  });

  it('malformed value (missing metadata.phone_number_id) → acked, nothing touched', async () => {
    await service.handleChange({ contacts: [], messages: [waMessage()] });
    expect(mockChannelService.resolveChannel).not.toHaveBeenCalled();
    expect(mockConversationService.appendMessage).not.toHaveBeenCalled();
  });

  it('unknown channel → ignored, no message processing', async () => {
    mockChannelService.resolveChannel.mockResolvedValue(null);
    await service.handleChange(waValue());
    expect(mockConversationService.appendMessage).not.toHaveBeenCalled();
    expect(mockOutboundService.sendText).not.toHaveBeenCalled();
  });

  it('status-only payload → no-op', async () => {
    await service.handleChange(waValue({ messages: undefined, statuses: [{ status: 'delivered' }] }));
    expect(mockConversationService.findMessageByWaMessageId).not.toHaveBeenCalled();
    expect(mockOutboundService.sendText).not.toHaveBeenCalled();
  });

  it('text message: dedupe → reusable session → pipeline → rendered reply → persist → send', async () => {
    await service.handleChange(waValue());
    await flush();

    expect(mockConversationService.findMessageByWaMessageId).toHaveBeenCalledWith('wamid.1');
    expect(mockConversationService.getReusableConversationBySession).toHaveBeenCalledWith(
      'wa-pn-1-15551234567'
    );
    expect(mockPreprocessTurn).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tid-1',
      rawText: 'do you have rice?',
      waMessageId: 'wamid.1',
      userMetadata: { wa_profile_name: 'Sam' },
    }));
    expect(mockCompleteTurn).toHaveBeenCalledWith(
      CONV,
      expect.objectContaining({ guardrailPersist: 'pass' }),
      CONFIG,
      { enforceChatbotEnabled: true },
    );
    expect(mockPersistAssistantTurn).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ responseType: 'faq' }),
      'Our FAQ answer',
    );
    expect(mockOutboundService.sendText).toHaveBeenCalledWith(CHANNEL, '15551234567', 'Our FAQ answer');
  });

  it('duplicate wa_message_id → ignored entirely', async () => {
    mockConversationService.findMessageByWaMessageId.mockResolvedValue({ id: 'msg-dup' });
    await service.handleChange(waValue());
    await flush();
    expect(mockConversationService.getReusableConversationBySession).not.toHaveBeenCalled();
    expect(mockConversationService.appendMessage).not.toHaveBeenCalled();
    expect(mockOutboundService.sendText).not.toHaveBeenCalled();
  });

  it('P2002 on the dedupe claim (cross-process race) → treated as duplicate, acked', async () => {
    mockConversationService.appendMessage.mockRejectedValue({ code: 'P2002' });
    await expect(service.handleChange(waValue())).resolves.toBeUndefined();
  });

  it('transient intake failure propagates (route returns 500 for Meta retry)', async () => {
    mockConversationService.findMessageByWaMessageId.mockRejectedValue(new Error('db down'));
    await expect(service.handleChange(waValue())).rejects.toThrow('db down');
  });

  it('expired session → archives stale, creates conversation with source=whatsapp + skipGreeting', async () => {
    const stale = { ...CONV, id: 'conv-stale' };
    mockConversationService.getReusableConversationBySession.mockResolvedValue(null);
    mockConversationService.getConversationBySession.mockResolvedValue(stale);
    mockConversationService.createConversation.mockResolvedValue({ conversation: CONV, greeting: null });

    await service.handleChange(waValue());
    await flush();

    expect(mockConversationService.updateStatus).toHaveBeenCalledWith('conv-stale', 'archived');
    expect(mockConversationService.createConversation).toHaveBeenCalledWith({
      tenantId: 'tid-1',
      sessionId: 'wa-pn-1-15551234567',
      customerPhone: '15551234567',
      source: 'whatsapp',
      skipGreeting: true,
    });
  });

  it('non-text message → dedupe claim persisted + canned reply, pipeline skipped', async () => {
    await service.handleChange(waValue({
      messages: [waMessage({ id: 'wamid.img', type: 'image', text: undefined })],
    }));
    await flush();

    expect(mockConversationService.appendMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      role: 'user',
      content: '[image message]',
      waMessageId: 'wamid.img',
      metadata: expect.objectContaining({ wa_type: 'image', wa_profile_name: 'Sam' }),
    }));
    expect(mockPreprocessTurn).not.toHaveBeenCalled();
    expect(mockCompleteTurn).not.toHaveBeenCalled();
    expect(mockOutboundService.sendText).toHaveBeenCalledWith(
      CHANNEL, '15551234567', expect.stringContaining('only read text')
    );
  });

  it('oversized text (>1000 chars) → rejected with canned reply, dedupe claim persisted', async () => {
    const long = 'x'.repeat(1200);
    await service.handleChange(waValue({
      messages: [waMessage({ id: 'wamid.long', text: { body: long } })],
    }));
    await flush();

    expect(mockConversationService.appendMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: 'user',
      waMessageId: 'wamid.long',
      metadata: expect.objectContaining({ rejected: 'too_long' }),
    }));
    expect(mockPreprocessTurn).not.toHaveBeenCalled();
    expect(mockOutboundService.sendText).toHaveBeenCalledWith(
      CHANNEL, '15551234567', expect.stringContaining('1,000 characters')
    );
  });

  it('batched messages process sequentially in order', async () => {
    const order: string[] = [];
    mockConversationService.findMessageByWaMessageId.mockImplementation(async (id: string) => {
      order.push(id);
      return null;
    });
    mockPreprocessTurn.mockImplementation(async (p: any) => ({
      rawText: p.rawText,
      userText: p.userText ?? p.rawText,
      guardrailAction: 'pass',
      guardrailPersist: 'pass',
      userPersisted: true,
    }));

    await service.handleChange(waValue({
      messages: [
        waMessage({ id: 'wamid.a', text: { body: 'first' } }),
        waMessage({ id: 'wamid.b', text: { body: 'second' } }),
      ],
    }));
    await flush();

    expect(order).toEqual(['wamid.a', 'wamid.b']);
    expect(mockOutboundService.sendText).toHaveBeenCalledTimes(2);
  });

  it('blocked guardrail → blocked reply sent, completeTurn skipped', async () => {
    mockPreprocessTurn.mockResolvedValue({
      rawText: 'spam',
      userText: 'spam',
      guardrailAction: 'block',
      guardrailPersist: 'blocked',
      userPersisted: true,
      blockedReply: 'I cannot process that message.',
    });

    await service.handleChange(waValue());
    await flush();

    expect(mockCompleteTurn).not.toHaveBeenCalled();
    expect(mockOutboundService.sendText).toHaveBeenCalledWith(
      CHANNEL, '15551234567', 'I cannot process that message.'
    );
  });

  it('capability_disabled outcome → generic unavailable reply persisted + sent', async () => {
    mockCompleteTurn.mockResolvedValue({
      kind: 'capability_disabled',
      reply: '',
      responseType: 'capability_disabled',
      guardrailResult: 'pass',
    });

    await service.handleChange(waValue());
    await flush();

    expect(mockPersistAssistantTurn).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ responseType: 'fallback' }),
      expect.stringContaining("isn't available"),
    );
    expect(mockOutboundService.sendText).toHaveBeenCalledWith(
      CHANNEL, '15551234567', expect.stringContaining("isn't available")
    );
  });

  it('completion failure → configured fallback persisted + sent', async () => {
    mockCompleteTurn.mockRejectedValue(new Error('llm exploded'));

    await service.handleChange(waValue());
    await flush();

    expect(mockPersistAssistantTurn).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ responseType: 'fallback' }),
      'Configured fallback.',
    );
    expect(mockOutboundService.sendText).toHaveBeenCalledWith(CHANNEL, '15551234567', 'Configured fallback.');
  });

  it('fallback delivery failure → dead-letter (no throw, no retry)', async () => {
    mockCompleteTurn.mockRejectedValue(new Error('llm exploded'));
    mockOutboundService.sendText.mockRejectedValueOnce(new Error('send exploded'));

    await expect(service.handleChange(waValue())).resolves.toBeUndefined();
    await flush();
    // One fallback attempt, then dead-letter — never retried
    expect(mockOutboundService.sendText).toHaveBeenCalledTimes(1);
  });

  it('per-sender intake mutex serializes concurrent deliveries for the same sender', async () => {
    const order: string[] = [];
    mockConversationService.findMessageByWaMessageId.mockImplementation(async (id: string) => {
      order.push(`start-${id}`);
      if (id === 'wamid.1') await new Promise(r => setTimeout(r, 30));
      order.push(`end-${id}`);
      return null;
    });

    const p1 = service.handleChange(waValue({ messages: [waMessage({ id: 'wamid.1' })] }));
    const p2 = service.handleChange(waValue({ messages: [waMessage({ id: 'wamid.2' })] }));
    await Promise.all([p1, p2]);

    // wamid.2's intake may not start until wamid.1's whole critical section ends
    expect(order.indexOf('start-wamid.2')).toBeGreaterThan(order.indexOf('end-wamid.1'));
  });
});
