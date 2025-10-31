import { Router } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { StorageBuckets } from '../storage-config';

const router = Router();

// Supabase client for file uploads
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const platformSettingsSchema = z.object({
  platformName: z.string().optional(),
  platformDescription: z.string().optional(),
});

// GET /platform-settings - Get platform branding settings
router.get('/platform-settings', async (_req, res) => {
  try {
    let settings = await prisma.platformSettings.findUnique({
      where: { id: 1 },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          id: 1,
          platformName: 'Visible Shelf',
          platformDescription: 'Manage your retail operations with ease',
        },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    res.status(500).json({ error: 'failed_to_fetch_settings' });
  }
});

// POST /platform-settings - Update platform branding settings
router.post(
  '/platform-settings',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
  ]),
  async (req: any, res) => {
    try {
      const parsed = platformSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      }

      const updateData: any = {
        ...parsed.data,
      };

      // Handle logo upload
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
            console.error('Logo upload error:', error);
            return res.status(500).json({ error: 'logo_upload_failed' });
          }

          updateData.logoUrl = supabase.storage.from(StorageBuckets.BRANDS.name).getPublicUrl(data.path).data.publicUrl;
        } else {
          return res.status(500).json({ error: 'storage_not_configured' });
        }
      }

      // Handle favicon upload
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
            console.error('Favicon upload error:', error);
            return res.status(500).json({ error: 'favicon_upload_failed' });
          }

          updateData.faviconUrl = supabase.storage.from(StorageBuckets.BRANDS.name).getPublicUrl(data.path).data.publicUrl;
        } else {
          return res.status(500).json({ error: 'storage_not_configured' });
        }
      }

      // Update or create settings
      const settings = await prisma.platformSettings.upsert({
        where: { id: 1 },
        update: updateData,
        create: {
          id: 1,
          platformName: updateData.platformName || 'Visible Shelf',
          platformDescription: updateData.platformDescription || 'Manage your retail operations with ease',
          logoUrl: updateData.logoUrl,
          faviconUrl: updateData.faviconUrl,
        },
      });

      res.json(settings);
    } catch (error) {
      console.error('Error updating platform settings:', error);
      res.status(500).json({ error: 'failed_to_update_settings' });
    }
  }
);

export default router;
