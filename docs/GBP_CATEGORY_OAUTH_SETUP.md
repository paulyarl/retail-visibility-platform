# GBP Category OAuth Integration Guide

**Status:** Ready to Implement  
**Estimated Time:** 2-3 hours  
**Complexity:** Medium

## Overview

This guide walks through integrating OAuth 2.0 for the Google Business Profile Categories API, enabling automated sync of the full ~4,000 category list.

---

## Prerequisites

1. **Google Cloud Project** with GBP API enabled
2. **OAuth 2.0 Credentials** (Client ID + Secret)
3. **Service Account** (recommended) or User OAuth
4. **API Scopes:** `https://www.googleapis.com/auth/business.manage`

---

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project

```
1. Go to: https://console.cloud.google.com/
2. Create new project or select existing
3. Name: "Retail Visibility Platform" (or your choice)
```

### 1.2 Enable GBP API

```
1. Navigate to: APIs & Services → Library
2. Search: "Google Business Profile API"
3. Click: Enable
```

### 1.3 Create OAuth Credentials

**Option A: Service Account (Recommended for Server-to-Server)**

```
1. Navigate to: APIs & Services → Credentials
2. Click: Create Credentials → Service Account
3. Name: "gbp-category-sync"
4. Role: "Service Account Token Creator"
5. Click: Done
6. Click on service account → Keys tab
7. Add Key → Create new key → JSON
8. Download JSON file (keep secure!)
```

**Option B: OAuth 2.0 Client (For User Authorization)**

```
1. Navigate to: APIs & Services → Credentials
2. Click: Create Credentials → OAuth client ID
3. Application type: Web application
4. Name: "GBP Category Sync"
5. Authorized redirect URIs:
   - http://localhost:3001/api/oauth/gbp/callback (dev)
   - https://yourdomain.com/api/oauth/gbp/callback (prod)
6. Click: Create
7. Copy Client ID and Client Secret
```

---

## Step 2: Environment Variables

Add to your `.env` file:

### For Service Account:

```bash
# GBP Category Sync - Service Account
GBP_SERVICE_ACCOUNT_EMAIL=gbp-category-sync@your-project.iam.gserviceaccount.com
GBP_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}' # Full JSON as string
GBP_CATEGORY_SYNC_ENABLED=true
```

### For OAuth 2.0:

```bash
# GBP Category Sync - OAuth
GBP_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GBP_OAUTH_CLIENT_SECRET=your-client-secret
GBP_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/gbp/callback
GBP_CATEGORY_SYNC_ENABLED=true
```

---

## Step 3: Install Dependencies

```bash
npm install googleapis @types/googleapis
```

---

## Step 4: Create OAuth Service

Create `apps/api/src/services/GBPOAuthService.ts`:

```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class GBPOAuthService {
  private oauth2Client: OAuth2Client;
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/business.manage'
  ];

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GBP_OAUTH_CLIENT_ID,
      process.env.GBP_OAUTH_CLIENT_SECRET,
      process.env.GBP_OAUTH_REDIRECT_URI
    );
  }

  /**
   * Generate authorization URL for user consent
   */
  getAuthorizationUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials.access_token!;
  }

  /**
   * Get authenticated client for API calls
   */
  getAuthenticatedClient(accessToken: string): OAuth2Client {
    const client = new google.auth.OAuth2();
    client.setCredentials({ access_token: accessToken });
    return client;
  }
}
```

---

## Step 5: Update GBPCategorySyncService

Update `apps/api/src/services/GBPCategorySyncService.ts`:

```typescript
import { google } from 'googleapis';
import { GBPOAuthService } from './GBPOAuthService';
import { prisma } from '../prisma';

export class GBPCategorySyncService {
  private readonly API_BASE = 'https://mybusiness.googleapis.com/v4';
  private oauthService: GBPOAuthService;

  constructor() {
    this.oauthService = new GBPOAuthService();
  }

  /**
   * Fetch latest GBP categories from Google API
   */
  async fetchLatestCategories(options: {
    regionCode?: string;
    languageCode?: string;
    pageSize?: number;
  } = {}): Promise<{
    categories: GBPCategory[];
    totalCount: number;
    version: string;
  }> {
    const {
      regionCode = 'US',
      languageCode = 'en',
      pageSize = 100
    } = options;

    try {
      // Get access token from database or environment
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        console.log('[GBPCategorySync] No OAuth token available, using hardcoded fallback');
        return this.getHardcodedCategories();
      }

      // Create authenticated client
      const auth = this.oauthService.getAuthenticatedClient(accessToken);
      const mybusiness = google.mybusiness({ version: 'v4', auth });

      const categories: GBPCategory[] = [];
      let nextPageToken: string | undefined;
      let totalCount = 0;

      do {
        const response = await mybusiness.categories.list({
          regionCode,
          languageCode,
          pageSize,
          pageToken: nextPageToken
        });

        if (response.data.categories) {
          categories.push(...response.data.categories.map(cat => ({
            categoryId: cat.name || '',
            displayName: cat.displayName || '',
            serviceTypes: cat.serviceTypes || [],
            moreHoursTypes: cat.moreHoursTypes || []
          })));
        }

        totalCount = response.data.totalCategoryCount || 0;
        nextPageToken = response.data.nextPageToken;
      } while (nextPageToken);

      return {
        categories,
        totalCount,
        version: this.generateVersion()
      };
    } catch (error) {
      console.error('[GBPCategorySync] Failed to fetch categories:', error);
      
      // Fallback to hardcoded categories
      return this.getHardcodedCategories();
    }
  }

  /**
   * Get access token from database or refresh if expired
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      // Check if we have stored OAuth tokens
      const oauthConfig = await prisma.systemConfig.findUnique({
        where: { key: 'gbp_oauth_tokens' }
      });

      if (!oauthConfig) {
        return null;
      }

      const tokens = JSON.parse(oauthConfig.value);
      
      // Check if token is expired
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        // Refresh token
        const newAccessToken = await this.oauthService.refreshAccessToken(tokens.refresh_token);
        
        // Update stored tokens
        await prisma.systemConfig.update({
          where: { key: 'gbp_oauth_tokens' },
          data: {
            value: JSON.stringify({
              ...tokens,
              access_token: newAccessToken,
              expiry_date: Date.now() + 3600000 // 1 hour
            })
          }
        });

        return newAccessToken;
      }

      return tokens.access_token;
    } catch (error) {
      console.error('[GBPCategorySync] Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Fallback to hardcoded categories
   */
  private getHardcodedCategories() {
    // Return the 30 hardcoded categories
    // (existing implementation)
  }

  // ... rest of existing methods
}
```

---

## Step 6: Create OAuth Callback Endpoint

Add to `apps/api/src/index.ts`:

```typescript
import { GBPOAuthService } from './services/GBPOAuthService';

// GET /api/oauth/gbp/authorize - Start OAuth flow
app.get('/api/oauth/gbp/authorize', async (req, res) => {
  try {
    const oauthService = new GBPOAuthService();
    const authUrl = oauthService.getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('[OAuth] Authorization failed:', error);
    res.status(500).json({ error: 'Failed to start authorization' });
  }
});

// GET /api/oauth/gbp/callback - OAuth callback
app.get('/api/oauth/gbp/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const oauthService = new GBPOAuthService();
    const tokens = await oauthService.getTokensFromCode(code);

    // Store tokens in database
    await prisma.systemConfig.upsert({
      where: { key: 'gbp_oauth_tokens' },
      update: {
        value: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date
        })
      },
      create: {
        key: 'gbp_oauth_tokens',
        value: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date
        })
      }
    });

    // Trigger immediate sync
    const { GBPCategorySyncService } = await import('./services/GBPCategorySyncService');
    const syncService = new GBPCategorySyncService();
    const result = await syncService.checkForUpdates();

    if (result.hasUpdates) {
      await syncService.applyUpdates(result.changes);
    }

    res.send(`
      <html>
        <body>
          <h1>✅ GBP Categories OAuth Connected!</h1>
          <p>Successfully authorized. You can close this window.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[OAuth] Callback failed:', error);
    res.status(500).json({ error: 'Failed to complete authorization' });
  }
});

// GET /api/oauth/gbp/status - Check OAuth status
app.get('/api/oauth/gbp/status', async (req, res) => {
  try {
    const oauthConfig = await prisma.systemConfig.findUnique({
      where: { key: 'gbp_oauth_tokens' }
    });

    res.json({
      connected: !!oauthConfig,
      hasRefreshToken: oauthConfig ? JSON.parse(oauthConfig.value).refresh_token : false
    });
  } catch (error) {
    console.error('[OAuth] Status check failed:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});
```

---

## Step 7: Add SystemConfig Model (if not exists)

Add to `prisma/schema.prisma`:

```prisma
model SystemConfig {
  key       String   @id
  value     String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("system_config")
}
```

Run migration:

```bash
npx prisma migrate dev --name add_system_config
```

---

## Step 8: Create Admin UI (Optional)

Create a simple admin page to trigger OAuth:

```typescript
// apps/web/src/app/admin/gbp-oauth/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';

export default function GBPOAuthPage() {
  const [status, setStatus] = useState<{ connected: boolean } | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const response = await fetch('/api/oauth/gbp/status');
    const data = await response.json();
    setStatus(data);
  };

  const startOAuth = () => {
    window.location.href = '/api/oauth/gbp/authorize';
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">GBP Category OAuth Setup</h1>
      
      {status && (
        <div className="mb-4">
          <p>Status: {status.connected ? '✅ Connected' : '❌ Not Connected'}</p>
        </div>
      )}

      <Button onClick={startOAuth}>
        {status?.connected ? 'Reconnect OAuth' : 'Connect OAuth'}
      </Button>
    </div>
  );
}
```

---

## Step 9: Testing

### Test OAuth Flow:

1. **Start server:** `npm run dev`
2. **Navigate to:** `http://localhost:3001/admin/gbp-oauth`
3. **Click:** "Connect OAuth"
4. **Authorize:** Grant permissions in Google consent screen
5. **Verify:** Check console for sync logs

### Test API Calls:

```bash
# Check OAuth status
curl http://localhost:3001/api/oauth/gbp/status

# Trigger manual sync (after OAuth)
curl -X POST http://localhost:3001/api/admin/gbp-categories/sync
```

---

## Step 10: Production Deployment

### Environment Variables:

```bash
# Production
GBP_OAUTH_CLIENT_ID=your-prod-client-id
GBP_OAUTH_CLIENT_SECRET=your-prod-secret
GBP_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/gbp/callback
GBP_CATEGORY_SYNC_ENABLED=true
```

### Security Checklist:

- ✅ Store tokens encrypted in database
- ✅ Use HTTPS for redirect URI
- ✅ Implement token refresh logic
- ✅ Add admin-only access to OAuth endpoints
- ✅ Log all OAuth events
- ✅ Monitor token expiration
- ✅ Handle revoked tokens gracefully

---

## Troubleshooting

### Issue: "Invalid redirect URI"
**Solution:** Ensure redirect URI in Google Console exactly matches your environment variable

### Issue: "Insufficient permissions"
**Solution:** Verify `business.manage` scope is enabled in Google Console

### Issue: "Token expired"
**Solution:** Implement automatic token refresh (Step 5 includes this)

### Issue: "API not enabled"
**Solution:** Enable Google Business Profile API in Google Cloud Console

---

## Alternative: Service Account (Simpler)

If you don't need user-specific authorization, use a Service Account:

```typescript
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GBP_SERVICE_ACCOUNT_KEY!),
  scopes: ['https://www.googleapis.com/auth/business.manage']
});

const mybusiness = google.mybusiness({ version: 'v4', auth });
```

**Pros:**
- No user consent needed
- No token refresh needed
- Simpler implementation

**Cons:**
- Requires service account setup
- May need domain-wide delegation

---

## Summary

**Time to Complete:** 2-3 hours
**Difficulty:** Medium
**Impact:** High (enables full 4,000 category list)

**Steps:**
1. ✅ Google Cloud setup (30 min)
2. ✅ Environment variables (5 min)
3. ✅ Install dependencies (2 min)
4. ✅ Create OAuth service (30 min)
5. ✅ Update sync service (45 min)
6. ✅ Create callback endpoint (30 min)
7. ✅ Database migration (10 min)
8. ✅ Admin UI (optional, 20 min)
9. ✅ Testing (30 min)
10. ✅ Production deployment (20 min)

**Result:** Automated sync of full GBP category list with weekly updates!
