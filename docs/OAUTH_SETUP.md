# OAuth 2.0 Setup with NextAuth.js + Auth0

This guide walks you through setting up secure OAuth 2.0 authentication using NextAuth.js and Auth0.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install next-auth
# or
pnpm add next-auth
```

### 2. Auth0 Setup

1. **Create Auth0 Account**
   - Go to [https://auth0.com](https://auth0.com)
   - Sign up for a free account

2. **Create Application**
   - Dashboard → Applications → Applications → Create Application
   - Name: `Your App Name`
   - Application Type: `Single Page Web Applications`
   - Click Create

3. **Configure Application**
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback/auth0`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`
   - **Allowed Origins (CORS)**: `http://localhost:3000`

4. **Create API (if not exists)**
   - Dashboard → Applications → APIs → Create API
   - Name: `Your API Name`
   - Identifier: `https://your-api.com` (this is your audience)
   - Signing Algorithm: `RS256`

5. **Enable RBAC (Optional)**
   - In your API settings → Enable RBAC
   - Add Permissions for fine-grained access control

### 3. Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your values:

```env
# Auth0 Configuration
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret
AUTH0_ISSUER=https://your-domain.auth0.com
AUTH0_AUDIENCE=https://your-api.com

# NextAuth.js Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your_nextauth_secret_here

# NextAuth.js URL (your app's base URL)
NEXTAUTH_URL=http://localhost:3000
```

### 4. Update App Layout

In your `app/layout.tsx`:

```tsx
import { NextAuthProvider } from '@/contexts/NextAuthContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  )
}
```

### 5. Replace AuthContext Usage

Replace imports from:

```tsx
// OLD
import { useAuth } from '@/contexts/AuthContext'
```

To:

```tsx
// NEW
import { useAuth } from '@/contexts/NextAuthContext'
```

### 6. Test the Setup

```bash
npm run dev
# or
pnpm dev
```

Visit `http://localhost:3000/auth/signin` to test authentication.

## 🔧 Configuration Options

### Custom Claims

Add custom claims to your Auth0 token:

```javascript
// In Auth0 Dashboard → Actions → Flows → Login Flow
function addCustomClaims(event, api) {
  // Add custom claims
  api.accessToken.setCustomClaim('https://yourapp.com/role', event.user.app_metadata.role);
  api.accessToken.setCustomClaim('https://yourapp.com/tenant_ids', event.user.app_metadata.tenant_ids);
  
  return event;
}
```

### Route Protection

The middleware automatically protects routes. Protected routes include:
- `/dashboard`
- `/profile`
- `/settings`
- `/admin`
- `/merchants`

### API Integration

Your API routes now receive user information in headers:

```typescript
// In your API routes
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  const userRole = request.headers.get('x-user-role')
  
  // Use user info for authorization
}
```

## 🛡️ Security Benefits

1. **No Password Transmission** - Credentials never touch your server
2. **PKCE Implementation** - Prevents authorization code interception
3. **Automatic Token Management** - NextAuth.js handles refresh tokens
4. **CSRF Protection** - Built-in state parameter validation
5. **Secure Storage** - Tokens stored in httpOnly cookies
6. **Session Management** - Automatic session expiration and renewal

## 🔄 Migration from AuthContext

The `NextAuthContext` provides the same interface as your existing `AuthContext`:

```typescript
// These work exactly the same
const { user, isAuthenticated, login, logout } = useAuth()

// Login now redirects to Auth0 instead of sending credentials
await login(email, password) // Redirects to Auth0 login page
```

## 🚀 Production Deployment

1. **Update Environment Variables**
   ```env
   NEXTAUTH_URL=https://yourdomain.com
   AUTH0_ISSUER=https://your-domain.auth0.com
   ```

2. **Update Auth0 Callback URLs**
   - Add your production URL: `https://yourdomain.com/api/auth/callback/auth0`
   - Add logout URL: `https://yourdomain.com`

3. **Enable HTTPS** (required for production)

## 📚 Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Auth0 Documentation](https://auth0.com/docs)
- [OAuth 2.0 Best Practices](https://auth0.com/docs/secure/security-guidelines/oauth-best-practices)

## 🎯 Next Steps

1. **Test thoroughly** in development
2. **Set up production Auth0 application**
3. **Configure custom claims** for your business logic
4. **Implement role-based access control**
5. **Add multi-factor authentication** (optional)

This setup provides enterprise-grade security without the complexity of managing authentication infrastructure.
