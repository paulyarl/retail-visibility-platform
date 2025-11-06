# Camera Scanning Module — Specification (RVP) v1.1 (Retrofit)

**Document Owner:** Intake & Capture Team (RVP)  
**Status:** Implementation-Ready (Retrofit + SLOs + Canary)  
**Date:** 2025-11-05  
**Related IDs:** REQ-2025-CAMSCAN-001, REQ-2025-BARCODE-CORE, ENH-2025-SCAN-UX, OPS-ALERT-SCAN-01

---

## 1) Goal & Scope
Deliver **in-browser and mobile web** camera barcode scanning to complete the scanning workflow alongside **USB scanner** and **manual entry**. Provide fast, accessible, privacy-safe capture of standard retail symbologies (UPC/EAN/Code128/QR), with **on-device decode** by default and **server-assisted** fallback. Support **enrichment** via existing product data services and canonicalize to RVP SKU model.

**Out of scope:** OCR of text labels, image recognition beyond barcodes, native app features not accessible via Web APIs.

---

## 2) User Stories
- As a store associate, I can **open the scanner**, point the camera at a barcode, and see the product auto-populate with enriched data in < 1.5s.  
- As a manager, I can **batch scan** multiple items, fix mis-reads, and commit a bulk update.  
- As an admin, I can **restrict** scanning to allowed roles and enforce data retention policies for captured frames (no photos stored).

---

## 3) Architecture Overview
```
[Browser/PWA]
  ├─ UI: Scan Panel (Canvas/WebGL preview, torch, zoom)
  ├─ Decoder: Primary (Barcode Detection API) → Fallback (WASM ZXing/ZXing-CPP)
  ├─ Privacy: No frame upload by default; ROI masking option
  └─ Publisher: emits ScanEvent → Intake Service

[Intake Service]
  ├─ Idempotency & Debounce (same code within window)
  ├─ Standards Parser (UPC/EAN/GS1 AI parsing)
  ├─ Enrichment Orchestrator (existing)
  └─ Inventory Upsert / Mapping Resolver → SWIS/Preview

[Observability]
  ├─ Frontend RUM (decode latency, FPS, dropped frames, memory)
  └─ Backend metrics (time-to-enrichment, error codes)
```

### 3.1 End-to-End Sequence (ASCII)
```
User → Scan UI → Decoder → Intake API → Enrichment → Inventory → Feeds
  |       |          |         |              |            |        |
  | open  | frames → | code →  | 202/200 →    | GTIN→SKU   | upsert | emit
  |       |          | idk     | enqueue/log  | enrich     | delta  | event
```

**Idempotency key (idk):** `sha256(tenant:store:code:timebucket)` (timebucket = ISO hour or 2s window in batch).  
**Client retry rule:** If 202 with `idk`, client may retry after 2s; 200 indicates duplicate accepted and ignored.

### 3.2 UI State Machine (Single/Batch)
```
IDLE → DETECTING → DECODED → (Single: COMMIT) | (Batch: STAGED → COMMIT)
         ↑           ↓ ERRORS → PROMPT RESCAN / MANUAL INPUT
```

---

## 4) Platform Support Matrix
| Platform | Camera Access | Decoder Path | Torch/Zoom | Notes |
|---|---|---|---|---|
| iOS Safari 16+ | `getUserMedia` | WASM fallback (ZXing) | Torch (where supported) | Barcode Detection API limited; use WASM |
| Android Chrome 108+ | `getUserMedia` | Barcode Detection API → WASM | Torch/Zoom | Prefer native API for performance |
| Desktop Chrome/Edge | `getUserMedia` | WASM | N/A | Good for back office |
| Firefox | `getUserMedia` | WASM | Limited | Enable experimental APIs guarded by flag |

---

## 5) UI/UX Specification
### 5.1 Entry Points
- **Global Add → Scan**  
- **Inventory → Add/Adjust → Camera Scan**  
- **Enrichment Console → Capture**

### 5.2 Scan Panel
- Full-screen overlay with live preview; **safe area** guides & corner brackets.  
- Controls: **torch**, **front/back camera**, **zoom**, **pause**, **manual input fallback**.  
- Read feedback: haptic (mobile), beep, and on-screen **barcode text** with symbology pill.  
- **Multi-read mode**: queue shows the last N codes with status.

### 5.3 Batch Mode
- Toggle **Single** / **Batch**; in Batch, each decode appends to a **staging list** with: code → parsed SKU → enrichment state (pending/ok/error).  
- Actions: **Undo**, **Edit**, **Remove**, **Commit** (bulk create/update).

### 5.4 Error UX
- Mis-read prompt: "Not your item?" → edit or rescan.  
- Slow decode (>1.5s): show tips (distance, angle, lighting).  
- No camera permission: guided fallback to USB/manual.

### 5.5 Accessibility
- Keyboard: `Space` toggles pause/resume; `Enter` confirms; `Esc` closes.  
- Screen reader: labels for controls; live region announces scan results.  
- High-contrast overlay and color-independent status icons.

---

## 6) Functional Requirements
```yaml
ID: REQ-2025-CAMSCAN-001
Title: Camera Scanning — Web & PWA
Type: Feature
Status: Ready for Implementation
Acceptance:
  - Median decode ≤ 300ms; P95 ≤ 1.5s (Android Chrome); iOS P95 ≤ 2.0s
  - First-code time (cold start) ≤ 3.0s over 4G
  - Batch commit accuracy ≥ 99.5% (UPC-A/EAN-13) with checksum
  - False-positive budget: ≤0.1% for UPC/EAN; ≤0.3% Code128; ≤0.5% QR
  - Zero frame uploads by default; no persistent raw images
  - Offline capture queue with auto-sync when online
```

### 6.1 Service Level Objectives (SLOs)
| Metric | Target | Window | Error Budget/Alert |
|---|---|---|---|
| UI decode p95 (Android) | ≤ 1.5s | 30d | Page alert if >2 days breach |
| UI decode p95 (iOS) | ≤ 2.0s | 30d | Open perf ticket if >1 day breach |
| Intake API availability | ≥ 99.9% | 30d | Pager @ 5-min rolling < 99% |
| Enrichment time-to-first-byte p95 | ≤ 1.0s | 30d | Warn if >3 consecutive hours |
| Duplicate suppression rate | ≥ 98% | 30d | Investigate if < 95% |

---

## 7) Barcode & Data Standards
- **Symbologies:** UPC-A/E, EAN-13/8, Code 128, Code 39 (limited), ITF, QR (URL & GS1 QR). Optional (flagged): **DataMatrix**, **PDF417**.  
- **Checksum:** UPC/EAN check-digit verification; reject failures with inline explanation.  
- **GS1 AIs:** Parse AIs `(01) GTIN`, `(10) Batch`, `(17) Expiry`, `(21) Serial`. Unknown AIs stored under `parsed.ai_unknown`.
- **Normalization:** Map GTIN ↔ internal SKU (prefer tenant mapping table).  
- **Idempotency:** Deduplicate repeated reads within a 2s window per device session and 1h for server-side de-dupe.

### 7.1 GS1 Acceptance Tests (Illustrative)
```
(01)00012345678905 → gtin=00012345678905
(01)09501101530003(17)261231 → gtin=09501101530003, expiry=2026-12-31
(01)00370003001913(10)LOT77(21)SN42 → batch=LOT77, serial=SN42
```

---

## 8) Security & Privacy
- Default **on-device decoding**; do not transmit frames.  
- Optional **server-assist** mode (feature-flagged) sends downscaled frame snippets only when repeated decode failures occur; delete immediately after result.  
- Enforce **HTTPS, secure contexts**; deny scanning in insecure origins.  
- **Permission hygiene:** preflight explanation modal; persistent indicator when camera active.
- **ROI Masking:** option to black out camera preview outside the scan window, reducing incidental PII capture.

### 8.1 QR Safe Resolver (Phishing Protection)
- The UI never auto-navigates on QR.  
- **POST /scan/qr/resolve** returns a safe action: `{"action":"open|block|interstitial","url":"...","reason":"..."}` based on allowlist/denylist rules.  
- Block `javascript:` and unknown schemes by default; allow tenant-configured domains.

### 8.2 CSP & Permissions-Policy Examples
**CSP**
```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' blob: data:;
  media-src 'self' blob:;
  worker-src 'self' blob:;
  script-src 'self';
  connect-src 'self' https://api.yourdomain.tld;
```
**Permissions-Policy**
```
Permissions-Policy: camera=(self), geolocation=(), microphone=()
```

---

## 9) API Contracts (Internal)
### 9.1 Frontend → Intake Service
```http
POST /scan/events
Authorization: Bearer <user>
Content-Type: application/json
{
  "tenant_id":"<uuid>",
  "store_id":"<uuid>",
  "device_id":"<uuid>",
  "code":"012345678905",
  "symbology":"upc_a",
  "captured_at":"2025-11-05T15:40:00Z",
  "session_id":"<uuid>",
  "batch_id":"<uuid|null>",
  "metadata":{"confidence":0.98,"frames":1}
}
```
**Responses**  
- `202 Accepted` with `{status:"queued", idempotency_key}` for first-in-window.  
- `200 OK` with `{status:"duplicate", idempotency_key}` if duplicate within server window.  
- `409 Conflict` reserved for schema/idempotency violations.

### 9.2 Intake → Enrichment Orchestrator
```json
{
  "scan_event_id":"...",
  "tenant_id":"...",
  "parsed": {"gtin":"012345678905","ai":{}},
  "sku_lookup": {"sku":"SKU-123","status":"found|missing"}
}
```

### 9.3 Inventory Upsert
- If SKU exists: update attributes (optional) or quantity adjustments (if workflow demands).  
- If missing: create **enrichment task** for human review.

### 9.4 QR Resolver
```http
POST /scan/qr/resolve
{
  "tenant_id":"<uuid>", "url":"https://example.com/x" }
→ { "action":"interstitial", "url":"https://example.com/x", "reason":"domain_not_allowlisted" }
```

---

## 10) Frontend Implementation Notes
- Use `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`.  
- Prefer **Barcode Detection API** when `"BarcodeDetector" in window` and supports required symbologies.  
- Fallback to **WASM ZXing/ZXing-CPP** worker for cross-browser parity.  
- Render to `<canvas>` for ROI cropping; throttle to device FPS; adaptive exposure hints.

---

## 11) Performance & Tuning
- Dynamic ROI: shrink scan window after first detection to increase decode rate.  
- Frame skipping: analyze every Nth frame (adaptive 1–3) based on FPS.  
- Debounce spurious repeats by hashing `code + orientation + timestamp bucket`.

---

## 12) Error Handling & Edge Cases
- **Glare/low light:** prompt to enable torch; auto-increase exposure where supported.  
- **Damaged barcodes:** suggest manual entry; create remediation task.  
- **Multiple barcodes in frame:** select highest confidence; allow manual picker UI.  
- **Rotated/curved labels:** enable multi-angle sampling; dewarp in worker when needed.

---

## 13) Observability
**Frontend RUM Metrics**  
- `scan.decode.latency.ms` (median, p95)  
- `scan.fps`  
- `scan.success.rate`  
- `scan.permission.denied.rate`  
- `scan.frames.dropped.rate`  
- `scan.memory.mb`  
- `scan.first_decode.ttfi.ms`

**Backend Metrics**  
- `scan.to.enrichment.ms`  
- `enrichment.success.rate`  
- `idempotency.hit.rate`  
- `server_assist.invocations`

**Tracing**  
- Generate `trace_id` in UI; propagate via `x-trace-id` header → Intake → Enrichment → Inventory; show the same `trace_id` in Sync/Enrichment UIs for end-to-end timing.

---

## 14) Roles & Permissions
- Roles: **Owner, Manager, Associate, Analyst**.  
- Only **Owner/Manager/Associate** may scan; **Analyst** read-only.  
- Feature flag: `ff.capture.camera.enabled` per tenant/store.

---

## 15) QA & Acceptance Tests
- Cross-browser matrix (Android/iOS/Desktop).  
- Symbology set: UPC-A/E, EAN-13/8, Code128, QR.  
- Latency benchmarks per device tier (low/med/high).  
- Offline queue test: capture 20 scans offline → auto-sync on reconnect.  
- Security: verify frames never leave device in default mode.

---

## 16) Rollout Plan
1. **Canary cohort**: enable on 2 stores (10 devices). Sample at 20% RUM.
2. **Guardrails**: auto-disable if p95 decode > 2.5s for 1h or error rate > 5%.
3. **Expand**: +10 stores after 7d stable SLOs; raise RUM sampling to 50%.
4. **GA**: enable per-tenant; publish SOP.

### 16.1 Rollback Playbook
- One-click feature-flag off (`ff.capture.camera.enabled=false`).  
- Keep USB/manual inputs available.  
- Post-mortem: export traces for last 2h; create remedial ticket.

---

## 17) Dependencies
- Existing **USB & Manual Barcode** workflows (already live).  
- **Enrichment Orchestrator** and **Inventory Upsert** endpoints.  
- **Tenant Feature Flags** service.  
- **Observability** pipeline.

---

## 18) Risks & Mitigations
- iOS performance variability → optimize WASM workers, reduce canvas copies.  
- Store lighting conditions → torch control, UX guidance.  
- Privacy concerns → no frame uploads; clear indicators; policy text; ROI masking.  
- QR phishing → QR Safe Resolver with allowlist + interstitial.

---

## 19) Open Questions
- Do we need **DataMatrix** or **PDF417** for specific categories?  
- Should batch mode support **quantity scanning** (scan + count entry) in one pass?  
- Do we auto-create SKU records on unknown GTIN, or always gate via enrichment queue?

---

## 20) Changelog
- **v1.1 (2025-11-05):** Retrofit: SLOs/Error budgets, sequence/state diagrams, QR Safe Resolver, CSP/Permissions-Policy, RUM telemetry additions, ZXing WASM concrete wiring, ROI masking, canary + rollback.
- **v1.0 (2025-11-05):** Initial camera scanning spec aligned with USB & Manual inputs; includes UX, APIs, privacy, performance, rollout.

---

## 21) Next Steps
- Wire ZXing WASM worker as shown and self-host binary with long-lived cache.  
- Implement QR Safe Resolver service + allowlist UI.  
- Add RUM correlation and dashboards; set SLO alerts.  
- Prepare canary cohort and rollback automation.  
- Expand tests to include lighting/distance angles and CI camera emulation.
