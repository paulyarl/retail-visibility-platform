'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle, ArrowLeft } from 'lucide-react';

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment'); // Changed from 'paymentId' to 'payment'
  const orderId = searchParams.get('orderId');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (paymentId) {
      fetchOrderDetails();
    }
  }, [paymentId]);

  const fetchOrderDetails = async () => {
    try {
      console.log('Fetching order details for paymentId:', paymentId);
      const response = await fetch(`/api/checkout/payments/${paymentId}`);
      console.log('Payment details response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (response.ok) {
        const { payment } = await response.json();
        console.log('Payment data received:', payment);
        setOrderDetails(payment);
        
        // Fetch tenant information if we have the tenant_id
        if (payment.tenant_id) {
          console.log('Fetching tenant info for:', payment.tenant_id);
          const tenantResponse = await fetch(`/api/tenants/${payment.tenant_id}`);
          if (tenantResponse.ok) {
            const tenantData = await tenantResponse.json();
            console.log('Tenant data received:', tenantData);
            setTenantInfo(tenantData);
            
            // Also fetch business profile for complete branding info
            const profileResponse = await fetch(`/api/tenants/${payment.tenant_id}/business-profile`);
            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              console.log('Business profile data received:', profileData);
              // Merge business profile data with tenant info
              setTenantInfo((prev: any) => ({
                ...prev,
                ...profileData.business_profile
              }));
            }
          }
        }
      } else {
        const errorData = await response.text();
        console.error('Payment API error:', errorData);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Store Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            {/* Store Logo */}
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mr-4 overflow-hidden">
              {tenantInfo?.logo_url ? (
                <img 
                  src={tenantInfo.logo_url} 
                  alt={tenantInfo.business_name || tenantInfo?.name || 'Store Logo'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-blue-600 font-bold text-xl">
                  {(tenantInfo?.business_name || tenantInfo?.name || 'Demo Store').substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {tenantInfo?.business_name || tenantInfo?.name || 'Demo Store'}
              </h1>
              <p className="text-gray-600">
                {tenantInfo?.business_description || 'Your trusted local retailer'}
              </p>
            </div>
          </div>
          <div className="text-center text-sm text-gray-500">
            <p>
              {tenantInfo?.address_line1 && (
                <>
                  {tenantInfo.address_line1}
                  {tenantInfo?.address_line2 && `, ${tenantInfo.address_line2}`}
                  {tenantInfo?.city && `, ${tenantInfo.city}`}
                  {tenantInfo?.state && `, ${tenantInfo.state}`}
                  {tenantInfo?.postal_code && ` ${tenantInfo.postal_code}`}
                </>
              ) || '123 Main Street, Anytown, USA 12345'}
            </p>
            <p>
              {tenantInfo?.email || tenantInfo?.phone ? (
                <>
                  {tenantInfo?.email && <>{tenantInfo.email}</>}
                  {tenantInfo?.email && tenantInfo?.phone && ' | '}
                  {tenantInfo?.phone && <>{tenantInfo.phone}</>}
                </>
              ) : 'contact@demostore.com | (555) 123-4567'}
            </p>
            {tenantInfo?.website && (
              <p className="text-blue-600 hover:underline">
                <a href={tenantInfo.website} target="_blank" rel="noopener noreferrer">
                  {tenantInfo.website}
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Confirmation Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">Thank you for your purchase. Your order has been received.</p>
          <p className="text-sm text-gray-500 mt-2">Order confirmation sent to your email</p>
        </div>

        {/* Order Details */}
        {orderDetails && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Order Number</p>
                  <p className="font-semibold">{orderDetails.orders?.order_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold capitalize">{orderDetails.orders?.order_status || 'Pending'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <p className="font-semibold capitalize">{orderDetails.payment_status || 'Processing'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold">
                    ${((orderDetails.amount_cents || 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              {orderDetails.orders?.order_items && (
                <div>
                  <h3 className="font-semibold mb-2">Items</h3>
                  <div className="space-y-2">
                    {orderDetails.orders.order_items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span>${((item.total_cents || 0) / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fees Breakdown */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>${((orderDetails.amount_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span>FREE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span>$0.00</span>
                  </div>
                  {orderDetails.platform_fee_cents && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platform Fee</span>
                      <span>${(orderDetails.platform_fee_cents / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base border-t pt-2">
                    <span>Total</span>
                    <span>${((orderDetails.amount_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {orderDetails.orders?.shipping_address_line1 && (
                <div>
                  <h3 className="font-semibold mb-2">Shipping Address</h3>
                  <div className="text-sm text-gray-600">
                    <p>{orderDetails.orders.shipping_address_line1}</p>
                    {orderDetails.orders.shipping_address_line2 && (
                      <p>{orderDetails.orders.shipping_address_line2}</p>
                    )}
                    <p>
                      {orderDetails.orders.shipping_city}, {orderDetails.orders.shipping_state} {orderDetails.orders.shipping_postal_code}
                    </p>
                    <p>{orderDetails.orders.shipping_country}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Store
          </Button>
          <Button onClick={() => window.print()}>
            Print Receipt
          </Button>
        </div>

        {/* Next Steps */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✅ You'll receive an email confirmation shortly</li>
              <li>📦 We'll process your order within 1-2 business days</li>
              <li>🚚 You'll receive shipping confirmation when your order ships</li>
              <li>📧 You can track your order status using the order number above</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order confirmation...</p>
        </div>
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  );
}
