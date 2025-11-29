'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GBPCategoryCard from '@/components/settings/GBPCategoryCard';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

export default function GBPCategoryPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Centralized access control - Platform Support or Tenant Admin
  const { hasAccess, loading: accessLoading, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get(`/api/tenant/profile?tenant_id=${tenantId}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error('[GBPCategoryPage] Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      loadProfile();
    }
  }, [tenantId]);

  // Access control checks
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Admin Access Required"
        message="You need tenant administrator privileges to manage Google Business Profile category."
        userRole={tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-600 mb-4">
        <Link href={`/t/${tenantId}/settings`} className="hover:text-gray-900">Settings</Link>
        {' '}/{' '}
        <span className="text-gray-900 font-medium">GBP Business Category</span>
      </nav>

      <PageHeader
        title="Google Business Profile Category"
        description="Manage your primary business category for Google Business Profile"
      />

      {/* Clarification Card */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          What's the difference?
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
          <strong>Business Category</strong> (this page) describes your store type for Google Business Profile 
          (e.g., "Grocery store", "Clothing store"). <strong>Product Categories</strong> organize 
          individual items you sell (e.g., "Dairy", "Produce", "Men's Apparel").
        </p>
        <Link 
          href={`/t/${tenantId}/categories`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 underline"
        >
          Manage Product Categories
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="mt-6 space-y-6">
        <GBPCategoryCard
          tenantId={tenantId}
          initialPrimary={
            profile?.gbpCategoryId && profile?.gbpCategoryName
              ? { id: profile.gbpCategoryId, name: profile.gbpCategoryName }
              : null
          }
          initialSecondary={profile?.gbpSecondaryCategories || []}
          syncStatus={profile?.gbpCategorySyncStatus}
          lastSynced={profile?.gbpCategoryLastMirrored}
        />

        {/* Quick Start Guide */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
            🚀 Quick Start Guide
          </h3>
          
          {/* How It Works */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700 mb-6">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How It Works
            </h4>
            <ol className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                <span><strong>Select Primary Category:</strong> Choose from dropdown or search for your main business type (required)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                <span><strong>Add Secondary Categories:</strong> Add up to 9 additional categories that describe your business (optional)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                <span><strong>Save & Sync:</strong> Your categories automatically sync to your directory listing</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">4.</span>
                <span><strong>View Mappings:</strong> See which directory categories your GBP categories map to</span>
              </li>
            </ol>
          </div>

          {/* Popular Categories */}
          <div className="mb-6">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">Popular Retail Categories</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Food & Beverage</h5>
                <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                  <li>• Grocery store</li>
                  <li>• Convenience store</li>
                  <li>• Supermarket</li>
                  <li>• Liquor store</li>
                </ul>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">General Retail</h5>
                <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                  <li>• Clothing store</li>
                  <li>• Electronics store</li>
                  <li>• Furniture store</li>
                  <li>• Hardware store</li>
                </ul>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Health & Beauty</h5>
                <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                  <li>• Pharmacy</li>
                  <li>• Beauty supply store</li>
                  <li>• Cosmetics store</li>
                </ul>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Specialty Stores</h5>
                <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                  <li>• Book store</li>
                  <li>• Pet store</li>
                  <li>• Toy store</li>
                  <li>• Sporting goods store</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tips & Best Practices */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Tips & Best Practices
            </h4>
            <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">💡</span>
                <span><strong>Primary First:</strong> Your primary category is most important for Google search results</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">🎯</span>
                <span><strong>Be Specific:</strong> "Grocery store" is better than just "store"</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">🔍</span>
                <span><strong>Can't Find It?</strong> Click "🔍 Can't find it? Search" to search thousands of categories</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">🔗</span>
                <span><strong>Check Mappings:</strong> After saving, see which directory categories your store will appear in</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">⚠️</span>
                <span><strong>Unmapped Warning:</strong> If a category shows "unmapped", your store won't appear in that directory category page</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
