# Google Merchant Center Setup Guide

This guide walks you through connecting your store to Google Merchant Center to get your products listed on Google Shopping.

---

## What is Google Merchant Center?

Google Merchant Center is a free tool that lets you upload your store and product data to Google. Once connected, your products can appear in:

- **Google Shopping** - Product listings in search results
- **Google Search** - Rich product snippets
- **Google Images** - Product image search
- **Google Maps** - Local inventory (if you have a physical store)

---

## Prerequisites

Before you begin, make sure you have:

- [ ] A Google account (Gmail or Google Workspace)
- [ ] Your business information ready (name, address, website)
- [ ] Products in your RVP inventory with:
  - Product name
  - Price
  - At least one image
  - Description (recommended)

---

## Step 1: Create a Google Merchant Center Account

If you don't already have a Merchant Center account:

1. Go to [merchants.google.com](https://merchants.google.com)
2. Click **Get Started**
3. Sign in with your Google account
4. Enter your business information:
   - Business name
   - Country
   - Time zone
5. Accept the Terms of Service
6. Complete the setup wizard

> **Tip:** Use the same Google account you'll use to connect to RVP.

---

## Step 2: Verify Your Website (Optional but Recommended)

Google may require you to verify ownership of your website:

1. In Merchant Center, go to **Settings** → **Business information**
2. Add your website URL
3. Choose a verification method:
   - **HTML tag** - Add a meta tag to your website
   - **Google Analytics** - If you use GA on your site
   - **Google Tag Manager** - If you use GTM
4. Complete verification

> **Note:** If you don't have a website, you can still list products, but some features may be limited.

---

## Step 3: Connect Your RVP Account to Google

1. Log in to your RVP dashboard
2. Navigate to **Settings** → **Integrations** → **Google**
3. Click **Connect Google Account**
4. Sign in with the same Google account you used for Merchant Center
5. Grant the requested permissions:
   - View and manage your Google Merchant Center account
   - View your email address (for account identification)
6. You'll be redirected back to RVP

---

## Step 4: Link Your Merchant Center Account

After connecting your Google account:

1. Click **Link Merchant Center**
2. Select your Merchant Center account from the list
3. Click to confirm the link

You should now see all three checkmarks:
- ✅ Connect Google Account
- ✅ Link Merchant Center
- ✅ Authorization Active

---

## Step 5: Sync Your Products

### Manual Sync

1. Go to **Items** (your inventory page)
2. Click the **Sync to Google** button (appears when connected)
3. Wait for the sync to complete
4. You'll see a confirmation message with the number of products synced

### Automatic Sync

Once connected, your products are automatically synced every 6 hours. You don't need to do anything!

---

## Step 6: Verify Your Products in Merchant Center

1. Go to [merchants.google.com](https://merchants.google.com)
2. Click **Products** in the left menu
3. You should see your synced products
4. Check for any warnings or errors that need attention

---

## Troubleshooting

### "No Merchant Center accounts found"

- Make sure you've created a Merchant Center account first
- Verify you're signed in with the correct Google account
- Try disconnecting and reconnecting your Google account

### Products not appearing in Google Shopping

- Products can take 24-48 hours to appear after first sync
- Check Merchant Center for any product disapprovals
- Ensure products have:
  - Valid price
  - At least one image
  - Visibility set to "Public"

### Sync errors

- Check that your products have all required fields
- Review the sync status page for specific error messages
- Contact support if errors persist

---

## Product Requirements for Google Shopping

For best results, ensure your products have:

| Field | Required | Notes |
|-------|----------|-------|
| Title | ✅ Yes | Clear, descriptive product name |
| Price | ✅ Yes | Must be greater than $0 |
| Image | ✅ Yes | At least one high-quality image |
| Description | Recommended | Helps with search visibility |
| Brand | Recommended | Improves product matching |
| GTIN/UPC | Recommended | Required for some categories |
| Availability | ✅ Yes | In stock / Out of stock |

---

## FAQ

### How often are products synced?

Products are automatically synced every 6 hours. You can also manually sync anytime from the Items page.

### Do I need to pay for Google Merchant Center?

No! Google Merchant Center is free. Your products appear in free listings on Google Shopping.

### Can I sync only certain products?

Currently, all public products are synced. Products with visibility set to "Private" are not synced.

### How do I disconnect from Google?

Go to **Settings** → **Integrations** → **Google** and click **Disconnect**.

---

## Need Help?

If you're having trouble connecting or syncing:

1. Check the [Google Merchant Center Help](https://support.google.com/merchants)
2. Review your sync status in RVP
3. Contact RVP support for assistance

---

*Last updated: December 2025*
