# Square POS Integration Implementation Plan

## Executive Summary
Add Square POS integration alongside existing Clover integration to support both major POS systems on day 1 launch. Leverage existing OAuth and webhook infrastructure to minimize implementation time.

**Timeline:** 5-7 days
**Priority:** High (Launch Blocker)
**Dependencies:** Existing Clover integration patterns

---

## Phase 1: Infrastructure Setup (Day 1)

### 1.1 Square Developer Account & App Setup
- [ ] Create Square Developer account
- [ ] Register application in Square Developer Dashboard
- [ ] Obtain OAuth credentials (Application ID, Access Token)
- [ ] Configure OAuth redirect URLs
- [ ] Set up webhook endpoints in Square Dashboard
- [ ] Enable required permissions:
  - `ITEMS_READ` - Read catalog items
  - `ITEMS_WRITE` - Update catalog items
  - `INVENTORY_READ` - Read inventory counts
  - `INVENTORY_WRITE` - Update inventory counts
  - `MERCHANT_PROFILE_READ` - Read merchant info

### 1.2 Install Dependencies
```bash
cd apps/api
npm install square @types/square
```

### 1.3 Environment Variables
Add to `.env`:
```env
# Square Integration
SQUARE_APPLICATION_ID=sq0idp-xxxxx
SQUARE_ACCESS_TOKEN=xxxxx
SQUARE_ENVIRONMENT=sandbox  # or production
SQUARE_WEBHOOK_SIGNATURE_KEY=xxxxx
SQUARE_OAUTH_REDIRECT_URI=https://yourapp.com/api/integrations/square/callback
```

---

## Phase 2: Database Schema (Day 1)

### 2.1 Create Square Integration Tables

```sql
-- Square OAuth tokens per tenant
CREATE TABLE square_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  merchant_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  location_id VARCHAR(255),
  business_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_square_integrations_tenant ON square_integrations(tenant_id);
CREATE INDEX idx_square_integrations_merchant ON square_integrations(merchant_id);

-- Square product mapping
CREATE TABLE square_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  square_catalog_object_id VARCHAR(255) NOT NULL,
  square_variation_id VARCHAR(255),
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, item_id),
  UNIQUE(square_catalog_object_id, square_variation_id)
);

CREATE INDEX idx_square_mappings_tenant ON square_product_mappings(tenant_id);
CREATE INDEX idx_square_mappings_item ON square_product_mappings(item_id);
CREATE INDEX idx_square_mappings_catalog ON square_product_mappings(square_catalog_object_id);

-- Square sync log
CREATE TABLE square_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'webhook'
  direction VARCHAR(20) NOT NULL, -- 'import', 'export'
  status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_square_sync_logs_tenant ON square_sync_logs(tenant_id);
CREATE INDEX idx_square_sync_logs_status ON square_sync_logs(status);
```

### 2.2 Run Migration
```bash
cd apps/api
npm run migration:create square_integration
# Add SQL above to migration file
npm run migration:run
```

---

## Phase 3: Backend Implementation (Days 2-4)

### 3.1 Square Client Service
**File:** `apps/api/src/services/square/square-client.ts`

```typescript
import { Client, Environment } from 'square';
import { config } from '../../config';

export class SquareClient {
  private client: Client;

  constructor(accessToken: string) {
    this.client = new Client({
      accessToken,
      environment: config.square.environment === 'production' 
        ? Environment.Production 
        : Environment.Sandbox,
    });
  }

  // Catalog API
  async listCatalogItems() {
    return this.client.catalogApi.listCatalog(undefined, 'ITEM');
  }

  async getCatalogItem(objectId: string) {
    return this.client.catalogApi.retrieveCatalogObject(objectId);
  }

  async upsertCatalogItem(item: any) {
    return this.client.catalogApi.upsertCatalogObject({
      idempotencyKey: crypto.randomUUID(),
      object: item,
    });
  }

  // Inventory API
  async getInventoryCounts(catalogObjectIds: string[]) {
    return this.client.inventoryApi.batchRetrieveInventoryCounts({
      catalogObjectIds,
    });
  }

  async updateInventoryCount(catalogObjectId: string, locationId: string, quantity: number) {
    return this.client.inventoryApi.batchChangeInventory({
      idempotencyKey: crypto.randomUUID(),
      changes: [{
        type: 'PHYSICAL_COUNT',
        physicalCount: {
          catalogObjectId,
          locationId,
          quantity: quantity.toString(),
          occurredAt: new Date().toISOString(),
        },
      }],
    });
  }

  // Locations API
  async listLocations() {
    return this.client.locationsApi.listLocations();
  }

  // Merchant API
  async getMerchant() {
    return this.client.merchantsApi.retrieveMerchant('me');
  }
}
```

### 3.2 OAuth Flow
**File:** `apps/api/src/routes/integrations/square-oauth.ts`

```typescript
import { Router } from 'express';
import { Client, Environment } from 'square';
import { db } from '../../db';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Step 1: Redirect to Square OAuth
router.get('/connect', requireAuth, async (req, res) => {
  const { tenantId } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId required' });
  }

  // Verify user has access to tenant
  const hasAccess = await db.checkTenantAccess(req.user.id, tenantId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const state = Buffer.from(JSON.stringify({ 
    tenantId, 
    userId: req.user.id 
  })).toString('base64');

  const authUrl = `https://connect.squareup${config.square.environment === 'sandbox' ? 'sandbox' : ''}.com/oauth2/authorize?` +
    `client_id=${config.square.applicationId}&` +
    `scope=ITEMS_READ+ITEMS_WRITE+INVENTORY_READ+INVENTORY_WRITE+MERCHANT_PROFILE_READ&` +
    `state=${state}`;

  res.json({ authUrl });
});

// Step 2: Handle OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  try {
    // Decode state
    const { tenantId, userId } = JSON.parse(
      Buffer.from(state as string, 'base64').toString()
    );

    // Exchange code for access token
    const client = new Client({
      environment: config.square.environment === 'production'
        ? Environment.Production
        : Environment.Sandbox,
    });

    const { result } = await client.oAuthApi.obtainToken({
      clientId: config.square.applicationId,
      clientSecret: config.square.accessToken,
      code: code as string,
      grantType: 'authorization_code',
    });

    // Get merchant info
    const merchantClient = new Client({
      accessToken: result.accessToken,
      environment: config.square.environment === 'production'
        ? Environment.Production
        : Environment.Sandbox,
    });

    const { result: merchant } = await merchantClient.merchantsApi.retrieveMerchant('me');
    const { result: locations } = await merchantClient.locationsApi.listLocations();

    // Store integration
    await db.query(`
      INSERT INTO square_integrations (
        tenant_id, merchant_id, access_token, refresh_token,
        expires_at, location_id, business_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      ON CONFLICT (tenant_id) 
      DO UPDATE SET
        merchant_id = EXCLUDED.merchant_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        location_id = EXCLUDED.location_id,
        business_name = EXCLUDED.business_name,
        status = 'active',
        updated_at = NOW()
    `, [
      tenantId,
      result.merchantId,
      result.accessToken,
      result.refreshToken,
      result.expiresAt ? new Date(result.expiresAt) : null,
      locations.locations?.[0]?.id,
      merchant.merchant?.businessName,
    ]);

    // Trigger initial sync
    await triggerInitialSync(tenantId);

    // Redirect to success page
    res.redirect(`${config.webUrl}/t/${tenantId}/settings/integrations/square?status=success`);
  } catch (error) {
    console.error('Square OAuth error:', error);
    res.redirect(`${config.webUrl}/settings/integrations/square?status=error`);
  }
});

// Disconnect
router.post('/disconnect', requireAuth, async (req, res) => {
  const { tenantId } = req.body;

  await db.query(`
    UPDATE square_integrations 
    SET status = 'disconnected', updated_at = NOW()
    WHERE tenant_id = $1
  `, [tenantId]);

  res.json({ success: true });
});

export default router;
```

### 3.3 Inventory Sync Service
**File:** `apps/api/src/services/square/inventory-sync.ts`

```typescript
import { SquareClient } from './square-client';
import { db } from '../../db';

export class SquareInventorySync {
  async syncFromSquare(tenantId: string): Promise<void> {
    // Get integration
    const integration = await db.query(`
      SELECT * FROM square_integrations WHERE tenant_id = $1 AND status = 'active'
    `, [tenantId]);

    if (!integration.rows[0]) {
      throw new Error('No active Square integration');
    }

    const client = new SquareClient(integration.rows[0].access_token);

    // Get all catalog items
    const { result } = await client.listCatalogItems();
    
    for (const item of result.objects || []) {
      if (item.type !== 'ITEM') continue;

      // Get inventory counts
      const variations = item.itemData?.variations || [];
      
      for (const variation of variations) {
        const { result: inventoryResult } = await client.getInventoryCounts([variation.id!]);
        
        const count = inventoryResult.counts?.[0];
        const quantity = count ? parseInt(count.quantity || '0') : 0;

        // Update or create item in our system
        await this.upsertItem(tenantId, item, variation, quantity);
      }
    }

    // Update last sync time
    await db.query(`
      UPDATE square_integrations 
      SET last_sync_at = NOW()
      WHERE tenant_id = $1
    `, [tenantId]);
  }

  async syncToSquare(tenantId: string, itemId: string): Promise<void> {
    // Implementation for pushing updates to Square
    // Similar pattern to Clover integration
  }

  private async upsertItem(tenantId: string, item: any, variation: any, quantity: number) {
    // Map Square item to our item schema
    // Create or update item
    // Create mapping record
  }
}
```

### 3.4 Webhook Handler
**File:** `apps/api/src/routes/webhooks/square.ts`

```typescript
import { Router } from 'express';
import crypto from 'crypto';
import { SquareInventorySync } from '../../services/square/inventory-sync';

const router = Router();

// Verify Square webhook signature
function verifySignature(body: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!);
  const hash = hmac.update(body).digest('base64');
  return hash === signature;
}

router.post('/', async (req, res) => {
  const signature = req.headers['x-square-signature'] as string;
  
  if (!verifySignature(JSON.stringify(req.body), signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { type, data } = req.body;

  try {
    switch (type) {
      case 'inventory.count.updated':
        await handleInventoryUpdate(data);
        break;
      case 'catalog.version.updated':
        await handleCatalogUpdate(data);
        break;
      default:
        console.log('Unhandled Square webhook:', type);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Square webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleInventoryUpdate(data: any) {
  // Find tenant by Square merchant ID
  const { object: { inventory_counts } } = data;
  
  for (const count of inventory_counts) {
    // Update inventory in our system
    await updateInventoryFromSquare(count);
  }
}

async function handleCatalogUpdate(data: any) {
  // Trigger catalog sync for affected tenants
}

export default router;
```

---

## Phase 4: Frontend Implementation (Day 5)

### 4.1 Square Integration Settings Page
**File:** `apps/web/src/app/[tenantId]/settings/integrations/square/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';

export default function SquareIntegrationPage({ params }: { params: { tenantId: string } }) {
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState(null);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/square/connect?tenantId=${params.tenantId}`);
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Square?')) return;

    try {
      await fetch('/api/integrations/square/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: params.tenantId }),
      });
      setIntegration(null);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Square POS Integration</CardTitle>
        </CardHeader>
        <CardContent>
          {!integration ? (
            <div className="space-y-4">
              <p className="text-neutral-600">
                Connect your Square POS to automatically sync inventory in real-time.
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-600">
                <li>Real-time inventory sync</li>
                <li>Automatic product updates</li>
                <li>Prevent overselling</li>
                <li>Sync across storefront and Google</li>
              </ul>
              <Button onClick={handleConnect} disabled={loading}>
                {loading ? 'Connecting...' : 'Connect Square'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">✓ Connected to Square</p>
                <p className="text-green-600 text-sm mt-1">
                  Business: {integration.businessName}
                </p>
              </div>
              <Button variant="destructive" onClick={handleDisconnect}>
                Disconnect Square
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4.2 Update Integration List
**File:** `apps/web/src/app/[tenantId]/settings/integrations/page.tsx`

Add Square card alongside Clover:
```typescript
<Card>
  <CardHeader>
    <CardTitle>Square POS</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-neutral-600 mb-4">
      Sync inventory with your Square POS in real-time
    </p>
    <Link href={`/t/${tenantId}/settings/integrations/square`}>
      <Button>Configure Square</Button>
    </Link>
  </CardContent>
</Card>
```

---

## Phase 5: Testing (Day 6)

### 5.1 Unit Tests
- [ ] Square client service tests
- [ ] OAuth flow tests
- [ ] Inventory sync tests
- [ ] Webhook handler tests

### 5.2 Integration Tests
- [ ] End-to-end OAuth flow in sandbox
- [ ] Inventory sync from Square → Platform
- [ ] Inventory sync from Platform → Square
- [ ] Webhook delivery and processing
- [ ] Error handling and retry logic

### 5.3 Manual Testing Checklist
- [ ] Connect Square account
- [ ] Import existing products
- [ ] Sell item in Square → verify platform updates
- [ ] Update item in platform → verify Square updates
- [ ] Disconnect Square account
- [ ] Reconnect Square account

---

## Phase 6: Documentation & Deployment (Day 7)

### 6.1 Documentation
**File:** `docs/integrations/SQUARE.md`

- Setup instructions
- OAuth flow diagram
- Webhook configuration
- Troubleshooting guide
- API rate limits and best practices

### 6.2 Deployment Checklist
- [ ] Environment variables configured in production
- [ ] Database migrations run
- [ ] Webhook endpoints registered in Square Dashboard
- [ ] OAuth redirect URLs configured
- [ ] Rate limiting configured
- [ ] Monitoring and alerts set up
- [ ] Error tracking configured (Sentry)

### 6.3 Launch Communication
- [ ] Update feature catalog (already done ✓)
- [ ] Update dashboard messaging (already done ✓)
- [ ] Create help center articles
- [ ] Prepare support team
- [ ] Create demo video

---

## Success Metrics

### Technical Metrics
- OAuth success rate > 95%
- Sync latency < 5 seconds
- Webhook processing < 1 second
- Error rate < 1%

### Business Metrics
- Square connections in first week
- Active sync operations per day
- Customer satisfaction with sync accuracy
- Support tickets related to Square

---

## Risk Mitigation

### Risk 1: API Rate Limits
- **Mitigation:** Implement exponential backoff, queue system
- **Monitoring:** Track API usage, set alerts at 80% limit

### Risk 2: Webhook Delivery Failures
- **Mitigation:** Implement retry logic, fallback polling
- **Monitoring:** Track webhook success rate, alert on failures

### Risk 3: Data Sync Conflicts
- **Mitigation:** Last-write-wins with timestamp, conflict resolution UI
- **Monitoring:** Log all conflicts, review patterns

### Risk 4: OAuth Token Expiration
- **Mitigation:** Automatic refresh token flow, user notification
- **Monitoring:** Track token expiration, proactive refresh

---

## Dependencies & Prerequisites

### External
- Square Developer account (approved)
- Webhook endpoint accessible from Square servers
- SSL certificate for webhook endpoint

### Internal
- Existing Clover integration patterns (reference)
- Database migration system
- OAuth infrastructure
- Webhook processing infrastructure

---

## Team Assignments

### Backend (3-4 days)
- OAuth flow implementation
- Inventory sync service
- Webhook handlers
- Database migrations

### Frontend (1-2 days)
- Settings page
- Integration status UI
- Error handling

### QA (1-2 days)
- Test plan execution
- Sandbox testing
- Edge case validation

### DevOps (1 day)
- Environment setup
- Webhook configuration
- Monitoring setup

---

## Post-Launch

### Week 1
- Monitor error rates
- Collect user feedback
- Fix critical bugs
- Optimize sync performance

### Week 2-4
- Add advanced features (bulk sync, selective sync)
- Improve error messages
- Add sync history/logs
- Performance optimization

### Ongoing
- Monitor API changes from Square
- Update SDK versions
- Improve sync algorithms
- Add new Square features as available

---

## Appendix

### A. Square API Endpoints Used
- `/v2/oauth/authorize` - OAuth authorization
- `/v2/oauth/token` - Token exchange
- `/v2/catalog/list` - List catalog items
- `/v2/catalog/object/{id}` - Get catalog item
- `/v2/catalog/object` - Upsert catalog item
- `/v2/inventory/counts/batch-retrieve` - Get inventory counts
- `/v2/inventory/changes/batch-create` - Update inventory
- `/v2/locations` - List locations
- `/v2/merchants/me` - Get merchant info

### B. Required Square Permissions
- `ITEMS_READ` - Read catalog
- `ITEMS_WRITE` - Update catalog
- `INVENTORY_READ` - Read inventory
- `INVENTORY_WRITE` - Update inventory
- `MERCHANT_PROFILE_READ` - Read merchant info

### C. Webhook Events to Handle
- `inventory.count.updated` - Inventory changed
- `catalog.version.updated` - Catalog changed
- `oauth.authorization.revoked` - User disconnected

---

## Questions for Product/Business

1. Should we support multiple Square locations per tenant?
2. What's the sync frequency for non-webhook updates (fallback)?
3. Should we support Square gift cards/modifiers?
4. Do we need historical sync data/audit trail?
5. Should we support Square's loyalty program integration?

---

**Status:** Ready for implementation
**Estimated Completion:** 7 days from start
**Launch Blocker:** Yes - Required for day 1 launch with both POS systems
