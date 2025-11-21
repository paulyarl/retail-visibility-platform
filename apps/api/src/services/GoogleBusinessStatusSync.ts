/**
 * Google Business Profile Status Sync Service
 * 
 * Syncs location lifecycle status changes to Google Business Profile
 * Maps internal status to GBP openInfo.status values
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type LocationStatus = 'pending' | 'active' | 'inactive' | 'closed' | 'archived';

interface GoogleOpenInfo {
  status: 'OPEN' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  canReopen?: boolean;
  openingDate?: {
    year: number;
    month: number;
    day: number;
  };
}

interface StatusSyncResult {
  success: boolean;
  gbpStatus?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Map internal location status to Google Business Profile status
 */
export function mapToGoogleStatus(
  status: LocationStatus,
  reopeningDate?: Date | null
): GoogleOpenInfo | null {
  switch (status) {
    case 'active':
      return {
        status: 'OPEN',
      };

    case 'inactive':
      // Temporarily closed with optional reopening date
      const openInfo: GoogleOpenInfo = {
        status: 'CLOSED_TEMPORARILY',
        canReopen: true,
      };

      if (reopeningDate) {
        openInfo.openingDate = {
          year: reopeningDate.getFullYear(),
          month: reopeningDate.getMonth() + 1, // GBP uses 1-based months
          day: reopeningDate.getDate(),
        };
      }

      return openInfo;

    case 'closed':
      // Permanently closed
      return {
        status: 'CLOSED_PERMANENTLY',
      };

    case 'pending':
    case 'archived':
      // Don't sync pending (not yet live) or archived (historical)
      return null;

    default:
      return null;
  }
}

/**
 * Sync location status to Google Business Profile
 */
export async function syncLocationStatusToGoogle(
  tenantId: string,
  status: LocationStatus,
  reopeningDate?: Date | null
): Promise<StatusSyncResult> {
  try {
    // Get tenant with Google Business Profile connection
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        googleBusinessAccessToken: true,
        googleBusinessRefreshToken: true,
        googleBusinessTokenExpiry: true,
        google_oauth_accounts: {
          include: {
            gbpLocations: true,
            tokens: true,
          },
          take: 1, // Get first connected account
        },
      },
    });

    if (!tenant) {
      return {
        success: false,
        error: 'Tenant not found',
      };
    }

    // Check if tenant has Google Business Profile connected
    const googleAccount = tenant.googleOAuthAccounts[0];
    const gbpLocation = googleAccount?.gbpLocations[0];

    if (!gbpLocation) {
      return {
        success: true,
        skipped: true,
        reason: 'No Google Business Profile connected',
      };
    }

    // Map status to Google format
    const googleOpenInfo = mapToGoogleStatus(status, reopeningDate);

    if (!googleOpenInfo) {
      return {
        success: true,
        skipped: true,
        reason: `Status '${status}' does not sync to Google`,
      };
    }

    // Get access token (prefer OAuth token, fallback to legacy)
    const accessToken = googleAccount?.tokens?.accessTokenEncrypted || tenant.googleBusinessAccessToken;

    if (!accessToken) {
      return {
        success: false,
        error: 'No Google access token available',
      };
    }

    // Check if token is expired
    const now = new Date();
    const tokenExpiry = googleAccount?.tokens?.expiresAt || tenant.googleBusinessTokenExpiry;
    
    if (tokenExpiry && new Date(tokenExpiry) < now) {
      // Token expired - would need to refresh
      // For now, log and skip (refresh logic should be in separate service)
      console.warn(`[GoogleBusinessStatusSync] Token expired for tenant ${tenantId}`);
      return {
        success: false,
        error: 'Google access token expired',
      };
    }

    // Make API call to Google My Business API
    // Note: accessTokenEncrypted would need to be decrypted in production
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpLocation.locationId}?updateMask=openInfo`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openInfo: googleOpenInfo,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GoogleBusinessStatusSync] API error for tenant ${tenantId}:`, errorText);
      
      return {
        success: false,
        error: `Google API error: ${response.status} ${response.statusText}`,
      };
    }

    const result = await response.json();

    console.log(`[GoogleBusinessStatusSync] Successfully synced status for tenant ${tenantId}:`, {
      status,
      gbpStatus: googleOpenInfo.status,
      reopeningDate: reopeningDate?.toISOString(),
    });

    return {
      success: true,
      gbpStatus: googleOpenInfo.status,
    };

  } catch (error: any) {
    console.error(`[GoogleBusinessStatusSync] Error syncing tenant ${tenantId}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Sync status change with retry logic
 */
export async function syncWithRetry(
  tenantId: string,
  status: LocationStatus,
  reopeningDate?: Date | null,
  maxRetries: number = 3
): Promise<StatusSyncResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await syncLocationStatusToGoogle(tenantId, status, reopeningDate);

    if (result.success || result.skipped) {
      return result;
    }

    lastError = result.error;

    // Don't retry on certain errors
    if (
      result.error?.includes('not found') ||
      result.error?.includes('No Google') ||
      result.error?.includes('expired')
    ) {
      return result;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`[GoogleBusinessStatusSync] Retry attempt ${attempt + 1} for tenant ${tenantId}`);
    }
  }

  return {
    success: false,
    error: lastError || 'Max retries exceeded',
  };
}

/**
 * Log sync result to database (optional audit trail)
 */
export async function logSyncResult(
  tenantId: string,
  status: LocationStatus,
  result: StatusSyncResult
): Promise<void> {
  try {
    // Could create a GoogleSyncLog table for this
    // For now, just console log
    console.log(`[GoogleBusinessStatusSync] Sync result for ${tenantId}:`, {
      status,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GoogleBusinessStatusSync] Error logging sync result:', error);
  }
}
