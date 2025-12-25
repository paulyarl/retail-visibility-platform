"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Badge, AnimatedCard, Spinner } from '@/components/ui';
import { motion } from 'framer-motion';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api, API_BASE_URL } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

type PropagationSection = {
  title: string;
  description: string;
  action: () => void;
  icon: React.ReactNode;
  color: string;
  stats: string;
  badge?: string;
  disabled?: boolean;
};

type PropagationGroup = {
  title: string;
  description: string;
  sections: PropagationSection[];
};


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function PropagationControlPanel() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  // Use centralized access control system
  const { 
    hasAccess, 
    loading: accessLoading, 
    tenantRole,
    organizationData,
    tenantData,
    isPlatformAdmin: userIsPlatformAdmin,
  } = useAccessControl(
    tenantId,
    AccessPresets.CHAIN_PROPAGATION,
    true // Fetch organization data
  );

  const [organizationInfo, setOrganizationInfo] = useState<{
    id: string;
    name: string;
    tenants: Array<{ id: string; name: string; isHero: boolean }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHeroLocation, setIsHeroLocation] = useState(false);

  // Modal states
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showBusinessHoursModal, setShowBusinessHoursModal] = useState(false);
  const [showFeatureFlagsModal, setShowFeatureFlagsModal] = useState(false);
  const [showUserRolesModal, setShowUserRolesModal] = useState(false);
  const [showBrandAssetsModal, setShowBrandAssetsModal] = useState(false);
  const [showBusinessProfileModal, setShowBusinessProfileModal] = useState(false);

  // Business Hours propagation state
  const [includeSpecialHours, setIncludeSpecialHours] = useState(true);
  const [propagating, setPropagating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Feature Flags propagation state
  const [featureFlagsMode, setFeatureFlagsMode] = useState<'create_only' | 'update_only' | 'create_or_update'>('create_or_update');

  // User Roles propagation state
  const [userRolesMode, setUserRolesMode] = useState<'create_only' | 'update_only' | 'create_or_update'>('create_or_update');

  // Load organization info from the access control hook data
  useEffect(() => {
    if (organizationData && tenantData) {
      const tenantsWithHeroFlag = organizationData.tenants?.map((t: any) => ({
        id: t.id,
        name: t.name,
        isHero: t.metadata?.isHeroLocation === true
      })) || [];
      
      setOrganizationInfo({
        id: organizationData.id,
        name: organizationData.name,
        tenants: tenantsWithHeroFlag
      });
      
      setIsHeroLocation(tenantData.metadata?.isHeroLocation === true);
      setLoading(false);
    } else if (!accessLoading) {
      setLoading(false);
    }
  }, [organizationData, tenantData, accessLoading]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  async function propagateBusinessHours() {
    try {
      setPropagating(true);
      setShowBusinessHoursModal(false);

      const res = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/business-hours/propagate`, {
        includeSpecialHours
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to propagate business hours');
      }

      const result = await res.json();
      const summary = `Regular hours: ${result.data.regularHoursUpdated}, Special hours: ${result.data.specialHoursCreated + result.data.specialHoursUpdated}`;
      showToast('success', `Successfully propagated business hours to ${result.data.totalLocations} locations (${summary})`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to propagate business hours');
    } finally {
      setPropagating(false);
    }
  }

  async function propagateFeatureFlags() {
    try {
      setPropagating(true);
      setShowFeatureFlagsModal(false);

      const res = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/feature-flags/propagate`, {
        mode: featureFlagsMode
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to propagate feature flags');
      }

      const result = await res.json();
      const summary = `Created: ${result.data.created}, Updated: ${result.data.updated}, Skipped: ${result.data.skipped}`;
      showToast('success', `Successfully propagated ${result.data.totalFlags} feature flags to ${result.data.totalLocations} locations (${summary})`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to propagate feature flags');
    } finally {
      setPropagating(false);
    }
  }

  async function propagateUserRoles() {
    try {
      setPropagating(true);
      setShowUserRolesModal(false);

      const res = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/user-roles/propagate`, {
        mode: userRolesMode
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to propagate user roles');
      }

      const result = await res.json();
      const summary = `Created: ${result.data.created}, Updated: ${result.data.updated}, Skipped: ${result.data.skipped}`;
      showToast('success', `Successfully propagated ${result.data.totalUsers} user roles to ${result.data.totalLocations} locations (${summary})`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to propagate user roles');
    } finally {
      setPropagating(false);
    }
  }

  async function propagateBrandAssets() {
    try {
      setPropagating(true);
      setShowBrandAssetsModal(false);

      const res = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/brand-assets/propagate`);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to propagate brand assets');
      }

      const result = await res.json();
      showToast('success', `Successfully propagated brand assets to ${result.data.totalLocations} locations (${result.data.updated} updated)`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to propagate brand assets');
    } finally {
      setPropagating(false);
    }
  }

  async function propagateBusinessProfile() {
    try {
      setPropagating(true);
      setShowBusinessProfileModal(false);

      const res = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/business-profile/propagate`);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to propagate business profile');
      }

      const result = await res.json();
      showToast('success', `Successfully propagated business profile to ${result.data.totalLocations} locations (${result.data.updated} updated)`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to propagate business profile');
    } finally {
      setPropagating(false);
    }
  }

  const propagationGroups: PropagationGroup[] = [
    {
      title: 'Product & Catalog Management',
      description: 'Propagate products, categories, and catalog structure',
      sections: [
        {
          title: 'Categories',
          description: 'Propagate product categories and Google taxonomy alignments',
          action: () => setShowCategoriesModal(true),
          icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
          color: 'bg-purple-500',
          stats: 'Bulk propagation',
          badge: 'ACTIVE',
        },
        {
          title: 'Products/SKUs',
          description: 'Propagate individual or bulk products to locations',
          action: () => setShowItemsModal(true),
          icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
          color: 'bg-blue-500',
          stats: 'Single or bulk',
          badge: 'ACTIVE',
        },
      ],
    },
    {
      title: 'Business Information',
      description: 'Propagate business hours, profile, and operational details',
      sections: [
        {
          title: 'Business Hours',
          description: 'Propagate regular and special hours to all locations',
          action: () => setShowBusinessHoursModal(true),
          icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
          color: 'bg-green-500',
          stats: 'Hours template',
          badge: 'NEW',
        },
        {
          title: 'Business Profile',
          description: 'Propagate business description, attributes, and settings',
          action: () => setShowBusinessProfileModal(true),
          icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
          color: 'bg-cyan-500',
          stats: 'Profile info',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Configuration & Settings',
      description: 'Propagate feature flags, permissions, and system settings',
      sections: [
        {
          title: 'Feature Flags',
          description: 'Enable or disable features across all locations',
          action: () => setShowFeatureFlagsModal(true),
          icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>,
          color: 'bg-indigo-500',
          stats: 'Centralized control',
          badge: 'NEW',
        },
        {
          title: 'User Roles & Permissions',
          description: 'Propagate user invitations and role assignments',
          action: () => setShowUserRolesModal(true),
          icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
          color: 'bg-pink-500',
          stats: 'Team management',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Branding & Assets',
      description: 'Propagate logos, colors, and brand identity',
      sections: [
        {
          title: 'Brand Assets',
          description: 'Propagate logos, colors, and branding elements',
          action: () => setShowBrandAssetsModal(true),
          icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
          color: 'bg-orange-500',
          stats: 'Brand consistency',
          badge: 'NEW',
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Access denied for non-owner/admin users
  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Propagation Control Panel"
        pageDescription="Manage multi-location propagation"
        title="Access Restricted"
        message="The Propagation Control Panel requires Starter tier or higher with multiple locations. You must be an owner or administrator to access propagation features."
        userRole={userIsPlatformAdmin ? 'Platform Admin' : tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  if (!organizationInfo) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <PageHeader
          title="Propagation Control Panel"
          description="Manage multi-location propagation"
          icon={Icons.Admin}
          backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-neutral-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Not Part of an Organization</h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  Propagation features are available when you have 2 or more locations. Upgrade to Starter tier or higher to manage multiple locations and use propagation tools.
                </p>
                <Link href={`/t/${tenantId}/settings/organization`} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Create or Join Organization
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Propagation Control Panel"
        description="Manage multi-location propagation for your chain"
        icon={Icons.Admin}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Getting Started Guide */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">🚀 Getting Started with Propagation</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Propagation allows you to efficiently manage multiple locations by copying configurations from a hero location to all other locations in your organization.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Prerequisites */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Prerequisites
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span><strong>Hero Location:</strong> Designate one location as the master in <Link href={`/t/${tenantId}/settings/organization`} className="underline hover:text-blue-600">Organization Settings</Link></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span><strong>Organization:</strong> All locations must be part of the same organization</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span><strong>Permissions:</strong> You must be an Owner or Admin</span>
                    </li>
                  </ul>
                </div>

                {/* Best Practices */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Best Practices
                  </h4>
                  <ul className="text-sm text-green-800 dark:text-green-200 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                      <span><strong>Test first:</strong> Try with 1-2 locations before propagating to all</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                      <span><strong>Use modes wisely:</strong> "Create Only" preserves local customizations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                      <span><strong>Backup important data:</strong> Some propagations overwrite existing data</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Common Scenarios */}
              <div>
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Common Scenarios
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                    <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">🆕 New Chain Setup</h5>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">Setting up a new chain with multiple locations</p>
                    <ol className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                      <li>1. Configure hero location completely</li>
                      <li>2. Propagate <strong>Categories</strong> (create_or_update)</li>
                      <li>3. Propagate <strong>Brand Assets</strong></li>
                      <li>4. Propagate <strong>Business Hours</strong></li>
                      <li>5. Propagate <strong>Feature Flags</strong></li>
                      <li>6. Add location-specific products</li>
                    </ol>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                    <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">🔄 Updating Existing Chain</h5>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">Rolling out changes to all locations</p>
                    <ol className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                      <li>1. Update hero location settings</li>
                      <li>2. Use <strong>update_only</strong> mode to preserve local data</li>
                      <li>3. Propagate specific features (e.g., new categories)</li>
                      <li>4. Verify changes at 1-2 locations</li>
                      <li>5. Monitor for errors in results</li>
                    </ol>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                    <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">👥 Team Expansion</h5>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">Adding team members across locations</p>
                    <ol className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                      <li>1. Add users to hero location</li>
                      <li>2. Assign appropriate roles</li>
                      <li>3. Propagate <strong>User Roles</strong> (create_only)</li>
                      <li>4. Preserves existing team members</li>
                      <li>5. New members get access to all locations</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Propagation Modes Guide */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Understanding Propagation Modes</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-purple-800 dark:text-purple-200 mb-1">✅ Create or Update</div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">Syncs everything - creates new and updates existing</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400"><strong>Use when:</strong> You want complete synchronization</p>
                  </div>
                  <div>
                    <div className="font-semibold text-purple-800 dark:text-purple-200 mb-1">➕ Create Only</div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">Only adds new items, skips existing ones</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400"><strong>Use when:</strong> You want to preserve local customizations</p>
                  </div>
                  <div>
                    <div className="font-semibold text-purple-800 dark:text-purple-200 mb-1">🔄 Update Only</div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">Only updates existing items, won't create new</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400"><strong>Use when:</strong> You want to update settings without adding new items</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hero Location Selector - Prominent Card */}
        <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-lg bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-neutral-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">Hero Location</h3>
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 font-semibold">
                    Required
                  </Badge>
                </div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4 font-medium">
                  ⚡ The hero location is the source of truth for all propagation operations. Data will be copied FROM this location TO other locations.
                </p>
                <div className="flex items-center gap-4">
                  <select
                    value={organizationInfo.tenants.find(t => t.isHero)?.id || ''}
                    onChange={async (e) => {
                      const newHeroId = e.target.value;
                      if (!newHeroId) return;
                      
                      if (confirm(`Set ${organizationInfo.tenants.find(t => t.id === newHeroId)?.name} as the hero location?`)) {
                        try {
                          const res = await api.put(`${API_BASE_URL}/organizations/${organizationInfo.id}/hero-location`, {
                            tenantId: newHeroId
                          });
                          
                          if (res.ok) {
                            // Reload organization info
                            const tenantRes = await api.get(`${API_BASE_URL}/tenants/${tenantId}`);
                            if (tenantRes.ok) {
                              const tenantData = await tenantRes.json();
                              if (tenantData.organizationId) {
                                const orgRes = await api.get(`${API_BASE_URL}/organizations/${tenantData.organizationId}`);
                                if (orgRes.ok) {
                                  const orgData = await orgRes.json();
                                  const tenantsWithHeroFlag = orgData.tenants?.map((t: any) => ({
                                    id: t.id,
                                    name: t.name,
                                    isHero: t.metadata?.isHeroLocation === true
                                  })) || [];
                                  
                                  setOrganizationInfo({
                                    id: orgData.id,
                                    name: orgData.name,
                                    tenants: tenantsWithHeroFlag
                                  });
                                  
                                  alert('✅ Hero location updated successfully!');
                                }
                              }
                            }
                          } else {
                            const error = await res.json();
                            alert(`❌ Failed to set hero location: ${error.message || 'Unknown error'}`);
                          }
                        } catch (err) {
                          alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                        }
                      }
                    }}
                    className="flex-1 px-4 py-3 text-base font-semibold border-2 border-purple-300 dark:border-purple-700 rounded-lg focus:ring-4 focus:ring-purple-500/50 focus:border-purple-500 bg-white dark:bg-neutral-800 text-purple-900 dark:text-purple-100 shadow-sm hover:border-purple-400 dark:hover:border-purple-600 transition-all cursor-pointer"
                  >
                    {organizationInfo.tenants.map((t) => (
                      <option key={t.id} value={t.id} className="font-semibold">
                        {t.isHero ? '⭐ ' : ''}{t.name}{t.isHero ? ' (Current Hero)' : ''}
                      </option>
                    ))}
                  </select>
                  {!organizationInfo.tenants.find(t => t.isHero) && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">No hero location set</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedCard delay={0} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Organization</p>
                  <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{organizationInfo.name}</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-between">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.1} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Locations</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{organizationInfo.tenants.length}</p>
                </div>
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.2} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Hero Location</p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                    {organizationInfo.tenants.find(t => t.isHero)?.name || 'Not set'}
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>

        {/* Propagation Groups */}
        <div className="space-y-10">
          {propagationGroups.map((group, groupIndex) => (
            <div key={group.title}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{group.title}</h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{group.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.sections.map((section, sectionIndex) => {
                  const cardIndex = groupIndex * 10 + sectionIndex;
                  return (
                    <motion.div
                      key={section.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: cardIndex * 0.05, duration: 0.3 }}
                    >
                      <button
                        onClick={section.action}
                        disabled={section.disabled}
                        className="w-full text-left group p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`${section.color} p-3 rounded-lg text-white shadow-sm flex-shrink-0`}>
                            {section.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {section.title}
                              </h3>
                              {section.badge && <Badge variant="info" className="text-xs">{section.badge}</Badge>}
                            </div>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{section.description}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">{section.stats}</p>
                          </div>
                          <svg className="w-5 h-5 text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Modals */}
        {showCategoriesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCategoriesModal(false)}>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Categories Propagation</h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">Category propagation is available on the Categories page.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowCategoriesModal(false)} className="px-4 py-2 border border-neutral-300 rounded-md hover:bg-neutral-50">Cancel</button>
                <Link href={`/t/${tenantId}/categories`} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Go to Categories</Link>
              </div>
            </div>
          </div>
        )}

        {showItemsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowItemsModal(false)}>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Products/SKUs Propagation</h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">Product propagation is available on the Items page and Organization settings.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowItemsModal(false)} className="px-4 py-2 border border-neutral-300 rounded-md hover:bg-neutral-50">Cancel</button>
                <Link href={`/t/${tenantId}/items`} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Go to Items</Link>
              </div>
            </div>
          </div>
        )}

        {/* Business Hours Modal */}
        {showBusinessHoursModal && organizationInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBusinessHoursModal(false)}>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Propagate Business Hours</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    This will copy business hours from <strong>{organizationInfo.tenants.find(t => t.isHero)?.name || 'hero location'}</strong> to all {organizationInfo.tenants.length - 1} other locations in your organization.
                  </p>
                </div>

                <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                  <input
                    type="checkbox"
                    id="includeSpecialHours"
                    checked={includeSpecialHours}
                    onChange={(e) => setIncludeSpecialHours(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="includeSpecialHours" className="text-sm font-medium text-neutral-900 dark:text-neutral-100 cursor-pointer">
                    Include special hours (holidays, closures)
                  </label>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> This will overwrite existing business hours at all locations. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowBusinessHoursModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={propagateBusinessHours}
                  disabled={propagating}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {propagating ? 'Propagating...' : 'Propagate Hours'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feature Flags Modal */}
        {showFeatureFlagsModal && organizationInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFeatureFlagsModal(false)}>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Propagate Feature Flags</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    This will copy feature flags from <strong>{organizationInfo.tenants.find(t => t.isHero)?.name || 'hero location'}</strong> to all {organizationInfo.tenants.length - 1} other locations.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Propagation Mode</label>
                  <select
                    value={featureFlagsMode}
                    onChange={(e) => setFeatureFlagsMode(e.target.value as any)}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-2 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="create_or_update">Create or Update (Sync All)</option>
                    <option value="create_only">Create Only (Skip Existing)</option>
                    <option value="update_only">Update Only (Skip New)</option>
                  </select>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                    {featureFlagsMode === 'create_or_update' && '✅ Creates new flags and updates existing ones'}
                    {featureFlagsMode === 'create_only' && '➕ Only creates flags that don\'t exist at locations'}
                    {featureFlagsMode === 'update_only' && '🔄 Only updates existing flags, won\'t create new ones'}
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> This will propagate flag states (enabled/disabled) and descriptions. Location-specific customizations may be overwritten in update modes.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowFeatureFlagsModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={propagateFeatureFlags}
                  disabled={propagating}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {propagating ? 'Propagating...' : 'Propagate Flags'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Roles Modal */}
        {showUserRolesModal && organizationInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowUserRolesModal(false)}>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Propagate User Roles</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    This will copy user roles from <strong>{organizationInfo.tenants.find(t => t.isHero)?.name || 'hero location'}</strong> to all {organizationInfo.tenants.length - 1} other locations.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Propagation Mode</label>
                  <select value={userRolesMode} onChange={(e) => setUserRolesMode(e.target.value as any)} className="w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-2 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="create_or_update">Create or Update (Sync All)</option>
                    <option value="create_only">Create Only (Skip Existing)</option>
                    <option value="update_only">Update Only (Skip New)</option>
                  </select>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                    {userRolesMode === 'create_or_update' && '✅ Adds new team members and updates existing roles'}
                    {userRolesMode === 'create_only' && '➕ Only adds team members that don\'t exist at locations'}
                    {userRolesMode === 'update_only' && '🔄 Only updates existing team members\' roles'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowUserRolesModal(false)} className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">Cancel</button>
                <button onClick={propagateUserRoles} disabled={propagating} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{propagating ? 'Propagating...' : 'Propagate Roles'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Brand Assets Modal */}
        {showBrandAssetsModal && organizationInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBrandAssetsModal(false)}>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Propagate Brand Assets</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    This will copy brand assets (logo, colors) from <strong>{organizationInfo.tenants.find(t => t.isHero)?.name || 'hero location'}</strong> to all {organizationInfo.tenants.length - 1} other locations.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> This will overwrite existing brand assets at all locations to ensure brand consistency.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowBrandAssetsModal(false)} className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">Cancel</button>
                <button onClick={propagateBrandAssets} disabled={propagating} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{propagating ? 'Propagating...' : 'Propagate Assets'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Business Profile Modal */}
        {showBusinessProfileModal && organizationInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBusinessProfileModal(false)}>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Propagate Business Profile</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    This will copy business profile information from <strong>{organizationInfo.tenants.find(t => t.isHero)?.name || 'hero location'}</strong> to all {organizationInfo.tenants.length - 1} other locations.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> This will overwrite existing business profile information at all locations for consistency.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowBusinessProfileModal(false)} className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">Cancel</button>
                <button onClick={propagateBusinessProfile} disabled={propagating} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{propagating ? 'Propagating...' : 'Propagate Profile'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-lg shadow-lg text-white max-w-md ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
