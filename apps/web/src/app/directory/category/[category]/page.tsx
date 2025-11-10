import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag } from 'lucide-react';
import { DirectoryGrid } from '@/components/directory/DirectoryGrid';
import { BreadcrumbStructuredData } from '@/components/directory/StructuredData';

interface CategoryPageProps {
  params: {
    category: string;
  };
  searchParams: {
    page?: string;
  };
}

// Category display names and descriptions
const CATEGORY_INFO: Record<string, { name: string; description: string; emoji: string }> = {
  grocery: {
    name: 'Grocery Stores',
    description: 'Find local grocery stores, supermarkets, and food markets in your area. Fresh produce, quality meats, and everyday essentials.',
    emoji: '🛒',
  },
  restaurant: {
    name: 'Restaurants',
    description: 'Discover restaurants, cafes, and dining establishments. From fine dining to casual eats, find your next meal.',
    emoji: '🍽️',
  },
  retail: {
    name: 'Retail Stores',
    description: 'Browse retail shops and stores offering a variety of products and services for your shopping needs.',
    emoji: '🏪',
  },
  clothing: {
    name: 'Clothing Stores',
    description: 'Shop for fashion, apparel, and accessories at local clothing boutiques and stores.',
    emoji: '👕',
  },
  electronics: {
    name: 'Electronics Stores',
    description: 'Find electronics retailers offering computers, phones, gadgets, and tech accessories.',
    emoji: '💻',
  },
  furniture: {
    name: 'Furniture Stores',
    description: 'Discover furniture stores for your home and office. Quality pieces for every room.',
    emoji: '🛋️',
  },
  hardware: {
    name: 'Hardware Stores',
    description: 'Find hardware stores for tools, building materials, and home improvement supplies.',
    emoji: '🔨',
  },
  pharmacy: {
    name: 'Pharmacies',
    description: 'Locate pharmacies and drugstores for prescriptions, health products, and wellness items.',
    emoji: '💊',
  },
  bakery: {
    name: 'Bakeries',
    description: 'Find bakeries offering fresh bread, pastries, cakes, and baked goods.',
    emoji: '🥖',
  },
  cafe: {
    name: 'Cafes & Coffee Shops',
    description: 'Discover cafes and coffee shops for your daily caffeine fix and cozy atmosphere.',
    emoji: '☕',
  },
};

async function getCategoryListings(category: string, page: number = 1) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const limit = 12;
  
  try {
    const res = await fetch(
      `${apiUrl}/api/directory/search?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`,
      { next: { revalidate: 300 } }
    );

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching category listings:', error);
    return null;
  }
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const categoryInfo = CATEGORY_INFO[category.toLowerCase()];

  if (!categoryInfo) {
    return {
      title: 'Category Not Found',
    };
  }

  const title = `${categoryInfo.name} - Local Business Directory`;
  const description = categoryInfo.description;

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

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category } = await params;
  const page = Number(searchParams.page) || 1;
  
  const categoryInfo = CATEGORY_INFO[category.toLowerCase()];

  if (!categoryInfo) {
    notFound();
  }

  const data = await getCategoryListings(category, page);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load category listings</p>
          <Link href="/directory" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/directory/category/${category}`;

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: baseUrl },
          { name: 'Directory', url: `${baseUrl}/directory` },
          { name: categoryInfo.name, url: currentUrl },
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

            {/* Category Hero */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-3xl">
                {categoryInfo.emoji}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {categoryInfo.name}
                </h1>
                <p className="text-gray-600 mt-1">
                  {data.pagination.totalItems} {data.pagination.totalItems === 1 ? 'store' : 'stores'} found
                </p>
              </div>
            </div>

            <p className="text-gray-700 max-w-3xl">
              {categoryInfo.description}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {data.listings.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No stores found in this category
              </h3>
              <p className="text-gray-600 mb-6">
                Check back soon as new businesses join our directory.
              </p>
              <Link
                href="/directory"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse All Stores
              </Link>
            </div>
          ) : (
            <DirectoryGrid
              listings={data.listings}
              pagination={data.pagination}
              baseUrl="/directory/category"
              categorySlug={category}
            />
          )}
        </div>

        {/* Related Categories */}
        {data.listings.length > 0 && (
          <div className="bg-white border-t mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Browse Other Categories
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Object.entries(CATEGORY_INFO)
                  .filter(([key]) => key !== category.toLowerCase())
                  .slice(0, 5)
                  .map(([key, info]) => (
                    <Link
                      key={key}
                      href={`/directory/category/${key}`}
                      className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-3xl mb-2">{info.emoji}</span>
                      <span className="text-sm font-medium text-gray-900 text-center">
                        {info.name}
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
