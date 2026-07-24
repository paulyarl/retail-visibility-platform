/**
 * P0 Pinterest Pin campaign data for Sprint 3 production.
 *
 * Marketing uses these records to write Pin copy and generate the final
 * outbound links with unique UTM content tags per loop.
 */

export interface PinterestPin {
  /** Internal loop ID (e.g. P-03) */
  loopId: string;
  /** Pin headline shown on Pinterest */
  headline: string;
  /** Destination path on the Visible Shelf site */
  destinationPath: string;
  /** Pinterest board name */
  board: string;
  /** Pin description copy */
  description: string;
  /** 2-5 relevant hashtags */
  hashtags: string[];
  /** Alt text for the Pin image */
  altText: string;
  /** Expected 2:3 hero image asset filename (without extension) */
  heroAsset: string;
}

const BASE_URL =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : 'https://visibleshelf.com';

export const P0_PINS: PinterestPin[] = [
  {
    loopId: 'P-03',
    headline:
      "Stop losing sales to 'I'll come back later' — take a deposit now",
    destinationPath: '/solutions/deposit-commerce',
    board: 'Local Retail Growth',
    description:
      'Capture demand before shoppers walk away. Let customers reserve products with a partial deposit and pay the balance at pickup. Perfect for local retail, BOPIS, and made-to-order goods.',
    hashtags: [
      '#LocalRetail',
      '#BOPIS',
      '#DepositCommerce',
      '#RetailTools',
      '#SmallBusiness',
    ],
    altText:
      'Hand holding a phone showing a reserve-with-deposit checkout screen for a local retail product',
    heroAsset: 'p03-deposit-commerce-hero',
  },
  {
    loopId: 'P-01',
    headline: 'Turn your Clover POS into a full online storefront in 14 days',
    destinationPath: '/solutions/clover-storefront',
    board: 'Clover POS Power Tips',
    description:
      'Sync your Clover POS to a live storefront. Products, inventory, and pricing stay in one place, so you never double-enter data again.',
    hashtags: [
      '#CloverPOS',
      '#OnlineStorefront',
      '#RetailTech',
      '#SmallBusiness',
      '#InventorySync',
    ],
    altText:
      'Split-screen mockup of a Clover POS terminal and a matching online storefront product page',
    heroAsset: 'p01-clover-storefront-hero',
  },
  {
    loopId: 'P-02',
    headline:
      'Get your local store on Google without hiring an agency',
    destinationPath: '/solutions/google-visibility',
    board: 'Get Found on Google',
    description:
      'Connect your Google Business Profile and product catalog so shoppers find you on Search, Maps, and Shopping. No agency required.',
    hashtags: [
      '#GoogleVisibility',
      '#LocalSEO',
      '#GoogleBusinessProfile',
      '#RetailMarketing',
      '#SmallBusiness',
    ],
    altText:
      'Before-and-after Google Search results showing a local store moving up in rankings',
    heroAsset: 'p02-google-visibility-hero',
  },
  {
    loopId: 'P-04',
    headline:
      'Let customers choose: pay in full or reserve for pickup',
    destinationPath: '/solutions/omnichannel',
    board: 'Omnichannel Retail',
    description:
      'Give shoppers the freedom to buy, reserve, or pick up — all from one connected product catalog and inventory system.',
    hashtags: [
      '#Omnichannel',
      '#LocalRetail',
      '#BOPIS',
      '#RetailCheckout',
      '#SmallBusiness',
    ],
    altText:
      'Split-path checkout mockup showing options to pay in full or reserve with deposit',
    heroAsset: 'p04-omnichannel-hero',
  },
  {
    loopId: 'P-10',
    headline:
      'The 3 reasons local products never show up on Google',
    destinationPath: '/guides/google-visibility-checklist',
    board: 'Get Found on Google',
    description:
      'Download the free Google Visibility Checklist and learn the three silent killers hiding your store from local search results.',
    hashtags: [
      '#LocalSEO',
      '#GoogleVisibility',
      '#RetailMarketing',
      '#FreeGuide',
      '#SmallBusiness',
    ],
    altText:
      'Tablet showing a Google Visibility Checklist PDF download page for local retailers',
    heroAsset: 'p10-google-visibility-checklist-hero',
  },
  {
    loopId: 'P-06',
    headline:
      'Create branded QR codes with your store logo — track every scan',
    destinationPath: '/features#qr',
    board: 'QR Code Marketing',
    description:
      'Generate branded QR codes for products, windows, receipts, and campaigns. See which scans turn into sales.',
    hashtags: [
      '#QRCodeMarketing',
      '#RetailTech',
      '#LocalRetail',
      '#TrackScans',
      '#SmallBusiness',
    ],
    altText:
      'Styled grid of branded QR codes for a local store window, product tags, and receipt',
    heroAsset: 'p06-qr-code-grid',
  },
];

/**
 * Build the full outbound Pinterest URL for a given Pin, including the
 * unique UTM content tag and a `ref=pinterest` referral marker.
 */
export function buildPinUrl(pin: PinterestPin): string {
  const params = new URLSearchParams({
    utm_source: 'pinterest',
    utm_medium: 'social',
    utm_campaign: 'rvp_p0_pins',
    utm_content: pin.loopId,
    ref: 'pinterest',
  });

  const base = `${BASE_URL.replace(/\/$/, '')}${pin.destinationPath}`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}

/**
 * Convenience map keyed by loopId for quick lookup.
 */
export const P0_PINS_BY_LOOP = Object.fromEntries(
  P0_PINS.map((pin) => [pin.loopId, pin])
);
