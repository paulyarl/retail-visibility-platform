# Universal Identifier API Documentation

## 🎯 **Overview**

The Universal Identifier API provides a unified interface for resolving tenant identifiers across all endpoints. This system supports three identifier types with encrypted caching for optimal performance.

## 📋 **Supported Identifier Types**

| Type | Example | Description | Use Case |
|------|---------|-------------|----------|
| **tenant-id** | `tid-m8ijkrnk` | Internal database ID | System integrations |
| **slug** | `baraka-international-market-inc` | Human-readable URL | Public URLs, SEO |
| **auto-id** | `ULCW` | Short auto-generated | QR codes, references |

## 🔗 **API Endpoints**

### **Public Routes**

#### **GET /api/public/shops/:identifier**
Get shop information by any identifier type.

**Request:**
```bash
curl http://localhost:4000/api/public/shops/tid-m8ijkrnk
curl http://localhost:4000/api/public/shops/baraka-international-market-inc
curl http://localhost:4000/api/public/shops/ULCW
```

**Response:**
```json
{
  "success": true,
  "shop": {
    "id": "tid-m8ijkrnk",
    "name": "Baraka International Market inc.",
    "slug": "baraka-international-market-inc",
    "business_name": "Baraka International Market inc.",
    "imageUrl": "https://example.com/logo.jpg",
    "address": "2740 Saw Mill Run Blvd",
    "city": "Pittsburgh",
    "state": "PA",
    "zip_code": "15227",
    "location": "Pittsburgh, PA",
    "rating": 5,
    "rating_count": 6,
    "productCount": 30,
    "is_published": true,
    "primary_category": "Grocery Store",
    "created_at": "2026-02-04T08:21:03.150Z"
  },
  "metadata": {
    "tenant": {
      "id": "tid-m8ijkrnk",
      "name": "Baraka International Market inc.",
      "slug": "baraka-international-market-inc",
      "type": "tenant_id"
    },
    "identifierType": "tenant_id"
  }
}
```

#### **POST /api/public/test/batch-resolve**
Test multiple identifiers simultaneously.

**Request:**
```bash
curl -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{
    "identifiers": [
      "tid-m8ijkrnk",
      "baraka-international-market-inc",
      "ULCW",
      "invalid-id"
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "successes": [
      {
        "identifier": "tid-m8ijkrnk",
        "tenant": {
          "id": "tid-m8ijkrnk",
          "slug": "baraka-international-market-inc",
          "name": "Baraka International Market inc.",
          "subscriptionStatus": "active",
          "metadata": { /* tenant metadata */ },
          "type": "tenant_id"
        },
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

### **Authenticated Routes**

#### **GET /api/tenants/:identifier/profile**
Get complete tenant profile (requires authentication).

**Request:**
```bash
curl http://localhost:4000/api/tenants/tid-m8ijkrnk/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tid-m8ijkrnk",
    "name": "Baraka International Market inc.",
    "slug": "baraka-international-market-inc",
    "subscriptionStatus": "active",
    "metadata": {
      "gbp_categories": {
        "primary": {
          "id": "gcid:grocery-store",
          "name": "Grocery Store"
        },
        "secondary": [
          {
            "id": "gcid:african-grocery-store",
            "name": "African Grocery Store"
          }
        ],
        "sync_status": "synced",
        "last_synced_at": "2026-01-27T17:17:19.881Z"
      }
    },
    "createdAt": "2025-12-22T21:22:47.114Z",
    "updatedAt": "2025-12-22T21:22:47.114Z",
    "settings": {},
    "businessInfo": {}
  },
  "metadata": {
    "tenant": {
      "id": "tid-m8ijkrnk",
      "name": "Baraka International Market inc.",
      "slug": "baraka-international-market-inc",
      "type": "tenant_id"
    },
    "identifierType": "tenant_id"
  }
}
```

#### **GET /api/tenants/:identifier/complete**
Get complete tenant data including usage, tier, and subscription.

**Request:**
```bash
curl http://localhost:4000/api/tenants/tid-m8ijkrnk/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": { /* tenant profile data */ },
    "usage": {
      "totalItems": 30,
      "activeItems": 25,
      "categories": 5,
      "users": 3,
      "orders": 150
    },
    "tier": {
      "currentTier": "basic",
      "limits": {
        "items": 1000,
        "users": 5,
        "categories": 50,
        "storage": 104857600
      },
      "usage": {
        "items": 30,
        "users": 3,
        "categories": 5,
        "storage": 5242880
      }
    },
    "subscription": {
      "status": "active",
      "plan": "basic",
      "features": ["basic_analytics", "inventory_management"]
    }
  },
  "metadata": { /* resolution metadata */ }
}
```

#### **GET /api/tenants/:identifier/stats**
Get tenant statistics and usage metrics.

**Request:**
```bash
curl http://localhost:4000/api/tenants/tid-m8ijkrnk/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "usage": {
      "totalItems": 30,
      "activeItems": 25,
      "categories": 5,
      "users": 3,
      "orders": 150
    },
    "tier": {
      "currentTier": "basic",
      "limits": { /* tier limits */ },
      "usage": { /* tier usage */ }
    },
    "subscription": {
      "status": "active",
      "plan": "basic",
      "features": ["basic_analytics", "inventory_management"]
    }
  },
  "metadata": { /* resolution metadata */ }
}
```

### **Cache Monitoring Routes**

#### **GET /api/cache/metrics**
Get cache performance metrics.

**Request:**
```bash
curl http://localhost:4000/api/cache/metrics
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "hits": 1250,
    "misses": 150,
    "hitRate": 0.89,
    "avgResponseTime": 45,
    "encryptedEntries": 89,
    "totalMemoryUsage": 92456,
    "lastReset": 1770192000000,
    "corruptionCount": 0,
    "invalidationCount": 5,
    "oldestEntry": 86400000,
    "newestEntry": 120000,
    "averageEntryAge": 43200000
  },
  "timestamp": 1770192724759
}
```

#### **GET /api/cache/health**
Get cache health status.

**Request:**
```bash
curl http://localhost:4000/api/cache/health
```

**Response:**
```json
{
  "success": true,
  "health": {
    "status": "healthy",
    "uptime": 86400000,
    "memoryUsage": 92456,
    "hitRate": 0.89,
    "errorRate": 0.01,
    "lastError": null,
    "entries": 89,
    "corruptionCount": 0
  },
  "timestamp": 1770192724759
}
```

#### **POST /api/cache/warm**
Warm cache with specific identifiers.

**Request:**
```bash
curl -X POST http://localhost:4000/api/cache/warm \
  -H "Content-Type: application/json" \
  -d '{
    "identifiers": [
      "tid-m8ijkrnk",
      "baraka-international-market-inc"
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "warmed": 2,
  "failed": 0,
  "results": [
    {
      "identifier": "tid-m8ijkrnk",
      "status": "success",
      "time": 234
    },
    {
      "identifier": "baraka-international-market-inc",
      "status": "success", 
      "time": 189
    }
  ],
  "timestamp": 1770192724759
}
```

## 🔐 **Authentication**

### **JWT Token Required**
All authenticated routes require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

### **Token Claims**
```json
{
  "userId": "uid-zqe5ns5k",
  "email": "platform@rvp.com",
  "role": "PLATFORM_ADMIN",
  "tenantIds": ["tid-m8ijkrnk", "tid-042hi7ju"],
  "iat": 1770035518,
  "exp": 1801571518
}
```

### **Access Control**
- **Public routes**: No authentication required
- **Authenticated routes**: Valid JWT token required
- **Tenant access**: User must have access to resolved tenant

## 📊 **Response Format**

### **Success Response**
```json
{
  "success": true,
  "data": { /* response data */ },
  "metadata": {
    "tenant": {
      "id": "tid-m8ijkrnk",
      "name": "Baraka International Market inc.",
      "slug": "baraka-international-market-inc",
      "type": "tenant_id"
    },
    "identifierType": "tenant_id",
    "timing": {
      "resolution": 45,
      "total": 234
    }
  }
}
```

### **Error Response**
```json
{
  "success": false,
  "error": "Tenant not found",
  "message": "No tenant found for identifier: invalid-id",
  "code": "TENANT_NOT_FOUND",
  "timestamp": 1770192724759
}
```

## 🚨 **Error Codes**

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `TENANT_NOT_FOUND` | Tenant not found for identifier | 404 |
| `AUTHENTICATION_REQUIRED` | JWT token required | 401 |
| `ACCESS_DENIED` | User lacks tenant access | 403 |
| `INVALID_IDENTIFIER` | Invalid identifier format | 400 |
| `CACHE_ERROR` | Cache encryption/decryption error | 500 |
| `DATABASE_ERROR` | Database query error | 500 |

## 📈 **Performance Characteristics**

### **Response Times**
- **Cache hit**: ~40ms
- **Cache miss**: ~600ms (includes database lookup)
- **Batch resolution**: ~200ms per identifier (parallel)

### **Cache Performance**
- **Hit rate**: 85-95% (typical)
- **Memory usage**: ~1KB per cached entry
- **TTL**: 15 minutes (default)
- **Max entries**: 1000 (configurable)

### **Throughput**
- **Concurrent requests**: 100+ (typical)
- **Batch size**: Up to 50 identifiers per request
- **Rate limiting**: Applied per endpoint

## 🔧 **Configuration**

### **Environment Variables**
```bash
# Cache encryption key (required for production)
IDENTIFIER_CACHE_KEY=your-secure-32-character-key

# Cache settings
CACHE_DEFAULT_TTL=900000        # 15 minutes
CACHE_MAX_ENTRIES=1000
CACHE_CLEANUP_INTERVAL=300000    # 5 minutes

# Performance settings
CACHE_BATCH_SIZE=50
CACHE_WARM_BATCH_SIZE=10
```

### **Cache Headers**
```http
Cache-Control: public, max-age=900    # 15 minutes for public routes
Cache-Control: private, max-age=300   # 5 minutes for private routes
X-Service-Source: Universal-Identifier-Cache
X-Resolution-Time: 45
```

## 🧪 **Testing Examples**

### **Basic Identifier Resolution**
```bash
# Test tenant-id
curl http://localhost:4000/api/public/shops/tid-m8ijkrnk

# Test slug
curl http://localhost:4000/api/public/shops/baraka-international-market-inc

# Test auto-id
curl http://localhost:4000/api/public/shops/ULCW
```

### **Batch Testing**
```bash
# Test multiple identifiers
curl -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{
    "identifiers": [
      "tid-m8ijkrnk",
      "baraka-international-market-inc",
      "ULCW",
      "invalid-id"
    ]
  }'
```

### **Authenticated Testing**
```bash
# Test tenant profile
curl http://localhost:4000/api/tenants/tid-m8ijkrnk/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test complete tenant data
curl http://localhost:4000/api/tenants/tid-m8ijkrnk/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Cache Testing**
```bash
# Get cache metrics
curl http://localhost:4000/api/cache/metrics

# Check cache health
curl http://localhost:4000/api/cache/health

# Warm cache
curl -X POST http://localhost:4000/api/cache/warm \
  -H "Content-Type: application/json" \
  -d '{"identifiers": ["tid-m8ijkrnk"]}'
```

## 🔄 **Integration Examples**

### **JavaScript/TypeScript**
```typescript
// Universal identifier resolution
async function getTenant(identifier: string) {
  const response = await fetch(`/api/public/shops/${identifier}`);
  const data = await response.json();
  
  if (data.success) {
    return data.shop;
  } else {
    throw new Error(data.error);
  }
}

// Batch testing
async function testIdentifiers(identifiers: string[]) {
  const response = await fetch('/api/public/test/batch-resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers })
  });
  
  return response.json();
}
```

### **Python**
```python
import requests

def get_tenant(identifier):
    response = requests.get(f'http://localhost:4000/api/public/shops/{identifier}')
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Error: {response.json().get('error')}")

def test_identifiers(identifiers):
    response = requests.post(
        'http://localhost:4000/api/public/test/batch-resolve',
        json={'identifiers': identifiers}
    )
    return response.json()
```

### **cURL**
```bash
# Basic usage
curl http://localhost:4000/api/public/shops/tid-m8ijkrnk

# With headers
curl -H "Accept: application/json" \
     http://localhost:4000/api/public/shops/baraka-international-market-inc

# Batch testing
curl -X POST http://localhost:4000/api/public/test/batch-resolve \
  -H "Content-Type: application/json" \
  -d '{"identifiers": ["tid-m8ijkrnk", "baraka-international-market-inc"]}'
```

## 📚 **Additional Resources**

- [Implementation Guide](./UNIVERSAL_IDENTIFIER_IMPLEMENTATION_GUIDE.md)
- [Migration Plan](./TENANT_SERVICE_MIGRATION_PLAN.md)
- [Troubleshooting Guide](./UNIVERSAL_IDENTIFIER_TROUBLESHOOTING.md)
- [Performance Guide](./UNIVERSAL_IDENTIFIER_PERFORMANCE.md)

This API provides a robust, secure, and high-performance universal identifier system suitable for production use across all platform endpoints.
