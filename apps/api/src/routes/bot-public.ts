/**
 * Public Bot API Routes
 *
 * Unified route pattern: /api/public/bot/*
 *
 * POST   /api/public/bot/conversations              — Start conversation
 * POST   /api/public/bot/conversations/:sessionId/messages — Send message
 * GET    /api/public/bot/config?tenantId=            — Fetch widget config
 * GET    /api/public/bot/skills/:skillName            — Execute skill
 * GET    /api/public/bot/products/search              — Search tenant product catalog
 * GET    /api/public/bot/policies                       — Fetch tenant storefront policies
 * GET    /api/public/bot/crm/ticket-status             — Look up support tickets (CRM assistant skill)
 * POST   /api/public/bot/crm/create-ticket             — Create support ticket from chat (CRM assistant skill)
 * POST   /api/public/bot/conversations/:sessionId/feedback — Submit feedback
 */

import { Router } from 'express';
import { z } from 'zod';
import BotConfigurationService from '../services/BotConfigurationService';
import BotConversationService from '../services/BotConversationService';
import BotStaticResponseService from '../services/BotStaticResponseService';
import BotGuardrailService from '../services/BotGuardrailService';
import BotIntentService from '../services/BotIntentService';
import BotSkillService from '../services/BotSkillService';
import BotCrmIntegrationService from '../services/BotCrmIntegrationService';
import BotBusinessHoursService from '../services/BotBusinessHoursService';
import BotDynamicResponseService from '../services/BotDynamicResponseService';
import BotChannelSteeringService from '../services/BotChannelSteeringService';
import BotBertGuardrailService from '../services/BotBertGuardrailService';
import BotBertIntentService from '../services/BotBertIntentService';
import BotProductCatalogService from '../services/BotProductCatalogService';
import BotCrmAssistantService from '../services/BotCrmAssistantService';
import StorefrontPolicyService from '../services/StorefrontPolicyService';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { resolveEmbedKey, getTenantIdFromRequest } from '../middleware/embed-key-validation';

const router = Router();
const configService = BotConfigurationService.getInstance();
const conversationService = BotConversationService.getInstance();
const staticResponseService = BotStaticResponseService.getInstance();
const guardrailService = BotGuardrailService.getInstance();
const intentService = BotIntentService.getInstance();
const skillService = BotSkillService.getInstance();
const crmIntegrationService = BotCrmIntegrationService.getInstance();
const businessHoursService = BotBusinessHoursService.getInstance();
const dynamicResponseService = BotDynamicResponseService.getInstance();
const channelSteeringService = BotChannelSteeringService.getInstance();
const crmAssistantService = BotCrmAssistantService.getInstance();
const bertGuardrailService = BotBertGuardrailService.getInstance();
const bertIntentService = BotBertIntentService.getInstance();
const productCatalogService = BotProductCatalogService.getInstance();

// Rate limiting (in-memory, per session)
const sessionRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = sessionRequestCounts.get(sessionId);
  if (!entry || now > entry.resetAt) {
    sessionRequestCounts.set(sessionId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MINUTE) return false;
  entry.count++;
  return true;
}

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

function getHandshakeResponse(message: string, config: { botName: string; tone: string; greeting: string }): string | null {
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

// Validation schemas
const startConversationSchema = z.object({
  tenantId: z.string().min(1).optional(),
  embedKey: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(50).optional(),
  pageContext: z.string().max(100).optional(),
  contextEntityName: z.string().max(200).optional(),
}).refine(data => data.tenantId || data.embedKey, {
  message: 'Either tenantId or embedKey is required',
});

const sendMessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

const feedbackSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(['positive', 'negative']),
});

// GET /api/public/bot/config?tenantId=&embedKey=
router.get('/config', resolveEmbedKey, async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req, res);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenant_id', message: 'tenantId or embedKey is required' });
    }

    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps || !caps.effective.chatbot.enabled || !caps.effective.chatbot.widget_enabled) {
      return res.json({ success: true, config: null, message: 'Chatbot is not enabled for this tenant' });
    }

    const config = await configService.getPublicConfig(tenantId);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching bot config:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch bot config' });
  }
});

// POST /api/public/bot/conversations
router.post('/conversations', resolveEmbedKey, async (req, res) => {
  try {
    const validation = startConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const tenantId = res.locals.embedTenantId || validation.data.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenant_id', message: 'tenantId or embedKey is required' });
    }
    const { customerEmail, customerPhone, pageContext, contextEntityName } = validation.data;
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps || !caps.effective.chatbot.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot is not enabled for this tenant' });
    }

    const config = await configService.getOrCreate(tenantId);
    if (config.status !== 'active') {
      return res.status(403).json({ success: false, error: 'bot_disabled', message: 'Bot is currently disabled' });
    }

    // Check business hours for after-hours mode
    let isOpen = true;
    if (config.afterHoursEnabled) {
      const hoursResult = await businessHoursService.checkBusinessHours(tenantId);
      isOpen = hoursResult.isOpen;
    }

    const { conversation, greeting } = await conversationService.createConversation({
      tenantId,
      customerEmail,
      customerPhone,
      pageContext,
      contextEntityName,
      source: 'widget',
    });

    // Use context-aware greeting
    const contextualGreeting = configService.getContextualGreeting(config, pageContext, isOpen, contextEntityName);

    res.json({ success: true, sessionId: conversation.sessionId, greeting: contextualGreeting || greeting });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to start conversation' });
  }
});

// POST /api/public/bot/conversations/:sessionId/messages
router.post('/conversations/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const validation = sendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid message', details: validation.error.issues });
    }

    // Rate limit
    if (!checkRateLimit(sessionId)) {
      return res.status(429).json({ success: false, error: 'rate_limited', message: 'Too many messages. Please slow down.' });
    }

    // Validate session
    const valid = await conversationService.isSessionValid(sessionId);
    if (!valid) {
      return res.status(403).json({ success: false, error: 'session_expired', message: 'Session is expired or closed' });
    }

    const conversation = await conversationService.getConversationBySession(sessionId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Conversation not found' });
    }

    const config = await configService.getOrCreate(conversation.tenantId);

    const { message } = validation.data;

    // 1. Guardrail check
    const guardrailResult = await guardrailService.checkMessage(conversation.tenantId, message);

    if (guardrailResult.action === 'block') {
      const blockMessage = guardrailService.getBlockResponse(
        guardrailResult.triggeredRules,
        config.fallbackMessage
      );

      // Store user message + blocked response
      await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        guardrailResult: 'blocked',
      });
      const botMsg = await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: blockMessage,
        responseType: 'fallback',
        guardrailResult: 'blocked',
      });

      return res.json({
        success: true,
        reply: blockMessage,
        responseType: 'fallback',
        guardrailResult: 'blocked',
        messageId: botMsg.id,
      });
    }

    // Store user message (possibly masked)
    await conversationService.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: guardrailResult.modifiedMessage,
      guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
    });

    // 2. Intent detection
    const intentResult = await intentService.detectIntent(guardrailResult.modifiedMessage);

    // 3. Try skill execution if intent maps to a skill
    if (intentResult.mappedSkill && intentResult.intent) {
      const skillResult = await skillService.executeSkill(
        conversation.tenantId,
        intentResult.mappedSkill,
        { message: guardrailResult.modifiedMessage, pageContext: conversation.pageContext || undefined }
      );

      if (skillResult.success) {
        const botMsg = await conversationService.appendMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: `Here's what I found:`,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          responseType: 'skill',
          skillName: intentResult.mappedSkill,
          metadata: { skillCard: skillResult.cardSchema, skillData: skillResult.data },
        });

        return res.json({
          success: true,
          reply: `Here's what I found:`,
          responseType: 'skill',
          matchedFaqId: null,
          skillCard: skillResult.cardSchema,
          skillName: intentResult.mappedSkill,
          guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
          messageId: botMsg.id,
        });
      }
    }

    // 3.5. Handshake layer — catch greetings, gratitude, farewells before fallback
    const handshakeReply = getHandshakeResponse(guardrailResult.modifiedMessage, config);
    if (handshakeReply) {
      const botMsg = await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: handshakeReply,
        intent: 'handshake',
        confidence: 1,
        responseType: 'handshake',
        guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
      });

      return res.json({
        success: true,
        reply: handshakeReply,
        responseType: 'handshake',
        matchedFaqId: null,
        guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
        messageId: botMsg.id,
      });
    }

    // 4. Tier Router: dynamic (GPT + RAG) vs static (FAQ keyword match)
    const caps = await resolveEffectiveCapabilities(conversation.tenantId);
    const platformAiEnabled = await dynamicResponseService.isPlatformAiEnabled();
    const useDynamic = caps?.effective.chatbot.dynamic_enabled && dynamicResponseService.isAvailable() && platformAiEnabled;

    if (useDynamic) {
      // BERT-enhanced guardrail check (in addition to rule-based)
      if (bertGuardrailService.isAvailable()) {
        const bertResult = await bertGuardrailService.isToxic(guardrailResult.modifiedMessage);
        if (bertResult.toxic) {
          const blockMessage = config.fallbackMessage;
          await conversationService.appendMessage({
            conversationId: conversation.id,
            role: 'assistant',
            content: blockMessage,
            responseType: 'fallback',
            guardrailResult: 'blocked',
            metadata: { bert_toxicity_score: bertResult.score },
          });
          return res.json({
            success: true,
            reply: blockMessage,
            responseType: 'fallback',
            guardrailResult: 'blocked',
          });
        }
      }

      // BERT-enhanced intent detection (falls back to keyword if unavailable)
      let dynamicIntent = intentResult.intent;
      let dynamicConfidence = intentResult.confidence;
      if (bertIntentService.isAvailable()) {
        const bertIntent = await bertIntentService.classify(guardrailResult.modifiedMessage);
        if (bertIntent.confidence > 0.5) {
          dynamicIntent = bertIntent.intent;
          dynamicConfidence = bertIntent.confidence;
        }
      }

      const dynamicResult = await dynamicResponseService.generateResponse(
        conversation.tenantId,
        conversation.id,
        guardrailResult.modifiedMessage,
        config,
        conversation.pageContext
      );

      const botMsg = await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: dynamicResult.reply,
        intent: dynamicIntent || undefined,
        confidence: dynamicConfidence,
        matchedFaqId: dynamicResult.matchedFaqId || undefined,
        responseType: dynamicResult.responseType,
        guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
        metadata: { ragChunksUsed: dynamicResult.ragChunksUsed },
      });

      // Escalation: if bot couldn't answer (fallback or channel_steering) and escalation enabled
      let escalated = false;
      if ((dynamicResult.responseType === 'fallback' || dynamicResult.responseType === 'channel_steering') && config.escalationEnabled) {
        try {
          const alreadyEscalated = await crmIntegrationService.isEscalated(conversation.id);
          if (!alreadyEscalated) {
            await crmIntegrationService.escalateToTicket({
              tenantId: conversation.tenantId,
              conversationId: conversation.id,
              sessionId: conversation.sessionId,
              customerEmail: conversation.customerEmail,
              customerPhone: conversation.customerPhone,
              reason: 'Bot could not answer customer question',
              summary: `Customer asked: "${message}" — bot steered the customer to available support channels.`,
            });
            escalated = true;
          }
        } catch (escalationError) {
          console.error('[BotPublic] Escalation failed:', escalationError);
        }
      }

      return res.json({
        success: true,
        reply: dynamicResult.reply,
        responseType: dynamicResult.responseType,
        matchedFaqId: dynamicResult.matchedFaqId,
        guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
        messageId: botMsg.id,
        escalated,
        channels: dynamicResult.channels,
      });
    }

    // 4b. Static FAQ response (free tier or dynamic unavailable)
    const staticResult = await staticResponseService.findResponse(
      conversation.tenantId,
      guardrailResult.modifiedMessage,
      conversation.pageContext || undefined
    );

    let finalReply = staticResult.reply;
    let finalResponseType: string = staticResult.responseType;
    let finalChannels: any[] | undefined;

    // If static FAQ has no match, steer to available human channels instead of
    // repeating a static fallback message.
    if (staticResult.responseType === 'fallback') {
      const steering = await channelSteeringService.steer(conversation.tenantId, config.botName);
      finalReply = steering.reply;
      finalResponseType = 'channel_steering';
      finalChannels = steering.channels;
    }

    const botMsg = await conversationService.appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: finalReply,
      intent: intentResult.intent || undefined,
      confidence: intentResult.confidence,
      matchedFaqId: staticResult.matchedFaqId || undefined,
      responseType: finalResponseType,
      guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
      metadata: finalChannels ? { channels: finalChannels } : undefined,
    });

    // 5. Escalation: if fallback and escalation enabled, create CRM ticket
    let escalated = false;
    if (staticResult.responseType === 'fallback' && config.escalationEnabled) {
      try {
        const alreadyEscalated = await crmIntegrationService.isEscalated(conversation.id);
        if (!alreadyEscalated) {
          await crmIntegrationService.escalateToTicket({
            tenantId: conversation.tenantId,
            conversationId: conversation.id,
            sessionId: conversation.sessionId,
            customerEmail: conversation.customerEmail,
            customerPhone: conversation.customerPhone,
            reason: 'Bot could not answer customer question',
            summary: `Customer asked: "${message}" — bot steered the customer to available support channels.`,
          });
          escalated = true;
        }
      } catch (escalationError) {
        console.error('[BotPublic] Escalation failed:', escalationError);
      }
    }

    res.json({
      success: true,
      reply: finalReply,
      responseType: finalResponseType,
      matchedFaqId: staticResult.matchedFaqId,
      guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
      messageId: botMsg.id,
      escalated,
      channels: finalChannels,
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to process message' });
  }
});

// GET /api/public/bot/skills/:skillName?tenantId=&embedKey=
router.get('/skills/:skillName', resolveEmbedKey, async (req, res) => {
  try {
    const { skillName } = req.params;
    const tenantId = getTenantIdFromRequest(req, res);
    const { tenantId: _omit, embedKey: _omit2, ...params } = req.query;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenant_id', message: 'tenantId or embedKey is required' });
    }

    const result = await skillService.executeSkill(tenantId, skillName, params);
    res.json({ success: result.success, data: result.data, cardSchema: result.cardSchema, error: result.error });
  } catch (error) {
    console.error('Error executing skill:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to execute skill' });
  }
});

// GET /api/public/bot/products/search?tenantId=&query=&badge=&limit=
// Exposes a curated subset of the storefront product catalog to the bot.
// Requires chatbot capability to be enabled for the tenant.
const productSearchSchema = z.object({
  tenantId: z.string().min(1).optional(),
  embedKey: z.string().min(1).optional(),
  query: z.string().min(1).max(200),
  badge: z.enum(['featured', 'new_arrival', 'staff_pick', 'seasonal', 'sale', 'clearance', 'store_selection', 'trending', 'recommended', 'bestseller', 'random_featured']).optional(),
  limit: z.coerce.number().min(1).max(20).default(5),
}).refine(data => data.tenantId || data.embedKey, {
  message: 'Either tenantId or embedKey is required',
});

router.get('/products/search', resolveEmbedKey, async (req, res) => {
  try {
    const validation = productSearchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: validation.error.issues,
      });
    }

    const tenantId = res.locals.embedTenantId || validation.data.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenant_id', message: 'tenantId or embedKey is required' });
    }
    const { query, badge, limit } = validation.data;

    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps || !caps.effective.chatbot.enabled) {
      return res.status(403).json({
        success: false,
        error: 'capability_disabled',
        message: 'Chatbot is not enabled for this tenant',
      });
    }

    const result = await productCatalogService.searchProducts(tenantId, query, {
      limit,
      badge: badge as any,
      inStockOnly: true,
    });

    const products = result.products.map((p) => ({
      id: p.inventoryItemId,
      name: p.productName,
      slug: p.productSlug,
      brand: p.brand,
      price: p.price,
      currency: p.currency,
      isOnSale: p.isOnSale,
      discountPercentage: p.discountPercentage,
      stockStatus: p.stockStatus,
      category: p.productCategory,
      imageUrl: p.image_url,
      badges: p.badges,
    }));

    res.json({
      success: true,
      products,
      total: products.length,
    });
  } catch (error) {
    console.error('[BotPublic] Product search failed:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to search product catalog',
    });
  }
});

// GET /api/public/bot/policies?tenantId=&embedKey=&type=
router.get('/policies', resolveEmbedKey, async (req, res) => {
  try {
    const tenantId = res.locals.embedTenantId || (req.query.tenantId as string);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenant_id', message: 'tenantId or embedKey is required' });
    }

    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps || !caps.effective.chatbot.enabled) {
      return res.status(403).json({
        success: false,
        error: 'capability_disabled',
        message: 'Chatbot is not enabled for this tenant',
      });
    }

    const policyType = req.query.type as string | undefined;
    const policies = await StorefrontPolicyService.getInstance().getPolicies(tenantId);

    if (policyType) {
      const content = (policies as any)[policyType] as string | null;
      if (!content) {
        return res.status(404).json({ success: false, error: 'not_found', message: 'Policy not configured' });
      }
      return res.json({ success: true, type: policyType, content, updatedAt: policies.updatedAt });
    }

    return res.json({ success: true, policies });
  } catch (error) {
    console.error('[BotPublic] Policy lookup failed:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch policies',
    });
  }
});

// POST /api/public/bot/preview — Preview bot response (for FAQ bot preview component)
// Returns a static FAQ match without creating a conversation
router.post('/preview', resolveEmbedKey, async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req, res);
    const { message, pageContext } = req.body || {};
    if (!tenantId || !message) {
      return res.status(400).json({ success: false, error: 'missing_params', message: 'tenantId (or embedKey) and message are required' });
    }

    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps || !caps.effective.chatbot.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot is not enabled for this tenant' });
    }

    const result = await staticResponseService.findResponse(tenantId, message, pageContext);
    res.json({
      success: true,
      reply: result.reply,
      responseType: result.responseType,
      matchedFaqId: result.matchedFaqId,
    });
  } catch (error) {
    console.error('Error previewing bot response:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to preview response' });
  }
});

// POST /api/public/bot/conversations/:sessionId/feedback
router.post('/conversations/:sessionId/feedback', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const validation = feedbackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid feedback', details: validation.error.issues });
    }

    const conversation = await conversationService.getConversationBySession(sessionId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Conversation not found' });
    }

    const { messageId, rating } = validation.data;
    await conversationService.addFeedback(messageId, conversation.id, rating);
    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to submit feedback' });
  }
});

// ====================
// CRM Assistant Skill Endpoints
// ====================

// GET /api/public/bot/crm/ticket-status?tenantId=&customerEmail=
router.get('/crm/ticket-status', resolveEmbedKey, async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req, res);
    const { customerEmail } = req.query;
    if (!tenantId || !customerEmail) {
      return res.status(400).json({ success: false, error: 'missing_params', message: 'tenantId (or embedKey) and customerEmail are required' });
    }

    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps || !caps.effective.chatbot.enabled || !caps.effective.chatbot.skills_enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot skills are not enabled for this tenant' });
    }
    if (!caps.effective.chatbot.allowed_skill_types.includes('chatbot_skill_crm_assistant' as any)) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'CRM assistant skill is not available for this tier' });
    }

    const tickets = await crmAssistantService.lookupTickets(tenantId, customerEmail as string);
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error looking up tickets:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to look up tickets' });
  }
});

// POST /api/public/bot/crm/create-ticket
const createTicketSchema = z.object({
  tenantId: z.string().optional(),
  embedKey: z.string().optional(),
  conversationId: z.string(),
  sessionId: z.string(),
  customerEmail: z.string().optional(),
  issueSummary: z.string().min(5).max(500),
});

router.post('/crm/create-ticket', resolveEmbedKey, async (req, res) => {
  try {
    const validation = createTicketSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const tenantId = res.locals.embedTenantId || validation.data.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenant_id', message: 'tenantId or embedKey is required' });
    }

    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps || !caps.effective.chatbot.enabled || !caps.effective.chatbot.skills_enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot skills are not enabled for this tenant' });
    }
    if (!caps.effective.chatbot.allowed_skill_types.includes('chatbot_skill_crm_assistant' as any)) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'CRM assistant skill is not available for this tier' });
    }

    const { conversationId, sessionId, customerEmail, issueSummary } = validation.data;
    const ticket = await crmAssistantService.createTicket(
      tenantId,
      conversationId,
      sessionId,
      customerEmail || null,
      issueSummary
    );
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to create ticket' });
  }
});

export default router;
