"use client";

import { useState, useEffect } from 'react';
import { Star, Settings, Package, Users, Search, AlertCircle } from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import FeaturedProductsManager from '@/components/tenant/FeaturedProductsManager';
import { Tenant } from '@/services/PlatformHomeSingletonService';

export default function AdminDirectoryFeaturedManagement() {
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantData, setSelectedTenantData] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant && tenants.length > 0) {
      const tenant = tenants.find(t => t.id === selectedTenant);
      setSelectedTenantData(tenant || null);
    } else {
      setSelectedTenantData(null);
    }
  }, [selectedTenant, tenants]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const result = await platformHomeService.getAdminTierTenants();
      if (result) {
        setTenants(result);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      'starter': 'bg-gray-100 text-gray-700',
      'professional': 'bg-blue-100 text-blue-700',
      'enterprise': 'bg-purple-100 text-purple-700'
    };
    return colors[tier] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Tenant Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Directory Featured Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage directory featured products for tenants. Directory featured products appear in premium directory listings.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Star className="w-4 h-4" />
            <span>Directory Context</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Tenant List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No tenants found</p>
            </div>
          ) : (
            filteredTenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => setSelectedTenant(tenant.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedTenant === tenant.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{tenant.name}</div>
                    <div className="text-sm text-gray-500 font-mono">{tenant.id.slice(0, 8)}...</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierColor(tenant.subscriptionTier || 'starter')}`}>
                      {tenant.subscriptionTier || 'starter'}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Selected Tenant Info */}
      {selectedTenant && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedTenantData?.name || 'Selected Tenant'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Managing directory featured products for this tenant
              </p>
            </div>

            {selectedTenantData && (
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getTierColor(selectedTenantData.subscriptionTier || 'starter')}`}>
                  {selectedTenantData.subscriptionTier || 'starter'}
                </span>
                <div className="text-sm text-gray-600">
                  <span className="font-mono text-xs">{selectedTenantData.id.slice(0, 8)}...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Featured Context Banner */}
      {selectedTenant && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-indigo-900">Premium Featured Management</h3>
              <p className="text-sm text-indigo-700">
                Managing premium featured products for {selectedTenantData?.name || 'the tenant'}. These products require admin approval and appear in premium placements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Featured Products Manager */}
      {selectedTenant && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <FeaturedProductsManager 
            tenantId={selectedTenant}
            context="directory"
            hasFeaturedAccess={selectedTenantData?.featured_access_approved && selectedTenantData?.subscription_status === 'active'}
          />
        </div>
      )}

      {/* No Tenant Selected */}
      {!selectedTenant && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Tenant</h3>
          <p className="text-gray-600">
            Choose a tenant from the list above to manage their premium featured products.
          </p>
        </div>
      )}
    </div>
  );
}
