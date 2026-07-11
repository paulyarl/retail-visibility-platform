/**
 * Admin Routes Orchestrator
 *
 * Single router that mounts all admin sub-routers in strict order:
 * 1. Specific sub-path routers (mounted at their own sub-paths)
 * 2. Generic root-mounted routers LAST (tenant-flags, platform-flags, effective-flags, admin-users, admin-tools)
 *
 * This enforces that specific admin paths always win over any generic catch-all.
 *
 * ── Auth Middleware Strategy (Auth Scope Isolation) ──────────────────────
 * All admin sub-routers are mounted with authenticateToken + requireAdmin at
 * the mount level. No sub-router uses router.use(authenticateToken) or
 * router.use(requireAdmin) internally — this prevents auth scope bleed between
 * sibling routers (per docs/AUTH_SCOPE_ISOLATION_SPEC.md).
 *
 * Sub-routers that need finer-grained role checks (e.g. requirePlatformStaff
 * for PLATFORM_SUPPORT/PLATFORM_VIEWER access) apply those per-route.
 *
 * paypal-connect is mounted with authenticateToken only (not requireAdmin)
 * because it has tenant-facing order/capture routes that need auth but not
 * admin access. Its admin routes have requireAdmin per-route.
 *
 * notification-logs is mounted with authenticateToken only because it uses
 * requirePlatformAdmin per-route (which checks req.user for 401).
 *
 * scan-metrics is mounted with authenticateToken only because it does its
 * own canViewAllTenants() role check per-route.
 *
 * security-monitoring is mounted with authenticateToken only; requireAdmin
 * is applied per-route where needed.
 *
 * google-product-taxonomy is mounted with authenticateToken only; it's a
 * read-only taxonomy search that any authenticated admin can access.
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
import adminWholesaleMatchingRoutes from './admin/wholesale-matching';
import adminBrandPartnersRoutes from './admin/brand-partners';

// Generic root-mounted routers (mounted at bare /api/admin)
import tenantFlagsRoutes from './tenant-flags';
import platformFlagsRoutes from './platform-flags';
import effectiveFlagsRoutes from './effective-flags';

const router = Router();

// ── 1. Specific sub-path routers ────────────────────────────────────────
router.use('/service-charges', authenticateToken, requireAdmin, serviceChargesRoutes);
router.use('/paypal-connect', authenticateToken, paypalConnectRoutes);
router.use('/security', authenticateToken, adminSecurityMonitoringRoutes);
router.use('/security', authenticateToken, requireAdmin, adminSecurityRoutes);
router.use('/tier-system', authenticateToken, requireAdmin, tierSystemRoutes);
router.use('/capabilities', authenticateToken, requireAdmin, capabilityRoutes);
router.use('/tiers', authenticateToken, requireAdmin, tierManagementRoutes);
router.use('/scan-metrics', authenticateToken, scanMetricsRoutes);
router.use('/cached-products', authenticateToken, requireAdmin, cachedProductsRoutes);
router.use('/users', authenticateToken, requireAdmin, adminUsersRoutes);
router.use('/tools', authenticateToken, requireAdmin, adminToolsRoutes);
router.use('/sentry', authenticateToken, requireAdmin, sentryRoutes);
router.use('/errors', authenticateToken, requireAdmin, errorLogRoutes);
router.use('/manual-billing', authenticateToken, requireAdmin, manualBillingRoutes);
router.use('/platform-revenue', authenticateToken, requireAdmin, platformRevenueRoutes);
router.use('/platform-fee-invoices', authenticateToken, requireAdmin, platformFeeInvoiceRoutes);
router.use('/notification-logs', authenticateToken, notificationLogsRoutes);
router.use('/inventory-transfers', authenticateToken, requireAdmin, adminInventoryTransferRoutes);
router.use('/slug-registry', authenticateToken, requireAdmin, adminSlugRegistryRoutes);
router.use('/catalog', authenticateToken, requireAdmin, adminCatalogRoutes);
router.use('/inventory', authenticateToken, requireAdmin, adminInventoryStatsRoutes);
router.use('/google-product-taxonomy', authenticateToken, googleProductTaxonomyRoutes);
router.use('/demo-tenants', authenticateToken, requireAdmin, adminDemoTenantRoutes);
router.use('/performance', authenticateToken, requireAdmin, performanceApi);
router.use('/platform-categories', authenticateToken, requireAdmin, platformCategoriesRoutes);
router.use('/gbp-categories', authenticateToken, requireAdmin, gbpCategoriesSyncRoutes);
router.use('/feature-overrides', authenticateToken, requireAdmin, featureOverridesRoutes);
router.use('/tenants', authenticateToken, requireAdmin, adminTenantsRoutes);
router.use('/ticker-config', authenticateToken, requireAdmin, tickerConfigRoutes);
router.use('/ticker-messages', authenticateToken, requireAdmin, tickerMessagesRoutes);
router.use('/tiers', authenticateToken, requireAdmin, adminTiersRoutes);
router.use('/trials', authenticateToken, requireAdmin, trialManagementRoutes);
router.use('/analytics', authenticateToken, requireAdmin, adminAnalyticsRoutes);
router.use('/navigation-links', authenticateToken, requireAdmin, navigationLinksRoutes);
router.use('/categories', authenticateToken, requireAdmin, categoriesPropagateRoutes);
router.use('/billing', authenticateToken, requireAdmin, adminTenantBillingRoutes);
router.use('/billing', authenticateToken, requireAdmin, adminPlatformBillingRoutes);
router.use('/billing', authenticateToken, requireAdmin, adminAutomationRoutes);
router.use('/capability-types', authenticateToken, requireAdmin, capabilityTypesRoutes);
router.use('/features', authenticateToken, requireAdmin, featuresRoutes);
router.use('/capabilities', authenticateToken, requireAdmin, capabilitiesRoutes);
router.use('/tier-capabilities', authenticateToken, requireAdmin, tierCapabilitiesRoutes);
router.use('/taxonomy', authenticateToken, requireAdmin, taxonomyAdminRoutes);
router.use('/crm', authenticateToken, requireAdmin, crmAdminRoutes);
router.use('/bot', authenticateToken, requireAdmin, botPlatformRoutes);
router.use('/feature-purchases', authenticateToken, requireAdmin, featurePurchasesRoutes);
router.use('/bot-embed-licenses', authenticateToken, requireAdmin, botEmbedLicensesRoutes);
router.use('/bsaas-catalog', authenticateToken, requireAdmin, bsaasCatalogRoutes);
router.use('/bsaas-bundles', authenticateToken, requireAdmin, bsaasBundlesRoutes);
router.use('/bsaas-analytics', authenticateToken, requireAdmin, bsaasAnalyticsRoutes);
router.use('/bsaas-promotions', authenticateToken, requireAdmin, bsaasPromotionsRoutes);
router.use('/capability-constraints', authenticateToken, requireAdmin, capabilityConstraintsRoutes);
router.use('/suppliers', authenticateToken, requireAdmin, supplierAdminRoutes);
router.use('/wholesale', authenticateToken, requireAdmin, adminWholesaleMatchingRoutes);
router.use('/brand-partners', authenticateToken, requireAdmin, adminBrandPartnersRoutes);
router.use('/platform-settings', authenticateToken, requireAdmin, adminPlatformSettingsRoutes);

// ── 2. Generic root-mounted routers LAST ──────────────────────────────────
// These use specific sub-paths internally (/tenant-flags, /platform-flags, /effective-flags, /users, /tools)
// but are mounted at bare /api/admin. They must come after all specific sub-path routers.
router.use('/', authenticateToken, requireAdmin, tenantFlagsRoutes);
router.use('/', authenticateToken, requireAdmin, adminUsersRoutes);
router.use('/', authenticateToken, requireAdmin, platformFlagsRoutes);
router.use('/', authenticateToken, requireAdmin, effectiveFlagsRoutes);
router.use('/', authenticateToken, requireAdmin, adminToolsRoutes);

export default router;
