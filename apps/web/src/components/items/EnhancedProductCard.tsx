/**
 * Enhanced Product Card Component
 * 
 * Shop management-inspired product card with:
 * - Visual status indicators
 * - Photo thumbnails (first 2-3 images)
 * - Quick action buttons
 * - URL information display
 * - Analytics preview
 * - Mobile-optimized layout
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, Badge, Tooltip } from '@/components/ui';
import { Button } from '@mantine/core';
import { 
  Edit3, 
  Trash2, 
  Eye, 
  Copy, 
  ExternalLink, 
  Package, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Archive,
  MoreVertical
} from 'lucide-react';
import { Item } from '@/services/itemsDataService';
import QuickStockEditor from '@/components/shared/QuickStockEditor';
import SyncStatusIndicator from './SyncStatusIndicator';

interface EnhancedProductCardProps {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onQRCode: (item: Item) => void;
  onPhotos: (item: Item) => void;
  onCategory: (item: Item) => void;
  onClone?: (item: Item) => void;
  onPropagate?: (item: Item) => void;
  onVisibilityToggle?: (item: Item) => void;
  onStatusToggle?: (item: Item) => void;
  onStockUpdate?: (itemId: string, newStock: number) => Promise<void>;
  tenantId?: string;
  bulkMode?: boolean;
  selectedItems?: Set<string>;
  onToggleSelection?: (itemId: string) => void;
  hasOrganizationAccess?: boolean;
  organizationData?: any;
  analytics?: {
    views?: number;
    clicks?: number;
    conversions?: number;
    revenue?: number;
  };
}

/**
 * Enhanced product card with shop management UX patterns
 */
export default function EnhancedProductCard({
  item,
  onEdit,
  onDelete,
  onQRCode,
  onPhotos,
  onCategory,
  onClone,
  onPropagate,
  onVisibilityToggle,
  onStatusToggle,
  onStockUpdate,
  tenantId,
  bulkMode = false,
  selectedItems = new Set(),
  onToggleSelection,
  hasOrganizationAccess,
  organizationData,
  analytics,
}: EnhancedProductCardProps) {
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Status configuration
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          variant: 'success' as const,
          icon: CheckCircle,
          label: 'Active',
          color: 'text-green-600 bg-green-50 border-green-200'
        };
      case 'inactive':
        return {
          variant: 'warning' as const,
          icon: AlertCircle,
          label: 'Inactive',
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200'
        };
      case 'archived':
        return {
          variant: 'default' as const,
          icon: Archive,
          label: 'Archived',
          color: 'text-gray-600 bg-gray-50 border-gray-200'
        };
      case 'syncing':
        return {
          variant: 'info' as const,
          icon: Clock,
          label: 'Syncing',
          color: 'text-blue-600 bg-blue-50 border-blue-200'
        };
      default:
        return {
          variant: 'default' as const,
          icon: Package,
          label: 'Draft',
          color: 'text-gray-600 bg-gray-50 border-gray-200'
        };
    }
  };

  const statusConfig = getStatusConfig(item.itemStatus || item.status || 'draft');
  const StatusIcon = statusConfig.icon;

  // Stock status
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { status: 'out', color: 'text-red-600 bg-red-50', label: 'Out of Stock' };
    if (stock < 5) return { status: 'low', color: 'text-orange-600 bg-orange-50', label: 'Low Stock' };
    return { status: 'good', color: 'text-green-600 bg-green-50', label: 'In Stock' };
  };

  const stockStatus = getStockStatus(item.stock);

  // Generate product URL
  const productUrl = `/products/${item.id}`;

  return (
    <Card className={`group hover:shadow-lg transition-all duration-200 ${bulkMode ? 'ring-2 ring-primary-500' : ''} ${selectedItems.has(item.id) ? 'ring-2 ring-primary-500 bg-primary-50/50' : ''}`}>
      <CardContent className="p-4">
        {/* Header with Status and Selection */}
        <div className="flex items-start justify-between mb-3">
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </div>

          {/* Selection Checkbox for Bulk Mode */}
          {bulkMode && (
            <input
              type="checkbox"
              checked={selectedItems.has(item.id)}
              onChange={() => onToggleSelection?.(item.id)}
              className="w-5 h-5 rounded border-2 border-primary-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>

        {/* Image Section with Thumbnails */}
        <div className="relative mb-3">
          <div 
            className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => {
              if (bulkMode && onToggleSelection) {
                onToggleSelection(item.id);
              } else {
                tenantId && window.open(`/t/${tenantId}/items/${item.id}`, '_blank');
              }
            }}
            title={bulkMode ? "Click to select" : "View item details"}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-neutral-400" />
              </div>
            )}
          </div>

          {/* Photo Count Badge */}
          {item.photoCount && item.photoCount > 1 && (
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
              +{item.photoCount - 1} photos
            </div>
          )}

          {/* Stock Status Badge */}
          <div className={`absolute top-2 right-2 ${stockStatus.color} text-xs px-2 py-1 rounded-full font-medium`}>
            {stockStatus.label}
          </div>
        </div>

        {/* Product Information */}
        <div className="space-y-2 mb-3">
          {/* Product Name */}
          <h4 
            className="font-semibold text-neutral-900 dark:text-neutral-900 line-clamp-2 cursor-pointer hover:text-primary-600 transition-colors"
            onClick={() => tenantId && window.open(`/t/${tenantId}/items/${item.id}`, '_blank')}
            title="View item details"
          >
            {item.name}
          </h4>

          {/* SKU and Price */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              SKU: {item.sku}
            </span>
            <div className="font-bold text-neutral-900 dark:text-neutral-900">
              {item.price && item.price > 0 ? `$${item.price.toFixed(2)}` : 'No price'}
            </div>
          </div>

          {/* Category */}
          {item.tenantCategory && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-700 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800">
              <span>{typeof item.tenantCategory === 'string' ? item.tenantCategory : item.tenantCategory?.name || ''}</span>
            </div>
          )}

          {/* Sync Status */}
          <SyncStatusIndicator 
            itemStatus={item.status}
            visibility={item.visibility}
            tenantCategoryId={item.tenantCategoryId}
            showDetails={false}
          />
        </div>

        {/* Analytics Preview */}
        {analytics && (analytics.views || analytics.clicks) && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 mb-3">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-3">
                {analytics.views && (
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{analytics.views}</span>
                  </div>
                )}
                {analytics.clicks && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>{analytics.clicks}</span>
                  </div>
                )}
              </div>
              {analytics.revenue && (
                <div className="font-medium text-green-600">
                  ${analytics.revenue.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* URL Information */}
        {tenantId && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                <ExternalLink className="w-3 h-3" />
                <span className="font-mono truncate max-w-[120px]">
                  /products/{item.id}
                </span>
              </div>
              <Tooltip content="Copy product URL">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}${productUrl}`)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Quick Stock Editor */}
        {onStockUpdate && (
          <div className="mb-3">
            <QuickStockEditor
              itemId={item.id}
              itemName={item.name}
              currentStock={item.stock}
              onUpdate={onStockUpdate}
              compact={true}
              showStatus={false}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-700">
          {/* Primary Actions */}
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onEdit(item)} 
            className="flex-1 text-xs"
            title="Edit product details"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Edit
          </Button>

          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onPhotos(item)} 
            className="text-xs"
            title="Manage photos"
          >
            <Eye className="w-3 h-3" />
          </Button>

          {/* More Actions Dropdown */}
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="text-xs"
              title="More actions"
            >
              <MoreVertical className="w-3 h-3" />
            </Button>

            {showMoreActions && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  {onClone && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onClone(item);
                        setShowMoreActions(false);
                      }}
                      className="w-full justify-start text-xs"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Clone Product
                    </Button>
                  )}
                  
                  {onPropagate && (
                    <>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onPropagate(item);
                          setShowMoreActions(false);
                        }}
                        disabled={!hasOrganizationAccess || !organizationData || organizationData.tenants.length <= 1}
                        className={`w-full justify-start text-xs ${
                          hasOrganizationAccess && organizationData && organizationData.tenants.length > 1
                            ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        title={
                          hasOrganizationAccess && organizationData && organizationData.tenants.length > 1
                            ? 'Propagate to other locations in your organization'
                            : !hasOrganizationAccess
                            ? 'Propagation requires organization membership'
                            : organizationData?.tenants.length <= 1
                            ? 'Propagation requires multiple locations in your organization'
                            : 'Loading organization data...'
                        }
                      >
                        <Package className="w-3 h-3 mr-2" />
                        Propagate to Locations
                        {(!hasOrganizationAccess || !organizationData || organizationData.tenants.length <= 1) && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-semibold">
                            {!hasOrganizationAccess ? 'ORG' : organizationData?.tenants.length <= 1 ? '1 LOC' : 'LOAD'}
                          </span>
                        )}
                      </Button>
                    </>
                  )}
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onCategory(item);
                      setShowMoreActions(false);
                    }}
                    className="w-full justify-start text-xs"
                  >
                    <Package className="w-3 h-3 mr-2" />
                    Categories
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onQRCode(item);
                      setShowMoreActions(false);
                    }}
                    className="w-full justify-start text-xs"
                  >
                    <Eye className="w-3 h-3 mr-2" />
                    QR Code
                  </Button>

                  <hr className="my-1 border-gray-200 dark:border-gray-700" />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onDelete(item);
                      setShowMoreActions(false);
                    }}
                    className="w-full justify-start text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
