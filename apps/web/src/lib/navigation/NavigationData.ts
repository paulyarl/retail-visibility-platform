// Server-side navigation data (no JSX)

export const NavigationData = {
  // URL Patterns
  URL_PATTERNS: {
    PLATFORM: '/',
    TENANT: '/t/[tenantId]',
    ADMIN: '/admin',
  },

  // Color Palette
  COLORS: {
    PRIMARY: '#3b82f6',
    SECONDARY: '#64748b',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#06b6d4',
    MUTED: '#94a3b8',
    ACCENT: '#8b5cf6',
  },

  // Navigation Hierarchy
  HIERARCHY: {
    DASHBOARD: 10,
    USER_PANEL: 20,
    STORE_CENTER: 30,
    INVENTORY_CENTER: 40,
    ADVANCED_FEATURES: 22,     // Maps to STORE_SETTINGS
    ADMIN_PLATFORM: 56,        // Maps to PLATFORM_ADMIN
    SUPPORT_HELP: 90,          // Keep for help/support
  },

  // Icon Keys (server-side only - no JSX)
  ICON_KEYS: {
    // Core sections
    DASHBOARD: 'DASHBOARD',
    USER_PANEL: 'USER_PANEL',
    STORE_CENTER: 'STORE_CENTER',
    INVENTORY_CENTER: 'INVENTORY_CENTER',
    
    // Platform sections (50-79)
    PLATFORM_DASHBOARD: 'PLATFORM_DASHBOARD',
    PLATFORM_SETTINGS: 'PLATFORM_SETTINGS',
    PLATFORM_BILLING: 'PLATFORM_BILLING',
    PLATFORM_TIERS: 'PLATFORM_TIERS',
    PLATFORM_USERS: 'PLATFORM_USERS',
    PLATFORM_CATEGORIES: 'PLATFORM_CATEGORIES',
    PLATFORM_INSIGHTS: 'PLATFORM_INSIGHTS',
    PLATFORM_ADMIN: 'PLATFORM_ADMIN',
    PLATFORM_FEATURES: 'PLATFORM_FEATURES',
    PLATFORM_INTEGRATIONS: 'PLATFORM_INTEGRATIONS',
    
    // Legacy sections (80-99)
    ACCOUNT: 'ACCOUNT',
    APPEARANCE: 'APPEARANCE',
    SUBSCRIPTION: 'SUBSCRIPTION',
    ORGANIZATION: 'ORGANIZATION',
    STORE: 'STORE',
    TEAM: 'TEAM',
    INTEGRATIONS: 'INTEGRATIONS',
    ANALYTICS: 'ANALYTICS',
    SETTINGS: 'SETTINGS',
    HELP: 'HELP',
    USER: 'USER',
    ADMIN: 'ADMIN',
    
    // Inventory features (40-49)
    INVENTORY_SCANNER: 'INVENTORY_SCANNER',
    INVENTORY_QUICKSTART: 'INVENTORY_QUICKSTART',
  },

  // Navigation Depth Guidelines
  NAVIGATION_DEPTH: {
    MAX_LEVELS: 3,        // Primary → Secondary → Tertiary
    PRIMARY_MAX: 8,       // Max primary navigation items
    SECONDARY_MAX: 7,     // Max secondary items per primary
    TERTIARY_MAX: 4,      // Max tertiary items per secondary
  },
};
