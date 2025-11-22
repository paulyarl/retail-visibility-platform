import { Express } from 'express';
import { authenticateToken } from '../../middleware/auth';

// Integration routes - temporarily disabled for isolation
// import cloverRoutes from '../integrations/clover';
// import googleBusinessOAuthRoutes from '../google-business-oauth';
// import scanRoutes from '../scan';
// import scanMetricsRoutes from '../scan-metrics';
// import emailTestRoutes from '../email-test';
// import testGbpRoutes from '../test-gbp';

/**
 * Mount integration routes
 * These handle third-party integrations and scanning
 */
export function mountIntegrationRoutes(app: Express) {
  console.log('🔌 Mounting integration routes...');

  // Temporarily disabled for isolation
  console.log('⚠️ Integration routes disabled for debugging');

  console.log('✅ Integration routes mounted (disabled)');
}
