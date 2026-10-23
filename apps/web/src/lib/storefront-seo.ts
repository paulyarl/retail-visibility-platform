/**
 * Storefront SEO labels + JSON-LD (spec §4.9 / RC11).
 *
 * Structured data is basic discoverability, not a paid enhancement: it is
 * emitted for every tenant, outside the `enhanced_seo` capability. The
 * capability still gates keywords and enriched copy.
 */

export interface StorefrontTypeLabel {
  title: string;
  desc: string;
  schemaType: string;
}

export const STOREFRONT_TYPE_LABELS: Record<string, StorefrontTypeLabel> = {
  retail: { title: 'Store Catalog', desc: 'Browse products', schemaType: 'Store' },
  online: { title: 'Online Store', desc: 'Shop online', schemaType: 'OnlineStore' },
  service: { title: 'Services', desc: 'Book professional services', schemaType: 'Service' },
  social: { title: 'Shop', desc: 'Discover and shop', schemaType: 'Store' },
  flexible: { title: 'Store & Services', desc: 'Browse products and services', schemaType: 'Store' },
  none: { title: 'Storefront', desc: 'View store', schemaType: 'Store' },
};

export function storefrontTypeLabel(type: string | null | undefined): StorefrontTypeLabel {
  return STOREFRONT_TYPE_LABELS[type ?? ''] ?? STOREFRONT_TYPE_LABELS.retail;
}

export interface StorefrontSchemaAddress {
  streetAddress?: string | null;
  addressLocality?: string | null;
  addressRegion?: string | null;
  postalCode?: string | null;
  addressCountry?: string | null;
}

export interface StorefrontSchemaInput {
  type: string | null | undefined;
  businessName: string;
  description: string;
  imageUrl?: string | null;
  address?: StorefrontSchemaAddress | null;
  telephone?: string | null;
  email?: string | null;
  website?: string | null;
  keywords?: string[] | null;
}

/** `PostalAddress` with null/empty fields stripped — JSON-LD should not carry nulls. */
function postalAddress(address: StorefrontSchemaAddress): Record<string, string> | undefined {
  const entries = Object.entries(address).filter(
    ([, value]) => typeof value === 'string' && value.trim() !== '',
  ) as [string, string][];
  if (entries.length === 0) return undefined;
  return { '@type': 'PostalAddress', ...Object.fromEntries(entries) };
}

export function buildStorefrontSchema(input: StorefrontSchemaInput): Record<string, unknown> {
  const label = storefrontTypeLabel(input.type);
  const address = input.address ? postalAddress(input.address) : undefined;
  const keywords = (input.keywords ?? []).filter((tag) => tag && tag.trim() !== '');

  return {
    '@context': 'https://schema.org',
    '@type': label.schemaType,
    name: input.businessName,
    description: input.description,
    image: input.imageUrl ? [input.imageUrl] : undefined,
    address,
    telephone: input.telephone || undefined,
    email: input.email || undefined,
    website: input.website || undefined,
    keywords: keywords.length > 0 ? keywords.join(', ') : undefined,
  };
}
