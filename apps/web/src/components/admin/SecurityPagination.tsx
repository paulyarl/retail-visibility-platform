/**
 * Security Pagination Component
 * Wrapper around the base Pagination component for security data
 */

"use client";

import { Pagination } from '@/components/ui/Pagination';
import { PaginationInfo } from '@/types/security';

interface SecurityPaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
}

export function SecurityPagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  loading = false,
}: SecurityPaginationProps) {
  if (!pagination || pagination.total === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Pagination info */}
      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} items
        </span>
        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>
      </div>

      {/* Pagination controls */}
      <Pagination
        currentPage={pagination.page}
        totalItems={pagination.total}
        pageSize={pagination.limit}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="text-center text-sm text-neutral-500">
          Loading...
        </div>
      )}
    </div>
  );
}
