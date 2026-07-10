import { Express } from 'express';
import { authenticateToken, checkTenantAccess, requireAdmin } from '../../middleware/auth';
import { auditLogger } from '../../middleware/audit-logger';

// Core business routes - re-enabled for localhost testing
import auditRoutes from '../audit';
import policyRoutes from '../policy';
import billingRoutes from '../billing';
import subscriptionRoutes from '../subscriptions';
import categoryRoutes from '../categories';
import performanceRoutes from '../performance';
import organizationRoutes from '../organizations';
import organizationRequestRoutes from '../organization-requests';
import upgradeRequestsRoutes from '../upgrade-requests';
import permissionRoutes from '../permissions';
import userRoutes from '../users';
import tenantUserRoutes from '../tenant-users';
import platformSettingsRoutes from '../platform-settings';
import platformStatsRoutes from '../platform-stats';
import businessHoursRoutes from '../business-hours';
import taxonomyRoutes from '../taxonomy';
import analyticsRoutes from '../analytics';
import tenantsRoutes from '../tenants';
import tenantTierRoutes from '../tenant-tier';
import paymentGatewaysRoutes from '../payment-gateways';
import digitalDownloadsRoutes from '../digital-downloads';
import digitalDownloadPagesRoutes from '../tenant/digital-download-pages';
import shopCategoriesRoutes from '../shop-categories';
import tenantLogoRoutes from '../tenant-logo';
import globalCatalogRoutes from '../global-catalog';
import catalogSlugsRoutes from '../catalog-slugs';
import catalogAdoptionRoutes from '../catalog-adoption';
import locationAvailabilityRoutes from '../location-availability';
import crossTenantProductsRoutes from '../cross-tenant-products';
import tenantCapabilitiesRoutes from '../tenant-capabilities';
import crmTenantRoutes from '../crm/tenant/crm-tenant';
import { authenticateCustomer } from '../../middleware/auth';
import crmCustomerRoutes from '../crm/customer/crm-customer';
import tenantSupplierRoutes from '../tenant/suppliers';
import brandingRoutes from '../branding';

/**
 * Mount core business routes
 * These handle the main business logic of the platform
 */
export function mountCoreRoutes(app: Express) {
  console.log('🏢 Mounting core business routes...');

  // Apply audit middleware globally (logs all write operations)
  app.use(auditLogger);

  // Mount v3.5 routes
  app.use(auditRoutes);
  app.use(policyRoutes);
  app.use('/api', billingRoutes);
  app.use('/subscriptions', subscriptionRoutes);
  app.use('/api/categories', authenticateToken, categoryRoutes);
  app.use('/performance', performanceRoutes);
  app.use('/api/organizations', authenticateToken, organizationRoutes);
  app.use('/organization-requests', organizationRequestRoutes);
  app.use('/upgrade-requests', upgradeRequestsRoutes);
  app.use('/permissions', permissionRoutes);
  app.use('/users', userRoutes);
  app.use('/api/user', userRoutes);
  
  // IMPORTANT: Mount public tier routes BEFORE authenticated tenant routes
  // This allows /api/tenants/:id/tier/public to work without auth
  app.use('/api', tenantTierRoutes);
  
  // IMPORTANT: Mount payment gateways WITHOUT global auth middleware
  // Individual routes handle their own authentication (public vs authenticated)
  app.use('/api/tenants', paymentGatewaysRoutes);
  
  // IMPORTANT: Mount tenant capabilities WITHOUT global auth middleware
  // Public endpoint for storefront/checkout capability resolution
  app.use('/api/tenants', tenantCapabilitiesRoutes);
  
  // IMPORTANT: Mount digital downloads WITHOUT auth - uses access tokens for security
  app.use('/api/download', digitalDownloadsRoutes);

  // Digital download pages management (tenant-scoped CRUD)
  app.use('/api/tenants', digitalDownloadPagesRoutes);
  
  app.use('/api/tenants', authenticateToken, tenantsRoutes);
  app.use('/api/tenants', authenticateToken, tenantUserRoutes);
  app.use(platformSettingsRoutes);
  app.use('/api/platform-stats', platformStatsRoutes);
  app.use('/api', businessHoursRoutes);
  app.use('/api/taxonomy', taxonomyRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/shop-categories', shopCategoriesRoutes);
  app.use('/api/public/tenant', tenantLogoRoutes);
  
  // Global catalog routes (public access for browsing)
  app.use('/api/catalog', globalCatalogRoutes);
  app.use('/api/catalog/slugs', catalogSlugsRoutes);
  app.use('/api/catalog', catalogAdoptionRoutes);
  app.use('/api/catalog/availability', locationAvailabilityRoutes);
  
  // Cross-tenant product routes (leverage product_slug for platform-wide queries)
  app.use('/api/cross-tenant', crossTenantProductsRoutes);

  // CRM tenant routes (tenant-scoped, requires tenant access)
  app.use('/api/tenant/crm', authenticateToken, checkTenantAccess, crmTenantRoutes);

  // CRM customer routes (customer-scoped, requires customer JWT auth)
  app.use('/api/customer/crm', authenticateCustomer, crmCustomerRoutes);

  // Supplier catalog tenant routes (catalog search, import, mappings)
  app.use('/api/tenants/:tenantId', tenantSupplierRoutes);

  // Branding routes (public GET for storefront, auth PUT for merchant)
  app.use('/api/branding', brandingRoutes);

  console.log('✅ Core business routes mounted');
}
