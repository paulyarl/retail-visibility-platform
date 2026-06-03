'use client';

import { useState, useEffect } from 'react';
import { Button } from '@mantine/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Printer, Download, Mail, Phone, MapPin, Store, CheckCircle2, Package, AlertTriangle, XCircle } from 'lucide-react';
import TenantQRCode from '@/components/public/TenantQRCode';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { customerOrderService } from '@/services/CustomerOrderService';
import { publicPlatformFeeService } from '@/services/PublicPlatformFeeService';

interface OrderReceiptProps {
  cart: {
    tenantId: string;
    tenantName: string;
    tenantLogo?: string;
    items: Array<{
      id: string;
      name: string;
      sku: string;
      quantity: number;
      unitPrice: number;
    }>;
    subtotal: number;
    status: string;
    fulfillmentStatus?: string;
    fulfilledAt?: string | null;
    orderId?: string;
    paymentId?: string;
    gatewayTransactionId?: string;
    paidAt?: Date;
    fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping';
    fulfillmentFee?: number;
    customerInfo?: {
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
    // Deposit order fields
    checkoutMode?: 'deposit' | 'full_payment';
    depositCents?: number;
    remainingBalanceCents?: number;
    pickupDeadline?: string | null;
    depositForfeitedAt?: string | null;
    depositPercentage?: number | null;
    // Cancellation fields
    cancellationReason?: string;
    cancelledAt?: string | null;
    // Payment gateway
    gatewayType?: string;
  };
  platformFeePercentage?: number;
  onPrint?: () => void;
  className?: string;
  actions?: React.ReactNode;
  statusHistory?: any[];
}

export default function OrderReceipt({ cart, platformFeePercentage: propPlatformFeePercentage = 3.0, onPrint, className = "", actions, statusHistory: propStatusHistory }: OrderReceiptProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [fulfillmentSettings, setFulfillmentSettings] = useState<any>(null);
  const [effectivePlatformFeePercentage, setEffectivePlatformFeePercentage] = useState<number>(propPlatformFeePercentage);
  const [statusHistory, setStatusHistory] = useState<any[]>(propStatusHistory || []);

  // Fetch actual platform fee percentage if not explicitly provided
  useEffect(() => {
    // If the prop is explicitly different from the default, trust it
    if (propPlatformFeePercentage !== 3.0) {
      setEffectivePlatformFeePercentage(propPlatformFeePercentage);
      return;
    }

    // Otherwise fetch from the single source of truth
    const fetchPlatformFee = async () => {
      try {
        const percentage = await publicPlatformFeeService.getPlatformFeePercentage();
        setEffectivePlatformFeePercentage(percentage);
      } catch (error) {
        console.warn('[OrderReceipt] Failed to fetch platform fee, using default:', error);
        setEffectivePlatformFeePercentage(3.0);
      }
    };

    fetchPlatformFee();
  }, [propPlatformFeePercentage]);

  // Fetch order status history only when not provided as prop
  useEffect(() => {
    if (propStatusHistory) return;

    const fetchStatusHistory = async () => {
      if (!cart.orderId) return;
      
      try {
        const orderData = await customerOrderService.getOrder(cart.orderId, cart.customerInfo?.email);
        if (orderData && orderData.statusHistory) {
          setStatusHistory(orderData.statusHistory);
        }
      } catch (error) {
        console.warn('[OrderReceipt] Failed to fetch status history:', error);
      }
    };

    fetchStatusHistory();
  }, [cart.orderId, cart.tenantId, propStatusHistory]);

  // Debug: Log cart data to see what's available
  // console.log('[OrderReceipt] Cart data:', {
  //   customerInfo: cart.customerInfo,
  //   shippingAddress: cart.shippingAddress,
  //   tenantId: cart.tenantId,
  //   orderId: cart.orderId
  // });

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Calculate fees (same as checkout)
  const platformFee = Math.round(cart.subtotal * (effectivePlatformFeePercentage / 100));
  const fulfillmentFee = cart.fulfillmentFee || 0;
  const total = cart.subtotal + platformFee + fulfillmentFee;
  
  // Deposit order handling
  const isDepositOrder = cart.checkoutMode === 'deposit';
  const isDepositForfeited = isDepositOrder && cart.depositForfeitedAt;
  const depositAmount = cart.depositCents || 0;
  const remainingBalance = cart.remainingBalanceCents || (total - depositAmount);
  const depositPercentageDisplay = cart.depositPercentage ?? (depositAmount > 0 && cart.subtotal > 0 ? Math.round((depositAmount / cart.subtotal) * 100) : null);
  
  const getFulfillmentLabel = () => {
    if (!cart.fulfillmentMethod) return 'Fulfillment';
    if (cart.fulfillmentMethod === 'pickup') return 'In-Store Pickup';
    if (cart.fulfillmentMethod === 'delivery') return 'Local Delivery';
    return 'Shipping';
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⏳', label: 'Pending' },
      processing: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔄', label: 'Processing' },
      shipped: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '📦', label: 'Shipped' },
      fulfilled: { color: 'bg-green-100 text-green-800 border-green-200', icon: '✅', label: 'Fulfilled' },
      cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: '❌', label: 'Cancelled' },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.pending;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        <span className="text-xs">{badge.icon}</span>
        {badge.label}
      </span>
    );
  };

  const formatStatusDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fetch tenant profile and business hours
  useEffect(() => {
    const fetchTenantData = async () => {
      if (!cart.tenantId) return;
      
      setIsLoadingProfile(true);
      try {
        // Fetch tenant profile
        const profile = await publicTenantInfoService.getBusinessProfile(cart.tenantId);
        // console.log('[OrderReceipt] Fetched tenant profile:', profile);
        setTenantProfile(profile);

        // Fetch business hours for all orders (important for multi-store orders)
        const hours = await publicTenantInfoService.getBusinessHours(cart.tenantId);
        if (hours) {
          // console.log('[OrderReceipt] Fetched business hours:', hours);
          setBusinessHours(hours);
        } else {
          console.error('[OrderReceipt] Failed to fetch business hours');
        }

        // Fetch fulfillment settings for pickup ready time
        const fulfillmentSettings = await publicTenantInfoService.getFulfillmentSettings(cart.tenantId);
        if (fulfillmentSettings) {
          // console.log('[OrderReceipt] Fetched fulfillment settings:', fulfillmentSettings);
          setFulfillmentSettings(fulfillmentSettings);
        } else {
          console.error('[OrderReceipt] Failed to fetch fulfillment settings');
        }
      } catch (error) {
        console.error('[OrderReceipt] Error fetching tenant data:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchTenantData();
  }, [cart.tenantId]);

  // Compute directions URL from tenant profile
  const directionsUrl = tenantProfile?.address_line1 && tenantProfile?.city && tenantProfile?.state
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${tenantProfile.address_line1}, ${tenantProfile.city}, ${tenantProfile.state} ${tenantProfile.postal_code}`)}`
    : '';

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 100);
    onPrint?.();
  };

  const handleDownload = () => {
    // Create a text receipt
    const receipt = generateTextReceipt();
    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${cart.orderId || 'order'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const generateTextReceipt = () => {
    const storeAddress = tenantProfile?.address_line1 ? `
${tenantProfile.address_line1}
${tenantProfile.address_line2 ? tenantProfile.address_line2 : ''}
${tenantProfile.city}, ${tenantProfile.state} ${tenantProfile.postal_code}
${tenantProfile.country_code}` : 'Store Location';
    
    const storePhone = tenantProfile?.phone_number || '(555) 123-4567';
    const storeEmail = tenantProfile?.email || `support@${cart.tenantName.toLowerCase().replace(/\s+/g, '-')}.com`;
    // console.log(`Cart gateway 1: ${cart.gatewayType}`);

    return `
╔══════════════════════════════════════════════════════════════╗
║                      ORDER RECEIPT                           ║
╚══════════════════════════════════════════════════════════════╝

Order Number: ${cart.orderId || 'N/A'}
Order Status: ${cart.status.toUpperCase()}
Date: ${cart.paidAt ? formatDate(cart.paidAt) : new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════

CUSTOMER INFORMATION
───────────────────────────────────────────────────────────
${cart.customerInfo ? `
Name: ${cart.customerInfo.firstName} ${cart.customerInfo.lastName}
Email: ${cart.customerInfo.email}
Phone: ${cart.customerInfo.phone}` : 'Guest Checkout'}

═══════════════════════════════════════════════════════════════

FULFILLMENT METHOD
───────────────────────────────────────────────────────────
${cart.fulfillmentMethod === 'pickup' ? `
*** IN-STORE PICKUP ***
Pick up your order at our store location.
We'll notify you when your order is ready for pickup.
${fulfillmentFee === 0 ? 'FREE' : formatCurrency(fulfillmentFee)}
${fulfillmentSettings?.pickup_ready_time_minutes ? `
⏱️ Estimated Ready Time: ${Math.floor(fulfillmentSettings.pickup_ready_time_minutes / 60)}h ${fulfillmentSettings.pickup_ready_time_minutes % 60}m
Your order will typically be ready within ${fulfillmentSettings.pickup_ready_time_minutes} minutes.` : ''}
${fulfillmentSettings?.pickup_instructions ? `

📋 Pickup Instructions:
${fulfillmentSettings.pickup_instructions}` : ''}

${businessHours ? `Store Hours:
${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
  const dayHours = businessHours[day];
  const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
  const dayLabel = isToday ? `${day} (Today)` : day;
  const hours = dayHours ? `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}` : 'Closed';
  return `  ${dayLabel.padEnd(18)} ${hours}`;
}).join('\n')}` : ''}` : ''}${cart.fulfillmentMethod === 'delivery' && cart.shippingAddress ? `
*** LOCAL DELIVERY ***
Delivery Address:
${cart.customerInfo?.firstName} ${cart.customerInfo?.lastName}
${cart.shippingAddress.addressLine1}
${cart.shippingAddress.addressLine2 ? cart.shippingAddress.addressLine2 : ''}
${cart.shippingAddress.city}, ${cart.shippingAddress.state} ${cart.shippingAddress.postalCode}
${cart.customerInfo?.phone ? `Contact: ${cart.customerInfo.phone}` : ''}` : ''}${cart.fulfillmentMethod === 'shipping' && cart.shippingAddress ? `
*** SHIPPING ***
Shipping Address:
${cart.customerInfo?.firstName} ${cart.customerInfo?.lastName}
${cart.shippingAddress.addressLine1}
${cart.shippingAddress.addressLine2 ? cart.shippingAddress.addressLine2 : ''}
${cart.shippingAddress.city}, ${cart.shippingAddress.state} ${cart.shippingAddress.postalCode}
${cart.shippingAddress.country}
${cart.customerInfo?.phone ? `Contact: ${cart.customerInfo.phone}` : ''}` : ''}${!cart.fulfillmentMethod && cart.shippingAddress ? `
Shipping Address:
${cart.customerInfo?.firstName} ${cart.customerInfo?.lastName}
${cart.shippingAddress.addressLine1}
${cart.shippingAddress.addressLine2 ? cart.shippingAddress.addressLine2 : ''}
${cart.shippingAddress.city}, ${cart.shippingAddress.state} ${cart.shippingAddress.postalCode}
${cart.shippingAddress.country}` : ''}

═══════════════════════════════════════════════════════════════

MERCHANT INFORMATION
───────────────────────────────────────────────────────────
Store: ${cart.tenantName}
Store ID: ${cart.tenantId}
Address: ${storeAddress}
Phone: ${storePhone}
Email: ${storeEmail}

═══════════════════════════════════════════════════════════════

ORDER ITEMS
───────────────────────────────────────────────────────────
${cart.items.map(item => {
  const itemTotal = item.unitPrice * item.quantity;
  return `${item.quantity}x ${item.name}
    SKU: ${item.sku}
    Unit Price: ${formatCurrency(item.unitPrice)}
    Item Total: ${formatCurrency(itemTotal)}`;
}).join('\n\n')}

═══════════════════════════════════════════════════════════════

ORDER SUMMARY
───────────────────────────────────────────────────────────
Subtotal: ${formatCurrency(cart.subtotal)}
${platformFee > 0 ? `Platform Fee (${effectivePlatformFeePercentage}%): ${formatCurrency(platformFee)}\n` : ''}${getFulfillmentLabel()}: ${formatCurrency(fulfillmentFee)}
───────────────────────────────────────────────────────────
TOTAL: ${formatCurrency(total)}

═══════════════════════════════════════════════════════════════

PAYMENT INFORMATION
───────────────────────────────────────────────────────────
Payment Method: ${cart.gatewayType ? cart.gatewayType.charAt(0).toUpperCase() + cart.gatewayType.slice(1) : 'PayPal'}
Payment Status: ${cart.status.toUpperCase()}
Transaction ID: ${cart.gatewayTransactionId || cart.paymentId || cart.orderId || 'N/A'}

═══════════════════════════════════════════════════════════════

FULFILLMENT INFORMATION
───────────────────────────────────────────────────────────
Fulfillment Method: ${getFulfillmentLabel()}
Fulfillment Status: ${cart.fulfillmentStatus === 'fulfilled' ? 'PICKED UP' : cart.fulfillmentStatus?.toUpperCase() || 'PROCESSING'}${cart.fulfilledAt ? `
Picked Up On: ${new Date(cart.fulfilledAt).toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})}` : ''}${cart.fulfillmentMethod === 'pickup' && tenantProfile?.address_line1 ? `
Pickup Location: ${tenantProfile.address_line1}${tenantProfile.address_line2 ? `, ${tenantProfile.address_line2}` : ''}, ${tenantProfile.city}, ${tenantProfile.state} ${tenantProfile.postal_code}` : ''}

═══════════════════════════════════════════════════════════════

Thank you for your order!
Questions? Contact us at support@visibleshelf.store

Generated on ${new Date().toLocaleString()}
`.trim();
  };

  // Allow cancelled orders and forfeited deposit orders to show receipt
  const isCancelled = cart.status === 'cancelled';
  if (cart.status !== 'paid' && cart.status !== 'fulfilled' && !isDepositForfeited && !isCancelled) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header - show appropriate status */}
      {isCancelled ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Order Cancelled</h3>
              <p className="text-sm text-red-700">
                Order ID: {cart.orderId || 'Processing...'}
                {cart.cancelledAt && ` · Cancelled on ${formatDate(new Date(cart.cancelledAt))}`}
              </p>
            </div>
          </div>
        </div>
      ) : isDepositForfeited ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Deposit Forfeited</h3>
              <p className="text-sm text-red-700">
                Order ID: {cart.orderId || 'Processing...'}
                {cart.depositForfeitedAt && ` · Forfeited on ${formatDate(new Date(cart.depositForfeitedAt))}`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Order Completed Successfully!</h3>
              <p className="text-sm text-green-700">
                Order ID: {cart.orderId || 'Processing...'}
                {cart.paidAt && ` · Paid on ${formatDate(cart.paidAt)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Order Receipt</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isPrinting}
                className="print:hidden"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="print:hidden"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Order Details */}
          <div className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Order Information</h4>
                <p className="text-sm text-gray-600">
                  Order #{cart.orderId || 'Processing...'}
                </p>
                <p className="text-sm text-gray-600">
                  {cart.paidAt ? formatDate(cart.paidAt) : new Date().toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  isCancelled ? 'bg-red-100 text-red-800' :
                  isDepositForfeited ? 'bg-red-100 text-red-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {isCancelled && <XCircle className="h-4 w-4 mr-1" />}
                  {!isCancelled && !isDepositForfeited && <CheckCircle2 className="h-4 w-4 mr-1" />}
                  {isDepositForfeited && <AlertTriangle className="h-4 w-4 mr-1" />}
                  {isCancelled ? 'Cancelled' : isDepositForfeited ? 'Forfeited' : cart.status.charAt(0).toUpperCase() + cart.status.slice(1)}
                </span>
              </div>
            </div>
            
            {/* Cancellation Reason */}
            {isCancelled && cart.cancellationReason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <span className="font-medium">Cancellation Reason:</span> {cart.cancellationReason}
                </p>
              </div>
            )}
          </div>

          {/* Customer Information */}
          {cart.customerInfo && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Customer Information</h4>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-blue-900">
                  {cart.customerInfo.firstName} {cart.customerInfo.lastName}
                </p>
                {cart.customerInfo.email && (
                  <p className="text-blue-700">
                    <span className="font-medium">Email:</span> {cart.customerInfo.email}
                  </p>
                )}
                {cart.customerInfo.phone && (
                  <p className="text-blue-700">
                    <span className="font-medium">Phone:</span> {cart.customerInfo.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fulfillment Method */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
            <div className="flex items-center gap-3 mb-3">
              <Package className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Fulfillment Method</h4>
            </div>
            <div className="space-y-3 text-sm">
              {cart.fulfillmentMethod === 'pickup' && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-600 text-white px-3 py-1 rounded-full font-semibold text-xs">
                      IN-STORE PICKUP
                    </div>
                    {fulfillmentFee === 0 && (
                      <span className="text-green-600 font-semibold">FREE</span>
                    )}
                  </div>
                  <p className="text-purple-800 font-medium">
                    Pick up your order at our store location
                  </p>
                  <p className="text-purple-700">
                    We'll notify you when your order is ready for pickup.
                  </p>
                  
                  {/* Pickup Ready Time */}
                  {fulfillmentSettings?.pickup_ready_time_minutes && (
                    <div className="mt-2 p-2 bg-purple-100 rounded border border-purple-300">
                      <p className="text-purple-900 font-semibold text-sm">
                        ⏱️ Estimated Ready Time: {Math.floor(fulfillmentSettings.pickup_ready_time_minutes / 60)}h {fulfillmentSettings.pickup_ready_time_minutes % 60}m
                      </p>
                      <p className="text-purple-700 text-xs mt-1">
                        Your order will typically be ready within {fulfillmentSettings.pickup_ready_time_minutes} minutes of placing your order.
                      </p>
                    </div>
                  )}
                  
                  {/* Pickup Instructions */}
                  {fulfillmentSettings?.pickup_instructions && (
                    <div className="mt-2 p-2 bg-purple-100 rounded border border-purple-300">
                      <p className="text-purple-900 font-semibold text-sm">
                        📋 Pickup Instructions:
                      </p>
                      <p className="text-purple-700 text-xs mt-1">
                        {fulfillmentSettings.pickup_instructions}
                      </p>
                    </div>
                  )}
                  
                  {/* Store Hours */}
                  {businessHours && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <p className="text-purple-800 font-medium mb-2">Store Hours:</p>
                      <div className="space-y-1 text-xs">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                          const dayHours = businessHours[day];
                          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                          
                          return (
                            <div key={day} className={`flex justify-between ${isToday ? 'font-semibold text-purple-900' : 'text-purple-700'}`}>
                              <span>{isToday ? `${day} (Today)` : day}</span>
                              <span>
                                {dayHours ? `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}` : 'Closed'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* QR Code for Directions */}
                  {directionsUrl && cart.tenantId && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <p className="text-purple-800 font-medium mb-2">Get Directions:</p>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <TenantQRCode
                            url={directionsUrl}
                            tenantId={cart.tenantId}
                            size={150}
                            showDownload={false}
                            label=""
                            className="bg-transparent shadow-none p-0"
                          />
                        </div>
                        <div className="flex-1 text-xs text-purple-700">
                          <p className="font-medium mb-1">Scan for directions</p>
                          <p className="leading-relaxed">
                            {tenantProfile.address_line1}
                            {tenantProfile.address_line2 && `, ${tenantProfile.address_line2}`}
                            <br />
                            {tenantProfile.city}, {tenantProfile.state} {tenantProfile.postal_code}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {cart.fulfillmentMethod === 'delivery' && cart.shippingAddress && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-600 text-white px-3 py-1 rounded-full font-semibold text-xs">
                      LOCAL DELIVERY
                    </div>
                  </div>
                  <p className="text-purple-800 font-medium">Delivery Address:</p>
                  <div className="text-purple-700 pl-2 border-l-2 border-purple-300">
                    <p className="font-medium">
                      {cart.customerInfo?.firstName} {cart.customerInfo?.lastName}
                    </p>
                    <p>{cart.shippingAddress.addressLine1}</p>
                    {cart.shippingAddress.addressLine2 && (
                      <p>{cart.shippingAddress.addressLine2}</p>
                    )}
                    <p>
                      {cart.shippingAddress.city}, {cart.shippingAddress.state} {cart.shippingAddress.postalCode}
                    </p>
                    {cart.customerInfo?.phone && (
                      <p className="mt-1">
                        <span className="font-medium">Contact:</span> {cart.customerInfo.phone}
                      </p>
                    )}
                  </div>
                </>
              )}
              
              {cart.fulfillmentMethod === 'shipping' && cart.shippingAddress && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-600 text-white px-3 py-1 rounded-full font-semibold text-xs">
                      SHIPPING
                    </div>
                  </div>
                  <p className="text-purple-800 font-medium">Shipping Address:</p>
                  <div className="text-purple-700 pl-2 border-l-2 border-purple-300">
                    <p className="font-medium">
                      {cart.customerInfo?.firstName} {cart.customerInfo?.lastName}
                    </p>
                    <p>{cart.shippingAddress.addressLine1}</p>
                    {cart.shippingAddress.addressLine2 && (
                      <p>{cart.shippingAddress.addressLine2}</p>
                    )}
                    <p>
                      {cart.shippingAddress.city}, {cart.shippingAddress.state} {cart.shippingAddress.postalCode}
                    </p>
                    <p>{cart.shippingAddress.country}</p>
                    {cart.customerInfo?.phone && (
                      <p className="mt-1">
                        <span className="font-medium">Contact:</span> {cart.customerInfo.phone}
                      </p>
                    )}
                  </div>
                </>
              )}
              
              {!cart.fulfillmentMethod && cart.shippingAddress && (
                <>
                  <p className="text-purple-800 font-medium">Shipping Address:</p>
                  <div className="text-purple-700">
                    <p className="font-medium">
                      {cart.customerInfo?.firstName} {cart.customerInfo?.lastName}
                    </p>
                    <p>{cart.shippingAddress.addressLine1}</p>
                    {cart.shippingAddress.addressLine2 && (
                      <p>{cart.shippingAddress.addressLine2}</p>
                    )}
                    <p>
                      {cart.shippingAddress.city}, {cart.shippingAddress.state} {cart.shippingAddress.postalCode}
                    </p>
                    <p>{cart.shippingAddress.country}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Store Information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Store className="h-5 w-5 text-gray-600" />
              <h4 className="font-semibold text-gray-900">Store Information</h4>
            </div>
            <div className="space-y-3">
              {/* Store Logo and Name */}
              <div className="flex items-center gap-3">
                {(cart.tenantLogo || tenantProfile?.logo_url) && (
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 flex-shrink-0">
                    <img
                      src={cart.tenantLogo || tenantProfile?.logo_url}
                      alt={cart.tenantName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="font-medium text-base">{cart.tenantName}</p>
                  <p className="text-gray-600 text-xs">Store ID: {cart.tenantId}</p>
                </div>
              </div>
              
                            
              {/* Store Address */}
              {tenantProfile?.address_line1 && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="break-words">
                      {tenantProfile.address_line1}
                      {tenantProfile.address_line2 && `, ${tenantProfile.address_line2}`}
                    </p>
                    <p className="break-words">
                      {tenantProfile.city}, {tenantProfile.state} {tenantProfile.postal_code}
                    </p>
                    <p className="break-words">{tenantProfile.country_code}</p>
                  </div>
                </div>
              )}
              
              {/* Store Phone */}
              {tenantProfile?.phone_number && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{tenantProfile.phone_number}</span>
                </div>
              )}
              
              {/* Store Email */}
              {tenantProfile?.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{tenantProfile.email}</span>
                </div>
              )}
              
              {/* Fallback placeholders if no profile data */}
              {!tenantProfile && (
                <>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>Store Location</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>Contact: (555) 123-4567</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>support@${cart.tenantName.toLowerCase().replace(/\s+/g, '-')}.com</span>
                  </div>
                </>
              )}

              {/* Store Hours - Always show for multi-store orders */}
              {businessHours && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-gray-800 font-medium mb-2">Store Hours:</p>
                  <div className="space-y-1 text-xs">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const dayHours = businessHours[day];
                      const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                      
                      // Debug logging
                      // if (day === 'Monday') {
                        // console.log('[OrderReceipt] Business hours state:', businessHours);
                        // console.log('[OrderReceipt] Monday hours:', dayHours);
                      // }
                      //  console.log(`Cart gateway 2: ${cart.gatewayType}`);
                      
                      return (
                        <div key={day} className={`flex justify-between ${isToday ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          <span>{isToday ? `${day} (Today)` : day}</span>
                          <span>
                            {dayHours ? `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}` : 'Closed'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* QR Code for Directions - Always show */}
              {directionsUrl && cart.tenantId && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-gray-800 font-medium mb-2">Get Directions:</p>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <TenantQRCode
                        url={directionsUrl}
                        tenantId={cart.tenantId}
                        size={150}
                        showDownload={false}
                        label=""
                        className="bg-transparent shadow-none p-0"
                      />
                    </div>
                    <div className="flex-1 text-xs text-gray-700">
                      <p className="font-medium mb-1">Scan for directions</p>
                      <p className="leading-relaxed">
                        {tenantProfile.address_line1}
                        {tenantProfile.address_line2 && `, ${tenantProfile.address_line2}`}
                        <br />
                        {tenantProfile.city}, {tenantProfile.state} {tenantProfile.postal_code}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
            <div className="space-y-3">
              {cart.items.map((item) => {
                const itemTotal = item.unitPrice * item.quantity;
                //  console.log(`Cart gateway 3: ${cart.gatewayType}`);
                return (
                  <div key={item.id} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium">{formatCurrency(itemTotal)}</p>
                      <p className="text-sm text-gray-600">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Summary */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-semibold text-gray-900 mb-3">Order Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(cart.subtotal)}</span>
              </div>
              {platformFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Platform Fee ({effectivePlatformFeePercentage}%)</span>
                  <span>{formatCurrency(platformFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{getFulfillmentLabel()}</span>
                <span className={fulfillmentFee === 0 ? 'text-green-600 font-semibold' : ''}>
                  {fulfillmentFee === 0 ? 'FREE' : formatCurrency(fulfillmentFee)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                <span>Order Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              
              {/* Deposit Order Info - context aware based on status */}
              {isDepositOrder && depositAmount > 0 && (
                <>
                  {isDepositForfeited ? (
                    // Forfeited deposit
                    <div className="flex justify-between text-sm pt-3 mt-3 border-t border-gray-200 bg-red-50 -mx-4 px-4 py-2 rounded">
                      <span className="text-red-800 font-medium">Deposit Forfeited</span>
                      <span className="text-red-800 font-semibold">{formatCurrency(depositAmount)}</span>
                    </div>
                  ) : cart.fulfillmentStatus === 'fulfilled' ? (
                    // Picked up - show what was paid
                    <>
                      <div className="flex justify-between text-sm pt-3 mt-3 border-t border-gray-200 bg-green-50 -mx-4 px-4 py-2 rounded">
                        <span className="text-green-800 font-medium">Deposit Paid {depositPercentageDisplay !== null ? `(${depositPercentageDisplay}%)` : ''}</span>
                        <span className="text-green-800 font-semibold">{formatCurrency(depositAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm bg-green-50 -mx-4 px-4 py-2 rounded-b">
                        <span className="text-green-700">Balance Paid at Pickup</span>
                        <span className="text-green-700 font-medium">{formatCurrency(remainingBalance)}</span>
                      </div>
                    </>
                  ) : (
                    // Pending pickup
                    <>
                      <div className="flex justify-between text-sm pt-3 mt-3 border-t border-gray-200 bg-amber-50 -mx-4 px-4 py-2 rounded">
                        <span className="text-amber-800 font-medium">Deposit Paid {depositPercentageDisplay !== null ? `(${depositPercentageDisplay}%)` : ''}</span>
                        <span className="text-amber-800 font-semibold">{formatCurrency(depositAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm bg-amber-50 -mx-4 px-4 py-2">
                        <span className="text-amber-700">Balance Due at Pickup</span>
                        <span className="text-amber-700 font-medium">{formatCurrency(remainingBalance)}</span>
                      </div>
                      {cart.pickupDeadline && (
                        <div className="text-xs text-amber-600 bg-amber-50 -mx-4 px-4 py-2 rounded-b">
                          Pickup by {new Date(cart.pickupDeadline).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} to avoid deposit forfeiture.
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Payment Information */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Payment Information</h4>
            <div className="space-y-1 text-sm">
              <p className="text-blue-700">
                <span className="font-medium">Method:</span> {cart.gatewayType ? cart.gatewayType.charAt(0).toUpperCase() + cart.gatewayType.slice(1) : 'PayPal'}
              </p>
              <p className="text-blue-700">
                <span className="font-medium">Status:</span> {cart.status.charAt(0).toUpperCase() + cart.status.slice(1)}
              </p>
              <p className="text-blue-700">
                <span className="font-medium">Transaction ID:</span> {cart.gatewayTransactionId || cart.paymentId || cart.orderId || 'Processing...'}
              </p>
            </div>
          </div>

          {/* Fulfillment Information */}
          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-2">Fulfillment Information</h4>
            <div className="space-y-1 text-sm">
              <p className="text-purple-700">
                <span className="font-medium">Method:</span> {getFulfillmentLabel()}
              </p>
              <p className="text-purple-700">
                <span className="font-medium">Status:</span>{' '}
                {cart.fulfillmentStatus === 'fulfilled' ? (
                  <span className="text-green-700 font-semibold">Picked Up</span>
                ) : cart.fulfillmentStatus === 'pending' ? (
                  <span className="text-amber-700 font-semibold">Pending</span>
                ) : cart.fulfillmentStatus ? (
                  cart.fulfillmentStatus.charAt(0).toUpperCase() + cart.fulfillmentStatus.slice(1)
                ) : (
                  'Processing'
                )}
              </p>
              {cart.fulfilledAt && (
                <p className="text-purple-700">
                  <span className="font-medium">Picked Up On:</span>{' '}
                  {new Date(cart.fulfilledAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {cart.fulfillmentMethod === 'pickup' && tenantProfile?.address_line1 && (
                <p className="text-purple-700 mt-2 pt-2 border-t border-purple-200">
                  <span className="font-medium">Pickup Location:</span>{' '}
                  {tenantProfile.address_line1}
                  {tenantProfile.address_line2 && `, ${tenantProfile.address_line2}`}
                  {`, ${tenantProfile.city}, ${tenantProfile.state} ${tenantProfile.postal_code}`}
                </p>
              )}
            </div>
          </div>

          {/* Status History Timeline */}
          {statusHistory.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">Order Timeline</h4>
              <div className="space-y-3">
                {statusHistory.map((entry, index) => (
                  <div key={entry.id || index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusBadge(entry.to_status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {entry.reason || `Status changed to ${entry.to_status}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatStatusDateTime(entry.created_at)}
                        </p>
                      </div>
                      {entry.changed_by_name && (
                        <p className="text-xs text-gray-600">
                          by {entry.changed_by_name}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-gray-600 mt-1">
                          {entry.notes}
                        </p>
                      )}
                      {entry.from_status && entry.from_status !== entry.to_status && (
                        <p className="text-xs text-gray-500">
                          Changed from {entry.from_status} to {entry.to_status}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {actions && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              {actions}
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
            <p>Thank you for your order!</p>
            <p>Questions? Contact us at support@visibleshelf.store</p>
            <p className="text-xs mt-2">Generated on {new Date().toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          @page {
            margin: 0.5in;
            size: letter;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
