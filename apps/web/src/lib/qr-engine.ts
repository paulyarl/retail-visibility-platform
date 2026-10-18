/**
 * Shared QR Generation Engine
 *
 * Single source of truth for QR code generation across all surfaces:
 * - QrPreviewPane (settings live preview)
 * - StyledTenantQR (styled QR on merchant surfaces)
 * - TenantQRCode (classic QR on merchant surfaces + download paths)
 * - QRGeneratorClient (admin general-purpose QR generator)
 * - QRCodeGenerator (product item QR codes)
 * - PromoCodeQRDialog (BSaaS promo code QR codes)
 * - PrivateFeatureGrantDialog (admin grant token QR codes)
 *
 * Handles both classic (qrcode lib) and styled (qr-code-styling lib) paths,
 * logo overlay with shape support (square/circle), gradient application
 * to dots, corner squares, and corner dots, and template-based presets
 * so consumers can align with a consistent visual identity.
 */

// ── Templates ──────────────────────────────────────────────────────────

export type QrTemplateName =
  | 'default'
  | 'promo'
  | 'promo-sale'
  | 'bundle-promo'
  | 'private-grant'
  | 'merchant-promo'
  | 'coupon-flash'
  | 'coupon-free-ship'
  | 'coupon-bogo'
  | 'report-audit'
  | 'claim-invite';

export interface QrTemplate {
  name: QrTemplateName;
  label: string;
  description: string;
  defaults: Partial<QrEngineOptions>;
}

export const QR_TEMPLATES: Record<QrTemplateName, QrTemplate> = {
  default: {
    name: 'default',
    label: 'Default',
    description: 'Standard merchant QR style',
    defaults: {
      styled: true,
      dotType: 'rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#1a56db',
      cornerColor: '#1a56db',
      cornerDotColor: '#ffffff',
      bgColor: '#ffffff',
      gradientEnabled: false,
      gradientStart: '#1a56db',
      gradientEnd: '#7c3aed',
      logoShape: 'square',
    },
  },
  promo: {
    name: 'promo',
    label: 'Promo (Default)',
    description: 'General marketing',
    defaults: {
      styled: true,
      dotType: 'rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#1a56db',
      cornerColor: '#1a56db',
      cornerDotColor: '#ffffff',
      bgColor: '#f8fafc',
      gradientEnabled: false,
      gradientStart: '#1a56db',
      gradientEnd: '#7c3aed',
      logoShape: 'square',
    },
  },
  'promo-sale': {
    name: 'promo-sale',
    label: 'Promo (Sale)',
    description: 'Flash sales, limited-time',
    defaults: {
      styled: true,
      dotType: 'classy-rounded',
      cornerType: 'rounded',
      cornerDotType: 'dot',
      dotColor: '#dc2626',
      cornerColor: '#dc2626',
      cornerDotColor: '#ffffff',
      bgColor: '#fef2f2',
      gradientEnabled: false,
      gradientStart: '#dc2626',
      gradientEnd: '#7c3aed',
      logoShape: 'square',
    },
  },
  'bundle-promo': {
    name: 'bundle-promo',
    label: 'Bundle Promo',
    description: 'Bundle discount campaigns',
    defaults: {
      styled: true,
      dotType: 'extra-rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#16a34a',
      cornerColor: '#16a34a',
      cornerDotColor: '#ffffff',
      bgColor: '#f0fdf4',
      gradientEnabled: false,
      gradientStart: '#16a34a',
      gradientEnd: '#7c3aed',
      logoShape: 'square',
    },
  },
  'merchant-promo': {
    name: 'merchant-promo',
    label: 'Merchant Promo',
    description: 'Merchant coupon promotion',
    defaults: {
      styled: true,
      dotType: 'rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#f59e0b',
      cornerColor: '#f59e0b',
      cornerDotColor: '#ffffff',
      bgColor: '#fffbeb',
      gradientEnabled: false,
      gradientStart: '#f59e0b',
      gradientEnd: '#d97706',
      logoShape: 'square',
    },
  },
  'coupon-flash': {
    name: 'coupon-flash',
    label: 'Coupon Flash',
    description: 'Flash sale coupon',
    defaults: {
      styled: true,
      dotType: 'classy-rounded',
      cornerType: 'rounded',
      cornerDotType: 'dot',
      dotColor: '#dc2626',
      cornerColor: '#dc2626',
      cornerDotColor: '#ffffff',
      bgColor: '#fef2f2',
      gradientEnabled: false,
      gradientStart: '#dc2626',
      gradientEnd: '#991b1b',
      logoShape: 'square',
    },
  },
  'coupon-free-ship': {
    name: 'coupon-free-ship',
    label: 'Coupon Free Shipping',
    description: 'Free shipping offer',
    defaults: {
      styled: true,
      dotType: 'rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#16a34a',
      cornerColor: '#16a34a',
      cornerDotColor: '#ffffff',
      bgColor: '#f0fdf4',
      gradientEnabled: false,
      gradientStart: '#16a34a',
      gradientEnd: '#15803d',
      logoShape: 'square',
    },
  },
  'coupon-bogo': {
    name: 'coupon-bogo',
    label: 'Coupon BOGO',
    description: 'Buy one get one offer',
    defaults: {
      styled: true,
      dotType: 'extra-rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#9333ea',
      cornerColor: '#9333ea',
      cornerDotColor: '#ffffff',
      bgColor: '#faf5ff',
      gradientEnabled: false,
      gradientStart: '#9333ea',
      gradientEnd: '#6b21a8',
      logoShape: 'square',
    },
  },
  'private-grant': {
    name: 'private-grant',
    label: 'Private Grant',
    description: 'Enterprise deals, trade shows',
    defaults: {
      styled: true,
      dotType: 'dots',
      cornerType: 'dot',
      cornerDotType: 'dot',
      dotColor: '#7c3aed',
      cornerColor: '#7c3aed',
      cornerDotColor: '#ffffff',
      bgColor: '#faf5ff',
      gradientEnabled: false,
      gradientStart: '#7c3aed',
      gradientEnd: '#1a56db',
      logoShape: 'square',
    },
  },
  // Seed/directory surfaces — the seed QR kits (claim invite + report
  // delivery + on-page banner) pick from these per-surface, like the coupon
  // dialog's COUPON_TEMPLATES subset.
  'report-audit': {
    name: 'report-audit',
    label: 'Report',
    description: 'Business report links & banners',
    defaults: {
      styled: true,
      dotType: 'classy-rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#0f3a5f',
      cornerColor: '#0f3a5f',
      cornerDotColor: '#ffffff',
      bgColor: '#f0f9ff',
      gradientEnabled: true,
      gradientStart: '#0f3a5f',
      gradientEnd: '#0284c7',
      logoShape: 'square',
    },
  },
  'claim-invite': {
    name: 'claim-invite',
    label: 'Claim Invite',
    description: 'Business claim links & cards',
    defaults: {
      styled: true,
      dotType: 'rounded',
      cornerType: 'extra-rounded',
      cornerDotType: 'dot',
      dotColor: '#047857',
      cornerColor: '#047857',
      cornerDotColor: '#ffffff',
      bgColor: '#ecfdf5',
      gradientEnabled: false,
      gradientStart: '#047857',
      gradientEnd: '#10b981',
      logoShape: 'square',
    },
  },
};

export const QR_TEMPLATE_LIST = Object.values(QR_TEMPLATES);

/**
 * Persisted QR design — the camelCase projection of a
 * tenant_storefront_qr_settings row (the storefront_qr capability module's
 * per-tenant style storage). Used for surfaces that render an
 * operator/merchant-authored design rather than a live template —
 * e.g. the directory-seed report banner on /place/[slug].
 */
export interface PersistedQrStyle {
  dotType?: string;
  cornerType?: string;
  cornerDotType?: string;
  dotColor?: string;
  cornerColor?: string;
  cornerDotColor?: string;
  bgColor?: string;
  customColorsEnabled?: boolean;
  gradientEnabled?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
  gradientOnDots?: boolean;
  gradientOnCorners?: boolean;
  gradientOnCornerDots?: boolean;
  /** Embed a logo in the QR center. */
  logo?: boolean;
  logoShape?: string;
}

// ── Options ────────────────────────────────────────────────────────────

export interface QrEngineOptions {
  /** URL/data to encode in the QR code */
  data: string;
  /** Export size in pixels */
  exportSize: number;
  /** Whether to use styled QR (qr-code-styling) or classic (qrcode) */
  styled: boolean;
  /** Template name — applies defaults that consumer overrides take precedence over */
  template?: QrTemplateName;
  /** Logo URL to overlay on the QR code, or null for no logo */
  logoUrl?: string | null;
  /** Logo cutout shape: 'square' or 'circle' */
  logoShape?: string;
  /** Error correction level */
  errorCorrection?: 'H' | 'M';

  // Styled options (ignored for classic)
  dotType?: string;
  cornerType?: string;
  cornerDotType?: string;
  dotColor?: string;
  cornerColor?: string;
  cornerDotColor?: string;
  bgColor?: string;
  gradientEnabled?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
  /** Apply gradient to dots (defaults to true when gradientEnabled) */
  gradientOnDots?: boolean;
  /** Apply gradient to corner squares (defaults to true when gradientEnabled) */
  gradientOnCorners?: boolean;
  /** Apply gradient to corner dots (defaults to true when gradientEnabled) */
  gradientOnCornerDots?: boolean;
}

/**
 * Resolve options by merging template defaults with consumer overrides.
 * Consumer-provided values always take precedence over template defaults.
 */
function resolveOptions(opts: QrEngineOptions): QrEngineOptions {
  if (!opts.template) return opts;
  const tpl = QR_TEMPLATES[opts.template];
  if (!tpl) return opts;
  const merged = { ...tpl.defaults, ...opts } as QrEngineOptions;
  delete merged.template;
  return merged;
}

/**
 * Generate a QR code and return a PNG data URL.
 *
 * - Styled path: uses qr-code-styling, then overlays logo manually (library
 *   doesn't support imageShape, so we generate without image and overlay after).
 * - Classic path: uses qrcode library, then overlays logo manually.
 *
 * Both paths use the same overlayLogoOnQR helper for consistent logo rendering.
 */
/**
 * Build a QRCodeStyling instance from engine options.
 * For consumers that need to append directly to DOM or use .download({ extension: 'svg' }).
 * Applies template defaults, gradient on all elements, and correct error correction.
 * Logo is NOT embedded via the library (imageShape is broken) — use generateQrDataUrl
 * if you need logo overlay. This is for live-preview-style consumers that don't need logos.
 */
export async function generateQrInstance(opts: QrEngineOptions): Promise<any> {
  const { default: QRCodeStyling } = await import('qr-code-styling');
  const resolved = resolveOptions(opts);

  const {
    data,
    exportSize,
    logoUrl,
    errorCorrection = logoUrl ? 'H' : 'M',
    dotType = 'rounded',
    cornerType = 'extra-rounded',
    cornerDotType = 'dot',
    dotColor = '#1a56db',
    cornerColor = '#1a56db',
    cornerDotColor = '#ffffff',
    bgColor = '#ffffff',
    gradientEnabled = false,
    gradientStart = '#1a56db',
    gradientEnd = '#7c3aed',
    gradientOnDots = true,
    gradientOnCorners = true,
    gradientOnCornerDots = true,
  } = resolved;

  const gradient = gradientEnabled
    ? {
        type: 'linear' as const,
        rotation: 45,
        colorStops: [
          { offset: 0, color: gradientStart },
          { offset: 1, color: gradientEnd },
        ],
      }
    : undefined;

  return new QRCodeStyling({
    width: exportSize,
    height: exportSize,
    type: 'svg',
    data,
    dotsOptions: { color: dotColor, type: dotType as any, gradient: gradientEnabled && gradientOnDots ? gradient : undefined },
    cornersSquareOptions: { color: cornerColor, type: cornerType as any, gradient: gradientEnabled && gradientOnCorners ? gradient : undefined },
    cornersDotOptions: { color: cornerDotColor, type: cornerDotType as any, gradient: gradientEnabled && gradientOnCornerDots ? gradient : undefined },
    backgroundOptions: { color: bgColor },
    qrOptions: { errorCorrectionLevel: errorCorrection },
  });
}

/**
 * Generate a QR code and return a PNG data URL.
 *
 * - Styled path: uses qr-code-styling, then overlays logo manually (library
 *   doesn't support imageShape, so we generate without image and overlay after).
 * - Classic path: uses qrcode library, then overlays logo manually.
 *
 * Both paths use the same overlayLogoOnQR helper for consistent logo rendering.
 */
export async function generateQrDataUrl(opts: QrEngineOptions): Promise<string> {
  const resolved = resolveOptions(opts);
  const { styled } = resolved;

  if (styled) {
    // Overall bound on the styled path — every image load inside is
    // individually timeout-guarded, but a caller should never be left
    // pending if the library itself stalls for an unforeseen reason.
    return Promise.race([
      generateStyledQr(resolved),
      rejectAfter(6000, 'styled_qr_timeout'),
    ]);
  }
  return generateClassicQr(resolved);
}

/**
 * Generate a styled QR code using qr-code-styling library.
 * Logo is overlaid manually after generation (library ignores imageShape).
 */
async function generateStyledQr(opts: QrEngineOptions): Promise<string> {
  const resolved = resolveOptions(opts);
  const { default: QRCodeStyling } = await import('qr-code-styling');

  const {
    data,
    exportSize,
    logoUrl,
    logoShape = 'square',
    errorCorrection = logoUrl ? 'H' : 'M',
    dotType = 'rounded',
    cornerType = 'extra-rounded',
    cornerDotType = 'dot',
    dotColor = '#1a56db',
    cornerColor = '#1a56db',
    cornerDotColor = '#ffffff',
    bgColor = '#ffffff',
    gradientEnabled = false,
    gradientStart = '#1a56db',
    gradientEnd = '#7c3aed',
    gradientOnDots = true,
    gradientOnCorners = true,
    gradientOnCornerDots = true,
  } = resolved;

  const gradient = gradientEnabled
    ? {
        type: 'linear' as const,
        rotation: 45,
        colorStops: [
          { offset: 0, color: gradientStart },
          { offset: 1, color: gradientEnd },
        ],
      }
    : undefined;

  const qr = new QRCodeStyling({
    width: exportSize,
    height: exportSize,
    type: 'svg',
    data,
    dotsOptions: {
      color: dotColor,
      type: dotType as any,
      gradient: gradientEnabled && gradientOnDots ? gradient : undefined,
    },
    cornersSquareOptions: {
      color: cornerColor,
      type: cornerType as any,
      gradient: gradientEnabled && gradientOnCorners ? gradient : undefined,
    },
    cornersDotOptions: {
      color: cornerDotColor,
      type: cornerDotType as any,
      gradient: gradientEnabled && gradientOnCornerDots ? gradient : undefined,
    },
    backgroundOptions: { color: bgColor },
    qrOptions: { errorCorrectionLevel: errorCorrection },
  });

  // Rasterize the svg ourselves — the lib's internal png path loads the
  // serialized svg through an Image with only onload wired (no onerror/
  // timeout) and draws it at its intrinsic size, so a suppressed or
  // zero-size raster resolves to a fully transparent PNG. Drawing
  // explicitly-sized and verifying the output isn't blank turns those
  // silent failures into rejections callers can fall back from.
  const svgBlob = await qr.getRawData('svg');
  if (!(svgBlob instanceof Blob)) {
    throw new Error('Failed to generate styled QR svg');
  }
  const svgUrl = URL.createObjectURL(svgBlob);
  let qrImg: HTMLImageElement;
  try {
    qrImg = await loadImageWithTimeout(svgUrl, 4000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }

  const canvas = document.createElement('canvas');
  canvas.width = exportSize;
  canvas.height = exportSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(qrImg, 0, 0, exportSize, exportSize);
  if (!canvasHasQrContent(ctx, exportSize)) {
    throw new Error('styled_qr_blank');
  }

  if (logoUrl) {
    try {
      const finalCanvas = await overlayLogoOnQRAsync(canvas, logoUrl, logoShape);
      return finalCanvas.toDataURL('image/png', 1.0);
    } catch {
      // fallback to plain QR
    }
  }

  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Load an image with both error and timeout handling — qr-code-styling's
 * internal raster path wires onload only, so a failed data/blob-URI load
 * never settles. Our own path must not inherit that hang.
 */
function loadImageWithTimeout(src: string, ms: number, crossOrigin?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('image_load_timeout'));
    }, ms);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image_load_error'));
    };
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.src = src;
  });
}

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * True when the canvas contains real QR content, not a blank or partial
 * raster. Failure modes covered:
 *
 * - fully transparent output (suppressed svg raster, zero-size drawImage)
 * - background-only output (a fill that fails to rasterize — e.g. an svg
 *   linearGradient that some GPU-accelerated img rasters render as
 *   transparent — leaves every pixel at the bg color)
 * - partial output (corner marks paint but dots don't — a handful of big
 *   shapes still differs from bg enough to pass a coarse count)
 *
 * The check samples the CENTER of the canvas: QR data modules always cover
 * the middle while the failure modes above leave it at the background
 * color. (0,0) sits inside the quiet zone, so it samples the background.
 */
function canvasHasQrContent(ctx: CanvasRenderingContext2D, size: number): boolean {
  const { data: outer } = ctx.getImageData(0, 0, 1, 1);
  const br = outer[0], bg = outer[1], bb = outer[2], ba = outer[3];

  const midStart = Math.floor(size * 0.25);
  const midSize = size - midStart * 2;
  const { data } = ctx.getImageData(midStart, midStart, midSize, midSize);
  let opaque = 0, content = 0;
  for (let i = 0; i < data.length; i += 16) {
    const a = data[i + 3];
    if (a !== 0) opaque++;
    if (
      Math.abs(data[i] - br) > 24 ||
      Math.abs(data[i + 1] - bg) > 24 ||
      Math.abs(data[i + 2] - bb) > 24 ||
      Math.abs(a - ba) > 24
    ) {
      content++;
    }
  }
  return opaque > 0 && content > 64;
}

/**
 * Generate a classic black-and-white QR code using qrcode library.
 * Logo is overlaid manually with shape support.
 */
async function generateClassicQr(opts: QrEngineOptions): Promise<string> {
  const resolved = resolveOptions(opts);
  const QRCode = (await import('qrcode')).default;

  const {
    data,
    exportSize,
    logoUrl,
    logoShape = 'square',
    errorCorrection = logoUrl ? 'H' : 'M',
  } = resolved;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = exportSize;
  canvas.height = exportSize;

  await QRCode.toCanvas(canvas, data, {
    width: exportSize,
    margin: exportSize >= 2048 ? 4 : exportSize >= 1024 ? 3 : 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: errorCorrection,
  });

  if (logoUrl) {
    try {
      const finalCanvas = await overlayLogoOnQRAsync(canvas, logoUrl, logoShape);
      return finalCanvas.toDataURL('image/png', 1.0);
    } catch {
      // fallback to plain QR
    }
  }

  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Overlay a logo image on a QR code canvas with shape support.
 * Supports 'square' and 'circle' cutout shapes.
 *
 * This is the single implementation used by all QR generation paths.
 * Always async because Image loading is inherently async.
 */
export async function overlayLogoOnQRAsync(
  qrCanvas: HTMLCanvasElement,
  logoSrc: string,
  logoShape: string,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const isCircle = logoShape === 'circle';

  // Bounded load — a stalled logo request (remote storage URL, service-worker
  // interception, etc.) must degrade to a plain QR rather than hang the
  // caller's generation promise forever.
  const img = await loadImageWithTimeout(logoSrc, 4000, 'anonymous');

  canvas.width = qrCanvas.width;
  canvas.height = qrCanvas.height;
  ctx.drawImage(qrCanvas, 0, 0);

  const logoSize = Math.floor(canvas.width * 0.30);
  const logoX = (canvas.width - logoSize) / 2;
  const logoY = (canvas.height - logoSize) / 2;

  ctx.fillStyle = '#FFFFFF';
  if (isCircle) {
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(logoX - 6, logoY - 6, logoSize + 12, logoSize + 12);
  }

  ctx.save();
  if (isCircle) {
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(logoX, logoY, logoSize, logoSize);
    ctx.clip();
  }
  ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
  ctx.restore();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  if (isCircle) {
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(logoX - 3, logoY - 3, logoSize + 6, logoSize + 6);
  }

  return canvas;
}
