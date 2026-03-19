import { Express } from 'express';
//import authRoutes from '../../auth/auth.routes';
import authSyncRoutes from '../auth-sync';
import onboardingRoutes from '../onboarding';

/**
 * Mount authentication routes
 * These are essential and should always be enabled
 */
export function mountAuthRoutes(app: Express) {
  console.log('🔐 Mounting authentication routes...');
  
  // Mount auth routes (no authentication required for these endpoints)
  // app.use('/auth', authRoutes);
  // app.use('/api/auth', authRoutes);
  
  // Auth sync routes (for Auth0 user synchronization)
  app.use('/api/auth', authSyncRoutes);
  
  // Onboarding routes (requires authentication)
  app.use('/api/auth/onboarding', onboardingRoutes);
  
  console.log('✅ Authentication routes mounted');
}
