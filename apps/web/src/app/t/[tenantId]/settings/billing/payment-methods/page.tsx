'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Group, Text, Stack, Alert, Loader, Modal, TextInput } from '@mantine/core';
import { 
  IconCreditCard, 
  IconPlus, 
  IconTrash, 
  IconCheck,
  IconAlertTriangle,
  IconRefresh,
  IconBrandPaypal
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { tenantBillingService, type PaymentMethod } from '@/services/TenantBillingService';
import { subscriptionBillingService } from '@/services/SubscriptionBillingService';
import { StripeCardForm } from '@/components/billing/StripeCardForm';

export default function PaymentMethodsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [defaultPaymentId, setDefaultPaymentId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'card' | 'paypal'>('card');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      loadPaymentMethods();
    }
  }, [tenantId]);

  // Handle PayPal return URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paypalToken = urlParams.get('paypal-token');
    const tokenId = urlParams.get('token') || urlParams.get('approval_token_id') || urlParams.get('token_id');
    
    if (paypalToken === 'success' && tokenId) {
      const savePayPalMethod = async () => {
        try {
          setProcessing(true);
          await subscriptionBillingService.savePayPalPaymentMethod(tokenId);
          // Clear URL params
          window.history.replaceState({}, '', window.location.pathname);
          await loadPaymentMethods();
        } catch (err: any) {
          setError(err.message || 'Failed to save PayPal payment method');
        } finally {
          setProcessing(false);
        }
      };
      savePayPalMethod();
    }
  }, [tenantId]);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      const methods = await tenantBillingService.getPaymentMethods(tenantId);
      setPaymentMethods(methods);
      
      // Set default payment method ID
      const defaultMethod = Array.isArray(methods) ? methods.find(m => m.isDefault) : null;
      if (defaultMethod) {
        setDefaultPaymentId(defaultMethod.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = (type: 'card' | 'paypal' = 'card') => {
    setPaymentType(type);
    if (type === 'paypal') {
      handleAddPayPal();
    } else {
      setShowAddModal(true);
    }
  };

  const handleAddPayPal = async () => {
    try {
      setProcessing(true);
      const result = await subscriptionBillingService.createPayPalBillingAgreement();
      const approvalUrl = (result as any)?.data?.approvalUrl || result?.approvalUrl;
      if (approvalUrl) {
        window.location.href = approvalUrl;
      } else {
        throw new Error('No approval URL returned from PayPal');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add PayPal');
      setProcessing(false);
    }
  };

  const handlePaymentMethodSuccess = async () => {
    setShowAddModal(false);
    setProcessing(false);
    await loadPaymentMethods();
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      await tenantBillingService.updatePaymentMethod(tenantId, paymentMethodId, { isDefault: true });
      await loadPaymentMethods();
    } catch (err: any) {
      setError(err.message || 'Failed to update default payment method');
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      await tenantBillingService.removePaymentMethod(tenantId, paymentMethodId);
      await loadPaymentMethods();
    } catch (err: any) {
      setError(err.message || 'Failed to remove payment method');
    }
  };

  // Payment method display matching subscription page style
  const renderPaymentMethod = (method: PaymentMethod) => {
    if (method.gatewayType === 'paypal') {
      return (
        <>
          <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
            <IconBrandPaypal size="1rem" />
          </div>
          <div>
            <Text size="sm" fw={500}>
              PayPal
            </Text>
            <Text size="xs" c="dimmed">
              {method.paypalEmail || 'PayPal Account'}
              {method.isDefault && ' · Default'}
            </Text>
          </div>
        </>
      );
    } else if (method.gatewayType === 'manual') {
      return (
        <>
          <div className="w-10 h-6 bg-gray-600 rounded flex items-center justify-center text-white text-xs font-bold">
            MANUAL
          </div>
          <div>
            <Text size="sm" fw={500}>
              Manual Payment
            </Text>
            <Text size="xs" c="dimmed">
              {method.isDefault && ' · Default'}
            </Text>
          </div>
        </>
      );
    } else {
      // Stripe card
      return (
        <>
          <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-white text-xs font-bold">
            {method.cardBrand?.toUpperCase() || 'CARD'}
          </div>
          <div>
            <Text size="sm" fw={500}>
              {method.cardBrand} ending in {method.cardLast4}
            </Text>
            <Text size="xs" c="dimmed">
              Expires {method.expiryMonth}/{method.expiryYear}
              {method.isDefault && ' · Default'}
            </Text>
          </div>
        </>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert color="red" icon={<IconAlertTriangle />}>
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Methods"
        description="Manage your payment methods for subscription and platform fees"
        icon={Icons.CreditCard}
        backLink={{
          href: `/t/${tenantId}/settings/billing`,
          label: 'Back to Billing'
        }}
      />

      {/* Add Payment Method Button */}
      <Card>
        <Group justify="space-between">
          <div>
            <h3 className="text-lg font-semibold">Payment Methods</h3>
            <p className="text-sm text-gray-600">
              Manage your payment methods for automatic billing
            </p>
          </div>
          
          <Group gap="xs">
            <Button
              leftSection={<IconCreditCard size="1rem" />}
              onClick={() => handleAddPaymentMethod('card')}
               variant="filled" style={{ color: 'white' }}
            >
              Add Card
            </Button>
            <Button
              leftSection={<IconBrandPaypal size="1rem" />}
              onClick={() => handleAddPaymentMethod('paypal')}
              loading={processing}
               variant="filled" style={{ color: 'white' }}
            >
              Add PayPal
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Payment Methods Section */}
      <Card withBorder padding="lg" radius="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <IconCreditCard size="1.25rem" />
              Payment Methods
            </h3>
            <Group gap="xs">
              <Button 
                size="xs" 
                leftSection={<IconCreditCard size="0.875rem" />}
                onClick={() => handleAddPaymentMethod('card')}
                variant="filled" style={{ color: 'white' }}
              >
                Add Card
              </Button>
              <Button 
                size="xs" 
                leftSection={<IconBrandPaypal size="0.875rem" />}
                onClick={() => handleAddPaymentMethod('paypal')}
                loading={processing}
                variant="filled" style={{ color: 'white' }}
              >
                Add PayPal
              </Button>
            </Group>
          </div>

          {!Array.isArray(paymentMethods) || paymentMethods.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-4 text-neutral-500">
                <IconCreditCard size="2rem" className="mx-auto mb-2 opacity-50" />
                <p>No saved payment methods</p>
              </div>
              
              {/* Payment Options when no saved methods */}
              <div className="space-y-3 pt-2 border-t">
                <Text size="sm" fw={500}>Add a payment method:</Text>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button 
                    size="sm"
                    variant="filled" style={{ color: 'white' }}
                    leftSection={<IconCreditCard size="1rem" />}
                    onClick={() => handleAddPaymentMethod('card')} 
                  >
                    Add Card (Stripe)
                  </Button>
                  <Button 
                    size="sm"
                    variant="filled" style={{ color: 'white' }}
                    leftSection={<IconBrandPaypal size="1rem" />}
                    onClick={() => handleAddPaymentMethod('paypal')}
                    loading={processing}
                  >
                    Add PayPal
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.isArray(paymentMethods) && paymentMethods.map((method) => (
                <div 
                  key={method.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    method.isDefault ? 'border-blue-500 bg-blue-50' : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {renderPaymentMethod(method)}
                  </div>
                  <Group gap="xs">
                    {!method.isDefault && (
                      <Button 
                        size="xs" 
                        variant="subtle" 
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    
                    {paymentMethods.length > 1 && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemovePaymentMethod(method.id)}
                      >
                        <IconTrash size="0.875rem" />
                      </Button>
                    )}
                  </Group>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Add Payment Method Modal */}
      <Modal
        opened={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Payment Method"
        size="md"
      >
        <StripeCardForm 
          onSuccess={handlePaymentMethodSuccess}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Security Information */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Security & Privacy</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <IconCheck className="w-4 h-4 text-green-500 mt-0.5" />
            <p>Your payment information is encrypted and securely stored by Stripe or PayPal</p>
          </div>
          <div className="flex items-start gap-2">
            <IconCheck className="w-4 h-4 text-green-500 mt-0.5" />
            <p>We never store your full credit card details on our servers</p>
          </div>
          <div className="flex items-start gap-2">
            <IconCheck className="w-4 h-4 text-green-500 mt-0.5" />
            <p>PCI-DSS compliant payment processing</p>
          </div>
          <div className="flex items-start gap-2">
            <IconCheck className="w-4 h-4 text-green-500 mt-0.5" />
            <p>You can remove or update payment methods at any time</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
