/**
 * Quick Start Scenarios
 * Shared across tenant and admin quick-start pages
 */

export interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  categoryCount: number;
  sampleProductCount: number;
  cachedCount?: number;
}

export const QUICK_START_SCENARIOS: Scenario[] = [
  {
    id: 'grocery',
    name: 'Grocery Store',
    description: 'Fresh produce, pantry staples, and everyday essentials',
    icon: '🛒',
    categoryCount: 8,
    sampleProductCount: 50,
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    description: 'Health products, medications, and wellness items',
    icon: '💊',
    categoryCount: 6,
    sampleProductCount: 40,
  },
  {
    id: 'fashion',
    name: 'Fashion Boutique',
    description: 'Clothing, accessories, and style essentials',
    icon: '👗',
    categoryCount: 7,
    sampleProductCount: 40,
  },
  {
    id: 'electronics',
    name: 'Electronics Store',
    description: 'Tech gadgets, devices, and accessories',
    icon: '📱',
    categoryCount: 6,
    sampleProductCount: 30,
  },
  {
    id: 'home_garden',
    name: 'Home & Garden',
    description: 'Furniture, decor, and outdoor living',
    icon: '🏡',
    categoryCount: 8,
    sampleProductCount: 45,
  },
  {
    id: 'health_beauty',
    name: 'Health & Beauty',
    description: 'Skincare, cosmetics, and personal care',
    icon: '💄',
    categoryCount: 7,
    sampleProductCount: 40,
  },
  {
    id: 'sports_outdoors',
    name: 'Sports & Outdoors',
    description: 'Athletic gear, equipment, and outdoor essentials',
    icon: '⚽',
    categoryCount: 8,
    sampleProductCount: 45,
  },
  {
    id: 'toys_games',
    name: 'Toys & Games',
    description: 'Fun for all ages, from puzzles to action figures',
    icon: '🎮',
    categoryCount: 6,
    sampleProductCount: 35,
  },
  {
    id: 'automotive',
    name: 'Automotive',
    description: 'Car parts, accessories, and maintenance supplies',
    icon: '🚗',
    categoryCount: 7,
    sampleProductCount: 40,
  },
  {
    id: 'books_media',
    name: 'Books & Media',
    description: 'Books, music, movies, and entertainment',
    icon: '📚',
    categoryCount: 5,
    sampleProductCount: 30,
  },
  {
    id: 'pet_supplies',
    name: 'Pet Supplies',
    description: 'Food, toys, and care products for pets',
    icon: '🐾',
    categoryCount: 6,
    sampleProductCount: 35,
  },
  {
    id: 'office_supplies',
    name: 'Office Supplies',
    description: 'Stationery, equipment, and workspace essentials',
    icon: '📎',
    categoryCount: 5,
    sampleProductCount: 30,
  },
  {
    id: 'jewelry',
    name: 'Jewelry',
    description: 'Fine jewelry, watches, and accessories',
    icon: '💍',
    categoryCount: 4,
    sampleProductCount: 25,
  },
  {
    id: 'baby_kids',
    name: 'Baby & Kids',
    description: 'Products for infants, toddlers, and children',
    icon: '👶',
    categoryCount: 7,
    sampleProductCount: 40,
  },
  {
    id: 'arts_crafts',
    name: 'Arts & Crafts',
    description: 'Creative supplies and DIY materials',
    icon: '🎨',
    categoryCount: 6,
    sampleProductCount: 35,
  },
  {
    id: 'hardware_tools',
    name: 'Hardware & Tools',
    description: 'Tools, building materials, and hardware',
    icon: '🔨',
    categoryCount: 7,
    sampleProductCount: 40,
  },
  {
    id: 'furniture',
    name: 'Furniture',
    description: 'Home and office furniture pieces',
    icon: '🛋️',
    categoryCount: 5,
    sampleProductCount: 30,
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Menu items, beverages, and food service',
    icon: '🍽️',
    categoryCount: 6,
    sampleProductCount: 35,
  },
  {
    id: 'general',
    name: 'General Store',
    description: 'Mixed variety of everyday products',
    icon: '🏪',
    categoryCount: 5,
    sampleProductCount: 35,
  },
  {
    id: 'service_business',
    name: 'Service Business',
    description: 'Bookable services, appointments, and consultations',
    icon: '🔧',
    categoryCount: 4,
    sampleProductCount: 15,
  },
];
