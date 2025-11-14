import { Badge, Button, Card, CardContent } from '@/components/ui';
import { Item } from '@/services/itemsDataService';
import SyncStatusIndicator from './SyncStatusIndicator';

interface ItemsListProps {
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
 * List view component for items
 * Displays items in a 2-row card format with all actions
 */
export default function ItemsList({
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
}: ItemsListProps) {
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
    <div className="space-y-3 sm:space-y-4 mb-6" suppressHydrationWarning>
      {items.map((item) => (
        <Card 
          key={item.id} 
          className="border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-md hover:shadow-xl hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-800 dark:to-neutral-900"
        >
          <CardContent className="p-3 sm:p-4 md:p-5">
            {/* Row 1: Main Info */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3">
              {/* Image - Primary photo - Clickable */}
              <div 
                className="flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => tenantId && window.open(`/t/${tenantId}/items/${item.id}`, '_blank')}
                title="View item details"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shadow-md border-2 border-neutral-200 dark:border-neutral-600"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-600">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mb-0.5 sm:mb-1 truncate cursor-pointer hover:text-primary-600 transition-colors"
                      onClick={() => tenantId && window.open(`/t/${tenantId}/items/${item.id}`, '_blank')}
                      title="View item details"
                    >
                      {item.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-500 font-mono">{item.sku}</p>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {item.categoryPath && item.categoryPath.length > 0 && (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800 mt-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {item.categoryPath.join(' › ')}
                      </div>
                    )}
                  </div>
                  
                  {/* Badges & Sync Status */}
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Badge variant={item.status === 'active' ? 'success' : 'default'}>
                        {item.status}
                      </Badge>
                      <Badge variant={item.visibility === 'public' ? 'info' : 'default'}>
                        {item.visibility}
                      </Badge>
                    </div>
                    {/* Sync Status - right next to badges */}
                    <SyncStatusIndicator 
                      itemStatus={item.status}
                      visibility={item.visibility}
                      categoryPath={item.categoryPath}
                      showDetails={true}
                    />
                  </div>
                </div>

                {/* Price & Stock */}
                <div className="flex items-center gap-6 mt-2">
                  <div>
                    <p className="text-xs text-neutral-500">Price</p>
                    <p className="text-xl font-bold text-neutral-900 dark:text-white">
                      ${(item.price / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Stock</p>
                    <p className={`text-lg font-semibold ${item.stock < 10 ? 'text-warning' : 'text-success'}`}>
                      {item.stock}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Actions - Core sync actions first, then additional, then blocking */}
            <div className="flex flex-wrap gap-2 pt-4 mt-1 border-t-2 border-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200 dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700">
              {/* CORE SYNC ACTIONS - Edit, Photos, Category */}
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => onEdit(item)}
                title="Edit product details (name, price, description, etc.)"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onPhotos(item)}
                title="Add or manage product images (required for Google sync)"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Photos
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onCategory(item)}
                title="Assign Google product category (required for Google sync)"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Category
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

              {/* Blocking Actions - Right Side (grouped together) */}
              {onStatusToggle && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => onStatusToggle(item)}
                  title={item.status === 'active' ? 'Archive this product (will stop syncing to Google, but keeps the data)' : 'Restore from archive (required for Google sync)'}
                  className={`ml-auto ${item.status === 'active' ? 'text-green-600 hover:text-green-700' : 'text-amber-600 hover:text-amber-700'}`}
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
