import { Card, CardContent, Input, Button } from '@/components/ui';

interface ItemFormData {
  sku: string;
  name: string;
  price: string;
  stock: string;
  description?: string;
}

interface ItemsCreateFormProps {
  formData: ItemFormData;
  onFieldChange: (field: keyof ItemFormData, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isValid: boolean;
  creating: boolean;
}

/**
 * Create form component for adding new items
 * Handles SKU, name, price, stock, and description inputs
 */
export default function ItemsCreateForm({
  formData,
  onFieldChange,
  onSubmit,
  onCancel,
  isValid,
  creating,
}: ItemsCreateFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !creating) {
      onSubmit();
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Add New Item
          </h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SKU */}
            <Input
              label="SKU"
              placeholder="e.g., PROD-001"
              value={formData.sku}
              onChange={(e) => onFieldChange('sku', e.target.value)}
              required
              disabled={creating}
            />

            {/* Name */}
            <Input
              label="Product Name"
              placeholder="e.g., Premium Widget"
              value={formData.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
              required
              disabled={creating}
            />

            {/* Price */}
            <Input
              label="Price ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.price}
              onChange={(e) => onFieldChange('price', e.target.value)}
              required
              disabled={creating}
            />

            {/* Stock */}
            <Input
              label="Stock Quantity"
              type="number"
              min="0"
              placeholder="0"
              value={formData.stock}
              onChange={(e) => onFieldChange('stock', e.target.value)}
              required
              disabled={creating}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              placeholder="Product description..."
              value={formData.description || ''}
              onChange={(e) => onFieldChange('description', e.target.value)}
              disabled={creating}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isValid || creating}
              loading={creating}
            >
              {creating ? 'Creating...' : 'Create Item'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
