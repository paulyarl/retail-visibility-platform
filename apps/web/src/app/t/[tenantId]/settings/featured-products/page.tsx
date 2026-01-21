"use client";

import { useState, useEffect } from 'react';
import SetTenantId from '@/components/client/SetTenantId';
import FeaturedProductsManager from '@/components/tenant/FeaturedProductsManager';
import { ArrowLeft, Star } from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

interface Tenant {
  id: string;
  name: string;
  subscription_tier: string;
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
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${tierInfo.color}`}>
      <span className="text-lg">{tierInfo.icon}</span>
      <span className="font-semibold text-sm">{tierInfo.name}</span>
    </div>
  );
}

export default function FeaturedProductsSettings({ 
  params 
}: { 
  params: Promise<{ tenantId: string }> 
}) {
  const [tenantId, setTenantId] = useState<string>('');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initComponent = async () => {
      const resolvedParams = await params;
      const id = resolvedParams.tenantId;
      setTenantId(id);

      // Fetch tenant data
      try {
        const response = await apiRequest(`/api/tenants/${id}`, {
          cache: 'no-store'
        });

        if (response.ok) {
          const data = await response.json();
          setTenant(data);
        } else {
          console.error('Failed to fetch tenant:', response.status);
        }
      } catch (error) {
        console.error('Error fetching tenant:', error);
      } finally {
        setLoading(false);
      }
    };

    initComponent();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link
                  href={`/t/${tenantId}/settings`}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Star className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">
                      Featured Products Management
                    </h1>
                    <p className="text-sm text-gray-500">
                      Manage featured products for directory and storefront
                    </p>
                  </div>
                </div>
              </div>
              {tenant?.subscription_tier && (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Current Tier</p>
                    <SimpleTierBadge tier={tenant.subscription_tier} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <FeaturedProductsManager tenantId={tenantId} />
        </div>
      </div>
    </>
  );
}
