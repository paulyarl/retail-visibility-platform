/**
 * Feature Operations Registry
 * 
 * Defines all critical operations that can be gated by features.
 * Used by both API and Web workspaces for consistent feature gating.
 */

import type { PermissionType } from '../definitions/tier-hierarchies';

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

// Single source of truth for all feature operations
export const FEATURE_OPERATIONS: Record<string, FeatureOperation> = {
  // Product Management Operations
  'add_products': {
    canonicalKey: 'product_management',
    requiredPermission: 'canEdit',
    tierRequirement: 'starter',
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
    tierRequirement: 'starter',
    apiEndpoints: ['/api/products/bulk-import', '/api/import/csv'],
    components: ['BulkImportModal', 'ImportButton'],
    riskLevel: 'medium',
    description: 'Import multiple products at once',
    category: 'product'
  },
  
  'product_featuring': {
    canonicalKey: 'featured_products',
    requiredPermission: 'canEdit',
    tierRequirement: 'starter',
    apiEndpoints: ['/api/products/feature', '/api/featured-products'],
    components: ['FeatureButton', 'FeaturedProductsManager'],
    riskLevel: 'medium',
    description: 'Feature products on storefront',
    category: 'product'
  },
  
  'category_management': {
    canonicalKey: 'categories',
    requiredPermission: 'canManage',
    tierRequirement: 'starter',
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
    canonicalKey: 'delivery_options',
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
    canonicalKey: 'conversion_tracking',
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
    canonicalKey: 'clover_sync',
    requiredPermission: 'canManage',
    tierRequirement: 'starter',
    apiEndpoints: ['/api/clover/sync', '/api/integrations/clover'],
    components: ['CloverSyncButton', 'IntegrationSettings'],
    riskLevel: 'high',
    description: 'Sync with Clover POS system',
    category: 'integration'
  },
  
  'square_sync': {
    canonicalKey: 'square_sync',
    requiredPermission: 'canManage',
    tierRequirement: 'starter',
    apiEndpoints: ['/api/square/sync', '/api/integrations/square'],
    components: ['SquareSyncButton', 'IntegrationSettings'],
    riskLevel: 'high',
    description: 'Sync with Square POS system',
    category: 'integration'
  },
  
  'google_shopping': {
    canonicalKey: 'google_shopping',
    requiredPermission: 'canManage',
    tierRequirement: 'starter',
    apiEndpoints: ['/api/google/shopping', '/api/google/merchant-center'],
    components: ['GoogleShoppingSettings', 'MerchantCenterConnect'],
    riskLevel: 'medium',
    description: 'List products on Google Shopping',
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
    tierRequirement: 'starter',
    apiEndpoints: ['/api/qr-codes', '/api/products/qr'],
    components: ['QRCodeGenerator', 'QRCodeDisplay'],
    riskLevel: 'low',
    description: 'Generate QR codes for products',
    category: 'ui'
  },
  
  'storefront': {
    canonicalKey: 'storefront',
    requiredPermission: 'canView',
    tierRequirement: 'starter',
    apiEndpoints: ['/api/storefront', '/api/storefront/customize'],
    components: ['StorefrontEditor', 'StorefrontPreview'],
    riskLevel: 'medium',
    description: 'Customize storefront appearance',
    category: 'ui'
  },
  
  'quick_setup': {
    canonicalKey: 'quick_setup',
    requiredPermission: 'canManage',
    tierRequirement: 'starter',
    apiEndpoints: ['/api/quick-setup', '/api/onboarding'],
    components: ['QuickSetupWizard', 'OnboardingFlow'],
    riskLevel: 'medium',
    description: 'Guided setup for new tenants',
    category: 'ui'
  }
};

// Helper functions for operations
export function getOperationsByCategory(category: FeatureOperation['category']): Record<string, FeatureOperation> {
  const result: Record<string, FeatureOperation> = {};
  
  Object.entries(FEATURE_OPERATIONS).forEach(([key, operation]) => {
    if (operation.category === category) {
      result[key] = operation;
    }
  });
  
  return result;
}

export function getOperationsByRiskLevel(riskLevel: FeatureOperation['riskLevel']): Record<string, FeatureOperation> {
  const result: Record<string, FeatureOperation> = {};
  
  Object.entries(FEATURE_OPERATIONS).forEach(([key, operation]) => {
    if (operation.riskLevel === riskLevel) {
      result[key] = operation;
    }
  });
  
  return result;
}

export function validateOperation(operation: string): boolean {
  return FEATURE_OPERATIONS.hasOwnProperty(operation);
}

export function getOperation(operation: string): FeatureOperation | null {
  return FEATURE_OPERATIONS[operation] || null;
}
