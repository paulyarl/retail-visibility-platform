# API Proxy Routes Audit

## Issue
Many Vercel API proxy routes are not forwarding authentication headers (Authorization, Cookie) to the Railway backend API, causing 401 Unauthorized errors.

## Solution
Use the centralized `api-proxy.ts` utility functions which automatically forward auth headers.

## Status

### ✅ Fixed
- `/api/organization/billing/counters` - GET (Authorization + Cookie)
- `/api/admin/settings/branding` - GET, POST (Authorization + Cookie)
- `/api/admin/email-config` - GET, PUT (Authorization + Cookie)
- `/api/tenant/gbp-category` - GET, PUT (Authorization + Cookie)
- `/api/upgrade-requests` - GET, POST (Bearer token - already correct)
- `/api/upgrade-requests/[id]` - GET, PATCH, DELETE (Bearer token - already correct)

### ✅ Verified Correct
Routes that already properly forward auth:

1. `/api/upgrade-requests/*` - Uses Bearer token extraction from cookies ✅

## Recommended Fix Pattern

### Before (Missing Auth Headers)
```typescript
const response = await fetch(`${API_BASE_URL}/admin/email-config`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // ❌ No auth headers!
  },
});
```

### After (Using Utility)
```typescript
import { proxyGet } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  try {
    const response = await proxyGet(req, '/admin/email-config');
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
```

### Alternative (Manual Header Forwarding)
```typescript
const authHeader = req.headers.get('authorization');
const cookieHeader = req.headers.get('cookie');

const headers: HeadersInit = {
  'Content-Type': 'application/json',
};

if (authHeader) {
  headers['Authorization'] = authHeader;
}

if (cookieHeader) {
  headers['Cookie'] = cookieHeader;
}

const response = await fetch(`${API_BASE_URL}/admin/email-config`, {
  method: 'GET',
  headers,
});
```

## Testing Checklist

For each route:
- [ ] Test as authenticated user
- [ ] Test as unauthenticated user (should get 401)
- [ ] Test with platform admin
- [ ] Test with regular user
- [ ] Verify Railway logs show successful auth

## Priority

**High Priority (User-Facing)**
- Organization billing/counters ✅
- Admin settings
- Tenant settings

**Medium Priority (Admin-Only)**
- Email config
- Branding
- Feature flags

**Low Priority (Internal)**
- Upgrade requests
- Debug endpoints

## Next Steps

1. ✅ Update `api-proxy.ts` to forward Cookie headers
2. ⏳ Audit all API routes for auth header forwarding
3. ⏳ Update routes to use centralized utility
4. ⏳ Add tests to prevent regression
5. ⏳ Document pattern in developer guide

## Prevention

**For New API Routes:**
1. ✅ ALWAYS use `api-proxy.ts` utility functions
2. ✅ NEVER manually call `fetch(API_BASE_URL)` without auth headers
3. ✅ Test with authentication before deploying
4. ❌ NEVER assume Vercel automatically forwards headers

**Code Review Checklist:**
- [ ] Does route proxy to Railway?
- [ ] Are auth headers forwarded?
- [ ] Is `api-proxy.ts` utility used?
- [ ] Has it been tested with auth?
