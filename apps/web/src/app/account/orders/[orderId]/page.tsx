'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { customerOrderService, CustomerOrder } from '@/services/CustomerOrderService';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import DigitalDownloadsCard from '@/components/downloads/DigitalDownloadsCard';
import FulfillmentTimeline from '@/components/orders/FulfillmentTimeline';
import ProductTypeBadge from '@/components/products/ProductTypeBadge';
import ServiceAppointmentCard from '@/components/orders/ServiceAppointmentCard';
import type { ServiceBooking } from '@/services/CustomerOrderService';
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
  const [serviceBookings, setServiceBookings] = useState<ServiceBooking[]>([]);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const result = await customerOrderService.getOrder(orderId);
      if (result) {
        setOrder(result);
        // Fetch service bookings if order has service items
        if (result.items?.some(item => item.productType === 'service' || item.productType === 'hybrid')) {
          try {
            const bookings = await customerOrderService.getOrderServiceBookings(result.orderId);
            setServiceBookings(bookings);
          } catch (e) {
            console.error('Failed to load service bookings:', e);
          }
        }
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

  const getDominantProductType = (): 'physical' | 'digital' | 'service' | 'hybrid' => {
    if (!order?.items?.length) return 'physical';
    const types = order.items.map(item => item.productType || 'physical');
    const uniqueTypes = [...new Set(types)];
    if (uniqueTypes.length === 1) return uniqueTypes[0] as any;
    if (uniqueTypes.includes('digital') && uniqueTypes.includes('physical')) return 'hybrid';
    if (uniqueTypes.includes('service') && uniqueTypes.includes('physical')) return 'hybrid';
    return uniqueTypes[0] as any;
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
          <FulfillmentTimeline
            productType={getDominantProductType()}
            orderStatus={order.orderStatus}
            createdAt={order.createdAt}
            paidAt={order.paidAt}
            fulfilledAt={order.fulfilledAt}
            digitalDeliveredAt={order.items?.find((item: any) => item.digitalDeliveredAt)?.digitalDeliveredAt}
            trackingNumber={order.trackingNumber}
          />

          {/* Split fulfillment status for hybrid orders */}
          {getDominantProductType() === 'hybrid' && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Fulfillment by Component</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(() => {
                  const items = order.items || [];
                  const hasPhysical = items.some(i => (i.productType || 'physical') === 'physical');
                  const hasDigital = items.some(i => i.productType === 'digital' || i.productType === 'hybrid');
                  const hasService = items.some(i => i.productType === 'service');

                  const components: Array<{ type: string; label: string; status: string; color: string }> = [];

                  if (hasPhysical) {
                    const physicalFulfilled = order.fulfillmentStatus === 'fulfilled' || order.fulfilledAt;
                    components.push({
                      type: 'physical',
                      label: 'Physical',
                      status: physicalFulfilled ? 'Fulfilled' : order.fulfillmentStatus || 'Pending',
                      color: physicalFulfilled ? 'text-green-700 bg-green-50' : 'text-yellow-700 bg-yellow-50',
                    });
                  }
                  if (hasDigital) {
                    const digitalDelivered = items.some((i: any) => i.digitalDeliveredAt || i.digitalDeliveryStatus === 'delivered');
                    components.push({
                      type: 'digital',
                      label: 'Digital',
                      status: digitalDelivered ? 'Delivered' : 'Pending',
                      color: digitalDelivered ? 'text-green-700 bg-green-50' : 'text-yellow-700 bg-yellow-50',
                    });
                  }
                  if (hasService) {
                    const serviceBooked = serviceBookings.length > 0;
                    const serviceCompleted = serviceBookings.length > 0 && serviceBookings.every(b => b.status === 'completed');
                    components.push({
                      type: 'service',
                      label: 'Service',
                      status: serviceCompleted ? 'Completed' : serviceBooked ? serviceBookings[0].status : 'Pending',
                      color: serviceCompleted ? 'text-green-700 bg-green-50' : serviceBooked ? 'text-blue-700 bg-blue-50' : 'text-yellow-700 bg-yellow-50',
                    });
                  }

                  return components.map(c => (
                    <div key={c.type} className={`rounded-lg px-3 py-2 ${c.color}`}>
                      <p className="text-xs font-medium">{c.label}</p>
                      <p className="text-sm font-semibold capitalize">{c.status}</p>
                    </div>
                  ));
                })()}
              </div>
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.productType && item.productType !== 'physical' && (
                        <ProductTypeBadge productType={item.productType} size="sm" />
                      )}
                    </div>
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

      {/* Digital Downloads */}
      {order.items?.some((item: any) => item.productType === 'digital' || item.productType === 'hybrid') && (
        <div className="mt-6">
          <DigitalDownloadsCard orderId={order.orderId} />
          <div className="text-center mt-2">
            <Link href="/account/downloads" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Go to Downloads Page →
            </Link>
          </div>
        </div>
      )}

      {/* Service Appointments */}
      {serviceBookings.length > 0 && (
        <div className="mt-6 space-y-4">
          {serviceBookings.map(booking => (
            <ServiceAppointmentCard key={booking.id} booking={booking} />
          ))}
          <div className="text-center">
            <Link href="/account/appointments" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View All Appointments →
            </Link>
          </div>
        </div>
      )}

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
                productType: item.productType,
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
              depositPercentage: (order as any).depositPercentage || undefined,
              gatewayType: (order as any).gatewayType || undefined,
            }}
          />
        </div>
      )}
    </div>
  );
}
