'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  googleCategoryId?: string | null;
  productsWithImages?: number;
  productsWithDescriptions?: number;
  productsWithBrand?: number;
  productsWithPrice?: number;
  inStockProducts?: number;
  avgPriceCents?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
}

interface CategoryMobileDropdownProps {
  tenantId: string;
  categories: Category[];
  totalProducts: number;
}

export default function CategoryMobileDropdown({ tenantId, categories, totalProducts }: CategoryMobileDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category');

  const handleCategoryChange = (slug: string) => {
    if (slug === '') {
      router.push(`/tenant/${tenantId}`);
    } else {
      router.push(`/tenant/${tenantId}?category=${slug}`);
    }
  };

  return (
    <div className="lg:hidden mb-6">
      <label htmlFor="category-select" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
        Filter by Category
      </label>
      <select
        id="category-select"
        value={currentCategory || ''}
        onChange={(e) => handleCategoryChange(e.target.value)}
        className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">All Products ({totalProducts})</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name} ({category.count})
            {category.inStockProducts !== undefined && category.inStockProducts < category.count && ` (${category.inStockProducts} in stock)`}
          </option>
        ))}
      </select>
    </div>
  );
}
