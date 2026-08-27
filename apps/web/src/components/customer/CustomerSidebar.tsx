'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  MapPin,
  Bell,
  Settings,
  LogOut,
  User,
  CreditCard,
  Download,
  Ticket,
  Briefcase,
  Receipt,
  LifeBuoy,
  Palette,
  ShoppingBag,
  Building2,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  Store,
} from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { cn } from '@/lib/utils';
import marketingCustomerService from '@/services/MarketingCustomerService';

// Storefront context items (§7.2) — visible when contexts.storefront is true
const storefrontNavItems = [
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/coupons', label: 'My Coupons', icon: Ticket },
  { href: '/account/downloads', label: 'Digital Downloads', icon: Download },
];

// Platform context items (§7.2) — "My Services" group, visible when contexts.platform is true
const platformNavItems = [
  { href: '/account/marketing', label: 'My Services', icon: Briefcase },
  { href: '/account/marketing/purchases', label: 'Purchases', icon: ShoppingBag },
  { href: '/account/marketing/support', label: 'Support', icon: LifeBuoy },
  { href: '/account/marketing/alerts', label: 'Service Alerts', icon: Bell },
  { href: '/account/marketing/settings', label: 'Branding', icon: Palette },
];

// Google Business group — visible when contexts.platform is true (Phase 1)
const gbpNavItems = [
  { href: '/account/marketing/gbp', label: 'GBP Dashboard', icon: Building2 },
  { href: '/account/marketing/gbp/reviews', label: 'Reviews', icon: MessageSquare },
  { href: '/account/marketing/gbp/posts', label: 'Posts', icon: FileText },
  { href: '/account/marketing/gbp/media', label: 'Media', icon: ImageIcon },
];

// Context-agnostic items (§7.8) — visible in either context
const sharedNavItems = [
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/payment-methods', label: 'Payment Methods', icon: CreditCard },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/settings', label: 'Settings', icon: Settings },
];

export function CustomerSidebar() {
  const pathname = usePathname();
  const { customer, contexts, tenantId, logout } = useCustomerAuth();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  // Fetch unread alert count when platform context is active (§7.9)
  useEffect(() => {
    if (!contexts?.platform) {
      setUnreadAlerts(0);
      return;
    }
    let cancelled = false;
    const loadUnread = async () => {
      try {
        const count = await marketingCustomerService.getUnreadAlertCount();
        if (!cancelled) setUnreadAlerts(count);
      } catch {
        // Silently fail — badge is non-critical
      }
    };
    loadUnread();
    // Refresh every 60s
    const interval = setInterval(loadUnread, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [contexts?.platform, pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const renderNavItem = (item: { href: string; label: string; icon: any; badge?: number }) => {
    const isActive = pathname === item.href ||
      (item.href !== '/account' && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-50'
        )}
      >
        <item.icon className="w-5 h-5" />
        <span className="flex-1">{item.label}</span>
        {!!item.badge && item.badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen relative">
      {/* Customer Info */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {customer?.firstName || customer?.email?.split('@')[0] || 'Customer'}
            </p>
            <p className="text-xs text-gray-500 truncate">{customer?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {/* Overview — always visible */}
        {renderNavItem({ href: '/account', label: 'Overview', icon: LayoutDashboard })}

        {/* Storefront group (§7.2) — visible when contexts.storefront is true */}
        {contexts?.storefront && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shopping</p>
            </div>
            {storefrontNavItems.map(renderNavItem)}
          </>
        )}

        {/* Platform group (§7.2) — "My Services", visible when contexts.platform is true */}
        {contexts?.platform && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">My Services</p>
            </div>
            {platformNavItems.map(renderNavItem)}
          </>
        )}

        {/* My Business group — visible when the customer owns a tenant
            (directory seed claim, GBP-scoped campaign purchase, etc.).
            Links to the tenant dashboard where the owner can publish their
            directory listing, manage their storefront, and access GBP tools. */}
        {tenantId && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">My Business</p>
            </div>
            {renderNavItem({ href: `/t/${tenantId}/dashboard`, label: 'Business Dashboard', icon: Store })}
          </>
        )}

        {/* Google Business group — visible when contexts.platform is true (Phase 1) */}
        {contexts?.platform && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Google Business</p>
            </div>
            {gbpNavItems.map(renderNavItem)}
          </>
        )}

        {/* Shared items — context-agnostic (§7.8) */}
        <div className="pt-4 pb-1 px-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
        </div>
        {sharedNavItems.map((item) =>
          renderNavItem({
            ...item,
            badge: item.href === '/account/notifications' ? unreadAlerts : undefined,
          }),
        )}
      </nav>

      {/* Logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
