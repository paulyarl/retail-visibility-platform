/**
 * Admin subdomain management — list, rename, and remove tenant subdomains.
 *
 * Platform-admin only. All writes go through lib/subdomain.ts, which enforces
 * the reserved-name list, cross-namespace availability, and the mirror
 * invariant (subdomain = slug) via SlugSingletonService. Each mutation is
 * audited with before/after + reason.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requirePlatformAdmin } from '../middleware/auth';
import {
  assignSubdomain,
  clearSubdomain,
  checkSubdomainAvailability,
  type SubdomainFailureCode,
} from '../lib/subdomain';
import { audit } from '../audit';
import { logger } from '../logger';

const router = Router();

const ERROR_MESSAGES: Record<SubdomainFailureCode, string> = {
  invalid_subdomain:
    'Subdomain must be 2-30 characters, contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen',
  reserved_subdomain: 'This subdomain is reserved by the platform',
  subdomain_taken: 'This subdomain is already taken by another tenant',
  tenant_not_found: 'Tenant not found',
};

function failureStatus(code: SubdomainFailureCode): number {
  if (code === 'subdomain_taken') return 409;
  if (code === 'tenant_not_found') return 404;
  return 400;
}

function actorId(req: Request): string {
  const user = req.user as any;
  return user?.userId || user?.user_id || user?.id || 'unknown';
}

/**
 * GET /api/admin/subdomains?search=&page=&limit=
 * Tenants that currently have a subdomain (current-behaviour scope).
 */
router.get('/', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, parseInt(String(req.query.page ?? ''), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? ''), 10) || 20));

    const where: any = {
      subdomain: { not: null },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { subdomain: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.tenants.findMany({
        where,
        select: { id: true, name: true, slug: true, subdomain: true, created_at: true, updated_at: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tenants.count({ where }),
    ]);

    return res.json({
      success: true,
      data: rows.map((r) => ({
        tenantId: r.id,
        tenantName: r.name,
        slug: r.slug,
        subdomain: r.subdomain,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    logger.error('[GET /api/admin/subdomains] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to list subdomains' });
  }
});

/**
 * GET /api/admin/subdomains/check?value=&excludeTenantId=
 * Availability across both namespaces, for the rename modal.
 */
router.get('/check', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const value = typeof req.query.value === 'string' ? req.query.value : '';
    const excludeTenantId = typeof req.query.excludeTenantId === 'string' ? req.query.excludeTenantId : undefined;
    if (!value) {
      return res.status(400).json({ success: false, error: 'bad_request', message: 'value is required' });
    }

    const availability = await checkSubdomainAvailability(value, excludeTenantId);
    return res.json({
      success: true,
      available: availability.available,
      reason: availability.code ?? null,
      takenBy: availability.takenBy ?? null,
    });
  } catch (error: any) {
    logger.error('[GET /api/admin/subdomains/check] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to check availability' });
  }
});

/**
 * PUT /api/admin/subdomains/:tenantId
 * Assign or rename a tenant's subdomain. Body: { subdomain, reason? }
 */
router.put('/:tenantId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { subdomain, reason } = req.body ?? {};

    if (!subdomain || typeof subdomain !== 'string') {
      return res.status(400).json({ success: false, error: 'bad_request', message: 'subdomain is required' });
    }

    const result = await assignSubdomain(tenantId, subdomain);
    if (!result.ok) {
      return res.status(failureStatus(result.code)).json({
        success: false,
        error: result.code,
        message: ERROR_MESSAGES[result.code],
      });
    }

    await audit({
      tenantId,
      actor: actorId(req),
      actorType: 'user',
      action: 'tenant.subdomain.update',
      payload: { id: tenantId, entity_type: 'tenant', before: result.before, after: result.after, reason: reason ?? null },
    });

    return res.json({ success: true, data: result.after, before: result.before });
  } catch (error: any) {
    logger.error('[PUT /api/admin/subdomains/:tenantId] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update subdomain' });
  }
});

/**
 * DELETE /api/admin/subdomains/:tenantId
 * Remove a tenant's subdomain (slug retained). Body: { reason? }
 */
router.delete('/:tenantId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { reason } = req.body ?? {};

    const result = await clearSubdomain(tenantId);
    if (!result.ok) {
      return res.status(failureStatus(result.code)).json({
        success: false,
        error: result.code,
        message: ERROR_MESSAGES[result.code],
      });
    }

    await audit({
      tenantId,
      actor: actorId(req),
      actorType: 'user',
      action: 'tenant.subdomain.delete',
      payload: { id: tenantId, entity_type: 'tenant', before: result.before, after: result.after, reason: reason ?? null },
    });

    return res.json({ success: true, data: result.after, before: result.before });
  } catch (error: any) {
    logger.error('[DELETE /api/admin/subdomains/:tenantId] Error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to remove subdomain' });
  }
});

export default router;
