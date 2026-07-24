/**
 * Social campaign URL builder for the Meta/Instagram transition pack.
 *
 * Generates UTM-tagged outbound links for the same P0 loops across
 * Pinterest, Instagram, and Facebook.
 */

import { P0_PINS } from '@/lib/pinterest/pinCampaigns';

export type SocialSource = 'pinterest' | 'instagram' | 'facebook';

export interface CampaignUrl {
  loopId: string;
  source: SocialSource;
  medium: 'social' | 'paid_social';
  campaign: string;
  destinationPath: string;
  url: string;
  headline: string;
}

const BASE_URL =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : 'https://visibleshelf.com';

/**
 * Build a single campaign URL with UTM and ref parameters.
 */
export function buildCampaignUrl(
  destinationPath: string,
  source: SocialSource,
  options: {
    medium?: 'social' | 'paid_social';
    campaign?: string;
    content?: string;
    includeRef?: boolean;
  } = {}
): string {
  const {
    medium = 'social',
    campaign = 'rvp_p0_pins',
    content,
    includeRef = true,
  } = options;

  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
  });

  if (content) {
    params.set('utm_content', content);
  }

  if (includeRef) {
    params.set('ref', source);
  }

  const base = `${BASE_URL.replace(/\/$/, '')}${destinationPath}`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}

/**
 * Return the full matrix of P0 campaign URLs across Pinterest,
 * Instagram, and Facebook.
 *
 * Use this as the source-of-truth for the marketing URL matrix.
 */
export function getP0CampaignUrls(): CampaignUrl[] {
  const urls: CampaignUrl[] = [];
  const sources: SocialSource[] = ['pinterest', 'instagram', 'facebook'];

  for (const pin of P0_PINS) {
    for (const source of sources) {
      urls.push({
        loopId: pin.loopId,
        source,
        medium: 'social',
        campaign: 'rvp_p0_pins',
        destinationPath: pin.destinationPath,
        url: buildCampaignUrl(pin.destinationPath, source, {
          content: pin.loopId,
        }),
        headline: pin.headline,
      });
    }
  }

  return urls;
}

/**
 * Convenience map keyed by `loopId` for quick lookup.
 */
export const P0_CAMPAIGNS_BY_LOOP = Object.fromEntries(
  getP0CampaignUrls().map((c) => [`${c.loopId}-${c.source}`, c])
);
