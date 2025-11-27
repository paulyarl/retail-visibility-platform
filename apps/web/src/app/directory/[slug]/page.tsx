import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Clock, Share2, ArrowLeft } from 'lucide-react';
import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import DirectoryActions from '@/components/directory/DirectoryActions';

interface StoreDetailPageProps {
  params: {
    slug: string;
  };
}

async function getStoreListing(identifier: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/directory/${identifier}`, {
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

  const businessName = listing.business_name || 'Business';
  const title = `${businessName} - ${listing.city}, ${listing.state}`;
  const description = listing.description || 
    `Visit ${businessName} in ${listing.city}, ${listing.state}. ${listing.product_count || 0} products available.`;

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
  const { slug: identifier } = await params;
  const listing = await getStoreListing(identifier);

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
  const currentUrl = `${baseUrl}/directory/${identifier}`;

  // For RelatedStores, we need the slug (not tenant ID)
  const slugForRelated = identifier.startsWith('t-') ? listing.slug : identifier;

  // Helper function to format category names to URL slugs
  const formatCategorySlug = (category: string) => {
    return category
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  };

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
                    {/* Display all categories */}
                    {listing.primary_category && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {/* Primary category */}
                        <Link
                          href={`/directory/categories/${formatCategorySlug(listing.primary_category)}`}
                          className="inline-block px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm rounded-full font-medium transition-colors"
                        >
                          {listing.primary_category}
                        </Link>
                        {/* Secondary categories */}
                        {listing.secondary_categories && listing.secondary_categories.map((category: string, index: number) => (
                          <Link
                            key={index}
                            href={`/directory/categories/${formatCategorySlug(category)}`}
                            className="inline-block px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition-colors"
                          >
                            {category}
                          </Link>
                        ))}
                      </div>
                    )}
                  {listing.product_count > 0 && (
                    <p className="text-gray-600 mt-2">
                      {listing.product_count} products available
                    </p>
                  )}
                </div>
                <DirectoryActions listing={listing} currentUrl={currentUrl} />
              </div>

              {listing.description && (
                <p className="mt-6 text-gray-700 leading-relaxed">
                  {listing.description}
                </p>
              )}
            </div>

            {/* Visit Store Button */}
            <a
              href={`/tenant/${listing.id}`}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Visit Storefront
            </a>
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
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
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
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
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
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
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
                    <Globe className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
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

              {/* Social Links */}
              {listing.business_profile?.special_links && Object.keys(listing.business_profile.special_links).length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Follow Us</h3>
                  <div className="flex flex-wrap gap-3">
                    {listing.business_profile.special_links.facebook && (
                      <a
                        href={listing.business_profile.special_links.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                        title="Facebook"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                    )}
                    {listing.business_profile.special_links.instagram && (
                      <a
                        href={listing.business_profile.special_links.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-pink-600 hover:text-pink-700 transition-colors"
                        title="Instagram"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
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
      <RelatedStores currentSlug={slugForRelated} />
    </>
  );
}
