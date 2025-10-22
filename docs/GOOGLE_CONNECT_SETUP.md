# Google Connect Suite - Setup & Deployment Guide

**Version:** 1.0 (Read-Only)  
**Status:** Ready for Pilot Testing  
**ENH:** ENH-2026-043 (GMC) + ENH-2026-044 (GBP)

---

## Overview

The Google Connect Suite integrates Google Merchant Center and Google Business Profile into the Retail Visibility Platform, enabling merchants to:
- Sync inventory to Google Shopping
- View Business Profile insights
- Manage multiple locations
- Track performance metrics

---

## Architecture

```
┌─────────────────────────────────────────┐
│ Google Cloud Console (Platform Owner)  │
│ - OAuth Client ID                       │
│ - Client Secret                         │
│ - Shared by all tenants                 │
└─────────────────────────────────────────┘
                    │
                    │ Your credentials
                    ▼
┌─────────────────────────────────────────┐
│ RVP Platform (Your App)                 │
│ - OAuth 2.0 Flow                        │
│ - AES-256-GCM Encryption                │
│ - Token Refresh                         │
│ - NAP Validation                        │
└─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Tenant A │  │ Tenant B │  │ Tenant C │
│ Tokens   │  │ Tokens   │  │ Tokens   │
└──────────┘  └──────────┘  └──────────┘
```

---

## Prerequisites

- [ ] Google Cloud Console account
- [ ] Railway backend deployed
- [ ] Vercel frontend deployed
- [ ] PostgreSQL database (Railway)
- [ ] Supabase account (for storage)

---

## Part 1: Google Cloud Console Setup

### Step 1: Create Project

1. Go to https://console.cloud.google.com/
2. Click project dropdown → "New Project"
3. Name: `Retail Visibility Platform`
4. Click "Create"

### Step 2: Enable APIs

Navigate to `APIs & Services` → `Library` and enable:

1. **Content API for Shopping** (for Merchant Center)
2. **My Business Business Information API** (for Business Profile)
3. **My Business Account Management API** (for Business Profile)

### Step 3: Configure OAuth Consent Screen

1. Go to `APIs & Services` → `OAuth consent screen`
2. Select **External** user type
3. Fill in:
   - **App name:** Retail Visibility Platform
   - **User support email:** your-email@example.com
   - **App logo:** (optional)
   - **Application home page:** `https://retail-visibility-platform-web.vercel.app`
   - **Authorized domains:** `vercel.app`
   - **Developer contact:** your-email@example.com

4. Click "Save and Continue"

### Step 4: Add Scopes

Click "Add or Remove Scopes" and add:
- `https://www.googleapis.com/auth/content`
- `https://www.googleapis.com/auth/business.manage`
- `openid`
- `email`
- `profile`

### Step 5: Add Test Users (Development)

Add your email and any test accounts for development.

### Step 6: Create OAuth Credentials

1. Go to `APIs & Services` → `Credentials`
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: `RVP Web Client`
5. Add Authorized redirect URIs:
   ```
   http://localhost:3000/api/google/callback
   http://localhost:4000/google/callback
   https://your-api.railway.app/google/callback
   https://retail-visibility-platform-web.vercel.app/api/google/callback
   ```
6. Click "Create"
7. **SAVE YOUR CREDENTIALS:**
   - Client ID: `xxxxx.apps.googleusercontent.com`
   - Client Secret: `xxxxx`

---

## Part 2: Environment Variables

### Backend (Railway)

Add these environment variables to your Railway project:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-api.railway.app/google/callback

# Token Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
OAUTH_ENCRYPTION_KEY=your_64_character_hex_key

# Frontend URL (for OAuth redirects)
WEB_URL=https://retail-visibility-platform-web.vercel.app

# Database (already configured)
DATABASE_URL=postgresql://...

# Supabase (already configured)
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
```

### Frontend (Vercel)

Add these environment variables to your Vercel project:

```env
# API URL
API_BASE_URL=https://your-api.railway.app
NEXT_PUBLIC_API_URL=https://your-api.railway.app

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Part 3: Database Migration

### Run Migration

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

This will create:
- `google_oauth_accounts`
- `google_oauth_tokens`
- `google_merchant_links`
- `gbp_locations`
- `gbp_insights_daily`

### Verify Tables

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'google%' OR table_name LIKE 'gbp%';
```

---

## Part 4: Feature Flag Configuration

### Enable for Pilot Tenants

1. Go to `/settings/admin/features`
2. Find `FF_GOOGLE_CONNECT_SUITE`
3. Enable for pilot tenants:
   - Strategy: `pilot`
   - Add tenant IDs to `pilotTenants` array
   - Or enable for region: `us-east-1`

### Code Configuration

Edit `apps/web/src/lib/featureFlags/index.ts`:

```typescript
FF_GOOGLE_CONNECT_SUITE: {
  flag: 'FF_GOOGLE_CONNECT_SUITE',
  strategy: 'pilot',
  percentage: 0,
  pilotTenants: ['tenant-id-1', 'tenant-id-2'], // Add pilot tenant IDs
  pilotRegions: ['us-east-1'],
},
```

---

## Part 5: Testing

### Pre-Test Checklist

- [ ] Google Cloud Console configured
- [ ] OAuth credentials created
- [ ] Environment variables set (Railway + Vercel)
- [ ] Database migration completed
- [ ] Feature flag enabled for test tenant
- [ ] Business profile complete (NAP required)

### Test Flow

1. **Complete Business Profile**
   - Go to `/settings/tenant`
   - Fill in business name, address, city, state
   - Save profile

2. **Connect Google Account**
   - See "Google Connect Suite" card
   - Click "Connect with Google"
   - Authorize scopes
   - Redirected back with success

3. **Verify Connection**
   - See connected account info
   - View merchant links count
   - View GBP locations count

4. **Test GMC Integration**
   ```bash
   # List merchant accounts
   GET /google/gmc/accounts?tenantId=xxx
   
   # Sync merchant
   POST /google/gmc/sync
   Body: { tenantId: "xxx", merchantId: "xxx" }
   
   # List products
   GET /google/gmc/products?tenantId=xxx&merchantId=xxx
   ```

5. **Test GBP Integration**
   ```bash
   # List locations
   GET /google/gbp/locations?tenantId=xxx
   
   # Sync location
   POST /google/gbp/sync
   Body: { tenantId: "xxx", locationName: "accounts/xxx/locations/xxx" }
   
   # Get insights
   GET /google/gbp/insights?locationId=xxx&days=30
   ```

---

## Part 6: Monitoring

### Key Metrics

Monitor these in your logs:

- **OAuth Success Rate:** `[Google OAuth] Account connected`
- **Token Refresh:** `[GMC/GBP] Token expired, refreshing...`
- **Sync Errors:** `[GMC/GBP] Sync error`
- **API Errors:** `[GMC/GBP] Failed to fetch`

### Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `incomplete_business_profile` | NAP not complete | Complete business profile first |
| `invalid_state` | State expired or tampered | Retry OAuth flow |
| `token_exchange_failed` | Invalid auth code | Check OAuth configuration |
| `google_account_not_found` | Not connected | Connect Google account first |
| `No valid access token` | Token expired & refresh failed | Reconnect Google account |

---

## Part 7: Rollback Procedure

If issues arise, follow this rollback:

### Immediate Rollback

1. **Disable Feature Flag**
   ```typescript
   FF_GOOGLE_CONNECT_SUITE: {
     strategy: 'off', // Disable immediately
   }
   ```

2. **Revoke Active Tokens**
   ```bash
   # For each connected tenant
   DELETE /google/disconnect?tenantId=xxx
   ```

3. **Clear Cache**
   - Restart Railway backend
   - Clear Vercel edge cache

### Full Rollback

If database rollback needed:

```sql
-- Drop tables (cascade will handle foreign keys)
DROP TABLE IF EXISTS gbp_insights_daily CASCADE;
DROP TABLE IF EXISTS gbp_locations CASCADE;
DROP TABLE IF EXISTS google_merchant_links CASCADE;
DROP TABLE IF EXISTS google_oauth_tokens CASCADE;
DROP TABLE IF EXISTS google_oauth_accounts CASCADE;

-- Remove source column from SyncJob
ALTER TABLE "SyncJob" DROP COLUMN IF EXISTS "source";
```

---

## Part 8: Security Checklist

- [ ] OAuth credentials stored in environment variables (not code)
- [ ] Encryption key is 32 bytes (64 hex characters)
- [ ] HTTPS enabled on all endpoints
- [ ] Token refresh working correctly
- [ ] Token revocation tested
- [ ] NAP validation enforced
- [ ] State parameter validated
- [ ] Error messages don't leak sensitive data

---

## Part 9: Production Readiness

### Before Going Live

- [ ] Test with real Google Merchant Center account
- [ ] Test with real Google Business Profile
- [ ] Verify token refresh after 1 hour
- [ ] Test disconnect flow
- [ ] Test reconnect flow
- [ ] Verify cascade deletes work
- [ ] Load test OAuth endpoints
- [ ] Review error logs
- [ ] Document known limitations

### Known Limitations (v1)

- **Read-only access** - No write operations to GMC/GBP
- **Single business account** - GBP fetches first account only
- **30-day insights** - Historical data limited
- **No bulk operations** - One tenant at a time
- **Manual sync** - No automatic background sync (yet)

---

## Part 10: Support & Troubleshooting

### Debug Mode

Enable detailed logging:

```typescript
// In oauth.ts, gmc.ts, gbp.ts
console.log('[DEBUG]', ...);
```

### Common Issues

**Issue:** "Failed to connect to Google"
- Check OAuth credentials
- Verify redirect URIs match exactly
- Check browser console for errors

**Issue:** "No merchant accounts found"
- Verify user has Merchant Center access
- Check scopes were granted
- Review Google API quotas

**Issue:** "Token refresh failed"
- Check refresh token is stored
- Verify encryption key hasn't changed
- Reconnect Google account

### Getting Help

1. Check Railway logs: `railway logs`
2. Check Vercel logs: Vercel dashboard
3. Review Google Cloud Console → APIs & Services → Credentials
4. Test OAuth flow in incognito mode

---

## Appendix: API Reference

### OAuth Endpoints

```typescript
// Start OAuth
GET /google/auth?tenantId={id}
Response: { authUrl: string }

// OAuth callback (handled by Google)
GET /google/callback?code={code}&state={state}
Redirects to: /settings/tenant?google_connected=true

// Check status
GET /google/status?tenantId={id}
Response: {
  connected: boolean,
  email?: string,
  displayName?: string,
  merchantLinks?: number,
  gbpLocations?: number
}

// Disconnect
DELETE /google/disconnect?tenantId={id}
Response: { success: boolean }
```

### GMC Endpoints

```typescript
// List merchants
GET /google/gmc/accounts?tenantId={id}
Response: { merchants: Array }

// Sync merchant
POST /google/gmc/sync
Body: { tenantId: string, merchantId: string }
Response: { success: boolean }

// List products
GET /google/gmc/products?tenantId={id}&merchantId={id}
Response: { products: Array }

// Get stats
GET /google/gmc/stats?tenantId={id}&merchantId={id}
Response: {
  stats: {
    total: number,
    active: number,
    pending: number,
    disapproved: number
  }
}
```

### GBP Endpoints

```typescript
// List locations
GET /google/gbp/locations?tenantId={id}
Response: { locations: Array }

// Sync location
POST /google/gbp/sync
Body: { tenantId: string, locationName: string }
Response: { success: boolean }

// Get insights
GET /google/gbp/insights?locationId={id}&days={30}
Response: {
  insights: {
    period: string,
    totals: {
      viewsSearch: number,
      viewsMaps: number,
      actionsWebsite: number,
      actionsPhone: number,
      actionsDirections: number,
      photosCount: number
    },
    daily: Array
  }
}
```

---

## Version History

- **v1.0** (2025-10-23) - Initial release with read-only GMC + GBP
- **v2.0** (TBD) - Write operations (hours, photos)
- **v3.0** (TBD) - Multi-location bulk operations

---

**Ready for pilot testing!** 🚀
