# Case Transform Implementation Guide

## Quick Start

### 1. API-Side Transform (Recommended for Stable Endpoints)

```typescript
// In your API routes (apps/api/src/index.ts)
import { caseTransformMiddleware } from './middleware/case-transform';

// Apply to specific routes
app.use('/api/tenants/:id/profile', caseTransformMiddleware);
app.use('/api/items', caseTransformMiddleware);

// Your endpoint returns snake_case as usual
app.get('/api/tenants/:id/profile', async (req, res) => {
  const profile = await getBusinessProfile(req.params.id);
  // Returns: { business_name: "...", tenant_id: "..." }
  res.json(profile); // Automatically transformed to camelCase
});
```

**Frontend receives:**
```typescript
// Automatically camelCase - no transform needed!
const profile = await fetch('/api/tenants/123/profile').then(r => r.json());
// Returns: { businessName: "...", tenantId: "..." }
```

### 2. Frontend Transform (Recommended for Evolving Endpoints)

```typescript
// In your React hooks (apps/web/src/hooks/)
import { transformToCamel } from '@/utils/case-transform';

const useBusinessProfile = (tenantId: string, options = {}) => {
  const { transform = true } = options;
  
  const { data } = useSWR(`/api/tenants/${tenantId}/profile`, async (url) => {
    const response = await fetch(url).then(r => r.json());
    return transform ? transformToCamel(response, { deep: true }) : response;
  });
  
  return { data };
};
```

**Usage:**
```typescript
// Automatic camelCase
const { data } = useBusinessProfile('123'); 
// data: { businessName: "...", tenantId: "..." }

// Keep original snake_case
const { data } = useBusinessProfile('123', { transform: false });
// data: { business_name: "...", tenant_id: "..." }
```

## Decision Matrix

| Endpoint Characteristics | Recommended Approach | Reason |
|--------------------------|---------------------|---------|
| **Stable + High Frontend Activity** | API Transform | Eliminates frontend burden |
| **Evolving + High API Activity** | Frontend Transform | Flexibility for changes |
| **Legacy + External Consumers** | No Transform | Maintain compatibility |
| **Experimental + Rapid Iteration** | Frontend Transform | Easy to adjust |

## Configuration Examples

### API Configuration

```typescript
// apps/api/src/config/transform-config.ts
export const transformStrategies = {
  // Stable endpoints - API transform
  '/api/tenants/:id/profile': {
    layer: 'api',
    reason: 'Stable endpoint, high frontend usage',
    stability: 'stable',
    activity: 'high'
  },
  
  // Evolving endpoints - Frontend transform
  '/api/integrations/*': {
    layer: 'frontend', 
    reason: 'Rapidly evolving schemas',
    stability: 'evolving',
    activity: 'high'
  },
  
  // Legacy endpoints - No transform
  '/api/legacy/*': {
    layer: 'none',
    reason: 'Maintain compatibility',
    stability: 'legacy',
    activity: 'low'
  }
};
```

### Frontend Configuration

```typescript
// apps/web/src/utils/case-transform.ts
const transformOptions = {
  // Deep transform for nested objects
  deep: true,
  
  // Auto-detect if transform is needed
  autoDetect: true,
  
  // Only transform specific fields
  whitelist: ['business_name', 'tenant_id', 'created_at']
};

const camelData = transformToCamel(apiResponse, transformOptions);
```

## Migration Strategy

### Phase 1: Add Frontend Transform (Safe)
```typescript
// Start with optional frontend transforms
const { data } = useApiData('/api/profile', { transform: true });
```

### Phase 2: Identify Stable Endpoints
```typescript
// Add API transforms to stable, high-traffic endpoints
app.use('/api/tenants/:id/profile', caseTransformMiddleware);
```

### Phase 3: Gradual Migration
```typescript
// Move transforms to optimal layer based on usage patterns
// Monitor performance and developer feedback
```

## Performance Considerations

### API Transform Performance
- **Overhead:** ~1-2ms per request for typical objects
- **Memory:** Minimal (shallow object creation)
- **Caching:** Consider caching transformed responses

### Frontend Transform Performance
- **Overhead:** ~0.5-1ms per transform for typical objects  
- **Memory:** Client-side only
- **Bundling:** ~2KB minified utility functions

### Benchmarking
```typescript
import { runDevTests } from '@/utils/transform-test';

// Run in development console
runDevTests();
// ✅ Passed: 5
// ❌ Failed: 0
// ⚡ Camel Transform: 12.34ms (1000 iterations)
// ⚡ Snake Transform: 11.87ms (1000 iterations)
```

## Best Practices

### 1. Choose the Right Layer
- **API Transform:** Stable endpoints, multiple consumers
- **Frontend Transform:** Evolving endpoints, single consumer
- **No Transform:** Legacy endpoints, external APIs

### 2. Use Auto-Detection
```typescript
// Let the utility decide if transform is needed
transformToCamel(data, { autoDetect: true });
```

### 3. Whitelist for Safety
```typescript
// Only transform known-safe fields during migration
transformToCamel(data, { 
  whitelist: ['business_name', 'tenant_id'] 
});
```

### 4. Test Thoroughly
```typescript
// Use the testing framework
import { runTransformTests } from '@/utils/transform-test';
const results = runTransformTests();
```

### 5. Monitor Performance
```typescript
// Enable performance monitoring
export const transformFeatureFlags = {
  monitorPerformance: process.env.MONITOR_TRANSFORM_PERFORMANCE === 'true'
};
```

## Common Patterns

### 1. Business Profile Transform
```typescript
// API returns snake_case
const profile = {
  business_name: 'Acme Corp',
  tenant_id: '123',
  address_line1: '123 Main St'
};

// Transform to camelCase
const camelProfile = transformToCamel(profile);
// { businessName: 'Acme Corp', tenantId: '123', addressLine1: '123 Main St' }
```

### 2. Nested Object Transform
```typescript
const data = {
  tenant_id: '123',
  business_profile: {
    contact_info: {
      phone_number: '555-1234'
    }
  }
};

const transformed = transformToCamel(data, { deep: true });
// { tenantId: '123', businessProfile: { contactInfo: { phoneNumber: '555-1234' } } }
```

### 3. Array Transform
```typescript
const items = [
  { item_id: '1', item_name: 'Product 1' },
  { item_id: '2', item_name: 'Product 2' }
];

const camelItems = transformToCamel({ items }, { deep: true });
// { items: [{ itemId: '1', itemName: 'Product 1' }, ...] }
```

## Troubleshooting

### Transform Not Working?
1. **Check auto-detection:** Set `autoDetect: false` to force transform
2. **Verify whitelist:** Ensure fields are included in whitelist
3. **Check deep option:** Use `deep: true` for nested objects

### Performance Issues?
1. **Profile transforms:** Use browser dev tools to measure
2. **Reduce depth:** Avoid deep transforms on large objects
3. **Cache results:** Store transformed data to avoid re-processing

### Type Errors?
1. **Update interfaces:** Create both snake_case and camelCase types
2. **Use generics:** `transformToCamel<MyType>(data)`
3. **Gradual typing:** Start with `any` and add types incrementally

## Environment Variables

```bash
# API Transform Feature Flags
API_TRANSFORM_ENABLED=true
ENABLE_PROFILE_TRANSFORMS=true
ENABLE_ITEMS_TRANSFORMS=true
LOG_TRANSFORM_ACTIVITY=true
MONITOR_TRANSFORM_PERFORMANCE=true

# Performance Thresholds
MAX_TRANSFORM_TIME_MS=10
MAX_RESPONSE_SIZE_KB=1024
```

## Next Steps

1. **Choose your approach** based on endpoint characteristics
2. **Start with frontend transforms** for safety
3. **Add API transforms** to stable endpoints
4. **Monitor performance** and adjust as needed
5. **Migrate gradually** based on real usage patterns

---

**Need Help?** Check the test suite in `apps/web/src/utils/transform-test.ts` for examples and validation.
