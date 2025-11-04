# M2 Unified Validation API - Developer Documentation

**Feature:** Unified Validation API + Feed Enforcement  
**Version:** 1.0.0 (In Progress)  
**Last Updated:** November 4, 2025  
**Audience:** Developers & API Integrators

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Validation Rules](#validation-rules)
4. [Feed Enforcement](#feed-enforcement)
5. [Error Handling](#error-handling)
6. [Code Examples](#code-examples)
7. [Testing](#testing)
8. [Best Practices](#best-practices)

---

## 🎯 Overview

### What is M2?

M2 provides a unified validation API that ensures data quality and consistency across:
- Product categories
- Product feeds
- Category assignments
- Data imports
- SKU scanning operations

### Key Features

- ✅ **Unified Validation** - Single validation layer for all operations
- 🔒 **Feed Enforcement** - Prevent invalid data from entering system
- 📋 **Precheck API** - Validate before committing
- 🚫 **Error Prevention** - Catch issues early
- 📊 **Validation Reports** - Detailed error messages
- 🔄 **Scanning Integration** - Validates scanned items

### Architecture

```
┌─────────────────┐
│  Client/UI      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validation API  │ ◄── M2 Layer
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database       │
└─────────────────┘
```

---

## 🔌 API Endpoints

### Base URL

```
Production: https://api.retailvisibility.com
Development: http://localhost:4000
```

### Authentication

All endpoints require JWT authentication:

```http
Authorization: Bearer <your_jwt_token>
```

---

## Category Validation Endpoints

### 1. Precheck Category

**Validate category data before creating/updating**

```http
POST /api/categories/precheck
```

**Request Body:**

```json
{
  "name": "Electronics",
  "parentId": "cat_123456",
  "description": "Electronic devices and accessories",
  "attributes": {
    "icon": "electronics",
    "color": "#3B82F6"
  }
}
```

**Response (200 OK):**

```json
{
  "valid": true,
  "warnings": [],
  "suggestions": {
    "gbpCategory": "Consumer Electronics",
    "relatedCategories": ["Computers", "Mobile Devices"]
  }
}
```

**Response (422 Unprocessable Entity):**

```json
{
  "valid": false,
  "errors": [
    {
      "field": "name",
      "code": "DUPLICATE_NAME",
      "message": "Category name already exists",
      "suggestion": "Use 'Electronics & Gadgets' instead"
    },
    {
      "field": "parentId",
      "code": "INVALID_PARENT",
      "message": "Parent category not found"
    }
  ],
  "warnings": [
    {
      "field": "description",
      "code": "TOO_SHORT",
      "message": "Description should be at least 20 characters"
    }
  ]
}
```

---

### 2. Validate Category

**Full validation with database checks**

```http
POST /api/categories/validate
```

**Request Body:**

```json
{
  "categoryId": "cat_123456",
  "operation": "update",
  "data": {
    "name": "Updated Electronics",
    "description": "Updated description"
  }
}
```

**Response:**

```json
{
  "valid": true,
  "categoryId": "cat_123456",
  "validation": {
    "nameUnique": true,
    "parentValid": true,
    "hierarchyDepth": 2,
    "gbpMapped": true
  },
  "metadata": {
    "affectedProducts": 150,
    "childCategories": 5
  }
}
```

---

### 3. Validate Category Assignment

**Validate product-to-category assignment**

```http
POST /api/categories/validate-assignment
```

**Request Body:**

```json
{
  "productId": "prod_789",
  "categoryId": "cat_123456",
  "operation": "assign"
}
```

**Response:**

```json
{
  "valid": true,
  "assignment": {
    "compatible": true,
    "categoryPath": ["Home", "Electronics", "Computers"],
    "gbpCategory": "Consumer Electronics"
  },
  "recommendations": {
    "suggestedAttributes": ["brand", "model", "price"],
    "relatedCategories": ["Laptops", "Desktops"]
  }
}
```

---

## Product Feed Endpoints

### 4. Precheck Feed

**Validate feed data before push**

```http
POST /api/feed/precheck
```

**Request Body:**

```json
{
  "tenantId": "tenant_123",
  "products": [
    {
      "sku": "ELEC-001",
      "name": "Wireless Mouse",
      "category": "Electronics > Accessories",
      "price": 29.99,
      "quantity": 100
    }
  ]
}
```

**Response:**

```json
{
  "valid": true,
  "summary": {
    "totalProducts": 1,
    "validProducts": 1,
    "invalidProducts": 0,
    "warnings": 0
  },
  "products": [
    {
      "sku": "ELEC-001",
      "valid": true,
      "categoryMapped": true,
      "gbpCategory": "Consumer Electronics"
    }
  ]
}
```

**Response (with errors):**

```json
{
  "valid": false,
  "summary": {
    "totalProducts": 2,
    "validProducts": 1,
    "invalidProducts": 1,
    "warnings": 1
  },
  "products": [
    {
      "sku": "ELEC-001",
      "valid": true,
      "warnings": [
        {
          "code": "MISSING_DESCRIPTION",
          "message": "Product description is recommended"
        }
      ]
    },
    {
      "sku": "ELEC-002",
      "valid": false,
      "errors": [
        {
          "field": "category",
          "code": "CATEGORY_NOT_FOUND",
          "message": "Category 'Invalid Category' does not exist"
        },
        {
          "field": "price",
          "code": "INVALID_PRICE",
          "message": "Price must be greater than 0"
        }
      ]
    }
  ]
}
```

---

### 5. Push Feed

**Push validated feed to system**

```http
POST /api/feed/push
```

**Headers:**

```http
Authorization: Bearer <token>
Content-Type: application/json
X-Tenant-ID: tenant_123
```

**Request Body:**

```json
{
  "tenantId": "tenant_123",
  "source": "manual_upload",
  "validateFirst": true,
  "products": [
    {
      "sku": "ELEC-001",
      "name": "Wireless Mouse",
      "category": "Electronics > Accessories",
      "price": 29.99,
      "quantity": 100,
      "attributes": {
        "brand": "TechCo",
        "color": "Black"
      }
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "feedId": "feed_abc123",
  "summary": {
    "totalProducts": 1,
    "created": 1,
    "updated": 0,
    "skipped": 0,
    "failed": 0
  },
  "timestamp": "2025-11-04T02:00:00Z"
}
```

**Response (422 Unprocessable Entity - Enforcement Enabled):**

```json
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "Feed validation failed. Fix errors before pushing.",
  "validation": {
    "totalProducts": 2,
    "validProducts": 1,
    "invalidProducts": 1
  },
  "errors": [
    {
      "sku": "ELEC-002",
      "field": "category",
      "code": "CATEGORY_REQUIRED",
      "message": "Category is required when FEED_ALIGNMENT_ENFORCE is enabled"
    }
  ]
}
```

---

### 6. Get Feed Status

**Check status of pushed feed**

```http
GET /api/feed/{feedId}/status
```

**Response:**

```json
{
  "feedId": "feed_abc123",
  "status": "completed",
  "progress": {
    "total": 100,
    "processed": 100,
    "successful": 98,
    "failed": 2
  },
  "startedAt": "2025-11-04T02:00:00Z",
  "completedAt": "2025-11-04T02:05:00Z",
  "duration": 300000,
  "errors": [
    {
      "sku": "ELEC-099",
      "error": "Duplicate SKU"
    }
  ]
}
```

---

## Scanning Integration Endpoints

### 7. Precheck Scan Result

**Validate scanned item before committing**

```http
POST /api/scan/{sessionId}/precheck
```

**Request Body:**

```json
{
  "barcode": "012345678905",
  "enrichment": {
    "name": "Product Name",
    "category": "Electronics",
    "brand": "BrandName"
  }
}
```

**Response:**

```json
{
  "valid": true,
  "barcode": "012345678905",
  "validation": {
    "nameValid": true,
    "categoryValid": true,
    "categoryMapped": true,
    "gbpCategory": "Consumer Electronics"
  },
  "warnings": [],
  "suggestions": {
    "category": "Electronics > Accessories",
    "attributes": ["model", "color"]
  }
}
```

---

### 8. Validate Scan Session

**Validate entire scan session before commit**

```http
POST /api/scan/{sessionId}/validate
```

**Response:**

```json
{
  "valid": true,
  "sessionId": "session_123",
  "summary": {
    "totalItems": 10,
    "validItems": 10,
    "invalidItems": 0,
    "warnings": 2
  },
  "items": [
    {
      "resultId": "result_1",
      "barcode": "012345678905",
      "valid": true,
      "warnings": [
        {
          "code": "MISSING_BRAND",
          "message": "Brand information not available"
        }
      ]
    }
  ]
}
```

---

## 📋 Validation Rules

### Category Validation Rules

#### Required Fields

| Field | Type | Required | Max Length |
|-------|------|----------|------------|
| `name` | string | Yes | 100 |
| `tenantId` | string | Yes | - |
| `parentId` | string | No | - |
| `description` | string | No | 500 |

#### Business Rules

1. **Unique Names**
   - Category names must be unique within tenant
   - Case-insensitive comparison
   - Error code: `DUPLICATE_NAME`

2. **Valid Parent**
   - Parent category must exist
   - Cannot create circular references
   - Error code: `INVALID_PARENT`

3. **Hierarchy Depth**
   - Maximum depth: 5 levels
   - Error code: `MAX_DEPTH_EXCEEDED`

4. **GBP Mapping**
   - Warning if no GBP category mapped
   - Code: `GBP_NOT_MAPPED`

### Product Validation Rules

#### Required Fields (when FEED_ALIGNMENT_ENFORCE = true)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `sku` | string | Yes | Unique, 1-100 chars |
| `name` | string | Yes | 1-200 chars |
| `category` | string | Yes | Must exist |
| `price` | number | Yes | > 0 |
| `quantity` | integer | No | >= 0 |

#### Business Rules

1. **Category Assignment**
   - Product must have valid category
   - Category must be leaf node (no children)
   - Error code: `CATEGORY_REQUIRED`

2. **Price Validation**
   - Must be positive number
   - Maximum: 999999.99
   - Error code: `INVALID_PRICE`

3. **SKU Uniqueness**
   - SKU must be unique within tenant
   - Error code: `DUPLICATE_SKU`

---

## 🔒 Feed Enforcement

### Configuration

Feed enforcement is controlled by the `FEED_ALIGNMENT_ENFORCE` flag:

```env
# .env
FEED_ALIGNMENT_ENFORCE=true
```

### Enforcement Levels

#### Strict Mode (FEED_ALIGNMENT_ENFORCE = true)

- ❌ Rejects feeds with validation errors
- ✅ Requires all products to have categories
- ✅ Enforces price validation
- ✅ Blocks duplicate SKUs
- ⚠️ Allows warnings but logs them

**Response:**
```json
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "Feed rejected due to validation errors"
}
```

#### Lenient Mode (FEED_ALIGNMENT_ENFORCE = false)

- ✅ Accepts feeds with warnings
- ⚠️ Logs validation errors
- ✅ Allows missing categories
- ✅ Skips invalid items
- 📊 Reports issues in response

**Response:**
```json
{
  "success": true,
  "warnings": [
    {
      "sku": "PROD-001",
      "message": "Missing category"
    }
  ]
}
```

### Checking Enforcement Status

```http
GET /api/config/feed-enforcement
```

**Response:**

```json
{
  "enforced": true,
  "mode": "strict",
  "rules": {
    "categoryRequired": true,
    "priceValidation": true,
    "skuUniqueness": true
  }
}
```

---

## ⚠️ Error Handling

### Error Response Format

All validation errors follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "fieldName",
    "value": "invalidValue",
    "constraint": "validation rule violated"
  },
  "timestamp": "2025-11-04T02:00:00Z",
  "requestId": "req_abc123"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_FAILED` | 422 | One or more validation rules failed |
| `CATEGORY_NOT_FOUND` | 404 | Referenced category doesn't exist |
| `DUPLICATE_NAME` | 409 | Category name already exists |
| `DUPLICATE_SKU` | 409 | Product SKU already exists |
| `INVALID_PARENT` | 400 | Parent category is invalid |
| `MAX_DEPTH_EXCEEDED` | 400 | Category hierarchy too deep |
| `CATEGORY_REQUIRED` | 422 | Category is required (enforcement mode) |
| `INVALID_PRICE` | 422 | Price validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Error Handling Best Practices

**1. Check Precheck First**

```javascript
// Always precheck before pushing
const precheckResult = await fetch('/api/feed/precheck', {
  method: 'POST',
  body: JSON.stringify(feedData)
});

if (!precheckResult.valid) {
  // Handle errors before pushing
  console.error('Validation failed:', precheckResult.errors);
  return;
}

// Now safe to push
await fetch('/api/feed/push', {
  method: 'POST',
  body: JSON.stringify(feedData)
});
```

**2. Handle 422 Gracefully**

```javascript
try {
  const response = await fetch('/api/feed/push', {
    method: 'POST',
    body: JSON.stringify(feedData)
  });
  
  if (response.status === 422) {
    const errors = await response.json();
    // Show user-friendly error messages
    displayValidationErrors(errors);
    return;
  }
  
  const result = await response.json();
  // Success handling
} catch (error) {
  // Network or other errors
  console.error('Feed push failed:', error);
}
```

**3. Retry Logic**

```javascript
async function pushFeedWithRetry(feedData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/api/feed/push', {
        method: 'POST',
        body: JSON.stringify(feedData)
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // Don't retry validation errors
      if (response.status === 422) {
        throw new Error('Validation failed');
      }
      
      // Retry on server errors
      if (response.status >= 500) {
        await sleep(1000 * Math.pow(2, i)); // Exponential backoff
        continue;
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

---

## 💻 Code Examples

### JavaScript/TypeScript

#### Precheck Category

```typescript
interface CategoryPrecheckRequest {
  name: string;
  parentId?: string;
  description?: string;
  attributes?: Record<string, any>;
}

interface CategoryPrecheckResponse {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  suggestions?: {
    gbpCategory?: string;
    relatedCategories?: string[];
  };
}

async function precheckCategory(
  data: CategoryPrecheckRequest
): Promise<CategoryPrecheckResponse> {
  const response = await fetch('/api/categories/precheck', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify(data)
  });
  
  return await response.json();
}

// Usage
const result = await precheckCategory({
  name: 'Electronics',
  description: 'Electronic devices and accessories'
});

if (!result.valid) {
  console.error('Validation failed:', result.errors);
} else {
  console.log('Category valid!', result.suggestions);
}
```

#### Push Feed with Validation

```typescript
interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  quantity?: number;
  attributes?: Record<string, any>;
}

interface FeedPushRequest {
  tenantId: string;
  source: string;
  validateFirst: boolean;
  products: Product[];
}

async function pushFeed(
  tenantId: string,
  products: Product[]
): Promise<void> {
  // Step 1: Precheck
  const precheckResponse = await fetch('/api/feed/precheck', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ tenantId, products })
  });
  
  const precheckResult = await precheckResponse.json();
  
  if (!precheckResult.valid) {
    throw new Error(`Validation failed: ${JSON.stringify(precheckResult.errors)}`);
  }
  
  // Step 2: Push
  const pushResponse = await fetch('/api/feed/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      'X-Tenant-ID': tenantId
    },
    body: JSON.stringify({
      tenantId,
      source: 'api',
      validateFirst: true,
      products
    })
  });
  
  if (!pushResponse.ok) {
    const error = await pushResponse.json();
    throw new Error(`Feed push failed: ${error.message}`);
  }
  
  const result = await pushResponse.json();
  console.log('Feed pushed successfully:', result);
}
```

### Python

```python
import requests
from typing import List, Dict, Optional

class ValidationAPI:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def precheck_category(self, name: str, parent_id: Optional[str] = None) -> Dict:
        """Precheck category before creating"""
        url = f'{self.base_url}/api/categories/precheck'
        data = {
            'name': name,
            'parentId': parent_id
        }
        
        response = requests.post(url, json=data, headers=self.headers)
        return response.json()
    
    def push_feed(self, tenant_id: str, products: List[Dict]) -> Dict:
        """Push product feed with validation"""
        # Precheck first
        precheck_url = f'{self.base_url}/api/feed/precheck'
        precheck_data = {
            'tenantId': tenant_id,
            'products': products
        }
        
        precheck_response = requests.post(
            precheck_url,
            json=precheck_data,
            headers=self.headers
        )
        precheck_result = precheck_response.json()
        
        if not precheck_result.get('valid'):
            raise ValueError(f"Validation failed: {precheck_result.get('errors')}")
        
        # Push feed
        push_url = f'{self.base_url}/api/feed/push'
        push_data = {
            'tenantId': tenant_id,
            'source': 'api',
            'validateFirst': True,
            'products': products
        }
        
        push_response = requests.post(
            push_url,
            json=push_data,
            headers=self.headers
        )
        
        if push_response.status_code != 200:
            raise Exception(f"Feed push failed: {push_response.text}")
        
        return push_response.json()

# Usage
api = ValidationAPI('http://localhost:4000', 'your_token_here')

# Precheck category
result = api.precheck_category('Electronics')
print(f"Valid: {result['valid']}")

# Push feed
products = [
    {
        'sku': 'ELEC-001',
        'name': 'Wireless Mouse',
        'category': 'Electronics',
        'price': 29.99
    }
]

feed_result = api.push_feed('tenant_123', products)
print(f"Feed ID: {feed_result['feedId']}")
```

### cURL

```bash
# Precheck category
curl -X POST http://localhost:4000/api/categories/precheck \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electronics",
    "description": "Electronic devices"
  }'

# Push feed
curl -X POST http://localhost:4000/api/feed/push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_123" \
  -d '{
    "tenantId": "tenant_123",
    "source": "api",
    "validateFirst": true,
    "products": [
      {
        "sku": "ELEC-001",
        "name": "Wireless Mouse",
        "category": "Electronics",
        "price": 29.99
      }
    ]
  }'
```

---

## 🧪 Testing

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { validateCategory } from './validation';

describe('Category Validation', () => {
  it('should validate valid category', () => {
    const result = validateCategory({
      name: 'Electronics',
      description: 'Electronic devices'
    });
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should reject duplicate category name', () => {
    const result = validateCategory({
      name: 'Existing Category'
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('DUPLICATE_NAME');
  });
  
  it('should warn about missing GBP mapping', () => {
    const result = validateCategory({
      name: 'Custom Category'
    });
    
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'GBP_NOT_MAPPED' })
    );
  });
});
```

### Integration Testing

```typescript
describe('Feed Push API', () => {
  it('should push valid feed', async () => {
    const response = await fetch('/api/feed/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId: 'test_tenant',
        products: [
          {
            sku: 'TEST-001',
            name: 'Test Product',
            category: 'Test Category',
            price: 10.00
          }
        ]
      })
    });
    
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid feed when enforcement enabled', async () => {
    const response = await fetch('/api/feed/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId: 'test_tenant',
        products: [
          {
            sku: 'TEST-002',
            name: 'Invalid Product',
            // Missing category
            price: -10.00 // Invalid price
          }
        ]
      })
    });
    
    expect(response.status).toBe(422);
    const result = await response.json();
    expect(result.error).toBe('VALIDATION_FAILED');
  });
});
```

---

## 💡 Best Practices

### 1. Always Precheck

```typescript
// ✅ Good: Precheck before pushing
const precheck = await precheckFeed(data);
if (precheck.valid) {
  await pushFeed(data);
}

// ❌ Bad: Push without prechecking
await pushFeed(data); // May fail with 422
```

### 2. Handle Validation Errors Gracefully

```typescript
// ✅ Good: User-friendly error handling
try {
  await pushFeed(data);
} catch (error) {
  if (error.code === 'VALIDATION_FAILED') {
    showUserFriendlyErrors(error.details);
  } else {
    showGenericError();
  }
}
```

### 3. Batch Validation

```typescript
// ✅ Good: Validate entire batch
const result = await precheckFeed({
  products: allProducts // Validate all at once
});

// ❌ Bad: Validate one by one
for (const product of products) {
  await precheckProduct(product); // Too many API calls
}
```

### 4. Cache Validation Results

```typescript
// ✅ Good: Cache category validation
const categoryCache = new Map();

async function validateCategoryWithCache(categoryId: string) {
  if (categoryCache.has(categoryId)) {
    return categoryCache.get(categoryId);
  }
  
  const result = await validateCategory(categoryId);
  categoryCache.set(categoryId, result);
  return result;
}
```

### 5. Monitor Validation Metrics

```typescript
// Track validation failures
metrics.increment('validation.failed', {
  errorCode: error.code,
  endpoint: '/api/feed/push'
});

// Track validation success rate
const successRate = validProducts / totalProducts;
metrics.gauge('validation.success_rate', successRate);
```

---

## 📊 Rate Limits

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `/api/categories/precheck` | 100 req/min | Per user |
| `/api/categories/validate` | 100 req/min | Per user |
| `/api/feed/precheck` | 10 req/min | Per tenant |
| `/api/feed/push` | 5 req/min | Per tenant |
| `/api/scan/*/precheck` | 50 req/min | Per session |

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699056000
```

---

## 🔗 Related Documentation

- [M2 Admin Guide](./M2_ADMIN_GUIDE.md) - Feed enforcement configuration
- [M3 API Documentation](./M3_API_DOCUMENTATION.md) - Category sync APIs
- [M4 API Documentation](./M4_API_DOCUMENTATION.md) - SKU scanning APIs
- [OpenAPI Specification](./openapi.yaml) - Complete API reference

---

## 📞 Support

**Developer Support:**
- Email: dev-support@retailvisibility.com
- Slack: #api-support
- Documentation: https://docs.retailvisibility.com

**Report API Issues:**
- Include request ID
- Provide request/response samples
- Note environment (prod/dev)

---

**Version:** 1.0.0 (In Progress)  
**Last Updated:** November 4, 2025  
**Status:** 🟡 Partially Complete

**Questions?** Contact dev-support@retailvisibility.com
