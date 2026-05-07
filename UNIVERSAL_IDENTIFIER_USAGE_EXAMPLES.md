# Universal Identifier Usage Examples

## 🎯 **Quick Start Examples**

### **Basic Usage**

#### **1. Get Shop by Tenant ID**
```bash
curl http://localhost:4000/api/public/shops/tid-m8ijkrnk
```

#### **2. Get Shop by Slug**
```bash
curl http://localhost:4000/api/public/shops/baraka-international-market-inc
```

#### **3. Get Shop by Auto ID**
```bash
curl http://localhost:4000/api/public/shops/ULCW
```

#### **4. Get Tenant Profile (Authenticated)**
```bash
curl http://localhost:4000/api/tenants/tid-m8ijkrnk/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 **Advanced Usage Examples**

### **Batch Testing**

#### **Test Multiple Identifiers**
```bash
curl -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{
    "identifiers": [
      "tid-m8ijkrnk",
      "baraka-international-market-inc",
      "ULCW",
      "invalid-id",
      "another-tenant-slug"
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "successes": [
      {
        "identifier": "tid-m8ijkrnk",
        "tenant": { /* complete tenant data */ },
        "type": "tenant_id",
        "time": 214
      },
      {
        "identifier": "baraka-international-market-inc",
        "tenant": { /* same tenant data */ },
        "type": "slug",
        "time": 617
      }
    ],
    "failures": [
      {
        "identifier": "ULCW",
        "error": "Tenant not found",
        "time": 779
      },
      {
        "identifier": "invalid-id",
        "error": "Tenant not found",
        "time": 779
      }
    ]
  },
  "timestamp": 1770192724759
}
```

### **Performance Testing**

#### **Single Identifier Performance**
```bash
# First request (cache miss)
time curl http://localhost:4000/api/public/shops/tid-m8ijkrnk

# Second request (cache hit)
time curl http://localhost:4000/api/public/shops/tid-m8ijkrnk
```

#### **Batch Performance**
```bash
# Test 10 identifiers in parallel
curl -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{
    "identifiers": [
      "tid-m8ijkrnk",
      "baraka-international-market-inc",
      "another-tenant-1",
      "another-tenant-2",
      "another-tenant-3",
      "another-tenant-4",
      "another-tenant-5",
      "another-tenant-6",
      "another-tenant-7",
      "another-tenant-8"
    ]
  }'
```

## 💻 **Integration Examples**

### **JavaScript/TypeScript**

#### **Basic Integration**
```typescript
class UniversalIdentifierClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }
  
  async getShop(identifier: string): Promise<ShopData> {
    const response = await fetch(`${this.baseUrl}/api/public/shops/${identifier}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch shop');
    }
    
    return data.shop;
  }
  
  async getTenantProfile(identifier: string, token: string): Promise<TenantProfile> {
    const response = await fetch(`${this.baseUrl}/api/tenants/${identifier}/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch tenant profile');
    }
    
    return data.data;
  }
  
  async batchResolve(identifiers: string[]): Promise<BatchResult> {
    const response = await fetch(`${this.baseUrl}/api/public/test/batch-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers })
    });
    
    return response.json();
  }
}

// Usage examples
const client = new UniversalIdentifierClient();

// Get shop by any identifier type
const shop = await client.getShop('tid-m8ijkrnk'); // tenant-id
const shop2 = await client.getShop('baraka-international-market-inc'); // slug

// Batch resolve multiple identifiers
const results = await client.batchResolve([
  'tid-m8ijkrnk',
  'baraka-international-market-inc',
  'ULCW'
]);

// Authenticated tenant profile
const profile = await client.getTenantProfile('tid-m8ijkrnk', 'your-jwt-token');
```

#### **React Hook Example**
```typescript
import { useState, useEffect } from 'react';

interface UseShopResult {
  shop: ShopData | null;
  loading: boolean;
  error: string | null;
}

export function useShop(identifier: string): UseShopResult {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchShop() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/public/shops/${identifier}`);
        const data = await response.json();
        
        if (data.success) {
          setShop(data.shop);
        } else {
          setError(data.error || 'Failed to fetch shop');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    if (identifier) {
      fetchShop();
    }
  }, [identifier]);
  
  return { shop, loading, error };
}

// Usage in component
function ShopProfile({ identifier }: { identifier: string }) {
  const { shop, loading, error } = useShop(identifier);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!shop) return <div>Shop not found</div>;
  
  return (
    <div>
      <h1>{shop.name}</h1>
      <p>{shop.location}</p>
      <p>Rating: {shop.rating} ({shop.rating_count} reviews)</p>
    </div>
  );
}
```

#### **Node.js Service Integration**
```typescript
import { UniversalIdentifierCache } from './services/UniversalIdentifierCache';

class TenantService {
  private cache: UniversalIdentifierCache;
  
  constructor() {
    this.cache = UniversalIdentifierCache.getInstance();
  }
  
  async resolveTenant(identifier: string): Promise<ResolvedTenant | null> {
    // Use the cache directly
    return this.cache.resolveIdentifier(identifier);
  }
  
  async getTenantWithUsage(identifier: string): Promise<TenantWithUsage | null> {
    const tenant = await this.resolveTenant(identifier);
    
    if (!tenant) {
      return null;
    }
    
    // Get usage data in parallel
    const [usage, stats] = await Promise.all([
      this.getTenantUsage(tenant.id),
      this.getTenantStats(tenant.id)
    ]);
    
    return {
      ...tenant,
      usage,
      stats
    };
  }
  
  async batchResolve(identifiers: string[]): Promise<Map<string, ResolvedTenant | null>> {
    const results = new Map<string, ResolvedTenant | null>();
    
    // Resolve in parallel
    const promises = identifiers.map(async (identifier) => {
      const tenant = await this.resolveTenant(identifier);
      results.set(identifier, tenant);
      return { identifier, tenant };
    });
    
    await Promise.all(promises);
    return results;
  }
  
  private async getTenantUsage(tenantId: string): Promise<TenantUsage> {
    // Implementation for usage data
    return {
      totalItems: 0,
      activeItems: 0,
      categories: 0,
      users: 0,
      orders: 0
    };
  }
  
  private async getTenantStats(tenantId: string): Promise<TenantStats> {
    // Implementation for stats data
    return {
      revenue: 0,
      orders: 0,
      visitors: 0,
      conversionRate: 0
    };
  }
}
```

### **Python Integration**

#### **Basic Python Client**
```python
import requests
from typing import List, Dict, Optional
import json

class UniversalIdentifierClient:
    def __init__(self, base_url: str = "http://localhost:4000"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def get_shop(self, identifier: str) -> Dict:
        """Get shop by any identifier type"""
        response = self.session.get(f"{self.base_url}/api/public/shops/{identifier}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return data['shop']
        
        raise Exception(f"Failed to fetch shop: {response.text}")
    
    def get_tenant_profile(self, identifier: str, token: str) -> Dict:
        """Get tenant profile (requires authentication)"""
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(
            f"{self.base_url}/api/tenants/{identifier}/profile",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return data['data']
        
        raise Exception(f"Failed to fetch tenant profile: {response.text}")
    
    def batch_resolve(self, identifiers: List[str]) -> Dict:
        """Resolve multiple identifiers in parallel"""
        response = self.session.post(
            f"{self.base_url}/api/public/test/batch-resolve",
            json={'identifiers': identifiers}
        )
        
        if response.status_code == 200:
            return response.json()
        
        raise Exception(f"Batch resolve failed: {response.text}")
    
    def get_cache_metrics(self) -> Dict:
        """Get cache performance metrics"""
        response = self.session.get(f"{self.base_url}/api/cache/metrics")
        
        if response.status_code == 200:
            return response.json()
        
        raise Exception(f"Failed to get cache metrics: {response.text}")

# Usage example
client = UniversalIdentifierClient()

# Get shop by different identifier types
shop1 = client.get_shop('tid-m8ijkrnk')  # tenant-id
shop2 = client.get_shop('baraka-international-market-inc')  # slug

# Batch resolve multiple identifiers
results = client.batch_resolve([
    'tid-m8ijkrnk',
    'baraka-international-market-inc',
    'ULCW',
    'invalid-id'
])

print(f"Successes: {len(results['data']['successes'])}")
print(f"Failures: {len(results['data']['failures'])}")

# Get cache metrics
metrics = client.get_cache_metrics()
print(f"Cache hit rate: {metrics['metrics']['hitRate']:.2%}")
```

#### **Django Integration**
```python
import requests
from django.conf import settings
from typing import Dict, List, Optional

class TenantResolver:
    def __init__(self):
        self.api_url = getattr(settings, 'UNIVERSAL_IDENTIFIER_API_URL', 'http://localhost:4000')
        self.timeout = getattr(settings, 'UNIVERSAL_IDENTIFIER_TIMEOUT', 10)
    
    def resolve_tenant(self, identifier: str) -> Optional[Dict]:
        """Resolve tenant by any identifier type"""
        try:
            response = requests.get(
                f"{self.api_url}/api/public/shops/{identifier}",
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    return data['shop']
            
            return None
        except requests.RequestException as e:
            print(f"Error resolving tenant {identifier}: {e}")
            return None
    
    def batch_resolve(self, identifiers: List[str]) -> Dict:
        """Resolve multiple identifiers"""
        try:
            response = requests.post(
                f"{self.api_url}/api/public/test/batch-resolve",
                json={'identifiers': identifiers},
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            
            return {'success': False, 'error': 'Batch resolve failed'}
        except requests.RequestException as e:
            print(f"Error batch resolving: {e}")
            return {'success': False, 'error': str(e)}

# Django view example
from django.http import JsonResponse
from django.views.decorators.http import require_GET

@require_GET
def shop_detail(request, identifier):
    resolver = TenantResolver()
    shop = resolver.resolve_tenant(identifier)
    
    if shop:
        return JsonResponse({
            'success': True,
            'shop': shop
        })
    else:
        return JsonResponse({
            'success': False,
            'error': 'Shop not found'
        }, status=404)

@require_GET
def batch_resolve(request):
    identifiers = request.GET.getlist('identifiers', [])
    
    if not identifiers:
        return JsonResponse({
            'success': False,
            'error': 'No identifiers provided'
        }, status=400)
    
    resolver = TenantResolver()
    results = resolver.batch_resolve(identifiers)
    
    return JsonResponse(results)
```

### **cURL Scripts**

#### **Performance Testing Script**
```bash
#!/bin/bash

# Performance testing script for universal identifiers

echo "=== Universal Identifier Performance Test ==="

# Test single identifier performance
echo "Testing single identifier performance..."
time curl -s http://localhost:4000/api/public/shops/tid-m8ijkrnk > /dev/null

# Test cache hit performance
echo "Testing cache hit performance..."
time curl -s http://localhost:4000/api/public/shops/tid-m8ijkrnk > /dev/null

# Test batch resolution
echo "Testing batch resolution..."
time curl -s -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{"identifiers": ["tid-m8ijkrnk", "baraka-international-market-inc", "ULCW"]}' \
  > /dev/null

# Test different identifier types
echo "Testing different identifier types..."
echo "Tenant ID:"
time curl -s http://localhost:4000/api/public/shops/tid-m8ijkrnk > /dev/null

echo "Slug:"
time curl -s http://localhost:4000/api/public/shops/baraka-international-market-inc > /dev/null

echo "Auto ID:"
time curl -s http://localhost:4000/api/public/shops/ULCW > /dev/null

# Test error handling
echo "Testing error handling..."
time curl -s http://localhost:4000/api/public/shops/invalid-id > /dev/null

echo "=== Performance Test Complete ==="
```

#### **Batch Testing Script**
```bash
#!/bin/bash

# Batch testing script for universal identifiers

IDENTIFIERS=(
  "tid-m8ijkrnk"
  "baraka-international-market-inc"
  "ULCW"
  "invalid-id"
  "another-tenant-slug"
  "yet-another-tenant"
)

echo "=== Batch Testing Universal Identifiers ==="

# Create JSON payload
JSON_PAYLOAD=$(jq -n --arg identifiers "$(printf '%s\n' "${IDENTIFIERS[@]}" | jq -R . | jq -s .)" \
  '{identifiers: $identifiers}')

echo "Testing batch resolve..."
curl -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  | jq '{
    success: .success,
    total_processed: (.data.successes | length) + (.data.failures | length),
    successes: .data.successes | length,
    failures: .data.failures | length,
    avg_time: ((.data.successes + .data.failures) | map(.time) | add / length),
    results: .data
  }'

echo ""
echo "=== Individual Tests ==="

for identifier in "${IDENTIFIERS[@]}"; do
  echo "Testing: $identifier"
  response=$(curl -s http://localhost:4000/api/public/shops/$identifier)
  
  if echo "$response" | jq -e '.success' > /dev/null; then
    echo "✅ Success: $(echo "$response" | jq -r '.shop.name // .shop.id')"
  else
    echo "❌ Failed: $(echo "$response" | jq -r '.error // .message // "Unknown error"')"
  fi
done

echo ""
echo "=== Cache Metrics ==="
curl -s http://localhost:4000/api/cache/metrics | jq '{
  cache_hits: .metrics.hits,
  cache_misses: .metrics.misses,
  hit_rate: (.metrics.hits / (.metrics.hits + .metrics.misses) * 100),
  avg_response_time: .metrics.avgResponseTime,
  total_entries: .metrics.encryptedEntries
}'

echo ""
echo "=== Batch Test Complete ==="
```

#### **Health Check Script**
```bash
#!/bin/bash

# Health check script for universal identifier system

echo "=== Universal Identifier Health Check ==="

# Check API availability
echo "1. API Availability..."
if curl -s http://localhost:4000/api/public/shops/tid-m8ijkrnk > /dev/null; then
  echo "✅ API is accessible"
else
  echo "❌ API is not accessible"
  exit 1
fi

# Check cache health
echo "2. Cache Health..."
cache_health=$(curl -s http://localhost:4000/api/cache/health)
if echo "$cache_health" | jq -e '.health.status == "healthy"' > /dev/null; then
  echo "✅ Cache is healthy"
  echo "   - Hit rate: $(echo "$cache_health" | jq -r '.health.hitRate')"
  echo "   - Memory usage: $(echo "$cache_health" | jq -r '.health.memoryUsage') bytes"
  echo "   - Entries: $(echo "$cache_health" | jq -r '.health.entries')"
else
  echo "❌ Cache health issues"
  echo "$cache_health" | jq -r '.health'
fi

# Check batch testing
echo "3. Batch Testing..."
batch_result=$(curl -s -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{"identifiers": ["tid-m8ijkrnk", "baraka-international-market-inc"]}')

if echo "$batch_result" | jq -e '.success' > /dev/null; then
  successes=$(echo "$batch_result" | jq -r '.data.successes | length')
  failures=$(echo "$batch_result" | jq -r '.data.failures | length')
  echo "✅ Batch testing working"
  echo "   - Successes: $successes"
  echo "   - Failures: $failures"
else
  echo "❌ Batch testing failed"
fi

# Check metrics
echo "4. Cache Metrics..."
metrics=$(curl -s http://localhost:4000/api/cache/metrics)
if echo "$metrics" | jq -e '.success' > /dev/null; then
  hit_rate=$(echo "$metrics" | jq -r '.metrics.hitRate')
  avg_time=$(echo "$metrics" | jq -r '.metrics.avgResponseTime')
  echo "✅ Metrics available"
  echo "   - Hit rate: $(echo "$hit_rate * 100" | cut -d. -f1)%"
  echo "   - Avg response time: ${avg_time}ms"
else
  echo "❌ Metrics not available"
fi

echo ""
echo "=== Health Check Complete ==="
```

## 🎯 **Real-World Scenarios**

### **E-commerce Integration**
```typescript
// E-commerce platform integration
class ECommercePlatform {
  private identifierClient: UniversalIdentifierClient;
  
  constructor() {
    this.identifierClient = new UniversalIdentifierClient();
  }
  
  async getStorefront(identifier: string): Promise<StorefrontData> {
    // Resolve tenant by any identifier type
    const shop = await this.identifierClient.getShop(identifier);
    
    // Get additional storefront data
    const products = await this.getProducts(shop.id);
    const categories = await this.getCategories(shop.id);
    
    return {
      shop,
      products,
      categories,
      seo: {
        title: shop.name,
        description: `Shop ${shop.name} - ${shop.location}`,
        keywords: shop.primary_category
      }
    };
  }
  
  async searchStores(query: string): Promise<StorefrontData[]> {
    // Search by slugs (SEO-friendly)
    const identifiers = await this.searchIdentifiers(query);
    
    // Batch resolve all matching stores
    const results = await this.identifierClient.batchResolve(identifiers);
    
    // Build storefront data
    const storefronts = await Promise.all(
      results.successes.map(async (result) => {
        return this.getStorefront(result.identifier);
      })
    );
    
    return storefronts;
  }
}
```

### **Analytics Integration**
```python
# Analytics platform integration
class AnalyticsPlatform:
    def __init__(self):
        self.client = UniversalIdentifierClient()
    
    def get_tenant_analytics(self, identifier: str, date_range: Dict) -> Dict:
        """Get analytics for any tenant identifier"""
        # Resolve tenant
        shop = self.client.get_shop(identifier)
        
        # Get analytics data
        analytics = self.fetch_analytics(shop['id'], date_range)
        
        return {
            'tenant': shop,
            'analytics': analytics,
            'identifier_type': shop.get('metadata', {}).get('identifierType'),
            'resolution_time': shop.get('metadata', {}).get('timing', {}).get('resolution')
        }
    
    def batch_analytics(self, identifiers: List[str], date_range: Dict) -> Dict:
        """Get analytics for multiple tenants"""
        # Batch resolve identifiers
        results = self.client.batch_resolve(identifiers)
        
        # Get analytics for successful resolutions
        analytics_data = {}
        
        for success in results['data']['successes']:
            analytics_data[success['identifier']] = self.get_tenant_analytics(
                success['identifier'], 
                date_range
            )
        
        return {
            'analytics': analytics_data,
            'failed_resolutions': results['data']['failures'],
            'total_processed': len(results['data']['successes']) + len(results['data']['failures'])
        }
```

These examples demonstrate practical integration patterns for the universal identifier system across different platforms and use cases.
