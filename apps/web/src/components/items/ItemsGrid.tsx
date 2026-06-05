import { Item } from '@/services/itemsDataService';
import EnhancedProductCard from './EnhancedProductCard';
import { Button } from '@mantine/core';

interface ItemsGridProps {
  items: Item[];
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
  onRestore?: (item: Item) => void;
  onPurge?: (item: Item) => void;
  tenantId?: string;
  bulkMode?: boolean;
  selectedItems?: Set<string>;
  onToggleSelection?: (itemId: string) => void;
  hasOrganizationAccess?: boolean;
  organizationData?: any;
}

/**
 * Enhanced Grid view component for items
 * Displays items as enhanced product cards in a responsive grid
 */
export default function ItemsGrid({
  items,
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
  onRestore,
  onPurge,
  tenantId,
  bulkMode = false,
  selectedItems = new Set(),
  onToggleSelection,
  hasOrganizationAccess,
  organizationData,
}: ItemsGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
          No items found
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400">
          Get started by adding your first item
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6" suppressHydrationWarning>
      {items.map((item) => (
        <EnhancedProductCard
          key={item.id}
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onQRCode={onQRCode}
          onPhotos={onPhotos}
          onCategory={onCategory}
          onClone={onClone}
          onPropagate={onPropagate}
          onVisibilityToggle={onVisibilityToggle}
          onStatusToggle={onStatusToggle}
          onStockUpdate={onStockUpdate}
          onRestore={onRestore}
          onPurge={onPurge}
          tenantId={tenantId}
          bulkMode={bulkMode}
          selectedItems={selectedItems}
          onToggleSelection={onToggleSelection}
          hasOrganizationAccess={hasOrganizationAccess}
          organizationData={organizationData}
          // Mock analytics data for now - will be replaced with real data
          analytics={{
            views: Math.floor(Math.random() * 100),
            clicks: Math.floor(Math.random() * 50),
            revenue: item.price ? item.price * Math.floor(Math.random() * 10) : 0,
          }}
        />
      ))}
    </div>
  );
}
