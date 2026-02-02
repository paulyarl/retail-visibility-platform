/**
 * Shop Profile Page
 * Professional public shop profile with exceptional user experience
 * Leverages existing platform assets and provides bi-directional navigation
 */

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ShopProfileClient from './ShopProfileClient';

// Types
interface Shop {
  id: string;
  name: string;
  slug: string;
  business_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  website?: string;
  rating_avg?: number;
  rating_count?: number;
  product_count: number;
  is_published: boolean;
  primary_category?: string;
  created_at: Date;
  tenantName?: string;
  tenantLogoUrl?: string;
}

interface ShopProfilePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ 
    page?: string; 
    search?: string; 
    category?: string; 
    featured?: string;
    view?: string;
  }>;
}

// Shop data fetching function
async function getShopBySlug(identifier: string): Promise<Shop | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    
    // First try to fetch by slug
    let response = await fetch(`${baseUrl}/api/public/shops/${identifier}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // If slug fetch fails, try by tenant ID
    if (!response.ok) {
      response = await fetch(`${baseUrl}/api/public/shops/id/${identifier}`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.success ? result.shop : null;
  } catch (error) {
    console.error('Error fetching shop:', error);
    return null;
  }
}

// Loading skeleton component
function ShopProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Hero Section Skeleton */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-start space-x-6">
                <div className="h-24 w-24 bg-gray-200 rounded-lg animate-pulse" />
                <div className="flex-1 space-y-3">
                  <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="flex items-center space-x-4">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
            </div>
            <div>
              <div className="h-64 w-full bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="h-12 w-full bg-gray-200 rounded animate-pulse mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 w-full bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-64 w-full bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default async function ShopProfilePage({ params, searchParams }: ShopProfilePageProps) {
  const { slug } = await params;
  
  // Fetch shop data
  const shop = await getShopBySlug(slug);
  
  if (!shop) {
    notFound();
  }

  return (
    <Suspense fallback={<ShopProfileSkeleton />}>
      <ShopProfileClient shop={shop} />
    </Suspense>
  );
}

