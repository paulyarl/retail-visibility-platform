'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMultiCart } from '@/hooks/useMultiCart';
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { CustomerInfoForm } from '@/components/checkout/CustomerInfoForm';
import FulfillmentMethodForm, { FulfillmentMethod } from '@/components/checkout/FulfillmentMethodForm';
import { ShippingAddressForm } from '@/components/checkout/ShippingAddressForm';
import PayPalPaymentForm from '@/components/checkout/PayPalPaymentForm';
import SquarePaymentForm from '@/components/checkout/SquarePaymentForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, ShoppingCart, Store, CreditCard, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { getCart, clearCart } from '@/lib/cart/cartManager';

type CheckoutStep = 'review' | 'fulfillment' | 'shipping' | 'payment';
type PaymentMethod = 'square' | 'paypal';

interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface ShippingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams?.get('tenantId');
  const gatewayType = searchParams?.get('gatewayType') as PaymentMethod | null;
  
  const { carts } = useMultiCart();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('review');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod | null>(null);
  const [fulfillmentFee, setFulfillmentFee] = useState<number>(0);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(gatewayType || 'square');
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableGateways, setAvailableGateways] = useState<PaymentMethod[]>([]);

  // Get the cart for this tenant and gateway type from multi-cart system
  const cart = tenantId && gatewayType ? getCart(tenantId, gatewayType) : null;
  const cartItems = cart?.items || [];
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);

  // Fetch available payment gateways (public endpoint for checkout)
  useEffect(() => {
    const fetchPaymentGateways = async () => {
      if (!tenantId) return;
      
      try {
        console.log('[Checkout] Fetching payment gateways for tenant:', tenantId);
        // Use direct fetch for public checkout - no auth required
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/tenants/${tenantId}/payment-gateways/public`);
        
        if (!response.ok) {
          console.error('[Checkout] Failed to fetch payment gateways:', response.status);
          return;
        }
        
        const data = await response.json();
        console.log('[Checkout] Payment gateways data:', data);
        const gateways = data.gateways || [];
        
        // Extract active gateway types
        const activeTypes = gateways
          .filter((gateway: any) => gateway.is_active)
          .map((gateway: any) => gateway.gateway_type as PaymentMethod);
        
        console.log('[Checkout] Active gateway types:', activeTypes);
        setAvailableGateways(activeTypes);
        
        // Set default payment method to first available if current selection is not available
        if (activeTypes.length > 0 && !activeTypes.includes(paymentMethod)) {
          console.log('[Checkout] Setting default payment method to:', activeTypes[0]);
          setPaymentMethod(activeTypes[0]);
        }
      } catch (error) {
        console.error('[Checkout] Failed to fetch payment gateways:', error);
      }
    };

    fetchPaymentGateways();
  }, [tenantId]);

  // Initialize checkout - validate cart exists
  useEffect(() => {
    console.log('[Checkout] Initialization check:', { 
      tenantId,
      gatewayType,
      hasCart: !!cart,
      itemCount: cart?.items?.length,
      isInitialized 
    });

    if (!tenantId || !gatewayType) {
      console.log('[Checkout] Missing tenant ID or gateway type, redirecting to /carts');
      router.push('/carts');
      return;
    }

    if (cart) {
      console.log('[Checkout] Cart found:', { 
        tenantId: cart.tenant_id,
        gatewayType: cart.gateway_type,
        itemCount: cart.items.length
      });
      
      // Valid cart - mark as initialized
      if (!isInitialized) {
        console.log('[Checkout] Valid cart, initializing checkout');
        setIsInitialized(true);
      }
    } else if (!isInitialized) {
      // Cart doesn't exist yet - give it a moment to load from localStorage
      console.log('[Checkout] No cart found, waiting for load...');
      const timer = setTimeout(() => {
        const loadedCart = tenantId && gatewayType ? getCart(tenantId, gatewayType) : null;
        if (!loadedCart) {
          console.log('[Checkout] Cart still not found after delay, redirecting');
          router.push('/carts');
        } else {
          console.log('[Checkout] Cart loaded after delay');
          setIsInitialized(true);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [tenantId, gatewayType, cart, router, isInitialized]);

  const platformFee = Math.round(subtotal * 0.03); // 3% platform fee
  const total = subtotal + platformFee + fulfillmentFee;

  // Map cart items to payment form format
  const mappedCartItems = cartItems.map(item => ({
    id: item.product_id,
    name: item.product_name,
    sku: item.product_sku || '',
    quantity: item.quantity,
    unitPrice: item.price_cents, // Keep in cents - OrderSummary.formatCurrency expects cents
    listPrice: item.list_price_cents,
    imageUrl: item.product_image,
    inventoryItemId: item.product_id,
    tenantId: tenantId || ''
  }));

  if (!tenantId || !cart) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleCustomerInfoSubmit = (info: CustomerInfo) => {
    setCustomerInfo(info);
    setCurrentStep('fulfillment');
  };

  const handleFulfillmentSubmit = (method: FulfillmentMethod, fee: number) => {
    setFulfillmentMethod(method);
    setFulfillmentFee(fee);
    
    // If pickup, skip shipping address and go to payment
    if (method === 'pickup') {
      setCurrentStep('payment');
    } else {
      setCurrentStep('shipping');
    }
  };

  const handleShippingSubmit = (address: ShippingAddress) => {
    setShippingAddress(address);
    setCurrentStep('payment');
  };

  const handlePaymentSuccess = async (orderNumber: string, gatewayTransactionId?: string) => {
    console.log('[Checkout] Payment success:', {
      orderNumber,
      gatewayTransactionId,
      customerInfo,
      shippingAddress,
      fulfillmentMethod,
      fulfillmentFee,
      tenantId,
      gatewayType
    });
    
    // Clear the cart after successful payment
    if (tenantId && gatewayType) {
      clearCart(tenantId, gatewayType);
      
      // Trigger cart update event
      window.dispatchEvent(new Event('cart-updated'));
    }
    
    // Save customer email/phone to localStorage for order history lookup
    if (customerInfo?.email) {
      localStorage.setItem('buyer_email', customerInfo.email);
    }
    if (customerInfo?.phone) {
      localStorage.setItem('buyer_phone', customerInfo.phone);
    }
    
    // Redirect to buyer order history
    router.push('/my-orders');
  };

  const handleBack = () => {
    if (currentStep === 'payment') {
      setCurrentStep('shipping');
    } else if (currentStep === 'shipping') {
      setCurrentStep('fulfillment');
    } else if (currentStep === 'fulfillment') {
      setCurrentStep('review');
    } else {
      router.push('/carts');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            {/* Navigation Options */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant="ghost"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/carts')}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Edit Cart
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/tenant/${tenantId}`)}
              >
                <Store className="mr-2 h-4 w-4" />
                Back to Store
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/directory')}
              >
                Continue Shopping
              </Button>
            </div>
            
            {/* Store Branding */}
            <div className="flex items-center gap-3 mb-4 p-4 bg-white rounded-lg border">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {cart.tenant_logo ? (
                  <img
                    src={cart.tenant_logo}
                    alt={cart.tenant_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Purchasing from</p>
                <p className="font-semibold text-gray-900">{cart.tenant_name}</p>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold">Checkout</h1>
          </div>

          {/* Progress Indicator */}
          <CheckoutProgress currentStep={currentStep} />

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step 1: Review & Customer Info */}
              {currentStep === 'review' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CustomerInfoForm
                      initialData={customerInfo}
                      onSubmit={handleCustomerInfoSubmit}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Fulfillment Method */}
              {currentStep === 'fulfillment' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Fulfillment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FulfillmentMethodForm
                      tenantId={tenantId}
                      subtotal={subtotal}
                      initialMethod={fulfillmentMethod || undefined}
                      onSubmit={handleFulfillmentSubmit}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Shipping Address (only for delivery/shipping) */}
              {currentStep === 'shipping' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ShippingAddressForm
                      initialData={shippingAddress}
                      onSubmit={handleShippingSubmit}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 4: Payment */}
              {currentStep === 'payment' && customerInfo && fulfillmentMethod && (
                fulfillmentMethod === 'pickup' || shippingAddress
              ) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Payment Method Selector */}
                    <div className="space-y-3">
                      <h3 className="font-medium text-neutral-900 dark:text-white">
                        Select Payment Method
                      </h3>
                      
                      {/* Only show available payment gateways */}
                      {availableGateways.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <CreditCard className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                          <p>No payment methods are configured</p>
                          <p className="text-sm">Please contact the store to set up payment options</p>
                        </div>
                      ) : (
                        <>
                          {/* Square Option - Only show if configured */}
                          {availableGateways.includes('square') && (
                            <button
                              onClick={() => setPaymentMethod('square')}
                              className={`w-full p-4 rounded-lg border-2 transition-all ${
                                paymentMethod === 'square'
                                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <CreditCard className="h-6 w-6 text-primary-600" />
                                <div className="text-left flex-1">
                                  <div className="font-medium text-neutral-900 dark:text-white">
                                    Credit or Debit Card
                                  </div>
                                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                    Visa, Mastercard, Amex, Discover
                                  </div>
                                </div>
                                {paymentMethod === 'square' && (
                                  <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </button>
                          )}

                          {/* PayPal Option - Only show if configured */}
                          {availableGateways.includes('paypal') && (
                            <button
                              onClick={() => setPaymentMethod('paypal')}
                              className={`w-full p-4 rounded-lg border-2 transition-all ${
                                paymentMethod === 'paypal'
                                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Wallet className="h-6 w-6 text-[#0070BA]" />
                                <div className="text-left flex-1">
                                  <div className="font-medium text-neutral-900 dark:text-white">
                                    PayPal
                                  </div>
                                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                    Pay with your PayPal account
                                  </div>
                                </div>
                                {paymentMethod === 'paypal' && (
                                  <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Conditional Payment Form */}
                    {paymentMethod === 'square' ? (
                      <SquarePaymentForm
                        amount={total}
                        customerInfo={customerInfo}
                        shippingAddress={shippingAddress ?? undefined}
                        fulfillmentMethod={fulfillmentMethod}
                        cartItems={mappedCartItems}
                        onSuccess={handlePaymentSuccess}
                        onBack={() => setCurrentStep('shipping')}
                      />
                    ) : (
                      <PayPalPaymentForm
                        amount={total}
                        customerInfo={customerInfo}
                        shippingAddress={shippingAddress ?? undefined}
                        fulfillmentMethod={fulfillmentMethod}
                        cartItems={mappedCartItems}
                        onSuccess={handlePaymentSuccess}
                        onBack={() => setCurrentStep('shipping')}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <OrderSummary
                  items={mappedCartItems}
                  subtotal={subtotal}
                  platformFee={platformFee}
                  shipping={fulfillmentFee}
                  total={total}
                  fulfillmentMethod={fulfillmentMethod || undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
