import express from "express";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./prisma";

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

const port = process.env.API_PORT || 4000;
app.listen(port, () => console.log(`API → http://localhost:${port}/health`));
