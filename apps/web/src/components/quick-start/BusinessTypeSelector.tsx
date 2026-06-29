'use client';

import { useState } from 'react';

export interface BusinessType {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultCategoryCount: number;
  defaultProductCount: number;
  examples?: string[];
}

// All 20 business types - single source of truth
export const BUSINESS_TYPES: BusinessType[] = [
  { id: 'grocery', name: 'Grocery Store', icon: '🛒', description: 'Fresh produce, dairy, meat, packaged goods', defaultCategoryCount: 15, defaultProductCount: 20, examples: ['Fresh Fruits', 'Dairy Products', 'Meat & Seafood', 'Bakery Items', 'Beverages'] },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊', description: 'Medications, health products, supplements', defaultCategoryCount: 15, defaultProductCount: 15, examples: ['Medications', 'Vitamins', 'Personal Care', 'First Aid', 'Health Devices'] },
  { id: 'fashion', name: 'Fashion Boutique', icon: '👗', description: 'Clothing, accessories, footwear', defaultCategoryCount: 12, defaultProductCount: 15, examples: ['Women\'s Clothing', 'Men\'s Clothing', 'Shoes', 'Accessories', 'Jewelry'] },
  { id: 'electronics', name: 'Electronics Store', icon: '📱', description: 'Phones, computers, tech accessories', defaultCategoryCount: 10, defaultProductCount: 12, examples: ['Mobile Phones', 'Computers', 'Audio Equipment', 'Gaming', 'Smart Home'] },
  { id: 'home_garden', name: 'Home & Garden', icon: '🏡', description: 'Furniture, decor, outdoor supplies', defaultCategoryCount: 15, defaultProductCount: 15, examples: ['Home Decor', 'Kitchen & Dining', 'Furniture', 'Lawn & Garden', 'Bedding'] },
  { id: 'health_beauty', name: 'Health & Beauty', icon: '💄', description: 'Cosmetics, skincare, personal care', defaultCategoryCount: 15, defaultProductCount: 15, examples: ['Personal Care', 'Cosmetics', 'Skincare', 'Hair Care', 'Bath & Body'] },
  { id: 'sports_outdoors', name: 'Sports & Outdoors', icon: '⚽', description: 'Athletic gear, camping, fitness', defaultCategoryCount: 15, defaultProductCount: 15, examples: ['Exercise Equipment', 'Outdoor Recreation', 'Team Sports', 'Camping', 'Cycling'] },
  { id: 'toys_games', name: 'Toys & Games', icon: '🎮', description: "Children's toys, board games, puzzles", defaultCategoryCount: 12, defaultProductCount: 12, examples: ['Action Figures', 'Board Games', 'Puzzles', 'Educational Toys', 'Outdoor Toys'] },
  { id: 'automotive', name: 'Automotive', icon: '🚗', description: 'Car parts, accessories, maintenance', defaultCategoryCount: 12, defaultProductCount: 12, examples: ['Vehicle Parts', 'Car Accessories', 'Car Care', 'Tools', 'Electronics'] },
  { id: 'books_media', name: 'Books & Media', icon: '📚', description: 'Books, music, movies, magazines', defaultCategoryCount: 12, defaultProductCount: 12, examples: ['Books', 'Music', 'Movies & TV', 'Magazines', 'E-Books'] },
  { id: 'pet_supplies', name: 'Pet Supplies', icon: '🐾', description: 'Pet food, toys, accessories', defaultCategoryCount: 12, defaultProductCount: 12, examples: ['Dog Supplies', 'Cat Supplies', 'Pet Food', 'Pet Toys', 'Pet Care'] },
  { id: 'office_supplies', name: 'Office Supplies', icon: '📎', description: 'Stationery, paper, office equipment', defaultCategoryCount: 12, defaultProductCount: 12, examples: ['Writing Supplies', 'Paper Products', 'Office Equipment', 'Filing', 'Presentation'] },
  { id: 'jewelry', name: 'Jewelry', icon: '💎', description: 'Rings, necklaces, watches, accessories', defaultCategoryCount: 10, defaultProductCount: 10, examples: ['Rings', 'Necklaces', 'Earrings', 'Bracelets', 'Watches'] },
  { id: 'baby_kids', name: 'Baby & Kids', icon: '👶', description: "Baby products, children's items", defaultCategoryCount: 15, defaultProductCount: 15, examples: ['Baby Care', 'Baby Toys', 'Baby Transport', 'Diapering', 'Feeding'] },
  { id: 'arts_crafts', name: 'Arts & Crafts', icon: '🎨', description: 'Art supplies, craft materials, hobbies', defaultCategoryCount: 12, defaultProductCount: 12, examples: ['Art Supplies', 'Craft Materials', 'Sewing', 'Scrapbooking', 'Party Supplies'] },
  { id: 'hardware_tools', name: 'Hardware & Tools', icon: '🔧', description: 'Power tools, hand tools, building materials', defaultCategoryCount: 15, defaultProductCount: 15, examples: ['Power Tools', 'Hand Tools', 'Building Materials', 'Plumbing', 'Electrical'] },
  { id: 'furniture', name: 'Furniture', icon: '🛋️', description: 'Living room, bedroom, office furniture', defaultCategoryCount: 12, defaultProductCount: 12, examples: ['Living Room', 'Bedroom', 'Office Furniture', 'Outdoor Furniture', 'Storage'] },
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', description: 'Prepared foods, menu items, beverages', defaultCategoryCount: 15, defaultProductCount: 15, examples: ['Appetizers', 'Main Courses', 'Desserts', 'Beverages', 'Catering'] },
  { id: 'service_business', name: 'Service Business', icon: '🛎️', description: 'Consulting, repairs, appointments, subscriptions', defaultCategoryCount: 4, defaultProductCount: 16, examples: ['Consultations', 'Repairs', 'Appointments', 'Subscriptions'] },
  { id: 'general', name: 'General Store', icon: '🏪', description: 'Mixed merchandise, variety store', defaultCategoryCount: 20, defaultProductCount: 20, examples: ['Home & Garden', 'Health & Beauty', 'Sports', 'Toys', 'Books'] },
];

export type BusinessTypeId = typeof BUSINESS_TYPES[number]['id'];

interface BusinessTypeSelectorProps {
  value: string | null;
  onChange: (typeId: string, type: BusinessType) => void;
  variant?: 'dropdown' | 'grid';
  showDescription?: boolean;
  className?: string;
  types?: BusinessType[];
}

/**
 * Reusable Business Type Selector component
 * Used across Quick Start interfaces for categories and products
 */
export function BusinessTypeSelector({
  value,
  onChange,
  variant = 'dropdown',
  showDescription = true,
  className = '',
  types = BUSINESS_TYPES,
}: BusinessTypeSelectorProps) {
  if (variant === 'dropdown') {
    return (
      <select
        value={value || ''}
        onChange={(e) => {
          const type = types.find(t => t.id === e.target.value);
          if (type) onChange(type.id, type);
        }}
        className={`w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${className}`}
      >
        <option value="" disabled>Select a business type...</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.icon} {type.name} ({type.defaultCategoryCount} categories)
          </option>
        ))}
      </select>
    );
  }

  // Grid variant for more visual selection
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 ${className}`}>
      {types.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => onChange(type.id, type)}
          className={`p-3 rounded-lg border-2 text-left transition-all ${
            value === type.id
              ? 'border-primary-500 bg-primary-50'
              : 'border-neutral-200 hover:border-primary-300'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="text-2xl">{type.icon}</div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-neutral-900 text-sm truncate">
                {type.name}
              </h4>
              {showDescription && (
                <p className="text-xs text-neutral-500 line-clamp-2">
                  {type.description}
                </p>
              )}
            </div>
            {value === type.id && (
              <div className="text-primary-600 flex-shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Helper function to get a business type by ID
 */
export function getBusinessType(id: string): BusinessType | undefined {
  return BUSINESS_TYPES.find(t => t.id === id);
}

/**
 * Helper to get default count based on type (for categories or products)
 */
export function getDefaultCount(typeId: string, countType: 'category' | 'product'): number {
  const type = getBusinessType(typeId);
  if (!type) return 15;
  return countType === 'category' ? type.defaultCategoryCount : type.defaultProductCount;
}

export default BusinessTypeSelector;
