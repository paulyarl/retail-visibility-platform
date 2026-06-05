# 🚀 Railway + Vercel Deployment Setup with Redis Cache

## 📋 Overview

This guide shows how to deploy the RVP platform with Redis caching using Railway (API) and Vercel (Frontend).

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel (Web)  │────│  Railway (API)  │────│   Redis Cache   │
│   Next.js App   │    │   Express API   │    │   Railway Redis │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛤️ Railway Setup (API + Redis)

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway new
```

### 2. Railway Configuration

Create `railway.toml` in root:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/api/Dockerfile"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
healthcheckPath = "/api/health"
healthcheckTimeout = 300
startCommand = "npm start"

[[services]]
name = "api"
source = "."
[services.environment]
NODE_ENV = "production"
PORT = "8080"

# Redis Configuration
[services.variables]
REDIS_URL = "${{REDIS_SERVICE_URL}}"
REDIS_HOST = "${{REDIS_SERVICE_HOST}}"
REDIS_PORT = "${{REDIS_SERVICE_PORT}}"

# Database Configuration
[services.variables]
DATABASE_URL = "${{POSTGRES_CONNECTION_URL}}"
DATABASE_HOST = "${{POSTGRES_HOST}}"
DATABASE_PORT = "${{POSTGRES_PORT}}"
DATABASE_USER = "${{POSTGRES_USER}}"
DATABASE_PASSWORD = "${{POSTGRES_PASSWORD}}"
DATABASE_NAME = "${{POSTGRES_DATABASE}}"

# Application Configuration
[services.variables]
JWT_SECRET = "${{JWT_SECRET}}"
NEXTAUTH_SECRET = "${{NEXTAUTH_SECRET}}"
NEXTAUTH_URL = "${{NEXTAUTH_URL}}"
STORAGE_BUCKET = "${{STORAGE_BUCKET}}"
SUPABASE_URL = "${{SUPABASE_URL}}"
SUPABASE_ANON_KEY = "${{SUPABASE_ANON_KEY}}"
SUPABASE_SERVICE_KEY = "${{SUPABASE_SERVICE_KEY}}"

# External Services
[services.variables]
SENDGRID_API_KEY = "${{SENDGRID_API_KEY}}"
STRIPE_SECRET_KEY = "${{STRIPE_SECRET_KEY}}"
STRIPE_WEBHOOK_SECRET = "${{STRIPE_WEBHOOK_SECRET}}"
PAYPAL_CLIENT_ID = "${{PAYPAL_CLIENT_ID}}"
PAYPAL_CLIENT_SECRET = "${{PAYPAL_CLIENT_SECRET}}"
SQUARE_ACCESS_TOKEN = "${{SQUARE_ACCESS_TOKEN}}"
SQUARE_ENVIRONMENT = "${{SQUARE_ENVIRONMENT}}"

# Monitoring & Analytics
[services.variables]
NEW_RELIC_LICENSE_KEY = "${{NEW_RELIC_LICENSE_KEY}}"
SENTRY_DSN = "${{SENTRY_DSN}}"

# Cache Configuration
[services.variables]
CACHE_TTL_DEFAULT = "900"  # 15 minutes
CACHE_TTL_SHORT = "300"    # 5 minutes
CACHE_TTL_LONG = "3600"    # 1 hour

# Health Check Configuration
[services.health_checks]
path = "/api/health"
port = 8080
timeout_seconds = 30
interval_seconds = 10
grace_period_seconds = 60

# Scaling Configuration
[services.scale]
min = 1
max = 3
target_cpu_percent = 70
target_memory_percent = 80

# Redis Service Configuration
[[services]]
name = "redis"
source = "railway/redis:7.2"
[services.variables]
REDIS_MAXMEMORY = "256mb"
REDIS_MAXMEMORY_POLICY = "allkeys-lru"

# Database Service Configuration
[[services]]
name = "postgres"
source = "railway/postgresql:16.1"
[services.variables]
POSTGRES_USER = "postgres"
POSTGRES_DB = "rvp_platform"
```

### 3. Deploy to Railway

```bash
# Add services to Railway
railway add postgresql
railway add redis

# Deploy API
railway up

# Get API URL
railway domain
```

### 4. Railway Environment Variables

Set these in Railway dashboard:

```bash
# Core Application
NODE_ENV=production
PORT=8080
JWT_SECRET=your-jwt-secret-here
NEXTAUTH_SECRET=your-nextauth-secret-here

# Database (auto-populated by Railway)
DATABASE_URL=${{POSTGRES_CONNECTION_URL}}

# Redis (auto-populated by Railway)
REDIS_URL=${{REDIS_SERVICE_URL}}

# External Services
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
STORAGE_BUCKET=your-storage-bucket

# Payment Services
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
SQUARE_ACCESS_TOKEN=sq0atp-...

# Email & Communication
SENDGRID_API_KEY=SG.your-sendgrid-key

# Monitoring
NEW_RELIC_LICENSE_KEY=your-newrelic-key
SENTRY_DSN=your-sentry-dsn
```

## 🌐 Vercel Setup (Frontend)

### 1. Install Vercel CLI

```bash
npm install -g vercel
vercel login
```

### 2. Vercel Configuration

Create `vercel.json` in root:

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install --filter=web --filter=shared",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_URL": "${{NEXT_PUBLIC_API_URL}}",
    "NEXT_PUBLIC_SUPABASE_URL": "${{NEXT_PUBLIC_SUPABASE_URL}}",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "${{NEXT_PUBLIC_SUPABASE_ANON_KEY}}",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "${{NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}}",
    "NEXT_PUBLIC_PAYPAL_CLIENT_ID": "${{NEXT_PUBLIC_PAYPAL_CLIENT_ID}}"
  },
  "build": {
    "env": {
      "NEXT_PUBLIC_API_URL": "${{NEXT_PUBLIC_API_URL}}",
      "NEXT_PUBLIC_SUPABASE_URL": "${{NEXT_PUBLIC_SUPABASE_URL}}",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY": "${{NEXT_PUBLIC_SUPABASE_ANON_KEY}}",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "${{NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}}",
      "NEXT_PUBLIC_PAYPAL_CLIENT_ID": "${{NEXT_PUBLIC_PAYPAL_CLIENT_ID}}"
    }
  },
  "functions": {
    "app/**/*.ts": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 30
    },
    "app/**/*.js": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, must-revalidate"
        }
      ]
    },
    {
      "source": "/_next/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/images/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=86400"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "${NEXT_PUBLIC_API_URL}/api/:path*"
    }
  ]
}
```

### 3. Deploy to Vercel

```bash
# Deploy frontend
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_PAYPAL_CLIENT_ID production
```

### 4. Vercel Environment Variables

Set these in Vercel dashboard:

```bash
# Public Variables (exposed to browser)
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
```

## 🔧 Redis Configuration

### 1. Redis Connection

The unified cache service automatically connects to Redis:

```typescript
// apps/api/src/lib/cache-service.ts
const initRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    console.log('[CacheService] Redis connected successfully');
  } catch (error) {
    console.warn('[CacheService] Redis connection failed, using fallback cache:', error);
    redisClient = null;
  }
};
```

### 2. Redis Environment Variables

```bash
# Railway (auto-populated)
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# Redis Cloud (optional)
REDIS_URL=rediss://:password@host:port
```

### 3. Cache TTL Configuration

```typescript
// apps/api/src/lib/cache-service.ts
export const CACHE_TTL = {
  SHORT: 5 * 60,        // 5 minutes
  MEDIUM: 15 * 60,      // 15 minutes
  LONG: 60 * 60,       // 1 hour
  VERY_LONG: 4 * 60 * 60, // 4 hours
  DAILY: 24 * 60 * 60,  // 1 day
} as const;
```

## 📊 Monitoring & Health Checks

### 1. API Health Check

Create health check endpoint:

```typescript
// apps/api/src/routes/health.ts
router.get('/health', async (req, res) => {
  try {
    const stats = await CacheService.getStats();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cache: stats,
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### 2. Railway Health Checks

```toml
[services.health_checks]
path = "/api/health"
port = 8080
timeout_seconds = 30
interval_seconds = 10
grace_period_seconds = 60
```

### 3. Vercel Analytics

Enable Vercel Analytics in dashboard:
- Go to Project Settings → Analytics
- Enable Web Vitals
- Set up custom events for cache performance

## 🚀 Deployment Commands

### Railway Commands

```bash
# Deploy all services
railway up

# Deploy specific service
railway up --service api

# View logs
railway logs

# Get service URL
railway domain

# Scale services
railway scale api min=1 max=3

# Add new service
railway add redis
railway add postgresql
```

### Vercel Commands

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel

# View deployment logs
vercel logs

# List deployments
vercel list

# Inspect build
vercel inspect
```

## 🔍 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis logs
   railway logs --service redis
   
   # Verify Redis URL
   echo $REDIS_URL
   ```

2. **API Not Responding**
   ```bash
   # Check API logs
   railway logs --service api
   
   # Verify health endpoint
   curl https://your-app.railway.app/api/health
   ```

3. **Frontend API Calls Failing**
   ```bash
   # Check environment variables
   vercel env ls
   
   # Verify API URL is accessible
   curl https://your-railway-app.railway.app/api/health
   ```

### Debug Mode

Enable debug logging:

```bash
# Railway
railway variables set DEBUG=*

# Vercel
vercel env add DEBUG production
```

## 📈 Performance Optimization

### Redis Optimization

```toml
# Railway Redis Configuration
[services.variables]
REDIS_MAXMEMORY = "256mb"
REDIS_MAXMEMORY_POLICY = "allkeys-lru"
```

### Cache Strategy

```typescript
// Cache frequently accessed data
await CacheService.set(CacheKeys.TENANT_INFO(tenantId), data, CACHE_TTL.MEDIUM);
await CacheService.set(CacheKeys.FEATURED_PRODUCTS(location), data, CACHE_TTL.SHORT);
await CacheService.set(CacheKeys.ADMIN_DASHBOARD(), data, CACHE_TTL.LONG);
```

### Database Optimization

```sql
-- Add indexes for cached queries
CREATE INDEX idx_storefront_products_tenant_featured ON storefront_products(tenant_id, is_actively_featured);
CREATE INDEX idx_directory_listings_published ON directory_listings_list(is_published, lat, lng);
```

## 🎯 Production Checklist

### Pre-Deployment

- [ ] All environment variables set
- [ ] Redis connection tested
- [ ] Database migrations run
- [ ] SSL certificates configured
- [ ] Health checks passing
- [ ] Monitoring configured

### Post-Deployment

- [ ] Verify API endpoints
- [ ] Test cache performance
- [ ] Check frontend functionality
- [ ] Monitor error rates
- [ ] Set up alerts
- [ ] Backup database

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Vercel Documentation](https://vercel.com/docs)
- [Redis Documentation](https://redis.io/documentation)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)

---

**🎉 Your RVP platform is now ready for production with Redis caching!**
🔍 Redis Connection Architecture
✅ Current Setup:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ www.visibleshelf │────│  aps.visibleshelf│────│   Redis Cache   │
│    (Vercel)     │    │   (Railway)     │    │  (Internal)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Supabase DB    │
                    │  (External)     │
                    └─────────────────┘
🎯 Redis Connection Types:
✅ Internal Railway Redis (Recommended):
bash
# Railway provides internal Redis URL
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
# No custom domain needed - internal service discovery
✅ External Redis Cloud (Optional):
bash
# If using Redis Cloud instead of Railway Redis
REDIS_URL=rediss://your-redis-cloud-host:port
REDIS_HOST=your-redis-cloud-host
REDIS_PORT=port
# Still no visibleshelf.store domain needed
🔧 Railway Redis Setup:
✅ Add Redis Service:
bash
# Add Railway Redis (internal)
railway add redis
# Railway automatically provides:
# - REDIS_SERVICE_URL
# - REDIS_SERVICE_HOST  
# - REDIS_SERVICE_PORT
✅ Environment Variables:
toml
# Railway.toml
[services.variables]
# Internal Railway Redis (auto-populated)
REDIS_URL = "${{REDIS_SERVICE_URL}}"
REDIS_HOST = "${{REDIS_SERVICE_HOST}}"
REDIS_PORT = "${{REDIS_SERVICE_PORT}}"
🚀 Connection Examples:
✅ Internal Railway Redis:
typescript
// apps/api/src/lib/cache-service.ts
const initRedis = async () => {
  try {
    redisClient = createClient({
      // Railway automatically provides this
      url: process.env.REDIS_URL || 'redis://redis:6379'
    });
    await redisClient.connect();
    console.log('[CacheService] Redis connected successfully');
  } catch (error) {
    console.warn('[CacheService] Redis connection failed, using fallback cache:', error);
  }
};
✅ No Custom Domain Needed:
bash
# ❌ NOT NEEDED
REDIS_URL=redis://redis.visibleshelf.store:6379
# ✅ CORRECT (Internal Railway)
REDIS_URL=redis://redis:6379
📊 Service Discovery:
✅ Railway Internal Services:
bash
# Railway automatically resolves service names
redis:6379          # Redis service
postgres:5432       # PostgreSQL service (if used)
api:8080           # API service
✅ External Services:
bash
# External services need full URLs
https://www.visibleshelf.store    # Frontend
https://aps.visibleshelf.store    # API
https://your-project.supabase.co  # Supabase
🔧 Complete Environment Setup:
✅ Railway Variables:
bash
# Internal Services (no custom domain)
REDIS_URL=${{REDIS_SERVICE_URL}}
REDIS_HOST=${{REDIS_SERVICE_HOST}}
REDIS_PORT=${{REDIS_SERVICE_PORT}}
# External Services (custom domains)
NEXTAUTH_URL=https://aps.visibleshelf.store
SUPABASE_URL=https://your-project.supabase.co
✅ Vercel Variables:
bash
# External API endpoint
NEXT_PUBLIC_API_URL=https://aps.visibleshelf.store
🎯 Network Architecture:
✅ Internal Network:
Railway Internal Network:
├── api:8080 (your API)
├── redis:6379 (Redis cache)
└── postgres:5432 (if used)
 
# These communicate internally without custom domains
✅ External Network:
Public Internet:
├── https://www.visibleshelf.store (Vercel)
├── https://aps.visibleshelf.store (Railway API)
└── https://your-project.supabase.co (Supabase)
🚀 Deployment Commands:
✅ Railway Setup:
bash
# Add Redis service (internal)
railway add redis
# Deploy API
railway up
# Get API URL (external)
railway domain
# Output: https://aps.visibleshelf.store
✅ Redis Connection Test:
typescript
// Test Redis connection in API
router.get('/cache/test', async (req, res) => {
  try {
    await CacheService.set('test', { message: 'Redis working!' }, 60);
    const cached = await CacheService.get('test');
    res.json({ 
      success: true, 
      cached,
      redisConnected: true 
    });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.message,
      redisConnected: false 
    });
  }
});
📈 Benefits of Internal Redis:
✅ Performance:
No network latency (same data center)
Internal service discovery (no DNS lookups)
Secure connection (internal network)
Auto-scaling with Railway
✅ Cost:
Included in Railway plan
No external Redis hosting needed
No custom SSL certificates
No domain management
Redis uses Railway's internal service discovery - no visibleshelf.store URL needed! 🎉

Exactly right! You've identified the key architectural pattern. Let me clarify the awareness relationships:

🔍 Service Awareness Architecture
✅ Current Awareness Pattern:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel Web    │────│  Railway API    │────│   Redis Cache   │
│                 │    │                 │    │                 │
│ Knows API URL   │    │ Knows Redis URL │    │ Knows Nothing   │
│ (configurable)  │    │ (auto-provided) │    │ (just storage)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
🎯 Awareness Breakdown:
✅ Web (Vercel) → API (Railway):
typescript
// Web knows about API
NEXT_PUBLIC_API_URL=https://aps.visibleshelf.store
// Frontend makes requests to API
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenant/info`)
✅ API (Railway) → Redis (Railway):
typescript
// API knows about Redis
REDIS_URL=redis://redis:6379
// API connects to Redis
const redisClient = createClient({
  url: process.env.REDIS_URL
});
✅ Redis → Nobody:
bash
# Redis is just a data store
# It doesn't know about API or Web
# It just responds to connections
🔧 Why This Architecture Works:
✅ One-Way Dependencies:
Web → API → Redis → (nothing)
✅ No Circular Dependencies:
Web doesn't need to know about Redis
Redis doesn't need to know about anything
API is the only one that knows about Redis
🚀 Connection Flow:
✅ Request Flow:
typescript
// 1. Web makes request to API
fetch('https://aps.visibleshelf.store/api/tenant/info')
// 2. API checks Redis cache
const cached = await CacheService.get('tenant:abc123:info');
// 3. If cache miss, API queries Supabase
const tenant = await supabase.from('tenants').select('*');
// 4. API stores result in Redis
await CacheService.set('tenant:abc123:info', tenant);
// 5. API returns result to Web
res.json(tenant);
✅ Redis Role:
bash
# Redis is just a key-value store
# It doesn't care who connects to it
# It doesn't know about URLs or domains
# It just stores and retrieves data
📊 Service Responsibilities:
✅ Web (Vercel):
Knows: API URL
Doesn't know: Redis, Database, Cache
Responsibility: User interface, API calls
✅ API (Railway):
Knows: Redis URL, Supabase URL
Doesn't know: Web URL (doesn't need it)
Responsibility: Business logic, caching, data access
✅ Redis (Railway):
Knows: Nothing
Doesn't know: API URL, Web URL, Database URL
Responsibility: Fast data storage/retrieval
🔧 Configuration Summary:
✅ Web Environment Variables:
bash
# Web only needs to know about API
NEXT_PUBLIC_API_URL=https://aps.visibleshelf.store
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
✅ API Environment Variables:
bash
# API needs to know about Redis and Supabase
REDIS_URL=redis://redis:6379
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
✅ Redis Environment Variables:
bash
# Redis needs no configuration about other services
# It just runs and accepts connections
🎯 Benefits of This Design:
✅ Loose Coupling:
Web can be deployed independently
Redis can be restarted without affecting Web
API can be scaled without changing Web
✅ Security:
Redis is not exposed to the internet
Web cannot directly access Redis
API controls all data access
✅ Simplicity:
Clear data flow: Web → API → Redis
No complex service discovery
Easy to debug and maintain
🚀 Deployment Independence:
✅ Independent Deployments:
bash
# Deploy Web (no Redis needed)
vercel --prod
# Deploy API (needs Redis)
railway up
# Deploy Redis (no other services needed)
railway up --service redis
✅ Service Isolation:
Web down: Redis and API still work
Redis down: Web and API still work (with fallback)
API down: Web shows errors, Redis still works
You're absolutely correct! Redis is a passive service that doesn't need to know about API or Web URLs. 🎉