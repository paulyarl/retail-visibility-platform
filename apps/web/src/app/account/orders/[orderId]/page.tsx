'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { customerOrderService, CustomerOrder } from '@/services/CustomerOrderService';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import { 
  Package, 
  ArrowLeft, 
  MapPin, 
  CreditCard, 
  Truck,
  CheckCircle,
  Clock,
  Loader2,
  Download,
  Receipt,
  Mail,
  Phone
} from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const result = await customerOrderService.getOrder(orderId);
      if (result) {
        setOrder(result);
      }
    } catch (error) {
      console.error('Failed to load order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch ((status || 'unknown').toLowerCase()) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'shipped':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'delivered':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getFulfillmentSteps = () => {
    if (!order) return [];
    
    const steps = [
      { label: 'Order Placed', date: order.createdAt, icon: CheckCircle, completed: true },
      { label: 'Processing', date: order.paidAt, icon: Clock, completed: !!order.paidAt },
      { label: 'Shipped', date: order.fulfilledAt, icon: Truck, completed: !!order.fulfilledAt },
      { label: 'Delivered', date: null, icon: Package, completed: order.orderStatus === 'delivered' },
    ];

    return steps;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/account/orders')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <p className="text-gray-600 mt-1">Placed on {formatDate(order.createdAt)}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(order.orderStatus)}`}>
            {order.orderStatus}
          </span>
        </div>
      </div>

      {/* Fulfillment Timeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {getFulfillmentSteps().map((step, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  step.completed 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  <step.icon className="w-6 h-6" />
                </div>
                <p className={`text-sm mt-2 ${step.completed ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(step.date)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {order.trackingNumber && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Tracking Number: </span>
                {order.trackingNumber}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items ({order.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      <p className="font-medium text-gray-900">{formatCurrency(item.unitPrice)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <div className="space-y-6">
          {/* Shipping Address */}
          {order.shippingAddress && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{order.customerName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && (
                  <p>{order.shippingAddress.addressLine2}</p>
                )}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{order.customerEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{order.customerPhone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-900">{formatCurrency(order.shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="text-gray-900">{formatCurrency(order.tax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 font-medium">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900 text-lg">{formatCurrency(order.total)}</span>
                </div>
                {order.payment && (
                  <div className="pt-2 text-xs text-gray-500">
                    Paid via {order.payment.method} on {formatDate(order.paidAt)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowReceipt(!showReceipt)}
            >
              <Receipt className="w-4 h-4 mr-2" />
              {showReceipt ? 'Hide Receipt' : 'View Receipt'}
            </Button>
            <Button variant="outline" className="flex-1">
              Request Help
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt View */}
      {showReceipt && order && (
        <div className="max-w-4xl mx-auto mt-8">
          <OrderReceipt
            cart={{
              tenantId: order.tenantId,
              tenantName: order.tenantName,
              tenantLogo: order.tenantLogo || undefined,
              items: order.items.map(item => ({
                id: item.id,
                name: item.name,
                sku: item.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice * 100,
              })),
              subtotal: order.subtotal * 100,
              status: order.orderStatus,
              fulfillmentStatus: order.fulfillmentStatus,
              fulfilledAt: order.fulfilledAt || undefined,
              orderId: order.orderNumber,
              paymentId: order.paymentId || undefined,
              gatewayTransactionId: order.gatewayTransactionId || undefined,
              paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
              fulfillmentMethod: order.fulfillmentMethod || undefined,
              fulfillmentFee: order.shipping ? order.shipping * 100 : 0,
              customerInfo: order.customerInfo || (order.customerEmail ? {
                email: order.customerEmail,
                firstName: order.customerName?.split(' ')[0] || '',
                lastName: order.customerName?.split(' ').slice(1).join(' ') || '',
                phone: order.customerPhone || '',
              } : undefined),
              shippingAddress: order.shippingAddress || undefined,
              checkoutMode: (order as any).checkoutMode || undefined,
              depositCents: (order as any).depositCents || undefined,
              remainingBalanceCents: (order as any).remainingBalanceCents || undefined,
              pickupDeadline: (order as any).pickupDeadline || undefined,
              gatewayType: (order as any).gatewayType || undefined,
            }}
          />
        </div>
      )}
    </div>
  );
}
