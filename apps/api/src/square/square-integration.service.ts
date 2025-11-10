/**
 * Square Integration Service
 * Orchestrates Square OAuth flow and integration management
 * Phase 2: Backend Implementation
 */

import { SquareOAuthService, createSquareOAuthService } from '../services/square/square-oauth.service';
import { squareIntegrationRepository } from '../services/square/square-integration.repository';
import { createSquareClient } from '../services/square/square-client';

export class SquareIntegrationService {
  private oauthService: SquareOAuthService | null = null;

  private getOAuthService(): SquareOAuthService {
    if (!this.oauthService) {
      this.oauthService = createSquareOAuthService();
    }
    return this.oauthService;
  }

  /**
   * Connect a tenant to Square
   * Exchanges authorization code for tokens and saves to database
   */
  async connectTenant(tenantId: string, authorizationCode: string) {
    try {
      console.log(`[SquareIntegration] Connecting tenant ${tenantId}...`);

      // Exchange code for tokens
      const tokens = await this.getOAuthService().exchangeCodeForToken(authorizationCode);

      console.log(`[SquareIntegration] Tokens received for merchant ${tokens.merchantId}`);

      // Get merchant and location info
      const squareClient = createSquareClient({
        access_token: tokens.accessToken,
        mode: (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      });

      const locations = await squareClient.listLocations();
      const primaryLocation = locations[0]; // Use first location as default

      // Save integration to database
      await squareIntegrationRepository.createIntegration({
        tenantId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        merchantId: tokens.merchantId,
        locationId: primaryLocation?.id,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        mode: (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      });

      console.log(`[SquareIntegration] Integration saved for tenant ${tenantId}`);

      // Get the created integration
      const integration = await squareIntegrationRepository.getIntegrationByTenantId(tenantId);

      return integration;
    } catch (error) {
      console.error('[SquareIntegration] Connect tenant error:', error);
      throw new Error('Failed to connect Square integration');
    }
  }

  /**
   * Disconnect a tenant from Square
   * Revokes tokens and removes integration from database
   */
  async disconnectTenant(tenantId: string) {
    try {
      console.log(`[SquareIntegration] Disconnecting tenant ${tenantId}...`);

      // Get integration
      const integration = await squareIntegrationRepository.getIntegrationByTenantId(tenantId);

      if (!integration) {
        throw new Error('Integration not found');
      }

      // Revoke access token
      try {
        await this.getOAuthService().revokeToken(integration.accessToken);
        console.log(`[SquareIntegration] Token revoked for tenant ${tenantId}`);
      } catch (error) {
        console.warn('[SquareIntegration] Token revocation failed (may already be revoked):', error);
        // Continue with deletion even if revocation fails
      }

      // Delete integration from database
      await squareIntegrationRepository.deleteIntegration(integration.id);

      console.log(`[SquareIntegration] Integration deleted for tenant ${tenantId}`);
    } catch (error) {
      console.error('[SquareIntegration] Disconnect tenant error:', error);
      throw error;
    }
  }

  /**
   * Get integration status for a tenant
   */
  async getIntegrationStatus(tenantId: string) {
    try {
      const integration = await squareIntegrationRepository.getIntegrationByTenantId(tenantId);

      if (!integration) {
        return null;
      }

      // Check if token needs refresh
      if (integration.tokenExpiresAt && integration.refreshToken) {
        const expiresAt = new Date(integration.tokenExpiresAt);
        const now = new Date();
        const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Refresh if expiring within 24 hours
        if (hoursUntilExpiry < 24 && hoursUntilExpiry > 0) {
          console.log(`[SquareIntegration] Token expiring soon for tenant ${tenantId}, refreshing...`);
          await this.refreshToken(integration.id, integration.refreshToken);
          
          // Get updated integration
          return await squareIntegrationRepository.getIntegrationByTenantId(tenantId);
        }
      }

      return integration;
    } catch (error) {
      console.error('[SquareIntegration] Get status error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(integrationId: string, refreshToken: string) {
    try {
      console.log(`[SquareIntegration] Refreshing token for integration ${integrationId}...`);

      const tokens = await this.getOAuthService().refreshAccessToken(refreshToken);

      await squareIntegrationRepository.updateIntegration(integrationId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      });

      console.log(`[SquareIntegration] Token refreshed for integration ${integrationId}`);
    } catch (error) {
      console.error('[SquareIntegration] Refresh token error:', error);
      
      // Mark integration as having an error
      await squareIntegrationRepository.updateIntegration(integrationId, {
        lastError: 'Token refresh failed',
        enabled: false,
      });

      throw error;
    }
  }

  /**
   * Get sync logs for a tenant
   */
  async getSyncLogs(tenantId: string, limit: number = 100) {
    try {
      return await squareIntegrationRepository.getSyncLogsByTenantId(tenantId, limit);
    } catch (error) {
      console.error('[SquareIntegration] Get sync logs error:', error);
      throw error;
    }
  }

  /**
   * Test connection to Square
   */
  async testConnection(tenantId: string): Promise<boolean> {
    try {
      const integration = await squareIntegrationRepository.getIntegrationByTenantId(tenantId);

      if (!integration) {
        return false;
      }

      const squareClient = createSquareClient({
        access_token: integration.accessToken,
        mode: integration.mode as 'sandbox' | 'production',
      });

      return await squareClient.testConnection();
    } catch (error) {
      console.error('[SquareIntegration] Test connection error:', error);
      return false;
    }
  }
}
