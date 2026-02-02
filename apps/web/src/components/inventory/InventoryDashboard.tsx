/**
 * Central Inventory Dashboard Component
 * 
 * Main dashboard component following shop management patterns:
 * - Header with tenant info and capacity indicators
 * - Stats overview with key metrics
 * - Quick actions for common tasks
 * - Product list with filtering and search
 * - Mobile-responsive design
 * 
 * Inspired by shop management dashboard UX patterns
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Upload, 
  Camera, 
  Search, 
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy,
  ExternalLink
} from 'lucide-react';


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/shadcn-select';

import InventoryStats from '@/components/inventory/InventoryStats';
import QuickActions from '@/components/inventory/QuickActions';
import ProductList from '@/components/inventory/ProductList';
import ProductFilters from '@/components/inventory/ProductFilters';
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge'; 
import { Tabs,TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Input,Button } from '../ui';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface InventoryDashboardProps {
  tenantId: string;
  tenant: any;
  usage: any;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  status: string;
  imageUrl?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  hasVariants?: boolean;
  viewCount?: number;
  orderCount?: number;
}

export default function InventoryDashboard({ tenantId, tenant, usage }: InventoryDashboardProps) {
  const [activeTab, setActiveTab] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Basic state management for products
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [suggestions, setSuggestions] = useState<{ text: string; sku: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(true); // Basic connection state
  const [updates, setUpdates] = useState<string[]>([]); // Mock updates state

  // Mock clear updates function
  const clearUpdates = () => {
    setUpdates([]);
  };

  // Mock refresh function
  const refresh = () => {
    setLoading(true);
    // This would be implemented with actual API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map((p: Product) => p.id));
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-yellow-100 text-yellow-800';
      case 'out_of_stock': return 'bg-red-100 text-red-800';
      case 'low_stock': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'draft': return 'Draft';
      case 'archived': return 'Archived';
      case 'out_of_stock': return 'Out of Stock';
      case 'low_stock': return 'Low Stock';
      default: return status;
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading inventory</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={refresh}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
          <p className="text-gray-600">Manage products and inventory for {tenant.name}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          
          {/* Capacity Badge */}
          <SubscriptionUsageBadge 
            variant="compact" 
            tenantId={tenantId}
            showUpgradeLink={true}
          />
        </div>
      </div>

      {/* Stats Overview */}
      <InventoryStats 
        tenantId={tenantId}
        loading={loading}
        refresh={refresh}
      />

      {/* Quick Actions */}
      <QuickActions 
        tenantId={tenantId}
        onActionComplete={refresh}
      />

      {/* Real-time Updates Indicator */}
      {updates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-blue-800">
                {updates.length} real-time update{updates.length > 1 ? 's' : ''} available
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearUpdates}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {isSearching && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {suggestions.map((suggestion: { text: string; sku: string }, index: number) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => setSearchQuery(suggestion.text)}
                    >
                      <div className="font-medium">{suggestion.text}</div>
                      <div className="text-gray-500 text-xs">{suggestion.sku}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>

            {/* Sort */}
            <Select value={sortBy} onValueChange={handleSort}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="sku">SKU</SelectItem>
                <SelectItem value="price_cents">Price</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="updated_at">Updated Date</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2"
            >
              {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <ProductFilters
              tenantId={tenantId}
              onFilterChange={refresh}
              onClose={() => setShowFilters(false)}
            />
          )}

          {/* Bulk Actions */}
          {selectedProducts.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedProducts.length === products.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Product List */}
          <ProductList
            products={products}
            loading={loading}
            selectedProducts={selectedProducts}
            onProductSelect={handleProductSelect}
            onProductEdit={(productId) => {
              // Navigate to product edit page
              window.location.href = `/t/${tenantId}/inventory/${productId}/edit`;
            }}
            onProductView={(productId) => {
              // Navigate to product view page
              window.location.href = `/products/${productId}`;
            }}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
            onRefresh={refresh}
          />

          {/* Load More */}
          {products.length < totalCount && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => {
                  // Load more products
                  // This would be implemented in the useInventoryData hook
                }}
                disabled={loading}
              >
                {loading ? 'Loading...' : `Load More (${totalCount - products.length} remaining)`}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-500">Analytics coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-500">Settings coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
