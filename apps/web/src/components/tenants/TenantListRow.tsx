'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Network,
  Package,
  Users,
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

interface TenantListRowProps {
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

export function TenantListRow({
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
}: TenantListRowProps) {
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
    >
      <div
        className="flex items-center gap-4 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
        onClick={onSelect}
      >
        {/* Logo */}
        <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          {tenant.tenantLogo ? (
            <img
              src={tenant.tenantLogo}
              className="w-full h-full object-cover"
              alt={tenant.name}
            />
          ) : (
            <Building2 className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
          )}
        </div>

        {/* Name + org */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
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
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {tenant.name}
                </span>
                {tenant.organization && (
                  <NextLink
                    href={`/t/${tenant.id}/settings/organization`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Network className="w-3 h-3" /> {tenant.organization.name}
                  </NextLink>
                )}
              </div>
              <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
                {tenant.id}
              </span>
            </>
          )}
        </div>

        {/* Tier badge */}
        {!editing && tenant.subscriptionTier && (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTierBadgeClass(
              tenant.subscriptionTier,
            )}`}
          >
            {formatTierDisplay(tenant.subscriptionTier)}
          </span>
        )}

        {/* Status */}
        {!editing && (
          <div className="flex items-center gap-1.5 w-24">
            <span
              className={`w-2 h-2 rounded-full ${getStatusDotClass(
                tenant.locationStatus ||
                  tenant.subscriptionStatus ||
                  'active',
              )}`}
            />
            <span className="text-xs text-neutral-600 dark:text-neutral-400 capitalize">
              {tenant.locationStatus || 'active'}
            </span>
          </div>
        )}

        {/* Stats */}
        {!editing && (
          <div className="hidden sm:flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 w-32">
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" /> {tenant._count?.items ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {tenant._count?.users ?? 0}
            </span>
          </div>
        )}

        {/* Actions */}
        {!editing && (
          <div onClick={(e) => e.stopPropagation()}>
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
