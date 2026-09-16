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
import BotSkillService from '../services/BotSkillService';
import BotBusinessHoursService from '../services/BotBusinessHoursService';
import BotProductCatalogService from '../services/BotProductCatalogService';
import BotCrmAssistantService from '../services/BotCrmAssistantService';
import { StorefrontPolicyService } from '../services/StorefrontPolicyService';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { preprocessTurn, completeTurn, persistUserTurn, persistAssistantTurn } from '../services/bot/BotTurnPipeline';
import { resolveEmbedKey, getTenantIdFromRequest } from '../middleware/embed-key-validation';
import { logger } from '../logger';

const router = Router();
const configService = BotConfigurationService.getInstance();
const conversationService = BotConversationService.getInstance();
const staticResponseService = BotStaticResponseService.getInstance();
const skillService = BotSkillService.getInstance();
const businessHoursService = BotBusinessHoursService.getInstance();
const crmAssistantService = BotCrmAssistantService.getInstance();
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
  tenantId: z.string().min(1).optional(),
  embedKey: z.string().min(1).optional(),
  pageContext: z.string().max(100).optional(),
  contextEntityName: z.string().max(200).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(50).optional(),
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
    logger.error('Error fetching bot config:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    const { sessionId, greeting } = await conversationService.prepareConversation({ tenantId });

    // Use context-aware greeting
    const contextualGreeting = configService.getContextualGreeting(config, pageContext, isOpen, contextEntityName);

    res.json({ success: true, sessionId, greeting: contextualGreeting || greeting });
  } catch (error) {
    logger.error('Error starting conversation:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to start conversation' });
  }
});

// POST /api/public/bot/conversations/:sessionId/messages
// Widget transport — thin HTTP wrapper over the shared BotTurnPipeline
// (WHATSAPP_CHANNEL_INTEGRATION_SPEC §8.2). One brain, multiple transports.
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

    let conversation = await conversationService.getConversationBySession(sessionId);

    // Resolve tenantId — from existing conversation, or from request body for lazy creation
    let tenantId: string | undefined = conversation?.tenantId;
    if (!tenantId) {
      tenantId = validation.data.embedKey
        ? res.locals.embedTenantId
        : validation.data.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'missing_tenant_id', message: 'tenantId or embedKey is required for the first message' });
      }
    }

    const config = await configService.getOrCreate(tenantId);
    const { message } = validation.data;

    // Guardrail + user-turn persistence (owns the user message; persists the
    // blocked turn only when a conversation already exists — spam never
    // creates records).
    const pre = await preprocessTurn({
      tenantId,
      conversation,
      rawText: message,
      fallbackMessage: config.fallbackMessage,
    });

    if (pre.blockedReply !== undefined) {
      if (conversation) {
        const botMsg = await persistAssistantTurn(conversation.id, {
          responseType: 'fallback',
          guardrailResult: 'blocked',
        }, pre.blockedReply);

        return res.json({
          success: true,
          reply: pre.blockedReply,
          responseType: 'fallback',
          guardrailResult: 'blocked',
          messageId: botMsg.id,
        });
      }

      return res.json({
        success: true,
        reply: pre.blockedReply,
        responseType: 'fallback',
        guardrailResult: 'blocked',
        messageId: null,
      });
    }

    // Message passed guardrails — lazy conversation creation on first turn
    if (!conversation) {
      const caps = await resolveEffectiveCapabilities(tenantId);
      if (!caps || !caps.effective.chatbot.enabled) {
        return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot is not enabled for this tenant' });
      }

      const result = await conversationService.createConversation({
        tenantId,
        sessionId,
        customerEmail: validation.data.customerEmail,
        customerPhone: validation.data.customerPhone,
        pageContext: validation.data.pageContext,
        contextEntityName: validation.data.contextEntityName,
        source: 'widget',
      });
      conversation = result.conversation;
      await persistUserTurn(conversation.id, pre);
    }

    // Decide the turn, then persist the assistant reply
    const turn = await completeTurn(conversation, pre, config);
    const botMsg = await persistAssistantTurn(conversation.id, turn, turn.reply);

    switch (turn.kind) {
      case 'skill':
        return res.json({
          success: true,
          reply: turn.reply,
          responseType: 'skill',
          matchedFaqId: null,
          skillCard: turn.skillCard,
          skillName: turn.skillName,
          guardrailResult: pre.guardrailPersist,
          messageId: botMsg.id,
        });

      case 'handshake':
        return res.json({
          success: true,
          reply: turn.reply,
          responseType: 'handshake',
          matchedFaqId: null,
          guardrailResult: pre.guardrailPersist,
          messageId: botMsg.id,
        });

      case 'bert_blocked':
        // Response shape pinned by characterization tests: no messageId
        return res.json({
          success: true,
          reply: turn.reply,
          responseType: 'fallback',
          guardrailResult: 'blocked',
        });

      case 'dynamic':
        return res.json({
          success: true,
          reply: turn.reply,
          responseType: turn.responseType,
          matchedFaqId: turn.matchedFaqId ?? null,
          guardrailResult: pre.guardrailPersist,
          messageId: botMsg.id,
          escalated: turn.escalated,
          channels: turn.channels,
        });

      case 'capability_disabled':
        // Unreachable for the widget (enforceChatbotEnabled is not set) —
        // kept for completeness so the switch is exhaustive.
        return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot is not enabled for this tenant' });

      default: // 'static'
        return res.json({
          success: true,
          reply: turn.reply,
          responseType: turn.responseType,
          matchedFaqId: turn.matchedFaqId ?? null,
          guardrailResult: pre.guardrailPersist,
          messageId: botMsg.id,
          escalated: turn.escalated,
          channels: turn.channels,
        });
    }
  } catch (error) {
    logger.error('Error processing message:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error executing skill:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPublic] Product search failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPublic] Policy lookup failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error previewing bot response:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error submitting feedback:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error looking up tickets:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('Error creating ticket:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to create ticket' });
  }
});

export default router;
