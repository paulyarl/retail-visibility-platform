/**
 * Meta (Facebook/Instagram) OAuth 2.0 Flow
 * Phase 2A: Meta Commerce Integration
 *
 * Implements secure OAuth flow for Meta Commerce Manager
 * (Instagram Shopping + Facebook Shop catalog sync)
 */

import crypto from 'crypto';

// Environment variables
const META_APP_ID = process.env.META_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || '';
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Meta OAuth endpoints
const META_AUTH_URL = 'https://www.facebook.com/v21.0/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/v21.0/oauth/access_token';
const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

// Required scopes for Meta Commerce
export const META_SCOPES = [
  'catalog_management',
  'instagram_basic',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_show_list',
  'business_management',
];

/**
 * Generate authorization URL for Meta OAuth flow
 */
export function getAuthorizationUrl(tenantId: string): string {
  const state = generateState(tenantId);

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    response_type: 'code',
    scope: META_SCOPES.join(','),
    state,
  });

  return `${META_AUTH_URL}?${params.toString()}`;
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

    // Validate timestamp (max 10 minutes old)
    const age = Date.now() - decoded.timestamp;
    if (age > 10 * 60 * 1000) {
      console.error('[Meta OAuth] State expired:', age);
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[Meta OAuth] Invalid state:', error);
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
} | null> {
  try {
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code,
    });

    const response = await fetch(META_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Meta OAuth] Token exchange failed:', error);
      return null;
    }

    return await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
    } | null;
  } catch (error) {
    console.error('[Meta OAuth] Token exchange error:', error);
    return null;
  }
}

/**
 * Get long-lived access token (exchanges short-lived token for a 60-day token)
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
} | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${META_TOKEN_URL}?${params.toString()}`);

    if (!response.ok) {
      const error = await response.text();
      console.error('[Meta OAuth] Long-lived token exchange failed:', error);
      return null;
    }

    return await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
    } | null;
  } catch (error) {
    console.error('[Meta OAuth] Long-lived token error:', error);
    return null;
  }
}

/**
 * Get Meta user info (Facebook ID, email, name)
 */
export async function getUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: { data: { url: string } };
} | null> {
  try {
    const params = new URLSearchParams({
      fields: 'id,email,name,picture',
      access_token: accessToken,
    });

    const response = await fetch(`${META_GRAPH_URL}/me?${params.toString()}`);

    if (!response.ok) {
      console.error('[Meta OAuth] User info fetch failed');
      return null;
    }

    return await response.json() as {
      id: string;
      email: string;
      name: string;
      picture?: { data: { url: string } };
    } | null;
  } catch (error) {
    console.error('[Meta OAuth] User info error:', error);
    return null;
  }
}

/**
 * Get Meta Business accounts for the authenticated user
 */
export async function getBusinessAccounts(accessToken: string): Promise<{
  data: Array<{
    id: string;
    name: string;
    instagram_business_account?: { id: string; username: string };
  }>;
} | null> {
  try {
    const params = new URLSearchParams({
      fields: 'id,name,instagram_business_account{username}',
      access_token: accessToken,
    });

    const response = await fetch(`${META_GRAPH_URL}/me/accounts?${params.toString()}`);

    if (!response.ok) {
      console.error('[Meta OAuth] Business accounts fetch failed');
      return null;
    }

    return await response.json() as {
      data: Array<{ id: string; name: string; instagram_business_account?: { id: string; username: string } }>;
    } | null;
  } catch (error) {
    console.error('[Meta OAuth] Business accounts error:', error);
    return null;
  }
}

/**
 * Get commerce catalogs for a business
 */
export async function getCatalogs(accessToken: string, businessId: string): Promise<{
  data: Array<{
    id: string;
    name: string;
  }>;
} | null> {
  try {
    const params = new URLSearchParams({
      fields: 'id,name',
      access_token: accessToken,
    });

    const response = await fetch(`${META_GRAPH_URL}/${businessId}/owned_product_catalogs?${params.toString()}`);

    if (!response.ok) {
      console.error('[Meta OAuth] Catalogs fetch failed');
      return null;
    }

    return await response.json() as {
      data: Array<{ id: string; name: string }>;
    } | null;
  } catch (error) {
    console.error('[Meta OAuth] Catalogs error:', error);
    return null;
  }
}

/**
 * Encrypt token for storage (same AES-256-GCM as Google OAuth)
 */
export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
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

/**
 * Revoke Meta OAuth token
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: token,
    });

    const response = await fetch(`${META_GRAPH_URL}/me/permissions?${params.toString()}`, {
      method: 'DELETE',
    });

    return response.ok;
  } catch (error) {
    console.error('[Meta OAuth] Token revocation error:', error);
    return false;
  }
}
