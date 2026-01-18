import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { basePrisma } from '../../prisma';
import { z } from 'zod';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Schema for rate limiting configuration
const rateLimitConfigSchema = z.object({
  route_type: z.string(),
  max_requests: z.number().min(1).max(10000),
  window_minutes: z.number().min(1).max(60),
  enabled: z.boolean(),
});

const platformSettingsSchema = z.object({
  rateLimitingEnabled: z.boolean().optional(),
  rateLimitConfigurations: z.array(rateLimitConfigSchema).optional(),
});

// GET / - Get admin platform settings (router mounted at /api/admin/platform-settings)
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get rate limiting configurations
    const rateLimitConfigs = await basePrisma.rate_limit_configurations.findMany({
      orderBy: { route_type: 'asc' }
    });

    // Get platform settings for rate limiting enabled flag
    const platformSettings = (await basePrisma.$queryRaw`
      SELECT 
        rate_limiting_enabled,
        updated_at as "updatedAt"
      FROM platform_settings_list
      WHERE id = 1
    `) as Array<{
      rate_limiting_enabled: boolean;
      updatedAt: string;
    }>;

    // Default settings if no configurations exist
    const defaultConfigs = [
      { route_type: 'auth', max_requests: 20, window_minutes: 1, enabled: true },
      { route_type: 'admin', max_requests: 20, window_minutes: 1, enabled: true },
      { route_type: 'strict', max_requests: 20, window_minutes: 1, enabled: true },
      { route_type: 'standard', max_requests: 100, window_minutes: 1, enabled: true },
      { route_type: 'exempt', max_requests: 1000, window_minutes: 1, enabled: false },
    ];

    const configs = rateLimitConfigs.length > 0 ? rateLimitConfigs : defaultConfigs;

    const settings = {
      rateLimitingEnabled: platformSettings[0]?.rate_limiting_enabled ?? true,
      updatedAt: platformSettings[0]?.updatedAt || new Date().toISOString(),
      updatedBy: req.user?.email || 'admin', // Use authenticated user instead of database field
      rateLimitConfigurations: configs,
    };

    res.json(settings);
  } catch (error) {
    console.error('[GET /api/admin/platform-settings] Error:', error);
    res.status(500).json({ error: 'Failed to fetch platform settings' });
  }
});

// PUT / - Update admin platform settings (router mounted at /api/admin/platform-settings)
router.put('/', async (req: Request, res: Response) => {
  try {
    // Parse the nested body field
    const requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = requestBody.body ? JSON.parse(requestBody.body) : requestBody;
    
    const parsed = platformSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_payload', 
        details: parsed.error.flatten() 
      });
    }

    const { rateLimitingEnabled, rateLimitConfigurations } = parsed.data;

    // Update rate limiting configurations if provided
    if (rateLimitConfigurations && rateLimitConfigurations.length > 0) {
      // Update rate limiting configurations
      for (const config of rateLimitConfigurations) {
        await basePrisma.rate_limit_configurations.upsert({
          where: { route_type: config.route_type },
          update: {
            max_requests: config.max_requests,
            window_minutes: config.window_minutes,
            enabled: config.enabled,
          },
          create: {
            route_type: config.route_type,
            max_requests: config.max_requests,
            window_minutes: config.window_minutes,
            enabled: config.enabled,
          },
        });
      }
    }

    // Update rate limiting enabled flag in platform settings
    if (rateLimitingEnabled !== undefined) {
      await basePrisma.$executeRaw`
        UPDATE platform_settings_list 
        SET rate_limiting_enabled = ${rateLimitingEnabled}
        WHERE id = 1
      `;
    }

    // Get updated settings to return
    const platformSettings = (await basePrisma.$queryRaw`
      SELECT 
        rate_limiting_enabled,
        updated_at as "updatedAt"
      FROM platform_settings_list
      WHERE id = 1
    `) as Array<{
      rate_limiting_enabled: boolean;
      updatedAt: string;
    }>;

    const updatedSettings = {
      rateLimitingEnabled: platformSettings[0]?.rate_limiting_enabled ?? true,
      updatedAt: platformSettings[0]?.updatedAt || new Date().toISOString(),
      updatedBy: req.user?.email || 'admin',
      rateLimitConfigurations: rateLimitConfigurations || [],
    };

    res.json(updatedSettings);
  } catch (error) {
    console.error('[PUT /api/admin/platform-settings] Error:', error);
    res.status(500).json({ error: 'Failed to update platform settings' });
  }
});

export default router;
