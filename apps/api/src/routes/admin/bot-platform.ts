/**
 * Bot Platform Admin Routes
 *
 * Platform admin endpoints for managing bot guardrails, intents, skills,
 * knowledge base embeddings, and viewing global bot dashboard stats.
 * Auth: authenticateToken (mounted externally)
 *
 * GET    /api/admin/bot/dashboard          — Global bot dashboard stats
 * GET    /api/admin/bot/guardrails         — List all guardrail rules
 * POST   /api/admin/bot/guardrails         — Create guardrail rule
 * PUT    /api/admin/bot/guardrails/:id     — Update guardrail rule
 * DELETE /api/admin/bot/guardrails/:id     — Delete guardrail rule
 * GET    /api/admin/bot/intents            — List all intents
 * POST   /api/admin/bot/intents            — Create intent
 * PUT    /api/admin/bot/intents/:id        — Update intent
 * DELETE /api/admin/bot/intents/:id        — Delete intent
 * GET    /api/admin/bot/skills             — List all skills
 * POST   /api/admin/bot/skills             — Create skill
 * PUT    /api/admin/bot/skills/:id         — Update skill
 * DELETE /api/admin/bot/skills/:id         — Delete skill
 * GET    /api/admin/bot/knowledge          — Embedding status across tenants
 * POST   /api/admin/bot/knowledge/refresh  — Trigger embedding refresh for a tenant
 * GET    /api/admin/bot/tenants            — List tenants with active chatbot + config summary
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import BotRagService from '../../services/BotRagService';
import { audit } from '../../audit';

const router = Router({ mergeParams: true });
const ragService = BotRagService.getInstance();

// ====================
// Dashboard Stats
// ====================

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const [
      totalConfigs,
      activeConfigs,
      totalConversations,
      activeConversations,
      totalMessages,
      totalSkills,
      activeSkills,
      totalGuardrailRules,
      activeGuardrailRules,
      totalIntents,
    ] = await Promise.all([
      prisma.bot_configurations.count(),
      prisma.bot_configurations.count({ where: { status: 'active' } }),
      prisma.bot_conversations.count(),
      prisma.bot_conversations.count({ where: { status: 'active' } }),
      prisma.bot_messages.count(),
      prisma.bot_skills.count(),
      prisma.bot_skills.count({ where: { status: 'active' } }),
      prisma.bot_guardrail_rules.count(),
      prisma.bot_guardrail_rules.count({ where: { is_active: true } }),
      prisma.bot_intents.count(),
    ]);

    // Conversations in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentConversations = await prisma.bot_conversations.count({
      where: { created_at: { gte: sevenDaysAgo } },
    });

    // Resolution breakdown
    const resolutionStats = await prisma.bot_conversations.groupBy({
      by: ['resolved_by'],
      _count: true,
    });

    // Top intents from messages
    const topIntents = await prisma.bot_messages.groupBy({
      by: ['intent'],
      _count: true,
      orderBy: { _count: { intent: 'desc' } },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        totalConfigs,
        activeConfigs,
        totalConversations,
        activeConversations,
        recentConversations,
        totalMessages,
        totalSkills,
        activeSkills,
        totalGuardrailRules,
        activeGuardrailRules,
        totalIntents,
        resolutionStats: resolutionStats.map((r: any) => ({ resolved_by: r.resolved_by, count: r._count })),
        topIntents: topIntents.filter((i: any) => i.intent).map((i: any) => ({ intent: i.intent, count: i._count.intent })),
      },
    });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch dashboard stats' });
  }
});

// ====================
// Guardrails CRUD
// ====================

const guardrailSchema = z.object({
  tenant_id: z.string().nullable().optional(),
  rule_type: z.enum(['banned_phrase', 'pii_detection', 'moderation', 'competitor']),
  pattern: z.string().min(1).max(500),
  action: z.enum(['block', 'flag', 'mask', 'replace']).default('block'),
  replacement: z.string().max(255).nullable().optional(),
  response_template: z.string().nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  is_active: z.boolean().default(true),
});

router.get('/guardrails', async (req: Request, res: Response) => {
  try {
    const tenantFilter = req.query.tenantId as string | undefined;
    const rules = await prisma.bot_guardrail_rules.findMany({
      where: tenantFilter ? { tenant_id: tenantFilter } : undefined,
      orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
    });
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error listing guardrails:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list guardrail rules' });
  }
});

router.post('/guardrails', async (req: Request, res: Response) => {
  try {
    const validation = guardrailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid guardrail data', details: validation.error.issues });
    }
    const rule = await prisma.bot_guardrail_rules.create({ data: validation.data });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'create', payload: { entity_type: 'bot_guardrail_rule', id: rule.id, ...validation.data } });
    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error creating guardrail:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create guardrail rule' });
  }
});

router.put('/guardrails/:id', async (req: Request, res: Response) => {
  try {
    const validation = guardrailSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid guardrail data', details: validation.error.issues });
    }
    const rule = await prisma.bot_guardrail_rules.update({
      where: { id: req.params.id },
      data: validation.data,
    });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'update', payload: { entity_type: 'bot_guardrail_rule', id: rule.id } });
    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error updating guardrail:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update guardrail rule' });
  }
});

router.delete('/guardrails/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bot_guardrail_rules.delete({ where: { id: req.params.id } });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'delete', payload: { entity_type: 'bot_guardrail_rule', id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error deleting guardrail:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete guardrail rule' });
  }
});

// ====================
// Intents CRUD
// ====================

const intentSchema = z.object({
  name: z.string().min(1).max(50),
  category: z.string().min(1).max(50),
  description: z.string().nullable().optional(),
  examples: z.array(z.string().max(255)).default([]),
  confidence_threshold: z.number().min(0).max(1).default(0.85),
  mapped_skill: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

router.get('/intents', async (_req: Request, res: Response) => {
  try {
    const intents = await prisma.bot_intents.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: intents });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error listing intents:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list intents' });
  }
});

router.post('/intents', async (req: Request, res: Response) => {
  try {
    const validation = intentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid intent data', details: validation.error.issues });
    }
    const intent = await prisma.bot_intents.create({ data: validation.data as any });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'create', payload: { entity_type: 'bot_intent', id: intent.id, ...validation.data } });
    res.json({ success: true, data: intent });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error creating intent:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create intent' });
  }
});

router.put('/intents/:id', async (req: Request, res: Response) => {
  try {
    const validation = intentSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid intent data', details: validation.error.issues });
    }
    const intent = await prisma.bot_intents.update({
      where: { id: req.params.id },
      data: validation.data as any,
    });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'update', payload: { entity_type: 'bot_intent', id: intent.id } });
    res.json({ success: true, data: intent });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error updating intent:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update intent' });
  }
});

router.delete('/intents/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bot_intents.delete({ where: { id: req.params.id } });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'delete', payload: { entity_type: 'bot_intent', id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error deleting intent:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete intent' });
  }
});

// ====================
// Skills CRUD
// ====================

const skillSchema = z.object({
  name: z.string().min(1).max(50),
  version: z.string().max(10).default('1.0.0'),
  description: z.string().nullable().optional(),
  endpoint: z.string().min(1).max(255),
  required_capabilities: z.array(z.string().max(50)).default([]),
  tier_gates: z.array(z.string().max(20)).default([]),
  capability_gates: z.array(z.string().max(50)).default([]),
  tenant_status_gates: z.array(z.string().max(20)).default([]),
  featured_aware: z.boolean().default(false),
  refresh_cadence_minutes: z.number().int().min(1).default(15),
  status: z.enum(['active', 'beta', 'deprecated']).default('active'),
  skill_card_schema: z.any().nullable().optional(),
  default_config: z.any().nullable().optional(),
});

router.get('/skills', async (_req: Request, res: Response) => {
  try {
    const skills = await prisma.bot_skills.findMany({
      orderBy: [{ name: 'asc' }],
      include: {
        bot_skill_configurations: { select: { tenant_id: true, enabled: true } },
      },
    });
    res.json({ success: true, data: skills });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error listing skills:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list skills' });
  }
});

router.post('/skills', async (req: Request, res: Response) => {
  try {
    const validation = skillSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid skill data', details: validation.error.issues });
    }
    const skill = await prisma.bot_skills.create({ data: validation.data as any });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'create', payload: { entity_type: 'bot_skill', id: skill.id, ...validation.data } });
    res.json({ success: true, data: skill });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error creating skill:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create skill' });
  }
});

router.put('/skills/:id', async (req: Request, res: Response) => {
  try {
    const validation = skillSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid skill data', details: validation.error.issues });
    }
    const skill = await prisma.bot_skills.update({
      where: { id: req.params.id },
      data: validation.data as any,
    });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'update', payload: { entity_type: 'bot_skill', id: skill.id } });
    res.json({ success: true, data: skill });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error updating skill:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update skill' });
  }
});

router.delete('/skills/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bot_skills.delete({ where: { id: req.params.id } });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'delete', payload: { entity_type: 'bot_skill', id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error deleting skill:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete skill' });
  }
});

// ====================
// Knowledge Base — embedding status across tenants
// ====================

router.get('/knowledge', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const skip = (page - 1) * limit;

    // Get tenants with active bot configs
    const configs = await prisma.bot_configurations.findMany({
      where: { status: 'active' },
      select: { tenant_id: true, bot_name: true, status: true },
      skip,
      take: limit,
      orderBy: { tenant_id: 'asc' },
    });

    const total = await prisma.bot_configurations.count({ where: { status: 'active' } });

    // Get embedding counts per tenant
    const tenantIds = configs.map((c: any) => c.tenant_id);
    const [faqCounts, productCounts] = await Promise.all([
      prisma.bot_faq_embeddings.groupBy({
        by: ['tenant_id'],
        where: { tenant_id: { in: tenantIds } },
        _count: true,
      }),
      prisma.bot_product_embeddings.groupBy({
        by: ['tenant_id'],
        where: { tenant_id: { in: tenantIds } },
        _count: true,
      }),
    ]);

    const faqMap = new Map(faqCounts.map((f: any) => [f.tenant_id, f._count]));
    const productMap = new Map(productCounts.map((p: any) => [p.tenant_id, p._count]));

    const data = configs.map((c: any) => ({
      tenantId: c.tenant_id,
      botName: c.bot_name,
      status: c.status,
      faqEmbeddings: faqMap.get(c.tenant_id) || 0,
      productEmbeddings: productMap.get(c.tenant_id) || 0,
    }));

    res.json({ success: true, data, total, page, limit });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error fetching knowledge status:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch knowledge status' });
  }
});

const refreshSchema = z.object({
  tenantId: z.string().min(1),
  type: z.enum(['faq', 'product', 'both']).default('both'),
});

router.post('/knowledge/refresh', async (req: Request, res: Response) => {
  try {
    const validation = refreshSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid refresh request', details: validation.error.issues });
    }

    const { tenantId, type } = validation.data;
    const results: any = {};

    if (type === 'faq' || type === 'both') {
      results.faq = await ragService.refreshEmbeddings(tenantId);
    }
    if (type === 'product' || type === 'both') {
      results.product = await ragService.refreshProductEmbeddings(tenantId);
    }

    await audit({ tenantId, actor: (req as any).user?.userId || 'admin', action: 'update', payload: { entity_type: 'bot_embeddings', action: 'manual_refresh', type } });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error refreshing embeddings:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to refresh embeddings' });
  }
});

// ====================
// Tenants — list with bot config summary
// ====================

router.get('/tenants', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const skip = (page - 1) * limit;
    const search = req.query.q as string | undefined;

    const where = search
      ? { OR: [{ tenant_id: { contains: search } }, { bot_name: { contains: search } }] }
      : undefined;

    const [configs, total] = await Promise.all([
      prisma.bot_configurations.findMany({
        where,
        select: {
          tenant_id: true,
          bot_name: true,
          status: true,
          tone: true,
          response_length: true,
          escalation_enabled: true,
          created_at: true,
          updated_at: true,
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.bot_configurations.count({ where }),
    ]);

    // Get conversation counts per tenant
    const tenantIds = configs.map((c: any) => c.tenant_id);
    const conversationCounts = await prisma.bot_conversations.groupBy({
      by: ['tenant_id'],
      where: { tenant_id: { in: tenantIds } },
      _count: true,
    });
    const convMap = new Map(conversationCounts.map((c: any) => [c.tenant_id, c._count]));

    const data = configs.map((c: any) => ({
      ...c,
      conversationCount: convMap.get(c.tenant_id) || 0,
    }));

    res.json({ success: true, data, total, page, limit });
  } catch (error) {
    console.error('[BotPlatformAdmin] Error listing bot tenants:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list bot tenants' });
  }
});

export default router;
