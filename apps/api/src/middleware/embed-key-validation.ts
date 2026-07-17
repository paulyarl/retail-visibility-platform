/**
 * Embed Key Validation Middleware
 *
 * Resolves tenant ID from an embed key for external bot widget embeds.
 * Validates the requesting domain against the license's allowed_domains.
 *
 * Usage:
 *   router.get('/config', resolveEmbedKey, async (req, res) => {
 *     const tenantId = getTenantIdFromRequest(req, res);
 *     ...
 *   });
 *
 * The middleware checks (in order):
 *   1. x-embed-key header
 *   2. embedKey query parameter
 *   3. embedKey in request body
 *
 * If an embed key is present, it resolves the tenant and validates the domain.
 * If no embed key is present, the request passes through (fallback to tenantId).
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';

/**
 * Extract the origin domain from request headers.
 * Checks Origin first, then Referer.
 */
function getOriginDomain(req: Request): string | null {
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {
      return null;
    }
  }

  const referer = req.headers.referer as string | undefined;
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Check if a domain matches the allowed_domains list.
 * Supports wildcard subdomains (e.g., *.example.com).
 */
function isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true; // empty = allow all

  const normalizedDomain = domain.toLowerCase();

  for (const allowed of allowedDomains) {
    const normalized = allowed.toLowerCase();

    // Exact match
    if (normalized === normalizedDomain) return true;

    // Wildcard match: *.example.com matches sub.example.com
    if (normalized.startsWith('*.')) {
      const baseDomain = normalized.slice(2);
      if (normalizedDomain.endsWith('.' + baseDomain) || normalizedDomain === baseDomain) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Middleware: resolve embed key to tenant ID and validate domain.
 * Passes through if no embed key is present (fallback to tenantId-based auth).
 */
export async function resolveEmbedKey(req: Request, res: Response, next: NextFunction) {
  try {
    const embedKey =
      (req.headers['x-embed-key'] as string) ||
      (req.query.embedKey as string) ||
      (req.body?.embedKey as string);

    if (!embedKey) {
      return next(); // No embed key — fall through to tenantId-based resolution
    }

    const license = await prisma.tenant_bot_embed_licenses.findFirst({
      where: {
        embed_key: embedKey,
        status: 'active',
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      select: {
        id: true,
        tenant_id: true,
        allowed_domains: true,
        source: true,
      },
    });

    if (!license) {
      return res.status(403).json({
        success: false,
        error: 'invalid_embed_key',
        message: 'Embed key is invalid, expired, or revoked',
      });
    }

    // Validate domain (skip for same-origin requests from the platform itself)
    const originDomain = getOriginDomain(req);
    if (originDomain && !isDomainAllowed(originDomain, license.allowed_domains)) {
      return res.status(403).json({
        success: false,
        error: 'domain_not_allowed',
        message: `Domain '${originDomain}' is not in the allowed domains list for this embed license`,
      });
    }

    // Attach resolved tenant ID to res.locals (standard Express pattern)
    res.locals.embedTenantId = license.tenant_id;
    res.locals.embedLicense = license;

    next();
  } catch (error) {
    logger.error('[EmbedKeyValidation] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to validate embed key' });
  }
}

/**
 * Helper: extract tenant ID from request, preferring embed key resolution.
 * Use in route handlers that accept both tenantId and embedKey.
 */
export function getTenantIdFromRequest(req: Request, res: Response): string | null {
  return res.locals.embedTenantId ||
    (req.query.tenantId as string) ||
    (req.body?.tenantId as string) ||
    null;
}
