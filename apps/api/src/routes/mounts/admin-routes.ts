import { Express } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';

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

/**
 * Mount admin routes
 * These handle platform administration and management
 */
export function mountAdminRoutes(app: Express) {
  console.log('👑 Mounting admin routes...');

  // Specific admin routes - MUST be mounted BEFORE generic routes to prevent conflicts
  app.use('/api/security', securityRoutes); // Security routes have their own auth middleware
  app.use('/api/admin/platform-categories', authenticateToken, requireAdmin, platformCategoriesRoutes);
  app.use('/api/admin/gbp-categories', authenticateToken, requireAdmin, gbpCategoriesSyncRoutes);
  app.use('/api/admin/feature-overrides', authenticateToken, requireAdmin, featureOverridesRoutes);
  app.use('/api/admin/tier-management', authenticateToken, requireAdmin, tierManagementRoutes);
  app.use('/api/admin/tier-system', authenticateToken, requireAdmin, tierSystemRoutes);
  app.use('/api/admin/tenants', authenticateToken, requireAdmin, adminTenantsRoutes);
  
  // Tenant flags: accessible by platform admins OR store owners of that specific tenant
  app.use('/admin', authenticateToken, tenantFlagsRoutes);
  app.use('/api/admin', authenticateToken, tenantFlagsRoutes);
  
  // Admin tools and users - these are more generic and should come after specific routes
  app.use('/api/admin', authenticateToken, requireAdmin, adminToolsRoutes);
  app.use('/admin', authenticateToken, adminUsersRoutes);
  app.use('/api/admin', authenticateToken, adminUsersRoutes);
  app.use('/admin/taxonomy', requireAdmin, taxonomyAdminRoutes);
  app.use('/admin', authenticateToken, platformFlagsRoutes);
  app.use('/api/admin', authenticateToken, platformFlagsRoutes);
  
  // Effective flags: middleware applied per-route (admin for platform, tenant access for tenant)
  app.use('/admin', authenticateToken, effectiveFlagsRoutes);
  app.use('/api/admin', authenticateToken, effectiveFlagsRoutes);
  
  // Platform settings - mount LAST to avoid conflicts with generic /api/admin routes
  console.log('🔧 Mounting platform settings route...');
  // Restore original path now that we know the route works
  app.use('/api/admin/platform-settings', authenticateToken, requireAdmin, platformSettingsRoutes);
  console.log('✅ Platform settings route mounted at /api/admin/platform-settings');

  console.log('✅ Admin routes mounted');
}
