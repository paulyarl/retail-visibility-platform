/**
 * Merchant Bot API Routes
 *
 * GET    /api/tenants/:tenantId/bot/config           — Get bot configuration
 * PUT    /api/tenants/:tenantId/bot/config           — Update bot configuration
 * GET    /api/tenants/:tenantId/bot/conversations    — List conversations (paginated)
 * GET    /api/tenants/:tenantId/bot/conversations/:id — Get conversation with messages
 * GET    /api/tenants/:tenantId/bot/skills            — List skills with tenant config
 * PUT    /api/tenants/:tenantId/bot/skills/:skillId   — Update skill config
 * GET    /api/tenants/:tenantId/bot/dashboard         — Dashboard stats
 * GET    /api/tenants/:tenantId/bot/analytics         — Analytics data
 * POST   /api/tenants/:tenantId/bot/product-embeddings/refresh — Refresh product catalog embeddings
 * GET    /api/tenants/:tenantId/bot/product-embeddings/status  — Check product embedding status
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import BotConfigurationService from '../services/BotConfigurationService';
import BotConversationService from '../services/BotConversationService';
import BotSkillService from '../services/BotSkillService';
import BotRagService from '../services/BotRagService';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

const router = Router({ mergeParams: true });
const configService = BotConfigurationService.getInstance();
const conversationService = BotConversationService.getInstance();
const skillService = BotSkillService.getInstance();
const ragService = BotRagService.getInstance();

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

export default router;
