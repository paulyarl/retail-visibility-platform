'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GBPCategoryCard from '@/components/settings/GBPCategoryCard';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';

export default function GBPCategoryPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
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
          initialCategory={
            profile?.gbpCategoryId && profile?.gbpCategoryName
              ? { id: profile.gbpCategoryId, name: profile.gbpCategoryName }
              : null
          }
          syncStatus={profile?.gbpCategorySyncStatus}
          lastMirrored={profile?.gbpCategoryLastMirrored}
        />

        {/* Quick Start Guide */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
            🚀 Quick Start: Popular Retail Categories
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Food & Beverage</h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• Grocery store</li>
                <li>• Convenience store</li>
                <li>• Supermarket</li>
                <li>• Liquor store</li>
                <li>• Specialty food store</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">General Retail</h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• Clothing store</li>
                <li>• Shoe store</li>
                <li>• Electronics store</li>
                <li>• Furniture store</li>
                <li>• Hardware store</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Health & Beauty</h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• Pharmacy</li>
                <li>• Beauty supply store</li>
                <li>• Cosmetics store</li>
                <li>• Health and beauty shop</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Specialty Stores</h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• Book store</li>
                <li>• Pet store</li>
                <li>• Toy store</li>
                <li>• Sporting goods store</li>
                <li>• Gift shop</li>
              </ul>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Search Tips
            </h4>
            <ul className="space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
              <li>• <strong>Be specific:</strong> "Grocery store" is better than just "store"</li>
              <li>• <strong>Use common terms:</strong> Search for how customers would describe your business</li>
              <li>• <strong>Primary activity:</strong> Choose the category that best represents your main business</li>
              <li>• <strong>Type at least 2 characters</strong> to see search results</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
