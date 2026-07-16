import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { prisma, basePrisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { StorageBuckets } from '../storage-config';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const DEV = unifiedConfig.isDevelopment;
const router = Router();

// Re-declare tenantProfileSchema for PATCH (same as inline-tenant-profile.ts)
const tenantProfileSchema = z.object({
  tenant_id: z.string().min(1),
  business_name: z.string().min(1).optional(),
  slug: z.string().optional().nullable().transform(v => v || undefined),
  business_description: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  contact_person: z.string().optional(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  display_map: z.boolean().optional(),
  map_privacy_mode: z.enum(["precise", "neighborhood"]).optional(),
  gbp_category_id: z.string().nullable().optional(),
  gbp_category_name: z.string().nullable().optional(),
  gbp_category_last_mirrored: z.string().datetime().nullable().optional(),
  gbp_category_sync_status: z.string().nullable().optional(),
});

router.get("/api/public/features-showcase-config", async (req, res) => {
  try {
    // Return default config for now (can be extended to read from database later)
    const defaultConfig = {
      mode: 'random',
      rotationEnabled: true,
      rotationInterval: 24,
      enabledModes: ['hybrid', 'random', 'tabs', 'grid', 'slider', 'fixed']
    };
    return res.json(defaultConfig);
  } catch (e: any) {
    logger.error("[GET /api/public/features-showcase-config] Error:", undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "failed_to_get_config" });
  }
});

// PATCH /api/tenant/profile - partial update
const tenantProfileUpdateSchema = tenantProfileSchema.partial().extend({ tenant_id: z.string().min(1) });
router.patch("/api/tenant/profile", authenticateToken, async (req, res) => {
  console.log('[PATCH /tenant/profile] Request body:', JSON.stringify(req.body, null, 2));
  const parsed = tenantProfileUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  console.log('[PATCH /tenant/profile] Parsed data:', JSON.stringify(parsed.data, null, 2));
  try {
    const { tenant_id, ...delta } = parsed.data;
    const existingTenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!existingTenant) return res.status(400).json({ error: "tenant_not_found" });

    // Use raw SQL instead of Prisma client since it doesn't recognize the new table
    // Import basePrisma to bypass retry wrapper
    const { basePrisma } = await import('../prisma');
    console.log(`[PATCH /tenant/profile] Processing update for tenant ${tenant_id}`);
    console.log(`[PATCH /tenant/profile] Delta data:`, delta);

    // Check if profile exists
    const existingProfiles = await basePrisma.$queryRaw`
      SELECT tenant_id FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
    `;
    console.log(`[PATCH /tenant/profile] Existing profiles found:`, (existingProfiles as any[]).length);
    let result;
    if ((existingProfiles as any[]).length > 0) {
      console.log(`[PATCH /tenant/profile] Updating existing profile`);
      // Update existing profile - build dynamic update query
      const updateParts = [];
      const values = [];

      Object.entries(delta).forEach(([key, value]) => {
        // Skip slug - it's stored in directory_settings_list, not tenant_business_profiles_list
        if (key === 'slug') return;
        if (value !== undefined) {
          updateParts.push(`"${key}" = $${values.length + 1}`);
          values.push(value === '' ? null : value);
        }
      });

      if (updateParts.length > 0) {
        updateParts.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(tenant_id); // Add tenant_id at the end
        const updateQuery = `
          UPDATE "tenant_business_profiles_list"
          SET ${updateParts.join(', ')}
          WHERE tenant_id = $${values.length}
        `;
        console.log(`[PATCH /tenant/profile] Update query:`, updateQuery);
        console.log(`[PATCH /tenant/profile] Update values:`, values);
        await basePrisma.$executeRawUnsafe(updateQuery, ...values);
        console.log(`[PATCH /tenant/profile] Update executed successfully`);
      }

      // Get updated profile (exclude geography column to avoid Prisma deserialization error)
      result = await basePrisma.$queryRaw`
        SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, gbp_category_id, gbp_category_name, gbp_category_last_mirrored, gbp_category_sync_status, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
      `;
      console.log(`[PATCH /tenant/profile] Retrieved updated profile:`, result);
    } else {
      console.log(`[PATCH /tenant/profile] Creating new profile`);
      // Create new profile
      const insertFields = ['tenant_id', 'business_name', 'address_line1', 'city', 'postal_code', 'country_code'];
      const insertValues = [
        tenant_id,
        delta.business_name || existingTenant.name,
        delta.address_line1 || '',
        delta.city || '',
        delta.postal_code || '',
        (delta.country_code || 'US').toUpperCase()
      ];

      // Add optional fields
      const optionalMappings = {
        address_line2: delta.address_line2,
        state: delta.state,
        phone_number: delta.phone_number,
        email: delta.email,
        website: delta.website,
        contact_person: delta.contact_person,
        logo_url: delta.logo_url,
        banner_url: delta.banner_url,
        business_description: delta.business_description,
      };

      Object.entries(optionalMappings).forEach(([field, value]) => {
        if (value !== undefined) {
          insertFields.push(field);
          insertValues.push(value === '' ? null : (value as any));
        }
      });

      // Always add updated_at field with current timestamp
      insertFields.push('updated_at');
      insertValues.push(new Date().toISOString());

      const placeholders = insertFields.map((_, i) => `$${i + 1}`);
      const insertQuery = `
        INSERT INTO "tenant_business_profiles_list" (${insertFields.map(f => `"${f}"`).join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      console.log(`[PATCH /tenant/profile] Insert query:`, insertQuery);
      console.log(`[PATCH /tenant/profile] Insert values:`, insertValues);

      result = await basePrisma.$executeRawUnsafe(insertQuery, ...insertValues).then(() =>
        basePrisma.$queryRaw`SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, gbp_category_id, gbp_category_name, gbp_category_last_mirrored, gbp_category_sync_status, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}`
      );
      console.log(`[PATCH /tenant/profile] Created new profile:`, result);
    }

    // Update tenant name if business_name changed
    if (delta.business_name && typeof delta.business_name === 'string' && delta.business_name.trim()) {
      await prisma.tenants.update({ where: { id: tenant_id }, data: { name: delta.business_name } });
    }

    // Update slug in directory_settings_list if explicitly provided
    if ((delta as any).slug) {
      console.log('[PATCH /tenant/profile] Updating slug to:', (delta as any).slug);
      try {
        const slugSingletonService = (await import('../services/SlugSingletonService')).default;
        await slugSingletonService.updateSlug(tenant_id, (delta as any).slug);
        console.log('[PATCH /tenant/profile] Slug updated successfully');
      } catch (slugError) {
        logger.error('[PATCH /tenant/profile] Failed to update slug:', undefined, { error: { name: (slugError as any)?.name || 'Error', message: (slugError as any)?.message || String(slugError), stack: (slugError as any)?.stack } });
        // Don't fail the entire request if slug update fails
      }
    } else if (delta.business_name) {
      // Auto-regenerate slug when business name changes (only if slug not explicitly provided)
      try {
        const slugSingletonService = (await import('../services/SlugSingletonService')).default;
        await slugSingletonService.regenerateSlugFromBusinessName(tenant_id, false);
        console.log('[PATCH /tenant/profile] Slug regenerated from new business name');
      } catch (slugError) {
        console.warn('[PATCH /tenant/profile] Failed to regenerate slug:', slugError);
        // Don't fail the entire request if slug regeneration fails
      }
    }

    // Handle logo_url clearing from tenant metadata
    if ('logo_url' in delta && delta.logo_url === '') {
      const currentMetadata = (existingTenant.metadata as any) || {};
      if (currentMetadata.logo_url) {
        delete currentMetadata.logo_url;
        await prisma.tenants.update({
          where: { id: tenant_id },
          data: { metadata: currentMetadata }
        });
      }
    }

    console.log(`[PATCH /tenant/profile] Final result to return:`, (result as any)[0] || result);

    // Fetch current slug to include in response
    const slugResult = await basePrisma.$queryRaw`
      SELECT slug FROM "directory_settings_list" WHERE tenant_id = ${tenant_id}
    `;
    const currentSlug = (slugResult as any[])[0]?.slug || null;

    const responseProfile = {
      ...((result as any)[0] || result),
      slug: currentSlug,
    };

    return res.json(responseProfile);
  } catch (e: any) {
    logger.error("[PATCH /tenant/profile] Error:", undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "failed_to_update_profile" });
  }
});

// Tenant logo upload endpoint (must be defined before multer middleware below)
const logoUploadMulter = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit for logos

const logoDataUrlSchema = z.object({
  tenant_id: z.string().min(1),
  dataUrl: z.string().min(1),
  contentType: z.string().min(1),
});

router.post("/api/tenants/:id/logo", logoUploadMulter.single("file"), async (req, res) => {
  try {
    const tenant_id = req.params.id;
    console.log(`[Logo Upload] Starting upload for tenant ${tenant_id}`, {
      hasFile: !!req.file,
      contentType: req.get('content-type'),
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id as string } });
    if (!tenant) {
      console.log(`[Logo Upload] Tenant not found: ${tenant_id}`);
      return res.status(400).json({ error: "tenant_not_found" });
    }

    // Initialize Supabase client (will be initialized below in photos section)
    const SUPABASE_URL = unifiedConfig.supabaseUrl;
    const SUPABASE_SERVICE_ROLE_KEY = unifiedConfig.supabaseServiceRoleKey;
    const supabaseLogo = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    if (!supabaseLogo) {
      return res.status(500).json({ error: "supabase_not_configured" });
    }

    let publicUrl: string;
    const TENANT_BUCKET = StorageBuckets.TENANTS;

    // A) multipart/form-data "file" upload
    if (req.file) {
      const f = req.file as any;
      const ext = f.mimetype.includes("png") ? ".png" : f.mimetype.includes("webp") ? ".webp" : ".jpg";
      const pathKey = `tenants/${tenant_id}/logo-${Date.now()}${ext}`;

      console.log(`[Logo Upload] Uploading to Supabase:`, {
        bucket: TENANT_BUCKET.name,
        pathKey,
        size: f.size,
        mimetype: f.mimetype
      });

      const { error, data } = await supabaseLogo.storage
        .from(TENANT_BUCKET.name)
        .upload(pathKey, f.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.mimetype || "application/octet-stream",
        });

      if (error) {
        logger.error(`[Logo Upload] Supabase upload error:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        return res.status(500).json({ error: error.message, details: error });
      }

      publicUrl = supabaseLogo.storage.from(TENANT_BUCKET.name).getPublicUrl(data.path).data.publicUrl;
      console.log(`[Logo Upload] Supabase upload successful:`, { publicUrl });
    }
    // B) JSON { url } upload
    else if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.dataUrl === "string") {
      const parsed = logoDataUrlSchema.safeParse(req.body || {});
      if (!parsed.success) {
        logger.error(`[Logo Upload] Invalid dataUrl payload:`, undefined, { error: { name: 'Error', message: String(parsed.error.flatten()) } });
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      }

      const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
      if (!match) return res.status(400).json({ error: "invalid_data_url" });

      const buf = Buffer.from(match[1], "base64");

      // Enforce 5MB limit for logos
      if (buf.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: "logo_too_large", maxSizeMB: 5 });
      }

      const ext = parsed.data.contentType.includes("png")
        ? ".png"
        : parsed.data.contentType.includes("webp")
          ? ".webp"
          : ".jpg";

      const pathKey = `tenants/${tenant_id}/logo-${Date.now()}${ext}`;
      console.log(`[Logo Upload] Uploading dataUrl to Supabase:`, {
        bucket: TENANT_BUCKET.name,
        pathKey,
        size: buf.length,
        contentType: parsed.data.contentType
      });

      const { error, data } = await supabaseLogo.storage
        .from(TENANT_BUCKET.name)
        .upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });

      if (error) {
        logger.error("[Logo Upload] Supabase dataUrl upload error:", undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
      }

      publicUrl = supabaseLogo.storage.from(TENANT_BUCKET.name).getPublicUrl(data.path).data.publicUrl;
      console.log(`[Logo Upload] Supabase dataUrl upload successful:`, { publicUrl });
    } else {
      return res.status(400).json({ error: "unsupported_payload" });
    }

    // Update tenant metadata with logo URL
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenant_id as string },
      data: {
        metadata: {
          ...(tenant.metadata as any || {}),
          logo_url: publicUrl,
        },
      },
    });

    // Also update business profile logo_url for directory listings (if profile exists)
    try {
      await prisma.tenant_business_profiles_list.update({
        where: { tenant_id: tenant_id as string },
        data: { logo_url: publicUrl },
      });
    } catch (profileError: any) {
      // Business profile doesn't exist yet, skip updating it
      // It will be created with logo during directory publish
      console.log(`[Logo Upload] Business profile not found for tenant ${tenant_id}, logo will be set during directory publish`);
    }

    return res.status(200).json({ url: publicUrl, tenant: updatedTenant });
  } catch (e: any) {
    console.error("[Logo Upload Error] Full error details:", {
      message: (e as any)?.message,
      stack: (e as any)?.stack,
      tenant_id: req.params.id,
    });
    return res.status(500).json({
      error: "failed_to_upload_logo",
      details: DEV ? (e as any)?.message : undefined
    });
  }
});

// Banner upload endpoint (similar to logo but for wide banners)
router.post("/api/tenant/:id/banner", logoUploadMulter.single("file"), async (req, res) => {
  try {
    const tenant_id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    console.log(`[Banner Upload] Starting upload for tenant ${tenant_id}`);

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(400).json({ error: "tenant_not_found" });
    }

    const SUPABASE_URL = unifiedConfig.supabaseUrl;
    const SUPABASE_SERVICE_ROLE_KEY = unifiedConfig.supabaseServiceRoleKey;
    const supabaseBanner = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    if (!supabaseBanner) {
      return res.status(500).json({ error: "supabase_not_configured" });
    }

    let publicUrl: string;
    const TENANT_BUCKET = StorageBuckets.TENANTS;

    // JSON dataUrl upload (frontend sends compressed base64)
    if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.dataUrl === "string") {
      const parsed = logoDataUrlSchema.safeParse(req.body || {});
      if (!parsed.success) {
        logger.error(`[Banner Upload] Invalid dataUrl payload:`, undefined, { error: { name: 'Error', message: String(parsed.error.flatten()) } });
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      }

      const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
      if (!match) return res.status(400).json({ error: "invalid_data_url" });

      const buf = Buffer.from(match[1], "base64");

      // Enforce 5MB limit for banners
      if (buf.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: "banner_too_large", maxSizeMB: 5 });
      }

      const ext = parsed.data.contentType.includes("png")
        ? ".png"
        : parsed.data.contentType.includes("webp")
          ? ".webp"
          : ".jpg";

      const pathKey = `tenants/${tenant_id}/banner-${Date.now()}${ext}`;
      console.log(`[Banner Upload] Uploading dataUrl to Supabase:`, {
        bucket: TENANT_BUCKET.name,
        pathKey,
        size: buf.length
      });

      const { error, data } = await supabaseBanner.storage
        .from(TENANT_BUCKET.name)
        .upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });

      if (error) {
        logger.error("[Banner Upload] Supabase upload error:", undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
      }

      publicUrl = supabaseBanner.storage.from(TENANT_BUCKET.name).getPublicUrl(data.path).data.publicUrl;
      console.log(`[Banner Upload] Supabase upload successful:`, { publicUrl });
    } else {
      return res.status(400).json({ error: "unsupported_payload" });
    }

    // Update tenant metadata with banner URL
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenant_id },
      data: {
        metadata: {
          ...(tenant.metadata as any || {}),
          banner_url: publicUrl,
        },
      },
    });

    return res.status(200).json({ url: publicUrl, tenant: updatedTenant });
  } catch (e: any) {
    logger.error("[Banner Upload Error]:", undefined, { error: { name: 'Error', message: String((e as any)?.message) } });
    return res.status(500).json({
      error: "failed_to_upload_banner",
      details: DEV ? (e as any)?.message : undefined
    });
  }
});

export default router;