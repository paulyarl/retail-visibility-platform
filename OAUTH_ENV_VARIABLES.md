# OAuth Environment Variables

## Required Environment Variables for PayPal & Square OAuth

Add these environment variables to your Doppler configuration for both staging and production environments.

---

## Token Encryption (Required for Both)

```bash
# Already set in Doppler ✅
TOKEN_ENCRYPTION_KEY=<64-character-hex-string>
```

**Purpose:** Encrypts OAuth access and refresh tokens at rest using AES-256-GCM  
**Format:** 64-character hexadecimal string (32 bytes)  
**Generate:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## PayPal OAuth Configuration

### Sandbox (Development/Staging)

```bash
PAYPAL_CLIENT_ID=<your-paypal-sandbox-client-id>
PAYPAL_CLIENT_SECRET=<your-paypal-sandbox-client-secret>
PAYPAL_OAUTH_REDIRECT_URI=https://aps.visibleshelf.store/api/oauth/paypal/callback
PAYPAL_ENVIRONMENT=sandbox
```

### Production

```bash
PAYPAL_CLIENT_ID=<your-paypal-production-client-id>
PAYPAL_CLIENT_SECRET=<your-paypal-production-client-secret>
PAYPAL_OAUTH_REDIRECT_URI=https://api.visibleshelf.com/api/oauth/paypal/callback
PAYPAL_ENVIRONMENT=production
```

### How to Get PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Navigate to **Apps & Credentials**
3. Create a new app or use existing app
4. Copy **Client ID** and **Secret**
5. Add redirect URI in app settings:
   - Sandbox: `https://aps.visibleshelf.store/api/oauth/paypal/callback`
   - Production: `https://api.visibleshelf.com/api/oauth/paypal/callback`
6. Required scopes:
   - `openid`
   - `profile`
   - `email`
   - `https://uri.paypal.com/services/payments/realtimepayment`

---

## Square OAuth Configuration

### Sandbox (Development/Staging)

```bash
SQUARE_APPLICATION_ID=<your-square-sandbox-application-id>
SQUARE_APPLICATION_SECRET=<your-square-sandbox-application-secret>
SQUARE_OAUTH_REDIRECT_URI=https://aps.visibleshelf.store/api/oauth/square/callback
SQUARE_ENVIRONMENT=sandbox
```

### Production

```bash
SQUARE_APPLICATION_ID=<your-square-production-application-id>
SQUARE_APPLICATION_SECRET=<your-square-production-application-secret>
SQUARE_OAUTH_REDIRECT_URI=https://api.visibleshelf.com/api/oauth/square/callback
SQUARE_ENVIRONMENT=production
```

### How to Get Square Credentials

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Create a new application or use existing
3. Navigate to **OAuth** tab
4. Copy **Application ID** and **Application Secret**
5. Add redirect URI:
   - Sandbox: `https://aps.visibleshelf.store/api/oauth/square/callback`
   - Production: `https://api.visibleshelf.com/api/oauth/square/callback`
6. Required permissions:
   - `PAYMENTS_READ`
   - `PAYMENTS_WRITE`
   - `MERCHANT_PROFILE_READ`

---

## API Endpoints Created

### PayPal OAuth Endpoints

- `GET /api/oauth/paypal/authorize?tenantId=xxx` - Initiate OAuth flow
- `GET /api/oauth/paypal/callback` - OAuth callback (redirect from PayPal)
- `GET /api/oauth/paypal/status?tenantId=xxx` - Check connection status
- `DELETE /api/oauth/paypal/disconnect` - Disconnect OAuth
- `POST /api/oauth/paypal/refresh` - Manually refresh token (testing)

### Square OAuth Endpoints

- `GET /api/oauth/square/authorize?tenantId=xxx` - Initiate OAuth flow
- `GET /api/oauth/square/callback` - OAuth callback (redirect from Square)
- `GET /api/oauth/square/status?tenantId=xxx` - Check connection status
- `DELETE /api/oauth/square/disconnect` - Disconnect OAuth (with revocation)
- `POST /api/oauth/square/refresh` - Manually refresh token (testing)

---

## Security Features

✅ **Token Encryption:** All tokens encrypted at rest with AES-256-GCM  
✅ **CSRF Protection:** State parameter validates OAuth callbacks  
✅ **Token Refresh:** Automatic refresh before expiration  
✅ **Secure Storage:** Tokens never logged or exposed in responses  
✅ **Token Expiration:** PayPal: 9 hours, Square: 30 days  
✅ **Refresh Tokens:** Non-expiring (until revoked)

---

## Database Tables

### `oauth_tokens`
Stores encrypted OAuth tokens with metadata:
- `access_token` - Encrypted access token
- `refresh_token` - Encrypted refresh token
- `expires_at` - Token expiration timestamp
- `merchant_id` - PayPal/Square merchant ID
- `gateway_type` - 'paypal' or 'square'

### `tenant_payment_gateways` (Updated)
Added OAuth fields:
- `oauth_connected` - Boolean flag for OAuth connection
- `oauth_merchant_id` - Merchant ID from OAuth

---

## Testing OAuth Flow

### Test PayPal OAuth (Sandbox)

1. Set sandbox environment variables in Doppler
2. Deploy API to staging
3. Navigate to: `https://aps.visibleshelf.store/api/oauth/paypal/authorize?tenantId=<your-tenant-id>`
4. Login with PayPal sandbox account
5. Authorize the app
6. Should redirect to: `/t/<tenant-id>/settings/payment-gateways?connected=paypal&success=true`

### Test Square OAuth (Sandbox)

1. Set sandbox environment variables in Doppler
2. Deploy API to staging
3. Navigate to: `https://aps.visibleshelf.store/api/oauth/square/authorize?tenantId=<your-tenant-id>`
4. Login with Square sandbox account
5. Authorize the app
6. Should redirect to: `/t/<tenant-id>/settings/payment-gateways?connected=square&success=true`

---

## Deployment Checklist

### Before Deployment

- [ ] Set `TOKEN_ENCRYPTION_KEY` in Doppler (staging & production) ✅
- [ ] Create PayPal sandbox app and get credentials
- [ ] Create PayPal production app and get credentials
- [ ] Create Square sandbox app and get credentials
- [ ] Create Square production app and get credentials
- [ ] Add all environment variables to Doppler
- [ ] Configure redirect URIs in PayPal/Square dashboards
- [ ] Run database migration (already done) ✅
- [ ] Deploy API with OAuth routes (ready to deploy)

### After Deployment

- [ ] Test PayPal OAuth flow in sandbox
- [ ] Test Square OAuth flow in sandbox
- [ ] Verify token encryption/decryption works
- [ ] Test token refresh mechanism
- [ ] Test disconnect functionality
- [ ] Monitor OAuth logs for errors
- [ ] Test production OAuth flows

---

## Troubleshooting

### "OAuth is not configured" Error
- Check that all required environment variables are set in Doppler
- Verify variables are deployed to Railway
- Restart API service after adding variables

### "Invalid state parameter" Error
- State parameter expired (10-minute timeout)
- User should restart OAuth flow
- Check system clock synchronization

### "Token refresh failed" Error
- Refresh token may have been revoked
- User needs to reconnect OAuth
- Check PayPal/Square dashboard for app status

### "No OAuth token found" Error
- User hasn't connected OAuth yet
- Token was manually deleted from database
- User needs to initiate OAuth flow

---

## Next Steps

1. **Set up PayPal and Square developer accounts**
2. **Create sandbox apps for testing**
3. **Add environment variables to Doppler**
4. **Deploy API to staging**
5. **Test OAuth flows**
6. **Implement frontend OAuth UI (Phase 4)**
7. **Add token refresh middleware (Phase 5)**
8. **Deploy to production**

---

## Files Created

**Backend Services:**
- `apps/api/src/services/TokenEncryptionService.ts` - AES-256-GCM encryption
- `apps/api/src/services/paypal/PayPalOAuthService.ts` - PayPal OAuth logic
- `apps/api/src/services/square/SquareOAuthService.ts` - Square OAuth logic

**API Routes:**
- `apps/api/src/routes/oauth/paypal.ts` - PayPal OAuth endpoints
- `apps/api/src/routes/oauth/square.ts` - Square OAuth endpoints
- `apps/api/src/routes/oauth/index.ts` - OAuth routes index

**Database:**
- `OAUTH_MIGRATION.sql` - Database schema migration (already run)

**Documentation:**
- `PAYMENT_GATEWAY_OAUTH_IMPLEMENTATION.md` - Full implementation plan
- `OAUTH_ENV_VARIABLES.md` - This file

---

## Support

For issues or questions:
1. Check API logs in Railway
2. Review OAuth service logs
3. Verify environment variables in Doppler
4. Test with sandbox credentials first
5. Check PayPal/Square developer dashboard for app status
