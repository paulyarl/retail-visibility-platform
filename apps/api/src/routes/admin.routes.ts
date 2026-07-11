/**
 * Admin Routes Orchestrator
 *
 * Single router that mounts all admin sub-routers in strict order:
 * 1. Specific sub-path routers (mounted at their own sub-paths)
 * 2. Generic root-mounted routers LAST (tenant-flags, platform-flags, effective-flags, admin-users, admin-tools)
 *
 * This enforces that specific admin paths always win over any generic catch-all.
 *
 * ── Auth Middleware Strategy ──────────────────────────────────────────────
 * - Routes with internal auth (router.use(requireAuth/requirePlatformAdmin)):
 *     service-charges, paypal-connect, manual-billing, platform-revenue,
 *     platform-fee-invoices, notification-logs, inventory-transfers,
 *     slug-registry, catalog, inventory-stats, google-product-taxonomy,
 *     demo-tenants, cached-products, scan-metrics
 *   → No mount-level auth needed (would be redundant).
 *
 * - Routes with mount-level auth (authenticateToken, requireAdmin):
 *     security (admin-security), tier-system, capabilities, users, tools,
 *     sentry, errors
 *   → These routes have no internal auth, so mount-level is required.
 *
 * - Routes with mount-level authenticateToken only:
 *     platform-categories, gbp-categories, feature-overrides, tenants,
 *     ticker-config, ticker-messages, tiers, trials, analytics,
 *     navigation-links, categories, billing, capability-types, features,
 *     capabilities, tier-capabilities, taxonomy, crm, bot, feature-purchases,
 *     bot-embed-licenses, bsaas-*, capability-constraints, suppliers,
 *     platform-settings
 *   → authenticateToken at mount; requireAdmin/requirePlatformAdmin is
 *     applied per-route inside some of these routers.
 *
 * - Generic root-mounted routers (tenant-flags, platform-flags,
 *   effective-flags, admin-users, admin-tools):
 *   → authenticateToken at mount. These define specific sub-paths internally.
 *
 * - PRE-EXISTING issues (not introduced by this refactor):
 *   - performance.ts: no auth at all (was unauthenticated in original registry)
 *   - security-monitoring.ts: requireAdmin is commented out internally
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';

// Specific sub-path routers
import serviceChargesRoutes from './admin/service-charges';
import paypalConnectRoutes from './paypal-connect';
import adminSecurityMonitoringRoutes from './admin/security-monitoring';
import adminSecurityRoutes from './admin-security';
import tierSystemRoutes from './admin/tier-system';
import capabilityRoutes from './admin/capability-routes';
import tierManagementRoutes from './admin/tier-management';
import scanMetricsRoutes from './scan-metrics';
import cachedProductsRoutes from './cached-products';
import adminUsersRoutes from './admin-users';
import adminToolsRoutes from './admin-tools';
import sentryRoutes from './admin/sentry';
import errorLogRoutes from './admin/errors';
import manualBillingRoutes from './admin/manual-billing';
import platformRevenueRoutes from './platform-revenue';
import platformFeeInvoiceRoutes from './platform-fee-invoices';
import notificationLogsRoutes from './admin/notification-logs';
import adminInventoryTransferRoutes from './admin/inventory-transfers';
import adminSlugRegistryRoutes from './admin/slug-registry';
import adminCatalogRoutes from './admin/catalog';
import adminInventoryStatsRoutes from './admin/inventory-stats';
import googleProductTaxonomyRoutes from './admin/google-product-taxonomy';
import adminDemoTenantRoutes from './admin/demo-tenants';
import performanceApi from './performance';
import platformCategoriesRoutes from './admin/platform-categories';
import gbpCategoriesSyncRoutes from './admin/gbp-categories-sync';
import featureOverridesRoutes from './admin/feature-overrides';
import adminTenantsRoutes from './admin/tenants';
import tickerConfigRoutes from './admin/ticker-config';
import tickerMessagesRoutes from './admin/ticker-messages';
import adminTiersRoutes from './admin/admin-tiers';
import trialManagementRoutes from './admin/trial-management';
import adminAnalyticsRoutes from './admin-analytics';
import navigationLinksRoutes from './admin/navigation-links';
import categoriesPropagateRoutes from './admin/categories-propagate';
import adminTenantBillingRoutes from './admin/tenant-billing';
import adminPlatformBillingRoutes from './admin/platform-billing';
import adminAutomationRoutes from './admin/automation';
import capabilityTypesRoutes from './admin/capability-types';
import featuresRoutes from './admin/features';
import capabilitiesRoutes from './admin/capabilities';
import tierCapabilitiesRoutes from './admin/tier-capabilities';
import taxonomyAdminRoutes from './taxonomy-admin';
import crmAdminRoutes from './crm/admin/crm-admin';
import botPlatformRoutes from './admin/bot-platform';
import featurePurchasesRoutes from './admin/feature-purchases';
import botEmbedLicensesRoutes from './admin/bot-embed-licenses';
import bsaasCatalogRoutes from './admin/bsaas-catalog';
import bsaasBundlesRoutes from './admin/bsaas-bundles';
import bsaasAnalyticsRoutes from './admin/bsaas-analytics';
import bsaasPromotionsRoutes from './admin/bsaas-promotions';
import capabilityConstraintsRoutes from './admin/capability-constraints';
import supplierAdminRoutes from './admin/suppliers';
import adminPlatformSettingsRoutes from './admin/platform-settings';

// Generic root-mounted routers (mounted at bare /api/admin)
import tenantFlagsRoutes from './tenant-flags';
import platformFlagsRoutes from './platform-flags';
import effectiveFlagsRoutes from './effective-flags';

const router = Router();

// ── 1. Specific sub-path routers ────────────────────────────────────────
router.use('/service-charges', serviceChargesRoutes);
router.use('/paypal-connect', paypalConnectRoutes);
router.use('/security', adminSecurityMonitoringRoutes);
router.use('/security', authenticateToken, requireAdmin, adminSecurityRoutes);
router.use('/tier-system', authenticateToken, requireAdmin, tierSystemRoutes); // Note: tier-system also has internal router.use(authenticateToken) — redundant but harmless
router.use('/capabilities', authenticateToken, requireAdmin, capabilityRoutes);
router.use('/tiers', authenticateToken, tierManagementRoutes);
router.use('/scan-metrics', scanMetricsRoutes);
router.use('/cached-products', cachedProductsRoutes);
router.use('/users', authenticateToken, requireAdmin, adminUsersRoutes);
router.use('/tools', authenticateToken, requireAdmin, adminToolsRoutes);
router.use('/sentry', authenticateToken, requireAdmin, sentryRoutes);
router.use('/errors', authenticateToken, requireAdmin, errorLogRoutes);
router.use('/manual-billing', manualBillingRoutes);
router.use('/platform-revenue', platformRevenueRoutes);
router.use('/platform-fee-invoices', platformFeeInvoiceRoutes);
router.use('/notification-logs', notificationLogsRoutes);
router.use('/inventory-transfers', adminInventoryTransferRoutes);
router.use('/slug-registry', adminSlugRegistryRoutes);
router.use('/catalog', adminCatalogRoutes);
router.use('/inventory', adminInventoryStatsRoutes);
router.use('/google-product-taxonomy', googleProductTaxonomyRoutes);
router.use('/demo-tenants', adminDemoTenantRoutes);
router.use('/performance', performanceApi);
router.use('/platform-categories', authenticateToken, platformCategoriesRoutes);
router.use('/gbp-categories', authenticateToken, gbpCategoriesSyncRoutes);
router.use('/feature-overrides', authenticateToken, featureOverridesRoutes);
router.use('/tenants', authenticateToken, adminTenantsRoutes);
router.use('/ticker-config', authenticateToken, tickerConfigRoutes);
router.use('/ticker-messages', authenticateToken, tickerMessagesRoutes);
router.use('/tiers', authenticateToken, adminTiersRoutes);
router.use('/trials', authenticateToken, trialManagementRoutes);
router.use('/analytics', authenticateToken, adminAnalyticsRoutes);
router.use('/navigation-links', authenticateToken, navigationLinksRoutes);
router.use('/categories', authenticateToken, categoriesPropagateRoutes);
router.use('/billing', authenticateToken, adminTenantBillingRoutes);
router.use('/billing', authenticateToken, adminPlatformBillingRoutes);
router.use('/billing', authenticateToken, adminAutomationRoutes);
router.use('/capability-types', authenticateToken, capabilityTypesRoutes);
router.use('/features', authenticateToken, featuresRoutes);
router.use('/capabilities', authenticateToken, capabilitiesRoutes);
router.use('/tier-capabilities', authenticateToken, tierCapabilitiesRoutes);
router.use('/taxonomy', authenticateToken, taxonomyAdminRoutes);
router.use('/crm', authenticateToken, crmAdminRoutes);
router.use('/bot', authenticateToken, botPlatformRoutes);
router.use('/feature-purchases', authenticateToken, featurePurchasesRoutes);
router.use('/bot-embed-licenses', authenticateToken, botEmbedLicensesRoutes);
router.use('/bsaas-catalog', authenticateToken, bsaasCatalogRoutes);
router.use('/bsaas-bundles', authenticateToken, bsaasBundlesRoutes);
router.use('/bsaas-analytics', authenticateToken, bsaasAnalyticsRoutes);
router.use('/bsaas-promotions', authenticateToken, bsaasPromotionsRoutes);
router.use('/capability-constraints', authenticateToken, capabilityConstraintsRoutes);
router.use('/suppliers', authenticateToken, supplierAdminRoutes);
router.use('/platform-settings', authenticateToken, adminPlatformSettingsRoutes);

// ── 2. Generic root-mounted routers LAST ──────────────────────────────────
// These use specific sub-paths internally (/tenant-flags, /platform-flags, /effective-flags, /users, /tools)
// but are mounted at bare /api/admin. They must come after all specific sub-path routers.
router.use('/', authenticateToken, tenantFlagsRoutes);
router.use('/', authenticateToken, adminUsersRoutes);
router.use('/', authenticateToken, platformFlagsRoutes);
router.use('/', authenticateToken, effectiveFlagsRoutes);
router.use('/', authenticateToken, adminToolsRoutes);

export default router;
