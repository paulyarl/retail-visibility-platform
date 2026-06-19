'use client';

import { Menu } from '@mantine/core';
import {
  MoreHorizontal,
  Pencil,
  ExternalLink,
  ToggleLeft,
  Edit3,
  Trash2,
} from 'lucide-react';
import type { TenantItem } from './types';

interface TenantActionsMenuProps {
  tenant: TenantItem;
  canEdit?: boolean;
  canDelete?: boolean;
  canRename?: boolean;
  onEditProfile: () => void;
  onViewStorefront: () => void;
  onStatusChange: (tenant: TenantItem) => void;
  onRename: () => void;
  onDelete: () => void;
}

export function TenantActionsMenu({
  tenant,
  canEdit = false,
  canDelete = false,
  canRename = false,
  onEditProfile,
  onViewStorefront,
  onStatusChange,
  onRename,
  onDelete,
}: TenantActionsMenuProps) {
  return (
    <Menu position="bottom-end" withinPortal shadow="sm" trigger="click">
      <Menu.Target>
        <button
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="More actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {canEdit && (
          <Menu.Item
            leftSection={<Pencil className="w-4 h-4" />}
            onClick={() => onEditProfile()}
          >
            Edit Profile
          </Menu.Item>
        )}
        <Menu.Item
          leftSection={<ExternalLink className="w-4 h-4" />}
          onClick={() => onViewStorefront()}
        >
          View Storefront
        </Menu.Item>
        {canEdit && (
          <Menu.Item
            leftSection={<ToggleLeft className="w-4 h-4" />}
            onClick={() => onStatusChange(tenant)}
          >
            Change Status
          </Menu.Item>
        )}
        {canRename && (
          <Menu.Item
            leftSection={<Edit3 className="w-4 h-4" />}
            onClick={() => onRename()}
          >
            Rename
          </Menu.Item>
        )}
        {canDelete && (
          <>
            <Menu.Divider />
            <Menu.Item
              color="red"
              leftSection={<Trash2 className="w-4 h-4" />}
              onClick={() => onDelete()}
            >
              Delete
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
