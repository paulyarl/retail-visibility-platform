# Digital Products Recipe Guide

A comprehensive guide to the digital products feature implementation, covering UX flows, expectations, and integration points.

---

## Table of Contents

1. [Overview](#overview)
2. [Product Types](#product-types)
3. [UX Flows](#ux-flows)
4. [API Endpoints](#api-endpoints)
5. [Services](#services)
6. [Security & Rate Limiting](#security--rate-limiting)
7. [Email Templates](#email-templates)
8. [Testing](#testing)

---

## Overview

Digital products enable merchants to sell downloadable content, software licenses, and access-granted content alongside physical products.

### Key Features
- **Three product types**: Digital-only, Physical-only, Hybrid (both)
- **Four delivery methods**: Direct download, External link, License key, Access grant
- **Access control**: Download limits, expiration dates, revocation
- **Real-time notifications**: WebSocket-based customer notifications
- **Automatic fulfillment**: Triggered on payment success

---

## Product Types

### 1. Digital Product (`digital`)
- Purely digital content
- No shipping required
- Immediate access after purchase
- Examples: E-books, software, courses, templates

### 2. Physical Product (`physical`)
- Traditional tangible goods
- Requires shipping
- Standard inventory management

### 3. Hybrid Product (`hybrid`)
- Combines physical and digital components
- Example: Physical book + digital companion PDF
- Both shipping and digital access required

---

## UX Flows

### Flow 1: Creating a Digital Product

```
Merchant navigates to Inventory
       |
       v
Clicks "Add New Product"
       |
       v
Product Type Step
   - Select "Digital" or "Hybrid"
   - Configure delivery method:
     • Direct Download (file upload)
     • External Link (URL)
     • License Key (auto-generated)
     • Access Grant (manual approval)
       |
       v
Digital Assets Step
   - Upload files (max 500MB each)
   - Add external links
   - Configure asset settings:
     • File name, MIME type
     • License key template
     • Access duration (days)
     • Download limit
       |
       v
Pricing Step
   - Set price
   - Configure variants (optional)
       |
       v
Save Product
```

**Expected Behavior:**
- Files upload to storage with progress indicator
- Access token generated automatically
- Download page created with unique slug
- Product appears in inventory with digital badge

---

### Flow 2: Customer Purchases Digital Product

```
Customer adds digital product to cart
       |
       v
Checkout
   - No shipping address required (digital-only)
   - Shipping shown for hybrid products
       |
       v
Payment
       |
       v
Payment Success Webhook
   - Stripe: payment_intent.succeeded
   - PayPal: PAYMENT.SALE.COMPLETED
       |
       v
Automatic Fulfillment
   - DigitalAccessService creates access grant
   - Download URL generated
   - Order item updated with download URL
   - Email sent to customer
       |
       v
Real-time Notification (if customer online)
   - WebSocket message: "digital-access-granted"
       |
       v
Customer receives email with download link
```

**Expected Behavior:**
- Access granted within seconds of payment
- Email contains unique download link
- Download link shows expiration date (if applicable)
- Download link shows remaining downloads (if limited)

---

### Flow 3: Customer Downloads Product

```
Customer clicks download link in email
       |
       v
Download Page (/download/{accessToken})
   - Validates access token
   - Checks expiration
   - Checks download limit
       |
       v
[Valid Access]
   - Shows product name, file info
   - Shows expiration date
   - Shows downloads remaining
   - "Download" button enabled
       |
       v
Customer clicks Download
   - File streamed to browser
   - Download count incremented
   - Access log created
       |
       v
[Invalid Access]
   - Shows error message:
     • "Access expired"
     • "Download limit reached"
     • "Invalid token"
   - Contact support link shown
```

**Expected Behavior:**
- Download starts immediately
- Progress shown for large files
- Download count updated in real-time
- Rate limited to 10 downloads/minute per IP

---

### Flow 4: Access Expiration Warning

```
Cron job runs daily
       |
       v
Find grants expiring in 7 days
       |
       v
Send expiration reminder email
   - Lists all expiring products
   - Days until expiration
   - Direct download links
       |
       v
Customer downloads before expiration
```

**Expected Behavior:**
- Email sent 7 days before expiration
- Amber-colored warning styling
- Clear call-to-action to download

---

### Flow 5: License Key Activation

```
Customer receives license key
       |
       v
Navigates to activation page
       |
       v
Enters license key
       |
       v
System validates:
   - Key exists
   - Not already activated
   - Not expired
       |
       v
[Valid]
   - Key activated
   - Activation date recorded
   - Success message shown
       |
       v
[Invalid]
   - Error shown:
     • "Invalid key"
     • "Already activated"
     • "Expired"
```

---

## API Endpoints

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/downloads/{tenantId}/{slug}` | GET | Public download page data |
| `/api/download/{accessToken}` | GET | Download file with token |
| `/api/download/{accessToken}/info` | GET | Get access grant info |
| `/api/download/{accessToken}/validate` | POST | Validate access token |

### Tenant Endpoints (Authenticated)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tenants/{tenantId}/download-pages` | GET | List download pages |
| `/api/tenants/{tenantId}/download-pages` | POST | Create download page |
| `/api/tenants/{tenantId}/download-pages/{pageId}` | GET/PATCH/DELETE | Manage download page |
| `/api/tenants/{tenantId}/download-pages/item/{itemId}` | GET | Get page by item ID |
| `/api/tenants/{tenantId}/digital-assets/upload` | POST | Upload digital asset |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/digital-products/stats` | GET | Platform-wide statistics |

---

## Services

### DigitalAccessService
**Location:** `apps/api/src/services/digital-assets/DigitalAccessService.ts`

**Responsibilities:**
- Create access grants for orders
- Validate access tokens
- Track download counts
- Manage expiration
- Revoke/extend access

**Key Methods:**
```typescript
createAccessGrant(params)     // Create new grant
validateAccess(token)         // Check if access allowed
recordDownload(token)         // Increment download count
revokeAccess(token, reason)   // Revoke access
extendAccess(token, days)     // Extend expiration
getAccessStats(itemId)        // Get statistics
```

---

### DigitalFulfillmentService
**Location:** `apps/api/src/services/digital-assets/DigitalFulfillmentService.ts`

**Responsibilities:**
- Auto-fulfill digital orders after payment
- Send download emails
- Retry failed fulfillments

**Key Methods:**
```typescript
fulfillOrder(orderId, baseUrl)     // Fulfill all digital items
hasDigitalProducts(orderId)        // Check if order has digital
retryFulfillment(orderId, baseUrl) // Retry failed items
```

---

### RealtimeService
**Location:** `apps/api/src/services/RealtimeService.ts`

**Responsibilities:**
- WebSocket client management
- Real-time customer notifications
- Payment success notifications

**Notification Types:**
```typescript
'digital-access-granted'  // Access ready for download
'download-complete'       // Download finished
'access-expiring'        // Access expiring soon
'access-revoked'         // Access revoked
```

---

### DownloadAccessService
**Location:** `apps/api/src/services/downloads/DownloadAccessService.ts`

**Responsibilities:**
- Access validation with page settings
- License key generation/validation
- Download logging

---

## Security & Rate Limiting

### Rate Limits

| Type | Limit | Window | Purpose |
|------|-------|--------|---------|
| Download | 10 requests | 1 minute | Prevent abuse |
| Access Token Validation | 30 requests | 1 minute | Prevent token enumeration |
| General API | 100 requests | 15 minutes | Standard protection |
| Auth | 5 requests | 15 minutes | Brute force protection |

### Security Features

1. **Access Token Security**
   - UUID-based tokens (cryptographically random)
   - Single-use validation per request
   - Automatic expiration tracking

2. **Download Protection**
   - Token required for every download
   - IP logging for audit trail
   - User agent tracking

3. **Rate Limit Alerts**
   - Security alerts created for violations
   - Context logging for forensics
   - Potential attack detection

---

## Email Templates

### 1. Download Receipt Email
**Trigger:** Payment success (digital products in order)

**Contents:**
- Order number and total
- List of digital products
- Download buttons for each
- Expiration date (if applicable)
- Downloads remaining (if limited)
- File size

**Subject:** "Your Digital Download is Ready! 🎉"

---

### 2. Expiration Reminder Email
**Trigger:** 7 days before access expires

**Contents:**
- Warning header (amber styling)
- List of expiring products
- Days until expiration
- Download buttons
- Call to action

**Subject:** "⚠️ Your Digital Downloads Are Expiring Soon"

---

## Testing

### E2E Test Scenarios
**Location:** `apps/api/src/tests/digital-products.test.ts`

**Coverage:**
- Product configuration
- Access grant lifecycle
- Download limit enforcement
- Expiration handling
- License key activation
- Revocation flows

### Performance Tests
**Location:** `apps/api/src/tests/digital-products.performance.ts`

**Benchmarks:**
- Access grant creation: < 100ms
- Access validation: < 50ms
- Download recording: < 75ms
- Batch validation (20): < 500ms
- Bulk creation (50): < 1000ms

---

## UI Components

### Web App Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProductTypeStep` | `components/inventory/wizards/steps/` | Select product type |
| `DigitalProductConfig` | `components/items/` | Configure digital settings |
| `DigitalAssetsStep` | `components/inventory/wizards/steps/` | Manage assets |
| `DigitalProductBadge` | `components/products/` | Display product type badge |
| `DownloadProgress` | `components/downloads/` | Download progress UI |

---

## Configuration

### Environment Variables

```bash
# Required
WEB_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Storage (for file uploads)
STORAGE_PROVIDER=supabase  # or s3, local
STORAGE_BUCKET=digital-assets

# Email
EMAIL_PROVIDER=sendgrid  # or resend, postmark

# Rate Limiting
RATE_LIMITING_ENABLED=true
RATE_LIMIT_DOWNLOAD_MAX=10
RATE_LIMIT_DOWNLOAD_WINDOW=60000
```

---

## Troubleshooting

### Common Issues

1. **"Access token not found"**
   - Token may have been revoked
   - Check `revoked_at` in database

2. **"Download limit reached"**
   - Customer exceeded allowed downloads
   - Extend limit via admin or API

3. **"Access has expired"**
   - Grant past `access_expires_at`
   - Extend access duration

4. **Fulfillment failed**
   - Check order has `digital` or `hybrid` items
   - Check `digital_delivery_status` on order items
   - Use retry endpoint: `POST /api/fulfillment/retry/{orderId}`

---

## Quick Reference

### Create Digital Product (API)

```typescript
POST /api/tenants/{tenantId}/items
{
  "name": "My E-Book",
  "product_type": "digital",
  "digital_delivery_method": "direct_download",
  "price": 1999,
  "access_duration_days": 30,
  "download_limit": 5,
  "digital_assets": [{
    "file_name": "ebook.pdf",
    "file_size_bytes": 1024000,
    "mime_type": "application/pdf"
  }]
}
```

### Check Access (API)

```typescript
POST /api/download/{accessToken}/validate
// Response:
{
  "granted": true,
  "accessGrant": {
    "downloadCount": 2,
    "maxDownloads": 5,
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

### Fulfill Order (Internal)

```typescript
import { digitalFulfillmentService } from './services/digital-assets/DigitalFulfillmentService';

await digitalFulfillmentService.fulfillOrder(orderId, baseUrl);
// Returns: { success, accessGrants, errors }
```

---

## Implementation Checklist

- [x] Database schema for digital products
- [x] Download page model and routes
- [x] Digital asset upload handling
- [x] Access grant creation and validation
- [x] Automatic fulfillment on payment
- [x] Download email templates
- [x] Expiration reminder emails
- [x] Real-time notifications
- [x] Rate limiting for downloads
- [x] License key support
- [x] E2E test coverage
- [x] Performance benchmarks
- [x] UI components for wizard
- [x] Product type badges
- [x] Download progress component

---

*Last updated: May 2026*
*Implementation: Phases 1-6 Complete*
