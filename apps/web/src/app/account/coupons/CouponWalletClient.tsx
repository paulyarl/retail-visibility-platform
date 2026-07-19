'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Ticket,
  ShoppingBag,
  Clock,
  Trash2,
  Copy,
  AlertCircle,
  Percent,
  DollarSign,
  Truck,
  Gift
} from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { clientLogger } from '@/lib/client-logger';
import customerCouponWalletService, { SavedCoupon, WalletStats } from '@/services/CustomerCouponWalletService';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'saved' | 'expiring' | 'redeemed' | 'expired';

const discountIcon = (discountType: string) => {
  switch (discountType) {
    case 'percent_off': return <Percent className="w-4 h-4" />;
    case 'fixed_amount': return <DollarSign className="w-4 h-4" />;
    case 'free_shipping': return <Truck className="w-4 h-4" />;
    case 'bogo': return <Gift className="w-4 h-4" />;
    default: return <Ticket className="w-4 h-4" />;
  }
};

const discountLabel = (discountType: string, discountValue: number) => {
  switch (discountType) {
    case 'percent_off': return `${discountValue}% off`;
    case 'fixed_amount': return `$${discountValue.toFixed(2)} off`;
    case 'free_shipping': return 'Free shipping';
    case 'bogo': return 'Buy one get one';
    default: return 'Discount';
  }
};

const formatExpiry = (expiresAt: string | null, status: string) => {
  if (status === 'expired') return 'Expired';
  if (status === 'redeemed') return 'Redeemed';
  if (!expiresAt) return 'No expiry';
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Expired';
  if (diff === 0) return 'Expires today';
  if (diff <= 2) return `Expires in ${diff} day${diff === 1 ? '' : 's'}`;
  if (diff <= 7) return `Expires in ${diff} days`;
  return `Expires ${expiry.toLocaleDateString()}`;
};

export default function CouponWalletClient() {
  const { customer } = useCustomerAuth();
  const [savedCoupons, setSavedCoupons] = useState<SavedCoupon[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = async () => {
    if (!customer?.id) return;
    setLoading(true);
    setError(null);

    const [walletResult, statsResult] = await Promise.all([
      customerCouponWalletService.getWallet({
        status: activeFilter === 'all' || activeFilter === 'expiring' ? undefined : activeFilter,
        limit: 200,
      }),
      customerCouponWalletService.getStats(),
    ]);

    if (walletResult.success && walletResult.savedCoupons) {
      let coupons = walletResult.savedCoupons;
      if (activeFilter === 'expiring') {
        const soonResult = await customerCouponWalletService.getExpiringSoon(7);
        if (soonResult.success) coupons = soonResult.savedCoupons ?? [];
      }
      setSavedCoupons(coupons);
    } else {
      setError(walletResult.error || 'Failed to load wallet');
      clientLogger.error('Failed to load wallet:', { detail: walletResult.error });
    }

    if (statsResult.success && statsResult.stats) {
      setStats(statsResult.stats);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadWallet();
  }, [customer?.id, activeFilter]);

  const handleUnsave = async (savedCouponId: string) => {
    const result = await customerCouponWalletService.unsaveCoupon(savedCouponId);
    if (result.success) {
      loadWallet();
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, SavedCoupon[]>();
    for (const c of savedCoupons) {
      const list = map.get(c.tenantId) ?? [];
      list.push(c);
      map.set(c.tenantId, list);
    }
    return map;
  }, [savedCoupons]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All ${stats ? `(${stats.totalSaved})` : ''}` },
    { key: 'saved', label: `Active ${stats ? `(${stats.active})` : ''}` },
    { key: 'expiring', label: `Expiring Soon ${stats ? `(${stats.expiringSoon})` : ''}` },
    { key: 'redeemed', label: `Redeemed ${stats ? `(${stats.redeemed})` : ''}` },
    { key: 'expired', label: 'Expired' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Coupons</h1>
          <p className="text-gray-600 mt-1">Coupons you have saved from your favorite merchants</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Browse Stores
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Saved</p>
                <p className="text-xl font-bold text-gray-900">{stats?.totalSaved ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-xl font-bold text-gray-900">{stats?.active ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Expiring Soon</p>
                <p className="text-xl font-bold text-gray-900">{stats?.expiringSoon ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Percent className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Savings</p>
                <p className="text-xl font-bold text-gray-900">${(stats?.totalSavingsCents ?? 0 / 100).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring banner */}
      {stats && stats.expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Coupons expiring soon</p>
            <p className="text-sm text-amber-700">
              You have {stats.expiringSoon} saved coupon{stats.expiringSoon === 1 ? '' : 's'} expiring within 7 days.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeFilter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Coupons */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading coupons...</div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : savedCoupons.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No saved coupons yet</p>
              <Link href="/">
                <Button>Browse stores and save coupons</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([tenantId, coupons]) => (
                <div key={tenantId} className="space-y-3">
                  <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                    {coupons[0]?.tenantLogo ? (
                      <img
                        src={coupons[0].tenantLogo}
                        alt={coupons[0].tenantName ?? ''}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {(coupons[0]?.tenantName ?? 'S').charAt(0)}
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900">{coupons[0]?.tenantName ?? 'Unknown Merchant'}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {coupons.map((coupon) => (
                      <div
                        key={coupon.savedCouponId}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                              {discountIcon(coupon.discountType)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{discountLabel(coupon.discountType, coupon.discountValue)}</p>
                              <p className="text-sm font-mono text-gray-600">{coupon.code}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn(
                              'text-xs px-2 py-1 rounded-full',
                              coupon.status === 'saved' ? 'bg-green-100 text-green-700' :
                              coupon.status === 'redeemed' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            )}>
                              {coupon.status}
                            </span>
                          </div>
                        </div>

                        {coupon.promotionalMessage && (
                          <p className="mt-3 text-sm text-gray-700">{coupon.promotionalMessage}</p>
                        )}
                        {coupon.termsSummary && (
                          <p className="mt-1 text-xs text-gray-500">{coupon.termsSummary}</p>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          <p className={cn(
                            'text-sm',
                            coupon.status === 'saved' && coupon.expiresAt && new Date(coupon.expiresAt).getTime() - Date.now() < 1000 * 60 * 60 * 48
                              ? 'text-amber-600 font-medium'
                              : 'text-gray-500'
                          )}>
                            {formatExpiry(coupon.expiresAt, coupon.status)}
                          </p>
                          <div className="flex items-center gap-2">
                            {coupon.status === 'saved' && (
                              <Link
                                href={`/tenant/${coupon.tenantId}?coupon=${encodeURIComponent(coupon.code)}`}
                              >
                                <Button size="sm" variant="outline">Shop Now</Button>
                              </Link>
                            )}
                            <button
                              onClick={() => navigator.clipboard.writeText(coupon.code)}
                              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                              title="Copy code"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            {coupon.status !== 'redeemed' && (
                              <button
                                onClick={() => handleUnsave(coupon.savedCouponId)}
                                className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                title="Remove from wallet"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
