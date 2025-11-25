import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Modal, ModalFooter, Button, Input, Alert } from '@/components/ui';
import { useFeatureFlag } from '@/lib/featureFlags';
import { apiRequest } from '@/lib/api';
import TenantCategorySelector from './TenantCategorySelector';

// Helper component to display category name by ID
function CategoryNameDisplay({ categoryId }: { categoryId: string }) {
  const [categoryName, setCategoryName] = useState<string>('Loading...');
  const params = useParams();
  const tenantId = params.tenantId as string;

  useEffect(() => {
    async function fetchCategory() {
      try {
        const response = await apiRequest(`api/v1/tenants/${tenantId}/categories`);
        if (response.ok) {
          const result = await response.json();
          const category = result.data?.find((c: any) => c.id === categoryId);
          if (category) {
            setCategoryName(category.name);
            if (category.googleCategoryId) {
              setCategoryName(`${category.name} (${category.googleCategoryId})`);
            }
          }
        }
      } catch (error) {
        setCategoryName('Unknown category');
      }
    }
    fetchCategory();
  }, [categoryId, tenantId]);

  return <span className="font-medium">{categoryName}</span>;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  manufacturer?: string;
  price: number;
  stock?: number;
  description?: string;
  status?: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing';
  categoryPath?: string[];
  tenantCategoryId?: string | null;
  tenantCategory?: {
    id: string;
    name: string;
    slug?: string;
    googleCategoryId?: string | null;
  };
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
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantCategoryId, setTenantCategoryId] = useState<string>('');
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
      // Map 'inactive' to 'archived' since we no longer have an Inactive button
      const mappedStatus = item.status === 'inactive' ? 'archived' : item.status;
      setStatus((mappedStatus === 'draft' || mappedStatus === 'active' || mappedStatus === 'archived') ? mappedStatus : 'draft');
      setTenantCategoryId(item.tenantCategoryId || '');
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
        itemStatus: status === 'draft' ? 'active' : status, // Map draft to active for API
        tenantCategoryId: tenantCategoryId || null,
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={item ? "Edit Item" : "Add New Item"}
      description={item ? "Update item details" : "Create a new item"}
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
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus('draft')}
              disabled={saving}
              className={`px-3 py-2 rounded-lg border-2 transition-all ${
                status === 'draft'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">✏️</span>
                <span className="text-xs font-medium">Draft</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatus('active')}
              disabled={saving}
              className={`px-3 py-2 rounded-lg border-2 transition-all ${
                status === 'active'
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">✓</span>
                <span className="text-xs font-medium">Active</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatus('archived')}
              disabled={saving}
              className={`px-3 py-2 rounded-lg border-2 transition-all ${
                status === 'archived'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">📦</span>
                <span className="text-xs font-medium">Archived</span>
              </div>
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            {status === 'draft' && '✏️ Draft - Review before activating (will not sync)'}
            {status === 'active' && '✓ Active - Will sync to Google if public and has a category'}
            {status === 'archived' && '📦 Archived - Preserved but will not sync to Google'}
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
            Product Category
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
                    {item?.tenantCategory ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {item.tenantCategory.name}
                        {item.tenantCategory.googleCategoryId && (
                          <span className="text-xs">({item.tenantCategory.googleCategoryId})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-neutral-500 italic">No category assigned</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Category Display - Shows pending change */}
            {tenantCategoryId && tenantCategoryId !== (item?.tenantCategoryId || '') && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 animate-pulse">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                      Selected Category (pending save)
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      <CategoryNameDisplay categoryId={tenantCategoryId} />
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ Click "Save Changes" to apply this category
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                  <TenantCategorySelector
                    selectedCategoryId={tenantCategoryId}
                    onSelect={(categoryId) => {
                      setTenantCategoryId(categoryId);
                      setShowCategorySelector(false);
                    }}
                    onCancel={() => setShowCategorySelector(false)}
                  />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Assign a category to organize your products. Categories with Google IDs will sync to Google Shopping.
          </p>
        </div>

        {/* Current Values Display - Only show when editing existing item */}
        {item && (
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
              <p><span className="font-medium">Category:</span> {item.tenantCategory ? item.tenantCategory.name : 'None'}</p>
              {item.description && (
                <p><span className="font-medium">Description:</span> {item.description.substring(0, 100)}{item.description.length > 100 ? '...' : ''}</p>
              )}
            </div>
          </div>
        )}
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
