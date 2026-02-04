# Universal Identifier Implementation Guide

## 🎯 **Architecture Overview**

The Universal Identifier Pattern provides a unified, encrypted cache-based system for resolving tenant identifiers across all API endpoints. This system supports three identifier types:

- **tenant-id**: `tid-m8ijkrnk` (internal database ID)
- **slug**: `baraka-international-market-inc` (human-readable URL)
- **auto-id**: `ULCW` (short auto-generated identifier)

## 🏗️ **System Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Request   │───▶│  Universal Cache │───▶│   Database      │
│   (Any ID Type)  │    │   (Encrypted)    │    │   (Fallback)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Response Data  │◀───│  Cached Result   │◀───│  Tenant Data    │
│   (Unified)     │    │   (Sub-ms)       │    │   (Full)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔧 **Core Components**

### **1. UniversalIdentifierCache**
```typescript
// Singleton encrypted cache service
class UniversalIdentifierCache {
  private static instance: UniversalIdentifierCache;
  private encryptedCache: Map<string, EncryptedCacheEntry>;
  private readonly cacheEncryption: CacheEncryption;
  
  // Resolve identifier with cache fallback
  async resolveIdentifier(identifier: string): Promise<ResolvedTenant | null>
  
  // Cache management
  async invalidateTenant(tenantId: string): Promise<void>
  clearCache(): void
  getMetrics(): CacheMetrics
}
```

### **2. Universal Identifier Resolver Middleware**
```typescript
// Express middleware for identifier resolution
export function universalIdentifierResolver(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { identifier } = req.params;
  
  // Resolve using encrypted cache
  const cache = UniversalIdentifierCache.getInstance();
  const resolvedTenant = await cache.resolveIdentifier(identifier);
  
  if (!resolvedTenant) {
    return res.status(404).json({
      success: false,
      error: 'Tenant not found',
      message: `No tenant found for identifier: ${identifier}`
    });
  }
  
  req.resolvedTenant = resolvedTenant;
  req.identifierType = resolvedTenant.type;
  next();
}
```

### **3. Universal Route Factory**
```typescript
// Factory for creating consistent routes
export function createUniversalRoute(options: UniversalRouteOptions): Router {
  const router = Router();
  
  // Apply universal identifier resolver
  router.use(universalIdentifierResolver);
  
  // Apply authentication if required
  if (options.auth?.required) {
    router.use(authenticateToken);
    if (options.auth?.checkAccess) {
      router.use(checkTenantAccess);
    }
  }
  
  // Apply caching headers
  if (options.cache) {
    router.use((req, res, next) => {
      const cacheControl = options.cache.public 
        ? `public, max-age=${options.cache.maxAge}`
        : `private, max-age=${options.cache.maxAge}`;
      res.setHeader('Cache-Control', cacheControl);
      next();
    });
  }
  
  // Execute handler
  router[options.methods[0]]('/', options.handler);
  
  return router;
}
```

## 🔐 **Security Implementation**

### **AES-256-GCM Encryption**
```typescript
class CacheEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  
  encrypt(data: any): EncryptionResult {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    // Set additional authenticated data
    cipher.setAAD(Buffer.from('tenant-identifier-cache'));
    
    const jsonString = JSON.stringify(data);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]),
      iv,
      authTag,
      algorithm: this.algorithm
    };
  }
}
```

### **Key Management**
```typescript
// Environment variable for encryption key
const IDENTIFIER_CACHE_KEY = process.env.IDENTIFIER_CACHE_KEY || 'default-cache-key-change-in-production';

// Key derivation (scrypt for security)
const key = crypto.scryptSync(keyMaterial, 'tenant-identifier-cache-salt', 32);
```

## ⚡ **Performance Optimization**

### **Cache Performance Metrics**
```typescript
interface CacheMetrics {
  hits: number;                    // Cache hits
  misses: number;                  // Cache misses
  hitRate: number;                // Hit rate percentage
  avgResponseTime: number;         // Average response time (ms)
  encryptedEntries: number;       // Number of cached entries
  totalMemoryUsage: number;        // Memory usage in bytes
  lastReset: number;               // Last metrics reset
}
```

### **Performance Characteristics**
- **Cache hits**: ~40ms (sub-millisecond for in-memory)
- **Cache misses**: ~600ms (database lookup + cache set)
- **Memory usage**: ~1KB per cached entry
- **TTL**: 15 minutes (configurable)
- **Encryption overhead**: <5ms per operation

### **Cache Warming Strategy**
```typescript
// Pre-warm cache for frequently accessed tenants
async warmCache(identifiers: string[]): Promise<void> {
  const promises = identifiers.map(async (identifier) => {
    await this.resolveIdentifier(identifier);
  });
  
  await Promise.all(promises);
  console.log(`[Cache] Warmed ${identifiers.length} entries`);
}
```

## 🔍 **Monitoring & Analytics**

### **Cache Health Monitoring**
```typescript
interface DetailedCacheMetrics extends CacheMetrics {
  corruptionCount: number;         // Detected corruption
  invalidationCount: number;       // Manual invalidations
  oldestEntry: number;             // Age of oldest entry (ms)
  newestEntry: number;             // Age of newest entry (ms)
  averageEntryAge: number;         // Average entry age (ms)
}
```

### **Monitoring Endpoints**
```typescript
// GET /api/cache/metrics
router.get('/metrics', (req, res) => {
  const cache = UniversalIdentifierCache.getInstance();
  const metrics = cache.getDetailedMetrics();
  
  res.json({
    success: true,
    metrics,
    timestamp: Date.now()
  });
});

// GET /api/cache/health
router.get('/health', (req, res) => {
  const cache = UniversalIdentifierCache.getInstance();
  const health = cache.getHealthStatus();
  
  res.json({
    success: true,
    health,
    timestamp: Date.now()
  });
});
```

## 🚀 **Integration Examples**

### **Basic Usage**
```typescript
// Create a universal tenant route
const tenantRoute = createUniversalRoute({
  path: '/tenants',
  methods: ['get'],
  auth: { required: true, checkAccess: true },
  cache: { maxAge: 300, public: false },
  handler: async (req, res) => {
    const { resolvedTenant } = req;
    const tenantService = TenantService.getInstance();
    
    const profile = await tenantService.getTenantProfile(resolvedTenant!.id);
    res.locals.data = profile;
  }
});
```

### **Batch Testing**
```typescript
// Test multiple identifiers
router.post('/test/batch-resolve', async (req, res) => {
  const { identifiers } = req.body;
  
  const results = await resolveMultipleIdentifiers(identifiers);
  
  res.json({
    success: true,
    data: results,
    timestamp: Date.now()
  });
});
```

### **Custom Route Factory**
```typescript
// Create specialized route factories
export function createShopProfileRoute(path: string): Router {
  return createUniversalRoute({
    path,
    methods: ['get'],
    cache: { maxAge: 900, public: true },
    handler: async (req, res) => {
      const { resolvedTenant } = req;
      const shopService = ShopService.getInstance();
      
      const shop = await shopService.getShopByTenantId(resolvedTenant!.id);
      res.locals.data = shop;
    }
  });
}
```

## 🛠️ **Configuration**

### **Environment Variables**
```bash
# Encryption key (REQUIRED for production)
IDENTIFIER_CACHE_KEY=your-secure-encryption-key-32-chars

# Cache configuration (optional)
CACHE_DEFAULT_TTL=900000        # 15 minutes in ms
CACHE_MAX_ENTRIES=1000
CACHE_CLEANUP_INTERVAL=300000    # 5 minutes in ms
```

### **Cache Configuration**
```typescript
// Cache settings in UniversalIdentifierCache constructor
private readonly defaultTTL = 15 * 60 * 1000; // 15 minutes
private readonly maxEntries = 1000;
private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes
```

## 📊 **Best Practices**

### **1. Cache Usage**
- Use cache for frequently accessed tenants
- Implement proper TTL based on data volatility
- Monitor cache hit rates and adjust accordingly

### **2. Security**
- Always use strong encryption keys in production
- Rotate encryption keys regularly
- Monitor for cache corruption attempts

### **3. Performance**
- Warm cache for known high-traffic tenants
- Implement cache invalidation on data updates
- Monitor memory usage and set appropriate limits

### **4. Error Handling**
- Gracefully fallback to database on cache errors
- Log cache failures for monitoring
- Implement circuit breakers for cache failures

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Cache Decryption Errors**
```typescript
// Error: "encryptedData.slice is not a function"
// Solution: Clear corrupted cache entries
if (!Buffer.isBuffer(encryptedData)) {
  console.log('[Cache] Invalid encrypted data format, clearing cache entry');
  this.encryptedCache.delete(identifier);
}
```

#### **Database Schema Issues**
```typescript
// Error: "Unknown field `updated_at` for select statement"
// Solution: Use only available fields in Prisma selects
const tenant = await prisma.tenants.findUnique({
  where: { id: tenantId },
  select: {
    id: true,
    name: true,
    slug: true,
    subscription_status: true,
    metadata: true,
    created_at: true
    // Remove: updated_at, settings (not in schema)
  }
});
```

#### **Performance Issues**
```typescript
// Symptom: Slow response times
// Solution: Monitor cache hit rate
const metrics = cache.getMetrics();
if (metrics.hitRate < 0.8) {
  console.warn('[Cache] Low hit rate:', metrics.hitRate);
  // Consider warming cache or adjusting TTL
}
```

### **Debugging Tools**

#### **Cache Debug Logging**
```typescript
// Enable debug logging
process.env.DEBUG_CACHE = 'true';

// Cache operations will log:
// [Cache DB LOOKUP] identifier
// [Cache HIT] identifier -> tenantId (Xms)
// [Cache SET] identifier -> tenantId
// [Cache ENCRYPT ERROR] identifier: error
```

#### **Performance Monitoring**
```typescript
// Monitor response times
const startTime = Date.now();
const result = await cache.resolveIdentifier(identifier);
const responseTime = Date.now() - startTime;

if (responseTime > 1000) {
  console.warn(`[Cache] Slow resolution: ${identifier} took ${responseTime}ms`);
}
```

## 📈 **Scaling Considerations**

### **Horizontal Scaling**
- Cache is per-instance (not distributed)
- Consider Redis for distributed caching in production
- Implement cache warming across instances

### **Memory Management**
- Monitor cache memory usage
- Implement automatic cleanup for expired entries
- Set appropriate max entry limits

### **Database Load**
- Cache reduces database load significantly
- Monitor database query patterns
- Optimize database indexes for identifier lookups

This implementation provides a robust, secure, and high-performance universal identifier system suitable for production use.
