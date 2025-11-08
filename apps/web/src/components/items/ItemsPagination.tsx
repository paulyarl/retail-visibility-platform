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
}

/**
 * Pagination component for items
 * Displays page controls and navigation
 */
export default function ItemsPagination({
  pagination,
  onPageChange,
}: ItemsPaginationProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalItems)} to{' '}
        {Math.min(pagination.page * pagination.limit, pagination.totalItems)} of{' '}
        {pagination.totalItems} items
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page === 1}
        >
          Previous
        </Button>
        
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={!pagination.hasMore}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
