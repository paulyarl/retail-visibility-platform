# Integration Examples — Using Implemented Features

This guide shows how to use the already-implemented Business Profile, Privacy Controls, SEO Markup, and Feature Flags.

---

## ✅ All Features Are Already Implemented!

Everything is ready to use. You just need to:
1. Enable feature flags
2. Connect to backend APIs
3. Use the components in your pages

---

## 1. Business Profile Forms (Already Integrated!)

### Location
The Business Profile components are now integrated into the Tenant Settings page at:
- **File:** `apps/web/src/app/settings/tenant/page.tsx`
- **URL:** `/settings/tenant`

### Components Used
- `BusinessProfileCard` - Display and edit business information
- `MapCardSettings` - Configure map display and privacy
- `SwisPreviewSettings` - Configure product preview

### Feature Flags
```typescript
// Currently enabled
FF_BUSINESS_PROFILE: 'on'  // ✅ Active

// Currently disabled (enable when backend ready)
FF_MAP_CARD: 'off'         // ⏳ Pending
FF_SWIS_PREVIEW: 'off'     // ⏳ Pending
```

### To Enable Map & SWIS Features
```typescript
import { enableForAll } from '@/lib/featureFlags';

// Enable for all users
enableForAll('FF_MAP_CARD');
enableForAll('FF_SWIS_PREVIEW');

// Or enable for pilot cohort
import { enablePilot } from '@/lib/featureFlags';
enablePilot('FF_MAP_CARD', ['tenant-1', 'tenant-2'], ['us-east-1']);
```

---

## 2. Privacy Controls Usage

### Using Coordinate Jitter

```typescript
import { applyPrivacyJitter, calculateDistance } from '@/lib/privacy/coordinateJitter';

// Example: Apply privacy to coordinates
const originalCoords = {
  latitude: 40.7128,
  longitude: -74.0060
};

// Precise mode (exact coordinates)
const preciseCoords = applyPrivacyJitter(originalCoords, 'precise');
console.log(preciseCoords);
// Output: { latitude: 40.7128, longitude: -74.0060 }

// Neighborhood mode (±0.002° jitter ≈200m)
const neighborhoodCoords = applyPrivacyJitter(originalCoords, 'neighborhood');
console.log(neighborhoodCoords);
// Output: { latitude: 40.712, longitude: -74.006 } (rounded)

// Calculate distance between original and jittered
const distance = calculateDistance(originalCoords, neighborhoodCoords);
console.log(`Privacy distance: ${distance}m`);
// Output: Privacy distance: 150m (approximately)
```

### Validate Privacy Jitter

```typescript
import { validatePrivacyJitter } from '@/lib/privacy/coordinateJitter';

const isValid = validatePrivacyJitter(originalCoords, neighborhoodCoords);
console.log(`Privacy jitter valid: ${isValid}`);
// Output: Privacy jitter valid: true (if 50m < distance < 300m)
```

### Audit Logging

```typescript
import { createCoordinateAccessLog } from '@/lib/privacy/coordinateJitter';

const auditLog = createCoordinateAccessLog({
  tenantId: 'tenant-123',
  userId: 'user-456',
  action: 'view',
  privacyMode: 'neighborhood',
  ipAddress: '192.168.1.1'
});

console.log(auditLog);
// Output: {
//   timestamp: '2025-10-21T15:30:00.000Z',
//   tenantId: 'tenant-123',
//   userId: 'user-456',
//   action: 'view',
//   privacyMode: 'neighborhood',
//   ipAddress: '192.168.1.1'
// }

// TODO: Send to audit logging service
// await fetch('/api/audit/coordinates', {
//   method: 'POST',
//   body: JSON.stringify(auditLog)
// });
```

---

## 3. SEO Markup Utilities Usage

### Generate LocalBusiness Schema

```typescript
import { generateLocalBusinessSchema, JsonLd } from '@/lib/seo/schemaMarkup';

// In your tenant public page component
export default function TenantPublicPage({ profile }) {
  const schema = generateLocalBusinessSchema({
    business_name: 'Downtown Electronics',
    address_line1: '123 Main St',
    city: 'New York',
    state: 'NY',
    postal_code: '10001',
    country_code: 'US',
    latitude: 40.7128,
    longitude: -74.0060,
    phone_number: '+1 212 555 0100',
    email: 'contact@downtown-electronics.com',
    website: 'https://downtown-electronics.com',
    hours: {
      monday: '09:00-17:00',
      tuesday: '09:00-17:00',
      wednesday: '09:00-17:00',
      thursday: '09:00-17:00',
      friday: '09:00-17:00',
      saturday: '10:00-16:00',
      sunday: 'closed'
    },
    social_links: {
      facebook: 'https://facebook.com/downtown-electronics',
      twitter: 'https://twitter.com/downtown_elec'
    }
  });

  return (
    <div>
      {/* Add JSON-LD to page head */}
      <JsonLd schema={schema} />
      
      {/* Your page content */}
      <h1>{profile.business_name}</h1>
      {/* ... */}
    </div>
  );
}
```

### Generate Product Schema

```typescript
import { generateProductSchema } from '@/lib/seo/schemaMarkup';

// In your product page
const productSchema = generateProductSchema(
  {
    sku: 'SKU-001',
    title: 'Organic Honey 12oz',
    brand: 'LocalBee',
    price: 7.99,
    currency: 'USD',
    image_url: 'https://example.com/honey.jpg',
    availability: 'in_stock',
    updated_at: '2025-10-21T14:32:00Z',
    category_path: ['Grocery', 'Pantry', 'Sweeteners']
  },
  'Downtown Electronics' // Tenant name
);

// Add to page
<JsonLd schema={productSchema} />
```

### Generate Product List Schema

```typescript
import { generateProductListSchema } from '@/lib/seo/schemaMarkup';

// In your product listing page
const products = [
  { sku: 'SKU-001', title: 'Product 1', price: 7.99, /* ... */ },
  { sku: 'SKU-002', title: 'Product 2', price: 9.99, /* ... */ },
];

const listSchema = generateProductListSchema(products, 'Downtown Electronics');

<JsonLd schema={listSchema} />
```

### Validate Schema

```typescript
import { validateSchema } from '@/lib/seo/schemaMarkup';

const validation = validateSchema(schema);
if (!validation.valid) {
  console.error('Schema validation errors:', validation.errors);
}
```

---

## 4. Feature Flag System Usage

### Check if Feature is Enabled

```typescript
import { isFeatureEnabled } from '@/lib/featureFlags';

// In a component
function MyComponent({ tenantId, region }) {
  const showMap = isFeatureEnabled('FF_MAP_CARD', tenantId, region);
  const showProducts = isFeatureEnabled('FF_SWIS_PREVIEW', tenantId, region);

  return (
    <div>
      {showMap && <MapCard {...props} />}
      {showProducts && <SwisPreviewWidget {...props} />}
    </div>
  );
}
```

### Enable Features (Admin Only)

```typescript
import { 
  enableForAll, 
  enablePilot, 
  enablePercentage,
  disableForAll 
} from '@/lib/featureFlags';

// Enable for everyone
enableForAll('FF_MAP_CARD');

// Enable for pilot cohort (20% of users in specific regions)
enablePilot('FF_SWIS_PREVIEW', 
  ['tenant-1', 'tenant-2', 'tenant-3'], // Specific tenants
  ['us-east-1', 'eu-west-1']            // Specific regions
);

// Enable for 50% of users (gradual rollout)
enablePercentage('FF_MAP_CARD', 50);

// Disable if issues found
disableForAll('FF_SWIS_PREVIEW');
```

### Gradual Rollout

```typescript
import { gradualRollout } from '@/lib/featureFlags';

// Increase from current % to 100% at 20% per day
gradualRollout('FF_MAP_CARD', 100, 20);

// Day 1: 20%
// Day 2: 40%
// Day 3: 60%
// Day 4: 80%
// Day 5: 100%
```

### Emergency Rollback

```typescript
import { rollbackFeature } from '@/lib/featureFlags';

// If critical issue detected
rollbackFeature('FF_SWIS_PREVIEW', 'High error rate detected');
// This will:
// 1. Disable the feature
// 2. Log the reason
// 3. Alert on-call team (in production)
```

---

## 5. Complete Integration Example

### Tenant Public Page with All Features

```typescript
// apps/web/src/app/tenant/[id]/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MapCard from '@/components/tenant/MapCard';
import SwisPreviewWidget from '@/components/tenant/SwisPreviewWidget';
import { generateLocalBusinessSchema, JsonLd } from '@/lib/seo/schemaMarkup';
import { applyPrivacyJitter } from '@/lib/privacy/coordinateJitter';
import { isFeatureEnabled } from '@/lib/featureFlags';

export default function TenantPublicPage() {
  const params = useParams();
  const tenantId = params.id as string;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tenant profile
    fetch(`/api/tenant/${tenantId}/profile`)
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        setLoading(false);
      });
  }, [tenantId]);

  if (loading || !profile) {
    return <div>Loading...</div>;
  }

  // Apply privacy jitter to coordinates
  const displayCoords = profile.latitude && profile.longitude
    ? applyPrivacyJitter(
        { latitude: profile.latitude, longitude: profile.longitude },
        profile.map_privacy_mode || 'precise'
      )
    : null;

  // Generate SEO schema
  const schema = generateLocalBusinessSchema({
    ...profile,
    latitude: displayCoords?.latitude,
    longitude: displayCoords?.longitude,
  });

  // Check feature flags
  const showMap = isFeatureEnabled('FF_MAP_CARD', tenantId, profile.region);
  const showProducts = isFeatureEnabled('FF_SWIS_PREVIEW', tenantId, profile.region);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* SEO Markup */}
      <JsonLd schema={schema} />

      {/* Hero Section */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-neutral-900">
            {profile.business_name}
          </h1>
          <p className="text-lg text-neutral-600 mt-2">
            {profile.city}, {profile.state}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Map Card - Feature Flag Controlled */}
        {showMap && profile.display_map && displayCoords && (
          <MapCard
            businessName={profile.business_name}
            addressLine1={profile.address_line1}
            addressLine2={profile.address_line2}
            city={profile.city}
            state={profile.state}
            postalCode={profile.postal_code}
            countryCode={profile.country_code}
            latitude={displayCoords.latitude}
            longitude={displayCoords.longitude}
            displayMap={true}
            privacyMode={profile.map_privacy_mode}
          />
        )}

        {/* SWIS Preview - Feature Flag Controlled */}
        {showProducts && (
          <SwisPreviewWidget
            tenantId={tenantId}
            limit={12}
            sortOrder="updated_desc"
            badgesEnabled={true}
            onViewAll={() => window.location.href = `/tenant/${tenantId}/products`}
          />
        )}
      </div>
    </div>
  );
}
```

---

## 6. Testing the Integration

### Test Privacy Controls

```bash
# In browser console
import { applyPrivacyJitter, calculateDistance } from '@/lib/privacy/coordinateJitter';

const coords = { latitude: 40.7128, longitude: -74.0060 };
const jittered = applyPrivacyJitter(coords, 'neighborhood');
const distance = calculateDistance(coords, jittered);

console.log('Original:', coords);
console.log('Jittered:', jittered);
console.log('Distance:', distance, 'm');
```

### Test Feature Flags

```bash
# In browser console or admin panel
import { isFeatureEnabled, enablePilot } from '@/lib/featureFlags';

// Check current status
console.log('Map enabled:', isFeatureEnabled('FF_MAP_CARD', 'tenant-1'));

// Enable for pilot
enablePilot('FF_MAP_CARD', ['tenant-1']);

// Check again
console.log('Map enabled:', isFeatureEnabled('FF_MAP_CARD', 'tenant-1'));
```

### Test SEO Markup

```bash
# View page source and look for JSON-LD
# Or use Google's Rich Results Test:
# https://search.google.com/test/rich-results

# Should see:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Downtown Electronics",
  ...
}
</script>
```

---

## Summary

### ✅ What's Implemented
1. **Business Profile Forms** - Fully integrated in Settings page
2. **Privacy Controls** - Coordinate jitter utility ready to use
3. **SEO Markup** - Schema.org generators ready to use
4. **Feature Flags** - Complete system with rollout controls

### ⏳ What's Needed
1. **Backend APIs** - Implement the API endpoints
2. **Database** - Add schema for business profiles
3. **Google Maps API Key** - Add to environment variables
4. **Enable Feature Flags** - Turn on when backend ready

### 🚀 Quick Start
1. Enable `FF_BUSINESS_PROFILE` (already on)
2. Visit `/settings/tenant` to see Business Profile card
3. When backend ready, enable `FF_MAP_CARD` and `FF_SWIS_PREVIEW`
4. Components will automatically appear!

---

**All features are implemented and ready to use!** 🎉
