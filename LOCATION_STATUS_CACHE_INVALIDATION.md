# Location Status Cache Invalidation Strategy

## Critical Cache Keys to Invalidate

When `location_status` changes for `tid-fjwr30ib`, these cache keys must be cleared:

### Browser/Server Cache (TenantPublicService)
```typescript
// Primary tenant info cache
`public-tenant-info-tid-fjwr30ib`
`public-tenant-profile-tid-fjwr30ib`
`tenant-hours-tid-fjwr30ib`

// Related tenant caches (for product pages)
`public-tenant-info-${product.tenantId}` // Multiple tenant IDs
`shop-data-sid-wudtb0kd` // Shop slug cache
`directory-listing-mina-african-market` // Directory cache

// Pattern-based invalidation
`*tid-fjwr30ib*` // Catch all tenant-specific keys
`*sid-wudtb0kd*` // Catch all shop-specific keys
`*mina-african-market*` // Catch all directory keys
```

### Backend API Cache
```typescript
// Database/API level caches
`tenant-info-tid-fjwr30ib`
`public-tenant-tid-fjwr30ib`
`mv_global_discovery:*tid-fjwr30ib*`
`directory:*tid-fjwr30ib*`
`shops:*tid-fjwr30ib*`
`shop:slug:sid-wudtb0kd`
`shop:tenantId:tid-fjwr30ib`
```

## Implementation

### 1. Backend Cache Invalidation
```typescript
// Add to the status update endpoint in /api/tenants/[id]/status
async function updateLocationStatus(tenantId: string, newStatus: string) {
  // Update database
  await prisma.tenants.update({
    where: { id: tenantId },
    data: { 
      location_status: newStatus,
      status_changed_at: new Date()
    }
  });

  // 🔥 CRITICAL: Invalidate all related caches
  await invalidateAllTenantCaches(tenantId);
}

async function invalidateAllTenantCaches(tenantId: string) {
  const { CacheService } = await import('../services/CacheService');
  
  // Get tenant slug for additional invalidation
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { slug: true }
  });
  
  const promises = [
    // Direct tenant caches
    CacheService.del(`tenant-info-${tenantId}`),
    CacheService.del(`public-tenant-${tenantId}`),
    
    // MV discovery cache (affects product/directory pages)
    CacheService.clear(`mv_global_discovery:*${tenantId}*`),
    
    // Shop-related caches
    CacheService.del(`shop:tenantId:${tenantId}`),
    CacheService.del(`shop:slug:${tenant?.slug}`),
    
    // Directory caches
    CacheService.clear(`directory:*${tenantId}*`),
  ];
  
  await Promise.all(promises);
  console.log(`[Cache Invalidation] Cleared ${promises.length} cache keys for tenant ${tenantId}`);
}
```

### 2. Frontend Service Cache Invalidation
```typescript
// Add to TenantInfoService.updateTenantStatus
async updateTenantStatus(tenantId: string, status: string) {
  const result = await this.makeDefaultRequest<any>(
    `/api/tenants/${tenantId}/status`,
    { 
      method: 'PATCH',
      body: JSON.stringify({ status })
    },
    `tenant-update-status-${tenantId}`,
    0, // No cache for updates
    { invalidateCache: true }
  );

  // 🔥 CRITICAL: Invalidate frontend singleton caches
  await this.invalidateAllTenantCaches(tenantId);
  
  return result.data;
}

async invalidateAllTenantCaches(tenantId: string) {
  // Get tenant slug for additional invalidation
  const tenantInfo = await this.getTenantInfo(tenantId);
  const slug = tenantInfo?.slug;
  
  const invalidations = [
    // Primary tenant info caches
    this.invalidateCache(`public-tenant-info-${tenantId}`),
    this.invalidateCache(`public-tenant-profile-${tenantId}`),
    this.invalidateCache(`tenant-hours-${tenantId}`),
    
    // Shop caches (if slug known)
    slug ? this.invalidateCache(`shop-data-${slug}`) : null,
    
    // Pattern-based invalidation
    this.invalidateCache(`*${tenantId}*`),
    slug ? this.invalidateCache(`*${slug}*`) : null,
  ].filter(Boolean);
  
  await Promise.all(invalidations);
  console.log(`[Frontend Cache] Invalidated ${invalidations.length} cache keys for tenant ${tenantId}`);
}
```

### 3. Next.js Route Cache Invalidation
```typescript
// Add to /api/tenants/[id]/route.ts PATCH handler
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();
  
  if (body.status !== undefined) {
    // 🔥 Clear Next.js data cache for affected pages
    revalidatePath(`/tenant/${id}`);
    revalidatePath(`/shops/${id}`);
    
    // Get tenant slug for additional revalidation
    const tenantInfo = await tenantInfoService.getTenantInfo(id);
    if (tenantInfo?.slug) {
      revalidatePath(`/shops/${tenantInfo.slug}`);
      revalidatePath(`/directory/${tenantInfo.slug}`);
    }
    
    // Call service with cache invalidation
    updatedTenant = await tenantInfoService.updateTenantStatus(id, body.status);
  }
  
  return NextResponse.json(updatedTenant);
}
```

## Endpoints Affected by `tid-fjwr30ib` Status Change

### Immediate Impact (15 min cache delay currently):
1. `/tenant/tid-fjwr30ib` - Shows stale location status
2. `/products/sid-wudtb0kd` - Shows stale tenant info in product page
3. `/directory/mina-african-market` - Shows stale tenant info in directory

### Secondary Impact:
4. `/tenants` - Admin tenant list (if includes status)
5. `/t/tid-m8ijkrnk/dashboard` - Tenant dashboard (if shows status)

### After Implementation:
- ✅ All pages refresh immediately when status changes
- ✅ Both browser and server caches cleared
- ✅ Backend API cache cleared
- ✅ Next.js route cache cleared

## Testing Strategy

1. **Before Fix**: Change status, verify 15-minute delay across all endpoints
2. **After Fix**: Change status, verify immediate refresh across all endpoints
3. **Cache Hit Testing**: Verify cache miss after status change
4. **Cross-browser Testing**: Verify invalidation works across different browsers

## Priority Implementation Order

1. **Critical**: Backend cache invalidation (affects all users)
2. **High**: Frontend singleton cache invalidation (affects browser users)  
3. **Medium**: Next.js route cache invalidation (affects SSR)
4. **Low**: Webhook-based invalidation for external changes
