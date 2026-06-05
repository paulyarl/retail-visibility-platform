# Camera Scanning Module Implementation Plan

## Overview

Phased implementation plan for Camera Scanning Module based on Technical Specification v1.1 (Retrofit)

**Timeline:** 8-10 weeks  
**Reference:** `specs/v39/camera_scanning_module_specification_rvp_v_1(1).md`

---

## Spec-to-Phase Quick Reference

Each implementation phase is directly linked to specific sections of the technical specification. Use this map to reference the spec context during implementation:

| Phase | Spec Sections | Key Requirements |
|-------|---------------|------------------|
| **Phase 1** | §3 (Architecture), §10 (Frontend) | Camera access, decoder setup, WASM fallback |
| **Phase 2** | §5 (UI/UX), §12 (Error Handling) | Scan panel, controls, error states, accessibility |
| **Phase 3** | §9 (API Contracts), §7 (Standards) | Intake API, GS1 parsing, idempotency |
| **Phase 4** | §5.3 (Batch Mode), §3.2 (State Machine) | Batch scanning, staging list, bulk commit |
| **Phase 5** | §8 (Security), §8.1 (QR Resolver) | Privacy controls, QR safety, CSP/Permissions |
| **Phase 6** | §13 (Observability), §6.1 (SLOs) | RUM metrics, trace IDs, performance monitoring |
| **Phase 7** | §15 (QA), §4 (Platform Support) | Cross-browser testing, symbology validation |
| **Phase 8** | §16 (Rollout), §16.1 (Rollback) | Canary deployment, guardrails, feature flags |

**💡 Tip:** Before starting each phase, review the corresponding spec sections for detailed requirements and context.

---

## Phase 1: Foundation & Camera Access (2 weeks)

**📋 Spec Reference:** Section 3 (Architecture Overview), Section 10 (Frontend Implementation)

**Context from Spec:**
- Use `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`
- Prefer Barcode Detection API when available
- Fallback to WASM ZXing/ZXing-CPP worker for cross-browser parity
- Render to `<canvas>` for ROI cropping
- Throttle to device FPS with adaptive exposure hints

### Camera Service

```typescript
// apps/web/src/services/camera/camera-service.ts

interface CameraConfig {
  facingMode: 'user' | 'environment';
  width: { ideal: number };
  height: { ideal: number };
}

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async requestPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted';
    } catch {
      return false;
    }
  }

  async startCamera(config: CameraConfig): Promise<MediaStream> {
    const constraints = {
      video: {
        facingMode: config.facingMode,
        width: config.width,
        height: config.height
      }
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.stream;
  }

  async stopCamera(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  async switchCamera(): Promise<void> {
    // Toggle between front and back camera
  }

  async enableTorch(enabled: boolean): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (track && 'torch' in track.getCapabilities()) {
      await track.applyConstraints({
        // @ts-ignore
        advanced: [{ torch: enabled }]
      });
    }
  }
}
```

### Decoder Service (Barcode Detection API + WASM Fallback)

```typescript
// apps/web/src/services/camera/decoder-service.ts

export interface DecodeResult {
  code: string;
  symbology: string;
  confidence: number;
  timestamp: number;
}

export class DecoderService {
  private barcodeDetector: any | null = null;
  private wasmWorker: Worker | null = null;

  async initialize(): Promise<void> {
    // Try native Barcode Detection API
    if ('BarcodeDetector' in window) {
      try {
        this.barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'qr_code']
        });
        console.log('Using native Barcode Detection API');
        return;
      } catch (error) {
        console.warn('Barcode Detection API not supported, falling back to WASM');
      }
    }

    // Fallback to WASM ZXing
    this.wasmWorker = new Worker('/workers/zxing-worker.js');
  }

  async decode(imageData: ImageData): Promise<DecodeResult | null> {
    if (this.barcodeDetector) {
      return await this.decodeNative(imageData);
    } else if (this.wasmWorker) {
      return await this.decodeWASM(imageData);
    }
    return null;
  }

  private async decodeNative(imageData: ImageData): Promise<DecodeResult | null> {
    try {
      const barcodes = await this.barcodeDetector.detect(imageData);
      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        return {
          code: barcode.rawValue,
          symbology: barcode.format,
          confidence: 1.0,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error('Native decode error:', error);
    }
    return null;
  }

  private async decodeWASM(imageData: ImageData): Promise<DecodeResult | null> {
    return new Promise((resolve) => {
      if (!this.wasmWorker) {
        resolve(null);
        return;
      }

      const timeout = setTimeout(() => resolve(null), 1500);

      this.wasmWorker.onmessage = (e) => {
        clearTimeout(timeout);
        if (e.data.success) {
          resolve({
            code: e.data.code,
            symbology: e.data.symbology,
            confidence: e.data.confidence || 0.9,
            timestamp: Date.now()
          });
        } else {
          resolve(null);
        }
      };

      this.wasmWorker.postMessage({ imageData });
    });
  }

  destroy(): void {
    if (this.wasmWorker) {
      this.wasmWorker.terminate();
      this.wasmWorker = null;
    }
  }
}
```

### Database Schema

```prisma
// prisma/schema.prisma

model ScanSession {
  id                String   @id @default(cuid())
  tenantId          String
  storeId           String?
  userId            String
  deviceId          String
  
  // Session details
  mode              String   // single, batch
  status            String   // active, completed, cancelled
  
  // Metadata
  startedAt         DateTime @default(now())
  completedAt       DateTime?
  
  scanEvents        ScanEvent[]
  
  @@index([tenantId])
  @@index([userId])
  @@index([deviceId])
}

model ScanEvent {
  id                String   @id @default(cuid())
  sessionId         String
  session           ScanSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  // Scan details
  code              String
  symbology         String
  confidence        Float
  
  // Timing
  capturedAt        DateTime
  processedAt       DateTime?
  
  // Enrichment
  enrichmentStatus  String   @default("pending") // pending, enriched, failed
  inventoryItemId   String?
  
  // Idempotency
  idempotencyKey    String   @unique
  
  // Metadata
  metadata          Json?
  
  createdAt         DateTime @default(now())
  
  @@index([sessionId])
  @@index([idempotencyKey])
  @@index([code])
}
```

---

## Phase 2: UI/UX & Scan Panel (2 weeks)

**📋 Spec Reference:** Section 5 (UI/UX Specification), Section 12 (Error Handling)

**Context from Spec:**
- Full-screen overlay with live preview, safe area guides & corner brackets
- Controls: torch, front/back camera, zoom, pause, manual input fallback
- Read feedback: haptic (mobile), beep, on-screen barcode text with symbology pill
- Error UX: mis-read prompt, slow decode tips, no permission fallback
- Accessibility: keyboard controls (Space/Enter/Esc), screen reader, high-contrast

### Scan Panel Component

```tsx
// apps/web/src/components/scanning/ScanPanel.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { CameraService } from '@/services/camera/camera-service';
import { DecoderService } from '@/services/camera/decoder-service';

interface ScanPanelProps {
  mode: 'single' | 'batch';
  onScan: (result: DecodeResult) => void;
  onClose: () => void;
}

export default function ScanPanel({ mode, onScan, onClose }: ScanPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const cameraService = useRef(new CameraService());
  const decoderService = useRef(new DecoderService());

  useEffect(() => {
    initializeScanner();
    return () => cleanup();
  }, []);

  const initializeScanner = async () => {
    try {
      // Check permission
      const hasPermission = await cameraService.current.requestPermission();
      if (!hasPermission) {
        setError('Camera permission required');
        return;
      }

      // Initialize decoder
      await decoderService.current.initialize();

      // Start camera
      const stream = await cameraService.current.startCamera({
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsScanning(true);
      startDecoding();
    } catch (error) {
      console.error('Scanner init error:', error);
      setError('Failed to start camera');
    }
  };

  const startDecoding = () => {
    const decode = async () => {
      if (!isScanning || !videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // Draw video frame to canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Decode
      const result = await decoderService.current.decode(imageData);

      if (result && result.code !== lastScan) {
        setLastScan(result.code);
        playBeep();
        vibrate();
        onScan(result);
      }

      // Continue scanning
      if (isScanning) {
        requestAnimationFrame(decode);
      }
    };

    decode();
  };

  const toggleTorch = async () => {
    await cameraService.current.enableTorch(!torchEnabled);
    setTorchEnabled(!torchEnabled);
  };

  const switchCamera = async () => {
    await cameraService.current.stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    await initializeScanner();
  };

  const playBeep = () => {
    const audio = new Audio('/sounds/beep.mp3');
    audio.play().catch(() => {});
  };

  const vibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
  };

  const cleanup = () => {
    setIsScanning(false);
    cameraService.current.stopCamera();
    decoderService.current.destroy();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Video Preview */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Canvas for decoding (hidden) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Scan Guide Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-48 border-4 border-white rounded-lg">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500" />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
        <Button onClick={toggleTorch} variant="secondary" className="rounded-full w-12 h-12">
          {torchEnabled ? '🔦' : '💡'}
        </Button>
        <Button onClick={switchCamera} variant="secondary" className="rounded-full w-12 h-12">
          🔄
        </Button>
        <Button onClick={onClose} variant="secondary" className="rounded-full w-12 h-12">
          ✕
        </Button>
      </div>

      {/* Last Scan Display */}
      {lastScan && (
        <div className="absolute top-8 left-0 right-0 flex justify-center">
          <div className="bg-green-500 text-white px-4 py-2 rounded-full">
            {lastScan}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute top-8 left-0 right-0 flex justify-center">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg max-w-md">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 3: API Integration & Standards (2 weeks)

**📋 Spec Reference:** Section 9 (API Contracts), Section 7 (Barcode & Data Standards)

**Context from Spec:**
- POST /scan/events with idempotency key
- 202 Accepted for first-in-window, 200 OK for duplicates
- GS1 AI parsing: (01) GTIN, (10) Batch, (17) Expiry, (21) Serial
- Checksum verification for UPC/EAN
- Idempotency: sha256(tenant:store:code:timebucket)

### Scan API Endpoints

```typescript
// apps/api/src/routes/scan.ts

router.post('/scan/events', requireAuth, async (req, res) => {
  try {
    const {
      tenant_id,
      store_id,
      device_id,
      code,
      symbology,
      captured_at,
      session_id,
      batch_id,
      metadata
    } = req.body;

    // Generate idempotency key
    const timebucket = new Date(captured_at).toISOString().slice(0, 13); // Hour bucket
    const idempotencyKey = createHash('sha256')
      .update(`${tenant_id}:${store_id}:${code}:${timebucket}`)
      .digest('hex');

    // Check for duplicate
    const existing = await prisma.scanEvent.findUnique({
      where: { idempotencyKey }
    });

    if (existing) {
      return res.json({
        status: 'duplicate',
        idempotency_key: idempotencyKey
      });
    }

    // Create scan event
    const scanEvent = await prisma.scanEvent.create({
      data: {
        sessionId: session_id,
        code,
        symbology,
        confidence: metadata?.confidence || 1.0,
        capturedAt: new Date(captured_at),
        idempotencyKey,
        metadata
      }
    });

    // Queue for enrichment
    await enrichmentQueue.add({
      scanEventId: scanEvent.id,
      tenantId: tenant_id,
      code,
      symbology
    });

    res.status(202).json({
      status: 'queued',
      idempotency_key: idempotencyKey,
      scan_event_id: scanEvent.id
    });
  } catch (error) {
    console.error('Scan event error:', error);
    res.status(500).json({ error: 'Failed to process scan event' });
  }
});
```

---

## Phase 4: Batch Mode & State Management (1 week)

**📋 Spec Reference:** Section 5.3 (Batch Mode), Section 3.2 (UI State Machine)

**Context from Spec:**
- Toggle Single/Batch mode
- Batch mode: each decode appends to staging list
- Staging list shows: code → parsed SKU → enrichment state
- Actions: Undo, Edit, Remove, Commit (bulk create/update)
- State machine: IDLE → DETECTING → DECODED → STAGED → COMMIT

---

## Phase 5: Security & Privacy (1 week)

**📋 Spec Reference:** Section 8 (Security & Privacy), Section 8.1 (QR Safe Resolver)

**Context from Spec:**
- Default on-device decoding; no frame transmission
- Optional server-assist mode (feature-flagged)
- Enforce HTTPS, secure contexts
- QR Safe Resolver: never auto-navigate, use allowlist/denylist
- CSP & Permissions-Policy headers
- ROI masking option

---

## Phase 6: Observability & Performance (1 week)

**📋 Spec Reference:** Section 13 (Observability), Section 6.1 (SLOs)

**Context from Spec:**
- Frontend RUM: decode latency (p95 ≤1.5s Android, ≤2.0s iOS), FPS, success rate
- Backend: scan-to-enrichment time, idempotency hit rate
- Trace IDs: UI → Intake → Enrichment → Inventory
- SLO alerts: page alert if >2 days breach

---

## Phase 7: Testing & QA (1 week)

**📋 Spec Reference:** Section 15 (QA & Acceptance Tests), Section 4 (Platform Support)

**Context from Spec:**
- Cross-browser matrix: Android/iOS/Desktop
- Symbology set: UPC-A/E, EAN-13/8, Code128, QR
- Latency benchmarks per device tier
- Offline queue test: 20 scans offline → auto-sync
- Security: verify frames never leave device

---

## Phase 8: Rollout & Canary (1 week)

**📋 Spec Reference:** Section 16 (Rollout Plan), Section 16.1 (Rollback Playbook)

**Context from Spec:**
- Canary: 2 stores, 10 devices, 20% RUM sampling
- Guardrails: auto-disable if p95 >2.5s for 1h or error >5%
- Expand: +10 stores after 7d stable SLOs
- Rollback: one-click feature flag off

---

## Success Criteria

- ✅ Median decode ≤300ms; P95 ≤1.5s (Android), ≤2.0s (iOS)
- ✅ First-code time ≤3.0s over 4G
- ✅ Batch accuracy ≥99.5% (UPC-A/EAN-13)
- ✅ Zero frame uploads by default
- ✅ WCAG 2.1 AA compliance
- ✅ Cross-browser support (iOS/Android/Desktop)

---

## Team Requirements

| Role | Commitment |
|------|------------|
| Frontend Engineer | Full-time |
| Backend Engineer | Full-time |
| QA Engineer | Part-time |
| DevOps Engineer | Part-time |

---

## Resources

**External Dependencies:**
- ZXing WASM library
- Barcode Detection API (Chrome/Edge)
- Camera permissions
- Feature flags service

**Tools:**
- Canvas API
- Web Workers
- getUserMedia API
- Prometheus (metrics)
- Cypress (E2E testing)
