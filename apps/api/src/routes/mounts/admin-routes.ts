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

/**
 * Mount admin routes
 * These handle platform administration and management
 */
export function mountAdminRoutes(app: Express) {
  console.log('👑 Mounting admin routes...');

  // Tenant flags: accessible by platform admins OR store owners of that specific tenant
  // MUST be mounted BEFORE the generic /api/admin route below to prevent route matching conflicts
  app.use('/admin', authenticateToken, tenantFlagsRoutes);
  app.use('/api/admin', authenticateToken, tenantFlagsRoutes);
  
  // Admin tools and users - these are more generic and should come after specific routes
  app.use('/api/admin', authenticateToken, requireAdmin, adminToolsRoutes);
  app.use('/api/admin/feature-overrides', featureOverridesRoutes);
  app.use('/api/admin/tier-management', tierManagementRoutes);
  app.use('/api/admin/tier-system', tierSystemRoutes);
  app.use('/admin', authenticateToken, adminUsersRoutes);
  app.use('/api/admin', authenticateToken, adminUsersRoutes);
  app.use('/admin/taxonomy', requireAdmin, taxonomyAdminRoutes);
  app.use('/admin', authenticateToken, platformFlagsRoutes);
  app.use('/api/admin', authenticateToken, platformFlagsRoutes);
  
  // Effective flags: middleware applied per-route (admin for platform, tenant access for tenant)
  app.use('/admin', authenticateToken, effectiveFlagsRoutes);
  app.use('/api/admin', authenticateToken, effectiveFlagsRoutes);

  console.log('✅ Admin routes mounted');
}
