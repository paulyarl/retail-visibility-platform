import { Express } from 'express';

// Route group imports - can be enabled/disabled independently
import { mountAuthRoutes } from './mounts/auth-routes';
import { mountCoreRoutes } from './mounts/core-routes';
import { mountAdminRoutes } from './mounts/admin-routes';
import { mountIntegrationRoutes } from './mounts/integration-routes';
import { mountDirectoryRoutes } from './mounts/directory-routes';
import { mountDashboardRoutes } from './mounts/dashboard-routes';

/**
 * Mount minimal routes (always enabled)
 * These are the core routes needed for basic functionality
 */
export function mountMinimalRoutes(app: Express) {
  console.log('🔧 Mounting minimal routes only...');
  
  // Authentication routes (always needed)
  mountAuthRoutes(app);
  
  console.log('✅ Minimal routes mounted');
}

/**
 * Mount all routes (for full functionality)
 * This includes all feature routes and integrations
 */
export function mountAllRoutes(app: Express) {
  console.log('🚀 Mounting ALL routes for full functionality...');
  
  // Core authentication (always first)
  mountAuthRoutes(app);
  
  // All feature routes
  mountCoreRoutes(app);
  mountDashboardRoutes(app);
  mountAdminRoutes(app);
  mountIntegrationRoutes(app);
  mountDirectoryRoutes(app);
  
  console.log('✅ ALL routes mounted - full functionality enabled');
}
