/*
  Import Supabase-exported CSV or JSON files into the Railway Postgres database
  Run from apps/api/ with DATABASE_URL pointing to Railway:

    $env:DATABASE_URL = "<RAILWAY_POSTGRES_URL>"
    pnpm tsx scripts/import-from-csv.ts

  Files are read from this directory: apps/api/scripts/
  Supported filenames (any subset is fine):
    - tenants.csv | tenants.json
    - users.csv | users.json
    - inventory_items.csv | inventory_items.json
    - photo_assets.csv | photo_assets.json
    - sync_jobs.csv | sync_jobs.json

  Notes:
  - CSV parsing here is simple (comma-separated, optional quotes). If your data contains embedded commas/newlines, prefer JSON exports.
  - The script uses createMany with skipDuplicates, assuming IDs from export are preserved.
*/

import fs from "fs";
import path from "path";
import { prisma } from "../src/prisma";

// ---------- utilities ----------
function hasFile(p: string) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function parseBoolean(v: any): boolean | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true","1","yes","y"].includes(s)) return true;
  if (["false","0","no","n"].includes(s)) return false;
  return null;
}

function parseInteger(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseJSON(v: any): any | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return null; }
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Very small CSV parser supporting simple quoted fields and commas
function parseCsv(content: string): any[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map(h => h.trim());
  const out: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvLine(lines[i]);
    const rec: any = {};
    header.forEach((key, idx) => {
      rec[key] = row[idx] ?? "";
    });
    out.push(rec);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') { result.push(cur); cur = ""; }
      else if (ch === '"') { inQuotes = true; }
      else { cur += ch; }
    }
  }
  result.push(cur);
  return result;
}

async function loadRecords(baseDir: string, stemOrStems: string | string[]): Promise<any[]> {
  const stems = Array.isArray(stemOrStems) ? stemOrStems : [stemOrStems];
  // Build candidate file names per stem
  const candidates: { type: "json" | "csv"; path: string }[] = [];
  for (const s of stems) {
    const jsonPath = path.join(baseDir, `${s}.json`);
    const csvPath = path.join(baseDir, `${s}.csv`);
    candidates.push({ type: "json", path: jsonPath });
    candidates.push({ type: "csv", path: csvPath });
  }
  const hit = candidates.find(c => hasFile(c.path));
  if (!hit) return [];
  console.log(`→ Using source file: ${path.basename(hit.path)}`);
  const raw = fs.readFileSync(hit.path, "utf-8");
  if (hit.type === "json") {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    const arr = Object.values(data).find(v => Array.isArray(v)) as any[] | undefined;
    return arr ?? [];
  } else {
    return parseCsv(raw);
  }
}

// ---------- importers ----------
async function importTenants(baseDir: string) {
  const rows = await loadRecords(baseDir, [
    "tenants",
    "Tenant_rows",
  ]);
  if (rows.length === 0) return { inserted: 0 };
  const data = rows.map(r => ({
    id: String(r.id ?? r.ID ?? r.tenant_id ?? r.tenantId ?? cryptoRandom()),
    name: String(r.name ?? ""),
    createdAt: parseDate(r.createdAt || r.created_at) ?? undefined,
  }));
  const res = await prisma.tenant.createMany({ data, skipDuplicates: true });
  return { inserted: res.count };
}

async function importUsers(baseDir: string) {
  const rows = await loadRecords(baseDir, [
    "users",
    "User_rows",
  ]);
  if (rows.length === 0) return { inserted: 0 };
  const data = rows.map(r => ({
    id: String(r.id ?? cryptoRandom()),
    tenantId: String(r.tenantId ?? r.tenant_id ?? ""),
    email: String(r.email ?? ""),
    role: String(r.role ?? r.user_role ?? "STAFF") as any,
    createdAt: parseDate(r.createdAt || r.created_at) ?? undefined,
  }));
  const res = await prisma.user.createMany({ data, skipDuplicates: true });
  return { inserted: res.count };
}

async function importItems(baseDir: string) {
  const rows = await loadRecords(baseDir, [
    "inventory_items",
    "InventoryItem_rows",
    "InventoryItems_rows",
  ]);
  if (rows.length === 0) return { inserted: 0 };
  const data = rows.map(r => ({
    id: String(r.id ?? cryptoRandom()),
    tenantId: String(r.tenantId ?? r.tenant_id ?? ""),
    sku: String(r.sku ?? ""),
    name: String(r.name ?? ""),
    priceCents: parseInteger(r.priceCents ?? r.price_cents) ?? 0,
    stock: parseInteger(r.stock) ?? 0,
    imageUrl: r.imageUrl ?? r.image_url ?? undefined,
    metadata: parseJSON(r.metadata) ?? undefined,
    createdAt: parseDate(r.createdAt || r.created_at) ?? undefined,
    updatedAt: parseDate(r.updatedAt || r.updated_at) ?? undefined,
  }));
  const res = await prisma.inventoryItem.createMany({ data, skipDuplicates: true });
  return { inserted: res.count };
}

async function importPhotos(baseDir: string) {
  const rows = await loadRecords(baseDir, [
    "photo_assets",
    "PhotoAsset_rows",
    "PhotoAssets_rows",
  ]);
  if (rows.length === 0) return { inserted: 0 };
  const data = rows.map(r => ({
    id: String(r.id ?? cryptoRandom()),
    tenantId: String(r.tenantId ?? r.tenant_id ?? ""),
    inventoryItemId: String(r.inventoryItemId ?? r.inventory_item_id ?? r.item_id ?? ""),
    url: String(r.url ?? ""),
    width: parseInteger(r.width) ?? undefined,
    height: parseInteger(r.height) ?? undefined,
    contentType: r.contentType ?? r.content_type ?? undefined,
    bytes: parseInteger(r.bytes) ?? undefined,
    exifRemoved: parseBoolean(r.exifRemoved ?? r.exif_removed) ?? undefined,
    capturedAt: parseDate(r.capturedAt || r.captured_at) ?? undefined,
    createdAt: parseDate(r.createdAt || r.created_at) ?? undefined,
  }));
  const res = await prisma.photoAsset.createMany({ data, skipDuplicates: true });
  return { inserted: res.count };
}

async function importSyncJobs(baseDir: string) {
  const rows = await loadRecords(baseDir, [
    "sync_jobs",
    "SyncJob_rows",
    "SyncJobs_rows",
  ]);
  if (rows.length === 0) return { inserted: 0 };
  const data = rows.map(r => ({
    id: String(r.id ?? cryptoRandom()),
    tenantId: String(r.tenantId ?? r.tenant_id ?? ""),
    target: String(r.target ?? ""),
    status: String(r.status ?? "queued"),
    attempt: parseInteger(r.attempt) ?? 0,
    payload: parseJSON(r.payload) ?? {},
    lastError: r.lastError ?? r.last_error ?? undefined,
    createdAt: parseDate(r.createdAt || r.created_at) ?? undefined,
    updatedAt: parseDate(r.updatedAt || r.updated_at) ?? undefined,
  }));
  const res = await prisma.syncJob.createMany({ data, skipDuplicates: true });
  return { inserted: res.count };
}

function cryptoRandom() {
  // Fallback if ids weren’t exported; Prisma schema uses cuid() normally
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// ---------- main ----------
async function main() {
  const baseDir = path.resolve(__dirname);
  console.log("Import base dir:", baseDir);

  // Order matters due to foreign keys
  const t = await importTenants(baseDir);
  console.log("Tenants inserted:", t.inserted);

  const u = await importUsers(baseDir);
  console.log("Users inserted:", u.inserted);

  const it = await importItems(baseDir);
  console.log("Inventory items inserted:", it.inserted);

  const ph = await importPhotos(baseDir);
  console.log("Photo assets inserted:", ph.inserted);

  const sj = await importSyncJobs(baseDir);
  console.log("Sync jobs inserted:", sj.inserted);
}

main()
  .then(async () => { await prisma.$disconnect(); console.log("\n✅ Import completed"); })
  .catch(async (e) => { console.error("Import failed:", e); await prisma.$disconnect(); process.exit(1); });
