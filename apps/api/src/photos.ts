import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
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
 *  - application/json with { url, width?, height?, bytes?, contentType?, exifRemoved? }
 *
 * Creates PhotoAsset linked to InventoryItem and returns the created asset.
 */
r.post("/items/:id/photos", upload.single("file"), async (req, res) => {
  try {
    const itemId = req.params.id;

    // verify item exists & get tenant
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: "item not found" });

    let url: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let bytes: number | undefined;
    let contentType: string | undefined;
    let exifRemoved = true;

    // Case A: multipart upload of a file
    if (req.file) {
      if (!supabase) {
        return res.status(500).json({ error: "server is not configured for direct uploads (missing SUPABASE envs)" });
      }
      const f = req.file; // buffer + mimetype + originalname
      const path = `${item.tenantId}/${item.sku || item.id}/${Date.now()}-${(f.originalname || "photo").replace(/\s+/g, "_")}`;

      const { error, data } = await supabase.storage.from("photos").upload(path, f.buffer, {
        cacheControl: "3600",
        contentType: f.mimetype || "application/octet-stream",
        upsert: false,
      });
      if (error) return res.status(500).json({ error: error.message });

      const pub = supabase.storage.from("photos").getPublicUrl(data.path);
      url = pub.data.publicUrl;
      contentType = f.mimetype;
      bytes = f.size;
      // We don't know width/height yet unless client sent them — leave undefined
    }

    // Case B: JSON body with url + metadata
    if (!req.file && req.is("application/json")) {
      const body = req.body || {};
      url = body.url;
      width = body.width;
      height = body.height;
      bytes = body.bytes;
      contentType = body.contentType;
      exifRemoved = body.exifRemoved ?? true;
    }

    if (!url) return res.status(400).json({ error: "missing image; provide multipart 'file' or JSON 'url'" });

    const created = await prisma.photoAsset.create({
      data: {
        tenantId: item.tenantId,
        inventoryItemId: item.id,
        url,
        width: width ?? null,
        height: height ?? null,
        contentType: contentType ?? null,
        bytes: bytes ?? null,
        exifRemoved,
      },
    });

    return res.status(201).json(created);
  } catch (e: any) {
    console.error("photo upload error", e);
    return res.status(500).json({ error: e?.message || "upload failed" });
  }
});

/** GET /items/:id/photos — list photos for an item */
r.get("/items/:id/photos", async (req, res) => {
  const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: "item not found" });

  const photos = await prisma.photoAsset.findMany({
    where: { inventoryItemId: item.id },
    orderBy: { capturedAt: "desc" },
  });
  res.json(photos);
});

export default r;
