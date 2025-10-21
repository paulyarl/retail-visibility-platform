# Backend API Updates for Business Profile Integration

## Overview
To enable the advanced tenant selector features (grouping by state, showing city/state, region filtering), the backend API needs to include business profile data in the tenant responses.

**IMPORTANT:** The API also needs to implement user-based filtering so business owners only see their tenants, while admins see all tenants.

---

## 1. Update GET /tenants Endpoint

### Authentication Headers
The frontend now passes these headers with every request:
```
X-User-Id: <supabase_user_id>
X-User-Email: <user_email>
X-User-Role: business_owner | admin
```

### Filtering Logic
```typescript
// Pseudo-code for backend
if (userRole === 'admin') {
  // Return ALL tenants
  return getAllTenants();
} else {
  // Return only tenants owned by this user
  return getTenantsByUserId(userId);
}
```

### Current Response:
```json
[
  {
    "id": "cmh10ifbq0007mq1zme0yxcu",
    "name": "Lupid Store"
  }
]
```

### Required Response:
```json
[
  {
    "id": "cmh10ifbq0007mq1zme0yxcu",
    "name": "Lupid Store",
    "city": "San Francisco",
    "state": "California",
    "region": "West Coast",
    "country": "US"
  }
]
```

### Database Query Update:
If using SQL/Prisma, join with business_profiles table:

```sql
SELECT 
  t.id,
  t.name,
  bp.city,
  bp.state,
  bp.region,
  bp.country_code as country
FROM tenants t
LEFT JOIN business_profiles bp ON t.id = bp.tenant_id
WHERE t.user_id = ?
```

Or in Prisma:
```typescript
const tenants = await prisma.tenant.findMany({
  where: { userId },
  include: {
    businessProfile: {
      select: {
        city: true,
        state: true,
        region: true,
        country_code: true,
      }
    }
  }
});

// Transform to flat structure
return tenants.map(t => ({
  id: t.id,
  name: t.name,
  city: t.businessProfile?.city,
  state: t.businessProfile?.state,
  region: t.businessProfile?.region,
  country: t.businessProfile?.country_code,
}));
```

---

## 2. Region Mapping (Optional)

If `region` is not stored in the database, you can derive it from the state:

```typescript
const STATE_TO_REGION: Record<string, string> = {
  // West Coast
  'California': 'West Coast',
  'Oregon': 'West Coast',
  'Washington': 'West Coast',
  
  // East Coast
  'New York': 'East Coast',
  'Massachusetts': 'East Coast',
  'Connecticut': 'East Coast',
  'New Jersey': 'East Coast',
  'Pennsylvania': 'East Coast',
  
  // South
  'Texas': 'South',
  'Florida': 'South',
  'Georgia': 'South',
  'North Carolina': 'South',
  
  // Midwest
  'Illinois': 'Midwest',
  'Ohio': 'Midwest',
  'Michigan': 'Midwest',
  'Wisconsin': 'Midwest',
  
  // Add more as needed...
};

function getRegion(state: string): string {
  return STATE_TO_REGION[state] || 'Other';
}
```

---

## 3. Business Profile Schema

Ensure your business_profiles table has these fields:

```sql
CREATE TABLE business_profiles (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) UNIQUE NOT NULL,
  business_name VARCHAR(255),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),           -- Required for dropdown
  state VARCHAR(100),          -- Required for grouping
  postal_code VARCHAR(20),
  country_code VARCHAR(2),     -- ISO 3166-1 alpha-2
  region VARCHAR(100),         -- Optional, can be derived
  phone_number VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  contact_person VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

---

## 4. Frontend Type Definition (Already Done)

The frontend is already expecting this structure:

```typescript
type Tenant = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  region?: string;
};
```

---

## 5. Testing the Integration

### Step 1: Complete Business Profile
1. Go to `/onboarding?tenantId=xxx`
2. Fill out all fields including city and state
3. Submit the form

### Step 2: Verify API Response
```bash
curl http://localhost:4000/tenants
```

Should return:
```json
[
  {
    "id": "xxx",
    "name": "Store Name",
    "city": "San Francisco",
    "state": "California",
    "region": "West Coast",
    "country": "US"
  }
]
```

### Step 3: See It in Action
1. Go to `/items` page
2. Click tenant dropdown
3. You should see:
   - Grouped by state (e.g., "CALIFORNIA")
   - City and state displayed under tenant name
   - Region shown if available

---

## 6. Advanced Features Enabled

Once the API returns this data, users will automatically get:

✅ **Grouping by State**
```
CALIFORNIA
  San Francisco Store
    San Francisco, CA
  Los Angeles Store
    Los Angeles, CA

NEW YORK
  Manhattan Store
    New York, NY
```

✅ **Search by City/State**
- Type "san francisco" → finds all SF stores
- Type "california" → finds all CA stores

✅ **Region Filtering** (if implemented)
- Group by region instead of state
- Filter by region

---

## 7. Migration Path

### Phase 1: Add Fields (Current)
- Add city, state, region to API response
- Fields can be null/undefined for existing tenants

### Phase 2: Backfill Data
- Prompt users to complete business profile
- Show banner: "Complete your business profile for better visibility"

### Phase 3: Make Required
- Require business profile completion during tenant creation
- Redirect to onboarding after tenant creation (already implemented)

---

## 8. API Endpoint Summary

### Required Changes:
- ✅ `GET /tenants` - Include city, state, region, country
- ⏳ `POST /tenant/:id/profile` - Save business profile (for onboarding)
- ⏳ `GET /tenant/:id/profile` - Retrieve business profile (for editing)

### Optional Enhancements:
- `GET /tenants?state=California` - Filter by state
- `GET /tenants?region=West Coast` - Filter by region
- `GET /tenants/regions` - Get list of all regions

---

## Questions?

If you need help with:
- Database schema
- Prisma models
- SQL queries
- Region mapping logic

Let me know and I can provide more specific code examples!
