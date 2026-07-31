/**
 * MarketingGbpEnhancerService
 *
 * Enriches Marketing Ops campaigns with contact data sourced from the
 * Google Places API (New). Activates the dormant `gbp_lookup_cache` /
 * `gbp_lookup_cached_at` columns on `mkt_campaigns_list`.
 *
 * Design constraints (see sprint plan §"Non-goals & guardrails"):
 *  - Places API is billable → 72h cache, opt-in enrichment, force-once-per-day
 *  - Never overwrite operator-entered values (null-only sync)
 *  - Soft failure: quota / no-match falls back to audit data, never throws
 *
 * Pattern: singleton extends BaseService (mirrors MarketingCampaignService).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { unifiedConfig } from '../config/unifiedConfig';
import { NotFoundError } from '../middleware/errorHandler';

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_DETAILS_FIELDS = 'formattedAddress,internationalPhoneNumber,nationalPhoneNumber,websiteUri';

const CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const FORCE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours between force-refreshes

export interface PlacesLookupResult {
  placeId?: string;
  formattedAddress?: string;
  phone?: string;
  website?: string;
  source: 'places_api' | 'cache' | 'audit_fallback' | 'no_match';
  cachedAt?: Date;
}

export interface PopulateContactResult {
  phone: string | null;
  websiteUrl: string | null;
  source: 'places_api' | 'cache' | 'audit_fallback' | 'no_match' | 'already_populated';
  populated: string[];
}

interface PlacesTextSearchResponse {
  places?: Array<{
    id: string;
    formattedAddress?: string;
    internationalPhoneNumber?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
  }>;
}

export class MarketingGbpEnhancerService extends BaseService {
  private static instance: MarketingGbpEnhancerService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingGbpEnhancerService {
    if (!MarketingGbpEnhancerService.instance) {
      MarketingGbpEnhancerService.instance = new MarketingGbpEnhancerService();
    }
    return MarketingGbpEnhancerService.instance;
  }

  /**
   * Look up a business via Google Places API (New), with a 72h cache.
   * `force=true` bypasses the cache but is rate-limited to once per day.
   */
  async lookupBusiness(
    campaignId: string,
    ctx?: RequestCtx,
    opts: { force?: boolean } = {},
  ): Promise<PlacesLookupResult> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: {
          business_name: true,
          city: true,
          neighborhood: true,
          gbp_lookup_cache: true,
          gbp_lookup_cached_at: true,
        },
      });
      if (!campaign) throw new NotFoundError('Campaign not found');
      if (!campaign.business_name || !campaign.city) {
        return { source: 'no_match' };
      }

      const now = Date.now();
      const cachedAtMs = campaign.gbp_lookup_cached_at ? new Date(campaign.gbp_lookup_cached_at).getTime() : 0;
      const cacheFresh = campaign.gbp_lookup_cache && (now - cachedAtMs) < CACHE_TTL_MS;

      // Serve from cache unless force is requested AND cooldown has elapsed.
      if (cacheFresh && !opts.force) {
        const cached = campaign.gbp_lookup_cache as any;
        return {
          placeId: cached?.placeId,
          formattedAddress: cached?.formattedAddress,
          phone: cached?.phone,
          website: cached?.website,
          source: 'cache',
          cachedAt: campaign.gbp_lookup_cached_at ?? undefined,
        };
      }
      if (opts.force && cacheFresh && (now - cachedAtMs) < FORCE_COOLDOWN_MS) {
        // Force cooldown: return cached instead of burning quota.
        const cached = campaign.gbp_lookup_cache as any;
        return {
          placeId: cached?.placeId,
          formattedAddress: cached?.formattedAddress,
          phone: cached?.phone,
          website: cached?.website,
          source: 'cache',
          cachedAt: campaign.gbp_lookup_cached_at ?? undefined,
        };
      }

      const apiKey = unifiedConfig.googleMapsApiKey;
      if (!apiKey) {
        logger.warn('GOOGLE_MAPS_API_KEY not configured; skipping Places lookup', ctx, { campaignId });
        return { source: 'no_match' };
      }

      const textQuery = `${campaign.business_name}, ${campaign.city}`;
      const response = await fetch(PLACES_TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri',
        },
        body: JSON.stringify({ textQuery, languageCode: 'en' }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        logger.warn('Places API text search failed', ctx, { campaignId, status: response.status, errBody });
        return { source: 'no_match' };
      }

      const data = (await response.json()) as PlacesTextSearchResponse;
      const place = data.places?.[0];
      if (!place) {
        // Cache the no-match so we don't re-query for 72h.
        await this.prisma.mkt_campaigns_list.update({
          where: { id: campaignId },
          data: { gbp_lookup_cache: { source: 'no_match' } as any, gbp_lookup_cached_at: new Date() },
        });
        return { source: 'no_match' };
      }

      const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || undefined;
      const website = place.websiteUri || undefined;

      const result: PlacesLookupResult = {
        placeId: place.id,
        formattedAddress: place.formattedAddress,
        phone,
        website,
        source: 'places_api',
        cachedAt: new Date(),
      };

      await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          gbp_lookup_cache: {
            placeId: result.placeId,
            formattedAddress: result.formattedAddress,
            phone: result.phone,
            website: result.website,
          } as any,
          gbp_lookup_cached_at: new Date(),
        },
      });

      logger.info('Places lookup succeeded', ctx, { campaignId, placeId: result.placeId });
      return result;
    } catch (error) {
      logger.error('Places lookup failed', ctx, { error: (error as Error).message, campaignId });
      // Soft-fail: never throw from lookup — callers (e.g. transitionStage) rely on this.
      return { source: 'no_match' };
    }
  }

  /**
   * Populate `phone` and `website_url` on a campaign from a Places lookup.
   * Null-only sync: never overwrites operator-entered values.
   */
  async populateContactFields(
    campaignId: string,
    ctx?: RequestCtx,
    opts: { force?: boolean } = {},
  ): Promise<PopulateContactResult> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { phone: true, website_url: true },
      });
      if (!campaign) throw new NotFoundError('Campaign not found');

      // If both already populated and not forced, skip.
      if (campaign.phone && campaign.website_url && !opts.force) {
        return { phone: campaign.phone, websiteUrl: campaign.website_url, source: 'already_populated', populated: [] };
      }

      const lookup = await this.lookupBusiness(campaignId, ctx, opts);

      const populated: string[] = [];
      const updateData: any = {};

      if (!campaign.phone && lookup.phone) {
        updateData.phone = lookup.phone;
        populated.push('phone');
      }
      if (!campaign.website_url && lookup.website) {
        updateData.website_url = lookup.website;
        updateData.has_website = 'yes';
        populated.push('website_url');
      }

      if (populated.length > 0) {
        await this.prisma.mkt_campaigns_list.update({
          where: { id: campaignId },
          data: updateData,
        });
        logger.info('Contact fields populated from GBP', ctx, { campaignId, populated, source: lookup.source });
      }

      return {
        phone: updateData.phone ?? campaign.phone ?? null,
        websiteUrl: updateData.website_url ?? campaign.website_url ?? null,
        source: lookup.source === 'places_api' || lookup.source === 'cache' ? lookup.source : (populated.length > 0 ? lookup.source : 'no_match'),
        populated,
      };
    } catch (error) {
      logger.error('populateContactFields failed', ctx, { error: (error as Error).message, campaignId });
      return { phone: null, websiteUrl: null, source: 'audit_fallback', populated: [] };
    }
  }
}
