import { Card, CardContent, Badge, Button } from '@/components/ui';
import { Item } from '@/services/itemsDataService';

interface ItemsGridProps {
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onQRCode: (item: Item) => void;
  onPhotos: (item: Item) => void;
  onCategory: (item: Item) => void;
  onPropagate?: (item: Item) => void;
}

/**
 * Grid view component for items
 * Displays items as cards in a responsive grid
 */
export default function ItemsGrid({
  items,
  onEdit,
  onDelete,
  onQRCode,
  onPhotos,
  onCategory,
  onPropagate,
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6" suppressHydrationWarning>
      {items.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            {/* Image */}
            <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-3 overflow-hidden">
              {item.images && item.images.length > 0 ? (
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-neutral-900 dark:text-white line-clamp-2">
                  {item.name}
                </h4>
                <Badge variant={item.status === 'active' ? 'success' : 'default'}>
                  {item.status}
                </Badge>
              </div>

              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                SKU: {item.sku}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-neutral-900 dark:text-white">
                  ${(item.price / 100).toFixed(2)}
                </div>
                <div className={`text-sm ${item.stock < 10 ? 'text-warning font-medium' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  Stock: {item.stock}
                </div>
              </div>

              {item.categoryPath && item.categoryPath.length > 0 && (
                <div className="text-xs text-neutral-500">
                  {item.categoryPath.join(' > ')}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onEdit(item)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onPhotos(item)}>
                Photos
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onQRCode(item)}>
                QR
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onCategory(item)}>
                Category
              </Button>
              {onPropagate && (
                <Button size="sm" variant="ghost" onClick={() => onPropagate(item)}>
                  Propagate
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete "${item.name}"?`)) {
                    onDelete(item);
                  }
                }}
                className="text-error hover:text-error"
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
