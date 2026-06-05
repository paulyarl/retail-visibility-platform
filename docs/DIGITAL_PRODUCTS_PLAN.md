# Digital Products & Download Pages Implementation Plan

## Overview

This plan implements a comprehensive digital product delivery system with dedicated download pages that are aligned with digital and hybrid items. The system supports multiple delivery methods, access controls, and secure validation.

## Architecture Principles

### Singleton Services Pattern

All API communication must use platform-aligned singleton services:

**Tenant/Private APIs:** Use `AuthenticatedApiSingleton`
- Download page CRUD operations
- Asset management
- Access grant management
- Analytics and reporting

**Public/Customer APIs:** Use `PublicApiSingleton`
- Download page access (public token validation)
- File downloads
- License key activation

**No Direct Fetch:** Never use raw `fetch()` calls. All API requests go through singleton services.

---

## Phase 1: Database Schema & Migration

### 1.1 New Tables

#### `digital_download_pages`
```sql
CREATE TABLE digital_download_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Page Configuration
  page_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, custom, external
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
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, active, archived
  published_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(tenant_id, item_id),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_download_pages_tenant ON digital_download_pages(tenant_id);
CREATE INDEX idx_download_pages_item ON digital_download_pages(item_id);
CREATE INDEX idx_download_pages_slug ON digital_download_pages(slug);
```

#### `digital_downloads`
```sql
CREATE TABLE digital_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  download_page_id UUID NOT NULL REFERENCES digital_download_pages(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  
  -- Asset Information
  asset_name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL, -- file, link, license_key, access_grant
  file_path TEXT, -- Supabase storage path for files
  file_size BIGINT,
  file_mime_type VARCHAR(255),
  external_url TEXT, -- For external links
  license_key_template TEXT, -- Template for generating license keys
  
  -- Download Configuration
  download_method VARCHAR(50) NOT NULL DEFAULT 'direct', -- direct, email, license_key, external
  requires_license_key BOOLEAN DEFAULT false,
  license_key_generator VARCHAR(50), -- uuid, custom, third_party
  
  -- Access Control
  access_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, time_limited, limited_downloads
  max_downloads INTEGER,
  expiry_days INTEGER,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory_items(tenant_id, id)
);

CREATE INDEX idx_downloads_page ON digital_downloads(download_page_id);
CREATE INDEX idx_downloads_item ON digital_downloads(item_id);
```

#### `download_access_grants`
```sql
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
  
  -- License Key (if applicable)
  license_key VARCHAR(255) UNIQUE,
  license_key_activated_at TIMESTAMP,
  license_key_activated_by VARCHAR(255), -- IP address or user agent
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, expired, revoked, exhausted
  revoked_at TIMESTAMP,
  revoked_reason TEXT,
  
  -- Tracking
  first_access_at TIMESTAMP,
  last_access_at TIMESTAMP,
  access_ip_addresses TEXT[], -- Array of IP addresses
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, customer_email, order_id, item_id)
);

CREATE INDEX idx_access_grants_token ON download_access_grants(access_token);
CREATE INDEX idx_access_grants_customer ON download_access_grants(customer_id);
CREATE INDEX idx_access_grants_order ON download_access_grants(order_id);
CREATE INDEX idx_access_grants_email ON download_access_grants(customer_email);
```

#### `download_access_logs`
```sql
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

CREATE INDEX idx_access_logs_grant ON download_access_logs(access_grant_id);
CREATE INDEX idx_access_logs_tenant ON download_access_logs(tenant_id);
CREATE INDEX idx_access_logs_timestamp ON download_access_logs(accessed_at);
```

### 1.2 inventory_items Table (Already Exists)

The `inventory_items` table already has all required digital product fields:

```sql
-- Existing fields (no migration needed):
product_type public.product_type NOT NULL DEFAULT 'physical'::product_type,
digital_delivery_method public.digital_delivery_method NULL,
digital_assets jsonb NULL,
access_duration_days integer NULL,
download_limit integer NULL,
license_type public.license_type NULL,
```

**Note:** We will add a `download_page_id` reference in a separate migration:

```sql
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS download_page_id TEXT REFERENCES digital_download_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_download_page ON inventory_items(download_page_id)
WHERE (download_page_id IS NOT NULL);
```

### 1.3 Migration Script

```bash
# Create migration file
apps/api/prisma/migrations/YYYYMMDDHHMMSS_digital_products_system/migration.sql
```

---

## Phase 2: API Endpoints & Singleton Services

### 2.0 Singleton Services

#### `DownloadPageService` (AuthenticatedApiSingleton)

**Location:** `apps/web/src/services/DownloadPageService.ts`

```typescript
import { AuthenticatedApiSingleton } from '@/lib/singletons/AuthenticatedApiSingleton';

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

export const downloadPageService = new DownloadPageService();
export default downloadPageService;
```

#### `PublicDownloadService` (PublicApiSingleton)

**Location:** `apps/web/src/services/PublicDownloadService.ts`

```typescript
import { PublicApiSingleton } from '@/lib/singletons/PublicApiSingleton';

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

export const publicDownloadService = new PublicDownloadService();
export default publicDownloadService;
```

### 2.1 Download Page Management (Merchant) - Backend Routes

These routes are called by `DownloadPageService` (AuthenticatedApiSingleton).

#### `POST /api/tenants/:tenantId/download-pages`
Create a new download page for a digital item.

**Request Body:**
```json
{
  "itemId": "uuid",
  "title": "Download Your Product",
  "slug": "download-product-name",
  "description": "Access your digital product",
  "pageType": "standard",
  "instructions": "Click the download button below",
  "requireAuthentication": true,
  "requirePurchaseVerification": true,
  "accessDurationDays": 30,
  "downloadLimit": 5
}
```

#### `GET /api/tenants/:tenantId/download-pages`
List all download pages for tenant.

#### `GET /api/tenants/:tenantId/download-pages/:pageId`
Get download page details.

#### `PUT /api/tenants/:tenantId/download-pages/:pageId`
Update download page.

#### `DELETE /api/tenants/:tenantId/download-pages/:pageId`
Delete download page.

#### `POST /api/tenants/:tenantId/download-pages/:pageId/assets`
Add digital asset to download page.

#### `DELETE /api/tenants/:tenantId/download-pages/:pageId/assets/:assetId`
Remove digital asset.

### 2.2 Download Access (Customer) - Backend Routes

These routes are called by `PublicDownloadService` (PublicApiSingleton).

#### `GET /api/download/:accessToken`
Validate access token and return download page data.

**Response:**
```json
{
  "valid": true,
  "page": {
    "title": "Download Your Product",
    "instructions": "...",
    "assets": [
      {
        "id": "uuid",
        "name": "Product Files",
        "type": "file",
        "size": 10485760,
        "downloadUrl": "/api/download/:accessToken/files/:assetId"
      }
    ]
  },
  "access": {
    "expiresAt": "2024-12-31T23:59:59Z",
    "downloadsRemaining": 3,
    "licenseKey": "XXXX-XXXX-XXXX"
  }
}
```

#### `GET /api/download/:accessToken/files/:assetId`
Download a specific file asset.

**Headers:**
- `Range`: Support for partial downloads (resumable)

**Response:**
- File stream with proper headers
- Updates download count
- Logs access

#### `POST /api/download/:accessToken/activate`
Activate a license key for the download.

**Request Body:**
```json
{
  "licenseKey": "XXXX-XXXX-XXXX"
}
```

### 2.3 Purchase Integration - Backend Service

#### Order Processing Hook

**Location:** `apps/api/src/services/OrderProcessingService.ts`

```typescript
async function processDigitalProductAccess(order: Order): Promise<void> {
  // Called after successful payment
  for (const item of order.items) {
    if (item.product_type === 'digital' || item.product_type === 'hybrid') {
      // Create access grant
      const grant = await prisma.download_access_grants.create({
        data: {
          tenant_id: order.tenant_id,
          download_page_id: item.download_page_id,
          item_id: item.id,
          customer_id: order.customer_id,
          customer_email: order.customer_email,
          order_id: order.id,
          order_item_id: item.order_item_id,
          access_token: generateSecureToken(),
          access_granted_at: new Date(),
          access_expires_at: calculateExpiration(item.access_duration_days),
          max_downloads: item.download_limit,
          license_key: item.license_type ? generateLicenseKey() : null,
          status: 'active'
        }
      });
      
      // Store download URL on order item
      await prisma.order_items.update({
        where: { id: item.order_item_id },
        data: {
          download_url: `${process.env.WEB_URL}/download/${grant.access_token}`
        }
      });
    }
  }
}
```

### 2.4 Access Control & Validation Logic

The download page has **full control** over access validation, inheriting settings from the item and enforcing them strictly.

#### Access Validation Flow

```typescript
// Location: apps/api/src/services/DownloadAccessService.ts

interface AccessValidationContext {
  // From access grant
  accessToken: string;
  customerId?: string;
  customerEmail: string;
  orderId: string;
  
  // From download page (inherited from item)
  downloadPageId: string;
  itemId: string;
  
  // Item access control settings (source of truth)
  itemSettings: {
    downloadLimit: number | null;           // From inventory_items.download_limit
    accessDurationDays: number | null;      // From inventory_items.access_duration_days
    licenseType: 'personal' | 'commercial' | 'enterprise' | 'educational' | null;
    digitalDeliveryMethod: 'direct_download' | 'license_key' | 'external_link' | 'access_grant';
  };
  
  // Download page overrides (optional)
  pageSettings: {
    requireAuthentication: boolean;
    requirePurchaseVerification: boolean;
    customDownloadLimit?: number;           // Override item limit if set
    customAccessDurationDays?: number;     // Override item duration if set
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
  
  // 2. Expiration Check (from item.access_duration_days or page override)
  const accessDuration = page.customAccessDurationDays ?? item.access_duration_days;
  if (accessDuration) {
    const expiresAt = new Date(grant.access_granted_at);
    expiresAt.setDate(expiresAt.getDate() + accessDuration);
    
    if (new Date() > expiresAt) {
      // Update grant status
      await updateGrantStatus(grant.id, 'expired');
      return { valid: false, error: 'ACCESS_EXPIRED', message: 'Access period has expired', expiresAt };
    }
  }
  
  // 3. Download Limit Check (from item.download_limit or page override)
  const downloadLimit = page.customDownloadLimit ?? item.download_limit;
  if (downloadLimit && grant.download_count >= downloadLimit) {
    // Update grant status
    await updateGrantStatus(grant.id, 'exhausted');
    return { valid: false, error: 'DOWNLOAD_LIMIT_EXCEEDED', message: 'Download limit reached', limit: downloadLimit };
  }
  
  // 4. Purchase Verification (if required by page)
  if (page.requirePurchaseVerification) {
    const order = await getOrder(grant.orderId);
    if (order.status !== 'completed') {
      return { valid: false, error: 'PURCHASE_NOT_VERIFIED', message: 'Order payment not completed' };
    }
  }
  
  // 5. Authentication Check (if required by page)
  if (page.requireAuthentication && !context.customerId) {
    return { valid: false, error: 'AUTHENTICATION_REQUIRED', message: 'Please sign in to access downloads' };
  }
  
  // 6. License Key Validation (for license_key delivery method)
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
  
  return { 
    valid: true, 
    grant: {
      id: grant.id,
      accessGrantedAt: grant.access_granted_at,
      accessExpiresAt: calculateExpiration(grant, accessDuration),
      downloadsRemaining: downloadLimit ? downloadLimit - grant.download_count : null,
      licenseKey: grant.license_key,
      licenseActivated: !!grant.license_key_activated_at
    },
    item: {
      name: item.name,
      productType: item.product_type,
      deliveryMethod: item.digital_delivery_method
    },
    page: {
      title: page.title,
      instructions: page.instructions,
      supportEmail: page.support_email
    },
    assets: assets.map(a => ({
      id: a.id,
      name: a.asset_name,
      type: a.asset_type,
      size: a.file_size
    }))
  };
}
```

#### License Key Management

```typescript
// Location: apps/api/src/services/LicenseKeyService.ts

interface LicenseKeyConfig {
  licenseType: 'personal' | 'commercial' | 'enterprise' | 'educational';
  deliveryMethod: 'license_key';
  requiresActivation: boolean;
}

// License key generation (called during access grant creation)
function generateLicenseKey(type: LicenseType): string {
  const prefix = {
    personal: 'PERS',
    commercial: 'COMM',
    enterprise: 'ENT',
    educational: 'EDU'
  }[type];
  
  const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 12);
  return `${prefix}-${uuid.slice(0,4)}-${uuid.slice(4,8)}-${uuid.slice(8,12)}`;
}

// License key activation (called when customer activates)
async function activateLicenseKey(
  accessToken: string, 
  licenseKey: string, 
  activationData: { ip: string; userAgent: string }
): Promise<ActivationResult> {
  const grant = await validateAccess(accessToken);
  
  if (!grant.valid) {
    throw new Error('Invalid access token');
  }
  
  if (grant.licenseKey !== licenseKey) {
    throw new Error('License key mismatch');
  }
  
  if (grant.licenseActivated) {
    // Check if same IP (allow re-activation from same device)
    if (grant.activatedBy !== activationData.ip) {
      throw new Error('License already activated on another device');
    }
    return { status: 'already_activated', message: 'License already active on this device' };
  }
  
  // Activate
  await prisma.download_access_grants.update({
    where: { id: grant.id },
    data: {
      license_key_activated_at: new Date(),
      license_key_activated_by: activationData.ip,
      status: 'activated'
    }
  });
  
  return { 
    status: 'activated', 
    message: 'License activated successfully',
    activatedAt: new Date(),
    licenseType: grant.licenseType
  };
}
```

#### Download Tracking & Enforcement

```typescript
// Location: apps/api/src/services/DownloadTrackingService.ts

async function trackDownload(
  accessToken: string,
  assetId: string,
  downloadContext: { ip: string; userAgent: string; referrer?: string }
): Promise<{ allowed: boolean; downloadUrl?: string; error?: string }> {
  // 1. Validate access (enforces all limits)
  const validation = await validateAccess(accessToken);
  
  if (!validation.valid) {
    return { allowed: false, error: validation.error };
  }
  
  // 2. Check if this specific asset was already downloaded (optional dedup)
  const previousDownload = await prisma.download_access_logs.findFirst({
    where: {
      access_grant_id: validation.grant.id,
      download_id: assetId,
      download_successful: true
    }
  });
  
  // 3. Generate signed download URL
  const asset = await getAsset(assetId);
  
  if (asset.asset_type === 'file') {
    // Generate Supabase signed URL (1 hour expiry)
    const downloadUrl = await supabase.storage
      .from('digital-downloads')
      .createSignedUrl(asset.file_path, 3600);
    
    // 4. Log download attempt
    await prisma.download_access_logs.create({
      data: {
        tenant_id: validation.grant.tenantId,
        access_grant_id: validation.grant.id,
        download_id: assetId,
        accessed_at: new Date(),
        ip_address: downloadContext.ip,
        user_agent: downloadContext.userAgent,
        referrer: downloadContext.referrer,
        download_successful: true
      }
    });
    
    // 5. Increment download count
    await prisma.download_access_grants.update({
      where: { id: validation.grant.id },
      data: { 
        download_count: { increment: 1 },
        last_access_at: new Date()
      }
    });
    
    return { allowed: true, downloadUrl: downloadUrl.signedUrl };
  }
  
  if (asset.asset_type === 'link') {
    // External link - just track and return
    await logExternalAccess(validation.grant.id, assetId, downloadContext);
    return { allowed: true, downloadUrl: asset.external_url };
  }
  
  return { allowed: false, error: 'UNSUPPORTED_ASSET_TYPE' };
}
```

### 2.5 Access Control Inheritance Rules

| Setting | Source | Override | Enforcement |
|---------|--------|----------|--------------|
| `download_limit` | `inventory_items.download_limit` | `download_pages.custom_download_limit` | Per-access grant, cumulative across all assets |
| `access_duration_days` | `inventory_items.access_duration_days` | `download_pages.custom_access_duration_days` | From `access_granted_at`, auto-expire |
| `license_type` | `inventory_items.license_type` | No override | Determines key format and activation rules |
| `digital_delivery_method` | `inventory_items.digital_delivery_method` | No override | Determines if license required |
| `require_authentication` | `download_pages.require_authentication` | N/A | Page-level only |
| `require_purchase_verification` | `download_pages.require_purchase_verification` | N/A | Page-level only |

---

### 3.1 Customer Download Page

**Route:** `/download/:accessToken`

**Location:** `apps/web/src/app/download/[accessToken]/page.tsx`

**Uses:** `PublicDownloadService` (PublicApiSingleton)

**Features:**
- Access token validation
- Display product information
- List downloadable assets
- Download progress tracking
- License key display (if applicable)
- Access expiration warning
- Download limit indicator
- Support contact information

**Components:**
```typescript
// DownloadPage.tsx
import { publicDownloadService } from '@/services/PublicDownloadService';

interface DownloadPageProps {
  accessToken: string;
}

// Components:
- DownloadAssetCard
- LicenseKeyDisplay
- AccessExpirationWarning
- DownloadLimitIndicator
- DownloadProgress
- SupportContact
```

### 3.2 Download Page Builder (Merchant)

**Route:** `/t/[tenantId]/items/[itemId]/download-page`

**Location:** `apps/web/src/app/t/[tenantId]/items/[itemId]/download-page/page.tsx`

**Uses:** `DownloadPageService` (AuthenticatedApiSingleton)

**Features:**
- Visual page builder
- Asset upload management
- Access control configuration
- Preview mode
- Publish/unpublish
- Analytics dashboard

**Sections:**
1. **Page Settings**: Title, slug, description, branding
2. **Assets**: Upload files, add external links, configure license keys
3. **Access Control**: Authentication, purchase verification, expiration
4. **Content**: Instructions, thank you message, support info
5. **SEO**: Meta tags, social sharing
6. **Analytics**: Download stats, access logs

---

## Phase 4: Wizard Integration

### 4.0 Wizard Flow Overview

The existing wizard has these steps:
1. **Basic Info** - Name, SKU, description
2. **Product Type** - Currently basic type selection
3. **Pricing** - Price, sale price
4. **Organization** - Category, brand
5. **Media** - Images, video
6. **Content** - Features, specifications
7. **Inventory** - Stock, variants
8. **Review** - Final review

**New Flow for Digital/Hybrid Products:**
1. Basic Info
2. **Product Type** (Enhanced) - Type selector + digital settings panel
3. Pricing
4. Organization
5. Media
6. Content
7. Inventory (Physical stock for hybrid only)
8. **Digital Assets** (New - Step 8 for digital/hybrid)
9. **Download Page** (New - Step 9 for digital/hybrid with download page)
10. Review (Enhanced - Shows digital product summary)

---

### 4.1 Product Type Step Enhancement (Step 2)

**File:** `apps/web/src/components/inventory/wizards/steps/ProductTypeStep.tsx`

**Current State:** Basic product type selection

**Enhanced UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Product Type                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Select the type of product you're creating:                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   📦 Physical │  │   💻 Digital │  │   🔄 Hybrid   │       │
│  │   Tangible    │  │   Downloadable│  │   Physical +  │       │
│  │   product     │  │   product    │  │   Digital     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  [If Digital or Hybrid selected, show panel below]          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Digital Product Settings                            │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                       │    │
│  │  Delivery Method *                                   │    │
│  │  ○ Direct Download                                   │    │
│  │  ○ License Key Activation                            │    │
│  │  ○ External Link                                     │    │
│  │  ○ Access Grant (Special permissions)                │    │
│  │                                                       │    │
│  │  [If License Key selected]                           │    │
│  │  ┌─────────────────────────────────────────────┐     │    │
│  │  │ License Type:                                │     │    │
│  │  │ ○ Personal (Single user)                     │     │    │
│  │  │ ○ Commercial (Business use)                  │     │    │
│  │  │ ○ Enterprise (Multiple seats)                │     │    │
│  │  │ ○ Educational (Academic use)                │     │    │
│  │  └─────────────────────────────────────────────┘     │    │
│  │                                                       │    │
│  │  Access Control                                       │    │
│  │  ┌─────────────────────────────────────────────┐     │    │
│  │  │ Access Duration (days): [    ]               │     │    │
│  │  │ ☐ Unlimited access                           │     │    │
│  │  │                                              │     │    │
│  │  │ Download Limit: [    ]                       │     │    │
│  │  │ ☐ Unlimited downloads                        │     │    │
│  │  └─────────────────────────────────────────────┘     │    │
│  │                                                       │    │
│  │  ☑ Create Download Page                              │    │
│  │     Automatically create a customer download page     │    │
│  │     for this product                                 │    │
│  │                                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Data Structure:**
```typescript
interface ProductTypeStepData {
  // Basic type selection
  productType: 'physical' | 'digital' | 'hybrid';
  
  // Digital settings (only for digital/hybrid)
  digitalSettings?: {
    deliveryMethod: 'direct_download' | 'license_key' | 'external_link' | 'access_grant';
    
    // License settings (only for license_key)
    licenseType?: 'personal' | 'commercial' | 'enterprise' | 'educational';
    
    // Access control
    accessDurationDays: number | null;  // null = unlimited
    downloadLimit: number | null;        // null = unlimited
    
    // Download page creation
    createDownloadPage: boolean;
    
    // Pre-fetched from existing item (edit mode)
    existingDownloadPageId?: string;
  };
}
```

**Component Implementation:**

```typescript
// apps/web/src/components/inventory/wizards/steps/ProductTypeStep.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Info, Package, Monitor, Layers } from 'lucide-react';

interface ProductTypeStepProps {
  data: ProductTypeStepData;
  onChange: (data: Partial<ProductTypeStepData>) => void;
  isEditMode?: boolean;
  existingItem?: any;
}

export default function ProductTypeStep({ data, onChange, isEditMode, existingItem }: ProductTypeStepProps) {
  const [showDigitalSettings, setShowDigitalSettings] = useState(false);
  
  // Load existing digital settings in edit mode
  useEffect(() => {
    if (isEditMode && existingItem) {
      const isDigital = existingItem.product_type === 'digital' || existingItem.product_type === 'hybrid';
      setShowDigitalSettings(isDigital);
      
      if (isDigital) {
        onChange({
          productType: existingItem.product_type,
          digitalSettings: {
            deliveryMethod: existingItem.digital_delivery_method || 'direct_download',
            licenseType: existingItem.license_type || undefined,
            accessDurationDays: existingItem.access_duration_days || null,
            downloadLimit: existingItem.download_limit || null,
            createDownloadPage: !!existingItem.download_page_id,
            existingDownloadPageId: existingItem.download_page_id || undefined
          }
        });
      }
    }
  }, [isEditMode, existingItem]);
  
  const handleProductTypeChange = (type: 'physical' | 'digital' | 'hybrid') => {
    const isDigital = type === 'digital' || type === 'hybrid';
    setShowDigitalSettings(isDigital);
    
    onChange({ 
      productType: type,
      // Reset digital settings if switching to physical
      ...(isDigital ? {} : { digitalSettings: undefined })
    });
  };
  
  const handleDigitalSettingChange = (updates: Partial<ProductTypeStepData['digitalSettings']>) => {
    onChange({
      digitalSettings: {
        ...data.digitalSettings,
        ...updates
      }
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Product Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Product Type</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={data.productType}
            onValueChange={handleProductTypeChange}
            className="grid grid-cols-3 gap-4"
          >
            <Card 
              className={`cursor-pointer ${data.productType === 'physical' ? 'border-primary' : ''}`}
              onClick={() => handleProductTypeChange('physical')}
            >
              <CardContent className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                <h3 className="font-semibold">Physical</h3>
                <p className="text-sm text-gray-600 mt-1">Tangible product</p>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer ${data.productType === 'digital' ? 'border-primary' : ''}`}
              onClick={() => handleProductTypeChange('digital')}
            >
              <CardContent className="p-6 text-center">
                <Monitor className="h-12 w-12 mx-auto mb-3 text-purple-600" />
                <h3 className="font-semibold">Digital</h3>
                <p className="text-sm text-gray-600 mt-1">Downloadable product</p>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer ${data.productType === 'hybrid' ? 'border-primary' : ''}`}
              onClick={() => handleProductTypeChange('hybrid')}
            >
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
              <RadioGroup
                value={data.digitalSettings?.deliveryMethod}
                onValueChange={(method) => handleDigitalSettingChange({ deliveryMethod: method })}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="direct_download" id="direct" />
                  <Label htmlFor="direct" className="cursor-pointer">
                    <div className="font-medium">Direct Download</div>
                    <div className="text-sm text-gray-600">Immediate file access</div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="license_key" id="license" />
                  <Label htmlFor="license" className="cursor-pointer">
                    <div className="font-medium">License Key</div>
                    <div className="text-sm text-gray-600">Activation required</div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="external_link" id="external" />
                  <Label htmlFor="external" className="cursor-pointer">
                    <div className="font-medium">External Link</div>
                    <div className="text-sm text-gray-600">Third-party hosting</div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="access_grant" id="grant" />
                  <Label htmlFor="grant" className="cursor-pointer">
                    <div className="font-medium">Access Grant</div>
                    <div className="text-sm text-gray-600">Special permissions</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* License Type (only for license_key) */}
            {data.digitalSettings?.deliveryMethod === 'license_key' && (
              <div className="space-y-3">
                <Label>License Type *</Label>
                <RadioGroup
                  value={data.digitalSettings?.licenseType}
                  onValueChange={(type) => handleDigitalSettingChange({ licenseType: type as any })}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="personal" id="personal" />
                    <Label htmlFor="personal">Personal (Single user)</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="commercial" id="commercial" />
                    <Label htmlFor="commercial">Commercial (Business)</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="enterprise" id="enterprise" />
                    <Label htmlFor="enterprise">Enterprise (Multi-seat)</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="educational" id="educational" />
                    <Label htmlFor="educational">Educational (Academic)</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            
            {/* Access Control */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Access Control</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Access Duration (days)</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="duration"
                      type="number"
                      placeholder="Unlimited"
                      value={data.digitalSettings?.accessDurationDays || ''}
                      onChange={(e) => handleDigitalSettingChange({ 
                        accessDurationDays: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      disabled={data.digitalSettings?.accessDurationDays === null}
                    />
                    <Switch
                      checked={data.digitalSettings?.accessDurationDays !== null}
                      onCheckedChange={(checked) => handleDigitalSettingChange({ 
                        accessDurationDays: checked ? 30 : null 
                      })}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Leave unchecked for unlimited access</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="limit">Download Limit</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="limit"
                      type="number"
                      placeholder="Unlimited"
                      value={data.digitalSettings?.downloadLimit || ''}
                      onChange={(e) => handleDigitalSettingChange({ 
                        downloadLimit: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      disabled={data.digitalSettings?.downloadLimit === null}
                    />
                    <Switch
                      checked={data.digitalSettings?.downloadLimit !== null}
                      onCheckedChange={(checked) => handleDigitalSettingChange({ 
                        downloadLimit: checked ? 5 : null 
                      })}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Leave unchecked for unlimited downloads</p>
                </div>
              </div>
            </div>
            
            {/* Download Page Creation */}
            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
              <Switch
                checked={data.digitalSettings?.createDownloadPage}
                onCheckedChange={(checked) => handleDigitalSettingChange({ 
                  createDownloadPage: checked 
                })}
              />
              <div className="flex-1">
                <Label className="font-semibold cursor-pointer">
                  Create Download Page
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically create a customer download page for this product.
                  The page will be accessible after purchase.
                </p>
                {data.digitalSettings?.existingDownloadPageId && (
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This product already has a download page. 
                      It will be updated with your changes.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 4.2 New Digital Assets Step (Step 8)

**File:** `apps/web/src/components/inventory/wizards/steps/DigitalAssetsStep.tsx`

**Position:** Step 8 - only shown for digital/hybrid products

**Conditional Display:** Shown when `productType === 'digital' || productType === 'hybrid'`

**Purpose:** Manage all digital assets for the product before creating the download page.

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Digital Assets                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Upload and manage the digital files for your product.      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Upload Files                                        │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │  📁 Drop files here or click to upload         │  │    │
│  │  │     Supported: ZIP, PDF, MP4, MP3, etc.        │  │    │
│  │  │     Max size: 500MB per file                   │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Add External Links                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Link Name: [                                    ]   │    │
│  │  URL:        [                                    ]   │    │
│  │  ☐ Track access (count clicks)                     │    │
│  │  [+ Add Link]                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Uploaded Assets (3)                              [Preview] │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  📄 Product Files.zip (45.2 MB)        [Delete]     │    │
│  │  📄 User Manual.pdf (2.1 MB)           [Delete]     │    │
│  │  🔗 Video Tutorial (external)          [Delete]     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ℹ️ These assets will be available on the download page.    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Data Structure:**
```typescript
interface DigitalAssetsStepData {
  assets: Array<{
    id: string;
    name: string;
    type: 'file' | 'link' | 'license_key';
    
    // For files
    file?: {
      path: string;          // Supabase storage path
      size: number;          // Bytes
      mimeType: string;      // MIME type
      uploadedAt: Date;
    };
    
    // For links
    externalUrl?: string;
    trackAccess?: boolean;
    
    // For license keys (if deliveryMethod === 'license_key')
    licenseKeyTemplate?: string;
    
    // Display settings
    displayOrder: number;
    isPrimary: boolean;
  }>;
  
  // Summary stats
  totalSize: number;         // Total size in bytes
  assetCount: number;
}
```

**Component Implementation:**

```typescript
// apps/web/src/components/inventory/wizards/steps/DigitalAssetsStep.tsx

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { 
  Upload, 
  FileText, 
  Link as LinkIcon, 
  Trash2, 
  Eye,
  Info,
  Loader2
} from 'lucide-react';
import { uploadImage } from '@/lib/image-upload';
import { itemsService } from '@/services/ItemsSingletonService';

interface DigitalAssetsStepProps {
  data: DigitalAssetsStepData;
  onChange: (data: Partial<DigitalAssetsStepData>) => void;
  deliveryMethod: string;  // From Step 2
  isEditMode?: boolean;
  existingItem?: any;
}

export default function DigitalAssetsStep({ 
  data, 
  onChange, 
  deliveryMethod,
  isEditMode,
  existingItem 
}: DigitalAssetsStepProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [externalLinkName, setExternalLinkName] = useState('');
  const [externalLinkUrl, setExternalLinkUrl] = useState('');
  const [trackExternalLink, setTrackExternalLink] = useState(false);
  
  // Load existing assets in edit mode
  useState(() => {
    if (isEditMode && existingItem?.digital_assets) {
      const assets = existingItem.digital_assets.map((asset: any, idx: number) => ({
        id: asset.id || `existing-${idx}`,
        name: asset.name,
        type: asset.type,
        file: asset.file,
        externalUrl: asset.external_url,
        trackAccess: asset.track_access,
        displayOrder: idx,
        isPrimary: idx === 0
      }));
      
      onChange({ assets });
    }
  }, [isEditMode, existingItem]);
  
  const handleFileUpload = useCallback(async (files: FileList) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const newAssets = [...data.assets];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file size (500MB max)
        if (file.size > 500 * 1024 * 1024) {
          alert(`File ${file.name} exceeds 500MB limit`);
          continue;
        }
        
        // Upload to Supabase
        const result = await uploadImage(
          file,
          `digital-assets/${Date.now()}-${file.name}`,
          (progress) => setUploadProgress(progress)
        );
        
        if (result) {
          newAssets.push({
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            type: 'file',
            file: {
              path: result.path,
              size: file.size,
              mimeType: file.type,
              uploadedAt: new Date()
            },
            displayOrder: newAssets.length,
            isPrimary: newAssets.length === 0
          });
        }
      }
      
      onChange({ 
        assets: newAssets,
        totalSize: newAssets.reduce((sum, a) => sum + (a.file?.size || 0), 0),
        assetCount: newAssets.length
      });
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [data.assets, onChange]);
  
  const handleAddExternalLink = () => {
    if (!externalLinkName || !externalLinkUrl) return;
    
    const newAssets = [...data.assets, {
      id: `link-${Date.now()}`,
      name: externalLinkName,
      type: 'link',
      externalUrl: externalLinkUrl,
      trackAccess: trackExternalLink,
      displayOrder: data.assets.length,
      isPrimary: false
    }];
    
    onChange({ 
      assets: newAssets,
      assetCount: newAssets.length
    });
    
    setExternalLinkName('');
    setExternalLinkUrl('');
    setTrackExternalLink(false);
  };
  
  const handleRemoveAsset = (assetId: string) => {
    const newAssets = data.assets.filter(a => a.id !== assetId);
    
    onChange({ 
      assets: newAssets.map((a, idx) => ({ ...a, displayOrder: idx })),
      totalSize: newAssets.reduce((sum, a) => sum + (a.file?.size || 0), 0),
      assetCount: newAssets.length
    });
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  
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
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
            {isUploading ? (
              <div className="space-y-2">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <p>Uploading... {uploadProgress}%</p>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">Drop files here or click to upload</p>
                <p className="text-sm text-gray-600 mt-1">
                  Supported: ZIP, PDF, MP4, MP3, etc.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Max size: 500MB per file
                </p>
              </>
            )}
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
            <div className="space-y-2">
              <Label htmlFor="link-name">Link Name</Label>
              <Input
                id="link-name"
                placeholder="Video Tutorial"
                value={externalLinkName}
                onChange={(e) => setExternalLinkName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://..."
                value={externalLinkUrl}
                onChange={(e) => setExternalLinkUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                checked={trackExternalLink}
                onCheckedChange={setTrackExternalLink}
              />
              <Label>Track access (count clicks)</Label>
            </div>
            <Button 
              onClick={handleAddExternalLink}
              disabled={!externalLinkName || !externalLinkUrl}
            >
              Add Link
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Uploaded Assets */}
      {data.assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Uploaded Assets ({data.assets.length})
              </span>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.assets.map((asset) => (
                <div 
                  key={asset.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {asset.type === 'file' ? (
                      <FileText className="h-5 w-5 text-blue-600" />
                    ) : (
                      <LinkIcon className="h-5 w-5 text-green-600" />
                    )}
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-gray-600">
                        {asset.type === 'file' 
                          ? formatFileSize(asset.file?.size || 0)
                          : 'External link'}
                      </p>
                    </div>
                    {asset.isPrimary && (
                      <Badge variant="secondary">Primary</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAsset(asset.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These assets will be available on the download page after purchase.
          {deliveryMethod === 'license_key' && ' License keys will be auto-generated for each purchase.'}
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

---

### 4.3 Download Page Step (Step 9)

**File:** `apps/web/src/components/inventory/wizards/steps/DownloadPageStep.tsx`

**Position:** Step 9 - only shown for digital/hybrid products with `createDownloadPage: true`

**Conditional Display:** Shown when `digitalSettings.createDownloadPage === true`

**Purpose:** Configure the customer-facing download page that will be created automatically.

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Download Page Configuration                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Page Settings                                       │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Page Title: [Download Your Product            ]     │    │
│  │  Page Slug:  [download-product-name            ] ✓   │    │
│  │  Description: [                               ]     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Content                                             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Instructions:                                       │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ Click the download button below to access     │  │    │
│  │  │ your files...                                 │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  │                                                       │    │
│  │  Thank You Message:                                  │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ Thank you for your purchase! Enjoy your...    │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  │                                                       │    │
│  │  Support Email: [support@example.com         ]      │    │
│  │  Support URL:   [https://...                 ]      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Access Control (Inherited from Product)            │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  ☑ Require Authentication                           │    │
│  │  ☑ Require Purchase Verification                    │    │
│  │                                                       │    │
│  │  Access Duration: 30 days (from product)            │    │
│  │  Download Limit: 5 downloads (from product)          │    │
│  │                                                       │    │
│  │  Override Settings:                                  │    │
│  │  ☐ Custom Access Duration: [   ] days               │    │
│  │  ☐ Custom Download Limit: [   ] downloads           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Branding (Optional)                                 │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Logo URL:   [                               ]      │    │
│  │  Banner URL: [                               ]      │    │
│  │  Brand Color: [ #3B82F6              ] 🎨           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Assets to Include                        [Preview]  │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  ☑ Product Files.zip (Primary)            [↑][↓]    │    │
│  │  ☑ User Manual.pdf                        [↑][↓]    │    │
│  │  ☑ Video Tutorial (external)              [↑][↓]    │    │
│  │                                                       │    │
│  │  All assets from previous step are included.        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  [Preview Download Page]  [Save as Draft]  [Publish]        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Data Structure:**
```typescript
interface DownloadPageStepData {
  // Page Settings
  title: string;
  slug: string;
  description?: string;
  
  // Content
  instructions?: string;
  thankYouMessage?: string;
  supportEmail?: string;
  supportUrl?: string;
  
  // Access Control
  requireAuthentication: boolean;
  requirePurchaseVerification: boolean;
  
  // Overrides (optional, null = use product settings)
  customAccessDurationDays?: number | null;
  customDownloadLimit?: number | null;
  
  // Branding
  branding: {
    logoUrl?: string;
    bannerUrl?: string;
    brandColor?: string;
  };
  
  // Assets (from DigitalAssetsStep)
  assets: Array<{
    id: string;
    name: string;
    type: 'file' | 'link' | 'license_key';
    displayOrder: number;
    include: boolean;  // Allow excluding specific assets
  }>;
  
  // Status
  status: 'draft' | 'active';
}
```

**Component Implementation:**

```typescript
// apps/web/src/components/inventory/wizards/steps/DownloadPageStep.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import {
  Settings,
  FileText,
  Shield,
  Palette,
  Eye,
  Save,
  Send,
  Info,
  GripVertical,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface DownloadPageStepProps {
  data: DownloadPageStepData;
  onChange: (data: Partial<DownloadPageStepData>) => void;
  
  // From previous steps
  productName: string;
  productSettings: {
    accessDurationDays: number | null;
    downloadLimit: number | null;
    deliveryMethod: string;
    licenseType?: string;
  };
  digitalAssets: Array<any>;  // From DigitalAssetsStep
  
  isEditMode?: boolean;
  existingDownloadPage?: any;
}

export default function DownloadPageStep({
  data,
  onChange,
  productName,
  productSettings,
  digitalAssets,
  isEditMode,
  existingDownloadPage
}: DownloadPageStepProps) {
  const [showPreview, setShowPreview] = useState(false);
  
  // Initialize with product name as default title
  useEffect(() => {
    if (!data.title && productName) {
      onChange({
        title: `Download Your ${productName}`,
        slug: generateSlug(productName),
        requireAuthentication: true,
        requirePurchaseVerification: true,
        assets: digitalAssets.map((a, idx) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          displayOrder: idx,
          include: true
        }))
      });
    }
  }, [productName, digitalAssets]);
  
  // Load existing download page in edit mode
  useEffect(() => {
    if (isEditMode && existingDownloadPage) {
      onChange({
        title: existingDownloadPage.title,
        slug: existingDownloadPage.slug,
        description: existingDownloadPage.description,
        instructions: existingDownloadPage.instructions,
        thankYouMessage: existingDownloadPage.thank_you_message,
        supportEmail: existingDownloadPage.support_email,
        supportUrl: existingDownloadPage.support_url,
        requireAuthentication: existingDownloadPage.require_authentication,
        requirePurchaseVerification: existingDownloadPage.require_purchase_verification,
        customAccessDurationDays: existingDownloadPage.custom_access_duration_days,
        customDownloadLimit: existingDownloadPage.custom_download_limit,
        branding: existingDownloadPage.branding || {},
        status: existingDownloadPage.status
      });
    }
  }, [isEditMode, existingDownloadPage]);
  
  const generateSlug = (name: string) => {
    return `download-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  };
  
  const handleAssetReorder = (assetId: string, direction: 'up' | 'down') => {
    const assets = [...data.assets];
    const idx = assets.findIndex(a => a.id === assetId);
    
    if (direction === 'up' && idx > 0) {
      [assets[idx - 1], assets[idx]] = [assets[idx], assets[idx - 1]];
    } else if (direction === 'down' && idx < assets.length - 1) {
      [assets[idx], assets[idx + 1]] = [assets[idx + 1], assets[idx]];
    }
    
    onChange({
      assets: assets.map((a, idx) => ({ ...a, displayOrder: idx }))
    });
  };
  
  const handleAssetToggle = (assetId: string) => {
    onChange({
      assets: data.assets.map(a => 
        a.id === assetId ? { ...a, include: !a.include } : a
      )
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Page Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Page Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Page Title *</Label>
            <Input
              id="title"
              value={data.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Download Your Product"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slug">Page Slug *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="slug"
                value={data.slug}
                onChange={(e) => onChange({ slug: e.target.value })}
                placeholder="download-product-name"
              />
              <Badge variant="secondary">Unique</Badge>
            </div>
            <p className="text-xs text-gray-500">
              URL: /download/{data.slug}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={data.description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Access your purchased digital product"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={data.instructions || ''}
              onChange={(e) => onChange({ instructions: e.target.value })}
              placeholder="Click the download button below to access your files..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="thankYou">Thank You Message</Label>
            <Textarea
              id="thankYou"
              value={data.thankYouMessage || ''}
              onChange={(e) => onChange({ thankYouMessage: e.target.value })}
              placeholder="Thank you for your purchase! Enjoy your..."
              rows={2}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={data.supportEmail || ''}
                onChange={(e) => onChange({ supportEmail: e.target.value })}
                placeholder="support@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportUrl">Support URL</Label>
              <Input
                id="supportUrl"
                type="url"
                value={data.supportUrl || ''}
                onChange={(e) => onChange({ supportUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Access control settings are inherited from the product configuration.
              You can override them below if needed.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Require Authentication</Label>
              <Switch
                checked={data.requireAuthentication}
                onCheckedChange={(checked) => onChange({ requireAuthentication: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Require Purchase Verification</Label>
              <Switch
                checked={data.requirePurchaseVerification}
                onCheckedChange={(checked) => onChange({ requirePurchaseVerification: checked })}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <Label className="text-base font-semibold">Inherited from Product</Label>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Access Duration:</span>
                <span className="ml-2 font-medium">
                  {productSettings.accessDurationDays 
                    ? `${productSettings.accessDurationDays} days`
                    : 'Unlimited'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Download Limit:</span>
                <span className="ml-2 font-medium">
                  {productSettings.downloadLimit 
                    ? `${productSettings.downloadLimit} downloads`
                    : 'Unlimited'}
                </span>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <Label className="text-base font-semibold">Override Settings (Optional)</Label>
            
            <div className="flex items-center gap-4">
              <Switch
                checked={data.customAccessDurationDays !== null && data.customAccessDurationDays !== undefined}
                onCheckedChange={(checked) => onChange({ 
                  customAccessDurationDays: checked ? productSettings.accessDurationDays || 30 : null 
                })}
              />
              <Label>Custom Access Duration</Label>
              {data.customAccessDurationDays !== null && data.customAccessDurationDays !== undefined && (
                <Input
                  type="number"
                  value={data.customAccessDurationDays}
                  onChange={(e) => onChange({ customAccessDurationDays: parseInt(e.target.value) })}
                  className="w-24"
                />
              )}
              <span className="text-sm text-gray-600">days</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Switch
                checked={data.customDownloadLimit !== null && data.customDownloadLimit !== undefined}
                onCheckedChange={(checked) => onChange({ 
                  customDownloadLimit: checked ? productSettings.downloadLimit || 5 : null 
                })}
              />
              <Label>Custom Download Limit</Label>
              {data.customDownloadLimit !== null && data.customDownloadLimit !== undefined && (
                <Input
                  type="number"
                  value={data.customDownloadLimit}
                  onChange={(e) => onChange({ customDownloadLimit: parseInt(e.target.value) })}
                  className="w-24"
                />
              )}
              <span className="text-sm text-gray-600">downloads</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                type="url"
                value={data.branding?.logoUrl || ''}
                onChange={(e) => onChange({ 
                  branding: { ...data.branding, logoUrl: e.target.value } 
                })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner">Banner URL</Label>
              <Input
                id="banner"
                type="url"
                value={data.branding?.bannerUrl || ''}
                onChange={(e) => onChange({ 
                  branding: { ...data.branding, bannerUrl: e.target.value } 
                })}
                placeholder="https://..."
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="color">Brand Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="color"
                type="color"
                value={data.branding?.brandColor || '#3B82F6'}
                onChange={(e) => onChange({ 
                  branding: { ...data.branding, brandColor: e.target.value } 
                })}
                className="w-16 h-10"
              />
              <Input
                value={data.branding?.brandColor || '#3B82F6'}
                onChange={(e) => onChange({ 
                  branding: { ...data.branding, brandColor: e.target.value } 
                })}
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assets to Include
            </span>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.assets.map((asset, idx) => (
              <div 
                key={asset.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">\n                  <input
                    type="checkbox"
                    checked={asset.include}
                    onChange={() => handleAssetToggle(asset.id)}
                    className="w-4 h-4"
                  />
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-sm text-gray-600">{asset.type}</p>
                  </div>
                  {idx === 0 && <Badge variant="secondary">Primary</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAssetReorder(asset.id, 'up')}
                    disabled={idx === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAssetReorder(asset.id, 'down')}
                    disabled={idx === data.assets.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            All assets from the previous step are included by default. 
            Uncheck to exclude specific assets.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 4.4 Review Step Enhancement (Step 10)

**File:** `apps/web/src/components/inventory/wizards/steps/ReviewStep.tsx`

**Current State:** Shows summary of all wizard steps

**Enhancements for Digital Products:**

```typescript
// Add digital product summary section

{wizardData.productType !== 'physical' && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Monitor className="h-5 w-5" />
        Digital Product Settings
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Delivery Method */}
      <div className="flex justify-between">
        <span className="text-sm text-gray-600">Delivery Method:</span>
        <Badge variant="default">
          {wizardData.digitalSettings.deliveryMethod.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>
      
      {/* License Type (if applicable) */}
      {wizardData.digitalSettings.licenseType && (
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">License Type:</span>
          <Badge variant="secondary">
            {wizardData.digitalSettings.licenseType.toUpperCase()}
          </Badge>
        </div>
      )}
      
      {/* Access Control */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Access Duration:</span>
          <span className="text-sm font-medium">
            {wizardData.digitalSettings.accessDurationDays 
              ? `${wizardData.digitalSettings.accessDurationDays} days`
              : 'Unlimited'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Download Limit:</span>
          <span className="text-sm font-medium">
            {wizardData.digitalSettings.downloadLimit 
              ? `${wizardData.digitalSettings.downloadLimit} downloads`
              : 'Unlimited'}
          </span>
        </div>
      </div>
      
      {/* Assets Summary */}
      {wizardData.digitalAssets && wizardData.digitalAssets.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Digital Assets:</span>
            <Badge variant="secondary">
              {wizardData.digitalAssets.length} files
            </Badge>
          </div>
          <div className="space-y-1">
            {wizardData.digitalAssets.slice(0, 3).map(asset => (
              <div key={asset.id} className="flex items-center gap-2 text-xs">
                <FileText className="h-3 w-3" />
                <span>{asset.name}</span>
              </div>
            ))}
            {wizardData.digitalAssets.length > 3 && (
              <p className="text-xs text-gray-500">
                +{wizardData.digitalAssets.length - 3} more...
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Download Page */}
      {wizardData.digitalSettings.createDownloadPage && (
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Download Page:</span>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600">
                Will be created
              </Badge>
              {wizardData.downloadPage && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.open(`/download/${wizardData.downloadPage.slug}`, '_blank')}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {wizardData.downloadPage?.title || 'Download Your Product'}
          </p>
          <p className="text-xs text-gray-500">
            /download/{wizardData.downloadPage?.slug || 'product-slug'}
          </p>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

### 4.5 Wizard Data Flow Integration

**Main Wizard Component Update:**

```typescript
// apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx

interface WizardData {
  // Existing fields...
  
  // Digital Product Fields (from Step 2)
  productType: 'physical' | 'digital' | 'hybrid';
  digitalSettings?: {
    deliveryMethod: 'direct_download' | 'license_key' | 'external_link' | 'access_grant';
    licenseType?: 'personal' | 'commercial' | 'enterprise' | 'educational';
    accessDurationDays: number | null;
    downloadLimit: number | null;
    createDownloadPage: boolean;
    existingDownloadPageId?: string;
  };
  
  // Digital Assets (from Step 8)
  digitalAssets?: Array<{
    id: string;
    name: string;
    type: 'file' | 'link' | 'license_key';
    file?: any;
    externalUrl?: string;
    displayOrder: number;
    isPrimary: boolean;
  }>;
  
  // Download Page (from Step 9)
  downloadPage?: {
    title: string;
    slug: string;
    description?: string;
    instructions?: string;
    thankYouMessage?: string;
    supportEmail?: string;
    supportUrl?: string;
    requireAuthentication: boolean;
    requirePurchaseVerification: boolean;
    customAccessDurationDays?: number | null;
    customDownloadLimit?: number | null;
    branding?: any;
    assets: Array<any>;
    status: 'draft' | 'active';
  };
}

// Step visibility logic
const shouldShowDigitalAssetsStep = wizardData.productType === 'digital' || wizardData.productType === 'hybrid';
const shouldShowDownloadPageStep = shouldShowDigitalAssetsStep && wizardData.digitalSettings?.createDownloadPage;

// Step configuration
const steps = [
  { id: 'basic-info', title: 'Basic Info', component: BasicInfoStep },
  { id: 'product-type', title: 'Product Type', component: ProductTypeStep },
  { id: 'pricing', title: 'Pricing', component: PricingStep },
  { id: 'organization', title: 'Organization', component: OrganizationStep },
  { id: 'media', title: 'Media', component: MediaStep },
  { id: 'content', title: 'Content', component: ContentStep },
  { id: 'inventory', title: 'Inventory', component: InventoryStep, 
    show: wizardData.productType !== 'digital' }, // Hide for digital-only
  { id: 'digital-assets', title: 'Digital Assets', component: DigitalAssetsStep,
    show: shouldShowDigitalAssetsStep,
  },
  { id: 'download-page', title: 'Download Page', component: DownloadPageStep,
    show: shouldShowDownloadPageStep,
  },
  { id: 'review', title: 'Review', component: ReviewStep },
];
```

### 4.6 Save Handler Integration

**On Wizard Completion:**

```typescript
// apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx

const handleSave = async () => {
  try {
    setIsSaving(true);
    
    // 1. Save inventory item
    const itemData = {
      ...wizardData.basicInfo,
      ...wizardData.pricing,
      ...wizardData.organization,
      ...wizardData.media,
      ...wizardData.content,
      product_type: wizardData.productType,
      
      // Digital fields
      ...(wizardData.productType !== 'physical' && {
        digital_delivery_method: wizardData.digitalSettings?.deliveryMethod,
        license_type: wizardData.digitalSettings?.licenseType,
        access_duration_days: wizardData.digitalSettings?.accessDurationDays,
        download_limit: wizardData.digitalSettings?.downloadLimit,
        digital_assets: wizardData.digitalAssets?.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          file: a.file,
          external_url: a.externalUrl,
          display_order: a.displayOrder,
          is_primary: a.isPrimary
        }))
      })
    };
    
    const item = isEditMode
      ? await itemsService.updateItem(tenantId, itemId, itemData)
      : await itemsService.createItem(tenantId, itemData);
    
    // 2. Create/Update download page (if applicable)
    if (wizardData.digitalSettings?.createDownloadPage && wizardData.downloadPage) {
      const pageData = {
        item_id: item.id,
        title: wizardData.downloadPage.title,
        slug: wizardData.downloadPage.slug,
        description: wizardData.downloadPage.description,
        instructions: wizardData.downloadPage.instructions,
        thank_you_message: wizardData.downloadPage.thankYouMessage,
        support_email: wizardData.downloadPage.supportEmail,
        support_url: wizardData.downloadPage.supportUrl,
        require_authentication: wizardData.downloadPage.requireAuthentication,
        require_purchase_verification: wizardData.downloadPage.requirePurchaseVerification,
        custom_access_duration_days: wizardData.downloadPage.customAccessDurationDays,
        custom_download_limit: wizardData.downloadPage.customDownloadLimit,
        branding: wizardData.downloadPage.branding,
        assets: wizardData.downloadPage.assets
          .filter(a => a.include)
          .map(a => ({
            asset_id: a.id,
            display_order: a.displayOrder
          })),
        status: wizardData.downloadPage.status
      };
      
      if (wizardData.digitalSettings.existingDownloadPageId) {
        await downloadPageService.updateDownloadPage(
          tenantId, 
          wizardData.digitalSettings.existingDownloadPageId, 
          pageData
        );
      } else {
        const page = await downloadPageService.createDownloadPage(tenantId, pageData);
        
        // Link download page to item
        await itemsService.updateItem(tenantId, item.id, {
          download_page_id: page.id
        });
      }
    }
    
    // 3. Success
    toast.success(isEditMode ? 'Item updated successfully' : 'Item created successfully');
    router.push(`/t/${tenantId}/items/${item.id}`);
    
  } catch (error) {
    console.error('Failed to save item:', error);
    toast.error('Failed to save item. Please try again.');
  } finally {
    setIsSaving(false);
  }
};
```

---

## Phase 5: Purchase Flow Integration

### 5.1 Order Confirmation Page

**File:** `apps/web/src/app/t/[tenantId]/orders/[orderId]/page.tsx`

**Changes:**
- Detect digital items in order
- Display download links for digital items
- Show access expiration dates
- Display license keys (if generated immediately)

**Component:**
```typescript
<DigitalProductSection>
  {digitalItems.map(item => (
    <DownloadLinkCard
      key={item.id}
      item={item}
      downloadUrl={item.downloadUrl}
      expiresAt={item.accessExpiresAt}
    />
  ))}
</DigitalProductSection>
```

### 5.2 Order Confirmation Email

**Template:** `apps/api/src/templates/emails/order-confirmation.tsx`

**Changes:**
- Add digital products section
- Include download links
- Show access instructions
- Display expiration warnings

### 5.3 Customer Order History

**File:** `apps/web/src/app/t/[tenantId]/account/orders/page.tsx`

**Changes:**
- Show download status for digital items
- Display remaining downloads
- Show access expiration
- Provide re-download links

---

## Phase 6: Security & Validation

### 6.1 Access Token Security

**Implementation:**
- UUID v4 tokens (cryptographically random)
- Token hashing in database (never store plain)
- Token expiration enforcement
- Single-use tokens for sensitive operations
- Rate limiting per token

**Validation:**
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
  
  // 3. Check if exists
  if (!grant) {
    throw new InvalidTokenError();
  }
  
  // 4. Check status
  if (grant.status !== 'active') {
    throw new AccessRevokedError(grant.status);
  }
  
  // 5. Check expiration
  if (grant.accessExpiresAt && grant.accessExpiresAt < new Date()) {
    throw new AccessExpiredError();
  }
  
  // 6. Check download limit
  if (grant.maxDownloads && grant.downloadCount >= grant.maxDownloads) {
    throw new DownloadLimitExceededError();
  }
  
  // 7. Check purchase verification (if required)
  if (grant.requiresPurchaseVerification) {
    const order = await db.orders.findUnique(grant.orderId);
    if (order.status !== 'completed') {
      throw new PurchaseNotVerifiedError();
    }
  }
  
  return grant;
}
```

### 6.2 Download Security

**File Streaming:**
- Use Supabase signed URLs (time-limited)
- Never expose storage paths to clients
- Support Range headers for resumable downloads
- Track download progress
- Validate file integrity (checksums)

**Rate Limiting:**
```typescript
// Per-token rate limiting
const rateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 downloads per minute per token
  skipFailedRequests: false,
  keyGenerator: (req) => req.accessToken
});
```

### 6.3 License Key Security

**Generation:**
- Cryptographically secure random generation
- Format validation (XXXX-XXXX-XXXX)
- Uniqueness guarantee
- Activation tracking

**Validation:**
```typescript
async function validateLicenseKey(
  licenseKey: string,
  accessToken: string
): Promise<boolean> {
  // 1. Validate format
  if (!isValidLicenseKeyFormat(licenseKey)) {
    return false;
  }
  
  // 2. Check against grant
  const grant = await validateAccessToken(accessToken);
  if (grant.licenseKey !== licenseKey) {
    return false;
  }
  
  // 3. Check if already activated
  if (grant.licenseKeyActivatedAt) {
    // Optional: Allow re-activation from same IP
    const currentIP = getRequestIP();
    if (grant.licenseKeyActivatedBy !== currentIP) {
      throw new LicenseAlreadyActivatedError();
    }
  }
  
  // 4. Activate
  await db.downloadAccessGrants.update({
    where: { id: grant.id },
    data: {
      licenseKeyActivatedAt: new Date(),
      licenseKeyActivatedBy: getRequestIP()
    }
  });
  
  return true;
}
```

### 6.4 Audit Logging

**Events to Log:**
- Access token created
- Access token validated
- Download initiated
- Download completed
- Download failed
- License key activated
- Access revoked
- Access expired

**Log Structure:**
```typescript
interface AccessLog {
  timestamp: Date;
  eventType: string;
  accessToken: string; // hashed
  customerId?: string;
  customerEmail: string;
  ipAddress: string;
  userAgent: string;
  referrer?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}
```

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Foundation
- [ ] Phase 1: Database schema design
- [ ] Phase 1: Migration scripts
- [ ] Phase 1: Prisma schema updates
- [ ] Phase 1: Test migrations

### Sprint 2 (Week 3-4): Backend APIs
- [ ] Phase 2: Download page CRUD APIs
- [ ] Phase 2: Download access APIs
- [ ] Phase 2: Purchase integration
- [ ] Phase 2: API testing

### Sprint 3 (Week 5-6): Frontend Pages
- [ ] Phase 3: Customer download page
- [ ] Phase 3: Download page builder
- [ ] Phase 3: Asset management UI
- [ ] Phase 3: UI testing

### Sprint 4 (Week 7-8): Wizard Integration
- [ ] Phase 4: Product type step
- [ ] Phase 4: Digital assets step
- [ ] Phase 4: Download page step
- [ ] Phase 4: Review step updates

### Sprint 5 (Week 9-10): Purchase Flow
- [ ] Phase 5: Order confirmation page
- [ ] Phase 5: Email templates
- [ ] Phase 5: Order history updates
- [ ] Phase 5: Testing

### Sprint 6 (Week 11-12): Security & Polish
- [ ] Phase 6: Access token security
- [ ] Phase 6: Download security
- [ ] Phase 6: License key system
- [ ] Phase 6: Audit logging
- [ ] Phase 6: Security testing
- [ ] Phase 6: Documentation

---

## Technical Considerations

### File Storage
- **Provider:** Supabase Storage
- **Bucket:** `digital-downloads`
- **Path Structure:** `:tenantId/:itemId/:assetId/:filename`
- **Signed URLs:** 1-hour expiration for downloads
- **Max File Size:** 500MB per file (configurable per tenant)

### Performance
- **CDN:** Use Supabase CDN for file downloads
- **Caching:** Cache download page metadata
- **Streaming:** Stream large files with Range support
- **Queue:** Background job for access grant creation

### Scalability
- **Database Indexing:** Optimized indexes for common queries
- **Pagination:** For large asset lists and access logs
- **Archiving:** Archive old access logs to cold storage
- **Cleanup:** Automated cleanup of expired access grants

### Compliance
- **GDPR:** Customer data retention policies
- **Audit Trail:** Complete access history
- **Data Export:** Customer download history export
- **Right to Forget:** Access grant deletion

---

## Testing Strategy

### Unit Tests
- Access token validation
- License key generation
- Download limit enforcement
- Expiration checks
- Rate limiting

### Integration Tests
- Purchase flow → access grant creation
- Download page → file download
- Wizard → download page creation
- Email → download link generation

### E2E Tests
- Complete digital product purchase flow
- Download page access with valid token
- Download page access with expired token
- License key activation
- Download limit exhaustion

### Security Tests
- Token brute force attempts
- Rate limiting effectiveness
- File path traversal attempts
- License key validation bypass
- Access control circumvention

---

## Success Metrics

1. **Functionality**
   - Digital products can be created through wizard
   - Download pages are automatically generated
   - Customers can access downloads after purchase
   - Access controls are enforced correctly

2. **Performance**
   - Download page loads in < 2 seconds
   - File downloads start in < 5 seconds
   - API endpoints respond in < 500ms

3. **Security**
   - Zero unauthorized access incidents
   - All access attempts logged
   - Rate limiting prevents abuse

4. **User Experience**
   - < 3 clicks to download after purchase
   - Clear instructions on download page
   - Helpful error messages for access issues

---

## Future Enhancements

1. **Versioning**
   - Track file versions
   - Allow customers to access previous versions
   - Version-specific download links

2. **Bundles**
   - Group multiple digital products
   - Single download page for bundles
   - Bundle-specific pricing

3. **Subscriptions**
   - Time-based access (monthly/yearly)
   - Subscription renewal extends access
   - Automatic access revocation on cancellation

4. **Analytics Dashboard**
   - Download statistics
   - Geographic distribution
   - Popular products
   - Access patterns

5. **Advanced Features**
   - Watermarking for PDFs
   - Custom download agreements
   - Survey before download
   - Social sharing incentives
