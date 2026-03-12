"use client";

import { useState, useEffect } from 'react';
import { Store, Search, ArrowLeft, Star, Package, Users, Settings, ChevronDown } from 'lucide-react';
import FeaturedProductsManager from '@/components/tenant/FeaturedProductsManager';
import { tenantInfoService } from '@/services/TenantInfoService';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

interface AdminTenantFeaturedManagementProps {
  selectedTenant: string;
  setSelectedTenant: (tenantId: string) => void;
}

interface Tenant {
  id: string;
  name: string;
  subscription_tier?: string;
  city?: string;
  state?: string;
}

function SimpleTierBadge({ tier }: { tier: string }) {
  const getTierInfo = (tierLevel: string) => {
    switch (tierLevel) {
      case 'trial':
        return { color: 'bg-orange-100 text-orange-700 border-orange-300', icon: '🧪', name: 'Trial' };
      case 'google_only':
        return { color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '🔍', name: 'Google Only' };
      case 'starter':
        return { color: 'bg-neutral-100 text-neutral-700 border-neutral-300', icon: '🌱', name: 'Starter' };
      case 'growth':
        return { color: 'bg-green-100 text-green-700 border-green-300', icon: '📈', name: 'Growth' };
      case 'professional':
        return { color: 'bg-purple-100 text-purple-700 border-purple-300', icon: '⭐', name: 'Professional' };
      case 'enterprise':
        return { color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '🏢', name: 'Enterprise' };
      case 'organization':
        return { color: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-300', icon: '💎', name: 'Organization' };
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: '📦', name: tierLevel };
    }
  };

  const tierInfo = getTierInfo(tier);

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${tierInfo.color}`}>
      <span className="text-sm">{tierInfo.icon}</span>
      <span className="font-medium">{tierInfo.name}</span>
    </div>
  );
}

export default function AdminTenantFeaturedManagement({ selectedTenant, setSelectedTenant }: AdminTenantFeaturedManagementProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await platformHomeService.getAdminTierTenants();
      // console.log('[AdminTenantFeaturedManagement] Fetched tenants:', response);
      if (response) {
        setTenants(response);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tenant.city && tenant.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (tenant.state && tenant.state.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedTenantData = tenants.find(t => t.id === selectedTenant);

  if (!selectedTenant) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Store className="w-7 h-7 text-green-500" />
            Store Featured Products Management
          </h2>
          <p className="mt-2 text-gray-600">
            Select a tenant to manage their storefront featured products. These products appear in the tenant's storefront and are visible to customers.
          </p>
        </div>

        {/* Tenant Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Tenant</h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenants by name, ID, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Tenant Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading tenants...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  onClick={() => setSelectedTenant(tenant.id)}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-white"
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <h4 className="font-semibold text-gray-900">{tenant.name}</h4>
                    </div>
                    <div className="flex justify-end">
                      <SimpleTierBadge tier={tenant.subscription_tier || 'free'} />
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>ID: <span className="font-mono text-xs">{tenant.id.slice(0, 8)}...</span></p>
                    {(tenant.city || tenant.state) && (
                      <p>
                        Location: {tenant.city && tenant.state ? `${tenant.city}, ${tenant.state}` : tenant.city || tenant.state}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Click to manage</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredTenants.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tenants Found</h3>
              <p className="text-gray-600">
                {searchQuery ? 'Try adjusting your search terms' : 'No tenants available'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with Back Button */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setSelectedTenant('')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenant Selection
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Store className="w-7 h-7 text-blue-500" />
              {selectedTenantData?.name || 'Tenant'} Featured Products
            </h2>
            <p className="mt-2 text-gray-600">
              Managing featured products for {selectedTenantData?.name || 'selected tenant'}
            </p>
          </div>
          
          {selectedTenantData && (
            <div className="flex items-center gap-3">
              <SimpleTierBadge tier={selectedTenantData.subscription_tier || 'free'} />
              <div className="text-sm text-gray-600">
                <span className="font-mono text-xs">{selectedTenantData.id.slice(0, 8)}...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Storefront Context Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <Store className="w-5 h-5 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Store Featured Management</h3>
            <p className="text-sm text-green-700">
              Managing storefront featured products for {selectedTenantData?.name || 'the tenant'}. These products appear in the tenant's storefront.
            </p>
          </div>
        </div>
      </div>

      {/* Featured Products Manager */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <FeaturedProductsManager 
          tenantId={selectedTenant}
          context="storefront"
        />
      </div>
    </div>
  );
}
