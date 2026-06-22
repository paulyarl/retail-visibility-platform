'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useNavLinks, ProcessedNavLink } from '@/hooks/useNavLinks';
import { useAuth } from '@/contexts/AuthContext';

interface CommandItem {
  id: string;
  label: string;
  href: string;
  group: string;
  icon?: React.ReactNode;
}

function flattenLinks(
  links: ProcessedNavLink[],
  group: string,
  parentLabel?: string,
): CommandItem[] {
  const items: CommandItem[] = [];
  for (const link of links) {
    if (!link.href) continue;
    const fullLabel = parentLabel ? `${parentLabel} › ${link.label}` : link.label;
    items.push({
      id: link.id || fullLabel,
      label: fullLabel,
      href: link.href,
      group,
      icon: link.icon,
    });
    if (link.children && link.children.length > 0) {
      items.push(...flattenLinks(link.children, group, fullLabel));
    }
  }
  return items;
}

export function CommandPalette() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isTenantOrAdminPage = pathname?.startsWith('/t/') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/tenants') ||
    pathname?.startsWith('/onboarding');

  if (!isAuthenticated || !isTenantOrAdminPage) return null;

  return <CommandPaletteInner pathname={pathname} />;
}

function CommandPaletteInner({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { adminLinks, allLinks, tenantLinks, loading } = useNavLinks();

  // Determine context from pathname
  const isAdminContext = pathname?.startsWith('/settings/admin') ?? false;
  const isTenantContext = pathname?.startsWith('/t/') ?? false;

  // Build command list based on context
  const commands = useMemo(() => {
    if (loading) return [];

    const items: CommandItem[] = [];

    // Always include platform/universal links
    items.push(...flattenLinks(allLinks, 'Platform'));

    // Include admin links if user is platform admin or in admin context
    if (user?.role === 'PLATFORM_ADMIN' || isAdminContext) {
      items.push(...flattenLinks(adminLinks, 'Admin'));
    }

    // Include tenant links if in tenant context
    if (isTenantContext) {
      items.push(...flattenLinks(tenantLinks, 'Tenant'));
    }

    // Deduplicate by href, keeping first occurrence
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [allLinks, adminLinks, tenantLinks, loading, user, isAdminContext, isTenantContext]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.href.toLowerCase().includes(q));
  }, [commands, query]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) {
        window.location.href = item.href;
        setOpen(false);
      }
    }
  }, [filtered, selectedIndex]);

  if (!open) return null;

  // Group filtered results
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [filtered]);

  let runningIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[15%] -translate-x-1/2 z-[10000] w-full max-w-xl px-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <svg className="w-5 h-5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages and actions..."
              className="flex-1 bg-transparent outline-none text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-neutral-400">
                {loading ? 'Loading commands...' : 'No results found'}
              </div>
            )}

            {Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {groupName}
                </div>
                {items.map(item => {
                  const idx = runningIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        window.location.href = item.href;
                        setOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {item.icon && <span className="flex-shrink-0 text-neutral-400">{item.icon}</span>}
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-[10px] text-neutral-400 truncate max-w-[200px]">{item.href}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 text-[10px] text-neutral-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 border border-neutral-200 dark:border-neutral-700 rounded">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 border border-neutral-200 dark:border-neutral-700 rounded">↵</kbd>
                select
              </span>
            </div>
            <span>{filtered.length} results</span>
          </div>
        </div>
      </div>
    </>
  );
}
