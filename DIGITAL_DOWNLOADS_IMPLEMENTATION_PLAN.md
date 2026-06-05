# Digital Download Products - Phased Implementation Plan

## Executive Summary

**Vision:** Enable merchants to sell digital products (ebooks, software, courses, templates, music, etc.) alongside physical inventory with automated post-purchase delivery.

**Business Value:**
- Expands addressable market (digital creators, educators, software vendors)
- Zero fulfillment costs for merchants
- Instant delivery = better customer experience
- Recurring revenue potential (subscriptions, updates)
- Differentiator from competitors

**Timeline:** 6-8 weeks across 4 phases
**Complexity:** Medium - Builds on existing checkout/payment infrastructure

---

## Current Architecture Analysis

### ✅ Existing Strengths
1. **Payment Gateway Integration** - Square & PayPal already implemented
2. **Order Management** - Complete order/payment/fulfillment tracking
3. **Inventory System** - Robust product management with metadata support
4. **Checkout Flow** - Multi-step checkout with fulfillment method selection
5. **Email System** - Transactional email infrastructure exists
6. **Tier System** - Feature gating already implemented

### 🔧 Required Additions
1. **Product Type Field** - Distinguish physical vs digital products
2. **Digital Asset Storage** - Secure file/link management
3. **Fulfillment Method** - Add "digital_download" option
4. **Access Control** - Time-limited/download-limited access
5. **Delivery System** - Automated post-purchase email with links
6. **Google Shopping** - Conditional sync logic for digital products

---

## Phase 1: Database & Core Infrastructure (Week 1-2)

### Priority: CRITICAL - Foundation for all other phases

### 1.1 Database Schema Changes

**Add to `inventory_items` table:**
```prisma
model inventory_items {
  // ... existing fields ...
  
  // Digital Product Fields
  product_type              product_type             @default(physical)
  digital_delivery_method   digital_delivery_method? // null for physical
  digital_assets            Json?                    // Array of asset objects
  access_duration_days      Int?                     // null = lifetime access
  download_limit            Int?                     // null = unlimited
  license_type              license_type?            // personal, commercial, etc.
  
  // Relations
  digital_access_grants     digital_access_grants[]
}

enum product_type {
  physical
  digital
  hybrid  // Both physical and digital components
}

enum digital_delivery_method {
  direct_download    // File hosted on platform
  external_link      // Link to external service (Dropbox, Google Drive, etc.)
  license_key        // Generate and deliver license key
  access_grant       // Grant access to platform-hosted content
}

enum license_type {
  personal
  commercial
  educational
  enterprise
}
```

**New table: `digital_access_grants`**
```prisma
model digital_access_grants {
  id                    String   @id @default(uuid())
  order_id              String
  order_item_id         String
  inventory_item_id     String
  customer_email        String
  access_token          String   @unique // Secure random token
  download_count        Int      @default(0)
  download_limit        Int?     // null = unlimited
  expires_at            DateTime? // null = lifetime
  first_accessed_at     DateTime?
  last_accessed_at      DateTime?
  revoked_at            DateTime?
  revoked_reason        String?
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
  
  inventory_items       inventory_items @relation(fields: [inventory_item_id], references: [id])
  orders                orders          @relation(fields: [order_id], references: [id])
  order_items           order_items     @relation(fields: [order_item_id], references: [id])
  
  @@index([customer_email])
  @@index([access_token])
  @@index([order_id])
  @@index([expires_at])
}
```

**Update `order_items` table:**
```prisma
model order_items {
  // ... existing fields ...
  
  product_type              product_type
  digital_delivery_status   digital_delivery_status? @default(pending)
  digital_delivered_at      DateTime?
  
  digital_access_grants     digital_access_grants[]
}

enum digital_delivery_status {
  pending
  delivered
  failed
  revoked
}
```

### 1.2 Digital Asset Storage Strategy

**Option A: Platform-Hosted (Recommended for MVP)**
- Store files in Supabase Storage (already using Supabase)
- Bucket: `digital-products`
- Path structure: `{tenant_id}/{product_id}/{filename}`
- Signed URLs with expiration (1 hour)
- Max file size: 500MB per file

**Option B: External Links (Phase 1 Support)**
- Merchants provide links to Dropbox, Google Drive, OneDrive, etc.
- Platform stores and delivers links
- No file hosting costs
- Merchant responsible for link maintenance

**Implementation:**
```typescript
// apps/api/src/lib/digital-assets.ts
interface DigitalAsset {
  id: string;
  name: string;
  type: 'file' | 'link' | 'license_key';
  storage_method: 'platform' | 'external';
  file_path?: string;        // For platform-hosted
  external_url?: string;     // For external links
  file_size_bytes?: number;
  mime_type?: string;
  description?: string;
  version?: string;
  created_at: string;
}

class DigitalAssetService {
  async uploadAsset(tenantId: string, productId: string, file: File): Promise<DigitalAsset>
  async generateSignedUrl(assetId: string, expiresIn: number): Promise<string>
  async validateAsset(assetId: string): Promise<boolean>
  async deleteAsset(assetId: string): Promise<void>
}
```

### 1.3 Migration Script

```typescript
// apps/api/prisma/migrations/XXX_add_digital_products.sql
-- Add product_type to existing products (default: physical)
ALTER TABLE inventory_items 
  ADD COLUMN product_type product_type DEFAULT 'physical',
  ADD COLUMN digital_delivery_method digital_delivery_method,
  ADD COLUMN digital_assets JSONB,
  ADD COLUMN access_duration_days INTEGER,
  ADD COLUMN download_limit INTEGER,
  ADD COLUMN license_type license_type;

-- Create digital_access_grants table
CREATE TABLE digital_access_grants (
  -- ... full schema
);

-- Update order_items
ALTER TABLE order_items
  ADD COLUMN product_type product_type DEFAULT 'physical',
  ADD COLUMN digital_delivery_status digital_delivery_status DEFAULT 'pending',
  ADD COLUMN digital_delivered_at TIMESTAMPTZ;
```

**Deliverables:**
- ✅ Prisma schema updated
- ✅ Migration scripts created and tested
- ✅ DigitalAssetService implemented
- ✅ Supabase storage bucket configured
- ✅ Database indexes optimized

---

## Phase 2: Product Management UI (Week 2-3)

### Priority: HIGH - Merchants need to create digital products

### 2.1 Product Type Selection

**Location:** Item creation/edit modal

**UI Flow:**
1. Product Type selector (Radio buttons)
   - 🏪 Physical Product (default)
   - 💾 Digital Product
   - 🎁 Hybrid (Physical + Digital)

2. Conditional fields based on selection:
   - Physical: Stock, shipping weight, dimensions
   - Digital: Delivery method, access settings, digital assets
   - Hybrid: All fields from both

### 2.2 Digital Product Configuration Modal

**New Component:** `DigitalProductSetup.tsx`

**Sections:**

**A. Delivery Method**
```typescript
<RadioGroup>
  <Radio value="direct_download">
    📥 Direct Download
    <p>Upload files - customers download directly from platform</p>
  </Radio>
  
  <Radio value="external_link">
    🔗 External Link
    <p>Provide links to Dropbox, Google Drive, etc.</p>
  </Radio>
  
  <Radio value="license_key">
    🔑 License Key
    <p>Generate unique license keys for software/services</p>
  </Radio>
  
  <Radio value="access_grant">
    🎓 Access Grant
    <p>Grant access to courses, memberships, or content</p>
  </Radio>
</RadioGroup>
```

**B. Digital Assets Upload/Management**

For `direct_download`:
```typescript
<FileUploadZone
  accept=".pdf,.zip,.mp3,.mp4,.epub,.mobi"
  maxSize={500 * 1024 * 1024} // 500MB
  multiple={true}
  onUpload={handleAssetUpload}
/>

<AssetList>
  {assets.map(asset => (
    <AssetCard
      name={asset.name}
      size={formatBytes(asset.file_size_bytes)}
      type={asset.mime_type}
      onDelete={() => handleDeleteAsset(asset.id)}
      onPreview={() => handlePreviewAsset(asset.id)}
    />
  ))}
</AssetList>
```

For `external_link`:
```typescript
<Input
  label="Download Link"
  placeholder="https://drive.google.com/file/..."
  helperText="Provide a permanent link to your file"
/>

<Textarea
  label="Access Instructions"
  placeholder="How customers should access the file..."
  rows={4}
/>
```

**C. Access Control Settings**
```typescript
<FormSection title="Access Control">
  <Select label="License Type">
    <option value="personal">Personal Use</option>
    <option value="commercial">Commercial Use</option>
    <option value="educational">Educational Use</option>
    <option value="enterprise">Enterprise License</option>
  </Select>
  
  <NumberInput
    label="Access Duration"
    suffix="days"
    placeholder="Leave empty for lifetime access"
    helperText="How long customers can access this product"
  />
  
  <NumberInput
    label="Download Limit"
    placeholder="Leave empty for unlimited downloads"
    helperText="Maximum number of times customer can download"
  />
</FormSection>
```

**D. Delivery Instructions**
```typescript
<RichTextEditor
  label="Post-Purchase Instructions"
  placeholder="Instructions that will be sent to customers after purchase..."
  helperText="Include setup instructions, system requirements, support info, etc."
/>
```

### 2.3 Product Card Indicators

**Visual Indicators:**
```typescript
// In ItemsGrid.tsx and ItemsList.tsx
{item.product_type === 'digital' && (
  <Badge variant="purple" icon={<Download />}>
    Digital Product
  </Badge>
)}

{item.product_type === 'hybrid' && (
  <Badge variant="blue" icon={<Package />}>
    Physical + Digital
  </Badge>
)}
```

### 2.4 Validation Rules

```typescript
// Digital product validation
const validateDigitalProduct = (item: InventoryItem) => {
  if (item.product_type === 'digital' || item.product_type === 'hybrid') {
    // Must have delivery method
    if (!item.digital_delivery_method) {
      return 'Please select a delivery method';
    }
    
    // Must have at least one asset or link
    if (item.digital_delivery_method === 'direct_download') {
      if (!item.digital_assets || item.digital_assets.length === 0) {
        return 'Please upload at least one file';
      }
    }
    
    if (item.digital_delivery_method === 'external_link') {
      if (!item.digital_assets?.[0]?.external_url) {
        return 'Please provide a download link';
      }
    }
    
    // License type required
    if (!item.license_type) {
      return 'Please select a license type';
    }
  }
  
  return null;
};
```

**Deliverables:**
- ✅ DigitalProductSetup component
- ✅ File upload integration with Supabase
- ✅ Asset management UI
- ✅ Product type indicators
- ✅ Validation logic
- ✅ Edit/delete asset functionality

---

## Phase 3: Checkout & Fulfillment Integration (Week 3-5)

### Priority: CRITICAL - Core purchase flow

### 3.1 Fulfillment Method Updates

**Update:** `FulfillmentMethodForm.tsx`

**New Logic:**
```typescript
const availableMethods = useMemo(() => {
  const hasPhysical = cartItems.some(item => 
    item.product_type === 'physical' || item.product_type === 'hybrid'
  );
  const hasDigital = cartItems.some(item => 
    item.product_type === 'digital' || item.product_type === 'hybrid'
  );
  
  const methods = [];
  
  if (hasPhysical) {
    methods.push('pickup', 'delivery', 'shipping');
  }
  
  if (hasDigital && !hasPhysical) {
    // Digital-only orders don't need fulfillment selection
    return ['digital_download'];
  }
  
  return methods;
}, [cartItems]);
```

**UI Display:**
```typescript
{cartHasDigitalOnly ? (
  <Alert variant="info" icon={<Download />}>
    <strong>Digital Product</strong>
    <p>Your download links will be emailed immediately after payment.</p>
  </Alert>
) : (
  <FulfillmentMethodSelector methods={availableMethods} />
)}
```

### 3.2 Checkout Validation

**Requirements for digital products:**
```typescript
const validateCheckout = (cart: Cart) => {
  const hasDigital = cart.items.some(item => item.product_type !== 'physical');
  
  if (hasDigital) {
    // Payment gateway required (no cash on delivery)
    if (!tenant.hasActivePaymentGateway) {
      return {
        error: 'payment_gateway_required',
        message: 'Digital products require an active payment gateway (Square or PayPal)'
      };
    }
    
    // Email required for delivery
    if (!customerInfo.email) {
      return {
        error: 'email_required',
        message: 'Email address is required for digital product delivery'
      };
    }
  }
  
  return { valid: true };
};
```

### 3.3 Order Processing Updates

**Update:** `apps/api/src/routes/checkout/square.ts` and `paypal.ts`

**After successful payment:**
```typescript
// Create order
const order = await prisma.orders.create({
  data: {
    // ... existing fields ...
    order_items: {
      create: orderItems.map(item => ({
        // ... existing fields ...
        product_type: item.product_type,
        digital_delivery_status: item.product_type === 'digital' 
          ? 'pending' 
          : null
      }))
    }
  }
});

// Process digital products
const digitalItems = orderItems.filter(item => 
  item.product_type === 'digital' || item.product_type === 'hybrid'
);

if (digitalItems.length > 0) {
  await processDigitalDelivery(order.id, digitalItems, customerInfo.email);
}
```

### 3.4 Digital Delivery Service

**New Service:** `apps/api/src/services/DigitalDeliveryService.ts`

```typescript
class DigitalDeliveryService {
  async processDigitalDelivery(
    orderId: string,
    orderItems: OrderItem[],
    customerEmail: string
  ): Promise<void> {
    for (const item of orderItems) {
      // Create access grant
      const accessGrant = await prisma.digital_access_grants.create({
        data: {
          order_id: orderId,
          order_item_id: item.id,
          inventory_item_id: item.inventory_item_id,
          customer_email: customerEmail,
          access_token: generateSecureToken(),
          download_limit: item.download_limit,
          expires_at: item.access_duration_days 
            ? addDays(new Date(), item.access_duration_days)
            : null
        }
      });
      
      // Generate download links
      const downloadLinks = await this.generateDownloadLinks(
        item.inventory_item_id,
        accessGrant.access_token
      );
      
      // Send delivery email
      await this.sendDeliveryEmail({
        to: customerEmail,
        orderNumber: order.order_number,
        productName: item.name,
        downloadLinks,
        accessGrant,
        instructions: item.delivery_instructions
      });
      
      // Update delivery status
      await prisma.order_items.update({
        where: { id: item.id },
        data: {
          digital_delivery_status: 'delivered',
          digital_delivered_at: new Date()
        }
      });
    }
  }
  
  async generateDownloadLinks(
    productId: string,
    accessToken: string
  ): Promise<DownloadLink[]> {
    const product = await prisma.inventory_items.findUnique({
      where: { id: productId }
    });
    
    const assets = product.digital_assets as DigitalAsset[];
    
    return assets.map(asset => ({
      name: asset.name,
      url: `${process.env.APP_URL}/api/downloads/${accessToken}/${asset.id}`,
      size: asset.file_size_bytes,
      type: asset.mime_type
    }));
  }
}
```

### 3.5 Download API Endpoint

**New Route:** `apps/api/src/routes/downloads.ts`

```typescript
router.get('/downloads/:token/:assetId', async (req, res) => {
  const { token, assetId } = req.params;
  
  // Validate access grant
  const grant = await prisma.digital_access_grants.findUnique({
    where: { access_token: token },
    include: { inventory_items: true }
  });
  
  if (!grant) {
    return res.status(404).json({ error: 'Invalid download link' });
  }
  
  // Check expiration
  if (grant.expires_at && new Date() > grant.expires_at) {
    return res.status(403).json({ error: 'Download link has expired' });
  }
  
  // Check download limit
  if (grant.download_limit && grant.download_count >= grant.download_limit) {
    return res.status(403).json({ error: 'Download limit reached' });
  }
  
  // Check if revoked
  if (grant.revoked_at) {
    return res.status(403).json({ error: 'Access has been revoked' });
  }
  
  // Get asset
  const assets = grant.inventory_items.digital_assets as DigitalAsset[];
  const asset = assets.find(a => a.id === assetId);
  
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  // Increment download count
  await prisma.digital_access_grants.update({
    where: { id: grant.id },
    data: {
      download_count: { increment: 1 },
      last_accessed_at: new Date(),
      first_accessed_at: grant.first_accessed_at || new Date()
    }
  });
  
  // Generate signed URL (for platform-hosted files)
  if (asset.storage_method === 'platform') {
    const signedUrl = await digitalAssetService.generateSignedUrl(
      asset.file_path,
      3600 // 1 hour
    );
    return res.redirect(signedUrl);
  }
  
  // Redirect to external link
  if (asset.storage_method === 'external') {
    return res.redirect(asset.external_url);
  }
});
```

### 3.6 Delivery Email Template

**New Template:** `apps/api/src/templates/digital-delivery-email.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Digital Product is Ready!</title>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
    <h1>🎉 Your Purchase is Complete!</h1>
    
    <p>Hi {{customerName}},</p>
    
    <p>Thank you for your purchase from {{storeName}}! Your digital product is ready to download.</p>
    
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2>{{productName}}</h2>
      <p><strong>Order #:</strong> {{orderNumber}}</p>
      <p><strong>License Type:</strong> {{licenseType}}</p>
    </div>
    
    <h3>📥 Download Your Files</h3>
    
    {{#each downloadLinks}}
    <div style="margin: 10px 0;">
      <a href="{{url}}" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
        Download {{name}} ({{size}})
      </a>
    </div>
    {{/each}}
    
    {{#if accessDuration}}
    <p><strong>⏰ Access Duration:</strong> {{accessDuration}} days from purchase</p>
    {{/if}}
    
    {{#if downloadLimit}}
    <p><strong>📊 Download Limit:</strong> {{downloadLimit}} downloads</p>
    {{/if}}
    
    {{#if instructions}}
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3>📋 Important Instructions</h3>
      {{{instructions}}}
    </div>
    {{/if}}
    
    <hr style="margin: 30px 0;">
    
    <p><strong>Need help?</strong> Contact {{storeName}} at {{storeEmail}}</p>
    
    <p style="font-size: 12px; color: #666;">
      This email contains your unique download links. Please do not share these links with others.
    </p>
  </div>
</body>
</html>
```

**Deliverables:**
- ✅ Checkout flow updated for digital products
- ✅ Payment gateway requirement enforced
- ✅ DigitalDeliveryService implemented
- ✅ Download API endpoint secured
- ✅ Email template created
- ✅ Access grant system functional

---

## Phase 4: Customer Experience & Management (Week 5-6)

### Priority: HIGH - Post-purchase experience

### 4.1 Customer Download Portal

**New Page:** `apps/web/src/app/my-downloads/page.tsx`

```typescript
export default function MyDownloadsPage() {
  const [email, setEmail] = useState('');
  const [downloads, setDownloads] = useState<DigitalAccessGrant[]>([]);
  
  const handleLookup = async () => {
    const response = await fetch(`/api/downloads/lookup?email=${email}`);
    const data = await response.json();
    setDownloads(data.grants);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1>My Digital Downloads</h1>
      
      <Card>
        <CardContent>
          <Input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={handleLookup}>Find My Downloads</Button>
        </CardContent>
      </Card>
      
      {downloads.length > 0 && (
        <div className="mt-8 space-y-4">
          {downloads.map(grant => (
            <DownloadCard
              key={grant.id}
              grant={grant}
              onDownload={(assetId) => handleDownload(grant.access_token, assetId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**DownloadCard Component:**
```typescript
function DownloadCard({ grant, onDownload }) {
  const isExpired = grant.expires_at && new Date() > new Date(grant.expires_at);
  const limitReached = grant.download_limit && grant.download_count >= grant.download_limit;
  const canDownload = !isExpired && !limitReached && !grant.revoked_at;
  
  return (
    <Card>
      <CardHeader>
        <h3>{grant.inventory_items.name}</h3>
        <Badge variant={canDownload ? 'success' : 'warning'}>
          {canDownload ? 'Active' : 'Expired'}
        </Badge>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Order #</p>
            <p className="font-medium">{grant.orders.order_number}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Purchase Date</p>
            <p className="font-medium">{formatDate(grant.created_at)}</p>
          </div>
          
          {grant.download_limit && (
            <div>
              <p className="text-sm text-gray-600">Downloads</p>
              <p className="font-medium">
                {grant.download_count} / {grant.download_limit}
              </p>
            </div>
          )}
          
          {grant.expires_at && (
            <div>
              <p className="text-sm text-gray-600">Expires</p>
              <p className="font-medium">{formatDate(grant.expires_at)}</p>
            </div>
          )}
        </div>
        
        {canDownload ? (
          <div className="space-y-2">
            {grant.inventory_items.digital_assets.map(asset => (
              <Button
                key={asset.id}
                variant="primary"
                icon={<Download />}
                onClick={() => onDownload(asset.id)}
              >
                Download {asset.name}
              </Button>
            ))}
          </div>
        ) : (
          <Alert variant="warning">
            {isExpired && 'This download link has expired.'}
            {limitReached && 'Download limit reached.'}
            {grant.revoked_at && 'Access has been revoked.'}
            <p className="mt-2">Please contact the merchant for assistance.</p>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.2 Merchant Management Dashboard

**New Page:** `apps/web/src/app/t/[tenantId]/digital-products/page.tsx`

**Sections:**

**A. Overview Stats**
```typescript
<StatsGrid>
  <StatCard
    title="Total Digital Products"
    value={stats.totalProducts}
    icon={<Download />}
  />
  <StatCard
    title="Active Access Grants"
    value={stats.activeGrants}
    icon={<Key />}
  />
  <StatCard
    title="Total Downloads"
    value={stats.totalDownloads}
    icon={<TrendingUp />}
  />
  <StatCard
    title="Revenue (Digital)"
    value={formatCurrency(stats.digitalRevenue)}
    icon={<DollarSign />}
  />
</StatsGrid>
```

**B. Access Grants Table**
```typescript
<DataTable
  columns={[
    { header: 'Customer', accessor: 'customer_email' },
    { header: 'Product', accessor: 'inventory_items.name' },
    { header: 'Order #', accessor: 'orders.order_number' },
    { header: 'Downloads', accessor: 'download_count' },
    { header: 'Status', accessor: 'status' },
    { header: 'Expires', accessor: 'expires_at' },
    { header: 'Actions', accessor: 'actions' }
  ]}
  data={accessGrants}
  actions={[
    {
      label: 'Extend Access',
      icon: <Clock />,
      onClick: (grant) => handleExtendAccess(grant.id)
    },
    {
      label: 'Revoke Access',
      icon: <Ban />,
      onClick: (grant) => handleRevokeAccess(grant.id),
      variant: 'danger'
    },
    {
      label: 'Resend Email',
      icon: <Mail />,
      onClick: (grant) => handleResendEmail(grant.id)
    }
  ]}
/>
```

**C. Management Actions**
```typescript
// Extend access
const handleExtendAccess = async (grantId: string, additionalDays: number) => {
  await fetch(`/api/digital-access/${grantId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ additional_days: additionalDays })
  });
};

// Revoke access
const handleRevokeAccess = async (grantId: string, reason: string) => {
  await fetch(`/api/digital-access/${grantId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

// Resend delivery email
const handleResendEmail = async (grantId: string) => {
  await fetch(`/api/digital-access/${grantId}/resend`, {
    method: 'POST'
  });
};
```

### 4.3 Order Confirmation Page Updates

**Update:** `apps/web/src/app/orders/confirmation/page.tsx`

```typescript
{order.order_items.some(item => item.product_type === 'digital') && (
  <Card className="mt-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Download className="h-5 w-5" />
        Digital Products
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Alert variant="success" icon={<CheckCircle />}>
        <strong>Download links sent!</strong>
        <p>Check your email ({order.customer_email}) for download instructions.</p>
      </Alert>
      
      <div className="mt-4 space-y-3">
        {order.order_items
          .filter(item => item.product_type === 'digital')
          .map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-600">
                  {item.digital_delivery_status === 'delivered' 
                    ? '✅ Delivered' 
                    : '⏳ Processing...'}
                </p>
              </div>
              {item.digital_delivery_status === 'delivered' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/my-downloads?email=${order.customer_email}`)}
                >
                  Access Downloads
                </Button>
              )}
            </div>
          ))}
      </div>
      
      <p className="mt-4 text-sm text-gray-600">
        Can't find the email? <a href="/my-downloads" className="text-blue-600 hover:underline">Access your downloads here</a>
      </p>
    </CardContent>
  </Card>
)}
```

**Deliverables:**
- ✅ Customer download portal
- ✅ Merchant management dashboard
- ✅ Access grant management (extend/revoke)
- ✅ Email resend functionality
- ✅ Order confirmation updates
- ✅ Download tracking and analytics

---

## Phase 5: Google Shopping & Advanced Features (Week 6-8)

### Priority: MEDIUM - Optimization and polish

### 5.1 Google Shopping Sync Logic

**Update:** Google sync service to handle digital products

```typescript
// apps/api/src/services/GoogleMerchantService.ts

class GoogleMerchantService {
  async syncProduct(product: InventoryItem): Promise<SyncResult> {
    // Digital products: conditional sync
    if (product.product_type === 'digital') {
      // Check if digital products are allowed in merchant's category
      const categoryAllowsDigital = await this.checkCategoryAllowsDigital(
        product.directory_category_id
      );
      
      if (!categoryAllowsDigital) {
        return {
          status: 'skipped',
          reason: 'Digital products not allowed in this category',
          sync_status: 'not_applicable'
        };
      }
      
      // Add digital product attributes
      product.availability = 'in stock'; // Always in stock
      product.shipping = null; // No shipping for digital
      product.is_bundle = false;
      
      // Add custom labels
      product.custom_label_0 = 'digital_product';
    }
    
    // Hybrid products: sync as physical with digital note
    if (product.product_type === 'hybrid') {
      product.custom_label_0 = 'hybrid_product';
      product.description += '\n\nIncludes digital download component.';
    }
    
    return await this.pushToGoogleMerchant(product);
  }
  
  async checkCategoryAllowsDigital(categoryId: string): Promise<boolean> {
    // Some Google Shopping categories don't support digital products
    const restrictedCategories = [
      'Apparel & Accessories',
      'Food, Beverages & Tobacco',
      'Furniture',
      // ... etc
    ];
    
    const category = await this.getCategory(categoryId);
    return !restrictedCategories.some(restricted => 
      category.path.includes(restricted)
    );
  }
}
```

### 5.2 Storefront Display

**Update:** Product cards to show digital badge

```typescript
// apps/web/src/app/t/[tenantId]/page.tsx (storefront)

<ProductCard product={product}>
  {product.product_type === 'digital' && (
    <Badge variant="purple" className="absolute top-2 right-2">
      <Download className="h-3 w-3 mr-1" />
      Instant Download
    </Badge>
  )}
  
  {product.product_type === 'hybrid' && (
    <Badge variant="blue" className="absolute top-2 right-2">
      <Package className="h-3 w-3 mr-1" />
      Physical + Digital
    </Badge>
  )}
</ProductCard>
```

### 5.3 Tier-Based Feature Gating

**Update:** Feature catalog

```typescript
// apps/web/src/lib/features/feature-catalog.ts

export const DIGITAL_PRODUCTS_FEATURE: Feature = {
  id: 'digital_products',
  name: 'Digital Products',
  description: 'Sell digital downloads, software licenses, and online courses',
  pillar: 'growth',
  icon: Download,
  requiredTier: 'professional', // Pro tier and above
  benefits: [
    'Unlimited digital products',
    'Automated delivery',
    'Access control management',
    'Download tracking',
    'License key generation'
  ],
  limitations: {
    starter: 'Not available',
    professional: 'Up to 50 digital products',
    enterprise: 'Unlimited digital products'
  }
};
```

**Enforcement:**
```typescript
// Check tier before allowing digital product creation
const canCreateDigitalProduct = async (tenantId: string): Promise<boolean> => {
  const tier = await getTenantTier(tenantId);
  
  if (tier.tier_name === 'starter' || tier.tier_name === 'trial') {
    return false;
  }
  
  if (tier.tier_name === 'professional') {
    const digitalProductCount = await prisma.inventory_items.count({
      where: {
        tenant_id: tenantId,
        product_type: { in: ['digital', 'hybrid'] }
      }
    });
    
    return digitalProductCount < 50;
  }
  
  return true; // Enterprise and Organization: unlimited
};
```

### 5.4 Analytics & Reporting

**New Dashboard Widget:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Digital Products Performance</CardTitle>
  </CardHeader>
  <CardContent>
    <MetricsGrid>
      <Metric
        label="Digital Revenue (30d)"
        value={formatCurrency(metrics.digitalRevenue30d)}
        change={metrics.digitalRevenueChange}
      />
      <Metric
        label="Total Downloads"
        value={metrics.totalDownloads}
        change={metrics.downloadsChange}
      />
      <Metric
        label="Avg. Downloads per Product"
        value={metrics.avgDownloadsPerProduct}
      />
      <Metric
        label="Active Access Grants"
        value={metrics.activeGrants}
      />
    </MetricsGrid>
    
    <Chart
      type="line"
      data={metrics.downloadsTrend}
      title="Downloads Over Time"
    />
  </CardContent>
</Card>
```

### 5.5 Advanced Features (Optional)

**A. Subscription-Based Digital Products**
- Recurring access grants
- Monthly/annual renewals
- Auto-renewal with payment gateway

**B. Version Management**
- Upload new versions of digital products
- Notify existing customers of updates
- Allow re-downloads of latest version

**C. Bundle Support**
- Create bundles of digital + physical products
- Discounted pricing for bundles
- Single checkout for multiple items

**D. License Key Generation**
```typescript
class LicenseKeyService {
  generateKey(productId: string, customerId: string): string {
    // Format: XXXX-XXXX-XXXX-XXXX
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(this.generateSegment());
    }
    return segments.join('-');
  }
  
  async validateKey(key: string, productId: string): Promise<boolean> {
    const grant = await prisma.digital_access_grants.findFirst({
      where: {
        license_key: key,
        inventory_item_id: productId,
        revoked_at: null
      }
    });
    
    return !!grant && (!grant.expires_at || new Date() < grant.expires_at);
  }
}
```

**Deliverables:**
- ✅ Google Shopping sync logic
- ✅ Storefront display updates
- ✅ Tier-based feature gating
- ✅ Analytics dashboard
- ✅ Optional advanced features documented

---

## Technical Requirements Summary

### Backend Dependencies
```json
{
  "@supabase/storage-js": "^2.5.0",  // File storage
  "uuid": "^9.0.0",                  // Access token generation
  "handlebars": "^4.7.8",            // Email templates
  "mime-types": "^2.1.35"            // File type detection
}
```

### Frontend Dependencies
```json
{
  "react-dropzone": "^14.2.3",      // File upload
  "lucide-react": "^0.263.1"        // Icons (already installed)
}
```

### Environment Variables
```env
# Supabase Storage
SUPABASE_STORAGE_URL=https://xxx.supabase.co/storage/v1
SUPABASE_STORAGE_KEY=xxx

# Digital Products
DIGITAL_PRODUCTS_MAX_FILE_SIZE=524288000  # 500MB
DIGITAL_PRODUCTS_ALLOWED_TYPES=.pdf,.zip,.mp3,.mp4,.epub,.mobi,.exe,.dmg
DOWNLOAD_LINK_EXPIRY_HOURS=1

# Email
SENDGRID_API_KEY=xxx  # Or existing email service
DIGITAL_DELIVERY_FROM_EMAIL=downloads@visibleshelf.com
```

---

## Security Considerations

### 1. Access Token Security
- Use cryptographically secure random tokens (32+ bytes)
- Never expose tokens in URLs (use POST requests where possible)
- Implement rate limiting on download endpoints
- Log all access attempts

### 2. File Storage Security
- Store files in private buckets (not public)
- Generate signed URLs with short expiration (1 hour)
- Validate file types on upload
- Scan files for malware (optional: integrate ClamAV)

### 3. Access Control
- Validate email ownership before showing downloads
- Implement CAPTCHA on download lookup page
- Rate limit download requests per IP
- Monitor for suspicious download patterns

### 4. Payment Verification
- Only create access grants after confirmed payment
- Handle payment failures gracefully
- Implement webhook verification for payment gateways

---

## Testing Strategy

### Unit Tests
- DigitalAssetService methods
- Access grant validation logic
- Download link generation
- Email template rendering

### Integration Tests
- Complete checkout flow with digital products
- Access grant creation after payment
- Download endpoint with various scenarios
- Email delivery

### E2E Tests
```typescript
describe('Digital Product Purchase Flow', () => {
  it('should complete purchase and deliver digital product', async () => {
    // 1. Create digital product
    // 2. Add to cart
    // 3. Complete checkout
    // 4. Verify access grant created
    // 5. Verify email sent
    // 6. Test download link
    // 7. Verify download count incremented
  });
  
  it('should enforce download limits', async () => {
    // Test download limit enforcement
  });
  
  it('should enforce expiration', async () => {
    // Test access expiration
  });
});
```

---

## Migration & Rollout Plan

### Week 1-2: Foundation
- Database migration (non-breaking)
- Backend services implementation
- Internal testing

### Week 3-4: UI Development
- Product management UI
- Merchant testing with beta users
- Feedback iteration

### Week 5-6: Checkout Integration
- Payment flow updates
- Delivery system testing
- Email template refinement

### Week 7-8: Polish & Launch
- Customer portal
- Analytics dashboard
- Documentation
- Public launch

### Post-Launch
- Monitor delivery success rates
- Gather merchant feedback
- Iterate on features
- Add advanced capabilities

---

## Success Metrics

### Business Metrics
- Number of merchants using digital products
- Digital product revenue as % of total
- Average order value (digital vs physical)
- Customer satisfaction scores

### Technical Metrics
- Delivery success rate (target: >99%)
- Download success rate (target: >95%)
- Email delivery rate (target: >98%)
- API response times (<500ms)

### User Experience Metrics
- Time from payment to first download
- Support tickets related to digital products
- Download portal usage
- Merchant adoption rate

---

## Risk Mitigation

### Risk 1: File Storage Costs
**Mitigation:** 
- Implement file size limits (500MB)
- Encourage external link usage
- Monitor storage usage per tenant
- Tier-based storage quotas

### Risk 2: Abuse/Piracy
**Mitigation:**
- Download limits per purchase
- Time-limited access
- Watermarking (future feature)
- DMCA takedown process

### Risk 3: Email Delivery Failures
**Mitigation:**
- Multiple email providers (failover)
- Retry logic with exponential backoff
- Customer portal as backup access method
- Merchant notification of failures

### Risk 4: Payment Gateway Issues
**Mitigation:**
- Support multiple gateways (Square + PayPal)
- Webhook verification and retry
- Manual grant creation for edge cases
- Clear error messages to customers

---

## Documentation Deliverables

1. **Merchant Guide:** "Selling Digital Products on VisibleShelf"
2. **Setup Tutorial:** Video walkthrough of creating first digital product
3. **API Documentation:** Digital products endpoints
4. **Customer FAQ:** "How to access my digital downloads"
5. **Troubleshooting Guide:** Common issues and solutions

---

## Future Enhancements (Post-MVP)

### Phase 6: Advanced Features
- Subscription-based digital products
- Version management and updates
- Customer review system for digital products
- Affiliate/referral program
- Digital product bundles
- Drip content delivery (courses)

### Phase 7: Platform Expansion
- Mobile app download support
- Offline download capability
- Multi-language support
- Currency conversion for international sales
- Tax calculation for digital goods

### Phase 8: Marketplace Features
- Digital product marketplace
- Creator verification badges
- Featured digital products
- Category-specific landing pages
- Search and discovery improvements

---

## Conclusion

This phased implementation plan provides a clear roadmap for adding digital download products to the platform. The approach:

✅ **Builds on existing infrastructure** (payments, orders, emails)
✅ **Maintains backward compatibility** (physical products unchanged)
✅ **Scales with tier system** (feature gating already in place)
✅ **Prioritizes security** (access control, token validation)
✅ **Delivers merchant value** (new revenue stream, zero fulfillment costs)
✅ **Enhances customer experience** (instant delivery, easy access)

**Estimated Total Effort:** 6-8 weeks for MVP
**Team Size:** 2-3 developers
**Risk Level:** Medium (well-defined scope, proven patterns)
**Business Impact:** High (new market segment, competitive advantage)

Ready to proceed with Phase 1 implementation?
