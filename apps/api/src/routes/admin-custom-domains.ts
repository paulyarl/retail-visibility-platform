/**
 * Admin custom-domain management (sprint plan 5.1–5.3) — support tooling for
 * the tenant DIY flow and the DFY/concierge paths.
 *
 * Platform-admin only. Attach/remove run the same CustomDomainService methods
 * the tenant routes use (identical lifecycle + gates); each mutation is
 * audited with actor + reason.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requirePlatformAdmin } from '../middleware/auth';
import { customDomainService } from '../services/CustomDomainService';
import { audit } from '../audit';
import { logger } from '../logger';

const router = Router();

function actorId(req: Request): string {
  const user = req.user as any;
  return user?.userId || user?.user_id || user?.id || 'unknown';
}

/**
 * GET /api/admin/custom-domains?search=&status=&page=&limit=
 * All tenant custom domains — the "tenant says it's verified but it isn't"
 * support surface. `status` filters; default returns everything.
 */
router.get('/', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const page = Math.max(1, parseInt(String(req.query.page ?? ''), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? ''), 10) || 20));

    // Search predicate kept separate from the status filter: the per-status
    // chip counts describe the current search, but never the current status.
    const searchWhere: any = search
      ? {
          OR: [
            { domain: { contains: search, mode: 'insensitive' } },
            { tenants: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const where: any = {
      ...(status ? { status } : {}),
      ...searchWhere,
    };

    const [rows, total, statusGroups] = await Promise.all([
      prisma.custom_domains.findMany({
        where,
        include: { tenants: { select: { id: true, name: true, slug: true, subdomain: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.custom_domains.count({ where }),
      prisma.custom_domains.groupBy({ by: ['status'], where: searchWhere, _count: { _all: true } }),
    ]);

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        tenantName: r.tenants?.name,
        tenantSlug: r.tenants?.slug,
        tenantSubdomain: r.tenants?.subdomain,
        domain: r.domain,
        status: r.status,
        attachedHosts: r.attached_hosts,
        verificationToken: r.verification_token,
        verificationCheckedAt: r.verification_checked_at,
        verificationError: r.verification_error,
        certificateStatus: r.certificate_status,
        certificateError: r.certificate_error,
        isPrimary: r.is_primary,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total,
      page,
      limit,
      // Row counts per status for the filter chips (unfiltered by status).
      statusCounts: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
    });
  } catch (error: any) {
    logger.error('[GET /api/admin/custom-domains] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to list custom domains' });
  }
});

/**
 * GET /api/admin/custom-domains/:tenantId
 * Per-tenant detail: domain rows + composed entitlement/flag state (5.2) —
 * the answer to "why can't this tenant add a domain" in one call.
 */
router.get('/:tenantId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const [domains, entitlement] = await Promise.all([
      customDomainService.listForTenant(tenantId),
      customDomainService.entitlementFor(tenantId),
    ]);
    return res.json({ success: true, domains, entitlement });
  } catch (error: any) {
    logger.error('[GET /api/admin/custom-domains/:tenantId] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to load tenant domains' });
  }
});

/**
 * POST /api/admin/custom-domains/:tenantId
 * Operator attach — the DFY/concierge path. Body: { domain, apex?, reason? }
 * The capability + flag gate still applies (D12): grant the capability via
 * admin override first — that's what makes the demo-tenant flow work too.
 */
router.post('/:tenantId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { domain, apex, reason } = req.body ?? {};

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ success: false, error: 'bad_request', message: 'domain is required' });
    }

    const result = await customDomainService.addDomain(tenantId, domain, {
      apexDeclared: typeof apex === 'boolean' ? apex : undefined,
    });
    if (!result.ok) {
      const status =
        result.code === 'not_entitled' ? 403 :
        result.code === 'domain_taken' || result.code === 'domain_limit' ? 409 :
        result.code === 'unconfigured' ? 503 :
        result.code === 'vercel_error' ? 502 : 400;
      return res.status(status).json({ success: false, error: result.code, message: result.message });
    }

    await audit({
      tenantId,
      actor: actorId(req),
      actorType: 'user',
      action: 'tenant.custom_domain.add',
      payload: { id: result.domain.id, entity_type: 'custom_domain', after: result.domain, reason: reason ?? null },
    });

    return res.status(201).json({ success: true, data: result.domain, attachedHosts: result.attachedHosts });
  } catch (error: any) {
    logger.error('[POST /api/admin/custom-domains/:tenantId] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to add custom domain' });
  }
});

/**
 * POST /api/admin/custom-domains/:tenantId/:domainId/check
 * Force re-check — same lifecycle path as the tenant button and the sweeper.
 */
router.post('/:tenantId/:domainId/check', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, domainId } = req.params;
    const result = await customDomainService.checkDomain(tenantId, domainId);
    if (!result.ok) {
      const status = result.code === 'not_found' ? 404 : result.code === 'unconfigured' ? 503 : result.code === 'vercel_error' ? 502 : 400;
      return res.status(status).json({ success: false, error: result.code, message: result.message });
    }
    return res.json({ success: true, data: result.domain });
  } catch (error: any) {
    logger.error('[POST /api/admin/custom-domains/:tenantId/:domainId/check] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to check custom domain' });
  }
});

/**
 * DELETE /api/admin/custom-domains/:tenantId/:domainId
 * Operator remove — detaches Vercel hosts then deletes the row. Body: { reason? }
 */
router.delete('/:tenantId/:domainId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, domainId } = req.params;
    const { reason } = req.body ?? {};

    const before = await customDomainService.getDomain(tenantId, domainId);
    const result = await customDomainService.removeDomain(tenantId, domainId);
    if (!result.ok) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Domain not found' });
    }

    await audit({
      tenantId,
      actor: actorId(req),
      actorType: 'user',
      action: 'tenant.custom_domain.delete',
      payload: { id: domainId, entity_type: 'custom_domain', before, reason: reason ?? null },
    });

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[DELETE /api/admin/custom-domains/:tenantId/:domainId] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to remove custom domain' });
  }
});

export default router;
