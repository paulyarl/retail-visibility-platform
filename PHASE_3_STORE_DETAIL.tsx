// ============================================================================
// PHASE 3: STORE DETAIL PAGE
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Star, 
  Package, 
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  Heart,
  Share2,
  ExternalLink
} from 'lucide-react';

interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  brand: string;
  stock: number;
  category: string;
  created_at: string;
}

interface StoreDetail {
  id: string;
  name: string;
  slug: string | null;
  city: string;
  state: string;
  address: string;
  zip_code: string;
  phone: string;
  email: string;
  website: string;
  latitude: number;
  longitude: number;
  logo_url: string;
  description: string;
  business_hours: any;
  rating_avg: number;
  rating_count: number;
  product_count: number;
  is_featured: boolean;
  subscription_tier: string;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    product_count: number;
    quality_score: number;
  }>;
  products: StoreProduct[];
}

const StoreDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'categories'>('overview');
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    if (storeId) {
      fetchStoreDetails();
    }
  }, [storeId]);

  const fetchStoreDetails = async () => {
    try {
      // This would be a new API endpoint we'd need to create
      // For now, we'll simulate with mock data based on our existing data
      const response = await fetch(`/api/directory/stores/${storeId}`);
      if (!response.ok) {
        throw new Error('Store not found');
      }
      const storeData = await response.json();
      setStore(storeData);
    } catch (error) {
      console.error('Error fetching store details:', error);
      setError('Store not found or failed to load');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = store?.products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.brand.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.category.toLowerCase().includes(productSearch.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🏪</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'This store does not exist'}</p>
          <button
            onClick={() => router.push('/directory')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-12">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-blue-100 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-start gap-6">
            {store.logo_url && (
              <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center">
                <img 
                  src={store.logo_url} 
                  alt={store.name}
                  className="w-20 h-20 object-contain"
                />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold mb-2">{store.name}</h1>
                  <div className="flex items-center gap-4 text-blue-100">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      {store.city}, {store.state}
                    </span>
                    {store.is_featured && (
                      <span className="bg-yellow-400 text-yellow-900 text-sm font-medium px-3 py-1 rounded">
                        Featured Store
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Save
                  </button>
                  <button className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
              </div>
              
              {/* Rating and Stats */}
              <div className="flex items-center gap-6">
                {store.rating_avg > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.floor(store.rating_avg)
                              ? 'text-yellow-400 fill-current'
                              : 'text-white/30'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-medium">{store.rating_avg}</span>
                    <span className="text-blue-100">({store.rating_count} reviews)</span>
                  </div>
                )}
                <span className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {store.product_count} products
                </span>
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {store.categories.length} categories
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">{store.address}</div>
                <div className="text-sm text-gray-600">{store.city}, {store.state} {store.zip_code}</div>
              </div>
            </div>
            
            {store.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{store.phone}</div>
                  <div className="text-sm text-gray-600">Phone</div>
                </div>
              </div>
            )}
            
            {store.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{store.email}</div>
                  <div className="text-sm text-gray-600">Email</div>
                </div>
              </div>
            )}
            
            {store.website && (
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-400" />
                <div>
                  <a 
                    href={store.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <div className="text-sm text-gray-600">Visit online</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 border-b-2 transition-colors ${
                activeTab === 'overview' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-4 border-b-2 transition-colors ${
                activeTab === 'products' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Products ({store.product_count})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 border-b-2 transition-colors ${
                activeTab === 'categories' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Categories ({store.categories.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Description */}
              {store.description && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">About {store.name}</h2>
                  <p className="text-gray-700 leading-relaxed">{store.description}</p>
                </div>
              )}

              {/* Categories Preview */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Categories</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {store.categories.map((category) => (
                    <a 
                      key={category.id}
                      href={`/directory/categories/${category.slug}`}
                      className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="text-lg font-semibold text-gray-900 mb-1">{category.name}</div>
                      <div className="text-sm text-gray-600">{category.product_count} products</div>
                      <div className="text-xs text-gray-500 mt-1">Quality: {category.quality_score}/100</div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Recent Products */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Products</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {store.products.slice(0, 6).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Store Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Products</span>
                    <span className="font-medium">{store.product_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Categories</span>
                    <span className="font-medium">{store.categories.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rating</span>
                    <span className="font-medium">{store.rating_avg || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tier</span>
                    <span className="font-medium capitalize">{store.subscription_tier}</span>
                  </div>
                </div>
              </div>

              {/* Business Hours */}
              {store.business_hours && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Business Hours
                  </h3>
                  {/* Render business hours from JSON */}
                  <div className="text-sm text-gray-600">
                    Business hours information
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
                <div className="space-y-2">
                  <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Contact Store
                  </button>
                  <button className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    Get Directions
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            {/* Product Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">Try adjusting your search</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {store.categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Product Card Component
const ProductCard: React.FC<{ product: StoreProduct }> = ({ product }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
      {product.image_url && (
        <div className="aspect-square bg-gray-100">
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
        {product.brand && (
          <div className="text-sm text-gray-600 mb-2">{product.brand}</div>
        )}
        {product.description && (
          <p className="text-sm text-gray-700 mb-3 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-gray-900">${product.price / 100}</div>
          <div className={`text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </div>
        </div>
      </div>
    </div>
  );
};

// Category Card Component
const CategoryCard: React.FC<{ category: any }> = ({ category }) => {
  return (
    <a 
      href={`/directory/categories/${category.slug}`}
      className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow block"
    >
      <h3 className="font-semibold text-gray-900 mb-2">{category.name}</h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Products:</span>
          <span className="font-medium">{category.product_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Quality Score:</span>
          <span className="font-medium">{category.quality_score}/100</span>
        </div>
      </div>
    </a>
  );
};

export default StoreDetailPage;
