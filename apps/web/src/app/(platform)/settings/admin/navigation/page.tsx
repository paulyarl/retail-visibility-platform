"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarTarget = 'all' | 'tenant' | 'admin';
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'new';

type NavLink = {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge: string;
  badgeVariant: BadgeVariant;
  targets: SidebarTarget[];
  order: number;
  enabled: boolean;
  dividerBefore: boolean;
  requiredPermission: string;
  requiredGroup: string;
  requiredRole: string;
};

const SIDEBAR_LABELS: Record<SidebarTarget, { label: string; description: string; color: string }> = {
  all: {
    label: 'All Users',
    description: 'Visible to every authenticated user in account settings',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  tenant: {
    label: 'Tenant Users',
    description: 'Visible to store owners and tenant members',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  admin: {
    label: 'Admin Only',
    description: 'Visible only to platform administrators',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
};

const BADGE_VARIANTS: BadgeVariant[] = ['default', 'success', 'warning', 'error', 'new'];

const ICON_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'home', label: 'Home' },
  { value: 'user', label: 'User' },
  { value: 'shield', label: 'Shield' },
  { value: 'lock', label: 'Lock' },
  { value: 'building', label: 'Building' },
  { value: 'palette', label: 'Palette' },
  { value: 'globe', label: 'Globe' },
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'chat', label: 'Chat' },
  { value: 'admin', label: 'Admin' },
  { value: 'bell', label: 'Bell' },
];

const PERMISSION_OPTIONS = [
  { value: '', label: 'None (everyone)' },
  { value: 'CAN_ADMIN_PLATFORM',        label: 'CAN_ADMIN_PLATFORM' },
  { value: 'CAN_SUPPORT_PLATFORM',       label: 'CAN_SUPPORT_PLATFORM' },
  { value: 'CAN_VIEW_PLATFORM_LOGS',     label: 'CAN_VIEW_PLATFORM_LOGS' },
  { value: 'CAN_MANAGE_PLATFORM_USERS',  label: 'CAN_MANAGE_PLATFORM_USERS' },
  { value: 'CAN_ACCESS_SYSTEM_TOOLS',    label: 'CAN_ACCESS_SYSTEM_TOOLS' },
  { value: 'CAN_VIEW_SENSITIVE_DATA',    label: 'CAN_VIEW_SENSITIVE_DATA' },
  { value: 'CAN_DELETE_DATA',            label: 'CAN_DELETE_DATA' },
  { value: 'CAN_BULK_OPERATIONS',        label: 'CAN_BULK_OPERATIONS' },
  { value: 'CAN_MANAGE_TENANT_USERS',    label: 'CAN_MANAGE_TENANT_USERS' },
  { value: 'CAN_MANAGE_TENANT_BILLING',  label: 'CAN_MANAGE_TENANT_BILLING' },
  { value: 'CAN_MANAGE_TENANT_SETTINGS', label: 'CAN_MANAGE_TENANT_SETTINGS' },
  { value: 'CAN_MANAGE_TENANT_ANALYTICS',label: 'CAN_MANAGE_TENANT_ANALYTICS' },
  { value: 'CAN_MANAGE_TENANT_INVENTORY',label: 'CAN_MANAGE_TENANT_INVENTORY' },
  { value: 'CAN_EXPORT_TENANT_DATA',     label: 'CAN_EXPORT_TENANT_DATA' },
];

const GROUP_OPTIONS = [
  { value: '', label: 'None (everyone)' },
  { value: 'IS_PLATFORM_ADMIN',   label: 'IS_PLATFORM_ADMIN' },
  { value: 'IS_PLATFORM_SUPPORT', label: 'IS_PLATFORM_SUPPORT' },
  { value: 'IS_TENANT_ADMIN',     label: 'IS_TENANT_ADMIN' },
  { value: 'IS_TENANT_OWNER',     label: 'IS_TENANT_OWNER' },
  { value: 'IS_TENANT_MANAGER',   label: 'IS_TENANT_MANAGER' },
  { value: 'IS_TENANT_USER',      label: 'IS_TENANT_USER' },
];

const ROLE_OPTIONS = [
  { value: '', label: 'None (everyone)' },
  { value: 'PLATFORM_ADMIN',   label: 'PLATFORM_ADMIN' },
  { value: 'PLATFORM_SUPPORT', label: 'PLATFORM_SUPPORT' },
  { value: 'TENANT_ADMIN',     label: 'TENANT_ADMIN' },
  { value: 'TENANT_OWNER',     label: 'TENANT_OWNER' },
  { value: 'OWNER',            label: 'OWNER' },
  { value: 'USER',             label: 'USER' },
  { value: 'ADMIN',            label: 'ADMIN' },
];

const DEFAULT_LINK: Omit<NavLink, 'id' | 'order'> = {
  label: '',
  href: '',
  icon: '',
  badge: '',
  badgeVariant: 'default',
  targets: ['all'],
  enabled: true,
  dividerBefore: false,
  requiredPermission: '',
  requiredGroup: '',
  requiredRole: '',
};

// ─── Seed data (static defaults — replace with DB fetch when API is ready) ────

const SEED_LINKS: NavLink[] = [
  {
    id: 'built-in-home',
    label: 'Platform Home',
    href: '/',
    icon: 'home',
    badge: '',
    badgeVariant: 'default',
    targets: ['all', 'tenant', 'admin'],
    order: 0,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
  },
  {
    id: 'built-in-account',
    label: 'My Account',
    href: '/settings/account',
    icon: 'user',
    badge: '',
    badgeVariant: 'default',
    targets: ['all', 'tenant'],
    order: 1,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
  },
  {
    id: 'built-in-security',
    label: 'Security & Privacy',
    href: '/settings/security',
    icon: 'shield',
    badge: '',
    badgeVariant: 'default',
    targets: ['all', 'tenant'],
    order: 2,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
  },
  {
    id: 'built-in-admin',
    label: 'Admin Panel',
    href: '/settings/admin',
    icon: 'admin',
    badge: 'Admin',
    badgeVariant: 'warning',
    targets: ['admin'],
    order: 3,
    enabled: true,
    dividerBefore: true,
    requiredPermission: 'CAN_ADMIN_PLATFORM',
    requiredGroup: 'IS_PLATFORM_ADMIN',
    requiredRole: '',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TargetPill({ target, active, onClick }: { target: SidebarTarget; active: boolean; onClick: () => void }) {
  const cfg = SIDEBAR_LABELS[target];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-all ${
        active
          ? cfg.color
          : 'bg-neutral-100 text-neutral-400 border-neutral-200 hover:border-neutral-300'
      }`}
    >
      {cfg.label}
    </button>
  );
}

function BadgePill({ variant }: { variant: BadgeVariant }) {
  const colors: Record<BadgeVariant, string> = {
    default: 'bg-neutral-100 text-neutral-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    new: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors[variant]}`}>
      {variant}
    </span>
  );
}

function LinkRow({
  link,
  index,
  total,
  onEdit,
  onToggle,
  onDelete,
  onMove,
}: {
  link: NavLink;
  index: number;
  total: number;
  onEdit: (link: NavLink) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
}) {
  const isBuiltIn = link.id.startsWith('built-in-');
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${link.enabled ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 opacity-60'}`}>
      {/* Order controls */}
      <div className="flex flex-col gap-0.5">
        <button
          disabled={index === 0}
          onClick={() => onMove(link.id, 'up')}
          className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move up"
        >
          <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          disabled={index === total - 1}
          onClick={() => onMove(link.id, 'down')}
          className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move down"
        >
          <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Label + href */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-900 truncate">{link.label || <span className="italic text-neutral-400">Untitled</span>}</span>
          {link.badge && <BadgePill variant={link.badgeVariant} />}
          {link.dividerBefore && (
            <span className="text-[10px] text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">divider</span>
          )}
          {isBuiltIn && (
            <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">built-in</span>
          )}
        </div>
        <p className="text-xs text-neutral-400 font-mono truncate mt-0.5">{link.href || '—'}</p>
      </div>

      {/* Sidebar targets + RBAC gates */}
      <div className="hidden sm:flex flex-col gap-1 flex-shrink-0 items-end">
        <div className="flex items-center gap-1">
          {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).map(t => (
            link.targets.includes(t) ? (
              <span key={t} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${SIDEBAR_LABELS[t].color}`}>
                {SIDEBAR_LABELS[t].label}
              </span>
            ) : null
          ))}
        </div>
        {(link.requiredPermission || link.requiredGroup || link.requiredRole) && (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {link.requiredPermission && (
              <span className="text-[9px] font-mono bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded" title="Required permission">
                {link.requiredPermission}
              </span>
            )}
            {link.requiredGroup && (
              <span className="text-[9px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded" title="Required group">
                {link.requiredGroup}
              </span>
            )}
            {link.requiredRole && (
              <span className="text-[9px] font-mono bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded" title="Required role">
                {link.requiredRole}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onToggle(link.id)}
          className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${link.enabled ? 'bg-primary-500' : 'bg-neutral-300'}`}
          title={link.enabled ? 'Disable' : 'Enable'}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${link.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
        </button>
        {!isBuiltIn && (
          <button
            onClick={() => onEdit(link)}
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        {!isBuiltIn && (
          <button
            onClick={() => onDelete(link.id)}
            className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function LinkEditor({
  link,
  onSave,
  onCancel,
}: {
  link: Partial<NavLink>;
  onSave: (link: NavLink) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<NavLink, 'id' | 'order'>>({
    label: link.label ?? '',
    href: link.href ?? '',
    icon: link.icon ?? '',
    badge: link.badge ?? '',
    badgeVariant: link.badgeVariant ?? 'default',
    targets: link.targets ?? ['all'],
    enabled: link.enabled ?? true,
    dividerBefore: link.dividerBefore ?? false,
    requiredPermission: link.requiredPermission ?? '',
    requiredGroup: link.requiredGroup ?? '',
    requiredRole: link.requiredRole ?? '',
  });

  const toggleTarget = (t: SidebarTarget) => {
    setForm(prev => ({
      ...prev,
      targets: prev.targets.includes(t)
        ? prev.targets.filter(x => x !== t)
        : [...prev.targets, t],
    }));
  };

  const handleSave = () => {
    if (!form.label.trim() || !form.href.trim()) return;
    onSave({
      ...form,
      id: link.id ?? `custom-${Date.now()}`,
      order: link.order ?? 999,
    });
  };

  return (
    <div className="bg-white border border-primary-200 rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-neutral-900">{link.id ? 'Edit Link' : 'New Link'}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Label *</label>
          <input
            value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="e.g. My Reports"
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">URL / Path *</label>
          <input
            value={form.href}
            onChange={e => setForm(p => ({ ...p, href: e.target.value }))}
            placeholder="e.g. /settings/reports"
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Icon</label>
          <select
            value={form.icon}
            onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Badge Text</label>
          <div className="flex gap-2">
            <input
              value={form.badge}
              onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}
              placeholder="e.g. NEW"
              className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={form.badgeVariant}
              onChange={e => setForm(p => ({ ...p, badgeVariant: e.target.value as BadgeVariant }))}
              className="px-2 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {BADGE_VARIANTS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Sidebar visibility */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-2">Sidebar Visibility</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).map(t => (
            <TargetPill
              key={t}
              target={t}
              active={form.targets.includes(t)}
              onClick={() => toggleTarget(t)}
            />
          ))}
        </div>
        {form.targets.length === 0 && (
          <p className="text-xs text-red-500 mt-1">At least one sidebar must be selected.</p>
        )}
        <div className="mt-2 space-y-1">
          {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).filter(t => form.targets.includes(t)).map(t => (
            <p key={t} className="text-xs text-neutral-500">
              <span className="font-medium">{SIDEBAR_LABELS[t].label}:</span> {SIDEBAR_LABELS[t].description}
            </p>
          ))}
        </div>
      </div>

      {/* RBAC Access Gates */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-2">
          Access Gates
          <span className="ml-1 text-neutral-400 font-normal">(optional — all fields are AND-combined)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-purple-600 mb-1">Required Permission</label>
            <select
              value={form.requiredPermission}
              onChange={e => setForm(p => ({ ...p, requiredPermission: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {PERMISSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-indigo-600 mb-1">Required Group</label>
            <select
              value={form.requiredGroup}
              onChange={e => setForm(p => ({ ...p, requiredGroup: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-orange-600 mb-1">Required Role</label>
            <select
              value={form.requiredRole}
              onChange={e => setForm(p => ({ ...p, requiredRole: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {(form.requiredPermission || form.requiredGroup || form.requiredRole) && (
          <p className="text-xs text-neutral-500 mt-2">
            This link will only be visible to users who satisfy <strong>all</strong> configured gates.
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
            className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-700">Enabled</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.dividerBefore}
            onChange={e => setForm(p => ({ ...p, dividerBefore: e.target.checked }))}
            className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-700">Add divider above</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!form.label.trim() || !form.href.trim() || form.targets.length === 0}
          className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save Link
        </button>
      </div>
    </div>
  );
}

function SidebarPreview({ links, target }: { links: NavLink[]; target: SidebarTarget }) {
  const visible = links.filter(l => l.enabled && l.targets.includes(target)).sort((a, b) => a.order - b.order);
  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SIDEBAR_LABELS[target].color}`}>
          {SIDEBAR_LABELS[target].label} Sidebar
        </span>
      </div>
      <div className="p-3 space-y-0.5 min-h-[160px]">
        {visible.length === 0 && (
          <p className="text-xs text-neutral-400 italic py-4 text-center">No links</p>
        )}
        {visible.map(link => (
          <div key={link.id}>
            {link.dividerBefore && <div className="my-1.5 border-t border-neutral-100" />}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-50 group">
              <div className="w-4 h-4 bg-neutral-200 rounded flex-shrink-0" title={link.icon || 'icon'} />
              <span className="text-xs font-medium text-neutral-700 truncate flex-1">{link.label}</span>
              {link.badge && <BadgePill variant={link.badgeVariant} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NavigationControlPage() {
  const { hasAccess, loading } = useAccessControl(null, AccessPresets.PLATFORM_ADMIN_ONLY);

  const [links, setLinks] = useState<NavLink[]>(SEED_LINKS);
  const [apiLoading, setApiLoading] = useState(true);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NavLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activePreview, setActivePreview] = useState<SidebarTarget>('all');

  // Fetch persisted links from API on mount; fall back to SEED_LINKS on error
  useEffect(() => {
    fetch('/api/admin/navigation-links')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setLinks(json.data);
        }
      })
      .catch(() => { /* keep SEED_LINKS */ })
      .finally(() => setApiLoading(false));
  }, []);

  const handleSave = useCallback((link: NavLink) => {
    setLinks(prev => {
      const idx = prev.findIndex(l => l.id === link.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = link;
        return next;
      }
      return [...prev, { ...link, order: prev.length }];
    });
    setEditing(null);
    setCreating(false);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
  }, []);

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    setLinks(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(l => l.id === id);
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const next = [...sorted];
      [next[idx].order, next[swapIdx].order] = [next[swapIdx].order, next[idx].order];
      return next;
    });
  }, []);

  const handlePublish = async () => {
    setPublishError(null);
    try {
      const res = await fetch('/api/admin/navigation-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Publish failed');
      if (Array.isArray(json.data)) setLinks(json.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish');
    }
  };

  if (loading || apiLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  const sortedLinks = [...links].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Navigation Control</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Create and manage links across all three sidebar contexts. Changes apply at publish time.
          </p>
        </div>
        <button
          onClick={handlePublish}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {saved ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Publish Changes
            </>
          )}
        </button>
      </div>

      {/* Sidebar legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(SIDEBAR_LABELS) as [SidebarTarget, typeof SIDEBAR_LABELS['all']][]).map(([key, cfg]) => (
          <div key={key} className={`px-4 py-3 rounded-xl border ${cfg.color} bg-opacity-40`}>
            <p className="text-xs font-bold">{cfg.label}</p>
            <p className="text-xs mt-0.5 opacity-80">{cfg.description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Link list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">
              Navigation Links <span className="text-neutral-400 font-normal">({sortedLinks.length})</span>
            </h2>
            {!creating && !editing && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Link
              </button>
            )}
          </div>

          {creating && (
            <LinkEditor
              link={{ ...DEFAULT_LINK }}
              onSave={handleSave}
              onCancel={() => setCreating(false)}
            />
          )}

          {editing && (
            <LinkEditor
              link={editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          )}

          {sortedLinks.length === 0 && !creating && (
            <div className="text-center py-10 text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
              No links yet. Add your first link above.
            </div>
          )}

          <div className="space-y-2">
            {sortedLinks.map((link, i) => (
              <LinkRow
                key={link.id}
                link={link}
                index={i}
                total={sortedLinks.length}
                onEdit={setEditing}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onMove={handleMove}
              />
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">Preview</h2>
            <div className="flex gap-1">
              {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).map(t => (
                <button
                  key={t}
                  onClick={() => setActivePreview(t)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-all ${
                    activePreview === t ? SIDEBAR_LABELS[t].color : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                  }`}
                >
                  {SIDEBAR_LABELS[t].label}
                </button>
              ))}
            </div>
          </div>
          <SidebarPreview links={links} target={activePreview} />

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">Persistence active</p>
            <p>Links are saved to the database via <code className="font-mono bg-amber-100 px-1 rounded">/api/admin/navigation-links</code> and loaded on every visit.</p>
            {publishError && <p className="text-red-600 font-semibold mt-1">{publishError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
