'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard, Sparkles, Star, Zap, TrendingUp,
  ArrowLeft, Plus, AlertCircle, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import SetTenantId from '@/components/client/SetTenantId';
import { subscriptionBillingService, type PaymentMethod } from '@/services/SubscriptionBillingService';
import { bsaasPurchaseService } from '@/services/BsaasPurchaseService';
import FeaturedPlacementPurchaseService from '@/services/FeaturedPlacementPurchaseService';
import DirectoryPromotionService from '@/services/DirectoryPromotionService';
import { useTenantComplete } from '@/hooks/dashboard/useTenantComplete';

// Lazy-load each store component so only the active tab's code is fetched
const SubscriptionPage = dynamic(() => import('@/app/(platform)/settings/subscription/page'), {
  ssr: false,
  loading: () => <TabLoading />,
});
const FeatureStorePage = dynamic(() => import('@/app/(platform)/settings/feature-store/page'), {
  ssr: false,
  loading: () => <TabLoading />,
});
const FeaturedStoreClient = dynamic(() => import('@/app/t/[tenantId]/settings/featured-store/FeaturedStoreClient'), {
  ssr: false,
  loading: () => <TabLoading />,
});
const PromotionSettingsPage = dynamic(() => import('@/app/t/[tenantId]/settings/promotion/page'), {
  ssr: false,
  loading: () => <TabLoading />,
});

type TabKey = 'plans' | 'features' | 'placements' | 'promotions';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabDef[] = [
  {
    key: 'plans',
    label: 'Plans',
    icon: <TrendingUp className="w-4 h-4" />,
    description: 'Manage your subscription tier',
  },
  {
    key: 'features',
    label: 'Features',
    icon: <Zap className="w-4 h-4" />,
    description: 'Purchase a la carte features',
  },
  {
    key: 'placements',
    label: 'Featured Products',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Promote individual products',
  },
  {
    key: 'promotions',
    label: 'Directory Promotion',
    icon: <Star className="w-4 h-4" />,
    description: 'Promote your store on the directory',
  },
];

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function PaymentMethodsBar({ tenantId }: { tenantId: string }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMethods = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        (window as any).__currentTenantId = tenantId;
      }
      const methods = await subscriptionBillingService.getPaymentMethods();
      setPaymentMethods(methods || []);
    } catch {
      // silently fail — the bar is informational
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400">
        <CreditCard className="w-4 h-4" />
        Loading payment methods...
      </div>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <Link
        href={`/t/${tenantId}/settings/subscription`}
        className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition-colors"
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>No payment method on file.</span>
        <span className="font-medium underline">Add one now</span>
        <Plus className="w-3.5 h-3.5" />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm">
      <CreditCard className="w-4 h-4 text-green-600 flex-shrink-0" />
      <span className="text-green-800">
        {paymentMethods.length} payment method{paymentMethods.length > 1 ? 's' : ''} on file
      </span>
      <div className="flex items-center gap-1.5 ml-auto">
        {paymentMethods.slice(0, 3).map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
            {m.cardBrand ? `${m.cardBrand} ••••${m.cardLast4}` : m.paypalEmail || 'Payment'}
            {m.isDefault && <span className="text-blue-600 font-medium">★</span>}
          </span>
        ))}
        {paymentMethods.length > 3 && (
          <span className="text-xs text-gray-400">+{paymentMethods.length - 3} more</span>
        )}
        <Link
          href={`/t/${tenantId}/settings/subscription`}
          className="ml-2 text-xs font-medium text-blue-600 hover:text-blue-700 underline"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

function StoreSummaryPanel({ tenantId }: { tenantId: string }) {
  const { tier, tenant: tenantData } = useTenantComplete(tenantId, false);
  const [featurePurchases, setFeaturePurchases] = useState<any[]>([]);
  const [placementPurchases, setPlacementPurchases] = useState<any[]>([]);
  const [promotionPurchases, setPromotionPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__currentTenantId = tenantId;
    }
    let cancelled = false;
    (async () => {
      try {
        const [features, placements, promotions] = await Promise.allSettled([
          bsaasPurchaseService.getFeaturePurchases(),
          FeaturedPlacementPurchaseService.listPurchases(tenantId, 'active'),
          DirectoryPromotionService.listPurchases(tenantId, 'active'),
        ]);
        if (cancelled) return;
        if (features.status === 'fulfilled') setFeaturePurchases(features.value || []);
        if (placements.status === 'fulfilled') setPlacementPurchases(placements.value || []);
        if (promotions.status === 'fulfilled') setPromotionPurchases(promotions.value || []);
      } catch {
        // informational panel — silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const activeFeatures = featurePurchases.filter((p: any) => p.status === 'active');
  const activePlacements = placementPurchases.filter((p: any) => p.status === 'active');
  const activePromotions = promotionPurchases.filter((p: any) => p.status === 'active');

  const tierName = tier?.effective?.name || tenantData?.subscriptionTier || '—';
  const tierStatus = tenantData?.subscriptionStatus || 'active';

  const cards = [
    {
      label: 'Plan',
      value: tierName,
      sub: tierStatus.charAt(0).toUpperCase() + tierStatus.slice(1),
      icon: <TrendingUp className="w-5 h-5" />,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      active: tierStatus === 'active' || tierStatus === 'trialing',
      count: null as number | null,
    },
    {
      label: 'Features',
      value: `${activeFeatures.length} active`,
      sub: `${featurePurchases.length} total purchases`,
      icon: <Zap className="w-5 h-5" />,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      active: activeFeatures.length > 0,
      count: activeFeatures.length,
    },
    {
      label: 'Featured Products',
      value: `${activePlacements.length} active`,
      sub: `${placementPurchases.length} total purchases`,
      icon: <Sparkles className="w-5 h-5" />,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      active: activePlacements.length > 0,
      count: activePlacements.length,
    },
    {
      label: 'Directory Promotion',
      value: `${activePromotions.length} active`,
      sub: `${promotionPurchases.length} total purchases`,
      icon: <Star className="w-5 h-5" />,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      active: activePromotions.length > 0,
      count: activePromotions.length,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-5 w-5 rounded bg-gray-200 mb-3" />
            <div className="h-4 w-20 rounded bg-gray-200 mb-2" />
            <div className="h-3 w-16 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                <span className={card.iconColor}>{card.icon}</span>
              </div>
              <span className="text-sm font-medium text-gray-700">{card.label}</span>
            </div>
            {card.active ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                None
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppStoreClient({
  tenantId,
  initialTab = 'plans',
}: {
  tenantId: string;
  initialTab?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlTab = searchParams?.get('tab') as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    (urlTab && TABS.some((t) => t.key === urlTab) ? urlTab : initialTab) as TabKey
  );

  // Sync tab with URL for deep-linking
  useEffect(() => {
    const tab = searchParams?.get('tab') as TabKey | null;
    if (tab && TABS.some((t) => t.key === tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', tab);
    router.replace(`/t/${tenantId}/settings/store?${params.toString()}`, { scroll: false });
  };

  const activeTabDef = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <SetTenantId tenantId={tenantId} />

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href={`/t/${tenantId}/settings`}
                className="flex items-center text-gray-500 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">App Store</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Payment methods bar */}
        <PaymentMethodsBar tenantId={tenantId} />

        {/* Store activity summary */}
        <StoreSummaryPanel tenantId={tenantId} />

        {/* Tab bar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
                    isActive
                      ? 'text-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab description */}
          <div className="px-5 py-2.5 bg-gray-50/50 border-b border-gray-100">
            <p className="text-xs text-gray-500">{activeTabDef.description}</p>
          </div>

          {/* Tab content */}
          <div className="p-5">
            <Suspense fallback={<TabLoading />}>
              {activeTab === 'plans' && <SubscriptionPage />}
              {activeTab === 'features' && <FeatureStorePage />}
              {activeTab === 'placements' && <FeaturedStoreClient tenantId={tenantId} />}
              {activeTab === 'promotions' && <PromotionSettingsPage tenantId={tenantId} />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
