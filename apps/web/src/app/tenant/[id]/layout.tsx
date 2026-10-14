import { headers } from 'next/headers';
import { isTenantHostName, platformOrigin } from '@/lib/storefront-routing';
import { StorefrontUrlProvider } from '@/components/storefront/StorefrontUrlContext';

/**
 * /tenant/[id] segment layout — mounts the storefront URL delegate for the
 * whole storefront tree (home, /services, /policies/*).
 *
 * On a tenant host (platform subdomain or tenant-owned custom domain) the
 * storefront IS the origin, so components emit host-relative paths
 * ('/', '/policies/x'). On the platform app they emit /tenant/{id}-prefixed
 * paths. The flag is computed from the request host — already resolved and
 * gated by the proxy, never a spoofable client input.
 */
export default async function TenantStorefrontLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const hdrs = await headers();
  const host = (hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? '').split(':')[0];
  const tenantHost = isTenantHostName(host);
  const origin = tenantHost
    ? `${host.includes('localhost') ? 'http' : 'https'}://${host}`
    : platformOrigin();

  return (
    <StorefrontUrlProvider tenantId={id} tenantHost={tenantHost} origin={origin}>
      {children}
    </StorefrontUrlProvider>
  );
}
