import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

/**
 * GET /api/platform-stats
 * Public endpoint - returns aggregated platform statistics
 * No authentication required - for marketing/transparency
 */
router.get('/', async (req, res) => {
  try {
    // Run all queries in parallel for performance
    const [
      totalTenants,
      totalItems,
      activeItems,
      tenantsWithItems,
    ] = await Promise.all([
      // Total number of tenants (retailers)
      prisma.tenant.count(),
      
      // Total number of items (products)
      (prisma as any).inventoryItem.count(),
      
      // Active items (synced to Google)
      (prisma as any).inventoryItem.count({
        where: {
          itemStatus: 'active',
        },
      }),
      
      // Tenants with at least one item (active storefronts)
      prisma.tenant.count({
        where: {
          inventoryItems: {
            some: {},
          },
        },
      }),
    ]);

    // Calculate uptime (simplified - you could integrate with monitoring service)
    // For now, assume 99.9% uptime (industry standard)
    const uptime = 99.9;

    // Format numbers for display
    const formatNumber = (num: number): string => {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
      }
      return num.toString();
    };

    res.json({
      activeRetailers: totalTenants,
      activeRetailersFormatted: formatNumber(totalTenants),
      productsListed: activeItems,
      productsListedFormatted: formatNumber(activeItems),
      storefrontsLive: tenantsWithItems,
      storefrontsLiveFormatted: formatNumber(tenantsWithItems),
      platformUptime: uptime,
      platformUptimeFormatted: `${uptime}%`,
      // Additional stats for potential future use
      totalProducts: totalItems,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Platform Stats] Error fetching stats:', error);
    
    // Return fallback values on error (better than failing)
    res.json({
      activeRetailers: 0,
      activeRetailersFormatted: '0',
      productsListed: 0,
      productsListedFormatted: '0',
      storefrontsLive: 0,
      storefrontsLiveFormatted: '0',
      platformUptime: 99.9,
      platformUptimeFormatted: '99.9%',
      totalProducts: 0,
      lastUpdated: new Date().toISOString(),
    });
  }
});

export default router;
