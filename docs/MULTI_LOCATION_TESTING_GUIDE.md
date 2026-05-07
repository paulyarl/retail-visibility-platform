# Multi-Location Inventory Architecture - Integration Testing Guide

## Overview

This guide covers testing the Phase 3 multi-location inventory architecture, including:
- Location availability API endpoints
- LocationAvailabilityService (frontend)
- LocationAvailabilitySection UI component
- End-to-end product page integration

---

## Prerequisites

1. **Database Setup**
   ```bash
   # Run the Phase 3 migration (if not already applied)
   cd apps/api
   npx prisma db push
   
   # Or apply the SQL migration directly
   psql -d your_database -f prisma/migrations/phase3_multi_location.sql
   ```

2. **Seed Test Data**
   - At least 2 tenants belonging to the same organization
   - Products with matching UPCs across tenants
   - Products with `in_stock` availability status

---

## API Endpoint Testing

### 1. Test Product Availability by Slug

**Endpoint:** `GET /api/catalog/availability`

```bash
# Basic query
curl "http://localhost:3001/api/catalog/availability?slug=test-product-slug"

# With user location (enables distance calculation)
curl "http://localhost:3001/api/catalog/availability?slug=test-product-slug&lat=40.7128&lng=-74.0060"

# With organization filter
curl "http://localhost:3001/api/catalog/availability?slug=test-product-slug&organizationId=org_123"

# With distance limit
curl "http://localhost:3001/api/catalog/availability?slug=test-product-slug&lat=40.7128&lng=-74.0060&maxDistance=25"

# Exclude out of stock
curl "http://localhost:3001/api/catalog/availability?slug=test-product-slug&includeOutOfStock=false"
```

**Expected Response:**
```json
{
  "productSlug": "test-product-slug",
  "universalSku": "USKU-12345",
  "productName": "Test Product",
  "totalLocations": 3,
  "inStockLocations": 2,
  "nearestAvailable": {
    "tenantId": "tenant_1",
    "tenantName": "Store A",
    "distance": 2.5,
    "stock": 10,
    "availability": "in_stock",
    "priceCents": 1999,
    "isNearest": true
  },
  "locations": [...],
  "userLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

### 2. Test Availability by Universal SKU

**Endpoint:** `GET /api/catalog/availability/sku`

```bash
curl "http://localhost:3001/api/catalog/availability/sku?sku=USKU-12345&lat=40.7128&lng=-74.0060"
```

### 3. Test Batch Availability (Cart)

**Endpoint:** `POST /api/catalog/availability/batch`

```bash
curl -X POST "http://localhost:3001/api/catalog/availability/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productSlug": "product-1", "quantity": 2},
      {"productSlug": "product-2", "quantity": 1}
    ],
    "lat": 40.7128,
    "lng": -74.0060,
    "organizationId": "org_123"
  }'
```

**Expected Response:**
```json
{
  "items": [
    {
      "productSlug": "product-1",
      "quantity": 2,
      "available": true,
      "locations": [
        {
          "tenantId": "tenant_1",
          "tenantName": "Store A",
          "distance": 2.5,
          "stock": 10,
          "availability": "in_stock",
          "priceCents": 1999
        }
      ]
    }
  ]
}
```

---

## Frontend Service Testing

### Test LocationAvailabilityService

Create a test page or use browser console:

```typescript
// In browser console or test file
import { locationAvailabilityService } from '@/services/LocationAvailabilityService';

// Test 1: Get product availability
const availability = await locationAvailabilityService.getProductAvailability(
  'test-product-slug',
  { latitude: 40.7128, longitude: -74.0060 },
  { maxDistance: 50, maxResults: 10 }
);
console.log('Availability:', availability);

// Test 2: Calculate distance
const distance = locationAvailabilityService.calculateDistance(
  40.7128, -74.0060,  // NYC
  34.0522, -118.2437  // LA
);
console.log('Distance (miles):', distance); // Should be ~2,445 miles

// Test 3: Find nearest available
const nearest = locationAvailabilityService.findNearestAvailable(availability.locations);
console.log('Nearest:', nearest);

// Test 4: Get availability summary
const summary = locationAvailabilityService.getAvailabilitySummary(availability.locations);
console.log('Summary:', summary);
```

---

## UI Component Testing

### Test LocationAvailabilitySection

1. **Create Test Page** (optional):
   ```tsx
   // apps/web/src/app/test-location/page.tsx
   'use client';
   
   import { LocationAvailabilitySection } from '@/components/products/LocationAvailabilitySection';
   
   export default function TestLocationPage() {
     return (
       <div className="p-8 max-w-4xl mx-auto">
         <h1 className="text-2xl font-bold mb-4">Location Availability Test</h1>
         <LocationAvailabilitySection
           productSlug="test-product"
           productName="Test Product"
           organizationId="org_123"
           preferredTenantId="tenant_1"
           maxDistance={50}
           maxResults={10}
         />
       </div>
     );
   }
   ```

2. **Test Scenarios:**
   - Load page with valid product slug → Should show locations
   - Load page without organizationId → Should not render
   - Load page with invalid product → Should show "No locations found"
   - Click location "Select" button → Should trigger onLocationSelect callback
   - Toggle expand/collapse → Should show/hide location list

3. **Browser Geolocation:**
   - Allow location permission → Should show distances
   - Deny location permission → Should show locations without distances

---

## End-to-End Integration Testing

### Test Flow: Product Page with Multi-Location

1. **Setup:**
   - Create an organization with 2+ tenants (stores)
   - Add the same product to multiple tenants
   - Set different stock levels and prices

2. **Test Steps:**
   ```
   1. Navigate to /products/[product-id]
   2. Verify LocationAvailabilitySection renders (if organizationId exists)
   3. Verify locations are displayed with correct:
      - Store names
      - Stock status badges
      - Prices
      - Distances (if geolocation enabled)
   4. Verify "Nearest" badge on closest in-stock location
   5. Verify "Preferred" badge on current tenant (if applicable)
   ```

3. **Verify API Calls:**
   - Open browser DevTools → Network tab
   - Look for `/api/catalog/availability?slug=...` request
   - Verify response contains expected data

---

## Test Data Setup Script

```sql
-- Create test organization
INSERT INTO organizations_list (id, name, owner_id, created_at, updated_at)
VALUES ('org_test', 'Test Organization', 'user_1', NOW(), NOW());

-- Create test tenants (stores)
INSERT INTO tenants (id, name, slug, organization_id, subscription_tier, created_at)
VALUES 
  ('tenant_1', 'Store A', 'store-a', 'org_test', 'chain_starter', NOW()),
  ('tenant_2', 'Store B', 'store-b', 'org_test', 'chain_starter', NOW());

-- Create test products with same UPC
INSERT INTO inventory_items (id, name, sku, gtin, price_cents, stock, availability, tenant_id, item_status, visibility, created_at, updated_at)
VALUES 
  ('item_1', 'Test Product', 'SKU-001', '012345678901', 1999, 10, 'in_stock', 'tenant_1', 'active', 'public', NOW(), NOW()),
  ('item_2', 'Test Product', 'SKU-002', '012345678901', 1799, 5, 'in_stock', 'tenant_2', 'active', 'public', NOW(), NOW()),
  ('item_3', 'Test Product', 'SKU-003', '012345678901', 2199, 0, 'out_of_stock', 'tenant_2', 'active', 'public', NOW(), NOW());

-- Create global catalog entry
INSERT INTO global_product_catalog (id, name, product_slug, gtin_upc, status, created_at, updated_at)
VALUES ('gp_1', 'Test Product', 'test-product', '012345678901', 'active', NOW(), NOW());

-- Create slug registry
INSERT INTO product_slug_registry (id, product_slug, universal_sku, created_at)
VALUES ('sr_1', 'test-product', 'USKU-001', NOW());
```

---

## Troubleshooting

### Common Issues

1. **"No locations found"**
   - Check products have `item_status: 'active'` and `visibility: 'public'`
   - Verify UPC/GTIN matches between inventory_items and global_product_catalog
   - Check tenant has `organization_id` set

2. **Distance shows 999**
   - Geolocation not available or denied
   - Tenant missing latitude/longitude in database

3. **TypeScript errors in service**
   - Ensure `FlexibleApiSingleton` is properly imported
   - Check abstract members are implemented

4. **API returns 500**
   - Check Prisma query syntax (use `mode: 'insensitive'` not `ilike`)
   - Verify enum values match schema (`in_stock`, `out_of_stock`, `preorder`)

---

## Automated Test Examples

### Jest/Playwright Test (API)

```typescript
// apps/api/src/routes/__tests__/location-availability.test.ts
import request from 'supertest';
import app from '../../index';

describe('Location Availability API', () => {
  it('should return availability for valid product slug', async () => {
    const response = await request(app)
      .get('/api/catalog/availability')
      .query({ slug: 'test-product', maxDistance: 50 });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('productSlug');
    expect(response.body).toHaveProperty('locations');
    expect(Array.isArray(response.body.locations)).toBe(true);
  });

  it('should calculate distances when user location provided', async () => {
    const response = await request(app)
      .get('/api/catalog/availability')
      .query({ 
        slug: 'test-product', 
        lat: '40.7128', 
        lng: '-74.0060' 
      });
    
    expect(response.status).toBe(200);
    expect(response.body.userLocation).toBeDefined();
  });
});
```

### Component Test (Jest + Testing Library)

```typescript
// apps/web/src/components/products/__tests__/LocationAvailabilitySection.test.tsx
import { render, screen } from '@testing-library/react';
import { LocationAvailabilitySection } from '../LocationAvailabilitySection';

// Mock the service
jest.mock('@/services/LocationAvailabilityService', () => ({
  locationAvailabilityService: {
    getProductAvailability: jest.fn().mockResolvedValue({
      productSlug: 'test-product',
      productName: 'Test Product',
      totalLocations: 2,
      inStockLocations: 1,
      locations: [
        { tenantId: 't1', tenantName: 'Store A', distance: 5, stock: 10, availability: 'in_stock', priceCents: 1999 }
      ]
    })
  }
}));

describe('LocationAvailabilitySection', () => {
  it('should render when organizationId provided', () => {
    render(
      <LocationAvailabilitySection
        productSlug="test-product"
        productName="Test Product"
        organizationId="org_1"
      />
    );
    
    expect(screen.getByText('Availability Near You')).toBeInTheDocument();
  });

  it('should not render without organizationId', () => {
    const { container } = render(
      <LocationAvailabilitySection
        productSlug="test-product"
        productName="Test Product"
      />
    );
    
    expect(container.firstChild).toBeNull();
  });
});
```

---

## Next Steps

After successful testing:
1. Apply database migration to staging/production
2. Monitor API response times
3. Add latitude/longitude to tenant records for accurate distances
4. Implement Phase 4: Organization-centric checkout architecture
