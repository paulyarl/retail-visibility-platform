/**
 * Schema.org Structured Data Utilities
 * 
 * Generates JSON-LD markup for SEO optimization
 * Target: Rich Result Coverage ≥90%
 */

import React from 'react';
import type { BusinessProfile } from '@/lib/validation/businessProfile';
import type { SwisPreviewItem } from '@/components/tenant/SwisPreviewWidget';

/**
 * Generate LocalBusiness schema markup
 * 
 * @param profile - Business profile data
 * @returns JSON-LD schema object
 */
export function generateLocalBusinessSchema(profile: BusinessProfile & {
  latitude?: number;
  longitude?: number;
  phone_number: string;
  email: string;
}) {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: profile.business_name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: profile.address_line2 
        ? `${profile.address_line1}, ${profile.address_line2}`
        : profile.address_line1,
      addressLocality: profile.city,
      addressRegion: profile.state || undefined,
      postalCode: profile.postal_code,
      addressCountry: profile.country_code,
    },
    telephone: profile.phone_number,
    email: profile.email,
  };

  // Add geo coordinates if available
  if (profile.latitude && profile.longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: profile.latitude.toString(),
      longitude: profile.longitude.toString(),
    };
  }

  // Add website if available
  if (profile.website) {
    schema.url = profile.website;
  }

  // Add hours if available
  if (profile.hours && typeof profile.hours === 'object') {
    schema.openingHoursSpecification = formatOpeningHours(profile.hours);
  }

  // Add social links if available
  if (profile.social_links && typeof profile.social_links === 'object') {
    schema.sameAs = Object.values(profile.social_links).filter(Boolean);
  }

  return schema;
}

/**
 * Generate Product schema markup
 * 
 * @param product - Product data from SWIS preview
 * @param tenantName - Tenant business name
 * @returns JSON-LD schema object
 */
export function generateProductSchema(
  product: SwisPreviewItem,
  tenantName: string
) {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: product.currency,
      availability: getSchemaAvailability(product.availability),
      seller: {
        '@type': 'Organization',
        name: tenantName,
      },
    },
  };

  // Add brand if available
  if (product.brand) {
    schema.brand = {
      '@type': 'Brand',
      name: product.brand,
    };
  }

  // Add image if available
  if (product.image_url) {
    schema.image = product.image_url;
  }

  // Add category if available
  if (product.categoryPath && product.categoryPath.length > 0) {
    schema.category = product.categoryPath.join(' > ');
  }

  return schema;
}

/**
 * Generate ItemList schema for product collection
 * 
 * @param products - Array of products
 * @param tenantName - Tenant business name
 * @returns JSON-LD schema object
 */
export function generateProductListSchema(
  products: SwisPreviewItem[],
  tenantName: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateProductSchema(product, tenantName),
    })),
  };
}

/**
 * Convert availability status to Schema.org format
 * 
 * @param availability - Product availability status
 * @returns Schema.org availability URL
 */
function getSchemaAvailability(
  availability: 'in_stock' | 'out_of_stock' | 'preorder'
): string {
  switch (availability) {
    case 'in_stock':
      return 'https://schema.org/InStock';
    case 'out_of_stock':
      return 'https://schema.org/OutOfStock';
    case 'preorder':
      return 'https://schema.org/PreOrder';
    default:
      return 'https://schema.org/InStock';
  }
}

/**
 * Format opening hours for Schema.org
 * 
 * @param hours - Hours object (day -> time string)
 * @returns Array of OpeningHoursSpecification objects
 */
function formatOpeningHours(hours: Record<string, string>): any[] {
  const dayMap: Record<string, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };

  return Object.entries(hours)
    .filter(([_, time]) => time && time !== 'closed')
    .map(([day, time]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: dayMap[day.toLowerCase()] || day,
      opens: time.split('-')[0]?.trim() || '09:00',
      closes: time.split('-')[1]?.trim() || '17:00',
    }));
}

/**
 * Render JSON-LD script tag
 * 
 * @param schema - Schema object
 * @returns Script tag HTML string
 */
export function renderJsonLd(schema: any): string {
  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

/**
 * React component for JSON-LD script injection
 * 
 * @param schema - Schema object
 * @returns JSX element
 */
export function JsonLd({ schema }: { schema: any }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Validate schema markup
 * 
 * @param schema - Schema object to validate
 * @returns Validation result
 */
export function validateSchema(schema: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required @context
  if (!schema['@context']) {
    errors.push('Missing @context');
  }

  // Check required @type
  if (!schema['@type']) {
    errors.push('Missing @type');
  }

  // Type-specific validation
  if (schema['@type'] === 'LocalBusiness') {
    if (!schema.name) errors.push('LocalBusiness missing name');
    if (!schema.address) errors.push('LocalBusiness missing address');
  }

  if (schema['@type'] === 'Product') {
    if (!schema.name) errors.push('Product missing name');
    if (!schema.offers) errors.push('Product missing offers');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate breadcrumb schema
 * 
 * @param items - Breadcrumb items
 * @returns JSON-LD schema object
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
