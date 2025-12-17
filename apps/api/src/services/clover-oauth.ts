/**
 * Clover OAuth Service
 * 
 * Handles OAuth 2.0 flow for Clover POS integration
 * Reference: https://docs.clover.com/docs/oauth-2-0
 */

import crypto from 'crypto';

// Clover OAuth configuration
const CLOVER_CONFIG = {
  // Sandbox (for testing)
  sandbox: {
    authUrl: 'https://sandbox.dev.clover.com/oauth/authorize',
    tokenUrl: 'https://sandbox.dev.clover.com/oauth/token',
    apiBaseUrl: 'https://sandbox.dev.clover.com',
  },
  // Production
  production: {
    authUrl: 'https://www.clover.com/oauth/authorize',
    tokenUrl: 'https://www.clover.com/oauth/token',
    apiBaseUrl: 'https://api.clover.com',
  }
};

// OAuth scopes required for inventory sync
const REQUIRED_SCOPES = [
  'merchant_r',      // Read merchant information
  'inventory_r',     // Read inventory items
  'inventory_w',     // Write inventory items (for sync)
];

interface CloverOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
}

/**
 * Get Clover configuration from environment
 */
export function getCloverConfig(): CloverOAuthConfig {
  const clientId = process.env.CLOVER_CLIENT_ID;
  const clientSecret = process.env.CLOVER_CLIENT_SECRET;
  const redirectUri = process.env.CLOVER_REDIRECT_URI || `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/integrations/clover/oauth/callback`;
  const environment = (process.env.CLOVER_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  if (!clientId || !clientSecret) {
    throw new Error('Clover OAuth credentials not configured. Set CLOVER_CLIENT_ID and CLOVER_CLIENT_SECRET environment variables.');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment
  };
}

/**
 * Get Clover URLs based on environment
 */
export function getCloverUrls(environment: 'sandbox' | 'production' = 'sandbox') {
  return CLOVER_CONFIG[environment];
}

/**
 * Generate authorization URL for OAuth flow
 */
export function generateAuthorizationUrl(tenantId: string, state?: string): string {
  const config = getCloverConfig();
  const urls = getCloverUrls(config.environment);
  
  // Generate state token if not provided (for CSRF protection)
  const stateToken = state || crypto.randomBytes(32).toString('hex');
  
  // Encode tenant ID in state for callback
  const stateData = {
    tenantId,
    token: stateToken,
    timestamp: Date.now()
  };
  const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state: encodedState,
    // Clover uses space-separated scopes
    scope: REQUIRED_SCOPES.join(' ')
  });

  return `${urls.authUrl}?${params.toString()}`;
}

/**
 * Decode state parameter from OAuth callback
 */
export function decodeState(encodedState: string): { tenantId: string; token: string; timestamp: number } {
  try {
    const decoded = Buffer.from(encodedState, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error('Invalid state parameter');
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  merchant_id: string;
}> {
  const config = getCloverConfig();
  const urls = getCloverUrls(config.environment);

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(urls.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const data = await response.json();
  
  // Extract merchant ID from response
  // Clover returns merchant_id in the token response
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    merchant_id: data.merchant_id || data.merchantId
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const config = getCloverConfig();
  const urls = getCloverUrls(config.environment);

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch(urls.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return await response.json();
}

/**
 * Encrypt token for storage
 */
export function encryptToken(token: string): string {
  const secret = process.env.CLOVER_TOKEN_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  // Create a 32-byte key from the secret (for AES-256)
  const key = crypto.scryptSync(secret, 'salt', 32);
  // Generate a random 16-byte IV
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV + encrypted data (IV is needed for decryption)
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt token from storage
 */
export function decryptToken(encryptedToken: string): string {
  const secret = process.env.CLOVER_TOKEN_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  // Create a 32-byte key from the secret (for AES-256)
  const key = crypto.scryptSync(secret, 'salt', 32);

  // Extract IV and encrypted data
  const [ivHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Validate token expiration
 */
export function isTokenExpired(expiresAt: Date): boolean {
  // Consider token expired 5 minutes before actual expiration
  const bufferMs = 5 * 60 * 1000;
  return new Date().getTime() > (expiresAt.getTime() - bufferMs);
}

/**
 * Calculate token expiration date
 */
export function calculateTokenExpiration(expiresIn: number): Date {
  return new Date(Date.now() + (expiresIn * 1000));
}

/**
 * Get required OAuth scopes
 */
export function getRequiredScopes(): string[] {
  return [...REQUIRED_SCOPES];
}

/**
 * Format scopes for display
 */
export function formatScopesForDisplay(): Array<{ scope: string; description: string }> {
  return [
    {
      scope: 'merchant_r',
      description: 'Read your merchant information (name, location)'
    },
    {
      scope: 'inventory_r',
      description: 'Read your inventory items and stock levels'
    },
    {
      scope: 'inventory_w',
      description: 'Update inventory when syncing changes'
    }
  ];
}
