/**
 * InventoryImportService — CSV ingestion for POS-locked merchants.
 *
 * Spec: docs/LocalBiz/POS_INGESTION_PARTNER_PATH_SPEC.md §4
 *
 * One ingestion point for every CSV-exporting POS — the format registry maps
 * header names per vendor (nrs_pricebook, generic), never hardcodes the NRS
 * layout. Upsert keys on SKU: existing items update, unknown SKUs create
 * (physical/public/active defaults — the merchant's own export IS the
 * consent signal for catalog presence; Google selection stays opt-in).
 *
 * Re-uploads are idempotent; items absent from a re-upload are flagged in the
 * report, never auto-deleted (an export gap is not a removal signal).
 */

import { prisma } from '../prisma';
import { generateQuickStart } from '../lib/id-generator';
import { logger } from '../logger';

export type ImportFormat = 'nrs_pricebook' | 'generic';

export interface ImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
  absentItemIds: string[]; // present in DB but missing from this upload — flagged only
}

// ─── Format registry ────────────────────────────────────────────────────────
// Candidate header names per canonical field — first match wins,
// case-insensitive, whitespace/underscore-tolerant.

const FIELD_CANDIDATES: Record<string, string[]> = {
  sku: ['upc', 'sku', 'barcode', 'plu', 'item code', 'item_code', 'code'],
  name: ['item name', 'name', 'description', 'item description', 'title', 'item'],
  price: ['price', 'retail', 'price cents', 'price_cents', 'sale price', 'selling price'],
  stock: ['stock', 'quantity', 'qty', 'qty on hand', 'on hand', 'on_hand', 'inventory', 'stock quantity'],
  category: ['department', 'category', 'dept', 'group'],
};

// Price fields exported in cents by format (NRS exports price in cents —
// their own label formula divides by 100).
const CENTS_FORMATS = new Set(['nrs_pricebook']);

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveColumnMap(format: ImportFormat, headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const map: Record<string, number> = {};
  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES)) {
    for (const cand of candidates) {
      const idx = normalized.indexOf(cand);
      if (idx >= 0) { map[field] = idx; break; }
      const partial = normalized.findIndex(h => h.includes(cand));
      if (partial >= 0) { map[field] = partial; break; }
    }
  }
  return map;
}

// ─── Minimal CSV parser (quotes, embedded commas/newlines) ──────────────────

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function parsePrice(raw: string | undefined, centsFormat: boolean): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  const cents = centsFormat ? Math.round(n) : Math.round(n * 100);
  return cents >= 0 ? cents : null;
}

function parseStock(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/[,\s]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ─── Importer ───────────────────────────────────────────────────────────────

export async function importInventoryCsv(
  tenantId: string,
  format: ImportFormat,
  csvText: string,
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: [], absentItemIds: [] };
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    summary.errors.push('CSV has no data rows');
    return summary;
  }

  const headers = rows[0];
  const map = resolveColumnMap(format, headers);
  if (map.sku === undefined && map.name === undefined) {
    summary.errors.push(`Could not identify an SKU or name column in headers: ${headers.join(', ')}`);
    return summary;
  }

  const centsFormat = CENTS_FORMATS.has(format);
  const seenSkus = new Set<string>();
  const seenNoSkuNames = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sku = map.sku !== undefined ? (r[map.sku] || '').trim() : '';
    const name = map.name !== undefined ? (r[map.name] || '').trim() : '';
    if (!sku && !name) { summary.skipped++; continue; }

    const priceCents = map.price !== undefined ? parsePrice(r[map.price], centsFormat) : null;
    const stock = map.stock !== undefined ? parseStock(r[map.stock]) : null;
    const category = map.category !== undefined ? (r[map.category] || '').trim() : null;

    try {
      const key = sku || name;
      if (sku) seenSkus.add(sku); else seenNoSkuNames.add(name);

      const existing = sku
        ? await prisma.inventory_items.findFirst({ where: { tenant_id: tenantId, sku } })
        : await prisma.inventory_items.findFirst({ where: { tenant_id: tenantId, name } });

      if (existing) {
        const data: any = { updated_at: new Date() };
        let changed = false;
        if (name && name !== existing.name) { data.name = name; data.title = name; changed = true; }
        if (priceCents != null && priceCents !== existing.price_cents) { data.price_cents = priceCents; data.price = priceCents / 100; changed = true; }
        if (stock != null && stock !== existing.stock) { data.stock = stock; data.availability = stock > 0 ? 'in_stock' : 'out_of_stock'; changed = true; }
        if (changed) {
          await prisma.inventory_items.update({ where: { id: existing.id }, data });
          summary.updated++;
        } else {
          summary.unchanged++;
        }
      } else {
        await prisma.inventory_items.create({
          data: {
            id: generateQuickStart('item'),
            tenant_id: tenantId,
            sku: sku || null,
            name: name || sku || 'Unnamed item',
            title: name || sku || 'Unnamed item',
            price_cents: priceCents,
            price: priceCents != null ? priceCents / 100 : null,
            stock: stock ?? 0,
            availability: (stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock',
            product_type: 'physical',
            visibility: 'public',
            item_status: 'active',
            source: 'BULK_UPLOAD',
            category_path: category ? [category] : undefined,
          } as any,
        });
        summary.created++;
      }
    } catch (err: any) {
      summary.errors.push(`Row ${i + 1} (${sku || name}): ${err?.message || 'import failed'}`);
      summary.skipped++;
    }
  }

  // Flag items absent from this upload — surfaced for merchant review, NOT
  // auto-removed (an export gap is not a removal signal, spec §4).
  if (seenSkus.size > 0 || seenNoSkuNames.size > 0) {
    const tenantItems = await prisma.inventory_items.findMany({
      where: { tenant_id: tenantId, item_status: { not: 'trashed' }, source: 'BULK_UPLOAD' },
      select: { id: true, sku: true, name: true },
    });
    summary.absentItemIds = tenantItems
      .filter(it => !(it.sku ? seenSkus.has(it.sku) : seenNoSkuNames.has(it.name || '')))
      .map(it => it.id);
  }

  // Import watermark (spec §4) — the freshness label + future fast-path anchor
  try {
    await prisma.inventory_imports.create({
      data: {
        id: generateQuickStart('iimp'),
        tenant_id: tenantId,
        format,
        row_count: rows.length - 1,
        created_count: summary.created,
        updated_count: summary.updated,
        unchanged_count: summary.unchanged,
        skipped_count: summary.skipped,
        absent_count: summary.absentItemIds.length,
        errors: summary.errors.length ? summary.errors.slice(0, 25) : undefined,
      } as any,
    });
  } catch (err) {
    logger.warn('[InventoryImport] Failed to write import log:', undefined, { error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err), stack: (err as any)?.stack } });
  }

  return summary;
}

/** Last successful import for a tenant — the card's freshness label. */
export async function getLastImport(tenantId: string): Promise<{ at: Date; created: number; updated: number; unchanged: number } | null> {
  const row = await prisma.inventory_imports.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
    select: { created_at: true, created_count: true, updated_count: true, unchanged_count: true },
  });
  return row
    ? { at: row.created_at, created: row.created_count, updated: row.updated_count, unchanged: row.unchanged_count }
    : null;
}
