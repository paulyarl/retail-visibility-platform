import { Card, CardContent, Badge } from '@/components/ui';
import { Button } from '@mantine/core';
import { DbTier } from '../types';

interface BillingFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTierFilter: string;
  onTierFilterChange: (tier: string) => void;
  selectedStatusFilter: string;
  onStatusFilterChange: (status: string) => void;
  tiers: DbTier[];
  onClearFilters: () => void;
}

export default function BillingFilters({ searchQuery, onSearchChange, selectedTierFilter, onTierFilterChange, selectedStatusFilter, onStatusFilterChange, tiers, onClearFilters }: BillingFiltersProps) {
  const hasActiveFilters = searchQuery || selectedTierFilter !== 'all' || selectedStatusFilter !== 'all';

  // Create sorted tier options with multiple separators for filters
  const individualTiers = tiers
    .filter(t => !t.tierKey.startsWith('trial_') && t.tierKey !== 'expired_trial' && t.tierType === 'individual')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(t => ({ value: t.tierKey, label: t.displayName }));
  
  const organizationTiers = tiers
    .filter(t => !t.tierKey.startsWith('trial_') && t.tierKey !== 'expired_trial' && t.tierType === 'organization')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(t => ({ value: t.tierKey, label: t.displayName }));
  
  // Add trial tiers with proper sorting (excluding expired_trial)
  const trialTiers = [
    { value: 'trial_google_only', label: 'Trial: Google Only' },
    { value: 'trial_starter', label: 'Trial: Starter' },
    { value: 'trial_professional', label: 'Trial: Professional' },
    { value: 'trial_chain_starter', label: 'Trial: Chain Starter' },
  ];
  
  // Combine with multiple separators for filter dropdown
  const tierFilterOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: 'all', label: 'All Tiers' },
    ...individualTiers,
    { value: 'separator', label: '--- Organization Tiers ---', disabled: true },
    ...organizationTiers,
    { value: 'separator2', label: '--- Trials ---', disabled: true },
    ...trialTiers,
    { value: 'separator3', label: '--- Expired ---', disabled: true },
    { value: 'expired_trial', label: 'Expired Trial' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'separator', label: '--- Grace Period ---', disabled: true },
    { value: 'trial', label: 'Trial' },
    { value: 'past_due', label: 'Past Due' },
    { value: 'separator2', label: '--- Inactive ---', disabled: true },
    { value: 'canceled', label: 'Canceled' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, ID, location, or organization..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchQuery && (
                <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="w-full md:w-48">
            <select value={selectedTierFilter} onChange={(e) => onTierFilterChange(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900/50 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              {tierFilterOptions.map((option) => (
                <option 
                  key={option.value} 
                  value={option.value}
                  disabled={option.disabled}
                  className={option.disabled ? 'font-bold text-neutral-500' : ''}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select value={selectedStatusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900/50 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          {hasActiveFilters && <Button variant="secondary" onClick={onClearFilters}>Clear Filters</Button>}
        </div>
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchQuery && <Badge variant="default" className="bg-blue-100 text-blue-800">Search: "{searchQuery}"</Badge>}
            {selectedTierFilter !== 'all' && <Badge variant="default" className="bg-purple-100 text-purple-800">Tier: {tiers.find(t => t.tierKey === selectedTierFilter)?.displayName}</Badge>}
            {selectedStatusFilter !== 'all' && <Badge variant="default" className="bg-emerald-100 text-emerald-800">Status: {statusOptions.find(s => s.value === selectedStatusFilter)?.label}</Badge>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
