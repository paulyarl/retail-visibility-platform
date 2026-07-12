/**
 * Grant Token Service
 *
 * Handles signing and verification of BSaaS grant tokens used in QR codes
 * for private feature grants. Tokens are signed with the JWT secret and
 * contain feature_key, tenant_id (optional), duration_days, max_claims, and
 * qr_expiry.
 *
 * Phase 4: QR Codes for Private Grants
 */

import jwt from 'jsonwebtoken';
import { unifiedConfig } from '../config/unifiedConfig';

export interface GrantTokenPayload {
  grant_token_id: string;
  feature_key: string;
  tenant_id: string | null;
  duration_days: number | null;
  max_claims: number;
  qr_expires_at: string;
}

export interface VerifiedGrantToken extends GrantTokenPayload {
  iat: number;
  exp: number;
}

function getGrantTokenSecret(): string {
  return unifiedConfig.encryptionKey || process.env.JWT_ACCESS_SECRET || 'grant-token-fallback-secret';
}

export function signGrantToken(payload: Omit<GrantTokenPayload, 'qr_expires_at'> & { qr_expires_at: Date }): string {
  const secret = getGrantTokenSecret();
  const expiresIn = Math.floor((payload.qr_expires_at.getTime() - Date.now()) / 1000);
  return jwt.sign(
    {
      grant_token_id: payload.grant_token_id,
      feature_key: payload.feature_key,
      tenant_id: payload.tenant_id,
      duration_days: payload.duration_days,
      max_claims: payload.max_claims,
      qr_expires_at: payload.qr_expires_at.toISOString(),
    },
    secret,
    { expiresIn: Math.max(expiresIn, 1) },
  );
}

export function verifyGrantToken(token: string): VerifiedGrantToken | null {
  try {
    const secret = getGrantTokenSecret();
    const decoded = jwt.verify(token, secret) as VerifiedGrantToken;
    return decoded;
  } catch {
    return null;
  }
}

export function isGrantTokenExpired(token: VerifiedGrantToken): boolean {
  const qrExpiresAt = new Date(token.qr_expires_at);
  return qrExpiresAt.getTime() < Date.now();
}
