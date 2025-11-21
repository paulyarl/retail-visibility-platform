import { Express } from 'express';
import { authenticateToken, checkTenantAccess } from '../../middleware/auth';

// Dashboard and feature routes
import dashboardRoutes from '../dashboard';
import dashboardConsolidatedRoutes from '../dashboard-consolidated';
import tenantTierRoutes from '../tenant-tier';
import tenantLimitsRoutes from '../tenant-limits';
import promotionRoutes from '../promotion';
import businessHoursRoutes from '../business-hours';
import quickStartRoutes from '../quick-start';
import feedJobsRoutes from '../feed-jobs';
import feedbackRoutes from '../feedback';
import tenantCategoriesRoutes from '../tenant-categories';
import feedValidationRoutes from '../feed-validation';

// Category scaffolds
import categoriesPlatformRoutes from '../categories.platform';
import categoriesTenantRoutes from '../categories.tenant';
import categoriesMirrorRoutes from '../categories.mirror';
import mirrorAdminRoutes from '../mirror.admin';
import syncLogsRoutes from '../sync-logs';

/**
 * Mount dashboard and feature routes
 * These handle the main user-facing features and dashboards
 */
export function mountDashboardRoutes(app: Express) {
  console.log('📊 Mounting dashboard routes...');

  // Dashboard routes
  app.use('/api', dashboardRoutes); // Mount dashboard routes under /api prefix
  console.log('✅ Dashboard routes mounted');
  
  // Consolidated dashboard endpoint (reduces 4 calls to 1)
  app.use('/api', dashboardConsolidatedRoutes);
  console.log('✅ Consolidated dashboard route mounted');
  
  app.use('/api', promotionRoutes); // Promotion endpoints
  console.log('✅ Promotion routes mounted');
  
  app.use('/api', businessHoursRoutes); // Business hours management
  console.log('✅ Business hours routes mounted');
  
  app.use('/api', tenantTierRoutes); // Tenant tier and usage endpoints
  app.use('/api/tenant-limits', tenantLimitsRoutes); // Tenant creation limits
  console.log('✅ Tenant limits routes mounted');

  // v3.6.2-prep APIs
  app.use('/api/feed-jobs', feedJobsRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/v1/tenants', authenticateToken, checkTenantAccess, tenantCategoriesRoutes);
  app.use('/api/v1', quickStartRoutes);
  app.use('/api', feedValidationRoutes);

  // Category scaffolds (M3 start)
  app.use(categoriesPlatformRoutes);
  app.use(categoriesTenantRoutes);
  app.use(categoriesMirrorRoutes);
  app.use(mirrorAdminRoutes);
  app.use(syncLogsRoutes);

  console.log('✅ Dashboard routes mounted');
}
