/**
 * Clover Demo Emulator Service
 * 
 * Simulates Clover POS data for demo mode without requiring a real Clover account.
 * Provides realistic sample data for testing and evaluation.
 */

import { availability_status, product_source } from '@prisma/client';

/**
 * Category mapping from Clover categories to Google taxonomy category paths
 */
const CLOVER_CATEGORY_MAPPING: Record<string, { path: string[]; googleCategoryId?: string }> = {
  'Electronics': {
    path: ['Electronics', 'Audio', 'Headphones'],
    googleCategoryId: '240' // Electronics > Audio > Headphones
  },
  'Home & Kitchen': {
    path: ['Home & Garden', 'Kitchen & Dining', 'Kitchen Tools'],
    googleCategoryId: '212' // Home & Garden > Kitchen & Dining > Kitchen Tools
  },
  'Apparel': {
    path: ['Apparel & Accessories', 'Clothing', 'T-Shirts'],
    googleCategoryId: '1604' // Apparel & Accessories > Clothing > T-Shirts
  },
  'Sports & Outdoors': {
    path: ['Sports & Fitness', 'Sports & Outdoors', 'Fitness Equipment'],
    googleCategoryId: '185' // Sports & Fitness > Sports & Outdoors > Fitness Equipment
  },
  'Office Supplies': {
    path: ['Office Supplies', 'Writing Instruments', 'Pens'],
    googleCategoryId: '283' // Office Supplies > Writing Instruments > Pens
  }
};

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

// ============================================================================
// ENHANCED DEMO MODE - Simulation Features
// ============================================================================

/**
 * Simulation scenarios that users can trigger to learn the sync flow
 */
export type SimulationScenario = 
  // Item scenarios
  | 'stock_update'          // Clover stock changed, needs sync to RVP
  | 'price_update'          // Clover price changed, needs sync to RVP
  | 'new_item'              // New item added in Clover
  | 'item_deleted'          // Item deleted in Clover
  | 'conflict'              // SKU conflict between systems
  | 'sync_failure'          // Simulated sync failure
  | 'bulk_update'           // Multiple items changed at once
  // Category scenarios
  | 'new_category'          // New category added in Clover
  | 'category_renamed'      // Category renamed in Clover
  | 'category_items_moved'  // Items moved between categories
  | 'category_conflict';    // Category name conflict between systems

export interface SimulationEvent {
  id: string;
  scenario: SimulationScenario;
  timestamp: Date;
  status: 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';
  affectedItems: string[];
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  message: string;
  resolution?: string;
}

/**
 * Pre-defined simulation scenarios with realistic data
 */
const SIMULATION_SCENARIOS: Record<SimulationScenario, () => SimulationEvent> = {
  stock_update: () => ({
    id: `sim_${Date.now()}_stock`,
    scenario: 'stock_update',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: ['demo_item_001', 'demo_item_006'],
    changes: [
      { field: 'stock', oldValue: 15, newValue: 8 },
      { field: 'stock', oldValue: 65, newValue: 52 }
    ],
    message: 'Stock levels updated in Clover POS after sales transactions',
    resolution: 'Auto-sync will update RVP inventory to match Clover'
  }),
  
  price_update: () => ({
    id: `sim_${Date.now()}_price`,
    scenario: 'price_update',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: ['demo_item_003'],
    changes: [
      { field: 'price', oldValue: 2999, newValue: 2499 }
    ],
    message: 'Price reduced in Clover POS for promotional sale',
    resolution: 'Price will sync to RVP and update storefront listings'
  }),
  
  new_item: () => ({
    id: `sim_${Date.now()}_new`,
    scenario: 'new_item',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: ['demo_item_new_001'],
    changes: [
      { field: 'item', oldValue: null, newValue: {
        name: 'Wireless Earbuds Pro',
        sku: 'AUDIO-EB-PRO',
        price: 9999,
        stock: 20,
        category: 'Electronics' // Same category format as demo items
      }}
    ],
    message: 'New product added to Clover inventory',
    resolution: 'Item will be imported to RVP with auto-categorization'
  }),
  
  item_deleted: () => ({
    id: `sim_${Date.now()}_delete`,
    scenario: 'item_deleted',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: ['demo_item_020'],
    changes: [
      { field: 'status', oldValue: 'active', newValue: 'deleted' }
    ],
    message: 'Item discontinued and removed from Clover',
    resolution: 'RVP item will be marked as archived (not deleted)'
  }),
  
  conflict: () => ({
    id: `sim_${Date.now()}_conflict`,
    scenario: 'conflict',
    timestamp: new Date(),
    status: 'pending', // Start as pending so Execute button is shown
    affectedItems: ['demo_item_011'],
    changes: [
      { field: 'price', oldValue: 1999, newValue: 2199 }, // Clover price
      { field: 'price_rvp', oldValue: 1999, newValue: 1799 } // RVP price (edited locally)
    ],
    message: 'Price conflict detected: Item was edited in both Clover and RVP',
    resolution: 'Manual resolution required: Choose Clover value, RVP value, or custom'
  }),
  
  sync_failure: () => ({
    id: `sim_${Date.now()}_fail`,
    scenario: 'sync_failure',
    timestamp: new Date(),
    status: 'pending', // Start as pending so Execute button is shown
    affectedItems: ['demo_item_007', 'demo_item_008'],
    changes: [],
    message: 'Sync failed: Connection timeout to Clover API',
    resolution: 'Retry sync or check Clover API status'
  }),
  
  bulk_update: () => ({
    id: `sim_${Date.now()}_bulk`,
    scenario: 'bulk_update',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: ['demo_item_011', 'demo_item_012', 'demo_item_013', 'demo_item_014', 'demo_item_015'],
    changes: [
      { field: 'stock', oldValue: 85, newValue: 72 },
      { field: 'stock', oldValue: 24, newValue: 18 },
      { field: 'stock', oldValue: 48, newValue: 41 },
      { field: 'stock', oldValue: 32, newValue: 28 },
      { field: 'stock', oldValue: 120, newValue: 95 }
    ],
    message: 'End-of-day inventory reconciliation from Clover',
    resolution: 'Bulk sync will update all affected items'
  }),

  // Category simulation scenarios
  new_category: () => ({
    id: `sim_${Date.now()}_newcat`,
    scenario: 'new_category',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: [],
    changes: [
      { field: 'category', oldValue: null, newValue: {
        id: 'clv_cat_seasonal',
        name: 'Seasonal Specials',
        itemCount: 0
      }}
    ],
    message: 'New category "Seasonal Specials" created in Clover',
    resolution: 'Category will be synced to RVP and available for item assignment'
  }),

  category_renamed: () => ({
    id: `sim_${Date.now()}_catren`,
    scenario: 'category_renamed',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: ['demo_item_001', 'demo_item_002', 'demo_item_003'],
    changes: [
      { field: 'category_name', oldValue: 'Electronics', newValue: 'Tech & Gadgets' }
    ],
    message: 'Category renamed from "Electronics" to "Tech & Gadgets" in Clover',
    resolution: 'RVP category will be updated, all linked items remain assigned'
  }),

  category_items_moved: () => ({
    id: `sim_${Date.now()}_catmove`,
    scenario: 'category_items_moved',
    timestamp: new Date(),
    status: 'pending',
    affectedItems: ['demo_item_006', 'demo_item_007'],
    changes: [
      { field: 'category', oldValue: 'Home & Kitchen', newValue: 'Office Supplies' },
      { field: 'items_moved', oldValue: 2, newValue: 2 }
    ],
    message: '2 items moved from "Home & Kitchen" to "Office Supplies" in Clover',
    resolution: 'Item category assignments will update in RVP to match Clover'
  }),

  category_conflict: () => ({
    id: `sim_${Date.now()}_catconf`,
    scenario: 'category_conflict',
    timestamp: new Date(),
    status: 'pending', // Start as pending so Execute button is shown
    affectedItems: [],
    changes: [
      { field: 'category_name', oldValue: 'Sports & Outdoors', newValue: 'Sports & Fitness' }, // Clover
      { field: 'category_name_rvp', oldValue: 'Sports & Outdoors', newValue: 'Outdoor Recreation' } // RVP
    ],
    message: 'Category conflict: "Sports & Outdoors" renamed differently in both systems',
    resolution: 'Manual resolution required: Choose Clover name, RVP name, or merge categories'
  })
};

/**
 * Generate a simulation event for a given scenario
 */
export function generateSimulationEvent(scenario: SimulationScenario): SimulationEvent {
  const generator = SIMULATION_SCENARIOS[scenario];
  if (!generator) {
    throw new Error(`Unknown simulation scenario: ${scenario}`);
  }
  return generator();
}

/**
 * Get all available simulation scenarios with descriptions
 */
export function getAvailableScenarios(): { scenario: SimulationScenario; name: string; description: string; type: 'item' | 'category' }[] {
  return [
    // Item scenarios
    {
      scenario: 'stock_update',
      name: 'Stock Level Change',
      description: 'Simulates stock decreasing after sales in Clover POS',
      type: 'item'
    },
    {
      scenario: 'price_update',
      name: 'Price Change',
      description: 'Simulates a price update in Clover (e.g., promotional discount)',
      type: 'item'
    },
    {
      scenario: 'new_item',
      name: 'New Item Added',
      description: 'Simulates adding a new product in Clover that needs to sync to RVP',
      type: 'item'
    },
    {
      scenario: 'item_deleted',
      name: 'Item Discontinued',
      description: 'Simulates removing a product from Clover inventory',
      type: 'item'
    },
    {
      scenario: 'conflict',
      name: 'Sync Conflict',
      description: 'Simulates a conflict when the same item was edited in both systems',
      type: 'item'
    },
    {
      scenario: 'sync_failure',
      name: 'Sync Failure',
      description: 'Simulates a failed sync due to connection issues',
      type: 'item'
    },
    {
      scenario: 'bulk_update',
      name: 'Bulk Inventory Update',
      description: 'Simulates end-of-day inventory reconciliation with multiple changes',
      type: 'item'
    },
    // Category scenarios
    {
      scenario: 'new_category',
      name: 'New Category Added',
      description: 'Simulates Clover adding a new category that syncs to RVP',
      type: 'category'
    },
    {
      scenario: 'category_renamed',
      name: 'Category Renamed',
      description: 'Simulates renaming a category in Clover and syncing to RVP',
      type: 'category'
    },
    {
      scenario: 'category_items_moved',
      name: 'Items Moved to Category',
      description: 'Simulates moving items between categories in Clover',
      type: 'category'
    },
    {
      scenario: 'category_conflict',
      name: 'Category Conflict',
      description: 'Simulates a category name conflict between Clover and RVP',
      type: 'category'
    }
  ];
}

/**
 * Items that will be created with conflicts for demo purposes
 */
export const CONFLICT_DEMO_ITEMS = [
  {
    cloverItem: {
      id: 'demo_conflict_001',
      name: 'Premium Headphones',
      sku: 'CONFLICT-HP-001',
      price: 8999,
      stock: 10,
      category: 'Electronics'
    },
    rvpItem: {
      name: 'Premium Headphones (Store Edition)',
      sku: 'CONFLICT-HP-001', // Same SKU = conflict
      price: 7999, // Different price
      stock: 15 // Different stock
    },
    conflictType: 'sku_match_data_mismatch'
  },
  {
    cloverItem: {
      id: 'demo_conflict_002',
      name: 'Organic Coffee Beans',
      sku: 'FOOD-CB-ORG',
      price: 1499,
      stock: 50,
      category: 'Home & Kitchen'
    },
    rvpItem: {
      name: 'Organic Coffee Beans 1lb',
      sku: 'FOOD-CB-ORG',
      price: 1499,
      stock: 45 // Only stock differs
    },
    conflictType: 'stock_mismatch'
  }
];

/**
 * Simulate the progression of a sync operation
 * Returns status updates that can be polled by the frontend
 */
export function simulateSyncProgress(eventId: string): AsyncGenerator<{
  progress: number;
  status: string;
  currentItem?: string;
  itemsProcessed: number;
  totalItems: number;
}> {
  return (async function* () {
    const totalItems = 5;
    const items = ['demo_item_001', 'demo_item_002', 'demo_item_003', 'demo_item_004', 'demo_item_005'];
    
    yield { progress: 0, status: 'initializing', itemsProcessed: 0, totalItems };
    
    for (let i = 0; i < totalItems; i++) {
      yield {
        progress: Math.round(((i + 0.5) / totalItems) * 100),
        status: 'syncing',
        currentItem: items[i],
        itemsProcessed: i,
        totalItems
      };
      
      // Simulate processing time (in real usage, this would be actual work)
      yield {
        progress: Math.round(((i + 1) / totalItems) * 100),
        status: 'syncing',
        currentItem: items[i],
        itemsProcessed: i + 1,
        totalItems
      };
    }
    
    yield { progress: 100, status: 'complete', itemsProcessed: totalItems, totalItems };
  })();
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
  // Get category mapping for this clover category
  const categoryMapping = CLOVER_CATEGORY_MAPPING[demoItem.category];

  return {
    sku: demoItem.sku,
    name: demoItem.name,
    title: demoItem.name,
    brand: 'Demo Brand', // Required field
    description: demoItem.description || '',
    price: demoItem.price / 100, // Convert cents to dollars for price field
    price_cents: demoItem.price,
    currency: 'USD',
    stock: demoItem.stock,
    availability: demoItem.stock > 0 ? availability_status.in_stock : availability_status.out_of_stock,
    source: product_source.CLOVER_DEMO,
    // Proper category assignment following platform standards
    category_path: categoryMapping ? categoryMapping.path : [demoItem.category],
    metadata: {
      cloverItemId: demoItem.id,
      cloverCategory: demoItem.category,
      isDemoData: true,
      googleCategoryId: categoryMapping?.googleCategoryId
    }
  };
}
