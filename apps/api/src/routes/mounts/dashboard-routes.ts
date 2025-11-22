import { Express } from 'express';
import { authenticateToken, checkTenantAccess } from '../../middleware/auth';

// Dashboard and feature routes - temporarily disabled for isolation
// import dashboardRoutes from '../dashboard';
// import dashboardConsolidatedRoutes from '../dashboard-consolidated';
// import tenantTierRoutes from '../tenant-tier';
// import tenantLimitsRoutes from '../tenant-limits';
// import promotionRoutes from '../promotion';
// import businessHoursRoutes from '../business-hours';
// import quickStartRoutes from '../quick-start';
// import feedJobsRoutes from '../feed-jobs';
// import feedbackRoutes from '../feedback';
// import tenantCategoriesRoutes from '../tenant-categories';
// import feedValidationRoutes from '../feed-validation';

// Category scaffolds - temporarily disabled for isolation
// import categoriesPlatformRoutes from '../categories.platform';
// import categoriesTenantRoutes from '../categories.tenant';
// import categoriesMirrorRoutes from '../categories.mirror';
// import mirrorAdminRoutes from '../mirror.admin';
// import syncLogsRoutes from '../sync-logs';

/**
 * Mount dashboard and feature routes
 * These handle the main user-facing features and dashboards
 */
export function mountDashboardRoutes(app: Express) {
  console.log('📊 Mounting dashboard routes...');

  // Temporarily disabled for isolation
  console.log('⚠️ Dashboard routes disabled for debugging');

  console.log('✅ Dashboard routes mounted (disabled)');
}
