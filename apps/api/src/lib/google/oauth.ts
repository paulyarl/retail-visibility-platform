/**
 * Google OAuth 2.0 Flow
 * ENH-2026-043 + ENH-2026-044
 * 
 * Implements secure OAuth flow for Google Merchant Center + Business Profile
 */

import crypto from 'crypto';

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Required scopes for GMC + GBP
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/content', // Google Merchant API (replaces deprecated Content API)
  'https://www.googleapis.com/auth/business.manage', // Google Business Profile
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Generate authorization URL for OAuth flow
 */
export function getAuthorizationUrl(tenantId: string): string {
  const state = generateState(tenantId);
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    state,
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent to get refresh token
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
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
      console.error('[OAuth] State expired:', age);
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('[OAuth] Invalid state:', error);
    return null;
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
} | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OAuth] Token exchange failed:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[OAuth] Token exchange error:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
} | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OAuth] Token refresh failed:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[OAuth] Token refresh error:', error);
    return null;
  }
}

/**
 * Get user info from Google
 */
export async function getUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture: string;
} | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('[OAuth] User info fetch failed');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[OAuth] User info error:', error);
    return null;
  }
}

/**
 * Encrypt token for storage
 * Uses AES-256-GCM for authenticated encryption
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
 * Revoke Google OAuth token
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[OAuth] Token revocation error:', error);
    return false;
  }
}
