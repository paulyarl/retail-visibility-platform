'use client';

import { useEffect, useRef } from 'react';
import QrAnalyticsService from '@/services/QrAnalyticsService';

/**
 * Hook to track QR code scan events when a visitor arrives via a QR code.
 * Detects `source=qr` URL parameter and fires a scan event to the backend.
 * Only fires once per page load to avoid duplicate tracking.
 *
 * @param tenantId - The tenant ID to attribute the scan to
 * @param surface - Where the QR code was displayed (storefront, product, directory, etc.)
 * @param options - Optional additional tracking data
 */
export function useQrScanTracking(
  tenantId: string | undefined,
  surface: 'storefront' | 'product' | 'directory' | 'qr_landing' | 'promo' | 'private_grant' | 'general',
  options?: {
    productId?: string;
    enabled?: boolean;
  }
) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!tenantId || trackedRef.current) return;
    if (options?.enabled === false) return;

    // Check for QR source parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');

    if (source !== 'qr') return;

    trackedRef.current = true;

    // Fire-and-forget scan event
    QrAnalyticsService.trackScanEvent({
      tenantId,
      surface,
      consumer: 'merchant',
      productId: options?.productId,
      source: 'qr',
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || undefined : undefined,
    });
  }, [tenantId, surface, options?.productId, options?.enabled]);
}
