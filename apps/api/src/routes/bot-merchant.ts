/**
 * Merchant Bot API Routes
 *
 * GET    /api/tenants/:tenantId/bot/config           — Get bot configuration
 * PUT    /api/tenants/:tenantId/bot/config           — Update bot configuration
 * GET    /api/tenants/:tenantId/bot/conversations    — List conversations (paginated)
 * GET    /api/tenants/:tenantId/bot/conversations/:id — Get conversation with messages
 * PUT    /api/tenants/:tenantId/bot/conversations/:id/status — Update conversation status
 * POST   /api/tenants/:tenantId/bot/conversations/:id/escalate — Convert to CRM ticket
 * GET    /api/tenants/:tenantId/bot/skills            — List skills with tenant config
 * PUT    /api/tenants/:tenantId/bot/skills/:skillId   — Update skill config
 * GET    /api/tenants/:tenantId/bot/dashboard         — Dashboard stats
 * GET    /api/tenants/:tenantId/bot/analytics         — Analytics data
 * POST   /api/tenants/:tenantId/bot/product-embeddings/refresh — Refresh product catalog embeddings
 * GET    /api/tenants/:tenantId/bot/product-embeddings/status  — Check product embedding status
 * POST   /api/tenants/:tenantId/bot/avatar                       — Upload bot avatar image
 */

import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { StorageBuckets } from '../storage-config';
import { authenticateToken } from '../middleware/auth';
import BotConfigurationService from '../services/BotConfigurationService';
import BotConversationService from '../services/BotConversationService';
import BotSkillService from '../services/BotSkillService';
import BotRagService from '../services/BotRagService';
import BotDynamicResponseService from '../services/BotDynamicResponseService';
import BotStaticResponseService from '../services/BotStaticResponseService';
import BotGuardrailService from '../services/BotGuardrailService';
import BotPlatformGuideService from '../services/BotPlatformGuideService';
import BotIntentService from '../services/BotIntentService';
import BotCrmIntegrationService from '../services/BotCrmIntegrationService';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

const router = Router({ mergeParams: true });

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseService = createClient(
  process.env.SUPABASE_URL!,
  serviceRoleKey!
);
const configService = BotConfigurationService.getInstance();
const conversationService = BotConversationService.getInstance();
const skillService = BotSkillService.getInstance();
const ragService = BotRagService.getInstance();
const dynamicResponseService = BotDynamicResponseService.getInstance();
const staticResponseService = BotStaticResponseService.getInstance();
const guardrailService = BotGuardrailService.getInstance();
const platformGuideService = BotPlatformGuideService.getInstance();
const intentService = BotIntentService.getInstance();

// Validation schema for config updates
const botConfigSchema = z.object({
  botName: z.string().max(100).optional(),
  tone: z.enum(['friendly', 'professional', 'playful']).optional(),
  responseLength: z.enum(['concise', 'balanced', 'detailed']).optional(),
  fallbackMessage: z.string().max(2000).optional(),
  greeting: z.string().max(2000).optional(),
  widgetPosition: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
  widgetColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  widgetOffsetX: z.number().int().min(0).max(500).optional(),
  widgetOffsetY: z.number().int().min(0).max(500).optional(),
  widgetFont: z.string().max(50).optional(),
  widgetAvatarUrl: z.string().url().max(500).nullable().optional(),
  autoOpen: z.boolean().optional(),
  autoOpenDelay: z.number().int().min(0).max(60).optional(),
  afterHoursEnabled: z.boolean().optional(),
  afterHoursMessage: z.string().max(2000).nullable().optional(),
  businessHoursSource: z.enum(['business_profile', 'custom', 'disabled']).optional(),
  preChatEnabled: z.boolean().optional(),
  preChatEmail: z.boolean().optional(),
  preChatPhone: z.boolean().optional(),
  preChatOrder: z.boolean().optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  escalationEnabled: z.boolean().optional(),
  escalationMessage: z.string().max(2000).nullable().optional(),
});

const skillConfigSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

// GET /api/tenants/:tenantId/bot/config
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const config = await configService.getOrCreate(tenantId);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching bot config:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch bot config' });
  }
});

// PUT /api/tenants/:tenantId/bot/config
router.put('/config', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const validation = botConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid config data', details: validation.error.issues });
    }

    const config = await configService.update(tenantId, validation.data);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating bot config:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update bot config' });
  }
});

// GET /api/tenants/:tenantId/bot/conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;

    const result = await conversationService.listConversations(tenantId, { page, limit, status });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to list conversations' });
  }
});

// GET /api/tenants/:tenantId/bot/conversations/:id
router.get('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const conversation = await BotConversationService.getInstance()['getConversationBySession'](id);

    // Try by session_id first, then by id
    let conv = conversation;
    if (!conv) {
      const { prisma } = await import('../prisma');
      const direct = await prisma.bot_conversations.findUnique({ where: { id } });
      if (direct && direct.tenant_id === tenantId) {
        conv = {
          id: direct.id,
          tenantId: direct.tenant_id,
          sessionId: direct.session_id,
          customerEmail: direct.customer_email,
          customerPhone: direct.customer_phone,
          source: direct.source,
          status: direct.status,
          resolvedBy: direct.resolved_by,
          pageContext: direct.page_context,
          createdAt: direct.created_at,
          updatedAt: direct.updated_at,
          closedAt: direct.closed_at,
        };
      }
    }

    if (!conv || conv.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Conversation not found' });
    }

    const messages = await conversationService.getMessages(conv.id);
    res.json({ success: true, conversation: conv, messages });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch conversation' });
  }
});

// PUT /api/tenants/:tenantId/bot/conversations/:id/status — Update conversation status
router.put('/conversations/:id/status', authenticateToken, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { status } = req.body || {};

    if (!['active', 'closed', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'invalid_status', message: 'Status must be active, closed, or archived' });
    }

    // Verify conversation belongs to tenant
    const { prisma } = await import('../prisma');
    const conv = await prisma.bot_conversations.findUnique({ where: { id } });
    if (!conv || conv.tenant_id !== tenantId) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Conversation not found' });
    }

    const updated = await conversationService.updateStatus(id, status);
    res.json({ success: true, conversation: updated });
  } catch (error) {
    console.error('Error updating conversation status:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update conversation status' });
  }
});

// POST /api/tenants/:tenantId/bot/conversations/:id/escalate — Convert conversation to CRM support ticket
router.post('/conversations/:id/escalate', authenticateToken, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { reason, summary } = req.body || {};

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_reason', message: 'reason is required' });
    }

    // Verify conversation belongs to tenant
    const { prisma } = await import('../prisma');
    const conv = await prisma.bot_conversations.findUnique({ where: { id } });
    if (!conv || conv.tenant_id !== tenantId) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Conversation not found' });
    }

    // Check if already escalated
    const alreadyEscalated = await BotCrmIntegrationService.getInstance().isEscalated(id);
    if (alreadyEscalated) {
      return res.status(409).json({ success: false, error: 'already_escalated', message: 'Conversation has already been escalated to a support ticket' });
    }

    const result = await BotCrmIntegrationService.getInstance().escalateToTicket({
      tenantId,
      conversationId: id,
      sessionId: conv.session_id,
      customerEmail: conv.customer_email,
      customerPhone: conv.customer_phone,
      reason,
      summary: summary || 'Manually escalated by merchant from conversation detail view',
    });

    res.json({ success: true, ticketId: result.ticketId, ticketTitle: result.ticketTitle });
  } catch (error) {
    console.error('Error escalating conversation:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to escalate conversation' });
  }
});

// GET /api/tenants/:tenantId/bot/skills
router.get('/skills', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const skills = await skillService.listSkills(tenantId);
    res.json({ success: true, skills });
  } catch (error) {
    console.error('Error listing skills:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to list skills' });
  }
});

// PUT /api/tenants/:tenantId/bot/skills/:skillId
router.put('/skills/:skillId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, skillId } = req.params;
    const validation = skillConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid skill config', details: validation.error.issues });
    }

    await skillService.updateSkillConfig(tenantId, skillId, validation.data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating skill config:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update skill config' });
  }
});

// GET /api/tenants/:tenantId/bot/dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const stats = await conversationService.getDashboardStats(tenantId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/tenants/:tenantId/bot/analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const stats = await conversationService.getDashboardStats(tenantId);

    res.json({
      success: true,
      analytics: {
        ...stats,
        period: 'all',
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch analytics' });
  }
});

// POST /api/tenants/:tenantId/bot/gdpr-erase — GDPR right-to-erase customer data
router.post('/gdpr-erase', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { email, phone } = req.body || {};

    if (!email && !phone) {
      return res.status(400).json({ success: false, error: 'missing_identifier', message: 'Email or phone is required' });
    }

    const count = await conversationService.eraseCustomerData(tenantId, { email, phone });
    res.json({ success: true, erasedCount: count });
  } catch (error) {
    console.error('Error erasing customer data:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to erase customer data' });
  }
});

// POST /api/tenants/:tenantId/bot/retention — Run conversation retention policy
router.post('/retention', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const archived = await conversationService.archiveOldConversations(tenantId);
    const deleted = await conversationService.deleteOldConversations(tenantId);
    res.json({ success: true, archived, deleted });
  } catch (error) {
    console.error('Error running retention:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to run retention policy' });
  }
});

// POST /api/tenants/:tenantId/bot/faq-webhook — FAQ mutation webhook (internal)
// Called when FAQs are created/updated/deleted to trigger bot knowledge base refresh.
// Phase 3A: triggers embedding regeneration via BotRagService.
router.post('/faq-webhook', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { action, faqId } = req.body || {};

    // Phase 3A: regenerate embeddings for this tenant
    if (action === 'delete' && faqId) {
      // Single FAQ deletion — remove its embeddings
      await ragService.refreshEmbeddings(tenantId);
    } else {
      // Create/update — refresh all embeddings for the tenant
      await ragService.refreshEmbeddings(tenantId);
    }

    res.json({ success: true, message: 'FAQ webhook processed — embeddings refreshed', action, faqId, tenantId });
  } catch (error) {
    console.error('Error processing FAQ webhook:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to process webhook' });
  }
});

// POST /api/tenants/:tenantId/bot/embeddings/refresh — Manually refresh FAQ embeddings
router.post('/embeddings/refresh', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await ragService.refreshEmbeddings(tenantId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error refreshing embeddings:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to refresh embeddings' });
  }
});

// GET /api/tenants/:tenantId/bot/embeddings/status — Check FAQ + product embedding status
router.get('/embeddings/status', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const hasFaqEmbeddings = await ragService.hasEmbeddings(tenantId);
    const hasProductEmbeddings = await ragService.hasProductEmbeddings(tenantId);
    res.json({ success: true, hasFaqEmbeddings, hasProductEmbeddings });
  } catch (error) {
    console.error('Error checking embedding status:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to check embedding status' });
  }
});

// POST /api/tenants/:tenantId/bot/product-embeddings/refresh — Manually refresh product catalog embeddings
router.post('/product-embeddings/refresh', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await ragService.refreshProductEmbeddings(tenantId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error refreshing product embeddings:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to refresh product embeddings' });
  }
});

// GET /api/tenants/:tenantId/bot/product-embeddings/status — Check product embedding status
router.get('/product-embeddings/status', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const hasProductEmbeddings = await ragService.hasProductEmbeddings(tenantId);
    res.json({ success: true, hasProductEmbeddings });
  } catch (error) {
    console.error('Error checking product embedding status:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to check product embedding status' });
  }
});

// POST /api/tenants/:tenantId/bot/dashboard-chat/start — Start a dashboard bot conversation
router.post('/dashboard-chat/start', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const result = await conversationService.createConversation({
      tenantId,
      source: 'dashboard',
      pageContext: 'dashboard',
    });

    res.json({
      success: true,
      sessionId: result.conversation.sessionId,
      conversationId: result.conversation.id,
      greeting: result.greeting,
    });
  } catch (error) {
    console.error('Error starting dashboard chat:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to start dashboard chat' });
  }
});

// POST /api/tenants/:tenantId/bot/dashboard-chat/message — Send a message in dashboard chat
router.post('/dashboard-chat/message', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { sessionId, message } = req.body || {};

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_session', message: 'sessionId is required' });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'missing_message', message: 'message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, error: 'message_too_long', message: 'Message exceeds 2000 characters' });
    }

    const conversation = await conversationService.getConversationBySession(sessionId);
    if (!conversation || conversation.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Conversation not found' });
    }

    const config = await configService.getOrCreate(tenantId);

    // 1. Guardrail check
    const guardrailResult = await guardrailService.checkMessage(tenantId, message);
    if (guardrailResult.action === 'block') {
      const blockMessage = guardrailService.getBlockResponse(guardrailResult.triggeredRules, config.fallbackMessage);
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
      return res.json({ success: true, reply: blockMessage, responseType: 'fallback', messageId: botMsg.id });
    }

    // Store user message
    await conversationService.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: guardrailResult.modifiedMessage,
      guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
    });

    // 1.5. Intent detection + skill execution (e.g., platform_guide)
    const intentResult = await intentService.detectIntent(guardrailResult.modifiedMessage);
    if (intentResult.mappedSkill && intentResult.intent) {
      const skillResult = await skillService.executeSkill(
        tenantId,
        intentResult.mappedSkill,
        { message: guardrailResult.modifiedMessage, pageContext: 'dashboard' }
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
          skillCard: skillResult.cardSchema,
          skillName: intentResult.mappedSkill,
          messageId: botMsg.id,
        });
      }
    }

    // 2. Try dynamic response (GPT with platform context)
    if (dynamicResponseService.isAvailable() && (await dynamicResponseService.isPlatformAiEnabled())) {
      const dynamicResult = await dynamicResponseService.generateResponse(
        tenantId,
        conversation.id,
        guardrailResult.modifiedMessage,
        config,
        'dashboard',
      );

      const botMsg = await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: dynamicResult.reply,
        responseType: dynamicResult.responseType,
        matchedFaqId: dynamicResult.matchedFaqId || undefined,
      });

      return res.json({
        success: true,
        reply: dynamicResult.reply,
        responseType: dynamicResult.responseType,
        matchedFaqId: dynamicResult.matchedFaqId,
        messageId: botMsg.id,
      });
    }

    // 3. Fallback to static response
    const staticResult = await staticResponseService.findResponse(tenantId, guardrailResult.modifiedMessage, 'dashboard');
    const botMsg = await conversationService.appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: staticResult.reply,
      responseType: staticResult.responseType,
      matchedFaqId: staticResult.matchedFaqId || undefined,
    });

    return res.json({
      success: true,
      reply: staticResult.reply,
      responseType: staticResult.responseType,
      matchedFaqId: staticResult.matchedFaqId,
      messageId: botMsg.id,
    });
  } catch (error) {
    console.error('Error in dashboard chat:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to process dashboard chat message' });
  }
});

// GET /api/tenants/:tenantId/bot/platform-guide — Get platform guide context for the tenant
router.get('/platform-guide', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const ctx = await platformGuideService.buildContext(tenantId, 'dashboard');
    res.json({ success: true, guide: ctx });
  } catch (error) {
    console.error('Error fetching platform guide:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch platform guide' });
  }
});

// POST /api/tenants/:tenantId/bot/avatar — Upload bot avatar image
router.post('/avatar', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { dataUrl, contentType } = req.body;

    if (!dataUrl || !contentType) {
      return res.status(400).json({
        success: false,
        error: 'missing_data',
        message: 'dataUrl and contentType are required',
      });
    }

    if (!contentType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'invalid_content_type',
        message: 'Content type must be an image type',
      });
    }

    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const maxSize = 5 * 1024 * 1024;
    if (imageBuffer.length > maxSize) {
      return res.status(400).json({
        success: false,
        error: 'file_too_large',
        message: 'Avatar file must be less than 5MB',
      });
    }

    const fileExtension = contentType.split('/')[1] || 'png';
    const fileName = `bot-avatar-${tenantId}-${Date.now()}.${fileExtension}`;
    const supabasePath = `bot-avatars/${tenantId}/${fileName}`;

    const { error: uploadError } = await supabaseService.storage
      .from(StorageBuckets.TENANTS.name)
      .upload(supabasePath, imageBuffer, {
        cacheControl: '3600',
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[BotMerchant] Avatar upload error:', uploadError.message);
      return res.status(500).json({
        success: false,
        error: 'upload_failed',
        message: 'Failed to upload avatar to storage',
      });
    }

    const { data: publicUrlData } = supabaseService.storage
      .from(StorageBuckets.TENANTS.name)
      .getPublicUrl(supabasePath);

    const avatarUrl = publicUrlData.publicUrl;

    await configService.update(tenantId, { widgetAvatarUrl: avatarUrl });

    res.json({ success: true, url: avatarUrl });
  } catch (error) {
    console.error('[BotMerchant] Avatar upload error:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to upload avatar' });
  }
});

export default router;
