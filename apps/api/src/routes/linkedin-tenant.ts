import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { decryptToken } from '../lib/meta/oauth';
import {
  getLinkedInAuthorizationUrl,
  getAdministeredOrganizations,
} from '../lib/linkedin/oauth';
import { logger } from '../logger';

/**
 * Tenant-auth LinkedIn management (LINKEDIN_POSTING_SPEC §4.1, tenant twin).
 *
 * The customer-portal routes in social-customer.ts own the OAuth *callback*
 * (it's unauthenticated — state carries tenantId — so one callback serves
 * both flows; `flow:'tenant'` in state steers the post-connect redirect to
 * /t/:tid/settings/linkedin).
 *
 * These routes cover the tenant-side legs:
 *   GET    /:tenantId/linkedin/authorize      — build OAuth URL (flow=tenant)
 *   GET    /:tenantId/linkedin/status         — member account + surfaces
 *   GET    /:tenantId/linkedin/organizations  — administered company pages
 *   POST   /:tenantId/linkedin/select-surface — persist an organization_page
 *   DELETE /:tenantId/linkedin/surfaces/:id   — disconnect one org page
 */

const router = Router();

type SocialPostingMod = {
  enabled?: boolean;
  can_post_linkedin?: boolean;
  linkedin_enabled?: boolean;
};

async function canPostLinkedIn(tenantId: string): Promise<boolean> {
  const caps = await resolveEffectiveCapabilities(tenantId);
  const mod = caps?.effective?.social_posting as SocialPostingMod | undefined;
  return !!mod?.enabled && (!!mod.can_post_linkedin || !!mod.linkedin_enabled || (await permissionServiceFactory.hasFeature(tenantId, 'social_posting_linkedin')));
}

router.use('/:tenantId/linkedin', authenticateToken, checkTenantAccess);

router.get('/:tenantId/linkedin/authorize', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    if (!(await canPostLinkedIn(tenantId))) {
      return res.status(403).json({ success: false, error: 'entitlement_required', message: 'LinkedIn posting is not enabled' });
    }
    const state = Buffer.from(JSON.stringify({ tenantId, ts: Date.now(), flow: 'tenant' })).toString('base64url');
    res.json({ success: true, data: { url: getLinkedInAuthorizationUrl(state) } });
  } catch (error) {
    logger.error('[linkedin-tenant] authorize failed', undefined, { tenantId, error: String(error) });
    res.status(500).json({ success: false, error: 'authorize_failed' });
  }
});

router.get('/:tenantId/linkedin/status', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    const account = await prisma.linkedin_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: { linkedin_surface_connections: true },
    });
    res.json({
      success: true,
      data: {
        entitled: await canPostLinkedIn(tenantId),
        connected: !!account,
        memberName: account?.display_name ?? null,
        reauthorizationRequired: account?.reauthorization_required ?? false,
        tokenExpired: account?.token_expires_at ? account.token_expires_at <= new Date() : false,
        surfaces: (account?.linkedin_surface_connections ?? []).map((c) => ({
          id: c.id, surface: c.surface, targetRef: c.target_ref, displayName: c.display_name, memberRole: c.member_role,
        })),
      },
    });
  } catch (error) {
    logger.error('[linkedin-tenant] status failed', undefined, { tenantId, error: String(error) });
    res.status(500).json({ success: false, error: 'status_failed' });
  }
});

router.get('/:tenantId/linkedin/organizations', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    if (!(await canPostLinkedIn(tenantId))) {
      return res.status(403).json({ success: false, error: 'entitlement_required' });
    }
    const account = await prisma.linkedin_oauth_accounts_list.findFirst({ where: { tenant_id: tenantId } });
    if (!account) {
      return res.json({ success: true, data: { connected: false, organizations: [] } });
    }
    const orgs = await getAdministeredOrganizations(decryptToken(account.access_token_enc));
    res.json({ success: true, data: { connected: true, organizations: orgs } });
  } catch (error) {
    logger.error('[linkedin-tenant] organizations failed', undefined, { tenantId, error: String(error) });
    res.status(500).json({ success: false, error: 'organizations_failed' });
  }
});

const selectSchema = z.object({
  targetRef: z.string().regex(/^urn:li:organization:\d+$/, 'targetRef must be an organization URN'),
  displayName: z.string().max(255).optional(),
});

router.post('/:tenantId/linkedin/select-surface', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    const parsed = selectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', details: parsed.error.flatten() });
    }
    if (!(await canPostLinkedIn(tenantId))) {
      return res.status(403).json({ success: false, error: 'entitlement_required' });
    }
    const account = await prisma.linkedin_oauth_accounts_list.findFirst({ where: { tenant_id: tenantId } });
    if (!account) {
      return res.status(400).json({ success: false, error: 'not_connected', message: 'Connect LinkedIn first' });
    }

    // Verify the member administers this org when the ACL call returns data;
    // an empty ACL (scope pending) falls through on URN shape alone.
    const orgs = await getAdministeredOrganizations(decryptToken(account.access_token_enc));
    const match = orgs.find((o) => o.urn === parsed.data.targetRef);
    if (orgs.length > 0 && !match) {
      return res.status(404).json({ success: false, error: 'org_not_administered' });
    }

    const row = await prisma.linkedin_surface_connections.upsert({
      where: {
        linkedin_oauth_account_id_surface_target_ref: {
          linkedin_oauth_account_id: account.id,
          surface: 'organization_page',
          target_ref: parsed.data.targetRef,
        },
      },
      create: {
        id: `lsurf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        linkedin_oauth_account_id: account.id,
        surface: 'organization_page',
        target_ref: parsed.data.targetRef,
        display_name: parsed.data.displayName ?? match?.name ?? null,
        member_role: match?.role ?? null,
      },
      update: { display_name: parsed.data.displayName ?? match?.name ?? undefined, updated_at: new Date() },
    });
    res.json({ success: true, data: { surface: row } });
  } catch (error) {
    logger.error('[linkedin-tenant] select-surface failed', undefined, { tenantId, error: String(error) });
    res.status(500).json({ success: false, error: 'select_surface_failed' });
  }
});

router.delete('/:tenantId/linkedin/surfaces/:surfaceId', async (req: Request, res: Response) => {
  const { tenantId, surfaceId } = req.params;
  try {
    const conn = await prisma.linkedin_surface_connections.findUnique({
      where: { id: surfaceId },
      include: { linkedin_oauth_accounts_list: { select: { tenant_id: true } } },
    });
    if (!conn || conn.linkedin_oauth_accounts_list.tenant_id !== tenantId) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    await prisma.linkedin_surface_connections.delete({ where: { id: surfaceId } });
    res.json({ success: true });
  } catch (error) {
    logger.error('[linkedin-tenant] delete surface failed', undefined, { tenantId, surfaceId, error: String(error) });
    res.status(500).json({ success: false, error: 'delete_failed' });
  }
});

export default router;
