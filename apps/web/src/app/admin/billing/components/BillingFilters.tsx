import { Card, CardContent, Badge, Button } from '@/components/ui';
import { DbTier } from '../types';

interface BillingFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTierFilter: string;
  onTierFilterChange: (tier: string) => void;
  tiers: DbTier[];
  onClearFilters: () => void;
}

export default function BillingFilters({
  searchQuery,
  onSearchChange,
  selectedTierFilter,
  onTierFilterChange,
  tiers,
  onClearFilters,
}: BillingFiltersProps) {
  const hasActiveFilters = searchQuery || selectedTierFilter !== 'all';

  return (
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
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
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
              onChange={(e) => onTierFilterChange(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Tiers</option>
              {tiers.map((tier) => (
                <option key={tier.tierKey} value={tier.tierKey}>
                  {tier.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="secondary"
              onClick={onClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchQuery && (
              <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                Search: "{searchQuery}"
              </Badge>
            )}
            {selectedTierFilter !== 'all' && (
              <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                Tier: {tiers.find(t => t.tierKey === selectedTierFilter)?.displayName}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
