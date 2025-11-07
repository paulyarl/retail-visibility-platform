# Environment Variables Audit

**Last Updated:** October 31, 2025  
**Purpose:** Complete reference for all environment variables used across the platform

---

## 📋 Quick Reference

| Variable | Server | Required | Purpose |
|----------|--------|----------|---------|
| `DATABASE_URL` | Railway (API) | ✅ Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Railway (API) + Vercel (Web) | ✅ Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway (API) | ✅ Yes | Supabase admin key (server-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (Web) | ✅ Yes | Supabase URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (Web) | ✅ Yes | Supabase anon key (client-side) |
| `NEXT_PUBLIC_API_BASE_URL` | Vercel (Web) | ✅ Yes | API server URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Vercel (Web) | ⚠️ **NEW!** | Google Maps for storefront |
| `GOOGLE_CLIENT_ID` | Railway (API) | ✅ Yes | Google Merchant Center OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Railway (API) | ✅ Yes | Google Merchant Center OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Railway (API) | ✅ Yes | Merchant Center OAuth callback URL |
| `GOOGLE_BUSINESS_CLIENT_ID` | Railway (API) | ✅ Yes | Google My Business OAuth client ID |
| `GOOGLE_BUSINESS_CLIENT_SECRET` | Railway (API) | ✅ Yes | Google My Business OAuth client secret |
| `GOOGLE_BUSINESS_REDIRECT_URI` | Railway (API) | ✅ Yes | GMB OAuth callback URL |
| `OAUTH_ENCRYPTION_KEY` | Railway (API) | ✅ Yes | Token encryption key (32-byte hex) |
| `WEB_URL` | Railway (API) | ✅ Yes | Frontend URL for redirects |
| `NODE_ENV` | Both | ⚙️ Auto | Environment (production/development) |
| `PORT` or `API_PORT` | Railway (API) | ⚙️ Auto | API server port (default: 4000) |
| `UPLOAD_DIR` | Railway (API) | ❌ No | File upload directory (default: ./uploads) |
| `BUCKET_NAME` | Railway (API) | ❌ No | Photos bucket name (default: photos) |
| `PUBLIC_FLAG` | Railway (API) | ❌ No | Photos bucket public (default: true) |
| `TENANT_BUCKET_NAME` | Railway (API) | ❌ No | Tenants bucket name (default: tenants) |
| `TENANT_PUBLIC_FLAG` | Railway (API) | ❌ No | Tenants bucket public (default: true) |
| `BRAND_BUCKET_NAME` | Railway (API) | ❌ No | Brands bucket name (default: brands) |
| `BRAND_PUBLIC_FLAG` | Railway (API) | ❌ No | Brands bucket public (default: true) |
| `FF_GLOBAL_TENANT_META` | Railway (API) | ❌ No | Feature flag: Global tenant metadata |
| `FF_AUDIT_LOG` | Railway (API) | ❌ No | Feature flag: Audit logging |
| `FF_I18N_SCAFFOLD` | Railway (API) | ❌ No | Feature flag: i18n scaffolding |
| `FF_CURRENCY_RATE_STUB` | Railway (API) | ❌ No | Feature flag: Currency rate stub |

---

## 🚂 Railway (Backend API) - apps/api

### **Required Variables**

#### Database
```bash
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```
**Used in:**
- `apps/api/src/prisma.ts` - Prisma client initialization
- `apps/api/src/index.ts` - Database connection logging

**Purpose:** PostgreSQL connection string for Prisma ORM

---

#### Supabase (Server-side)
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Used in:**
- `apps/api/src/index.ts` - Photo uploads, tenant logo uploads
- `apps/api/src/photos.ts` - Photo management
- `apps/api/scripts/migrate-photos.ts` - Photo migration script
- `apps/api/scripts/storage-sync.js` - Storage sync script

**Purpose:** Server-side Supabase operations (file uploads, admin operations)

---

#### Google OAuth (Two Separate Integrations)

**Google Merchant Center OAuth:**
```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://your-api.railway.app/google/callback
```
**Used in:**
- `apps/api/src/lib/google/oauth.ts` - Merchant Center OAuth flow
- `apps/api/src/index.ts` - OAuth routes (/google/auth, /google/callback)

**Purpose:** Google OAuth 2.0 for Merchant Center integration

---

**Google My Business (GMB/GBP) OAuth:**
```bash
GOOGLE_BUSINESS_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_BUSINESS_REDIRECT_URI=https://your-api.railway.app/google-business/callback
```
**Used in:**
- `apps/api/src/routes/google-business-oauth.ts` - GMB OAuth flow
- `apps/api/src/routes/test-gbp.ts` - GMB testing endpoints

**Purpose:** Google OAuth 2.0 for Google Business Profile (GMB) integration

**Scopes:**
- Merchant Center: `https://www.googleapis.com/auth/content`
- Business Profile: `https://www.googleapis.com/auth/business.manage`

---

**OAuth Encryption Key (Shared):**
```bash
OAUTH_ENCRYPTION_KEY=64_character_hex_string_for_token_encryption
```
**Used in:**
- Both OAuth flows for encrypting/decrypting tokens

**How to generate OAUTH_ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

#### Frontend URL
```bash
WEB_URL=https://your-app.vercel.app
```
**Used in:**
- `apps/api/src/index.ts` - OAuth redirects after success/error

**Purpose:** Redirect users back to frontend after OAuth flow

---

### **Optional Variables**

#### Server Configuration
```bash
PORT=4000                    # API server port (default: 4000)
API_PORT=4000               # Alternative to PORT
NODE_ENV=production         # Environment mode (auto-set by Railway)
UPLOAD_DIR=/app/uploads     # File upload directory (default: ./uploads)
```

**Used in:**
- `apps/api/src/index.ts` - Server startup, file uploads, middleware

---

#### Supabase Storage Buckets
```bash
# PHOTOS BUCKET - Product/inventory images
BUCKET_NAME=photos               # Supabase bucket name (default: photos)
PUBLIC_FLAG=true                 # Public access (default: true)

# TENANTS BUCKET - Tenant branding assets (tenant logos, etc.)
TENANT_BUCKET_NAME=tenants       # Supabase bucket name (default: tenants)
TENANT_PUBLIC_FLAG=true          # Public access (default: true)

# BRANDS BUCKET - Platform branding assets (platform logo, favicon, etc.)
BRAND_BUCKET_NAME=brands         # Supabase bucket name (default: brands)
BRAND_PUBLIC_FLAG=true           # Public access (default: true)
```

**Used in:**
- `apps/api/src/storage-config.ts` - Centralized bucket configuration
- `apps/api/src/index.ts` - Tenant logo uploads, product photo uploads
- `apps/api/src/photos.ts` - Product photo management
- `apps/api/src/routes/platform-settings.ts` - Platform logo/favicon uploads

**Purpose:** Configure separate Supabase storage buckets for different asset types

**Bucket Alignment:**
- **PHOTOS** = Product/inventory images uploaded by tenants
- **TENANTS** = Tenant branding (tenant logos, business profile images)
- **BRANDS** = Platform branding (platform logo, favicon, white-label assets)

**Note:** Each bucket is a separate Supabase storage bucket, not a folder. Bucket names default to sensible values if not specified. File organization within buckets is handled by the application code (e.g., `tenantId/sku/filename.jpg`).

---

#### Feature Flags
```bash
FF_GLOBAL_TENANT_META=false      # Global tenant metadata feature
FF_AUDIT_LOG=false               # Audit logging feature
FF_I18N_SCAFFOLD=false           # Internationalization scaffolding
FF_CURRENCY_RATE_STUB=false      # Currency rate stub for testing
```

**Used in:**
- `apps/api/src/config.ts` - Feature flag configuration

**Purpose:** Enable/disable experimental features without code changes

---

## ☁️ Vercel (Frontend Web) - apps/web

### **Required Variables**

#### API Connection
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
```
**Used in:**
- `apps/web/src/lib/api.ts` - API client base URL
- `apps/web/src/lib/api-proxy.ts` - API proxy configuration
- `apps/web/src/app/tenant/[id]/page.tsx` - Storefront data fetching
- `apps/web/src/lib/map-utils.ts` - Map location fetching
- All API route handlers in `apps/web/src/app/api/`

**Purpose:** Connect frontend to backend API

---

#### Supabase (Client-side)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Used in:**
- `apps/web/src/lib/supabase/client.ts` - Browser Supabase client
- `apps/web/src/lib/supabase/server.ts` - Server-side Supabase client
- `apps/web/src/contexts/AuthContext.tsx` - Authentication context

**Purpose:** Client-side Supabase operations (auth, file access)

**Note:** Use `NEXT_PUBLIC_` prefix for client-side access

---

#### Google Maps (NEW! ⚠️)
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```
**Used in:**
- `apps/web/src/components/tenant/MapCard.tsx` - Embedded maps on storefront

**Purpose:** Display Google Maps on public storefront pages

**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Maps Embed API" and "Maps JavaScript API"
3. Create API key
4. Restrict to your domain (*.vercel.app)
5. Add to Vercel environment variables

**⚠️ CRITICAL:** Without this key, maps will show "For development purposes only" watermark

---

### **Optional Variables**

#### Next.js Configuration
```bash
NODE_ENV=production         # Auto-set by Vercel
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app  # Optional: App base URL
```

---

## 🧪 Testing Environment Variables

**Used in E2E tests:**
```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
BASE_URL=http://localhost:3000
API_URL=http://localhost:4000
```

**Files:**
- `apps/web/tests/e2e/*.spec.ts` - All Playwright tests

**Purpose:** Automated testing configuration

---

## 📝 Environment Variable Files

### Development (.env.local)
```bash
# apps/api/.env.local
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/google/callback
OAUTH_ENCRYPTION_KEY=...
WEB_URL=http://localhost:3000
NODE_ENV=development
PORT=4000

# apps/web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

### Production (Railway + Vercel)
**Railway (API):**
- Set in Railway dashboard → Variables tab
- All non-NEXT_PUBLIC variables

**Vercel (Web):**
- Set in Vercel dashboard → Settings → Environment Variables
- All NEXT_PUBLIC variables + NEXT_PUBLIC_API_BASE_URL

---

## 🔒 Security Best Practices

### ✅ DO:
- Use `NEXT_PUBLIC_` prefix ONLY for client-side variables
- Keep `SERVICE_ROLE_KEY` and `CLIENT_SECRET` on server-side only
- Use strong encryption keys (32+ bytes, random)
- Restrict Google Maps API key to your domain
- Use different values for dev/staging/production

### ❌ DON'T:
- Commit `.env.local` files to git (already in .gitignore)
- Share `SERVICE_ROLE_KEY` or `CLIENT_SECRET` publicly
- Use `NEXT_PUBLIC_` for sensitive keys
- Hardcode API keys in source code
- Use same OAuth credentials across environments

---

## 🚀 Deployment Checklist

### Railway (API) Setup:
1. ✅ Add `DATABASE_URL` (auto-provided by Railway PostgreSQL)
2. ✅ Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. ✅ Add Google OAuth credentials (4 variables)
4. ✅ Add `WEB_URL` pointing to Vercel deployment
5. ✅ Add `OAUTH_ENCRYPTION_KEY` (generate new for production!)
6. ⚙️ `NODE_ENV` and `PORT` auto-set by Railway

### Vercel (Web) Setup:
1. ✅ Add `NEXT_PUBLIC_API_BASE_URL` pointing to Railway
2. ✅ Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. ⚠️ **ADD `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** (NEW!)
4. ⚙️ `NODE_ENV` auto-set by Vercel

---

## 🔍 How to Find Missing Variables

### Check Railway Logs:
```bash
railway logs
```
Look for errors like:
- `DATABASE_URL is not defined`
- `GOOGLE_CLIENT_ID is missing`
- `SUPABASE_URL is required`

### Check Vercel Logs:
```bash
vercel logs
```
Look for errors like:
- `NEXT_PUBLIC_API_BASE_URL is not defined`
- `Failed to fetch from API`

### Check Browser Console:
Open DevTools → Console, look for:
- `API_BASE_URL is not set`
- `Supabase client initialization failed`
- `Google Maps API key missing`

---

## 📊 Variable Usage by Feature

### Storefront (NEW!)
**Required:**
- ✅ `NEXT_PUBLIC_API_BASE_URL` - Fetch tenant and products
- ✅ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Display store location
- ✅ `DATABASE_URL` - Query products from API

**Files:**
- `apps/web/src/app/tenant/[id]/page.tsx`
- `apps/web/src/components/tenant/MapCard.tsx`
- `apps/web/src/lib/map-utils.ts`

### Google OAuth
**Required:**
- ✅ `GOOGLE_CLIENT_ID`
- ✅ `GOOGLE_CLIENT_SECRET`
- ✅ `GOOGLE_REDIRECT_URI`
- ✅ `OAUTH_ENCRYPTION_KEY`
- ✅ `WEB_URL`

**Files:**
- `apps/api/src/lib/google/oauth.ts`
- `apps/api/src/index.ts` (OAuth routes)

### File Uploads
**Required:**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

**Optional:**
- `TENANT_BUCKET_NAME` (default: photos)
- `UPLOAD_DIR` (default: ./uploads)

**Files:**
- `apps/api/src/photos.ts`
- `apps/api/src/index.ts` (upload routes)

### Authentication
**Required:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Files:**
- `apps/web/src/lib/supabase/client.ts`
- `apps/web/src/contexts/AuthContext.tsx`

---

## 🆘 Troubleshooting

### "API connection failed"
**Check:**
1. `NEXT_PUBLIC_API_BASE_URL` is set in Vercel
2. Railway API is running (check Railway dashboard)
3. No trailing slash in API_BASE_URL

### "Maps not loading"
**Check:**
1. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in Vercel
2. API key is enabled for "Maps Embed API"
3. API key is not restricted to wrong domain

### "OAuth redirect failed"
**Check:**
1. `GOOGLE_REDIRECT_URI` matches actual callback URL
2. `WEB_URL` is correct in Railway
3. OAuth consent screen is configured in Google Cloud

### "Database connection error"
**Check:**
1. `DATABASE_URL` is set in Railway
2. PostgreSQL service is running
3. Connection string includes `?sslmode=require`

### "Supabase error"
**Check:**
1. All Supabase variables are set (both Railway and Vercel)
2. `SERVICE_ROLE_KEY` is only on Railway (not Vercel)
3. `ANON_KEY` is only on Vercel (not Railway)

---

## 📞 Quick Commands

### Generate OAuth Encryption Key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test API Connection:
```bash
curl https://your-api.railway.app/health
```

### Test Frontend Connection:
```bash
curl https://your-app.vercel.app/api/health
```

### Check Railway Variables:
```bash
railway variables
```

### Check Vercel Variables:
```bash
vercel env ls
```

---

## 🎯 Summary

**Total Variables:** 20  
**Railway (API):** 15 variables (11 required, 4 optional)  
**Vercel (Web):** 5 variables (4 required, 1 optional)  

**New Since Last Deploy:**
- ⚠️ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - **MUST ADD TO VERCEL!**

**Most Common Issues:**
1. Forgot to add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to Vercel
2. Wrong `GOOGLE_REDIRECT_URI` (must match actual callback URL)
3. Using `SERVICE_ROLE_KEY` on client-side (security risk!)
4. Missing `OAUTH_ENCRYPTION_KEY` (tokens won't encrypt)

---

*Last updated: October 31, 2025*  
*Next review: After adding barcode scanner feature*
