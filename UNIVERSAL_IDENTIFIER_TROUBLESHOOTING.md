# Universal Identifier Troubleshooting Guide

## 🎯 **Common Issues & Solutions**

### **🔍 Cache Issues**

#### **Issue: Cache Decryption Errors**
```
[Cache DECRYPT ERROR]: encryptedData.slice is not a function
[Cache DECRYPT ERROR] tid-m8ijkrnk: Error: Cache decryption failed
```

**Cause:** Legacy or corrupted cache entries from previous implementations.

**Solution:**
```typescript
// Clear corrupted cache entries
if (!Buffer.isBuffer(encryptedData)) {
  console.log('[Cache] Invalid encrypted data format, clearing cache entry');
  this.encryptedCache.delete(identifier);
  return null; // Fallback to database
}
```

**Manual Fix:**
```bash
# Clear entire cache
curl -X POST http://localhost:4000/api/cache/clear

# Or restart the application to clear in-memory cache
```

#### **Issue: Low Cache Hit Rate**
```
Cache hit rate: < 70%
```

**Causes:**
- Cache TTL too short
- High data volatility
- Cache warming not implemented
- Cache size limits reached

**Solutions:**
```typescript
// Increase TTL for stable data
const defaultTTL = 30 * 60 * 1000; // 30 minutes instead of 15

// Implement cache warming
async warmCache(identifiers: string[]): Promise<void> {
  const promises = identifiers.map(id => this.resolveIdentifier(id));
  await Promise.all(promises);
}

// Monitor cache metrics
const metrics = cache.getMetrics();
if (metrics.hitRate < 0.8) {
  console.warn('[Cache] Low hit rate:', metrics.hitRate);
}
```

#### **Issue: Memory Usage High**
```
Cache memory usage: > 100MB
```

**Causes:**
- Too many cached entries
- Large metadata objects
- Cache cleanup not working

**Solutions:**
```typescript
// Reduce max entries
private readonly maxEntries = 500; // From 1000

// Implement automatic cleanup
setInterval(() => {
  this.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes

// Monitor memory usage
const metrics = cache.getDetailedMetrics();
if (metrics.totalMemoryUsage > 100 * 1024 * 1024) { // 100MB
  console.warn('[Cache] High memory usage:', metrics.totalMemoryUsage);
  this.cleanup();
}
```

### **🔧 Database Issues**

#### **Issue: Prisma Schema Mismatch**
```
Unknown field `updated_at` for select statement on model `tenants`.
Unknown field `settings` for select statement on model `tenants`.
```

**Cause:** Database schema doesn't match the code expectations.

**Solution:**
```typescript
// Use only available fields
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

#### **Issue: Database Connection Errors**
```
PrismaClientValidationError: Invalid prisma.tenants.findUnique() invocation
```

**Causes:**
- Database not connected
- Invalid query parameters
- Database schema out of sync

**Solutions:**
```typescript
// Add proper error handling
try {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { /* valid fields */ }
  });
  return tenant;
} catch (error) {
  console.error('[TenantService] Database error:', error);
  if (error instanceof PrismaClientValidationError) {
    console.error('[TenantService] Validation error - check schema');
  }
  throw error;
}
```

#### **Issue: Slow Database Queries**
```
Database query took > 1000ms
```

**Causes:**
- Missing indexes
- Complex queries
- Database load

**Solutions:**
```typescript
// Add database indexes for identifier lookups
// In Prisma schema:
model tenants {
  id        String   @id @unique
  slug      String?  @unique
  // ... other fields
  
  @@index([id])
  @@index([slug])
}

// Optimize queries
const tenant = await prisma.tenants.findUnique({
  where: { id: tenantId },
  select: { /* only needed fields */ }
});
```

### **🚨 Authentication Issues**

#### **Issue: JWT Token Errors**
```
Authentication required
No token provided
Invalid token
```

**Causes:**
- Missing Authorization header
- Expired token
- Invalid token format

**Solutions:**
```typescript
// Check token presence
if (!req.headers.authorization) {
  return res.status(401).json({
    success: false,
    error: 'Authentication required',
    message: 'No token provided'
  });
}

// Validate token format
const authHeader = req.headers.authorization;
if (!authHeader.startsWith('Bearer ')) {
  return res.status(401).json({
    success: false,
    error: 'Invalid token format',
    message: 'Token must be in "Bearer <token>" format'
  });
}

// Extract and validate token
const token = authHeader.substring(7);
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
} catch (error) {
  return res.status(401).json({
    success: false,
    error: 'Invalid token',
    message: 'Token verification failed'
  });
}
```

#### **Issue: Tenant Access Denied**
```
Access denied for tenant
User not authorized for this tenant
```

**Causes:**
- User not in tenant
- Insufficient permissions
- Token doesn't include tenant ID

**Solutions:**
```typescript
// Check user tenant access
const userTenants = req.user.tenantIds || [];
if (!userTenants.includes(resolvedTenant.id)) {
  return res.status(403).json({
    success: false,
    error: 'Access denied',
    message: 'User not authorized for this tenant'
  });
}

// Check role-based access
if (req.user.role !== 'PLATFORM_ADMIN' && !userTenants.includes(resolvedTenant.id)) {
  return res.status(403).json({
    success: false,
    error: 'Access denied',
    message: 'Insufficient permissions'
  });
}
```

### **⚡ Performance Issues**

#### **Issue: Slow Response Times**
```
Response time > 2000ms
```

**Causes:**
- Cache misses
- Database queries
- Network latency
- Large response payloads

**Solutions:**
```typescript
// Add performance monitoring
const startTime = Date.now();

// ... resolve identifier ...

const resolutionTime = Date.now() - startTime;
if (resolutionTime > 1000) {
  console.warn(`[Performance] Slow resolution: ${identifier} took ${resolutionTime}ms`);
}

// Optimize response payloads
const response = {
  success: true,
  data: minimalData, // Only essential fields
  metadata: {
    timing: {
      resolution: resolutionTime,
      total: Date.now() - startTime
    }
  }
};
```

#### **Issue: Batch Resolution Slow**
```
Batch resolve 50 identifiers took > 5000ms
```

**Causes:**
- Too many parallel requests
- Database connection pool exhaustion
- Large batch size

**Solutions:**
```typescript
// Limit batch size
const MAX_BATCH_SIZE = 25;
if (identifiers.length > MAX_BATCH_SIZE) {
  return res.status(400).json({
    success: false,
    error: 'Batch too large',
    message: `Maximum batch size is ${MAX_BATCH_SIZE} identifiers`
  });
}

// Implement chunking for large batches
async function chunkedResolve(identifiers: string[]): Promise<BatchResult> {
  const chunks = [];
  for (let i = 0; i < identifiers.length; i += MAX_BATCH_SIZE) {
    chunks.push(identifiers.slice(i, i + MAX_BATCH_SIZE));
  }
  
  const results = [];
  for (const chunk of chunks) {
    const chunkResult = await resolveChunk(chunk);
    results.push(chunkResult);
  }
  
  return mergeResults(results);
}
```

### **🔒 Security Issues**

#### **Issue: Encryption Key Missing**
```
IDENTIFIER_CACHE_KEY environment variable not set
```

**Cause:** Missing encryption key for cache encryption.

**Solution:**
```bash
# Generate secure encryption key
openssl rand -hex 32

# Set environment variable
export IDENTIFIER_CACHE_KEY=your-secure-32-character-key

# Add to .env file
echo "IDENTIFIER_CACHE_KEY=your-secure-32-character-key" >> .env
```

#### **Issue: Cache Corruption**
```
Cache corruption detected
Decryption failed repeatedly
```

**Causes:**
- Invalid encryption key
- Data corruption
- Concurrent access issues

**Solutions:**
```typescript
// Add corruption detection
private async decrypt(encryptedData: Buffer): Promise<any> {
  try {
    const result = this.cacheEncryption.decrypt(encryptedData);
    return result.data;
  } catch (error) {
    console.error('[Cache DECRYPT ERROR]:', error);
    
    // Increment corruption counter
    this.metrics.corruptionCount++;
    
    // Clear corrupted entry
    throw new Error('Cache decryption failed');
  }
}

// Monitor corruption rate
const metrics = cache.getDetailedMetrics();
if (metrics.corruptionCount > 10) {
  console.error('[Cache] High corruption rate detected');
  cache.clearCache();
}
```

## 🔧 **Debugging Tools**

### **Enable Debug Logging**
```typescript
// Set debug environment variable
process.env.DEBUG_IDENTIFIER_RESOLVER = 'true';

// Debug logging in resolver
export function universalIdentifierResolver(req, res, next) {
  const { identifier } = req.params;
  console.log(`[Resolver] Processing identifier: ${identifier}`);
  console.log(`[Resolver] User: ${req.user?.userId || 'anonymous'}`);
  
  const startTime = Date.now();
  
  try {
    const resolvedTenant = await cache.resolveIdentifier(identifier);
    const resolutionTime = Date.now() - startTime;
    
    console.log(`[Resolver] Resolved: ${identifier} -> ${resolvedTenant?.id} (${resolutionTime}ms)`);
    console.log(`[Resolver] Type: ${resolvedTenant?.type}`);
    
    req.resolvedTenant = resolvedTenant;
    req.identifierType = resolvedTenant?.type;
    next();
  } catch (error) {
    console.error(`[Resolver] Error:`, error);
    next(error);
  }
}
```

### **Performance Profiling**
```typescript
// Add performance profiling
class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private metrics: Map<string, number[]> = new Map();
  
  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }
  
  startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}`;
    console.log(`[Profiler] Starting: ${operation}`);
    return timerId;
  }
  
  endTimer(timerId: string): number {
    const duration = Date.now() - parseInt(timerId.split('_')[1]);
    const operation = timerId.split('_')[0];
    
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    this.metrics.get(operation)!.push(duration);
    
    const avgDuration = this.metrics.get(operation)!
      .reduce((sum, time) => sum + time, 0) / this.metrics.get(operation)!.length;
    
    console.log(`[Profiler] ${operation}: ${duration}ms (avg: ${avgDuration.toFixed(2)}ms)`);
    
    return duration;
  }
  
  getMetrics(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const result: Record<string, any> = {};
    
    for (const [operation, times] of this.metrics.entries()) {
      result[operation] = {
        count: times.length,
        avg: times.reduce((sum, time) => sum + time, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times)
      };
    }
    
    return result;
  }
}

// Usage in resolver
const profiler = PerformanceProfiler.getInstance();
const timerId = profiler.startTimer('resolveIdentifier');
const resolvedTenant = await cache.resolveIdentifier(identifier);
profiler.endTimer(timerId);
```

### **Cache Inspection**
```typescript
// Add cache inspection methods
class UniversalIdentifierCache {
  inspectCache(): CacheInspection {
    const entries = Array.from(this.encryptedCache.entries());
    
    return {
      totalEntries: entries.length,
      entries: entries.map(([identifier, entry]) => ({
        identifier,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        age: Date.now() - entry.timestamp,
        remainingTtl: entry.ttl - (Date.now() - entry.timestamp),
        isExpired: this.isExpired(entry)
      }))
    };
  }
  
  getEntryDetails(identifier: string): CacheEntryDetails | null {
    const entry = this.encryptedCache.get(identifier);
    
    if (!entry) {
      return null;
    }
    
    try {
      const decrypted = await this.decrypt(entry.data);
      return {
        identifier,
        tenant: decrypted,
        cacheEntry: {
          timestamp: entry.timestamp,
          ttl: entry.ttl,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed,
          age: Date.now() - entry.timestamp,
          remainingTtl: entry.ttl - (Date.now() - entry.timestamp),
          isExpired: this.isExpired(entry)
        }
      };
    } catch (error) {
      return {
        identifier,
        error: 'Decryption failed',
        cacheEntry: {
          timestamp: entry.timestamp,
          ttl: entry.ttl,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed,
          age: Date.now() - entry.timestamp,
          remainingTtl: entry.ttl - (Date.now() - entry.timestamp),
          isExpired: this.isExpired(entry)
        }
      };
    }
  }
}
```

## 📋 **Health Check Scripts**

### **Comprehensive Health Check**
```bash
#!/bin/bash

echo "=== Universal Identifier Health Check ==="

# 1. Basic connectivity
echo "1. Testing API connectivity..."
if curl -s http://localhost:4000/api/public/shops/tid-m8ijkrnk > /dev/null; then
  echo "✅ API accessible"
else
  echo "❌ API not accessible"
  exit 1
fi

# 2. Cache health
echo "2. Checking cache health..."
cache_health=$(curl -s http://localhost:4000/api/cache/health)
cache_status=$(echo "$cache_health" | jq -r '.health.status')

if [ "$cache_status" = "healthy" ]; then
  echo "✅ Cache healthy"
  hit_rate=$(echo "$cache_health" | jq -r '.health.hitRate')
  echo "   Hit rate: $hit_rate"
else
  echo "❌ Cache unhealthy"
  echo "$cache_health" | jq -r '.health'
fi

# 3. Batch testing
echo "3. Testing batch resolution..."
batch_result=$(curl -s -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{"identifiers": ["tid-m8ijkrnk", "baraka-international-market-inc"]}')

if echo "$batch_result" | jq -e '.success' > /dev/null; then
  echo "✅ Batch resolution working"
else
  echo "❌ Batch resolution failed"
fi

# 4. Performance check
echo "4. Performance check..."
metrics=$(curl -s http://localhost:4000/api/cache/metrics)
avg_time=$(echo "$metrics" | jq -r '.metrics.avgResponseTime')
hit_rate=$(echo "$metrics" | jq -r '.metrics.hitRate')

echo "   Average response time: ${avg_time}ms"
echo "   Cache hit rate: $(echo "$hit_rate * 100" | cut -d. -f1)%"

# 5. Error handling
echo "5. Testing error handling..."
error_result=$(curl -s http://localhost:4000/api/public/shops/invalid-id)

if echo "$error_result" | jq -e '.success == false' > /dev/null; then
  echo "✅ Error handling working"
else
  echo "❌ Error handling issues"
fi

echo ""
echo "=== Health Check Complete ==="
```

### **Performance Benchmark**
```bash
#!/bin/bash

echo "=== Performance Benchmark ==="

# Test single identifier performance
echo "1. Single identifier performance..."
echo "Testing 10 requests:"

for i in {1..10}; do
  start_time=$(date +%s%3N)
  curl -s http://localhost:4000/api/public/shops/tid-m8ijkrnk > /dev/null
  end_time=$(date +%s%3N)
  echo "Request $i: $((end_time - start_time))ms"
done

# Test batch performance
echo ""
echo "2. Batch resolution performance..."
batch_sizes=(5 10 25 50)

for size in "${batch_sizes[@]}"; do
  echo "Testing batch size: $size"
  
  # Generate test identifiers
  identifiers=()
  for ((i=1; i<=size; i++)); do
    identifiers+=("test-identifier-$i")
  done
  
  # Create JSON payload
  json_payload=$(jq -n --arg ids "$(printf '%s\n' "${identifiers[@]}" | jq -R . | jq -s .)" \
    '{identifiers: $ids}')
  
  start_time=$(date +%s%3N)
  curl -s -X POST http://localhost:4000/api/public/test/batch-resolve \
    -H "Content-Type: application/json" \
    -d "$json_payload" > /dev/null
  end_time=$(date +%s%3N)
  
  echo "Batch size $size: $((end_time - start_time))ms"
done

# Test cache hit performance
echo ""
echo "3. Cache hit performance..."
echo "Testing 10 cache hits:"

for i in {1..10}; do
  start_time=$(date +%s%3N)
  curl -s http://localhost:4000/api/public/shops/tid-m8ijkrnk > /dev/null
  end_time=$(date +%s%3N)
  echo "Cache hit $i: $((end_time - start_time))ms"
done

echo ""
echo "=== Performance Benchmark Complete ==="
```

## 🚨 **Emergency Procedures**

### **Cache Corruption Recovery**
```typescript
// Emergency cache clearing
if (metrics.corruptionCount > 50) {
  console.error('[Cache] Emergency: High corruption rate detected');
  console.log('[Cache] Clearing all cache entries');
  
  this.encryptedCache.clear();
  this.metrics.corruptionCount = 0;
  
  // Notify monitoring
  this.notifyEmergency('Cache corruption detected - cache cleared');
}
```

### **Database Fallback**
```typescript
// Database fallback when cache fails
async resolveIdentifierWithFallback(identifier: string): Promise<ResolvedTenant | null> {
  try {
    // Try cache first
    return await this.resolveIdentifier(identifier);
  } catch (cacheError) {
    console.warn('[Cache] Cache failed, falling back to database:', cacheError);
    
    // Direct database lookup
    return await this.resolveFromDatabase(identifier);
  }
}
```

### **Graceful Degradation**
```typescript
// Graceful degradation for system issues
export function universalIdentifierResolver(req, res, next) {
  const { identifier } = req.params;
  
  try {
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
  } catch (error) {
    console.error('[Resolver] Critical error:', error);
    
    // Return degraded response
    res.status(500).json({
      success: false,
      error: 'Service temporarily unavailable',
      message: 'Please try again later'
    });
  }
}
```

This troubleshooting guide covers the most common issues and provides practical solutions for maintaining a healthy universal identifier system.
