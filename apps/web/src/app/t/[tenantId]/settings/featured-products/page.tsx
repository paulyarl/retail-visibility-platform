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
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  useEffect(() => {
    async function fetchTenant() {
      try {
        setLoading(true);
        setError(null);
        
        // Get tenantId from URL
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('tenantId') || 'tid-m8ijkrnk';
        
        console.log('FeaturedProductsSettings: Fetching tenant', id);
        
        const response = await apiRequest(`/api/tenants/${id}`);
        if (response.ok) {
          const data = await response.json();
          console.log('FeaturedProductsSettings: Tenant data received', data);
          setTenant(data);
        } else {
          const errorText = await response.text();
          console.error('FeaturedProductsSettings: Failed to load tenant', errorText);
          setError(`Failed to load tenant information: ${response.status}`);
        }
      } catch (err) {
        console.error('FeaturedProductsSettings: Error loading tenant', err);
        setError('Error loading tenant information');
        setDebug(err);
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading featured products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">⚠️</div>
          <p className="text-gray-600 mb-4">{error}</p>
          {debug && (
            <details className="text-left bg-gray-100 p-4 rounded text-xs">
              <summary>Debug Info</summary>
              <pre>{JSON.stringify(debug, null, 2)}</pre>
            </details>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-4">📦</div>
          <p className="text-gray-600">Tenant not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SetTenantId tenantId={tenant.id} />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href={`/t/${tenant.id}/settings`} className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Settings
              </Link>
              <div className="flex items-center">
                <Star className="w-6 h-6 text-amber-500 mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">Featured Products</h1>
              </div>
              <SimpleTierBadge tier={tenant.subscription_tier} />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Multi-Type Featuring:</strong> Managing all featured product types (Store Selection, New Arrivals, Seasonal, Sale, Staff Picks)
            </p>
          </div>
          <FeaturedProductsManager tenantId={tenant.id} />
        </div>
      </div>
    </div>
  );
}
