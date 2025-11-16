# GBP Category OAuth - Simplified Setup (Using Existing OAuth)

**Status:** Ready to Implement  
**Estimated Time:** 30 minutes  
**Complexity:** Low (reusing existing OAuth)

## Overview

You already have Google Business OAuth configured! We just need to update the GBPCategorySyncService to use your existing OAuth tokens.

---

## Your Existing Setup

```bash
GOOGLE_BUSINESS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=your-client-secret
GOOGLE_BUSINESS_REDIRECT_URI=https://api.visibleshelf.com/auth/google/business/callback
```

These credentials are already configured in your environment (Doppler).

---

## Step 1: Update GBPCategorySyncService

Update `apps/api/src/services/GBPCategorySyncService.ts` to use existing OAuth:

```typescript
import { google } from 'googleapis';
import { prisma } from '../prisma';

export class GBPCategorySyncService {
  private readonly API_BASE = 'https://mybusiness.googleapis.com/v4';

  /**
   * Get access token from existing Google Business OAuth integration
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      // Check if we have stored Google Business OAuth tokens
      // These are stored when users connect their Google Business Profile
      const oauthIntegration = await prisma.oAuthIntegration.findFirst({
        where: {
          provider: 'google_business',
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!oauthIntegration) {
        console.log('[GBPCategorySync] No Google Business OAuth integration found');
        return null;
      }

      // Decrypt and parse tokens
      const tokens = JSON.parse(oauthIntegration.accessToken); // Adjust based on your storage format
      
      // Check if token is expired
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        // Refresh token using existing OAuth service
        const newAccessToken = await this.refreshAccessToken(tokens.refresh_token);
        return newAccessToken;
      }

      return tokens.access_token;
    } catch (error) {
      console.error('[GBPCategorySync] Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Refresh access token using existing OAuth credentials
   */
  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_BUSINESS_CLIENT_ID,
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
      process.env.GOOGLE_BUSINESS_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token!;
  }

  /**
   * Fetch latest GBP categories from Google API
   */
  async fetchLatestCategories(options: {
    regionCode?: string;
    languageCode?: string;
    pageSize?: number;
  } = {}): Promise<{
    categories: any[];
    totalCount: number;
    version: string;
  }> {
    const {
      regionCode = 'US',
      languageCode = 'en',
      pageSize = 100
    } = options;

    try {
      // Get access token from existing OAuth integration
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        console.log('[GBPCategorySync] No OAuth token available, using hardcoded fallback');
        return this.getHardcodedCategories();
      }

      // Create authenticated client
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      const mybusiness = google.mybusiness({ version: 'v4', auth });

      const categories: any[] = [];
      let nextPageToken: string | undefined;
      let totalCount = 0;

      console.log('[GBPCategorySync] Fetching categories from Google API...');

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
        
        console.log(`[GBPCategorySync] Fetched ${categories.length}/${totalCount} categories`);
      } while (nextPageToken);

      console.log(`[GBPCategorySync] Successfully fetched ${categories.length} categories from Google API`);

      return {
        categories,
        totalCount,
        version: this.generateVersion()
      };
    } catch (error) {
      console.error('[GBPCategorySync] Failed to fetch categories from API:', error);
      
      // Fallback to hardcoded categories
      console.log('[GBPCategorySync] Falling back to hardcoded categories');
      return this.getHardcodedCategories();
    }
  }

  /**
   * Fallback to hardcoded categories
   */
  private getHardcodedCategories() {
    const hardcodedCategories = [
      { categoryId: "gcid:grocery_store", displayName: "Grocery store" },
      { categoryId: "gcid:convenience_store", displayName: "Convenience store" },
      { categoryId: "gcid:supermarket", displayName: "Supermarket" },
      { categoryId: "gcid:liquor_store", displayName: "Liquor store" },
      { categoryId: "gcid:specialty_food_store", displayName: "Specialty food store" },
      { categoryId: "gcid:clothing_store", displayName: "Clothing store" },
      { categoryId: "gcid:shoe_store", displayName: "Shoe store" },
      { categoryId: "gcid:electronics_store", displayName: "Electronics store" },
      { categoryId: "gcid:furniture_store", displayName: "Furniture store" },
      { categoryId: "gcid:hardware_store", displayName: "Hardware store" },
      { categoryId: "gcid:pharmacy", displayName: "Pharmacy" },
      { categoryId: "gcid:beauty_supply_store", displayName: "Beauty supply store" },
      { categoryId: "gcid:cosmetics_store", displayName: "Cosmetics store" },
      { categoryId: "gcid:health_and_beauty_shop", displayName: "Health and beauty shop" },
      { categoryId: "gcid:book_store", displayName: "Book store" },
      { categoryId: "gcid:pet_store", displayName: "Pet store" },
      { categoryId: "gcid:toy_store", displayName: "Toy store" },
      { categoryId: "gcid:sporting_goods_store", displayName: "Sporting goods store" },
      { categoryId: "gcid:gift_shop", displayName: "Gift shop" },
      { categoryId: "gcid:department_store", displayName: "Department store" },
      { categoryId: "gcid:discount_store", displayName: "Discount store" },
      { categoryId: "gcid:variety_store", displayName: "Variety store" },
      { categoryId: "gcid:home_goods_store", displayName: "Home goods store" },
      { categoryId: "gcid:jewelry_store", displayName: "Jewelry store" },
      { categoryId: "gcid:florist", displayName: "Florist" },
      { categoryId: "gcid:bakery", displayName: "Bakery" },
      { categoryId: "gcid:butcher_shop", displayName: "Butcher shop" },
      { categoryId: "gcid:produce_market", displayName: "Produce market" },
      { categoryId: "gcid:wine_store", displayName: "Wine store" },
    ];

    return {
      categories: hardcodedCategories,
      totalCount: hardcodedCategories.length,
      version: this.generateVersion()
    };
  }

  /**
   * Generate version string
   */
  private generateVersion(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // ... rest of existing methods (checkForUpdates, applyUpdates, etc.)
}
```

---

## Step 2: Check Your OAuth Integration Table

You likely have an `oauth_integrations` table. Let me check what it's called:

```sql
-- Check your OAuth table structure
SELECT * FROM oauth_integrations 
WHERE provider = 'google_business' 
LIMIT 1;

-- Or it might be called:
SELECT * FROM google_business_integrations LIMIT 1;
```

---

## Step 3: Install googleapis Package

```bash
npm install googleapis @types/googleapis
```

---

## Step 4: Test the Integration

The sync job will automatically run on server startup and weekly. To test immediately:

1. **Restart your API server:**
```bash
doppler run -- npm run dev
```

2. **Check logs for:**
```
📋 GBP category sync job enabled - checking weekly
✅ Seeded 30 GBP categories to database
🔄 Checking for GBP category updates...
[GBPCategorySync] Fetching categories from Google API...
[GBPCategorySync] Fetched 100/4000 categories
[GBPCategorySync] Successfully fetched 4000 categories from Google API
✅ Applied X updates, Y failed
```

---

## Step 5: Verify Database

Check that categories were synced:

```sql
SELECT COUNT(*) FROM gbp_categories WHERE is_active = true;
-- Should show ~4000 categories if OAuth worked
-- Should show ~30 categories if using hardcoded fallback
```

---

## Key Points

**✅ Reuses Existing OAuth:**
- No new OAuth setup needed
- Uses your existing Google Business credentials
- Leverages existing token storage

**✅ Automatic Fallback:**
- If OAuth token not found → uses hardcoded 30 categories
- If API call fails → uses hardcoded 30 categories
- Always works, even without OAuth

**✅ Automatic Token Refresh:**
- Checks token expiration
- Refreshes automatically using refresh token
- No manual intervention needed

**✅ Weekly Sync:**
- Runs automatically every 7 days
- Updates database with latest categories
- Keeps category list current

---

## Troubleshooting

### Issue: "No Google Business OAuth integration found"

**Check your OAuth table:**
```sql
SELECT * FROM oauth_integrations WHERE provider LIKE '%google%';
```

**Adjust the query in `getAccessToken()` to match your table structure.**

### Issue: "Insufficient permissions"

**Verify your OAuth scope includes:**
- `https://www.googleapis.com/auth/business.manage`

**Check in Google Cloud Console:**
1. Go to OAuth consent screen
2. Verify scopes include business.manage

### Issue: Still using hardcoded categories

**Check logs for specific error:**
```
[GBPCategorySync] Failed to fetch categories from API: [error details]
```

**Common causes:**
- OAuth token expired and refresh failed
- API not enabled in Google Cloud Console
- Insufficient permissions

---

## Summary

**Time to Complete:** 30 minutes
**Difficulty:** Low (reusing existing OAuth)
**Impact:** High (4,000 categories vs 30)

**Steps:**
1. ✅ Update GBPCategorySyncService (15 min)
2. ✅ Install googleapis package (2 min)
3. ✅ Restart server (1 min)
4. ✅ Verify sync logs (5 min)
5. ✅ Check database (2 min)

**Result:** Automated sync of full 4,000 GBP category list using your existing OAuth!

---

## Next Steps

1. **Update the service** with the code above
2. **Adjust OAuth table query** to match your schema
3. **Restart server** and check logs
4. **Verify categories** in database
5. **Test search** in GBPCategorySelector

The system will automatically:
- ✅ Use OAuth if available
- ✅ Fall back to hardcoded if not
- ✅ Refresh tokens automatically
- ✅ Sync weekly
- ✅ Update database

Much simpler than setting up new OAuth from scratch!
