'use client';

import { useEffect, useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Button } from '@mantine/core';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Loader2, CreditCard, Lock } from 'lucide-react';
import { customerOrderService } from '@/services/CustomerOrderService';

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
  }>;
  onSuccess: (orderNumber: string, gatewayTransactionId?: string) => void;
  onBack: () => void;
}

interface PayPalPaymentFormContentProps extends PayPalPaymentFormProps {
  orderId: string;
  orderNumber: string;
  paymentId: string;
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
}: PayPalPaymentFormContentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PayPal configuration
  const paypalOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
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
        amount,
        customerInfo,
        shippingAddress,
        cartItems,
      });

      console.log('PayPal create order response:', response);

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

      // Pass both order number and PayPal transaction ID
      onSuccess(orderNumber, response.capture?.id || data.orderID);
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
              <span>${(amount / 100).toFixed(2)}</span>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createOrderAndPayment();
  }, [props.customerInfo, props.shippingAddress, props.fulfillmentMethod, props.cartItems]);

  const createOrderAndPayment = async () => {
    try {
      // Create order
      const orderResponse = await customerOrderService.createCheckoutOrder({
        customerInfo: props.customerInfo,
        cartItems: props.cartItems,
        fulfillmentMethod: props.fulfillmentMethod || 'pickup',
        shippingAddress: props.shippingAddress,
        paymentMethod: 'paypal',
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

      const orderData = orderResponse.data;
      setOrderId(orderData.order.id);
      setOrderNumber(orderData.order.order_number);
      setPaymentId(orderData.payment.id);

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
    />
  );
}
