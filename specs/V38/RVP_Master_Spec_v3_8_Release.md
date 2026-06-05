# RVP Master Spec v3.8


---

# 🔄 v3.8 Addendum — SKU Scanning Module
**Generated:** 2025-11-01T13:11:01.560517  

This addendum merges the **SKU Scanning** functional & technical scope into the master release, including:
- Dual input modes (camera + USB), batch workflow, enrichment cache
- Idempotent SQL migrations with RLS
- OpenAPI contracts
- Backend route stubs
- React components for scanner and batch review
- Feature tiers & rate limits

## Technical Appendix — v3.8 SKU Scanning (Combined Pack)
(See embedded pack below)

# RVP v3.8 — SKU Scanning Pack (Combined)

# RVP v3.8 — SKU Scanning Pack
**Generated:** 2025-11-01T13:00:00

This pack implements the **SKU Scanning Module** with camera + USB scanner input,
enrichment pipeline, validation, duplicate detection, and batch workflow.

## Contents
- `sql/` — Idempotent migrations + RLS + rollback
- `api/openapi.yaml` — REST contracts
- `backend/` — Example route stubs (Node/TypeScript)
- `frontend/` — React components for **BarcodeScanner** and **BatchReview**
- `config/feature_tiers.yaml` — Feature flags & rate limits

## UI Flow (Scoped)
- Entry: Add Products → tabs: **Manual**, **Scan**, **CSV Upload**
- Scan modes: **Camera** (ZXing) and **USB Scanner** (keyboard wedge)
- After scan: Enrichment Preview → Validation errors inline → **Edit Details** or **Add Another**
- Batch Review: list of scanned items with status chips: `valid`, `invalid`, `duplicate`


---

## V3_8_001_tables.sql

```sql
-- V3_8_001_tables.sql
-- SKU scanning core tables (idempotent).

CREATE TABLE IF NOT EXISTS sku_scan_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE,
  user_id uuid,
  status text CHECK (status IN ('pending','processed','failed')) DEFAULT 'pending',
  device text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS sku_scan_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_session_id uuid REFERENCES sku_scan_session(id) ON DELETE CASCADE,
  barcode text,
  format text,
  resolved_product jsonb,
  enrichment_source text,
  validation_state text, -- valid|invalid|partial|duplicate
  validation_errors jsonb,
  created_inventory_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Enrichment cache for lookups
CREATE TABLE IF NOT EXISTS product_template (
  barcode text PRIMARY KEY,
  name text,
  brand text,
  category_hint text,
  description text,
  images text[],
  msrp numeric(12,2),
  updated_at timestamptz DEFAULT now()
);

-- Lookup logging for rate limits/observability
CREATE TABLE IF NOT EXISTS barcode_lookup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  barcode text,
  source text,
  status text,
  latency_ms int,
  created_at timestamptz DEFAULT now()
);
```

---

## V3_8_002_indexes_rls.sql

```sql
-- V3_8_002_indexes_rls.sql
-- Indexes, RLS policies, and helpers.

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scan_session_tenant ON sku_scan_session(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_result_session ON sku_scan_result(scan_session_id);
CREATE INDEX IF NOT EXISTS idx_scan_result_state ON sku_scan_result(validation_state);
CREATE INDEX IF NOT EXISTS idx_lookup_log_tenant ON barcode_lookup_log(tenant_id);

-- RLS for tenant-owned tables
ALTER TABLE sku_scan_session ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scan_session_tenant_rw ON sku_scan_session;
CREATE POLICY scan_session_tenant_rw ON sku_scan_session
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

ALTER TABLE sku_scan_result ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scan_result_tenant_rw ON sku_scan_result;
CREATE POLICY scan_result_tenant_rw ON sku_scan_result
USING (scan_session_id IN (SELECT id FROM sku_scan_session WHERE tenant_id = auth.uid()))
WITH CHECK (scan_session_id IN (SELECT id FROM sku_scan_session WHERE tenant_id = auth.uid()));

-- touch triggers if helper exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='touch_updated_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_scan_session_touch') THEN
      CREATE TRIGGER trg_scan_session_touch BEFORE UPDATE ON sku_scan_session
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_scan_result_touch') THEN
      CREATE TRIGGER trg_scan_result_touch BEFORE UPDATE ON sku_scan_result
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    END IF;
  END IF;
END $$;
```

---

## V3_8_003_functions.sql

```sql
-- V3_8_003_functions.sql
-- Helper function for EAN/UPC checksum (basic mod-10 for UPC-A / EAN-13).

CREATE OR REPLACE FUNCTION validate_barcode_mod10(code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  digits TEXT := regexp_replace(code, '\D', '', 'g');
  len INT := char_length(digits);
  sum INT := 0;
  check_digit INT;
  i INT;
  c INT;
BEGIN
  IF len NOT IN (12,13) THEN
    RETURN FALSE;
  END IF;

  -- compute checksum for first len-1 digits
  FOR i IN 1..len-1 LOOP
    c := (substr(digits, i, 1))::INT;
    IF (len = 12) THEN
      -- UPC-A weighting: odd*3 + even
      IF (i % 2 = 1) THEN sum := sum + 3*c; ELSE sum := sum + c; END IF;
    ELSE
      -- EAN-13 weighting: odd + even*3
      IF (i % 2 = 1) THEN sum := sum + c; ELSE sum := sum + 3*c; END IF;
    END IF;
  END LOOP;
  check_digit := (10 - (sum % 10)) % 10;
  RETURN check_digit = (substr(digits, len, 1))::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## V3_8_900_rollback.sql

```sql
-- V3_8_900_rollback.sql
BEGIN;
DROP POLICY IF EXISTS scan_result_tenant_rw ON sku_scan_result;
ALTER TABLE sku_scan_result DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scan_session_tenant_rw ON sku_scan_session;
ALTER TABLE sku_scan_session DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS barcode_lookup_log;
DROP TABLE IF EXISTS product_template;
DROP TABLE IF EXISTS sku_scan_result;
DROP TABLE IF EXISTS sku_scan_session;

DROP FUNCTION IF EXISTS validate_barcode_mod10(TEXT);
COMMIT;
```

---

## openapi.yaml

```yaml
openapi: 3.0.3
info:
  title: RVP SKU Scanning API
  version: v3.8-pre
paths:
  /tenant/{tenant_id}/sku/scan:
    post:
      summary: Start or submit a scan (camera/upload/manual)
      parameters:
        - in: path
          name: tenant_id
          schema: { type: string, format: uuid }
          required: true
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                image_base64: { type: string }
                barcode: { type: string }
                source_device: { type: string }
      responses:
        "202":
          description: Scan accepted
          content:
            application/json:
              schema: { type: object, properties: { scan_session_id: { type: string, format: uuid } } }
  /tenant/{tenant_id}/sku/scan/{session_id}/results:
    get:
      summary: Retrieve results for a scan session
      parameters:
        - in: path
          name: tenant_id
          schema: { type: string, format: uuid }
          required: true
        - in: path
          name: session_id
          schema: { type: string, format: uuid }
          required: true
      responses:
        "200":
          description: Results payload
          content:
            application/json:
              schema:
                type: object
                properties:
                  results:
                    type: array
                    items:
                      type: object
                      properties:
                        barcode: { type: string }
                        resolved_product: { type: object }
                        validation_state: { type: string }
                        created_inventory_id: { type: string, format: uuid, nullable: true }
  /tenant/{tenant_id}/sku/scan/{session_id}/commit:
    post:
      summary: Commit valid results into inventory
      parameters:
        - in: path
          name: tenant_id
          schema: { type: string, format: uuid }
          required: true
        - in: path
          name: session_id
          schema: { type: string, format: uuid }
          required: true
      responses:
        "200":
          description: Commit summary
          content:
            application/json:
              schema:
                type: object
                properties:
                  created_count: { type: integer }
                  invalid_count: { type: integer }
                  duplicate_count: { type: integer }
  /products/lookup-barcode/{barcode}:
    get:
      summary: Enrichment lookup with cache-first strategy
      parameters:
        - in: path
          name: barcode
          schema: { type: string }
          required: true
      responses:
        "200":
          description: Product template (cached or external)
          content:
            application/json:
              schema: { type: object }
        "404":
          description: Product not found
        "429":
          description: Rate limited
```

---

## backend/lookup_barcode.ts

```ts
// backend/routes/lookup_barcode.ts
import type { Request, Response } from 'express';

export async function lookupBarcode(req: Request, res: Response) {
  const { barcode } = req.params as { barcode: string };
  try {
    // 1) cache first
    const cached = await req.ctx.db.product_template.findUnique({ where: { barcode } });
    if (cached) return res.json(cached);

    // 2) external providers (pseudo, replace with real fetch + rate limit checks)
    // TODO: implement provider rotation + timeouts + attribution
    const product = null;

    if (product) {
      await req.ctx.db.product_template.upsert({
        where: { barcode },
        update: { ...product, updated_at: new Date() },
        create: { barcode, ...product }
      });
      return res.json(product);
    }
    return res.status(404).json({ error: 'Product not found' });
  } catch (e) {
    req.ctx.logger.error({ e }, 'lookup_barcode_error');
    return res.status(500).json({ error: 'Lookup failed' });
  }
}
```

---

## backend/scan_commit.ts

```ts
// backend/routes/scan_commit.ts
import type { Request, Response } from 'express';

export async function commitScanSession(req: Request, res: Response) {
  const { tenant_id, session_id } = req.params as { tenant_id: string, session_id: string };
  try {
    // Fetch results
    const results = await req.ctx.db.sku_scan_result.findMany({
      where: { scan_session_id: session_id }
    });

    let created = 0, invalid = 0, duplicate = 0;
    for (const r of results) {
      if (r.validation_state === 'valid') {
        // naive duplicate check: inventory_item(tenant_id, barcode) — depends on your schema
        const exists = await req.ctx.db.inventory_item.findFirst({ where: { tenant_id, sku: r.barcode } });
        if (exists) { duplicate++; continue; }
        await req.ctx.db.inventory_item.create({
          data: {
            tenant_id,
            sku: r.barcode,
            title: r.resolved_product?.name ?? 'New Product',
            brand: r.resolved_product?.brand ?? 'Unknown',
            description: r.resolved_product?.description ?? null,
            price: 0, currency: 'USD',
            availability: 'in_stock',
            image_url: (r.resolved_product?.images?.[0]) ?? 'https://example.com/placeholder.jpg'
          }
        });
        created++;
      } else if (r.validation_state === 'invalid') {
        invalid++;
      }
    }
    return res.json({ created_count: created, invalid_count: invalid, duplicate_count: duplicate });
  } catch (e) {
    req.ctx.logger.error({ e }, 'commit_scan_session_error');
    return res.status(500).json({ error: 'Commit failed' });
  }
}
```

---

## frontend/BarcodeScanner.tsx

```tsx
// frontend/BarcodeScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

type Props = { onScan: (code: string) => void };

export function BarcodeScanner({ onScan }: Props) {
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Camera-based scanning
  const startCameraScan = async () => {
    setScanning(true);
    try {
      const codeReader = new BrowserMultiFormatReader();
      const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current || undefined);
      onScan(result.getText());
    } catch (e) {
      console.error('scan error', e);
    } finally {
      setScanning(false);
    }
  };

  // USB scanner (keyboard wedge or manual input)
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && manualInput.trim().length > 0) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={startCameraScan} disabled={scanning}>📷 Scan with Camera</button>
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Or scan/type barcode and press Enter"
        />
      </div>
      <video ref={videoRef} style={{ width: 320, height: 240 }} autoPlay muted playsInline />
    </div>
  );
}
```

---

## frontend/BatchReview.tsx

```tsx
// frontend/BatchReview.tsx
import React from 'react';

type Result = {
  barcode: string;
  title?: string;
  state: 'valid' | 'invalid' | 'partial' | 'duplicate';
  errors?: string[];
};

type Props = {
  results: Result[];
  onEdit: (barcode: string) => void;
  onCommit: () => void;
};

export function BatchReview({ results, onEdit, onCommit }: Props) {
  return (
    <div>
      <h3>Batch Review</h3>
      <ul>
        {results.map((r) => (
          <li key={r.barcode}>
            <strong>{r.barcode}</strong> — {r.title ?? 'Unknown'} — <em>{r.state}</em>
            {r.errors && r.errors.length > 0 && (
              <ul>{r.errors.map((e, i) => <li key={i}>⚠ {e}</li>)}</ul>
            )}
            <button onClick={() => onEdit(r.barcode)}>Edit</button>
          </li>
        ))}
      </ul>
      <button onClick={onCommit}>Commit Valid Items</button>
    </div>
  );
}
```

---

## config/feature_tiers.yaml

```yaml
feature_tiers:
  GoogleOnly:
    FF_SKU_SCANNING: false
    FF_CAMERA_SCANNER: false
    FF_USB_SCANNER: false
    FF_SKU_ENRICHMENT_ENGINE: false
    monthly_enrichment_limit: 0
  Starter:
    FF_SKU_SCANNING: true
    FF_CAMERA_SCANNER: true
    FF_USB_SCANNER: false
    FF_SKU_ENRICHMENT_ENGINE: true
    monthly_enrichment_limit: 100
  Professional:
    FF_SKU_SCANNING: true
    FF_CAMERA_SCANNER: true
    FF_USB_SCANNER: true
    FF_SKU_ENRICHMENT_ENGINE: true
    monthly_enrichment_limit: -1
  Enterprise:
    FF_SKU_SCANNING: true
    FF_CAMERA_SCANNER: true
    FF_USB_SCANNER: true
    FF_SKU_ENRICHMENT_ENGINE: true
    monthly_enrichment_limit: -1
    custom_product_db: true
```
