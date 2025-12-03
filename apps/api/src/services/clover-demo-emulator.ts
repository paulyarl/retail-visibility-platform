/**
 * Clover Demo Emulator Service
 * 
 * Simulates Clover POS data for demo mode without requiring a real Clover account.
 * Provides realistic sample data for testing and evaluation.
 */

import { availability_status, product_source } from '@prisma/client';

export interface DemoItem {
  id: string;
  name: string;
  sku: string;
  price: number; // in cents
  stock: number;
  category: string;
  description?: string;
}

/**
 * Sample demo items representing a typical retail inventory
 */
const DEMO_ITEMS: DemoItem[] = [
  // Electronics
  {
    id: 'demo_item_001',
    name: 'Wireless Bluetooth Headphones',
    sku: 'AUDIO-WH-001',
    price: 7999, // $79.99
    stock: 15,
    category: 'Electronics',
    description: 'Premium noise-canceling wireless headphones with 30-hour battery life'
  },
  {
    id: 'demo_item_002',
    name: 'USB-C Fast Charger 65W',
    sku: 'POWER-UC-065',
    price: 3499,
    stock: 42,
    category: 'Electronics',
    description: 'Universal fast charger compatible with laptops, tablets, and phones'
  },
  {
    id: 'demo_item_003',
    name: 'Wireless Mouse - Ergonomic',
    sku: 'INPUT-MS-ERG',
    price: 2999,
    stock: 28,
    category: 'Electronics',
    description: 'Comfortable ergonomic design with precision tracking'
  },
  {
    id: 'demo_item_004',
    name: 'Portable Power Bank 20000mAh',
    sku: 'POWER-PB-20K',
    price: 4999,
    stock: 18,
    category: 'Electronics',
    description: 'High-capacity power bank with dual USB ports'
  },
  {
    id: 'demo_item_005',
    name: 'Smart Watch - Fitness Tracker',
    sku: 'WEAR-SW-FIT',
    price: 12999,
    stock: 12,
    category: 'Electronics',
    description: 'Track your fitness goals with heart rate monitoring and GPS'
  },

  // Home & Kitchen
  {
    id: 'demo_item_006',
    name: 'Stainless Steel Water Bottle 32oz',
    sku: 'HOME-WB-32',
    price: 2499,
    stock: 65,
    category: 'Home & Kitchen',
    description: 'Insulated water bottle keeps drinks cold for 24 hours'
  },
  {
    id: 'demo_item_007',
    name: 'Coffee Maker - 12 Cup',
    sku: 'KITCHEN-CM-12',
    price: 5999,
    stock: 8,
    category: 'Home & Kitchen',
    description: 'Programmable coffee maker with auto-brew timer'
  },
  {
    id: 'demo_item_008',
    name: 'Non-Stick Cookware Set',
    sku: 'KITCHEN-CW-SET',
    price: 8999,
    stock: 5,
    category: 'Home & Kitchen',
    description: '10-piece non-stick cookware set with glass lids'
  },
  {
    id: 'demo_item_009',
    name: 'Electric Kettle 1.7L',
    sku: 'KITCHEN-EK-17',
    price: 3499,
    stock: 22,
    category: 'Home & Kitchen',
    description: 'Fast-boiling electric kettle with auto shut-off'
  },
  {
    id: 'demo_item_010',
    name: 'Bamboo Cutting Board Set',
    sku: 'KITCHEN-CB-BAM',
    price: 2999,
    stock: 30,
    category: 'Home & Kitchen',
    description: 'Eco-friendly bamboo cutting boards in 3 sizes'
  },

  // Apparel
  {
    id: 'demo_item_011',
    name: 'Cotton T-Shirt - Unisex',
    sku: 'APPAREL-TS-UNI',
    price: 1999,
    stock: 85,
    category: 'Apparel',
    description: '100% organic cotton t-shirt, available in multiple colors'
  },
  {
    id: 'demo_item_012',
    name: 'Running Shoes - Athletic',
    sku: 'APPAREL-SH-RUN',
    price: 7999,
    stock: 24,
    category: 'Apparel',
    description: 'Lightweight running shoes with cushioned sole'
  },
  {
    id: 'demo_item_013',
    name: 'Baseball Cap - Adjustable',
    sku: 'APPAREL-CAP-BB',
    price: 1499,
    stock: 48,
    category: 'Apparel',
    description: 'Classic baseball cap with adjustable strap'
  },
  {
    id: 'demo_item_014',
    name: 'Hoodie - Pullover',
    sku: 'APPAREL-HD-PO',
    price: 3999,
    stock: 32,
    category: 'Apparel',
    description: 'Comfortable pullover hoodie with front pocket'
  },
  {
    id: 'demo_item_015',
    name: 'Athletic Socks - 6 Pack',
    sku: 'APPAREL-SK-ATH',
    price: 1299,
    stock: 120,
    category: 'Apparel',
    description: 'Moisture-wicking athletic socks, 6-pack'
  },

  // Sports & Outdoors
  {
    id: 'demo_item_016',
    name: 'Yoga Mat - Extra Thick',
    sku: 'SPORTS-YM-XTH',
    price: 2999,
    stock: 18,
    category: 'Sports & Outdoors',
    description: 'Non-slip yoga mat with carrying strap'
  },
  {
    id: 'demo_item_017',
    name: 'Camping Tent - 4 Person',
    sku: 'OUTDOOR-TN-4P',
    price: 12999,
    stock: 6,
    category: 'Sports & Outdoors',
    description: 'Waterproof camping tent with easy setup'
  },
  {
    id: 'demo_item_018',
    name: 'Hiking Backpack 40L',
    sku: 'OUTDOOR-BP-40L',
    price: 6999,
    stock: 14,
    category: 'Sports & Outdoors',
    description: 'Durable hiking backpack with multiple compartments'
  },
  {
    id: 'demo_item_019',
    name: 'Resistance Bands Set',
    sku: 'SPORTS-RB-SET',
    price: 1999,
    stock: 45,
    category: 'Sports & Outdoors',
    description: 'Set of 5 resistance bands with different strengths'
  },
  {
    id: 'demo_item_020',
    name: 'Water Bottle Holder - Bike',
    sku: 'OUTDOOR-WH-BK',
    price: 899,
    stock: 55,
    category: 'Sports & Outdoors',
    description: 'Universal water bottle holder for bicycles'
  },

  // Office Supplies
  {
    id: 'demo_item_021',
    name: 'Wireless Keyboard & Mouse Combo',
    sku: 'OFFICE-KM-WL',
    price: 4999,
    stock: 16,
    category: 'Office Supplies',
    description: 'Slim wireless keyboard and mouse combo'
  },
  {
    id: 'demo_item_022',
    name: 'Desk Organizer Set',
    sku: 'OFFICE-DO-SET',
    price: 2499,
    stock: 28,
    category: 'Office Supplies',
    description: 'Bamboo desk organizer with multiple compartments'
  },
  {
    id: 'demo_item_023',
    name: 'LED Desk Lamp',
    sku: 'OFFICE-DL-LED',
    price: 3499,
    stock: 12,
    category: 'Office Supplies',
    description: 'Adjustable LED desk lamp with USB charging port'
  },
  {
    id: 'demo_item_024',
    name: 'Notebook Set - Hardcover',
    sku: 'OFFICE-NB-HC',
    price: 1599,
    stock: 72,
    category: 'Office Supplies',
    description: 'Set of 3 hardcover notebooks with lined pages'
  },
  {
    id: 'demo_item_025',
    name: 'Gel Pen Set - 12 Colors',
    sku: 'OFFICE-GP-12C',
    price: 999,
    stock: 95,
    category: 'Office Supplies',
    description: 'Smooth-writing gel pens in assorted colors'
  },
];

/**
 * Get all demo items
 */
export function getDemoItems(): DemoItem[] {
  return [...DEMO_ITEMS];
}

/**
 * Get a specific demo item by ID
 */
export function getDemoItem(id: string): DemoItem | undefined {
  return DEMO_ITEMS.find(item => item.id === id);
}

/**
 * Simulate inventory update (for future webhook simulation)
 */
export function simulateInventoryUpdate(item_id: string, newStock: number): DemoItem | null {
  const item = DEMO_ITEMS.find(i => i.id === item_id);
  if (!item) return null;
  
  // In a real implementation, this would emit an event
  return {
    ...item,
    stock: newStock
  };
}

/**
 * Get demo items by category
 */
export function getDemoItemsByCategory(category: string): DemoItem[] {
  return DEMO_ITEMS.filter(item => item.category === category);
}

/**
 * Get all demo categories
 */
export function getDemoCategories(): string[] {
  return [...new Set(DEMO_ITEMS.map(item => item.category))];
}

/**
 * Convert demo item to Visible Shell inventory item format
 */
export function convertDemoItemToRVPFormat(demoItem: DemoItem) {
  return {
    sku: demoItem.sku,
    name: demoItem.name,
    title: demoItem.name,
    brand: 'Demo Brand', // Required field
    description: demoItem.description || '',
    price: demoItem.price / 100, // Convert cents to dollars for price field
    priceCents: demoItem.price,
    currency: 'USD',
    stock: demoItem.stock,
    availability: demoItem.stock > 0 ? availability_status.in_stock : availability_status.out_of_stock,
    source: product_source.CLOVER_DEMO,
    metadata: {
      cloverItemId: demoItem.id,
      cloverCategory: demoItem.category,
      isDemoData: true
    }
  };
}
