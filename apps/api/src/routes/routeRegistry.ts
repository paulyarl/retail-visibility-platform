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
import faireWebhookRoutes from '../routes/webhooks/faire';

// Infrastructure
import cacheMonitoringRoutes from '../routes/cache-monitoring';
import cacheInvalidationRoutes from '../routes/cache-invalidation';
import cacheRoutes from '../routes/cache';
import publicApiRoutes from '../routes/public-catalog';
import platformDashboardRoutes from '../routes/platform-dashboard';

// Tenant
import universalTenantsRoutes from '../routes/universal-tenants';
import tenantOrchestrator from '../routes/tenant.routes';
import publicTenantCapabilities from '../routes/public-tenant-capabilities';
import adminOrchestrator from '../routes/admin.routes';
import tenantCategoriesRoutes from '../routes/tenant-categories';
import tenantInventoryTransferRoutes from '../routes/tenant-inventory-transfers';

// Items / Products
import variantsRoutes from '../routes/variants';
import photosRouter from '../photos';
import productLikesRoutes from '../routes/product-likes';
import productFeaturingRoutes from '../routes/product-featuring';
import productCacheSingletonRoutes from '../routes/product-cache-singleton';

// Directory
import directoryOrchestrator from '../routes/directory.routes';
import directoryOptimizedRoutes from '../routes/directory-optimized';
import slugGenerationRoutes from '../routes/slug-generation';

// Shops (public shop directory browsing)
import shopsRoutes from '../routes/shops';

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
import orderManagementRoutes from '../routes/order-management';
import fulfillmentRoutes from '../routes/fulfillment';

// Admin (individual admin route imports now in admin.routes.ts orchestrator)
// These imports are kept because they're also used at non-admin paths:
import scanMetricsRoutes from '../routes/scan-metrics';
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
import featuredOptionsSettingsRoutes from '../routes/featured-options-settings';
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
import paymentGatewaySettingsRoutes from '../routes/payment-gateway-settings';
import organizationCommerceSettingsRoutes from '../routes/organization-commerce-settings';

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
import feedValidationRoutes from '../routes/feed-validation';
import businessProfileValidationRoutes from '../routes/business-profile-validation';
import quickStartRoutes from '../routes/quick-start';
import recommendationRoutes from '../routes/recommendations';
import cloneRoutes from '../routes/clone';
import queueRoutes from '../routes/queue-routes';
import subscriptionBillingRoutes from '../routes/subscription-billing';
import stripeWebhookRoutes from '../routes/stripe-webhook';
import storeReviewsRoutes from '../routes/store-reviews';
import brandPartnersRoutes from '../routes/brand-partners';
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

// ─── Routes from mount files (being consolidated) ─────────────────────────

// Auth mounts
import authRoutes from '../auth/auth.routes';
import onboardingRoutes from '../routes/onboarding';

// Core mounts
import auditRoutes from '../routes/audit';
import policyRoutes from '../routes/policy';
import subscriptionRoutes from '../routes/subscriptions';
import categoryRoutes from '../routes/categories';
import userRoutes from '../routes/users';
import platformStatsRoutes from '../routes/platform-stats';
import businessHoursRoutes from '../routes/business-hours';
import taxonomyRoutes from '../routes/taxonomy';
import analyticsRoutes from '../routes/analytics';
import shopCategoriesRoutes from '../routes/shop-categories';
import tenantLogoRoutes from '../routes/tenant-logo';
import globalCatalogRoutes from '../routes/global-catalog';
import catalogSlugsRoutes from '../routes/catalog-slugs';
import catalogAdoptionRoutes from '../routes/catalog-adoption';
import locationAvailabilityRoutes from '../routes/location-availability';
import crossTenantProductsRoutes from '../routes/cross-tenant-products';
import digitalDownloadsRoutes from '../routes/digital-downloads';
import crmTenantRoutes from '../routes/crm/tenant/crm-tenant';
import crmCustomerRoutes from '../routes/crm/customer/crm-customer';
import tenantSupplierRoutes from '../routes/tenant/suppliers';
import brandingRoutes from '../routes/branding';
import tenantTierRoutes, { publicTenantRouter as tenantTierPublicRouter } from '../routes/tenant-tier';

// Dashboard mounts
import dashboardRoutes from '../routes/dashboard';
import dashboardConsolidatedRoutes from '../routes/dashboard-consolidated';
import promotionRoutes from '../routes/promotion';
import tenantLimitsRoutes from '../routes/tenant-limits';
import feedJobsRoutes from '../routes/feed-jobs';
import feedbackRoutes from '../routes/feedback';
import cacheStatsRoutes from '../routes/cache-stats';
import categoriesPlatformRoutes from '../routes/categories.platform';
import categoriesTenantRoutes from '../routes/categories.tenant';
import categoriesMirrorRoutes from '../routes/categories.mirror';
import mirrorAdminRoutes from '../routes/mirror.admin';
import syncLogsRoutes from '../routes/sync-logs';

// Admin mounts (individual admin route imports now in admin.routes.ts orchestrator)
// These imports are kept because they're used at /admin (non-api) paths:
import securityRoutes from '../routes/security';
import tenantFlagsRoutes from '../routes/tenant-flags';
import platformFlagsRoutes from '../routes/platform-flags';
import effectiveFlagsRoutes from '../routes/effective-flags';
import adminUsersRoutes from '../routes/admin-users';

// Integration mounts
import emailTestRoutes from '../routes/email-test';
import testGbpRoutes from '../routes/test-gbp';

// Directory mounts (routes at other paths — not part of the /api/directory orchestrator)
import directoryAdminRoutes from '../routes/directory-admin';
import directorySupportRoutes from '../routes/directory-support';

// Middleware (extended with checkTenantAccess, authenticateCustomer, auditLogger)
import { authenticateToken, requireAdmin, checkTenantAccess, authenticateCustomer } from '../middleware/auth';
import { auditLogger } from '../middleware/audit-logger';

// ─── Registry Types ────────────────────────────────────────────────────────

export type AuthLevel = 'public' | 'tenant' | 'admin' | 'webhook';

export interface RouteEntry {
  path: string;
  router: any;
  middleware?: any[];
  domain: string;
  authLevel: AuthLevel;
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
    authLevel: 'public',
    comment: 'Mounted BEFORE auth middleware (errors can occur pre-login)',
    preMiddleware: true,
  },
  {
    path: '/api/webhooks',
    router: webhooksRoutes,
    domain: 'pre-middleware',
    authLevel: 'webhook',
    comment: 'Webhooks MUST be mounted BEFORE JSON parsing for Stripe signature verification',
    preMiddleware: true,
  },
  {
    path: '/api/webhooks/stripe-connect',
    router: stripeConnectWebhooks,
    domain: 'pre-middleware',
    authLevel: 'webhook',
    comment: 'Stripe Connect webhooks - requires raw body',
    preMiddleware: true,
  },
  {
    path: '/api/webhooks/faire',
    router: faireWebhookRoutes,
    domain: 'pre-middleware',
    authLevel: 'webhook',
    comment: 'Faire webhook - requires raw body for signature verification',
    preMiddleware: true,
  },

  // ── Infrastructure ────────────────────────────────────────────────────
  {
    path: '/api/admin',
    router: adminOrchestrator,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Admin orchestrator — mounts all admin sub-routers in strict order (specific sub-paths before generic root mounts)',
  },
  {
    path: '/api',
    router: universalTenantsRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Universal tenant routes (Phase 3: Universal Identifier System)',
  },
  {
    path: '/api/cache',
    router: cacheMonitoringRoutes,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Cache monitoring (Phase 1: Encrypted Cache System)',
  },
  {
    path: '/api/cache',
    router: cacheInvalidationRoutes,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Cache invalidation (Cache Management)',
  },
  {
    path: '/api/public',
    router: publicApiRoutes,
    domain: 'public',
    authLevel: 'public',
    comment: 'Public API routes (Singleton System)',
  },
  {
    path: '/api/public/tenants',
    router: publicTenantCapabilities,
    domain: 'public',
    authLevel: 'public',
    comment: 'Public tenant capabilities (resolve, capabilities, effective-capabilities summary) per AUTH_SCOPE_ISOLATION_SPEC.md',
  },

  // ── Shops (public shop browsing — must be before /api/directory to avoid catch-all) ──
  {
    path: '/api/shops',
    router: shopsRoutes,
    domain: 'shops',
    authLevel: 'public',
    comment: 'Public shop directory, trending, categories, featured products, shop details',
  },

  // ── Directory (orchestrator handles all /api/directory sub-routes) ───
  {
    path: '/api/directory',
    router: directoryOrchestrator,
    domain: 'directory',
    authLevel: 'public',
    comment: 'Directory orchestrator — mounts all sub-routers in strict static-first order',
  },
  {
    path: '/api/directory-optimized',
    router: directoryOptimizedRoutes,
    domain: 'directory',
    authLevel: 'public',
    comment: 'Directory optimized (materialized view - 6.7x faster)',
  },
  {
    path: '/api/slugs',
    router: slugGenerationRoutes,
    domain: 'directory',
    authLevel: 'public',
    comment: 'Slug generation (Platform Standard - SlugSingletonService)',
  },

  // ── Public routes (must be before authenticated catch-alls) ──────────
  {
    path: '/api/recommendations',
    router: recommendationRoutes,
    domain: 'public',
    authLevel: 'public',
    comment: 'Recommendation routes (MVP recommendation system - PUBLIC)',
  },

  // ── Variants & Scan ──────────────────────────────────────────────────
  {
    path: '/api',
    router: variantsRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Product variants routes (auth applied per-route)',
  },
  {
    path: '/api',
    router: scanRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'M4: SKU Scanning routes',
  },

  // ── Storefront ───────────────────────────────────────────────────────
  {
    path: '/api/storefront',
    router: storefrontFeaturedRoutes,
    domain: 'storefront',
    authLevel: 'public',
    comment: 'Storefront featured products (MV optimized)',
  },
  {
    path: '/api/storefront',
    router: storefrontRoutes,
    domain: 'storefront',
    authLevel: 'public',
    comment: 'Storefront routes (materialized view for instant category filtering)',
  },

  // ── Featured products ────────────────────────────────────────────────
  {
    path: '/api/featured-products',
    router: featuredProductsScoredRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Featured products with quality scoring',
  },
  {
    path: '/api/featured-products-singleton',
    router: featuredProductsSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Featured products singleton',
  },
  {
    path: '/api',
    router: activeFeaturedRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Active featured resolver',
  },
  {
    path: '/api/public/tenants/:tenantId',
    router: activeFeaturedPublicRouter,
    domain: 'public',
    authLevel: 'public',
    comment: 'Active featured resolver (public tenant router)',
  },
  {
    path: '/api',
    router: featuredPlacementRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Featured placement (monetization)',
  },
  {
    path: '/api',
    router: productFeaturingRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Product featuring routes',
  },

  // ── Checkout & Orders ────────────────────────────────────────────────
  {
    path: '/api/checkout',
    router: checkoutRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Checkout routes (Guest)',
  },
  {
    path: '/api/checkout',
    router: checkoutPaymentsRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Checkout payments',
  },
  {
    path: '/api/checkout/paypal',
    router: paypalRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'PayPal checkout',
  },
  {
    path: '/api/checkout/square',
    router: squareCheckoutRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Square checkout',
  },
  {
    path: '/api/checkout/stripe',
    router: stripeCheckoutRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Stripe checkout',
  },
  {
    path: '/api/deposit-forfeiture',
    router: depositForfeitureRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Deposit forfeiture',
  },
  {
    path: '/api/orders',
    router: buyerOrdersRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Buyer orders (Public - No Auth)',
  },
  {
    path: '/api/orders',
    router: ordersRoutes,
    middleware: [authenticateToken],
    domain: 'checkout',
    authLevel: 'tenant',
    comment: 'Orders (Phase 3A: Order Management Foundation)',
  },
  {
    path: '/api/shopping-carts',
    router: shoppingCartsRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Shopping carts (Phase 3C: Database-Persisted Carts)',
  },
  {
    path: '/api/payments',
    router: paymentsRoutes,
    middleware: [authenticateToken],
    domain: 'checkout',
    authLevel: 'tenant',
    comment: 'Payments (Phase 3B: Payment Processing)',
  },
  {
    path: '/api/orders',
    router: paymentsRoutes,
    middleware: [authenticateToken],
    domain: 'checkout',
    authLevel: 'tenant',
    comment: 'Payments also mounted at /api/orders',
  },

  // ── GBP ──────────────────────────────────────────────────────────────
  {
    path: '/api/gbp',
    router: gbpRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'GBP routes (Google Business Profile category search)',
  },
  {
    path: '/api',
    router: inlineGbpCategoriesRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'GBP categories inline handlers (popular + search)',
  },

  // ── Platform Dashboard ─────────────────────────────────────────────
  {
    path: '/api/platform',
    router: platformDashboardRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Platform dashboard at /api/platform/dashboard and /api/platform/stats',
  },

  // ── Tenants (orchestrator handles all /api/tenants sub-routes) ──────
  {
    path: '/api',
    router: platformSettingsRoutes,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Platform settings at /api/platform-settings',
  },
  {
    path: '/api/tenants',
    router: tenantOrchestrator,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Tenant orchestrator — mounts all tenant sub-routers in strict order (sub-resources before /:id)',
  },
  // ── Settings (public endpoints at /api) ──────────────────────────────
  {
    path: '/api',
    router: fulfillmentSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Fulfillment settings public at /api/public/tenant/:tenantId/fulfillment-settings',
  },
  {
    path: '/api',
    router: commerceSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Commerce settings public at /api/public/tenant/:tenantId/commerce-settings',
  },
  {
    path: '/api/tax',
    router: taxRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Tax engine at /api/tax/calculate',
  },
  {
    path: '/api',
    router: featuredOptionsSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Featured options public at /api/public/tenant/:tenantId/featured-options',
  },
  {
    path: '/api',
    router: storefrontTypeSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Storefront type public at /api/public/tenant/:tenantId/storefront-type',
  },
  {
    path: '/api',
    router: productTypeSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Product type public at /api/public/tenant/:tenantId/product-type',
  },
  {
    path: '/api',
    router: storefrontPolicyRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Storefront policies public at /api/public/storefront-policies/:tenantId',
  },
  {
    path: '/api',
    router: policyTemplateRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Policy templates at /api/public/policy-templates, /api/tenants/:tenantId/storefront-policies/templates, and /api/admin/policy-templates',
  },
  {
    path: '/api',
    router: faqOptionsSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'FAQ options public at /api/public/tenant/:tenantId/faq-options',
  },
  {
    path: '/api',
    router: crmOptionsSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'CRM options public at /api/public/tenant/:tenantId/crm-options',
  },
  {
    path: '/api',
    router: socialCommerceOptionsSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Social commerce options public',
  },
  {
    path: '/api',
    router: chatbotOptionsSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Chatbot options public at /api/public/tenant/:tenantId/chatbot-options',
  },
  {
    path: '/api/public/bot',
    router: botPublicRoutes,
    domain: 'social',
    authLevel: 'public',
    comment: 'Bot public routes at /api/public/bot/*',
  },
  {
    path: '/api/tenants/:tenantId/bot',
    router: botMerchantRoutes,
    middleware: [authenticateToken],
    domain: 'social',
    authLevel: 'tenant',
    comment: 'Bot merchant routes at /api/tenants/:tenantId/bot/*',
  },
  {
    path: '/api',
    router: paymentGatewaySettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Payment gateway settings public at /api/public/tenant/:tenantId/payment-gateway-settings',
  },
  {
    path: '/api/organizations',
    router: organizationCommerceSettingsRoutes,
    domain: 'settings',
    authLevel: 'tenant',
    comment: 'Organization commerce settings at /api/organizations/:organizationId/commerce-settings',
  },
  {
    path: '/api',
    router: organizationCommerceSettingsRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Organization commerce settings public',
  },

  // ── Billing ──────────────────────────────────────────────────────────
  {
    path: '/api',
    router: billingRoutes,
    domain: 'billing',
    authLevel: 'public',
    comment: 'Billing routes at /api/billing',
  },

  // ── Rate Limit Warnings ─────────────────────────────────────────────
  {
    path: '/api',
    router: rateLimitWarningsRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Rate limit warning tracking at /api/rate-limit-warnings',
  },

  // ── Orders (tenant-scoped) ───────────────────────────────────────────
  {
    path: '/api',
    router: tenantOrdersRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Tenant orders at /api/tenants/:tenantId/orders',
  },
  {
    path: '/api/tenants/:tenantId/shipments',
    router: shipmentRoutes,
    domain: 'checkout',
    authLevel: 'tenant',
    comment: 'Shipments at /api/tenants/:tenantId/shipments',
  },
  {
    path: '/api/tenant/inventory-transfers',
    router: tenantInventoryTransferRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Tenant inventory transfers (auth temporarily removed for testing)',
  },
  {
    path: '/api/tenant',
    router: feedValidationRoutes,
    middleware: [authenticateToken],
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Feed validation - must be BEFORE tenantCategoriesRoutes to avoid /:tenantId/categories/:id matching /coverage',
  },

  // ── Auth & RBAC (inline handlers extracted) ──────────────────────────
  {
    path: '/',
    router: inlineAuthRbacRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Auth RBAC endpoints (role-groups, user-groups, permissions, user-access, role-protected routes)',
  },

  // ── Tenant categories ────────────────────────────────────────────────
  {
    path: '/api/tenant',
    router: tenantCategoriesRoutes,
    middleware: [authenticateToken],
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Tenant categories (GBP)',
  },

  // ── Products & Photos ────────────────────────────────────────────────
  {
    path: '/api/products',
    router: productLikesRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Product likes routes',
  },
  {
    path: '/api/tenants/:tenantId/faqs',
    router: faqRoutes,
    domain: 'items',
    authLevel: 'tenant',
    comment: 'FAQ routes (merchant)',
  },
  {
    path: '/api/public/tenants/:tenantId',
    router: faqPublicRoutes,
    domain: 'public',
    authLevel: 'public',
    comment: 'FAQ public routes at /api/public/tenants/:tenantId/faqs',
  },
  {
    path: '/api/items',
    router: photosRouter,
    domain: 'items',
    authLevel: 'public',
    comment: 'Photos routes at /api/items',
  },

  // ── Cache ────────────────────────────────────────────────────────────
  {
    path: '/api/cache',
    router: cacheRoutes,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Cache routes',
  },

  // ── Compliance ───────────────────────────────────────────────────────
  {
    path: '/api/gdpr',
    router: gdprRoutes,
    domain: 'compliance',
    authLevel: 'public',
    comment: 'GDPR compliance (data export, consent management)',
  },
  {
    path: '/api/gdpr',
    router: accountDeletionRoutes,
    domain: 'compliance',
    authLevel: 'public',
    comment: 'Account deletion requests (30-day grace period)',
  },
  {
    path: '/api',
    router: accountDeletionRoutes,
    domain: 'compliance',
    authLevel: 'public',
    comment: 'Account deletion also at /api',
  },
  {
    path: '/api/ccpa',
    router: ccpaRoutes,
    domain: 'compliance',
    authLevel: 'public',
    comment: 'CCPA compliance (opt-out-sale, data categories)',
  },

  // ── MFA & Security ───────────────────────────────────────────────────
  {
    path: '/api/auth/mfa',
    router: mfaRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'MFA routes (two-factor authentication)',
  },
  {
    path: '/api/auth0-mfa',
    router: auth0MFARoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Auth0 MFA routes (custom UI + Auth0 backend)',
  },
  {
    path: '/api/auth',
    router: authSyncRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Auth0 sync routes at /api/auth/sync-user',
  },
  {
    path: '/api/auth',
    router: authSessionsRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Security sessions at /api/auth/sessions',
  },
  {
    path: '/api/security/telemetry',
    router: securityTelemetryRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Security telemetry (no auth required) - mounted first',
  },
  {
    path: '/api/security',
    router: securityAlertsRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Security alerts at /api/security/security-alerts',
  },
  // ── Clone ────────────────────────────────────────────────────────────
  {
    path: '/api/clone',
    router: cloneRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Clone routes (product & category cloning)',
  },

  // ── Organizations ────────────────────────────────────────────────────
  {
    path: '/api/upgrade-requests',
    router: upgradeRequestsRoutes,
    domain: 'organization',
    authLevel: 'public',
    comment: 'Upgrade requests',
  },
  {
    path: '/api/organization-requests',
    router: organizationRequestRoutes,
    domain: 'organization',
    authLevel: 'public',
    comment: 'Organization requests',
  },
  {
    path: '/organizations',
    router: organizationRoutes,
    domain: 'organization',
    authLevel: 'public',
    comment: 'Organizations routes (no auth at /organizations)',
  },
  {
    path: '/api/organizations',
    router: organizationRoutes,
    middleware: [authenticateToken],
    domain: 'organization',
    authLevel: 'tenant',
    comment: 'Organizations routes (with authentication at /api/organizations)',
  },
  {
    path: '/api/organizations',
    router: organizationCapabilitiesRoutes,
    domain: 'organization',
    authLevel: 'tenant',
    comment: 'Organization capabilities at /api/organizations/:orgId/effective-capabilities',
  },
  {
    path: '/api/organizations',
    router: organizationUserRoutes,
    domain: 'organization',
    authLevel: 'tenant',
    comment: 'Organization users at /api/organizations/:orgId/users',
  },

  // ── Misc endpoints ───────────────────────────────────────────────────
  {
    path: '/api/hero-location',
    router: heroLocationRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Hero location routes',
  },
  {
    path: '/api/order-management',
    router: orderManagementRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Order management routes',
  },
  {
    path: '/api/fulfillment',
    router: fulfillmentRoutes,
    domain: 'checkout',
    authLevel: 'public',
    comment: 'Fulfillment coordination routes',
  },
  {
    path: '/api/customers',
    router: customerRoutes,
    domain: 'customer',
    authLevel: 'public',
    comment: 'Customer management routes',
  },
  {
    path: '/api/customer-auth',
    router: customerAuthRoutes,
    domain: 'customer',
    authLevel: 'public',
    comment: 'Customer authentication routes',
  },
  {
    path: '/api/customer-auth-token',
    router: customerAuthTokenRoutes,
    domain: 'customer',
    authLevel: 'public',
    comment: 'Customer auth token fallback routes',
  },
  {
    path: '/api/customer-addresses',
    router: customerAddressesRoutes,
    domain: 'customer',
    authLevel: 'public',
    comment: 'Customer addresses routes',
  },
  {
    path: '/api/customer-notifications',
    router: customerNotificationsRoutes,
    domain: 'customer',
    authLevel: 'public',
    comment: 'Customer notifications routes',
  },
  {
    path: '/api/customer-payment-methods',
    router: customerPaymentMethodsRoutes,
    domain: 'customer',
    authLevel: 'public',
    comment: 'Customer payment methods routes',
  },
  {
    path: '/api/debug-cookies',
    router: debugCookiesRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Debug cookies route',
  },

  // ── POS Integrations ─────────────────────────────────────────────────
  {
    path: '/api/integrations',
    router: cloverRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Clover POS integration',
  },
  {
    path: '/api/integrations',
    router: squareRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Square POS integration',
  },

  // ── OAuth Integrations ───────────────────────────────────────────────
  {
    path: '/api',
    router: googleBusinessOAuthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Google Business Profile OAuth at /api/google/business',
  },
  {
    path: '/auth',
    router: googleBusinessOAuthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Google Business Profile OAuth callback at /auth/google/business (matches GOOGLE_BUSINESS_REDIRECT_URI)',
  },
  {
    path: '/api',
    router: googleMerchantOAuthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Google Merchant Center OAuth at /api/google/oauth',
  },
  {
    path: '/api',
    router: metaOAuthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Meta Commerce OAuth at /api/meta/oauth',
  },
  {
    path: '/api',
    router: metaWebhookRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Meta Commerce webhooks at /api/meta/webhooks',
  },
  {
    path: '/api',
    router: tiktokOAuthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'TikTok Shop OAuth at /api/tiktok/oauth',
  },
  {
    path: '/api',
    router: tiktokWebhookRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'TikTok Shop webhooks at /api/tiktok/webhooks',
  },
  {
    path: '/api/oauth',
    router: oauthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'OAuth routes (PayPal & Square payment gateway OAuth)',
  },

  // ── Social ───────────────────────────────────────────────────────────
  {
    path: '/api',
    router: socialProofRoutes,
    domain: 'social',
    authLevel: 'public',
    comment: 'Social Proof / UGC at /api/public/social-proof',
  },
  {
    path: '/api',
    router: shippingRateRoutes,
    domain: 'social',
    authLevel: 'public',
    comment: 'Shipping rates at /api/shipping/rates',
  },
  {
    path: '/api',
    router: returnsRoutes,
    domain: 'social',
    authLevel: 'public',
    comment: 'Returns portal at /api/public/returns',
  },
  {
    path: '/api',
    router: socialPixelRoutes,
    domain: 'social',
    authLevel: 'public',
    comment: 'Social Pixels at /api/social-pixels',
  },

  // ── Store reviews ────────────────────────────────────────────────────
  {
    path: '/api/stores',
    router: storeReviewsRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Store reviews at /api/stores',
  },
  {
    path: '/api',
    router: storeReviewsRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Store reviews also at /api for helpful votes endpoint',
  },

  // ── Queue ────────────────────────────────────────────────────────────
  {
    path: '/api/queue',
    router: queueRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Product queue routes',
  },

  // ── Subscription billing ─────────────────────────────────────────────
  {
    path: '/api/subscription',
    router: subscriptionBillingRoutes,
    domain: 'billing',
    authLevel: 'public',
    comment: 'Subscription billing routes',
  },

  // ── Stripe webhooks (late mount) ─────────────────────────────────────
  {
    path: '/api/webhooks/stripe',
    router: stripeWebhookRoutes,
    domain: 'pre-middleware',
    authLevel: 'webhook',
    comment: 'Stripe webhook routes (late mount)',
  },

  // ── Badges ───────────────────────────────────────────────────────────
  {
    path: '/api',
    router: badgeRegistryRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Badge registry at /api/public/badge-registry and /api/tenants/:tenantId/badge-registry',
  },
  {
    path: '/api',
    router: badgeAnalyticsRoutes,
    domain: 'misc',
    authLevel: 'public',
    comment: 'Badge analytics at /api/tenants/:tenantId/badge-analytics and /api/public/badge-events',
  },

  // ── Permissions ──────────────────────────────────────────────────────
  {
    path: '/api/permissions',
    router: permissionRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Permissions routes',
  },

  // ── Admin routes ─────────────────────────────────────────────────────
  {
    path: '/api/tier-config',
    router: tierConfigRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Tier config routes (tenant-accessible)',
  },
  // ── Singleton system routes ──────────────────────────────────────────
  {
    path: '/api/categories-singleton',
    router: categoriesSingletonRoutes,
    middleware: [authenticateToken],
    domain: 'singleton',
    authLevel: 'tenant',
    comment: 'Categories routes (UniversalSingleton)',
  },
  {
    path: '/api/shop-management',
    router: shopManagementRoutes,
    middleware: [authenticateToken],
    domain: 'singleton',
    authLevel: 'tenant',
    comment: 'Shop Management routes (Real Database Service)',
  },
  {
    path: '/api/gbp-advanced-sync-singleton',
    router: gbpAdvancedSyncSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'GBP Advanced Sync singleton',
  },
  {
    path: '/api/gmc-product-sync-singleton',
    router: gmcProductSyncSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'GMC Product Sync singleton',
  },
  {
    path: '/api/clover-oauth-singleton',
    router: cloverOAuthSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Clover OAuth singleton',
  },
  {
    path: '/api/oauth-singleton',
    router: oauthSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'OAuth singleton',
  },
  {
    path: '/api/refund-singleton',
    router: refundSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Refund singleton',
  },
  {
    path: '/api/taxonomy-sync-singleton',
    router: taxonomySyncSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Taxonomy sync singleton',
  },
  {
    path: '/api/gbp-sync-tracking-singleton',
    router: gbpSyncTrackingSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'GBP sync tracking singleton',
  },
  {
    path: '/api/recommendation-singleton',
    router: recommendationSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Recommendation singleton',
  },
  {
    path: '/api/gbp-category-sync-singleton',
    router: gbpCategorySyncSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'GBP category sync singleton',
  },
  {
    path: '/api/barcode-enrichment-singleton',
    router: barcodeEnrichmentSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Barcode enrichment singleton',
  },
  {
    path: '/api/digital-asset-singleton',
    router: digitalAssetSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Digital asset singleton',
  },
  {
    path: '/api/product-cache-singleton',
    router: productCacheSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Product cache singleton',
  },
  {
    path: '/api/ai-image-singleton',
    router: aiImageSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'AI image singleton',
  },
  {
    path: '/api/reviews-singleton',
    router: reviewsSingletonRoutes,
    domain: 'singleton',
    authLevel: 'public',
    comment: 'Reviews singleton',
  },

  // ── Inline handler routes (extracted from index.ts) ──────────────────
  {
    path: '/',
    router: inlineTenantRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Inline tenant CRUD, status, coordinates, subdomains, business hours',
  },
  {
    path: '/',
    router: inlineTenantProfileRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Inline tenant profile, GBP category, public tenant endpoints, categories, diagnostics',
  },
  {
    path: '/',
    router: inlineItemsRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Inline items/complete, item update, category assignment, needs-enrichment',
  },
  {
    path: '/',
    router: inlineTaxonomyRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Inline taxonomy admin status and sync endpoints',
  },

  // ── Email config (inline) ────────────────────────────────────────────
  {
    path: '/',
    router: inlineEmailConfigRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Email config GET/PUT',
  },

  // ── Directory inline handlers ────────────────────────────────────────
  {
    path: '/',
    router: inlineDirectoryRoutes,
    domain: 'directory',
    authLevel: 'public',
    comment: 'Directory simple-test, store-types test, store-types',
  },

  // ── Google OAuth inline handlers ─────────────────────────────────────
  {
    path: '/',
    router: inlineGoogleOAuthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Google OAuth auth/callback',
  },

  
  // â”€â”€ Tenant upload (inline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    path: '/',
    router: inlineTenantUploadRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Features showcase config, PATCH tenant profile, logo/banner upload',
  },

  // â”€â”€ Items CRUD (inline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    path: '/',
    router: inlineItemsCrudRoutes,
    domain: 'inventory',
    authLevel: 'public',
    comment: 'Items list, stats, get, create, update, delete, restore, purge, photo upload',
  },
  // ── Misc (health, ping, routes listing, jobs) ────────────────────────
  {
    path: '/',
    router: inlineMiscRoutes,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Health, ping, __routes, and jobs endpoints',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ── Routes consolidated from mounts/*.ts ─────────────────────────────
  // These were previously mounted via mountAllRoutes(app) and are now
  // registered here so mountAllRoutes can be removed.
  // ═══════════════════════════════════════════════════════════════════════

  // ── Audit middleware (global) ────────────────────────────────────────
  {
    path: '/',
    router: auditLogger,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Global audit logger middleware (logs all write operations)',
  },

  // ── Auth routes (from auth-routes.ts) ────────────────────────────────
  {
    path: '/auth',
    router: authRoutes,
    domain: 'auth',
    authLevel: 'public',
    comment: 'Auth0 login/callback routes at /auth',
  },
  {
    path: '/api/auth',
    router: authRoutes,
    domain: 'auth',
    authLevel: 'public',
    comment: 'Auth0 login/callback routes at /api/auth',
  },
  {
    path: '/api/auth/onboarding',
    router: onboardingRoutes,
    domain: 'auth',
    authLevel: 'public',
    comment: 'Onboarding routes (requires authentication)',
  },

  // ── Core business routes (from core-routes.ts) ───────────────────────
  {
    path: '/',
    router: auditRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Audit routes',
  },
  {
    path: '/',
    router: policyRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Policy routes',
  },
  {
    path: '/subscriptions',
    router: subscriptionRoutes,
    domain: 'billing',
    authLevel: 'public',
    comment: 'Subscription routes at /subscriptions',
  },
  {
    path: '/api/categories',
    router: categoryRoutes,
    middleware: [authenticateToken],
    domain: 'items',
    authLevel: 'tenant',
    comment: 'Category routes at /api/categories',
  },
  {
    path: '/performance',
    router: performanceApi,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Performance routes at /performance',
  },
  {
    path: '/organization-requests',
    router: organizationRequestRoutes,
    domain: 'organization',
    authLevel: 'public',
    comment: 'Organization requests at /organization-requests (no /api prefix)',
  },
  {
    path: '/upgrade-requests',
    router: upgradeRequestsRoutes,
    domain: 'organization',
    authLevel: 'public',
    comment: 'Upgrade requests at /upgrade-requests (no /api prefix)',
  },
  {
    path: '/permissions',
    router: permissionRoutes,
    domain: 'security',
    authLevel: 'public',
    comment: 'Permission routes at /permissions',
  },
  {
    path: '/users',
    router: userRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'User routes at /users (no /api prefix)',
  },
  {
    path: '/api/user',
    router: userRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'User routes at /api/user',
  },
  {
    path: '/api/public/tenants/:tenantId',
    router: tenantTierPublicRouter,
    domain: 'public',
    authLevel: 'public',
    comment: 'Public tier endpoint at /api/public/tenants/:tenantId/tier (no auth)',
  },
  {
    path: '/api',
    router: tenantTierRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Tenant tier routes (authenticated tenant routes only)',
  },
  {
    path: '/api/download',
    router: digitalDownloadsRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Digital downloads (no global auth - uses access tokens)',
  },
  {
    path: '/api/platform-stats',
    router: platformStatsRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Platform stats at /api/platform-stats',
  },
  {
    path: '/api',
    router: businessHoursRoutes,
    domain: 'settings',
    authLevel: 'public',
    comment: 'Business hours management at /api',
  },
  {
    path: '/api/taxonomy',
    router: taxonomyRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Taxonomy routes at /api/taxonomy',
  },
  {
    path: '/api/analytics',
    router: analyticsRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Analytics routes at /api/analytics',
  },
  {
    path: '/api/shop-categories',
    router: shopCategoriesRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Shop categories at /api/shop-categories',
  },
  {
    path: '/api/public/tenant',
    router: tenantLogoRoutes,
    domain: 'tenant',
    authLevel: 'public',
    comment: 'Tenant logo routes at /api/public/tenant',
  },
  {
    path: '/api/catalog',
    router: globalCatalogRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Global catalog routes (public access for browsing)',
  },
  {
    path: '/api/catalog/slugs',
    router: catalogSlugsRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Catalog slugs at /api/catalog/slugs',
  },
  {
    path: '/api/catalog',
    router: catalogAdoptionRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Catalog adoption at /api/catalog',
  },
  {
    path: '/api/catalog/availability',
    router: locationAvailabilityRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Location availability at /api/catalog/availability',
  },
  {
    path: '/api/cross-tenant',
    router: crossTenantProductsRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Cross-tenant product routes at /api/cross-tenant',
  },
  {
    path: '/api/tenant/crm',
    router: crmTenantRoutes,
    middleware: [authenticateToken, checkTenantAccess],
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'CRM tenant routes (tenant-scoped, requires tenant access)',
  },
  {
    path: '/api/customer/crm',
    router: crmCustomerRoutes,
    middleware: [authenticateCustomer],
    domain: 'customer',
    authLevel: 'public',
    comment: 'CRM customer routes (customer-scoped, requires customer JWT auth)',
  },
  {
    path: '/api/tenants/:tenantId',
    router: tenantSupplierRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Supplier catalog tenant routes at /api/tenants/:tenantId',
  },
  {
    path: '/api/branding',
    router: brandingRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Branding routes (public GET for storefront, auth PUT for merchant)',
  },

  // ── Dashboard routes (from dashboard-routes.ts) ──────────────────────
  {
    path: '/api/dashboard',
    router: dashboardRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Dashboard routes at /api/dashboard',
  },
  {
    path: '/api/dashboard',
    router: dashboardConsolidatedRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Consolidated dashboard routes at /api/dashboard',
  },
  {
    path: '/api',
    router: promotionRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Promotion endpoints at /api',
  },
  {
    path: '/api/tenant-limits',
    router: tenantLimitsRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Tenant creation limits at /api/tenant-limits',
  },
  {
    path: '/api/feed-jobs',
    router: feedJobsRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Feed jobs at /api/feed-jobs',
  },
  {
    path: '/api/feedback',
    router: feedbackRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Feedback at /api/feedback',
  },
  {
    path: '/api/v1/tenants',
    router: tenantCategoriesRoutes,
    middleware: [authenticateToken, checkTenantAccess],
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Tenant categories at /api/v1/tenants/:tenantId/categories',
  },
  {
    path: '/api/v1',
    router: quickStartRoutes,
    domain: 'tenant',
    authLevel: 'tenant',
    comment: 'Quick start at /api/v1',
  },
  {
    path: '/api/v1',
    router: cacheStatsRoutes,
    domain: 'infrastructure',
    authLevel: 'public',
    comment: 'Cache statistics at /api/v1',
  },
  {
    path: '/api/platform',
    router: categoriesPlatformRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Category scaffold platform routes at /api/platform',
  },
  {
    path: '/',
    router: categoriesTenantRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Category scaffold tenant routes',
  },
  {
    path: '/',
    router: categoriesMirrorRoutes,
    domain: 'items',
    authLevel: 'public',
    comment: 'Category scaffold mirror routes',
  },
  {
    path: '/',
    router: mirrorAdminRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Mirror admin routes',
  },
  {
    path: '/',
    router: syncLogsRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Sync logs routes',
  },

  // ── Security route (not under /api/admin) ────────────────────────────
  {
    path: '/api/security',
    router: securityRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Security routes (skips /telemetry which has its own mounting)',
  },
  // ── Legacy /admin mounts (not at /api/admin — kept for backward compatibility) ──
  {
    path: '/admin',
    router: tenantFlagsRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Tenant flags at /admin (platform admin or store owners)',
  },
  {
    path: '/admin',
    router: adminUsersRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Admin users at /admin',
  },
  {
    path: '/admin',
    router: platformFlagsRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Platform flags at /admin',
  },
  {
    path: '/admin',
    router: effectiveFlagsRoutes,
    middleware: [authenticateToken],
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Effective flags at /admin',
  },

  // ── Integration routes (from integration-routes.ts) ──────────────────
  {
    path: '/api/integrations',
    router: cloverRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Clover POS integration at /api/integrations',
  },
  {
    path: '/api/google-business',
    router: googleBusinessOAuthRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Google Business Profile OAuth at /api/google-business',
  },
  {
    path: '/',
    router: scanMetricsRoutes,
    domain: 'admin',
    authLevel: 'admin',
    comment: 'Scan metrics routes (mounted at root, routes define their own paths)',
  },
  {
    path: '/api/email',
    router: emailTestRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Email test routes at /api/email',
  },
  {
    path: '/test',
    router: testGbpRoutes,
    domain: 'integration',
    authLevel: 'public',
    comment: 'Test GBP routes at /test',
  },

  // ── Directory routes at other paths (not part of /api/directory orchestrator) ──
  {
    path: '/api/admin/directory',
    router: directoryAdminRoutes,
    domain: 'directory',
    authLevel: 'admin',
    comment: 'Admin directory management (auth in routes)',
  },
  {
    path: '/api/support/directory',
    router: directorySupportRoutes,
    domain: 'directory',
    authLevel: 'public',
    comment: 'Support directory tools (auth in routes)',
  },

  // ── Brand Partners (authenticated, non-tenant) ──────────────────────
  {
    path: '/api/brand-partners',
    router: brandPartnersRoutes,
    domain: 'integration',
    authLevel: 'tenant',
    comment: 'Brand partner self-service claim submission and lookup',
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
