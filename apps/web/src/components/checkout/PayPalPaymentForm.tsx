'use client';

import { useEffect, useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Button } from '@mantine/core';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Loader2, CreditCard, Lock } from 'lucide-react';
import { customerOrderService } from '@/services/CustomerOrderService';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { validateMinimumPaymentAmount } from '@/utils/paymentValidation';

interface PayPalPaymentFormProps {
  amount: number;
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping';
  cartItems: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    tenantId: string;
  }>;
  onSuccess: (orderNumber: string, gatewayTransactionId?: string, paymentMethodDetails?: { token?: string; cardLast4?: string; cardBrand?: string; expiryMonth?: number; expiryYear?: string }) => void;
  onBack: () => void;
  checkoutMode?: 'deposit' | 'full_payment';
}

interface PayPalPaymentFormContentProps extends PayPalPaymentFormProps {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  backendPaymentAmount?: number;
}

function PayPalPaymentFormContent({
  amount,
  customerInfo,
  shippingAddress,
  cartItems,
  onSuccess,
  onBack,
  orderId,
  orderNumber,
  paymentId,
  checkoutMode,
  backendPaymentAmount,
}: PayPalPaymentFormContentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PayPal configuration
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!paypalClientId) {
    return (
      <Alert variant="error">
        <AlertDescription>
          PayPal is not configured. Please contact the site administrator or select a different payment method.
        </AlertDescription>
      </Alert>
    );
  }

  const paypalOptions = {
    clientId: paypalClientId,
    currency: 'USD',
    intent: 'capture' as const,
    // Force sandbox mode to match backend API
    'disable-funding': 'credit,card',
  };

  const createOrder = async () => {
    try {
      const response = await customerOrderService.createPayPalOrder({
        orderId,
        paymentId,
        amount: backendPaymentAmount ?? amount,
        customerInfo,
        shippingAddress,
        cartItems,
      });

      // console.log('PayPal create order response:', response);

      if (!response) {
        throw new Error('Failed to create PayPal order');
      }

      // Service wraps response in data property
      const paypalOrderId = response.data?.orderId || response.orderId;
      if (!paypalOrderId) {
        throw new Error('No PayPal order ID in response');
      }
      return paypalOrderId;
    } catch (error) {
      console.error('PayPal create order error:', error);
      setError('Failed to initialize payment. Please try again.');
      throw error;
    }
  };

  const onApprove = async (data: any) => {
    try {
      setIsProcessing(true);
      setError(null);

      const response = await customerOrderService.capturePayPalOrder({
        orderId: data.orderID,
        paymentId,
        paypalOrderId: data.orderID,
      });

      if (!response) {
        throw new Error('Payment capture failed');
      }

      // Pass order number, PayPal transaction ID, and token for saving
      const transactionId = response.capture?.id || data.orderID;
      onSuccess(orderNumber, transactionId, {
        token: transactionId,
      });
    } catch (error) {
      console.error('PayPal capture error:', error);
      setError('Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onError = (error: any) => {
    console.error('PayPal error:', error);
    setError('Payment failed. Please try again.');
  };

  if (error) {
    return (
      <Alert variant="error">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
        <div className="space-y-2">
          {cartItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.name} (x{item.quantity})</span>
              <span>${(item.unitPrice * item.quantity / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>${((backendPaymentAmount ?? amount) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PayPal Buttons */}
      <div className="space-y-4">
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          <Lock className="h-4 w-4" />
          <span>Secure payment powered by PayPal</span>
        </div>

        <PayPalScriptProvider options={paypalOptions}>
          <PayPalButtons
            createOrder={createOrder}
            onApprove={onApprove}
            onError={onError}
            style={{
              layout: 'vertical',
              color: 'blue',
              shape: 'rect',
              label: 'paypal',
            }}
            disabled={isProcessing}
          />
        </PayPalScriptProvider>

        {isProcessing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Processing payment...</span>
          </div>
        )}
      </div>

      {/* Back Button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Back to Information
        </Button>
      </div>
    </div>
  );
}

export default function PayPalPaymentForm(props: PayPalPaymentFormProps) {
  const [orderId, setOrderId] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [backendPaymentAmount, setBackendPaymentAmount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings: platformSettings } = usePlatformSettings();

  // Validate minimum payment amount using platform-wide settings
  const paymentValidation = validateMinimumPaymentAmount(props.amount, platformSettings?.minimumPaymentAmount);
  
  if (!paymentValidation.isValid) {
    // console.log('[PayPal] Amount validation failed:', paymentValidation);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Payment Amount Too Low</p>
        <p className="text-red-600 text-sm mt-1">{paymentValidation.message}</p>
      </div>
    );
  }

  useEffect(() => {
    createOrderAndPayment();
  }, [props.fulfillmentMethod, props.amount]);

  const createOrderAndPayment = async () => {
    try {
      // Create order
      const orderResponse = await customerOrderService.createCheckoutOrder({
        customerInfo: props.customerInfo,
        cartItems: props.cartItems,
        fulfillmentMethod: props.fulfillmentMethod || 'pickup',
        shippingAddress: props.shippingAddress,
        paymentMethod: 'paypal',
        checkoutMode: props.checkoutMode,
      });

      if (!orderResponse) {
        throw new Error('Failed to create order - no response');
      }

      // Check for error response
      if (!orderResponse.success) {
        const errorMsg = orderResponse.message || orderResponse.error || 'Failed to create order';
        console.error('[PayPalPaymentForm] Order creation failed:', orderResponse);
        throw new Error(errorMsg);
      }

      const responseData = orderResponse.data || orderResponse;
      const order = responseData.order;
      const payment = responseData.payment;
      
      if (!order?.id) {
        console.error('[PayPalPaymentForm] Invalid order response:', orderResponse);
        throw new Error('Order creation returned invalid data');
      }
      
      setOrderId(order.id);
      setOrderNumber(order.order_number);
      
      if (payment?.id) {
        setPaymentId(payment.id);
      }
      if (typeof payment?.amount_cents === 'number') {
        setBackendPaymentAmount(payment.amount_cents);
      }

      setLoading(false);
    } catch (error) {
      console.error('Order creation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize checkout. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="ml-3 text-gray-600">Setting up payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <PayPalPaymentFormContent
      {...props}
      orderId={orderId}
      orderNumber={orderNumber}
      paymentId={paymentId}
      backendPaymentAmount={backendPaymentAmount}
    />
  );
}
