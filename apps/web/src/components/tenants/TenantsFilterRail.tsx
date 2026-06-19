'use client';

import { Drawer } from '@mantine/core';
import {
  SlidersHorizontal,
  Network,
  Store,
  X,
} from 'lucide-react';
import type {
  ChainFilterValue,
  StatusFilterValue,
  SortByValue,
} from './types';

interface TenantsFilterRailProps {
  chainFilter: ChainFilterValue;
  setChainFilter: (v: ChainFilterValue) => void;
  statusFilter: StatusFilterValue;
  setStatusFilter: (v: StatusFilterValue) => void;
  sortBy: SortByValue;
  setSortBy: (v: SortByValue) => void;
  activeCount: number;
  clearAll: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-2">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface RadioRowProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
  dotColor?: string;
}

function RadioRow({ label, checked, onChange, icon, dotColor }: RadioRowProps) {
  return (
    <button
      onClick={onChange}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors ${
        checked
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
      }`}
    >
      <span
        className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
          checked
            ? 'border-blue-600 dark:border-blue-400'
            : 'border-neutral-300 dark:border-neutral-600'
        }`}
      >
        {checked && (
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
        )}
      </span>
      {dotColor && <span className={`w-2 h-2 rounded-full ${dotColor}`} />}
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function FilterContent({
  chainFilter,
  setChainFilter,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  activeCount,
  clearAll,
}: Omit<TenantsFilterRailProps, 'mobileOpen' | 'setMobileOpen'>) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-blue-600 text-white">
              {activeCount}
            </span>
          )}
        </h3>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Location Type */}
      <FilterSection title="Location Type">
        <RadioRow
          label="All Types"
          checked={chainFilter === 'all'}
          onChange={() => setChainFilter('all')}
        />
        <RadioRow
          label="Chain"
          icon={<Network className="w-3.5 h-3.5" />}
          checked={chainFilter === 'chain'}
          onChange={() => setChainFilter('chain')}
        />
        <RadioRow
          label="Standalone"
          icon={<Store className="w-3.5 h-3.5" />}
          checked={chainFilter === 'standalone'}
          onChange={() => setChainFilter('standalone')}
        />
      </FilterSection>

      {/* Status */}
      <FilterSection title="Status">
        <RadioRow
          label="All Statuses"
          checked={statusFilter === 'all'}
          onChange={() => setStatusFilter('all')}
        />
        <RadioRow
          label="Active"
          dotColor="bg-green-500"
          checked={statusFilter === 'active'}
          onChange={() => setStatusFilter('active')}
        />
        <RadioRow
          label="Trial"
          dotColor="bg-blue-500"
          checked={statusFilter === 'trial'}
          onChange={() => setStatusFilter('trial')}
        />
        <RadioRow
          label="Pending"
          dotColor="bg-amber-500"
          checked={statusFilter === 'pending'}
          onChange={() => setStatusFilter('pending')}
        />
        <RadioRow
          label="Inactive"
          dotColor="bg-orange-500"
          checked={statusFilter === 'inactive'}
          onChange={() => setStatusFilter('inactive')}
        />
        <RadioRow
          label="Closed"
          dotColor="bg-red-500"
          checked={statusFilter === 'closed'}
          onChange={() => setStatusFilter('closed')}
        />
        <RadioRow
          label="Archived"
          dotColor="bg-neutral-400"
          checked={statusFilter === 'archived'}
          onChange={() => setStatusFilter('archived')}
        />
      </FilterSection>

      {/* Sort By */}
      <FilterSection title="Sort By">
        <RadioRow
          label="Name (A–Z)"
          checked={sortBy === 'name'}
          onChange={() => setSortBy('name')}
        />
        <RadioRow
          label="Created (newest)"
          checked={sortBy === 'createdAt'}
          onChange={() => setSortBy('createdAt')}
        />
        <RadioRow
          label="Products (most)"
          checked={sortBy === 'items'}
          onChange={() => setSortBy('items')}
        />
        <RadioRow
          label="Users (most)"
          checked={sortBy === 'users'}
          onChange={() => setSortBy('users')}
        />
      </FilterSection>
    </>
  );
}

export function TenantsFilterRail({
  chainFilter,
  setChainFilter,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  activeCount,
  clearAll,
  mobileOpen,
  setMobileOpen,
}: TenantsFilterRailProps) {
  return (
    <>
      {/* Desktop sticky rail */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <FilterContent
            chainFilter={chainFilter}
            setChainFilter={setChainFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            activeCount={activeCount}
            clearAll={clearAll}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer
        opened={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Filters"
        position="right"
        size="sm"
        classNames={{
          content: 'bg-white dark:bg-neutral-900',
        }}
      >
        <FilterContent
          chainFilter={chainFilter}
          setChainFilter={setChainFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          activeCount={activeCount}
          clearAll={clearAll}
        />
      </Drawer>
    </>
  );
}

export function MobileFilterTrigger({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
    >
      <SlidersHorizontal className="w-4 h-4" />
      Filters
      {activeCount > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-blue-600 text-white">
          {activeCount}
        </span>
      )}
    </button>
  );
}
