'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Star, Search, CreditCard, Sparkles, Check, AlertCircle, Loader2, Package, Clock } from 'lucide-react';
import { FeaturedPlacementPurchaseService, type PlacementPlan, type PlacementPurchase } from '@/services/FeaturedPlacementPurchaseService';
import { itemsService } from '@/services/ItemsService';
import { subscriptionBillingService, type PaymentMethod } from '@/services/SubscriptionBillingService';
import SetTenantId from '@/components/client/SetTenantId';

interface Item {
  id: string;
  name: string;
  product_slug?: string;
  images?: string[];
  metadata?: any;
}

interface ItemResponse {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function FeaturedStoreClient({ tenantId }: { tenantId: string }) {
  const [plans, setPlans] = useState<PlacementPlan[]>([]);
  const [purchases, setPurchases] = useState<PlacementPurchase[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Step state: 1 = select product, 2 = select plan, 3 = payment
  const [step, setStep] = useState(1);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlacementPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);

  const svc = FeaturedPlacementPurchaseService;

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      setLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      (window as any).__currentTenantId = tenantId;
    }

    try {
      setLoading(true);
      const [plansData, purchasesData, itemsData, methodsData] = await Promise.all([
        svc.listPlans(),
        svc.listPurchases(tenantId),
        itemsService.getItems(tenantId, { page: 1, pageSize: 100, search: '' }),
        subscriptionBillingService.getPaymentMethods(),
      ]);
      setPlans(plansData);
      setPurchases(purchasesData);
      setItems((itemsData as any)?.items || []);
      setPaymentMethods(methodsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load featured store');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredItems = items.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activePurchasesByItem = new Map(
    purchases
      .filter(p => p.status === 'active' || p.status === 'pending')
      .map(p => [p.inventoryItemId, p])
  );

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setSelectedPlan(null);
    setStep(2);
  };

  const handleSelectPlan = (plan: PlacementPlan) => {
    setSelectedPlan(plan);
    setStep(3);
  };

  const handlePurchase = async () => {
    if (!selectedItem || !selectedPlan) return;

    try {
      setProcessing(true);
      setError(null);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const result = await svc.createPurchase(tenantId, {
        inventoryItemId: selectedItem.id,
        planKey: selectedPlan.planKey,
        successUrl: `${origin}/t/${tenantId}/settings/featured-store?status=success`,
        cancelUrl: `${origin}/t/${tenantId}/settings/featured-store?status=cancelled`,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setSuccess('Purchase initiated successfully!');
        setShowCheckout(false);
        await loadData();
        setStep(1);
        setSelectedItem(null);
        setSelectedPlan(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process purchase');
    } finally {
      setProcessing(false);
    }
  };

  const handleRenew = async (purchase: PlacementPurchase) => {
    try {
      setProcessing(true);
      setError(null);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const result = await svc.renewPurchase(tenantId, purchase.id, {
        successUrl: `${origin}/t/${tenantId}/settings/featured-store?status=renewed`,
        cancelUrl: `${origin}/t/${tenantId}/settings/featured-store?status=cancelled`,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to renew placement');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  };

  const formatDuration = (days: number) => {
    if (days === 7) return '1 week';
    if (days === 14) return '2 weeks';
    if (days === 30) return '1 month';
    if (days === 90) return '3 months';
    return `${days} days`;
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return '—';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    return `${diffDays} days left`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading featured store...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SetTenantId tenantId={tenantId} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href={`/t/${tenantId}/settings`} className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Settings
              </Link>
              <div className="flex items-center">
                <Sparkles className="w-6 h-6 text-amber-500 mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">Featured Store</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <span className="sr-only">Dismiss</span>
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
              <span className="sr-only">Dismiss</span>
              ×
            </button>
          </div>
        )}

        {/* Active Placements */}
        {purchases.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your Featured Placements</h2>
              <p className="text-sm text-gray-500 mt-1">Active and recent placement purchases</p>
            </div>
            <div className="divide-y divide-gray-100">
              {purchases.map(purchase => {
                const item = items.find(i => i.id === purchase.inventoryItemId);
                const isActive = purchase.status === 'active';
                const isExpired = purchase.status === 'expired';
                const isRevoked = purchase.status === 'revoked';

                return (
                  <div key={purchase.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-green-500' : isExpired ? 'bg-gray-400' : isRevoked ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item?.name || purchase.inventoryItemId}
                        </p>
                        <p className="text-xs text-gray-500">
                          {svc.formatSurface(purchase.surface)} · {formatPrice(purchase.priceCents, purchase.currency || 'USD')} · {formatDuration(purchase.durationDays)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-xs font-medium ${
                          isActive ? 'text-green-600' : isExpired ? 'text-gray-500' : isRevoked ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {svc.formatStatus(purchase.status)}
                        </p>
                        {isActive && (
                          <p className="text-xs text-gray-400">{formatExpiry(purchase.expiresAt)}</p>
                        )}
                      </div>
                      {isActive && (
                        <button
                          onClick={() => handleRenew(purchase)}
                          disabled={processing}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                        >
                          Renew
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Purchase Flow */}
        {plans.length === 0 && !loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Featured Plans Available</h3>
            <p className="text-sm text-gray-500">Featured placement plans are not currently configured. Check back later.</p>
          </div>
        ) : (
          <>
            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-4">
              {[
                { num: 1, label: 'Select Product' },
                { num: 2, label: 'Choose Plan' },
                { num: 3, label: 'Checkout' },
              ].map((s, idx) => (
                <div key={s.num} className="flex items-center">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      step >= s.num ? 'bg-white text-blue-600' : 'bg-gray-300 text-gray-600'
                    }`}>{s.num}</span>
                    {s.label}
                  </div>
                  {idx < 2 && <div className={`w-8 h-0.5 ${step > s.num ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Product Picker */}
            {step === 1 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Select a Product to Feature</h2>
                  <p className="text-sm text-gray-500 mt-1">Choose which product you want to promote with a featured placement</p>
                </div>
                <div className="p-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        {items.length === 0 ? 'No products found. Add products first.' : 'No products match your search.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredItems.map(item => {
                        const activePurchase = activePurchasesByItem.get(item.id);
                        const itemImage = item.images?.[0] || (item.metadata?.images?.[0]);

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectItem(item)}
                            className="w-full px-6 py-3 flex items-center gap-4 hover:bg-blue-50 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                              {itemImage ? (
                                <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400 m-auto mt-2.5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                              {item.product_slug && (
                                <p className="text-xs text-gray-400 truncate">{item.product_slug}</p>
                              )}
                            </div>
                            {activePurchase && (
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                activePurchase.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {svc.formatStatus(activePurchase.status)}
                              </span>
                            )}
                            <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Plan Selection */}
            {step === 2 && selectedItem && (
              <div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex-shrink-0 overflow-hidden">
                    {selectedItem.images?.[0] || selectedItem.metadata?.images?.[0] ? (
                      <img src={selectedItem.images?.[0] || selectedItem.metadata?.images?.[0]} alt={selectedItem.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-gray-400 m-auto mt-2.5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Featuring: {selectedItem.name}</p>
                    <button onClick={() => setStep(1)} className="text-xs text-blue-600 hover:underline">
                      Change product
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan)}
                      className={`text-left bg-white rounded-lg border-2 p-5 transition-all hover:shadow-md ${
                        selectedPlan?.id === plan.id
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-500" />
                          <h3 className="font-semibold text-gray-900">{plan.label}</h3>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{svc.formatSurface(plan.surface)}</p>
                      <div className="mb-3">
                        <span className="text-2xl font-bold text-gray-900">{formatPrice(plan.priceCents, plan.currency || 'USD')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatDuration(plan.durationDays)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                        <Sparkles className="w-4 h-4" />
                        Select Plan
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Checkout */}
            {step === 3 && selectedItem && selectedPlan && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Review & Checkout</h2>
                </div>
                <div className="p-6 space-y-5">
                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Product</span>
                      <span className="text-sm font-medium text-gray-900">{selectedItem.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Placement</span>
                      <span className="text-sm font-medium text-gray-900">{selectedPlan.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Surface</span>
                      <span className="text-sm font-medium text-gray-900">{svc.formatSurface(selectedPlan.surface)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Duration</span>
                      <span className="text-sm font-medium text-gray-900">{formatDuration(selectedPlan.durationDays)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Total</span>
                      <span className="text-lg font-bold text-gray-900">{formatPrice(selectedPlan.priceCents, selectedPlan.currency || 'USD')}</span>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-gray-500" />
                      <h3 className="text-sm font-semibold text-gray-900">Payment Method</h3>
                    </div>
                    {paymentMethods.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                          No payment methods on file. You'll be redirected to Stripe to complete payment securely.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {paymentMethods.map(method => (
                          <div key={method.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {method.cardBrand ? `${method.cardBrand} •••• ${method.cardLast4}` : method.paypalEmail || 'Payment method'}
                            </span>
                            {method.isDefault && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Default</span>
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-gray-400 mt-2">
                          You'll be redirected to Stripe to complete payment securely.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePurchase}
                      disabled={processing}
                      className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Purchase Featured Placement
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
