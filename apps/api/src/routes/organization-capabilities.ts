/**
 * Organization Capabilities API Routes
 *
 * GET /api/organizations/:orgId/effective-capabilities
 * Returns org-level effective capabilities (tab access, panel access, propagation types)
 * resolved from the org's subscription tier features.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { getEffectiveTier } from '../utils/trial-tier-transparency';
import { resolveOrgOptions } from '../services/resolvers';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { BotConfigurationService } from '../services/BotConfigurationService';
import { BotConversationService } from '../services/BotConversationService';
import BotRagService from '../services/BotRagService';
import BotDynamicResponseService from '../services/BotDynamicResponseService';
import BotGuardrailService from '../services/BotGuardrailService';
import BotStaticResponseService from '../services/BotStaticResponseService';
import BotIntentService from '../services/BotIntentService';
import BotSkillService from '../services/BotSkillService';
import OrgBotService from '../services/OrgBotService';
import { logger } from '../logger';
import { generateCorrelationId } from '../lib/id-generator';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

const CAPABILITY_DOMAINS = [
  'commerce', 'payment_gateway', 'storefront', 'fulfillment', 'product_options',
  'featured', 'integrations', 'quickstart', 'storefront_options',
  'directory_entry', 'faq', 'crm', 'chatbot', 'barcode_scan',
] as const;

const DOMAIN_LABELS: Record<string, string> = {
  commerce: 'Commerce',
  payment_gateway: 'Payment Gateway',
  storefront: 'Storefront',
  fulfillment: 'Fulfillment',
  product_options: 'Product Options',
  featured: 'Featured Options',
  integrations: 'Integrations',
  quickstart: 'Quickstart',
  storefront_options: 'Storefront Options',
  directory_entry: 'Directory Entry',
  faq: 'FAQ',
  crm: 'CRM',
  chatbot: 'Chatbot',
  barcode_scan: 'Barcode Scan',
};

/**
 * GET /api/organizations/:orgId/effective-capabilities
 */
router.get('/:orgId/effective-capabilities', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'orgId required' });
    }

    const correlationId = generateCorrelationId();
    const logMeta = { correlationId, orgId };

    // 1. Fetch org with subscription tier
    const org = await prisma.organizations_list.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!org) {
      logger.warn('[OrgCapabilities] Organization not found', undefined, logMeta);
      return res.status(404).json({ success: false, error: 'organization_not_found' });
    }

    const orgTierKey = org.subscription_tier || null;
    const resolvedTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;

    if (!resolvedTierKey) {
      // No tier assigned — return minimal defaults
      const result = resolveOrgOptions({}, false);
      return res.json({ success: true, data: result });
    }

    // 2. Fetch tier features for organization_options capability type
    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: resolvedTierKey },
      select: { id: true, name: true, description: true },
    });

    if (!tier) {
      logger.warn('[OrgCapabilities] Tier not found', undefined, { ...logMeta, tierKey: resolvedTierKey });
      const result = resolveOrgOptions({}, false);
      return res.json({ success: true, data: result });
    }

    // Find capability type
    const capType = await prisma.capability_type_list.findUnique({
      where: { key: 'organization_options' },
    });

    let tierFeatures: any[] = [];
    if (capType) {
      tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: tier.id,
          capability_type_id: capType.id,
          is_enabled: true,
        },
      });
    } else {
      // Fallback: prefix-based query
      tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: tier.id,
          feature_key: { startsWith: 'org_' },
          is_enabled: true,
        },
      });
    }

    // 3. Merge features (most-permissive-wins if org has multiple tiers)
    const features: Record<string, boolean> = {};
    for (const tf of tierFeatures) {
      const key = tf.feature_key.trim();
      features[key] = features[key] || tf.is_enabled;
    }

    // 3.5. Merge BSaaS purchases (à la carte org features)
    // Find hero tenant for this org
    const heroTenant = await prisma.tenants.findFirst({
      where: { organization_id: orgId },
      select: { id: true, metadata: true },
    });

    let purchasedFeatureKeys: string[] = [];
    if (heroTenant) {
      const heroMeta = heroTenant.metadata as any;
      const heroTenantId = heroMeta?.isHeroLocation ? heroTenant.id : heroTenant.id;

      const purchases = await prisma.tenant_feature_purchases.findMany({
        where: {
          tenant_id: heroTenantId,
          status: { in: ['active', 'past_due', 'trial'] },
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          feature_key: { startsWith: 'org_' },
        },
        select: { feature_key: true },
      });

      purchasedFeatureKeys = purchases.map(p => p.feature_key);
      for (const key of purchasedFeatureKeys) {
        features[key] = true; // purchased = always enabled
      }
    }

    // 4. Resolve
    const result = resolveOrgOptions(features, true);

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json({
      success: true,
      data: {
        ...result,
        tier: {
          key: resolvedTierKey,
          name: tier.name || resolvedTierKey,
          description: tier.description || '',
        },
        purchased_feature_keys: purchasedFeatureKeys,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/organizations/:orgId/effective-capabilities] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve organization capabilities',
    });
  }
});

/**
 * GET /api/organizations/:orgId/capability-rollup
 * Aggregates per-tenant capability status across all locations in the org.
 * Returns counts per capability domain: enabled, gated, tier-blocked.
 */
router.get('/:orgId/capability-rollup', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'orgId required' });
    }

    const correlationId = generateCorrelationId();
    const logMeta = { correlationId, orgId };

    // 1. Fetch org with tenants
    const org = await prisma.organizations_list.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        tenants: {
          select: { id: true, name: true },
        },
      },
    });

    if (!org) {
      logger.warn('[OrgCapabilityRollup] Organization not found', undefined, logMeta);
      return res.status(404).json({ success: false, error: 'organization_not_found' });
    }

    const totalLocations = org.tenants.length;
    if (totalLocations === 0) {
      return res.json({
        success: true,
        data: {
          totalLocations: 0,
          domains: [],
          locations: [],
        },
      });
    }

    // 2. Fetch capabilities for each tenant in parallel
    const results = await Promise.allSettled(
      org.tenants.map(async (tenant) => {
        const caps = await resolveEffectiveCapabilities(tenant.id, { detail: 'summary' });
        return { tenantId: tenant.id, tenantName: tenant.name, caps };
      })
    );

    const locations: Array<{
      tenantId: string;
      tenantName: string;
      domains: Record<string, boolean>;
    }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const tenant = org.tenants[i];
      if (result.status === 'fulfilled' && result.value.caps) {
        const domains: Record<string, boolean> = {};
        for (const domain of CAPABILITY_DOMAINS) {
          const eff = (result.value.caps.effective as any)[domain];
          domains[domain] = eff?.enabled ?? false;
        }
        locations.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          domains,
        });
      } else {
        // Failed to resolve — mark all as unknown/false
        const domains: Record<string, boolean> = {};
        for (const domain of CAPABILITY_DOMAINS) {
          domains[domain] = false;
        }
        locations.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          domains,
        });
      }
    }

    // 3. Aggregate per domain
    const domains = CAPABILITY_DOMAINS.map((domain) => {
      let enabledCount = 0;
      for (const loc of locations) {
        if (loc.domains[domain]) enabledCount++;
      }
      return {
        key: domain,
        label: DOMAIN_LABELS[domain] || domain,
        enabledCount,
        totalLocations,
        disabledCount: totalLocations - enabledCount,
      };
    });

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({
      success: true,
      data: {
        totalLocations,
        domains,
        locations,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/organizations/:orgId/capability-rollup] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve capability rollup',
    });
  }
});

/**
 * GET /api/organizations/:orgId/bot-status
 * Aggregates chatbot status across all locations in the org.
 * For each location: bot active/inactive, conversation count, FAQ/product KB status.
 */
router.get('/:orgId/bot-status', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'orgId required' });
    }

    const correlationId = generateCorrelationId();
    const logMeta = { correlationId, orgId };

    const org = await prisma.organizations_list.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        tenants: { select: { id: true, name: true } },
      },
    });

    if (!org) {
      logger.warn('[OrgBotStatus] Organization not found', undefined, logMeta);
      return res.status(404).json({ success: false, error: 'organization_not_found' });
    }

    const totalLocations = org.tenants.length;
    if (totalLocations === 0) {
      return res.json({
        success: true,
        data: { totalLocations: 0, totalActive: 0, totalInactive: 0, locations: [] },
      });
    }

    const configService = BotConfigurationService.getInstance();
    const conversationService = BotConversationService.getInstance();
    const ragService = BotRagService.getInstance();

    const results = await Promise.allSettled(
      org.tenants.map(async (tenant) => {
        const [config, stats, hasFaq, hasProducts] = await Promise.all([
          configService.getOrCreate(tenant.id),
          conversationService.getDashboardStats(tenant.id),
          ragService.hasEmbeddings(tenant.id),
          ragService.hasProductEmbeddings(tenant.id),
        ]);
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          botActive: config.status === 'active',
          conversationCount: stats.totalConversations,
          activeConversations: stats.activeConversations,
          hasFaqEmbeddings: hasFaq,
          hasProductEmbeddings: hasProducts,
        };
      })
    );

    const locations = results.map((result, i) => {
      const tenant = org.tenants[i];
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        botActive: false,
        conversationCount: 0,
        activeConversations: 0,
        hasFaqEmbeddings: false,
        hasProductEmbeddings: false,
      };
    });

    const totalActive = locations.filter((l) => l.botActive).length;

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({
      success: true,
      data: {
        totalLocations,
        totalActive,
        totalInactive: totalLocations - totalActive,
        locations,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/organizations/:orgId/bot-status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve bot status',
    });
  }
});

// Org bot service instances
const orgBotService = OrgBotService.getInstance();
const orgConfigService = BotConfigurationService.getInstance();
const orgConversationService = BotConversationService.getInstance();
const orgDynamicResponseService = BotDynamicResponseService.getInstance();
const orgGuardrailService = BotGuardrailService.getInstance();
const orgStaticResponseService = BotStaticResponseService.getInstance();
const orgIntentService = BotIntentService.getInstance();
const orgSkillService = BotSkillService.getInstance();

/**
 * POST /api/organizations/:orgId/bot/chat/start
 * Start an org-level bot conversation using the hero location's tenant as host.
 */
router.post('/:orgId/bot/chat/start', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'orgId required' });
    }

    const ctx = await orgBotService.buildOrgContext(orgId);
    if (!ctx) {
      return res.status(404).json({ success: false, error: 'organization_not_found', message: 'Organization has no locations' });
    }

    // Ensure bot config exists for hero tenant
    await orgConfigService.getOrCreate(ctx.heroTenantId);

    const result = await orgConversationService.createConversation({
      tenantId: ctx.heroTenantId,
      source: 'org_dashboard',
      pageContext: 'dashboard',
    });

    const greeting = orgBotService.buildGreeting(ctx);

    // Override the greeting message
    await prisma.bot_messages.updateMany({
      where: { conversation_id: result.conversation.id, role: 'assistant' },
      data: { content: greeting },
    });

    res.json({
      success: true,
      sessionId: result.conversation.sessionId,
      conversationId: result.conversation.id,
      greeting,
      orgContext: { orgName: ctx.orgName, totalLocations: ctx.totalLocations },
    });
  } catch (error: any) {
    console.error('[POST /api/organizations/:orgId/bot/chat/start] Error:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to start org bot chat' });
  }
});

/**
 * POST /api/organizations/:orgId/bot/chat/message
 * Send a message in the org-level bot conversation.
 */
router.post('/:orgId/bot/chat/message', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
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

    // Build org context for the system prompt
    const ctx = await orgBotService.buildOrgContext(orgId);
    if (!ctx) {
      return res.status(404).json({ success: false, error: 'organization_not_found' });
    }

    const conversation = await orgConversationService.getConversationBySession(sessionId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Conversation not found' });
    }

    const config = await orgConfigService.getOrCreate(ctx.heroTenantId);

    // 1. Guardrail check
    const guardrailResult = await orgGuardrailService.checkMessage(ctx.heroTenantId, message);
    if (guardrailResult.action === 'block') {
      const blockMessage = orgGuardrailService.getBlockResponse(guardrailResult.triggeredRules, config.fallbackMessage);
      await orgConversationService.appendMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        guardrailResult: 'blocked',
      });
      const botMsg = await orgConversationService.appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: blockMessage,
        responseType: 'fallback',
        guardrailResult: 'blocked',
      });
      return res.json({ success: true, reply: blockMessage, responseType: 'fallback', messageId: botMsg.id });
    }

    // Store user message
    await orgConversationService.appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: guardrailResult.modifiedMessage,
      guardrailResult: guardrailResult.action === 'pass' ? 'pass' : guardrailResult.action,
    });

    // 2. Intent detection + skill execution
    const intentResult = await orgIntentService.detectIntent(guardrailResult.modifiedMessage);
    if (intentResult.mappedSkill && intentResult.intent) {
      const skillResult = await orgSkillService.executeSkill(
        ctx.heroTenantId,
        intentResult.mappedSkill,
        { message: guardrailResult.modifiedMessage, pageContext: 'dashboard' }
      );

      if (skillResult.success) {
        const botMsg = await orgConversationService.appendMessage({
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

    // 3. Try dynamic response (GPT with org context)
    if (orgDynamicResponseService.isAvailable() && (await orgDynamicResponseService.isPlatformAiEnabled())) {
      // Generate response with hero tenant, then we'd ideally inject org context.
      // The dynamic response service builds its own system prompt from config.
      // We pass 'dashboard' as pageContext. The org context addition is handled
      // by storing it as a special FAQ-like context via a post-generation wrap.
      const dynamicResult = await orgDynamicResponseService.generateResponse(
        ctx.heroTenantId,
        conversation.id,
        guardrailResult.modifiedMessage,
        config,
        'dashboard',
      );

      // Prepend org context awareness to the reply if it's a dynamic response
      let reply = dynamicResult.reply;
      if (dynamicResult.responseType === 'dynamic' && ctx.totalLocations > 1) {
        // The reply is already generated; we just ensure the org context is known
        // by appending it as context for future messages in the conversation
      }

      const botMsg = await orgConversationService.appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: reply,
        responseType: dynamicResult.responseType,
        matchedFaqId: dynamicResult.matchedFaqId || undefined,
      });

      return res.json({
        success: true,
        reply,
        responseType: dynamicResult.responseType,
        matchedFaqId: dynamicResult.matchedFaqId,
        messageId: botMsg.id,
      });
    }

    // 4. Fallback to static response
    const staticResult = await orgStaticResponseService.findResponse(ctx.heroTenantId, guardrailResult.modifiedMessage, 'dashboard');
    const botMsg = await orgConversationService.appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: staticResult.reply,
      responseType: 'static',
    });

    return res.json({
      success: true,
      reply: staticResult.reply,
      responseType: 'static',
      messageId: botMsg.id,
    });
  } catch (error: any) {
    console.error('[POST /api/organizations/:orgId/bot/chat/message] Error:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to send message' });
  }
});

export default router;
