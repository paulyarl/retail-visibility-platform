import { Express } from 'express';

// Route group imports - can be enabled/disabled independently
import { mountAuthRoutes } from './mounts/auth-routes';
import { mountCoreRoutes } from './mounts/core-routes';
import { mountAdminRoutes } from './mounts/admin-routes';
import { mountIntegrationRoutes } from './mounts/integration-routes';
import { mountDirectoryRoutes } from './mounts/directory-routes';
import { mountDashboardRoutes } from './mounts/dashboard-routes';
import performanceApi from './performance-api';

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
  
  try {
    // Core authentication (always first)
    mountAuthRoutes(app);
  } catch (error) {
    console.error('❌ Error mounting auth routes:', error);
  }
  
  try {
    // All feature routes
    mountCoreRoutes(app);
  } catch (error) {
    console.error('❌ Error mounting core routes:', error);
  }
  
  try {
    mountDashboardRoutes(app);
  } catch (error) {
    console.error('❌ Error mounting dashboard routes:', error);
  }
  
  try {
    mountAdminRoutes(app);
  } catch (error) {
    console.error('❌ Error mounting admin routes:', error);
  }
  
  try {
    mountIntegrationRoutes(app);
  } catch (error) {
    console.error('❌ Error mounting integration routes:', error);
  }
  
  try {
    mountDirectoryRoutes(app);
  } catch (error) {
    console.error('❌ Error mounting directory routes:', error);
  }
  
  try {
    // Performance monitoring and optimization routes
    app.use('/api/admin/performance', performanceApi);
    console.log('✅ Performance routes mounted');
  } catch (error) {
    console.error('❌ Error mounting performance routes:', error);
  }
  
  console.log('✅ ALL routes mounted - full functionality enabled');
}
