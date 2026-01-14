import { TokenEncryptionService } from '../TokenEncryptionService';
import { prisma } from '../../prisma';
import crypto from 'crypto';

interface SquareTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_at: string; // ISO 8601 format
  merchant_id?: string;
}

export class SquareOAuthService {
  private applicationId: string;
  private applicationSecret: string;
  private redirectUri: string;
  private environment: 'sandbox' | 'production';
  private tokenEncryption: TokenEncryptionService;

  constructor() {
    this.applicationId = process.env.SQUARE_APPLICATION_ID || '';
    this.applicationSecret = process.env.SQUARE_APPLICATION_SECRET || '';
    this.redirectUri = process.env.SQUARE_OAUTH_REDIRECT_URI || '';
    this.environment = (process.env.SQUARE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.tokenEncryption = new TokenEncryptionService();

    if (!this.applicationId || !this.applicationSecret || !this.redirectUri) {
      console.warn('[Square OAuth] Missing required environment variables');
    }
  }

  /**
   * Get the base URL for Square API based on environment
   */
  private getBaseUrl(): string {
    return this.environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
  }

  /**
   * Generate authorization URL for user to connect Square
   * @param tenantId - Tenant ID to associate with this OAuth connection
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(tenantId: string, state?: string): string {
    const stateParam = state || this.generateState(tenantId);
    const baseUrl = `${this.getBaseUrl()}/oauth2/authorize`;

    const params = new URLSearchParams({
      client_id: this.applicationId,
      scope: 'PAYMENTS_READ PAYMENTS_WRITE MERCHANT_PROFILE_READ',
      session: 'false',
      state: stateParam,
      redirect_uri: this.redirectUri,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from Square callback
   * @param tenantId - Tenant ID to associate tokens with
   * @returns Token response from Square
   */
  async exchangeCodeForToken(code: string, tenantId: string): Promise<SquareTokenResponse> {
    const tokenUrl = `${this.getBaseUrl()}/oauth2/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        client_id: this.applicationId,
        client_secret: this.applicationSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
      throw new Error(`Square token exchange failed: ${error.message || error.error}`);
    }

    const data = await response.json() as SquareTokenResponse;
    
    // Store encrypted tokens
    await this.storeTokens(tenantId, data);
    
    return data;
  }

  /**
   * Refresh access token using refresh token
   * @param tenantId - Tenant ID to refresh tokens for
   * @returns New token response from Square
   */
  async refreshAccessToken(tenantId: string): Promise<SquareTokenResponse> {
    const tokenRecord = await prisma.oauth_tokens.findUnique({
      where: {
        tenant_id_gateway_type: {
          tenant_id: tenantId,
          gateway_type: 'square',
        },
      },
    });

    if (!tokenRecord || !tokenRecord.refresh_token) {
      throw new Error('No refresh token available for Square');
    }

    const refreshToken = this.tokenEncryption.decrypt(tokenRecord.refresh_token);
    const tokenUrl = `${this.getBaseUrl()}/oauth2/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        client_id: this.applicationId,
        client_secret: this.applicationSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
      throw new Error(`Square token refresh failed: ${error.message || error.error}`);
    }

    const data = await response.json() as SquareTokenResponse;
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
          gateway_type: 'square',
        },
      },
    });

    if (!tokenRecord) {
      throw new Error('No Square OAuth token found for this tenant');
    }

    // Check if token is expired or about to expire (1 day buffer for Square's 30-day tokens)
    const expiresIn = tokenRecord.expires_at.getTime() - Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (expiresIn < oneDay) {
      // Token expiring soon, refresh it
      console.log(`[Square OAuth] Token expiring soon for tenant ${tenantId}, refreshing...`);
      const refreshed = await this.refreshAccessToken(tenantId);
      return refreshed.access_token;
    }

    return this.tokenEncryption.decrypt(tokenRecord.access_token);
  }

  /**
   * Revoke Square OAuth token
   * @param tenantId - Tenant ID to revoke token for
   */
  async revokeToken(tenantId: string): Promise<void> {
    const tokenRecord = await prisma.oauth_tokens.findUnique({
      where: {
        tenant_id_gateway_type: {
          tenant_id: tenantId,
          gateway_type: 'square',
        },
      },
    });

    if (!tokenRecord) {
      throw new Error('No Square OAuth token found for this tenant');
    }

    const accessToken = this.tokenEncryption.decrypt(tokenRecord.access_token);
    const revokeUrl = `${this.getBaseUrl()}/oauth2/revoke`;

    const response = await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        client_id: this.applicationId,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
      console.error(`[Square OAuth] Token revocation failed: ${error.message || error.error}`);
      // Continue with disconnect even if revocation fails
    }

    await this.disconnect(tenantId);
  }

  /**
   * Store encrypted tokens in database
   * @param tenantId - Tenant ID to associate tokens with
   * @param tokenData - Token response from Square
   */
  private async storeTokens(tenantId: string, tokenData: SquareTokenResponse): Promise<void> {
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    await prisma.oauth_tokens.upsert({
      where: {
        tenant_id_gateway_type: {
          tenant_id: tenantId,
          gateway_type: 'square',
        },
      },
      create: {
        id: crypto.randomBytes(16).toString('hex'),
        tenant_id: tenantId,
        gateway_type: 'square',
        access_token: this.tokenEncryption.encrypt(tokenData.access_token),
        refresh_token: tokenData.refresh_token 
          ? this.tokenEncryption.encrypt(tokenData.refresh_token)
          : null,
        token_type: tokenData.token_type,
        expires_at: expiresAt,
        merchant_id: tokenData.merchant_id || null,
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
        merchant_id: tokenData.merchant_id || undefined,
        last_refreshed_at: now,
        updated_at: now,
      },
    });

    // Update payment gateway record to mark as OAuth connected
    await prisma.tenant_payment_gateways.updateMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'square',
      },
      data: {
        oauth_connected: true,
        oauth_merchant_id: tokenData.merchant_id || null,
        updated_at: now,
      },
    });

    console.log(`[Square OAuth] Tokens stored successfully for tenant ${tenantId}`);
  }

  /**
   * Disconnect Square OAuth for a tenant
   * @param tenantId - Tenant ID to disconnect
   */
  async disconnect(tenantId: string): Promise<void> {
    // Delete OAuth tokens
    await prisma.oauth_tokens.deleteMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'square',
      },
    });

    // Update payment gateway record
    await prisma.tenant_payment_gateways.updateMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'square',
      },
      data: {
        oauth_connected: false,
        oauth_merchant_id: null,
        updated_at: new Date(),
      },
    });

    console.log(`[Square OAuth] Disconnected for tenant ${tenantId}`);
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
   * Check if Square OAuth is properly configured
   * @returns True if all required environment variables are set
   */
  isConfigured(): boolean {
    return !!(this.applicationId && this.applicationSecret && this.redirectUri);
  }
}
