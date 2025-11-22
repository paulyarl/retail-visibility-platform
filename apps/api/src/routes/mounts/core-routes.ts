import { Express } from 'express';
import { authenticateToken, checkTenantAccess, requireAdmin } from '../../middleware/auth';
import { auditLogger } from '../../middleware/audit-logger';

// Core business routes - re-enabled for localhost testing
import auditRoutes from '../audit';
import policyRoutes from '../policy';
import billingRoutes from '../billing';
import subscriptionRoutes from '../subscriptions';
import categoryRoutes from '../categories';
import performanceRoutes from '../performance';
import organizationRoutes from '../organizations';
import organizationRequestRoutes from '../organization-requests';
import upgradeRequestsRoutes from '../upgrade-requests';
import permissionRoutes from '../permissions';
import userRoutes from '../users';
import tenantUserRoutes from '../tenant-users';
import platformSettingsRoutes from '../platform-settings';
import platformStatsRoutes from '../platform-stats';

/**
 * Mount core business routes
 * These handle the main business logic of the platform
 */
export function mountCoreRoutes(app: Express) {
  console.log('🏢 Mounting core business routes...');

  // Apply audit middleware globally (logs all write operations)
  app.use(auditLogger);

  // Mount v3.5 routes
  app.use(auditRoutes);
  app.use(policyRoutes);
  app.use(billingRoutes);
  app.use('/subscriptions', subscriptionRoutes);
  app.use('/api/categories', authenticateToken, categoryRoutes);
  app.use('/performance', performanceRoutes);
  app.use('/api/organizations', authenticateToken, organizationRoutes);
  app.use('/organization-requests', organizationRequestRoutes);
  app.use('/upgrade-requests', upgradeRequestsRoutes);
  app.use('/permissions', permissionRoutes);
  app.use('/users', userRoutes);
  app.use('/api/tenants', tenantUserRoutes);
  app.use(platformSettingsRoutes);
  app.use('/api/platform-stats', platformStatsRoutes);

  console.log('✅ Core business routes mounted');
}
