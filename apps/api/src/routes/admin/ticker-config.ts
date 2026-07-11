/**
 * Ticker Configuration API Routes
 * 
 * Provides endpoints for managing platform-wide ticker configuration
 * and messages for administrators
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { prisma } from '../../prisma';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

// GET /api/admin/ticker-config - Get ticker configuration
router.get('/', async (req: Request, res: Response) => {
  /* console.log('[ADMIN TICKER CONFIG GET] Request received at:', new Date().toISOString());
  console.log('[ADMIN TICKER CONFIG GET] Headers:', {
    authorization: req.headers.authorization ? 'present' : 'missing',
    'user-agent': req.headers['user-agent'],
    'content-type': req.headers['content-type'],
    'x-requested-with': req.headers['x-requested-with']
  });
  console.log('[ADMIN TICKER CONFIG GET] User:', req.user ? { id: req.user.userId, email: req.user.email } : 'no user');
 */
  try {
    // Get ticker configuration from database
    const config = await prisma.ticker_configs.findFirst({
      orderBy: { created_at: 'desc' }
    });

    // Get active messages from database
    const messages = await prisma.ticker_messages.findMany({
      where: { is_active: true },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ]
    });

   // console.log('[ADMIN TICKER CONFIG GET] Database config:', config);
   // console.log('[ADMIN TICKER CONFIG GET] Database messages:', messages);

    if (!config) {
      // Return default configuration if none exists
      const defaultConfig = {
        enabled: true,
        messages: messages.map(msg => ({
          id: msg.id,
          message: msg.message,
          type: msg.type,
          icon: msg.icon,
          scrolling: msg.is_scrolling,
          dismissible: msg.is_dismissible,
          targetAudience: msg.target_audience,
          targetTiers: msg.target_tiers || [],
          targetTenants: msg.target_tenants || [],
          startDate: msg.start_date,
          endDate: msg.end_date,
          priority: msg.priority,
          isActive: msg.is_active,
          createdBy: msg.created_by,
          createdAt: msg.created_at,
          updatedAt: msg.updated_at
        })),
        globalSettings: {
          maxMessages: 3,
          autoRotate: true,
          rotationInterval: 5,
          showDismissButton: true
        }
      };
      //console.log('[ADMIN TICKER CONFIG GET] Returning default config with messages:', defaultConfig);
      return res.json({
        success: true,
        data: defaultConfig
      });
    }

    const responseData = {
      enabled: config.is_enabled,
      messages: messages.map(msg => ({
        id: msg.id,
        message: msg.message,
        type: msg.type,
        icon: msg.icon,
        scrolling: msg.is_scrolling,
        dismissible: msg.is_dismissible,
        targetAudience: msg.target_audience,
        targetTiers: msg.target_tiers || [],
        targetTenants: msg.target_tenants || [],
        startDate: msg.start_date,
        endDate: msg.end_date,
        priority: msg.priority,
        isActive: msg.is_active,
        createdBy: msg.created_by,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at
      })),
      globalSettings: {
        maxMessages: config.max_messages,
        autoRotate: config.is_auto_rotate,
        rotationInterval: config.rotation_interval,
        showDismissButton: true // Default to true since field doesn't exist in DB
      }
    };

   // console.log('[ADMIN TICKER CONFIG GET] About to send response');
    return res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching ticker config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch ticker configuration',
      userMessage: 'Unable to load ticker settings'
    });
  }
});

// PUT /api/admin/ticker-config - Update ticker configuration
router.put('/', async (req: Request, res: Response) => {
  try {
    const { enabled, globalSettings } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
        userMessage: 'Invalid configuration data'
      });
    }

    if (!globalSettings || typeof globalSettings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'globalSettings is required',
        userMessage: 'Invalid configuration data'
      });
    }

    // Update or create configuration
    const config = await prisma.ticker_configs.upsert({
      where: { id: 'default-config' }, // Use fixed string ID for singleton config
      update: {
        is_enabled: enabled,
        max_messages: globalSettings.maxMessages || 3,
        is_auto_rotate: globalSettings.autoRotate !== false,
        rotation_interval: globalSettings.rotationInterval || 5,
        updated_at: new Date()
      },
      create: {
        is_enabled: enabled,
        max_messages: globalSettings.maxMessages || 3,
        is_auto_rotate: globalSettings.autoRotate !== false,
        rotation_interval: globalSettings.rotationInterval || 5,
        created_by: req.user?.id || 'system'
      }
    });

    return res.json({
      success: true,
      data: {
        enabled: config.is_enabled,
        globalSettings: {
          maxMessages: config.max_messages,
          autoRotate: config.is_auto_rotate,
          rotationInterval: config.rotation_interval,
          showDismissButton: true // Default to true since field doesn't exist in DB
        }
      },
      userMessage: 'Ticker configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticker config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update ticker configuration',
      userMessage: 'Unable to save ticker settings'
    });
  }
});

/**
 * PUT /api/admin/ticker-config/settings
 * Update global ticker settings
 * Permission: Platform admin only
 */
router.put('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    /* console.log('[ADMIN TICKER CONFIG SETTINGS] Request received from platform admin');
    console.log('[ADMIN TICKER CONFIG SETTINGS] Request body:', req.body); */

    const settings = req.body;

    // Validate settings
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Settings object is required',
        userMessage: 'Invalid settings provided'
      });
    }

    // Get or create ticker config
    let config = await prisma.ticker_configs.findFirst();
  //  console.log('[ADMIN TICKER CONFIG SETTINGS] Existing config:', config);
    
    if (!config) {
      // Create new config if none exists
      console.log('[ADMIN TICKER CONFIG SETTINGS] Creating new config with enabled:', settings.enabled);
      config = await prisma.ticker_configs.create({
        data: {
          is_enabled: settings.enabled !== undefined ? settings.enabled : true,
          max_messages: settings.maxMessages || 3,
          is_auto_rotate: settings.autoRotate !== false,
          rotation_interval: settings.rotationInterval || 5,
          created_by: req.user?.id || 'system'
        }
      });
     // console.log('[ADMIN TICKER CONFIG SETTINGS] Created config:', config);
    } else {
      // Update existing config
   //   console.log('[ADMIN TICKER CONFIG SETTINGS] Updating existing config, current enabled:', config.is_enabled, 'new enabled:', settings.enabled);
      config = await prisma.ticker_configs.update({
        where: { id: config.id },
        data: {
          is_enabled: settings.enabled !== undefined ? settings.enabled : config.is_enabled,
          max_messages: settings.maxMessages !== undefined ? settings.maxMessages : config.max_messages,
          is_auto_rotate: settings.autoRotate !== undefined ? settings.autoRotate : config.is_auto_rotate,
          rotation_interval: settings.rotationInterval !== undefined ? settings.rotationInterval : config.rotation_interval
        }
      });
 //     console.log('[ADMIN TICKER CONFIG SETTINGS] Updated config:', config);
    }

    // Return updated config
    return res.json({
      success: true,
      data: {
        id: config.id,
        enabled: config.is_enabled,
        globalSettings: {
          maxMessages: config.max_messages,
          autoRotate: config.is_auto_rotate,
          rotationInterval: config.rotation_interval,
          showDismissButton: true // Default to true since field doesn't exist in DB
        }
      },
      userMessage: 'Ticker settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticker settings:', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update ticker settings',
      userMessage: 'Unable to save ticker settings'
    });
  }
});

export default router;
