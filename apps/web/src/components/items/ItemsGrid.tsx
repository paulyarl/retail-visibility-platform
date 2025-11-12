import { Card, CardContent, Badge, Button } from '@/components/ui';
import { Item } from '@/services/itemsDataService';
import SyncStatusIndicator from './SyncStatusIndicator';

interface ItemsGridProps {
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onQRCode: (item: Item) => void;
  onPhotos: (item: Item) => void;
  onCategory: (item: Item) => void;
  onPropagate?: (item: Item) => void;
  onVisibilityToggle?: (item: Item) => void;
  onStatusToggle?: (item: Item) => void;
  tenantId?: string;
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
  onVisibilityToggle,
  onStatusToggle,
  tenantId,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6" suppressHydrationWarning>
      {items.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 sm:p-4">
            {/* Image - Clickable */}
            <div 
              className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-3 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => tenantId && window.open(`/t/${tenantId}/items/${item.id}`, '_blank')}
              title="View item details"
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
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
                <h4 
                  className="font-semibold text-neutral-900 dark:text-white line-clamp-2 cursor-pointer hover:text-primary-600 transition-colors"
                  onClick={() => tenantId && window.open(`/t/${tenantId}/items/${item.id}`, '_blank')}
                  title="View item details"
                >
                  {item.name}
                </h4>
                {item.status && (
                  <Badge variant={item.status === 'active' ? 'success' : item.status === 'syncing' ? 'info' : 'default'}>
                    {item.status}
                  </Badge>
                )}
              </div>

              {/* Sync Status - compact view right after title */}
              <SyncStatusIndicator 
                itemStatus={item.status}
                visibility={item.visibility}
                categoryPath={item.categoryPath}
                showDetails={false}
              />

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

            {/* Action Buttons - Core sync-enabling actions first */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 sm:mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
              {/* CORE SYNC ACTIONS - Edit, Photos, Category */}
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onEdit(item)} 
                className="text-xs sm:text-sm min-h-[36px] sm:min-h-[32px]"
                title="Edit product details (name, price, description, etc.)"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden xs:inline">Edit</span>
                <span className="xs:hidden">✏️</span>
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onPhotos(item)} 
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 text-xs sm:text-sm min-h-[36px] sm:min-h-[32px]"
                title="Add or manage product images (required for Google sync)"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden xs:inline">Photos</span>
                <span className="xs:hidden">📸</span>
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onCategory(item)} 
                className="text-xs sm:text-sm min-h-[36px] sm:min-h-[32px]"
                title="Assign Google product category (required for Google sync)"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="hidden xs:inline">Category</span>
                <span className="xs:hidden">🏷️</span>
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => window.open(`/products/${item.id}`, '_blank')} 
                className="text-xs sm:text-sm min-h-[36px] sm:min-h-[32px]"
                title="View public product page (storefront)"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="hidden xs:inline">View</span>
                <span className="xs:hidden">👁️</span>
              </Button>

              {/* ADDITIONAL ACTIONS */}
              {tenantId && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => window.location.href = `/t/${tenantId}/scan?mode=enrich&itemId=${item.id}&sku=${encodeURIComponent(item.sku)}`}
                  title="Scan barcode to add images, descriptions, and product details"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Enrich
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onQRCode(item)}
                title="Generate QR code for this product (for in-store displays)"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                QR
              </Button>

              {/* BLOCKING ACTIONS - Status, Visibility, Delete */}
              {onVisibilityToggle && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => onVisibilityToggle(item)}
                  title={item.visibility === 'public' ? 'Click to make Private (will stop syncing to Google)' : 'Click to make Public (required for Google sync)'}
                >
                  {item.visibility === 'public' ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Public
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      Private
                    </>
                  )}
                </Button>
              )}
              {onStatusToggle && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => onStatusToggle(item)}
                  title={item.status === 'active' ? 'Archive this product (will stop syncing to Google, but keeps the data)' : 'Restore from archive (required for Google sync)'}
                  className={item.status === 'active' ? 'text-green-600 hover:text-green-700' : 'text-amber-600 hover:text-amber-700'}
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    {item.status === 'active' ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    )}
                  </svg>
                  {item.status === 'active' ? 'Active' : 'Archived'}
                </Button>
              )}
              {/* Always show Propagate to demonstrate org-tier value */}
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onPropagate?.(item)}
                disabled={!onPropagate}
                title={onPropagate ? "Push this product to all your other locations (Starter+ with 2+ locations)" : "Propagate to other locations - Available on Starter tier with 2+ locations"}
                className={`bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 ${!onPropagate ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Propagate
                {!onPropagate && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-semibold">ORG</span>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Move "${item.name}" to trash?`)) {
                    onDelete(item);
                  }
                }}
                className="text-error hover:text-error"
                title="Move to trash (can be permanently deleted later)"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Trash
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
