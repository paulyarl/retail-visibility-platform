/**
 * Type-Safe Context-Aware Cache Invalidation Examples
 * 
 * This file demonstrates how to use the enhanced cache invalidation system
 * with proper TypeScript typing for AppContext and CacheIsolation enums.
 */

import { AppContext, CacheIsolation } from '../utils/contextCacheManager';

// Example usage patterns for context-aware cache invalidation

// 1. **Target Specific Context and Isolation**
// Clears exactly: 'tier-system-tiers:admin:admin'
await this.invalidateCacheWithContext('tier-system-tiers', AppContext.ADMIN, CacheIsolation.ADMIN);

// 2. **Target All Admin Context Keys** 
// Clears: 'tier-system-tiers:admin:*' (all admin context variations)
await this.invalidateCacheWithContext('tier-system-tiers', AppContext.ADMIN, null);

// 3. **Target All Admin Isolation Keys**
// Clears: 'tier-system-tiers:*:admin' (all admin isolation variations)
await this.invalidateCacheWithContext('tier-system-tiers', null, CacheIsolation.ADMIN);

// 4. **Target All Contexts and Isolations**
// Clears: 'tier-system-tiers*' (everything related to tier-system-tiers)
await this.invalidateCacheWithContext('tier-system-tiers', null, null);

// 5. **Multi-Context Invalidation**
// Perfect for admin operations that affect multiple user levels
await this.invalidateCacheAcrossContexts(
  'tier-system-tiers', 
  [AppContext.ADMIN, AppContext.SYSTEM, AppContext.TENANT], 
  [CacheIsolation.ADMIN, CacheIsolation.TENANT, CacheIsolation.USER]
);

// 6. **Real-World Admin Operation Examples**

// **Tier System Updates** - Clear admin and system caches
await this.invalidateCacheAcrossContexts(
  'platform-tier-system-tiers',
  [AppContext.ADMIN, AppContext.SYSTEM],
  [CacheIsolation.ADMIN, CacheIsolation.TENANT]
);

// **User Management** - Clear user and admin caches
await this.invalidateCacheAcrossContexts(
  'platform-user-preferences',
  [AppContext.USER, AppContext.ADMIN],
  [CacheIsolation.USER, CacheIsolation.ADMIN]
);

// **Tenant Operations** - Clear tenant and system caches
await this.invalidateCacheAcrossContexts(
  'platform-tenant-complete',
  [AppContext.TENANT, AppContext.SYSTEM],
  [CacheIsolation.TENANT, CacheIsolation.SYSTEM]
);

// **Public Data Updates** - Clear public and system caches
await this.invalidateCacheAcrossContexts(
  'public-shops',
  [AppContext.PUBLIC, AppContext.SYSTEM],
  [CacheIsolation.PUBLIC, CacheIsolation.GLOBAL]
);

// 7. **Type Safety Benefits**
// ✅ TypeScript will catch these errors:
// await this.invalidateCacheWithContext('tiers', 'invalid-context', CacheIsolation.ADMIN); // Error!
// await this.invalidateCacheAcrossContexts('tiers', ['admin'], ['invalid-isolation']); // Error!

// ✅ But these are valid:
await this.invalidateCacheWithContext('tiers', AppContext.ADMIN, CacheIsolation.ADMIN);
await this.invalidateCacheAcrossContexts('tiers', [AppContext.ADMIN], [CacheIsolation.ADMIN]);

// 8. **Cache Key Format Examples**
// The system generates keys in format: {baseKey}:{context}:{isolation}
// 
// Examples:
// - 'tier-system-tiers:admin:admin' (admin operations)
// - 'tier-system-tiers:system:tenant' (system-level shared data)  
// - 'tier-system-tiers:user:user' (user-specific data)
// - 'public-shops:public:global' (public data)

// 9. **Performance Considerations**
// - Use specific contexts when possible for better performance
// - Use multi-context invalidation for operations that truly affect multiple levels
// - Avoid overly broad invalidation (null, null) unless necessary

export { AppContext, CacheIsolation };
