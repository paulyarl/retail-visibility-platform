# Auth0 Next.js SDK Setup

> ⚠️ **This is a migration-era SDK setup guide and parts of it have drifted from the
> deployed configuration.** For the authoritative record of the Auth0 tenant, its
> applications, allowlist rules, the Google OAuth relationships, and host/domain config,
> see **[AUTH_CONFIG_SECURITY.md](./AUTH_CONFIG_SECURITY.md)** — including how to verify a
> change actually took effect. In particular, the `AUTH0_CLIENT_ID` below is the **staging**
> application and must not be used for local development.
>
> Known drift in this file: paths (`apps/web/lib/…` vs actual `apps/web/src/lib/…`),
> `APP_BASE_URL` (the SDK infers the base URL from the request host; it is not set), the
> "HttpOnly cookies" claim (the identity cookies `auth0_email` / `auth0_id` are set with
> `httpOnly: false`), and the absence of any mention of allowlist wildcards.

This guide walks you through setting up secure OAuth 2.0 authentication using the official Auth0 Next.js SDK.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install @auth0/nextjs-auth0@4.x
# or
pnpm add @auth0/nextjs-auth0@4.x
```

### 2. Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Fill in your values from the Auth0 dashboard:

```env
# From your Auth0 dashboard
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=dev-jaiggvvi3zsttaoo.us.auth0.com
# Local dev needs its OWN Auth0 application — never the staging one.
# (The staging app is `Visible Shelf`.) Pointing local dev at staging means
# local logins use staging's allowlist and user pool. Create e.g.
# `visible-shelf-local-dev` with only http://localhost:3000/auth/callback
# allowlisted. See AUTH_CONFIG_SECURITY.md §2.
AUTH0_CLIENT_ID=your_local_dev_client_id_here
AUTH0_CLIENT_SECRET=your_auth0_client_secret_here
AUTH0_SECRET=your_auth0_secret_here

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_FF_TENANT_URLS=true
```

### 3. Files Created

The following files have been automatically created:

- `apps/web/lib/auth0.ts` - Auth0 client configuration
- `apps/web/proxy.ts` - Updated with Auth0 middleware integration
- `apps/web/app/page.tsx` - Home page with authentication state
- `apps/web/.env.local.example` - Environment variables template

### 4. Test the Setup

```bash
cd apps/web
pnpm dev
```

Visit `http://localhost:3000` to test authentication.

## 🔧 How It Works

### Auth0 Middleware Integration

The proxy.ts file has been updated to integrate Auth0's middleware:

```typescript
import { auth0 } from './lib/auth0';

export async function proxy(req: NextRequest) {
  // First, let Auth0 handle authentication routes
  const authResponse = await auth0.middleware(req);
  
  // If Auth0 handled the request (auth routes), return the response
  if (authResponse) {
    return authResponse;
  }

  // Continue with existing proxy logic for non-auth routes
  // ... rest of your existing proxy logic
}
```

### Automatic Auth Routes

Auth0 automatically provides these routes:

- `/auth/login` - Redirects to Auth0 login page
- `/auth/logout` - Logs out the user
- `/auth/callback` - Handles the OAuth callback
- `/auth/profile` - Returns the user profile as JSON
- `/auth/access-token` - Returns the access token

### Server-Side Session Access

In any server component or API route:

```typescript
import { auth0 } from '@/lib/auth0';

export default async function MyComponent() {
  const session = await auth0.getSession();
  
  if (session) {
    // User is authenticated
    return <div>Welcome {session.user.name}!</div>;
  }
  
  return <div>Please sign in</div>;
}
```

## 🛡️ Security Benefits

1. **No Password Transmission** - Credentials never touch your server
2. **PKCE Implementation** - Built into Auth0 SDK
3. **Secure Session Storage** - HttpOnly cookies
4. **Automatic Token Management** - Refresh tokens handled automatically
5. **CSRF Protection** - Built-in state validation
6. **Enterprise Grade** - Auth0 handles security infrastructure

## 🔄 Migration from Existing Auth

### Before (Plaintext Credentials)
```typescript
// ❌ Insecure - sends password in JSON
await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

### After (Secure Auth0)
```typescript
// ✅ Secure - redirects to Auth0
<Link href="/auth/login">
  <Button>Sign In</Button>
</Link>
```

## 🎯 Custom Claims Setup

### 1. Configure Auth0 Actions

In your Auth0 dashboard:

1. Go to **Actions → Flows → Login Flow**
2. Add a new Action with this code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Add custom claims for your application
  api.accessToken.setCustomClaim('https://yourapp.com/role', event.user.app_metadata.role || 'USER');
  api.accessToken.setCustomClaim('https://yourapp.com/tenant_ids', event.user.app_metadata.tenant_ids || []);
  api.accessToken.setCustomClaim('https://yourapp.com/isAdmin', event.user.app_metadata.isAdmin || false);
  
  // You can also add ID token claims
  api.idToken.setCustomClaim('role', event.user.app_metadata.role || 'USER');
  api.idToken.setCustomClaim('tenant_ids', event.user.app_metadata.tenant_ids || []);
};
```

### 2. Access Custom Claims

```typescript
const session = await auth0.getSession();
const userRole = session.user['https://yourapp.com/role'];
const tenantIds = session.user['https://yourapp.com/tenant_ids'];
const isAdmin = session.user['https://yourapp.com/isAdmin'];
```

## 🚀 Production Deployment

### 1. Update Environment Variables

```env
APP_BASE_URL=https://yourdomain.com
AUTH0_DOMAIN=your-production-domain.auth0.com
```

### 2. Update Auth0 Application

In your Auth0 dashboard:

1. Add your production URL to **Allowed Callback URLs**:
   - `https://yourdomain.com/auth/callback`

2. Add your production URL to **Allowed Logout URLs**:
   - `https://yourdomain.com`

3. Add your production URL to **Allowed Web Origins**:
   - `https://yourdomain.com`

### 3. Enable HTTPS

Auth0 requires HTTPS in production. Ensure your domain has SSL/TLS configured.

## 📚 Additional Resources

- [Auth0 Next.js SDK Documentation](https://auth0.com/docs/quickstart/webapp/nextjs)
- [Auth0 Actions Documentation](https://auth0.com/docs/actions)
- [Custom Claims Guide](https://auth0.com/docs/tokens/guides/create-custom-claims)

## 🎉 Benefits Achieved

✅ **Enterprise Security** - Auth0 handles authentication infrastructure  
✅ **Zero Password Exposure** - No credentials transmitted  
✅ **Automatic Session Management** - Built-in token refresh  
✅ **Scalable** - Handles millions of users  
✅ **Compliant** - GDPR, SOC2, HIPAA ready  
✅ **Developer Friendly** - Simple API, great TypeScript support  

Your application now has enterprise-grade authentication without managing security infrastructure!
