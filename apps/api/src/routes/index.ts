import { Express } from 'express';
import { authenticateToken, checkTenantAccess, requireAdmin } from '../middleware/auth';

// Route group imports - can be enabled/disabled independently
import { mountAuthRoutes } from './mounts/auth-routes';
import { mountCoreRoutes } from './mounts/core-routes';
import { mountAdminRoutes } from './mounts/admin-routes';
import { mountIntegrationRoutes } from './mounts/integration-routes';
import { mountDirectoryRoutes } from './mounts/directory-routes';
import { mountDashboardRoutes } from './mounts/dashboard-routes';

/**
 * Mount all application routes
 * Each mount function can be enabled/disabled independently for isolation
 */
export function mountAllRoutes(app: Express) {
  console.log('🔧 Mounting application routes...');

  // Phase 1: Essential routes (always enabled)
  mountAuthRoutes(app);
  
  // Phase 2: Core business routes (can be disabled for isolation)
  try {
    mountCoreRoutes(app);
    console.log('✅ Core routes mounted');
  } catch (error) {
    console.error('❌ Core routes failed:', error);
  }

  // Phase 3: Admin routes (can be disabled for isolation)
  try {
    mountAdminRoutes(app);
    console.log('✅ Admin routes mounted');
  } catch (error) {
    console.error('❌ Admin routes failed:', error);
  }

  // Phase 4: Integration routes (can be disabled for isolation)
  try {
    mountIntegrationRoutes(app);
    console.log('✅ Integration routes mounted');
  } catch (error) {
    console.error('❌ Integration routes failed:', error);
  }

  // Phase 5: Directory routes (can be disabled for isolation)
  try {
    mountDirectoryRoutes(app);
    console.log('✅ Directory routes mounted');
  } catch (error) {
    console.error('❌ Directory routes failed:', error);
  }

  // Phase 6: Dashboard routes (can be disabled for isolation)
  try {
    mountDashboardRoutes(app);
    console.log('✅ Dashboard routes mounted');
  } catch (error) {
    console.error('❌ Dashboard routes failed:', error);
  }

  console.log('🚀 All routes mounted successfully');
}

/**
 * Mount only essential routes for minimal server
 */
export function mountMinimalRoutes(app: Express) {
  console.log('🔧 Mounting minimal routes only...');
  mountAuthRoutes(app);
  console.log('✅ Minimal routes mounted');
}
