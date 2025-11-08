import { Button } from '@/components/ui';

interface BillingPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  filteredCount: number;
  itemsPerPage: number;
}

export default function BillingPagination({
  currentPage,
  totalPages,
  onPageChange,
  filteredCount,
  itemsPerPage,
}: BillingPaginationProps) {
  if (filteredCount <= itemsPerPage) {
    return null;
  }

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredCount);

  return (
    <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      <span className="text-sm text-neutral-600 dark:text-neutral-400 px-4">
        Page {currentPage} of {totalPages} ({startIndex}-{endIndex} of {filteredCount})
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next
      </Button>
    </div>
  );
}
