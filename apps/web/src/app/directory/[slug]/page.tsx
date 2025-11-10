import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Clock, Share2, ArrowLeft } from 'lucide-react';
import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';

interface StoreDetailPageProps {
  params: {
    slug: string;
  };
}

async function getStoreListing(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/directory/${slug}`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.listing;
  } catch (error) {
    console.error('Error fetching store:', error);
    return null;
  }
}

export async function generateMetadata({ params }: StoreDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getStoreListing(slug);

  if (!listing) {
    return {
      title: 'Store Not Found',
    };
  }

  const title = `${listing.business_name} - ${listing.city}, ${listing.state}`;
  const description = listing.description || 
    `Visit ${listing.business_name} in ${listing.city}, ${listing.state}. ${listing.product_count || 0} products available.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: listing.logo_url ? [listing.logo_url] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: listing.logo_url ? [listing.logo_url] : [],
    },
  };
}

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { slug } = await params;
  const listing = await getStoreListing(slug);

  if (!listing) {
    notFound();
  }

  const fullAddress = [
    listing.address,
    listing.city,
    listing.state,
    listing.zip_code,
  ].filter(Boolean).join(', ');

  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/directory/${slug}`;

  return (
    <>
      {/* Structured Data for SEO */}
      <LocalBusinessStructuredData listing={listing} url={currentUrl} />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: baseUrl },
          { name: 'Directory', url: `${baseUrl}/directory` },
          { name: listing.business_name, url: currentUrl },
        ]}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            href="/directory"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Directory
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Store Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start gap-6">
                {listing.logo_url && (
                  <img
                    src={listing.logo_url}
                    alt={listing.business_name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {listing.business_name}
                  </h1>
                  {listing.primary_category && (
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      {listing.primary_category}
                    </span>
                  )}
                  {listing.product_count > 0 && (
                    <p className="text-gray-600 mt-2">
                      {listing.product_count} products available
                    </p>
                  )}
                </div>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Share"
                >
                  <Share2 className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {listing.description && (
                <p className="mt-6 text-gray-700 leading-relaxed">
                  {listing.description}
                </p>
              )}
            </div>

            {/* Visit Store Button */}
            {listing.website && (
              <a
                href={listing.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
              >
                Visit Store Website
              </a>
            )}
          </div>

          {/* Right Column - Contact & Hours */}
          <div className="space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Contact Information
              </h2>
              <div className="space-y-4">
                {fullAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Address</p>
                      <p className="text-sm text-gray-600">{fullAddress}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block"
                      >
                        Get Directions →
                      </a>
                    </div>
                  </div>
                )}

                {listing.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Phone</p>
                      <a
                        href={`tel:${listing.phone}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {listing.phone}
                      </a>
                    </div>
                  </div>
                )}

                {listing.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email</p>
                      <a
                        href={`mailto:${listing.email}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {listing.email}
                      </a>
                    </div>
                  </div>
                )}

                {listing.website && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Website</p>
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 break-all"
                      >
                        {listing.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Business Hours */}
            {listing.business_hours && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Business Hours
                </h2>
                <div className="space-y-2">
                  {Object.entries(listing.business_hours).map(([day, hours]: [string, any]) => (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="font-medium text-gray-900 capitalize">{day}</span>
                      <span className="text-gray-600">
                        {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Related Stores */}
      <RelatedStores currentSlug={slug} />
    </>
  );
}
