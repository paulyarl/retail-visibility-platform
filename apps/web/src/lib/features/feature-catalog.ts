/**
 * Feature Catalog
 * Defines all platform features with friendly, user-facing descriptions
 * Used to dynamically build tier-aware dashboard sections
 */

export interface PlatformFeature {
  id: string;
  name: string;
  tagline: string; // Short, catchy description
  description: string; // Friendly, informal explanation
  icon: string;
  pillar: 'foundation' | 'visibility' | 'intelligence' | 'scale' | 'automation' | 'connection' | 'growth';
  category: 'inventory' | 'analytics' | 'locations' | 'automation' | 'integration' | 'support';
  requiredTier: 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization';
  route?: string;
  comingSoon?: boolean;
  isNew?: boolean;
}

/**
 * Platform Pillars (Internal structure - not exposed to users)
 * These organize features into a natural flow/story
 */
export const PLATFORM_PILLARS = {
  foundation: {
    title: "Get Your Products Online",
    subtitle: "The basics - get your inventory into the system",
    emoji: "🏗️",
    order: 1
  },
  visibility: {
    title: "Make Sure People Can Find You",
    subtitle: "Get discovered on Google and other platforms",
    emoji: "🔍",
    order: 2
  },
  intelligence: {
    title: "Understand What's Working",
    subtitle: "See what's selling and what's not",
    emoji: "🧠",
    order: 3
  },
  scale: {
    title: "Grow Beyond One Location",
    subtitle: "Manage multiple stores like a pro",
    emoji: "🚀",
    order: 4
  },
  automation: {
    title: "Work Smarter, Not Harder",
    subtitle: "Let the system handle the repetitive stuff",
    emoji: "⚡",
    order: 5
  },
  connection: {
    title: "Connect Everything Together",
    subtitle: "Make all your tools talk to each other",
    emoji: "🔌",
    order: 6
  },
  growth: {
    title: "Take It to the Next Level",
    subtitle: "Advanced tools for serious growth",
    emoji: "📈",
    order: 7
  }
} as const;

export const FEATURE_CATALOG: PlatformFeature[] = [
  // PILLAR 1: Foundation - Get Your Products Online
  {
    id: 'basic_inventory',
    name: 'Product Catalog',
    tagline: 'Your digital shelf',
    description: "Keep track of everything you sell! Add products, set prices, and manage your inventory all in one place. It's like having a super-organized stockroom.",
    icon: 'inventory',
    pillar: 'foundation',
    category: 'inventory',
    requiredTier: 'starter',
    route: '/items'
  },
  {
    id: 'manual_entry',
    name: 'Quick Add Products',
    tagline: 'Add items in seconds',
    description: "Got a new product? Just type it in! No complicated forms or confusing fields. Add what you need and get back to running your business.",
    icon: 'inventory',
    pillar: 'foundation',
    category: 'inventory',
    requiredTier: 'starter',
    route: '/items?create=true'
  },
  {
    id: 'manual_barcode',
    name: 'Manual Barcode Entry',
    tagline: 'Type it in, we\'ll find it',
    description: "Know the barcode? Just type it in and we'll look up the product details for you. No scanner needed - perfect for adding a few items at a time.",
    icon: 'inventory',
    pillar: 'foundation',
    category: 'inventory',
    requiredTier: 'google_only',
    route: '/scan?mode=manual'
  },
  {
    id: 'barcode_scan',
    name: 'Smart Barcode Scanner',
    tagline: 'Scan once, get everything!',
    description: "Scan a barcode and we'll automatically fill in the product name, description, images, and details from our database. No typing, no research - just scan and we do the rest! Perfect for adding lots of products quickly.",
    icon: 'inventory',
    pillar: 'foundation',
    category: 'inventory',
    requiredTier: 'professional',
    route: '/scan',
    isNew: true
  },
  {
    id: 'basic_search',
    name: 'Find Anything Fast',
    tagline: 'Search like a pro',
    description: "Looking for that one product? Just start typing and we'll find it for you. Works with names, codes, or even partial matches.",
    icon: 'inventory',
    pillar: 'foundation',
    category: 'inventory',
    requiredTier: 'starter'
  },
  {
    id: 'bulk_import',
    name: 'Bulk Upload',
    tagline: 'Add hundreds at once',
    description: "Have a spreadsheet full of products? Upload it all at once! We'll handle the heavy lifting while you grab a coffee.",
    icon: 'inventory',
    pillar: 'foundation',
    category: 'inventory',
    requiredTier: 'starter',
    route: '/import'
  },
  {
    id: 'categories',
    name: 'Smart Categories',
    tagline: 'Organize like a boss',
    description: "Group your products into categories that make sense for YOUR business. Clothing, electronics, snacks - organize however you want!",
    icon: 'inventory',
    pillar: 'foundation',
    category: 'inventory',
    requiredTier: 'starter',
    route: '/categories'
  },

  {
    id: 'clover_sync',
    name: 'Clover POS Integration',
    tagline: 'Real-time stock sync everywhere!',
    description: "Connect your Clover POS and your stock levels stay in sync everywhere - automatically! When you sell an item in Clover, your storefront and Google (SWIS) instantly show the updated count. No double-entry, no manual updates, no overselling!",
    icon: 'integration',
    pillar: 'foundation',
    category: 'integration',
    requiredTier: 'starter',
    route: '/settings/integrations/clover',
    isNew: true
  },
  {
    id: 'square_sync',
    name: 'Square POS Integration',
    tagline: 'Real-time stock sync everywhere!',
    description: "Connect your Square POS and your stock levels stay in sync everywhere - automatically! Sell an item in Square, and your storefront and Google (SWIS) instantly update. Perfect for small businesses - no migration, no manual updates, no overselling!",
    icon: 'integration',
    pillar: 'foundation',
    category: 'integration',
    requiredTier: 'starter',
    route: '/settings/integrations/square',
    isNew: true
  },

  // PILLAR 2: Visibility - Make Sure People Can Find You
  {
    id: 'google_sync',
    name: 'Google Business Sync',
    tagline: 'Show up on Google',
    description: "Automatically sync your products to Google so customers can find you when they search. Be where your customers are looking!",
    icon: 'visibility',
    pillar: 'visibility',
    category: 'integration',
    requiredTier: 'starter'
  },
  {
    id: 'swis',
    name: 'See What\'s In Store (SWIS)',
    tagline: 'Show real-time inventory on Google',
    description: "Enable Google's See What's In Store! Shoppers searching on Google will see your real-time inventory and know exactly what you have before they visit. Huge for local foot traffic!",
    icon: 'visibility',
    pillar: 'visibility',
    category: 'integration',
    requiredTier: 'starter',
    isNew: true
  },
  {
    id: 'storefront',
    name: 'Your Own Storefront',
    tagline: 'Your products, beautifully displayed',
    description: "Get a gorgeous online storefront automatically! We'll create a beautiful page showcasing your products. Share the link, add it to your website, or use it as your main online presence.",
    icon: 'visibility',
    pillar: 'visibility',
    category: 'integration',
    requiredTier: 'starter',
    route: '/storefront'
  },
  {
    id: 'platform_directory',
    name: 'Platform Directory Listing',
    tagline: 'Get discovered by shoppers',
    description: "We'll list your store in our platform directory where shoppers browse local retailers. It's like having a spot in a busy mall - more eyes on your products!",
    icon: 'visibility',
    pillar: 'visibility',
    category: 'integration',
    requiredTier: 'starter'
  },

  // PILLAR 3: Intelligence - Understand What's Working
  {
    id: 'basic_analytics',
    name: 'Sales Insights',
    tagline: 'See what\'s working',
    description: "Which products are flying off the shelves? Which ones are gathering dust? Get clear, simple reports that actually help you make decisions.",
    icon: 'analytics',
    pillar: 'intelligence',
    category: 'analytics',
    requiredTier: 'starter',
    route: '/analytics'
  },
  {
    id: 'advanced_analytics',
    name: 'Deep Analytics',
    tagline: 'Data that makes sense',
    description: "Go beyond the basics! Track trends over time, compare locations, forecast demand, and spot opportunities you're missing.",
    icon: 'analytics',
    pillar: 'intelligence',
    category: 'analytics',
    requiredTier: 'professional',
    route: '/analytics/advanced'
  },
  {
    id: 'ai_insights',
    name: 'AI Recommendations',
    tagline: 'Smart suggestions',
    description: "Let AI be your business advisor! Get personalized recommendations on what to stock, when to reorder, and how to price products.",
    icon: 'ai',
    pillar: 'intelligence',
    category: 'analytics',
    requiredTier: 'professional',
    route: '/insights',
    isNew: true
  },
  {
    id: 'custom_reports',
    name: 'Custom Reports',
    tagline: 'Your data, your way',
    description: "Build reports that answer YOUR questions. Filter, sort, and export exactly what you need. No more wrestling with spreadsheets!",
    icon: 'analytics',
    pillar: 'intelligence',
    category: 'analytics',
    requiredTier: 'professional',
    route: '/reports'
  },

  // PILLAR 4: Scale - Grow Beyond One Location
  {
    id: 'multi_location',
    name: 'Multiple Locations',
    tagline: 'Manage all your stores',
    description: "Got more than one store? No problem! See inventory across all locations, transfer products between stores, and keep everything in sync.",
    icon: 'location',
    pillar: 'scale',
    category: 'locations',
    requiredTier: 'starter',
    route: '/locations'
  },
  {
    id: 'propagation',
    name: 'Chain-Wide Updates',
    tagline: 'Update once, apply everywhere',
    description: "Running a chain? Make changes at headquarters and push them to all your locations instantly. Update prices, add products, or change settings across your entire organization with one click. No more calling each store!",
    icon: 'location',
    pillar: 'scale',
    category: 'locations',
    requiredTier: 'organization',
    route: '/propagation',
    isNew: true
  },
  {
    id: 'team_access',
    name: 'Team Collaboration',
    tagline: 'Work together',
    description: "Invite your team! Everyone can update inventory, but you control who sees what. Perfect for managers, staff, and even suppliers.",
    icon: 'support',
    pillar: 'scale',
    category: 'support',
    requiredTier: 'starter',
    route: '/users'
  },
  {
    id: 'advanced_permissions',
    name: 'Advanced Permissions',
    tagline: 'Total control',
    description: "Fine-tune who can do what. Create custom roles, set location-specific access, and keep your data secure.",
    icon: 'support',
    pillar: 'scale',
    category: 'support',
    requiredTier: 'enterprise'
  },

  // PILLAR 5: Automation - Work Smarter, Not Harder
  {
    id: 'inventory_alerts',
    name: 'Low Stock Alerts',
    tagline: 'Never run out',
    description: "We'll ping you when products are running low, so you can restock before customers start asking. No more 'sorry, we're out!'",
    icon: 'automation',
    pillar: 'automation',
    category: 'automation',
    requiredTier: 'starter'
  },
  {
    id: 'automated_ordering',
    name: 'Auto-Reorder',
    tagline: 'Set it and forget it',
    description: "Never manually reorder again! Set rules and we'll automatically create purchase orders when stock runs low. Like having a robot assistant.",
    icon: 'automation',
    pillar: 'automation',
    category: 'automation',
    requiredTier: 'professional',
    comingSoon: true
  },

  // PILLAR 6: Connection - Connect Everything Together
  {
    id: 'api_access',
    name: 'API Integration',
    tagline: 'Connect everything',
    description: "Connect your other tools! Sync with your POS, accounting software, or website. Make all your systems talk to each other.",
    icon: 'api',
    pillar: 'connection',
    category: 'integration',
    requiredTier: 'professional',
    route: '/settings/integrations'
  },
  {
    id: 'custom_integrations',
    name: 'Custom Integrations',
    tagline: 'Build anything',
    description: "Need something special? Our team will build custom integrations just for you. Connect to any system, any way you want.",
    icon: 'api',
    pillar: 'connection',
    category: 'integration',
    requiredTier: 'enterprise'
  },

  // PILLAR 7: Growth - Take It to the Next Level
  {
    id: 'priority_support',
    name: 'Priority Support',
    tagline: 'We\'ve got your back',
    description: "Jump to the front of the line! Get faster responses, dedicated support, and direct access to our team when you need help.",
    icon: 'support',
    pillar: 'growth',
    category: 'support',
    requiredTier: 'professional'
  },
  {
    id: 'white_label',
    name: 'White Label',
    tagline: 'Make it yours',
    description: "Brand it your way! Use your logo, colors, and domain. Your customers will think you built this yourself.",
    icon: 'support',
    pillar: 'growth',
    category: 'support',
    requiredTier: 'enterprise'
  },
  {
    id: 'dedicated_account',
    name: 'Dedicated Account Manager',
    tagline: 'Your personal guide',
    description: "Get your own account manager who knows your business. They'll help you get the most out of the platform and answer any questions.",
    icon: 'support',
    pillar: 'growth',
    category: 'support',
    requiredTier: 'enterprise'
  }
];

/**
 * Get features available for a specific tier
 */
export function getFeaturesForTier(tierLevel: string): PlatformFeature[] {
  const tierHierarchy = ['google_only', 'starter', 'professional', 'enterprise'];
  const tierIndex = tierHierarchy.indexOf(tierLevel);
  
  if (tierIndex === -1) {
    return [];
  }
  
  // Return all features up to and including this tier
  return FEATURE_CATALOG.filter(feature => {
    const featureIndex = tierHierarchy.indexOf(feature.requiredTier);
    return featureIndex !== -1 && featureIndex <= tierIndex;
  });
}

/**
 * Get locked features for a specific tier (features requiring upgrade)
 */
export function getLockedFeatures(tierLevel: string): PlatformFeature[] {
  const tierHierarchy = ['google_only', 'starter', 'professional', 'enterprise'];
  const tierIndex = tierHierarchy.indexOf(tierLevel);
  
  if (tierIndex === -1) {
    return FEATURE_CATALOG;
  }
  
  // Return features that require a higher tier
  return FEATURE_CATALOG.filter(feature => {
    const featureIndex = tierHierarchy.indexOf(feature.requiredTier);
    return featureIndex !== -1 && featureIndex > tierIndex;
  });
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(
  features: PlatformFeature[],
  category: PlatformFeature['category']
): PlatformFeature[] {
  return features.filter(f => f.category === category);
}

/**
 * Get new/highlighted features
 */
export function getNewFeatures(): PlatformFeature[] {
  return FEATURE_CATALOG.filter(f => f.isNew && !f.comingSoon);
}

/**
 * Get coming soon features
 */
export function getComingSoonFeatures(): PlatformFeature[] {
  return FEATURE_CATALOG.filter(f => f.comingSoon);
}

/**
 * Get features organized by pillar
 * Returns features grouped by pillar in order
 */
export function getFeaturesByPillar(features: PlatformFeature[]): Record<string, PlatformFeature[]> {
  const grouped: Record<string, PlatformFeature[]> = {};
  
  // Initialize all pillars
  Object.keys(PLATFORM_PILLARS).forEach(pillar => {
    grouped[pillar] = [];
  });
  
  // Group features by pillar
  features.forEach(feature => {
    if (grouped[feature.pillar]) {
      grouped[feature.pillar].push(feature);
    }
  });
  
  return grouped;
}

/**
 * Get pillar info
 */
export function getPillarInfo(pillarKey: keyof typeof PLATFORM_PILLARS) {
  return PLATFORM_PILLARS[pillarKey];
}
