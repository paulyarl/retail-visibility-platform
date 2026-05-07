'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2, Package, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@mantine/core';
import { Input } from '@/components/ui/Input';
import { itemsService } from '@/services/ItemsSingletonService';

interface ItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (itemId: string) => void;
  tenantId: string;
}

interface Item {
  id: string;
  name: string;
  brand?: string;
  sku?: string;
  image_url?: string;
  price: number | null; // Match ItemsSingletonService.Item type
  item_status?: string;
}

export default function ItemPickerModal({ isOpen, onClose, onSelect, tenantId }: ItemPickerModalProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadItems = useCallback(async (resetPage = false) => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const currentPage = resetPage ? 1 : page;
      const result = await itemsService.getItemsComplete({
        tenant_id: tenantId,
        q: searchQuery || undefined,
        page: currentPage,
        limit: 20,
      });

      if (result?.items && Array.isArray(result.items)) {
        if (resetPage) {
          setItems(result.items);
          setPage(1);
        } else {
          setItems(prev => [...prev, ...result.items]);
        }
        setHasMore(result.pagination?.hasMore ?? result.items.length === 20);
      }
    } catch (error) {
      console.error('[ItemPickerModal] Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, searchQuery, page]);

  // Load items when modal opens or search changes
  useEffect(() => {
    if (isOpen) {
      loadItems(true);
    }
  }, [isOpen, searchQuery]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        loadItems(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelect = (itemId: string) => {
    onSelect(itemId);
    onClose();
    setSearchQuery('');
    setItems([]);
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    loadItems(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Select Item to Edit
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search items by name, brand, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto mt-4">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? 'No items found matching your search' : 'No items available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-3"
                  onClick={() => handleSelect(item.id)}
                >
                  {/* Image */}
                  <div className="w-16 h-16 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    {item.brand && (
                      <div className="text-xs text-gray-500 truncate">{item.brand}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {item.sku && (
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {item.sku}
                        </span>
                      )}
                      {item.price != null && (
                        <span className="text-xs text-green-600 font-medium">
                          ${((item.price ?? 0) / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit Icon */}
                  <Edit className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && items.length > 0 && (
            <div className="py-4 text-center">
              <Button
                variant="subtle"
                onClick={handleLoadMore}
                loading={isLoading}
              >
                Load More
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
