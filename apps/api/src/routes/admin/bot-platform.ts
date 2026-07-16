/**
 * Bot Platform Admin Routes
 *
 * Platform admin endpoints for managing bot guardrails, intents, skills,
 * knowledge base embeddings, and viewing global bot dashboard stats.
 * Auth: authenticateToken (mounted externally)
 *
 * GET    /api/admin/bot/settings          — Get bot AI control settings
 * PUT    /api/admin/bot/settings          — Update bot AI control settings
 * POST   /api/admin/bot/sync-now          — Trigger manual embedding sync
 * GET    /api/admin/bot/sync-estimate     — Estimate sync cost (products, tokens, $)
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
import { logger } from '../../logger';

const router = Router({ mergeParams: true });
const ragService = BotRagService.getInstance();

// ====================
// AI Controls — platform-level enable/disable for bot AI features
// ====================

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.platform_settings_list.findFirst();
    res.json({
      success: true,
      data: {
        botAiEnabled: settings?.bot_ai_enabled ?? true,
        botEmbeddingSyncEnabled: settings?.bot_embedding_sync_enabled ?? true,
        botEmbeddingModel: settings?.bot_embedding_model ?? 'text-embedding-3-small',
        botChatModel: settings?.bot_chat_model ?? 'gpt-4o-mini',
        botSyncIntervalHours: settings?.bot_sync_interval_hours ?? 12,
        botEmbeddingProvider: settings?.bot_embedding_provider ?? 'openai',
        botChatProvider: settings?.bot_chat_provider ?? 'openai',
      },
    });
  } catch (error) {
    logger.error('[BotPlatformAdmin] Error fetching bot settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch bot settings' });
  }
});

const botSettingsSchema = z.object({
  botAiEnabled: z.boolean(),
  botEmbeddingSyncEnabled: z.boolean(),
  botEmbeddingModel: z.string().min(1).max(50).default('text-embedding-3-small'),
  botChatModel: z.string().min(1).max(50).default('gpt-4o-mini'),
  botSyncIntervalHours: z.number().int().min(0).max(168).default(12),
  botEmbeddingProvider: z.enum(['openai', 'anthropic', 'google', 'mistral']).default('openai'),
  botChatProvider: z.enum(['openai', 'anthropic', 'google', 'mistral']).default('openai'),
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const validation = botSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid bot settings', details: validation.error.issues });
    }

    const { botAiEnabled, botEmbeddingSyncEnabled, botEmbeddingModel, botChatModel, botSyncIntervalHours, botEmbeddingProvider, botChatProvider } = validation.data;

    // Upsert platform settings (single row, id=1)
    const settings = await prisma.platform_settings_list.upsert({
      where: { id: 1 },
      update: {
        bot_ai_enabled: botAiEnabled,
        bot_embedding_sync_enabled: botEmbeddingSyncEnabled,
        bot_embedding_model: botEmbeddingModel,
        bot_chat_model: botChatModel,
        bot_sync_interval_hours: botSyncIntervalHours,
        bot_embedding_provider: botEmbeddingProvider,
        bot_chat_provider: botChatProvider,
      },
      create: {
        id: 1,
        bot_ai_enabled: botAiEnabled,
        bot_embedding_sync_enabled: botEmbeddingSyncEnabled,
        bot_embedding_model: botEmbeddingModel,
        bot_chat_model: botChatModel,
        bot_sync_interval_hours: botSyncIntervalHours,
        bot_embedding_provider: botEmbeddingProvider,
        bot_chat_provider: botChatProvider,
        updated_at: new Date(),
      },
    });

    // Start/stop embedding sync job based on setting
    try {
      if (botEmbeddingSyncEnabled && botAiEnabled) {
        const { startBotProductEmbeddingSync, stopBotProductEmbeddingSync } = await import('../../jobs/bot-product-embedding-sync');
        stopBotProductEmbeddingSync();
        await startBotProductEmbeddingSync();
        console.log('[BotPlatformAdmin] Embedding sync job started (admin toggle)');
      } else {
        const { stopBotProductEmbeddingSync } = await import('../../jobs/bot-product-embedding-sync');
        stopBotProductEmbeddingSync();
        console.log('[BotPlatformAdmin] Embedding sync job stopped (admin toggle)');
      }
    } catch (jobErr) {
      logger.error('[BotPlatformAdmin] Error toggling embedding sync job:', undefined, { error: { name: (jobErr as any)?.name || 'Error', message: (jobErr as any)?.message || String(jobErr), stack: (jobErr as any)?.stack } });
    }

    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'update', payload: { entity_type: 'bot_settings', botAiEnabled, botEmbeddingSyncEnabled, botEmbeddingModel, botChatModel, botSyncIntervalHours, botEmbeddingProvider, botChatProvider } });

    // Invalidate provider factory cache so new provider/model takes effect
    try {
      const aiProviderFactory = await import('../../services/ai-providers');
      aiProviderFactory.default.invalidateCache();
    } catch { /* factory may not be loaded yet */ }

    res.json({
      success: true,
      data: {
        botAiEnabled: settings.bot_ai_enabled ?? true,
        botEmbeddingSyncEnabled: settings.bot_embedding_sync_enabled ?? true,
        botEmbeddingModel: settings.bot_embedding_model ?? 'text-embedding-3-small',
        botChatModel: settings.bot_chat_model ?? 'gpt-4o-mini',
        botSyncIntervalHours: settings.bot_sync_interval_hours ?? 12,
        botEmbeddingProvider: settings.bot_embedding_provider ?? 'openai',
        botChatProvider: settings.bot_chat_provider ?? 'openai',
      },
    });
  } catch (error) {
    logger.error('[BotPlatformAdmin] Error updating bot settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update bot settings' });
  }
});

// ====================
// Manual Sync Trigger + Cost Estimation
// ====================

router.post('/sync-now', async (req: Request, res: Response) => {
  try {
    const { triggerManualProductEmbeddingSync } = await import('../../jobs/bot-product-embedding-sync');
    console.log('[BotPlatformAdmin] Manual sync triggered by admin');
    const result = await triggerManualProductEmbeddingSync();
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'update', payload: { entity_type: 'bot_sync', action: 'manual_trigger', ...result } });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[BotPlatformAdmin] Error triggering manual sync:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to trigger sync' });
  }
});

router.get('/sync-estimate', async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.bot_configurations.findMany({
      where: { status: 'active' },
      select: { tenant_id: true },
    });
    const tenantIds = configs.map((c: any) => c.tenant_id);

    let totalProducts = 0;
    let totalChunks = 0;
    const pool = require('../../utils/db-pool').getDirectPool();

    for (const tenantId of tenantIds) {
      const result = await pool.query(
        `SELECT count(*)::int as cnt FROM mv_storefront_discovery
         WHERE tenant_id = $1 AND item_status = 'active' AND visibility = 'public'
         AND stock_status IN ('in_stock', 'low_stock')`,
        [tenantId]
      );
      const productCount = result.rows[0]?.cnt || 0;
      totalProducts += productCount;
      // Estimate ~2 chunks per product (500-char chunks with overlap)
      totalChunks += productCount * 2;
    }

    // Cost estimates (approximate OpenAI pricing per 1M tokens)
    // text-embedding-3-small: $0.02/1M tokens, text-embedding-3-large: $0.13/1M tokens
    // Each chunk ~500 chars ~125 tokens
    const settings = await prisma.platform_settings_list.findFirst();
    const embeddingModel = settings?.bot_embedding_model ?? 'text-embedding-3-small';
    const tokensPerChunk = 125;
    const totalTokens = totalChunks * tokensPerChunk;
    const costPer1M = embeddingModel === 'text-embedding-3-large' ? 0.13 : 0.02;
    const estimatedCost = (totalTokens / 1_000_000) * costPer1M;

    res.json({
      success: true,
      data: {
        tenantCount: tenantIds.length,
        totalProducts,
        estimatedChunks: totalChunks,
        estimatedTokens: totalTokens,
        estimatedCostUsd: Math.round(estimatedCost * 10000) / 10000,
        embeddingModel,
      },
    });
  } catch (error) {
    logger.error('[BotPlatformAdmin] Error estimating sync cost:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to estimate sync cost' });
  }
});

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
    logger.error('[BotPlatformAdmin] Error fetching dashboard stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error listing guardrails:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error creating guardrail:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error updating guardrail:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update guardrail rule' });
  }
});

router.delete('/guardrails/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bot_guardrail_rules.delete({ where: { id: req.params.id } });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'delete', payload: { entity_type: 'bot_guardrail_rule', id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('[BotPlatformAdmin] Error deleting guardrail:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error listing intents:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error creating intent:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error updating intent:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update intent' });
  }
});

router.delete('/intents/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bot_intents.delete({ where: { id: req.params.id } });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'delete', payload: { entity_type: 'bot_intent', id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('[BotPlatformAdmin] Error deleting intent:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error listing skills:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error creating skill:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error updating skill:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update skill' });
  }
});

router.delete('/skills/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bot_skills.delete({ where: { id: req.params.id } });
    await audit({ tenantId: 'platform', actor: (req as any).user?.userId || 'admin', action: 'delete', payload: { entity_type: 'bot_skill', id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('[BotPlatformAdmin] Error deleting skill:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error fetching knowledge status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error refreshing embeddings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotPlatformAdmin] Error listing bot tenants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list bot tenants' });
  }
});

export default router;
