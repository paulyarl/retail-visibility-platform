'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiCart } from '@/hooks/useMultiCart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Store, ArrowRight, Trash2, ShoppingBag, CheckCircle2, Package, Receipt, Edit, ChevronDown, ChevronUp, Plus, Minus, CreditCard } from 'lucide-react';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { useCommerceCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface Gateway {
  id: string;
  gateway_type: string;
  is_active: boolean;
  is_default: boolean;
  display_name?: string;
}

interface TenantInfo {
  name: string;
  logo_url?: string;
}

export default function MultiCartPage() {
  const router = useRouter();
  const { carts, clearCart: clearSpecificCart, updateQuantity, removeItem, totalItems } = useMultiCart();
  const [expandedCart, setExpandedCart] = useState<string | null>(null);
  const [tenantGateways, setTenantGateways] = useState<Record<string, Gateway[]>>({});
  const [tenantInfo, setTenantInfo] = useState<Record<string, TenantInfo>>({});
  const [tenantCommerceState, setTenantCommerceState] = useState<Record<string, { enabled: boolean; cartVisible: boolean }>>({});

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const toggleCartExpanded = (cartKey: string) => {
    setExpandedCart(expandedCart === cartKey ? null : cartKey);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Paid
          </div>
        );
      case 'fulfilled':
        return (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            <Package className="h-4 w-4" />
            Fulfilled
          </div>
        );
      default:
        return null;
    }
  };

  const handleCheckout = (tenantId: string, gatewayType: string) => {
    router.push(`/checkout?tenantId=${tenantId}&gatewayType=${gatewayType}`);
  };

  // Fetch tenant info (name, logo), available gateways, and commerce capability for each tenant
  useEffect(() => {
    const fetchTenantData = async () => {
      const tenantIds = [...new Set(carts.map(c => c.cart.tenant_id))];
      const gatewayData: Record<string, Gateway[]> = {};
      const tenantInfoData: Record<string, TenantInfo> = {};
      const commerceData: Record<string, { enabled: boolean; cartVisible: boolean }> = {};

      // Lazy-load the service to avoid circular import issues
      const { CapabilityResolutionService } = await import('@/services/CapabilityResolutionService');
      const capService = CapabilityResolutionService.getInstance();
      
      for (const tenantId of tenantIds) {
        try {
          // Fetch gateways, tenant profile, and commerce capability in parallel
          const [gateways, profile, commerceState] = await Promise.all([
            publicTenantInfoService.getPaymentGateways(tenantId),
            publicTenantInfoService.getTenantProfile(tenantId).catch(() => null),
            capService.getCommerceState(tenantId).catch(() => null)
          ]);
          
          gatewayData[tenantId] = gateways.filter((g: Gateway) => g.is_active);
          
          if (profile) {
            const data = (profile as any).data || profile;
            tenantInfoData[tenantId] = {
              name: data.name || data.business_name || tenantId,
              logo_url: data.logo_url || data.logoUrl
            };
          } else {
            tenantInfoData[tenantId] = {
              name: tenantId
            };
          }

          // Store commerce capability state
          if (commerceState) {
            commerceData[tenantId] = {
              enabled: commerceState.enabled,
              cartVisible: commerceState.cartVisible,
            };
          } else {
            // Fallback: if capability fetch fails, assume commerce is enabled
            commerceData[tenantId] = { enabled: true, cartVisible: true };
          }
        } catch (err) {
          console.warn(`Failed to fetch data for tenant ${tenantId}:`, err);
          gatewayData[tenantId] = [];
          tenantInfoData[tenantId] = { name: tenantId };
          commerceData[tenantId] = { enabled: true, cartVisible: true };
        }
      }
      
      setTenantGateways(gatewayData);
      setTenantInfo(tenantInfoData);
      setTenantCommerceState(commerceData);
    };
    
    if (carts.length > 0) {
      fetchTenantData();
    }
  }, [carts]);

  const handleClearCart = (tenantId: string) => {
    if (!confirm('Remove all items from this cart?')) {
      return;
    }
    clearSpecificCart(tenantId);
  };

  if (carts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No active carts</h2>
                <p className="text-gray-600 mb-6">
                  Start shopping from your favorite local stores!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => router.push('/directory')}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Browse Stores
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/my-orders')}>
                    <Receipt className="mr-2 h-4 w-4" />
                    My Orders
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalAcrossAllCarts = carts.reduce((sum, cartSummary) => sum + cartSummary.total_cents, 0);
  // console.log(`All carts: ${JSON.stringify(carts)}`);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Shopping Carts</h1>
          <p className="text-gray-600">
            {carts.length} {carts.length === 1 ? 'cart' : 'carts'} • {totalItems} items
          </p>
        </div>

        {/* Summary Card */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total across all carts</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalAcrossAllCarts)}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {carts.length} {carts.length === 1 ? 'cart' : 'carts'} • {totalItems} items
                </p>
              </div>
              <ShoppingCart className="h-12 w-12 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Cart List - One cart per tenant */}
        <div className="space-y-6">
          {carts.map((cartSummary) => {
            const { cart, item_count, total_cents } = cartSummary;
            const availableGateways = tenantGateways[cart.tenant_id] || [];
            const isExpanded = expandedCart === cartSummary.key;
            const info = tenantInfo[cart.tenant_id];
            const displayName = info?.name || cart.tenant_name;
            const displayLogo = info?.logo_url || cart.tenant_logo;
            const commerceState = tenantCommerceState[cart.tenant_id];
            const commerceDisabled = commerceState && !commerceState.enabled;
            
            return (
              <Card key={cartSummary.key} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  {/* Tenant Header */}
                  <div className="flex items-start gap-4 mb-4 pb-4 border-b">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {displayLogo ? (
                        <img
                          src={displayLogo}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
                      <p className="text-sm text-gray-600">
                        {item_count} {item_count === 1 ? 'item' : 'items'} · {formatCurrency(total_cents)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(total_cents)}</p>
                    </div>
                  </div>
                  
                  {/* Payment Options — gated by commerce capability */}
                  {commerceDisabled ? (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800 font-medium">
                        Online checkout is not available for this store.
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Please contact the store directly to arrange purchase.
                      </p>
                    </div>
                  ) : availableGateways.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Choose Payment Method:</p>
                      <div className="flex flex-wrap gap-2">
                        {availableGateways.map(gateway => (
                          <Button
                            key={gateway.id}
                            onClick={() => handleCheckout(cart.tenant_id, gateway.gateway_type)}
                            variant="gradient"
                            style={{ color: 'white' }}
                            className={gateway.is_default ? 'bg-black hover:bg-gray-800' : 'bg-blue-600 hover:bg-blue-700'}
                          >
                            {gateway.gateway_type === 'square' ? (
                              <div className="w-5 h-5 bg-white rounded flex items-center justify-center mr-2">
                                <CreditCard className="w-3 h-3 text-black" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 bg-white rounded flex items-center justify-center mr-2">
                                <CreditCard className="w-3 h-3 text-blue-600" />
                              </div>
                            )}
                            Checkout with {gateway.display_name || (gateway.gateway_type === 'square' ? 'Square' : 'PayPal')}
                            {gateway.is_default && <span className="ml-2 text-xs opacity-75">(Default)</span>}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Cart Items */}
                  <div className="space-y-3">
                    {/* Item Preview */}
                    {!isExpanded && (
                      <div className="space-y-1">
                        {cart.items.slice(0, 3).map((item) => (
                          <p key={item.product_id} className="text-sm text-gray-600 truncate">
                            {item.quantity}x {item.product_name}
                            {item.variant_name && <span className="text-gray-400"> ({item.variant_name})</span>}
                          </p>
                        ))}
                        {cart.items.length > 3 && (
                          <p className="text-sm text-gray-500">
                            +{cart.items.length - 3} more items
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Edit Controls */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCartExpanded(cartSummary.key)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        {isExpanded ? 'Hide Details' : 'Edit Cart'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearCart(cart.tenant_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Clear Cart
                      </Button>
                    </div>
                    
                    {/* Expandable Cart Items */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {cart.items.map((item) => (
                          <div key={`${item.product_id}-${item.variant_id || 'default'}`} className="flex items-center gap-3 bg-white p-3 rounded border">
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.product_image ? (
                                <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingBag className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                              {item.variant_name && (
                                <p className="text-xs text-gray-500">{item.variant_name}</p>
                              )}
                              <p className="text-xs text-gray-600">{formatCurrency(item.price_cents)} each</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(cart.tenant_id, item.product_id, item.quantity - 1, item.variant_id)}
                                disabled={item.quantity <= 1}
                                className="h-7 w-7 p-0"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm">{item.quantity}</span>
                              {item.stock !== undefined && item.stock > 0 && (
                                <span className="text-xs text-gray-400">/{item.stock}</span>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const maxStock = item.stock ?? Infinity;
                                  if (item.quantity >= maxStock) {
                                    alert(`Cannot add more. Only ${maxStock} available in stock.`);
                                    return;
                                  }
                                  updateQuantity(cart.tenant_id, item.product_id, item.quantity + 1, item.variant_id);
                                }}
                                disabled={item.stock !== undefined && item.quantity >= item.stock}
                                className="h-7 w-7 p-0"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm font-medium w-16 text-right">{formatCurrency(item.price_cents * item.quantity)}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(cart.tenant_id, item.product_id, item.variant_id)}
                              className="text-red-600 h-7 w-7 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/tenant/${cart.tenant_id}`)}
                          className="w-full mt-2"
                        >
                          <Store className="mr-1 h-3 w-3" />
                          Add More Items from {cart.tenant_name}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Continue Shopping */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            size="lg"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            Continue Shopping
          </Button>
        </div>
      </div>
      
      {/* Powered By Footer */}
      <PoweredByFooter />
    </div>
  );
}
