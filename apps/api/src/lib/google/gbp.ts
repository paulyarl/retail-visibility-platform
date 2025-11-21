/**
 * Google Business Profile (GBP) Integration
 * ENH-2026-044
 * 
 * Read-only access to GBP data (v1)
 */

import { decryptToken, refreshAccessToken, encryptToken } from './oauth';
import { prisma } from '../../prisma';

const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_INSIGHTS_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';

/**
 * Get valid access token (refresh if expired)
 */
async function getValidAccessToken(accountId: string): Promise<string | null> {
  try {
    const tokenRecord = await prisma.google_oauth_tokens.findUnique({
      where: { account_id: accountId },
    });

    if (!tokenRecord) {
      console.error('[GBP] No token found for account:', accountId);
      return null;
    }

    // Check if token is expired
    const now = new Date();
    if (tokenRecord.expires_at <= now) {
      console.log('[GBP] Token expired, refreshing...');
      
      const refreshToken = decryptToken(tokenRecord.refresh_token_encrypted);
      const newTokens = await refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        console.error('[GBP] Failed to refresh token');
        return null;
      }

      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await prisma.google_oauth_tokens.update({
        where: { account_id: accountId },
        data: {
          access_token_encrypted: encryptToken(newTokens.access_token),
          expires_at: newExpiresAt,
          scopes: newTokens.scope.split(' '),
          updatedAt: new Date(),
        },
      });

      return newTokens.access_token;
    }

    return decryptToken(tokenRecord.access_token_encrypted);
  } catch (error) {
    console.error('[GBP] Error getting valid token:', error);
    return null;
  }
}

/**
 * List business accounts
 */
export async function listBusinessAccounts(accountId: string): Promise<any[]> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(`${GBP_INSIGHTS_API}/accounts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GBP] Failed to fetch business accounts:', error);
      return [];
    }

    const data = await response.json();
    return data.accounts || [];
  } catch (error) {
    console.error('[GBP] Error listing business accounts:', error);
    return [];
  }
}

/**
 * List locations for a business account
 */
export async function listLocations(
  accountId: string,
  businessAccountName: string
): Promise<any[]> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(
      `${GBP_API_BASE}/${businessAccountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories,metadata`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GBP] Failed to fetch locations:', error);
      return [];
    }

    const data = await response.json();
    return data.locations || [];
  } catch (error) {
    console.error('[GBP] Error listing locations:', error);
    return [];
  }
}

/**
 * Get location details
 */
export async function getLocation(
  accountId: string,
  locationName: string
): Promise<any | null> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(
      `${GBP_API_BASE}/${locationName}?readMask=*`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GBP] Failed to fetch location:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[GBP] Error getting location:', error);
    return null;
  }
}

/**
 * Sync location to database
 */
export async function syncLocation(
  accountId: string,
  locationData: any
): Promise<boolean> {
  try {
    const locationId = locationData.name.split('/').pop();
    const address = locationData.storefrontAddress;
    const phone = locationData.phoneNumbers?.primaryPhone;

    await prisma.gbp_locations.upsert({
      where: {
        account_id_location_id: {
          account_id: accountId,
          location_id: locationId,
        },
      },
      create: {
        id: `gbp_loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        account_id: accountId,
        location_id: locationId,
        location_name: locationData.title,
        store_code: locationData.storeCode,
        address: address ? formatAddress(address) : null,
        phone_number: phone,
        website_url: locationData.websiteUri,
        category: locationData.categories?.primaryCategory?.displayName,
        is_verified: locationData.metadata?.hasVoiceOfMerchant || false,
        is_published: !locationData.metadata?.duplicate,
        last_fetched_at: new Date(),
        updatedAt: new Date(),
      },
      update: {
        location_name: locationData.title,
        store_code: locationData.storeCode,
        address: address ? formatAddress(address) : null,
        phone_number: phone,
        website_url: locationData.websiteUri,
        category: locationData.categories?.primaryCategory?.displayName,
        is_verified: locationData.metadata?.hasVoiceOfMerchant || false,
        is_published: !locationData.metadata?.duplicate,
        last_fetched_at: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('[GBP] Synced location:', locationId);
    return true;
  } catch (error) {
    console.error('[GBP] Error syncing location:', error);
    return false;
  }
}

/**
 * Format address object to string
 */
function formatAddress(address: any): string {
  const parts = [
    address.addressLines?.join(', '),
    address.locality,
    address.administrativeArea,
    address.postalCode,
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Get location insights (last 30 days)
 */
export async function getLocationInsights(
  accountId: string,
  locationName: string
): Promise<any | null> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    // Calculate date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const requestBody = {
      locationNames: [locationName],
      basicRequest: {
        metricRequests: [
          { metric: 'QUERIES_DIRECT' },
          { metric: 'QUERIES_INDIRECT' },
          { metric: 'VIEWS_MAPS' },
          { metric: 'VIEWS_SEARCH' },
          { metric: 'ACTIONS_WEBSITE' },
          { metric: 'ACTIONS_PHONE' },
          { metric: 'ACTIONS_DRIVING_DIRECTIONS' },
          { metric: 'PHOTOS_COUNT_MERCHANT' },
        ],
        timeRange: {
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      },
    };

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/locations:reportInsights`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GBP] Failed to fetch insights:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[GBP] Error getting location insights:', error);
    return null;
  }
}

/**
 * Store daily insights in database
 */
export async function storeInsights(
  locationId: string,
  date: Date,
  insights: {
    viewsSearch: number;
    viewsMaps: number;
    actionsWebsite: number;
    actionsPhone: number;
    actionsDirections: number;
    photosCount: number;
  }
): Promise<boolean> {
  try {
    await prisma.gbp_insights_daily.upsert({
      where: {
        location_id_date: {
          location_id: locationId,
          date,
        },
      },
      create: {
        id: `gbp_ins_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        location_id: locationId,
        date,
        views_search: insights.viewsSearch,
        views_maps: insights.viewsMaps,
        actions_website: insights.actionsWebsite,
        actions_phone: insights.actionsPhone,
        actions_directions: insights.actionsDirections,
        photos_count: insights.photosCount,
        createdAt: new Date(),
      },
      update: {
        views_search: insights.viewsSearch,
        views_maps: insights.viewsMaps,
        actions_website: insights.actionsWebsite,
        actions_phone: insights.actionsPhone,
        actions_directions: insights.actionsDirections,
        photos_count: insights.photosCount,
      },
    });

    return true;
  } catch (error) {
    console.error('[GBP] Error storing insights:', error);
    return false;
  }
}

/**
 * Get aggregated insights for location
 */
export async function getAggregatedInsights(
  locationId: string,
  days: number = 30
): Promise<any> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const insights = await prisma.gbp_insights_daily.findMany({
      where: {
        location_id: locationId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate totals
    const totals = insights.reduce(
      (acc, day) => ({
        viewsSearch: acc.viewsSearch + day.views_search,
        viewsMaps: acc.viewsMaps + day.views_maps,
        actionsWebsite: acc.actionsWebsite + day.actions_website,
        actionsPhone: acc.actionsPhone + day.actions_phone,
        actionsDirections: acc.actionsDirections + day.actions_directions,
        photosCount: acc.photosCount + day.photos_count,
      }),
      {
        viewsSearch: 0,
        viewsMaps: 0,
        actionsWebsite: 0,
        actionsPhone: 0,
        actionsDirections: 0,
        photosCount: 0,
      }
    );

    return {
      period: `${days} days`,
      totals,
      daily: insights,
    };
  } catch (error) {
    console.error('[GBP] Error getting aggregated insights:', error);
    return null;
  }
}
