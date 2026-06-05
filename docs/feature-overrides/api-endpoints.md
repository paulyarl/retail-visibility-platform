# Feature Overrides API Endpoints

## Overview
API endpoints for managing all types of feature overrides in the platform.

## Base URL
`/api/admin/feature-overrides`

## Authentication
All endpoints require admin authentication and appropriate permissions.

## Endpoints

### 1. Get All Overrides
```
GET /api/admin/feature-overrides
```

**Query Parameters:**
- `type` (optional): Filter by override type (`feature`, `pricing`, `limits`, `featured_products`, `tenant_limits`)
- `status` (optional): Filter by status (`active`, `expired`, `revoked`, `pending`)
- `tenantId` (optional): Filter by tenant ID
- `organizationId` (optional): Filter by organization ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "overrides": [
    {
      "id": "override-123",
      "organizationId": "org-456",
      "organizationName": "Test Organization",
      "tenantId": "tenant-789",
      "tenantName": "Test Tenant",
      "type": "feature",
      "status": "active",
      "reason": "Trial upgrade",
      "approvedBy": "admin-1",
      "approvedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "expiresAt": null,
      // Type-specific fields
      "feature": "advanced_analytics",
      "featureName": "Advanced Analytics"
    }
  ],
  "count": 25,
  "page": 1,
  "totalPages": 1
}
```

### 2. Get Override by ID
```
GET /api/admin/feature-overrides/{id}
```

**Response:** Single override object (same structure as above)

### 3. Create Feature Override
```
POST /api/admin/feature-overrides/feature
```

**Request Body:**
```json
{
  "organizationId": "org-456",
  "tenantId": "tenant-789",
  "feature": "advanced_analytics",
  "featureName": "Advanced Analytics",
  "reason": "Trial upgrade for enterprise client",
  "expiresAt": "2024-02-15T23:59:59Z"
}
```

**Response:** Created override object

### 4. Create Pricing Override
```
POST /api/admin/feature-overrides/pricing
```

**Request Body:**
```json
{
  "organizationId": "org-456",
  "tenantId": "tenant-789",
  "subscriptionTier": "enterprise",
  "originalPrice": 499.99,
  "customPrice": 399.99,
  "discountPercent": 20,
  "currency": "USD",
  "billingInterval": "monthly",
  "reason": "Custom pricing for enterprise client",
  "expiresAt": null
}
```

**Response:** Created override object

### 5. Create Limits Override
```
POST /api/admin/feature-overrides/limits
```

**Request Body:**
```json
{
  "organizationId": "org-456",
  "tenantId": "tenant-789",
  "subscriptionTier": "business",
  "limitType": "locations",
  "originalLimit": 3,
  "customLimit": 10,
  "reason": "Expansion allowance for growing business",
  "expiresAt": "2024-06-30T23:59:59Z"
}
```

**Response:** Created override object

### 6. Create Featured Products Override
```
POST /api/admin/feature-overrides/featured-products
```

**Request Body:**
```json
{
  "organizationId": "org-456",
  "tenantId": "tenant-789",
  "subscriptionTier": "basic",
  "featuredType": "seasonal",
  "originalLimit": 5,
  "customLimit": 15,
  "reason": "Holiday promotion increase",
  "expiresAt": "2024-01-31T23:59:59Z"
}
```

**Response:** Created override object

### 7. Create Tenant Limits Override
```
POST /api/admin/feature-overrides/tenant-limits
```

**Request Body:**
```json
{
  "organizationId": "org-456",
  "tenantId": "tenant-789",
  "subscriptionTier": "basic",
  "originalLimit": 1,
  "customLimit": 5,
  "reason": "Multi-location expansion",
  "expiresAt": null
}
```

**Response:** Created override object

### 8. Update Override Status
```
PUT /api/admin/feature-overrides/{id}/status
```

**Request Body:**
```json
{
  "status": "revoked",
  "reason": "No longer needed"
}
```

**Response:** Updated override object

### 9. Delete Override
```
DELETE /api/admin/feature-overrides/{id}
```

**Response:** 
```json
{
  "message": "Override deleted successfully"
}
```

### 10. Get Override Statistics
```
GET /api/admin/feature-overrides/stats
```

**Response:**
```json
{
  "total": 150,
  "active": 120,
  "expired": 20,
  "revoked": 8,
  "pending": 2,
  "byType": {
    "feature": 45,
    "pricing": 25,
    "limits": 30,
    "featured_products": 35,
    "tenant_limits": 15
  }
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK` - Successful operation
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "error": "Validation error",
  "message": "Invalid override type specified",
  "details": {
    "field": "type",
    "value": "invalid_type",
    "allowedValues": ["feature", "pricing", "limits", "featured_products", "tenant_limits"]
  }
}
```

## Database Operations (Single Table Architecture)

### Feature Override Creation
```sql
-- Insert main override record
INSERT INTO feature_overrides (
  id, organization_id, tenant_id, override_type, status, reason, expires_at, granted_by
) VALUES ($1, $2, $3, 'feature', 'active', $4, $5, $6);

-- Insert feature details (flexible structure)
INSERT INTO feature_override_details (
  override_id, detail_type, detail_key, detail_value, detail_boolean_value
) VALUES 
  ($1, 'feature', 'feature_name', $2, true),
  ($1, 'feature', 'feature_key', $3, null);
```

### Pricing Override Creation
```sql
-- Insert main override record with pricing fields
INSERT INTO feature_overrides (
  id, organization_id, tenant_id, override_type, status, subscription_tier, 
  custom_price, currency, reason, expires_at, granted_by
) VALUES ($1, $2, $3, 'pricing', 'active', $4, $5, $6, $7, $8, $9);

-- Insert pricing details
INSERT INTO feature_override_details (
  override_id, detail_type, detail_key, detail_value, detail_numeric_value
) VALUES 
  ($1, 'pricing_field', 'billing_interval', $2, null),
  ($1, 'pricing_field', 'original_price', $3, $4),
  ($1, 'pricing_field', 'discount_percent', $5, $6);
```

### Limits Override Creation
```sql
-- Insert main override record with limit fields
INSERT INTO feature_overrides (
  id, organization_id, tenant_id, override_type, status, subscription_tier, 
  original_limit, custom_limit, reason, expires_at, granted_by
) VALUES ($1, $2, $3, 'limits', 'active', $4, $5, $6, $7, $8, $9);

-- Insert limits details
INSERT INTO feature_override_details (
  override_id, detail_type, detail_key, detail_value, detail_numeric_value
) VALUES 
  ($1, 'limit_type', 'limit_name', $2, null),
  ($1, 'limit_type', 'limit_unit', $3, null);
```

### Featured Products Override Creation
```sql
-- Insert main override record
INSERT INTO feature_overrides (
  id, organization_id, tenant_id, override_type, status, subscription_tier, 
  original_limit, custom_limit, reason, expires_at, granted_by
) VALUES ($1, $2, $3, 'featured_products', 'active', $4, $5, $6, $7, $8, $9);

-- Insert featured products details
INSERT INTO feature_override_details (
  override_id, detail_type, detail_key, detail_value, detail_numeric_value
) VALUES 
  ($1, 'featured_type', 'featured_name', $2, null),
  ($1, 'featured_type', 'duration', $3, null);
```

### Tenant Limits Override Creation
```sql
-- Insert main override record
INSERT INTO feature_overrides (
  id, organization_id, tenant_id, override_type, status, subscription_tier, 
  original_limit, custom_limit, reason, expires_at, granted_by
) VALUES ($1, $2, $3, 'tenant_limits', 'active', $4, $5, $6, $7, $8, $9);

-- Insert tenant limits details
INSERT INTO feature_override_details (
  override_id, detail_type, detail_key, detail_value, detail_numeric_value
) VALUES 
  ($1, 'limit_type', 'limit_name', $2, null),
  ($1, 'limit_type', 'geographic_scope', $3, null);
```

### Query Examples for Single Table Architecture

#### Get All Active Overrides for a Tenant
```sql
SELECT 
    fo.*,
    od.detail_type,
    od.detail_key,
    od.detail_value,
    od.detail_numeric_value
FROM feature_overrides fo
LEFT JOIN feature_override_details od ON fo.id = od.override_id
WHERE fo.tenant_id = $1 
  AND fo.status = 'active'
  AND (fo.expires_at IS NULL OR fo.expires_at > CURRENT_TIMESTAMP)
ORDER BY fo.created_at DESC;
```

#### Get Specific Override Type with Details
```sql
-- Get feature overrides
SELECT 
    fo.*,
    od.detail_value as feature_name
FROM feature_overrides fo
JOIN feature_override_details od ON fo.id = od.override_id
WHERE fo.tenant_id = $1 
  AND fo.override_type = 'feature'
  AND od.detail_type = 'feature'
  AND od.detail_key = 'feature_name'
  AND fo.status = 'active';

-- Get pricing overrides
SELECT 
    fo.*,
    fo.custom_price,
    fo.currency,
    od.detail_value as billing_interval
FROM feature_overrides fo
JOIN feature_override_details od ON fo.id = od.override_id
WHERE fo.tenant_id = $1 
  AND fo.override_type = 'pricing'
  AND od.detail_type = 'pricing_field'
  AND od.detail_key = 'billing_interval'
  AND fo.status = 'active';
```

#### Admin View with All Override Types
```sql
SELECT 
    fo.id,
    fo.organization_id,
    fo.tenant_id,
    t.name as tenant_name,
    o.name as organization_name,
    fo.override_type,
    fo.status,
    fo.reason,
    fo.granted_by,
    fo.created_at,
    fo.expires_at,
    CASE fo.override_type
        WHEN 'feature' THEN (
            SELECT od.detail_value 
            FROM feature_override_details od 
            WHERE od.override_id = fo.id 
              AND od.detail_type = 'feature' 
              AND od.detail_key = 'feature_name' 
            LIMIT 1
        )
        WHEN 'pricing' THEN CONCAT(fo.custom_price, ' ', fo.currency)
        WHEN 'limits' THEN CONCAT(
            fo.custom_limit, ' ', 
            (SELECT od.detail_value 
             FROM feature_override_details od 
             WHERE od.override_id = fo.id 
               AND od.detail_type = 'limit_type' 
               AND od.detail_key = 'limit_name' 
             LIMIT 1)
        )
        WHEN 'featured_products' THEN CONCAT(
            fo.custom_limit, ' ', 
            (SELECT od.detail_value 
             FROM feature_override_details od 
             WHERE od.override_id = fo.id 
               AND od.detail_type = 'featured_type' 
               AND od.detail_key = 'featured_name' 
             LIMIT 1)
        )
        WHEN 'tenant_limits' THEN CONCAT(fo.custom_limit, ' locations')
    END as override_value
FROM feature_overrides fo
LEFT JOIN tenants t ON fo.tenant_id = t.id
LEFT JOIN organizations_list o ON fo.organization_id = o.id
ORDER BY fo.created_at DESC;
```

## Performance Considerations

### Indexes Used
- `idx_feature_overrides_tenant_id` - Filter by tenant
- `idx_feature_overrides_type` - Filter by type
- `idx_feature_overrides_status` - Filter by status
- `idx_overrides_tenant_type_status` - Composite queries
- Detail table indexes for specific type queries

### Caching Strategy
- List endpoints: 15 minutes cache
- Single override: 5 minutes cache
- Statistics: 1 hour cache
- Cache invalidated on any create/update/delete operation

### Pagination
- Default page size: 50 items
- Maximum page size: 100 items
- Uses cursor-based pagination for large datasets

## Security Considerations

### Authentication
- JWT token required
- Admin role validation
- Organization/tenant access validation

### Authorization
- Only admins can create overrides
- Users can only view overrides for their organizations
- Audit trail for all actions

### Validation
- Input sanitization
- Business rule validation
- Rate limiting applied
