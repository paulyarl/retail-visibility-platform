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
    const tokenRecord = await prisma.googleOAuthToken.findUnique({
      where: { accountId },
    });

    if (!tokenRecord) {
      console.error('[GBP] No token found for account:', accountId);
      return null;
    }

    // Check if token is expired
    const now = new Date();
    if (tokenRecord.expiresAt <= now) {
      console.log('[GBP] Token expired, refreshing...');
      
      const refreshToken = decryptToken(tokenRecord.refreshTokenEncrypted);
      const newTokens = await refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        console.error('[GBP] Failed to refresh token');
        return null;
      }

      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await prisma.googleOAuthToken.update({
        where: { accountId },
        data: {
          accessTokenEncrypted: encryptToken(newTokens.access_token),
          expiresAt: newExpiresAt,
          scopes: newTokens.scope.split(' '),
        },
      });

      return newTokens.access_token;
    }

    return decryptToken(tokenRecord.accessTokenEncrypted);
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

    await prisma.gbpLocation.upsert({
      where: {
        accountId_locationId: {
          accountId,
          locationId,
        },
      },
      create: {
        accountId,
        locationId,
        locationName: locationData.title,
        storeCode: locationData.storeCode,
        address: address ? formatAddress(address) : null,
        phoneNumber: phone,
        websiteUrl: locationData.websiteUri,
        category: locationData.categories?.primaryCategory?.displayName,
        isVerified: locationData.metadata?.hasVoiceOfMerchant || false,
        isPublished: !locationData.metadata?.duplicate,
        lastFetchedAt: new Date(),
      },
      update: {
        locationName: locationData.title,
        storeCode: locationData.storeCode,
        address: address ? formatAddress(address) : null,
        phoneNumber: phone,
        websiteUrl: locationData.websiteUri,
        category: locationData.categories?.primaryCategory?.displayName,
        isVerified: locationData.metadata?.hasVoiceOfMerchant || false,
        isPublished: !locationData.metadata?.duplicate,
        lastFetchedAt: new Date(),
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
    await prisma.gbpInsightDaily.upsert({
      where: {
        locationId_date: {
          locationId,
          date,
        },
      },
      create: {
        locationId,
        date,
        ...insights,
      },
      update: insights,
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

    const insights = await prisma.gbpInsightDaily.findMany({
      where: {
        locationId,
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
        viewsSearch: acc.viewsSearch + day.viewsSearch,
        viewsMaps: acc.viewsMaps + day.viewsMaps,
        actionsWebsite: acc.actionsWebsite + day.actionsWebsite,
        actionsPhone: acc.actionsPhone + day.actionsPhone,
        actionsDirections: acc.actionsDirections + day.actionsDirections,
        photosCount: acc.photosCount + day.photosCount,
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
