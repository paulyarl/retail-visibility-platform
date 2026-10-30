/**
 * Surface resolution — map a social_posts row to its connected surface and
 * decrypted token. The "platform profile" (§4.0): surfaces resolve
 * independently; a tenant can have Page+IG but no Threads.
 */

import { prisma } from '../../prisma';
import { decryptToken } from '../meta/oauth';
import { META_SURFACE_MAP, type SocialPlatform } from './types';

export interface ResolvedSurface {
  connectionId: string;
  surface: string;
  targetRef: string;
  displayName: string | null;
  token: string;
}

export async function resolveSurface(
  tenantId: string,
  platform: SocialPlatform,
  targetRef?: string | null,
): Promise<ResolvedSurface | null> {
  const surface = META_SURFACE_MAP[platform];
  if (!surface) return null;

  const connection = await prisma.meta_surface_connections.findFirst({
    where: {
      surface,
      ...(targetRef ? { target_ref: targetRef } : {}),
      meta_oauth_accounts_list: { tenant_id: tenantId },
    },
    orderBy: { connected_at: 'asc' },
    include: { meta_oauth_accounts_list: true },
  });
  if (!connection) return null;

  if (connection.token_expires_at && connection.token_expires_at <= new Date()) {
    return null; // lapsed Threads token — metaTokenRefresh job owns renewal
  }

  return {
    connectionId: connection.id,
    surface: connection.surface,
    targetRef: connection.target_ref,
    displayName: connection.display_name,
    token: decryptToken(connection.access_token_enc),
  };
}
