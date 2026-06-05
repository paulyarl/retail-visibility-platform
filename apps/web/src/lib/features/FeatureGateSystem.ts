/**
 * Unified Feature Gate System
 * 
 * Centralized system for all feature access checks across the platform.
 * Replaces fragmented feature checking patterns with consistent implementation.
 */

import { featureResolver } from './FeatureResolver';

// ==================== FEATURE OPERATIONS REGISTRY ====================

export interface FeatureOperation {
  canonicalKey: string;
  requiredPermission: PermissionType;
  tierRequirement: string;
  apiEndpoints: string[];
  components: string[];
  riskLevel: 'high' | 'medium' | 'low';
  description: string;
  category: 'product' | 'commerce' | 'analytics' | 'branding' | 'integration' | 'ui';
}

export type PermissionType = 'canView' | 'canEdit' | 'canManage' | 'canSupport' | 'canAdmin';

// Single source of truth for all feature operations
export const FEATURE_OPERATIONS: Record<string, FeatureOperation> = {
  // Product Management Operations
  'add_products': {
    canonicalKey: 'product_management',
    requiredPermission: 'canEdit',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/products', '/api/bulk-import'],
    components: ['ProductForm', 'BulkImportButton', 'AddProductButton'],
    riskLevel: 'high',
    description: 'Add new products to inventory',
    category: 'product'
  },
  
  'barcode_scanning': {
    canonicalKey: 'barcode_scanning',
    requiredPermission: 'canEdit',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/products/scan', '/api/barcode/lookup'],
    components: ['BarcodeScanner', 'ScanButton', 'CameraScanner'],
    riskLevel: 'high',
    description: 'Scan barcodes to add products',
    category: 'product'
  },
  
  'bulk_import': {
    canonicalKey: 'bulk_import',
    requiredPermission: 'canEdit',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/products/bulk-import', '/api/import/csv'],
    components: ['BulkImportModal', 'ImportButton'],
    riskLevel: 'medium',
    description: 'Import multiple products at once',
    category: 'product'
  },
  
  'product_featuring': {
    canonicalKey: 'featured_products',
    requiredPermission: 'canEdit',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/products/feature', '/api/featured-products'],
    components: ['FeatureButton', 'FeaturedProductsManager'],
    riskLevel: 'medium',
    description: 'Feature products on storefront',
    category: 'product'
  },
  
  'category_management': {
    canonicalKey: 'categories',
    requiredPermission: 'canManage',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/categories', '/api/categories/reorder'],
    components: ['CategoryManager', 'CategoryForm'],
    riskLevel: 'medium',
    description: 'Manage product categories',
    category: 'product'
  },
  
  // Commerce Operations
  'accept_payments': {
    canonicalKey: 'commerce',
    requiredPermission: 'canManage',
    tierRequirement: 'commitment',
    apiEndpoints: ['/api/payments', '/api/checkout', '/api/payment-methods'],
    components: ['CheckoutForm', 'PaymentSettings', 'CheckoutButton'],
    riskLevel: 'high',
    description: 'Accept online payments',
    category: 'commerce'
  },
  
  'payment_gateway_setup': {
    canonicalKey: 'payment_client_credentials',
    requiredPermission: 'canManage',
    tierRequirement: 'commitment',
    apiEndpoints: ['/api/payment-gateways', '/api/stripe/connect'],
    components: ['PaymentGatewaySettings', 'StripeConnectButton'],
    riskLevel: 'high',
    description: 'Configure payment gateways',
    category: 'commerce'
  },
  
  'delivery_options': {
    canonicalKey: 'commerce',
    requiredPermission: 'canManage',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/delivery', '/api/shipping'],
    components: ['DeliverySettings', 'ShippingOptions'],
    riskLevel: 'medium',
    description: 'Configure delivery and shipping',
    category: 'commerce'
  },
  
  // Analytics Operations
  'advanced_analytics': {
    canonicalKey: 'analytics',
    requiredPermission: 'canView',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/analytics', '/api/reports'],
    components: ['AnalyticsDashboard', 'ReportsPanel'],
    riskLevel: 'medium',
    description: 'View advanced analytics and reports',
    category: 'analytics'
  },
  
  'conversion_tracking': {
    canonicalKey: 'analytics',
    requiredPermission: 'canView',
    tierRequirement: 'commitment',
    apiEndpoints: ['/api/conversions', '/api/tracking'],
    components: ['ConversionReport', 'TrackingSettings'],
    riskLevel: 'low',
    description: 'Track conversion metrics',
    category: 'analytics'
  },
  
  'data_export': {
    canonicalKey: 'api_access',
    requiredPermission: 'canManage',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/export', '/api/data/export'],
    components: ['ExportButton', 'DataExportModal'],
    riskLevel: 'low',
    description: 'Export data via API',
    category: 'analytics'
  },
  
  // Branding Operations
  'custom_logo': {
    canonicalKey: 'branding_suite',
    requiredPermission: 'canManage',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/branding/logo', '/api/upload/logo'],
    components: ['LogoUploader', 'BrandingSettings'],
    riskLevel: 'medium',
    description: 'Upload custom business logo',
    category: 'branding'
  },
  
  'custom_colors': {
    canonicalKey: 'branding_suite',
    requiredPermission: 'canManage',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/branding/colors', '/api/theme/colors'],
    components: ['ColorPicker', 'ThemeCustomizer'],
    riskLevel: 'low',
    description: 'Customize storefront colors',
    category: 'branding'
  },
  
  'marketing_copy': {
    canonicalKey: 'branding_suite',
    requiredPermission: 'canEdit',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/branding/copy', '/api/marketing/copy'],
    components: ['MarketingCopyEditor', 'CopyGenerator'],
    riskLevel: 'low',
    description: 'Custom marketing content',
    category: 'branding'
  },
  
  // Integration Operations
  'clover_sync': {
    canonicalKey: 'integration_clover',
    requiredPermission: 'canManage',
    tierRequirement: 'starter',
    apiEndpoints: ['/api/clover/sync', '/api/integrations/clover'],
    components: ['CloverSyncButton', 'IntegrationSettings'],
    riskLevel: 'high',
    description: 'Sync with Clover POS system',
    category: 'integration'
  },
  
  'square_sync': {
    canonicalKey: 'integration_square',
    requiredPermission: 'canManage',
    tierRequirement: 'ecommerce',
    apiEndpoints: ['/api/square/sync', '/api/integrations/square'],
    components: ['SquareSyncButton', 'IntegrationSettings'],
    riskLevel: 'high',
    description: 'Sync with Square POS system',
    category: 'integration'
  },
  
  'google_shopping': {
    canonicalKey: 'integration_google_shopping',
    requiredPermission: 'canManage',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/google/shopping', '/api/google/merchant-center'],
    components: ['GoogleShoppingSettings', 'MerchantCenterConnect'],
    riskLevel: 'medium',
    description: 'List products on Google Shopping',
    category: 'integration'
  },
  
  'google_merchant_center': {
    canonicalKey: 'integration_google_merchant_center',
    requiredPermission: 'canManage',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/google/merchant-center', '/api/gmc/sync'],
    components: ['MerchantCenterConnect', 'GMCSyncSettings'],
    riskLevel: 'medium',
    description: 'Sync inventory to Google Merchant Center',
    category: 'integration'
  },
  
  'gbp_integration': {
    canonicalKey: 'integration_gbp',
    requiredPermission: 'canManage',
    tierRequirement: 'ecommerce',
    apiEndpoints: ['/api/gbp/sync', '/api/integrations/gbp'],
    components: ['GBPIntegrationSettings', 'GBPSyncButton'],
    riskLevel: 'medium',
    description: 'Sync inventory to Google Business Profile',
    category: 'integration'
  },
  
  'gmc_sync': {
    canonicalKey: 'integration_gmc_sync',
    requiredPermission: 'canManage',
    tierRequirement: 'commitment',
    apiEndpoints: ['/api/gmc/sync', '/api/gmc/variants'],
    components: ['GMCSyncButton', 'GMCSyncSettings'],
    riskLevel: 'medium',
    description: 'Advanced GMC sync with variant support',
    category: 'integration'
  },
  
  'api_access': {
    canonicalKey: 'api_access',
    requiredPermission: 'canManage',
    tierRequirement: 'professional',
    apiEndpoints: ['/api/docs', '/api/keys'],
    components: ['ApiDocumentation', 'ApiKeyManager'],
    riskLevel: 'medium',
    description: 'Access platform APIs',
    category: 'integration'
  },
  
  // UI/UX Operations
  'qr_codes': {
    canonicalKey: 'qr_codes',
    requiredPermission: 'canView',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/qr-codes', '/api/products/qr'],
    components: ['QRCodeGenerator', 'QRCodeDisplay'],
    riskLevel: 'low',
    description: 'Generate QR codes for products',
    category: 'ui'
  },
  
  'storefront': {
    canonicalKey: 'storefront',
    requiredPermission: 'canView',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/storefront', '/api/storefront/customize'],
    components: ['StorefrontEditor', 'StorefrontPreview'],
    riskLevel: 'medium',
    description: 'Customize storefront appearance',
    category: 'ui'
  },
  
  'quick_setup': {
    canonicalKey: 'quick_setup',
    requiredPermission: 'canManage',
    tierRequirement: 'discovery',
    apiEndpoints: ['/api/quick-setup', '/api/onboarding'],
    components: ['QuickSetupWizard', 'OnboardingFlow'],
    riskLevel: 'medium',
    description: 'Guided setup for new tenants',
    category: 'ui'
  }
};

// ==================== FEATURE GATE HOOK ====================

export interface FeatureGateResult {
  hasAccess: boolean;
  accessDeniedReason: string | null;
  canUpgrade: boolean;
  requiredTier: string;
  requiredPermission: PermissionType;
  operation: FeatureOperation;
}

export interface FeatureGateContext {
  tier?: {
    key: string;
    name: string;
  };
  userRole?: string;
  platformUser?: {
    canBypassAll?: boolean;
    canBypassRole?: boolean;
  };
}

/**
 * Core feature gate logic - can be used in hooks, services, or middleware
 */
export class FeatureGateEngine {
  /**
   * Check if user has access to a feature operation
   */
  static checkAccess(
    operation: keyof typeof FEATURE_OPERATIONS,
    context: FeatureGateContext
  ): FeatureGateResult {
    const op = FEATURE_OPERATIONS[operation];
    if (!op) {
      throw new Error(`Unknown feature operation: ${operation}`);
    }
    
    // Platform admin bypass
    if (context.platformUser?.canBypassAll) {
      return {
        hasAccess: true,
        accessDeniedReason: null,
        canUpgrade: false,
        requiredTier: op.tierRequirement,
        requiredPermission: op.requiredPermission,
        operation: op
      };
    }
    
    // Resolve canonical feature
    const canonicalKey = featureResolver.resolveFeature(op.canonicalKey);
    
    // Tier check
    const hasTierFeature = this.checkTierFeature(canonicalKey, context.tier?.key);
    if (!hasTierFeature) {
      return {
        hasAccess: false,
        accessDeniedReason: `Requires ${op.tierRequirement} tier or higher`,
        canUpgrade: true,
        requiredTier: op.tierRequirement,
        requiredPermission: op.requiredPermission,
        operation: op
      };
    }
    
    // Role check
    const hasPermission = this.checkPermission(context.userRole, op.requiredPermission);
    if (!hasPermission) {
      return {
        hasAccess: false,
        accessDeniedReason: `Your role (${context.userRole}) cannot ${op.requiredPermission.replace('can', '').toLowerCase()}`,
        canUpgrade: false,
        requiredTier: op.tierRequirement,
        requiredPermission: op.requiredPermission,
        operation: op
      };
    }
    
    return {
      hasAccess: true,
      accessDeniedReason: null,
      canUpgrade: false,
      requiredTier: op.tierRequirement,
      requiredPermission: op.requiredPermission,
      operation: op
    };
  }
  
  /**
   * Check if tier has feature (simplified version)
   */
  private static checkTierFeature(featureKey: string, tierKey?: string): boolean {
    if (!tierKey) return false;
    
    // This would integrate with your tier system
    // For now, use a simple mapping based on tier hierarchy
    const tierHierarchy = {
      'discovery': 1,
      'starter': 2,
      'storefront': 3,
      'commitment': 4,
      'ecommerce': 4,
      'professional': 5,
      'omnichannel': 5,
      'enterprise': 6
    };
    
    const featureTiers: Record<string, number> = {
      'product_management': 2, // discovery+
      'barcode_scanning': 5,   // professional+
      'bulk_import': 2,        // discovery+
      'featured_products': 2,  // discovery+
      'categories': 2,         // discovery+
      'commerce': 4,           // commitment+
      'payment_client_credentials': 4, // commitment+
      'analytics': 5,          // professional+
      'api_access': 5,         // professional+
      'branding_suite': 5,     // professional+
      'integration_clover': 2,     // starter+
      'integration_square': 4,     // ecommerce+
      'integration_google_shopping': 1, // discovery+
      'integration_google_merchant_center': 1, // discovery+
      'integration_gbp': 4,        // ecommerce+
      'integration_gmc_sync': 4,   // commitment+
      'integration_propagation_gbp': 7, // organization+
      'clover_sync': 2,            // legacy alias → integration_clover
      'square_sync': 4,            // legacy alias → integration_square
      'google_shopping': 1,        // legacy alias → integration_google_shopping
      'qr_codes': 2,           // discovery+
      'storefront': 2,         // discovery+
      'quick_setup': 2         // discovery+
    };
    
    const tierLevel = tierHierarchy[tierKey as keyof typeof tierHierarchy] || 0;
    const requiredLevel = featureTiers[featureKey] || 999;
    
    return tierLevel >= requiredLevel;
  }
  
  /**
   * Check if user role has permission
   */
  private static checkPermission(userRole: string | undefined, requiredPermission: PermissionType): boolean {
    if (!userRole) return false;
    
    const rolePermissions: Record<string, PermissionType[]> = {
      'OWNER': ['canView', 'canEdit', 'canManage', 'canSupport', 'canAdmin'],
      'ADMIN': ['canView', 'canEdit', 'canManage', 'canSupport'],
      'SUPPORT': ['canView', 'canEdit', 'canManage', 'canSupport'],
      'MANAGER': ['canView', 'canEdit', 'canManage', 'canSupport'],
      'MEMBER': ['canView', 'canEdit'],
      'VIEWER': ['canView'],
    };
    
    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(requiredPermission);
  }
  
  /**
   * Get all operations for a category
   */
  static getOperationsByCategory(category: FeatureOperation['category']): Record<string, FeatureOperation> {
    const result: Record<string, FeatureOperation> = {};
    
    Object.entries(FEATURE_OPERATIONS).forEach(([key, operation]) => {
      if (operation.category === category) {
        result[key] = operation;
      }
    });
    
    return result;
  }
  
  /**
   * Get operations by risk level
   */
  static getOperationsByRiskLevel(riskLevel: FeatureOperation['riskLevel']): Record<string, FeatureOperation> {
    const result: Record<string, FeatureOperation> = {};
    
    Object.entries(FEATURE_OPERATIONS).forEach(([key, operation]) => {
      if (operation.riskLevel === riskLevel) {
        result[key] = operation;
      }
    });
    
    return result;
  }
  
  /**
   * Validate feature gate implementation
   */
  static validateImplementation(): string[] {
    const issues: string[] = [];
    
    Object.entries(FEATURE_OPERATIONS).forEach(([operation, config]) => {
      // Check if feature is defined in resolver
      if (!featureResolver.hasFeature(config.canonicalKey)) {
        issues.push(`${operation}: Feature ${config.canonicalKey} not defined in resolver`);
      }
      
      // Check if tier requirement is valid
      const validTiers = ['discovery', 'starter', 'storefront', 'commitment', 'ecommerce', 'professional', 'omnichannel', 'enterprise'];
      if (!validTiers.includes(config.tierRequirement)) {
        issues.push(`${operation}: Invalid tier requirement ${config.tierRequirement}`);
      }
      
      // Check if permission type is valid
      const validPermissions = ['canView', 'canEdit', 'canManage', 'canSupport', 'canAdmin'];
      if (!validPermissions.includes(config.requiredPermission)) {
        issues.push(`${operation}: Invalid permission ${config.requiredPermission}`);
      }
      
      // Check for empty arrays
      if (config.apiEndpoints.length === 0) {
        issues.push(`${operation}: No API endpoints defined`);
      }
      
      if (config.components.length === 0) {
        issues.push(`${operation}: No components defined`);
      }
    });
    
    return issues;
  }
}

// ==================== CONVENIENCE EXPORTS ====================

export const highRiskOperations = FeatureGateEngine.getOperationsByRiskLevel('high');
export const mediumRiskOperations = FeatureGateEngine.getOperationsByRiskLevel('medium');
export const lowRiskOperations = FeatureGateEngine.getOperationsByRiskLevel('low');

export const productOperations = FeatureGateEngine.getOperationsByCategory('product');
export const commerceOperations = FeatureGateEngine.getOperationsByCategory('commerce');
export const analyticsOperations = FeatureGateEngine.getOperationsByCategory('analytics');
export const brandingOperations = FeatureGateEngine.getOperationsByCategory('branding');
export const integrationOperations = FeatureGateEngine.getOperationsByCategory('integration');
export const uiOperations = FeatureGateEngine.getOperationsByCategory('ui');

// Export for use in console/debugging
if (typeof window !== 'undefined') {
  (window as any).featureGateEngine = FeatureGateEngine;
  (window as any).featureOperations = FEATURE_OPERATIONS;
}
