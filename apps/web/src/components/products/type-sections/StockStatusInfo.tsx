'use client';

interface StockStatusInfoProps {
  product: any;
  currentStock?: number;
  currentAvailability?: string;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function StockStatusInfo({
  product,
  currentStock,
  currentAvailability,
  layoutVariant = 'classic',
}: StockStatusInfoProps) {
  const stock = currentStock ?? product.stock;
  const availability = currentAvailability ?? product.availability;
  const inStock = stock > 0 || availability === 'in_stock';

  if (inStock) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          In Stock{stock > 0 ? ` (${stock} available)` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Out of Stock
      </span>
    </div>
  );
}
