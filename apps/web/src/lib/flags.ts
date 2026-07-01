/**
 * Client-side feature flags
 * These are loaded from environment variables at build time
 */

export const Flags = {
  SCAN_ENRICHMENT: process.env.NEXT_PUBLIC_FF_SCAN_ENRICHMENT === 'true',
} as const;

export type FlagName = keyof typeof Flags;
