/**
 * Tracking URL Generator
 * Maps carrier names to their public tracking URL templates
 */

const CARRIER_TRACKING_URLS: Record<string, string> = {
  usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}',
  ups: 'https://www.ups.com/track?tracknum={tracking}',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
  dhl: 'https://www.dhl.com/us-en/home/tracking/tracking-parcel.html?submit=1&tracking-id={tracking}',
  amazon: 'https://www.amazon.com/gp/your-account/ship-track/details?trackingId={tracking}',
  ontrac: 'https://www.ontrac.com/tracking.aspx?tracking_number={tracking}',
  lasership: 'https://www.lasership.com/track/{tracking}',
};

/**
 * Generate a tracking URL for a given carrier and tracking number
 * @param carrier - Carrier name (case-insensitive, e.g. "USPS", "FedEx")
 * @param trackingNumber - The tracking number
 * @returns Tracking URL or null if carrier not supported
 */
export function generateTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  if (!carrier || !trackingNumber) return null;

  const normalizedCarrier = carrier.toLowerCase().replace(/[^a-z]/g, '');
  const template = CARRIER_TRACKING_URLS[normalizedCarrier];

  if (!template) return null;

  return template.replace('{tracking}', encodeURIComponent(trackingNumber));
}

/**
 * Check if a carrier has a known tracking URL template
 */
export function isCarrierSupported(carrier: string | null | undefined): boolean {
  if (!carrier) return false;
  const normalizedCarrier = carrier.toLowerCase().replace(/[^a-z]/g, '');
  return normalizedCarrier in CARRIER_TRACKING_URLS;
}

/**
 * Get all supported carrier names
 */
export function getSupportedCarriers(): string[] {
  return Object.keys(CARRIER_TRACKING_URLS).map(c => c.toUpperCase());
}
