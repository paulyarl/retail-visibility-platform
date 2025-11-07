# Google My Business (GMB) OAuth Setup Guide

**Purpose:** Separate OAuth credentials for Google Business Profile integration  
**Different from:** Google Merchant Center OAuth

---

## 🎯 Why Separate OAuth Credentials?

Your platform now has **TWO separate Google integrations:**

1. **Google Merchant Center** - Product feed management
   - Uses: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
   - Scope: `https://www.googleapis.com/auth/content`
   - Callback: `/google/callback`

2. **Google My Business (GMB/GBP)** - Business profile management
   - Uses: `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET`, `GOOGLE_BUSINESS_REDIRECT_URI`
   - Scope: `https://www.googleapis.com/auth/business.manage`
   - Callback: `/google-business/callback`

---

## 🔧 Setup Steps

### Step 1: Create Google Cloud Project (if not exists)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Name: "Retail Visibility Platform - GMB"

---

### Step 2: Enable Google My Business API

1. Go to **APIs & Services** → **Library**
2. Search for "Google My Business API"
3. Click **Enable**
4. Also enable "My Business Business Information API"

---

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "RVP GMB OAuth"

**Authorized redirect URIs:**
```
https://rvpapi-production.up.railway.app/google-business/callback
http://localhost:4000/google-business/callback (for dev)
```

5. Click **Create**
6. Copy **Client ID** and **Client Secret**

---

### Step 4: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. User Type: **External** (or Internal if Google Workspace)
3. Fill in:
   - App name: "Retail Visibility Platform"
   - User support email: your-email@domain.com
   - Developer contact: your-email@domain.com

4. **Scopes** → Add or remove scopes:
   - Search: "Google My Business"
   - Select: `https://www.googleapis.com/auth/business.manage`
   - Save

5. **Test users** (if in testing mode):
   - Add your email and any test users

---

### Step 5: Add to Railway

```bash
# Railway Dashboard → Variables
GOOGLE_BUSINESS_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_BUSINESS_REDIRECT_URI=https://rvpapi-production.up.railway.app/google-business/callback
```

---

### Step 6: Verify Setup

**Test endpoint:**
```bash
# Start OAuth flow
curl "https://rvpapi-production.up.railway.app/google/business?tenantId=test-tenant-id"

# Should redirect to Google OAuth consent screen
```

**In browser:**
1. Go to Settings → Integrations
2. Click "Connect Google Business Profile"
3. Complete OAuth flow
4. Verify connection saved

---

## 📊 Environment Variables Summary

### Production (Railway)

```bash
# Merchant Center OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://rvpapi-production.up.railway.app/google/callback

# Google My Business OAuth (NEW)
GOOGLE_BUSINESS_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_BUSINESS_REDIRECT_URI=https://rvpapi-production.up.railway.app/google-business/callback

# Shared encryption key
OAUTH_ENCRYPTION_KEY=64_character_hex_string
```

### Development (Local)

```bash
# Merchant Center OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:4000/google/callback

# Google My Business OAuth
GOOGLE_BUSINESS_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_BUSINESS_REDIRECT_URI=http://localhost:4000/google-business/callback

# Shared encryption key
OAUTH_ENCRYPTION_KEY=64_character_hex_string
```

---

## 🔍 How to Tell Them Apart

| Feature | Merchant Center | Google My Business |
|---------|----------------|-------------------|
| **Purpose** | Product feed sync | Business profile sync |
| **API** | Content API for Shopping | My Business API |
| **Scope** | `auth/content` | `auth/business.manage` |
| **Env Prefix** | `GOOGLE_` | `GOOGLE_BUSINESS_` |
| **Callback** | `/google/callback` | `/google-business/callback` |
| **Routes** | `lib/google/oauth.ts` | `routes/google-business-oauth.ts` |

---

## 🧪 Testing

### Test GMB OAuth Flow

```bash
# 1. Start OAuth
GET /google/business?tenantId=<tenant-id>

# 2. User completes OAuth on Google
# 3. Callback receives code
GET /google-business/callback?code=xxx&state={"tenantId":"xxx"}

# 4. Verify in database
SELECT * FROM "GoogleOAuthAccount" WHERE tenant_id = '<tenant-id>';
```

### Test GMB API Access

```bash
# Test endpoint (if configured)
GET /test-gbp

# Should return GMB configuration status
```

---

## 🚨 Common Issues

### Issue: "Redirect URI mismatch"

**Cause:** Callback URL doesn't match Google Cloud Console  
**Fix:** Ensure exact match:
- Railway: `https://rvpapi-production.up.railway.app/google-business/callback`
- Local: `http://localhost:4000/google-business/callback`

---

### Issue: "Access denied"

**Cause:** Scope not approved or app not verified  
**Fix:**
1. Check OAuth consent screen scopes
2. Add test users if in testing mode
3. Submit for verification if going public

---

### Issue: "Invalid client"

**Cause:** Wrong client ID or secret  
**Fix:**
1. Verify credentials in Google Cloud Console
2. Check Railway environment variables
3. Ensure no extra spaces in values

---

## 📋 Migration Checklist

For staging → main migration:

- [ ] Create GMB OAuth credentials in Google Cloud
- [ ] Enable My Business API
- [ ] Configure OAuth consent screen
- [ ] Add `GOOGLE_BUSINESS_CLIENT_ID` to Railway
- [ ] Add `GOOGLE_BUSINESS_CLIENT_SECRET` to Railway
- [ ] Add `GOOGLE_BUSINESS_REDIRECT_URI` to Railway
- [ ] Test OAuth flow in production
- [ ] Verify tokens are encrypted
- [ ] Test GMB API calls

---

## 🔗 Related Documentation

- `ENVIRONMENT_VARIABLES.md` - All environment variables
- `STAGING_TO_MAIN_MIGRATION_PLAN.md` - Migration guide
- [Google My Business API Docs](https://developers.google.com/my-business)
- [OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)

---

**Created:** November 7, 2025  
**Last Updated:** November 7, 2025  
**Status:** Required for staging → main migration
