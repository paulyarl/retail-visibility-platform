/**
 * Google Business Profile - Business Info Sync Service
 * 
 * Syncs business information from platform to Google Business Profile:
 * - Business name
 * - Phone number
 * - Website URL
 * - Address
 * - Description
 * - Categories (primary + secondary)
 * 
 * This service enables the platform to be the single source of truth
 * for businesses syncing their data to Google.
 */

import { prisma } from '../prisma';

const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';

interface BusinessInfo {
  name?: string;
  phone?: string;
  website?: string;
  address?: {
    addressLines?: string[];
    locality?: string;        // city
    administrativeArea?: string;  // state
    postalCode?: string;
    regionCode?: string;      // country code, e.g., 'US'
  };
  description?: string;
}

interface CategoryInfo {
  primaryCategoryId?: string;
  secondaryCategoryIds?: string[];
}

interface SyncResult {
  success: boolean;
  field: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

interface FullSyncResult {
  success: boolean;
  results: SyncResult[];
  syncedFields: string[];
  failedFields: string[];
  skippedFields: string[];
}

/**
 * Get valid GBP access token for a tenant
 * Handles token refresh if expired
 */
async function getValidAccessToken(tenantId: string): Promise<string | null> {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        google_business_access_token: true,
        google_business_refresh_token: true,
        google_business_token_expiry: true,
      }
    });

    if (!tenant?.google_business_access_token) {
      console.log(`[GBPBusinessInfoSync] No GBP token for tenant ${tenantId}`);
      return null;
    }

    // Check if token is expired
    if (tenant.google_business_token_expiry && new Date(tenant.google_business_token_expiry) < new Date()) {
      // Token expired - try to refresh
      if (tenant.google_business_refresh_token) {
        const { google } = await import('googleapis');
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_BUSINESS_CLIENT_ID,
          process.env.GOOGLE_BUSINESS_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: tenant.google_business_refresh_token });
        
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          
          // Update stored token
          await prisma.tenants.update({
            where: { id: tenantId },
            data: {
              google_business_access_token: credentials.access_token,
              google_business_token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            }
          });
          
          return credentials.access_token!;
        } catch (refreshError) {
          console.error(`[GBPBusinessInfoSync] Token refresh failed for tenant ${tenantId}:`, refreshError);
          return null;
        }
      }
      return null;
    }

    return tenant.google_business_access_token;
  } catch (error) {
    console.error(`[GBPBusinessInfoSync] Error getting token for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Get linked GBP location for a tenant
 */
async function getLinkedLocation(tenantId: string): Promise<string | null> {
  try {
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        gbp_locations_list: {
          take: 1,
          orderBy: { updated_at: 'desc' }
        }
      }
    });

    return account?.gbp_locations_list[0]?.location_id || null;
  } catch (error) {
    console.error(`[GBPBusinessInfoSync] Error getting linked location for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Sync business name to Google
 */
export async function syncBusinessName(
  tenantId: string,
  businessName: string
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, field: 'name', error: 'No valid access token' };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return { success: true, field: 'name', skipped: true, reason: 'No GBP location linked' };
    }

    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?updateMask=title`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: businessName,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to sync business name:`, error);
      return { success: false, field: 'name', error: `API error: ${response.status}` };
    }

    console.log(`[GBPBusinessInfoSync] Synced business name for tenant ${tenantId}`);
    return { success: true, field: 'name' };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error syncing business name:`, error);
    return { success: false, field: 'name', error: error.message };
  }
}

/**
 * Sync phone number to Google
 */
export async function syncPhoneNumber(
  tenantId: string,
  phoneNumber: string
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, field: 'phone', error: 'No valid access token' };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return { success: true, field: 'phone', skipped: true, reason: 'No GBP location linked' };
    }

    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?updateMask=phoneNumbers`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumbers: {
            primaryPhone: phoneNumber,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to sync phone:`, error);
      return { success: false, field: 'phone', error: `API error: ${response.status}` };
    }

    console.log(`[GBPBusinessInfoSync] Synced phone for tenant ${tenantId}`);
    return { success: true, field: 'phone' };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error syncing phone:`, error);
    return { success: false, field: 'phone', error: error.message };
  }
}

/**
 * Sync website URL to Google
 */
export async function syncWebsite(
  tenantId: string,
  websiteUrl: string
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, field: 'website', error: 'No valid access token' };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return { success: true, field: 'website', skipped: true, reason: 'No GBP location linked' };
    }

    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?updateMask=websiteUri`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteUri: websiteUrl,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to sync website:`, error);
      return { success: false, field: 'website', error: `API error: ${response.status}` };
    }

    console.log(`[GBPBusinessInfoSync] Synced website for tenant ${tenantId}`);
    return { success: true, field: 'website' };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error syncing website:`, error);
    return { success: false, field: 'website', error: error.message };
  }
}

/**
 * Sync address to Google
 */
export async function syncAddress(
  tenantId: string,
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  }
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, field: 'address', error: 'No valid access token' };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return { success: true, field: 'address', skipped: true, reason: 'No GBP location linked' };
    }

    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?updateMask=storefrontAddress`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storefrontAddress: {
            addressLines: [address.street],
            locality: address.city,
            administrativeArea: address.state,
            postalCode: address.zip,
            regionCode: address.country || 'US',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to sync address:`, error);
      return { success: false, field: 'address', error: `API error: ${response.status}` };
    }

    console.log(`[GBPBusinessInfoSync] Synced address for tenant ${tenantId}`);
    return { success: true, field: 'address' };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error syncing address:`, error);
    return { success: false, field: 'address', error: error.message };
  }
}

/**
 * Sync business description to Google
 */
export async function syncDescription(
  tenantId: string,
  description: string
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, field: 'description', error: 'No valid access token' };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return { success: true, field: 'description', skipped: true, reason: 'No GBP location linked' };
    }

    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?updateMask=profile`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: {
            description: description,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to sync description:`, error);
      return { success: false, field: 'description', error: `API error: ${response.status}` };
    }

    console.log(`[GBPBusinessInfoSync] Synced description for tenant ${tenantId}`);
    return { success: true, field: 'description' };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error syncing description:`, error);
    return { success: false, field: 'description', error: error.message };
  }
}

/**
 * Sync categories to Google
 * Note: Category IDs must be valid GBP category IDs (e.g., "gcid:grocery_store")
 */
export async function syncCategories(
  tenantId: string,
  primaryCategoryId: string,
  secondaryCategoryIds?: string[]
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, field: 'categories', error: 'No valid access token' };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return { success: true, field: 'categories', skipped: true, reason: 'No GBP location linked' };
    }

    const categoriesPayload: any = {
      primaryCategory: {
        name: primaryCategoryId,
      },
    };

    if (secondaryCategoryIds && secondaryCategoryIds.length > 0) {
      categoriesPayload.additionalCategories = secondaryCategoryIds.map(id => ({
        name: id,
      }));
    }

    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?updateMask=categories`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: categoriesPayload,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to sync categories:`, error);
      return { success: false, field: 'categories', error: `API error: ${response.status}` };
    }

    console.log(`[GBPBusinessInfoSync] Synced categories for tenant ${tenantId}`);
    return { success: true, field: 'categories' };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error syncing categories:`, error);
    return { success: false, field: 'categories', error: error.message };
  }
}

/**
 * Sync all business info to Google in one call
 * More efficient than individual calls
 */
export async function syncAllBusinessInfo(
  tenantId: string,
  info: BusinessInfo & CategoryInfo
): Promise<FullSyncResult> {
  const results: SyncResult[] = [];
  const syncedFields: string[] = [];
  const failedFields: string[] = [];
  const skippedFields: string[] = [];

  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return {
        success: false,
        results: [{ success: false, field: 'all', error: 'No valid access token' }],
        syncedFields: [],
        failedFields: ['all'],
        skippedFields: [],
      };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return {
        success: true,
        results: [{ success: true, field: 'all', skipped: true, reason: 'No GBP location linked' }],
        syncedFields: [],
        failedFields: [],
        skippedFields: ['all'],
      };
    }

    // Build update mask and payload
    const updateMaskParts: string[] = [];
    const payload: any = {};

    if (info.name) {
      updateMaskParts.push('title');
      payload.title = info.name;
    }

    if (info.phone) {
      updateMaskParts.push('phoneNumbers');
      payload.phoneNumbers = { primaryPhone: info.phone };
    }

    if (info.website) {
      updateMaskParts.push('websiteUri');
      payload.websiteUri = info.website;
    }

    if (info.address) {
      updateMaskParts.push('storefrontAddress');
      payload.storefrontAddress = {
        addressLines: info.address.addressLines || [],
        locality: info.address.locality,
        administrativeArea: info.address.administrativeArea,
        postalCode: info.address.postalCode,
        regionCode: info.address.regionCode || 'US',
      };
    }

    if (info.description) {
      updateMaskParts.push('profile');
      payload.profile = { description: info.description };
    }

    if (info.primaryCategoryId) {
      updateMaskParts.push('categories');
      payload.categories = {
        primaryCategory: { name: info.primaryCategoryId },
      };
      if (info.secondaryCategoryIds && info.secondaryCategoryIds.length > 0) {
        payload.categories.additionalCategories = info.secondaryCategoryIds.map(id => ({ name: id }));
      }
    }

    if (updateMaskParts.length === 0) {
      return {
        success: true,
        results: [{ success: true, field: 'all', skipped: true, reason: 'No fields to sync' }],
        syncedFields: [],
        failedFields: [],
        skippedFields: ['all'],
      };
    }

    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?updateMask=${updateMaskParts.join(',')}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to sync all business info:`, error);
      
      return {
        success: false,
        results: [{ success: false, field: 'all', error: `API error: ${response.status} - ${error}` }],
        syncedFields: [],
        failedFields: updateMaskParts,
        skippedFields: [],
      };
    }

    console.log(`[GBPBusinessInfoSync] Synced all business info for tenant ${tenantId}:`, updateMaskParts);

    // Record sync timestamp
    await recordSyncTimestamp(tenantId, updateMaskParts);

    return {
      success: true,
      results: updateMaskParts.map(field => ({ success: true, field })),
      syncedFields: updateMaskParts,
      failedFields: [],
      skippedFields: [],
    };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error syncing all business info:`, error);
    return {
      success: false,
      results: [{ success: false, field: 'all', error: error.message }],
      syncedFields: [],
      failedFields: ['all'],
      skippedFields: [],
    };
  }
}

/**
 * Record sync timestamp in tenant metadata
 */
async function recordSyncTimestamp(tenantId: string, fields: string[]): Promise<void> {
  try {
    // Update tenant_business_profiles_list with sync timestamp
    await prisma.tenant_business_profiles_list.updateMany({
      where: { tenant_id: tenantId },
      data: {
        updated_at: new Date(),
      }
    });

    console.log(`[GBPBusinessInfoSync] Recorded sync timestamp for tenant ${tenantId}`);
  } catch (error) {
    console.error(`[GBPBusinessInfoSync] Error recording sync timestamp:`, error);
  }
}

/**
 * Get sync status for a tenant
 */
export async function getSyncStatus(tenantId: string): Promise<{
  hasGBPConnection: boolean;
  hasLinkedLocation: boolean;
  lastSyncedAt: Date | null;
  canSync: boolean;
}> {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        google_business_access_token: true,
      }
    });

    const locationId = await getLinkedLocation(tenantId);

    const businessProfile = await prisma.tenant_business_profiles_list.findFirst({
      where: { tenant_id: tenantId },
      select: {
        updated_at: true,
      }
    });

    return {
      hasGBPConnection: !!tenant?.google_business_access_token,
      hasLinkedLocation: !!locationId,
      lastSyncedAt: businessProfile?.updated_at || null,
      canSync: !!tenant?.google_business_access_token && !!locationId,
    };
  } catch (error) {
    console.error(`[GBPBusinessInfoSync] Error getting sync status:`, error);
    return {
      hasGBPConnection: false,
      hasLinkedLocation: false,
      lastSyncedAt: null,
      canSync: false,
    };
  }
}

// ============================================================================
// READ FROM GOOGLE - Fetch current data from Google Business Profile
// ============================================================================

export interface GoogleBusinessData {
  name: string | null;
  phone: string | null;
  website: string | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    formatted: string | null;
  } | null;
  description: string | null;
  categories: {
    primary: { id: string; name: string } | null;
    secondary: { id: string; name: string }[];
  };
  openInfo: {
    status: 'OPEN' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | null;
    canReopen: boolean | null;
    openingDate: string | null;
  } | null;
  regularHours: {
    periods: Array<{
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }>;
  } | null;
  metadata: {
    hasVoiceOfMerchant: boolean;
    canModifyServiceList: boolean;
    canHaveFoodMenus: boolean;
  } | null;
  lastFetchedAt: string;
}

export interface ComparisonField {
  field: string;
  label: string;
  localValue: string | null;
  googleValue: string | null;
  status: 'synced' | 'local_only' | 'google_only' | 'conflict' | 'not_set';
  canSync: boolean;
}

export interface ComparisonResult {
  success: boolean;
  fields: ComparisonField[];
  summary: {
    synced: number;
    conflicts: number;
    localOnly: number;
    googleOnly: number;
    notSet: number;
  };
  googleData: GoogleBusinessData | null;
  error?: string;
}

/**
 * Read current business data from Google Business Profile
 */
export async function readFromGoogle(tenantId: string): Promise<{
  success: boolean;
  data: GoogleBusinessData | null;
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, data: null, error: 'No valid access token' };
    }

    const locationId = await getLinkedLocation(tenantId);
    if (!locationId) {
      return { success: false, data: null, error: 'No GBP location linked' };
    }

    // Fetch location data from Google
    const response = await fetch(
      `${GBP_API_BASE}/locations/${locationId}?readMask=name,title,phoneNumbers,websiteUri,storefrontAddress,profile,categories,openInfo,regularHours,metadata`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPBusinessInfoSync] Failed to read from Google:`, error);
      return { success: false, data: null, error: `API error: ${response.status}` };
    }

    const googleLocation = await response.json() as {
      title?: string;
      phoneNumbers?: { primaryPhone?: string };
      websiteUri?: string;
      storefrontAddress?: {
        addressLines?: string[];
        locality?: string;
        administrativeArea?: string;
        postalCode?: string;
        regionCode?: string;
      };
      profile?: { description?: string };
      categories?: {
        primaryCategory?: { name?: string; displayName?: string };
        additionalCategories?: Array<{ name?: string; displayName?: string }>;
      };
      openInfo?: {
        status?: string;
        canReopen?: boolean;
        openingDate?: { year?: number; month?: number; day?: number };
      };
      regularHours?: {
        periods?: Array<{
          openDay?: string;
          openTime?: { hours?: number; minutes?: number };
          closeDay?: string;
          closeTime?: { hours?: number; minutes?: number };
        }>;
      };
      metadata?: {
        hasVoiceOfMerchant?: boolean;
        canModifyServiceList?: boolean;
        canHaveFoodMenus?: boolean;
      };
    };

    // Parse the response into our standard format
    const data: GoogleBusinessData = {
      name: googleLocation.title || null,
      phone: googleLocation.phoneNumbers?.primaryPhone || null,
      website: googleLocation.websiteUri || null,
      address: googleLocation.storefrontAddress ? {
        street: googleLocation.storefrontAddress.addressLines?.join(', ') || null,
        city: googleLocation.storefrontAddress.locality || null,
        state: googleLocation.storefrontAddress.administrativeArea || null,
        zip: googleLocation.storefrontAddress.postalCode || null,
        country: googleLocation.storefrontAddress.regionCode || null,
        formatted: formatAddressFromGoogle(googleLocation.storefrontAddress),
      } : null,
      description: googleLocation.profile?.description || null,
      categories: {
        primary: googleLocation.categories?.primaryCategory ? {
          id: googleLocation.categories.primaryCategory.name || '',
          name: googleLocation.categories.primaryCategory.displayName || googleLocation.categories.primaryCategory.name || '',
        } : null,
        secondary: (googleLocation.categories?.additionalCategories || []).map((cat: any) => ({
          id: cat.name || '',
          name: cat.displayName || cat.name || '',
        })),
      },
      openInfo: googleLocation.openInfo ? {
        status: (googleLocation.openInfo.status as 'OPEN' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY') || null,
        canReopen: googleLocation.openInfo.canReopen || null,
        openingDate: googleLocation.openInfo.openingDate ? 
          `${googleLocation.openInfo.openingDate.year}-${googleLocation.openInfo.openingDate.month}-${googleLocation.openInfo.openingDate.day}` : null,
      } : null,
      regularHours: googleLocation.regularHours ? {
        periods: (googleLocation.regularHours.periods || []).map((p: any) => ({
          openDay: p.openDay || '',
          openTime: p.openTime?.hours ? `${p.openTime.hours}:${p.openTime.minutes || '00'}` : '',
          closeDay: p.closeDay || '',
          closeTime: p.closeTime?.hours ? `${p.closeTime.hours}:${p.closeTime.minutes || '00'}` : '',
        })),
      } : null,
      metadata: googleLocation.metadata ? {
        hasVoiceOfMerchant: googleLocation.metadata.hasVoiceOfMerchant || false,
        canModifyServiceList: googleLocation.metadata.canModifyServiceList || false,
        canHaveFoodMenus: googleLocation.metadata.canHaveFoodMenus || false,
      } : null,
      lastFetchedAt: new Date().toISOString(),
    };

    console.log(`[GBPBusinessInfoSync] Read data from Google for tenant ${tenantId}`);
    return { success: true, data };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error reading from Google:`, error);
    return { success: false, data: null, error: error.message };
  }
}

/**
 * Compare local data with Google data
 */
export async function compareWithGoogle(tenantId: string): Promise<ComparisonResult> {
  try {
    // Read from Google
    const googleResult = await readFromGoogle(tenantId);
    if (!googleResult.success || !googleResult.data) {
      return {
        success: false,
        fields: [],
        summary: { synced: 0, conflicts: 0, localOnly: 0, googleOnly: 0, notSet: 0 },
        googleData: null,
        error: googleResult.error,
      };
    }

    const googleData = googleResult.data;

    // Get local data
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        location_status: true,
      }
    });

    const businessProfile = await prisma.tenant_business_profiles_list.findFirst({
      where: { tenant_id: tenantId },
    });

    // Compare fields
    const fields: ComparisonField[] = [];

    // Business Name
    fields.push(compareField(
      'name',
      'Business Name',
      businessProfile?.business_name || tenant?.name || null,
      googleData.name,
      true
    ));

    // Phone
    fields.push(compareField(
      'phone',
      'Phone Number',
      businessProfile?.phone_number || null,
      googleData.phone,
      true
    ));

    // Website
    fields.push(compareField(
      'website',
      'Website',
      businessProfile?.website || null,
      googleData.website,
      true
    ));

    // Address
    const localAddress = businessProfile?.address_line1 && businessProfile?.city && businessProfile?.state
      ? `${businessProfile.address_line1}, ${businessProfile.city}, ${businessProfile.state} ${businessProfile.postal_code || ''}`
      : null;
    fields.push(compareField(
      'address',
      'Address',
      localAddress,
      googleData.address?.formatted || null,
      true
    ));

    // Description
    fields.push(compareField(
      'description',
      'Description',
      businessProfile?.business_description || null,
      googleData.description,
      true
    ));

    // Primary Category
    fields.push(compareField(
      'primaryCategory',
      'Primary Category',
      businessProfile?.gbp_category_name || null,
      googleData.categories.primary?.name || null,
      true
    ));

    // Store Status
    const localStatus = mapLocalStatusToGoogle(tenant?.location_status as any);
    fields.push(compareField(
      'storeStatus',
      'Store Status',
      localStatus,
      googleData.openInfo?.status || null,
      true
    ));

    // Calculate summary
    const summary = {
      synced: fields.filter(f => f.status === 'synced').length,
      conflicts: fields.filter(f => f.status === 'conflict').length,
      localOnly: fields.filter(f => f.status === 'local_only').length,
      googleOnly: fields.filter(f => f.status === 'google_only').length,
      notSet: fields.filter(f => f.status === 'not_set').length,
    };

    return {
      success: true,
      fields,
      summary,
      googleData,
    };
  } catch (error: any) {
    console.error(`[GBPBusinessInfoSync] Error comparing with Google:`, error);
    return {
      success: false,
      fields: [],
      summary: { synced: 0, conflicts: 0, localOnly: 0, googleOnly: 0, notSet: 0 },
      googleData: null,
      error: error.message,
    };
  }
}

/**
 * Helper: Compare a single field
 */
function compareField(
  field: string,
  label: string,
  localValue: string | null,
  googleValue: string | null,
  canSync: boolean
): ComparisonField {
  // Normalize values for comparison
  const normalizedLocal = normalizeValue(localValue);
  const normalizedGoogle = normalizeValue(googleValue);

  let status: ComparisonField['status'];

  if (!normalizedLocal && !normalizedGoogle) {
    status = 'not_set';
  } else if (normalizedLocal && !normalizedGoogle) {
    status = 'local_only';
  } else if (!normalizedLocal && normalizedGoogle) {
    status = 'google_only';
  } else if (normalizedLocal === normalizedGoogle) {
    status = 'synced';
  } else {
    status = 'conflict';
  }

  return {
    field,
    label,
    localValue,
    googleValue,
    status,
    canSync,
  };
}

/**
 * Helper: Normalize value for comparison
 */
function normalizeValue(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Helper: Format address from Google response
 */
function formatAddressFromGoogle(address: any): string | null {
  if (!address) return null;
  const parts = [
    address.addressLines?.join(', '),
    address.locality,
    address.administrativeArea,
    address.postalCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Helper: Map local status to Google status string
 */
function mapLocalStatusToGoogle(status: string | null): string | null {
  switch (status) {
    case 'active':
      return 'OPEN';
    case 'inactive':
      return 'CLOSED_TEMPORARILY';
    case 'closed':
      return 'CLOSED_PERMANENTLY';
    default:
      return null;
  }
}
