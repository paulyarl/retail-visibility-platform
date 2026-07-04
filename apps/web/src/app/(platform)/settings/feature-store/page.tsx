'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Badge, Button, Modal, Group, Text, Stack, Alert, Loader, Grid } from '@mantine/core';
import { IconCheck, IconAlertCircle, IconCreditCard, IconBolt, IconCircleX, IconInfoCircle, IconTag } from '@tabler/icons-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { bsaasPurchaseService, type BsaasCatalogItem } from '@/services/BsaasPurchaseService';
import { subscriptionBillingService, type PaymentMethod } from '@/services/SubscriptionBillingService';

export const dynamic = 'force-dynamic';

export default function FeatureStorePage({ tenantId: propTenantId }: { tenantId?: string }) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const tenantId = propTenantId || searchParams?.get('tenantId') || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);

  const [catalog, setCatalog] = useState<BsaasCatalogItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [purchaseTarget, setPurchaseTarget] = useState<BsaasCatalogItem | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [promoCode, setPromoCode] = useState('');

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
      const [catalogData, methodsData] = await Promise.all([
        bsaasPurchaseService.getFeatureCatalog(),
        subscriptionBillingService.getPaymentMethods(),
      ]);
      setCatalog(catalogData);
      setPaymentMethods(methodsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature store');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

    const defaultMethod = paymentMethods.find(m => m.isDefault) || paymentMethods[0];
    if (!defaultMethod) {
      setError('No payment method found. Please add a payment method in your subscription settings first.');
      return;
    }

    setPurchaseTarget(item);
    setSelectedPaymentMethodId(defaultMethod.id);
    setPromoCode('');
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
        } else if (result.error === 'already_active') {
          setError('This feature is already active for your tenant.');
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
      <PageHeader
        title="Feature Store"
        description="Purchase à la carte features to enhance your plan"
        icon={<IconBolt className="w-6 h-6" />}
      />

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

        {catalog.length === 0 && !loading && (
          <Card withBorder p="xl" className="text-center">
            <IconInfoCircle size={48} className="mx-auto text-neutral-400 mb-4" />
            <Text size="lg" c="dimmed">No features are currently available for purchase.</Text>
            <Text size="sm" c="dimmed" mt="xs">Check back later as new features are added.</Text>
          </Card>
        )}

        <Grid>
          {catalog.map((item) => {
            const isActive = item.purchase?.status === 'active';
            const isSuspended = item.purchase?.status === 'suspended';
            const inTier = item.tierAvailability === 'in_tier_active';
            const gateOff = item.tierAvailability === 'in_tier_gate_off';

            return (
              <Grid.Col key={item.key} span={{ base: 12, md: 6, lg: 4 }}>
                <Card withBorder shadow="sm" p="lg" className="flex flex-col h-full">
                  <Group justify="space-between" mb="xs">
                    <Text fw={600} size="lg">{item.name}</Text>
                    {isActive && <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Active</Badge>}
                    {isSuspended && <Badge color="orange" variant="light">Suspended</Badge>}
                    {inTier && !isActive && <Badge color="blue" variant="light">In Your Plan</Badge>}
                    {gateOff && !isActive && <Badge color="yellow" variant="light">Disabled in Settings</Badge>}
                  </Group>

                  <Text size="sm" c="dimmed" className="flex-grow" mb="md">
                    {item.description}
                  </Text>

                  <Group justify="space-between" mt="auto">
                    <Text fw={700} size="xl" c="blue">
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

        {/* Purchase Confirmation Modal */}
        <Modal
          opened={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Confirm Purchase"
          size="md"
        >
          {purchaseTarget && (
            <Stack gap="md">
              <Card withBorder p="md" bg="neutral.50">
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
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter promo code"
                      className="flex-1 h-38 px-3 border border-neutral-200 rounded-r-md text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
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
      </div>
    </div>
  );
}
