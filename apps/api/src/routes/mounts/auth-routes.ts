import { Express } from 'express';
import authRoutes from '../../auth/auth.routes';

/**
 * Mount authentication routes
 * These are essential and should always be enabled
 */
export function mountAuthRoutes(app: Express) {
  console.log('🔐 Mounting authentication routes...');
  
  // Mount auth routes (no authentication required for these endpoints)
  app.use('/auth', authRoutes);
  app.use('/api/auth', authRoutes);
  
  console.log('✅ Authentication routes mounted');
}
