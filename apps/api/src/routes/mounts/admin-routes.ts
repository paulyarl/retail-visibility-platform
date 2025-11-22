import { Express } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';

// Admin routes - temporarily disabled for isolation
// import tenantFlagsRoutes from '../tenant-flags';
// import platformFlagsRoutes from '../platform-flags';
// import effectiveFlagsRoutes from '../effective-flags';
// import adminToolsRoutes from '../admin-tools';
// import adminUsersRoutes from '../admin-users';
// import featureOverridesRoutes from '../admin/feature-overrides';
// import tierManagementRoutes from '../admin/tier-management';
// import tierSystemRoutes from '../admin/tier-system';
// import taxonomyAdminRoutes from '../taxonomy-admin';

/**
 * Mount admin routes
 * These handle platform administration and management
 */
export function mountAdminRoutes(app: Express) {
  console.log('👑 Mounting admin routes...');

  // Temporarily disabled for isolation
  console.log('⚠️ Admin routes disabled for debugging');

  console.log('✅ Admin routes mounted (disabled)');
}
