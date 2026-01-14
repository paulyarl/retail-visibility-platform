# Payment Gateway OAuth Implementation Plan

## Executive Summary

**Goal:** Replace manual credential entry with secure OAuth 2.0 flows for PayPal and Square payment gateways.

**Benefits:**
- Enhanced security (no storing sensitive credentials)
- Better user experience (one-click connection)
- Automatic token refresh
- Reduced support burden (no manual credential errors)
- Industry best practice

**Timeline:** 2-3 weeks
**Complexity:** Medium-High

---

## Current State vs. Target State

### Current (Manual Credentials)
```
User Flow:
1. User goes to PayPal/Square dashboard
2. Creates API credentials manually
3. Copies Client ID, Client Secret, etc.
4. Pastes into our form
5. We store credentials in database

Issues:
- Security risk (storing sensitive credentials)
- Poor UX (manual copy/paste)
- Credentials can expire
- No automatic refresh
- User error prone
```

### Target (OAuth 2.0)
```
User Flow:
1. User clicks "Connect PayPal/Square"
2. Redirected to PayPal/Square login
3. Authorizes our app
4. Redirected back with authorization code
5. We exchange code for access token
6. Store encrypted tokens with refresh capability

Benefits:
- Secure (tokens, not credentials)
- Great UX (one-click)
- Automatic token refresh
- Industry standard
- Professional integration
```

---

## Phase 1: Research & Architecture (Days 1-2)

### 1.1 PayPal OAuth Research

**OAuth Type:** OAuth 2.0 Authorization Code Flow

**Required Setup:**
1. Create PayPal App in Developer Dashboard
2. Configure OAuth redirect URIs
3. Request permissions (scopes)

**Key Endpoints:**
- Authorization: `https://www.paypal.com/signin/authorize`
- Token Exchange: `https://api.paypal.com/v1/oauth2/token`
- Token Refresh: `https://api.paypal.com/v1/oauth2/token`

**Required Scopes:**
- `openid` - Basic profile
- `profile` - User profile info
- `email` - Email address
- `https://uri.paypal.com/services/payments/realtimepayment` - Payment processing

**Token Lifespan:**
- Access Token: 9 hours
- Refresh Token: Does not expire (until revoked)

**Documentation:**
- https://developer.paypal.com/api/rest/authentication/
- https://developer.paypal.com/api/rest/oauth2/

### 1.2 Square OAuth Research

**OAuth Type:** OAuth 2.0 Authorization Code Flow

**Required Setup:**
1. Create Square Application
2. Configure OAuth redirect URIs
3. Request permissions

**Key Endpoints:**
- Authorization: `https://connect.squareup.com/oauth2/authorize`
- Token Exchange: `https://connect.squareup.com/oauth2/token`
- Token Refresh: `https://connect.squareup.com/oauth2/token`
- Token Revoke: `https://connect.squareup.com/oauth2/revoke`

**Required Scopes:**
- `PAYMENTS_READ` - Read payment info
- `PAYMENTS_WRITE` - Process payments
- `MERCHANT_PROFILE_READ` - Read merchant info

**Token Lifespan:**
- Access Token: 30 days
- Refresh Token: Does not expire (until revoked)

**Documentation:**
- https://developer.squareup.com/docs/oauth-api/overview
- https://developer.squareup.com/docs/oauth-api/authorize

### 1.3 Architecture Decisions

**Token Storage:**
- Encrypt tokens at rest (AES-256)
- Store in dedicated `oauth_tokens` table
- Never log tokens
- Implement token rotation

**Security Measures:**
- HTTPS only for OAuth callbacks
- State parameter for CSRF protection
- PKCE (Proof Key for Code Exchange) if supported
- Secure token encryption key management

**Error Handling:**
- Token expiration detection
- Automatic refresh attempts
- User notification on auth failures
- Graceful degradation

---

## Phase 2: Database Schema (Day 3)

### 2.1 OAuth Tokens Table

```prisma
model OAuthToken {
  id                String    @id @default(cuid())
  tenantId          String    @map("tenant_id")
  gatewayType       String    @map("gateway_type") // 'paypal' | 'square'
  
  // Encrypted tokens
  accessToken       String    @map("access_token") // Encrypted
  refreshToken      String?   @map("refresh_token") // Encrypted
  tokenType         String    @default("Bearer") @map("token_type")
  
  // Token metadata
  expiresAt         DateTime  @map("expires_at")
  scope             String?   // Granted scopes
  
  // OAuth metadata
  merchantId        String?   @map("merchant_id") // PayPal/Square merchant ID
  merchantEmail     String?   @map("merchant_email")
  
  // Timestamps
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  lastRefreshedAt   DateTime? @map("last_refreshed_at")
  
  // Relations
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, gatewayType])
  @@map("oauth_tokens")
}
```

### 2.2 Update Payment Gateway Table

```prisma
model PaymentGateway {
  // ... existing fields ...
  
  // OAuth fields
  oauthConnected    Boolean   @default(false) @map("oauth_connected")
  oauthMerchantId   String?   @map("oauth_merchant_id")
  
  // Deprecate manual credential fields (keep for backward compatibility)
  // Mark as optional for OAuth-connected gateways
}
```

### 2.3 Migration Strategy

1. Add new `oauth_tokens` table
2. Add `oauthConnected` flag to `payment_gateways`
3. Keep existing credential fields for backward compatibility
4. Migrate existing gateways gradually

---

## Phase 3: Backend Implementation (Days 4-8)

### 3.1 Token Encryption Service

**File:** `apps/api/src/services/TokenEncryptionService.ts`

```typescript
import crypto from 'crypto';

export class TokenEncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be 64 characters (32 bytes hex)');
    }
    this.key = Buffer.from(encryptionKey, 'hex');
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### 3.2 PayPal OAuth Service

**File:** `apps/api/src/services/paypal/PayPalOAuthService.ts`

```typescript
import { TokenEncryptionService } from '../TokenEncryptionService';
import { prisma } from '../../prisma';

export class PayPalOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private environment: 'sandbox' | 'production';
  private tokenEncryption: TokenEncryptionService;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID!;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
    this.redirectUri = process.env.PAYPAL_OAUTH_REDIRECT_URI!;
    this.environment = (process.env.PAYPAL_ENVIRONMENT as any) || 'sandbox';
    this.tokenEncryption = new TokenEncryptionService();
  }

  /**
   * Generate authorization URL for user to connect PayPal
   */
  getAuthorizationUrl(tenantId: string, state?: string): string {
    const baseUrl = this.environment === 'production'
      ? 'https://www.paypal.com/signin/authorize'
      : 'https://www.sandbox.paypal.com/signin/authorize';

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid profile email https://uri.paypal.com/services/payments/realtimepayment',
      redirect_uri: this.redirectUri,
      state: state || this.generateState(tenantId),
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, tenantId: string) {
    const tokenUrl = this.environment === 'production'
      ? 'https://api.paypal.com/v1/oauth2/token'
      : 'https://api.sandbox.paypal.com/v1/oauth2/token';

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`PayPal token exchange failed: ${error.error_description}`);
    }

    const data = await response.json();
    
    // Store encrypted tokens
    await this.storeTokens(tenantId, data);
    
    return data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(tenantId: string) {
    const tokenRecord = await prisma.oAuthToken.findUnique({
      where: {
        tenantId_gatewayType: {
          tenantId,
          gatewayType: 'paypal',
        },
      },
    });

    if (!tokenRecord || !tokenRecord.refreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshToken = this.tokenEncryption.decrypt(tokenRecord.refreshToken);
    const tokenUrl = this.environment === 'production'
      ? 'https://api.paypal.com/v1/oauth2/token'
      : 'https://api.sandbox.paypal.com/v1/oauth2/token';

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`PayPal token refresh failed: ${error.error_description}`);
    }

    const data = await response.json();
    await this.storeTokens(tenantId, data);
    
    return data;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(tenantId: string): Promise<string> {
    const tokenRecord = await prisma.oAuthToken.findUnique({
      where: {
        tenantId_gatewayType: {
          tenantId,
          gatewayType: 'paypal',
        },
      },
    });

    if (!tokenRecord) {
      throw new Error('No PayPal OAuth token found');
    }

    // Check if token is expired or about to expire (5 min buffer)
    const expiresIn = tokenRecord.expiresAt.getTime() - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      // Token expired or expiring soon, refresh it
      const refreshed = await this.refreshAccessToken(tenantId);
      return refreshed.access_token;
    }

    return this.tokenEncryption.decrypt(tokenRecord.accessToken);
  }

  /**
   * Store encrypted tokens in database
   */
  private async storeTokens(tenantId: string, tokenData: any) {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await prisma.oAuthToken.upsert({
      where: {
        tenantId_gatewayType: {
          tenantId,
          gatewayType: 'paypal',
        },
      },
      create: {
        tenantId,
        gatewayType: 'paypal',
        accessToken: this.tokenEncryption.encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token 
          ? this.tokenEncryption.encrypt(tokenData.refresh_token)
          : null,
        tokenType: tokenData.token_type,
        expiresAt,
        scope: tokenData.scope,
        lastRefreshedAt: new Date(),
      },
      update: {
        accessToken: this.tokenEncryption.encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token 
          ? this.tokenEncryption.encrypt(tokenData.refresh_token)
          : undefined,
        expiresAt,
        scope: tokenData.scope,
        lastRefreshedAt: new Date(),
      },
    });

    // Update payment gateway record
    await prisma.paymentGateway.updateMany({
      where: {
        tenantId,
        gateway_type: 'paypal',
      },
      data: {
        oauthConnected: true,
      },
    });
  }

  /**
   * Generate secure state parameter for CSRF protection
   */
  private generateState(tenantId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${tenantId}:${timestamp}:${random}`;
    return Buffer.from(data).toString('base64url');
  }

  /**
   * Verify and parse state parameter
   */
  verifyState(state: string): { tenantId: string; timestamp: number } {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const [tenantId, timestamp] = decoded.split(':');
      
      // Check if state is not older than 10 minutes
      const age = Date.now() - parseInt(timestamp);
      if (age > 10 * 60 * 1000) {
        throw new Error('State parameter expired');
      }
      
      return { tenantId, timestamp: parseInt(timestamp) };
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }
}
```

### 3.3 Square OAuth Service

**File:** `apps/api/src/services/square/SquareOAuthService.ts`

```typescript
// Similar structure to PayPal, adapted for Square API
// Key differences:
// - Different endpoints
// - Different token lifespan (30 days vs 9 hours)
// - Different scope format
// - Includes location_id in response
```

### 3.4 API Routes

**File:** `apps/api/src/routes/oauth/paypal.ts`

```typescript
import { Router } from 'express';
import { PayPalOAuthService } from '../../services/paypal/PayPalOAuthService';
import { requireAuth } from '../../middleware/auth';

const router = Router();
const paypalOAuth = new PayPalOAuthService();

/**
 * Initiate PayPal OAuth flow
 * GET /api/oauth/paypal/authorize?tenantId=xxx
 */
router.get('/authorize', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    // Verify user has access to this tenant
    // ... access control check ...

    const authUrl = paypalOAuth.getAuthorizationUrl(tenantId as string);
    
    res.json({ authorizationUrl: authUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * OAuth callback endpoint
 * GET /api/oauth/paypal/callback?code=xxx&state=xxx
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      return res.redirect(
        `/settings/payment-gateways?error=${error}&message=${error_description}`
      );
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // Verify state parameter
    const { tenantId } = paypalOAuth.verifyState(state as string);

    // Exchange code for token
    await paypalOAuth.exchangeCodeForToken(code as string, tenantId);

    // Redirect to success page
    res.redirect(`/t/${tenantId}/settings/payment-gateways?connected=paypal`);
  } catch (error: any) {
    console.error('[PayPal OAuth] Callback error:', error);
    res.redirect(`/settings/payment-gateways?error=oauth_failed&message=${error.message}`);
  }
});

/**
 * Disconnect PayPal OAuth
 * DELETE /api/oauth/paypal/disconnect
 */
router.delete('/disconnect', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.body;

    // Delete OAuth tokens
    await prisma.oAuthToken.delete({
      where: {
        tenantId_gatewayType: {
          tenantId,
          gatewayType: 'paypal',
        },
      },
    });

    // Update payment gateway
    await prisma.paymentGateway.updateMany({
      where: {
        tenantId,
        gateway_type: 'paypal',
      },
      data: {
        oauthConnected: false,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**File:** `apps/api/src/routes/oauth/square.ts`
- Similar structure for Square OAuth

---

## Phase 4: Frontend Implementation (Days 9-11)

### 4.1 OAuth Connection Component

**File:** `apps/web/src/components/payment-gateways/OAuthConnectButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface OAuthConnectButtonProps {
  tenantId: string;
  gatewayType: 'paypal' | 'square';
  isConnected: boolean;
  onConnectionChange: () => void;
}

export default function OAuthConnectButton({
  tenantId,
  gatewayType,
  isConnected,
  onConnectionChange,
}: OAuthConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get authorization URL from backend
      const response = await api.get(
        `/api/oauth/${gatewayType}/authorize?tenantId=${tenantId}`
      );

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth flow');
      }

      const { authorizationUrl } = await response.json();

      // Redirect to OAuth provider
      window.location.href = authorizationUrl;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${gatewayType}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.delete(`/api/oauth/${gatewayType}/disconnect`, {
        tenantId,
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      onConnectionChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const gatewayName = gatewayType === 'paypal' ? 'PayPal' : 'Square';

  if (isConnected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Connected to {gatewayName}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={loading}
        >
          {loading ? 'Disconnecting...' : 'Disconnect'}
        </Button>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-2"
      >
        <ExternalLink className="h-4 w-4" />
        {loading ? 'Connecting...' : `Connect ${gatewayName}`}
      </Button>
      {error && (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      <p className="text-xs text-neutral-500">
        Securely connect your {gatewayName} account with one click
      </p>
    </div>
  );
}
```

### 4.2 Update Payment Gateway Settings Page

**Modify:** `apps/web/src/app/t/[tenantId]/settings/payment-gateways/page.tsx`

Add OAuth option alongside manual credential entry:

```typescript
// Add toggle between OAuth and Manual
const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'manual'>('oauth');

// Show OAuth button if method is 'oauth'
{connectionMethod === 'oauth' ? (
  <OAuthConnectButton
    tenantId={tenantId}
    gatewayType="paypal"
    isConnected={gateway.oauthConnected}
    onConnectionChange={loadGateways}
  />
) : (
  // Existing manual form
)}
```

### 4.3 Success/Error Handling

Handle OAuth callback redirects with query parameters:

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get('connected');
  const error = params.get('error');
  const message = params.get('message');

  if (connected) {
    setSaveSuccess(true);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (error) {
    setSaveError(message || 'OAuth connection failed');
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
```

---

## Phase 5: Token Refresh & Error Handling (Day 12)

### 5.1 Automatic Token Refresh Middleware

**File:** `apps/api/src/middleware/oauth-token-refresh.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { PayPalOAuthService } from '../services/paypal/PayPalOAuthService';
import { SquareOAuthService } from '../services/square/SquareOAuthService';

export async function ensureValidToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { tenantId, gatewayType } = req.body;

    if (!tenantId || !gatewayType) {
      return next();
    }

    // Check if gateway uses OAuth
    const gateway = await prisma.paymentGateway.findFirst({
      where: {
        tenantId,
        gateway_type: gatewayType,
        oauthConnected: true,
      },
    });

    if (!gateway) {
      return next(); // Not OAuth, skip
    }

    // Get valid token (will refresh if needed)
    if (gatewayType === 'paypal') {
      const paypalOAuth = new PayPalOAuthService();
      await paypalOAuth.getValidAccessToken(tenantId);
    } else if (gatewayType === 'square') {
      const squareOAuth = new SquareOAuthService();
      await squareOAuth.getValidAccessToken(tenantId);
    }

    next();
  } catch (error) {
    console.error('[OAuth Middleware] Token refresh failed:', error);
    // Don't block request, let payment processing handle the error
    next();
  }
}
```

### 5.2 Payment Processing Integration

Update payment processing to use OAuth tokens:

```typescript
// In PayPal payment processing
const paypalOAuth = new PayPalOAuthService();
const accessToken = await paypalOAuth.getValidAccessToken(tenantId);

// Use accessToken for API calls instead of manual credentials
```

---

## Phase 6: Testing & Deployment (Days 13-14)

### 6.1 Testing Checklist

**PayPal OAuth:**
- [ ] Authorization URL generation
- [ ] Successful OAuth flow (sandbox)
- [ ] Token storage and encryption
- [ ] Token refresh mechanism
- [ ] Payment processing with OAuth token
- [ ] Disconnect flow
- [ ] Error handling (user cancels, invalid code, etc.)
- [ ] CSRF protection (state parameter)

**Square OAuth:**
- [ ] Authorization URL generation
- [ ] Successful OAuth flow (sandbox)
- [ ] Token storage and encryption
- [ ] Token refresh mechanism
- [ ] Payment processing with OAuth token
- [ ] Disconnect flow
- [ ] Error handling
- [ ] CSRF protection

**Security:**
- [ ] Tokens encrypted at rest
- [ ] No tokens in logs
- [ ] HTTPS enforced
- [ ] State parameter validation
- [ ] Token expiration handling

**UX:**
- [ ] Clear connection status
- [ ] Error messages user-friendly
- [ ] Loading states
- [ ] Success confirmations
- [ ] Graceful fallback to manual

### 6.2 Environment Variables

**Required:**
```env
# PayPal OAuth
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/paypal/callback
PAYPAL_ENVIRONMENT=sandbox

# Square OAuth
SQUARE_APPLICATION_ID=xxx
SQUARE_APPLICATION_SECRET=xxx
SQUARE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/square/callback
SQUARE_ENVIRONMENT=sandbox

# Token Encryption
TOKEN_ENCRYPTION_KEY=64_character_hex_string
```

### 6.3 Deployment Steps

1. **Database Migration:**
   ```bash
   npx prisma migrate dev --name add_oauth_tokens
   npx prisma generate
   ```

2. **Environment Setup:**
   - Add OAuth credentials to Railway/Vercel
   - Configure redirect URIs in PayPal/Square dashboards

3. **Deploy Backend:**
   - Deploy API with new OAuth routes
   - Verify token encryption works

4. **Deploy Frontend:**
   - Deploy web app with OAuth UI
   - Test OAuth flow end-to-end

5. **Monitor:**
   - Watch for OAuth errors
   - Monitor token refresh success rate
   - Check payment processing success

---

## Phase 7: Migration & Rollout (Days 15+)

### 7.1 Gradual Rollout

**Week 1:**
- Deploy to staging
- Internal testing
- Fix any issues

**Week 2:**
- Deploy to production
- Feature flag for OAuth (optional)
- Monitor closely

**Week 3:**
- Encourage existing users to migrate
- Send migration guide
- Offer support

### 7.2 User Migration

**For Existing Manual Credentials:**
1. Show banner: "Switch to secure OAuth connection"
2. Provide one-click migration
3. Keep manual credentials as fallback
4. Eventually deprecate manual entry

**Migration Flow:**
```
1. User sees "Upgrade to OAuth" banner
2. Clicks "Upgrade"
3. Completes OAuth flow
4. Old credentials marked as deprecated
5. System uses OAuth tokens going forward
```

---

## Success Metrics

**Technical:**
- OAuth success rate > 95%
- Token refresh success rate > 99%
- Payment processing success rate maintained
- Zero token leaks

**User Experience:**
- Connection time < 30 seconds
- User satisfaction with OAuth flow
- Reduced support tickets for credential issues

**Security:**
- All tokens encrypted
- No credentials in database
- Automatic token rotation working

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth provider downtime | High | Fallback to manual credentials temporarily |
| Token refresh failures | Medium | Retry logic, user notification |
| User confusion | Low | Clear UI, documentation, support |
| Security vulnerabilities | High | Security audit, penetration testing |
| Migration issues | Medium | Gradual rollout, feature flags |

---

## Future Enhancements

1. **Webhook Integration:**
   - Real-time payment notifications
   - Account status changes

2. **Multi-Account Support:**
   - Multiple PayPal/Square accounts per tenant
   - Account switching

3. **Advanced Permissions:**
   - Granular scope management
   - Read-only vs full access

4. **OAuth for Other Providers:**
   - Stripe OAuth
   - Authorize.net OAuth

---

## Documentation

### For Developers:
- OAuth implementation guide
- Token encryption guide
- Testing guide
- Troubleshooting guide

### For Users:
- How to connect PayPal via OAuth
- How to connect Square via OAuth
- FAQ: OAuth vs Manual
- Troubleshooting connection issues

---

## Conclusion

OAuth implementation will significantly improve security and user experience for payment gateway connections. The phased approach ensures thorough testing and gradual rollout, minimizing risks while delivering professional-grade integration.

**Next Steps:**
1. Review and approve this plan
2. Set up PayPal/Square developer accounts
3. Begin Phase 1 implementation
4. Regular progress check-ins
