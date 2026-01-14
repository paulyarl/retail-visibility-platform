'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Printer, Download, Mail, Phone, MapPin, Store, CheckCircle2, Package } from 'lucide-react';
import QRCode from 'qrcode';

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
  };
  onPrint?: () => void;
  className?: string;
}

export default function OrderReceipt({ cart, onPrint, className = "" }: OrderReceiptProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [fulfillmentSettings, setFulfillmentSettings] = useState<any>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Debug: Log cart data to see what's available
  console.log('[OrderReceipt] Cart data:', {
    customerInfo: cart.customerInfo,
    shippingAddress: cart.shippingAddress,
    tenantId: cart.tenantId,
    orderId: cart.orderId
  });
  
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
  const platformFee = Math.round(cart.subtotal * 0.03); // 3% platform fee
  const fulfillmentFee = cart.fulfillmentFee || 0;
  const total = cart.subtotal + platformFee + fulfillmentFee;
  
  const getFulfillmentLabel = () => {
    if (!cart.fulfillmentMethod) return 'Fulfillment';
    if (cart.fulfillmentMethod === 'pickup') return 'In-Store Pickup';
    if (cart.fulfillmentMethod === 'delivery') return 'Local Delivery';
    return 'Shipping';
  };

  // Fetch tenant profile and business hours
  useEffect(() => {
    const fetchTenantData = async () => {
      if (!cart.tenantId) return;
      
      setIsLoadingProfile(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        
        // Fetch tenant profile
        const profileResponse = await fetch(`${apiUrl}/public/tenant/${cart.tenantId}/profile`);
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          console.log('[OrderReceipt] Fetched tenant profile:', profile);
          setTenantProfile(profile);
        } else {
          console.error('[OrderReceipt] Failed to fetch tenant profile:', profileResponse.status);
        }

        // Fetch business hours for all orders (important for multi-store orders)
        const hoursResponse = await fetch(`${apiUrl}/api/tenant/${cart.tenantId}/business-hours`);
        if (hoursResponse.ok) {
          const hoursData = await hoursResponse.json();
          if (hoursData.success && hoursData.data) {
            const { periods, timezone } = hoursData.data;
            const hours: any = { timezone, periods };

            // Convert periods to day-based format
            const dayMap: Record<string, string> = {
              'MONDAY': 'Monday',
              'TUESDAY': 'Tuesday',
              'WEDNESDAY': 'Wednesday',
              'THURSDAY': 'Thursday',
              'FRIDAY': 'Friday',
              'SATURDAY': 'Saturday',
              'SUNDAY': 'Sunday'
            };
            
            periods.forEach((period: any) => {
              const titleCaseDay = dayMap[period.day] || period.day;
              if (titleCaseDay && !hours[titleCaseDay]) {
                hours[titleCaseDay] = {
                  open: period.open,
                  close: period.close
                };
              }
            });

            console.log('[OrderReceipt] Fetched business hours:', hours);
            setBusinessHours(hours);
          }
        }

        // Fetch fulfillment settings for pickup ready time
        const fulfillmentResponse = await fetch(`${apiUrl}/public/tenant/${cart.tenantId}/fulfillment-settings`);
        if (fulfillmentResponse.ok) {
          const fulfillmentData = await fulfillmentResponse.json();
          if (fulfillmentData.success && fulfillmentData.settings) {
            console.log('[OrderReceipt] Fetched fulfillment settings:', fulfillmentData.settings);
            setFulfillmentSettings(fulfillmentData.settings);
          }
        }
      } catch (error) {
        console.error('[OrderReceipt] Error fetching tenant data:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchTenantData();
  }, [cart.tenantId]);

  // Generate QR code for directions when profile data is available
  useEffect(() => {
    const generateDirectionsQR = async () => {
      if (!tenantProfile || !qrCanvasRef.current) return;

      // Build Google Maps directions URL from store address
      if (tenantProfile.address_line1 && tenantProfile.city && tenantProfile.state) {
        const address = `${tenantProfile.address_line1}, ${tenantProfile.city}, ${tenantProfile.state} ${tenantProfile.postal_code}`;
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

        try {
          await QRCode.toCanvas(qrCanvasRef.current, mapsUrl, {
            width: 150,
            margin: 2,
            color: {
              dark: '#7c3aed', // Purple to match fulfillment theme
              light: '#ffffff',
            },
          });
          console.log('[OrderReceipt] Generated directions QR code');
        } catch (error) {
          console.error('[OrderReceipt] Error generating QR code:', error);
        }
      }
    };

    generateDirectionsQR();
  }, [cart.fulfillmentMethod, tenantProfile]);

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
Platform Fee (3%): ${formatCurrency(platformFee)}
${getFulfillmentLabel()}: ${formatCurrency(fulfillmentFee)}
───────────────────────────────────────────────────────────
TOTAL: ${formatCurrency(total)}

═══════════════════════════════════════════════════════════════

PAYMENT INFORMATION
───────────────────────────────────────────────────────────
Payment Method: PayPal
Payment Status: ${cart.status.toUpperCase()}
Transaction ID: ${cart.gatewayTransactionId || cart.paymentId || cart.orderId || 'N/A'}

═══════════════════════════════════════════════════════════════

Thank you for your order!
Questions? Contact us at support@example.com

Generated on ${new Date().toLocaleString()}
`.trim();
  };

  if (cart.status !== 'paid' && cart.status !== 'fulfilled') {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Success Header */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Order Completed Successfully!</h3>
            <p className="text-sm text-green-700">
              Order ID: {cart.orderId || 'Processing...'}
              {cart.paidAt && ` • Paid on ${formatDate(cart.paidAt)}`}
            </p>
          </div>
        </div>
      </div>

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
                <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {cart.status.charAt(0).toUpperCase() + cart.status.slice(1)}
                </span>
              </div>
            </div>
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
                  {tenantProfile?.address_line1 && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <p className="text-purple-800 font-medium mb-2">Get Directions:</p>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <canvas 
                            ref={qrCanvasRef} 
                            className="border-2 border-purple-300 rounded-lg"
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
                      if (day === 'Monday') {
                        console.log('[OrderReceipt] Business hours state:', businessHours);
                        console.log('[OrderReceipt] Monday hours:', dayHours);
                      }
                      
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
              {tenantProfile?.address_line1 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-gray-800 font-medium mb-2">Get Directions:</p>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <canvas 
                        ref={qrCanvasRef} 
                        className="border-2 border-gray-300 rounded-lg"
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
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee (3%)</span>
                <span>{formatCurrency(platformFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{getFulfillmentLabel()}</span>
                <span className={fulfillmentFee === 0 ? 'text-green-600 font-semibold' : ''}>
                  {fulfillmentFee === 0 ? 'FREE' : formatCurrency(fulfillmentFee)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Payment Information</h4>
            <div className="space-y-1 text-sm">
              <p className="text-blue-700">
                <span className="font-medium">Method:</span> PayPal
              </p>
              <p className="text-blue-700">
                <span className="font-medium">Status:</span> {cart.status.charAt(0).toUpperCase() + cart.status.slice(1)}
              </p>
              <p className="text-blue-700">
                <span className="font-medium">Transaction ID:</span> {cart.gatewayTransactionId || cart.paymentId || cart.orderId || 'Processing...'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
            <p>Thank you for your order!</p>
            <p>Questions? Contact us at support@example.com</p>
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
