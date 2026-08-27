'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { CustomerPendingClaim } from '@/services/CustomerAuthService';
import { customerOrderService, CustomerOrder } from '@/services/CustomerOrderService';
import { customerAddressesService } from '@/services/CustomerAddressesService';
import customerCouponWalletService from '@/services/CustomerCouponWalletService';
import marketingCustomerService, {
  CustomerPortalOverview,
  GbpStatusResponse,
} from '@/services/MarketingCustomerService';
import {
  Package, MapPin, ShoppingBag, Clock, TrendingUp, Download, Ticket,
  ChevronDown, Briefcase, Building2, Star, ArrowRight, CheckCircle,
  AlertCircle, XCircle,
} from 'lucide-react';
import CrmCustomerWidget from '@/components/crm/CrmCustomerWidget';
import { clientLogger } from '@/lib/client-logger';

// ─── Collapsible Section wrapper ─────────────────────────────────────────
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  viewAllHref,
  viewAllLabel = 'View All',
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Icon className="w-5 h-5 text-gray-500" />
          <CardTitle>{title}</CardTitle>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ml-1 ${open ? '' : '-rotate-90'}`}
          />
        </button>
        {viewAllHref && (
          <Link href={viewAllHref}>
            <Button variant="ghost" size="sm">{viewAllLabel}</Button>
          </Link>
        )}
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Main page ───────────────────────────────────────────────────────────
export default function AccountOverviewPage() {
  const { customer, contexts, pendingClaims } = useCustomerAuth();
  const [recentOrders, setRecentOrders] = useState<CustomerOrder[]>([]);
  const [digitalDownloadsCount, setDigitalDownloadsCount] = useState(0);
  const [addressCount, setAddressCount] = useState(0);
  const [savedCouponCount, setSavedCouponCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Marketing / platform data
  const [marketingOverview, setMarketingOverview] = useState<CustomerPortalOverview | null>(null);
  const [gbpStatus, setGbpStatus] = useState<GbpStatusResponse | null>(null);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [gbpLoading, setGbpLoading] = useState(false);

  const isPlatform = contexts?.platform === true;

  useEffect(() => {
    if (customer?.email) {
      loadRecentOrders();
    }
    if (customer?.id) {
      loadSavedCouponCount();
    }
  }, [customer?.email, customer?.id]);

  // Load marketing + GBP data only when platform context is active
  useEffect(() => {
    if (!isPlatform) return;
    loadMarketingOverview();
    loadGbpStatus();
  }, [isPlatform]);

  const loadRecentOrders = async () => {
    if (!customer?.email) return;
    try {
      const result = await customerOrderService.getCustomerOrders(customer.email, 1, 5);
      setRecentOrders(result.orders);
      let digitalCount = 0;
      for (const order of result.orders) {
        for (const item of order.items) {
          if (item.productType === 'digital' || item.productType === 'hybrid') {
            digitalCount++;
          }
        }
      }
      setDigitalDownloadsCount(digitalCount);
      try {
        const addrResult = await customerAddressesService.listAddresses();
        setAddressCount(addrResult.addresses?.length || 0);
      } catch (addressError) {
        clientLogger.error('Failed to load addresses:', { detail: addressError });
        setAddressCount(0);
      }
    } catch (error) {
      clientLogger.error('Failed to load recent orders:', { detail: error });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedCouponCount = async () => {
    try {
      const result = await customerCouponWalletService.getStats();
      if (result.success && result.stats) {
        setSavedCouponCount(result.stats.active);
      }
    } catch (error) {
      clientLogger.error('Failed to load saved coupon count:', { detail: error });
      setSavedCouponCount(0);
    }
  };

  const loadMarketingOverview = useCallback(async () => {
    setMarketingLoading(true);
    try {
      const data = await marketingCustomerService.getOverview();
      setMarketingOverview(data);
    } catch {
      // Non-critical
    } finally {
      setMarketingLoading(false);
    }
  }, []);

  const loadGbpStatus = useCallback(async () => {
    setGbpLoading(true);
    try {
      const data = await marketingCustomerService.getGbpStatus();
      setGbpStatus(data);
    } catch {
      // Non-critical
    } finally {
      setGbpLoading(false);
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'shipped':
        return 'text-purple-600 bg-purple-50';
      case 'delivered':
        return 'text-green-600 bg-green-50';
      case 'cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {customer?.firstName || 'Customer'}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here's an overview of your account
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{recentOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Saved Addresses</p>
                <p className="text-2xl font-bold text-gray-900">{addressCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${recentOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link href="/account/coupons">
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Saved Coupons</p>
                  <p className="text-2xl font-bold text-gray-900">{savedCouponCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pending Directory Claims — shown regardless of platform context */}
      {pendingClaims.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 bg-amber-100">
            <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Directory Claim Requests ({pendingClaims.length})
            </h3>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingClaims.map((claim) => {
              const isPending = claim.status === 'pending';
              const isApproved = claim.status === 'approved';
              const isRejected = claim.status === 'rejected';
              return (
                <div key={claim.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {claim.business_name || 'Unknown Business'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {claim.category}
                      {claim.city ? ` · ${claim.city}, ${claim.state}` : ''}
                      {' · Submitted '}
                      {new Date(claim.submitted_at).toLocaleDateString()}
                    </p>
                    {isRejected && claim.rejection_reason && (
                      <p className="text-xs text-red-600 mt-1">
                        Reason: {claim.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pending Review
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {pendingClaims.some((c) => c.status === 'pending') && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
              <p className="text-xs text-amber-700">
                Our team will review your claim within 1-2 business days. Once approved,
                your Google Business Profile tools will appear in the dashboard.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Orders — collapsible */}
      <CollapsibleSection
        title="Recent Orders"
        icon={Package}
        defaultOpen={true}
        viewAllHref="/account/orders"
      >
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading orders...</div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No orders yet</p>
            <Link href="/">
              <Button>Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <Link
                key={order.orderId}
                href={`/account/orders/${order.orderId}`}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{order.orderNumber}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${order.total.toFixed(2)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.orderStatus)}`}>
                    {order.orderStatus}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* My Services — collapsible, only when platform context */}
      {isPlatform && (
        <CollapsibleSection
          title="My Services"
          icon={Briefcase}
          defaultOpen={false}
          viewAllHref="/account/marketing"
        >
          {marketingLoading ? (
            <div className="text-center py-8 text-gray-500">Loading services...</div>
          ) : marketingOverview ? (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-gray-500">Total Spent</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {formatPrice(marketingOverview.totalSpentCents)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-gray-500">Active Engagements</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {marketingOverview.activeEngagements}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <p className="text-xs text-gray-500">Deliverables Ready</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {marketingOverview.deliverablesReady}
                  </p>
                </div>
              </div>

              {/* Campaigns list (top 3) */}
              {marketingOverview.campaigns.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p>No marketing campaigns yet.</p>
                  <Link href="/account/marketing" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                    Explore services →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {marketingOverview.campaigns.slice(0, 3).map((campaign) => (
                    <Link
                      key={campaign.id}
                      href={`/account/marketing/campaigns/${campaign.id}`}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{campaign.businessName}</p>
                          <p className="text-xs text-gray-500">{campaign.serviceCategoryLabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          campaign.status.status === 'delivered' ? 'bg-green-50 text-green-700' :
                          campaign.status.status === 'in_production' ? 'bg-blue-50 text-blue-700' :
                          campaign.status.status === 'active_plan' ? 'bg-purple-50 text-purple-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {campaign.status.label}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to load services.{' '}
              <Link href="/account/marketing" className="text-blue-600 hover:underline">
                View all →
              </Link>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Google Business — collapsible, only when platform context */}
      {isPlatform && (
        <CollapsibleSection
          title="Google Business"
          icon={Building2}
          defaultOpen={false}
          viewAllHref="/account/marketing/gbp"
        >
          {gbpLoading ? (
            <div className="text-center py-8 text-gray-500">Loading GBP status...</div>
          ) : gbpStatus ? (
            <div className="space-y-4">
              {/* Connection status */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  gbpStatus.connected ? 'bg-green-100' : 'bg-gray-200'
                }`}>
                  <Building2 className={`w-5 h-5 ${gbpStatus.connected ? 'text-green-600' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {gbpStatus.connected ? 'Google Business Profile Connected' : 'Not Connected'}
                  </p>
                  {gbpStatus.location && (
                    <p className="text-sm text-gray-500">
                      {gbpStatus.location.locationName || gbpStatus.location.businessName || gbpStatus.location.address}
                    </p>
                  )}
                </div>
                {!gbpStatus.connected && (
                  <Link href="/account/marketing/gbp">
                    <Button size="sm">Connect</Button>
                  </Link>
                )}
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link
                  href="/account/marketing/gbp/reviews"
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <Star className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Reviews</p>
                    <p className="text-xs text-gray-500">View & respond</p>
                  </div>
                </Link>
                <Link
                  href="/account/marketing/gbp/posts"
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <Package className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Posts</p>
                    <p className="text-xs text-gray-500">Schedule updates</p>
                  </div>
                </Link>
                <Link
                  href="/account/marketing/gbp/media"
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <Download className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Media</p>
                    <p className="text-xs text-gray-500">Photos & videos</p>
                  </div>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to load GBP status.{' '}
              <Link href="/account/marketing/gbp" className="text-blue-600 hover:underline">
                View dashboard →
              </Link>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/account/addresses">
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Addresses</p>
                  <p className="text-sm text-gray-600">Add or update your shipping addresses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/account/settings">
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Account Settings</p>
                  <p className="text-sm text-gray-600">Update your profile and preferences</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/account/downloads">
          <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Download className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Digital Downloads</p>
                  <p className="text-sm text-gray-600">Access your digital products</p>
                </div>
                {digitalDownloadsCount > 0 && (
                  <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                    {digitalDownloadsCount}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Support Widget */}
      <CrmCustomerWidget />
    </div>
  );
}
