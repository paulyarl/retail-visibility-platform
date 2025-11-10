/**
 * Structured Data Component
 * Generates JSON-LD structured data for SEO
 */

interface LocalBusinessData {
  business_name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  latitude?: number;
  longitude?: number;
  business_hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  primary_category?: string;
  rating_avg?: number;
  rating_count?: number;
}

interface StructuredDataProps {
  listing: LocalBusinessData;
  url: string;
}

export function LocalBusinessStructuredData({ listing, url }: StructuredDataProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: listing.business_name,
    url: url,
    ...(listing.logo_url && { image: listing.logo_url }),
    ...(listing.phone && { telephone: listing.phone }),
    ...(listing.email && { email: listing.email }),
    ...(listing.website && { url: listing.website }),
    ...(listing.primary_category && { '@type': mapCategoryToSchemaType(listing.primary_category) }),
    
    // Address
    ...(listing.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: listing.address,
        addressLocality: listing.city,
        addressRegion: listing.state,
        postalCode: listing.zip_code,
        addressCountry: listing.country || 'US',
      },
    }),
    
    // Geo coordinates
    ...(listing.latitude && listing.longitude && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: listing.latitude,
        longitude: listing.longitude,
      },
    }),
    
    // Opening hours
    ...(listing.business_hours && {
      openingHoursSpecification: Object.entries(listing.business_hours)
        .filter(([_, hours]) => !hours.closed)
        .map(([day, hours]) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: capitalizeDay(day),
          opens: hours.open,
          closes: hours.close,
        })),
    }),
    
    // Ratings
    ...(listing.rating_avg && listing.rating_count && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: listing.rating_avg,
        reviewCount: listing.rating_count,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

// Helper to map categories to Schema.org types
function mapCategoryToSchemaType(category: string): string {
  const categoryMap: Record<string, string> = {
    restaurant: 'Restaurant',
    grocery: 'GroceryStore',
    retail: 'Store',
    clothing: 'ClothingStore',
    electronics: 'ElectronicsStore',
    furniture: 'FurnitureStore',
    hardware: 'HardwareStore',
    pharmacy: 'Pharmacy',
    bakery: 'Bakery',
    cafe: 'CafeOrCoffeeShop',
    bar: 'BarOrPub',
    gym: 'ExerciseGym',
    salon: 'BeautySalon',
    spa: 'DaySpa',
    hotel: 'Hotel',
    // Add more mappings as needed
  };

  const normalized = category.toLowerCase().trim();
  return categoryMap[normalized] || 'LocalBusiness';
}

// Helper to capitalize day names for Schema.org
function capitalizeDay(day: string): string {
  const dayMap: Record<string, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };

  return dayMap[day.toLowerCase()] || day;
}

// Breadcrumb structured data
interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbStructuredData({ items }: BreadcrumbStructuredDataProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
