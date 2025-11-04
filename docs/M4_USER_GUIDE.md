# M4 SKU Scanning - User Guide

**Feature:** SKU Scanning & Inventory Management  
**Version:** 1.0.0  
**Last Updated:** November 4, 2025

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Starting a Scan Session](#starting-a-scan-session)
4. [Scanning Products](#scanning-products)
5. [Managing Scan Results](#managing-scan-results)
6. [Committing to Inventory](#committing-to-inventory)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## 🎯 Introduction

### What is SKU Scanning?

SKU Scanning is a powerful feature that allows you to quickly add products to your inventory by scanning barcodes. The system automatically looks up product information, enriches the data, and adds items to your inventory in bulk.

### Key Benefits

- ⚡ **Fast Data Entry** - Scan dozens of products in minutes
- 🔍 **Automatic Enrichment** - Product details fetched automatically
- ✅ **Validation** - Catch errors before committing to inventory
- 📊 **Duplicate Detection** - Prevents scanning the same item twice
- 🎯 **Accuracy** - Reduces manual entry errors

### Use Cases

- **Initial Inventory Setup** - Quickly populate a new store
- **Stock Taking** - Verify and update existing inventory
- **Receiving Shipments** - Add new products as they arrive
- **Inventory Audits** - Reconcile physical stock with system records

### Supported Devices

- 🖱️ **USB Barcode Scanners** - Plug-and-play support
- ⌨️ **Manual Entry** - Type barcodes directly
- 📱 **Camera Scanning** - Coming soon

---

## 🚀 Getting Started

### Prerequisites

Before you begin scanning:

1. ✅ You must be logged in
2. ✅ You must have a tenant selected
3. ✅ You must have inventory management permissions
4. ✅ (Optional) USB barcode scanner connected

### Accessing the Scan Feature

**Method 1: From Quick Start**
1. Navigate to your tenant dashboard
2. Click **"Quick Start"** in the sidebar
3. Look for the **"SKU Scanning"** option
4. Click **"Start Scanning"**

**Method 2: Direct URL**
```
/t/[your-tenant-id]/scan
```

**Method 3: From Inventory Page**
1. Go to **Inventory** page
2. Click **"Scan Products"** button
3. You'll be redirected to the scan interface

### Permission Requirements

| Role | Can Scan | Can Commit | Can Cancel |
|------|----------|------------|------------|
| Admin | ✅ | ✅ | ✅ |
| Business Owner | ✅ | ✅ | ✅ |
| User | ✅ | ✅ | ✅ |
| Viewer | ❌ | ❌ | ❌ |

---

## 📱 Starting a Scan Session

### Step 1: Choose Device Type

When you start a new scan session, you'll be asked to select your input method:

**USB Scanner** (Recommended)
- Fastest method
- Hands-free operation
- Automatic barcode detection
- Best for high-volume scanning

**Manual Entry**
- No hardware required
- Good for small batches
- Useful for damaged barcodes
- Backup option if scanner fails

### Step 2: Configure Session (Optional)

**Session Name** (Optional)
- Give your session a descriptive name
- Example: "Weekly Stock Count - Nov 2025"
- Helps track scanning history

**Template** (Optional)
- Pre-fill common product fields
- Set default category
- Set default brand
- Useful for scanning similar items

### Step 3: Start Scanning

1. Click **"Start Session"**
2. Session is created and ready
3. You'll see:
   - Session ID
   - Start time
   - Device type
   - Scanned count (starts at 0)

---

## 🔍 Scanning Products

### Using a USB Scanner

1. **Position the scanner** - Point at barcode
2. **Pull the trigger** - Scanner beeps when successful
3. **Wait for confirmation** - Item appears in results list
4. **Repeat** - Continue scanning next item

**Tips:**
- Hold scanner 4-6 inches from barcode
- Ensure good lighting
- Keep barcode flat and unwrinkled
- If it doesn't scan, try manual entry

### Manual Entry

1. **Click the input field** - Focus on barcode entry
2. **Type the barcode** - Enter all digits
3. **Press Enter** - Submit the barcode
4. **Wait for confirmation** - Item appears in results
5. **Repeat** - Continue with next barcode

**Tips:**
- Double-check digits before pressing Enter
- Use number pad for faster entry
- Watch for leading zeros
- Most UPC barcodes are 12 digits

### What Happens When You Scan

1. **Barcode Submitted** - System receives the barcode
2. **Duplicate Check** - Verifies not already scanned
3. **Product Lookup** - Searches product database
4. **Enrichment** - Fetches additional product data
5. **Display Result** - Shows product in results list

### Product Enrichment

The system automatically enriches products with:

- **Product Name** - Official product title
- **Brand** - Manufacturer or brand name
- **Category** - Product classification
- **Description** - Product details
- **Images** - Product photos (when available)
- **Price** - Suggested retail price (when available)
- **Attributes** - Size, color, weight, etc.

**Data Sources:**
- Internal product database
- UPC Database API
- Google Shopping
- Manufacturer databases

---

## 📋 Managing Scan Results

### Viewing Results

**Results List** shows:
- ✅ Product name
- 🏷️ Barcode/UPC
- 📦 Brand
- 🗂️ Category
- ⏰ Scan timestamp
- 🎨 Product image (if available)

**Sorting Options:**
- Most recent first (default)
- Alphabetical by name
- By category
- By brand

**Filtering Options:**
- Show all items
- Show enriched items only
- Show items needing review
- Show duplicates

### Reviewing Product Details

1. **Click on any scanned item**
2. View detailed information:
   - Full product name
   - Complete description
   - All attributes
   - Enrichment status
   - Data source
3. **Edit if needed** (see below)
4. **Close** to return to list

### Editing Scanned Items

Before committing, you can edit any item:

1. **Click the Edit icon** (pencil) on an item
2. **Modify fields:**
   - Product name
   - Description
   - Category
   - Brand
   - Price
   - Quantity (default: 1)
3. **Click Save** to apply changes
4. **Click Cancel** to discard changes

**Editable Fields:**
- ✏️ Name
- ✏️ Description
- ✏️ Category
- ✏️ Brand
- ✏️ Price
- ✏️ Quantity
- ✏️ Custom attributes

**Non-Editable Fields:**
- 🔒 Barcode/UPC
- 🔒 Scan timestamp
- 🔒 Session ID

### Removing Items

If you scanned an item by mistake:

1. **Find the item** in results list
2. **Click the Delete icon** (trash)
3. **Confirm removal**
4. Item is removed from session
5. Scanned count decreases

**Note:** Removed items can be scanned again if needed.

### Handling Duplicates

If you scan the same barcode twice:

**What Happens:**
- 🚫 System rejects the duplicate
- ⚠️ Warning message appears
- 📊 Duplicate counter increases
- 🔢 Original item remains in list

**Options:**
1. **Ignore** - Continue scanning
2. **Increase Quantity** - Edit original item to increase qty
3. **Remove Original** - Delete first scan, scan again

---

## ✅ Committing to Inventory

### Review Before Commit

Before finalizing, review your scan session:

**Check:**
- ✅ All items scanned correctly
- ✅ Product names are accurate
- ✅ Categories assigned
- ✅ Quantities correct
- ✅ No unwanted items

**Session Summary Shows:**
- Total items scanned
- Successful enrichments
- Items needing review
- Duplicate attempts
- Session duration

### Validation

The system validates each item before committing:

**Required Fields:**
- ✅ Product name
- ✅ Category
- ✅ Barcode/UPC

**Optional Fields:**
- Brand
- Description
- Price
- Images
- Attributes

**Validation Errors:**

If validation fails, you'll see:
- ❌ List of items with errors
- 📝 What's missing for each item
- 🔧 How to fix each issue

**Common Issues:**
- Missing product name → Add manually
- Missing category → Assign category
- Invalid barcode → Check digits

### Committing the Session

**Option 1: Commit with Validation** (Recommended)

1. Click **"Commit to Inventory"**
2. System validates all items
3. If validation passes:
   - Items added to inventory
   - Session marked complete
   - Success message shown
4. If validation fails:
   - Error list displayed
   - Fix issues and try again

**Option 2: Skip Validation** (Advanced)

1. Click **"Advanced Options"**
2. Check **"Skip Validation"**
3. Click **"Commit Anyway"**
4. Items added without validation
5. ⚠️ Use with caution!

**After Commit:**
- ✅ Items appear in inventory
- 📊 Inventory counts updated
- 📝 Audit log entry created
- 🎉 Success notification shown
- 🔄 Session status: Completed

### What Gets Added to Inventory

Each scanned item becomes an inventory item with:

**Core Data:**
- Product name
- Barcode/UPC
- Category
- Brand
- Description

**Inventory Data:**
- Quantity (default: 1)
- Status (default: Active)
- Tenant ID
- Created timestamp
- Created by (your user ID)

**Enrichment Data:**
- Product images
- Attributes
- Pricing info
- Data source

---

## 🎓 Advanced Features

### Using Templates

Templates pre-fill common fields for faster scanning:

**Creating a Template:**
1. Go to **Settings → Scan Templates**
2. Click **"New Template"**
3. Set defaults:
   - Category
   - Brand
   - Status
   - Custom attributes
4. Save template

**Using a Template:**
1. Start new scan session
2. Select template from dropdown
3. All scanned items inherit template values
4. Override individual items as needed

**Use Cases:**
- Scanning products from same brand
- Adding items to specific category
- Bulk imports with common attributes

### Batch Operations

Perform actions on multiple items at once:

**Select Multiple Items:**
1. Check boxes next to items
2. Or click **"Select All"**

**Batch Actions:**
- 🗂️ **Assign Category** - Set category for all
- 🏷️ **Set Brand** - Apply brand to all
- 🔢 **Update Quantity** - Change qty for all
- 🗑️ **Delete Selected** - Remove multiple items
- ✏️ **Bulk Edit** - Edit common fields

### Session Management

**Pausing a Session:**
1. Click **"Pause"** button
2. Session saved with current state
3. Resume anytime from session list

**Resuming a Session:**
1. Go to **"My Sessions"**
2. Find paused session
3. Click **"Resume"**
4. Continue scanning

**Canceling a Session:**
1. Click **"Cancel Session"**
2. Confirm cancellation
3. All scanned items discarded
4. Session marked as canceled

**Session History:**
- View all past sessions
- See session details
- Review what was scanned
- Check commit status
- Export session data

### Keyboard Shortcuts

Speed up your workflow with shortcuts:

| Shortcut | Action |
|----------|--------|
| `Enter` | Submit barcode |
| `Esc` | Clear input field |
| `Ctrl + S` | Save current item |
| `Ctrl + D` | Delete selected item |
| `Ctrl + Enter` | Commit session |
| `Ctrl + Z` | Undo last scan |
| `Tab` | Navigate fields |

---

## 🔧 Troubleshooting

### Scanner Not Working

**Problem:** USB scanner not detecting barcodes

**Solutions:**
1. ✅ Check USB connection
2. ✅ Try different USB port
3. ✅ Restart browser
4. ✅ Check scanner LED (should be on)
5. ✅ Test scanner in notepad (should type numbers)
6. ✅ Switch to manual entry as backup

**Still not working?**
- Check scanner compatibility
- Update scanner drivers
- Try different scanner
- Contact support

### Barcode Not Found

**Problem:** "Product not found" error

**Possible Causes:**
- Barcode not in database
- Damaged/unreadable barcode
- Wrong barcode type
- Regional barcode variation

**Solutions:**
1. **Try manual entry** - Retype barcode carefully
2. **Check barcode format** - Ensure correct digits
3. **Add manually** - Create product manually
4. **Skip item** - Continue with other items
5. **Contact support** - Report missing barcode

### Duplicate Detection Issues

**Problem:** System says duplicate but item not in list

**Causes:**
- Item was removed earlier
- Item in different session
- Cache issue

**Solutions:**
1. Refresh the page
2. Check session history
3. Clear browser cache
4. Start new session

### Validation Errors

**Problem:** Can't commit due to validation errors

**Common Errors:**

**"Product name required"**
- Solution: Edit item and add name

**"Category required"**
- Solution: Assign category to item

**"Invalid barcode format"**
- Solution: Check barcode digits

**"Duplicate barcode in inventory"**
- Solution: Item already exists, update quantity instead

### Slow Performance

**Problem:** Scanning is slow or laggy

**Solutions:**
1. Close other browser tabs
2. Clear browser cache
3. Check internet connection
4. Reduce number of items per session
5. Commit current session and start new one
6. Use Chrome or Edge (recommended browsers)

### Session Lost

**Problem:** Session disappeared or can't find it

**Solutions:**
1. Check **"My Sessions"** page
2. Look in **"Paused Sessions"**
3. Check **"Session History"**
4. Session may have auto-expired (after 24 hours)
5. Contact support with session ID

---

## 💡 Best Practices

### Efficient Scanning Workflow

**1. Prepare Your Workspace**
- Good lighting
- Flat surface
- Scanner within reach
- Products organized
- Clear workspace

**2. Batch Similar Items**
- Group by category
- Group by brand
- Use templates
- Scan in logical order

**3. Regular Commits**
- Commit every 50-100 items
- Don't wait until end
- Reduces risk of data loss
- Easier to review smaller batches

**4. Quality Control**
- Review items as you scan
- Fix errors immediately
- Check enrichment quality
- Verify categories

**5. Use Keyboard Shortcuts**
- Faster than mouse
- Reduces hand movement
- Increases productivity

### Data Quality Tips

**Product Names:**
- ✅ Use official product names
- ✅ Include brand in name
- ✅ Add size/variant info
- ❌ Don't use all caps
- ❌ Don't use abbreviations

**Categories:**
- ✅ Use specific categories
- ✅ Follow category hierarchy
- ✅ Be consistent
- ❌ Don't create duplicate categories
- ❌ Don't use vague categories

**Descriptions:**
- ✅ Include key features
- ✅ Mention use cases
- ✅ Add specifications
- ❌ Don't copy full marketing text
- ❌ Don't include pricing

### Session Management

**When to Start New Session:**
- Different product category
- Different supplier/brand
- Different location
- New day/shift
- After committing 100+ items

**When to Pause Session:**
- Taking a break
- Need to verify something
- Switching tasks
- End of shift
- Technical issues

**When to Cancel Session:**
- Wrong tenant selected
- Duplicate session created
- Major scanning errors
- Starting over needed

### Performance Optimization

**For Large Batches (100+ items):**
1. Commit in smaller batches (50 items)
2. Use templates to reduce enrichment time
3. Close other applications
4. Use wired internet connection
5. Scan during off-peak hours

**For Best Speed:**
- Use USB scanner (not manual)
- Pre-organize products
- Use keyboard shortcuts
- Minimize editing
- Batch similar items

### Error Prevention

**Before Scanning:**
- ✅ Select correct tenant
- ✅ Check scanner connection
- ✅ Verify template settings
- ✅ Clear any previous session

**During Scanning:**
- ✅ Watch for duplicate warnings
- ✅ Verify product names
- ✅ Check enrichment status
- ✅ Review periodically

**Before Committing:**
- ✅ Review all items
- ✅ Check for missing data
- ✅ Verify quantities
- ✅ Confirm categories

---

## 📊 Understanding Metrics

### Session Metrics

**Scanned Count** - Total items scanned (including duplicates)

**Unique Items** - Distinct products in session

**Enrichment Rate** - % of items with full data

**Duplicate Rate** - % of duplicate scan attempts

**Session Duration** - Time from start to commit

**Commit Success Rate** - % of items successfully added

### Quality Indicators

**🟢 High Quality (90%+ enrichment)**
- Most fields populated
- Images available
- Categories assigned
- Ready to commit

**🟡 Medium Quality (50-89% enrichment)**
- Basic info available
- Some fields missing
- May need manual review
- Can commit with edits

**🔴 Low Quality (<50% enrichment)**
- Minimal data available
- Requires manual entry
- Review before committing
- Consider adding manually

---

## 🆘 Getting Help

### In-App Help

**Help Button** - Click ? icon for:
- Feature overview
- Quick tips
- Keyboard shortcuts
- Video tutorials

**Tooltips** - Hover over elements for:
- Field descriptions
- Button functions
- Status meanings

### Support Resources

**Documentation:**
- User Guide (this document)
- API Documentation
- Video Tutorials
- FAQ

**Contact Support:**
- Email: support@retailvisibility.com
- Response time: 24-48 hours
- Include session ID if applicable

**Community:**
- User forums (coming soon)
- Feature requests
- Best practices sharing

---

## 📈 What's Next?

### Coming Soon

**Camera Scanning** 📱
- Use phone/tablet camera
- Scan multiple items at once
- OCR for damaged barcodes

**Offline Mode** 🔌
- Scan without internet
- Sync when online
- Perfect for warehouses

**Advanced Analytics** 📊
- Scanning efficiency reports
- Product enrichment stats
- User performance metrics

**Mobile App** 📱
- Native iOS/Android apps
- Better camera integration
- Offline support

**AI Enhancements** 🤖
- Smart category suggestions
- Automatic brand detection
- Image recognition

---

## 🎯 Quick Reference

### Common Tasks

| Task | Steps |
|------|-------|
| Start scanning | Quick Start → SKU Scanning → Start Session |
| Scan with USB | Point scanner → Pull trigger → Wait for beep |
| Manual entry | Type barcode → Press Enter |
| Remove item | Click trash icon → Confirm |
| Edit item | Click pencil icon → Make changes → Save |
| Commit session | Review items → Click Commit → Confirm |
| Cancel session | Click Cancel → Confirm |

### Status Indicators

| Icon/Color | Meaning |
|------------|---------|
| 🟢 Green checkmark | Item fully enriched |
| 🟡 Yellow warning | Partial enrichment |
| 🔴 Red X | Enrichment failed |
| ⏳ Hourglass | Processing |
| 🚫 Blocked | Duplicate detected |
| ✅ Check | Validation passed |
| ❌ X | Validation failed |

### Keyboard Shortcuts

| Windows/Linux | Mac | Action |
|---------------|-----|--------|
| `Enter` | `Return` | Submit barcode |
| `Esc` | `Esc` | Clear/Cancel |
| `Ctrl + S` | `⌘ + S` | Save |
| `Ctrl + D` | `⌘ + D` | Delete |
| `Ctrl + Enter` | `⌘ + Return` | Commit |
| `Ctrl + Z` | `⌘ + Z` | Undo |

---

**Version:** 1.0.0  
**Last Updated:** November 4, 2025  
**Feature Status:** ✅ Production Ready

**Questions?** Contact support@retailvisibility.com
