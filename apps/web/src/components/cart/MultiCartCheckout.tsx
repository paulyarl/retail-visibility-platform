/**
 * Multi-Cart Checkout Component
 * Displays all carts (one per tenant)
 * Allows gateway selection at checkout
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, CheckCircle, XCircle, Store } from 'lucide-react';
import { CartSummary } from '@/lib/cart/cartManager';
import { Button } from '@mantine/core';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';

interface Gateway {
  id: string;
  gateway_type: string;
  is_active: boolean;
  is_default: boolean;
  display_name?: string;
}

interface MultiCartCheckoutProps {
  carts: CartSummary[];
  onCartProcessed: (tenantId: string) => void;
}

interface CheckoutStatus {
  [key: string]: 'pending' | 'processing' | 'success' | 'error';
}

interface TenantProfile {
  id: string;
  name: string;
  logo_url?: string;
}

export default function MultiCartCheckout({ carts, onCartProcessed }: MultiCartCheckoutProps) {
  const router = useRouter();
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tenantGateways, setTenantGateways] = useState<Record<string, Gateway[]>>({});
  const [selectedGateways, setSelectedGateways] = useState<Record<string, string>>({});
  const [tenantProfiles, setTenantProfiles] = useState<Record<string, TenantProfile>>({});

  // console.log(`[MultiCartCheckout] carts: ${JSON.stringify(carts)}`);

  // Fetch available gateways and tenant profiles for each tenant
  useEffect(() => {
    const fetchData = async () => {
      const tenantIds = [...new Set(carts.map(c => c.cart.tenant_id))];
      const gatewayData: Record<string, Gateway[]> = {};
      const profileData: Record<string, TenantProfile> = {};
      
      for (const tenantId of tenantIds) {
        try {
          // Fetch gateways
          const gateways = await publicTenantInfoService.getPaymentGateways(tenantId);
          gatewayData[tenantId] = gateways.filter(g => g.is_active);
          // Set default gateway for each tenant
          const defaultGateway = gateways.find(g => g.is_default) || gateways[0];
          if (defaultGateway) {
            setSelectedGateways(prev => ({
              ...prev,
              [tenantId]: defaultGateway.gateway_type
            }));
          }
        } catch (err) {
          console.warn(`Failed to fetch gateways for tenant ${tenantId}:`, err);
          gatewayData[tenantId] = [];
        }
        
        try {
          // Fetch tenant profile for name and logo
          const profile = await publicTenantInfoService.getTenantProfile(tenantId);
          if (profile) {
            profileData[tenantId] = {
              id: tenantId,
              name: profile.business_name || tenantId,
              logo_url: profile.logo_url,
            };
          }
        } catch (err) {
          console.warn(`Failed to fetch profile for tenant ${tenantId}:`, err);
        }
      }
      
      setTenantGateways(gatewayData);
      setTenantProfiles(profileData);
    };
    
    if (carts.length > 0) {
      fetchData();
    }
  }, [carts]);

  const getGatewayIcon = (gatewayType: string) => {
    switch (gatewayType.toLowerCase()) {
      case 'square':
        return (
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
      case 'paypal':
        return (
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
    }
  };

  const getGatewayLabel = (gatewayType: string) => {
    switch (gatewayType.toLowerCase()) {
      case 'square':
        return 'Square';
      case 'paypal':
        return 'PayPal';
      default:
        return gatewayType.charAt(0).toUpperCase() + gatewayType.slice(1);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleCheckout = async (cartSummary: CartSummary) => {
    const { cart } = cartSummary;
    const statusKey = cart.tenant_id;
    const gatewayType = selectedGateways[cart.tenant_id];
    // console.log(`Checkout cart: ${JSON.stringify(cart)}`)

    if (!gatewayType) {
      console.error('[MultiCartCheckout] No gateway selected');
      return;
    }

    setCheckoutStatus(prev => ({ ...prev, [statusKey]: 'processing' }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[statusKey];
      return newErrors;
    });

    try {
      // Navigate to checkout page with cart context
      const params = new URLSearchParams({
        tenantId: cart.tenant_id,
        gatewayType: gatewayType
      });

      router.push(`/checkout?${params.toString()}`);
    } catch (error: any) {
      console.error('[MultiCartCheckout] Checkout failed:', error);
      setCheckoutStatus(prev => ({ ...prev, [statusKey]: 'error' }));
      setErrors(prev => ({ ...prev, [statusKey]: error.message || 'Checkout failed' }));
    }
  };

  const getStatusIcon = (statusKey: string) => {
    const status = checkoutStatus[statusKey];
    
    switch (status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  if (carts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Your carts are empty</h3>
        <p className="text-gray-600 mb-6">Add some items to get started</p>
        <Button onClick={() => router.push('/')}>
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Options */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Button>
        <Button
          variant="gradient"
          style={{ color: 'white' }}
          onClick={() => router.push('/carts')}
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          View All Carts
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push('/directory')}
        >
          Continue Shopping
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
        <p className="text-gray-600">
          You have {carts.length} cart{carts.length !== 1 ? 's' : ''} ready for checkout
        </p>
      </div>

      {carts.map((cartSummary) => {
        const { cart, item_count, total_cents } = cartSummary;
        const statusKey = cart.tenant_id;
        const status = checkoutStatus[statusKey];
        const error = errors[statusKey];
        const availableGateways = tenantGateways[cart.tenant_id] || [];
        const selectedGateway = selectedGateways[cart.tenant_id];
        // console.log(`[MultiCartCheckout] Selected cart: ${JSON.stringify(cart)}`);
        // console.log(`[MultiCartCheckout] Selected cartSummary: ${JSON.stringify(cartSummary)}`);
        
        // Use fetched profile or fall back to cart data
        const tenantProfile = tenantProfiles[cart.tenant_id];
        const displayName = tenantProfile?.name || cart.tenant_name || cart.tenant_id;
        const displayLogo = tenantProfile?.logo_url || cart.tenant_logo;

        return (
          <Card key={cartSummary.key} className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {displayLogo ? (
                      <img src={displayLogo} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {displayName}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {item_count} {item_count === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
                {getStatusIcon(statusKey)}
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {cart.items.map((item, index) => (
                  <div key={`${item.product_id}_${index}`} className="flex items-start gap-4">
                    {item.product_image && (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.product_name}</h4>
                      <p className="text-sm text-gray-600">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatPrice(item.price_cents * item.quantity)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatPrice(item.price_cents)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items</span>
                  <span className="text-gray-900">{item_count}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatPrice(total_cents)}</span>
                </div>
              </div>

              {/* Gateway Selection */}
              {availableGateways.length > 1 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Select Payment Method:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableGateways.map(gateway => (
                      <button
                        key={gateway.id}
                        onClick={() => setSelectedGateways(prev => ({
                          ...prev,
                          [cart.tenant_id]: gateway.gateway_type
                        }))}
                        className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                          selectedGateway === gateway.gateway_type
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {getGatewayIcon(gateway.gateway_type)}
                        <span className="text-sm font-medium">
                          {gateway.display_name || getGatewayLabel(gateway.gateway_type)}
                        </span>
                        {gateway.is_default && (
                          <span className="text-xs text-gray-500">(Default)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Checkout Button */}
              <div className="mt-6">
                <Button
                  onClick={() => handleCheckout(cartSummary)}
                  disabled={status === 'processing' || status === 'success' || !selectedGateway}
                  className="w-full"
                  size="lg"
                  
                            variant="gradient"
                            style={{ color: 'white' }}
                >
                  {status === 'processing' && (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  )}
                  {status === 'success' && (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Completed
                    </>
                  )}
                  {!status && selectedGateway && (
                    <>
                      Checkout with {getGatewayLabel(selectedGateway)}
                    </>
                  )}
                  {!selectedGateway && (
                    <>
                      Select Payment Method
                    </>
                  )}
                  {status === 'error' && (
                    <>
                      Retry Checkout
                    </>
                  )}
                </Button>
              </div>

              {/* Payment Method Info */}
              {selectedGateway && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💳 This cart will be processed using {getGatewayLabel(selectedGateway)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Summary Footer */}
      <Card className="bg-gray-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Total Across All Carts
              </h3>
              <p className="text-sm text-gray-600">
                {carts.reduce((sum, c) => sum + c.item_count, 0)} items in {carts.length} cart{carts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(carts.reduce((sum, c) => sum + c.total_cents, 0))}
              </p>
              <p className="text-sm text-gray-600">
                {carts.length} separate payment{carts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Multiple Carts:</strong> Each cart will be processed separately with its designated payment method. 
          You can checkout one cart at a time, and return to complete the others when ready.
        </p>
      </div>
    </div>
  );
}
