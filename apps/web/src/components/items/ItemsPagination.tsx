import { Button } from '@/components/ui';

interface ItemsPaginationProps {
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Pagination component for items
 * Displays page controls, navigation, and page size selector
 */
export default function ItemsPagination({
  pagination,
  onPageChange,
  onPageSizeChange,
}: ItemsPaginationProps) {
  if (pagination.totalItems === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
      {/* Left side: Items count and page size selector */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalItems)} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.totalItems)} of{' '}
          {pagination.totalItems} items
        </div>
        
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-sm text-neutral-600 dark:text-neutral-400">
              Per page:
            </label>
            <select
              id="pageSize"
              value={pagination.limit}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page navigation */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page === 1}
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </Button>
        
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 px-2">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={!pagination.hasMore}
        >
          Next
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
