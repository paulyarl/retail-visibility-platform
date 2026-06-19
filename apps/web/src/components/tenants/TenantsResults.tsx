'use client';

import {
  PackageSearch,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { TenantCardV2 } from './TenantCardV2';
import { TenantListRow } from './TenantListRow';
import {
  type TenantItem,
  type TenantsViewMode,
  type SortByValue,
  type SortDirValue,
} from './types';

interface TenantsResultsProps {
  tenants: TenantItem[];
  viewMode: TenantsViewMode;
  loading: boolean;
  hasActiveFilters: boolean;
  hasTenants: boolean;
  sortBy: SortByValue;
  sortDir: SortDirValue;
  onSort: (field: SortByValue) => void;
  onClearFilters: () => void;
  onCreateClick: () => void;
  getPermissions: (tenantId: string) => {
    canEdit: boolean;
    canDelete: boolean;
    canRename: boolean;
  };
  onSelect: (tenant: TenantItem) => void;
  onViewItems: (tenant: TenantItem) => void;
  onEditProfile: (tenant: TenantItem) => void;
  onViewStorefront: (tenant: TenantItem) => void;
  onStatusChange: (tenant: TenantItem) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (tenant: TenantItem) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-pulse">
      <div className="h-24 bg-neutral-200 dark:bg-neutral-800" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-full w-20" />
        <div className="flex gap-3">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-24" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
        </div>
      </div>
      <div className="h-12 bg-neutral-100 dark:bg-neutral-800/50" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 animate-pulse">
      <div className="w-10 h-10 shrink-0 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
        <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/4" />
      </div>
      <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded-full w-16" />
      <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
    </div>
  );
}

const SORT_LABELS: Record<SortByValue, string> = {
  name: 'Name',
  createdAt: 'Created',
  items: 'Products',
  users: 'Users',
};

export function TenantsResults({
  tenants,
  viewMode,
  loading,
  hasActiveFilters,
  hasTenants,
  sortBy,
  sortDir,
  onSort,
  onClearFilters,
  onCreateClick,
  getPermissions,
  onSelect,
  onViewItems,
  onEditProfile,
  onViewStorefront,
  onStatusChange,
  onRename,
  onDelete,
}: TenantsResultsProps) {
  if (loading) {
    if (viewMode === 'list') {
      return (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      );
    }
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (tenants.length === 0) {
    const message = hasActiveFilters
      ? 'Try adjusting your filters'
      : hasTenants
        ? 'Try a different search term'
        : 'Get started by creating your first location';

    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <PackageSearch className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          No locations found
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          {message}
        </p>
        <button
          onClick={hasActiveFilters ? onClearFilters : onCreateClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {hasActiveFilters ? (
            <>
              <X className="w-4 h-4" /> Clear filters
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add Location
            </>
          )}
        </button>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Sortable header */}
        <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <div className="w-10 shrink-0" />
          <button
            onClick={() => onSort('name')}
            className="flex-1 text-left flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Name
            {sortBy === 'name' &&
              (sortDir === 'asc' ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              ))}
          </button>
          <div className="w-20 text-center">Tier</div>
          <div className="w-24 text-center">Status</div>
          <button
            onClick={() => onSort('items')}
            className="hidden sm:flex w-16 items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Products
            {sortBy === 'items' &&
              (sortDir === 'asc' ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              ))}
          </button>
          <button
            onClick={() => onSort('users')}
            className="hidden sm:flex w-16 items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Users
            {sortBy === 'users' &&
              (sortDir === 'asc' ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              ))}
          </button>
          <div className="w-8" />
        </div>

        {tenants.map((tenant, index) => {
          const perms = getPermissions(tenant.id);
          return (
            <TenantListRow
              key={tenant.id}
              tenant={tenant}
              index={index}
              canEdit={perms.canEdit}
              canDelete={perms.canDelete}
              canRename={perms.canRename}
              onSelect={() => onSelect(tenant)}
              onViewItems={() => onViewItems(tenant)}
              onEditProfile={() => onEditProfile(tenant)}
              onViewStorefront={() => onViewStorefront(tenant)}
              onStatusChange={onStatusChange}
              onRename={onRename}
              onDelete={() => onDelete(tenant)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {tenants.map((tenant, index) => {
        const perms = getPermissions(tenant.id);
        return (
          <TenantCardV2
            key={tenant.id}
            tenant={tenant}
            index={index}
            canEdit={perms.canEdit}
            canDelete={perms.canDelete}
            canRename={perms.canRename}
            onSelect={() => onSelect(tenant)}
            onViewItems={() => onViewItems(tenant)}
            onEditProfile={() => onEditProfile(tenant)}
            onViewStorefront={() => onViewStorefront(tenant)}
            onStatusChange={onStatusChange}
            onRename={onRename}
            onDelete={() => onDelete(tenant)}
          />
        );
      })}
    </div>
  );
}
