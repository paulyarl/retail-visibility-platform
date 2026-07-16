'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import customerPaymentMethodsService, {
  CustomerPaymentMethod,
} from '@/services/CustomerPaymentMethodsService';
import { CustomerPaymentMethodCard } from '@/components/customer/CustomerPaymentMethodCard';
import { CustomerAddCardModal } from '@/components/customer/CustomerAddCardForm';
import { CreditCard, Plus, Loader2, AlertTriangle, Wallet } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

export default function PaymentMethodsPage() {
  const { customer } = useCustomerAuth();
  const [paymentMethods, setPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get tenantId from current store context or customer's last order
  // For now, we show all payment methods grouped by tenant
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [processingPayPal, setProcessingPayPal] = useState(false);

  // Handle PayPal return after approval
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const paypalStatus = urlParams.get('paypal');
    const token = urlParams.get('token') || urlParams.get('approval_token_id');
    const tenantId = urlParams.get('tenant_id');

    if (paypalStatus === 'success' && token && tenantId) {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      setProcessingPayPal(true);
      setError(null);

      customerPaymentMethodsService
        .savePayPalPaymentMethod(tenantId, token)
        .then(result => {
          if (result.success) {
            setSuccess('PayPal payment method added successfully');
            loadPaymentMethods();
          } else {
            setError(result.error || 'Failed to save PayPal payment method');
          }
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to save PayPal payment method');
        })
        .finally(() => setProcessingPayPal(false));
    } else if (paypalStatus === 'cancel') {
      window.history.replaceState({}, '', window.location.pathname);
      setError('PayPal authorization was cancelled');
    }
  }, []);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setIsLoading(true);
      const result = await customerPaymentMethodsService.listPaymentMethods();
      if (result.success && result.paymentMethods) {
        setPaymentMethods(result.paymentMethods);
      }
    } catch (err) {
      clientLogger.error('Failed to load payment methods:', { detail: err });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      setError(null);
      const result = await customerPaymentMethodsService.setDefaultPaymentMethod(id);
      if (result.success) {
        setSuccess('Default payment method updated');
        await loadPaymentMethods();
      } else {
        setError(result.error || 'Failed to set default payment method');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set default payment method');
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      setRemovingId(id);
      setError(null);
      const result = await customerPaymentMethodsService.removePaymentMethod(id);
      if (result.success) {
        setSuccess('Payment method removed');
        await loadPaymentMethods();
      } else {
        setError(result.error || 'Failed to remove payment method');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove payment method');
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddSuccess = async () => {
    setSuccess('Payment method added successfully');
    await loadPaymentMethods();
  };

  const handleAddPayPal = async (tenantId: string) => {
    try {
      setProcessingPayPal(true);
      setError(null);
      const result = await customerPaymentMethodsService.createPayPalBillingAgreement(tenantId);
      if (result.success && result.approvalUrl) {
        // Append tenant_id to return URL for the save handler
        const separator = result.approvalUrl.includes('?') ? '&' : '?';
        const redirectUrl = `${result.approvalUrl}${separator}tenant_id=${encodeURIComponent(tenantId)}`;
        window.location.href = redirectUrl;
      } else {
        setError(result.error || 'Failed to start PayPal authorization');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start PayPal authorization');
    } finally {
      setProcessingPayPal(false);
    }
  };

  // Group payment methods by tenant
  const groupedByTenant = paymentMethods.reduce<Record<string, CustomerPaymentMethod[]>>((acc, pm) => {
    const key = pm.tenantId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pm);
    return acc;
  }, {});

  // Get unique tenant IDs
  const tenantIds = Object.keys(groupedByTenant);

  // Determine which tenantId to use for adding cards
  // Default to the first tenant if only one, otherwise require selection
  const addCardTenantId = selectedTenantId || (tenantIds.length === 1 ? tenantIds[0] : null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Payment Methods
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your saved cards and payment methods
          </p>
        </div>
        <div className="flex items-center gap-2">
          {addCardTenantId && (
            <Button
              onClick={() => setShowAddCard(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </Button>
          )}
          {addCardTenantId && (
            <Button
              variant="outline"
              onClick={() => handleAddPayPal(addCardTenantId)}
              disabled={processingPayPal}
              className="flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              {processingPayPal ? 'Connecting...' : 'Add PayPal'}
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-green-800">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
            ×
          </button>
        </div>
      )}

      {/* Expiring cards warning */}
      {paymentMethods.some(m => {
        if (!m.expiryMonth || !m.expiryYear) return false;
        const now = new Date();
        const threshold = new Date(now.getFullYear(), now.getMonth() + 2, 1);
        return new Date(m.expiryYear, m.expiryMonth, 1) <= threshold;
      }) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            One or more of your cards is expiring soon. Please update your payment method to avoid payment issues.
          </p>
        </div>
      )}

      {/* Payment methods by tenant */}
      {paymentMethods.length === 0 ? (
        <Card className="text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No saved payment methods</h3>
          <p className="text-sm text-gray-500 mb-6">
            Add a card to speed up future checkouts
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            {addCardTenantId && (
              <Button onClick={() => setShowAddCard(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Card
              </Button>
            )}
            {addCardTenantId && (
              <Button
                variant="outline"
                onClick={() => handleAddPayPal(addCardTenantId)}
                disabled={processingPayPal}
                className="flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                {processingPayPal ? 'Connecting...' : 'Add PayPal'}
              </Button>
            )}
          </div>
          {!addCardTenantId && (
            <p className="text-xs text-gray-400">
              Visit a store to add a payment method during checkout
            </p>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {tenantIds.map(tenantId => {
            const methods = groupedByTenant[tenantId];
            const storeName = methods[0]?.tenantId || 'Store';

            return (
              <Card key={tenantId} padding="lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {tenantId === 'demo-tenant' ? 'Demo Store' : `Store: ${tenantId.slice(0, 12)}...`}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedTenantId(tenantId);
                          setShowAddCard(true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Card
                      </button>
                      <button
                        onClick={() => handleAddPayPal(tenantId)}
                        disabled={processingPayPal}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Wallet className="w-3 h-3" />
                        {processingPayPal ? '...' : 'Add PayPal'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {methods.map(method => (
                      <CustomerPaymentMethodCard
                        key={method.id}
                        method={method}
                        onSetDefault={handleSetDefault}
                        onRemove={handleRemove}
                        isRemoving={removingId === method.id}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Security note */}
      <Card padding="md">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900">Your payment info is secure</h4>
            <p className="text-xs text-gray-500 mt-1">
              Card details are encrypted and processed by Stripe. We never store your full card number on our servers.
              Cards are saved per store for your security.
            </p>
          </div>
        </div>
      </Card>

      {/* Add Card Modal */}
      {addCardTenantId && (
        <CustomerAddCardModal
          isOpen={showAddCard}
          onClose={() => setShowAddCard(false)}
          tenantId={addCardTenantId}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  );
}
