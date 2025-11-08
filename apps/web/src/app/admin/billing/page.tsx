'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  organization?: {
    id: string;
    name: string;
  } | null;
  metadata?: { city?: string; state?: string };
}

interface DbTier {
  id: string;
  tierKey: string;
  displayName: string;
  priceMonthly: number;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
}

const ITEMS_PER_PAGE = 25;

export default function AdminBillingPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [dbTiers, setDbTiers] = useState<DbTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadTenants();
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      setTiersLoading(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.get(`${apiBaseUrl}/api/admin/tier-system/tiers`);
      if (res.ok) {
        const data = await res.json();
        setDbTiers(data.tiers || []);
      }
    } catch (e) {
      console.error('Failed to load tiers:', e);
    } finally {
      setTiersLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const res = await api.get('/api/tenants');
      const data = await res.json();
      setTenants(data);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierInfo = (tierKey?: string) => {
    const tier = dbTiers.find(t => t.tierKey === tierKey);
    return tier;
  };

  const getTierColor = (tierKey?: string) => {
    const tier = getTierInfo(tierKey);
    if (!tier) return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
    
    if (tier.tierType === 'organization') {
      return 'bg-gradient-to-r from-purple-500 to-pink-600 text-white';
    }
    
    const colors: Record<string, string> = {
      google_only: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      professional: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      enterprise: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    };
    return colors[tierKey || ''] || 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
  };

  if (loading || tiersLoading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Billing Dashboard"
          description="Loading..."
          icon={Icons.Settings}
          backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
        />
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  // Filter and search logic
  const filteredTenants = tenants.filter(tenant => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.metadata?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.metadata?.state?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.organization?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    // Tier filter
    const matchesTier = selectedTierFilter === 'all' || 
      tenant.subscriptionTier === selectedTierFilter;

    return matchesSearch && matchesTier;
  });

  // Generate dynamic summary from ALL tenants (not filtered)
  const tierSummary = dbTiers.map(tier => ({
    tierKey: tier.tierKey,
    displayName: tier.displayName,
    count: tenants.filter(t => t.subscriptionTier === tier.tierKey).length,
    color: getTierColor(tier.tierKey),
  }));

  const totalTenants = tenants.length;
  const filteredCount = filteredTenants.length;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTierFilter]);

  return mounted ? (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Billing Dashboard"
        description="View SKU usage, limits, and billing status across all tenants"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6 space-y-6">
        {/* Search and Filter Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by name, ID, location, or organization..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Tier Filter */}
              <div className="w-full md:w-64">
                <select
                  value={selectedTierFilter}
                  onChange={(e) => setSelectedTierFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Tiers ({totalTenants})</option>
                  {dbTiers.map(tier => (
                    <option key={tier.tierKey} value={tier.tierKey}>
                      {tier.displayName} ({tenants.filter(t => t.subscriptionTier === tier.tierKey).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || selectedTierFilter !== 'all') && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTierFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Active Filters Display */}
            {(searchQuery || selectedTierFilter !== 'all') && (
              <div className="mt-4 flex flex-wrap gap-2">
                {searchQuery && (
                  <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    Search: "{searchQuery}"
                  </Badge>
                )}
                {selectedTierFilter !== 'all' && (
                  <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    Tier: {dbTiers.find(t => t.tierKey === selectedTierFilter)?.displayName}
                  </Badge>
                )}
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Showing {filteredCount} of {totalTenants} tenants
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards - Dynamic from Database */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Total Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Tenants</div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{totalTenants}</div>
            </CardContent>
          </Card>
          
          {/* Dynamic Tier Cards */}
          {tierSummary.map(tier => (
            <Card key={tier.tierKey}>
              <CardContent className="pt-6">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">{tier.displayName}</div>
                <div className="text-3xl font-bold">
                  <Badge variant="default" className={tier.color}>
                    {tier.count}
                  </Badge>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                  {((tier.count / totalTenants) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tenant List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedTierFilter === 'all' ? 'All Tenants' : `${dbTiers.find(t => t.tierKey === selectedTierFilter)?.displayName} Tenants`}
              </CardTitle>
              {filteredTenants.length > 0 && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCount)} of {filteredCount}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredTenants.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">No tenants found</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {searchQuery || selectedTierFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'No tenants available'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTenants
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg mb-1">
                      <div className="font-bold text-primary-900 dark:text-primary-100">{tenant.name}</div>
                    </div>
                    {tenant.metadata?.city && tenant.metadata?.state && (
                      <div className="text-sm text-neutral-600">
                        {tenant.metadata.city}, {tenant.metadata.state}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className={getTierColor(tenant.subscriptionTier)}>
                      {getTierInfo(tenant.subscriptionTier)?.displayName || tenant.subscriptionTier || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              ))}
              </div>
            )}

            {/* Pagination Controls */}
            {filteredTenants.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Page {currentPage} of {Math.ceil(filteredCount / ITEMS_PER_PAGE)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredCount / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(filteredCount / ITEMS_PER_PAGE)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  ) : null;
}
