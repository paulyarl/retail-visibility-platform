import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { resolveEffectiveCapabilities, invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { logger } from '../logger';

const router = Router();

// Validation schema
const chatbotOptionsSettingsSchema = z.object({
  chatbot_enabled: z.boolean().optional(),
  chatbot_static_enabled: z.boolean().optional(),
  chatbot_dynamic_enabled: z.boolean().optional(),
  chatbot_skills_enabled: z.boolean().optional(),
  chatbot_kb_enabled: z.boolean().optional(),
  chatbot_widget_enabled: z.boolean().optional(),
  chatbot_widget_custom_theme: z.boolean().optional(),
  chatbot_widget_skill_cards: z.boolean().optional(),
  chatbot_widget_after_hours: z.boolean().optional(),
});

// Default settings
const DEFAULT_SETTINGS = {
  chatbot_enabled: true,
  chatbot_static_enabled: true,
  chatbot_dynamic_enabled: false,
  chatbot_skills_enabled: false,
  chatbot_kb_enabled: false,
  chatbot_widget_enabled: true,
  chatbot_widget_custom_theme: false,
  chatbot_widget_skill_cards: false,
  chatbot_widget_after_hours: false,
};

const CHATBOT_FEATURE_KEYS = [
  'chatbot_enabled',
  'chatbot_static_enabled',
  'chatbot_dynamic_enabled',
  'chatbot_skills_enabled',
  'chatbot_kb_enabled',
  'chatbot_widget_enabled',
  'chatbot_widget_custom_theme',
  'chatbot_widget_skill_cards',
  'chatbot_widget_after_hours',
] as const;

// Tier-gate mapping: which tier features enable which merchant toggles
const TIER_GATE_MAP: Record<string, string[]> = {
  chatbot_static_enabled: ['chatbot_static_enabled', 'chatbot_static_lookup', 'chatbot_flexible'],
  chatbot_dynamic_enabled: ['chatbot_dynamic_enabled', 'chatbot_shared_dynamic', 'chatbot_flexible'],
  chatbot_skills_enabled: ['chatbot_skills_enabled', 'chatbot_skill_product_search', 'chatbot_flexible'],
  chatbot_kb_enabled: ['chatbot_kb_enabled', 'chatbot_kb_static_faq', 'chatbot_flexible'],
  chatbot_widget_enabled: ['chatbot_widget_enabled', 'chatbot_widget_embed', 'chatbot_flexible'],
  chatbot_widget_custom_theme: ['chatbot_widget_custom_theme', 'chatbot_flexible'],
  chatbot_widget_skill_cards: ['chatbot_widget_skill_cards', 'chatbot_flexible'],
  chatbot_widget_after_hours: ['chatbot_widget_after_hours', 'chatbot_flexible'],
};

// Get chatbot options settings for a tenant
router.get('/:tenantId/chatbot-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps) {
      const allOff: Record<string, boolean> = {};
      for (const key of CHATBOT_FEATURE_KEYS) { allOff[key] = false; }
      return res.json({ success: true, settings: allOff, tierState: null });
    }
    const tierState = caps.effective.chatbot;

    if (!tierState.enabled) {
      const allOff: Record<string, boolean> = {};
      for (const key of CHATBOT_FEATURE_KEYS) { allOff[key] = false; }
      return res.json({ success: true, settings: allOff, tierState });
    }

    const merchantPrefs = await prisma.tenant_chatbot_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    const tierFilteredSettings: Record<string, boolean> = {
      chatbot_enabled: !!rawSettings.chatbot_enabled && tierState.enabled,
      chatbot_static_enabled: tierState.static_enabled ? !!rawSettings.chatbot_static_enabled : false,
      chatbot_dynamic_enabled: tierState.dynamic_enabled ? !!rawSettings.chatbot_dynamic_enabled : false,
      chatbot_skills_enabled: tierState.skills_enabled ? !!rawSettings.chatbot_skills_enabled : false,
      chatbot_kb_enabled: tierState.kb_enabled ? !!rawSettings.chatbot_kb_enabled : false,
      chatbot_widget_enabled: tierState.widget_enabled ? !!rawSettings.chatbot_widget_enabled : false,
      chatbot_widget_custom_theme: (tierState.is_flexible || tierState.allowed_widget_types.includes('chatbot_widget_custom_theme')) ? !!rawSettings.chatbot_widget_custom_theme : false,
      chatbot_widget_skill_cards: (tierState.is_flexible || tierState.allowed_widget_types.includes('chatbot_widget_skill_cards')) ? !!rawSettings.chatbot_widget_skill_cards : false,
      chatbot_widget_after_hours: (tierState.is_flexible || tierState.allowed_widget_types.includes('chatbot_widget_after_hours')) ? !!rawSettings.chatbot_widget_after_hours : false,
    };

    res.json({ success: true, settings: tierFilteredSettings, tierState });
  } catch (error) {
    logger.error('Error fetching chatbot options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch chatbot options settings' });
  }
});

// Update chatbot options settings for a tenant
router.put('/:tenantId/chatbot-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const validationResult = chatbotOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid chatbot options settings data', details: validationResult.error.issues });
    }

    const data = validationResult.data;
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot options capability is disabled for this tenant\'s tier' });
    }
    const tierState = caps.effective.chatbot;

    if (!tierState.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Chatbot options capability is disabled for this tenant\'s tier' });
    }

    const filteredData: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'chatbot_enabled') { filteredData[key] = value; continue; }

      const gateFeatures = TIER_GATE_MAP[key];
      if (!gateFeatures) { filteredData[key] = value; continue; }

      const isAllowed = tierState.is_flexible || gateFeatures.some(gk => (caps!.effective.chatbot as any)[gk] || tierState.allowed_response_engines.includes(gk as any) || tierState.allowed_skill_types.includes(gk as any) || tierState.allowed_kb_types.includes(gk as any) || tierState.allowed_widget_types.includes(gk as any));

      if (isAllowed) {
        filteredData[key] = value;
      } else if (value === true) {
        return res.status(403).json({ success: false, error: 'tier_restricted', message: `Chatbot feature '${key}' is not available on your current plan`, feature_key: key });
      }
    }

    const existing = await prisma.tenant_chatbot_options_settings.findUnique({ where: { tenant_id: tenantId } });
    let settings;
    if (existing) {
      settings = await prisma.tenant_chatbot_options_settings.update({
        where: { tenant_id: tenantId },
        data: { ...filteredData, updated_at: new Date() },
      });
    } else {
      settings = await prisma.tenant_chatbot_options_settings.create({
        data: { id: `chbot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, tenant_id: tenantId, ...filteredData },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        chatbot_enabled: settings.chatbot_enabled,
        chatbot_static_enabled: settings.chatbot_static_enabled,
        chatbot_dynamic_enabled: settings.chatbot_dynamic_enabled,
        chatbot_skills_enabled: settings.chatbot_skills_enabled,
        chatbot_kb_enabled: settings.chatbot_kb_enabled,
        chatbot_widget_enabled: settings.chatbot_widget_enabled,
        chatbot_widget_custom_theme: settings.chatbot_widget_custom_theme,
        chatbot_widget_skill_cards: settings.chatbot_widget_skill_cards,
        chatbot_widget_after_hours: settings.chatbot_widget_after_hours,
      },
    });
  } catch (error) {
    logger.error('Error updating chatbot options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update chatbot options settings' });
  }
});

// Public endpoint — deprecated, use effective-capabilities instead
router.get('/public/tenant/:tenantId/chatbot-options', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /public/tenant/${tenantId}/chatbot-options is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps) {
      const allOff: Record<string, boolean> = {};
      for (const key of CHATBOT_FEATURE_KEYS) { allOff[key] = false; }
      return res.json({ success: true, settings: allOff, tierState: null });
    }
    const tierState = caps.effective.chatbot;

    if (!tierState.enabled) {
      const allOff: Record<string, boolean> = {};
      for (const key of CHATBOT_FEATURE_KEYS) { allOff[key] = false; }
      return res.json({ success: true, settings: allOff, tierState });
    }

    const merchantPrefs = await prisma.tenant_chatbot_options_settings.findUnique({ where: { tenant_id: tenantId } });
    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    const publicSettings: Record<string, boolean> = {
      chatbot_enabled: !!rawSettings.chatbot_enabled && tierState.enabled,
      chatbot_static_enabled: tierState.static_enabled ? !!rawSettings.chatbot_static_enabled : false,
      chatbot_widget_enabled: tierState.widget_enabled ? !!rawSettings.chatbot_widget_enabled : false,
    };

    res.json({ success: true, settings: publicSettings, tierState });
  } catch (error) {
    logger.error('Error fetching public chatbot options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch chatbot options settings' });
  }
});

// Get chatbot options capability state for a tenant
router.get('/:tenantId/chatbot-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps) {
      return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to resolve capabilities' });
    }
    const state = caps.effective.chatbot;
    res.json({ success: true, capability: state });
  } catch (error) {
    logger.error('Error resolving chatbot options capability:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to resolve chatbot options capability' });
  }
});

export default router;
