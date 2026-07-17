/**
 * Scheduled OAuth Token Refresh Job
 * Automatically refreshes OAuth tokens for PayPal and Square before they expire
 * Runs every hour to check tokens expiring within 24 hours
 */

import { prisma } from '../prisma';
import { PayPalOAuthService } from '../services/paypal/PayPalOAuthService';
import { SquareOAuthService } from '../services/square/SquareOAuthService';

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_EXPIRY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours before expiry

let refreshIntervalId: NodeJS.Timeout | null = null;

interface TokenRefreshResult {
  tenantId: string;
  gatewayType: string;
  success: boolean;
  error?: string;
}

/**
 * Get all OAuth tokens that need refresh (expiring within 24 hours)
 */
async function getTokensNeedingRefresh(): Promise<Array<{ tenant_id: string; gateway_type: string; expires_at: Date }>> {
  try {
    const threshold = new Date(Date.now() + TOKEN_EXPIRY_THRESHOLD_MS);
    
    const tokens = await prisma.oauth_tokens.findMany({
      where: {
        expires_at: {
          lte: threshold, // Expires within 24 hours
          gt: new Date(), // Not already expired (grace period handled by MV)
        },
      },
      select: {
        tenant_id: true,
        gateway_type: true,
        expires_at: true,
      },
    });

    return tokens;
  } catch (error) {
    console.error('[OAuth Token Refresh] Error getting tokens needing refresh:', error);
    return [];
  }
}

/**
 * Refresh a single OAuth token
 */
async function refreshToken(tenantId: string, gatewayType: string): Promise<TokenRefreshResult> {
  try {
    if (gatewayType === 'paypal') {
      const paypalService = new PayPalOAuthService();
      await paypalService.refreshAccessToken(tenantId);
      return { tenantId, gatewayType, success: true };
    } else if (gatewayType === 'square') {
      const squareService = new SquareOAuthService();
      await squareService.refreshAccessToken(tenantId);
      return { tenantId, gatewayType, success: true };
    } else {
      return { tenantId, gatewayType, success: false, error: `Unknown gateway type: ${gatewayType}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[OAuth Token Refresh] Error refreshing ${gatewayType} token for tenant ${tenantId}:`, errorMessage);
    return { tenantId, gatewayType, success: false, error: errorMessage };
  }
}

/**
 * Run token refresh for all tokens expiring soon
 */
async function runScheduledRefresh(): Promise<void> {
  console.log('[OAuth Token Refresh] Starting scheduled token refresh...');
  const startTime = Date.now();

  try {
    const tokensNeedingRefresh = await getTokensNeedingRefresh();
    console.log(`[OAuth Token Refresh] Found ${tokensNeedingRefresh.length} tokens needing refresh`);

    if (tokensNeedingRefresh.length === 0) {
      console.log('[OAuth Token Refresh] No tokens need refresh, skipping');
      return;
    }

    let totalRefreshed = 0;
    let totalFailed = 0;
    const results: TokenRefreshResult[] = [];

    for (const token of tokensNeedingRefresh) {
      const result = await refreshToken(token.tenant_id, token.gateway_type);
      results.push(result);

      if (result.success) {
        totalRefreshed++;
        console.log(`[OAuth Token Refresh] Refreshed ${token.gateway_type} token for tenant ${token.tenant_id}`);
      } else {
        totalFailed++;
        console.error(`[OAuth Token Refresh] Failed to refresh ${token.gateway_type} token for tenant ${token.tenant_id}: ${result.error}`);
      }

      // Small delay between refreshes to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[OAuth Token Refresh] Completed in ${duration}s: ${totalRefreshed} refreshed, ${totalFailed} failed`);
  } catch (error) {
    console.error('[OAuth Token Refresh] Scheduled refresh failed:', error);
  }
}

/**
 * Start the scheduled token refresh job
 */
export function startOAuthTokenRefresh(): void {
  if (refreshIntervalId) {
    console.log('[OAuth Token Refresh] Already running');
    return;
  }

  console.log(`[OAuth Token Refresh] Starting scheduler (every ${REFRESH_INTERVAL_MS / 1000 / 60} minutes)`);
  
  // Run immediately on startup (after a short delay to let server initialize)
  setTimeout(() => {
    runScheduledRefresh();
  }, 60000); // 1 minute delay after startup

  // Then run on interval
  refreshIntervalId = setInterval(() => {
    runScheduledRefresh();
  }, REFRESH_INTERVAL_MS);
}

/**
 * Stop the scheduled token refresh job
 */
export function stopOAuthTokenRefresh(): void {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    console.log('[OAuth Token Refresh] Stopped');
  }
}

/**
 * Manually trigger a refresh for all tokens expiring soon
 */
export async function triggerManualRefresh(): Promise<{ tokens: number; refreshed: number; failed: number }> {
  const startTime = Date.now();
  const tokensNeedingRefresh = await getTokensNeedingRefresh();
  
  let totalRefreshed = 0;
  let totalFailed = 0;

  for (const token of tokensNeedingRefresh) {
    const result = await refreshToken(token.tenant_id, token.gateway_type);
    if (result.success) {
      totalRefreshed++;
    } else {
      totalFailed++;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[OAuth Manual Refresh] Completed in ${duration}s: ${totalRefreshed} refreshed, ${totalFailed} failed`);

  return {
    tokens: tokensNeedingRefresh.length,
    refreshed: totalRefreshed,
    failed: totalFailed
  };
}

/**
 * Get status of OAuth tokens (for monitoring)
 */
export async function getOAuthTokenStatus(): Promise<{
  total: number;
  expiringWithin24h: number;
  expired: number;
  byGateway: Record<string, { total: number; expiring: number; expired: number }>;
}> {
  const threshold = new Date(Date.now() + TOKEN_EXPIRY_THRESHOLD_MS);
  
  const tokens = await prisma.oauth_tokens.findMany({
    select: {
      gateway_type: true,
      expires_at: true,
    },
  });

  const status = {
    total: tokens.length,
    expiringWithin24h: 0,
    expired: 0,
    byGateway: {} as Record<string, { total: number; expiring: number; expired: number }>,
  };

  for (const token of tokens) {
    const gateway = token.gateway_type;
    
    if (!status.byGateway[gateway]) {
      status.byGateway[gateway] = { total: 0, expiring: 0, expired: 0 };
    }
    
    status.byGateway[gateway].total++;
    
    if (token.expires_at < new Date()) {
      status.expired++;
      status.byGateway[gateway].expired++;
    } else if (token.expires_at <= threshold) {
      status.expiringWithin24h++;
      status.byGateway[gateway].expiring++;
    }
  }

  return status;
}
