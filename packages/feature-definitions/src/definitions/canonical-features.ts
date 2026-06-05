/**
 * Canonical Feature Definitions
 * 
 * Single source of truth for all feature capabilities.
 * Used by both API and Web workspaces.
 */

export interface FeatureCapability {
  key: string;
  name: string;
  description: string;
  category: 'product' | 'commerce' | 'analytics' | 'branding' | 'integration' | 'ui';
  metadata?: Record<string, any>;
}

// Canonical feature definitions (identical in both workspaces)
export const CANONICAL_FEATURES: Record<string, FeatureCapability> = {
  // Product Management Features
  'product_management': {
    key: 'product_management',
    name: 'Product Management',
    description: 'Add, edit, and manage products',
    category: 'product',
    metadata: {
      maxProducts: 'tier_dependent',
      bulkOperations: true,
      categories: true
    }
  },
  
  'barcode_scanning': {
    key: 'barcode_scanning',
    name: 'Barcode Scanning',
    description: 'Scan barcodes to add products',
    category: 'product',
    metadata: {
      autoFill: true,
      imageRecognition: true,
      cameraAccess: true
    }
  },
  
  'bulk_import': {
    key: 'bulk_import',
    name: 'Bulk Import',
    description: 'Import multiple products at once',
    category: 'product',
    metadata: {
      supportedFormats: ['csv', 'xlsx'],
      maxBatchSize: 1000,
      validation: true
    }
  },
  
  'featured_products': {
    key: 'featured_products',
    name: 'Featured Products',
    description: 'Feature products on storefront',
    category: 'product',
    metadata: {
      maxFeatured: 10,
      rotation: true,
      analytics: true
    }
  },
  
  'categories': {
    key: 'categories',
    name: 'Product Categories',
    description: 'Organize products into categories',
    category: 'product',
    metadata: {
      maxCategories: 50,
      hierarchy: true,
      customOrdering: true
    }
  },
  
  // Commerce Features
  'commerce': {
    key: 'commerce',
    name: 'E-commerce',
    description: 'Complete online selling capabilities',
    category: 'commerce',
    metadata: {
      checkout: true,
      payments: true,
      inventory: true,
      orders: true
    }
  },
  
  'payment_client_credentials': {
    key: 'payment_client_credentials',
    name: 'Payment Gateway Setup',
    description: 'Configure payment gateway credentials',
    category: 'commerce',
    metadata: {
      supportedGateways: ['stripe', 'paypal', 'square', 'clover'],
      webhookSupport: true,
      testing: true
    }
  },
  
  'delivery_options': {
    key: 'delivery_options',
    name: 'Delivery Options',
    description: 'Configure delivery and shipping',
    category: 'commerce',
    metadata: {
      shippingMethods: ['pickup', 'delivery', 'shipping'],
      tracking: true,
      zones: true
    }
  },
  
  // Analytics Features
  'analytics': {
    key: 'analytics',
    name: 'Performance Analytics',
    description: 'Track performance metrics and analytics',
    category: 'analytics',
    metadata: {
      reports: ['views', 'clicks', 'conversions', 'revenue'],
      export: true,
      realTime: false,
      retention: '90_days'
    }
  },
  
  'advanced_analytics': {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Advanced analytics with custom reports',
    category: 'analytics',
    metadata: {
      customReports: true,
      dataExport: true,
      apiAccess: true,
      retention: '365_days'
    }
  },
  
  'conversion_tracking': {
    key: 'conversion_tracking',
    name: 'Conversion Tracking',
    description: 'Track conversion metrics',
    category: 'analytics',
    metadata: {
      funnels: true,
      attribution: true,
      cohort: false
    }
  },
  
  // Branding Features
  'branding_suite': {
    key: 'branding_suite',
    name: 'Branding Suite',
    description: 'Complete branding customization',
    category: 'branding',
    metadata: {
      logo: true,
      customColors: true,
      customFonts: false,
      marketingCopy: true,
      customCSS: false
    }
  },
  
  'custom_domain': {
    key: 'custom_domain',
    name: 'Custom Domain',
    description: 'Use custom domain for storefront',
    category: 'branding',
    metadata: {
      ssl: true,
      dns: true,
      subdomains: true
    }
  },
  
  'white_label': {
    key: 'white_label',
    name: 'White Label',
    description: 'Remove platform branding',
    category: 'branding',
    metadata: {
      platformBranding: false,
      customFooter: true,
      customEmails: true
    }
  },
  
  // Integration Features
  'clover_sync': {
    key: 'clover_sync',
    name: 'Clover POS Integration',
    description: 'Real-time sync with Clover POS',
    category: 'integration',
    metadata: {
      realTime: true,
      inventory: true,
      orders: false,
      webhooks: true
    }
  },
  
  'square_sync': {
    key: 'square_sync',
    name: 'Square POS Integration',
    description: 'Real-time sync with Square POS',
    category: 'integration',
    metadata: {
      realTime: true,
      inventory: true,
      orders: false,
      webhooks: true
    }
  },
  
  'google_shopping': {
    key: 'google_shopping',
    name: 'Google Shopping',
    description: 'List products on Google Shopping',
    category: 'integration',
    metadata: {
      merchantCenter: true,
      productFeed: true,
      autoSync: true
    }
  },
  
  'google_merchant_center': {
    key: 'google_merchant_center',
    name: 'Google Merchant Center',
    description: 'Sync inventory to Google Merchant Center',
    category: 'integration',
    metadata: {
      autoSync: true,
      validation: true,
      errorHandling: true
    }
  },
  
  'api_access': {
    key: 'api_access',
    name: 'API Access',
    description: 'Access platform APIs',
    category: 'integration',
    metadata: {
      rateLimit: '1000_per_hour',
      authentication: 'oauth2',
      documentation: true
    }
  },
  
  // UI/UX Features
  'qr_codes': {
    key: 'qr_codes',
    name: 'QR Codes',
    description: 'Generate QR codes for products',
    category: 'ui',
    metadata: {
      supportedResolutions: ['512', '1024', '2048'],
      formats: ['png', 'svg'],
      customization: true
    }
  },
  
  'storefront': {
    key: 'storefront',
    name: 'Storefront',
    description: 'Public storefront for products',
    category: 'ui',
    metadata: {
      customization: true,
      seo: true,
      mobile: true,
      analytics: true
    }
  },
  
  'quick_setup': {
    key: 'quick_setup',
    name: 'Quick Setup',
    description: 'Guided setup for new tenants',
    category: 'ui',
    metadata: {
      steps: ['profile', 'products', 'storefront', 'payments'],
      skip: true,
      progress: true
    }
  },
  
  'mobile_responsive': {
    key: 'mobile_responsive',
    name: 'Mobile Responsive',
    description: 'Mobile-optimized interface',
    category: 'ui',
    metadata: {
      responsive: true,
      touchOptimized: true,
      pwa: false
    }
  },
  
  'enhanced_seo': {
    key: 'enhanced_seo',
    name: 'Enhanced SEO',
    description: 'Advanced SEO optimization',
    category: 'ui',
    metadata: {
      metaTags: true,
      structuredData: true,
      sitemap: true,
      robots: true
    }
  },
  
  'privacy_mode': {
    key: 'privacy_mode',
    name: 'Privacy Mode',
    description: 'Control privacy settings',
    category: 'ui',
    metadata: {
      dataSharing: false,
      analytics: false,
      publicProfile: false
    }
  },
  
  'interactive_maps': {
    key: 'interactive_maps',
    name: 'Interactive Maps',
    description: 'Interactive location maps',
    category: 'ui',
    metadata: {
      provider: 'google_maps',
      customization: true,
      directions: true
    }
  },
  
  'image_gallery': {
    key: 'image_gallery',
    name: 'Image Gallery',
    description: 'Multiple product images',
    category: 'ui',
    metadata: {
      maxImages: 'tier_dependent',
      formats: ['jpg', 'png', 'webp'],
      optimization: true
    }
  }
};
