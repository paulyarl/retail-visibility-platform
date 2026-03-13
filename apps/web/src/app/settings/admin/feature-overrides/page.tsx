'use client';

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, useToast } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Modal, ModalFooter } from '@/components/ui';
import { Input } from '@/components/ui';
import { Select } from '@/components/ui';
import { Button } from '@mantine/core';
import { Search, Filter, Plus, Edit, Trash2, Shield, Settings, Zap, X } from 'lucide-react';
import { featureOverridesService, type Override, type OverrideType, type OverrideStatus } from '@/services/FeatureOverridesService';
import { tenantTierService, type Tenant, type DbTier } from '@/services/TenantTierService';
import { organizationService, type Organization } from '@/services/OrganizationService';
import { notifications } from '@mantine/notifications';

export default function FeatureOverridesPage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<OverrideType>('feature');
  const [processing, setProcessing] = useState(false);
  
  // Dropdown data
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tiers, setTiers] = useState<DbTier[]>([]);
  const [featuredLimits, setFeaturedLimits] = useState<any>(null);
  const [tenantLimits, setTenantLimits] = useState<any>(null);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Form state for new override
  const [newOverride, setNewOverride] = useState({
    organizationId: '',
    tenantId: '',
    feature: '',
    featureName: '',
    subscriptionTier: '',
    customPrice: '',
    currency: 'USD',
    billingInterval: 'monthly' as 'monthly' | 'yearly',
    limitType: 'locations' as 'locations' | 'skus',
    customLimit: '',
    featuredType: '',
    reason: '',
    expiresAt: ''
  });

  useEffect(() => {
    fetchOverrides();
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      setLoadingDropdowns(true);
      
      // Fetch all data in parallel
      const [orgs, tenantsData, tiersData, featuredData, tenantLimitsData] = await Promise.allSettled([
        fetchOrganizations(),
        fetchTenants(),
        fetchTiers(),
        fetchFeaturedLimits(),
        fetchTenantLimits()
      ]);
      
      if (orgs.status === 'fulfilled') setOrganizations(orgs.value);
      if (tenantsData.status === 'fulfilled') setTenants(tenantsData.value);
      if (tiersData.status === 'fulfilled') setTiers(tiersData.value);
      if (featuredData.status === 'fulfilled') setFeaturedLimits(featuredData.value);
      if (tenantLimitsData.status === 'fulfilled') setTenantLimits(tenantLimitsData.value);
      
    } catch (error) {
      console.error('Failed to fetch dropdown data:', error);
      notifications.show({
        title: 'Warning',
        message: 'Failed to load dropdown options',
        color: 'yellow',
      });
    } finally {
      setLoadingDropdowns(false);
    }
  };

  const fetchOrganizations = async (): Promise<Organization[]> => {
    const response = await fetch('/api/organizations');
    if (!response.ok) throw new Error('Failed to fetch organizations');
    return response.json();
  };

  const fetchTenants = async (): Promise<Tenant[]> => {
    const data = await tenantTierService.getAdminTierTenants();
    return data || [];
  };

  const fetchTiers = async (): Promise<DbTier[]> => {
    const data = await tenantTierService.getAdminTiers();
    return data || [];
  };

  const fetchFeaturedLimits = async () => {
    const response = await fetch('/api/tenant-limits/featured-products/all');
    if (!response.ok) throw new Error('Failed to fetch featured limits');
    return response.json();
  };

  const fetchTenantLimits = async () => {
    const response = await fetch('/api/tenant-limits/tiers');
    if (!response.ok) throw new Error('Failed to fetch tenant limits');
    return response.json();
  };

  const fetchOverrides = async () => {
    try {
      setLoading(true);
      const data = await featureOverridesService.getOverrides();
      if (data && Array.isArray(data)) {
        setOverrides(data);
      } else {
        // Fallback to mock data if API fails
        const mockOverrides: Override[] = [
          {
            id: '1',
            tenantId: 'tid-abc123',
            tenantName: 'Premium Store',
            type: 'feature',
            feature: 'advanced_analytics',
            featureName: 'Advanced Analytics',
            status: 'active',
            reason: 'Premium tier customer requested early access',
            approvedBy: 'admin@platform.com',
            approvedAt: '2024-01-15T10:30:00Z',
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
            expiresAt: '2024-04-15T10:30:00Z'
          },
          {
            id: '2',
            tenantId: 'tid-def456',
            tenantName: 'Test Store',
            type: 'feature',
            feature: 'bulk_import',
            featureName: 'Bulk Import',
            status: 'revoked',
            reason: 'Testing period completed',
            approvedBy: 'admin@platform.com',
            approvedAt: '2024-01-10T15:45:00Z',
            createdAt: '2024-01-10T15:45:00Z',
            updatedAt: '2024-01-10T15:45:00Z',
            expiresAt: null
          }
        ];
        setOverrides(mockOverrides);
      }
    } catch (error) {
      console.error('Failed to fetch overrides:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load overrides. Using mock data.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOverrides = (overrides || []).filter(override =>
    (override.organizationName || override.tenantName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (override.type === 'feature' ? override.featureName : 
     override.type === 'pricing' ? `Pricing Override` : 
     override.type === 'limits' ? `Limits Override` :
     override.type === 'featured_products' ? `Featured Products Override` :
     override.type === 'tenant_limits' ? `Tenant Limits Override` :
     `${(override as any).type} Override`).toLowerCase().includes(searchTerm.toLowerCase()) ||
    override.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper functions
  const getAllFeatures = () => {
    const featureSet = new Set<string>();
    tiers.forEach(tier => {
      tier.features.forEach(feature => featureSet.add(feature));
    });
    
    // Common feature mappings
    const featureMap: Record<string, string> = {
      'google_shopping': 'Google Shopping',
      'google_merchant_center': 'Google Merchant Center',
      'basic_product_pages': 'Basic Product Pages',
      'qr_codes_512': 'QR Codes (512px)',
      'performance_analytics': 'Performance Analytics',
      'quick_start_wizard': 'Quick Start Wizard',
      'manual_barcode': 'Manual Barcode Entry',
      'manual_entry': 'Manual Entry',
      'basic_search': 'Basic Search',
      'bulk_import': 'Bulk Import',
      'categories': 'Categories',
      'square_sync': 'Square Sync',
      'clover_sync': 'Clover Sync',
      'storefront': 'Storefront',
      'product_search': 'Product Search',
      'mobile_responsive': 'Mobile Responsive',
      'enhanced_seo': 'Enhanced SEO',
      'basic_categories': 'Basic Categories',
      'image_gallery_5': 'Image Gallery (5 images)',
      'barcode_scan': 'Barcode Scanning',
      'google_sync': 'Google Sync',
      'quick_start_wizard_full': 'Quick Start Wizard (Full)',
      'product_scanning': 'Product Scanning',
      'gbp_integration': 'GBP Integration',
      'custom_branding': 'Custom Branding',
      'business_logo': 'Business Logo',
      'qr_codes_1024': 'QR Codes (1024px)',
      'interactive_maps': 'Interactive Maps',
      'privacy_mode': 'Privacy Mode',
      'custom_marketing_copy': 'Custom Marketing Copy',
      'priority_support': 'Priority Support',
      'qr_codes_2048': 'QR Codes (2048px)',
      'image_gallery_10': 'Image Gallery (10 images)',
      'custom_integrations': 'Custom Integrations',
      'advanced_analytics': 'Advanced Analytics',
      'api_access': 'API Access',
      'custom_domain': 'Custom Domain',
      'dedicated_account_manager': 'Dedicated Account Manager',
      'sla_guarantee': 'SLA Guarantee',
      'bulk_operations': 'Bulk Operations',
      'centralized_inventory': 'Centralized Inventory',
      'cross_location_reporting': 'Cross-Location Reporting',
      'custom_pricing': 'Custom Pricing',
      'location_groups': 'Location Groups',
      'multi_location': 'Multi-Location',
      'organization_dashboard': 'Organization Dashboard',
      'role_based_access': 'Role-Based Access',
      'unlimited_skus': 'Unlimited SKUs',
      'white_label': 'White Label',
      'chain_branding': 'Chain Branding',
      'franchise_management': 'Franchise Management',
      'chain_analytics': 'Chain Analytics',
      'regional_management': 'Regional Management',
      'chain_promotions': 'Chain Promotions',
      'master_catalog': 'Master Catalog',
      'location_templates': 'Location Templates',
      'propagation': 'Propagation',
      'propagation_hours': 'Propagation (Hours)',
      'propagation_products': 'Propagation (Products)',
      'propagation_categories': 'Propagation (Categories)',
      'enterprise_sso': 'Enterprise SSO'
    };

    return Array.from(featureSet).map(key => ({
      key,
      name: featureMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    })).sort((a, b) => a.name.localeCompare(b.name));
  };

  const getFeatureName = (key: string) => {
    const allFeatures = getAllFeatures();
    const feature = allFeatures.find(f => f.key === key);
    return feature?.name || key;
  };

  const getStatusBadge = (status: OverrideStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'revoked':
        return <Badge variant="error">Revoked</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'expired':
        return <Badge variant="default">Expired</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: OverrideType) => {
    switch (type) {
      case 'feature':
        return <Badge variant="info">Feature</Badge>;
      case 'pricing':
        return <Badge variant="success">Pricing</Badge>;
      case 'limits':
        return <Badge variant="warning">Limits</Badge>;
      case 'featured_products':
        return <Badge variant="info">Featured Products</Badge>;
      case 'tenant_limits':
        return <Badge variant="warning">Tenant Limits</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const handleCreateOverride = async () => {
    try {
      setProcessing(true);

      let result;
      switch (selectedType) {
        case 'feature':
          result = await featureOverridesService.createFeatureOverride({
            organizationId: newOverride.organizationId || undefined,
            tenantId: newOverride.tenantId || undefined,
            feature: newOverride.feature,
            featureName: newOverride.featureName,
            reason: newOverride.reason,
            expiresAt: newOverride.expiresAt || null
          });
          break;
        case 'pricing':
          result = await featureOverridesService.createPricingOverride({
            organizationId: newOverride.organizationId || undefined,
            tenantId: newOverride.tenantId || undefined,
            subscriptionTier: newOverride.subscriptionTier,
            customPrice: parseFloat(newOverride.customPrice),
            currency: newOverride.currency,
            billingInterval: newOverride.billingInterval,
            reason: newOverride.reason,
            expiresAt: newOverride.expiresAt || null
          });
          break;
        case 'limits':
          result = await featureOverridesService.createLimitsOverride({
            organizationId: newOverride.organizationId || undefined,
            tenantId: newOverride.tenantId || undefined,
            subscriptionTier: newOverride.subscriptionTier,
            limitType: newOverride.limitType,
            customLimit: parseInt(newOverride.customLimit),
            reason: newOverride.reason,
            expiresAt: newOverride.expiresAt || null
          });
          break;
        case 'featured_products':
          result = await featureOverridesService.createFeaturedProductsOverride({
            organizationId: newOverride.organizationId || undefined,
            tenantId: newOverride.tenantId || undefined,
            subscriptionTier: newOverride.subscriptionTier,
            featuredType: newOverride.featuredType,
            customLimit: parseInt(newOverride.customLimit),
            reason: newOverride.reason,
            expiresAt: newOverride.expiresAt || null
          });
          break;
        case 'tenant_limits':
          result = await featureOverridesService.createTenantLimitsOverride({
            organizationId: newOverride.organizationId || undefined,
            tenantId: newOverride.tenantId || undefined,
            subscriptionTier: newOverride.subscriptionTier,
            customLimit: parseInt(newOverride.customLimit),
            reason: newOverride.reason,
            expiresAt: newOverride.expiresAt || null
          });
          break;
      }

      if (result) {
        notifications.show({
          title: 'Success',
          message: `Successfully created ${selectedType} override`,
          color: 'green',
        });
        setShowCreateModal(false);
        resetForm();
        await fetchOverrides(); // Refresh the list
      } else {
        throw new Error('Failed to create override');
      }
    } catch (error: any) {
      console.error('Failed to create override:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create override. Please try again.',
        color: 'red',
      });
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setNewOverride({
      organizationId: '',
      tenantId: '',
      feature: '',
      featureName: '',
      subscriptionTier: '',
      customPrice: '',
      currency: 'USD',
      billingInterval: 'monthly' as 'monthly' | 'yearly',
      limitType: 'locations' as 'locations' | 'skus',
      customLimit: '',
      featuredType: '',
      reason: '',
      expiresAt: ''
    });
  };

  const handleTypeChange = (type: OverrideType) => {
    setSelectedType(type);
    resetForm();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Feature Overrides"
          description="Grant or revoke tier features, pricing, and limits for specific tenants and organizations"
          icon={Icons.Settings}
        />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Overrides"
        description="Grant or revoke tier features, pricing, and limits for specific tenants and organizations"
        icon={Icons.Settings}
      />

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by tenant, organization, override type, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" />
              New Override
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Overrides</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overrides.filter(o => o.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revoked Overrides</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overrides.filter(o => o.status === 'revoked').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Overrides</p>
                <p className="text-2xl font-bold text-gray-900">{overrides.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Plus className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overrides.filter(o => o.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overrides List */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Overrides</CardTitle>
          <CardDescription>
            Manage feature access, pricing, and limit overrides for specific tenants and organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredOverrides.map((override) => (
              <div
                key={override.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {override.organizationName || override.tenantName}
                      </h3>
                      {getTypeBadge(override.type)}
                      {getStatusBadge(override.status)}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {override.type === 'feature' && (
                        <p>
                          <span className="font-medium">Feature:</span> {override.featureName}
                        </p>
                      )}
                      {override.type === 'pricing' && (
                        <p>
                          <span className="font-medium">Pricing Override:</span> Custom pricing for {override.subscriptionTier}
                        </p>
                      )}
                      {override.type === 'limits' && (
                        <p>
                          <span className="font-medium">Limits Override:</span> Custom {override.limitType} limit for {override.subscriptionTier}
                        </p>
                      )}
                      {override.type === 'featured_products' && (
                        <p>
                          <span className="font-medium">Featured Products Override:</span> Custom {override.featuredType} limit for {override.subscriptionTier}
                        </p>
                      )}
                      {override.type === 'tenant_limits' && (
                        <p>
                          <span className="font-medium">Tenant Limits Override:</span> Custom location limit for {override.subscriptionTier}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Reason:</span> {override.reason}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <span>
                          Approved by {override.approvedBy}
                        </span>
                        <span>
                          on {new Date(override.approvedAt).toLocaleDateString()}
                        </span>
                        {override.expiresAt && (
                          <span className="text-orange-600">
                            Expires {new Date(override.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredOverrides.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No overrides found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Override Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Override"
        description="Create a new feature, pricing, or limits override"
      >
        <div className="space-y-4">
          {/* Override Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Override Type *</label>
            <div className="flex gap-2">
              {(['feature', 'pricing', 'limits', 'featured_products', 'tenant_limits'] as OverrideType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    selectedType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {type === 'featured_products' ? 'Featured Products' : 
                   type === 'tenant_limits' ? 'Tenant Limits' :
                   type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Organization/Tenant Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
            <Select
              value={newOverride.organizationId}
              onChange={(e) => setNewOverride(prev => ({ ...prev, organizationId: e.target.value }))}
              disabled={loadingDropdowns}
            >
              <option value="">Select organization (optional)</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
            <Select
              value={newOverride.tenantId}
              onChange={(e) => setNewOverride(prev => ({ ...prev, tenantId: e.target.value }))}
              disabled={loadingDropdowns}
            >
              <option value="">Select tenant (optional)</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.subscription_tier})
                </option>
              ))}
            </Select>
          </div>

          {/* Type-specific fields */}
          {selectedType === 'feature' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Feature *</label>
                <Select
                  value={newOverride.feature}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, feature: e.target.value, featureName: getFeatureName(e.target.value) }))}
                  required
                >
                  <option value="">Select feature</option>
                  {getAllFeatures().map((feature) => (
                    <option key={feature.key} value={feature.key}>
                      {feature.name}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          {selectedType === 'pricing' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Tier *</label>
                <Select
                  value={newOverride.subscriptionTier}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, subscriptionTier: e.target.value }))}
                  required
                >
                  <option value="">Select tier</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.displayName} (${tier.price})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Price *</label>
                <Input
                  type="number"
                  value={newOverride.customPrice}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, customPrice: e.target.value }))}
                  placeholder="199.99"
                  required
                />
              </div>
            </>
          )}

          {selectedType === 'limits' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Tier *</label>
                <Select
                  value={newOverride.subscriptionTier}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, subscriptionTier: e.target.value }))}
                  required
                >
                  <option value="">Select tier</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.displayName} (${tier.price})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limit Type *</label>
                <select
                  value={newOverride.limitType}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, limitType: e.target.value as 'locations' | 'skus' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="locations">Max Locations</option>
                  <option value="skus">Max SKUs</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Limit *</label>
                <Input
                  type="number"
                  value={newOverride.customLimit}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, customLimit: e.target.value }))}
                  placeholder="10"
                  required
                />
              </div>
            </>
          )}

          {selectedType === 'featured_products' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Tier *</label>
                <Select
                  value={newOverride.subscriptionTier}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, subscriptionTier: e.target.value }))}
                  required
                >
                  <option value="">Select tier</option>
                  {featuredLimits?.tiers?.map((tier: string) => (
                    <option key={tier} value={tier}>
                      {tier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Featured Type *</label>
                <Select
                  value={newOverride.featuredType}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, featuredType: e.target.value }))}
                  required
                >
                  <option value="">Select featured type</option>
                  {featuredLimits && newOverride.subscriptionTier && featuredLimits.limits[newOverride.subscriptionTier] && 
                    Object.keys(featuredLimits.limits[newOverride.subscriptionTier]).map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))
                  }
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Limit *</label>
                <Input
                  type="number"
                  value={newOverride.customLimit}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, customLimit: e.target.value }))}
                  placeholder="5"
                  required
                />
              </div>
            </>
          )}

          {selectedType === 'tenant_limits' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Tier *</label>
                <Select
                  value={newOverride.subscriptionTier}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, subscriptionTier: e.target.value }))}
                  required
                >
                  <option value="">Select tier</option>
                  {tenantLimits?.tiers?.map((tier: any) => (
                    <option key={tier.tier} value={tier.tier}>
                      {tier.displayName} (Current: {tier.limit || 'Unlimited'})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Limit *</label>
                <Input
                  type="number"
                  value={newOverride.customLimit}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, customLimit: e.target.value }))}
                  placeholder="10"
                  required
                />
              </div>
            </>
          )}

          {/* Common fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Override *</label>
            <textarea
              value={newOverride.reason}
              onChange={(e) => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Explain why this override is needed..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date (optional)</label>
            <Input
              type="date"
              value={newOverride.expiresAt}
              onChange={(e) => setNewOverride(prev => ({ ...prev, expiresAt: e.target.value }))}
            />
          </div>
        </div>

        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setShowCreateModal(false)}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateOverride}
            disabled={processing}
            loading={processing}
          >
            {processing ? 'Creating...' : 'Create Override'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
