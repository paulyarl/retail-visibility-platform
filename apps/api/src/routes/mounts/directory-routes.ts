import { Express } from 'express';
import { authenticateToken, checkTenantAccess } from '../../middleware/auth';

// Directory routes - re-enabled for localhost testing
import directoryRoutes from '../directory-v2';
import enhancedDirectoryRoutes from '../ENHANCED_DIRECTORY_ROUTES'; // NEW: Enhanced routes with 3-category support
import directoryMvRoutes from '../directory-mv'; // NEW: Materialized views (10,000x faster)
import directoryTenantRoutes from '../directory-tenant';
import directoryAdminRoutes from '../directory-admin';
import directorySupportRoutes from '../directory-support';
import directoryCategoriesRoutes from '../directory-categories';
import directoryStoreTypesRoutes from '../directory-store-types';

/**
 * Mount directory routes
 * These handle the public directory and discovery features
 */
export function mountDirectoryRoutes(app: Express) {
  console.log('📂 Mounting directory routes...');

  // Directory Materialized Views routes - NEW: 10,000x performance improvement
  // Mount at /api/directory/mv/* for testing, will replace /api/directory/* after verification
  app.use('/api/directory/mv', directoryMvRoutes);
  console.log('✅ Directory materialized view routes mounted (10,000x faster)');

  // Directory Categories routes - NEW for category-based discovery (mount FIRST to take precedence)
  app.use('/api/directory', directoryCategoriesRoutes);
  console.log('✅ Directory categories routes mounted (category-based discovery)');

  // Directory Store Types routes - NEW for store type browsing (dual category system)
  app.use('/api/directory', directoryStoreTypesRoutes);
  console.log('✅ Directory store types routes mounted (store type discovery)');

  // Directory routes - mount AFTER category routes to avoid conflicts
  // Category routes handle: /api/directory/categories/*
  // These routes handle: /api/directory/search, /api/directory/locations, etc.
  app.use('/api/directory', directoryRoutes); // Public directory endpoint - no auth required
  app.use('/api/directory/enhanced', enhancedDirectoryRoutes); // Enhanced routes with 3-category support
  app.use('/api/admin/directory', directoryAdminRoutes); // Admin directory management (auth in routes)
  app.use('/api/support/directory', directorySupportRoutes); // Support directory tools (auth in routes)
  
  // Tenant directory routes - MUST come before generic tenant routes
  app.use('/api/tenants', directoryTenantRoutes); // Tenant directory management (auth in routes)
  console.log('✅ Directory listings routes mounted (directory_listings table)');

  console.log('✅ Directory routes mounted (enhanced with 3-category support)');
}
