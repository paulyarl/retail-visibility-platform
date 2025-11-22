import { Express } from 'express';
import { authenticateToken, checkTenantAccess } from '../../middleware/auth';

// Directory routes - temporarily disabled for isolation
// import directoryRoutes from '../directory-v2';
// import directoryTenantRoutes from '../directory-tenant';
// import directoryAdminRoutes from '../directory-admin';
// import directorySupportRoutes from '../directory-support';
// import directoryCategoriesRoutes from '../directory-categories';
// import directoryStoreTypesRoutes from '../directory-store-types';

/**
 * Mount directory routes
 * These handle the public directory and discovery features
 */
export function mountDirectoryRoutes(app: Express) {
  console.log('📂 Mounting directory routes...');

  // Temporarily disabled for isolation
  console.log('⚠️ Directory routes disabled for debugging');

  console.log('✅ Directory routes mounted (disabled)');
}
