'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Loader2, CreditCard, Lock } from 'lucide-react';

interface SquarePaymentFormProps {
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
    listPrice?: number;
    imageUrl?: string;
    inventoryItemId?: string;
    tenantId: string;
  }>;
  onSuccess: (orderNumber: string, gatewayTransactionId?: string) => void;
  onBack: () => void;
}

interface SquarePaymentFormContentProps extends SquarePaymentFormProps {
  orderId: string;
  orderNumber: string;
  paymentId: string;
}

function SquarePaymentFormContent({
  amount,
  customerInfo,
  shippingAddress,
  cartItems,
  onSuccess,
  onBack,
  orderId,
  orderNumber,
  paymentId,
}: SquarePaymentFormContentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);

  useEffect(() => {
    const initializeSquare = async () => {
      try {
        if (!window.Square) {
          throw new Error('Square.js failed to load');
        }

        const paymentsInstance = window.Square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );

        setPayments(paymentsInstance);

        const cardInstance = await paymentsInstance.card();
        await cardInstance.attach('#card-container');
        setCard(cardInstance);
      } catch (err) {
        console.error('Square initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Square payment form');
      }
    };

    initializeSquare();

    return () => {
      if (card) {
        card.destroy();
      }
    };
  }, []);

  const handlePayment = async () => {
    if (!card || !payments) {
      setError('Payment form not initialized');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Tokenize card
      const result = await card.tokenize();
      
      if (result.status === 'OK') {
        const token = result.token;

        // Process payment with backend
        const response = await fetch('/api/checkout/square/process-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            paymentId,
            sourceId: token,
            amount,
            customerInfo,
            shippingAddress,
            cartItems,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Payment failed');
        }

        const { payment } = await response.json();
        
        // Success - call onSuccess with order number and transaction ID
        onSuccess(orderNumber, payment.id);
      } else {
        // Handle tokenization errors
        const errors = result.errors || [];
        const errorMessage = errors.map((e: any) => e.message).join(', ');
        throw new Error(errorMessage || 'Card validation failed');
      }
    } catch (err) {
      console.error('Square payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment processing failed');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* Square Card Container */}
        <div 
          id="card-container" 
          className="min-h-[200px] p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        />

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <Lock className="h-4 w-4" />
          <span>Secure payment powered by Square</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handlePayment}
          disabled={isProcessing || !card}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Pay ${(amount / 100).toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function SquarePaymentForm(props: SquarePaymentFormProps) {
  const [orderId, setOrderId] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Destructure props for useEffect dependencies
  const { customerInfo, shippingAddress, cartItems, amount } = props;

  useEffect(() => {
    const initializePayment = async () => {
      try {
        // Create order
        const orderResponse = await fetch('/api/checkout/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId: cartItems[0]?.tenantId,
            customer: {
              email: customerInfo.email,
              firstName: customerInfo.firstName,
              lastName: customerInfo.lastName,
              phone: customerInfo.phone,
            },
            shippingAddress: shippingAddress,
            items: cartItems.map((item) => ({
              id: item.inventoryItemId,
              sku: item.sku,
              name: item.name,
              quantity: item.quantity,
              unit_price_cents: item.unitPrice,
              list_price_cents: item.listPrice,
              image_url: item.imageUrl,
              tenant_id: item.tenantId,
            })),
          }),
        });

        if (!orderResponse.ok) {
          throw new Error('Failed to create order');
        }

        const { order } = await orderResponse.json();
        setOrderId(order.id);
        setOrderNumber(order.orderNumber);

        // Create payment record
        const paymentResponse = await fetch('/api/checkout/payments/charge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: order.id,
            paymentMethod: {
              type: 'card',
            },
            gatewayType: 'square',
          }),
        });

        if (!paymentResponse.ok) {
          throw new Error('Failed to create payment record');
        }

        const { payment } = await paymentResponse.json();
        setPaymentId(payment.id);
        setIsLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initializePayment();
  }, [customerInfo, shippingAddress, cartItems, amount]);

  // Load Square.js script
  useEffect(() => {
    if (document.getElementById('square-js')) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'square-js';
    script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
    script.async = true;
    script.onload = () => {
      console.log('Square.js loaded successfully');
    };
    script.onerror = () => {
      setError('Failed to load Square payment form');
    };
    document.body.appendChild(script);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="ml-3 text-gray-600">Preparing payment...</p>
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
    <SquarePaymentFormContent
      {...props}
      orderId={orderId}
      orderNumber={orderNumber}
      paymentId={paymentId}
    />
  );
}

// Extend Window interface for Square
declare global {
  interface Window {
    Square?: any;
  }
}
