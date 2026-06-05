# Production Database Reliability Guide

## Critical Issue
Intermittent database connection failures in production are **unacceptable** for business operations.

## Root Cause
Supabase connection pooler can be unreliable with Vercel serverless functions due to:
1. Cold starts creating new connections
2. Connection pool exhaustion
3. Network latency/timeouts
4. Improper connection lifecycle management

## Production-Grade Solutions Implemented

### 1. Enhanced Retry Logic ✅
- **5 retries** with exponential backoff (200ms → 3200ms)
- Catches all connection error types:
  - `P1001` - Can't reach database
  - `PrismaClientInitializationError`
  - Connection refused errors
- Detailed logging for debugging

### 2. Connection Pooling Configuration ✅
```typescript
__internal: {
  engine: {
    connection_limit: 1 // One connection per serverless instance
  }
}
```

### 3. Proper Connection Lifecycle ✅
- Automatic disconnect on process exit
- No connection reuse in production (prevents stale connections)
- Health check helper for monitoring

## Required Vercel Environment Variables

### Current Configuration
```bash
DATABASE_URL=postgresql://postgres.pzxiurmwgkqhghxydazt:e64d93fe4e18b14@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&sslmode=require

DIRECT_URL=postgresql://postgres:e64d93fe4e18b14@db.pzxiurmwgkqhghxydazt.supabase.co:5432/postgres?sslmode=require

PRISMA_CLIENT_ENGINE_TYPE=binary
DATABASE_CONNECTION_TIMEOUT=10000
```

### Additional Recommended Variables
```bash
# Increase function timeout for database operations
VERCEL_FUNCTION_TIMEOUT=30

# Enable connection pooling
PRISMA_CONNECTION_POOL_SIZE=1

# Disable query logging in production (performance)
PRISMA_LOG_LEVEL=error
```

## Alternative Solutions (If Issues Persist)

### Option 1: Supabase Pooler Settings
In Supabase Dashboard → Settings → Database:
- **Pool Mode**: Session (not Transaction)
- **Pool Size**: 15 (default)
- **Max Client Connections**: 100

### Option 2: Use Prisma Accelerate (Recommended for Enterprise)
- Managed connection pooling
- Global edge caching
- 99.99% uptime SLA
- Cost: $29/month

```bash
# Replace DATABASE_URL with Accelerate URL
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY
```

### Option 3: Direct Connection (Not Recommended)
Only use if pooler continues to fail:
```bash
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres?sslmode=require
```
⚠️ **Warning**: Limited to 60 connections, will fail under load

### Option 4: Self-Hosted Connection Pooler
Deploy PgBouncer on Railway/Fly.io:
- Full control over pooling
- Better reliability
- Additional cost (~$5-10/month)

## Monitoring & Alerts

### 1. Add Vercel Integration
- Sentry for error tracking
- LogDrain for centralized logging
- Uptime monitoring (UptimeRobot, Pingdom)

### 2. Database Monitoring
```typescript
// Add to health check endpoint
app.get('/health/db', async (req, res) => {
  const start = Date.now();
  const isHealthy = await checkDatabaseConnection();
  const latency = Date.now() - start;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    latency: `${latency}ms`,
    timestamp: new Date().toISOString()
  });
});
```

### 3. Alert Thresholds
- Connection latency > 1000ms: Warning
- Connection latency > 3000ms: Critical
- Failed health checks > 3 in 5 min: Page on-call

## Testing Reliability

### Load Test Script
```bash
# Install artillery
npm install -g artillery

# Create test config
cat > load-test.yml <<EOF
config:
  target: 'https://your-api.vercel.app'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
    - get:
        url: "/health/db"
EOF

# Run test
artillery run load-test.yml
```

### Expected Results
- ✅ 99.9%+ success rate
- ✅ p95 latency < 500ms
- ✅ p99 latency < 1000ms
- ✅ Zero connection errors

## Rollback Plan

If issues persist after deployment:

1. **Immediate**: Revert to previous deployment in Vercel
2. **Short-term**: Switch to direct connection (accept lower capacity)
3. **Long-term**: Migrate to Prisma Accelerate or self-hosted pooler

## Success Criteria

- ✅ Zero "Can't reach database" errors in 24 hours
- ✅ All requests complete within 3 seconds
- ✅ 99.9% uptime over 7 days
- ✅ No customer-reported database issues

## Next Steps

1. Deploy these changes
2. Monitor logs for 24 hours
3. Run load tests
4. If issues persist, escalate to Option 2 (Prisma Accelerate)
