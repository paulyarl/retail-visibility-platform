'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import { shopsService, type Shop } from '@/services/ShopsService';
import RealShopService, { type ShopData as RealShop, type ShopAnalytics as ShopAnalyticsType } from '@/services/RealShopService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@mantine/core';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  Plus, 
  Store, 
  Eye, 
  Edit, 
  Trash2, 
  BarChart3, 
  Settings, 
  Upload,
  Globe,
  Phone,
  Mail,
  MapPin,
  Star,
  Users,
  Package,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Copy
} from 'lucide-react';
import ShopCreationWizard from '@/components/shops/ShopCreationWizard';
import ShopAnalytics from '@/components/shops/ShopAnalytics';
import ShopBrandingCustomizer from '@/components/shops/ShopBrandingCustomizer';
import ShopPublishingWorkflow from '@/components/shops/ShopPublishingWorkflow';
import { clientLogger } from '@/lib/client-logger';

interface ShopManagementProps {
  params: Promise<{
    tenantId: string;
  }>;
}

interface ShopStats {
  totalShops: number;
  activeShops: number;
  publishedShops: number;
  totalProducts: number;
  totalViews: number;
  totalOrders: number;
  averageRating: number;
  monthlyGrowth: number;
}

interface ShopUrls {
  slugUrl: string | null;
  tenantIdUrl: string;
  autoIdUrl: string;
  canonicalUrl: string;
}

// Main component using React.use() to handle Next.js 15+ params
export default function ShopManagementPage({ params }: ShopManagementProps) {
  const { tenantId } = use(params);

  // Add debugging and guard clause
  if (!tenantId) {
    clientLogger.error('[ShopManagementPage] No tenantId provided');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">Tenant ID is required. Please check the URL.</p>
        </div>
      </div>
    );
  }

  console.log('[ShopManagementPage] Initializing with tenantId:', tenantId);
  const [shops, setShops] = useState<Shop[]>([]);
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showCreationWizard, setShowCreationWizard] = useState(false);
  const [showBrandingCustomizer, setShowBrandingCustomizer] = useState(false);
  const [showPublishingWorkflow, setShowPublishingWorkflow] = useState(false);

  useEffect(() => {
    fetchShops();
    fetchStats();
  }, [tenantId]);

  const fetchShops = async () => {
    try {
      setLoading(true);
      // Use the real service to get shop data
      const realShopService = RealShopService.getInstance();
      const shop = await realShopService.getShop(tenantId);
      
      // Convert to the expected Shop format for compatibility
      const shops: Shop[] = shop ? [{
        tenantId: shop.tenantId, // Use tenantId as the primary identifier
        name: shop.name,
        slug: shop.slug,
        description: shop.description || '',
        bannerUrl: shop.bannerUrl,
        imageUrl: shop.logoUrl, // Map logoUrl to imageUrl
        autoId: shop.id || shop.tenantId, // Map id to autoId
        category: shop.categoryId || 'general',
        location: shop.address ? `${shop.address.line1}, ${shop.address.city}` : '',
        address: shop.address ? `${shop.address.line1}, ${shop.address.city}` : undefined,
        contact: {
          email: shop.email || '',
          phone: shop.phone || '',
          website: shop.website || ''
        },
        productCount: 0,
        rating: 0,
        reviewCount: 0,
        isVerified: true,
        isActive: true,
        createdAt: shop.createdAt || new Date().toISOString(),
        updatedAt: shop.updatedAt || new Date().toISOString(),
        urls: {
          slugUrl: shop.slug ? `/directory/${shop.slug}` : null,
          tenantIdUrl: `/directory/${shop.tenantId}`,
          autoIdUrl: `/directory/${shop.tenantId}`,
          canonicalUrl: shop.slug ? `/directory/${shop.slug}` : `/directory/${shop.tenantId}`
        }
      }] : [];
      
      setShops(shops);
    } catch (error) {
      clientLogger.error('Error fetching shops:', { detail: error });
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Use real analytics from the service
      const realShopService = RealShopService.getInstance();
      const shop = await realShopService.getShop(tenantId);
      
      if (shop) {
        const analytics = await realShopService.getShopAnalytics(tenantId);
        
        const stats: ShopStats = {
          totalShops: 1,
          activeShops: shop.isActive ? 1 : 0,
          publishedShops: shop.isPublished ? 1 : 0,
          totalProducts: analytics.products,
          totalViews: analytics.views,
          totalOrders: analytics.orders,
          averageRating: analytics.rating,
          monthlyGrowth: 0 // Would need to calculate from historical data
        };
        setStats(stats);
      } else {
        // No shop exists
        const emptyStats: ShopStats = {
          totalShops: 0,
          activeShops: 0,
          publishedShops: 0,
          totalProducts: 0,
          totalViews: 0,
          totalOrders: 0,
          averageRating: 0,
          monthlyGrowth: 0
        };
        setStats(emptyStats);
      }
    } catch (error) {
      clientLogger.error('Error fetching stats:', { detail: error });
      setStats(null);
    }
  };

  const handleShopCreated = (newShop: Shop) => {
    setShops(prev => [...prev, newShop]);
    setShowCreationWizard(false);
    fetchStats(); // Refresh stats
  };

  const handleShopUpdated = (updatedShop: Shop) => {
    setShops(prev => prev.map(shop => 
      shop.tenantId === updatedShop.tenantId ? updatedShop : shop
    ));
    setSelectedShop(updatedShop);
  };

  const handleShopDeleted = (shopId: string) => {
    setShops(prev => prev.filter(shop => shop.tenantId !== shopId));
    setSelectedShop(null);
    fetchStats(); // Refresh stats
  };

  const getShopStatusColor = (shop: Shop) => {
    if (!shop.isActive) return 'error';
    if (!shop.isVerified) return 'warning';
    return 'default';
  };

  const getShopStatusText = (shop: Shop) => {
    if (!shop.isActive) return 'Inactive';
    if (!shop.isVerified) return 'Pending';
    return 'Active';
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log('URL copied to clipboard:', text);
    } catch (err) {
      clientLogger.error('Failed to copy URL:', { detail: err });
    }
  };

  const ShopUrlDisplay = ({ shop }: { shop: Shop }) => {
    const [urls, setUrls] = useState<ShopUrls | null>(null);
    const [loadingUrls, setLoadingUrls] = useState(true);

    useEffect(() => {
      const fetchUrls = async () => {
        try {
          const shopUrls = await shopsService.getShopUrls(shop.tenantId, shop.slug);
          setUrls(shopUrls);
        } catch (error) {
          clientLogger.error('Error fetching shop URLs:', { detail: error });
        } finally {
          setLoadingUrls(false);
        }
      };

      if (shop) {
        fetchUrls();
      }
    }, [shop]);

    if (loadingUrls) {
      return (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      );
    }

    if (!urls) {
      return (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">URL information unavailable</p>
        </div>
      );
    }

    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
        <p className="text-xs font-semibold text-gray-700 mb-2">Shop URLs:</p>
        
        {/* Primary URL (Canonical) */}
        <div key="primary-url" className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900">Primary:</p>
            <p className="text-xs text-blue-600 truncate">{urls.canonicalUrl}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(`${window.location.origin}${urls.canonicalUrl}`)}
            className="ml-2"
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>

        {/* Slug URL (if available) */}
        {urls.slugUrl && (
          <div key="slug-url" className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900">Slug:</p>
              <p className="text-xs text-green-600 truncate">{urls.slugUrl}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(`${window.location.origin}${urls.slugUrl}`)}
              className="ml-2"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Tenant ID URL */}
        <div key="tenant-url" className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900">Tenant ID:</p>
            <p className="text-xs text-orange-600 truncate">{urls.tenantIdUrl}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(`${window.location.origin}${urls.tenantIdUrl}`)}
            className="ml-2"
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>

        {/* Auto ID URL */}
        <div key="auto-url" className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900">Auto ID:</p>
            <p className="text-xs text-purple-600 truncate">{urls.autoIdUrl}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(`${window.location.origin}${urls.autoIdUrl}`)}
            className="ml-2"
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  if (showCreationWizard) {
    return (
      <ShopCreationWizard
        tenantId={tenantId}
        onComplete={handleShopCreated}
        onCancel={() => setShowCreationWizard(false)}
      />
    );
  }

  if (showBrandingCustomizer && selectedShop) {
    return (
      <ShopBrandingCustomizer
        shop={selectedShop}
        onUpdate={handleShopUpdated}
        onCancel={() => setShowBrandingCustomizer(false)}
      />
    );
  }

  if (showPublishingWorkflow && selectedShop) {
    return (
      <ShopPublishingWorkflow
        shop={selectedShop}
        onUpdate={handleShopUpdated}
        onCancel={() => setShowPublishingWorkflow(false)}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shop Management</h1>
          <p className="text-gray-600 mt-2">
            Manage your shops, customize branding, and track performance
          </p>
        </div>
        <Button onClick={() => setShowCreationWizard(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create New Shop
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Shops</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalShops}</p>
                </div>
                <Store className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Shops</p>
                  <p className="text-2xl font-bold text-green-600">{stats.activeShops}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Published Shops</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.publishedShops}</p>
                </div>
                <Globe className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Growth</p>
                  <p className="text-2xl font-bold text-purple-600">+{stats.monthlyGrowth}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger key="overview" value="overview">Overview</TabsTrigger>
          <TabsTrigger key="analytics" value="analytics">Analytics</TabsTrigger>
          <TabsTrigger key="branding" value="branding">Branding</TabsTrigger>
          <TabsTrigger key="publishing" value="publishing">Publishing</TabsTrigger>
          <TabsTrigger key="settings" value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Shops List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Shops</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={`skeleton-${i}`} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : shops.length === 0 ? (
                  <div className="text-center py-12">
                    <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No shops yet</h3>
                    <p className="text-gray-600 mb-4">
                      Create your first shop to get started
                    </p>
                    <Button onClick={() => setShowCreationWizard(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Shop
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shops.map((shop, index) => (
                      <div key={shop.tenantId || shop.autoId || `shop-${index}`} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {shop.imageUrl ? (
                            <img
                              src={shop.imageUrl}
                              alt={shop.name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                              <Store className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{shop.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={getShopStatusColor(shop)}>
                                {getShopStatusText(shop)}
                              </Badge>
                              {shop.isVerified && (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <ShopUrlDisplay shop={shop} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedShop(shop)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedShop(shop);
                              setShowBrandingCustomizer(true);
                            }}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowCreationWizard(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Shop
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('analytics')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('branding')}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Customize Branding
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('publishing')}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Publish Shop
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <ShopAnalytics tenantId={tenantId} shops={shops} />
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          {selectedShop ? (
            <ShopBrandingCustomizer
              shop={selectedShop}
              onUpdate={handleShopUpdated}
              onCancel={() => {}}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Shop</h3>
                <p className="text-gray-600">
                  Choose a shop from the overview to customize its branding
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Publishing Tab */}
        <TabsContent value="publishing">
          {selectedShop ? (
            <ShopPublishingWorkflow
              shop={selectedShop}
              onUpdate={handleShopUpdated}
              onCancel={() => {}}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Shop</h3>
                <p className="text-gray-600">
                  Choose a shop from the overview to manage its publishing workflow
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Shop Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Auto-publish new shops</h4>
                        <p className="text-sm text-gray-600">Automatically publish shops when they're created</p>
                      </div>
                      <Button variant="outline">Configure</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Default shop template</h4>
                        <p className="text-sm text-gray-600">Template used for new shop creation</p>
                      </div>
                      <Button variant="outline">Select Template</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Shop analytics</h4>
                        <p className="text-sm text-gray-600">Enable detailed shop performance tracking</p>
                      </div>
                      <Button variant="outline">Configure</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
