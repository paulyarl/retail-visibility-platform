'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Network,
  Package,
  Users,
  Calendar,
  X,
  Check,
} from 'lucide-react';
import NextLink from 'next/link';
import { TenantActionsMenu } from './TenantActionsMenu';
import {
  getTierBadgeClass,
  formatTierDisplay,
  getStatusDotClass,
  type TenantItem,
} from './types';

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

interface TenantCardV2Props {
  tenant: TenantItem;
  index: number;
  canEdit?: boolean;
  canDelete?: boolean;
  canRename?: boolean;
  onSelect: () => void;
  onViewItems: () => void;
  onEditProfile: () => void;
  onViewStorefront: () => void;
  onStatusChange: (tenant: TenantItem) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: () => void;
}

export function TenantCardV2({
  tenant,
  index,
  canEdit = false,
  canDelete = false,
  canRename = false,
  onSelect,
  onViewItems,
  onEditProfile,
  onViewStorefront,
  onStatusChange,
  onRename,
  onDelete,
}: TenantCardV2Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tenant.name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim() || value.trim() === tenant.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onRename(tenant.id, value);
    setSaving(false);
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        {/* Header zone */}
        <div className="relative h-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-800 dark:to-neutral-700 overflow-hidden">
          {tenant.tenantLogo ? (
            <img
              src={tenant.tenantLogo}
              alt={tenant.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-10 h-10 text-neutral-300 dark:text-neutral-600" />
            </div>
          )}
          {tenant.organization && (
            <NextLink
              href={`/t/${tenant.id}/settings/organization`}
              target="_blank"
              className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 dark:bg-neutral-900/90 text-cyan-700 dark:text-cyan-300 backdrop-blur-sm hover:underline"
            >
              <Network className="w-3 h-3" />
              {tenant.organization.name}
            </NextLink>
          )}
          <span
            className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${getStatusDotClass(
              tenant.locationStatus || tenant.subscriptionStatus || 'active',
            )} ring-2 ring-white dark:ring-neutral-900`}
          />
        </div>

        {/* Body */}
        <div className="p-4 space-y-2">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') setEditing(false);
                }}
                autoFocus
                className="flex-1 px-2 py-1 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={save}
                disabled={saving}
                className="p-1 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setValue(tenant.name);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h3
              className="text-base font-semibold text-neutral-900 dark:text-neutral-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              onClick={onSelect}
            >
              {tenant.name}
            </h3>
          )}

          {/* Tier badge */}
          {tenant.subscriptionTier && !editing && (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getTierBadgeClass(
                tenant.subscriptionTier,
              )}`}
            >
              {formatTierDisplay(tenant.subscriptionTier)}
            </span>
          )}

          {/* Subscription status badge (non-active) */}
          {tenant.subscriptionStatus &&
            tenant.subscriptionStatus !== 'active' &&
            !editing && (
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                {tenant.subscriptionStatus
                  .replace('_', ' ')
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            )}

          {/* Stats */}
          {!editing && (
            <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {tenant._count?.items ?? 0} products
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {tenant._count?.users ?? 0} users
              </span>
            </div>
          )}

          {/* Created date */}
          {tenant.createdAt && !editing && (
            <span className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
              <Calendar className="w-3 h-3" />
              {formatRelativeDate(tenant.createdAt)}
            </span>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={onViewItems}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Package className="w-4 h-4" />
              View Inventory
            </button>
            <TenantActionsMenu
              tenant={tenant}
              canEdit={canEdit}
              canDelete={canDelete}
              canRename={canRename}
              onEditProfile={onEditProfile}
              onViewStorefront={onViewStorefront}
              onStatusChange={onStatusChange}
              onRename={() => setEditing(true)}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
