import { Router, Request, Response } from "express";
import multer from "multer";
import { prisma } from "./prisma";
import { createClient } from "@supabase/supabase-js";
import { StorageBuckets } from "./storage-config";
import { generateQuickStart } from "./lib/id-generator";

const prismaClient = prisma;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const r = Router();

// server-side supabase client (service role)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

/**
 * POST /items/:id/photos
 * Accepts EITHER:
 *  - multipart/form-data with field "file"
 *  - application/json with { url, width?, height?, bytes?, contentType?, exifRemoved?, alt?, caption? }
 *
 * Creates PhotoAsset linked to InventoryItem and returns the created asset.
 * Enforces max 11 photos per item (1 primary + 10 additional).
 */
r.post("/:id/photos", upload.single("file"), async (req, res) => {
  try {
    const itemId = req.params.id;

    // verify item exists & get tenant
    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: "item not found" });

    // Enforce 11-photo limit
    const existingCount = await prisma.photo_assets.count({ where: { inventoryItemId: item.id } }); 
    if (existingCount >= 11) {
      return res.status(400).json({ error: "maximum 11 photos per item" });
    }

    let url: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let bytes: number | undefined;
    let contentType: string | undefined;
    let exifRemoved = true;
    let alt: string | undefined;
    let caption: string | undefined;

    // Case A: multipart upload of a file
    if (req.file) {
      if (!supabase) {
        return res.status(500).json({ error: "server is not configured for direct uploads (missing SUPABASE envs)" });
      }
      const f = req.file; // buffer + mimetype + originalname
      const path = `${item.tenant_id}/${item.sku || item.id}/${Date.now()}-${(f.originalname || "photo").replace(/\s+/g, "_")}`;

      const { error, data } = await supabase.storage.from(StorageBuckets.PHOTOS.name).upload(path, f.buffer, {
        cacheControl: "3600",
        contentType: f.mimetype || "application/octet-stream",
        upsert: false,
      });
      if (error) return res.status(500).json({ error: error.message });

      const pub = supabase.storage.from(StorageBuckets.PHOTOS.name).getPublicUrl(data.path);
      url = pub.data.publicUrl;
      contentType = f.mimetype;
      bytes = f.size;
      // Extract alt/caption from form data if present
      alt = req.body.alt;
      caption = req.body.caption;
    }

    // Case B: JSON body with url or dataUrl + metadata
    if (!req.file && req.is("application/json")) {
      const body = req.body || {};
      
      // Handle dataUrl (base64 encoded image from client)
      if (body.dataUrl && supabase) {
        const dataUrl = body.dataUrl as string;
        const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!matches) {
          return res.status(400).json({ error: "invalid dataUrl format" });
        }
        
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const ext = mimeType.split('/')[1] || 'jpg';
        const filename = `${Date.now()}.${ext}`;
        const path = `${item.tenant_id}/${item.sku || item.id}/${filename}`;
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from(StorageBuckets.PHOTOS.name)
          .upload(path, buffer, {
            cacheControl: "3600",
            contentType: mimeType,
            upsert: false,
          });
        
        if (uploadError) {
          return res.status(500).json({ error: uploadError.message });
        }
        
        const pub = supabase.storage.from(StorageBuckets.PHOTOS.name).getPublicUrl(uploadData.path);
        url = pub.data.publicUrl;
        contentType = mimeType;
        bytes = buffer.length;
      } else {
        // Handle regular URL
        url = body.url;
      }
      
      width = body.width;
      height = body.height;
      bytes = bytes || body.bytes;
      contentType = contentType || body.contentType;
      exifRemoved = body.exifRemoved ?? true;
      alt = body.alt;
      caption = body.caption;
    }

    if (!url) return res.status(400).json({ error: "missing image; provide multipart 'file', JSON 'url', or JSON 'dataUrl'" });

    // Find next available position (max + 1, or 0 if first)
    const maxPos = await prisma.photo_assets.findFirst({
      where: { inventoryItemId: item.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = maxPos ? maxPos.position + 1 : 0;

    const created = await prisma.photo_assets.create({
      data: {
        id: generateQuickStart("pid"),
        tenantId: item.tenant_id,
        inventoryItemId: item.id,
        url,
        width: width ?? null,
        height: height ?? null,
        contentType: contentType ?? null,
        bytes: bytes ?? null,
        exifRemoved: exifRemoved,
        position: nextPosition,
        alt: alt ?? null,
        caption: caption ?? null,
      },
    });

    // Update item's image_url to primary photo (position 0)
    if (nextPosition === 0) {
      await prisma.inventory_items.update({ where: { id: item.id }, data: { image_url: url } });
    }

    return res.status(201).json(created);
  } catch (e: any) {
    console.error("photo upload error", e);
    return res.status(500).json({ error: e?.message || "upload failed" });
  }
});

/** GET /:id/photos — list photos for an item, ordered by position */
r.get('/:id/photos', async (req, res) => {
  const item = await prisma.inventory_items.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: "item not found" });

  const photos = await prisma.photo_assets.findMany({
    where: { inventoryItemId: item.id },
    orderBy: { position: "asc" },
  });
  res.json(photos);
});

/**
 * POST /items/:id/photos/migrate-legacy
 * Migrates a legacy imageUrl to the photo_assets table so it can be managed.
 * This creates a photo_asset record from the item's existing imageUrl.
 */
r.post('/:id/photos/migrate-legacy', async (req, res) => {
  try {
    const itemId = req.params.id;

    // Verify item exists and has an imageUrl
    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: "item not found" });
    if (!item.image_url) return res.status(400).json({ error: "item has no legacy image to migrate" });

    // Check if there are already photos in photo_assets
    const existingCount = await prisma.photo_assets.count({ where: { inventoryItemId: item.id } });
    if (existingCount > 0) {
      return res.status(400).json({ error: "item already has photos in gallery, cannot migrate legacy image" });
    }

    // Create photo_asset from the legacy imageUrl
    const photoId = generateQuickStart("pha");
    const created = await prisma.photo_assets.create({
      data: {
        id: photoId,
        tenantId: item.tenant_id,
        inventoryItemId: item.id,
        url: item.image_url,
        position: 0,
        exifRemoved: false,
      },
    });

    return res.status(201).json(created);
  } catch (e: any) {
    console.error("migrate legacy photo error", e);
    return res.status(500).json({ error: e?.message || "migration failed" });
  }
});

/** PUT /:id/photos/:photoId — update alt, caption, or position */
r.put('/:id/photos/:photoId', async (req, res) => {
  try {
    const { id: itemId, photoId } = req.params;
    const { alt, caption, position } = req.body || {};

    // Verify item exists
    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) {
      return res.status(404).json({ error: "item not found" });
    }

    // Verify photo exists and belongs to this item
    const photo = await prisma.photo_assets.findUnique({ where: { id: photoId } });
    if (!photo || photo.inventoryItemId !== itemId) {
      return res.status(404).json({ error: "photo not found" });
    }

    // If position is changing, handle swap/reorder
    if (position !== undefined && position !== photo.position) {
      // Find photo at target position (if any)
      const targetPhoto = await prisma.photo_assets.findFirst({
        where: { inventoryItemId: itemId, position },
      });

      // Use sequential updates to avoid Prisma transaction tracing issues
      // The unique constraint on [inventory_item_id, position] requires careful ordering
      try {
        if (targetPhoto) {
          // Step 1: Move target photo to a temporary position (-1)
          await prisma.photo_assets.update({
            where: { id: targetPhoto.id },
            data: { position: -1 },
          });
        }

        // Step 2: Move this photo to target position
        await prisma.photo_assets.update({
          where: { id: photoId },
          data: {
            position,
            ...(alt !== undefined && { alt }),
            ...(caption !== undefined && { caption }),
          },
        });

        if (targetPhoto) {
          // Step 3: Move target photo to this photo's old position
          await prisma.photo_assets.update({
            where: { id: targetPhoto.id },
            data: { position: photo.position },
          });
        }
      } catch (swapError: any) {
        console.error(`[Photo Update] Position swap failed:`, swapError);
        return res.status(500).json({ 
          error: "position_update_failed", 
          details: swapError.message 
        });
      }

      // Refetch the updated photo to ensure we return the committed state
      const updated = await prisma.photo_assets.findUnique({ where: { id: photoId } });
      if (!updated) {
        return res.status(500).json({ error: "photo update failed" });
      }

      // Update item image_url if primary changed
      if (position === 0) {
        await prisma.inventory_items.update({
          where: { id: itemId },
          data: { image_url: updated.url },
        });
      }

      return res.json(updated);
    }

    // No position change, just update alt/caption
    const updated = await prisma.photo_assets.update({
      where: { id: photoId },
      data: {
        ...(alt !== undefined && { alt }),
        ...(caption !== undefined && { caption }),
      },
    });

    res.json(updated);
  } catch (e: any) {
    console.error("photo update error", e);
    res.status(500).json({ error: e?.message || "update failed" });
  }
});

/** PUT /:id/photos/reorder — bulk reorder photos */
r.put('/:id/photos/reorder', async (req, res) => {
  try {
    const itemId = req.params.id;
    const updates: Array<{ id: string; position: number }> = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "body must be array of {id, position}" });
    }

    // Verify item exists
    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: "item not found" });

    // Verify all photos belong to this item
    const photoIds = updates.map(u => u.id);
    const photos = await prisma.photo_assets.findMany({
      where: { id: { in: photoIds }, inventoryItemId: itemId },
    });

    if (photos.length !== photoIds.length) {
      return res.status(400).json({ error: "some photos not found or don't belong to this item" });
    }

    // Update positions in transaction
    await prisma.$transaction(
      updates.map(({ id, position }) =>
        prisma.photo_assets.update({
          where: { id },
          data: { position },
        })
      )
    );

    // Update item image_url to primary (position 0)
    const primary = await prisma.photo_assets.findFirst({
      where: { inventoryItemId: itemId, position: 0 },
    });
    if (primary) {
      await prisma.inventory_items.update({
        where: { id: itemId },
        data: { image_url: primary.url },
      });
    }

    res.status(204).send();
  } catch (e: any) {
    console.error("reorder error", e);
    res.status(500).json({ error: e?.message || "reorder failed" });
  }
});

/** DELETE /:id/photos/:photoId — delete photo and re-pack positions */
r.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    const { id: itemId, photoId } = req.params;

    // Verify item exists
    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: "item not found" });

    // Verify photo exists and belongs to this item
    const photo = await prisma.photo_assets.findUnique({ where: { id: photoId } });
    if (!photo || photo.inventoryItemId !== itemId) {
      return res.status(404).json({ error: "photo not found" });
    }

    // Delete from Supabase Storage (extract path from URL)
    if (supabase && photo.url) {
      try {
        // Extract path from public URL (format: https://.../storage/v1/object/public/photos/{path})
        const match = photo.url.match(/\/photos\/(.+)$/);
        if (match) {
          const path = match[1];
          await supabase.storage.from(StorageBuckets.PHOTOS.name).remove([path]);
        }
      } catch (storageError) {
        console.error("Failed to delete from storage:", storageError);
        // Continue with DB deletion even if storage fails
      }
    }

    // Delete photo from DB
    await prisma.photo_assets.delete({ where: { id: photoId } });

    // Re-pack positions: get all remaining photos and reassign positions 0, 1, 2...
    const remaining = await prisma.photo_assets.findMany({
      where: { inventoryItemId: itemId },
      orderBy: { position: "asc" },
    });

    if (remaining.length > 0) {
      // Update positions sequentially to avoid Prisma transaction issues
      for (let idx = 0; idx < remaining.length; idx++) {
        await prisma.photo_assets.update({
          where: { id: remaining[idx].id },
          data: { position: idx },
        });
      }

      // Update item image_url to new primary (position 0)
      await prisma.inventory_items.update({
        where: { id: itemId },
        data: { image_url: remaining[0].url }, 
      });
    } else {
      // No photos left, clear image_url
      await prisma.inventory_items.update({
        where: { id: itemId },
        data: { image_url: null },
      });
    }

    res.status(204).send();
  } catch (e: any) {
    console.error("photo delete error", e);
    res.status(500).json({ error: e?.message || "delete failed" });
  }
});

export default r;
