/**
 * LinkedIn OAuth leg — member identity + organization-page discovery.
 *
 * Spec: docs/LocalBiz/LINKEDIN_POSTING_SPEC.md §4.0
 * Authorize at linkedin.com/oauth/v2/authorization → exchange at
 * linkedin.com/oauth/v2/accessToken (~60d access token, optional
 * refresh_token) → OIDC /v2/userinfo for the member identity →
 * /rest/organizationAcls for administered company pages.
 *
 * Tokens are MEMBER-scoped: one token posts to every org page the member
 * administers (author URN switches the page). Requires the Community
 * Management API product for w_organization_social / rw_organization_admin.
 */

import { logger } from '../../logger';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || '';
export const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202511';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API = 'https://api.linkedin.com';

export const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'w_organization_social',
  'rw_organization_admin',
  'r_organization_social',
];

export function getLinkedInAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    scope: LINKEDIN_SCOPES.join(' '),
    state,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

/** code → access token (+ optional refresh token). */
export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokenResponse | null> {
  try {
    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: LINKEDIN_REDIRECT_URI,
      }),
    });
    if (!res.ok) {
      logger.error('[LinkedIn OAuth] code exchange failed:', undefined, { error: { name: 'Error', message: await res.text() } });
      return null;
    }
    return (await res.json()) as LinkedInTokenResponse;
  } catch (error) {
    logger.error('[LinkedIn OAuth] exchange error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

/** refresh_token grant → fresh access (+ rotated refresh) token. */
export async function refreshLinkedInToken(refreshToken: string): Promise<LinkedInTokenResponse | null> {
  try {
    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as LinkedInTokenResponse;
  } catch {
    return null;
  }
}

/** OIDC userinfo — the member identity (sub is the stable person id). */
export async function getLinkedInUserinfo(accessToken: string): Promise<{ sub: string; name?: string; email?: string; picture?: string } | null> {
  try {
    const res = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { sub: string; name?: string; email?: string; picture?: string };
  } catch {
    return null;
  }
}

export interface LinkedInOrganization {
  /** Full author URN, e.g. urn:li:organization:12345 — stored as target_ref. */
  urn: string;
  id: string;
  name: string;
  /** Raw roleAssignee role — posting-eligible: ADMINISTRATOR, CONTENT_ADMINISTRATOR, DIRECT_SPONSORED_CONTENT_POSTER */
  role: string;
}

const ORG_ROLES = new Set([
  'ADMINISTRATOR',
  'CONTENT_ADMINISTRATOR',
  'DIRECT_SPONSORED_CONTENT_POSTER',
]);

/**
 * Pages the member administers — GET /rest/organizationAcls?q=roleAssignee.
 * Requires rw_organization_admin (Community Management API product).
 */
export async function getAdministeredOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
  try {
    const params = new URLSearchParams({
      q: 'roleAssignee',
      projection: '(elements*(*,roleAssignee~(localizedName),organization~(localizedName)))',
    });
    const res = await fetch(`${LINKEDIN_API}/rest/organizationAcls?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Linkedin-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!res.ok) {
      logger.warn('[LinkedIn OAuth] organizationAcls failed', undefined, { status: res.status });
      return [];
    }
    const json = (await res.json()) as {
      elements?: Array<{
        role?: string;
        roleAssignee?: string;
        organization?: string;
        'organization~'?: { localizedName?: string };
      }>;
    };
    return (json.elements ?? [])
      .map((el) => {
        const orgId = el.organization ? el.organization.replace('urn:li:organization:', '') : null;
        const memberId = el.roleAssignee ? el.roleAssignee.replace('urn:li:person:', '') : null;
        // Only surface pages where THIS member holds a posting-eligible role —
        // the ACL list is roleAssignee-scoped already, but keep the role filter
        // honest since CONTENT_ADMINISTRATOR posts but can't administer.
        void memberId;
        if (!orgId || !el.role || !ORG_ROLES.has(el.role)) return null;
        return {
          urn: `urn:li:organization:${orgId}`,
          id: orgId,
          name: el['organization~']?.localizedName || orgId,
          role: el.role,
        };
      })
      .filter((o): o is LinkedInOrganization => o !== null);
  } catch (error) {
    logger.error('[LinkedIn OAuth] organizations error:', undefined, { error: (error as any)?.message || String(error) });
    return [];
  }
}
