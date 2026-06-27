/**
 * TikTok Shop OAuth 2.0 Flow
 * Phase 2B: TikTok Shop Integration
 *
 * Implements secure OAuth flow for TikTok Shop API
 * (catalog sync + order ingestion)
 */

import crypto from 'crypto';

const TIKTOK_APP_KEY = process.env.TIKTOK_APP_KEY || '';
const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET || '';
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || '';
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const TIKTOK_AUTH_URL = 'https://auth.tiktok-shops.com/api/v2/oauth2/authorize';
const TIKTOK_TOKEN_URL = 'https://auth.tiktok-shops.com/api/v2/oauth2/access_token';
const TIKTOK_API_URL = 'https://open.tiktokglobalshop.com/api/v1';

export const TIKTOK_SCOPES = [
  'user.info.basic',
  'shop.product',
  'shop.order',
  'shop.product.stock',
];

/**
 * Generate authorization URL for TikTok Shop OAuth flow
 */
export function getAuthorizationUrl(tenantId: string): string {
  const state = generateState(tenantId);

  const params = new URLSearchParams({
    app_key: TIKTOK_APP_KEY,
    redirect_uri: TIKTOK_REDIRECT_URI,
    response_type: 'code',
    scope: TIKTOK_SCOPES.join(','),
    state,
  });

  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

/**
 * Generate and encode state parameter with tenant ID
 */
function generateState(tenantId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = {
    tenantId,
    nonce,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

/**
 * Decode and validate state parameter
 */
export function decodeState(state: string): { tenantId: string; nonce: string; timestamp: number } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());

    const age = Date.now() - decoded.timestamp;
    if (age > 10 * 60 * 1000) {
      console.error('[TikTok OAuth] State expired:', age);
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[TikTok OAuth] Invalid state:', error);
    return null;
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
} | null> {
  try {
    const params = new URLSearchParams({
      app_key: TIKTOK_APP_KEY,
      app_secret: TIKTOK_APP_SECRET,
      auth_code: code,
      grant_type: 'authorized_code',
    });

    const response = await fetch(`${TIKTOK_TOKEN_URL}?${params.toString()}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TikTok OAuth] Token exchange failed:', error);
      return null;
    }

    const result = await response.json() as any;
    if (result.code !== 0 && result.data) {
      return result.data as {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        refresh_expires_in: number;
        open_id: string;
      };
    }

    console.error('[TikTok OAuth] Token exchange error response:', result);
    return null;
  } catch (error) {
    console.error('[TikTok OAuth] Token exchange error:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
} | null> {
  try {
    const params = new URLSearchParams({
      app_key: TIKTOK_APP_KEY,
      app_secret: TIKTOK_APP_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(`${TIKTOK_TOKEN_URL}?${params.toString()}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TikTok OAuth] Token refresh failed:', error);
      return null;
    }

    const result = await response.json() as any;
    if (result.code !== 0 && result.data) {
      return result.data as {
        access_token: string;
        expires_in: number;
        refresh_token: string;
        refresh_expires_in: number;
      };
    }

    return null;
  } catch (error) {
    console.error('[TikTok OAuth] Token refresh error:', error);
    return null;
  }
}

/**
 * Get TikTok seller info
 */
export async function getSellerInfo(accessToken: string): Promise<{
  open_id: string;
  email: string;
  name: string;
  avatar_url: string;
  shop_id: string;
  shop_name: string;
} | null> {
  try {
    const params = new URLSearchParams({
      app_key: TIKTOK_APP_KEY,
      access_token: accessToken,
    });

    const response = await fetch(`${TIKTOK_API_URL}/user/info?${params.toString()}`);

    if (!response.ok) {
      console.error('[TikTok OAuth] Seller info fetch failed');
      return null;
    }

    const result = await response.json() as any;
    if (result.code !== 0 && result.data) {
      return {
        open_id: result.data.open_id || '',
        email: result.data.email || '',
        name: result.data.name || '',
        avatar_url: result.data.avatar_url || '',
        shop_id: result.data.shop?.id || '',
        shop_name: result.data.shop?.name || '',
      };
    }

    return null;
  } catch (error) {
    console.error('[TikTok OAuth] Seller info error:', error);
    return null;
  }
}

/**
 * Encrypt token for storage (same AES-256-GCM as Meta/Google OAuth)
 */
export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt token from storage
 */
export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
