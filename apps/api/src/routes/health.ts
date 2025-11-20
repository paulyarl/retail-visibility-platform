import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../prisma';
import { prisma } from '../prisma';

const router = Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/health/db
 * Database connection health check
 */
router.get('/db', async (_req: Request, res: Response) => {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    const latency = Date.now() - start;
    
    // Get connection info (without sensitive data)
    const dbUrl = process.env.DATABASE_URL || '';
    const hostname = dbUrl.match(/@([^:]+):/)?.[1] || 'unknown';
    const port = dbUrl.match(/:(\d+)\//)?.[1] || 'unknown';
    
    res.json({ 
      status: 'ok',
      database: 'connected',
      hostname,
      port,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    const latency = Date.now() - start;
    console.error('[Database Health] Connection check failed:', error);
    
    res.status(503).json({ 
      status: 'error',
      database: 'disconnected',
      error: error.message,
      code: error.code,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/critical
 * Critical path health check (login flow)
 */
router.get('/critical', async (_req: Request, res: Response) => {
  const checks = {
    database: false,
    userQuery: false,
    sessionQuery: false,
  };
  
  const errors: string[] = [];
  const start = Date.now();
  
  try {
    // Check 1: Basic database connection
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    
    // Check 2: User table query (critical for login)
    const userCount = await prisma.users.count();
    checks.userQuery = true;
    
    // Check 3: Session table query (critical for auth)
    const sessionCount = await prisma.user_sessions.count();
    checks.sessionQuery = true;
    
    const latency = Date.now() - start;
    
    res.json({
      status: 'ok',
      message: 'All critical paths operational',
      checks,
      latency: `${latency}ms`,
      metrics: {
        user_tenants: userCount,
        sessions: sessionCount,
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    const latency = Date.now() - start;
    
    if (!checks.database) {
      errors.push('Database connection failed');
    } else if (!checks.userQuery) {
      errors.push('User table query failed');
    } else if (!checks.sessionQuery) {
      errors.push('Session table query failed');
    }
    
    console.error('[Critical Path Health] Failed:', {
      checks,
      errors,
      error: error.message
    });
    
    res.status(503).json({
      status: 'error',
      message: 'Critical path failure detected',
      checks,
      errors,
      latency: `${latency}ms`,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
