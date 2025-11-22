/**
 * Square OAuth Service
 * Handles OAuth 2.0 flow for Square integration
 * Phase 2: Backend Implementation
 */

const { SquareClient } = require('square') as any;
import crypto from 'crypto';

export interface SquareOAuthConfig {
  applicationId: string;
  environment: 'sandbox' | 'production';
  redirectUri: string;
}

export interface SquareTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  merchantId: string;
  scopes?: string[];
}

export class SquareOAuthService {
  private config: SquareOAuthConfig;
  private client: any;

  constructor(config: SquareOAuthConfig) {
    this.config = config;
    
    const environment = config.environment === 'production' 
      ? 'production' 
      : 'sandbox';

    this.client = new SquareClient({
      environment,
    });
  }

  /**
   * Generate authorization URL for OAuth flow
   * @param state - Random state for CSRF protection
   * @param tenantId - Tenant ID to associate with the integration
   */
  generateAuthorizationUrl(state: string, tenantId: string): string {
    const baseUrl = this.config.environment === 'production'
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const params = new URLSearchParams({
      client_id: this.config.applicationId,
      scope: [
        'ITEMS_READ',
        'ITEMS_WRITE',
        'INVENTORY_READ',
        'INVENTORY_WRITE',
        'MERCHANT_PROFILE_READ',
      ].join(' '),
      session: 'false',
      state: `${state}:${tenantId}`, // Encode tenant ID in state
      redirect_uri: this.config.redirectUri,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from Square
   */
  async exchangeCodeForToken(code: string): Promise<SquareTokens> {
    try {
      const response = await this.client.oAuthApi.obtainToken({
        clientId: this.config.applicationId,
        clientSecret: process.env.SQUARE_CLIENT_SECRET!,
        code,
        grantType: 'authorization_code',
        redirectUri: this.config.redirectUri,
      });

      const result = response.result;

      return {
        accessToken: result.accessToken!,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined, 
        merchantId: result.merchantId!,
        scopes: result.scopes,
      };
    } catch (error) {
      console.error('[SquareOAuth] Token exchange failed:', error);
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  /**
   * Refresh an expired access token
   * @param refreshToken - Refresh token from previous authorization
   */
  async refreshAccessToken(refreshToken: string): Promise<SquareTokens> {
    try {
      const response = await this.client.oAuthApi.obtainToken({
        clientId: this.config.applicationId,
        clientSecret: process.env.SQUARE_CLIENT_SECRET!,
        grantType: 'refresh_token',
        refreshToken,
      });

      const result = response.result;

      return {
        accessToken: result.accessToken!,
        refreshToken: result.refreshToken || refreshToken, // Use new or keep old
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
        merchantId: result.merchantId!,
        scopes: result.scopes,
      };
    } catch (error) {
      console.error('[SquareOAuth] Token refresh failed:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Revoke access token (disconnect)
   * @param accessToken - Access token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      await this.client.oAuthApi.revokeToken({
        clientId: this.config.applicationId,
        accessToken,
      });
    } catch (error) {
      console.error('[SquareOAuth] Token revocation failed:', error);
      throw new Error('Failed to revoke access token');
    }
  }

  /**
   * Generate a secure random state for CSRF protection
   */
  static generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Parse state parameter to extract tenant ID
   * @param state - State string in format "randomState:tenantId"
   */
  static parseState(state: string): { state: string; tenantId: string } {
    const [randomState, tenantId] = state.split(':');
    return { state: randomState, tenantId };
  }
}

/**
 * Factory function to create OAuth service from environment
 */
export function createSquareOAuthService(): SquareOAuthService {
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const environment = (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  const redirectUri = process.env.SQUARE_OAUTH_REDIRECT_URI;

  if (!applicationId) {
    throw new Error('SQUARE_APPLICATION_ID environment variable is required');
  }

  if (!redirectUri) {
    throw new Error('SQUARE_OAUTH_REDIRECT_URI environment variable is required');
  }

  return new SquareOAuthService({
    applicationId,
    environment,
    redirectUri,
  });
}
