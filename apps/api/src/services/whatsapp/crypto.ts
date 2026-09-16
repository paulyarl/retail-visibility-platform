/**
 * WhatsApp Channel Credential Crypto
 *
 * Scoped assertion wrapper around lib/meta/oauth encryptToken/decryptToken.
 * Per spec §4.3/§8.8 (V11 decision): OAUTH_ENCRYPTION_KEY must be present and
 * exactly 64 hex chars for WhatsApp channel credentials — asserted lazily on
 * every credential operation so a missing/misconfigured key fails closed for
 * WhatsApp only. Meta Commerce and Google OAuth keep the existing module-load
 * fallback; removing that fallback globally is separate hardening work.
 */

import {
  encryptToken,
  decryptToken,
  isOauthEncryptionKeyConfigured,
} from '../../lib/meta/oauth';

export function assertChannelEncryptionKey(): void {
  if (!isOauthEncryptionKeyConfigured()) {
    throw new Error(
      'OAUTH_ENCRYPTION_KEY must be set to 64 hex characters before WhatsApp channel credentials can be used'
    );
  }
}

export function encryptChannelToken(token: string): string {
  assertChannelEncryptionKey();
  return encryptToken(token);
}

export function decryptChannelToken(encryptedToken: string): string {
  assertChannelEncryptionKey();
  return decryptToken(encryptedToken);
}
