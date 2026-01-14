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
import businessHoursRoutes from '../business-hours';
import taxonomyRoutes from '../taxonomy';
import analyticsRoutes from '../analytics';
import tenantsRoutes from '../tenants';
import tenantTierRoutes from '../tenant-tier';
import paymentGatewaysRoutes from '../payment-gateways';

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
  app.use('/api/user', userRoutes);
  
  // IMPORTANT: Mount public tier routes BEFORE authenticated tenant routes
  // This allows /api/tenants/:id/tier/public to work without auth
  app.use('/api', tenantTierRoutes);
  
  // IMPORTANT: Mount payment gateways WITHOUT global auth middleware
  // Individual routes handle their own authentication (public vs authenticated)
  app.use('/api/tenants', paymentGatewaysRoutes);
  
  app.use('/api/tenants', authenticateToken, tenantsRoutes);
  app.use('/api/tenants', authenticateToken, tenantUserRoutes);
  app.use(platformSettingsRoutes);
  app.use('/api/platform-stats', platformStatsRoutes);
  app.use('/api', businessHoursRoutes);
  app.use('/api/taxonomy', taxonomyRoutes);
  app.use('/api/analytics', analyticsRoutes);

  console.log('✅ Core business routes mounted');
}
