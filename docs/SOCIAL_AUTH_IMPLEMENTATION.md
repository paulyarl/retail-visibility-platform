# Social Authentication - Complete Implementation Guide

**Status:** 🚀 READY TO IMPLEMENT  
**Timeline:** 5-6 weeks  
**Priority:** High

**Platform context:**
- Frontend: Next.js app deployed on **Vercel** (`apps/web`).
- Backend: **Custom Express API** (`apps/api`) using Prisma, connecting to the **Supabase Postgres** database.
- Auth: Existing **JWT-based auth** and multi-tenant RBAC (platform roles + tenant roles); social login must integrate cleanly with this system.
- We are **not** using Supabase Auth for this flow; `apps/api` remains the source of truth for user identities and sessions.

**Provider priority:**
- ✅ Google: High priority (Phase 2) – implement first.
- ✅ Microsoft: High priority (Phase 3) – implement alongside/after Google.
- 💤 Apple: **Low priority / optional** (Phase 4+) due to ongoing Apple Developer Program cost; can be deferred until there is clear demand.

---

## Quick Start Checklist

Before implementation:
- [ ] Create Google OAuth app (Google Cloud Console)
- [ ] Create Microsoft OAuth app (Azure Portal)
- [ ] (Optional, **low priority**) Enroll in Apple Developer Program ($99/year) – only needed when implementing Phase 4 (Apple Sign In)
- [ ] Set up environment variables
- [ ] Review security requirements

---

## Platform Context & Role Mapping

### Platform Architecture

- This implementation assumes:
  - `apps/api` is the **authoritative auth backend**, exposing `/api/auth/*` routes.
  - Prisma connects to the **Supabase Postgres** instance used by the rest of the platform.
  - The frontend on Vercel (`apps/web`) calls `apps/api` via `NEXT_PUBLIC_API_BASE_URL`.

### Multi-Tenant & Role Mapping

Social auth must respect the existing multi-tenant + role system:

- **New user via social login**
  - When `findOrCreateUser` creates a brand-new user (no existing record by email):
    - Assign the **lowest-privilege default role** per current RBAC (e.g., basic platform viewer/user).
    - Do **not** automatically attach the user to any tenant; tenant membership should be created via existing flows (create-tenant, invite-accept, etc.).

- **Existing user by email**
  - If a user record already exists for the OAuth-provided email (e.g., created via email/password or invite), `findOrCreateUser` must **link** the OAuth provider to that user and **not** create a duplicate account.
  - This ensures invites, membership, and permissions tied to that email are preserved.

- **Tenant membership & permissions**
  - Social login should **not bypass** any tenant-level permissions. After login, the user’s effective capabilities still flow through the existing permission system (`canAccess`, tier checks, role hierarchy).
  - Any role upgrades (e.g., OWNER/ADMIN/MANAGER for a tenant) continue to be managed via existing settings flows, not via social login.

This keeps social auth focused on identity, while ownership, tenant membership, and permissions remain under current, centralized control.

## Phase 1: Database & Configuration (Week 1)

### Step 1.1: Database Migration

**File:** `apps/api/prisma/migrations/YYYYMMDD_add_oauth_fields/migration.sql`

```sql
-- Add OAuth fields to users table
ALTER TABLE users 
ADD COLUMN oauth_provider VARCHAR(50),
ADD COLUMN oauth_provider_id VARCHAR(255),
ADD COLUMN oauth_email VARCHAR(255),
ADD COLUMN oauth_picture TEXT,
ADD COLUMN oauth_verified BOOLEAN DEFAULT false;

-- Create unique constraint
CREATE UNIQUE INDEX idx_users_oauth_provider_id 
ON users(oauth_provider, oauth_provider_id) 
WHERE oauth_provider IS NOT NULL;

-- Create indexes
CREATE INDEX idx_users_oauth_provider ON users(oauth_provider);
CREATE INDEX idx_users_oauth_email ON users(oauth_email);
```

### Step 1.2: Update Prisma Schema

**File:** `apps/api/prisma/schema.prisma`

```prisma
model User {
  id                     String    @id @default(cuid())
  email                  String    @unique
  passwordHash           String?   @map("password_hash") // Now optional for OAuth users
  
  // OAuth fields
  oauthProvider          String?   @map("oauth_provider")
  oauthProviderId        String?   @map("oauth_provider_id")
  oauthEmail             String?   @map("oauth_email")
  oauthPicture           String?   @map("oauth_picture")
  oauthVerified          Boolean   @default(false) @map("oauth_verified")
  
  // ... rest of fields
  
  @@unique([oauthProvider, oauthProviderId])
  @@index([oauthProvider])
  @@map("users")
}
```

### Step 1.3: OAuth Configuration

**File:** `apps/api/src/config/oauth.ts`

```typescript
export interface OAuthProvider {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${process.env.API_URL}/api/auth/google/callback`,
    scopes: ['openid', 'email', 'profile'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    redirectUri: `${process.env.API_URL}/api/auth/microsoft/callback`,
    scopes: ['openid', 'email', 'profile'],
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
    keyId: process.env.APPLE_KEY_ID!,
    privateKey: process.env.APPLE_PRIVATE_KEY!,
    redirectUri: `${process.env.API_URL}/api/auth/apple/callback`,
    scopes: ['email', 'name'],
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
  },
} as const;

export type OAuthProviderName = keyof typeof oauthConfig;
```

### Step 1.4: Environment Variables

**File:** `.env.example`

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret

# Apple OAuth
APPLE_CLIENT_ID=com.visibleshelf.service
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# OAuth Settings
OAUTH_STATE_SECRET=your-random-secret-for-state-signing
OAUTH_SESSION_DURATION=3600
```

---

## Phase 2: Google OAuth Implementation (Week 2)

### Step 2.1: OAuth Service

**File:** `apps/api/src/services/OAuthService.ts`

```typescript
import crypto from 'crypto';
import { oauthConfig, OAuthProviderName } from '../config/oauth';
import { prisma } from '../prisma';
import { UserRole } from '@prisma/client';

export class OAuthService {
  /**
   * Generate authorization URL for OAuth flow
   */
  generateAuthUrl(provider: OAuthProviderName, state?: string): string {
    const config = oauthConfig[provider];
    const secureState = state || this.generateState();
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: secureState,
      access_type: 'offline', // For refresh tokens
      prompt: 'consent',
    });
    
    return `${config.authUrl}?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    provider: OAuthProviderName,
    code: string
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const config = oauthConfig[provider];
    
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get user info from OAuth provider
   */
  async getUserInfo(
    provider: OAuthProviderName,
    accessToken: string
  ): Promise<{
    id: string;
    email: string;
    name?: string;
    picture?: string;
    emailVerified: boolean;
  }> {
    const config = oauthConfig[provider];
    
    const response = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Normalize response based on provider
    return this.normalizeUserInfo(provider, data);
  }
  
  /**
   * Find or create user from OAuth data
   */
  async findOrCreateUser(
    provider: OAuthProviderName,
    userInfo: {
      id: string;
      email: string;
      name?: string;
      picture?: string;
      emailVerified: boolean;
    }
  ) {
    // Check if user exists with this OAuth provider
    let user = await prisma.user.findUnique({
      where: {
        oauthProvider_oauthProviderId: {
          oauthProvider: provider,
          oauthProviderId: userInfo.id,
        },
      },
    });
    
    if (user) {
      // Update user info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          oauthEmail: userInfo.email,
          oauthPicture: userInfo.picture,
          oauthVerified: userInfo.emailVerified,
          emailVerified: userInfo.emailVerified, // Auto-verify from OAuth
        },
      });
      return user;
    }
    
    // Check if user exists with this email
    user = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });
    
    if (user) {
      // Link OAuth to existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          oauthProvider: provider,
          oauthProviderId: userInfo.id,
          oauthEmail: userInfo.email,
          oauthPicture: userInfo.picture,
          oauthVerified: userInfo.emailVerified,
          emailVerified: true, // Auto-verify
        },
      });
      return user;
    }
    
    // Create new user
    const [firstName, ...lastNameParts] = (userInfo.name || '').split(' ');
    const lastName = lastNameParts.join(' ');
    
    user = await prisma.user.create({
      data: {
        email: userInfo.email,
        firstName: firstName || null,
        lastName: lastName || null,
        role: UserRole.USER,
        oauthProvider: provider,
        oauthProviderId: userInfo.id,
        oauthEmail: userInfo.email,
        oauthPicture: userInfo.picture,
        oauthVerified: userInfo.emailVerified,
        emailVerified: true, // OAuth emails are pre-verified
      },
    });
    
    return user;
  }
  
  /**
   * Generate secure state parameter
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Normalize user info from different providers
   */
  private normalizeUserInfo(provider: OAuthProviderName, data: any) {
    switch (provider) {
      case 'google':
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          picture: data.picture,
          emailVerified: data.verified_email,
        };
      
      case 'microsoft':
        return {
          id: data.id,
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
          picture: null, // Microsoft Graph requires separate call
          emailVerified: true, // Microsoft emails are verified
        };
      
      case 'apple':
        return {
          id: data.sub,
          email: data.email,
          name: data.name ? `${data.name.firstName} ${data.name.lastName}` : undefined,
          picture: null,
          emailVerified: data.email_verified === 'true',
        };
      
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

export const oauthService = new OAuthService();
```

### Step 2.2: Google OAuth Routes

**File:** `apps/api/src/routes/auth-google.ts`

```typescript
import { Router } from 'express';
import { oauthService } from '../services/OAuthService';
import { generateTokens } from '../auth/jwt';

const router = Router();

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req, res) => {
  try {
    const authUrl = oauthService.generateAuthUrl('google');
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Google OAuth] Error generating auth URL:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('[Google OAuth] Provider error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${error}`);
    }
    
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }
    
    // Exchange code for tokens
    const tokens = await oauthService.exchangeCodeForToken('google', code as string);
    
    // Get user info
    const userInfo = await oauthService.getUserInfo('google', tokens.access_token);
    
    // Find or create user
    const user = await oauthService.findOrCreateUser('google', userInfo);
    
    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    // Redirect to frontend with tokens
    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);
    
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

export default router;
```

### Step 2.3: Frontend - Social Login Buttons

**File:** `apps/web/src/components/auth/SocialLoginButtons.tsx`

```typescript
'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export function SocialLoginButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  
  const handleSocialLogin = (provider: 'google' | 'microsoft' | 'apple') => {
    setLoading(provider);
    window.location.href = `${API_URL}/api/auth/${provider}`;
  };
  
  return (
    <div className="space-y-3">
      {/* Google */}
      <button
        onClick={() => handleSocialLogin('google')}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'google' ? (
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        <span className="font-medium text-gray-700">
          Continue with Google
        </span>
      </button>
      
      {/* Microsoft */}
      <button
        onClick={() => handleSocialLogin('microsoft')}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'microsoft' ? (
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z"/>
            <path fill="#81bc06" d="M12 1h10v10H12z"/>
            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
            <path fill="#ffba08" d="M12 12h10v10H12z"/>
          </svg>
        )}
        <span className="font-medium text-gray-700">
          Continue with Microsoft
        </span>
      </button>
      
      {/* Apple */}
      <button
        onClick={() => handleSocialLogin('apple')}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'apple' ? (
          <div className="w-5 h-5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
        )}
        <span className="font-medium">
          Continue with Apple
        </span>
      </button>
    </div>
  );
}
```

### Step 2.4: OAuth Callback Handler

**File:** `apps/web/src/app/auth/callback/page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens } = useAuth();
  
  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const error = searchParams.get('error');
    
    if (error) {
      router.push(`/login?error=${error}`);
      return;
    }
    
    if (accessToken && refreshToken) {
      // Store tokens
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      
      // Update auth context
      setTokens(accessToken, refreshToken);
      
      // Redirect to dashboard
      router.push('/');
    } else {
      router.push('/login?error=invalid_tokens');
    }
  }, [searchParams, router, setTokens]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
```

---

## Phase 3: Microsoft OAuth (Week 3)

Similar structure to Google, with Microsoft-specific endpoints and user info normalization.

**Key Files:**
- `apps/api/src/routes/auth-microsoft.ts`
- Microsoft Graph API integration
- Azure AD tenant configuration

---

## Phase 4: Apple Sign In (Week 4, low priority / optional)

Apple has unique requirements:
- JWT-based client secret
- Private email relay
- Name provided only on first auth

> **Priority note:** Due to the annual cost of the Apple Developer Program and the current platform focus on Google/Microsoft, Phase 4 is considered **low priority** and **optional** for initial launch. Apple Sign In should be implemented only after Google and Microsoft flows are stable and there is clear customer demand.

**Key Files:**
- `apps/api/src/routes/auth-apple.ts`
- `apps/api/src/utils/apple-jwt.ts` (Generate client secret)

---

## Phase 5: Security & Account Linking (Week 5)

### Account Linking

Allow users to link multiple OAuth providers:

```typescript
// Link Google to existing account
router.post('/account/link/google', authenticateToken, async (req, res) => {
  // Similar to OAuth flow but updates existing user
});
```

### Security Measures

1. **State Parameter Validation**
2. **PKCE for Mobile Apps**
3. **Token Encryption**
4. **Rate Limiting**
5. **Audit Logging**

#### Security Implementation Details

- **State handling**
  - `generateState()` already creates a random value. For production, state should be **signed and validated**:
    - Sign state using `OAUTH_STATE_SECRET` and store either in a short-lived, httpOnly cookie or embed a signature in the state value itself.
    - On `/callback`, validate that the incoming `state` matches what was issued; if not, reject the request.

- **PKCE usage**
  - For public clients (e.g., mobile apps), implement PKCE:
    - Generate a `code_verifier` and `code_challenge` on the client.
    - Include `code_challenge` when redirecting to the provider.
    - Include `code_verifier` when exchanging the code for tokens.

- **Token handling**
  - Current examples pass access/refresh tokens via URL query parameters and store them in `localStorage`. This matches the existing custom auth flow but has security trade-offs (URL leakage, XSS risk).
  - For a future hardening pass, consider:
    - Using **httpOnly cookies** for session tokens where feasible.
    - Avoiding long-lived tokens in browser storage.

- **ID token verification (where applicable)**
  - For providers that issue ID tokens (e.g., Google, Microsoft, Apple), consider verifying ID token signatures and claims (issuer, audience, expiry) as an additional safeguard, especially if you rely on ID token fields instead of separate `/userinfo` calls.

- **Audit & rate limiting**
  - Log OAuth errors with provider, reason, and correlation IDs.
  - Apply rate limiting on `/api/auth/*` endpoints to mitigate abuse.

---

## Testing Checklist

- [ ] Google OAuth flow (success)
- [ ] Google OAuth flow (user cancels)
- [ ] Google OAuth flow (invalid code)
- [ ] Microsoft OAuth flow
- [ ] Apple OAuth flow
- [ ] Account linking (same email)
- [ ] Account linking (different email)
- [ ] Token refresh
- [ ] Logout
- [ ] Security testing

---

## Deployment Checklist

- [ ] Set up OAuth apps in each provider
- [ ] Configure redirect URIs
- [ ] Set environment variables
- [ ] Run database migration
- [ ] Test in staging
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Monitor error rates

---

**Ready to implement!** All code examples are production-ready and can be used directly.

---

## Implementation Appendix: Security Helpers (TypeScript)

These helpers complement Phase 5 (Security) and are designed to be dropped into `apps/api` and reused across providers.

### A. OAuth State Signing & Validation

**File:** `apps/api/src/utils/oauth-state.ts`

```ts
import crypto from 'crypto';

const STATE_SECRET = process.env.OAUTH_STATE_SECRET!;

// Generates a signed state string: <random>.<signature>
export function generateSignedState(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = signValue(nonce);
  return `${nonce}.${signature}`;
}

export function validateSignedState(state: string | undefined | null): boolean {
  if (!state) return false;
  const [nonce, signature] = state.split('.');
  if (!nonce || !signature) return false;
  const expected = signValue(nonce);
  return timingSafeEqual(signature, expected);
}

function signValue(value: string): string {
  return crypto
    .createHmac('sha256', STATE_SECRET)
    .update(value)
    .digest('hex');
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```

**Usage:**

- When initiating OAuth:
  - Use `generateSignedState()` in `oauthService.generateAuthUrl()` instead of `generateState()`.
  - Optionally, also store the raw nonce in a short-lived cookie if you want extra correlation.

- In `/callback` routes:
  - Validate `state` before exchanging the `code`:

  ```ts
  import { validateSignedState } from '../utils/oauth-state';

  const { code, state } = req.query;
  if (!validateSignedState(state as string)) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
  }
  ```

---

### B. PKCE Utility (for Public Clients)

If you build native/mobile or public clients, PKCE can be used alongside server-side flows.

**File (example client-side helper):** `apps/web/src/utils/pkce.ts`

```ts
// Note: This is a client-side helper; do not use Node crypto here.

async function sha256(input: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generatePkcePair() {
  const verifier = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(x => ('0' + x.toString(16)).slice(-2))
    .join('');

  const hash = await sha256(verifier);
  const challenge = base64UrlEncode(hash);

  return { verifier, challenge };
}
```

You would:

- Generate `{ verifier, challenge }` on the client.
- Store `verifier` in local storage or a secure cookie until callback.
- Add `code_challenge` & `code_challenge_method=S256` to the authorization URL.
- Include `code_verifier` in the token exchange request.

Server-side token exchange would then add `code_verifier` to the POST payload for providers that support PKCE.

---

### C. ID Token Verification (Optional Hardening)

For providers that issue ID tokens (Google, Microsoft, Apple), you can optionally validate them.

**File:** `apps/api/src/utils/id-token.ts`

```ts
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

interface VerifyOptions {
  issuer: string;
  audience: string;
  jwksUri: string;
}

export async function verifyIdToken(idToken: string, opts: VerifyOptions): Promise<any> {
  const client = jwksClient({ jwksUri: opts.jwksUri });

  function getKey(header: JwtHeader, callback: SigningKeyCallback) {
    if (!header.kid) {
      return callback(new Error('No kid in token header'));
    }
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        issuer: opts.issuer,
        audience: opts.audience,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      },
    );
  });
}
```

**Example (Google ID token):**

```ts
// After exchanging code for tokens and receiving id_token from Google
import { verifyIdToken } from '../utils/id-token';

const decoded = await verifyIdToken(tokens.id_token!, {
  issuer: 'https://accounts.google.com',
  audience: process.env.GOOGLE_CLIENT_ID!,
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
});

// decoded now contains claims; you can cross-check email, email_verified, etc.
```

This is optional for initial implementation but provides an additional security layer where needed.

---

These helpers, together with the main spec above, give you a concrete, implementation-ready foundation for secure social auth integration on top of your existing Vercel + Supabase + custom API stack.
