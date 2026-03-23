/**
 * Navigation Links API Routes
 *
 * Manages dynamically-configured sidebar links published from the
 * Admin Navigation Control Panel (/settings/admin/navigation).
 *
 * GET  /api/admin/navigation-links        — return all links ordered by sort_order
 * POST /api/admin/navigation-links        — bulk-replace the full link list
 * PUT  /api/admin/navigation-links/:id    — update a single link
 * DELETE /api/admin/navigation-links/:id  — delete a single link (built-in- prefix blocked)
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { prisma } from '../../prisma';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TARGETS      = ['all', 'tenant', 'admin'] as const;
const VALID_BADGE_VARIANTS = ['default', 'success', 'warning', 'error', 'new'] as const;

function toApiShape(row: any) {
  return {
    id:                  row.id,
    label:               row.label,
    href:                row.href,
    icon:                row.icon,
    badge:               row.badge,
    badgeVariant:        row.badge_variant,
    targets:             row.targets,
    order:               row.sort_order,
    enabled:             row.is_enabled,
    dividerBefore:       row.is_divider_before,
    requiredPermission:  row.required_permission,
    requiredGroup:       row.required_group,
    requiredRole:        row.required_role,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
  };
}

// ─── GET /api/admin/navigation-links ─────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const links = await prisma.navigation_links.findMany({
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    return res.json({
      success: true,
      data: links.map(toApiShape),
    });
  } catch (error) {
    console.error('[Navigation Links] GET error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch navigation links',
      userMessage: 'Unable to load navigation links',
    });
  }
});

// ─── POST /api/admin/navigation-links — bulk-replace ─────────────────────────
// Replaces all non-built-in links with the submitted list. Built-in links
// (id prefixed 'built-in-') are never deleted — only their mutable fields
// are updated if they are included in the payload.

router.post('/', async (req: Request, res: Response) => {
  try {
    const { links } = req.body as { links: any[] };

    if (!Array.isArray(links)) {
      return res.status(400).json({
        success: false,
        error: 'links array is required',
        userMessage: 'Please provide a links array',
      });
    }

    // Validate each link
    for (const link of links) {
      if (!link.label || typeof link.label !== 'string' || !link.label.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Each link must have a label',
          userMessage: 'All links must have a label',
        });
      }
      if (!link.href || typeof link.href !== 'string' || !link.href.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Each link must have an href',
          userMessage: 'All links must have a destination URL',
        });
      }
      if (!Array.isArray(link.targets) || link.targets.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Each link must have at least one target',
          userMessage: 'All links must be assigned to at least one sidebar',
        });
      }
      if (!link.targets.every((t: string) => (VALID_TARGETS as readonly string[]).includes(t))) {
        return res.status(400).json({
          success: false,
          error: `Invalid target value — must be one of: ${VALID_TARGETS.join(', ')}`,
          userMessage: 'Invalid sidebar target',
        });
      }
      if (link.badgeVariant && !(VALID_BADGE_VARIANTS as readonly string[]).includes(link.badgeVariant)) {
        return res.status(400).json({
          success: false,
          error: `Invalid badgeVariant — must be one of: ${VALID_BADGE_VARIANTS.join(', ')}`,
          userMessage: 'Invalid badge variant',
        });
      }
    }

    const userId = (req as any).user?.id || 'system';

    // Fetch built-in IDs before the transaction so we can exclude them from deletion
    const builtInRows = await prisma.navigation_links.findMany({
      where: { id: { startsWith: 'built-in-' } },
      select: { id: true },
    });
    const builtInIds = builtInRows.map(r => r.id);

    // Run as a transaction: delete non-built-in rows, then upsert all submitted links
    await prisma.$transaction(async (tx) => {
      // Delete all non-built-in links not present in the new payload
      const incomingIds = links
        .filter(l => l.id && !l.id.startsWith('built-in-'))
        .map(l => l.id as string);

      const preserveIds = [...builtInIds, ...incomingIds];

      await tx.navigation_links.deleteMany({
        where: {
          id: { notIn: preserveIds },
        },
      });

      // Upsert each link
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const data = {
          label:               link.label.trim(),
          href:                link.href.trim(),
          icon:                link.icon || '',
          badge:               link.badge || '',
          badge_variant:       link.badgeVariant || 'default',
          targets:             link.targets,
          sort_order:          link.order ?? i,
          is_enabled:          link.enabled !== false,
          is_divider_before:   link.dividerBefore === true,
          required_permission: link.requiredPermission || '',
          required_group:      link.requiredGroup || '',
          required_role:       link.requiredRole || '',
          updated_at:          new Date(),
        };

        if (link.id) {
          await tx.navigation_links.upsert({
            where:  { id: link.id },
            update: data,
            create: { id: link.id, ...data, created_by: userId },
          });
        } else {
          await tx.navigation_links.create({
            data: { ...data, created_by: userId },
          });
        }
      }
    });

    // Return the updated full list
    const saved = await prisma.navigation_links.findMany({
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    return res.json({
      success: true,
      data: saved.map(toApiShape),
      userMessage: 'Navigation links saved successfully',
    });
  } catch (error) {
    console.error('[Navigation Links] POST error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save navigation links',
      userMessage: 'Unable to save navigation links',
    });
  }
});

// ─── PUT /api/admin/navigation-links/:id — single update ─────────────────────

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const link = req.body;

    const existing = await prisma.navigation_links.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Link not found',
        userMessage: 'Navigation link not found',
      });
    }

    const updated = await prisma.navigation_links.update({
      where: { id },
      data: {
        ...(link.label        !== undefined && { label:               link.label.trim() }),
        ...(link.href         !== undefined && { href:                link.href.trim() }),
        ...(link.icon         !== undefined && { icon:                link.icon }),
        ...(link.badge        !== undefined && { badge:               link.badge }),
        ...(link.badgeVariant !== undefined && { badge_variant:       link.badgeVariant }),
        ...(link.targets      !== undefined && { targets:             link.targets }),
        ...(link.order        !== undefined && { sort_order:          link.order }),
        ...(link.enabled      !== undefined && { is_enabled:          link.enabled }),
        ...(link.dividerBefore !== undefined && { is_divider_before:  link.dividerBefore }),
        ...(link.requiredPermission !== undefined && { required_permission: link.requiredPermission }),
        ...(link.requiredGroup      !== undefined && { required_group:      link.requiredGroup }),
        ...(link.requiredRole       !== undefined && { required_role:       link.requiredRole }),
        updated_at: new Date(),
      },
    });

    return res.json({ success: true, data: toApiShape(updated), userMessage: 'Link updated' });
  } catch (error) {
    console.error('[Navigation Links] PUT error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update link',
      userMessage: 'Unable to update navigation link',
    });
  }
});

// ─── DELETE /api/admin/navigation-links/:id ───────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (id.startsWith('built-in-')) {
      return res.status(403).json({
        success: false,
        error: 'Built-in links cannot be deleted',
        userMessage: 'Built-in navigation links cannot be removed',
      });
    }

    const existing = await prisma.navigation_links.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Link not found',
        userMessage: 'Navigation link not found',
      });
    }

    await prisma.navigation_links.delete({ where: { id } });

    return res.json({ success: true, userMessage: 'Navigation link deleted' });
  } catch (error) {
    console.error('[Navigation Links] DELETE error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete link',
      userMessage: 'Unable to delete navigation link',
    });
  }
});

export default router;
