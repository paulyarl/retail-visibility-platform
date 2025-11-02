"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Product {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
}

interface ProductDisplayProps {
  products: Product[];
  tenantId: string;
}

export default function ProductDisplay({ products, tenantId }: ProductDisplayProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div>
      {/* View Toggle */}
      <div className="flex justify-end mb-6">
        <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-600 p-1 bg-white dark:bg-neutral-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary-600 text-white'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            aria-label="Grid view"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            aria-label="List view"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: Product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-700">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* Stock Badge */}
                {product.availability === 'out_of_stock' && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    Out of Stock
                  </div>
                )}
                {product.availability === 'preorder' && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    Pre-order
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  {product.brand}
                </p>
                <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 mb-2">
                  {product.title}
                </h3>
                {product.description && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {product.currency} {typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    SKU: {product.sku}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {products.map((product: Product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow flex"
            >
              {/* Product Image */}
              <div className="relative w-48 h-48 flex-shrink-0 bg-neutral-100 dark:bg-neutral-700">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* Stock Badge */}
                {product.availability === 'out_of_stock' && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    Out of Stock
                  </div>
                )}
                {product.availability === 'preorder' && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    Pre-order
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                        {product.brand}
                      </p>
                      <h3 className="font-semibold text-lg text-neutral-900 dark:text-white mb-2">
                        {product.title}
                      </h3>
                    </div>
                    <p className="text-xl font-bold text-primary-600 dark:text-primary-400 ml-4">
                      {product.currency} {typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}
                    </p>
                  </div>
                  {product.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                      {product.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>SKU: {product.sku}</span>
                  <span>Stock: {product.stock}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
