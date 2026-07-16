"use client";

import { useState, useEffect } from 'react';
import SetTenantId from '@/components/client/SetTenantId';
import FeaturedProductsManager from '@/components/tenant/FeaturedProductsManager';
import { ArrowLeft, Star, TrendingUp, Eye, MousePointer, BarChart3, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { tenantInfoService } from '@/services/TenantInfoService';
import TenantFeaturedAccessService from '@/services/TenantFeaturedAccessService';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { useFeaturedOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { clientLogger } from '@/lib/client-logger';

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
      case 'discovery':
        return { color: 'bg-green-100 text-green-700 border-green-300', icon: '📈', name: 'Discovery' };
      case 'commitment':
        return { color: 'bg-indigo-100 text-indigo-700 border-indigo-300', icon: '⭐', name: 'Commitment' };
      case 'storefront':
        return { color: 'bg-orange-100 text-orange-700 border-orange-300', icon: '🏢', name: 'Storefront' };
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
  const [featuredAccessApproved, setFeaturedAccessApproved] = useState<boolean>(false);
  const [merchantFeaturedEnabled, setMerchantFeaturedEnabled] = useState<boolean>(true);

  // Capability check for featured tier gating
  const featuredCap = useFeaturedOptionsCapability(tenantId);
  const isFeaturedEnabled = featuredCap.data?.enabled ?? true;
  const allowedTypes = featuredCap.data?.allowedTypes ?? [];
  // console.log(`FeaturedProductsSettings: featuredAccessApproved`, featuredAccessApproved, 'isFeaturedEnabled', isFeaturedEnabled, 'allowedTypes', allowedTypes);

  useEffect(() => {
    async function fetchTenant() {
      try {
        setLoading(true);
        setError(null);
        
        // Get tenantId from route params (Next.js 15+ async params)
        const resolvedParams = await params;
        const id = resolvedParams.tenantId;
        
        // Validate tenantId exists
        if (!id) {
          clientLogger.error('FeaturedProductsSettings: No tenantId provided in route params');
          return;
        }
        
        // Set the tenantId in state for use throughout the component
        setTenantId(id);
        
        // console.log('FeaturedProductsSettings: Fetching tenant', id);
        
        const tenantData = await tenantInfoService.getTenantInfo(id);
        if (tenantData) {
          // console.log('FeaturedProductsSettings: Tenant data received', tenantData);
          setTenant(tenantData);
          
          // Fetch featured access approval status (tenant-scoped, no admin required)
          try {
            const hasApprovedAccess = await TenantFeaturedAccessService.hasFeaturedAccess(id);
            // console.log(`FeaturedProductsSettings: Has approved access`, hasApprovedAccess);
            
            setFeaturedAccessApproved(hasApprovedAccess);
          } catch (approvalError) {
            clientLogger.error('FeaturedProductsSettings: Error fetching approval status', { detail: approvalError });
            setFeaturedAccessApproved(false); // Default to locked on error
          }

          // Fetch merchant preference for featured_enabled
          try {
            const optsSettings = await platformHomeService.getTenantFeaturedOptionsSettings(id);
            setMerchantFeaturedEnabled(optsSettings?.featured_enabled !== false);
          } catch (prefError) {
            clientLogger.error('FeaturedProductsSettings: Error fetching featured options settings', { detail: prefError });
            setMerchantFeaturedEnabled(true); // Default to enabled on error
          }
        } else {
          clientLogger.error('FeaturedProductsSettings: Failed to load tenant');
          setError('Failed to load tenant information');
        }
      } catch (err) {
        clientLogger.error('FeaturedProductsSettings: Error loading tenant', { detail: err });
        setError('Error loading tenant information');
        setDebug(err);
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, [params]);

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

  // Tier gate: if featured capability is disabled entirely, show locked state
  if (!isFeaturedEnabled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SetTenantId tenantId={tenant.id} />
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
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
            <Star className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-amber-800 mb-2">Featured Products Not Available</h2>
            <p className="text-amber-700 mb-4">
              Featured products are not included in your current plan. Upgrade to access promotional featuring for your products.
            </p>
            <Link
              href={`/t/${tenant.id}/settings`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </Link>
          </div>
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
          {!merchantFeaturedEnabled ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
              <Star className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-amber-800 mb-2">Featured Products Are Disabled</h2>
              <p className="text-amber-700 mb-6 max-w-lg mx-auto">
                You have turned off the featured products system in your settings. Product featuring is currently inactive and no featured sections will appear on your storefront or directory listing.
              </p>
              <Link
                href={`/t/${tenant.id}/settings/featured-options`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Star className="w-4 h-4" />
                Go to Featured Options to Re-enable
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Storefront Featuring:</strong> Managing storefront featured product types (New Arrivals, Seasonal, Staff Picks, Sale Items, Bestsellers, Clearance, Trending Now, Featured, Recommended)
                </p>
              </div>
              <FeaturedProductsManager 
                tenantId={tenant.id} 
                hasFeaturedAccess={featuredAccessApproved}
              />
            </>
          )}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-50 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Why Feature Your Products?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Highlight Your Best Products</h4>
                <p className="text-gray-600 text-sm">Badge labels like "New Arrival" and "On Sale" catch shopper attention immediately</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Increase Product Discovery</h4>
                <p className="text-gray-600 text-sm">Featured sections appear prominently on your storefront homepage</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <MousePointer className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Boost Conversion Rates</h4>
                <p className="text-gray-600 text-sm">Highlighted products convert up to 2x better than regular listings</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Curate Your Showcase</h4>
                <p className="text-gray-600 text-sm">Organize products into meaningful categories that guide shopper browsing</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/t/${tenant.id}/settings/featured-store`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Browse Featured Store
            </Link>
            <Link
              href={`/t/${tenant.id}/settings/products/badges/suggestions`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Star className="w-4 h-4" />
              Explore Badge Suggestions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
