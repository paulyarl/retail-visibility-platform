'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Badge, Button, Modal, Group, Text, Stack, Alert, Loader, Grid } from '@mantine/core';
import { IconCheck, IconAlertCircle, IconCreditCard, IconBolt, IconCircleX, IconInfoCircle, IconTag, IconLock, IconPalette } from '@tabler/icons-react';
import { TrendingUp, Eye, Zap, BarChart3, Wrench, Package } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { bsaasPurchaseService, type BsaasCatalogItem, type BsaasBundleCatalogItem } from '@/services/BsaasPurchaseService';
import { subscriptionBillingService, type PaymentMethod } from '@/services/SubscriptionBillingService';
import { tenantPublicService } from '@/services/TenantPublicService';

export const dynamic = 'force-dynamic';

export default function FeatureStorePage({ tenantId: propTenantId }: { tenantId?: string } = {}) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const tenantId = propTenantId || searchParams?.get('tenantId') || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);

  const [catalog, setCatalog] = useState<BsaasCatalogItem[]>([]);
  const [bundleCatalog, setBundleCatalog] = useState<BsaasBundleCatalogItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [purchaseTarget, setPurchaseTarget] = useState<BsaasCatalogItem | null>(null);
  const [bundleTarget, setBundleTarget] = useState<BsaasBundleCatalogItem | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showBundleConfirm, setShowBundleConfirm] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<{ discountCents: number; chargedAmount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isDemoTenant, setIsDemoTenant] = useState(false);
  const [urlPromoCode, setUrlPromoCode] = useState<string | null>(null);
  const [grantToken, setGrantToken] = useState<string | null>(null);
  const [grantRedeeming, setGrantRedeeming] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'features' | 'bundles' | 'services'>('features');

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
      const [catalogData, bundleData, methodsData, tenantInfo] = await Promise.all([
        bsaasPurchaseService.getFeatureCatalog(),
        bsaasPurchaseService.getBundleCatalog(),
        subscriptionBillingService.getPaymentMethods(),
        tenantPublicService.getPublicTenantInfo(tenantId),
      ]);
      setCatalog(catalogData);
      setBundleCatalog(bundleData);
      setPaymentMethods(methodsData || []);
      setIsDemoTenant(tenantInfo?.isDemo || false);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature store');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const promoFromUrl = searchParams?.get('promo');
    if (promoFromUrl) {
      setUrlPromoCode(promoFromUrl);
      setPromoCode(promoFromUrl);
    }
    const grantFromUrl = searchParams?.get('grant');
    if (grantFromUrl) {
      setGrantToken(grantFromUrl);
    }
  }, [searchParams]);

  const handlePurchaseClick = (item: BsaasCatalogItem) => {
    if (item.tierAvailability === 'in_tier_active') {
      setError(`"${item.name}" is already included in your subscription tier — no purchase needed.`);
      return;
    }
    if (item.tierAvailability === 'in_tier_gate_off') {
      setError(`"${item.name}" is included in your tier but disabled in your settings. Enable it in your Settings page instead of purchasing.`);
      return;
    }
    if (item.purchase?.status === 'active') {
      setError(`"${item.name}" is already active for your tenant.`);
      return;
    }
    if (item.tierEligible === false) {
      setError(item.ineligibleReason || 'Your current plan does not support purchasing this feature. Please upgrade your plan.');
      return;
    }

    const defaultMethod = paymentMethods.find(m => m.isDefault) || paymentMethods[0];
    if (!defaultMethod) {
      setError('No payment method found. Please add a payment method in your subscription settings first.');
      return;
    }

    setPurchaseTarget(item);
    setSelectedPaymentMethodId(defaultMethod.id);
    setPromoCode(urlPromoCode || '');
    setPromoDiscount(null);
    setPromoError(null);
    setShowConfirm(true);
    setError(null);
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseTarget || !selectedPaymentMethodId) return;

    try {
      setProcessing(true);
      setError(null);

      const result = await bsaasPurchaseService.purchaseFeature(
        purchaseTarget.key,
        selectedPaymentMethodId,
        promoCode.trim() || undefined
      );

      if (result.success) {
        setSuccess(`Successfully purchased "${purchaseTarget.name}"! The feature is now active.`);
        setShowConfirm(false);
        setPurchaseTarget(null);
        await loadData();
      } else {
        if (result.error === 'in_tier_already') {
          setError(`This feature is already included in your subscription tier — no purchase needed.`);
        } else if (result.error === 'in_tier_gate_off') {
          setError(`This feature is included in your tier but disabled in your settings. Enable it in your Settings page instead.`);
        } else if (result.error === 'payment_failed') {
          setError(result.message || 'Payment failed. Please check your payment method.');
        } else if (result.error === 'upgrade_required') {
          setError(result.message || 'Your current plan does not support purchasing this feature. Please upgrade your plan.');
        } else if (result.error === 'already_active') {
          setError('This feature is already active for your tenant.');
        } else if (result.error === 'demo_tenant_blocked') {
          setError(result.message || 'This feature is not available for demo tenants.');
        } else {
          setError(result.message || result.error || 'Failed to purchase feature');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process purchase');
    } finally {
      setProcessing(false);
    }
  };

  const handleBundlePurchaseClick = (bundle: BsaasBundleCatalogItem) => {
    if (bundle.allActive) {
      setError(`All components of "${bundle.name}" are already active for your tenant.`);
      return;
    }
    if (bundle.allInTier) {
      setError(`All components of "${bundle.name}" are already included in your subscription plan — no purchase needed.`);
      return;
    }
    if (bundle.tierEligible === false) {
      setError(bundle.ineligibleReason || 'Your current plan does not support purchasing this bundle. Please upgrade your plan.');
      return;
    }

    const defaultMethod = paymentMethods.find(m => m.isDefault) || paymentMethods[0];
    if (!defaultMethod) {
      setError('No payment method found. Please add a payment method in your subscription settings first.');
      return;
    }

    setBundleTarget(bundle);
    setSelectedPaymentMethodId(defaultMethod.id);
    setPromoCode(urlPromoCode || '');
    setPromoDiscount(null);
    setPromoError(null);
    setShowBundleConfirm(true);
    setError(null);
  };

  const handleConfirmBundlePurchase = async () => {
    if (!bundleTarget || !selectedPaymentMethodId) return;

    try {
      setProcessing(true);
      setError(null);

      const result = await bsaasPurchaseService.purchaseBundle(
        bundleTarget.bundleKey,
        selectedPaymentMethodId,
        promoCode.trim() || undefined
      );

      if (result.success) {
        const statusLabel = result.data?.status === 'trial' ? ` (trial — ${bundleTarget.trialDays} days)` : '';
        setSuccess(`Successfully purchased "${bundleTarget.name}"${statusLabel}! All components are now active.`);
        setShowBundleConfirm(false);
        setBundleTarget(null);
        await loadData();
      } else {
        if (result.error === 'payment_failed') {
          setError(result.message || 'Payment failed. Please check your payment method.');
        } else if (result.error === 'upgrade_required') {
          setError(result.message || 'Your current plan does not support purchasing this bundle. Please upgrade your plan.');
        } else if (result.error === 'already_active') {
          setError('All components of this bundle are already active for your tenant.');
        } else if (result.error === 'demo_tenant_blocked') {
          setError(result.message || 'This bundle is not available for demo tenants.');
        } else {
          setError(result.message || result.error || 'Failed to purchase bundle');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process bundle purchase');
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    const target = purchaseTarget || bundleTarget;
    if (!target) return;

    const priceCents = 'bundleKey' in target ? target.priceCents : target.priceCents;
    const featureKey = 'key' in target ? target.key : undefined;
    const bundleKey = 'bundleKey' in target ? target.bundleKey : undefined;

    try {
      setPromoValidating(true);
      setPromoError(null);
      setPromoDiscount(null);

      const result = await bsaasPurchaseService.validatePromoCode(
        promoCode.trim(),
        priceCents,
        { featureKey, bundleKey }
      );

      if (result.success && result.data) {
        setPromoDiscount({
          discountCents: result.data.discount_cents,
          chargedAmount: result.data.charged_amount,
        });
      } else {
        setPromoError(result.message || result.error || 'Invalid promo code');
      }
    } catch (err: any) {
      setPromoError(err.message || 'Failed to validate promo code');
    } finally {
      setPromoValidating(false);
    }
  };

  const handleCancelPurchase = async (purchaseId: string, featureName: string) => {
    if (!confirm(`Are you sure you want to cancel "${featureName}"? You will lose access at the end of the current billing period.`)) return;

    try {
      setProcessing(true);
      const result = await bsaasPurchaseService.cancelPurchase(purchaseId);
      if (result.success) {
        setSuccess(`"${featureName}" has been cancelled.`);
        await loadData();
      } else {
        setError(result.message || result.error || 'Failed to cancel purchase');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel purchase');
    } finally {
      setProcessing(false);
    }
  };

  const hasPaymentMethod = paymentMethods.length > 0;

  const formatPrice = (cents: number, cycle: string) => {
    const dollars = (cents / 100).toFixed(2);
    if (cycle === 'one_time') return `$${dollars} one-time`;
    if (cycle === 'annual') return `$${dollars}/year`;
    return `$${dollars}/mo`;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        {success && (
          <Alert icon={<IconCheck size={16} />} color="green" onClose={() => setSuccess(null)} withCloseButton>
            {success}
          </Alert>
        )}

        {urlPromoCode && (
          <Alert icon={<IconTag size={16} />} color="blue" withCloseButton onClose={() => setUrlPromoCode(null)}>
            Promo code <strong>{urlPromoCode}</strong> applied — click a feature or bundle to purchase with discount.
          </Alert>
        )}

        {grantToken && (
          <Card withBorder p="lg" className="bg-purple-50 border-purple-200">
            <Stack gap="sm">
              <div className="flex items-center gap-2">
                <IconLock size={20} className="text-purple-600" />
                <Text fw={600} className="text-purple-900">You&apos;ve been granted access to a feature</Text>
              </div>
              <Text size="sm" c="dimmed">
                Click Redeem to activate this feature on your tenant. This is a complimentary grant — no payment required.
              </Text>
              {grantError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setGrantError(null)} withCloseButton>
                  {grantError}
                </Alert>
              )}
              {grantSuccess && (
                <Alert icon={<IconCheck size={16} />} color="green" onClose={() => setGrantSuccess(null)} withCloseButton>
                  {grantSuccess}
                </Alert>
              )}
              <Group>
                <Button
                  color="grape"
                  onClick={async () => {
                    try {
                      setGrantRedeeming(true);
                      setGrantError(null);
                      const result = await bsaasPurchaseService.redeemGrant(grantToken);
                      if (result.success) {
                        setGrantSuccess(`Successfully activated "${result.data?.feature_name || 'feature'}"!`);
                        setGrantToken(null);
                        await loadData();
                      } else {
                        setGrantError(result.message || result.error || 'Failed to redeem grant');
                      }
                    } catch (err: any) {
                      setGrantError(err.message || 'Failed to redeem grant');
                    } finally {
                      setGrantRedeeming(false);
                    }
                  }}
                  loading={grantRedeeming}
                >
                  Redeem Grant
                </Button>
                <Button variant="subtle" color="gray" onClick={() => setGrantToken(null)}>
                  Dismiss
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setActiveTab('features')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'features'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            Features
            {catalog.filter(item => item.capabilityType !== 'platform_services').length > 0 && (
              <Badge size="xs" variant="light" color="blue">{catalog.filter(item => item.capabilityType !== 'platform_services').length}</Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab('bundles')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'bundles'
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Package className="w-4 h-4" />
            Bundles
            {bundleCatalog.filter(b => !b.allActive).length > 0 && (
              <Badge size="xs" variant="light" color="violet">{bundleCatalog.filter(b => !b.allActive).length}</Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'services'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Services
            {catalog.filter(item => item.capabilityType === 'platform_services').length > 0 && (
              <Badge size="xs" variant="light" color="orange">{catalog.filter(item => item.capabilityType === 'platform_services').length}</Badge>
            )}
          </button>
        </div>

        {catalog.length === 0 && bundleCatalog.length === 0 && !loading && (
          <Card withBorder p="xl" className="text-center">
            <IconInfoCircle size={48} className="mx-auto text-neutral-400 mb-4" />
            <Text size="lg" c="dimmed">No features are currently available for purchase.</Text>
            <Text size="sm" c="dimmed" mt="xs">Check back later as new features are added.</Text>
          </Card>
        )}

        {/* Bundles Tab */}
        {activeTab === 'bundles' && bundleCatalog.filter(b => !b.allActive).length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-600" />
              <h2 className="text-xl font-bold text-gray-900">Bundles</h2>
              <Badge color="violet" variant="light" size="sm">Save more</Badge>
            </div>
            <Grid>
              {bundleCatalog.filter(b => !b.allActive).map((bundle) => {
                const notEligible = bundle.tierEligible === false;
                const demoBlocked = isDemoTenant && !bundle.demoEligible;
                const allInTier = bundle.allInTier;
                const componentSum = bundle.items.reduce((sum, _item) => sum, 0);
                const savingsPercent = componentSum > 0 && bundle.priceCents < componentSum
                  ? Math.round(((componentSum - bundle.priceCents) / componentSum) * 100)
                  : 0;

                return (
                  <Grid.Col key={bundle.bundleKey} span={{ base: 12, md: 6 }}>
                    <Card withBorder shadow="sm" p="lg" className={`flex flex-col h-full ${notEligible ? 'opacity-70' : ''}`}>
                      <Group justify="space-between" mb="xs">
                        <Group gap="sm">
                          <Text fw={700} size="lg">{bundle.name}</Text>
                          <Badge color="violet" variant="filled" size="sm">Bundle</Badge>
                          {bundle.items.some(item => item.featureKey.startsWith('org_')) && (
                            <Badge color="orange" variant="light" size="sm">ORG</Badge>
                          )}
                          {bundle.trialEligible && bundle.trialDays > 0 && (
                            <Badge color="teal" variant="light" size="sm">{bundle.trialDays}-day trial</Badge>
                          )}
                        </Group>
                        {notEligible && <Badge color="gray" variant="light" leftSection={<IconLock size={12} />}>Upgrade Required</Badge>}
                        {demoBlocked && <Badge color="red" variant="light" size="sm">Demo Restricted</Badge>}
                      </Group>

                      <Text size="sm" c="dimmed" className="flex-grow" mb="sm">
                        {bundle.description}
                      </Text>

                      {/* Component list */}
                      <Stack gap="xs" mb="md">
                        {bundle.items.map((item) => (
                          <Group key={item.featureKey} gap="sm">
                            {item.alreadyPurchased ? (
                              <IconCheck size={16} className="text-green-600" />
                            ) : item.inTier ? (
                              <IconCheck size={16} className="text-blue-500" />
                            ) : (
                              <IconCircleX size={16} className="text-neutral-400" />
                            )}
                            <Text size="sm" c={item.alreadyPurchased ? 'green' : item.inTier ? 'blue' : 'dimmed'}>
                              {item.name}
                              {item.alreadyPurchased && ' (already owned)'}
                              {item.inTier && !item.alreadyPurchased && ' (in your plan)'}
                            </Text>
                          </Group>
                        ))}
                      </Stack>

                      {notEligible && (
                        <div className="mb-md space-y-1">
                          <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                            {bundle.ineligibleReason}
                          </Text>
                          {bundle.ineligibleDomains && bundle.ineligibleDomains.length > 0 && (
                            <Group gap="xs">
                              <Text size="xs" fw={500} c="dimmed">Blocked domains:</Text>
                              {bundle.ineligibleDomains.map((domain) => (
                                <Badge key={domain} color="red" variant="light" size="xs">
                                  {domain.replace(/_options$/, '').replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </Group>
                          )}
                        </div>
                      )}

                      <Group justify="space-between" mt="auto">
                        <Group gap="sm">
                          <Text fw={700} size="xl" c={notEligible ? 'dimmed' : 'violet'}>
                            {formatPrice(bundle.priceCents, bundle.billingCycle)}
                          </Text>
                          {savingsPercent > 0 && (
                            <Badge color="green" variant="light" size="sm">Save {savingsPercent}%</Badge>
                          )}
                        </Group>

                        {notEligible ? (
                          <Link href={`/t/${tenantId}/settings/store?tab=plans`}>
                            <Button variant="light" color="gray" size="sm" leftSection={<IconLock size={16} />}>
                              Upgrade Plan
                            </Button>
                          </Link>
                        ) : demoBlocked ? (
                          <Button variant="light" color="red" size="sm" disabled>
                            Not Available for Demo
                          </Button>
                        ) : allInTier ? (
                          <Button variant="light" color="blue" size="sm" disabled>
                            Included in Plan
                          </Button>
                        ) : !hasPaymentMethod ? (
                          <Group gap="xs">
                            <Badge color="orange" variant="light" size="sm" leftSection={<IconCreditCard size={12} />}>No Card on File</Badge>
                            <Link href={`/t/${tenantId}/settings/store?tab=billing`}>
                              <Button variant="light" color="orange" size="sm">
                                Add Payment Method
                              </Button>
                            </Link>
                          </Group>
                        ) : (
                          <Button
                            variant="gradient"
                            gradient={{ from: 'violet', to: 'blue' }}
                            style={{ color: 'white' }}
                            size="sm"
                            onClick={() => handleBundlePurchaseClick(bundle)}
                            leftSection={<IconBolt size={16} />}
                          >
                            {bundle.trialEligible && bundle.trialDays > 0 ? 'Start Trial' : 'Purchase Bundle'}
                          </Button>
                        )}
                      </Group>
                    </Card>
                  </Grid.Col>
                );
              })}
            </Grid>
          </div>
        )}

        {/* Individual Features Tab */}
        {activeTab === 'features' && catalog.filter(item => item.capabilityType !== 'platform_services').length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Individual Features</h2>
            <Grid>
          {catalog.filter(item => item.capabilityType !== 'platform_services').map((item) => {
            const isActive = item.purchase?.status === 'active';
            const isSuspended = item.purchase?.status === 'suspended';
            const inTier = item.tierAvailability === 'in_tier_active';
            const gateOff = item.tierAvailability === 'in_tier_gate_off';
            const notEligible = item.tierEligible === false && !isActive && !inTier && !gateOff;
            const demoBlocked = isDemoTenant && !item.demoEligible;

            return (
              <Grid.Col key={item.key} span={{ base: 12, md: 6, lg: 4 }}>
                <Card withBorder shadow="sm" p="lg" className={`flex flex-col h-full ${notEligible ? 'opacity-70' : ''}`}>
                  <Group justify="space-between" mb="xs">
                    <Text fw={600} size="lg">{item.name}</Text>
                    {isActive && <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Active</Badge>}
                    {isSuspended && <Badge color="orange" variant="light">Suspended</Badge>}
                    {inTier && !isActive && <Badge color="blue" variant="light">In Your Plan</Badge>}
                    {gateOff && !isActive && <Badge color="yellow" variant="light">Disabled in Settings</Badge>}
                    {notEligible && <Badge color="gray" variant="light" leftSection={<IconLock size={12} />}>Upgrade Required</Badge>}
                    {demoBlocked && <Badge color="red" variant="light" size="sm">Demo Restricted</Badge>}
                  </Group>

                  <Text size="sm" c="dimmed" className="flex-grow" mb="md">
                    {item.description}
                  </Text>

                  {notEligible && (
                    <Text size="xs" c="dimmed" className="mb-md" style={{ fontStyle: 'italic' }}>
                      {item.ineligibleReason}
                    </Text>
                  )}

                  <Group justify="space-between" mt="auto">
                    <Text fw={700} size="xl" c={notEligible ? 'dimmed' : 'blue'}>
                      {formatPrice(item.priceCents, item.billingCycle)}
                    </Text>

                    {isActive ? (
                      <Button
                        variant="light"
                        color="red"
                        size="sm"
                        loading={processing}
                        onClick={() => handleCancelPurchase(item.purchase!.id, item.name)}
                        leftSection={<IconCircleX size={16} />}
                      >
                        Cancel
                      </Button>
                    ) : inTier ? (
                      <Button variant="light" color="blue" size="sm" disabled>
                        Included in Plan
                      </Button>
                    ) : gateOff ? (
                      <Button variant="light" color="yellow" size="sm" disabled>
                        Enable in Settings
                      </Button>
                    ) : notEligible ? (
                      <Link href={`/t/${tenantId}/settings/store?tab=plans`}>
                        <Button variant="light" color="gray" size="sm" leftSection={<IconLock size={16} />}>
                          Upgrade Plan
                        </Button>
                      </Link>
                    ) : demoBlocked ? (
                      <Button variant="light" color="red" size="sm" disabled>
                        Not Available for Demo
                      </Button>
                    ) : !hasPaymentMethod ? (
                      <Group gap="xs">
                        <Badge color="orange" variant="light" size="sm" leftSection={<IconCreditCard size={12} />}>No Card on File</Badge>
                        <Link href={`/t/${tenantId}/settings/store?tab=billing`}>
                          <Button variant="light" color="orange" size="sm">
                            Add Payment Method
                          </Button>
                        </Link>
                      </Group>
                    ) : (
                      <Button 
                        variant="gradient"
                        style={{ color: 'white' }}
                        size="sm"
                        onClick={() => handlePurchaseClick(item)}
                        leftSection={<IconBolt size={16} />}
                      >
                        Purchase
                      </Button>
                    )}
                  </Group>
                </Card>
              </Grid.Col>
            );
          })}
            </Grid>
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            {catalog.filter(item => item.capabilityType === 'platform_services').length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-600" />
                  <h2 className="text-xl font-bold text-gray-900">Platform Services</h2>
                  <Badge color="orange" variant="light" size="sm">One-time</Badge>
                </div>
                <Text size="sm" c="dimmed">
                  Professional services to help you get set up and grow your business. Logo design, store setup, SEO optimization, and more.
                </Text>
                <Grid>
                  {catalog.filter(item => item.capabilityType === 'platform_services').map((item) => {
                    const isActive = item.purchase?.status === 'active';
                    const isSuspended = item.purchase?.status === 'suspended';
                    const inTier = item.tierAvailability === 'in_tier_active';
                    const gateOff = item.tierAvailability === 'in_tier_gate_off';
                    const notEligible = item.tierEligible === false && !isActive && !inTier && !gateOff;
                    const demoBlocked = isDemoTenant && !item.demoEligible;

                    return (
                      <Grid.Col key={item.key} span={{ base: 12, md: 6, lg: 4 }}>
                        <Card withBorder shadow="sm" p="lg" className={`flex flex-col h-full ${notEligible ? 'opacity-70' : ''}`}>
                          <Group justify="space-between" mb="xs">
                            <Text fw={600} size="lg">{item.name}</Text>
                            {isActive && <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Active</Badge>}
                            {isSuspended && <Badge color="orange" variant="light">Suspended</Badge>}
                            {notEligible && <Badge color="gray" variant="light" leftSection={<IconLock size={12} />}>Upgrade Required</Badge>}
                            {demoBlocked && <Badge color="red" variant="light" size="sm">Demo Restricted</Badge>}
                          </Group>

                          <Text size="sm" c="dimmed" className="flex-grow" mb="md">
                            {item.description}
                          </Text>

                          {notEligible && (
                            <Text size="xs" c="dimmed" className="mb-md" style={{ fontStyle: 'italic' }}>
                              {item.ineligibleReason}
                            </Text>
                          )}

                          <Group justify="space-between" mt="auto">
                            <Text fw={700} size="xl" c={notEligible ? 'dimmed' : 'amber'}>
                              {formatPrice(item.priceCents, item.billingCycle)}
                            </Text>

                            {isActive ? (
                              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Purchased</Badge>
                            ) : notEligible ? (
                              <Link href={`/t/${tenantId}/settings/store?tab=plans`}>
                                <Button variant="light" color="gray" size="sm" leftSection={<IconLock size={16} />}>
                                  Upgrade Plan
                                </Button>
                              </Link>
                            ) : demoBlocked ? (
                              <Button variant="light" color="red" size="sm" disabled>
                                Not Available for Demo
                              </Button>
                            ) : !hasPaymentMethod ? (
                              <Group gap="xs">
                                <Badge color="orange" variant="light" size="sm" leftSection={<IconCreditCard size={12} />}>No Card on File</Badge>
                                <Link href={`/t/${tenantId}/settings/store?tab=billing`}>
                                  <Button variant="light" color="orange" size="sm">
                                    Add Payment Method
                                  </Button>
                                </Link>
                              </Group>
                            ) : (
                              <Button
                                variant="gradient"
                                gradient={{ from: 'amber', to: 'orange' }}
                                style={{ color: 'white' }}
                                size="sm"
                                onClick={() => handlePurchaseClick(item)}
                                leftSection={<IconBolt size={16} />}
                              >
                                Purchase
                              </Button>
                            )}
                          </Group>
                        </Card>
                      </Grid.Col>
                    );
                  })}
                </Grid>
              </div>
            ) : (
              <Card withBorder p="xl" className="text-center">
                <Wrench size={48} className="mx-auto text-neutral-400 mb-4" />
                <Text size="lg" c="dimmed">No platform services are currently available.</Text>
                <Text size="sm" c="dimmed" mt="xs">Check back later as new services are added.</Text>
              </Card>
            )}
          </div>
        )}

        {/* Benefits Section */}
        {activeTab === 'features' && (
        <div className="bg-gray-50 rounded-lg p-8 mt-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" />
            Why Purchase Add-On Features?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Only Pay for What You Need</h4>
                <p className="text-gray-600 text-sm">Add individual capabilities without upgrading your entire subscription tier</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Instant Activation</h4>
                <p className="text-gray-600 text-sm">Features activate immediately after purchase — no waiting, no setup required</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Eye className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Flexible Billing</h4>
                <p className="text-gray-600 text-sm">Choose monthly or annual billing, or one-time purchases — cancel anytime</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Tier-Aware Pricing</h4>
                <p className="text-gray-600 text-sm">Features already included in your plan are clearly marked — never pay twice</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/t/${tenantId}/settings/tier-features`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Zap className="w-4 h-4" />
              See Your Plan Features
            </Link>
            <Link
              href={`/t/${tenantId}/settings/store?tab=plans`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Explore All Plans
            </Link>
          </div>
        </div>
        )}

        {/* Purchase Confirmation Modal */}
        <Modal
          opened={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Confirm Purchase"
          size="md"
        >
          {purchaseTarget && (
            <Stack gap="md">
              <Card withBorder p="md" bg="gray.0">
                <Group justify="space-between">
                  <Text fw={600}>{purchaseTarget.name}</Text>
                  <Text fw={700} c="blue">{formatPrice(purchaseTarget.priceCents, purchaseTarget.billingCycle)}</Text>
                </Group>
                <Text size="sm" c="dimmed" mt="xs">{purchaseTarget.description}</Text>
              </Card>

              <div>
                <Text size="sm" fw={500} mb="xs">Payment Method</Text>
                {paymentMethods.length === 0 ? (
                  <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                    No payment methods available. Add one in your subscription settings.
                  </Alert>
                ) : (
                  <Stack gap="xs">
                    {paymentMethods.map((method) => (
                      <Card
                        key={method.id}
                        withBorder
                        p="sm"
                        onClick={() => setSelectedPaymentMethodId(method.id)}
                        className={`cursor-pointer transition-colors ${selectedPaymentMethodId === method.id ? 'border-blue-500 bg-blue-50' : 'hover:border-neutral-300'}`}
                      >
                        <Group gap="sm">
                          <IconCreditCard size={20} className="text-neutral-500" />
                          <Text size="sm">
                            {method.cardBrand ? `${method.cardBrand} •••• ${method.cardLast4}` : method.paypalEmail || 'Payment method'}
                          </Text>
                          {method.isDefault && <Badge size="xs" variant="light">Default</Badge>}
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Promo Code (optional)</Text>
                <div className="flex items-center gap-sm">
                  <div className="flex items-center flex-1">
                    <span className="inline-flex items-center justify-center px-3 h-38 bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-md text-neutral-500">
                      <IconTag size={16} />
                    </span>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value); setPromoDiscount(null); setPromoError(null); }}
                      placeholder="Enter promo code"
                      className="flex-1 h-38 px-3 border border-neutral-200 rounded-r-md text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    loading={promoValidating}
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim()}
                  >
                    Apply
                  </Button>
                </div>
                {promoError && (
                  <Text size="xs" c="red" mt={4}>{promoError}</Text>
                )}
                {promoDiscount && purchaseTarget && promoDiscount.discountCents > 0 && (
                  <Group gap="xs" mt={4}>
                    <Text size="sm" c="dimmed" td="line-through">{formatPrice(purchaseTarget.priceCents, purchaseTarget.billingCycle)}</Text>
                    <IconBolt size={14} className="text-green-600" />
                    <Text size="sm" fw={700} c="green.7">{formatPrice(promoDiscount.chargedAmount, purchaseTarget.billingCycle)}</Text>
                    <Badge size="xs" variant="light" color="green">{promoCode.trim()} applied</Badge>
                  </Group>
                )}
                {promoDiscount && promoDiscount.discountCents === 0 && (
                  <Text size="xs" c="dimmed" mt={4}>No discount applied for this code.</Text>
                )}
              </div>

              <Group justify="flex-end">
                <Button variant="default" onClick={() => setShowConfirm(false)}>Cancel</Button>
                <Button
                  color="blue"
                  loading={processing}
                  onClick={handleConfirmPurchase}
                  disabled={!selectedPaymentMethodId}
                >
                  Confirm Purchase
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Bundle Purchase Confirmation Modal */}
        <Modal
          opened={showBundleConfirm}
          onClose={() => setShowBundleConfirm(false)}
          title="Confirm Bundle Purchase"
          size="md"
        >
          {bundleTarget && (
            <Stack gap="md">
              <Card withBorder p="md" bg="violet.0">
                <Group justify="space-between">
                  <Group gap="sm">
                    <Text fw={600}>{bundleTarget.name}</Text>
                    <Badge color="violet" variant="filled" size="sm">Bundle</Badge>
                    {bundleTarget.items.some(item => item.featureKey.startsWith('org_')) && (
                      <Badge color="orange" variant="light" size="sm">ORG</Badge>
                    )}
                  </Group>
                  <Text fw={700} c="violet">{formatPrice(bundleTarget.priceCents, bundleTarget.billingCycle)}</Text>
                </Group>
                <Text size="sm" c="dimmed" mt="xs">{bundleTarget.description}</Text>
                {bundleTarget.trialEligible && bundleTarget.trialDays > 0 && (
                  <Text size="xs" c="teal" mt="xs" fw={500}>
                    Includes {bundleTarget.trialDays}-day free trial. No charge until trial ends.
                  </Text>
                )}
              </Card>

              <div>
                <Text size="sm" fw={500} mb="xs">What's included:</Text>
                <Stack gap="xs">
                  {bundleTarget.items.map((item) => (
                    <Group key={item.featureKey} gap="sm">
                      <IconCheck size={16} className={item.alreadyPurchased ? 'text-green-600' : item.inTier ? 'text-blue-500' : 'text-neutral-400'} />
                      <Text size="sm" c={item.alreadyPurchased ? 'green' : 'dimmed'}>
                        {item.name}
                        {item.alreadyPurchased && ' (already owned)'}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Payment Method</Text>
                {paymentMethods.length === 0 ? (
                  <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                    No payment methods available. Add one in your subscription settings.
                  </Alert>
                ) : (
                  <Stack gap="xs">
                    {paymentMethods.map((method) => (
                      <Card
                        key={method.id}
                        withBorder
                        p="sm"
                        onClick={() => setSelectedPaymentMethodId(method.id)}
                        className={`cursor-pointer transition-colors ${selectedPaymentMethodId === method.id ? 'border-violet-500 bg-violet-50' : 'hover:border-neutral-300'}`}
                      >
                        <Group gap="sm">
                          <IconCreditCard size={20} className="text-neutral-500" />
                          <Text size="sm">
                            {method.cardBrand ? `${method.cardBrand} •••• ${method.cardLast4}` : method.paypalEmail || 'Payment method'}
                          </Text>
                          {method.isDefault && <Badge size="xs" variant="light">Default</Badge>}
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Promo Code (optional)</Text>
                <div className="flex items-center gap-sm">
                  <div className="flex items-center flex-1">
                    <span className="inline-flex items-center justify-center px-3 h-38 bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-md text-neutral-500">
                      <IconTag size={16} />
                    </span>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value); setPromoDiscount(null); setPromoError(null); }}
                      placeholder="Enter promo code"
                      className="flex-1 h-38 px-3 border border-neutral-200 rounded-r-md text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    color="violet"
                    loading={promoValidating}
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim()}
                  >
                    Apply
                  </Button>
                </div>
                {promoError && (
                  <Text size="xs" c="red" mt={4}>{promoError}</Text>
                )}
                {promoDiscount && bundleTarget && promoDiscount.discountCents > 0 && (
                  <Group gap="xs" mt={4}>
                    <Text size="sm" c="dimmed" td="line-through">{formatPrice(bundleTarget.priceCents, bundleTarget.billingCycle)}</Text>
                    <IconBolt size={14} className="text-green-600" />
                    <Text size="sm" fw={700} c="green.7">{formatPrice(promoDiscount.chargedAmount, bundleTarget.billingCycle)}</Text>
                    <Badge size="xs" variant="light" color="green">{promoCode.trim()} applied</Badge>
                  </Group>
                )}
                {promoDiscount && promoDiscount.discountCents === 0 && (
                  <Text size="xs" c="dimmed" mt={4}>No discount applied for this code.</Text>
                )}
              </div>

              <Group justify="flex-end">
                <Button variant="default" onClick={() => setShowBundleConfirm(false)}>Cancel</Button>
                <Button
                  color="violet"
                  loading={processing}
                  onClick={handleConfirmBundlePurchase}
                  disabled={!selectedPaymentMethodId}
                >
                  {bundleTarget.trialEligible && bundleTarget.trialDays > 0 ? 'Start Trial' : 'Confirm Purchase'}
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </div>
    </div>
  );
}
