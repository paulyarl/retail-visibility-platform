import { Router, Request, Response } from "express";
import multer from "multer";
import { prisma } from "../prisma";
import { createClient } from "@supabase/supabase-js";
import { StorageBuckets } from "../storage-config";
import { generateQuickStart } from "../lib/id-generator";

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
 * POST /:listingId/photos
 * Accepts EITHER:
 *  - multipart/form-data with field "file"
 *  - application/json with { url, width?, height?, bytes?, contentType?, exifRemoved?, alt?, caption? }
 *
 * Creates DirectoryPhoto linked to DirectoryListing and returns the created photo.
 * Enforces max 10 photos per listing.
 */
r.post("/:listingId/photos", upload.single("file"), async (req, res) => {
  try {
    const listingId = req.params.listingId;

    // verify listing exists & get tenant
    const listing = await prisma.directory_listings_list.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: "directory listing not found" });

    // Enforce 10-photo limit
    const existingCount = await prisma.directory_photos.count({ where: { listing_id: listingId } });
    if (existingCount >= 10) {
      return res.status(400).json({ error: "maximum 10 photos per directory listing" });
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
      const path = `directory/${listing.tenant_id}/${listing.slug || listing.id}/${Date.now()}-${(f.originalname || "photo").replace(/\s+/g, "_")}`;

      const { error, data } = await supabase.storage.from(StorageBuckets.TENANTS.name).upload(path, f.buffer, {
        cacheControl: "3600",
        contentType: f.mimetype || "application/octet-stream",
        upsert: false,
      });
      if (error) return res.status(500).json({ error: error.message });

      const pub = supabase.storage.from(StorageBuckets.TENANTS.name).getPublicUrl(data.path);
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
        const path = `directory/${listing.tenant_id}/${listing.slug || listing.id}/${filename}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from(StorageBuckets.TENANTS.name)
          .upload(path, buffer, {
            cacheControl: "3600",
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          return res.status(500).json({ error: uploadError.message });
        }

        const pub = supabase.storage.from(StorageBuckets.TENANTS.name).getPublicUrl(uploadData.path);
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
    const maxPos = await prisma.directory_photos.findFirst({
      where: { listing_id: listingId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = maxPos && maxPos.position !== null ? maxPos.position + 1 : 0;

    const created = await prisma.directory_photos.create({
      data: {
        tenant_id: listing.tenant_id,
        listing_id: listingId,
        url,
        width: width ?? null,
        height: height ?? null,
        content_type: contentType ?? null,
        bytes: bytes ?? null,
        exif_removed: exifRemoved,
        position: nextPosition,
        alt: alt ?? null,
        caption: caption ?? null,
      },
    });

    return res.status(201).json(created);
  } catch (e: any) {
    console.error("directory photo upload error", e);
    return res.status(500).json({ error: e?.message || "upload failed" });
  }
});

/** GET /:listingId/photos — list photos for a directory listing, ordered by position */
r.get("/:listingId/photos", async (req, res) => {
  const listing = await prisma.directory_listings_list.findUnique({ where: { id: req.params.listingId } });
  if (!listing) return res.status(404).json({ error: "directory listing not found" });

  const photos = await prisma.directory_photos.findMany({
    where: { listing_id: listing.id },
    orderBy: { position: "asc" },
  });
  res.json(photos);
});

/** PUT /:listingId/photos/:photoId — update alt, caption, or position */
r.put("/:listingId/photos/:photoId", async (req, res) => {
  try {
    const { listingId, photoId } = req.params;
    const { alt, caption, position } = req.body || {};

    // Verify listing exists
    const listing = await prisma.directory_listings_list.findUnique({ where: { id: listingId } });
    if (!listing) {
      return res.status(404).json({ error: "directory listing not found" });
    }

    // Verify photo exists and belongs to this listing
    const photo = await prisma.directory_photos.findUnique({ where: { id: photoId } });
    if (!photo || photo.listing_id !== listingId) {
      return res.status(404).json({ error: "photo not found" });
    }

    // If position is changing, handle swap/reorder
    if (position !== undefined && position !== photo.position) {
      // Find photo at target position (if any)
      const targetPhoto = await prisma.directory_photos.findFirst({
        where: { listing_id: listingId, position },
      });

      // Use sequential updates to avoid Prisma transaction tracing issues
      try {
        if (targetPhoto) {
          // Step 1: Move target photo to a temporary position (-1)
          await prisma.directory_photos.update({
            where: { id: targetPhoto.id },
            data: { position: -1 },
          });
        }

        // Step 2: Move this photo to target position
        await prisma.directory_photos.update({
          where: { id: photoId },
          data: {
            position,
            ...(alt !== undefined && { alt }),
            ...(caption !== undefined && { caption }),
          },
        });

        if (targetPhoto) {
          // Step 3: Move target photo to this photo's old position
          await prisma.directory_photos.update({
            where: { id: targetPhoto.id },
            data: { position: photo.position },
          });
        }
      } catch (swapError: any) {
        console.error(`[Directory Photo Update] Position swap failed:`, swapError);
        return res.status(500).json({
          error: "position_update_failed",
          details: swapError.message
        });
      }

      // Refetch the updated photo
      const updated = await prisma.directory_photos.findUnique({ where: { id: photoId } });
      if (!updated) {
        return res.status(500).json({ error: "photo update failed" });
      }

      return res.json(updated);
    }

    // No position change, just update alt/caption
    const updated = await prisma.directory_photos.update({
      where: { id: photoId },
      data: {
        ...(alt !== undefined && { alt }),
        ...(caption !== undefined && { caption }),
      },
    });

    res.json(updated);
  } catch (e: any) {
    console.error("directory photo update error", e);
    res.status(500).json({ error: e?.message || "update failed" });
  }
});

/** PUT /:listingId/photos/reorder — bulk reorder directory photos */
r.put("/:listingId/photos/reorder", async (req, res) => {
  try {
    const listingId = req.params.listingId;
    const updates: Array<{ id: string; position: number }> = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "body must be array of {id, position}" });
    }

    // Verify listing exists
    const listing = await prisma.directory_listings_list.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: "directory listing not found" });

    // Verify all photos belong to this listing
    const photoIds = updates.map(u => u.id);
    const photos = await prisma.directory_photos.findMany({
      where: { id: { in: photoIds }, listing_id: listingId },
    });

    if (photos.length !== photoIds.length) {
      return res.status(400).json({ error: "some photos not found or don't belong to this listing" });
    }

    // Update positions in transaction
    await prisma.$transaction(
      updates.map(({ id, position }) =>
        prisma.directory_photos.update({
          where: { id },
          data: { position },
        })
      )
    );

    res.status(204).send();
  } catch (e: any) {
    console.error("directory photo reorder error", e);
    res.status(500).json({ error: e?.message || "reorder failed" });
  }
});

/** DELETE /:listingId/photos/:photoId — delete directory photo and re-pack positions */
r.delete("/:listingId/photos/:photoId", async (req, res) => {
  try {
    const { listingId, photoId } = req.params;

    // Verify listing exists
    const listing = await prisma.directory_listings_list.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: "directory listing not found" });

    // Verify photo exists and belongs to this listing
    const photo = await prisma.directory_photos.findUnique({ where: { id: photoId } });
    if (!photo || photo.listing_id !== listingId) {
      return res.status(404).json({ error: "photo not found" });
    }

    // Delete from Supabase Storage (extract path from URL)
    if (supabase && photo.url) {
      try {
        // Extract path from public URL (format: https://.../storage/v1/object/public/photos/{path})
        const match = photo.url.match(/\/tenants\/(.+)$/);
        if (match) {
          const path = match[1];
          await supabase.storage.from(StorageBuckets.TENANTS.name).remove([path]);
        }
      } catch (storageError) {
        console.error("Failed to delete directory photo from storage:", storageError);
        // Continue with DB deletion even if storage fails
      }
    }

    // Delete photo from DB
    await prisma.directory_photos.delete({ where: { id: photoId } });

    // Re-pack positions: get all remaining photos and reassign positions 0, 1, 2...
    const remaining = await prisma.directory_photos.findMany({
      where: { listing_id: listingId },
      orderBy: { position: "asc" },
    });

    if (remaining.length > 0) {
      // Update positions sequentially to avoid Prisma transaction issues
      for (let idx = 0; idx < remaining.length; idx++) {
        await prisma.directory_photos.update({
          where: { id: remaining[idx].id },
          data: { position: idx },
        });
      }
    }

    res.status(204).send();
  } catch (e: any) {
    console.error("directory photo delete error", e);
    res.status(500).json({ error: e?.message || "delete failed" });
  }
});

export default r;
