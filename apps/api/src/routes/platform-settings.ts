import { Router } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { StorageBuckets } from '../storage-config';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const router = Router();

// Supabase client for file uploads
const SUPABASE_URL = unifiedConfig.supabaseUrl;
const SUPABASE_SERVICE_ROLE_KEY = unifiedConfig.supabaseServiceRoleKey;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const platform_settings_listSchema = z.object({
  platformName: z.string().optional(),
  platformDescription: z.string().optional(),
  // Theme settings
  themePreset: z.string().optional(),
  themeColors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    neutral: z.string()
  }).optional(),
  themeFontFamily: z.string().optional(),
  themeBorderRadius: z.string().optional(),
  themeButtonSize: z.string().optional(),
  themeSpacing: z.number().optional(),
});

// GET /platform-settings - Get platform branding settings
router.get('/platform-settings', async (_req, res) => {
  try {
    // Check if Prisma client is properly initialized
    if (!prisma || !prisma.platform_settings_list) {
      console.warn('[Platform Settings] Prisma client not properly initialized, using defaults');
      return res.json({
        id: 1,
        platformName: 'Visible Shelf',
        platformDescription: 'Retail visibility platform empowering local businesses with AI-powered inventory management, automated product enrichment, Google Business Profile sync, customizable digital storefronts, and a public directory connecting customers to local merchants—all designed to increase discoverability and drive sales.',
        logoUrl: null,
        faviconUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    let settings = await prisma.platform_settings_list.findUnique({
      where: { id: 1 },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.platform_settings_list.create({
        data: {
          id: 1, 
          platform_name: 'Visible Shelf',
          platform_description: 'Retail visibility platform empowering local businesses with AI-powered inventory management, automated product enrichment, Google Business Profile sync, customizable digital storefronts, and a public directory connecting customers to local merchants—all designed to increase discoverability and drive sales.',
          updated_at: new Date(),
        },
      });
    }

    // Map snake_case database fields to camelCase for frontend
    const publicBranding = {
      platformName: settings.platform_name,
      platformDescription: settings.platform_description,
      logoUrl: settings.logo_url,
      faviconUrl: settings.favicon_url,
      bannerUrl: settings.banner_url,
      themePreset: settings.theme_preset,
      themeColors: settings.theme_colors,
      themeFontFamily: settings.theme_font_family,
      themeBorderRadius: settings.theme_border_radius,
      themeButtonSize: settings.theme_button_size,
      themeSpacing: settings.theme_spacing,
      // Contact information
      contactEmail: settings.contact_email,
      contactPhone: settings.contact_phone,
      contactAddress: settings.contact_address,
      contactWebsite: settings.contact_website,
      // Social media
      socialFacebook: settings.social_facebook,
      socialTwitter: settings.social_twitter,
      socialInstagram: settings.social_instagram,
      socialLinkedIn: settings.social_linkedin,
      socialYoutube: settings.social_youtube,
    };

    // Features
    const features = {
      rateLimitingEnabled: settings.rate_limiting_enabled ?? true,
    };

    const mappedSettings = {
      ...publicBranding,
      ...features,
      createdAt: settings.created_at?.toISOString(),
      updatedAt: settings.updated_at?.toISOString(),
    };

    res.json(mappedSettings);
  } catch (error) {
    logger.error('Error fetching platform settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_fetch_settings' });
  }
});

// POST /platform-settings - Update platform branding settings
router.post(
  '/platform-settings',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]),
  async (req: any, res) => {
    try {
      // Pre-process form data - parse JSON strings and numbers from multipart form
      const processedBody = { ...req.body };
      if (typeof processedBody.themeColors === 'string') {
        try {
          processedBody.themeColors = JSON.parse(processedBody.themeColors);
        } catch {
          // Keep as-is, validation will fail
        }
      }
      if (typeof processedBody.themeSpacing === 'string') {
        const parsed = parseInt(processedBody.themeSpacing, 10);
        if (!isNaN(parsed)) {
          processedBody.themeSpacing = parsed;
        }
      }

      const parsed = platform_settings_listSchema.safeParse(processedBody);
      if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      }

      const updateData: any = {};

      // Map camelCase to snake_case for database compatibility
      if (parsed.data.platformName !== undefined) {
        updateData.platform_name = parsed.data.platformName;
      }
      if (parsed.data.platformDescription !== undefined) {
        updateData.platform_description = parsed.data.platformDescription;
      }

      // Theme settings mapping
      if (parsed.data.themePreset !== undefined) {
        updateData.theme_preset = parsed.data.themePreset;
      }
      if (parsed.data.themeColors !== undefined) {
        updateData.theme_colors = parsed.data.themeColors;
      }
      if (parsed.data.themeFontFamily !== undefined) {
        updateData.theme_font_family = parsed.data.themeFontFamily;
      }
      if (parsed.data.themeBorderRadius !== undefined) {
        updateData.theme_border_radius = parsed.data.themeBorderRadius;
      }
      if (parsed.data.themeButtonSize !== undefined) {
        updateData.theme_button_size = parsed.data.themeButtonSize;
      }
      if (parsed.data.themeSpacing !== undefined) {
        updateData.theme_spacing = parsed.data.themeSpacing;
      }

      // Features mapping - handle features separately since not in schema
      if (req.body.features?.rateLimitingEnabled !== undefined) {
        updateData.rate_limiting_enabled = req.body.features.rateLimitingEnabled;
      }

      // Handle logo upload (skip if Supabase not configured)
      if (req.files?.logo?.[0]) {
        const logoFile = req.files.logo[0];
        if (supabase) {
          const pathKey = `platform/logo-${Date.now()}.${logoFile.originalname.split('.').pop()}`;
          const { error, data } = await supabase.storage
            .from(StorageBuckets.BRANDS.name)
            .upload(pathKey, logoFile.buffer, {
              cacheControl: '3600',
              upsert: false,
              contentType: logoFile.mimetype,
            });

          if (error) {
            logger.error('Logo upload error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
            return res.status(500).json({ error: 'logo_upload_failed' });
          }

          updateData.logo_url = supabase.storage.from(StorageBuckets.BRANDS.name).getPublicUrl(data.path).data.publicUrl;
        } else {
          console.warn('Supabase not configured, skipping logo upload');
          updateData.logo_url = 'https://via.placeholder.com/150x50?text=Logo';
        }
      }

      // Handle favicon upload (skip if Supabase not configured)
      if (req.files?.favicon?.[0]) {
        const faviconFile = req.files.favicon[0];
        if (supabase) {
          const pathKey = `platform/favicon-${Date.now()}.${faviconFile.originalname.split('.').pop()}`;
          const { error, data } = await supabase.storage
            .from(StorageBuckets.BRANDS.name)
            .upload(pathKey, faviconFile.buffer, {
              cacheControl: '3600',
              upsert: false,
              contentType: faviconFile.mimetype,
            });

          if (error) {
            logger.error('Favicon upload error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
            return res.status(500).json({ error: 'favicon_upload_failed' });
          }

          updateData.favicon_url = supabase.storage.from(StorageBuckets.BRANDS.name).getPublicUrl(data.path).data.publicUrl;
        } else {
          console.warn('Supabase not configured, skipping favicon upload');
          updateData.favicon_url = 'https://via.placeholder.com/32x32?text=Favicon';
        }
      }

      // Handle banner upload
      if (req.files?.banner?.[0]) {
        const bannerFile = req.files.banner[0];
        if (supabase) {
          const pathKey = `platform/banner-${Date.now()}.${bannerFile.originalname.split('.').pop()}`;
          const { error, data } = await supabase.storage
            .from(StorageBuckets.BRANDS.name)
            .upload(pathKey, bannerFile.buffer, {
              cacheControl: '3600',
              upsert: false,
              contentType: bannerFile.mimetype,
            });

          if (error) {
            logger.error('Banner upload error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
            return res.status(500).json({ error: 'banner_upload_failed' });
          }

          updateData.banner_url = supabase.storage.from(StorageBuckets.BRANDS.name).getPublicUrl(data.path).data.publicUrl;
        } else {
          console.warn('Supabase not configured, skipping banner upload');
          updateData.banner_url = 'https://via.placeholder.com/1200x400?text=Banner';
        }
      }

      // Handle contact information
      if (req.body.contactEmail !== undefined) {
        updateData.contact_email = req.body.contactEmail;
      }
      if (req.body.contactPhone !== undefined) {
        updateData.contact_phone = req.body.contactPhone;
      }
      if (req.body.contactAddress !== undefined) {
        updateData.contact_address = req.body.contactAddress;
      }
      if (req.body.contactWebsite !== undefined) {
        updateData.contact_website = req.body.contactWebsite;
      }

      // Handle social media
      if (req.body.socialFacebook !== undefined) {
        updateData.social_facebook = req.body.socialFacebook;
      }
      if (req.body.socialTwitter !== undefined) {
        updateData.social_twitter = req.body.socialTwitter;
      }
      if (req.body.socialInstagram !== undefined) {
        updateData.social_instagram = req.body.socialInstagram;
      }
      if (req.body.socialLinkedIn !== undefined) {
        updateData.social_linkedin = req.body.socialLinkedIn;
      }
      if (req.body.socialYoutube !== undefined) {
        updateData.social_youtube = req.body.socialYoutube;
      }

      // Handle banner URL from form data
      if (req.body.bannerUrl !== undefined) {
        updateData.banner_url = req.body.bannerUrl;
      }

      // Update or create settings
      const settings = await prisma.platform_settings_list.upsert({
        where: { id: 1 },
        update: updateData,
        create: {
          id: 1,
          platform_name: updateData.platform_name || 'Visible Shelf',
          platform_description: updateData.platform_description || 'Manage your retail operations with ease',
          logo_url: updateData.logo_url,
          favicon_url: updateData.favicon_url,
          banner_url: updateData.banner_url,
          contact_email: updateData.contact_email,
          contact_phone: updateData.contact_phone,
          contact_address: updateData.contact_address,
          contact_website: updateData.contact_website,
          social_facebook: updateData.social_facebook,
          social_twitter: updateData.social_twitter,
          social_instagram: updateData.social_instagram,
          social_linkedin: updateData.social_linkedin,
          social_youtube: updateData.social_youtube,
          updated_at: new Date(),
        },
      });

      // Map snake_case database fields to camelCase for frontend
      const mappedSettings = {
        id: settings.id,
        platformName: settings.platform_name,
        platformDescription: settings.platform_description,
        logoUrl: settings.logo_url,
        faviconUrl: settings.favicon_url,
        bannerUrl: settings.banner_url,
        themePreset: settings.theme_preset,
        themeColors: settings.theme_colors,
        themeFontFamily: settings.theme_font_family,
        themeBorderRadius: settings.theme_border_radius,
        themeButtonSize: settings.theme_button_size,
        themeSpacing: settings.theme_spacing,
        // Contact information
        contactEmail: settings.contact_email,
        contactPhone: settings.contact_phone,
        contactAddress: settings.contact_address,
        contactWebsite: settings.contact_website,
        // Social media
        socialFacebook: settings.social_facebook,
        socialTwitter: settings.social_twitter,
        socialInstagram: settings.social_instagram,
        socialLinkedIn: settings.social_linkedin,
        socialYoutube: settings.social_youtube,
        features: {
          rateLimitingEnabled: settings.rate_limiting_enabled ?? true,
        },
        createdAt: settings.created_at?.toISOString(),
        updatedAt: settings.updated_at?.toISOString(),
      };

      res.json(mappedSettings);
    } catch (error) {
      logger.error('Error updating platform settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({ error: 'failed_to_update_settings' });
    }
  }
);

export default router;
