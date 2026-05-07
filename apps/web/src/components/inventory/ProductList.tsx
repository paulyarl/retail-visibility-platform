/**
 * Product List Component
 * 
 * Displays products with shop management-inspired UX:
 * - Product cards with status indicators
 * - URL display and copy functionality
 * - Bulk selection capabilities
 * - Mobile-responsive design
 * - Real-time updates
 * 
 * Following shop management dashboard patterns
 */

'use client';

import { useState } from 'react';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  MoreVertical,
  Package,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

import { Button } from '@mantine/core';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
// Dropdown components not available, using basic button menu for now
// import { 
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
// Simple copy function since copyToClipboard not available
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

interface ProductListProps {
  products: any[];
  loading?: boolean;
  selectedProducts: string[];
  onProductSelect: (productId: string) => void;
  onProductEdit: (productId: string) => void;
  onProductView: (productId: string) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  onRefresh: () => void;
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
  urls?: {
    skuUrl: string;
    productIdUrl: string;
    autoIdUrl?: string;
    canonicalUrl: string;
    storefrontUrl: string;
    directoryUrl: string;
  };
}

export default function ProductList({
  products,
  loading = false,
  selectedProducts,
  onProductSelect,
  onProductEdit,
  onProductView,
  getStatusColor,
  getStatusText,
  onRefresh
}: ProductListProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleCopyUrl = async (url: string, type: string) => {
    try {
      await copyToClipboard(url);
      setCopiedUrl(`${type} URL copied to clipboard!`);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleImageError = (productId: string) => {
    setImageErrors(prev => new Set(prev).add(productId));
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateString));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'draft':
        return <Package className="h-4 w-4 text-gray-500" />;
      case 'archived':
        return <Package className="h-4 w-4 text-yellow-500" />;
      case 'out_of_stock':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'low_stock':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return 'text-red-600';
    if (stock <= 5) return 'text-orange-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500 mb-4">
            Get started by adding your first product
          </p>
          <Button onClick={onRefresh}>Refresh</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Copied URL Notification */}
      {copiedUrl && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">{copiedUrl}</p>
        </div>
      )}

      {/* Product List */}
      <div className="space-y-4">
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start space-x-4">
                {/* Checkbox */}
                <div className="pt-1">
                  <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => onProductSelect(product.id)}
                  />
                </div>

                {/* Product Image */}
                <div className="flex-shrink-0">
                  {product.imageUrl && !imageErrors.has(product.id) ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-16 w-16 rounded-lg object-cover"
                      onError={() => handleImageError(product.id)}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {product.name}
                    </h3>
                    {getStatusIcon(product.status)}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                    <span>SKU: {product.sku}</span>
                    {product.category && (
                      <span>• {product.category}</span>
                    )}
                    {product.hasVariants && (
                      <Badge variant="default" className="text-xs">
                        Variants
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(product.priceCents)}
                        </p>
                        <p className={`text-sm ${getStockColor(product.stock)}`}>
                          {product.stock} in stock
                        </p>
                      </div>
                    
                    <div className="text-sm text-gray-500">
                      <p>Created: {formatDate(product.createdAt)}</p>
                      {product.viewCount && (
                        <p>{product.viewCount} views</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProductView(product.id)}
                    className="p-2"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProductEdit(product.id)}
                    className="p-2"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  {/* Replace dropdown menu with simple buttons for now */}
                  <Button variant="ghost" size="sm" className="p-2" onClick={() => handleCopyUrl(product.urls?.canonicalUrl || '', 'Canonical')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2" onClick={() => handleCopyUrl(product.urls?.skuUrl || '', 'SKU')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2" onClick={() => handleCopyUrl(product.urls?.productIdUrl || '', 'Product ID')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  {product.urls?.autoIdUrl && (
                    <Button variant="ghost" size="sm" className="p-2" onClick={() => handleCopyUrl(product.urls.autoIdUrl, 'Auto ID')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="p-2" onClick={() => window.open(product.urls?.storefrontUrl || '', '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2" onClick={() => window.open(product.urls?.directoryUrl || '', '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

              {/* URLs Section */}
              {product.urls && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Canonical:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-blue-600 truncate max-w-xs">
                          {product.urls.canonicalUrl}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyUrl(product.urls.canonicalUrl, 'Canonical')}
                          className="p-1"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">SKU:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-green-600 truncate max-w-xs">
                          {product.urls.skuUrl}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyUrl(product.urls.skuUrl, 'SKU')}
                          className="p-1"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Product ID:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-orange-600 truncate max-w-xs">
                          {product.urls.productIdUrl}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyUrl(product.urls.productIdUrl, 'Product ID')}
                          className="p-1"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {product.urls.autoIdUrl && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Auto ID:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-purple-600 truncate max-w-xs">
                            {product.urls.autoIdUrl}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyUrl(product.urls.autoIdUrl, 'Auto ID')}
                            className="p-1"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
