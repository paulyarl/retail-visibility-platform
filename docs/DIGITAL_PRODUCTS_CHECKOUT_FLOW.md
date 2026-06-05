# Digital Products Checkout Flow Implementation Plan

## Overview

This plan implements a comprehensive checkout flow for digital products, integrating with the digital products system to provide seamless purchase experiences for digital, hybrid, and physical products. The flow handles cart management, checkout validation, payment processing, and immediate digital access grant creation.

## Digital Products Plan Audit - Identified Gaps

### Critical Gaps in Current Plan

#### 1. **Cart & Checkout Integration (Major Gap)**
- **Missing**: Cart handling for digital products
- **Missing**: Checkout validation for mixed carts (physical + digital)
- **Missing**: Payment flow integration with digital product access
- **Missing**: Real-time access grant creation on payment success

#### 2. **Customer Experience Gaps**
- **Missing**: Product page digital product indicators
- **Missing**: Cart digital product badges and warnings
- **Missing**: Checkout flow adjustments for digital-only carts
- **Missing**: Immediate download access after payment

#### 3. **Account & Order Management Gaps**
- **Missing**: Customer account digital download section
- **Missing**: Order history digital product management
- **Missing**: Download access tracking in customer dashboard
- **Missing**: License key management interface

#### 4. **Email & Notification Gaps**
- **Missing**: Digital product purchase email templates
- **Missing**: Access expiration reminder emails
- **Missing**: Download limit warning notifications
- **Missing**: License key delivery emails

#### 5. **Backend Service Gaps**
- **Missing**: Cart service digital product handling
- **Missing**: Checkout service digital validation
- **Missing**: Payment webhook digital access hooks
- **Missing**: Customer service digital download management

#### 6. **Frontend Component Gaps**
- **Missing**: Digital product cart items
- **Missing**: Checkout digital product summary
- **Missing**: Payment success digital access display
- **Missing**: Customer download management interface

---

## Phase 1: Cart Integration

### 1.1 Cart Service Enhancement

**File:** `apps/web/src/services/CartService.ts`

**Current State:** Handles physical products only

**Enhancements:**
```typescript
interface CartItem {
  // Existing fields...
  id: string;
  name: string;
  price: number;
  quantity: number;
  
  // Digital product fields
  productType: 'physical' | 'digital' | 'hybrid';
  isDigitalOnly: boolean;
  digitalDeliveryMethod?: string;
  requiresDownloadPage: boolean;
  hasDigitalComponent: boolean;
}

interface Cart {
  items: CartItem[];
  
  // New computed properties
  hasPhysicalItems: boolean;
  hasDigitalItems: boolean;
  isDigitalOnlyCart: boolean;
  isMixedCart: boolean;
  
  // Shipping validation
  requiresShipping: boolean;
  shippingAddressRequired: boolean;
}

class CartService extends AuthenticatedApiSingleton {
  // Existing methods...
  
  // Digital product validation
  validateDigitalItem(itemId: string): Promise<ValidationResult>;
  checkDownloadPageAvailability(itemId: string): Promise<boolean>;
  
  // Cart type detection
  getCartType(): 'physical' | 'digital' | 'mixed';
  requiresShipping(): boolean;
  
  // Mixed cart handling
  validateMixedCart(): Promise<MixedCartValidation>;
  getShippingRequirements(): ShippingRequirements;
}
```

### 1.2 Cart Component Updates

**File:** `apps/web/src/components/cart/CartItem.tsx`

**Enhancements:**
```typescript
interface CartItemProps {
  item: CartItem;
  onUpdate?: (item: CartItem) => void;
  onRemove?: (itemId: string) => void;
}

// Digital product indicators
{item.productType !== 'physical' && (
  <div className="flex items-center gap-2 mb-2">
    <Badge variant={item.isDigitalOnly ? 'digital' : 'hybrid'}>
      {item.isDigitalOnly ? 'Digital' : 'Hybrid'}
    </Badge>
    {item.isDigitalOnly && (
      <span className="text-sm text-gray-600">
        📥 Instant download
      </span>
    )}
  </div>
)}

// Delivery method display
{item.digitalDeliveryMethod && (
  <div className="text-xs text-gray-500">
    Delivery: {item.digitalDeliveryMethod.replace('_', ' ')}
  </div>
)}
```

### 1.3 Cart Summary Updates

**File:** `apps/web/src/components/cart/CartSummary.tsx`

**Enhancements:**
```typescript
// Digital cart indicators
{cart.isDigitalOnlyCart && (
  <Alert>
    <Download className="h-4 w-4" />
    <AlertDescription>
      This order contains only digital products. No shipping required.
    </AlertDescription>
  </Alert>
)}

{cart.isMixedCart && (
  <Alert>
    <Package className="h-4 w-4" />
    <AlertDescription>
      This order contains both physical and digital products.
      Shipping address required for physical items.
    </AlertDescription>
  </Alert>
)}

// Shipping section conditional display
{cart.requiresShipping && (
  <ShippingSection />
)}
```

---

## Phase 2: Checkout Flow Integration

### 2.1 Checkout Service Enhancement

**File:** `apps/web/src/services/CheckoutService.ts`

**Enhancements:**
```typescript
interface CheckoutRequest {
  // Existing fields...
  items: CartItem[];
  shippingAddress?: Address;
  billingAddress: Address;
  paymentMethod: PaymentMethod;
  
  // Digital product fields
  cartType: 'physical' | 'digital' | 'mixed';
  skipShipping: boolean;
  createDigitalAccess: boolean;
}

interface CheckoutResponse {
  // Existing fields...
  order: Order;
  
  // Digital product fields
  digitalAccessGrants?: DigitalAccessGrant[];
  downloadUrls?: string[];
  licenseKeys?: LicenseKey[];
  immediateDownloads: boolean;
}

class CheckoutService extends AuthenticatedApiSingleton {
  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    // Validate cart type
    if (request.cartType === 'digital' && request.shippingAddress) {
      throw new Error('Shipping address not required for digital orders');
    }
    
    // Process checkout
    const order = await this.processOrder(request);
    
    // Create digital access for digital items
    if (request.createDigitalAccess) {
      const accessGrants = await this.createDigitalAccess(order);
      return {
        ...order,
        digitalAccessGrants: accessGrants,
        downloadUrls: accessGrants.map(g => g.downloadUrl),
        immediateDownloads: true
      };
    }
    
    return order;
  }
  
  private async createDigitalAccess(order: Order): Promise<DigitalAccessGrant[]> {
    // Call digital access creation service
    return await digitalAccessService.createAccessGrants(order);
  }
}
```

### 2.2 Checkout Page Updates

**File:** `apps/web/src/app/checkout/page.tsx`

**Enhancements:**
```typescript
// Cart type detection
const cartType = cartService.getCartType();
const requiresShipping = cartService.requiresShipping();

// Conditional shipping section
{requiresShipping && (
  <ShippingSection 
    address={shippingAddress}
    onChange={setShippingAddress}
  />
)}

// Digital cart notice
{cartType === 'digital' && (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 text-green-600" />
        <div>
          <h3 className="font-semibold">Digital Order</h3>
          <p className="text-sm text-gray-600">
            No shipping required. Instant access after payment.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}

// Mixed cart notice
{cartType === 'mixed' && (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        <Package className="h-5 w-5 text-blue-600" />
        <div>
          <h3 className="font-semibold">Mixed Order</h3>
          <p className="text-sm text-gray-600">
            Physical items will be shipped. Digital items available immediately.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

### 2.3 Payment Processing Integration

**File:** `apps/api/src/services/PaymentProcessingService.ts`

**Enhancements:**
```typescript
interface PaymentSuccessHook {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

class PaymentProcessingService {
  async handlePaymentSuccess(hook: PaymentSuccessHook): Promise<void> {
    // Update order status
    await this.updateOrderStatus(hook.orderId, 'completed');
    
    // Create digital access for digital items
    await this.createDigitalAccessIfNeeded(hook.orderId);
    
    // Send notifications
    await this.sendOrderConfirmation(hook.orderId);
    await this.sendDigitalAccessEmails(hook.orderId);
  }
  
  private async createDigitalAccessIfNeeded(orderId: string): Promise<void> {
    const order = await getOrderWithItems(orderId);
    const digitalItems = order.items.filter(item => 
      item.product_type === 'digital' || item.product_type === 'hybrid'
    );
    
    if (digitalItems.length > 0) {
      await digitalAccessService.createAccessGrantsForOrder(order);
    }
  }
}
```

---

## Phase 3: Order Confirmation & Immediate Access

### 3.1 Order Confirmation Page Enhancement

**File:** `apps/web/src/app/t/[tenantId]/orders/[orderId]/page.tsx`

**Enhancements:**
```typescript
interface OrderConfirmationPageProps {
  orderId: string;
  tenantId: string;
}

export default function OrderConfirmationPage({ orderId, tenantId }: OrderConfirmationPageProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [digitalAccess, setDigitalAccess] = useState<DigitalAccess[]>([]);
  
  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);
  
  const loadOrderDetails = async () => {
    const orderData = await ordersService.getOrder(tenantId, orderId);
    setOrder(orderData);
    
    // Load digital access if applicable
    if (hasDigitalItems(orderData)) {
      const accessData = await digitalAccessService.getOrderAccess(orderId);
      setDigitalAccess(accessData);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Order confirmation */}
      <OrderConfirmationSection order={order} />
      
      {/* Digital products section */}
      {digitalAccess.length > 0 && (
        <DigitalProductsSection 
          accessGrants={digitalAccess}
          order={order}
        />
      )}
      
      {/* Physical items shipping info */}
      {hasPhysicalItems(order) && (
        <ShippingSection order={order} />
      )}
    </div>
  );
}

// Digital products section component
function DigitalProductsSection({ accessGrants, order }: DigitalProductsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Digital Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {accessGrants.map(grant => (
            <DigitalAccessCard
              key={grant.id}
              grant={grant}
              orderItem={order.items.find(item => item.id === grant.itemId)}
            />
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold mb-2">Important</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Download links have been sent to your email</li>
            <li>• Access expires {formatExpiration(grant.accessExpiresAt)}</li>
            <li>• Save this page for future downloads</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function DigitalAccessCard({ grant, orderItem }: DigitalAccessCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{orderItem.name}</h4>
          <p className="text-sm text-gray-600">
            {grant.deliveryMethod.replace('_', ' ')}
          </p>
        </div>
        <Badge variant="secondary">
          {grant.licenseKey ? 'License Required' : 'Ready to Download'}
        </Badge>
      </div>
      
      {/* Download links */}
      <div className="space-y-2">
        {grant.assets.map(asset => (
          <div key={asset.id} className="flex items-center justify-between">
            <span className="text-sm">{asset.name}</span>
            <Button size="sm" asChild>
              <Link href={`/download/${grant.accessToken}`}>
                Download
              </Link>
            </Button>
          </div>
        ))}
      </div>
      
      {/* License key */}
      {grant.licenseKey && (
        <div className="p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Key className="h-4 w-4" />
            <span className="font-semibold text-sm">License Key</span>
          </div>
          <code className="text-sm bg-white px-2 py-1 rounded">
            {grant.licenseKey}
          </code>
          <p className="text-xs text-gray-600 mt-1">
            Keep this key safe. It's required for activation.
          </p>
        </div>
      )}
      
      {/* Access info */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>Downloads remaining: {grant.downloadsRemaining || 'Unlimited'}</div>
        {grant.accessExpiresAt && (
          <div>Access expires: {formatDate(grant.accessExpiresAt)}</div>
        )}
      </div>
    </div>
  );
}
```

### 3.2 Immediate Access Modal

**File:** `apps/web/src/components/modals/ImmediateAccessModal.tsx`

**Purpose:** Show immediate download access after payment

```typescript
interface ImmediateAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  digitalAccess: DigitalAccess[];
  orderId: string;
}

export default function ImmediateAccessModal({ 
  isOpen, 
  onClose, 
  digitalAccess, 
  orderId 
}: ImmediateAccessModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-green-600" />
            Your Digital Products Are Ready!
          </DialogTitle>
          <DialogDescription>
            Your payment was successful. You can now access your digital products.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {digitalAccess.map(grant => (
            <ImmediateAccessCard key={grant.id} grant={grant} />
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button asChild>
            <Link href={`/t/${tenantId}/orders/${orderId}`}>
            View Order Details
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Phase 4: Customer Account Integration

### 4.1 Customer Download Dashboard

**File:** `apps/web/src/app/t/[tenantId]/account/downloads/page.tsx`

**Purpose:** Central hub for customer's digital downloads

```typescript
export default function CustomerDownloadsPage() {
  const [downloads, setDownloads] = useState<DigitalAccess[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Downloads</h1>
        <p className="text-gray-600">
          Access all your purchased digital products
        </p>
      </div>
      
      {/* Filters */}
      <div className="flex gap-2">
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All ({downloads.length})
        </Button>
        <Button 
          variant={filter === 'active' ? 'default' : 'outline'}
          onClick={() => setFilter('active')}
        >
          Active ({activeDownloads.length})
        </Button>
        <Button 
          variant={filter === 'expired' ? 'default' : 'outline'}
          onClick={() => setFilter('expired')}
        >
          Expired ({expiredDownloads.length})
        </Button>
      </div>
      
      {/* Downloads grid */}
      <div className="grid gap-4">
        {filteredDownloads.map(download => (
          <DownloadCard key={download.id} download={download} />
        ))}
      </div>
      
      {filteredDownloads.length === 0 && (
        <EmptyState>
          <Download className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No downloads found</h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? "You haven't purchased any digital products yet."
              : `No ${filter} downloads found.`
            }
          </p>
        </EmptyState>
      )}
    </div>
  );
}

function DownloadCard({ download }: { download: DigitalAccess }) {
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold">{download.itemName}</h3>
            <p className="text-sm text-gray-600 mb-3">
              Purchased {formatDate(download.accessGrantedAt)}
            </p>
            
            {/* Status */}
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={download.isActive ? 'default' : 'secondary'}>
                {download.isActive ? 'Active' : 'Expired'}
              </Badge>
              {download.licenseKey && (
                <Badge variant="outline">
                  License Required
                </Badge>
              )}
            </div>
            
            {/* Access info */}
            <div className="text-sm text-gray-600 space-y-1">
              {download.downloadsRemaining !== null && (
                <div>
                  Downloads remaining: {download.downloadsRemaining}
                </div>
              )}
              {download.accessExpiresAt && (
                <div>
                  Expires: {formatDate(download.accessExpiresAt)}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href={`/download/${download.accessToken}`}>
                Download
              </Link>
            </Button>
            
            {download.licenseKey && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowLicenseKey(!showLicenseKey)}
              >
                <Key className="h-4 w-4 mr-2" />
                License Key
              </Button>
            )}
          </div>
        </div>
        
        {/* License key reveal */}
        {showLicenseKey && download.licenseKey && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-4 w-4" />
              <span className="font-semibold text-sm">Your License Key</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-white px-2 py-1 rounded">
                {download.licenseKey}
              </code>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => copyToClipboard(download.licenseKey)}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Keep this key safe. It's required for product activation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.2 Order History Enhancement

**File:** `apps/web/src/app/t/[tenantId]/account/orders/page.tsx`

**Enhancements:**
```typescript
function OrderCard({ order }: { order: Order }) {
  const hasDigitalItems = order.items.some(item => 
    item.product_type === 'digital' || item.product_type === 'hybrid'
  );
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">Order #{order.id.slice(-8)}</h3>
            <p className="text-sm text-gray-600">
              {formatDate(order.created_at)} • {formatCurrency(order.total)}
            </p>
            
            {/* Digital indicator */}
            {hasDigitalItems && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Contains Digital Products
                </Badge>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/t/${tenantId}/orders/${order.id}`}>
                View Details
              </Link>
            </Button>
            
            {hasDigitalItems && (
              <Button size="sm" asChild>
                <Link href={`/t/${tenantId}/downloads`}>
                  View Downloads
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Phase 5: Email Templates & Notifications

### 5.1 Order Confirmation Email Enhancement

**File:** `apps/api/src/templates/emails/order-confirmation.tsx`

**Enhancements:**
```typescript
interface OrderConfirmationEmailProps {
  order: Order;
  customer: Customer;
  digitalAccess?: DigitalAccess[];
}

export default function OrderConfirmationEmail({ 
  order, 
  customer, 
  digitalAccess 
}: OrderConfirmationEmailProps) {
  const hasDigitalItems = digitalAccess && digitalAccess.length > 0;
  
  return (
    <Html>
      <Head />
      <Preview>Your order confirmation and digital downloads</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <h1>Order Confirmation</h1>
            <p>Thank you for your purchase!</p>
          </Section>
          
          {/* Order details */}
          <Section style={section}>
            <h2>Order Details</h2>
            <Text>Order #{order.id.slice(-8)}</Text>
            <Text>{formatDate(order.created_at)}</Text>
            <Text>Total: {formatCurrency(order.total)}</Text>
          </Section>
          
          {/* Digital products section */}
          {hasDigitalItems && (
            <Section style={digitalSection}>
              <h2>📥 Your Digital Products</h2>
              <Text>
                Your digital products are ready for immediate download!
              </Text>
              
              {digitalAccess.map(grant => (
                <div key={grant.id} style={digitalProduct}>
                  <h3>{grant.itemName}</h3>
                  
                  {/* Download links */}
                  <div style={downloadLinks}>
                    {grant.assets.map(asset => (
                      <Link
                        key={asset.id}
                        href={`${process.env.WEB_URL}/download/${grant.accessToken}`}
                        style={downloadLink}
                      >
                        Download {asset.name}
                      </Link>
                    ))}
                  </div>
                  
                  {/* License key */}
                  {grant.licenseKey && (
                    <div style={licenseSection}>
                      <h4>License Key</h4>
                      <code style={licenseKey}>{grant.licenseKey}</code>
                      <Text style={licenseNote}>
                        Save this key for product activation
                      </Text>
                    </div>
                  )}
                  
                  {/* Access info */}
                  <div style={accessInfo}>
                    {grant.downloadsRemaining !== null && (
                      <Text>
                        Downloads remaining: {grant.downloadsRemaining}
                      </Text>
                    )}
                    {grant.accessExpiresAt && (
                      <Text>
                        Access expires: {formatDate(grant.accessExpiresAt)}
                      </Text>
                    )}
                  </div>
                </div>
              ))}
              
              <div style={accessNote}>
                <Text>
                  All download links and access information have been saved to 
                  your account for future access.
                </Text>
              </div>
            </Section>
          )}
          
          {/* Physical items shipping */}
          {hasPhysicalItems(order) && (
            <Section style={section}>
              <h2>📦 Shipping Information</h2>
              <Text>Your physical items will be shipped to:</Text>
              <AddressBlock address={order.shipping_address} />
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const digitalSection = {
  backgroundColor: '#f0f9ff',
  padding: '20px',
  borderRadius: '8px',
  border: '1px solid #0ea5e9'
};

const digitalProduct = {
  backgroundColor: 'white',
  padding: '16px',
  borderRadius: '6px',
  marginBottom: '16px'
};

const downloadLinks = {
  margin: '12px 0'
};

const downloadLink = {
  display: 'inline-block',
  backgroundColor: '#0ea5e9',
  color: 'white',
  padding: '8px 16px',
  borderRadius: '4px',
  textDecoration: 'none',
  marginRight: '8px',
  marginBottom: '8px'
};

const licenseSection = {
  backgroundColor: '#fef3c7',
  padding: '12px',
  borderRadius: '4px',
  margin: '12px 0'
};

const licenseKey = {
  backgroundColor: 'white',
  padding: '4px 8px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '14px'
};

const licenseNote = {
  fontSize: '12px',
  color: '#666',
  marginTop: '4px'
};
```

### 5.2 Access Expiration Reminder Email

**File:** `apps/api/src/templates/emails/access-expiration-reminder.tsx`

```typescript
interface AccessExpirationReminderProps {
  customer: Customer;
  expiringAccess: DigitalAccess[];
}

export default function AccessExpirationReminderEmail({ 
  customer, 
  expiringAccess 
}: AccessExpirationReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>Your digital product access is expiring soon</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <h1>⚠️ Access Expiring Soon</h1>
            <p>Some of your digital product access will expire soon.</p>
          </Section>
          
          <Section style={section}>
            <h2>Expiring Downloads</h2>
            
            {expiringAccess.map(access => (
              <div key={access.id} style={expiringItem}>
                <h3>{access.itemName}</h3>
                <Text>
                  Expires in {Math.ceil(daysUntilExpiration(access.accessExpiresAt))} days
                </Text>
                <Text>
                  Downloads remaining: {access.downloadsRemaining || 'Unlimited'}
                </Text>
                
                <Button style={downloadButton} href={`${process.env.WEB_URL}/download/${access.accessToken}`}>
                  Download Now
                </Button>
              </div>
            ))}
            
            <div style={reminderNote}>
              <Text>
                Download your files before they expire. Once expired, 
                you'll need to repurchase the product to regain access.
              </Text>
            </div>
          </Section>
          
          <Section style={section}>
            <Text>
              Questions? Contact our support team at support@example.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### 5.3 Download Limit Warning Email

**File:** `apps/api/src/templates/emails/download-limit-warning.tsx`

```typescript
interface DownloadLimitWarningProps {
  customer: Customer;
  limitedAccess: DigitalAccess[];
}

export default function DownloadLimitWarningEmail({ 
  customer, 
  limitedAccess 
}: DownloadLimitWarningProps) {
  return (
    <Html>
      <Head />
      <Preview>You're running out of downloads</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <h1>📊 Download Limit Warning</h1>
            <p>You're running low on remaining downloads.</p>
          </Section>
          
          <Section style={section}>
            <h2>Low Download Count</h2>
            
            {limitedAccess.map(access => (
              <div key={access.id} style={warningItem}>
                <h3>{access.itemName}</h3>
                <Text>
                  Only {access.downloadsRemaining} downloads remaining
                </Text>
                <Text>
                  Total downloads: {access.downloadCount}
                </Text>
                
                <Button style={downloadButton} href={`${process.env.WEB_URL}/download/${access.accessToken}`}>
                  Download Now
                </Button>
              </div>
            ))}
            
            <div style={warningNote}>
              <Text>
                Make sure to download all your files before you run out of downloads.
                Consider backing up your files to avoid losing access.
              </Text>
            </div>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Phase 6: Backend Services & Webhooks

### 6.1 Digital Access Service

**File:** `apps/api/src/services/DigitalAccessService.ts`

```typescript
class DigitalAccessService {
  async createAccessGrantsForOrder(order: Order): Promise<DigitalAccessGrant[]> {
    const grants: DigitalAccessGrant[] = [];
    
    for (const item of order.items) {
      if (item.product_type === 'digital' || item.product_type === 'hybrid') {
        const grant = await this.createAccessGrant(order, item);
        grants.push(grant);
        
        // Update order item with download URL
        await prisma.order_items.update({
          where: { id: item.order_item_id },
          data: {
            download_url: `${process.env.WEB_URL}/download/${grant.access_token}`
          }
        });
      }
    }
    
    return grants;
  }
  
  private async createAccessGrant(order: Order, item: OrderItem): Promise<DigitalAccessGrant> {
    // Get download page for item
    const downloadPage = await this.getDownloadPageForItem(item.id);
    
    // Generate access token
    const accessToken = crypto.randomUUID();
    
    // Calculate expiration
    const accessExpiresAt = item.access_duration_days 
      ? new Date(Date.now() + item.access_duration_days * 24 * 60 * 60 * 1000)
      : null;
    
    // Generate license key if needed
    const licenseKey = item.digital_delivery_method === 'license_key'
      ? this.generateLicenseKey(item.license_type)
      : null;
    
    // Create access grant
    const grant = await prisma.download_access_grants.create({
      data: {
        tenant_id: order.tenant_id,
        download_page_id: downloadPage?.id,
        item_id: item.id,
        customer_id: order.customer_id,
        customer_email: order.customer_email,
        order_id: order.id,
        order_item_id: item.order_item_id,
        access_token: accessToken,
        access_granted_at: new Date(),
        access_expires_at: accessExpiresAt,
        max_downloads: item.download_limit,
        license_key: licenseKey,
        status: 'active'
      }
    });
    
    // Send immediate access notification
    await this.sendImmediateAccessNotification(grant, order);
    
    return grant;
  }
  
  async sendImmediateAccessNotification(grant: DigitalAccessGrant, order: Order): Promise<void> {
    // Send email with download links
    await emailService.sendTemplate('digital-access-granted', {
      to: order.customer_email,
      data: {
        customer: order.customer,
        order,
        accessGrants: [grant]
      }
    });
    
    // Schedule expiration reminder (if applicable)
    if (grant.access_expires_at) {
      await this.scheduleExpirationReminder(grant);
    }
  }
  
  private async scheduleExpirationReminder(grant: DigitalAccessGrant): Promise<void> {
    const reminderDate = new Date(grant.access_expires_at);
    reminderDate.setDate(reminderDate.getDate() - 7); // 7 days before expiration
    
    await schedulerService.scheduleJob({
      type: 'access-expiration-reminder',
      executeAt: reminderDate,
      data: {
        grantId: grant.id,
        customerEmail: grant.customer_email
      }
    });
  }
}
```

### 6.2 Payment Webhook Enhancement

**File:** `apps/api/src/webhooks/payment-webhook.ts`

```typescript
export async function handlePaymentWebhook(event: PaymentEvent): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data);
      break;
    default:
      console.log(`Unhandled webhook event: ${event.type}`);
  }
}

async function handlePaymentSuccess(data: PaymentSuccessData): Promise<void> {
  const order = await getOrderFromPaymentIntent(data.paymentIntentId);
  
  if (!order) {
    throw new Error('Order not found for payment intent');
  }
  
  // Update order status
  await prisma.orders.update({
    where: { id: order.id },
    data: { status: 'completed', completed_at: new Date() }
  });
  
  // Create digital access for digital items
  const digitalAccess = await digitalAccessService.createAccessGrantsForOrder(order);
  
  // Send order confirmation
  await emailService.sendTemplate('order-confirmation', {
    to: order.customer_email,
    data: {
      customer: order.customer,
      order,
      digitalAccess
    }
  });
  
  // Trigger real-time notification (if customer is online)
  if (order.customer_id) {
    await realtimeService.notifyCustomer(order.customer_id, {
      type: 'order-completed',
      data: {
        orderId: order.id,
        hasDigitalProducts: digitalAccess.length > 0,
        immediateAccess: digitalAccess.length > 0
      }
    });
  }
}
```

### 6.3 Customer Service Integration

**File:** `apps/web/src/services/CustomerService.ts`

```typescript
class CustomerService extends AuthenticatedApiSingleton {
  // Digital download management
  async getCustomerDownloads(customerId: string): Promise<DigitalAccess[]> {
    return await this.makeRequest('GET', `/customers/${customerId}/downloads`);
  }
  
  async getDownloadDetails(customerId: string, accessToken: string): Promise<DigitalAccess> {
    return await this.makeRequest('GET', `/customers/${customerId}/downloads/${accessToken}`);
  }
  
  async revokeAccess(customerId: string, grantId: string, reason: string): Promise<void> {
    return await this.makeRequest('POST', `/customers/${customerId}/downloads/${grantId}/revoke`, {
      reason
    });
  }
  
  async extendAccess(customerId: string, grantId: string, additionalDays: number): Promise<DigitalAccess> {
    return await this.makeRequest('POST', `/customers/${customerId}/downloads/${grantId}/extend`, {
      additionalDays
    });
  }
  
  async resetDownloadLimit(customerId: string, grantId: string, newLimit: number): Promise<DigitalAccess> {
    return await this.makeRequest('POST', `/customers/${customerId}/downloads/${grantId}/reset-limit`, {
      newLimit
    });
  }
  
  // License key management
  async regenerateLicenseKey(customerId: string, grantId: string): Promise<{ licenseKey: string }> {
    return await this.makeRequest('POST', `/customers/${customerId}/downloads/${grantId}/regenerate-key`);
  }
  
  async deactivateLicenseKey(customerId: string, grantId: string): Promise<void> {
    return await this.makeRequest('POST', `/customers/${customerId}/downloads/${grantId}/deactivate-key`);
  }
}
```

---

## Phase 7: Frontend Components & UI

### 7.1 Digital Product Badge Component

**File:** `apps/web/src/components/products/DigitalProductBadge.tsx`

```typescript
interface DigitalProductBadgeProps {
  productType: 'physical' | 'digital' | 'hybrid';
  deliveryMethod?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export default function DigitalProductBadge({ 
  productType, 
  deliveryMethod, 
  size = 'sm',
  showIcon = true 
}: DigitalProductBadgeProps) {
  if (productType === 'physical') return null;
  
  const getBadgeProps = () => {
    switch (productType) {
      case 'digital':
        return {
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 border-green-200',
          icon: Download,
          text: 'Digital'
        };
      case 'hybrid':
        return {
          variant: 'secondary' as const,
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Layers,
          text: 'Hybrid'
        };
      default:
        return null;
    }
  };
  
  const props = getBadgeProps();
  if (!props) return null;
  
  return (
    <Badge 
      variant={props.variant} 
      className={`${props.className} ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'}`}
    >
      {showIcon && <props.icon className={`h-3 w-3 mr-1 ${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />}
      {props.text}
      {deliveryMethod && (
        <span className="ml-1 opacity-75">
          ({deliveryMethod.replace('_', ' ')})
        </span>
      )}
    </Badge>
  );
}
```

### 7.2 Download Progress Component

**File:** `apps/web/src/components/downloads/DownloadProgress.tsx`

```typescript
interface DownloadProgressProps {
  asset: DigitalAsset;
  onDownload: (asset: DigitalAsset) => void;
}

export default function DownloadProgress({ asset, onDownload }: DownloadProgressProps) {
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(0);
    
    try {
      const response = await fetch(asset.downloadUrl);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const contentLength = response.headers.get('Content-Length');
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('No reader available');
      }
      
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (contentLength) {
          setProgress((receivedLength / parseInt(contentLength)) * 100);
        }
      }
      
      // Create blob and download
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = asset.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setProgress(100);
      onDownload(asset);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <div className="space-y-2">
      <Button 
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full"
      >
        {isDownloading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Downloading... {Math.round(progress)}%
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download {asset.name}
          </>
        )}
      </Button>
      
      {isDownloading && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
```

### 7.3 License Key Display Component

**File:** `apps/web/src/components/downloads/LicenseKeyDisplay.tsx`

```typescript
interface LicenseKeyDisplayProps {
  licenseKey: string;
  licenseType: string;
  isActivated?: boolean;
  onActivate?: (key: string) => void;
}

export default function LicenseKeyDisplay({ 
  licenseKey, 
  licenseType, 
  isActivated = false,
  onActivate 
}: LicenseKeyDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          <span className="font-semibold">License Key</span>
          <Badge variant="outline">{licenseType}</Badge>
          {isActivated && (
            <Badge variant="default" className="bg-green-600">
              Activated
            </Badge>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowKey(!showKey)}
        >
          {showKey ? 'Hide' : 'Show'}
        </Button>
      </div>
      
      {showKey && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <code className="flex-1 text-sm bg-white px-3 py-2 rounded font-mono">
              {licenseKey}
            </code>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          
          <div className="text-xs text-gray-600 space-y-1">
            <p>• Keep this key safe - it's required for product activation</p>
            <p>• This key can only be activated on one device</p>
            <p>• Save this key in a secure location</p>
          </div>
          
          {!isActivated && onActivate && (
            <div className="mt-3 pt-3 border-t border-yellow-300">
              <Button size="sm" onClick={() => onActivate(licenseKey)}>
                Activate License
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 8: Testing & Quality Assurance

### 8.1 Test Scenarios

#### Cart & Checkout Tests
- [ ] Digital-only cart checkout flow
- [ ] Mixed cart checkout flow  
- [ ] Physical-only cart (no changes)
- [ ] Cart validation for digital products
- [ ] Shipping address requirement validation
- [ ] Payment processing with digital access creation

#### Access & Download Tests
- [ ] Immediate access after payment
- [ ] Download limit enforcement
- [ ] Access expiration handling
- [ ] License key activation
- [ ] Invalid access token handling
- [ ] Expired access token handling

#### Email & Notification Tests
- [ ] Order confirmation with digital products
- [ ] Access expiration reminders
- [ ] Download limit warnings
- [ ] License key delivery

#### Customer Account Tests
- [ ] Download dashboard functionality
- [ ] License key management
- [ ] Access history tracking
- [ ] Download re-attempt functionality

### 8.2 Performance Considerations

#### File Downloads
- Implement CDN for large files
- Support resumable downloads
- Optimize for concurrent downloads
- Monitor bandwidth usage

#### Database Optimization
- Index access grants for fast lookups
- Archive old access logs
- Optimize download tracking queries
- Implement caching for popular downloads

#### Security Testing
- Access token brute force protection
- Download sharing prevention
- License key validation testing
- Rate limiting effectiveness

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Foundation
- [ ] Cart service digital product handling
- [ ] Checkout service enhancements
- [ ] Basic digital product indicators

### Sprint 2 (Week 3-4): Core Flow
- [ ] Payment processing integration
- [ ] Digital access creation service
- [ ] Order confirmation enhancements

### Sprint 3 (Week 5-6): Customer Experience
- [ ] Customer download dashboard
- [ ] Email templates
- [ ] License key management

### Sprint 4 (Week 7-8): UI Components
- [ ] Digital product badges
- [ ] Download progress components
- [ ] License key display

### Sprint 5 (Week 9-10): Notifications
- [ ] Expiration reminders
- [ ] Download limit warnings
- [ ] Real-time notifications

### Sprint 6 (Week 11-12): Testing & Polish
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security testing
- [ ] Documentation

---

## Dependencies & Prerequisites

### Required from Digital Products Plan
- ✅ Database schema (digital_download_pages, download_access_grants)
- ✅ API endpoints (download access validation)
- ✅ Singleton services (DownloadPageService, PublicDownloadService)
- ✅ Access control logic
- ✅ License key management

### Integration Points
- Cart service modifications
- Checkout service integration
- Payment webhook enhancements
- Email template system
- Customer account system
- Real-time notifications

### External Dependencies
- Supabase storage for file hosting
- Email service provider (SendGrid/Resend)
- Payment gateway webhooks (Stripe/PayPal)
- CDN for file delivery (optional)

---

## Success Metrics

### Customer Experience
- **Immediate Access Time**: < 5 seconds from payment to download
- **Download Success Rate**: > 99%
- **Customer Support Tickets**: < 1% related to digital access issues

### Business Metrics
- **Digital Product Conversion**: Track vs physical products
- **Repeat Download Rate**: Measure customer re-engagement
- **License Key Activation**: Track activation rates

### Technical Metrics
- **API Response Time**: < 200ms for access validation
- **Download Speed**: Maintain CDN performance
- **System Uptime**: > 99.9% for download services

This comprehensive checkout flow plan bridges all the gaps identified in the digital products plan and provides a complete end-to-end solution for digital product purchases.
