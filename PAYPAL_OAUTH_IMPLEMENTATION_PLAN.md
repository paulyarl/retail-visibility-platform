# PayPal OAuth Connect Implementation Plan

## 🎯 Status: PLANNED - To be implemented after sandbox testing complete

---

## 📋 Current State (Phase 1)

### **Manual Credential Entry** ✅ COMPLETE
- Tenants enter PayPal Client ID and Secret manually
- Good for: Testing, development, sandbox validation
- Location: `/t/[tenantId]/settings/payment-gateways`
- Status: Ready for testing

**Testing Flow:**
1. Get PayPal sandbox credentials from developer.paypal.com
2. Enter credentials in payment gateway settings
3. Test complete shopping cart flow
4. Validate order processing with PayPal sandbox

---

## 🚀 Next Phase: PayPal OAuth Connect

### **Why OAuth Connect?**
- ✅ No developer account needed for merchants
- ✅ Uses regular PayPal business accounts
- ✅ One-click connection experience
- ✅ Industry-standard integration
- ✅ Better merchant conversion rates
- ✅ Secure token management

### **Merchant Experience:**
```
1. Click "Connect PayPal" button
   ↓
2. Redirected to PayPal login
   ↓
3. Log in with PayPal business account
   ↓
4. Grant permission to platform
   ↓
5. Redirected back to platform
   ↓
6. Payment gateway automatically configured
   ↓
7. Shopping cart enabled
```

---

## 🔧 Implementation Requirements

### **1. PayPal Partner Application**
**Prerequisites:**
- Apply for PayPal Partner status
- Get Partner Client ID and Secret
- Configure OAuth redirect URIs
- Set up webhook endpoints

**Partner API Scopes Needed:**
```
openid
profile
email
https://uri.paypal.com/services/payments/realtimepayment
https://uri.paypal.com/services/payments/payment/authcapture
```

**Redirect URIs:**
```
Production: https://visibleshelf.com/api/paypal/callback
Staging: https://staging.visibleshelf.com/api/paypal/callback
Development: http://localhost:3000/api/paypal/callback
```

---

### **2. Backend Implementation**

#### **A. PayPal OAuth Routes**
**File:** `apps/api/src/routes/paypal-oauth.ts`

```typescript
import { Router } from 'express';
import { requireAuth, checkTenantAccess } from '../middleware/auth';
import axios from 'axios';
import crypto from 'crypto';

const router = Router();

// Environment variables needed
const PAYPAL_PARTNER_CLIENT_ID = process.env.PAYPAL_PARTNER_CLIENT_ID;
const PAYPAL_PARTNER_SECRET = process.env.PAYPAL_PARTNER_SECRET;
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const BASE_URL = PAYPAL_MODE === 'live' 
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

/**
 * GET /api/paypal/connect/:tenantId
 * Initiate PayPal OAuth flow
 */
router.get('/connect/:tenantId', requireAuth, checkTenantAccess, async (req, res) => {
  const { tenantId } = req.params;
  
  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state in session or database
  req.session.paypalOAuthState = state;
  req.session.paypalTenantId = tenantId;
  
  // Build PayPal OAuth URL
  const redirectUri = `${process.env.API_BASE_URL}/api/paypal/callback`;
  const authUrl = `${BASE_URL}/connect?` +
    `flowEntry=static&` +
    `client_id=${PAYPAL_PARTNER_CLIENT_ID}&` +
    `response_type=code&` +
    `scope=openid profile email https://uri.paypal.com/services/payments/realtimepayment&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}`;
  
  res.redirect(authUrl);
});

/**
 * GET /api/paypal/callback
 * Handle PayPal OAuth callback
 */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Verify state token
  if (state !== req.session.paypalOAuthState) {
    return res.redirect('/settings/payment-gateways?error=invalid_state');
  }
  
  const tenantId = req.session.paypalTenantId;
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      `${BASE_URL}/v1/oauth2/token`,
      'grant_type=authorization_code&code=' + code,
      {
        auth: {
          username: PAYPAL_PARTNER_CLIENT_ID,
          password: PAYPAL_PARTNER_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Get merchant info
    const userInfoResponse = await axios.get(
      `${BASE_URL}/v1/identity/oauth2/userinfo?schema=paypalv1.1`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    
    const merchantInfo = userInfoResponse.data;
    
    // Store encrypted tokens in database
    const gatewayId = `gateway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await prisma.tenant_payment_gateways.create({
      data: {
        id: gatewayId,
        tenant_id: tenantId,
        gateway_type: 'paypal',
        is_active: true,
        is_default: true,
        api_key_encrypted: encrypt(access_token),
        api_secret_encrypted: encrypt(refresh_token),
        config: {
          mode: PAYPAL_MODE,
          merchant_id: merchantInfo.payer_id,
          merchant_email: merchantInfo.email,
          connected_via: 'oauth',
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        },
        last_verified_at: new Date(),
        verification_status: 'verified',
      },
    });
    
    // Clear session
    delete req.session.paypalOAuthState;
    delete req.session.paypalTenantId;
    
    // Redirect back to settings with success
    res.redirect(`/t/${tenantId}/settings/payment-gateways?success=connected`);
    
  } catch (error) {
    console.error('[PayPal OAuth] Token exchange failed:', error);
    res.redirect(`/t/${tenantId}/settings/payment-gateways?error=connection_failed`);
  }
});

/**
 * POST /api/paypal/refresh/:tenantId/:gatewayId
 * Refresh PayPal access token
 */
router.post('/refresh/:tenantId/:gatewayId', requireAuth, checkTenantAccess, async (req, res) => {
  const { tenantId, gatewayId } = req.params;
  
  try {
    // Get gateway
    const gateway = await prisma.tenant_payment_gateways.findFirst({
      where: {
        id: gatewayId,
        tenant_id: tenantId,
        gateway_type: 'paypal',
      },
    });
    
    if (!gateway) {
      return res.status(404).json({ error: 'Gateway not found' });
    }
    
    // Decrypt refresh token
    const refreshToken = decrypt(gateway.api_secret_encrypted);
    
    // Request new access token
    const tokenResponse = await axios.post(
      `${BASE_URL}/v1/oauth2/token`,
      `grant_type=refresh_token&refresh_token=${refreshToken}`,
      {
        auth: {
          username: PAYPAL_PARTNER_CLIENT_ID,
          password: PAYPAL_PARTNER_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    const { access_token, expires_in } = tokenResponse.data;
    
    // Update gateway with new token
    await prisma.tenant_payment_gateways.update({
      where: { id: gatewayId },
      data: {
        api_key_encrypted: encrypt(access_token),
        config: {
          ...gateway.config,
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        },
        last_verified_at: new Date(),
      },
    });
    
    res.json({ success: true, message: 'Token refreshed' });
    
  } catch (error) {
    console.error('[PayPal OAuth] Token refresh failed:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

export default router;
```

#### **B. Mount OAuth Routes**
**File:** `apps/api/src/index.ts`

```typescript
import paypalOAuthRoutes from './routes/paypal-oauth';

// Mount PayPal OAuth routes
app.use('/api/paypal', paypalOAuthRoutes);
console.log('✅ PayPal OAuth routes mounted at /api/paypal');
```

---

### **3. Frontend Implementation**

#### **A. Update Payment Gateway Settings Page**
**File:** `apps/web/src/app/t/[tenantId]/settings/payment-gateways/page.tsx`

**Add OAuth Connect Button:**
```typescript
const handleConnectPayPal = () => {
  // Redirect to OAuth flow
  window.location.href = `/api/paypal/connect/${tenantId}`;
};

// In the PayPal card, add two connection options:
{!paypalGateway ? (
  <div className="space-y-4">
    {/* Quick Connect (Recommended) */}
    <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-blue-900">Quick Connect</h4>
        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">Recommended</span>
      </div>
      <p className="text-sm text-blue-800 mb-4">
        Connect your existing PayPal business account in one click. No developer account needed.
      </p>
      <Button onClick={handleConnectPayPal} className="w-full">
        <CreditCard className="w-4 h-4 mr-2" />
        Connect PayPal Account
      </Button>
    </div>
    
    {/* Manual Setup (Advanced) */}
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Manual Setup</h4>
        <span className="px-2 py-1 bg-neutral-200 text-neutral-700 text-xs rounded">Advanced</span>
      </div>
      <p className="text-sm text-neutral-600 mb-4">
        Enter PayPal API credentials manually. Requires PayPal developer account.
      </p>
      <Button variant="outline" onClick={() => setShowPayPalForm(true)} className="w-full">
        Configure Manually
      </Button>
    </div>
  </div>
) : (
  // Existing gateway display
)}
```

#### **B. Handle OAuth Success/Error**
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const success = params.get('success');
  const error = params.get('error');
  
  if (success === 'connected') {
    setSaveSuccess(true);
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
  }
  
  if (error) {
    setError(getErrorMessage(error));
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
```

---

### **4. Token Refresh Strategy**

**Automatic Token Refresh:**
```typescript
// apps/api/src/services/PayPalTokenManager.ts

export class PayPalTokenManager {
  async getValidToken(gatewayId: string): Promise<string> {
    const gateway = await prisma.tenant_payment_gateways.findUnique({
      where: { id: gatewayId },
    });
    
    if (!gateway) throw new Error('Gateway not found');
    
    const expiresAt = new Date(gateway.config.expires_at);
    const now = new Date();
    
    // Refresh if token expires in less than 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      return await this.refreshToken(gateway);
    }
    
    return decrypt(gateway.api_key_encrypted);
  }
  
  private async refreshToken(gateway: any): Promise<string> {
    // Refresh token logic from OAuth route
    // ...
  }
}
```

---

## 📋 Environment Variables Needed

```env
# PayPal Partner API
PAYPAL_PARTNER_CLIENT_ID=your-partner-client-id
PAYPAL_PARTNER_SECRET=your-partner-secret
PAYPAL_MODE=sandbox  # or 'live' for production

# OAuth Callback URL
API_BASE_URL=http://localhost:4000  # or production URL
```

---

## 🧪 Testing Plan

### **Phase 1: Sandbox Testing** (Current)
- ✅ Manual credential entry
- ✅ Test cart functionality
- ✅ Test checkout flow
- ✅ Validate order processing

### **Phase 2: OAuth Implementation**
1. Apply for PayPal Partner status
2. Implement OAuth routes
3. Update frontend UI
4. Test OAuth flow in sandbox
5. Test token refresh
6. Validate payment processing

### **Phase 3: Production Deployment**
1. Get production Partner credentials
2. Configure production redirect URIs
3. Deploy OAuth implementation
4. Monitor connection success rates
5. Provide merchant support

---

## 🎯 Benefits of OAuth Connect

**For Merchants:**
- ✅ No developer account needed
- ✅ One-click setup (< 2 minutes)
- ✅ Uses existing PayPal business account
- ✅ Secure OAuth flow
- ✅ Easy to understand

**For Platform:**
- ✅ Higher conversion rates
- ✅ Better merchant experience
- ✅ Automatic token management
- ✅ Industry-standard integration
- ✅ Reduced support burden

**For Customers:**
- ✅ More merchants accepting payments
- ✅ Trusted PayPal checkout
- ✅ Secure transactions

---

## 📝 Migration Path

**Existing Manual Gateways:**
- Keep working as-is
- Offer "Upgrade to Quick Connect" option
- Gradual migration, not forced

**New Merchants:**
- Show Quick Connect first (recommended)
- Manual setup as secondary option
- Clear benefits of each approach

---

## ✅ Implementation Checklist

### **Prerequisites:**
- [ ] Apply for PayPal Partner status
- [ ] Get Partner Client ID and Secret
- [ ] Configure OAuth redirect URIs
- [ ] Set up webhook endpoints

### **Backend:**
- [ ] Create PayPal OAuth routes
- [ ] Implement token exchange
- [ ] Add token refresh logic
- [ ] Mount routes in API index
- [ ] Add environment variables

### **Frontend:**
- [ ] Add "Quick Connect" button
- [ ] Update payment gateway settings UI
- [ ] Handle OAuth callback
- [ ] Show connection status
- [ ] Add error handling

### **Testing:**
- [ ] Test OAuth flow in sandbox
- [ ] Test token refresh
- [ ] Test payment processing
- [ ] Test error scenarios
- [ ] Validate security

### **Documentation:**
- [ ] Update merchant onboarding guide
- [ ] Create OAuth troubleshooting guide
- [ ] Document token management
- [ ] Update API documentation

---

## 🚀 Timeline

**Phase 1 (Current):** Manual credentials - Ready for testing
**Phase 2 (Next):** OAuth Connect - After sandbox validation
**Phase 3 (Future):** Production deployment

**Estimated Implementation Time:** 2-3 days after PayPal Partner approval

---

**This plan will be executed after successful completion of Phase 1 sandbox testing!**
