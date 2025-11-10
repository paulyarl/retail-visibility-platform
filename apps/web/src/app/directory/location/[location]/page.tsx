import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { DirectoryGrid } from '@/components/directory/DirectoryGrid';
import { BreadcrumbStructuredData } from '@/components/directory/StructuredData';

interface LocationPageProps {
  params: {
    location: string; // Format: "city-state" e.g., "brooklyn-ny"
  };
  searchParams: {
    page?: string;
  };
}

// Parse location slug into city and state
function parseLocation(locationSlug: string): { city: string; state: string } | null {
  const parts = locationSlug.split('-');
  if (parts.length < 2) return null;
  
  // Last part is state, everything else is city
  const state = parts[parts.length - 1].toUpperCase();
  const city = parts.slice(0, -1).join(' ');
  
  return {
    city: city.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    state,
  };
}

// Format location for display
function formatLocation(city: string, state: string): string {
  return `${city}, ${state}`;
}

async function getLocationListings(city: string, state: string, page: number = 1) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const limit = 12;
  
  try {
    const res = await fetch(
      `${apiUrl}/api/directory/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&page=${page}&limit=${limit}`,
      { next: { revalidate: 300 } }
    );

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching location listings:', error);
    return null;
  }
}

// Get nearby locations for suggestions
async function getNearbyLocations(currentCity: string, currentState: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/directory/locations`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    
    // Filter out current location and limit to 6
    return data.locations
      .filter((loc: any) => 
        loc.city.toLowerCase() !== currentCity.toLowerCase() || 
        loc.state.toLowerCase() !== currentState.toLowerCase()
      )
      .slice(0, 6);
  } catch (error) {
    console.error('Error fetching nearby locations:', error);
    return [];
  }
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { location } = await params;
  const parsed = parseLocation(location);

  if (!parsed) {
    return {
      title: 'Location Not Found',
    };
  }

  const locationName = formatLocation(parsed.city, parsed.state);
  const title = `Local Businesses in ${locationName} - Business Directory`;
  const description = `Discover local businesses, shops, and services in ${locationName}. Find stores, restaurants, and more in your area.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function LocationPage({ params, searchParams }: LocationPageProps) {
  const { location } = await params;
  const page = Number(searchParams.page) || 1;
  
  const parsed = parseLocation(location);

  if (!parsed) {
    notFound();
  }

  const { city, state } = parsed;
  const locationName = formatLocation(city, state);

  const [data, nearbyLocations] = await Promise.all([
    getLocationListings(city, state, page),
    getNearbyLocations(city, state),
  ]);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load location listings</p>
          <Link href="/directory" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/directory/location/${location}`;

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: baseUrl },
          { name: 'Directory', url: `${baseUrl}/directory` },
          { name: locationName, url: currentUrl },
        ]}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Link 
              href="/directory"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Directory
            </Link>

            {/* Location Hero */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Businesses in {locationName}
                </h1>
                <p className="text-gray-600 mt-1">
                  {data.pagination.totalItems} local {data.pagination.totalItems === 1 ? 'business' : 'businesses'}
                </p>
              </div>
            </div>

            <p className="text-gray-700 max-w-3xl">
              Discover local businesses, shops, restaurants, and services in {locationName}. 
              Support your local community and find everything you need nearby.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {data.listings.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No businesses found in {locationName}
              </h3>
              <p className="text-gray-600 mb-6">
                Check back soon as new businesses join our directory.
              </p>
              <Link
                href="/directory"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse All Locations
              </Link>
            </div>
          ) : (
            <DirectoryGrid
              listings={data.listings}
              pagination={data.pagination}
              baseUrl="/directory/location"
              categorySlug={location}
            />
          )}
        </div>

        {/* Nearby Locations */}
        {data.listings.length > 0 && nearbyLocations.length > 0 && (
          <div className="bg-white border-t mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Browse Nearby Locations
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {nearbyLocations.map((loc: any) => {
                  const slug = `${loc.city.toLowerCase().replace(/\s+/g, '-')}-${loc.state.toLowerCase()}`;
                  return (
                    <Link
                      key={slug}
                      href={`/directory/location/${slug}`}
                      className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MapPin className="w-8 h-8 text-green-600 mb-2" />
                      <span className="text-sm font-medium text-gray-900 text-center">
                        {loc.city}, {loc.state}
                      </span>
                      <span className="text-xs text-gray-600 mt-1">
                        {loc.count} {loc.count === 1 ? 'business' : 'businesses'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Local SEO Content */}
        {data.listings.length > 0 && (
          <div className="bg-gray-100 border-t">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="prose max-w-none">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  About {locationName}
                </h2>
                <p className="text-gray-700 mb-4">
                  {locationName} is home to a vibrant community of local businesses serving residents and visitors alike. 
                  From essential services to unique shopping experiences, you'll find everything you need right here in your community.
                </p>
                <p className="text-gray-700">
                  Browse our directory to discover {data.pagination.totalItems} local businesses in {locationName}. 
                  Support local commerce and find quality products and services from businesses that care about your community.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
