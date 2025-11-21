import { Express } from 'express';
import { authenticateToken } from '../../middleware/auth';

// Integration routes
import cloverRoutes from '../integrations/clover';
import googleBusinessOAuthRoutes from '../google-business-oauth';
import scanRoutes from '../scan';
import scanMetricsRoutes from '../scan-metrics';
import emailTestRoutes from '../email-test';
import testGbpRoutes from '../test-gbp';

/**
 * Mount integration routes
 * These handle third-party integrations and scanning
 */
export function mountIntegrationRoutes(app: Express) {
  console.log('🔌 Mounting integration routes...');

  // POS Integrations
  app.use('/api/integrations', cloverRoutes);
  console.log('✅ Clover integration routes mounted');

  // Temporarily disabled Square routes to fix production startup
  // app.use('/square', async (req, res, next) => {
  //   try {
  //     const routes = await getSquareRoutes();
  //     return routes(req, res, next);
  //   } catch (error) {
  //     console.error('[Square Routes] Lazy loading error:', error);
  //     res.status(500).json({ error: 'square_integration_unavailable' });
  //   }
  // });

  // Google Business Profile
  app.use('/api/google-business', googleBusinessOAuthRoutes);

  // Scanning and barcode processing
  app.use('/api', scanRoutes);
  console.log('✅ Scan routes mounted at /api/scan');
  app.use(scanMetricsRoutes);

  // Email and testing
  app.use('/api/email', emailTestRoutes);
  console.log('✅ Email routes mounted');
  app.use('/test', testGbpRoutes);

  console.log('✅ Integration routes mounted');
}
