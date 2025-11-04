/**
 * Client-side feature flags
 * These are loaded from environment variables at build time
 */

export const Flags = {
  // M4: SKU Scanning
  SKU_SCANNING: process.env.NEXT_PUBLIC_FF_SKU_SCANNING === 'true',
  SCAN_CAMERA: process.env.NEXT_PUBLIC_FF_SCAN_CAMERA === 'true',
  SCAN_USB: process.env.NEXT_PUBLIC_FF_SCAN_USB !== 'false', // Enabled by default
  SCAN_ENRICHMENT: process.env.NEXT_PUBLIC_FF_SCAN_ENRICHMENT === 'true',
  SCAN_DUPLICATE_CHECK: process.env.NEXT_PUBLIC_FF_SCAN_DUPLICATE_CHECK !== 'false', // Enabled by default
} as const;

export type FlagName = keyof typeof Flags;
