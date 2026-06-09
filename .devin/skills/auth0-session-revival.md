# Auth0 Session Revival — Agent Skill Recipe

## Scope
Apply this skill when an authenticated Next.js page in `apps/web` does **not** properly redirect to `/auth/login` after an Auth0 session expires, or when users land on `/` instead of their original page after re-login.

## Context

- Auth method: Auth0 Next.js SDK with **cookie-based sessions** (not Bearer tokens).
- Session lifetime: ~1 day.
- Auth0 SDK callback (`lib/auth0.ts`) reads `ctx.returnTo` to redirect after login.
- Query parameter `next` is **ignored** by the SDK.

## Two-Layer Protection Pattern

Every authenticated route needs **both** layers:

| Layer | Catches | Location |
|-------|---------|----------|
| Server-side gate | Expired session on hard refresh / direct URL | `layout.tsx` or `page.tsx` |
| Client-side gate | Expired session during client navigation or while on page | Layout `useEffect` or `TenantAuthGate`-style wrapper |

---

## Recipe

### Step 1 — Inspect the current server-side redirect

Open the route's `layout.tsx` or `page.tsx`.

Look for these anti-patterns:

- `redirect(`/auth/login?next=...`)`  → wrong parameter name
- `await auth0.getSession()` without `try/catch` → can throw 500 on expired cookies
- Missing redirect entirely → unauthenticated users see broken UI

### Step 2 — Fix the server-side gate

Use this template (swap `<RoutePath>` for the actual path, e.g. `/t/${tenantId}/dashboard`):

```tsx
import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';

export default async function MyLayout({ children }) {
  let session = null;
  try {
    session = await auth0.getSession();
  } catch {
    // Expired or malformed cookies — treat as unauthenticated
    session = null;
  }

  if (!session?.user) {
    const returnPath = '<RoutePath>';
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnPath)}`);
  }

  // ... rest of layout
}
```

**Rules**
- Always use **`returnTo`** in the query string.
- Always wrap `auth0.getSession()` in `try/catch`.

### Step 3 — Add the client-side gate

If the route layout is a Server Component (it almost always is), add a lightweight Client Component gate.

Create once, reuse everywhere:

`apps/web/src/components/auth/AuthGate.tsx`

```tsx
"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
```

Then wrap the page content:

```tsx
import AuthGate from "@/components/auth/AuthGate";

export default async function MyPage() {
  return (
    <AuthGate>
      {/* actual page content */}
    </AuthGate>
  );
}
```

If the layout is already a Client Component (like `tenants/layout.tsx`), put the `useEffect` redirect directly in the layout instead of adding another wrapper.

### Step 4 — Verify the API layer fallback

Client-side API calls that return **401** should also trigger login revival.

Check `apps/web/src/lib/api.ts`. Ensure this block exists inside `apiRequest`:

```tsx
if (resp.status === 401 && typeof window !== 'undefined' && !(options as any).skipAuthRedirect) {
  try {
    const pathname = window.location.pathname;
    const alreadyRedirecting = sessionStorage.getItem('auth_redirecting') === '1';
    if (!alreadyRedirecting && pathname !== '/login' && pathname !== '/auth/login') {
      sessionStorage.setItem('auth_redirecting', '1');
      const returnTo = encodeURIComponent(pathname + window.location.search);
      window.location.href = `/auth/login?returnTo=${returnTo}`;
    }
  } catch {}
}
```

If it is missing, add it.

### Step 5 — Type-check

Run from repo root:

```bash
pnpm checkweb
```

Fix any TypeScript errors before proceeding.

### Step 6 — Manual test

1. Log in and navigate to the protected page.
2. Open DevTools → Application → Cookies and delete the `auth0` session cookie(s).
3. Hard-refresh the page.
4. **Expected**: redirect to Auth0 login → after login → back on the original page.
5. While on the page, trigger an API call (e.g. click a button that fetches data).
6. Delete the cookie again and re-trigger the API call.
7. **Expected**: `apiRequest` 401 handler redirects to login, then back to the page.

---

## Reference — Existing implementations in this repo

| Route | Server gate | Client gate | Notes |
|-------|-------------|-------------|-------|
| `/tenants` | No | Yes (`useEffect` in `layout.tsx`) | Uses `router.push` with `returnTo` |
| `/settings` | No | Yes (`useEffect` in `layout.tsx`) | Same pattern as `/tenants` |
| `/t/:tenantId` | Yes (`layout.tsx`) | No | Uses `TenantAuthGate` on `dashboard` only |
| `/t/:tenantId/dashboard` | Inherited from layout | Yes (`TenantAuthGate`) | Dual-layer protection |

---

## Common Pitfalls

1. **Using `next` instead of `returnTo`**
   The Auth0 SDK callback (`lib/auth0.ts`) reads `ctx.returnTo`. Using `next` causes users to land on `/` after login.

2. **Not wrapping `auth0.getSession()` in `try/catch`**
   Expired cookies can throw an exception, resulting in a 500 error page instead of a clean redirect.

3. **Missing client-side gate**
   Server-side redirects only run on initial load. If the user's session expires while they are already on the page (e.g., after a long idle period), only the client-side gate or the `apiRequest` 401 handler will catch it.

4. **Client-only redirect uses `window.location.href` instead of Next.js `router.push`**
   Inside React components, prefer `router.push` for client-side navigation to preserve Next.js routing state. Use `window.location.href` only in non-React utilities like `apiRequest`.

---

## Quick Copy-Paste — Auth0 Session Check Block

```tsx
let session = null;
try {
  session = await auth0.getSession();
} catch {
  session = null;
}
if (!session?.user) {
  redirect(`/auth/login?returnTo=${encodeURIComponent('<path>')}`);
}
```
