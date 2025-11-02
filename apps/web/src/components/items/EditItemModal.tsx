"use client";

import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input, Alert } from '@/components/ui';
import { useFeatureFlag } from '@/lib/featureFlags';

interface Item {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  manufacturer?: string;
  priceCents?: number;
  stock?: number;
  description?: string;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setPrice(item.priceCents ? (item.priceCents / 100).toFixed(2) : '');
      setStock(item.stock?.toString() || '');
      setDescription(item.description || '');
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

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedItem: Item = {
        ...item,
        sku: sku.trim(),
        name: name.trim(),
        brand: brand.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        priceCents: price ? Math.round(parseFloat(price) * 100) : undefined,
        stock: stock ? parseInt(stock) : undefined,
        description: description.trim() || undefined,
      };

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
            step="0.01"
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
            {item.priceCents !== undefined && (
              <p><span className="font-medium">Price:</span> ${(item.priceCents / 100).toFixed(2)}</p>
            )}
            {item.stock !== undefined && (
              <p><span className="font-medium">Stock:</span> {item.stock}</p>
            )}
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
