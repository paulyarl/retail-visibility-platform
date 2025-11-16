import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input, Alert } from '@/components/ui';
import { useFeatureFlag } from '@/lib/featureFlags';
import CategorySelector from './CategorySelector';

interface Item {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  manufacturer?: string;
  price: number;
  stock?: number;
  description?: string;
  status?: 'active' | 'inactive' | 'archived' | 'syncing';
  categoryPath?: string[];
}

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (item: Item) => Promise<void>;
}

export default function EditItemModal({ isOpen, onClose, item, onSave }: EditItemModalProps) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryPath, setCategoryPath] = useState<string[]>([]);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // Feature flag: sticky quick actions footer
  const ffQuick = useFeatureFlag('FF_CATEGORY_QUICK_ACTIONS');

  // Simple analytics logger
  function logQa(event: string, payload?: Record<string, any>) {
    try {
      console.debug(`[qa_footer_${event}]`, { itemId: item?.id, sku: item?.sku, ...payload });
    } catch {}
  }

  function getTenantIdFromUrl(): string | null {
    try {
      const m = window.location.pathname.match(/\/t\/([^/]+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setSku(item.sku || '');
      setName(item.name || '');
      setBrand(item.brand || '');
      setManufacturer(item.manufacturer || '');
      setPrice(item.price ? item.price.toFixed(2) : '');
      setStock(item.stock?.toString() || '');
      setDescription(item.description || '');
      setStatus((item.status === 'active' || item.status === 'inactive') ? item.status : 'active');
      setCategoryPath(item.categoryPath || []);
    }
  }, [item]);

  // Keyboard shortcuts when modal open and flag enabled
  useEffect(() => {
    if (!isOpen || !ffQuick) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const tid = getTenantIdFromUrl();
      // Alt+G → Align Category (navigate to Categories)
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        logQa('shortcut_align_category');
        if (tid) window.location.href = `/t/${tid}/categories`;
      }
      // Alt+V → Validate Feed
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        logQa('shortcut_validate_feed');
        if (tid) window.location.href = `/t/${tid}/feed-validation`;
      }
      // Alt+S → Save & Return
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        logQa('shortcut_save_return');
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, ffQuick, item, sku, name, brand, manufacturer, price, stock, description]);

  const handleSave = async () => {
    if (!item) return;

    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedItem = {
        ...item,
        sku: sku.trim(),
        name: name.trim(),
        brand: brand.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        stock: stock ? parseInt(stock) : undefined,
        description: description.trim() || undefined,
        status,
        itemStatus: status, // Backend uses itemStatus field
        categoryPath,
      } as Item;

      await onSave(updatedItem);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError(null);
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Item"
      description="Update item details"
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" title="Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Status Toggle */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Item Status
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setStatus('active')}
              disabled={saving}
              className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                status === 'active'
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Active</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatus('inactive')}
              disabled={saving}
              className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                status === 'inactive'
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Inactive</span>
              </div>
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            {status === 'active' 
              ? '✓ Item will sync to Google if public and has a category' 
              : '✗ Item will not sync to Google (inactive items are hidden)'}
          </p>
        </div>

        {/* SKU Field */}
        <div>
          <Input
            label="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g., SKU-001"
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Unique product identifier
          </p>
        </div>

        {/* Name Field */}
        <div>
          <Input
            label="Product Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Organic Honey 12oz"
            required
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Display name for the product
          </p>
        </div>

        {/* Brand Field */}
        <div>
          <Input
            label="Brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g., Fresh Farms"
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Brand name (optional)
          </p>
        </div>

        {/* Manufacturer Field */}
        <div>
          <Input
            label="Manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="e.g., Local Beekeepers Co."
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Supplier or manufacturer name (optional)
          </p>
        </div>

        {/* Price Field */}
        <div>
          <Input
            label="Price"
            type="number"
            step="0.5"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g., 12.99"
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Price in dollars (e.g., 12.99)
          </p>
        </div>

        {/* Stock Field */}
        <div>
          <Input
            label="Stock Quantity"
            type="number"
            step="1.0"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="e.g., 100"
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Available quantity in inventory
          </p>
        </div>

        {/* Description Field */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Premium organic honey sourced from local beekeepers..."
            disabled={saving}
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Product description for landing page (optional, not sent to Google Shopping)
          </p>
        </div>

        {/* Category Section */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Google Product Category
          </label>
          <div className="space-y-3">
            {/* Current Category Display */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Current Category
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {categoryPath.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {categoryPath.join(' › ')}
                      </span>
                    ) : (
                      <span className="text-neutral-500 italic">No category assigned</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCategorySelector(!showCategorySelector)}
                disabled={saving}
                className="w-full"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {showCategorySelector ? 'Hide Category Selection' : 'Change Category'}
              </Button>

              {showCategorySelector && (
                <div className="mt-3 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <CategorySelector
                    currentCategory={categoryPath}
                    onCategorySelect={(newCategory) => {
                      setCategoryPath(newCategory);
                      setShowCategorySelector(false);
                    }}
                    onCancel={() => setShowCategorySelector(false)}
                  />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Required for Google Shopping sync. Choose the most specific category that fits your product.
          </p>
        </div>

        {/* Current Values Display */}
        <div className="p-4 bg-neutral-50 rounded-lg">
          <p className="text-sm font-medium text-neutral-700 mb-2">Current Values</p>
          <div className="space-y-1 text-sm text-neutral-600">
            <p><span className="font-medium">SKU:</span> {item.sku}</p>
            <p><span className="font-medium">Name:</span> {item.name}</p>
            {item.brand && (
              <p><span className="font-medium">Brand:</span> {item.brand}</p>
            )}
            {item.manufacturer && (
              <p><span className="font-medium">Manufacturer:</span> {item.manufacturer}</p>
            )}
            {item.price !== undefined && (
              <p><span className="font-medium">Price:</span> ${item.price.toFixed(2)}</p>
            )}
            {item.stock !== undefined && (
              <p><span className="font-medium">Stock:</span> {item.stock}</p>
            )}
            <p><span className="font-medium">Category:</span> {item.categoryPath && item.categoryPath.length > 0 ? item.categoryPath.join(' › ') : 'None'}</p>
            {item.description && (
              <p><span className="font-medium">Description:</span> {item.description.substring(0, 100)}{item.description.length > 100 ? '...' : ''}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Quick Actions Footer (gated) */}
      {ffQuick && (
        <div className="mt-4 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-neutral-600">
              <span className="font-medium">Quick Actions</span>
              <span className="ml-2">Alt+G: Align • Alt+V: Validate • Alt+S: Save & Return</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  logQa('click_align_category');
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/categories`;
                }}
              >
                Align Category
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  logQa('click_preview_skus');
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/items`;
                }}
              >
                Preview SKUs
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  logQa('click_validate_feed');
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/feed-validation`;
                }}
              >
                Validate Feed
              </Button>
              <Button
                onClick={() => {
                  logQa('click_save_return');
                  handleSave();
                }}
                disabled={saving}
              >
                Save & Return
              </Button>
            </div>
          </div>
        </div>
      )}

      <ModalFooter>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
