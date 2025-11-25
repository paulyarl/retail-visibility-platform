"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Spinner, Alert } from '@/components/ui';
import { motion } from 'framer-motion';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

interface TierStats {
  totalTenants: number;
  totalOrganizations: number;
  totalTrialTenants: number;
  totalActiveTenants: number;
  estimatedMRR: number;
  tierDistribution: Array<{ tier: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}

interface Tenant {
  id: string;
  name: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  createdAt: string;
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
    subscriptionTier: string;
  };
  _count: {
    items: number;
  };
}

interface TierDefinition {
  id: string;
  name: string;
  displayName: string;
  price: number;
  maxSkus?: number;
  maxLocations?: number;
  description: string;
  type: string;
  features: string[];
  sortOrder?: number;
}

export default function TierManagementPage() {
  // Use centralized access control - platform admins only
  const {
    hasAccess,
    loading: accessLoading,
    isPlatformAdmin,
  } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [stats, setStats] = useState<TierStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tiers, setTiers] = useState<{ individual: TierDefinition[]; organization: TierDefinition[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    subscriptionTier: '',
    subscriptionStatus: '',
    reason: '',
  });
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const loadData = async () => {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        
        // Load stats
        const statsRes = await api.get(`${apiBaseUrl}/api/admin/tier-management/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Load tiers
        const tiersRes = await api.get(`${apiBaseUrl}/api/admin/tier-management/tiers`);
        if (tiersRes.ok) {
          const tiersData = await tiersRes.json();
          setTiers(tiersData);
        }

        // Load tenants
        const tenantsRes = await api.get(`${apiBaseUrl}/api/admin/tier-management/tenants?limit=1000`);
        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json();
          setTenants(tenantsData.tenants || []);
        }
      } catch (e) {
        console.error('Failed to load tier management data:', e);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (hasAccess) {
      loadData();
    }
  }, [hasAccess]);

  const getTierDisplayName = (tier: string) => {
    // Find tier in loaded tiers data
    if (tiers) {
      const allTiers = [...(tiers.individual || []), ...(tiers.organization || [])];
      const foundTier = allTiers.find(t => t.id === tier);
      if (foundTier) {
        return foundTier.displayName;
      }
    }
    
    // Fallback to hardcoded names for backwards compatibility
    const tierNames: Record<string, string> = {
      google_only: 'Google-Only',
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
      organization: 'Organization',
      chain_starter: 'Chain Starter',
      chain_professional: 'Chain Professional',
      chain_enterprise: 'Chain Enterprise',
    };
    return tierNames[tier] || tier;
  };

  const getTierBadgeColor = (tier: string) => {
    const colors: Record<string, string> = {
      google_only: 'bg-green-100 text-green-800',
      starter: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-amber-100 text-amber-800',
      organization: 'bg-gradient-to-br from-purple-500 to-pink-600 text-white',
      chain_starter: 'bg-blue-100 text-blue-800',
      chain_professional: 'bg-purple-100 text-purple-800',
      chain_enterprise: 'bg-amber-100 text-amber-800',
    };
    return colors[tier] || 'bg-neutral-100 text-neutral-800';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'trial':
        return <Badge variant="info">Trial</Badge>;
      case 'past_due':
        return <Badge variant="warning">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="default">Canceled</Badge>;
      case 'expired':
        return <Badge variant="error">Expired</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleUpdateTier = async () => {
    if (!selectedTenant || !updateForm.reason) {
      alert('Please provide a reason for the tier change');
      return;
    }

    setUpdating(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.patch(
        `${apiBaseUrl}/api/admin/tier-management/tenants/${selectedTenant.id}`,
        {
          subscriptionTier: updateForm.subscriptionTier || undefined,
          subscriptionStatus: updateForm.subscriptionStatus || undefined,
          reason: updateForm.reason,
        }
      );

      if (res.ok) {
        // Reload data
        const tenantsRes = await api.get(`${apiBaseUrl}/api/admin/tier-management/tenants?limit=1000`);
        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json();
          setTenants(tenantsData.tenants || []);
        }

        // Reload stats
        const statsRes = await api.get(`${apiBaseUrl}/api/admin/tier-management/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        setShowUpdateModal(false);
        setSelectedTenant(null);
        setUpdateForm({ subscriptionTier: '', subscriptionStatus: '', reason: '' });
      } else {
        const errorData = await res.json();
        alert(`Failed to update tier: ${errorData.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Failed to update tier:', e);
      alert('Failed to update tier');
    } finally {
      setUpdating(false);
    }
  };

  // Filter tenants
  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || tenant.subscriptionTier === tierFilter;
    const matchesStatus = statusFilter === 'all' || tenant.subscriptionStatus === statusFilter;
    return matchesSearch && matchesTier && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTenants = filteredTenants.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tierFilter, statusFilter]);

  // Access control checks
  if (accessLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Tier Management"
        pageDescription="Manage tenant subscription tiers"
        title="Platform Administrator Access Required"
        message="The Tier Management page is only accessible to platform administrators."
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Tier Management"
        description="Manage tenant subscription tiers and billing"
        icon={Icons.Admin}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <Alert variant="error" title="Error">
            {error}
          </Alert>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{stats.totalTenants}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Total Tenants</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{stats.totalActiveTenants}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Active</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{stats.totalTrialTenants}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Trial</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">{stats.totalOrganizations}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Organizations</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">${stats.estimatedMRR.toLocaleString()}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Est. MRR</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tier Distribution */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Tier Distribution</CardTitle>
              <CardDescription>Breakdown of tenants by subscription tier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.tierDistribution.map(({ tier, count }) => (
                  <div key={tier} className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{count}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{getTierDisplayName(tier)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              {/* Tier Filter */}
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="all">All Tiers</option>
                {tiers && (
                  <>
                    {(tiers.individual || []).map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.displayName}
                      </option>
                    ))}
                    {(tiers.organization || []).map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.displayName}
                      </option>
                    ))}
                  </>
                )}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="all">All Status</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Showing {filteredTenants.length} of {tenants.length} tenants
          </p>
        </div>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Subscriptions</CardTitle>
            <CardDescription>
              Showing {startIndex + 1}-{Math.min(endIndex, filteredTenants.length)} of {filteredTenants.length} tenant{filteredTenants.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTenants.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-600 dark:text-neutral-400">No tenants found</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {paginatedTenants.map((tenant, index) => (
                  <motion.div
                    key={tenant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="py-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">{tenant.name}</p>
                        {getStatusBadge(tenant.subscriptionStatus)}
                        <Badge className={getTierBadgeColor(tenant.subscriptionTier)}>
                          {getTierDisplayName(tenant.subscriptionTier)}
                        </Badge>
                        {tenant.organization && (
                          <Badge variant="default" className="bg-orange-100 text-orange-800">
                            Chain: {tenant.organization.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                        {tenant._count.items} SKUs • Created {new Date(tenant.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedTenant(tenant);
                        setUpdateForm({
                          subscriptionTier: tenant.subscriptionTier,
                          subscriptionStatus: tenant.subscriptionStatus,
                          reason: '',
                        });
                        setShowUpdateModal(true);
                      }}
                    >
                      Update Tier
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-4">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Update Modal */}
        {showUpdateModal && selectedTenant && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                Update Tier: {selectedTenant.name}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Subscription Tier
                  </label>
                  <select
                    value={updateForm.subscriptionTier}
                    onChange={(e) => setUpdateForm({ ...updateForm, subscriptionTier: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="">Select a tier...</option>
                    {tiers && (
                      <>
                        {/* Individual Tiers */}
                        <optgroup label="Individual Plans">
                          {(tiers.individual || []).map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.displayName} (${tier.price}/mo)
                              {tier.maxSkus && ` • ${tier.maxSkus.toLocaleString()} SKUs`}
                              {tier.maxLocations && ` • ${tier.maxLocations} locations`}
                            </option>
                          ))}
                        </optgroup>
                        {/* Organization Tiers */}
                        <optgroup label="Organization Plans">
                          {(tiers.organization || []).map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.displayName} (${tier.price}/mo)
                              {tier.maxSkus && ` • ${tier.maxSkus.toLocaleString()} SKUs`}
                              {tier.maxLocations && ` • ${tier.maxLocations} locations`}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Subscription Status
                  </label>
                  <select
                    value={updateForm.subscriptionStatus}
                    onChange={(e) => setUpdateForm({ ...updateForm, subscriptionStatus: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="canceled">Canceled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Reason (Required for audit trail)
                  </label>
                  <textarea
                    value={updateForm.reason}
                    onChange={(e) => setUpdateForm({ ...updateForm, reason: e.target.value })}
                    placeholder="e.g., Customer upgraded to Professional tier via sales call"
                    rows={3}
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Current:</strong> {getTierDisplayName(selectedTenant.subscriptionTier)} ({selectedTenant.subscriptionStatus})
                    <br />
                    <strong>SKUs:</strong> {selectedTenant._count.items}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="primary"
                  onClick={handleUpdateTier}
                  disabled={updating || !updateForm.reason}
                >
                  {updating ? <Spinner size="sm" /> : 'Update Tier'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedTenant(null);
                    setUpdateForm({ subscriptionTier: '', subscriptionStatus: '', reason: '' });
                  }}
                  disabled={updating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
