# OAuth Credentials Strategy: Dev vs Production

**Best Practice:** Use separate OAuth credentials for each environment

---

## 🎯 Why Separate Credentials?

### Security
- ✅ Compromised dev credentials don't affect production
- ✅ Can revoke dev credentials without impacting users
- ✅ Different access scopes for testing vs production

### Monitoring
- ✅ Separate quota tracking per environment
- ✅ Clear audit trails (dev vs prod API calls)
- ✅ Easier to debug issues

### Compliance
- ✅ Production data stays isolated
- ✅ Test users don't access production APIs
- ✅ Better for SOC 2 / security audits

### Flexibility
- ✅ Different redirect URIs (localhost vs production domain)
- ✅ Can test OAuth changes without affecting production
- ✅ Different rate limits per environment

---

## 📊 Recommended Setup

### Development Environment

**Google Cloud Project:** "RVP Development"

**Merchant Center OAuth:**
```bash
GOOGLE_CLIENT_ID=dev-123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-dev-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:4000/google/callback
```

**GMB OAuth:**
```bash
GOOGLE_BUSINESS_CLIENT_ID=dev-789012.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-dev-yyyyy
GOOGLE_BUSINESS_REDIRECT_URI=http://localhost:4000/google-business/callback
```

**Redirect URIs:**
- `http://localhost:4000/google/callback`
- `http://localhost:4000/google-business/callback`
- `http://localhost:3000/**` (for frontend redirects)

**OAuth Consent Screen:**
- Status: Testing
- Test users: Your dev team emails

---

### Production Environment

**Google Cloud Project:** "RVP Production" (separate project)

**Merchant Center OAuth:**
```bash
GOOGLE_CLIENT_ID=prod-123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-prod-xxxxx
GOOGLE_REDIRECT_URI=https://rvpapi-production.up.railway.app/google/callback
```

**GMB OAuth:**
```bash
GOOGLE_BUSINESS_CLIENT_ID=prod-789012.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-prod-yyyyy
GOOGLE_BUSINESS_REDIRECT_URI=https://rvpapi-production.up.railway.app/google-business/callback
```

**Redirect URIs:**
- `https://rvpapi-production.up.railway.app/google/callback`
- `https://rvpapi-production.up.railway.app/google-business/callback`
- `https://retail-visibility-platform-web.vercel.app/**`

**OAuth Consent Screen:**
- Status: In Production (or Published)
- Available to: All users with Google accounts

---

## 🔧 Setup Steps for Production

### Step 1: Create New Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click project dropdown → **New Project**
3. Name: "Retail Visibility Platform - Production"
4. Click **Create**

**Why separate project?**
- Isolates production from dev
- Separate billing (if needed)
- Clearer organization

---

### Step 2: Enable APIs (Production Project)

1. Select your new production project
2. Go to **APIs & Services** → **Library**
3. Enable:
   - ✅ Content API for Shopping (Merchant Center)
   - ✅ Google My Business API
   - ✅ My Business Business Information API

---

### Step 3: Create Production OAuth Credentials

**For Merchant Center:**

1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "RVP Production - Merchant Center"
5. Authorized redirect URIs:
   ```
   https://rvpapi-production.up.railway.app/google/callback
   ```
6. Click **Create**
7. **Copy Client ID and Client Secret** → Save securely

**For Google My Business:**

1. **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: "RVP Production - GMB"
4. Authorized redirect URIs:
   ```
   https://rvpapi-production.up.railway.app/google-business/callback
   ```
5. Click **Create**
6. **Copy Client ID and Client Secret** → Save securely

---

### Step 4: Configure OAuth Consent Screen (Production)

1. **APIs & Services** → **OAuth consent screen**
2. User Type: **External**
3. Fill in:
   - App name: "Retail Visibility Platform"
   - User support email: support@yourdomain.com
   - App logo: (upload your logo)
   - App domain: yourdomain.com
   - Authorized domains: yourdomain.com, vercel.app, railway.app
   - Developer contact: support@yourdomain.com

4. **Scopes:**
   - `https://www.googleapis.com/auth/content` (Merchant Center)
   - `https://www.googleapis.com/auth/business.manage` (GMB)

5. **Publishing Status:**
   - Start in "Testing" mode
   - Add test users for initial testing
   - Submit for verification when ready for public use

---

### Step 5: Add to Railway (Production)

```bash
# Railway Dashboard → Variables (Production)

# Merchant Center OAuth (PRODUCTION)
GOOGLE_CLIENT_ID=prod-123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-prod-xxxxx
GOOGLE_REDIRECT_URI=https://rvpapi-production.up.railway.app/google/callback

# GMB OAuth (PRODUCTION)
GOOGLE_BUSINESS_CLIENT_ID=prod-789012.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-prod-yyyyy
GOOGLE_BUSINESS_REDIRECT_URI=https://rvpapi-production.up.railway.app/google-business/callback

# Generate NEW encryption key for production
OAUTH_ENCRYPTION_KEY=<generate-new-64-char-hex>
```

**Generate new encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔒 Security Best Practices

### ✅ DO:

1. **Separate projects** for dev and prod
2. **Different credentials** for each environment
3. **Rotate secrets** regularly (every 90 days)
4. **Use HTTPS** for all production redirect URIs
5. **Restrict domains** in OAuth consent screen
6. **Monitor API usage** in Google Cloud Console
7. **Store secrets** in environment variables (never in code)
8. **Generate new encryption key** for production

### ❌ DON'T:

1. **Reuse dev credentials** in production
2. **Commit credentials** to git
3. **Share credentials** across environments
4. **Use localhost** redirect URIs in production
5. **Skip OAuth consent screen** configuration
6. **Use same encryption key** across environments
7. **Hardcode credentials** in source code

---

## 📋 Credentials Checklist

### Development
- [ ] Google Cloud project created ("RVP Development")
- [ ] Merchant Center OAuth credentials created
- [ ] GMB OAuth credentials created
- [ ] Redirect URIs set to localhost
- [ ] OAuth consent screen configured (Testing mode)
- [ ] Test users added
- [ ] Credentials added to local `.env.local`
- [ ] Encryption key generated

### Production
- [ ] **NEW** Google Cloud project created ("RVP Production")
- [ ] Merchant Center OAuth credentials created (separate)
- [ ] GMB OAuth credentials created (separate)
- [ ] Redirect URIs set to production domains
- [ ] OAuth consent screen configured (Production mode)
- [ ] App domain verified
- [ ] Credentials added to Railway
- [ ] **NEW** encryption key generated for production
- [ ] Test OAuth flow in production
- [ ] Monitor API quotas

---

## 🔄 Migration Impact

When migrating staging → main:

### What Changes:
- ✅ New production OAuth credentials
- ✅ New encryption key
- ✅ Production redirect URIs
- ✅ Separate Google Cloud project

### What Stays the Same:
- ✅ Code (no changes needed)
- ✅ OAuth flow logic
- ✅ Database schema
- ✅ API endpoints

### Environment Variables to Update:
```bash
# OLD (Dev/Staging)
GOOGLE_CLIENT_ID=dev-xxxxx
GOOGLE_CLIENT_SECRET=GOCSPX-dev-xxxxx
GOOGLE_BUSINESS_CLIENT_ID=dev-yyyyy
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-dev-yyyyy
OAUTH_ENCRYPTION_KEY=dev-key-xxxxx

# NEW (Production)
GOOGLE_CLIENT_ID=prod-xxxxx
GOOGLE_CLIENT_SECRET=GOCSPX-prod-xxxxx
GOOGLE_BUSINESS_CLIENT_ID=prod-yyyyy
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-prod-yyyyy
OAUTH_ENCRYPTION_KEY=prod-key-xxxxx  # NEW KEY!
```

---

## 🧪 Testing Production Credentials

### Before Going Live:

1. **Test Merchant Center OAuth:**
   ```bash
   # Initiate OAuth
   curl "https://rvpapi-production.up.railway.app/google/auth?tenantId=test"
   
   # Complete flow in browser
   # Verify token saved in database
   ```

2. **Test GMB OAuth:**
   ```bash
   # Initiate OAuth
   curl "https://rvpapi-production.up.railway.app/google/business?tenantId=test"
   
   # Complete flow in browser
   # Verify token saved in database
   ```

3. **Verify Token Encryption:**
   ```sql
   -- Check tokens are encrypted
   SELECT 
     id, 
     LENGTH(access_token_encrypted) as token_length,
     LENGTH(refresh_token_encrypted) as refresh_length
   FROM "GoogleOAuthToken"
   LIMIT 1;
   
   -- Should show encrypted values (not plaintext)
   ```

4. **Test API Calls:**
   - Fetch Merchant Center products
   - Fetch GMB locations
   - Update business hours
   - Verify no errors

---

## 📊 Comparison Table

| Aspect | Development | Production |
|--------|-------------|------------|
| **Google Cloud Project** | RVP Development | RVP Production (NEW) |
| **Merchant Client ID** | dev-xxxxx | prod-xxxxx (NEW) |
| **GMB Client ID** | dev-yyyyy | prod-yyyyy (NEW) |
| **Redirect URIs** | localhost:4000 | railway.app (HTTPS) |
| **OAuth Consent** | Testing mode | Production mode |
| **Test Users** | Dev team only | All users |
| **Encryption Key** | Dev key | Prod key (NEW) |
| **API Quotas** | Shared with dev | Dedicated |
| **Monitoring** | Dev metrics | Prod metrics |

---

## 🆘 Troubleshooting

### Issue: "Redirect URI mismatch" in production

**Cause:** Using dev credentials with production URIs  
**Fix:** Create new production credentials with correct URIs

---

### Issue: "Invalid client" after migration

**Cause:** Old dev credentials still in Railway  
**Fix:** Update Railway variables with new production credentials

---

### Issue: "Token decryption failed"

**Cause:** Using different encryption key than when token was created  
**Fix:** 
1. Generate new encryption key for production
2. Users will need to re-authenticate (tokens re-encrypted)

---

### Issue: OAuth consent screen shows "Unverified app"

**Cause:** Production app not verified by Google  
**Fix:**
1. Add test users for initial testing
2. Submit app for verification (takes 1-2 weeks)
3. Or keep in testing mode with limited users

---

## 🎯 Summary

**For Production Migration:**

1. ✅ Create **NEW** Google Cloud project
2. ✅ Create **NEW** OAuth credentials (Merchant + GMB)
3. ✅ Generate **NEW** encryption key
4. ✅ Configure production redirect URIs
5. ✅ Add to Railway (replace dev credentials)
6. ✅ Test OAuth flows
7. ✅ Monitor API usage

**DO NOT:**
- ❌ Reuse dev credentials
- ❌ Use same encryption key
- ❌ Skip testing

---

**Created:** November 7, 2025  
**Last Updated:** November 7, 2025  
**Status:** Required for staging → main migration
