# Social Authentication Implementation Plan

**Status:** 📋 PLANNED - OAuth 2.0 Integration  
**Created:** November 12, 2025  
**Priority:** High (Modern auth standard)

---

## Executive Summary

Modernize authentication by adding OAuth 2.0 social login providers (Google, Microsoft, Apple) alongside existing email/password authentication.

**Current:** Email/password only  
**Future:** Email/password + Google + Microsoft + Apple + GitHub (optional)

---

## Goals

1. **Reduce friction** - One-click login with existing accounts
2. **Improve security** - Leverage provider's 2FA/MFA
3. **Increase conversions** - Reduce registration abandonment
4. **Better UX** - No password to remember
5. **Trust signals** - Verified email from trusted providers

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Database Schema Updates**

```prisma
model User {
  // ... existing fields
  
  // OAuth fields
  oauthProvider    String?  @map("oauth_provider")    // google, microsoft, apple, github
  oauthProviderId  String?  @map("oauth_provider_id") // Provider's user ID
  oauthEmail       String?  @map("oauth_email")       // Email from provider
  oauthPicture     String?  @map("oauth_picture")     // Profile picture URL
  
  @@unique([oauthProvider, oauthProviderId])
  @@index([oauthProvider])
  @@index([oauthProviderId])
}
```

**OAuth Configuration Service**

```typescript
// apps/api/src/config/oauth.ts
export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/auth/google/callback`,
    scopes: ['openid', 'email', 'profile'],
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/auth/microsoft/callback`,
    scopes: ['openid', 'email', 'profile'],
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY,
    redirectUri: `${process.env.API_URL}/auth/apple/callback`,
    scopes: ['email', 'name'],
  },
};
```

---

### Phase 2: Google OAuth (Week 2)

**Backend Implementation**

```typescript
// apps/api/src/routes/auth-google.ts
router.get('/auth/google', (req, res) => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.google.clientId);
  authUrl.searchParams.set('redirect_uri', config.google.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.google.scopes.join(' '));
  authUrl.searchParams.set('state', generateSecureState());
  
  res.redirect(authUrl.toString());
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state
  // Exchange code for tokens
  // Get user info
  // Create or update user
  // Generate JWT tokens
  // Redirect to frontend with tokens
});
```

**Frontend UI**

```tsx
// apps/web/src/components/auth/SocialLoginButtons.tsx
export function SocialLoginButtons() {
  return (
    <div className="space-y-3">
      <button
        onClick={() => window.location.href = `${API_URL}/auth/google`}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>
    </div>
  );
}
```

---

### Phase 3: Microsoft OAuth (Week 3)

Similar to Google but using Microsoft Identity Platform (Azure AD).

---

### Phase 4: Apple Sign In (Week 4)

Apple has unique requirements (private email relay, JWT validation).

---

### Phase 5: Account Linking (Week 5)

Allow users to link multiple OAuth providers to one account.

---

## Security Considerations

- PKCE flow for mobile apps
- State parameter validation (CSRF protection)
- Secure token storage
- Email verification from providers
- Account takeover prevention

---

## Testing Strategy

- OAuth flow testing
- Token validation
- Account linking scenarios
- Error handling
- Security testing

---

## Rollout Plan

1. Beta test with internal users
2. Enable for 10% of users
3. Monitor metrics
4. Full rollout

---

**Total Timeline:** 5-6 weeks  
**Cost:** Provider setup fees (Apple: $99/year)  
**Priority:** High - Modern auth standard

