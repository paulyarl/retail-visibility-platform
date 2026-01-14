import { TokenEncryptionService } from '../TokenEncryptionService';
import { prisma } from '../../prisma';
import crypto from 'crypto';

interface PayPalTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class PayPalOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private environment: 'sandbox' | 'production';
  private tokenEncryption: TokenEncryptionService;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.redirectUri = process.env.PAYPAL_OAUTH_REDIRECT_URI || '';
    this.environment = (process.env.PAYPAL_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.tokenEncryption = new TokenEncryptionService();

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn('[PayPal OAuth] Missing required environment variables');
    }
  }

  /**
   * Get the base URL for PayPal API based on environment
   */
  private getBaseUrl(): string {
    return this.environment === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';
  }

  /**
   * Get the authorization URL for PayPal OAuth
   */
  private getAuthUrl(): string {
    return this.environment === 'production'
      ? 'https://www.paypal.com/signin/authorize'
      : 'https://www.sandbox.paypal.com/signin/authorize';
  }

  /**
   * Generate authorization URL for user to connect PayPal
   * @param tenantId - Tenant ID to associate with this OAuth connection
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(tenantId: string, state?: string): string {
    const stateParam = state || this.generateState(tenantId);
    const baseUrl = this.getAuthUrl();

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid profile email https://uri.paypal.com/services/payments/realtimepayment',
      redirect_uri: this.redirectUri,
      state: stateParam,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from PayPal callback
   * @param tenantId - Tenant ID to associate tokens with
   * @returns Token response from PayPal
   */
  async exchangeCodeForToken(code: string, tenantId: string): Promise<PayPalTokenResponse> {
    const tokenUrl = `${this.getBaseUrl()}/v1/oauth2/token`;
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
      throw new Error(`PayPal token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json() as PayPalTokenResponse;
    
    // Store encrypted tokens
    await this.storeTokens(tenantId, data);
    
    return data;
  }

  /**
   * Refresh access token using refresh token
   * @param tenantId - Tenant ID to refresh tokens for
   * @returns New token response from PayPal
   */
  async refreshAccessToken(tenantId: string): Promise<PayPalTokenResponse> {
    const tokenRecord = await prisma.oauth_tokens.findUnique({
      where: {
        tenant_id_gateway_type: {
          tenant_id: tenantId,
          gateway_type: 'paypal',
        },
      },
    });

    if (!tokenRecord || !tokenRecord.refresh_token) {
      throw new Error('No refresh token available for PayPal');
    }

    const refreshToken = this.tokenEncryption.decrypt(tokenRecord.refresh_token);
    const tokenUrl = `${this.getBaseUrl()}/v1/oauth2/token`;
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
      throw new Error(`PayPal token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json() as PayPalTokenResponse;
    await this.storeTokens(tenantId, data);
    
    return data;
  }

  /**
   * Get valid access token (refresh if needed)
   * @param tenantId - Tenant ID to get token for
   * @returns Valid access token
   */
  async getValidAccessToken(tenantId: string): Promise<string> {
    const tokenRecord = await prisma.oauth_tokens.findUnique({
      where: {
        tenant_id_gateway_type: {
          tenant_id: tenantId,
          gateway_type: 'paypal',
        },
      },
    });

    if (!tokenRecord) {
      throw new Error('No PayPal OAuth token found for this tenant');
    }

    // Check if token is expired or about to expire (5 min buffer)
    const expiresIn = tokenRecord.expires_at.getTime() - Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresIn < fiveMinutes) {
      // Token expired or expiring soon, refresh it
      console.log(`[PayPal OAuth] Token expiring soon for tenant ${tenantId}, refreshing...`);
      const refreshed = await this.refreshAccessToken(tenantId);
      return refreshed.access_token;
    }

    return this.tokenEncryption.decrypt(tokenRecord.access_token);
  }

  /**
   * Store encrypted tokens in database
   * @param tenantId - Tenant ID to associate tokens with
   * @param tokenData - Token response from PayPal
   */
  private async storeTokens(tenantId: string, tokenData: PayPalTokenResponse): Promise<void> {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    const now = new Date();

    await prisma.oauth_tokens.upsert({
      where: {
        tenant_id_gateway_type: {
          tenant_id: tenantId,
          gateway_type: 'paypal',
        },
      },
      create: {
        id: crypto.randomBytes(16).toString('hex'),
        tenant_id: tenantId,
        gateway_type: 'paypal',
        access_token: this.tokenEncryption.encrypt(tokenData.access_token),
        refresh_token: tokenData.refresh_token 
          ? this.tokenEncryption.encrypt(tokenData.refresh_token)
          : null,
        token_type: tokenData.token_type,
        expires_at: expiresAt,
        scope: tokenData.scope,
        last_refreshed_at: now,
        created_at: now,
        updated_at: now,
      },
      update: {
        access_token: this.tokenEncryption.encrypt(tokenData.access_token),
        refresh_token: tokenData.refresh_token 
          ? this.tokenEncryption.encrypt(tokenData.refresh_token)
          : undefined,
        expires_at: expiresAt,
        scope: tokenData.scope,
        last_refreshed_at: now,
        updated_at: now,
      },
    });

    // Update payment gateway record to mark as OAuth connected
    await prisma.tenant_payment_gateways.updateMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'paypal',
      },
      data: {
        oauth_connected: true,
        updated_at: now,
      },
    });

    console.log(`[PayPal OAuth] Tokens stored successfully for tenant ${tenantId}`);
  }

  /**
   * Disconnect PayPal OAuth for a tenant
   * @param tenantId - Tenant ID to disconnect
   */
  async disconnect(tenantId: string): Promise<void> {
    // Delete OAuth tokens
    await prisma.oauth_tokens.deleteMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'paypal',
      },
    });

    // Update payment gateway record
    await prisma.tenant_payment_gateways.updateMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'paypal',
      },
      data: {
        oauth_connected: false,
        oauth_merchant_id: null,
        updated_at: new Date(),
      },
    });

    console.log(`[PayPal OAuth] Disconnected for tenant ${tenantId}`);
  }

  /**
   * Generate secure state parameter for CSRF protection
   * @param tenantId - Tenant ID to encode in state
   * @returns Base64url encoded state parameter
   */
  private generateState(tenantId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${tenantId}:${timestamp}:${random}`;
    return Buffer.from(data).toString('base64url');
  }

  /**
   * Verify and parse state parameter
   * @param state - State parameter from OAuth callback
   * @returns Parsed tenant ID and timestamp
   */
  verifyState(state: string): { tenantId: string; timestamp: number } {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const [tenantId, timestampStr] = decoded.split(':');
      const timestamp = parseInt(timestampStr);
      
      // Check if state is not older than 10 minutes
      const age = Date.now() - timestamp;
      const tenMinutes = 10 * 60 * 1000;
      
      if (age > tenMinutes) {
        throw new Error('State parameter expired');
      }
      
      return { tenantId, timestamp };
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }

  /**
   * Check if PayPal OAuth is properly configured
   * @returns True if all required environment variables are set
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }
}
