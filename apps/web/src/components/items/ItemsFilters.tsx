import { Input, Button } from '@/components/ui';
import { StatusFilter, VisibilityFilter, CategoryFilter } from '@/hooks/useItemsFilters';
import { ViewMode } from '@/hooks/useItemsViewMode';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface ItemsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (filter: StatusFilter) => void;
  visibilityFilter: VisibilityFilter;
  onVisibilityChange: (filter: VisibilityFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryChange: (filter: CategoryFilter) => void;
  viewMode: ViewMode;
  onViewModeToggle: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  categories?: Category[];
  uncategorizedCount?: number;
}

/**
 * Filters component for items page
 * Search, status, visibility, category filters, and view mode toggle
 */
export default function ItemsFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  visibilityFilter,
  onVisibilityChange,
  categoryFilter,
  onCategoryChange,
  viewMode,
  onViewModeToggle,
  hasActiveFilters,
  onClearFilters,
  categories = [],
  uncategorizedCount = 0,
}: ItemsFiltersProps) {
  return (
    <div className="mb-6 space-y-4">
      {/* Search and View Toggle */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search items by name or SKU..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>

        <Button
          variant="secondary"
          onClick={onViewModeToggle}
          title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
        >
          {viewMode === 'grid' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          )}
        </Button>
      </div>

      {/* Filter Toggle Groups */}
      <div className="flex flex-wrap gap-4">
        {/* Status Filter Toggles */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Status:</span>
          <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-600 overflow-hidden">
            <button
              onClick={() => onStatusChange('all')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onStatusChange('active')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-neutral-300 dark:border-neutral-600 ${
                statusFilter === 'active'
                  ? 'bg-success text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => onStatusChange('inactive')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-neutral-300 dark:border-neutral-600 ${
                statusFilter === 'inactive'
                  ? 'bg-neutral-500 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              Inactive
            </button>
            <button
              onClick={() => onStatusChange('syncing')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-neutral-300 dark:border-neutral-600 ${
                statusFilter === 'syncing'
                  ? 'bg-info text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              Syncing
            </button>
          </div>
        </div>

        {/* Visibility Filter Toggles */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Visibility:</span>
          <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-600 overflow-hidden">
            <button
              onClick={() => onVisibilityChange('all')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                visibilityFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onVisibilityChange('public')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-neutral-300 dark:border-neutral-600 ${
                visibilityFilter === 'public'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              Public
            </button>
            <button
              onClick={() => onVisibilityChange('private')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-neutral-300 dark:border-neutral-600 ${
                visibilityFilter === 'private'
                  ? 'bg-neutral-500 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              Private
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value as CategoryFilter)}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-sm min-w-[180px]"
          >
            <option value="all">All Categories</option>
            {categories.length > 0 && (
              <>
                <option disabled>──────────</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </>
            )}
            {uncategorizedCount > 0 && (
              <>
                <option disabled>──────────</option>
                <option value="unassigned">No Category ({uncategorizedCount})</option>
              </>
            )}
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
