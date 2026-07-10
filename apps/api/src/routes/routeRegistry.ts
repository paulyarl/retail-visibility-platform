/**
 * Centralized Route Registry
 *
 * Declarative list of all route mounts for the API server.
 * Mount order is explicit and controls Express first-match-wins semantics.
 *
 * Categories:
 *   - pre-middleware  : Routes mounted BEFORE global JSON parsing (webhooks, etc.)
 *   - infrastructure  : Health, cache, static uploads
 *   - public          : Public API endpoints (no auth)
 *   - tenant          : Tenant CRUD, profile, status, coordinates
 *   - items           : Items, products, categories, photos
 *   - directory       : Directory listings, categories, store-types, featured, map
 *   - storefront      : Storefront routes (materialized views)
 *   - checkout        : Checkout, payments, orders, shopping carts
 *   - admin           : Admin routes (users, tools, sentry, errors, catalog, etc.)
 *   - integration     : OAuth, POS, GBP, GMC, Meta, TikTok
 *   - security        : Auth, MFA, GDPR, CCPA, sessions, security alerts
 *   - organization    : Organizations, capabilities, users
 *   - customer        : Customer auth, addresses, notifications, payment methods
 *   - singleton       : UniversalSingleton system routes
 *   - settings        : Fulfillment, commerce, tax, product options, etc.
 *   - social          : Social proof, social pixels, bot routes
 *   - compliance      : GDPR, CCPA, account deletion
 *   - misc            : Debug, clone, queue, badges, store reviews, etc.
 *
 * Usage in index.ts:
 *   import { mountFromRegistry } from './routes/routeRegistry';
 *   mountFromRegistry(app);
 */

import { Express } from 'express';

// ─── Route File Imports ────────────────────────────────────────────────────

// Pre-middleware (mounted before JSON parsing)
import clientErrorRoutes from '../routes/client-errors';
import webhooksRoutes from '../routes/webhooks';
import stripeConnectWebhooks from '../routes/stripe-connect-webhooks';

// Infrastructure
import cacheMonitoringRoutes from '../routes/cache-monitoring';
import cacheInvalidationRoutes from '../routes/cache-invalidation';
import cacheRoutes from '../routes/cache';
import publicApiRoutes from '../routes/public-api';

// Tenant
import universalTenantsRoutes from '../routes/universal-tenants';
import tenantsRoutes from '../routes/tenants';
import tenantCategoriesRoutes from '../routes/tenant-categories';
import trialSetupRoutes from '../routes/tenant/trial-setup';
import tenantNotificationsRoutes from '../routes/tenant-notifications';
import digitalDownloadPagesRoutes from '../routes/tenant/digital-download-pages';
import tenantInventoryTransferRoutes from '../routes/tenant-inventory-transfers';
import tenantStripeConnectRoutes from '../routes/tenant-stripe-connect';
import serviceChargesRoutes from '../routes/admin/service-charges';

// Items / Products
import variantsRoutes from '../routes/variants';
import photosRouter from '../photos';
import productLikesRoutes from '../routes/product-likes';
import productFeaturingRoutes from '../routes/product-featuring';
import productCacheSingletonRoutes from '../routes/product-cache-singleton';

// Directory
import directoryConsolidatedRoutes from '../routes/directory-consolidated';
import directoryRandomFeaturedRoutes from '../routes/directory-random-featured';
import directoryRandomFeaturedGlobalRoutes from '../routes/directory-random-featured-global';
import directoryFeaturedStoresRoutes from '../routes/directory-featured-stores';
import directoryPhotosRouter from '../routes/directory-photos';
import directoryOptimizedRoutes from '../routes/directory-optimized';
import directoryCategoriesOptimizedRoutes from '../routes/directory-categories-optimized';
import directoryCategoriesEnhancedRoutes from '../routes/directory-categories-enhanced';
import directoryMapRoutes from '../routes/directory-map';
import directoryRoutes from '../routes/directory';
import slugGenerationRoutes from '../routes/slug-generation';

// Storefront
import storefrontRoutes from '../routes/storefront';
import storefrontFeaturedRoutes from '../routes/storefront-featured';

// Featured products
import featuredProductsScoredRoutes from '../routes/featured-products-scored';
import featuredProductsSingletonRoutes from '../routes/featured-products-singleton';
import activeFeaturedRoutes, { publicTenantRouter as activeFeaturedPublicRouter } from '../routes/active-featured';
import featuredPlacementRoutes from '../routes/featured-placements';

// Checkout & Orders
import checkoutRoutes from '../routes/checkout';
import checkoutPaymentsRoutes from '../routes/checkout-payments';
import paypalRoutes from '../routes/checkout/paypal';
import squareCheckoutRoutes from '../routes/checkout/square';
import stripeCheckoutRoutes from '../routes/checkout/stripe';
import depositForfeitureRoutes from '../routes/deposit-forfeiture';
import buyerOrdersRoutes from '../routes/buyer-orders';
import ordersRoutes from '../routes/orders';
import shoppingCartsRoutes from '../routes/shopping-carts';
import paymentsRoutes from '../routes/payments';
import tenantOrdersRoutes from '../routes/tenant-orders';
import shipmentRoutes from '../routes/shipments';
import abandonedCartRoutes from '../routes/abandoned-carts';
import orderManagementRoutes from '../routes/order-management';
import fulfillmentRoutes from '../routes/fulfillment';

// Admin
import adminUsersRoutes from '../routes/admin-users';
import adminToolsRoutes from '../routes/admin-tools';
import cachedProductsRoutes from '../routes/cached-products';
import scanMetricsRoutes from '../routes/scan-metrics';
import sentryRoutes from '../routes/admin/sentry';
import errorLogRoutes from '../routes/admin/errors';
import manualBillingRoutes from '../routes/admin/manual-billing';
import platformRevenueRoutes from '../routes/platform-revenue';
import platformFeeInvoiceRoutes from '../routes/platform-fee-invoices';
import notificationLogsRoutes from '../routes/admin/notification-logs';
import adminInventoryTransferRoutes from '../routes/admin/inventory-transfers';
import adminSlugRegistryRoutes from '../routes/admin/slug-registry';
import adminCatalogRoutes from '../routes/admin/catalog';
import adminInventoryStatsRoutes from '../routes/admin/inventory-stats';
import googleProductTaxonomyRoutes from '../routes/admin/google-product-taxonomy';
import adminDemoTenantRoutes from '../routes/admin/demo-tenants';
import tierManagementRoutes from '../routes/admin/tier-management';
import tierSystemRoutes from '../routes/admin/tier-system';
import capabilityRoutes from '../routes/admin/capability-routes';
import featureOverridesRoutes from '../routes/admin/feature-overrides';
import adminSecurityMonitoringRoutes from '../routes/admin/security-monitoring';
import adminSecurityRoutes from '../routes/admin-security';
import platformSettingsRoutes from '../routes/platform-settings';
import performanceApi from '../routes/performance';

// Integrations
import oauthRoutes from '../routes/oauth';
import googleBusinessOAuthRoutes from '../routes/google-business-oauth';
import googleMerchantOAuthRoutes from '../routes/google-merchant-oauth';
import metaOAuthRoutes from '../routes/meta-oauth';
import metaWebhookRoutes from '../routes/meta-webhooks';
import tiktokOAuthRoutes from '../routes/tiktok-oauth';
import tiktokWebhookRoutes from '../routes/tiktok-webhooks';
import cloverRoutes from '../routes/integrations/clover';
import squareRoutes from '../routes/integrations/square';
import gbpRoutes from '../routes/gbp';
import scanRoutes from '../routes/scan';
import paypalConnectRoutes from '../routes/paypal-connect';

// Singleton system
import categoriesSingletonRoutes from '../routes/categories-singleton';
import shopManagementRoutes from '../routes/shop-management';
import gbpAdvancedSyncSingletonRoutes from '../routes/gbp-advanced-sync-singleton';
import gmcProductSyncSingletonRoutes from '../routes/gmc-product-sync-singleton';
import cloverOAuthSingletonRoutes from '../routes/clover-oauth-singleton';
import oauthSingletonRoutes from '../routes/oauth-singleton';
import refundSingletonRoutes from '../routes/refund-singleton';
import taxonomySyncSingletonRoutes from '../routes/taxonomy-sync-singleton';
import gbpSyncTrackingSingletonRoutes from '../routes/gbp-sync-tracking-singleton';
import recommendationSingletonRoutes from '../routes/recommendation-singleton';
import gbpCategorySyncSingletonRoutes from '../routes/gbp-category-sync-singleton';
import barcodeEnrichmentSingletonRoutes from '../routes/barcode-enrichment-singleton';
import digitalAssetSingletonRoutes from '../routes/digital-asset-singleton';
import aiImageSingletonRoutes from '../routes/ai-image-singleton';
import reviewsSingletonRoutes from '../routes/reviews-singleton';

// Settings
import fulfillmentSettingsRoutes from '../routes/fulfillment-settings';
import commerceSettingsRoutes from '../routes/commerce-settings';
import taxRoutes from '../routes/tax';
import productOptionsSettingsRoutes from '../routes/product-options-settings';
import featuredOptionsSettingsRoutes from '../routes/featured-options-settings';
import quickstartOptionsSettingsRoutes from '../routes/quickstart-options-settings';
import storefrontOptionsSettingsRoutes from '../routes/storefront-options-settings';
import directoryEntryOptionsSettingsRoutes from '../routes/directory-entry-options-settings';
import storefrontTypeSettingsRoutes from '../routes/storefront-type-settings';
import productTypeSettingsRoutes from '../routes/product-type-settings';
import storefrontPolicyRoutes from '../routes/storefront-policies';
import policyTemplateRoutes from '../routes/policy-templates';
import faqOptionsSettingsRoutes from '../routes/faq-options-settings';
import crmOptionsSettingsRoutes from '../routes/crm-options-settings';
import socialCommerceOptionsSettingsRoutes from '../routes/social-commerce-options-settings';
import chatbotOptionsSettingsRoutes from '../routes/chatbot-options-settings';
import botPublicRoutes from '../routes/bot-public';
import botMerchantRoutes from '../routes/bot-merchant';
import barcodeScanSettingsRoutes from '../routes/barcode-scan-settings';
import integrationOptionsSettingsRoutes from '../routes/integration-options-settings';
import paymentGatewaySettingsRoutes from '../routes/payment-gateway-settings';
import organizationCommerceSettingsRoutes from '../routes/organization-commerce-settings';
import paymentGatewaysRoutes from '../routes/payment-gateways';

// Social
import socialProofRoutes from '../routes/social-proof';
import socialPixelRoutes from '../routes/social-pixels';
import shippingRateRoutes from '../routes/shipping-rates';
import returnsRoutes from '../routes/returns';

// Security & Compliance
import permissionRoutes from '../routes/permissions';
import gdprRoutes from '../routes/gdpr';
import accountDeletionRoutes from '../routes/account-deletion';
import ccpaRoutes from '../routes/ccpa';
import mfaRoutes from '../routes/mfa';
import auth0MFARoutes from '../routes/auth0-mfa';
import authSyncRoutes from '../routes/auth-sync';
import authSessionsRoutes from '../routes/auth-sessions';
import securityAlertsRoutes from '../routes/security-alerts';
import securityTelemetryRoutes from '../routes/security-telemetry';

// Organizations
import organizationRoutes from '../routes/organizations';
import organizationRequestRoutes from '../routes/organization-requests';
import organizationUserRoutes from '../routes/organization-users';
import organizationCapabilitiesRoutes from '../routes/organization-capabilities';
import upgradeRequestsRoutes from '../routes/upgrade-requests';

// Customer
import customerRoutes from '../routes/customers';
import customerAuthRoutes from '../routes/customer-auth';
import customerAuthTokenRoutes from '../routes/customer-auth-token';
import customerAddressesRoutes from '../routes/customer-addresses';
import customerNotificationsRoutes from '../routes/customer-notifications';
import customerPaymentMethodsRoutes from '../routes/customer-payment-methods';

// Misc
import billingRoutes from '../routes/billing';
import rateLimitWarningsRoutes from '../routes/rate-limit-warnings';
import taxonomyAdminRoutes from '../routes/taxonomy-admin';
import feedValidationRoutes from '../routes/feed-validation';
import businessProfileValidationRoutes from '../routes/business-profile-validation';
import quickStartRoutes from '../routes/quick-start';
import recommendationRoutes from '../routes/recommendations';
import cloneRoutes from '../routes/clone';
import queueRoutes from '../routes/queue-routes';
import subscriptionBillingRoutes from '../routes/subscription-billing';
import stripeWebhookRoutes from '../routes/stripe-webhook';
import storeReviewsRoutes from '../routes/store-reviews';
import badgeRegistryRoutes from '../routes/badge-registry';
import badgeAnalyticsRoutes from '../routes/badge-analytics';
import heroLocationRoutes from '../routes/hero-location';
import debugCookiesRoutes from '../routes/debug-cookies';
import faqRoutes from '../routes/faq';
import faqPublicRoutes from '../routes/faq-public';
import tierConfigRoutes from '../routes/tier-config';

// Inline handler route files (extracted from index.ts)
import inlineAuthRbacRoutes from '../routes/inline-auth-rbac';
import inlineGbpCategoriesRoutes from '../routes/inline-gbp-categories';
import inlineMiscRoutes from '../routes/inline-misc';
import inlineTenantRoutes from '../routes/inline-tenant';
import inlineTenantProfileRoutes from '../routes/inline-tenant-profile';
import inlineItemsRoutes from '../routes/inline-items';
import inlineTaxonomyRoutes from '../routes/inline-taxonomy';
import inlineEmailConfigRoutes from '../routes/inline-email-config';
import inlineDirectoryRoutes from '../routes/inline-directory';
import inlineGoogleOAuthRoutes from '../routes/inline-google-oauth';
import inlineTenantUploadRoutes from '../routes/inline-tenant-upload';
import inlineItemsCrudRoutes from '../routes/inline-items-crud';

// Middleware
import { authenticateToken, requireAdmin } from '../middleware/auth';

// ─── Registry Types ────────────────────────────────────────────────────────

export interface RouteEntry {
  path: string;
  router: any;
  middleware?: any[];
  domain: string;
  comment?: string;
  /** If true, this mount must come before JSON parsing middleware */
  preMiddleware?: boolean;
  /** If true, this is a catch-all route that must be mounted AFTER specific routes */
  isCatchAll?: boolean;
}

// ─── Route Registry ────────────────────────────────────────────────────────

export const routeRegistry: RouteEntry[] = [
  // ── Pre-middleware (before JSON parsing) ──────────────────────────────
  {
    path: '/api/client-errors',
    router: clientErrorRoutes,
    middleware: [],
    domain: 'pre-middleware',
    comment: 'Mounted BEFORE auth middleware (errors can occur pre-login)',
    preMiddleware: true,
  },
  {
    path: '/api/webhooks',
    router: webhooksRoutes,
    domain: 'pre-middleware',
    comment: 'Webhooks MUST be mounted BEFORE JSON parsing for Stripe signature verification',
    preMiddleware: true,
  },
  {
    path: '/api/webhooks/stripe-connect',
    router: stripeConnectWebhooks,
    domain: 'pre-middleware',
    comment: 'Stripe Connect webhooks - requires raw body',
    preMiddleware: true,
  },

  // ── Infrastructure ────────────────────────────────────────────────────
  {
    path: '/api/admin/service-charges',
    router: serviceChargesRoutes,
    domain: 'admin',
    comment: 'Mounted BEFORE universal tenants to prevent interception',
  },
  {
    path: '/api',
    router: universalTenantsRoutes,
    domain: 'tenant',
    comment: 'Universal tenant routes (Phase 3: Universal Identifier System)',
  },
  {
    path: '/api/cache',
    router: cacheMonitoringRoutes,
    domain: 'infrastructure',
    comment: 'Cache monitoring (Phase 1: Encrypted Cache System)',
  },
  {
    path: '/api/cache',
    router: cacheInvalidationRoutes,
    domain: 'infrastructure',
    comment: 'Cache invalidation (Cache Management)',
  },
  {
    path: '/api/public',
    router: publicApiRoutes,
    domain: 'public',
    comment: 'Public API routes (Singleton System)',
  },

  // ── Directory (specific routes BEFORE catch-all) ─────────────────────
  {
    path: '/api/directory',
    router: directoryConsolidatedRoutes,
    domain: 'directory',
    comment: 'Consolidated route - mounted BEFORE any other /api/directory routes',
  },
  {
    path: '/api/directory',
    router: directoryRandomFeaturedRoutes,
    domain: 'directory',
    comment: 'Random featured products route',
  },
  {
    path: '/api/directory',
    router: directoryRandomFeaturedGlobalRoutes,
    domain: 'directory',
    comment: 'Global random featured products route',
  },
  {
    path: '/api/directory/featured-stores',
    router: directoryFeaturedStoresRoutes,
    domain: 'directory',
    comment: 'Featured stores - mounted BEFORE other directory routes to avoid conflicts',
  },
  {
    path: '/api/directory',
    router: directoryPhotosRouter,
    domain: 'directory',
    comment: 'Directory photos router (handles all photo endpoints with position support)',
  },
  {
    path: '/api/directory-optimized',
    router: directoryOptimizedRoutes,
    domain: 'directory',
    comment: 'Directory optimized (materialized view - 6.7x faster)',
  },
  {
    path: '/api/directory/categories-optimized',
    router: directoryCategoriesOptimizedRoutes,
    domain: 'directory',
    comment: 'Directory categories optimized (category statistics - 10x faster)',
  },
  {
    path: '/api/directory',
    router: directoryCategoriesEnhancedRoutes,
    domain: 'directory',
    comment: 'Enhanced directory categories - BEFORE store-types to avoid catch-all conflicts',
  },
  {
    path: '/api/slugs',
    router: slugGenerationRoutes,
    domain: 'directory',
    comment: 'Slug generation (Platform Standard - SlugSingletonService)',
  },
  {
    path: '/api/directory',
    router: directoryMapRoutes,
    domain: 'directory',
    comment: 'Directory map routes',
  },
  {
    path: '/api/directory',
    router: directoryRoutes,
    domain: 'directory',
    comment: 'Directory main routes (includes /:identifier catch-all)',
    isCatchAll: true,
  },

  // ── Public routes (must be before authenticated catch-alls) ──────────
  {
    path: '/api/recommendations',
    router: recommendationRoutes,
    domain: 'public',
    comment: 'Recommendation routes (MVP recommendation system - PUBLIC)',
  },

  // ── Variants & Scan ──────────────────────────────────────────────────
  {
    path: '/api',
    router: variantsRoutes,
    domain: 'items',
    comment: 'Product variants routes (auth applied per-route)',
  },
  {
    path: '/api',
    router: scanRoutes,
    domain: 'items',
    comment: 'M4: SKU Scanning routes',
  },

  // ── Storefront ───────────────────────────────────────────────────────
  {
    path: '/api/storefront',
    router: storefrontFeaturedRoutes,
    domain: 'storefront',
    comment: 'Storefront featured products (MV optimized)',
  },
  {
    path: '/api/storefront',
    router: storefrontRoutes,
    domain: 'storefront',
    comment: 'Storefront routes (materialized view for instant category filtering)',
  },

  // ── Featured products ────────────────────────────────────────────────
  {
    path: '/api/featured-products',
    router: featuredProductsScoredRoutes,
    domain: 'items',
    comment: 'Featured products with quality scoring',
  },
  {
    path: '/api/featured-products-singleton',
    router: featuredProductsSingletonRoutes,
    domain: 'singleton',
    comment: 'Featured products singleton',
  },
  {
    path: '/api',
    router: activeFeaturedRoutes,
    domain: 'items',
    comment: 'Active featured resolver',
  },
  {
    path: '/api/public/tenants/:tenantId',
    router: activeFeaturedPublicRouter,
    domain: 'public',
    comment: 'Active featured resolver (public tenant router)',
  },
  {
    path: '/api',
    router: featuredPlacementRoutes,
    domain: 'items',
    comment: 'Featured placement (monetization)',
  },
  {
    path: '/api',
    router: productFeaturingRoutes,
    domain: 'items',
    comment: 'Product featuring routes',
  },

  // ── Checkout & Orders ────────────────────────────────────────────────
  {
    path: '/api/checkout',
    router: checkoutRoutes,
    domain: 'checkout',
    comment: 'Checkout routes (Guest)',
  },
  {
    path: '/api/checkout',
    router: checkoutPaymentsRoutes,
    domain: 'checkout',
    comment: 'Checkout payments',
  },
  {
    path: '/api/checkout/paypal',
    router: paypalRoutes,
    domain: 'checkout',
    comment: 'PayPal checkout',
  },
  {
    path: '/api/checkout/square',
    router: squareCheckoutRoutes,
    domain: 'checkout',
    comment: 'Square checkout',
  },
  {
    path: '/api/checkout/stripe',
    router: stripeCheckoutRoutes,
    domain: 'checkout',
    comment: 'Stripe checkout',
  },
  {
    path: '/api/deposit-forfeiture',
    router: depositForfeitureRoutes,
    domain: 'checkout',
    comment: 'Deposit forfeiture',
  },
  {
    path: '/api/orders',
    router: buyerOrdersRoutes,
    domain: 'checkout',
    comment: 'Buyer orders (Public - No Auth)',
  },
  {
    path: '/api/orders',
    router: ordersRoutes,
    middleware: [authenticateToken],
    domain: 'checkout',
    comment: 'Orders (Phase 3A: Order Management Foundation)',
  },
  {
    path: '/api/shopping-carts',
    router: shoppingCartsRoutes,
    domain: 'checkout',
    comment: 'Shopping carts (Phase 3C: Database-Persisted Carts)',
  },
  {
    path: '/api/payments',
    router: paymentsRoutes,
    middleware: [authenticateToken],
    domain: 'checkout',
    comment: 'Payments (Phase 3B: Payment Processing)',
  },
  {
    path: '/api/orders',
    router: paymentsRoutes,
    middleware: [authenticateToken],
    domain: 'checkout',
    comment: 'Payments also mounted at /api/orders',
  },

  // ── GBP ──────────────────────────────────────────────────────────────
  {
    path: '/api/gbp',
    router: gbpRoutes,
    domain: 'integration',
    comment: 'GBP routes (Google Business Profile category search)',
  },
  {
    path: '/api',
    router: inlineGbpCategoriesRoutes,
    domain: 'integration',
    comment: 'GBP categories inline handlers (popular + search)',
  },

  // ── Tenants ──────────────────────────────────────────────────────────
  {
    path: '/api',
    router: platformSettingsRoutes,
    domain: 'infrastructure',
    comment: 'Platform settings at /api/platform-settings',
  },
  {
    path: '/api/tenants',
    router: tenantsRoutes,
    domain: 'tenant',
    comment: 'Tenants routes',
  },
  {
    path: '/api/tenants',
    router: paymentGatewaysRoutes,
    domain: 'tenant',
    comment: 'Payment gateway routes at /api/tenants/:tenantId/payment-gateways',
  },
  {
    path: '/api/tenants',
    router: tenantStripeConnectRoutes,
    domain: 'tenant',
    comment: 'Tenant Stripe Connect at /api/tenants/:tenantId/stripe-connect',
  },
  {
    path: '/api/tenants',
    router: paypalConnectRoutes,
    domain: 'tenant',
    comment: 'PayPal Connect at /api/tenants (also at /api/admin/paypal-connect)',
  },
  {
    path: '/api/admin/paypal-connect',
    router: paypalConnectRoutes,
    domain: 'admin',
    comment: 'PayPal Connect admin',
  },

  // ── Settings (tenant-scoped) ─────────────────────────────────────────
  {
    path: '/api/tenants',
    router: fulfillmentSettingsRoutes,
    domain: 'settings',
    comment: 'Fulfillment settings at /api/tenants/:tenantId/fulfillment-settings',
  },
  {
    path: '/api',
    router: fulfillmentSettingsRoutes,
    domain: 'settings',
    comment: 'Fulfillment settings public at /api/public/tenant/:tenantId/fulfillment-settings',
  },
  {
    path: '/api/tenants',
    router: commerceSettingsRoutes,
    domain: 'settings',
    comment: 'Commerce settings at /api/tenants/:tenantId/commerce-settings',
  },
  {
    path: '/api',
    router: commerceSettingsRoutes,
    domain: 'settings',
    comment: 'Commerce settings public at /api/public/tenant/:tenantId/commerce-settings',
  },
  {
    path: '/api/tax',
    router: taxRoutes,
    domain: 'settings',
    comment: 'Tax engine at /api/tax/calculate',
  },
  {
    path: '/api/tenants',
    router: taxRoutes,
    domain: 'settings',
    comment: 'Tax settings at /api/tenants/:tenantId/tax-settings',
  },
  {
    path: '/api/tenants',
    router: productOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Product options at /api/tenants/:tenantId/product-options',
  },
  {
    path: '/api/tenants',
    router: featuredOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Featured options at /api/tenants/:tenantId/featured-options',
  },
  {
    path: '/api',
    router: featuredOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Featured options public at /api/public/tenant/:tenantId/featured-options',
  },
  {
    path: '/api/tenants',
    router: quickstartOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Quickstart options at /api/tenants/:tenantId/quickstart-options',
  },
  {
    path: '/api/tenants',
    router: storefrontOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Storefront options at /api/tenants/:tenantId/storefront-options',
  },
  {
    path: '/api/tenants',
    router: directoryEntryOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Directory entry options at /api/tenants/:tenantId/directory-entry-options',
  },
  {
    path: '/api/tenants',
    router: storefrontTypeSettingsRoutes,
    domain: 'settings',
    comment: 'Storefront type at /api/tenants/:tenantId/storefront-type',
  },
  {
    path: '/api',
    router: storefrontTypeSettingsRoutes,
    domain: 'settings',
    comment: 'Storefront type public at /api/public/tenant/:tenantId/storefront-type',
  },
  {
    path: '/api/tenants',
    router: productTypeSettingsRoutes,
    domain: 'settings',
    comment: 'Product type at /api/tenants/:tenantId/product-type',
  },
  {
    path: '/api',
    router: productTypeSettingsRoutes,
    domain: 'settings',
    comment: 'Product type public at /api/public/tenant/:tenantId/product-type',
  },
  {
    path: '/api/tenants',
    router: storefrontPolicyRoutes,
    domain: 'settings',
    comment: 'Storefront policies at /api/tenants/:tenantId/storefront-policies',
  },
  {
    path: '/api',
    router: storefrontPolicyRoutes,
    domain: 'settings',
    comment: 'Storefront policies public at /api/public/storefront-policies/:tenantId',
  },
  {
    path: '/api',
    router: policyTemplateRoutes,
    domain: 'settings',
    comment: 'Policy templates at /api/public/policy-templates, /api/tenants/:tenantId/storefront-policies/templates, and /api/admin/policy-templates',
  },
  {
    path: '/api/tenants',
    router: faqOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'FAQ options at /api/tenants/:tenantId/faq-options',
  },
  {
    path: '/api',
    router: faqOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'FAQ options public at /api/public/tenant/:tenantId/faq-options',
  },
  {
    path: '/api/tenants',
    router: crmOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'CRM options at /api/tenants/:tenantId/crm-options',
  },
  {
    path: '/api',
    router: crmOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'CRM options public at /api/public/tenant/:tenantId/crm-options',
  },
  {
    path: '/api/tenants',
    router: socialCommerceOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Social commerce options at /api/tenants/:tenantId/social-commerce-options',
  },
  {
    path: '/api',
    router: socialCommerceOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Social commerce options public',
  },
  {
    path: '/api/tenants',
    router: chatbotOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Chatbot options at /api/tenants/:tenantId/chatbot-options',
  },
  {
    path: '/api',
    router: chatbotOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Chatbot options public at /api/public/tenant/:tenantId/chatbot-options',
  },
  {
    path: '/api/public/bot',
    router: botPublicRoutes,
    domain: 'social',
    comment: 'Bot public routes at /api/public/bot/*',
  },
  {
    path: '/api/tenants/:tenantId/bot',
    router: botMerchantRoutes,
    middleware: [authenticateToken],
    domain: 'social',
    comment: 'Bot merchant routes at /api/tenants/:tenantId/bot/*',
  },
  {
    path: '/api/tenants',
    router: barcodeScanSettingsRoutes,
    domain: 'settings',
    comment: 'Barcode scan settings at /api/tenants/:tenantId/barcode-scan',
  },
  {
    path: '/api/tenants',
    router: integrationOptionsSettingsRoutes,
    domain: 'settings',
    comment: 'Integration options at /api/tenants/:tenantId/integration-options',
  },
  {
    path: '/api/tenants',
    router: paymentGatewaySettingsRoutes,
    domain: 'settings',
    comment: 'Payment gateway settings at /api/tenants/:tenantId/payment-gateway-settings',
  },
  {
    path: '/api',
    router: paymentGatewaySettingsRoutes,
    domain: 'settings',
    comment: 'Payment gateway settings public at /api/public/tenant/:tenantId/payment-gateway-settings',
  },
  {
    path: '/api/organizations',
    router: organizationCommerceSettingsRoutes,
    domain: 'settings',
    comment: 'Organization commerce settings at /api/organizations/:organizationId/commerce-settings',
  },
  {
    path: '/api',
    router: organizationCommerceSettingsRoutes,
    domain: 'settings',
    comment: 'Organization commerce settings public',
  },

  // ── Billing ──────────────────────────────────────────────────────────
  {
    path: '/api',
    router: billingRoutes,
    domain: 'billing',
    comment: 'Billing routes at /api/billing',
  },

  // ── Orders (tenant-scoped) ───────────────────────────────────────────
  {
    path: '/api',
    router: tenantOrdersRoutes,
    domain: 'checkout',
    comment: 'Tenant orders at /api/tenants/:tenantId/orders',
  },
  {
    path: '/api/tenants/:tenantId/shipments',
    router: shipmentRoutes,
    domain: 'checkout',
    comment: 'Shipments at /api/tenants/:tenantId/shipments',
  },
  {
    path: '/api/tenants',
    router: abandonedCartRoutes,
    domain: 'checkout',
    comment: 'Abandoned carts at /api/tenants/:tenantId/abandoned-carts',
  },
  {
    path: '/api/tenant/inventory-transfers',
    router: tenantInventoryTransferRoutes,
    domain: 'tenant',
    comment: 'Tenant inventory transfers (auth temporarily removed for testing)',
  },
  {
    path: '/api/tenant',
    router: feedValidationRoutes,
    middleware: [authenticateToken],
    domain: 'tenant',
    comment: 'Feed validation - must be BEFORE tenantCategoriesRoutes to avoid /:tenantId/categories/:id matching /coverage',
  },

  // ── Auth & RBAC (inline handlers extracted) ──────────────────────────
  {
    path: '/',
    router: inlineAuthRbacRoutes,
    domain: 'security',
    comment: 'Auth RBAC endpoints (role-groups, user-groups, permissions, user-access, role-protected routes)',
  },

  // ── Tenant trial, notifications, categories ──────────────────────────
  {
    path: '/api/tenants',
    router: trialSetupRoutes,
    middleware: [authenticateToken],
    domain: 'tenant',
    comment: 'Tenant trial setup',
  },
  {
    path: '/api/tenants',
    router: tenantNotificationsRoutes,
    middleware: [authenticateToken],
    domain: 'tenant',
    comment: 'Tenant notifications at /api/tenants/:tenantId/notifications',
  },
  {
    path: '/api/tenants',
    router: digitalDownloadPagesRoutes,
    domain: 'tenant',
    comment: 'Digital download pages at /api/tenants/:tenantId/digital-download-pages',
  },
  {
    path: '/api/tenant',
    router: tenantCategoriesRoutes,
    middleware: [authenticateToken],
    domain: 'tenant',
    comment: 'Tenant categories (GBP)',
  },

  // ── Products & Photos ────────────────────────────────────────────────
  {
    path: '/api/products',
    router: productLikesRoutes,
    domain: 'items',
    comment: 'Product likes routes',
  },
  {
    path: '/api/tenants/:tenantId/faqs',
    router: faqRoutes,
    domain: 'items',
    comment: 'FAQ routes (merchant)',
  },
  {
    path: '/api/public/tenants/:tenantId',
    router: faqPublicRoutes,
    domain: 'public',
    comment: 'FAQ public routes at /api/public/tenants/:tenantId/faqs',
  },
  {
    path: '/api/items',
    router: photosRouter,
    domain: 'items',
    comment: 'Photos routes at /api/items',
  },
  {
    path: '/api/directory',
    router: directoryPhotosRouter,
    domain: 'directory',
    comment: 'Directory photos routes (second mount for directory-specific photo endpoints)',
  },

  // ── Cache ────────────────────────────────────────────────────────────
  {
    path: '/api/cache',
    router: cacheRoutes,
    domain: 'infrastructure',
    comment: 'Cache routes',
  },

  // ── Compliance ───────────────────────────────────────────────────────
  {
    path: '/api/gdpr',
    router: gdprRoutes,
    domain: 'compliance',
    comment: 'GDPR compliance (data export, consent management)',
  },
  {
    path: '/api/gdpr',
    router: accountDeletionRoutes,
    domain: 'compliance',
    comment: 'Account deletion requests (30-day grace period)',
  },
  {
    path: '/api',
    router: accountDeletionRoutes,
    domain: 'compliance',
    comment: 'Account deletion also at /api',
  },
  {
    path: '/api/ccpa',
    router: ccpaRoutes,
    domain: 'compliance',
    comment: 'CCPA compliance (opt-out-sale, data categories)',
  },

  // ── MFA & Security ───────────────────────────────────────────────────
  {
    path: '/api/auth/mfa',
    router: mfaRoutes,
    domain: 'security',
    comment: 'MFA routes (two-factor authentication)',
  },
  {
    path: '/api/auth0-mfa',
    router: auth0MFARoutes,
    domain: 'security',
    comment: 'Auth0 MFA routes (custom UI + Auth0 backend)',
  },
  {
    path: '/api/auth',
    router: authSyncRoutes,
    domain: 'security',
    comment: 'Auth0 sync routes at /api/auth/sync-user',
  },
  {
    path: '/api/auth',
    router: authSessionsRoutes,
    domain: 'security',
    comment: 'Security sessions at /api/auth/sessions',
  },
  {
    path: '/api/security/telemetry',
    router: securityTelemetryRoutes,
    domain: 'security',
    comment: 'Security telemetry (no auth required) - mounted first',
  },
  {
    path: '/api/security',
    router: securityAlertsRoutes,
    domain: 'security',
    comment: 'Security alerts at /api/security/security-alerts',
  },
  {
    path: '/api/admin/security',
    router: adminSecurityMonitoringRoutes,
    domain: 'admin',
    comment: 'Admin security monitoring',
  },
  {
    path: '/api/admin/security',
    router: adminSecurityRoutes,
    middleware: [authenticateToken, requireAdmin],
    domain: 'admin',
    comment: 'Admin security analytics (auth + admin required)',
  },

  // ── Clone ────────────────────────────────────────────────────────────
  {
    path: '/api/clone',
    router: cloneRoutes,
    domain: 'misc',
    comment: 'Clone routes (product & category cloning)',
  },

  // ── Organizations ────────────────────────────────────────────────────
  {
    path: '/api/upgrade-requests',
    router: upgradeRequestsRoutes,
    domain: 'organization',
    comment: 'Upgrade requests',
  },
  {
    path: '/api/organization-requests',
    router: organizationRequestRoutes,
    domain: 'organization',
    comment: 'Organization requests',
  },
  {
    path: '/organizations',
    router: organizationRoutes,
    domain: 'organization',
    comment: 'Organizations routes (no auth at /organizations)',
  },
  {
    path: '/api/organizations',
    router: organizationRoutes,
    middleware: [authenticateToken],
    domain: 'organization',
    comment: 'Organizations routes (with authentication at /api/organizations)',
  },
  {
    path: '/api/organizations',
    router: organizationCapabilitiesRoutes,
    domain: 'organization',
    comment: 'Organization capabilities at /api/organizations/:orgId/effective-capabilities',
  },
  {
    path: '/api/organizations',
    router: organizationUserRoutes,
    domain: 'organization',
    comment: 'Organization users at /api/organizations/:orgId/users',
  },

  // ── Misc endpoints ───────────────────────────────────────────────────
  {
    path: '/api/hero-location',
    router: heroLocationRoutes,
    domain: 'misc',
    comment: 'Hero location routes',
  },
  {
    path: '/api/order-management',
    router: orderManagementRoutes,
    domain: 'checkout',
    comment: 'Order management routes',
  },
  {
    path: '/api/fulfillment',
    router: fulfillmentRoutes,
    domain: 'checkout',
    comment: 'Fulfillment coordination routes',
  },
  {
    path: '/api/customers',
    router: customerRoutes,
    domain: 'customer',
    comment: 'Customer management routes',
  },
  {
    path: '/api/customer-auth',
    router: customerAuthRoutes,
    domain: 'customer',
    comment: 'Customer authentication routes',
  },
  {
    path: '/api/customer-auth-token',
    router: customerAuthTokenRoutes,
    domain: 'customer',
    comment: 'Customer auth token fallback routes',
  },
  {
    path: '/api/customer-addresses',
    router: customerAddressesRoutes,
    domain: 'customer',
    comment: 'Customer addresses routes',
  },
  {
    path: '/api/customer-notifications',
    router: customerNotificationsRoutes,
    domain: 'customer',
    comment: 'Customer notifications routes',
  },
  {
    path: '/api/customer-payment-methods',
    router: customerPaymentMethodsRoutes,
    domain: 'customer',
    comment: 'Customer payment methods routes',
  },
  {
    path: '/api/debug-cookies',
    router: debugCookiesRoutes,
    domain: 'misc',
    comment: 'Debug cookies route',
  },

  // ── POS Integrations ─────────────────────────────────────────────────
  {
    path: '/api/integrations',
    router: cloverRoutes,
    domain: 'integration',
    comment: 'Clover POS integration',
  },
  {
    path: '/api/integrations',
    router: squareRoutes,
    domain: 'integration',
    comment: 'Square POS integration',
  },

  // ── OAuth Integrations ───────────────────────────────────────────────
  {
    path: '/api',
    router: googleBusinessOAuthRoutes,
    domain: 'integration',
    comment: 'Google Business Profile OAuth at /api/google/business',
  },
  {
    path: '/auth',
    router: googleBusinessOAuthRoutes,
    domain: 'integration',
    comment: 'Google Business Profile OAuth callback at /auth/google/business (matches GOOGLE_BUSINESS_REDIRECT_URI)',
  },
  {
    path: '/api',
    router: googleMerchantOAuthRoutes,
    domain: 'integration',
    comment: 'Google Merchant Center OAuth at /api/google/oauth',
  },
  {
    path: '/api',
    router: metaOAuthRoutes,
    domain: 'integration',
    comment: 'Meta Commerce OAuth at /api/meta/oauth',
  },
  {
    path: '/api',
    router: metaWebhookRoutes,
    domain: 'integration',
    comment: 'Meta Commerce webhooks at /api/meta/webhooks',
  },
  {
    path: '/api',
    router: tiktokOAuthRoutes,
    domain: 'integration',
    comment: 'TikTok Shop OAuth at /api/tiktok/oauth',
  },
  {
    path: '/api',
    router: tiktokWebhookRoutes,
    domain: 'integration',
    comment: 'TikTok Shop webhooks at /api/tiktok/webhooks',
  },
  {
    path: '/api/oauth',
    router: oauthRoutes,
    domain: 'integration',
    comment: 'OAuth routes (PayPal & Square payment gateway OAuth)',
  },

  // ── Social ───────────────────────────────────────────────────────────
  {
    path: '/api',
    router: socialProofRoutes,
    domain: 'social',
    comment: 'Social Proof / UGC at /api/public/social-proof',
  },
  {
    path: '/api/tenants',
    router: socialProofRoutes,
    domain: 'social',
    comment: 'Social Proof / UGC at /api/tenants/:tenantId/social-proof',
  },
  {
    path: '/api',
    router: shippingRateRoutes,
    domain: 'social',
    comment: 'Shipping rates at /api/shipping/rates',
  },
  {
    path: '/api',
    router: returnsRoutes,
    domain: 'social',
    comment: 'Returns portal at /api/public/returns',
  },
  {
    path: '/api/tenants',
    router: returnsRoutes,
    domain: 'social',
    comment: 'Returns portal at /api/tenants/:tenantId/returns',
  },
  {
    path: '/api',
    router: socialPixelRoutes,
    domain: 'social',
    comment: 'Social Pixels at /api/social-pixels',
  },

  // ── Store reviews ────────────────────────────────────────────────────
  {
    path: '/api/stores',
    router: storeReviewsRoutes,
    domain: 'misc',
    comment: 'Store reviews at /api/stores',
  },
  {
    path: '/api',
    router: storeReviewsRoutes,
    domain: 'misc',
    comment: 'Store reviews also at /api for helpful votes endpoint',
  },

  // ── Queue ────────────────────────────────────────────────────────────
  {
    path: '/api/queue',
    router: queueRoutes,
    domain: 'misc',
    comment: 'Product queue routes',
  },

  // ── Subscription billing ─────────────────────────────────────────────
  {
    path: '/api/subscription',
    router: subscriptionBillingRoutes,
    domain: 'billing',
    comment: 'Subscription billing routes',
  },

  // ── Stripe webhooks (late mount) ─────────────────────────────────────
  {
    path: '/api/webhooks/stripe',
    router: stripeWebhookRoutes,
    domain: 'pre-middleware',
    comment: 'Stripe webhook routes (late mount)',
  },

  // ── Badges ───────────────────────────────────────────────────────────
  {
    path: '/api',
    router: badgeRegistryRoutes,
    domain: 'misc',
    comment: 'Badge registry at /api/public/badge-registry and /api/tenants/:tenantId/badge-registry',
  },
  {
    path: '/api',
    router: badgeAnalyticsRoutes,
    domain: 'misc',
    comment: 'Badge analytics at /api/tenants/:tenantId/badge-analytics and /api/public/badge-events',
  },

  // ── Permissions ──────────────────────────────────────────────────────
  {
    path: '/api/permissions',
    router: permissionRoutes,
    domain: 'security',
    comment: 'Permissions routes',
  },

  // ── Admin routes ─────────────────────────────────────────────────────
  {
    path: '/api/tier-config',
    router: tierConfigRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    comment: 'Tier config routes (tenant-accessible)',
  },
  {
    path: '/api/admin/tier-system',
    router: tierSystemRoutes,
    middleware: [authenticateToken, requireAdmin],
    domain: 'admin',
    comment: 'Admin tier system routes',
  },
  {
    path: '/api/admin/capabilities',
    router: capabilityRoutes,
    middleware: [authenticateToken, requireAdmin],
    domain: 'admin',
    comment: 'Admin capabilities routes',
  },
  {
    path: '/api/admin/tiers',
    router: tierManagementRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    comment: 'Admin tier management routes',
  },
  {
    path: '/api/admin/scan-metrics',
    router: scanMetricsRoutes,
    domain: 'admin',
    comment: 'Admin scan metrics routes',
  },
  {
    path: '/api/admin/cached-products',
    router: cachedProductsRoutes,
    domain: 'admin',
    comment: 'Admin cached products routes',
  },
  {
    path: '/api/admin/users',
    router: adminUsersRoutes,
    middleware: [authenticateToken, requireAdmin],
    domain: 'admin',
    comment: 'Admin users routes',
  },
  {
    path: '/api/admin/tools',
    router: adminToolsRoutes,
    middleware: [authenticateToken, requireAdmin],
    domain: 'admin',
    comment: 'Admin tools routes',
  },
  {
    path: '/api/admin/sentry',
    router: sentryRoutes,
    middleware: [authenticateToken, requireAdmin],
    domain: 'admin',
    comment: 'Admin sentry routes',
  },
  {
    path: '/api/admin/errors',
    router: errorLogRoutes,
    middleware: [authenticateToken, requireAdmin],
    domain: 'admin',
    comment: 'Admin error log routes',
  },
  {
    path: '/api/admin/manual-billing',
    router: manualBillingRoutes,
    domain: 'admin',
    comment: 'Admin manual billing routes',
  },
  {
    path: '/api/admin/platform-revenue',
    router: platformRevenueRoutes,
    domain: 'admin',
    comment: 'Admin platform revenue routes',
  },
  {
    path: '/api/admin/platform-fee-invoices',
    router: platformFeeInvoiceRoutes,
    domain: 'admin',
    comment: 'Platform fee invoice routes',
  },
  {
    path: '/api/admin/notification-logs',
    router: notificationLogsRoutes,
    domain: 'admin',
    comment: 'Admin notification logs routes',
  },
  {
    path: '/api/admin/inventory-transfers',
    router: adminInventoryTransferRoutes,
    domain: 'admin',
    comment: 'Admin inventory transfer routes',
  },
  {
    path: '/api/admin/slug-registry',
    router: adminSlugRegistryRoutes,
    domain: 'admin',
    comment: 'Admin slug registry routes',
  },
  {
    path: '/api/admin/catalog',
    router: adminCatalogRoutes,
    domain: 'admin',
    comment: 'Admin catalog routes',
  },
  {
    path: '/api/admin/inventory',
    router: adminInventoryStatsRoutes,
    domain: 'admin',
    comment: 'Admin inventory stats routes',
  },
  {
    path: '/api/admin/google-product-taxonomy',
    router: googleProductTaxonomyRoutes,
    domain: 'admin',
    comment: 'Google Product Taxonomy routes',
  },
  {
    path: '/api/admin/demo-tenants',
    router: adminDemoTenantRoutes,
    domain: 'admin',
    comment: 'Admin demo tenant routes',
  },
  {
    path: '/api/admin/performance',
    router: performanceApi,
    domain: 'admin',
    comment: 'Performance routes',
  },

  // ── Singleton system routes ──────────────────────────────────────────
  {
    path: '/api/categories-singleton',
    router: categoriesSingletonRoutes,
    middleware: [authenticateToken],
    domain: 'singleton',
    comment: 'Categories routes (UniversalSingleton)',
  },
  {
    path: '/api/shop-management',
    router: shopManagementRoutes,
    middleware: [authenticateToken],
    domain: 'singleton',
    comment: 'Shop Management routes (Real Database Service)',
  },
  {
    path: '/api/gbp-advanced-sync-singleton',
    router: gbpAdvancedSyncSingletonRoutes,
    domain: 'singleton',
    comment: 'GBP Advanced Sync singleton',
  },
  {
    path: '/api/gmc-product-sync-singleton',
    router: gmcProductSyncSingletonRoutes,
    domain: 'singleton',
    comment: 'GMC Product Sync singleton',
  },
  {
    path: '/api/clover-oauth-singleton',
    router: cloverOAuthSingletonRoutes,
    domain: 'singleton',
    comment: 'Clover OAuth singleton',
  },
  {
    path: '/api/oauth-singleton',
    router: oauthSingletonRoutes,
    domain: 'singleton',
    comment: 'OAuth singleton',
  },
  {
    path: '/api/refund-singleton',
    router: refundSingletonRoutes,
    domain: 'singleton',
    comment: 'Refund singleton',
  },
  {
    path: '/api/taxonomy-sync-singleton',
    router: taxonomySyncSingletonRoutes,
    domain: 'singleton',
    comment: 'Taxonomy sync singleton',
  },
  {
    path: '/api/gbp-sync-tracking-singleton',
    router: gbpSyncTrackingSingletonRoutes,
    domain: 'singleton',
    comment: 'GBP sync tracking singleton',
  },
  {
    path: '/api/recommendation-singleton',
    router: recommendationSingletonRoutes,
    domain: 'singleton',
    comment: 'Recommendation singleton',
  },
  {
    path: '/api/gbp-category-sync-singleton',
    router: gbpCategorySyncSingletonRoutes,
    domain: 'singleton',
    comment: 'GBP category sync singleton',
  },
  {
    path: '/api/barcode-enrichment-singleton',
    router: barcodeEnrichmentSingletonRoutes,
    domain: 'singleton',
    comment: 'Barcode enrichment singleton',
  },
  {
    path: '/api/digital-asset-singleton',
    router: digitalAssetSingletonRoutes,
    domain: 'singleton',
    comment: 'Digital asset singleton',
  },
  {
    path: '/api/product-cache-singleton',
    router: productCacheSingletonRoutes,
    domain: 'singleton',
    comment: 'Product cache singleton',
  },
  {
    path: '/api/ai-image-singleton',
    router: aiImageSingletonRoutes,
    domain: 'singleton',
    comment: 'AI image singleton',
  },
  {
    path: '/api/reviews-singleton',
    router: reviewsSingletonRoutes,
    domain: 'singleton',
    comment: 'Reviews singleton',
  },

  // ── Inline handler routes (extracted from index.ts) ──────────────────
  {
    path: '/',
    router: inlineTenantRoutes,
    domain: 'tenant',
    comment: 'Inline tenant CRUD, status, coordinates, subdomains, business hours',
  },
  {
    path: '/',
    router: inlineTenantProfileRoutes,
    domain: 'tenant',
    comment: 'Inline tenant profile, GBP category, public tenant endpoints, categories, diagnostics',
  },
  {
    path: '/',
    router: inlineItemsRoutes,
    domain: 'items',
    comment: 'Inline items/complete, item update, category assignment, needs-enrichment',
  },
  {
    path: '/',
    router: inlineTaxonomyRoutes,
    domain: 'admin',
    comment: 'Inline taxonomy admin status and sync endpoints',
  },

  // ── Email config (inline) ────────────────────────────────────────────
  {
    path: '/',
    router: inlineEmailConfigRoutes,
    domain: 'admin',
    comment: 'Email config GET/PUT',
  },

  // ── Directory inline handlers ────────────────────────────────────────
  {
    path: '/',
    router: inlineDirectoryRoutes,
    domain: 'directory',
    comment: 'Directory simple-test, store-types test, store-types',
  },

  // ── Google OAuth inline handlers ─────────────────────────────────────
  {
    path: '/',
    router: inlineGoogleOAuthRoutes,
    domain: 'integration',
    comment: 'Google OAuth auth/callback',
  },

  
  // â”€â”€ Tenant upload (inline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    path: '/',
    router: inlineTenantUploadRoutes,
    domain: 'tenant',
    comment: 'Features showcase config, PATCH tenant profile, logo/banner upload',
  },

  // â”€â”€ Items CRUD (inline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    path: '/',
    router: inlineItemsCrudRoutes,
    domain: 'inventory',
    comment: 'Items list, stats, get, create, update, delete, restore, purge, photo upload',
  },
  // ── Misc (health, ping, routes listing, jobs) ────────────────────────
  {
    path: '/',
    router: inlineMiscRoutes,
    domain: 'infrastructure',
    comment: 'Health, ping, __routes, and jobs endpoints',
  },
];

// ─── Mount Function ────────────────────────────────────────────────────────

/**
 * Mount all routes from the registry onto the Express app.
 * Routes are mounted in the order they appear in the registry array.
 * Pre-middleware routes are mounted first (before JSON parsing).
 */
export function mountFromRegistry(app: Express): void {
  const preMiddlewareRoutes = routeRegistry.filter(r => r.preMiddleware);
  const regularRoutes = routeRegistry.filter(r => !r.preMiddleware);

  // Mount pre-middleware routes first
  for (const entry of preMiddlewareRoutes) {
    try {
      if (entry.middleware && entry.middleware.length > 0) {
        app.use(entry.path, ...entry.middleware, entry.router);
      } else {
        app.use(entry.path, entry.router);
      }
      console.log(`✅ [Registry] ${entry.domain}: ${entry.path} - ${entry.comment || ''}`);
    } catch (error) {
      console.error(`❌ [Registry] Failed to mount ${entry.path} (${entry.domain}):`, error);
    }
  }

  // Mount regular routes in order
  for (const entry of regularRoutes) {
    try {
      if (entry.middleware && entry.middleware.length > 0) {
        app.use(entry.path, ...entry.middleware, entry.router);
      } else {
        app.use(entry.path, entry.router);
      }
      console.log(`✅ [Registry] ${entry.domain}: ${entry.path} - ${entry.comment || ''}`);
    } catch (error) {
      console.error(`❌ [Registry] Failed to mount ${entry.path} (${entry.domain}):`, error);
    }
  }

  console.log(`✅ [Registry] All ${routeRegistry.length} route entries mounted (${preMiddlewareRoutes.length} pre-middleware, ${regularRoutes.length} regular)`);
}

/**
 * Get a summary of the route registry for debugging and verification.
 */
export function getRouteRegistrySummary(): { domain: string; count: number; paths: string[] }[] {
  const domains = new Map<string, string[]>();

  for (const entry of routeRegistry) {
    const existing = domains.get(entry.domain) || [];
    existing.push(entry.path);
    domains.set(entry.domain, existing);
  }

  return Array.from(domains.entries()).map(([domain, paths]) => ({
    domain,
    count: paths.length,
    paths,
  }));
}
