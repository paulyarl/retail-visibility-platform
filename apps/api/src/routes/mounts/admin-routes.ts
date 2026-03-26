import { Express } from 'express';
import { authenticateToken } from '../../middleware/auth';

// Admin routes - re-enabled for localhost testing
import tenantFlagsRoutes from '../tenant-flags';
import platformFlagsRoutes from '../platform-flags';
import effectiveFlagsRoutes from '../effective-flags';
import adminToolsRoutes from '../admin-tools';
import adminUsersRoutes from '../admin-users';
import featureOverridesRoutes from '../admin/feature-overrides';
import tierManagementRoutes from '../admin/tier-management';
import tierSystemRoutes from '../admin/tier-system';
import taxonomyAdminRoutes from '../taxonomy-admin';
import adminTenantsRoutes from '../admin/tenants';
import platformCategoriesRoutes from '../admin/platform-categories';
import gbpCategoriesSyncRoutes from '../admin/gbp-categories-sync';
import securityRoutes from '../security';
import platformSettingsRoutes from '../admin/platform-settings';
import tickerConfigRoutes from '../admin/ticker-config';
import tickerMessagesRoutes from '../admin/ticker-messages';
import tiersRoutes from '../admin/tiers';
import adminAnalyticsRoutes from '../admin-analytics';
import adminSecurityMonitoringRoutes from '../admin/security-monitoring';
import navigationLinksRoutes from '../admin/navigation-links';
import categoriesPropagateRoutes from '../admin/categories-propagate';

/**
 * Mount admin routes
 * These handle platform administration and management
 */
export function mountAdminRoutes(app: Express) {
  console.log('👑 Mounting admin routes...');

  // Specific admin routes - MUST be mounted BEFORE generic routes to prevent conflicts
  app.use('/api/security', (req, res, next) => {
    // Skip telemetry routes - they have their own mounting
    if (req.path.startsWith('/telemetry')) {
      return next();
    }
    return securityRoutes(req, res, next);
  }); // Security routes have their own auth middleware
  app.use('/api/admin/platform-categories', authenticateToken, platformCategoriesRoutes);
  app.use('/api/admin/gbp-categories', authenticateToken,  gbpCategoriesSyncRoutes);
  app.use('/api/admin/feature-overrides', authenticateToken,  featureOverridesRoutes);
  app.use('/api/admin/tier-management', authenticateToken,  tierManagementRoutes);
  app.use('/api/admin/tier-system', authenticateToken,  tierSystemRoutes);
  app.use('/api/admin/tenants', authenticateToken,  adminTenantsRoutes);
  app.use('/api/admin/ticker-config', authenticateToken,  tickerConfigRoutes);
  app.use('/api/admin/ticker-messages', authenticateToken,  tickerMessagesRoutes);
  app.use('/api/admin/tiers', authenticateToken,  tiersRoutes);
  app.use('/api/admin/analytics', authenticateToken,  adminAnalyticsRoutes);
  app.use('/api/admin/security', authenticateToken,  adminSecurityMonitoringRoutes);
  app.use('/api/admin/navigation-links', authenticateToken,  navigationLinksRoutes);
  app.use('/api/admin/categories', authenticateToken, categoriesPropagateRoutes);
  
  // Tenant flags: accessible by platform admins OR store owners of that specific tenant
  app.use('/admin', authenticateToken, tenantFlagsRoutes);
  app.use('/api/admin', authenticateToken, tenantFlagsRoutes);
  
  // Admin tools and users - these are more generic and should come after specific routes
  app.use('/api/admin', authenticateToken,  adminToolsRoutes);
  app.use('/admin', authenticateToken, adminUsersRoutes);
  app.use('/api/admin', authenticateToken, adminUsersRoutes);
  app.use('/api/admin/taxonomy', authenticateToken, taxonomyAdminRoutes);
  app.use('/admin', authenticateToken, platformFlagsRoutes);
  app.use('/api/admin', authenticateToken, platformFlagsRoutes);
  
  // Effective flags: middleware applied per-route (admin for platform, tenant access for tenant)
  app.use('/admin', authenticateToken, effectiveFlagsRoutes);
  app.use('/api/admin', authenticateToken, effectiveFlagsRoutes);
  
  // Platform settings - mount LAST to avoid conflicts with generic /api/admin routes
  console.log('🔧 Mounting platform settings route...');
  // Restore original path now that we know the route works
  app.use('/api/admin/platform-settings', authenticateToken,  platformSettingsRoutes);
  console.log('✅ Platform settings route mounted at /api/admin/platform-settings');

  console.log('✅ Admin routes mounted');
}
