'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Search, Filter, Star, Eye, Package, TrendingUp, Grid, List, Settings, RefreshCw } from 'lucide-react';

export default function InventoryFeaturedProductsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState('all');

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockProducts = [
      {
        id: '1',
        name: 'Premium Coffee Beans',
        sku: 'COF-001',
        category: 'Beverages',
        price: 24.99,
        currency: 'USD',
        stock: 150,
        isFeatured: true,
        featuredType: 'inventory',
        featuredPriority: 1,
        image_url: '/images/coffee-beans.jpg',
        description: 'Premium arabica coffee beans from Colombia',
        lastUpdated: '2024-01-19T10:30:00Z',
        views: 1250,
        sales: 89
      },
      {
        id: '2',
        name: 'Organic Green Tea',
        sku: 'TEA-002',
        category: 'Beverages',
        price: 18.99,
        currency: 'USD',
        stock: 75,
        isFeatured: true,
        featuredType: 'inventory',
        featuredPriority: 2,
        image_url: '/images/green-tea.jpg',
        description: 'Organic green tea leaves from Japan',
        lastUpdated: '2024-01-19T09:15:00Z',
        views: 890,
        sales: 56
      },
      {
        id: '3',
        name: 'Artisan Chocolate Bar',
        sku: 'CHO-003',
        category: 'Snacks',
        price: 12.99,
        currency: 'USD',
        stock: 200,
        isFeatured: true,
        featuredType: 'inventory',
        featuredPriority: 3,
        image_url: '/images/chocolate-bar.jpg',
        description: 'Handcrafted dark chocolate with sea salt',
        lastUpdated: '2024-01-19T11:45:00Z',
        views: 2100,
        sales: 145
      },
      {
        id: '4',
        name: 'Fresh Sourdough Bread',
        sku: 'BRE-004',
        category: 'Bakery',
        price: 8.99,
        currency: 'USD',
        stock: 25,
        isFeatured: false,
        featuredType: 'none',
        featuredPriority: 0,
        image_url: '/images/sourdough.jpg',
        description: 'Freshly baked sourdough bread daily',
        lastUpdated: '2024-01-19T06:30:00Z',
        views: 450,
        sales: 78
      },
      {
        id: '5',
        name: 'Local Honey Jar',
        sku: 'HON-005',
        category: 'Pantry',
        price: 15.99,
        currency: 'USD',
        stock: 60,
        isFeatured: true,
        featuredType: 'inventory',
        featuredPriority: 4,
        image_url: '/images/honey.jpg',
        description: 'Raw honey from local beekeepers',
        lastUpdated: '2024-01-19T08:00:00Z',
        views: 670,
        sales: 34
      }
    ];

    setTimeout(() => {
      setProducts(mockProducts);
      setLoading(false);
    }, 1000);
  }, [tenantId]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    const matchesStock = filterStock === 'all' || 
      (filterStock === 'in-stock' && product.stock > 0) ||
      (filterStock === 'low-stock' && product.stock <= 50);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleToggleFeatured = async (productId: string) => {
    setProducts(products.map(product => 
      product.id === productId 
        ? { 
            ...product, 
            isFeatured: !product.isFeatured,
            featuredType: !product.isFeatured ? 'inventory' : 'none',
            featuredPriority: !product.isFeatured ? products.filter(p => p.isFeatured).length + 1 : 0
          }
        : product
    ));
  };

  const handleUpdatePriority = async (productId: string, newPriority: number) => {
    setProducts(products.map(product => 
      product.id === productId 
        ? { ...product, featuredPriority: newPriority }
        : product
    ));
  };

  const categories = [...new Set(products.map(p => p.category))];
  const featuredCount = products.filter(p => p.isFeatured).length;
  const totalViews = products.reduce((sum, p) => sum + p.views, 0);
  const totalSales = products.reduce((sum, p) => sum + p.sales, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inventory Featured Products"
          description="Highlight your best inventory items with prominent display styling"
          icon={<Star className="w-6 h-6" />}
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Featured Products"
        description="Highlight your best inventory items with prominent display styling"
        icon={<Star className="w-6 h-6" />}
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Star className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Featured Items</p>
                <p className="text-2xl font-bold text-gray-900">{featuredCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">{totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by name, SKU, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Stock Levels</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock (≤50)</option>
            </select>

            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid/List */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Products</CardTitle>
          <CardDescription>
            Manage featured status and priority for your inventory items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                    product.isFeatured ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{product.name}</h3>
                      <p className="text-sm text-gray-600">{product.sku}</p>
                    </div>
                    {product.isFeatured && (
                      <Badge variant="warning" className="ml-2">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium">{product.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price:</span>
                      <span className="font-medium">${product.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stock:</span>
                      <span className={`font-medium ${
                        product.stock <= 50 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {product.stock}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Views:</span>
                      <span className="font-medium">{product.views.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sales:</span>
                      <span className="font-medium">{product.sales}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => handleToggleFeatured(product.id)}
                      variant={product.isFeatured ? 'outline' : 'default'}
                      size="sm"
                      className="flex-1"
                    >
                      {product.isFeatured ? 'Remove Featured' : 'Make Featured'}
                    </Button>
                    {product.isFeatured && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdatePriority(product.id, Math.max(1, product.featuredPriority - 1))}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                    product.isFeatured ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <span className="text-sm text-gray-600">{product.sku}</span>
                        {product.isFeatured && (
                          <Badge variant="warning">
                            <Star className="h-3 w-3 mr-1" />
                            Featured #{product.featuredPriority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <div className="font-medium">${product.price}</div>
                        <div className={`font-medium ${
                          product.stock <= 50 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          Stock: {product.stock}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{product.views.toLocaleString()} views</div>
                        <div className="font-medium">{product.sales} sales</div>
                      </div>
                      <Button
                        onClick={() => handleToggleFeatured(product.id)}
                        variant={product.isFeatured ? 'outline' : 'default'}
                        size="sm"
                      >
                        {product.isFeatured ? 'Remove' : 'Feature'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No products found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
