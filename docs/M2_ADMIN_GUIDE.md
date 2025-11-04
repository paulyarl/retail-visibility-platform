# M2 Feed Enforcement - Admin Guide

**Feature:** Feed Validation & Enforcement  
**Version:** 1.0.0 (In Progress)  
**Last Updated:** November 4, 2025  
**Audience:** System Administrators

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Enforcement Modes](#enforcement-modes)
4. [Monitoring](#monitoring)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## 🎯 Overview

### What is Feed Enforcement?

Feed Enforcement ensures data quality by validating product feeds before they enter your system. It prevents invalid data from causing issues downstream.

### Why Enable Enforcement?

**Benefits:**
- ✅ **Data Quality** - Ensures all products meet standards
- ✅ **Prevents Errors** - Catches issues before they cause problems
- ✅ **Category Compliance** - Enforces category requirements
- ✅ **Price Validation** - Prevents invalid pricing
- ✅ **SKU Uniqueness** - Avoids duplicate products

**Risks of Disabling:**
- ❌ Invalid data in database
- ❌ Broken category mappings
- ❌ Google Business Profile sync failures
- ❌ Poor search visibility
- ❌ Customer experience issues

### When to Use

**Enable Enforcement When:**
- System is in production
- Data quality is critical
- Multiple users/integrations push feeds
- GBP sync is active
- Category structure is established

**Disable Enforcement When:**
- Initial data migration
- Testing/development
- Bulk imports with known issues
- Temporary workarounds needed

---

## ⚙️ Configuration

### Environment Variables

Feed enforcement is controlled by environment variables:

```env
# Enable/disable feed enforcement
FEED_ALIGNMENT_ENFORCE=true

# Validation strictness level
FEED_VALIDATION_LEVEL=strict  # strict | lenient | off
```

### Setting via Doppler

**For Local Development:**

```bash
# Set enforcement flag
doppler secrets set FEED_ALIGNMENT_ENFORCE=true --config local

# Verify setting
doppler secrets get FEED_ALIGNMENT_ENFORCE --config local
```

**For Production:**

```bash
# Set enforcement flag
doppler secrets set FEED_ALIGNMENT_ENFORCE=true --config prd

# Verify setting
doppler secrets get FEED_ALIGNMENT_ENFORCE --config prd
```

### Setting via Admin UI

1. Go to **Settings** → **Admin** → **Features**
2. Find **"Feed Enforcement"**
3. Toggle **ON** or **OFF**
4. Click **"Save Changes"**
5. Restart API server (if required)

### Checking Current Status

**Via API:**

```bash
curl http://localhost:4000/api/config/feed-enforcement \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "enforced": true,
  "mode": "strict",
  "rules": {
    "categoryRequired": true,
    "priceValidation": true,
    "skuUniqueness": true
  },
  "lastUpdated": "2025-11-04T02:00:00Z"
}
```

**Via Admin Dashboard:**

1. Go to **Admin** → **System Status**
2. Check **"Feed Enforcement"** indicator
3. Status shows: ✅ Enabled or ❌ Disabled

---

## 🔒 Enforcement Modes

### Strict Mode (Recommended for Production)

**Configuration:**

```env
FEED_ALIGNMENT_ENFORCE=true
FEED_VALIDATION_LEVEL=strict
```

**Behavior:**
- ❌ Rejects feeds with ANY validation errors
- ✅ Requires all products to have categories
- ✅ Enforces price validation (must be > 0)
- ✅ Blocks duplicate SKUs
- ⚠️ Allows warnings (logs but doesn't block)

**Use When:**
- System is in production
- Data quality is critical
- Multiple integrations are active
- GBP sync is enabled

**Example Response:**

```json
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "Feed rejected: 2 products have validation errors",
  "errors": [
    {
      "sku": "PROD-001",
      "field": "category",
      "message": "Category is required"
    },
    {
      "sku": "PROD-002",
      "field": "price",
      "message": "Price must be greater than 0"
    }
  ]
}
```

---

### Lenient Mode (Development/Testing)

**Configuration:**

```env
FEED_ALIGNMENT_ENFORCE=false
FEED_VALIDATION_LEVEL=lenient
```

**Behavior:**
- ✅ Accepts feeds with validation errors
- ⚠️ Logs errors but doesn't block
- ✅ Allows missing categories
- ✅ Skips invalid items (doesn't import them)
- 📊 Reports issues in response

**Use When:**
- Development/testing environment
- Initial data migration
- Importing legacy data
- Troubleshooting issues

**Example Response:**

```json
{
  "success": true,
  "feedId": "feed_123",
  "summary": {
    "totalProducts": 10,
    "imported": 8,
    "skipped": 2
  },
  "warnings": [
    {
      "sku": "PROD-001",
      "message": "Missing category - product skipped"
    },
    {
      "sku": "PROD-002",
      "message": "Invalid price - product skipped"
    }
  ]
}
```

---

### Off Mode (Not Recommended)

**Configuration:**

```env
FEED_ALIGNMENT_ENFORCE=false
FEED_VALIDATION_LEVEL=off
```

**Behavior:**
- ✅ Accepts ALL feeds
- ⚠️ No validation performed
- ⚠️ Invalid data may enter system
- ⚠️ Can cause downstream issues

**Use When:**
- Emergency data recovery
- Temporary workaround
- Specific admin override needed

**⚠️ Warning:** Only use temporarily. Re-enable enforcement ASAP.

---

## 📊 Monitoring

### Admin Dashboard

**Location:** `/admin/feed-enforcement`

**Key Metrics:**
- **Enforcement Status** - Enabled/Disabled
- **Validation Mode** - Strict/Lenient/Off
- **Rejected Feeds (24h)** - Count of rejected feeds
- **Validation Errors (24h)** - Total validation errors
- **Success Rate** - % of feeds passing validation
- **Top Error Types** - Most common validation errors

**Dashboard View:**

```
┌─────────────────────────────────────────┐
│  Feed Enforcement Dashboard             │
├─────────────────────────────────────────┤
│  Status: ✅ Enabled (Strict Mode)       │
│  Last 24 Hours:                         │
│    • Feeds Processed: 150               │
│    • Feeds Rejected: 12 (8%)            │
│    • Validation Errors: 45              │
│    • Success Rate: 92%                  │
│                                         │
│  Top Errors:                            │
│    1. Missing Category (18)             │
│    2. Invalid Price (12)                │
│    3. Duplicate SKU (8)                 │
│    4. Invalid Parent (7)                │
└─────────────────────────────────────────┘
```

### Validation Logs

**Location:** `/admin/logs/validation`

**Log Entry Format:**

```json
{
  "timestamp": "2025-11-04T02:00:00Z",
  "feedId": "feed_123",
  "tenantId": "tenant_456",
  "source": "api",
  "status": "rejected",
  "validationErrors": 3,
  "errors": [
    {
      "sku": "PROD-001",
      "field": "category",
      "code": "CATEGORY_REQUIRED",
      "message": "Category is required when enforcement is enabled"
    }
  ],
  "userId": "user_789",
  "ipAddress": "192.168.1.100"
}
```

**Viewing Logs:**

1. Go to **Admin** → **Logs** → **Validation**
2. Filter by:
   - Date range
   - Tenant
   - Status (accepted/rejected)
   - Error type
3. Export logs as CSV/JSON

### Metrics & Alerts

**Prometheus Metrics:**

```
# Feed validation metrics
feed_validation_total{status="accepted|rejected"}
feed_validation_errors_total{error_type="category|price|sku"}
feed_validation_duration_seconds
feed_enforcement_enabled{mode="strict|lenient|off"}
```

**Grafana Dashboard:**

- Feed validation success rate over time
- Top validation error types
- Feeds rejected per tenant
- Validation duration percentiles

**Alerts:**

```yaml
# High rejection rate alert
- alert: HighFeedRejectionRate
  expr: rate(feed_validation_total{status="rejected"}[5m]) > 0.2
  for: 10m
  annotations:
    summary: "High feed rejection rate detected"
    description: "More than 20% of feeds are being rejected"

# Enforcement disabled alert
- alert: FeedEnforcementDisabled
  expr: feed_enforcement_enabled{mode="off"} == 1
  for: 1h
  annotations:
    summary: "Feed enforcement is disabled"
    description: "Feed enforcement has been disabled for over 1 hour"
```

---

## 🔍 Troubleshooting

### Common Issues

#### Issue 1: All Feeds Being Rejected

**Symptoms:**
- 100% rejection rate
- All feeds fail validation
- Users cannot import products

**Possible Causes:**
1. Enforcement enabled but categories not set up
2. Validation rules too strict
3. Legacy data doesn't meet new standards

**Solutions:**

**Option A: Temporarily Disable Enforcement**

```bash
# Disable enforcement
doppler secrets set FEED_ALIGNMENT_ENFORCE=false --config prd

# Restart API server
pm2 restart api
```

**Option B: Switch to Lenient Mode**

```bash
# Set lenient mode
doppler secrets set FEED_VALIDATION_LEVEL=lenient --config prd

# Restart API server
pm2 restart api
```

**Option C: Fix Data Issues**

1. Export rejected feeds
2. Fix validation errors
3. Re-import corrected data

---

#### Issue 2: Categories Not Validating

**Symptoms:**
- "Category not found" errors
- Valid categories being rejected
- Category validation inconsistent

**Possible Causes:**
1. Category names don't match exactly
2. Case sensitivity issues
3. Categories not synced to tenant

**Solutions:**

**Check Category Exists:**

```bash
curl http://localhost:4000/api/categories?tenantId=tenant_123 \
  -H "Authorization: Bearer TOKEN"
```

**Fix Category Mapping:**

1. Go to **Admin** → **Categories**
2. Find the category
3. Check tenant assignment
4. Verify category name matches exactly

**Sync Categories:**

```bash
# Trigger category sync
curl -X POST http://localhost:4000/api/categories/sync \
  -H "Authorization: Bearer TOKEN" \
  -d '{"tenantId": "tenant_123"}'
```

---

#### Issue 3: Duplicate SKU Errors

**Symptoms:**
- "Duplicate SKU" errors
- Products already exist
- Cannot update existing products

**Possible Causes:**
1. SKU already in database
2. Feed contains duplicate SKUs
3. Case sensitivity in SKU matching

**Solutions:**

**Check for Existing SKU:**

```bash
curl "http://localhost:4000/api/products?sku=PROD-001&tenantId=tenant_123" \
  -H "Authorization: Bearer TOKEN"
```

**Update Instead of Create:**

```json
{
  "operation": "upsert",  // Use upsert instead of create
  "products": [
    {
      "sku": "PROD-001",
      "name": "Updated Product"
    }
  ]
}
```

**Remove Duplicates from Feed:**

```javascript
// Deduplicate SKUs before pushing
const uniqueProducts = products.reduce((acc, product) => {
  if (!acc.find(p => p.sku === product.sku)) {
    acc.push(product);
  }
  return acc;
}, []);
```

---

#### Issue 4: Price Validation Failing

**Symptoms:**
- "Invalid price" errors
- Prices appear valid
- Inconsistent validation

**Possible Causes:**
1. Price is 0 or negative
2. Price format incorrect (string vs number)
3. Currency conversion issues

**Solutions:**

**Ensure Positive Price:**

```json
{
  "price": 29.99,  // ✅ Valid
  "price": 0,      // ❌ Invalid
  "price": -10,    // ❌ Invalid
}
```

**Use Correct Format:**

```json
{
  "price": 29.99,    // ✅ Valid (number)
  "price": "29.99",  // ❌ Invalid (string)
}
```

**Handle Free Products:**

```json
{
  "price": 0.01,  // Use minimum price for free items
  "isFree": true  // Add flag if needed
}
```

---

### Emergency Procedures

#### Disable Enforcement Immediately

**If enforcement is causing critical issues:**

```bash
# 1. Disable via Doppler
doppler secrets set FEED_ALIGNMENT_ENFORCE=false --config prd

# 2. Restart API
pm2 restart api

# 3. Verify disabled
curl http://localhost:4000/api/config/feed-enforcement

# 4. Notify team
# Post in #alerts channel

# 5. Create incident ticket
# Document reason for disabling
```

#### Re-enable After Fix

```bash
# 1. Fix underlying issues
# 2. Test in staging first
doppler secrets set FEED_ALIGNMENT_ENFORCE=true --config dev

# 3. Verify in staging
# Run test feeds

# 4. Enable in production
doppler secrets set FEED_ALIGNMENT_ENFORCE=true --config prd

# 5. Monitor closely
# Watch rejection rates for 1 hour
```

---

## 💡 Best Practices

### 1. Enable Enforcement in Production

```bash
# Production should always have enforcement enabled
FEED_ALIGNMENT_ENFORCE=true  # ✅ Production
FEED_ALIGNMENT_ENFORCE=false # ❌ Production (only temporarily)
```

### 2. Use Lenient Mode for Development

```bash
# Development can use lenient mode
FEED_VALIDATION_LEVEL=lenient  # ✅ Development
FEED_VALIDATION_LEVEL=strict   # ✅ Staging/Production
```

### 3. Monitor Rejection Rates

```bash
# Set up alerts for high rejection rates
- Alert if rejection rate > 10% for 10 minutes
- Alert if enforcement disabled for > 1 hour
- Alert if validation errors spike
```

### 4. Communicate Changes

**Before Enabling Enforcement:**
1. Notify all users/integrations
2. Provide migration guide
3. Offer support during transition
4. Set grace period if needed

**Email Template:**

```
Subject: Feed Validation Enforcement Enabled [Action Required]

Hi Team,

Starting [DATE], feed validation enforcement will be enabled.

What this means:
- All product feeds must have valid categories
- Prices must be greater than 0
- SKUs must be unique
- Invalid feeds will be rejected

Action Required:
1. Review your feed data
2. Fix any validation errors
3. Test feeds in staging environment
4. Contact support if you need help

Resources:
- Validation Guide: [LINK]
- API Documentation: [LINK]
- Support: support@retailvisibility.com

Questions? Reply to this email.
```

### 5. Regular Audits

**Monthly Checklist:**
- [ ] Review rejection rates
- [ ] Check top error types
- [ ] Verify enforcement status
- [ ] Update validation rules if needed
- [ ] Review and clean up logs
- [ ] Test enforcement in staging

### 6. Gradual Rollout

**Phased Approach:**

**Phase 1: Warnings Only (Week 1-2)**
```env
FEED_VALIDATION_LEVEL=lenient
# Log errors but don't block
```

**Phase 2: Pilot Tenants (Week 3-4)**
```env
FEED_VALIDATION_LEVEL=strict
# Enable for 10% of tenants
```

**Phase 3: Full Rollout (Week 5+)**
```env
FEED_VALIDATION_LEVEL=strict
# Enable for all tenants
```

### 7. Documentation

**Maintain Documentation:**
- Keep validation rules updated
- Document error codes
- Provide examples
- Update troubleshooting guide
- Share success stories

---

## 📋 Configuration Checklist

### Pre-Deployment

- [ ] Review validation rules
- [ ] Test in staging environment
- [ ] Notify users of changes
- [ ] Prepare rollback plan
- [ ] Set up monitoring/alerts
- [ ] Document configuration
- [ ] Train support team

### Deployment

- [ ] Enable enforcement in production
- [ ] Verify configuration
- [ ] Monitor rejection rates
- [ ] Check error logs
- [ ] Respond to user issues
- [ ] Document any issues

### Post-Deployment

- [ ] Review first 24 hours
- [ ] Analyze rejection patterns
- [ ] Adjust rules if needed
- [ ] Gather user feedback
- [ ] Update documentation
- [ ] Plan improvements

---

## 📞 Support

**Admin Support:**
- Email: admin-support@retailvisibility.com
- Slack: #admin-support
- Emergency: Call escalation line

**Escalation Path:**
1. Check this guide
2. Review logs and metrics
3. Contact support team
4. Escalate to engineering if needed

---

**Version:** 1.0.0 (In Progress)  
**Last Updated:** November 4, 2025  
**Status:** 🟡 Partially Complete

**Questions?** Contact admin-support@retailvisibility.com
