/**
 * Provider-scoped Google OAuth token store.
 *
 * The platform runs two Google OAuth clients — Merchant Center (`gmc`) and
 * Business Profile (`gbp`). A refresh token is bound to the client that issued
 * it, so each provider keeps its own row in `google_oauth_tokens_list` (unique on
 * `account_id, provider`) and is refreshed with its own credentials.
 *
 * Sharing one row per account meant whichever OAuth flow connected last
 * overwrote the other's tokens, and the loser failed every later refresh.
 *
 * Migration 343 adds `provider` and the composite unique key.
 */

import { prisma } from '../../prisma';
import { unifiedConfig } from '../../config/unifiedConfig';
import { decryptToken, encryptToken, refreshAccessToken } from './oauth';
import { logger } from '../../logger';

export type GoogleTokenProvider = 'gmc' | 'gbp';

export interface GoogleTokenRow {
  id: string;
  account_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: Date;
}

/**
 * OAuth client credentials for a provider. Merchant Center uses the default
 * client baked into `lib/google/oauth.ts`; Business Profile passes its own.
 */
export function googleTokenCredentials(provider: GoogleTokenProvider) {
  return provider === 'gbp'
    ? {
        clientId: unifiedConfig.googleBusinessClientId,
        clientSecret: unifiedConfig.googleBusinessClientSecret,
      }
    : {};
}

/**
 * Find a provider's token row, scoped to a tenant or to a specific account.
 * Returns null when that provider has never been authorized.
 */
export async function findGoogleToken(
  provider: GoogleTokenProvider,
  scope: { tenantId?: string; accountId?: string },
): Promise<GoogleTokenRow | null> {
  if (scope.accountId) {
    return (await prisma.google_oauth_tokens_list.findFirst({
      where: { account_id: scope.accountId, provider },
      orderBy: { created_at: 'desc' },
    })) as GoogleTokenRow | null;
  }

  const account = await prisma.google_oauth_accounts_list.findFirst({
    where: { tenant_id: scope.tenantId },
    include: { google_oauth_tokens_list: { where: { provider }, take: 1 } },
  });

  return (account?.google_oauth_tokens_list[0] as GoogleTokenRow | undefined) ?? null;
}

/**
 * Resolve a usable access token from a stored row, refreshing it with the
 * provider's own client when it has expired.
 */
export async function resolveGoogleAccessToken(
  provider: GoogleTokenProvider,
  tokenRecord: GoogleTokenRow,
): Promise<string | null> {
  if (tokenRecord.expires_at > new Date()) {
    return decryptToken(tokenRecord.access_token_encrypted);
  }

  const refreshToken = decryptToken(tokenRecord.refresh_token_encrypted);
  const newTokens = await refreshAccessToken(refreshToken, googleTokenCredentials(provider));
  if (!newTokens) {
    logger.error(`[GoogleTokenStore] ${provider} token refresh failed`, undefined);
    return null;
  }

  await prisma.google_oauth_tokens_list.update({
    where: { id: tokenRecord.id },
    data: {
      access_token_encrypted: encryptToken(newTokens.access_token),
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
      updated_at: new Date(),
    },
  });

  return newTokens.access_token;
}

/**
 * Get a valid access token for a provider, scoped to a tenant or account.
 * Returns null when the provider is not authorized or the refresh fails.
 */
export async function getValidGoogleAccessToken(
  provider: GoogleTokenProvider,
  scope: { tenantId?: string; accountId?: string },
): Promise<string | null> {
  try {
    const tokenRecord = await findGoogleToken(provider, scope);
    if (!tokenRecord) return null;
    return await resolveGoogleAccessToken(provider, tokenRecord);
  } catch (error) {
    logger.error(`[GoogleTokenStore] Error resolving ${provider} access token:`, undefined, {
      error: {
        name: (error as any)?.name || 'Error',
        message: (error as any)?.message || String(error),
        stack: (error as any)?.stack,
      },
    });
    return null;
  }
}

/** Upsert a provider's tokens for an account. */
export async function upsertGoogleToken(
  accountId: string,
  provider: GoogleTokenProvider,
  tokens: { access_token: string; refresh_token: string; expires_at: Date; scopes: string[] },
): Promise<void> {
  await prisma.google_oauth_tokens_list.upsert({
    where: { account_id_provider: { account_id: accountId, provider } },
    create: {
      id: `got_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      account_id: accountId,
      provider,
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      expires_at: tokens.expires_at,
      scopes: tokens.scopes,
      updated_at: new Date(),
    },
    update: {
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      expires_at: tokens.expires_at,
      scopes: tokens.scopes,
      updated_at: new Date(),
    },
  });
}

/**
 * Drop one provider's tokens. The account row is removed only when no provider
 * tokens remain, so disconnecting one integration never silently drops the other.
 */
export async function deleteGoogleToken(tenantId: string, provider: GoogleTokenProvider): Promise<void> {
  const account = await prisma.google_oauth_accounts_list.findFirst({
    where: { tenant_id: tenantId },
    select: { id: true },
  });
  if (!account) return;

  await prisma.google_oauth_tokens_list.deleteMany({
    where: { account_id: account.id, provider },
  });

  const remaining = await prisma.google_oauth_tokens_list.count({
    where: { account_id: account.id },
  });
  if (remaining === 0) {
    await prisma.google_oauth_accounts_list.delete({ where: { id: account.id } });
  }
}
