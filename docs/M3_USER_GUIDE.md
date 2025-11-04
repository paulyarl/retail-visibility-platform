# M3 Category Sync - User Guide

**Feature:** Google Business Profile Category Synchronization  
**Version:** 1.0.0  
**Last Updated:** November 4, 2025  
**Audience:** Administrators & Business Owners

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Understanding Category Sync](#understanding-category-sync)
3. [Getting Started](#getting-started)
4. [Syncing Categories](#syncing-categories)
5. [Monitoring Sync Status](#monitoring-sync-status)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## 🎯 Introduction

### What is Category Sync?

Category Sync (M3) is an admin feature that keeps your product categories synchronized between:

- **Platform Categories** - Your internal product taxonomy
- **Google Business Profile (GBP) Categories** - Google's official business categories

This ensures your products are properly categorized for Google Business Profile, Google Shopping, and other Google services.

### Why Use Category Sync?

**Benefits:**
- ✅ **Consistency** - Keep categories aligned across systems
- ✅ **SEO Optimization** - Better visibility in Google searches
- ✅ **Automation** - Reduce manual category management
- ✅ **Compliance** - Meet Google's category requirements
- ✅ **Efficiency** - Bulk update categories across products

### Who Should Use This?

**Administrators:**
- Manage platform-wide category mappings
- Configure sync strategies
- Monitor sync operations
- Troubleshoot sync issues

**Business Owners:**
- Ensure products are properly categorized
- Optimize for Google Business Profile
- Maintain category consistency

---

## 📚 Understanding Category Sync

### Category Types

**Platform Categories**
- Your internal product taxonomy
- Custom categories you create
- Hierarchical structure (parent/child)
- Flexible and customizable

**Google Business Profile (GBP) Categories**
- Google's official business categories
- Standardized taxonomy
- Required for GBP listings
- Limited to Google's predefined list

### Sync Strategies

**Platform to GBP** (`platform_to_gbp`)
- Pushes your platform categories to Google
- Updates GBP categories based on your taxonomy
- Use when: Your categories are the source of truth

**GBP to Platform** (`gbp_to_platform`)
- Pulls Google categories to your platform
- Updates platform categories from GBP
- Use when: Google categories are the source of truth

**Bi-directional Sync** (Coming Soon)
- Keeps both systems in sync
- Intelligent conflict resolution
- Best of both worlds

### How Sync Works

1. **Initiate Sync** - Admin triggers sync operation
2. **Queue Job** - Sync job added to queue
3. **Process Categories** - Worker processes each category
4. **Map & Transform** - Categories mapped between systems
5. **Update Records** - Database updated with changes
6. **Verify Sync** - System checks for out-of-sync items
7. **Report Results** - Admin sees sync summary

---

## 🚀 Getting Started

### Prerequisites

Before using category sync:

1. ✅ **Admin Access** - Must have admin role
2. ✅ **Feature Enabled** - `FF_CATEGORY_MIRRORING` must be enabled
3. ✅ **GBP Connected** - Google Business Profile must be linked
4. ✅ **Categories Exist** - Have categories in platform or GBP

### Accessing Category Sync

**Method 1: Admin Dashboard**
1. Go to **Settings** → **Admin**
2. Click **"Category Management"**
3. Select **"Category Sync"** tab

**Method 2: Direct URL**
```
/admin/categories/sync
```

### Checking Feature Status

**Verify Feature is Enabled:**
1. Go to **Settings** → **Admin** → **Features**
2. Look for **"Category Mirroring"**
3. Toggle should be **ON** (green)

If disabled:
- Contact system administrator
- Feature may be in testing phase
- May require additional setup

---

## 🔄 Syncing Categories

### Starting a Sync

#### Step 1: Choose Sync Strategy

**Platform to GBP** (Recommended for most users)
- Use when: Your platform categories are well-organized
- Effect: Updates Google categories to match yours
- Risk: Low (doesn't change your platform)

**GBP to Platform**
- Use when: Google categories are more accurate
- Effect: Updates platform categories from Google
- Risk: Medium (changes your platform taxonomy)

#### Step 2: Select Dry Run (Optional)

**Dry Run Mode:**
- ✅ Safe testing - No actual changes made
- ✅ Preview results - See what would change
- ✅ Validation - Check for errors before committing
- ✅ Recommended - Always test first

**Live Mode:**
- ⚠️ Makes real changes
- ⚠️ Cannot be undone easily
- ⚠️ Use after dry run succeeds

#### Step 3: Review Scope

**What Will Be Synced:**
- Number of categories affected
- Estimated sync duration
- Potential conflicts
- Out-of-sync items

**Review Carefully:**
- Check category count
- Verify strategy is correct
- Ensure no critical categories will be lost
- Confirm you have backup (if needed)

#### Step 4: Execute Sync

1. Click **"Start Sync"**
2. Confirm operation
3. Sync job queued
4. Monitor progress in real-time

### Monitoring Active Sync

**During Sync:**
- 📊 Progress bar shows completion %
- 🔢 Counter shows processed/total categories
- ⏱️ Estimated time remaining
- 📝 Live log of operations

**Status Indicators:**
- 🟢 **Processing** - Sync in progress
- 🟡 **Retrying** - Temporary error, retrying
- 🔴 **Failed** - Error occurred
- ✅ **Complete** - Sync finished successfully

### Understanding Sync Results

**Success Summary:**
- ✅ Categories synced
- ✅ Categories created
- ✅ Categories updated
- ✅ Categories skipped (already in sync)

**Error Summary:**
- ❌ Failed categories
- ⚠️ Validation errors
- 🔄 Retry attempts
- 📝 Error messages

**Sync Metrics:**
- ⏱️ Total duration
- 📊 Success rate
- 🔄 Retry count
- 📈 Categories per second

---

## 📊 Monitoring Sync Status

### Sync Dashboard

**Location:** `/admin/categories/sync/dashboard`

**Key Metrics:**
- **Last Sync** - When last sync completed
- **Sync Status** - Current sync state
- **Success Rate** - % of successful syncs
- **Out-of-Sync Count** - Categories needing sync
- **Failed Runs** - Recent failures

### Out-of-Sync Detection

**What is Out-of-Sync?**
- Platform category doesn't match GBP
- Category exists in one system but not other
- Category attributes differ between systems

**Detection Methods:**
- Automatic periodic checks
- Post-sync verification
- Manual verification trigger

**Out-of-Sync Indicators:**
- 🔴 Red badge on category
- ⚠️ Warning in dashboard
- 📧 Email notification (if enabled)

### Sync History

**View Past Syncs:**
1. Go to **Category Sync** → **History**
2. See list of all sync operations
3. Filter by:
   - Date range
   - Strategy
   - Status (success/failed)
   - User who triggered

**Sync Details:**
- Sync ID
- Timestamp
- Strategy used
- Duration
- Results summary
- Error logs (if any)

### Telemetry & Analytics

**Available Metrics:**
- Sync frequency
- Average duration
- Error rates
- Category coverage
- Sync trends over time

**Charts & Graphs:**
- Sync success rate over time
- Categories synced per day
- Error distribution
- Performance metrics

---

## 🔧 Troubleshooting

### Common Issues

#### Sync Fails Immediately

**Problem:** Sync job fails right after starting

**Possible Causes:**
- Feature flag disabled
- No GBP connection
- Invalid authentication
- Database error

**Solutions:**
1. Check feature flag is enabled
2. Verify GBP is connected
3. Re-authenticate with Google
4. Check API logs for errors
5. Contact support if persists

#### Categories Not Syncing

**Problem:** Some categories don't sync

**Possible Causes:**
- Category name too long
- Invalid characters in name
- Category doesn't exist in target system
- Mapping conflict

**Solutions:**
1. Check category name length (max 100 chars)
2. Remove special characters
3. Create category in target system first
4. Review category mapping rules
5. Check sync logs for specific errors

#### Out-of-Sync Count Increasing

**Problem:** More categories becoming out-of-sync

**Possible Causes:**
- Manual changes in GBP
- Platform categories being edited
- Sync not running regularly
- Sync errors accumulating

**Solutions:**
1. Run sync more frequently
2. Investigate manual changes
3. Review sync schedule
4. Fix any sync errors
5. Consider automated sync

#### Sync Takes Too Long

**Problem:** Sync operation is very slow

**Possible Causes:**
- Large number of categories
- Network issues
- API rate limits
- Database performance

**Solutions:**
1. Sync in smaller batches
2. Check internet connection
3. Review API rate limits
4. Optimize database queries
5. Schedule sync during off-peak hours

#### Duplicate Categories Created

**Problem:** Sync creates duplicate categories

**Possible Causes:**
- Matching algorithm issue
- Case sensitivity differences
- Special characters in names
- Sync conflict

**Solutions:**
1. Merge duplicate categories manually
2. Review category matching rules
3. Standardize category naming
4. Run cleanup script
5. Contact support for assistance

---

## 💡 Best Practices

### Planning Your Sync Strategy

**Before First Sync:**
1. ✅ Audit your categories
2. ✅ Clean up duplicates
3. ✅ Standardize naming
4. ✅ Document category structure
5. ✅ Run dry run first

**Choosing Strategy:**
- Use **Platform to GBP** if:
  - Your categories are well-organized
  - You want full control
  - You have custom taxonomy
  
- Use **GBP to Platform** if:
  - Starting fresh
  - Google categories are comprehensive
  - Want Google's standardization

### Sync Frequency

**Recommended Schedule:**
- **Daily** - For active stores with frequent changes
- **Weekly** - For stable catalogs
- **Monthly** - For established stores with minimal changes
- **On-Demand** - For testing or major updates

**Automated Sync:**
- Set up scheduled sync jobs
- Monitor for failures
- Review sync reports regularly
- Adjust frequency as needed

### Category Naming

**Best Practices:**
- ✅ Use clear, descriptive names
- ✅ Follow consistent naming convention
- ✅ Avoid special characters
- ✅ Keep names under 100 characters
- ✅ Use proper capitalization

**Avoid:**
- ❌ All caps (ELECTRONICS)
- ❌ Special characters (!@#$%)
- ❌ Excessive abbreviations
- ❌ Inconsistent formatting
- ❌ Duplicate names

### Maintaining Sync Health

**Regular Checks:**
1. Monitor out-of-sync count weekly
2. Review sync success rate monthly
3. Audit category mappings quarterly
4. Update sync strategy as needed

**Proactive Maintenance:**
- Fix out-of-sync items promptly
- Investigate sync failures immediately
- Keep categories organized
- Document category changes
- Train team on category management

### Data Backup

**Before Major Sync:**
1. Export current categories
2. Save category mappings
3. Document custom attributes
4. Note any special configurations

**Backup Methods:**
- Export to CSV
- Database snapshot
- API export
- Manual documentation

### Testing Changes

**Always Test First:**
1. Use dry run mode
2. Test with small category subset
3. Verify results before full sync
4. Have rollback plan ready

**Test Scenarios:**
- New category creation
- Category updates
- Category deletion
- Mapping conflicts
- Error handling

---

## 📈 Advanced Features

### Custom Category Mappings

**What Are Mappings?**
- Rules that connect platform categories to GBP categories
- Handle naming differences
- Resolve conflicts
- Enable custom transformations

**Creating Mappings:**
1. Go to **Category Sync** → **Mappings**
2. Click **"New Mapping"**
3. Select platform category
4. Select corresponding GBP category
5. Save mapping

**Use Cases:**
- Platform uses "Electronics" → GBP uses "Consumer Electronics"
- Multiple platform categories → Single GBP category
- Custom taxonomy → Google's standard taxonomy

### Sync Templates

**What Are Templates?**
- Pre-configured sync settings
- Save time on repeated syncs
- Ensure consistency
- Share configurations

**Creating Templates:**
1. Configure sync settings
2. Click **"Save as Template"**
3. Name template
4. Add description
5. Template available for future use

**Template Settings:**
- Sync strategy
- Dry run preference
- Category filters
- Mapping rules
- Notification preferences

### Scheduled Sync

**Automated Sync Jobs:**
1. Go to **Category Sync** → **Schedule**
2. Click **"New Schedule"**
3. Set frequency (daily/weekly/monthly)
4. Choose time
5. Select strategy
6. Enable/disable notifications

**Schedule Options:**
- Frequency
- Time of day
- Days of week
- Strategy
- Dry run mode
- Auto-retry on failure

### Webhooks & Notifications

**Sync Notifications:**
- Email on sync completion
- Slack integration
- Webhook to external system
- In-app notifications

**Configure Notifications:**
1. Go to **Settings** → **Notifications**
2. Enable **"Category Sync Notifications"**
3. Choose notification types:
   - Sync started
   - Sync completed
   - Sync failed
   - Out-of-sync detected
4. Set recipients/channels

---

## 🔗 Related Features

### Category Management

**Platform Categories:**
- Create/edit/delete categories
- Organize hierarchy
- Assign to products
- Set category attributes

**Location:** `/admin/categories`

### Google Business Profile

**GBP Integration:**
- Connect GBP account
- Manage business listings
- Update business info
- View GBP categories

**Location:** `/admin/google-business`

### Product Management

**Category Assignment:**
- Assign categories to products
- Bulk category updates
- Category-based filtering
- Category analytics

**Location:** `/inventory`

---

## 📞 Getting Help

### Support Resources

**Documentation:**
- M3 Completion Report
- M3 Testing Guide
- API Documentation
- Video Tutorials (coming soon)

**Contact Support:**
- Email: support@retailvisibility.com
- Include: Sync ID, error messages, screenshots
- Response time: 24-48 hours

**Community:**
- User forums (coming soon)
- Best practices sharing
- Feature requests

### Reporting Issues

**When Reporting Sync Issues:**
1. Note sync ID
2. Copy error messages
3. Take screenshots
4. Document steps to reproduce
5. Include category names affected

**What to Include:**
- Sync strategy used
- Number of categories
- Error messages
- Sync duration
- Browser/device info

---

## 🎓 Training Resources

### Video Tutorials (Coming Soon)

- Getting Started with Category Sync
- Understanding Sync Strategies
- Troubleshooting Common Issues
- Best Practices for Category Management

### Webinars (Coming Soon)

- Monthly training sessions
- Q&A with product team
- Advanced features deep-dive

---

## 📋 Quick Reference

### Common Tasks

| Task | Steps |
|------|-------|
| Start sync | Admin → Category Sync → Choose strategy → Start |
| Dry run | Enable "Dry Run" before starting sync |
| View history | Category Sync → History |
| Check status | Category Sync → Dashboard |
| Fix out-of-sync | Review out-of-sync list → Sync or fix manually |

### Sync Strategies

| Strategy | Direction | Use When |
|----------|-----------|----------|
| Platform to GBP | Platform → Google | Your categories are source of truth |
| GBP to Platform | Google → Platform | Google categories are source of truth |

### Status Indicators

| Icon/Color | Meaning |
|------------|---------|
| 🟢 Green | Sync successful |
| 🟡 Yellow | Sync in progress |
| 🔴 Red | Sync failed |
| ⚠️ Warning | Out-of-sync detected |
| ✅ Check | In sync |
| 🔄 Arrows | Retrying |

---

## 🔄 Version History

**v1.0.0** - November 4, 2025
- Initial release
- Platform to GBP sync
- GBP to Platform sync
- Dry run mode
- Retry logic with exponential backoff
- Out-of-sync detection
- Admin dashboard
- Sync history

**Coming Soon:**
- Bi-directional sync
- Advanced conflict resolution
- Batch category operations
- Category analytics
- Mobile app support

---

**Version:** 1.0.0  
**Last Updated:** November 4, 2025  
**Feature Status:** ✅ Production Ready

**Questions?** Contact support@retailvisibility.com
