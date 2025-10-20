import express from "express";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./prisma";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/tenants", async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ tenants });
  } catch (e) {
    res.status(500).json({ error: "failed_to_list_tenants" });
  }
});

const createTenantSchema = z.object({ name: z.string().min(1) });
app.post("/tenants", async (req, res) => {
  try {
    const parsed = createTenantSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }
    const tenant = await prisma.tenant.create({ data: { name: parsed.data.name } });
    res.status(201).json({ tenant });
  } catch (_e) {
    res.status(500).json({ error: "failed_to_create_tenant" });
  }
});

const updateTenantSchema = z.object({ name: z.string().min(1) });
app.put("/tenants/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const parsed = updateTenantSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }
    const tenant = await prisma.tenant.update({ where: { id }, data: { name: parsed.data.name } });
    res.json({ tenant });
  } catch (_e) {
    res.status(500).json({ error: "failed_to_update_tenant" });
  }
});

app.delete("/tenants/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.tenant.delete({ where: { id } });
    res.status(204).end();
  } catch (_e) {
    res.status(500).json({ error: "failed_to_delete_tenant" });
  }
});

app.get("/items", async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || "demo-tenant";
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: "failed_to_list_items" });
  }
});

// Create item (pilot/demo)
const createItemSchema = z.object({
  tenantId: z.string().min(1).default("demo-tenant"),
  sku: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
});

app.post("/items", async (req, res) => {
  try {
    const parsed = createItemSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }
    const { tenantId, sku, name, priceCents, stock } = parsed.data;
    const created = await prisma.inventoryItem.create({
      data: {
        tenantId,
        sku,
        name,
        priceCents: typeof priceCents === "number" ? priceCents : 0,
        stock: typeof stock === "number" ? stock : 0,
      },
    });
    res.status(201).json({ item: created });
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && (e as any).code === "P2002") {
      return res.status(409).json({ error: "duplicate_sku" });
    }
    res.status(500).json({ error: "failed_to_create_item" });
  }
});

const port = (process.env.PORT as string | undefined) || process.env.API_PORT || 4000;
app.listen(port, () => console.log(`API → http://localhost:${port}/health`));

