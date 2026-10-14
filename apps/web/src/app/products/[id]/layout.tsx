import { headers } from 'next/headers';
import { isTenantHostName, platformOrigin } from '@/lib/storefront-routing';
import { StorefrontUrlProvider } from '@/components/storefront/StorefrontUrlContext';

/**
 * /products/[id] segment layout — storefront URL delegate for product pages.
 * Product detail is a passthrough root on tenant hosts, so "Back to store"
 * and product-nav links must resolve host-relative there. No tenantId is
 * known at this level — call sites pass it to the hooks per product.
 */
export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const host = (hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? '').split(':')[0];
  const tenantHost = isTenantHostName(host);
  const origin = tenantHost
    ? `${host.includes('localhost') ? 'http' : 'https'}://${host}`
    : platformOrigin();

  return (
    <StorefrontUrlProvider tenantId="" tenantHost={tenantHost} origin={origin}>
      {children}
    </StorefrontUrlProvider>
  );
}
