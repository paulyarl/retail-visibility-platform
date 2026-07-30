'use client';

import { useEffect, useState } from 'react';
import { adminUsersService } from '@/services/AdminUsersService';

const STAFF_ROLES = ['PLATFORM_ADMIN', 'ADMIN', 'SUPPORT', 'PLATFORM_SUPPORT'];

export interface StaffUser {
  id: string;
  label: string;
}

export function useStaffUsers(): StaffUser[] {
  const [users, setUsers] = useState<StaffUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    adminUsersService.getUsers()
      .then((all) => {
        if (cancelled) return;
        const staff = (all || [])
          .filter((u: any) => STAFF_ROLES.includes(u.role) && (u.isActive ?? u.is_active ?? true))
          .map((u: any) => ({
            id: u.id,
            label: u.name && u.name !== 'Unnamed User' ? `${u.name} (${u.email})` : u.email,
          }))
          .sort((a: StaffUser, b: StaffUser) => a.label.localeCompare(b.label));
        setUsers(staff);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return users;
}

/** Resolve a stored user id to a display label; falls back to the raw value. */
export function staffDisplayName(users: StaffUser[], idOrValue: string | null | undefined): string | null {
  if (!idOrValue) return null;
  const match = users.find((u) => u.id === idOrValue);
  return match ? match.label : idOrValue;
}

interface PlatformUserSelectProps {
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  required?: boolean;
  className?: string;
}

/**
 * Dropdown of platform staff users (PLATFORM_ADMIN, ADMIN, SUPPORT, PLATFORM_SUPPORT).
 * Option value is the user id; label is name/email.
 */
export default function PlatformUserSelect({
  value,
  onChange,
  emptyLabel = '-- Select user --',
  required,
  className,
}: PlatformUserSelectProps) {
  const users = useStaffUsers();

  // Keep a current value visible even if it is not a known staff user (e.g. legacy free-text)
  const currentMissing = value && !users.some((u) => u.id === value);

  return (
    <select
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">{emptyLabel}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.label}</option>
      ))}
      {currentMissing && <option value={value}>{value}</option>}
    </select>
  );
}
