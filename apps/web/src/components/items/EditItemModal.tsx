"use client";

import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input, Alert } from '@/components/ui';

interface Item {
  id: string;
  sku: string;
  name: string;
  priceCents?: number;
  stock?: number;
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
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setSku(item.sku || '');
      setName(item.name || '');
      setPrice(item.priceCents ? (item.priceCents / 100).toFixed(2) : '');
      setStock(item.stock?.toString() || '');
    }
  }, [item]);

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
        priceCents: price ? Math.round(parseFloat(price) * 100) : undefined,
        stock: stock ? parseInt(stock) : undefined,
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

        {/* Current Values Display */}
        <div className="p-4 bg-neutral-50 rounded-lg">
          <p className="text-sm font-medium text-neutral-700 mb-2">Current Values</p>
          <div className="space-y-1 text-sm text-neutral-600">
            <p><span className="font-medium">SKU:</span> {item.sku}</p>
            <p><span className="font-medium">Name:</span> {item.name}</p>
            {item.priceCents !== undefined && (
              <p><span className="font-medium">Price:</span> ${(item.priceCents / 100).toFixed(2)}</p>
            )}
            {item.stock !== undefined && (
              <p><span className="font-medium">Stock:</span> {item.stock}</p>
            )}
          </div>
        </div>
      </div>

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
