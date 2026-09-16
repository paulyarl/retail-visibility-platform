/**
 * Bot Turn Pipeline — shared bot-turn module (WHATSAPP_CHANNEL_INTEGRATION_SPEC §8.2)
 *
 * Extracted from bot-public.ts so the widget route and the WhatsApp transport
 * share ONE bot brain. Decision-only: no Express, no `res`, no assistant
 * persistence inside the decision functions — callers persist via
 * persistAssistantTurn so each transport controls what content is stored
 * (widget stores the rich reply; WhatsApp stores the rendered text).
 *
 * Turn flow:
 *   preprocessTurn  — guardrail check + user-message append (owns the user turn)
 *   completeTurn    — intent → skill → handshake → dynamic/static → escalation
 *   persistAssistantTurn — append the assistant row for the decided outcome
 */

import BotConversationService, { BotConversation, BotMessage } from '../BotConversationService';
import BotGuardrailService from '../BotGuardrailService';
import BotIntentService from '../BotIntentService';
import BotSkillService from '../BotSkillService';
import BotStaticResponseService from '../BotStaticResponseService';
import BotDynamicResponseService from '../BotDynamicResponseService';
import BotChannelSteeringService from '../BotChannelSteeringService';
import BotCrmIntegrationService from '../BotCrmIntegrationService';
import BotBertGuardrailService from '../BotBertGuardrailService';
import BotBertIntentService from '../BotBertIntentService';
import { resolveEffectiveCapabilities } from '../EffectiveCapabilityResolver';
import type { BotConfig } from '../BotConfigurationService';
import { logger } from '../../logger';

const conversationService = BotConversationService.getInstance();
const guardrailService = BotGuardrailService.getInstance();
const intentService = BotIntentService.getInstance();
const skillService = BotSkillService.getInstance();
const staticResponseService = BotStaticResponseService.getInstance();
const dynamicResponseService = BotDynamicResponseService.getInstance();
const channelSteeringService = BotChannelSteeringService.getInstance();
const crmIntegrationService = BotCrmIntegrationService.getInstance();
const bertGuardrailService = BotBertGuardrailService.getInstance();
const bertIntentService = BotBertIntentService.getInstance();

// Handshake layer — lightweight conversational responses for greetings, gratitude, farewells
// Prevents these from falling through to the fallback/steering path unnecessarily.
const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|sup|howdy|greetings|good\s+(morning|afternoon|evening)|what'?s\s+up)\b/i,
];
const GRATITUDE_PATTERNS = [
  /^(thanks|thank\s+you|thx|ty|appreciate\s+(it|that)|cheers)\b/i,
];
const FAREWELL_PATTERNS = [
  /^(bye|goodbye|see\s+you|cya|later|take\s+care|have\s+a\s+(good|great|nice)\s+(day|one)|peace)\b/i,
];

function getHandshakeResponse(message: string, config: { botName: string; tone: string }): string | null {
  const trimmed = message.trim();

  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      const name = config.botName || 'Assistant';
      if (config.tone === 'playful') {
        return `Hey there! I'm ${name}. What can I help you with today?`;
      }
      if (config.tone === 'professional') {
        return `Hello. I'm ${name}, your shopping assistant. How may I help you today?`;
      }
      return `Hi! I'm ${name}. How can I help you today?`;
    }
  }

  for (const pattern of GRATITUDE_PATTERNS) {
    if (pattern.test(trimmed)) {
      if (config.tone === 'playful') {
        return `You're welcome! Anything else I can help with?`;
      }
      if (config.tone === 'professional') {
        return `You're welcome. Is there anything else I can assist you with?`;
      }
      return `You're welcome! Is there anything else I can help you with?`;
    }
  }

  for (const pattern of FAREWELL_PATTERNS) {
    if (pattern.test(trimmed)) {
      if (config.tone === 'playful') {
        return `Take care! Come back anytime.`;
      }
      if (config.tone === 'professional') {
        return `Goodbye. Feel free to reach out whenever you need assistance.`;
      }
      return `Goodbye! Feel free to come back anytime you have questions.`;
    }
  }

  return null;
}

// ─── Types ────────────────────────────────────────────────────────────

export interface TurnPre {
  /** Raw inbound text as received. */
  rawText: string;
  /** Guardrail-modified text used for all downstream bot work. */
  userText: string;
  /** Guardrail action: 'pass' | 'block' | 'flag' | 'mask' | 'replace'. */
  guardrailAction: string;
  /** Value persisted in bot_messages.guardrail_result for the user turn. */
  guardrailPersist: string;
  /** True when the user turn was appended (a conversation existed). */
  userPersisted: boolean;
  /** Block reply — set only when guardrailAction === 'block'. */
  blockedReply?: string;
  /** Provider message id carried through to persistUserTurn (WhatsApp only). */
  waMessageId?: string;
  /** Extra metadata carried through to persistUserTurn (WhatsApp only). */
  userMetadata?: any;
}

export type TurnKind =
  | 'skill'
  | 'handshake'
  | 'dynamic'
  | 'static'
  | 'bert_blocked'
  | 'capability_disabled';

export interface TurnResult {
  kind: TurnKind;
  reply: string;
  responseType: string;
  intent?: string;
  confidence?: number;
  matchedFaqId?: string | null;
  skillName?: string;
  /** Response-only fields (widget renders; never persisted as columns). */
  skillCard?: any;
  skillData?: any;
  channels?: any[];
  escalated?: boolean;
  /** Value persisted in bot_messages.guardrail_result for the assistant turn. */
  guardrailResult: string;
  assistantMetadata?: any;
}

/** Fields persistAssistantTurn needs — satisfied by TurnResult or a literal. */
export interface AssistantTurn {
  responseType: string;
  guardrailResult: string;
  intent?: string;
  confidence?: number;
  matchedFaqId?: string | null;
  skillName?: string;
  assistantMetadata?: any;
}

// ─── Turn functions ───────────────────────────────────────────────────

/**
 * Guardrail check + user-message append. Owns the user turn — transports
 * must NOT append the user message separately.
 *
 * - block + existing conversation → persists the blocked user turn (audit
 *   trail for an active conversation) and returns `blockedReply`.
 * - block + no conversation → returns `blockedReply`, persists nothing
 *   (spam never creates a record).
 * - pass/mask + existing conversation → appends the modified user turn.
 * - pass/mask + no conversation → defers the append; caller creates the
 *   conversation then calls persistUserTurn.
 */
export async function preprocessTurn(params: {
  tenantId: string;
  conversation: BotConversation | null;
  rawText: string;
  fallbackMessage: string;
  /** Provider message id — dedupe claim on the user row (WhatsApp only). */
  waMessageId?: string;
  /** Extra metadata for the user row (e.g. wa_profile_name). */
  userMetadata?: any;
}): Promise<TurnPre> {
  const { tenantId, conversation, rawText, fallbackMessage } = params;
  const guardrail = await guardrailService.checkMessage(tenantId, rawText);
  const guardrailPersist = guardrail.action === 'pass' ? 'pass' : guardrail.action;

  if (guardrail.action === 'block') {
    if (conversation) {
      await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'user',
        content: rawText,
        guardrailResult: 'blocked',
        metadata: params.userMetadata,
        waMessageId: params.waMessageId,
      });
    }
    return {
      rawText,
      userText: guardrail.modifiedMessage ?? rawText,
      guardrailAction: 'block',
      guardrailPersist: 'blocked',
      userPersisted: !!conversation,
      blockedReply: guardrailService.getBlockResponse(guardrail.triggeredRules, fallbackMessage),
      waMessageId: params.waMessageId,
      userMetadata: params.userMetadata,
    };
  }

  if (conversation) {
    await conversationService.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: guardrail.modifiedMessage,
      guardrailResult: guardrailPersist,
      metadata: params.userMetadata,
      waMessageId: params.waMessageId,
    });
  }

  return {
    rawText,
    userText: guardrail.modifiedMessage,
    guardrailAction: guardrail.action,
    guardrailPersist,
    userPersisted: !!conversation,
    waMessageId: params.waMessageId,
    userMetadata: params.userMetadata,
  };
}

/**
 * Append the deferred user turn after the caller creates the conversation
 * (widget lazy-creation path). No-op semantics for blocked turns — blocked
 * turns never reach here.
 */
export async function persistUserTurn(conversationId: string, pre: TurnPre): Promise<BotMessage> {
  return conversationService.appendMessage({
    conversationId,
    role: 'user',
    content: pre.userText,
    guardrailResult: pre.guardrailPersist,
    metadata: pre.userMetadata,
    waMessageId: pre.waMessageId,
  });
}

/**
 * Decide the bot's reply for a turn. Does not write to `res` and does not
 * persist the assistant message — both transports then call
 * persistAssistantTurn with the content they want stored.
 *
 * opts.enforceChatbotEnabled: when true, a missing/disabled chatbot.enabled
 * capability yields a `capability_disabled` outcome instead of falling
 * through to the static path (WhatsApp §13 gate; the widget does not pass
 * this — its capability gate lives on the lazy-creation path).
 */
export async function completeTurn(
  conversation: BotConversation,
  pre: TurnPre,
  config: BotConfig,
  opts: { enforceChatbotEnabled?: boolean } = {},
): Promise<TurnResult> {
  const caps = await resolveEffectiveCapabilities(conversation.tenantId);

  if (opts.enforceChatbotEnabled && (!caps || !caps.effective.chatbot.enabled)) {
    return {
      kind: 'capability_disabled',
      reply: '',
      responseType: 'capability_disabled',
      guardrailResult: pre.guardrailPersist,
      escalated: false,
    };
  }

  // Intent detection
  const intentResult = await intentService.detectIntent(pre.userText);

  // Skill execution when intent maps to a skill
  if (intentResult.mappedSkill && intentResult.intent) {
    const skillResult = await skillService.executeSkill(
      conversation.tenantId,
      intentResult.mappedSkill,
      { message: pre.userText, pageContext: conversation.pageContext || undefined }
    );

    if (skillResult.success) {
      return {
        kind: 'skill',
        reply: `Here's what I found:`,
        responseType: 'skill',
        intent: intentResult.intent || undefined,
        confidence: intentResult.confidence,
        skillName: intentResult.mappedSkill,
        skillCard: skillResult.cardSchema,
        skillData: skillResult.data,
        guardrailResult: pre.guardrailPersist,
        assistantMetadata: { skillCard: skillResult.cardSchema, skillData: skillResult.data },
      };
    }
  }

  // Handshake layer — greetings, gratitude, farewells before fallback
  const handshakeReply = getHandshakeResponse(pre.userText, config);
  if (handshakeReply) {
    return {
      kind: 'handshake',
      reply: handshakeReply,
      responseType: 'handshake',
      intent: 'handshake',
      confidence: 1,
      guardrailResult: pre.guardrailPersist,
    };
  }

  // Tier router: dynamic (GPT + RAG) vs static (FAQ keyword match)
  const platformAiEnabled = await dynamicResponseService.isPlatformAiEnabled();
  const useDynamic =
    caps?.effective.chatbot.dynamic_enabled &&
    dynamicResponseService.isAvailable() &&
    platformAiEnabled;

  if (useDynamic) {
    // BERT-enhanced guardrail check (in addition to rule-based)
    if (bertGuardrailService.isAvailable()) {
      const bertResult = await bertGuardrailService.isToxic(pre.userText);
      if (bertResult.toxic) {
        return {
          kind: 'bert_blocked',
          reply: config.fallbackMessage,
          responseType: 'fallback',
          guardrailResult: 'blocked',
          assistantMetadata: { bert_toxicity_score: bertResult.score },
        };
      }
    }

    // BERT-enhanced intent detection (falls back to keyword if unavailable)
    let dynamicIntent = intentResult.intent;
    let dynamicConfidence = intentResult.confidence;
    if (bertIntentService.isAvailable()) {
      const bertIntent = await bertIntentService.classify(pre.userText);
      if (bertIntent.confidence > 0.5) {
        dynamicIntent = bertIntent.intent;
        dynamicConfidence = bertIntent.confidence;
      }
    }

    const dynamicResult = await dynamicResponseService.generateResponse(
      conversation.tenantId,
      conversation.id,
      pre.userText,
      config,
      conversation.pageContext
    );

    const escalated = await maybeEscalate(
      conversation,
      config,
      pre.rawText,
      dynamicResult.responseType === 'fallback' || dynamicResult.responseType === 'channel_steering'
    );

    return {
      kind: 'dynamic',
      reply: dynamicResult.reply,
      responseType: dynamicResult.responseType,
      intent: dynamicIntent || undefined,
      confidence: dynamicConfidence,
      matchedFaqId: dynamicResult.matchedFaqId ?? undefined,
      channels: dynamicResult.channels,
      escalated,
      guardrailResult: pre.guardrailPersist,
      assistantMetadata: { ragChunksUsed: dynamicResult.ragChunksUsed },
    };
  }

  // Static FAQ response (free tier or dynamic unavailable)
  const staticResult = await staticResponseService.findResponse(
    conversation.tenantId,
    pre.userText,
    conversation.pageContext || undefined
  );

  let reply = staticResult.reply;
  let responseType: string = staticResult.responseType;
  let channels: any[] | undefined;

  // If static FAQ has no match, steer to available human channels instead of
  // repeating a static fallback message.
  if (staticResult.responseType === 'fallback') {
    const steering = await channelSteeringService.steer(conversation.tenantId, config.botName);
    reply = steering.reply;
    responseType = 'channel_steering';
    channels = steering.channels;
  }

  const escalated = await maybeEscalate(
    conversation,
    config,
    pre.rawText,
    staticResult.responseType === 'fallback'
  );

  return {
    kind: 'static',
    reply,
    responseType,
    intent: intentResult.intent || undefined,
    confidence: intentResult.confidence,
    matchedFaqId: staticResult.matchedFaqId ?? undefined,
    channels,
    escalated,
    guardrailResult: pre.guardrailPersist,
    assistantMetadata: channels ? { channels } : undefined,
  };
}

/**
 * Append the assistant turn for a decided outcome. `content` is what gets
 * stored — the widget passes result.reply; the WhatsApp transport passes the
 * rendered text (§8.4) while keeping the structured outcome in metadata.
 */
export async function persistAssistantTurn(
  conversationId: string,
  turn: AssistantTurn,
  content: string,
): Promise<BotMessage> {
  return conversationService.appendMessage({
    conversationId,
    role: 'assistant',
    content,
    intent: turn.intent,
    confidence: turn.confidence,
    matchedFaqId: turn.matchedFaqId ?? undefined,
    responseType: turn.responseType,
    guardrailResult: turn.guardrailResult,
    skillName: turn.skillName,
    metadata: turn.assistantMetadata,
  });
}

// ─── Internals ────────────────────────────────────────────────────────

async function maybeEscalate(
  conversation: BotConversation,
  config: BotConfig,
  rawText: string,
  shouldEscalate: boolean,
): Promise<boolean> {
  if (!shouldEscalate || !config.escalationEnabled) return false;
  try {
    const alreadyEscalated = await crmIntegrationService.isEscalated(conversation.id);
    if (alreadyEscalated) return false;
    await crmIntegrationService.escalateToTicket({
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      sessionId: conversation.sessionId,
      customerEmail: conversation.customerEmail,
      customerPhone: conversation.customerPhone,
      reason: 'Bot could not answer customer question',
      summary: `Customer asked: "${rawText}" — bot steered the customer to available support channels.`,
    });
    return true;
  } catch (error) {
    logger.error('[BotTurnPipeline] Escalation failed:', undefined, {
      error: {
        name: (error as any)?.name || 'Error',
        message: (error as any)?.message || String(error),
        stack: (error as any)?.stack,
      },
    });
    return false;
  }
}
