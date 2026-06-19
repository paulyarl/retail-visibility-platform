'use client';

import { Pagination } from '@mantine/core';

interface TenantsPaginationProps {
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  filteredCount: number;
}

export function TenantsPagination({
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  filteredCount,
}: TenantsPaginationProps) {
  const totalPages = Math.ceil(filteredCount / pageSize);
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, filteredCount);

  if (filteredCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 order-2 sm:order-1">
        Showing{' '}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {startIdx}–{endIdx}
        </span>{' '}
        of{' '}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {filteredCount}
        </span>{' '}
        locations
      </p>
      <Pagination
        value={currentPage}
        onChange={setCurrentPage}
        total={totalPages}
        color="blue"
        className="order-1 sm:order-2"
      />
      <select
        value={pageSize}
        onChange={(e) => setPageSize(Number(e.target.value))}
        className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 order-3"
      >
        <option value={10}>10 / page</option>
        <option value={25}>25 / page</option>
        <option value={50}>50 / page</option>
        <option value={100}>100 / page</option>
      </select>
    </div>
  );
}
