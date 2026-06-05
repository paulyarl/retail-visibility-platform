import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

interface PolicyRules {
  scope: string;
  countActivePrivate: boolean;
  countPreorder: boolean;
  countZeroPrice: boolean;
  requireImage: boolean;
  requireCurrency: boolean;
}

/**
 * Get effective policy for a tenant
 */
async function getEffectivePolicy(tenantId?: string): Promise<PolicyRules | null> {
  try {
    const scope = tenantId || 'global';

    const result = await prisma.$queryRaw<PolicyRules[]>(Prisma.sql`
      SELECT
        tenantId as scope,
        count_active_private,
        count_preorder,
        count_zero_price,
        require_image,
        require_currency
      FROM v_effective_sku_billing_policy
      WHERE tenantId = ${scope}
      LIMIT 1
    `);

    return result[0] || null;
  } catch (error) {
    console.error('[Policy] Error fetching effective policy:', error);
    return null;
  }
}

/**
 * Validate item against policy rules
 */
function validateItemAgainstPolicy(item: any, policy: PolicyRules): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check image requirement
  if (policy.requireImage && !item.imageUrl) {
    violations.push('Image is required by policy but not provided');
  }

  // Check currency requirement
  if (policy.requireCurrency && !item.currency) {
    violations.push('Currency is required by policy but not provided');
  }

  // Check zero price policy
  if (!policy.countZeroPrice && (item.price === 0 || item.priceCents === 0)) {
    violations.push('Zero-price items are not allowed by policy');
  }

  // Check preorder policy
  if (!policy.countPreorder && item.availability === 'preorder') {
    violations.push('Preorder items are not allowed by policy');
  }

  // Check private items policy
  if (!policy.countActivePrivate && item.visibility === 'private') {
    violations.push('Private items are not allowed by policy');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Middleware to enforce policy compliance on item creation/update
 */
export async function enforcePolicyCompliance(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Only enforce on POST (create) and PUT/PATCH (update)
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Only enforce on item endpoints, but exclude category assignment routes
    if (!req.path.includes('/items') && !req.path.includes('/inventory')) {
      return next();
    }

    // Skip policy enforcement for category assignment routes
    if (req.path.includes('/category')) {
      return next();
    }

    const tenantId = req.body?.tenantId || req.query?.tenantId;
    
    if (!tenantId) {
      // No tenant ID, skip policy check (will fail validation elsewhere)
      return next();
    }

    // Get effective policy
    const policy = await getEffectivePolicy(tenantId as string);

    if (!policy) {
      // No policy found, allow (fail-open for now)
      console.warn('[Policy] No effective policy found, allowing operation');
      return next();
    }

    // Validate item against policy
    const validation = validateItemAgainstPolicy(req.body, policy);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'policy_violation',
        message: 'Item does not comply with current policy',
        violations: validation.violations,
        policy: {
          scope: policy.scope,
          requireImage: policy.requireImage,
          requireCurrency: policy.requireCurrency,
          countZeroPrice: policy.countZeroPrice,
          countPreorder: policy.countPreorder,
          countActivePrivate: policy.countActivePrivate,
        },
      });
    }

    // Policy check passed, continue
    next();
  } catch (error) {
    console.error('[Policy Enforcement] Error:', error);
    // Fail-open: allow operation if policy check fails
    next();
  }
}

/**
 * Get compliance report for a tenant
 */
export async function getComplianceReport(tenantId: string) {
  try {
    const policy = await getEffectivePolicy(tenantId);

    if (!policy) {
      return {
        error: 'no_policy_found',
        tenantId,
      };
    }

    // Get all items for tenant
    const items = await prisma.inventory_items.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        sku: true,
        name: true,
        image_url: true,
        currency: true,
        price: true,
        price_cents: true,
        availability: true,
        visibility: true,
      },
    });

    // Check each item against policy
    const violations: Array<{
      item_id: string;
      sku: string;
      name: string;
      violations: string[];
    }> = [];

    for (const item of items) {
      const validation = validateItemAgainstPolicy(item, policy);
      if (!validation.valid) {
        violations.push({
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          violations: validation.violations,
        });
      }
    }

    return {
      tenantId,
      policy,
      totalItems: items.length,
      compliantItems: items.length - violations.length,
      violatingItems: violations.length,
      complianceRate: items.length > 0 ? ((items.length - violations.length) / items.length) * 100 : 100,
      violations,
    };
  } catch (error) {
    console.error('[Compliance Report] Error:', error);
    throw error;
  }
}
