import { Input, Button } from '@/components/ui';
import { StatusFilter, VisibilityFilter, CategoryFilter } from '@/hooks/useItemsFilters';
import { ViewMode } from '@/hooks/useItemsViewMode';

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

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="syncing">Syncing</option>
        </select>

        {/* Visibility Filter */}
        <select
          value={visibilityFilter}
          onChange={(e) => onVisibilityChange(e.target.value as VisibilityFilter)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-sm"
        >
          <option value="all">All Visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value as CategoryFilter)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-sm"
        >
          <option value="all">All Categories</option>
          <option value="assigned">With Category</option>
          <option value="unassigned">No Category</option>
        </select>

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
