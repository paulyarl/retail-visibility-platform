# Digital Products & Checkout Flow - Integrated Implementation Plan

## Overview

This integrated plan combines the digital products system with comprehensive checkout flow implementation, providing a complete end-to-end solution for digital product creation, management, and purchase. The plan spans 12 weeks across 6 sprints with proper dependency management and timeline integration.

## Architecture Principles

### Singleton Services Pattern

All API communication must use platform-aligned singleton services:

**Tenant/Private APIs:** Use `AuthenticatedApiSingleton`
- Download page CRUD operations
- Asset management
- Access grant management
- Analytics and reporting
- Cart service digital product handling
- Checkout service enhancements

**Public/Customer APIs:** Use `PublicApiSingleton`
- Download page access (public token validation)
- File downloads
- License key activation

**No Direct Fetch:** Never use raw `fetch()` calls. All API requests go through singleton services.

---

## Phase 1: Foundation & Cart Integration (Sprint 1-2)

### 1.1 Database Schema & Migration

#### New Tables
```sql
CREATE TABLE digital_download_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Page Configuration
  page_type VARCHAR(50) NOT NULL DEFAULT 'standard',
  custom_css TEXT,
  custom_js TEXT,
  logo_url TEXT,
  banner_url TEXT,
  brand_color VARCHAR(50),
  
  -- Content
  instructions TEXT,
  thank_you_message TEXT,
  support_email VARCHAR(255),
  support_url TEXT,
  
  -- Access Control
  require_authentication BOOLEAN DEFAULT true,
  require_purchase_verification BOOLEAN DEFAULT true,
  access_expires BOOLEAN DEFAULT false,
  access_duration_days INTEGER,
  
  -- Download Settings
  allow_multiple_downloads BOOLEAN DEFAULT true,
  download_limit INTEGER,
  download_tracking BOOLEAN DEFAULT true,
  
  -- SEO & Metadata
  seo_title VARCHAR(255),
  seo_description TEXT,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(tenant_id, item_id),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE digital_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  download_page_id UUID NOT NULL REFERENCES digital_download_pages(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  
  -- Asset Information
  asset_name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL,
  file_path TEXT,
  file_size BIGINT,
  file_mime_type VARCHAR(255),
  external_url TEXT,
  license_key_template TEXT,
  
  -- Download Configuration
  download_method VARCHAR(50) NOT NULL DEFAULT 'direct',
  requires_license_key BOOLEAN DEFAULT false,
  license_key_generator VARCHAR(50),
  
  -- Access Control
  access_type VARCHAR(50) NOT NULL DEFAULT 'standard',
  max_downloads INTEGER,
  expiry_days INTEGER,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE download_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  download_page_id UUID NOT NULL REFERENCES digital_download_pages(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  
  -- Customer Information
  customer_id UUID REFERENCES customers(id),
  customer_email VARCHAR(255) NOT NULL,
  order_id UUID REFERENCES orders(id),
  order_item_id UUID REFERENCES order_items(id),
  
  -- Access Token
  access_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_expires_at TIMESTAMP,
  
  -- Access Control
  access_granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  access_expires_at TIMESTAMP,
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  
  -- License Key
  license_key VARCHAR(255) UNIQUE,
  license_key_activated_at TIMESTAMP,
  license_key_activated_by VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMP,
  revoked_reason TEXT,
  
  -- Tracking
  first_access_at TIMESTAMP,
  last_access_at TIMESTAMP,
  access_ip_addresses TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE download_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_grant_id UUID NOT NULL REFERENCES download_access_grants(id) ON DELETE CASCADE,
  download_id UUID REFERENCES digital_downloads(id),
  
  -- Access Details
  accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(50),
  user_agent TEXT,
  referrer TEXT,
  
  -- Download Details
  download_successful BOOLEAN,
  download_size BIGINT,
  download_duration_ms INTEGER,
  
  -- Error Tracking
  error_code VARCHAR(50),
  error_message TEXT
);
```

#### inventory_items Table Update
```sql
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS download_page_id TEXT REFERENCES digital_download_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_download_page ON inventory_items(download_page_id)
WHERE (download_page_id IS NOT NULL);
```

### 1.2 Cart Service Enhancement

**File:** `apps/web/src/services/CartService.ts`

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
  
  // Computed properties
  hasPhysicalItems: boolean;
  hasDigitalItems: boolean;
  isDigitalOnlyCart: boolean;
  isMixedCart: boolean;
  requiresShipping: boolean;
  shippingAddressRequired: boolean;
}

class CartService extends AuthenticatedApiSingleton {
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

### 1.3 Basic Digital Product Indicators

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

---

## Phase 2: APIs & Checkout Core (Sprint 3-4)

### 2.1 Singleton Services

#### DownloadPageService (AuthenticatedApiSingleton)

**Location:** `apps/web/src/services/DownloadPageService.ts`

```typescript
class DownloadPageService extends AuthenticatedApiSingleton {
  // Download Page CRUD
  async createDownloadPage(tenantId: string, data: CreateDownloadPageRequest): Promise<DownloadPage>;
  async getDownloadPage(tenantId: string, pageId: string): Promise<DownloadPage>;
  async listDownloadPages(tenantId: string, filters?: DownloadPageFilters): Promise<DownloadPage[]>;
  async updateDownloadPage(tenantId: string, pageId: string, data: UpdateDownloadPageRequest): Promise<DownloadPage>;
  async deleteDownloadPage(tenantId: string, pageId: string): Promise<void>;
  async publishDownloadPage(tenantId: string, pageId: string): Promise<DownloadPage>;
  async unpublishDownloadPage(tenantId: string, pageId: string): Promise<DownloadPage>;

  // Asset Management
  async addAsset(tenantId: string, pageId: string, asset: CreateAssetRequest): Promise<DigitalAsset>;
  async updateAsset(tenantId: string, pageId: string, assetId: string, data: UpdateAssetRequest): Promise<DigitalAsset>;
  async deleteAsset(tenantId: string, pageId: string, assetId: string): Promise<void>;
  async reorderAssets(tenantId: string, pageId: string, assetIds: string[]): Promise<void>;

  // Access Grant Management
  async listAccessGrants(tenantId: string, pageId: string, filters?: AccessGrantFilters): Promise<AccessGrant[]>;
  async revokeAccessGrant(tenantId: string, grantId: string, reason: string): Promise<void>;
  async extendAccessGrant(tenantId: string, grantId: string, additionalDays: number): Promise<AccessGrant>;

  // Analytics
  async getDownloadStats(tenantId: string, pageId: string, dateRange?: DateRange): Promise<DownloadStats>;
  async getAccessLogs(tenantId: string, pageId: string, filters?: AccessLogFilters): Promise<AccessLog[]>;
}
```

#### PublicDownloadService (PublicApiSingleton)

**Location:** `apps/web/src/services/PublicDownloadService.ts`

```typescript
class PublicDownloadService extends PublicApiSingleton {
  // Access Validation (public, no auth required)
  async validateAccessToken(accessToken: string): Promise<AccessValidationResult>;
  async getDownloadPage(accessToken: string): Promise<PublicDownloadPage>;

  // Downloads (public, token-validated)
  async downloadFile(accessToken: string, assetId: string): Promise<Blob>;
  async getExternalLink(accessToken: string, assetId: string): Promise<string>;

  // License Key Activation (public, token-validated)
  async activateLicenseKey(accessToken: string, licenseKey: string): Promise<LicenseActivationResult>;

  // Access Info (public, token-validated)
  async getAccessInfo(accessToken: string): Promise<AccessInfo>;
}
```

#### CheckoutService Enhancement

**File:** `apps/web/src/services/CheckoutService.ts`

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
    return await digitalAccessService.createAccessGrantsForOrder(order);
  }
}
```

### 2.2 Backend API Routes

#### Download Page Management (Merchant)
- `POST /api/tenants/:tenantId/download-pages` - Create download page
- `GET /api/tenants/:tenantId/download-pages` - List download pages
- `GET /api/tenants/:tenantId/download-pages/:pageId` - Get download page
- `PUT /api/tenants/:tenantId/download-pages/:pageId` - Update download page
- `DELETE /api/tenants/:tenantId/download-pages/:pageId` - Delete download page
- `POST /api/tenants/:tenantId/download-pages/:pageId/assets` - Add asset
- `DELETE /api/tenants/:tenantId/download-pages/:pageId/assets/:assetId` - Remove asset

#### Download Access (Customer)
- `GET /api/download/:accessToken` - Validate access token
- `GET /api/download/:accessToken/files/:assetId` - Download file
- `POST /api/download/:accessToken/activate` - Activate license key

#### Checkout Integration
- `POST /api/checkout` - Process checkout with digital access
- `POST /api/webhooks/payment-success` - Handle payment success with digital access

### 2.3 Access Control & Validation Logic

**Location:** `apps/api/src/services/DownloadAccessService.ts`

```typescript
interface AccessValidationContext {
  accessToken: string;
  customerId?: string;
  customerEmail: string;
  orderId: string;
  downloadPageId: string;
  itemId: string;
  
  itemSettings: {
    downloadLimit: number | null;
    accessDurationDays: number | null;
    licenseType: 'personal' | 'commercial' | 'enterprise' | 'educational' | null;
    digitalDeliveryMethod: 'direct_download' | 'license_key' | 'external_link' | 'access_grant';
  };
  
  pageSettings: {
    requireAuthentication: boolean;
    requirePurchaseVerification: boolean;
    customDownloadLimit?: number;
    customAccessDurationDays?: number;
  };
}

async function validateAccess(context: AccessValidationContext): Promise<AccessValidationResult> {
  const grant = await getAccessGrant(context.accessToken);
  const item = await getItem(grant.itemId);
  const page = await getDownloadPage(grant.downloadPageId);
  
  // 1. Token Validation
  if (!grant || grant.status !== 'active') {
    return { valid: false, error: 'ACCESS_REVOKED', message: 'Access has been revoked' };
  }
  
  // 2. Expiration Check
  const accessDuration = page.customAccessDurationDays ?? item.access_duration_days;
  if (accessDuration) {
    const expiresAt = new Date(grant.access_granted_at);
    expiresAt.setDate(expiresAt.getDate() + accessDuration);
    
    if (new Date() > expiresAt) {
      await updateGrantStatus(grant.id, 'expired');
      return { valid: false, error: 'ACCESS_EXPIRED', message: 'Access period has expired' };
    }
  }
  
  // 3. Download Limit Check
  const downloadLimit = page.customDownloadLimit ?? item.download_limit;
  if (downloadLimit && grant.download_count >= downloadLimit) {
    await updateGrantStatus(grant.id, 'exhausted');
    return { valid: false, error: 'DOWNLOAD_LIMIT_EXCEEDED', message: 'Download limit reached' };
  }
  
  // 4. Purchase Verification
  if (page.requirePurchaseVerification) {
    const order = await getOrder(grant.orderId);
    if (order.status !== 'completed') {
      return { valid: false, error: 'PURCHASE_NOT_VERIFIED', message: 'Order payment not completed' };
    }
  }
  
  // 5. Authentication Check
  if (page.requireAuthentication && !context.customerId) {
    return { valid: false, error: 'AUTHENTICATION_REQUIRED', message: 'Please sign in to access downloads' };
  }
  
  // 6. License Key Validation
  if (item.digital_delivery_method === 'license_key') {
    if (!grant.license_key) {
      return { valid: false, error: 'LICENSE_KEY_REQUIRED', message: 'License key activation required' };
    }
    
    if (item.license_type && !grant.license_key_activated_at) {
      return { 
        valid: true, 
        requiresActivation: true, 
        licenseKey: grant.license_key,
        licenseType: item.license_type 
      };
    }
  }
  
  // 7. Asset Availability Check
  const assets = await getDownloadAssets(page.id);
  if (!assets || assets.length === 0) {
    return { valid: false, error: 'NO_ASSETS_AVAILABLE', message: 'No downloadable assets found' };
  }
  
  return { valid: true, grant, item, page, assets };
}
```

### 2.4 Payment Processing Integration

**File:** `apps/api/src/services/PaymentProcessingService.ts`

```typescript
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

## Phase 3: Frontend Pages & Customer Experience (Sprint 5-6)

### 3.1 Customer Download Page

**Route:** `/download/:accessToken`

**Location:** `apps/web/src/app/download/[accessToken]/page.tsx`

**Uses:** `PublicDownloadService` (PublicApiSingleton)

```typescript
export default function DownloadPage({ params }: { params: { accessToken: string } }) {
  const [accessData, setAccessData] = useState<AccessValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    validateAccess();
  }, [params.accessToken]);
  
  const validateAccess = async () => {
    try {
      const result = await publicDownloadService.validateAccessToken(params.accessToken);
      setAccessData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <DownloadPageLoading />;
  if (error) return <AccessError error={error} />;
  if (!accessData?.valid) return <AccessDenied />;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DownloadPageHeader page={accessData.page} />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <ProductInfo item={accessData.item} />
        
        {accessData.requiresActivation && (
          <LicenseKeyActivation 
            licenseKey={accessData.licenseKey}
            licenseType={accessData.licenseType}
            accessToken={params.accessToken}
          />
        )}
        
        <DownloadAssets 
          assets={accessData.assets}
          accessToken={params.accessToken}
        />
        
        <AccessInfo access={accessData.grant} />
        
        <SupportContact supportEmail={accessData.page.supportEmail} />
      </main>
    </div>
  );
}
```

### 3.2 Customer Download Dashboard

**Route:** `/t/[tenantId]/account/downloads`

**Location:** `apps/web/src/app/t/[tenantId]/account/downloads/page.tsx`

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
```

### 3.3 Order Confirmation Enhancement

**File:** `apps/web/src/app/t/[tenantId]/orders/[orderId]/page.tsx`

```typescript
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
```

### 3.4 Email Templates

#### Order Confirmation with Digital Products

**File:** `apps/api/src/templates/emails/order-confirmation.tsx`

```typescript
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
          
          {/* Digital products section */}
          {hasDigitalItems && (
            <Section style={digitalSection}>
              <h2>📥 Your Digital Products</h2>
              <Text>Your digital products are ready for immediate download!</Text>
              
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
                </div>
              ))}
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Phase 4: Wizard Integration & UI Components (Sprint 7-8)

### 4.1 Product Type Step Enhancement (Step 2)

**File:** `apps/web/src/components/inventory/wizards/steps/ProductTypeStep.tsx`

```typescript
export default function ProductTypeStep({ data, onChange, isEditMode, existingItem }: ProductTypeStepProps) {
  const [showDigitalSettings, setShowDigitalSettings] = useState(false);
  
  // Enhanced UI with digital settings panel
  return (
    <div className="space-y-6">
      {/* Product Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Product Type</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={data.productType} onValueChange={handleProductTypeChange}>
            <Card className={`cursor-pointer ${data.productType === 'physical' ? 'border-primary' : ''}`}>
              <CardContent className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                <h3 className="font-semibold">Physical</h3>
                <p className="text-sm text-gray-600 mt-1">Tangible product</p>
              </CardContent>
            </Card>
            
            <Card className={`cursor-pointer ${data.productType === 'digital' ? 'border-primary' : ''}`}>
              <CardContent className="p-6 text-center">
                <Monitor className="h-12 w-12 mx-auto mb-3 text-purple-600" />
                <h3 className="font-semibold">Digital</h3>
                <p className="text-sm text-gray-600 mt-1">Downloadable product</p>
              </CardContent>
            </Card>
            
            <Card className={`cursor-pointer ${data.productType === 'hybrid' ? 'border-primary' : ''}`}>
              <CardContent className="p-6 text-center">
                <Layers className="h-12 w-12 mx-auto mb-3 text-green-600" />
                <h3 className="font-semibold">Hybrid</h3>
                <p className="text-sm text-gray-600 mt-1">Physical + Digital</p>
              </CardContent>
            </Card>
          </RadioGroup>
        </CardContent>
      </Card>
      
      {/* Digital Settings Panel */}
      {showDigitalSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Digital Product Settings
              <Badge variant="secondary">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Delivery Method */}
            <div className="space-y-3">
              <Label>Delivery Method *</Label>
              <RadioGroup value={data.digitalSettings?.deliveryMethod}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="direct_download" id="direct" />
                  <Label htmlFor="direct">Direct Download</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="license_key" id="license" />
                  <Label htmlFor="license">License Key</Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Access Control */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Access Control</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Access Duration (days)</Label>
                  <Input type="number" placeholder="Unlimited" />
                </div>
                <div className="space-y-2">
                  <Label>Download Limit</Label>
                  <Input type="number" placeholder="Unlimited" />
                </div>
              </div>
            </div>
            
            {/* Download Page Creation */}
            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
              <Switch checked={data.digitalSettings?.createDownloadPage} />
              <div className="flex-1">
                <Label className="font-semibold">Create Download Page</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically create a customer download page for this product.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 4.2 Digital Assets Step (Step 8)

**File:** `apps/web/src/components/inventory/wizards/steps/DigitalAssetsStep.tsx`

```typescript
export default function DigitalAssetsStep({ data, onChange, deliveryMethod }: DigitalAssetsStepProps) {
  const [isUploading, setIsUploading] = useState(false);
  
  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer">
            <input type="file" multiple className="hidden" />
            <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium">Drop files here or click to upload</p>
            <p className="text-sm text-gray-600 mt-1">
              Supported: ZIP, PDF, MP4, MP3, etc.
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* External Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Add External Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="Link Name" />
            <Input placeholder="https://..." />
          </div>
          <Button>Add Link</Button>
        </CardContent>
      </Card>
      
      {/* Uploaded Assets */}
      {data.assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Assets ({data.assets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.assets.map(asset => (
                <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-gray-600">{asset.type}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 4.3 Download Progress Component

**File:** `apps/web/src/components/downloads/DownloadProgress.tsx`

```typescript
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
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        const contentLength = response.headers.get('Content-Length');
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
      a.click();
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
      <Button onClick={handleDownload} disabled={isDownloading} className="w-full">
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

---

## Phase 5: Notifications & Purchase Flow (Sprint 9-10)

### 5.1 Digital Access Service

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
    const downloadPage = await this.getDownloadPageForItem(item.id);
    const accessToken = crypto.randomUUID();
    
    const accessExpiresAt = item.access_duration_days 
      ? new Date(Date.now() + item.access_duration_days * 24 * 60 * 60 * 1000)
      : null;
    
    const licenseKey = item.digital_delivery_method === 'license_key'
      ? this.generateLicenseKey(item.license_type)
      : null;
    
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
    await emailService.sendTemplate('digital-access-granted', {
      to: order.customer_email,
      data: { customer: order.customer, order, accessGrants: [grant] }
    });
    
    // Schedule expiration reminder
    if (grant.access_expires_at) {
      await this.scheduleExpirationReminder(grant);
    }
  }
}
```

### 5.2 Expiration Reminder Email

**File:** `apps/api/src/templates/emails/access-expiration-reminder.tsx`

```typescript
export default function AccessExpirationReminderEmail({ customer, expiringAccess }: AccessExpirationReminderProps) {
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
                <Text>Expires in {Math.ceil(daysUntilExpiration(access.accessExpiresAt))} days</Text>
                <Text>Downloads remaining: {access.downloadsRemaining || 'Unlimited'}</Text>
                
                <Button style={downloadButton} href={`${process.env.WEB_URL}/download/${access.accessToken}`}>
                  Download Now
                </Button>
              </div>
            ))}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### 5.3 Real-time Notifications

**File:** `apps/api/src/services/RealtimeService.ts`

```typescript
class RealtimeService {
  async notifyCustomer(customerId: string, notification: Notification): Promise<void> {
    // Send real-time notification via WebSocket
    await this.sendWebSocketMessage(customerId, {
      type: notification.type,
      data: notification.data,
      timestamp: new Date()
    });
  }
  
  async handlePaymentSuccess(order: Order): Promise<void> {
    const digitalItems = order.items.filter(item => 
      item.product_type === 'digital' || item.product_type === 'hybrid'
    );
    
    if (digitalItems.length > 0 && order.customer_id) {
      await this.notifyCustomer(order.customer_id, {
        type: 'digital-access-granted',
        data: {
          orderId: order.id,
          itemCount: digitalItems.length,
          immediateAccess: true
        }
      });
    }
  }
}
```

---

## Phase 6: Security & Testing (Sprint 11-12)

### 6.1 Security Implementation

#### Access Token Security
```typescript
async function validateAccessToken(accessToken: string): Promise<AccessGrant> {
  // 1. Check token format
  if (!isValidUUID(accessToken)) {
    throw new InvalidTokenError();
  }
  
  // 2. Hash token and lookup
  const hashedToken = hashToken(accessToken);
  const grant = await db.downloadAccessGrants.findUnique({
    where: { accessToken: hashedToken }
  });
  
  // 3-7. Comprehensive validation checks
  if (!grant || grant.status !== 'active') {
    throw new AccessRevokedError(grant?.status);
  }
  
  if (grant.accessExpiresAt && grant.accessExpiresAt < new Date()) {
    throw new AccessExpiredError();
  }
  
  if (grant.maxDownloads && grant.downloadCount >= grant.maxDownloads) {
    throw new DownloadLimitExceededError();
  }
  
  return grant;
}
```

#### Rate Limiting
```typescript
const downloadRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 downloads per minute per token
  skipFailedRequests: false,
  keyGenerator: (req) => req.accessToken
});
```

### 6.2 Testing Strategy

#### End-to-End Test Scenarios
```typescript
describe('Digital Product Purchase Flow', () => {
  test('Digital-only cart checkout', async () => {
    // Add digital product to cart
    // Proceed to checkout (no shipping required)
    // Complete payment
    // Verify immediate access granted
    // Verify download links work
  });
  
  test('Mixed cart checkout', async () => {
    // Add physical + digital products
    // Verify shipping required
    // Complete payment
    // Verify shipping info + digital access
  });
  
  test('Download limit enforcement', async () => {
    // Purchase product with 3 download limit
    // Download 3 times successfully
    // Attempt 4th download - should fail
  });
  
  test('Access expiration', async () => {
    // Purchase product with 7-day access
    // Wait for expiration
    // Attempt download - should fail
  });
  
  test('License key activation', async () => {
    // Purchase license-protected product
    // Attempt download without activation - should fail
    // Activate license key
    // Download successfully
  });
});
```

#### Performance Tests
```typescript
describe('Digital Download Performance', () => {
  test('Download page load time < 2 seconds', async () => {
    const startTime = performance.now();
    await page.goto(`/download/${accessToken}`);
    const loadTime = performance.now() - startTime;
    expect(loadTime).toBeLessThan(2000);
  });
  
  test('File download starts < 5 seconds', async () => {
    const downloadStart = performance.now();
    await page.click('[data-testid="download-button"]');
    await page.waitForResponse(response => response.url().includes('/download/'));
    const downloadStartTime = performance.now() - downloadStart;
    expect(downloadStartTime).toBeLessThan(5000);
  });
});
```

### 6.3 Success Metrics

#### Customer Experience Metrics
- **Immediate Access Time**: < 5 seconds from payment to download
- **Download Success Rate**: > 99%
- **Customer Support Tickets**: < 1% related to digital access issues

#### Business Metrics
- **Digital Product Conversion**: Track vs physical products
- **Repeat Download Rate**: Measure customer re-engagement
- **License Key Activation**: Track activation rates

#### Technical Metrics
- **API Response Time**: < 200ms for access validation
- **Download Speed**: Maintain CDN performance
- **System Uptime**: > 99.9% for download services

---

## Implementation Timeline Summary

### Sprint 1 (Week 1-2): Foundation
- [ ] Database schema design and migration
- [ ] Cart service digital product handling
- [ ] Basic digital product indicators
- [ ] Prisma schema updates

### Sprint 2 (Week 3-4): Core APIs
- [ ] Download page CRUD APIs
- [ ] Download access APIs
- [ ] Checkout service enhancements
- [ ] Payment processing integration
- [ ] API testing

### Sprint 3 (Week 5-6): Frontend Pages
- [ ] Customer download page
- [ ] Customer download dashboard
- [ ] Order confirmation enhancements
- [ ] Email templates
- [ ] UI testing

### Sprint 4 (Week 7-8): Wizard & Components
- [ ] Product type step enhancement
- [ ] Digital assets step
- [ ] Download page step
- [ ] Review step updates
- [ ] UI components (badges, progress, etc.)

### Sprint 5 (Week 9-10): Notifications
- [ ] Digital access service
- [ ] Expiration reminders
- [ ] Download limit warnings
- [ ] Real-time notifications
- [ ] Email delivery testing

### Sprint 6 (Week 11-12): Security & Polish
- [ ] Access token security
- [ ] Download security
- [ ] License key system
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security testing
- [ ] Documentation

---

## Dependencies & Prerequisites

### Required Systems
- ✅ Supabase storage for file hosting
- ✅ Email service provider (SendGrid/Resend)
- ✅ Payment gateway webhooks (Stripe/PayPal)
- ✅ Real-time notification system

### Integration Points
- Cart service modifications
- Checkout service integration
- Payment webhook enhancements
- Customer account system
- Wizard system enhancement

---

This integrated plan provides a comprehensive 12-week implementation timeline that combines the digital products system with complete checkout flow functionality, ensuring proper dependency management and phased delivery.
