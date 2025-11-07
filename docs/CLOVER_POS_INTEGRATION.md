# Clover POS Integration Documentation

**Version:** 1.0  
**Last Updated:** November 7, 2025  
**Status:** Phase 1 & 2 Complete (Demo Mode + OAuth)

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Setup & Configuration](#setup--configuration)
5. [User Guide](#user-guide)
6. [Developer Guide](#developer-guide)
7. [API Reference](#api-reference)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)
10. [Roadmap](#roadmap)

---

## Overview

The Clover POS Integration allows retail businesses to automatically sync their inventory between Clover point-of-sale systems and the Retail Visibility Platform. This eliminates manual data entry and ensures inventory accuracy across all sales channels.

### Key Benefits

- **Automatic Sync** - Inventory updates flow from Clover to RVP automatically
- **Demo Mode** - Test with 25 sample products before connecting real account
- **Secure OAuth** - Industry-standard OAuth 2.0 authentication
- **Encrypted Storage** - All tokens encrypted with AES-256
- **Real-time Updates** - Changes sync within minutes
- **No Manual Entry** - Save hours of data entry work

### Current Status

✅ **Phase 1 Complete** - Demo Mode  
✅ **Phase 2 Complete** - OAuth Integration  
🚧 **Phase 3 In Progress** - Production Sync & Migration

---

## Features

### Phase 1: Demo Mode ✅

**Purpose:** Allow users to test the integration without a Clover account

**Features:**
- 25 realistic sample products
- 5 product categories (Electronics, Home, Apparel, Sports, Office)
- Instant import to inventory
- Full item mapping
- Easy enable/disable

**Use Cases:**
- Evaluate the integration before committing
- Test workflows and processes
- Train staff on the system
- Demo to stakeholders

### Phase 2: OAuth Integration ✅

**Purpose:** Connect real Clover accounts securely

**Features:**
- OAuth 2.0 authorization flow
- Scope disclosure (transparency)
- Token encryption (AES-256)
- CSRF protection via state parameter
- Automatic token refresh
- Sandbox and production environments

**Security:**
- Encrypted token storage
- 10-minute state expiration
- No password storage
- Revocable access

### Phase 3: Production Sync 🚧

**Coming Soon:**
- Live inventory import from Clover
- Real-time sync
- SKU reconciliation
- Conflict resolution
- Webhook support

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Integrations Page                                   │   │
│  │  - Enable Demo Mode                                  │   │
│  │  - Connect Clover Account (OAuth)                    │   │
│  │  - View Integration Status                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Express)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Clover Routes                                       │   │
│  │  - /demo/enable                                      │   │
│  │  - /demo/disable                                     │   │
│  │  - /oauth/authorize                                  │   │
│  │  - /oauth/callback                                   │   │
│  │  - /status                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Services                                            │   │
│  │  - clover-demo-emulator.ts                          │   │
│  │  - clover-oauth.ts                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Tables                                              │   │
│  │  - CloverIntegration (main record)                  │   │
│  │  - CloverSyncLog (audit trail)                      │   │
│  │  - CloverItemMapping (SKU mapping)                  │   │
│  │  - CloverDemoSnapshot (rollback)                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Clover API (External)                     │
│  - OAuth Authorization                                       │
│  - Token Exchange                                            │
│  - Inventory API (Phase 3)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

#### CloverIntegration
Main integration record tracking connection status and mode.

```sql
CREATE TABLE clover_integrations (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT UNIQUE NOT NULL,
  mode                  TEXT DEFAULT 'demo',  -- 'demo' or 'production'
  status                TEXT DEFAULT 'active', -- 'active', 'paused', 'error'
  
  -- OAuth tokens (encrypted)
  access_token          TEXT,
  refresh_token         TEXT,
  token_expires_at      TIMESTAMP,
  merchant_id           TEXT,
  
  -- Demo mode tracking
  demo_enabled_at       TIMESTAMP,
  demo_last_active_at   TIMESTAMP,
  
  -- Production mode tracking
  production_enabled_at TIMESTAMP,
  last_sync_at          TIMESTAMP,
  last_sync_status      TEXT,
  
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

#### CloverSyncLog
Tracks all sync operations with trace IDs for observability.

```sql
CREATE TABLE clover_sync_logs (
  id                 TEXT PRIMARY KEY,
  integration_id     TEXT NOT NULL,
  trace_id           TEXT UNIQUE NOT NULL,
  
  operation          TEXT NOT NULL,  -- 'sync', 'import', 'migrate'
  status             TEXT NOT NULL,  -- 'started', 'success', 'failed'
  
  items_processed    INTEGER DEFAULT 0,
  items_succeeded    INTEGER DEFAULT 0,
  items_failed       INTEGER DEFAULT 0,
  
  error_message      TEXT,
  error_details      JSONB,
  duration_ms        INTEGER,
  
  started_at         TIMESTAMP DEFAULT NOW(),
  completed_at       TIMESTAMP,
  
  FOREIGN KEY (integration_id) REFERENCES clover_integrations(id) ON DELETE CASCADE
);
```

#### CloverItemMapping
Maps Clover items to RVP inventory items.

```sql
CREATE TABLE clover_item_mappings (
  id                 TEXT PRIMARY KEY,
  integration_id     TEXT NOT NULL,
  
  clover_item_id     TEXT NOT NULL,
  clover_item_name   TEXT NOT NULL,
  clover_sku         TEXT,
  
  rvp_item_id        TEXT,
  rvp_sku            TEXT,
  
  mapping_status     TEXT DEFAULT 'pending',  -- 'pending', 'mapped', 'conflict'
  conflict_reason    TEXT,
  
  last_synced_at     TIMESTAMP,
  last_sync_status   TEXT,
  
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (integration_id) REFERENCES clover_integrations(id) ON DELETE CASCADE,
  UNIQUE (integration_id, clover_item_id)
);
```

#### CloverDemoSnapshot
Stores demo data for rollback during migration.

```sql
CREATE TABLE clover_demo_snapshots (
  id                 TEXT PRIMARY KEY,
  integration_id     TEXT NOT NULL,
  
  snapshot_data      JSONB NOT NULL,
  item_count         INTEGER NOT NULL,
  
  created_at         TIMESTAMP DEFAULT NOW(),
  expires_at         TIMESTAMP NOT NULL,  -- Auto-delete after 30 days
  
  FOREIGN KEY (integration_id) REFERENCES clover_integrations(id) ON DELETE CASCADE
);
```

---

## Setup & Configuration

### Prerequisites

1. **Clover Developer Account**
   - Sign up at https://www.clover.com/developers
   - Create a new app in the Clover dashboard

2. **Environment Variables**
   - Access to server environment configuration
   - Ability to add secure secrets

3. **Database Access**
   - PostgreSQL database with Prisma
   - Migration permissions

### Step 1: Create Clover App

1. Go to https://www.clover.com/developers
2. Click "Create App"
3. Fill in app details:
   - **App Name:** Retail Visibility Platform
   - **Description:** Inventory sync for retail businesses
   - **Website:** Your platform URL
4. Configure OAuth:
   - **Redirect URI:** `https://your-domain.com/api/integrations/clover/oauth/callback`
   - **Permissions:**
     - `merchant_r` - Read merchant information
     - `inventory_r` - Read inventory items
     - `inventory_w` - Write inventory items
5. Save and note your:
   - **App ID** (Client ID)
   - **App Secret** (Client Secret)

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Clover OAuth Configuration
CLOVER_CLIENT_ID=your_app_id_here
CLOVER_CLIENT_SECRET=your_app_secret_here
CLOVER_ENVIRONMENT=sandbox  # or 'production'
CLOVER_REDIRECT_URI=https://your-domain.com/api/integrations/clover/oauth/callback

# Token Encryption (generate a secure 32-character key)
CLOVER_TOKEN_ENCRYPTION_KEY=your_32_character_encryption_key_here
```

**Generate Encryption Key:**
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

### Step 3: Run Database Migration

```bash
cd apps/api
npx prisma migrate deploy
```

This creates the four Clover integration tables.

### Step 4: Verify Setup

Test the configuration:

```bash
# Check environment variables are loaded
node -e "console.log(process.env.CLOVER_CLIENT_ID ? 'OK' : 'Missing')"

# Test database connection
npx prisma db pull
```

---

## User Guide

### For Store Owners

#### Option 1: Demo Mode (No Clover Account Required)

**When to use:**
- Testing the integration
- Evaluating features
- Training staff
- Demonstrating to stakeholders

**Steps:**
1. Navigate to **Settings → Integrations**
2. Find the **Clover POS** card
3. Click **Enable Demo Mode**
4. Wait for import (25 items added instantly)
5. View your inventory to see sample products
6. Test workflows and processes
7. Click **Disable Demo Mode** when done

**What you get:**
- 25 realistic sample products
- 5 product categories
- Realistic pricing and stock levels
- Full item mappings
- Sync logs for testing

#### Option 2: Connect Real Clover Account (OAuth)

**When to use:**
- Ready to sync live inventory
- Have an active Clover account
- Want automatic updates

**Steps:**
1. Navigate to **Settings → Integrations**
2. Find the **Clover POS** card
3. Click **Connect Clover Account**
4. Review the permissions modal:
   - Read merchant information
   - Read inventory items
   - Update inventory
5. Click **Continue to Clover**
6. Log in to your Clover account
7. Authorize the app
8. You'll be redirected back with success message
9. Your inventory will sync automatically

**What happens:**
- Secure OAuth connection established
- Tokens encrypted and stored
- Integration switches to production mode
- Initial sync begins (Phase 3)

#### Managing Your Integration

**View Status:**
- Total items synced
- Mapped items count
- Conflict items (if any)
- Last sync time
- Connection status

**Disconnect:**
- Click **Disable Demo Mode** (for demo)
- Or use disconnect button (Phase 3)
- Choose to keep or remove items

---

## Developer Guide

### Adding Demo Items

Edit `apps/api/src/services/clover-demo-emulator.ts`:

```typescript
const DEMO_ITEMS: DemoItem[] = [
  {
    id: 'demo_item_026',
    name: 'Your Product Name',
    sku: 'YOUR-SKU-001',
    price: 2999,  // in cents ($29.99)
    stock: 50,
    category: 'Your Category',
    description: 'Product description'
  },
  // ... more items
];
```

### Customizing OAuth Scopes

Edit `apps/api/src/services/clover-oauth.ts`:

```typescript
const REQUIRED_SCOPES = [
  'merchant_r',
  'inventory_r',
  'inventory_w',
  // Add more scopes as needed
];
```

### Adding Custom Sync Logic

Create a new service in `apps/api/src/services/`:

```typescript
// clover-sync.ts
export async function syncInventory(integrationId: string) {
  // Your sync logic here
}
```

### Testing OAuth Flow Locally

1. Use ngrok for local HTTPS:
```bash
ngrok http 4000
```

2. Update Clover app redirect URI to ngrok URL

3. Update `.env`:
```bash
CLOVER_REDIRECT_URI=https://your-ngrok-url.ngrok.io/api/integrations/clover/oauth/callback
```

4. Test the flow end-to-end

---

## API Reference

### Demo Mode Endpoints

#### Enable Demo Mode
```http
POST /api/integrations/:tenantId/clover/demo/enable
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Demo mode enabled successfully",
  "integration": {
    "id": "clv_123",
    "mode": "demo",
    "status": "active"
  },
  "itemsImported": 25,
  "totalDemoItems": 25
}
```

#### Disable Demo Mode
```http
POST /api/integrations/:tenantId/clover/demo/disable
Authorization: Bearer {token}
Content-Type: application/json

{
  "keepItems": false
}
```

**Response:**
```json
{
  "message": "Demo mode disabled successfully",
  "itemsDeleted": 25,
  "itemsKept": 0
}
```

### OAuth Endpoints

#### Get Authorization URL
```http
GET /api/integrations/:tenantId/clover/oauth/authorize
Authorization: Bearer {token}
```

**Response:**
```json
{
  "authorizationUrl": "https://sandbox.dev.clover.com/oauth/authorize?...",
  "scopes": [
    {
      "scope": "merchant_r",
      "description": "Read your merchant information"
    }
  ]
}
```

#### OAuth Callback
```http
GET /api/integrations/clover/oauth/callback?code={code}&state={state}
```

**Redirects to:**
```
/t/{tenantId}/settings/integrations?success=connected
```

### Status Endpoint

#### Get Integration Status
```http
GET /api/integrations/:tenantId/clover/status
Authorization: Bearer {token}
```

**Response:**
```json
{
  "enabled": true,
  "mode": "production",
  "status": "active",
  "merchantId": "ABC123",
  "stats": {
    "totalItems": 150,
    "mappedItems": 148,
    "conflictItems": 2
  },
  "lastSyncAt": "2025-11-07T20:00:00Z",
  "lastSyncStatus": "success"
}
```

---

## Security

### Token Encryption

All OAuth tokens are encrypted before storage using AES-256-CBC:

```typescript
// Encryption
const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
let encrypted = cipher.update(token, 'utf8', 'hex');
encrypted += cipher.final('hex');

// Decryption
const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
decrypted += decipher.final('utf8');
```

### CSRF Protection

State parameter includes:
- Tenant ID
- Random token
- Timestamp

```typescript
const stateData = {
  tenantId: 'tenant_123',
  token: crypto.randomBytes(32).toString('hex'),
  timestamp: Date.now()
};
const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
```

State expires after 10 minutes to prevent replay attacks.

### Access Control

- **Tenant Admins** - Can manage integrations for their store
- **Platform Support** - Can view/manage all integrations
- **Platform Admins** - Full access

### Best Practices

1. **Rotate Encryption Keys** - Change `CLOVER_TOKEN_ENCRYPTION_KEY` periodically
2. **Monitor Logs** - Watch for failed OAuth attempts
3. **Audit Access** - Review who connects/disconnects integrations
4. **Secure Environment** - Never commit secrets to git
5. **Use HTTPS** - Always use HTTPS in production

---

## Troubleshooting

### Common Issues

#### "Missing CLOVER_CLIENT_ID"

**Cause:** Environment variables not set  
**Solution:** Add to `.env` file and restart server

#### "OAuth callback failed"

**Cause:** Redirect URI mismatch  
**Solution:** Verify redirect URI in Clover app matches your environment

#### "State expired"

**Cause:** User took >10 minutes to authorize  
**Solution:** Start OAuth flow again

#### "Already connected"

**Cause:** Integration already in production mode  
**Solution:** Disconnect first, then reconnect

#### Demo items not importing

**Cause:** SKU conflicts with existing items  
**Solution:** Check for duplicate SKUs in inventory

### Debug Mode

Enable debug logging:

```bash
DEBUG=clover:* npm run dev
```

### Support

- **Documentation:** This file
- **Issues:** GitHub Issues
- **Email:** support@yourplatform.com

---

## Roadmap

### Phase 1: Demo Mode ✅ COMPLETE
- [x] Database schema
- [x] Demo emulator service
- [x] API endpoints
- [x] UI implementation

### Phase 2: OAuth Integration ✅ COMPLETE
- [x] OAuth service
- [x] Authorization flow
- [x] Token management
- [x] Scope disclosure UI

### Phase 3: Production Sync 🚧 IN PROGRESS
- [ ] Live inventory import
- [ ] Real-time sync
- [ ] SKU reconciliation
- [ ] Conflict resolution UI
- [ ] Demo → Production migration

### Phase 4: Advanced Features 📋 PLANNED
- [ ] Webhook support
- [ ] Bi-directional sync
- [ ] Bulk operations
- [ ] Advanced mapping rules
- [ ] Custom field mapping

### Phase 5: Observability 📋 PLANNED
- [ ] Metrics dashboard
- [ ] Sync performance tracking
- [ ] Error rate monitoring
- [ ] Alerting system

---

## Changelog

### Version 1.0 (November 7, 2025)

**Phase 1 Complete:**
- Added demo mode with 25 sample products
- Implemented database schema
- Created API endpoints
- Built UI for demo management

**Phase 2 Complete:**
- Implemented OAuth 2.0 flow
- Added token encryption
- Created scope disclosure
- Built production connection UI

---

## License

Internal use only - Retail Visibility Platform

---

## Contact

For questions or support:
- **Technical Issues:** Create a GitHub issue
- **Feature Requests:** Product team
- **Security Concerns:** security@yourplatform.com
