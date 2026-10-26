import { platformOrigin } from '@/lib/storefront-routing';

const SOCIAL_PROFILES = [
  'https://facebook.com/shelfvisible',
  'https://instagram.com/shelfvisible',
  'https://x.com/shelfvisible',
  'https://www.linkedin.com/company/visibleshelf',
  'https://pinterest.com/shelfvisible',
  'https://tiktok.com/@shelfvisible',
  'https://threads.net/@shelfvisible',
];

/**
 * Platform-level JSON-LD (Organization + WebSite) emitted once from the root
 * layout. Per-listing LocalBusiness/BreadcrumbList schema lives in
 * components/directory/StructuredData.tsx — this declares the platform entity
 * itself so engines can disambiguate `VisibleShelf` from same-phrase sites
 * (e.g. thevisibleshelf.com). Rendered as a real <script> tag (not
 * metadata.other) so crawlers pick it up.
 */
export function PlatformStructuredData() {
  const origin = platformOrigin();
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'VisibleShelf',
        alternateName: 'Visible Shelf',
        url: origin,
        logo: `${origin}/icons/icon-512x512.png`,
        description:
          'Retail visibility platform connecting local merchant inventory to Google Shopping, storefronts, and a public directory.',
        sameAs: SOCIAL_PROFILES,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+1-913-703-6157',
          contactType: 'customer support',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: 'VisibleShelf',
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON-LD is data, not markup — escaping the closing-tag sequence keeps
      // the blob parseable if a string ever contains "</script>".
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }}
    />
  );
}
