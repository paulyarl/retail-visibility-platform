# 🗂️ **SERVICE MIGRATION CLEANUP PLAN**

## ✅ **Methods Successfully Extracted (Remove from PlatformHomeSingletonService)**

### **TenantUserService Methods:**
- `getTenantUsers()` → `tenantUserService.getTenantUsers()`
- `addTenantUser()` → `tenantUserService.addTenantUser()`
- `updateTenantUserRole()` → `tenantUserService.updateTenantUserRole()`
- `removeTenantUser()` → `tenantUserService.removeTenantUser()`

### **FeaturedProductsService Methods:**
- `getFeaturedProducts()` → `featuredProductsService.getFeaturedProducts()`
- `featureProduct()` → `featuredProductsService.featureProduct()`
- `unfeatureProduct()` → `featuredProductsService.unfeatureProduct()`
- `getFeaturingStats()` → `featuredProductsService.getFeaturingStats()`

### **AdminUserService Methods:**
- `getAdminUsers()` → `adminUserService.getAdminUsers()`
- `deleteAdminUser()` → `adminUserService.deleteAdminUser()`
- `createAdminUser()` → `adminUserService.createAdminUser()`
- `updateAdminUserPermissions()` → `adminUserService.updateAdminUserPermissions()`

### **InventoryScanService Methods:**
- `getScanSession()` → `inventoryScanService.getScanSession()`
- `createScanSession()` → `inventoryScanService.createScanSession()`
- `lookupBarcode()` → `inventoryScanService.lookupBarcode()`
- `deleteScanResult()` → `inventoryScanService.deleteScanResult()`
- `commitScanSession()` → `inventoryScanService.commitScanSession()`
- `endScanSession()` → `inventoryScanService.endScanSession()`
- `deleteScanSession()` → `inventoryScanService.deleteScanSession()`
- `addScanResult()` → `inventoryScanService.addScanResult()`
- `getScanResults()` → `inventoryScanService.getScanResults()`
- `checkActiveSessions()` → `inventoryScanService.checkActiveSessions()`

### **TenantTierService Methods:**
- `getAdminTiers()` → `tenantTierService.getAdminTiers()`
- `updateTenantTier()` → `tenantTierService.updateTenantTier()`
- `updateTierStatus()` → `tenantTierService.updateTierStatus()`
- `updateTier()` → `tenantTierService.updateTier()`
- `updateTierSortOrder()` → `tenantTierService.updateTierSortOrder()`
- `createTier()` → `tenantTierService.createTier()`
- `deleteTier()` → `tenantTierService.deleteTier()`
- `getTenantTier()` → `tenantTierService.getTenantTier()`

### **UserManagementService Methods:**
- `getUser()` → `userManagementService.getUser()`
- `getUserPreferences()` → `userManagementService.getUserPreferences()`
- `updateUserPreferences()` → `userManagementService.updateUserPreferences()`
- `updateUserProfile()` → `userManagementService.updateUserProfile()`
- `changePassword()` → `userManagementService.changePassword()`
- `enable2FA()` → `userManagementService.enable2FA()`
- `verify2FA()` → `userManagementService.verify2FA()`
- `disable2FA()` → `userManagementService.disable2FA()`
- `getUserActivity()` → `userManagementService.getUserActivity()`
- `deleteAccount()` → `userManagementService.deleteAccount()`

### **TenantCategoryService Methods:**
- `getTenantCategory()` → `tenantCategoryService.getTenantCategory()`
- `updateTenantCategory()` → `tenantCategoryService.updateTenantCategory()`
- `deleteTenantCategory()` → `tenantCategoryService.deleteTenantCategory()`
- `createTenantCategory()` → `tenantCategoryService.createTenantCategory()`
- `getTenantCategories()` → `tenantCategoryService.getTenantCategories()`
- `reorderTenantCategories()` → `tenantCategoryService.reorderTenantCategories()`
- `bulkImportTenantCategories()` → `tenantCategoryService.bulkImportTenantCategories()`
- `getTenantCategoryAnalytics()` → `tenantCategoryService.getTenantCategoryAnalytics()`
- `archiveTenantCategory()` → `tenantCategoryService.archiveTenantCategory()`
- `restoreTenantCategory()` → `tenantCategoryService.restoreTenantCategory()`

### **IntegrationService Methods:**
- `getSquareStatus()` → `integrationService.getSquareStatus()`
- `getSquareOAuthAuthorize()` → `integrationService.getSquareOAuthAuthorize()`
- `disconnectSquare()` → `integrationService.disconnectSquare()`
- `startSquareSync()` → `integrationService.startSquareSync()`
- `getCloverStatus()` → `integrationService.getCloverStatus()`
- `enableCloverDemo()` → `integrationService.enableCloverDemo()`
- `disableCloverDemo()` → `integrationService.disableCloverDemo()`
- `getSyncStatus()` → `integrationService.getSyncStatus()`
- `getAllIntegrationStatuses()` → `integrationService.getAllIntegrationStatuses()`
- `configureIntegration()` → `integrationService.configureIntegration()`
- `testIntegration()` → `integrationService.testIntegration()`
- `getIntegrationLogs()` → `integrationService.getIntegrationLogs()`

### **AdminAnalyticsService Methods:**
- `getAdminDirectoryStats()` → `adminAnalyticsService.getAdminDirectoryStats()`
- `getAdminDirectoryListings()` → `adminAnalyticsService.getAdminDirectoryListings()`
- `getAdminEnrichmentAnalytics()` → `adminAnalyticsService.getAdminEnrichmentAnalytics()`
- `searchAdminEnrichmentProducts()` → `adminAnalyticsService.searchAdminEnrichmentProducts()`
- `getAdminSubdomainStats()` → `adminAnalyticsService.getAdminSubdomainStats()`
- `getPlatformOverview()` → `adminAnalyticsService.getPlatformOverview()`
- `getTenantUsageStats()` → `adminAnalyticsService.getTenantUsageStats()`
- `getFeatureAdoptionMetrics()` → `adminAnalyticsService.getFeatureAdoptionMetrics()`
- `getPerformanceMetrics()` → `adminAnalyticsService.getPerformanceMetrics()`
- `getUserActivityAnalytics()` → `adminAnalyticsService.getUserActivityAnalytics()`
- `getRevenueAnalytics()` → `adminAnalyticsService.getRevenueAnalytics()`
- `exportAnalyticsData()` → `adminAnalyticsService.exportAnalyticsData()`
- `getCustomReport()` → `adminAnalyticsService.getCustomReport()`

### **OrganizationService Methods:**
- `createOrganizationRequest()` → `organizationService.createOrganizationRequest()`
- `assignTenantToOrganization()` → `organizationService.assignTenantToOrganization()`
- `removeTenantFromOrganization()` → `organizationService.removeTenantFromOrganization()`
- `deletePendingRequest()` → `organizationService.deletePendingRequest()`
- `updatePendingRequest()` → `organizationService.updatePendingRequest()`
- `getOrganization()` → `organizationService.getOrganization()`
- `getOrganizations()` → `organizationService.getOrganizations()`
- `createOrganization()` → `organizationService.createOrganization()`
- `updateOrganization()` → `organizationService.updateOrganization()`
- `deleteOrganization()` → `organizationService.deleteOrganization()`
- `getOrganizationMembers()` → `organizationService.getOrganizationMembers()`
- `addOrganizationMember()` → `organizationService.addOrganizationMember()`
- `removeOrganizationMember()` → `organizationService.removeOrganizationMember()`
- `getOrganizationSettings()` → `organizationService.getOrganizationSettings()`
- `updateOrganizationSettings()` → `organizationService.updateOrganizationSettings()`

### **SubdomainService Methods:**
- `getTenantSubdomain()` → `subdomainService.getTenantSubdomain()`
- `getUserSubdomains()` → `subdomainService.getUserSubdomains()`
- `checkSubdomainAvailability()` → `subdomainService.checkSubdomainAvailability()`
- `updateTenantSubdomain()` → `subdomainService.updateTenantSubdomain()`
- `deleteTenantSubdomain()` → `subdomainService.deleteTenantSubdomain()`
- `getAdminSubdomainStats()` → `subdomainService.getAdminSubdomainStats()`
- `reserveSubdomain()` → `subdomainService.reserveSubdomain()`
- `verifySubdomainOwnership()` → `subdomainService.verifySubdomainOwnership()`
- `getSubdomainConfig()` → `subdomainService.getSubdomainConfig()`
- `updateSubdomainConfig()` → `subdomainService.updateSubdomainConfig()`

### **TenantAnalyticsService Methods:**
- `getTenantUsage()` → `tenantAnalyticsService.getTenantUsage()`
- `getTenantCategory()` → `tenantAnalyticsService.getTenantCategory()`
- `getTenantPerformanceMetrics()` → `tenantAnalyticsService.getTenantPerformanceMetrics()`
- `getTenantProductAnalytics()` → `tenantAnalyticsService.getTenantProductAnalytics()`
- `getTenantCustomerAnalytics()` → `tenantAnalyticsService.getTenantCustomerAnalytics()`
- `getTenantSalesAnalytics()` → `tenantAnalyticsService.getTenantSalesAnalytics()`
- `getTenantInventoryAnalytics()` → `tenantAnalyticsService.getTenantInventoryAnalytics()`
- `getTenantEngagementMetrics()` → `tenantAnalyticsService.getTenantEngagementMetrics()`
- `getTenantApiUsageAnalytics()` → `tenantAnalyticsService.getTenantApiUsageAnalytics()`
- `getTenantErrorAnalytics()` → `tenantAnalyticsService.getTenantErrorAnalytics()`
- `getTenantStorageAnalytics()` → `tenantAnalyticsService.getTenantStorageAnalytics()`
- `getTenantBandwidthAnalytics()` → `tenantAnalyticsService.getTenantBandwidthAnalytics()`
- `exportTenantAnalytics()` → `tenantAnalyticsService.exportTenantAnalytics()`
- `getTenantDashboardSummary()` → `tenantAnalyticsService.getTenantDashboardSummary()`

## 🔄 **Methods to Keep in PlatformHomeSingletonService**
These methods are core to the singleton and should remain:
- `getTenants()` - Core tenant listing
- `getTenant()` - Core tenant details
- `getTenantProfile()` - Core tenant profile
- `getTenantLogo()` - Core tenant logo
- `getTenantFulfillmentSettings()` - Core fulfillment settings
- `getTenantComplete()` - Aggregated tenant data
- `getTenantTier()` - Core tier info
- `updateTenantName()` - Core tenant updates
- `updateTenantFulfillmentSettings()` - Core fulfillment updates
- `getCloverStatus()` - Core Clover status
- `getSentryConfig()` - Core Sentry config
- `getUpgradeRequests()` - Core upgrade requests
- `getPendingUpgradeRequest()` - Core pending requests
- `createUpgradeRequest()` - Core upgrade creation
- `createOrganizationRequest()` - Core org request creation
- `updatePendingRequest()` - Core request updates

## 🎯 **Cleanup Action Plan**
1. Remove all extracted methods from PlatformHomeSingletonService
2. Update imports in components to use new services
3. Run TypeScript check to verify no errors
4. Test functionality in development
