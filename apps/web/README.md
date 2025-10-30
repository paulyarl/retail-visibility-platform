This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Feature Flags

- FF_APP_SHELL_NAV: Enables the new header with Tenant Switcher. Dev/test override is available by setting `localStorage.ff_app_shell_nav = 'on'`.
- FF_TENANT_URLS: Enables URL-driven tenant context under `/t/{tenantId}/...`.

## Tenant URL Patterns

- `/t/{tenantId}/dashboard` → Renders legacy dashboard with the route tenant applied.
- `/t/{tenantId}/items` → Renders legacy Items page. SSR receives `tenantId` via `searchParams`.
- `/t/{tenantId}/users` → Renders legacy Users page.
- `/t/{tenantId}/settings/tenant` → Renders Tenant Settings page.
- `/onboarding?tenantId={id}` → Onboarding-first flow when profile is incomplete. Business Name is prefilled from tenant name.

Client sets and reads `localStorage.tenantId` and `localStorage.current_tenant_id`. SSR guards read `access_token` cookie set by the app on login/refresh.
