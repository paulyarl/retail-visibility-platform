/**
 * Product Category Breadcrumb Component
 * 
 * Displays hierarchical category navigation for products
 * Shows the full path from home to current category
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { ProductCategory } from '../../services/EnhancedProductService';

interface ProductCategoryBreadcrumbProps {
  categories: ProductCategory[];
  currentCategory?: string;
  className?: string;
}

const ProductCategoryBreadcrumb: React.FC<ProductCategoryBreadcrumbProps> = ({
  categories,
  currentCategory,
  className = ''
}) => {
  if (!categories || categories.length === 0) {
    return null;
  }

  const getBreadcrumbItems = () => {
    const items = [
      { name: 'Home', href: '/', isCurrent: false }
    ];

    // Add category hierarchy
    categories.forEach((category, index) => {
      const isLast = index === categories.length - 1;
      items.push({
        name: category.name,
        href: `/categories/${category.slug}`,
        isCurrent: isLast && !currentCategory
      });
    });

    // Add current category if provided
    if (currentCategory) {
      items.push({
        name: currentCategory,
        href: '#',
        isCurrent: true
      });
    }

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <svg
                className="w-4 h-4 text-gray-400 mx-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            
            {item.isCurrent ? (
              <span className="text-gray-900 font-medium" aria-current="page">
                {item.name}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default ProductCategoryBreadcrumb;
