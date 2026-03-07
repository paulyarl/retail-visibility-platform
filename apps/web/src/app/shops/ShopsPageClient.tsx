"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Star, Phone, Globe, Clock, Filter, Grid, List, ChevronDown, ChevronLeft, Store, ShoppingBag, TrendingUp, Sparkles, Tag, Users, Calendar, ArrowLeft, X, Flame, Leaf, Gift, Zap } from 'lucide-react';
import { Button, Container, Grid as MantineGrid, SimpleGrid, Badge, Card, Group, Text, Stack } from '@mantine/core';
import StorefrontActions from '../../components/storefront/StorefrontActions';
import { directorySingletonService } from '../../services/DirectorySingletonService';
import { shopsService } from '../../services/ShopsService';

import { computeStoreStatus, getTodaySpecialHours } from '@/lib/hours-utils';
import StoreStatusIndicator from '@/components/storefront/StoreStatusIndicator';
import { tenantStorefrontService } from '@/services/TenantStorefrontService';
import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import { Category } from '@/services/StorefrontService';
import { tenantInfoService } from '@/services/TenantInfoService';
import { usePublicPageTenantContext } from '@/hooks/useTenantContext';
import { PageProps } from './types';
import { PoweredByFooter } from '@/components/PoweredByFooter';

interface Shop {
  id: string;
  name: string;
  slug: string;
  business_name: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  categories?: string[];
  primary_category?: string;
  description?: string;
  hours?: any;
  is_featured?: boolean;
  featured_until?: string;
  featuredTypes?: string[]; // Array of featured type slugs
  distance?: number;
  created_at?: string;
  updated_at?: string;
  price?: number;
  product_count?: number;
}

interface TenantData {
  tenant: {
    id: string;
    businessName: string;
    slug: string;
    logo?: string;
    description?: string;
    website?: string;
  };
  products: any[];
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    productCount: number;
  }>;
  featuredProducts: any[];
  stats: {
    totalProducts: number;
    totalCategories: number;
    featuredCount: number;
  };
}

interface ProductCardProps {
  product: Shop;
  tenantId: string;
  onProductClick?: (product: Shop) => void;
}

interface ShopCardProps {
  shop: Shop;
  onShopClick?: (shop: Shop) => void;
}

interface FeaturedSectionProps {
  title: string;
  items: Shop[];
  renderItem: (item: Shop) => React.ReactNode;
  viewAllLink?: string;
  viewAllText?: string;
}

interface ShopViewTrackerProps {
  tenantId: string;
  pageType: string;
  category: string | null;
}

interface TroubleshootingToggleProps {
  tenantId?: string;
}

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

interface FilterPanelProps {
  categories: Array<{ name: string; count: number; type: 'shop' | 'product' }>;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortBy: 'name' | 'rating' | 'products' | 'newest';
  onSortChange: (sort: 'name' | 'rating' | 'products' | 'newest') => void;
  onClose: () => void;
}

interface Product {
  id: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  price?: number;
  salePrice?: number;
  currency?: string;
}

// Mock components for now - these should be imported from their actual files
const ShopViewTracker: React.FC<ShopViewTrackerProps> = ({ tenantId, pageType, category }) => {
  useEffect(() => {
    console.log(`Shop view tracked: ${tenantId}, ${pageType}, ${category}`);
  }, [tenantId, pageType, category]);
  return null;
};

const TroubleshootingToggle: React.FC<TroubleshootingToggleProps> = ({ tenantId }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className="bg-white dark:bg-gray-800"
      >
        {isOpen ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </Button>
      
      {isOpen && (
        <div className="absolute bottom-12 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-64">
          <h4 className="font-semibold mb-2">Debug Info</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>Tenant ID: {tenantId || 'N/A'}</p>
            <p>Page: Shops Directory</p>
          </div>
        </div>
      )}
    </div>
  );
};

const StatsCard: React.FC<StatsCardProps> = ({ icon, label, value, trend }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <div className="text-blue-600 dark:text-blue-400">
        {icon}
      </div>
    </div>
    {trend && (
      <div className={`mt-2 text-sm flex items-center ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
        <TrendingUp className={`h-4 w-4 mr-1 ${!trend.isPositive ? 'rotate-180' : ''}`} />
        {trend.value}%
      </div>
    )}
  </div>
);

// Featured Type Icon component for product cards (matching SmartProductCard pattern)
const FeaturedTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const config: Record<string, { icon: React.ReactNode; bgColor: string; title: string }> = {
    store_selection: { icon: <Star className="w-3 h-3 fill-white" />, bgColor: 'bg-amber-500', title: 'Store Selection' },
    new_arrival: { icon: <Sparkles className="w-3 h-3" />, bgColor: 'bg-green-500', title: 'New Arrival' },
    seasonal: { icon: <Gift className="w-3 h-3" />, bgColor: 'bg-orange-500', title: 'Seasonal' },
    sale: { icon: <Zap className="w-3 h-3" />, bgColor: 'bg-red-500', title: 'Sale' },
    staff_pick: { icon: <Users className="w-3 h-3" />, bgColor: 'bg-purple-500', title: 'Staff Pick' },
  };
  
  const cfg = config[type] || { icon: <Star className="w-3 h-3" />, bgColor: 'bg-gray-500', title: type };
  
  return (
    <span 
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${cfg.bgColor} text-white shadow-md`}
      title={cfg.title}
    >
      {cfg.icon}
    </span>
  );
};

const ProductCard: React.FC<ProductCardProps> = ({ product, tenantId, onProductClick }) => (
  <div 
    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
    onClick={() => onProductClick?.(product)}
  >
    <div className="aspect-square relative bg-gray-100 dark:bg-gray-700 rounded-t-lg overflow-hidden">
      {product.logo_url ? (
        <Image
          src={product.logo_url}
          alt={product.name}
          fill
          sizes="256px"
          className="object-cover"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <ShoppingBag className="h-12 w-12 text-gray-400" />
        </div>
      )}
      {/* Featured Type Icons Overlay - bottom left, stacked vertically */}
      {product.featuredTypes && product.featuredTypes.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-col gap-1">
          {product.featuredTypes.map((type, index) => (
            <FeaturedTypeIcon key={index} type={type} />
          ))}
        </div>
      )}
      {/* Fallback: show single featured badge if no featuredTypes array */}
      {!product.featuredTypes?.length && product.is_featured && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
          Featured
        </div>
      )}
    </div>
    <div className="p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{product.name}</h3>
      {product.business_name && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{product.business_name}</p>
      )}
      <div className="flex items-center justify-between">
        {product.rating && (
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
              {product.rating.toFixed(1)}
            </span>
          </div>
        )}
        {product.price && (
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            ${product.price}
          </span>
        )}
      </div>
    </div>
  </div>
);

const ShopCard: React.FC<ShopCardProps> = ({ shop, onShopClick }) => {
  const status = shop.hours ? computeStoreStatus(shop.hours) : null;
  const specialHours = shop.hours ? getTodaySpecialHours(shop.hours) : null;
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
      onClick={() => onShopClick?.(shop)}
    >
      <div className="aspect-video relative bg-gray-100 dark:bg-gray-700 rounded-t-lg overflow-hidden">
        {shop.logo_url ? (
          <Image
            src={shop.logo_url}
            alt={shop.name}
            fill
            sizes="512px"
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Store className="h-12 w-12 text-gray-400" />
          </div>
        )}
        {/* Featured Type Icons Overlay - bottom left, stacked vertically */}
        {shop.featuredTypes && shop.featuredTypes.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-col gap-1">
            {shop.featuredTypes.map((type, index) => (
              <FeaturedTypeIcon key={index} type={type} />
            ))}
          </div>
        )}
        {/* Fallback: show single featured badge if no featuredTypes array */}
        {!shop.featuredTypes?.length && shop.is_featured && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            Featured
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StoreStatusIndicator tenantId={shop.id} />
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{shop.name}</h3>
        {shop.business_name && shop.business_name !== shop.name && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {shop.business_name}
          </p>
        )}
        
        <div className="space-y-2">
          {shop.product_count !== undefined && shop.product_count > 0 && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <ShoppingBag className="h-4 w-4 mr-1" />
              {shop.product_count} products
            </div>
          )}
          
          {shop.address && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4 mr-1" />
              {shop.address}{shop.city && `, ${shop.city}`}{shop.state && `, ${shop.state}`}
            </div>
          )}
          
          {shop.phone && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Phone className="h-4 w-4 mr-1" />
              {shop.phone}
            </div>
          )}
          
          {shop.website && (
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
              <Globe className="h-4 w-4 mr-1" />
              <a href={shop.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Visit Website
              </a>
            </div>
          )}
          
          {specialHours && specialHours.length > 0 && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4 mr-1" />
              <span>{specialHours[0]?.label}: {specialHours[0]?.isClosed ? 'Closed' : `${specialHours[0]?.open} - ${specialHours[0]?.close}`}</span>
            </div>
          )}
          
          {shop.primary_category && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Tag className="h-4 w-4 mr-1" />
              {shop.primary_category}
            </div>
          )}
        </div>
        
        {shop.rating && (
          <div className="mt-3 flex items-center">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
              {shop.rating.toFixed(1)}
              {shop.review_count && (
                <span className="text-xs text-gray-500 ml-1">
                  ({shop.review_count} reviews)
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const FeaturedSection: React.FC<FeaturedSectionProps> = ({ 
  title, 
  items, 
  renderItem, 
  viewAllLink, 
  viewAllText = "View All" 
}) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {viewAllLink && (
        <Link href={viewAllLink} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          {viewAllText}
        </Link>
      )}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.slice(0, 6).map((item) => renderItem(item))}
    </div>
  </div>
);

const FilterPanel: React.FC<FilterPanelProps> = ({ 
  categories, 
  selectedCategory, 
  onCategoryChange, 
  sortBy, 
  onSortChange, 
  onClose 
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
    <div className="bg-white dark:bg-gray-800 w-full max-w-md h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Filters</h3>
          <Button variant="subtle" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        <div>
          <h4 className="font-medium mb-3">Category</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="category"
                checked={!selectedCategory}
                onChange={() => onCategoryChange('')}
                className="mr-2"
              />
              All Categories
            </label>
            {categories.map((category) => (
              <label key={category.name} className="flex items-center">
                <input
                  type="radio"
                  name="category"
                  checked={selectedCategory === category.name}
                  onChange={() => onCategoryChange(category.name)}
                  className="mr-2"
                />
                {category.name} ({category.count})
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-3">Sort By</h4>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="name">Name</option>
            <option value="rating">Rating</option>
            <option value="products">Products</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
    </div>
  </div>
);

export default function ShopsPageClient({ id, searchParams }: { id: string; searchParams: { page?: string; search?: string; category?: string; products_only?: string; featured?: string; view?: string } }) {
  const { tenantId, isInTenantContext, isFromUrl } = usePublicPageTenantContext();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'products' | 'newest'>('name');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<{name: string, count: number, type: 'shop' | 'product'}[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState<string | null>(null);
  const [hasMoreShops, setHasMoreShops] = useState(true);
  const [shopsOffset, setShopsOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [tenantLoading, setTenantLoading] = useState(!id); // Not loading if no id
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [mapLocation, setMapLocation] = useState<MapLocation | null>(null);
  const [platformSettings, setPlatformSettings] = useState<any>(null);

  // Show traditional listing when searching or filtering
  const showTraditionalListing = searchQuery || selectedCategory || sortBy !== 'name';

  const fetchShops = async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setShopsLoading(true);
      setShopsError(null);
      setShopsOffset(0);
    }
    
    try {
      const limit = 20;
      const offset = append ? shopsOffset : 0;
      
      // For now, we'll use the existing method but could enhance it to support pagination
      const shops = await directorySingletonService.getPublicShops();
      
      if (append) {
        // Append new shops to existing list
        setShops(prev => [...prev, ...shops]);
      } else {
        // Replace shops list
        setShops(shops);
      }
      
      // Update offset and hasMore state
      const newOffset = offset + shops.length;
      setShopsOffset(newOffset);
      setHasMoreShops(shops.length === limit); // If we got less than limit, no more shops
      
    } catch (err) {
      setShopsError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setShopsLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    const loadTenantData = async () => {
      // If no id, mark loading as complete immediately
      if (!id) {
        setTenantLoading(false);
        return;
      }
      
      setTenantLoading(true);
      setTenantError(null);
      
      try {
        // Get tenant info
        const tenantInfo = await tenantInfoService.getCompleteTenantInfo(id);
        if (!tenantInfo || !tenantInfo.tenant) {
          setTenantError('Tenant not found');
          return;
        }

        const tenant = tenantInfo.tenant;

        // Get products and categories from tenant-aware storefront service
        const storefrontData = await tenantStorefrontService.getStorefrontProducts(id);
        const products = storefrontData.items || [];
        const featuredProducts = products.filter((p: any) => p.featured);

        // Get categories
        let categories: Category[] = [];
        let uncategorizedCount = 0;

        try {
          // Get product counts per category from tenant-aware storefront service
          const storefrontCategories = await tenantStorefrontService.getStorefrontCategories(id);
          const rawCategories = storefrontCategories.categories || [];
          uncategorizedCount = storefrontCategories.uncategorizedCount || 0;

          // Convert storefront categories to the expected format
          categories = rawCategories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            productCount: cat.count,
            googleCategoryId: cat.googleCategoryId,
            category_type: 'platform', // All storefront categories are platform categories
          }));
        } catch (e) {
          console.error('Failed to fetch categories:', e);
        }

        // Calculate stats
        const stats = {
          totalProducts: products.length,
          totalCategories: categories.length,
          featuredCount: featuredProducts.length
        };

        setTenantData({
          tenant,
          products,
          categories,
          featuredProducts,
          stats
        });

        // Get map location
        if (tenantInfo.businessProfile?.address) {
          const location = await getTenantMapLocation(tenantInfo.businessProfile.address);
          setMapLocation(location);
        }

      } catch (error) {
        console.error('Error loading tenant data:', error);
        setTenantError('Failed to load tenant data');
      } finally {
        setTenantLoading(false);
      }
    };

    loadTenantData();
  }, [id]);

  useEffect(() => {
    const loadPlatformSettings = async () => {
      try {
        const settings = await platformSettingsService.getPlatformSettings();
        setPlatformSettings(settings);
      } catch (error) {
        console.error('Failed to load platform settings:', error);
      }
    };

    loadPlatformSettings();
  }, []);

  const handleShopClick = (shop: Shop) => {
    router.push(`/shops/${shop.slug}`);
  };

  const handleProductClick = (product: Shop) => {
    router.push(`/shops/${id}/products/${product.slug}`);
  };

  const filteredShops = shops.filter(shop => {
    const matchesSearch = !searchQuery || 
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || 
      shop.primary_category === selectedCategory ||
      shop.categories?.includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const sortedShops = [...filteredShops].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'products':
        return (b.product_count || 0) - (a.product_count || 0);
      case 'newest':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default:
        return a.name.localeCompare(b.name);
    }
  });

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading shop...</p>
        </div>
      </div>
    );
  }

  // Only show "Shop Not Found" if we have an id but no tenant data
  if (id && (tenantError || !tenantData)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Shop Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {tenantError || 'The requested shop could not be found.'}
          </p>
          <Link href="/shops">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shops
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // If we have tenant data, destructure it
  const tenant = tenantData?.tenant;
  const products = tenantData?.products || [];
  const featuredProducts = tenantData?.featuredProducts || [];
  const stats = tenantData?.stats || { totalProducts: 0, totalCategories: 0, totalReviews: 0, averageRating: 0, featuredCount: 0 };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Track shops landing page view */}
      <ShopViewTracker 
        tenantId="shops_landing" 
        pageType="shop_directory"
        category={null}
      />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              {/* Navigation Links */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium">
                  <Store className="h-4 w-4" />
                  Shops
                </span>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/directory"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Grid className="h-4 w-4" />
                  Directory
                </Link>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/featured"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Featured
                </Link>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/trending"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <TrendingUp className="h-4 w-4" />
                  Trending
                </Link>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search shops..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Filters */}
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="hidden md:flex"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="md:hidden"
              >
                <Filter className="h-4 w-4" />
              </Button>
              
              {/* View Mode */}
              <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <FilterPanel
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Mobile Filters */}
      {showMobileFilters && (
        <FilterPanel
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onClose={() => setShowMobileFilters(false)}
        />
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Shop Header - only show if viewing a specific shop */}
        {tenant && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              {tenant.logo ? (
                <Image
                  src={tenant.logo}
                  alt={tenant.businessName}
                  width={80}
                  height={80}
                  className="rounded-lg mr-4"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mr-4">
                  <Store className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {tenant.businessName}
                </h1>
                {tenant.description && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {tenant.description}
                  </p>
                )}
                <div className="flex items-center space-x-4">
                  {tenant.website && (
                    <a
                      href={tenant.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 flex items-center"
                    >
                      <Globe className="h-4 w-4 mr-1" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </div>
            
            <StorefrontActions 
              tenantId={id} 
              businessName={tenant.businessName}
              currentUrl={`/shops/${id}`}
            />
          </div>
        </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon={<Store className="h-6 w-6" />}
            label="Total Shops"
            value={shops.length}
          />
          <StatsCard
            icon={<ShoppingBag className="h-6 w-6" />}
            label="Total Products"
            value={shops.reduce((sum, shop) => sum + (shop.product_count || 0), 0)}
          />
          <StatsCard
            icon={<Sparkles className="h-6 w-6" />}
            label="Featured Shops"
            value={shops.filter(shop => shop.is_featured).length}
          />
          <StatsCard
            icon={<TrendingUp className="h-6 w-6" />}
            label="Active Now"
            value={Math.floor(shops.length * 0.7)}
            trend={{ value: 12, isPositive: true }}
          />
        </div>

        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <FeaturedSection
            title="Featured Products"
            items={featuredProducts}
            renderItem={(product) => (
              <ProductCard
                key={product.id}
                product={product}
                tenantId={id}
                onProductClick={handleProductClick}
              />
            )}
            viewAllLink={`/shops/${id}/products?featured=true`}
            viewAllText="View All Featured"
          />
        )}

        {/* Categories - only show on main shops page */}
        {!id && categories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Shop Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((category) => (
                <Link
                  key={category.name}
                  href={`/shops?category=${encodeURIComponent(category.name)}`}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                >
                  <Tag className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{category.count} shops</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Featured Shops - only show on main shops page */}
        {!id && (
          <FeaturedSection
            title="Featured Shops"
            items={shops.filter(shop => shop.is_featured)}
            renderItem={(shop) => (
              <ShopCard
                key={`featured-${shop.id}`}
                shop={shop}
                onShopClick={handleShopClick}
              />
            )}
            viewAllLink="/shops?featured=true"
            viewAllText="View All Featured"
          />
        )}

        {/* Trending Shops - only show on main shops page */}
        {!id && (
          <FeaturedSection
            title="Trending Shops"
            items={shops.slice(0, 6)}
            renderItem={(shop) => (
              <ShopCard
                key={`trending-${shop.id}`}
                shop={shop}
                onShopClick={handleShopClick}
              />
            )}
            viewAllLink="/shops?sort=newest"
            viewAllText="View All Trending"
          />
        )}

        {/* Traditional Shop Listing - always show shops list */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              All Shops ({sortedShops.length})
            </h2>
            <div className="flex items-center space-x-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="name">Sort by Name</option>
                  <option value="rating">Sort by Rating</option>
                  <option value="products">Sort by Products</option>
                  <option value="newest">Sort by Newest</option>
                </select>
              </div>
            </div>

            {shopsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading shops...</p>
              </div>
            ) : shopsError ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-4">{shopsError}</p>
                <Button onClick={() => fetchShops()}>Retry</Button>
              </div>
            ) : sortedShops.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No shops found matching your criteria.</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${
                viewMode === 'grid' 
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                  : 'grid-cols-1'
              }`}>
                {sortedShops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    onShopClick={handleShopClick}
                  />
                ))}
              </div>
            )}
            
            {/* Load More Button */}
            {!shopsLoading && !shopsError && sortedShops.length > 0 && hasMoreShops && (
              <div className="text-center mt-8">
                <Button
                  onClick={() => fetchShops(true)}
                  disabled={loadingMore}
                  variant="outline"
                  className="px-6 py-3"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                      Loading more...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Load More Shops
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* End of shops indicator */}
            {!shopsLoading && !shopsError && sortedShops.length > 0 && !hasMoreShops && (
              <div className="text-center mt-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">You've reached the end of the shops list</p>
              </div>
            )}
        </div>

        {/* Map View */}
        {!showTraditionalListing && mapLocation && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Location</h2>
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <MapPin className="h-12 w-12 text-gray-400" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Map view would be displayed here
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Debug Toggle */}
      <TroubleshootingToggle tenantId={id} />
        {/* Platform Branding Footer */}
                  <PoweredByFooter />
    </div>
  );
}
