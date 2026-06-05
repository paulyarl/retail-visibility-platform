# Production Credentials Setup Checklist

**Purpose:** Create separate OAuth credentials for production environment  
**Time Required:** 30 minutes

---

## ✅ Pre-Migration Checklist

### Google Cloud Console Setup

- [ ] **Create new Google Cloud project**
  - Name: "Retail Visibility Platform - Production"
  - Separate from dev project
  - Note project ID: ________________

- [ ] **Enable required APIs**
  - [ ] Content API for Shopping (Merchant Center)
  - [ ] Google My Business API
  - [ ] My Business Business Information API

---

### Merchant Center OAuth Credentials

- [ ] **Create OAuth client ID**
  - Application type: Web application
  - Name: "RVP Production - Merchant Center"
  
- [ ] **Set redirect URI**
  - [ ] `https://rvpapi-production.up.railway.app/google/callback`
  
- [ ] **Copy credentials**
  - Client ID: ________________
  - Client Secret: ________________
  - ⚠️ Store securely (password manager)

---

### Google My Business OAuth Credentials

- [ ] **Create OAuth client ID**
  - Application type: Web application
  - Name: "RVP Production - GMB"
  
- [ ] **Set redirect URI**
  - [ ] `https://rvpapi-production.up.railway.app/google-business/callback`
  
- [ ] **Copy credentials**
  - Client ID: ________________
  - Client Secret: ________________
  - ⚠️ Store securely (password manager)

---

### OAuth Consent Screen

- [ ] **Configure consent screen**
  - User type: External
  - App name: "Retail Visibility Platform"
  - User support email: ________________
  - Developer contact: ________________
  
- [ ] **Add scopes**
  - [ ] `https://www.googleapis.com/auth/content`
  - [ ] `https://www.googleapis.com/auth/business.manage`
  
- [ ] **Publishing status**
  - [ ] Start in "Testing" mode
  - [ ] Add test users: ________________
  - [ ] Plan verification submission (if needed)

---

### Generate Production Secrets

- [ ] **Generate OAuth encryption key**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  - Encryption key: ________________
  - ⚠️ Store securely (password manager)
  - ⚠️ Do NOT reuse dev key

---

## 🚂 Railway Configuration

- [ ] **Add Merchant Center OAuth variables**
  ```
  GOOGLE_CLIENT_ID=<production-client-id>
  GOOGLE_CLIENT_SECRET=<production-client-secret>
  GOOGLE_REDIRECT_URI=https://rvpapi-production.up.railway.app/google/callback
  ```

- [ ] **Add GMB OAuth variables**
  ```
  GOOGLE_BUSINESS_CLIENT_ID=<production-gmb-client-id>
  GOOGLE_BUSINESS_CLIENT_SECRET=<production-gmb-client-secret>
  GOOGLE_BUSINESS_REDIRECT_URI=https://rvpapi-production.up.railway.app/google-business/callback
  ```

- [ ] **Add encryption key**
  ```
  OAUTH_ENCRYPTION_KEY=<production-encryption-key>
  ```

- [ ] **Add other new variables**
  ```
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-maps-key>
  FF_GLOBAL_TENANT_META=false
  FF_AUDIT_LOG=false
  ```

- [ ] **Verify all variables set**
  ```bash
  railway variables
  ```

---

## ☁️ Vercel Configuration

- [ ] **Add Google Maps API key**
  ```
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-maps-key>
  ```

- [ ] **Select environments**
  - [ ] Production
  - [ ] Preview
  - [ ] Development

- [ ] **Verify variables set**
  ```bash
  vercel env ls
  ```

---

## 🧪 Testing

### Test Merchant Center OAuth

- [ ] **Initiate OAuth flow**
  ```bash
  curl "https://rvpapi-production.up.railway.app/google/auth?tenantId=test"
  ```

- [ ] **Complete OAuth in browser**
  - [ ] Redirects to Google
  - [ ] Shows correct app name
  - [ ] Requests correct scopes
  - [ ] Redirects back successfully

- [ ] **Verify token saved**
  ```sql
  SELECT * FROM "GoogleOAuthAccount" 
  WHERE tenant_id = 'test' 
  ORDER BY created_at DESC LIMIT 1;
  ```

---

### Test GMB OAuth

- [ ] **Initiate OAuth flow**
  ```bash
  curl "https://rvpapi-production.up.railway.app/google/business?tenantId=test"
  ```

- [ ] **Complete OAuth in browser**
  - [ ] Redirects to Google
  - [ ] Shows correct app name
  - [ ] Requests GMB scope
  - [ ] Redirects back successfully

- [ ] **Verify token saved**
  ```sql
  SELECT * FROM "GoogleOAuthAccount" 
  WHERE tenant_id = 'test' 
  ORDER BY created_at DESC LIMIT 1;
  ```

---

### Verify Token Encryption

- [ ] **Check tokens are encrypted**
  ```sql
  SELECT 
    id,
    LENGTH(access_token_encrypted) as token_length,
    LENGTH(refresh_token_encrypted) as refresh_length
  FROM "GoogleOAuthToken"
  LIMIT 1;
  ```
  - [ ] Token length > 100 (encrypted, not plaintext)
  - [ ] Refresh token length > 100

---

## 🔒 Security Verification

- [ ] **Credentials stored securely**
  - [ ] Not in git
  - [ ] Not in Slack/email
  - [ ] In password manager
  - [ ] Railway/Vercel only

- [ ] **Separate from dev**
  - [ ] Different Google Cloud project
  - [ ] Different client IDs
  - [ ] Different encryption key

- [ ] **HTTPS only**
  - [ ] All redirect URIs use HTTPS
  - [ ] No localhost in production

- [ ] **Access restricted**
  - [ ] OAuth consent screen configured
  - [ ] Test users added (if testing mode)
  - [ ] Scopes limited to required only

---

## 📝 Documentation

- [ ] **Record credentials location**
  - Password manager: ________________
  - Google Cloud project: ________________
  - Railway project: ________________

- [ ] **Document for team**
  - [ ] Where to find credentials
  - [ ] How to rotate if compromised
  - [ ] Who has access

- [ ] **Update runbooks**
  - [ ] OAuth troubleshooting
  - [ ] Credential rotation procedure
  - [ ] Emergency contacts

---

## ⚠️ Important Reminders

### DO:
- ✅ Create separate credentials for production
- ✅ Generate new encryption key for production
- ✅ Use HTTPS redirect URIs
- ✅ Test OAuth flows before going live
- ✅ Store credentials securely

### DON'T:
- ❌ Reuse dev credentials in production
- ❌ Reuse dev encryption key
- ❌ Commit credentials to git
- ❌ Share credentials in Slack/email
- ❌ Use localhost redirect URIs

---

## 🎯 Success Criteria

✅ New Google Cloud project created  
✅ Merchant Center OAuth credentials created  
✅ GMB OAuth credentials created  
✅ OAuth consent screen configured  
✅ All credentials added to Railway  
✅ Google Maps key added to Vercel  
✅ Merchant Center OAuth flow tested  
✅ GMB OAuth flow tested  
✅ Tokens encrypted correctly  
✅ No dev credentials in production  

---

## 🔗 Related Documentation

- `OAUTH_CREDENTIALS_STRATEGY.md` - Why separate credentials
- `GMB_OAUTH_SETUP.md` - GMB OAuth setup guide
- `STAGING_TO_MAIN_MIGRATION_PLAN.md` - Full migration plan
- `ENVIRONMENT_VARIABLES.md` - All environment variables

---

**Estimated Time:** 30 minutes  
**Difficulty:** Medium  
**Required Access:** Google Cloud Console, Railway, Vercel  
**Status:** Required before production migration
