import { permanentRedirect } from 'next/navigation';

// The bare /tenant root is the base of the storefront address space —
// /tenant/{id} is the path-form canonical for hostless tenants, but the root
// itself has no display surface. Consolidate onto /shops, the declared
// storefront browse index (PLACES_SEO_INDEXING_SPEC §4.9). On a tenant host
// the proxy canonicalizes bare /tenant to '/' before this page is reached.
export default function TenantIndexRedirect() {
  permanentRedirect('/shops');
}
