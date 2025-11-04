# Business Hours Feature Documentation

## Overview
The Business Hours feature allows tenants to manage their operating hours, display them on their public storefront, and optionally sync them with Google Business Profile.

## Feature Flag
**Flag Name:** `FF_TENANT_GBP_HOURS_SYNC`

**Scope:** Platform + Tenant
- Platform flag must be enabled globally
- Individual tenants can enable/disable for their store
- Controlled via Admin → Platform Flags and Admin → Tenant Flags

## Database Schema

### BusinessHours Table
```sql
CREATE TABLE "business_hours" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL UNIQUE,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "periods" JSONB NOT NULL DEFAULT '[]',
  "last_synced_at" TIMESTAMP,
  "sync_attempts" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
```

**Periods Format:**
```json
[
  { "day": "MONDAY", "open": "09:00", "close": "17:00" },
  { "day": "TUESDAY", "open": "09:00", "close": "17:00" }
]
```

### BusinessHoursSpecial Table
```sql
CREATE TABLE "business_hours_special" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "is_closed" BOOLEAN DEFAULT false,
  "open" TEXT,
  "close" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  UNIQUE("tenant_id", "date")
);
```

## API Endpoints

### Regular Hours

#### Get Business Hours
```http
GET /api/tenant/:tenantId/business-hours
```
**Response:**
```json
{
  "success": true,
  "data": {
    "timezone": "America/New_York",
    "periods": [
      { "day": "MONDAY", "open": "09:00", "close": "17:00" }
    ]
  }
}
```

#### Update Business Hours
```http
PUT /api/tenant/:tenantId/business-hours
Content-Type: application/json

{
  "timezone": "America/New_York",
  "periods": [
    { "day": "MONDAY", "open": "09:00", "close": "17:00" },
    { "day": "TUESDAY", "open": "09:00", "close": "17:00" }
  ]
}
```

### Special Hours

#### Get Special Hours
```http
GET /api/tenant/:tenantId/business-hours/special
```

#### Update Special Hours
```http
PUT /api/tenant/:tenantId/business-hours/special
Content-Type: application/json

{
  "overrides": [
    {
      "date": "2025-12-25",
      "isClosed": true,
      "note": "Christmas Day"
    }
  ]
}
```

### GBP Sync

#### Mirror to Google Business Profile
```http
POST /api/tenant/:tenantId/gbp/hours/mirror
```

#### Check Sync Status
```http
GET /api/tenant/:tenantId/gbp/hours/status
```

## Public Display

### Profile API Integration
The `/public/tenant/:tenantId/profile` endpoint automatically includes business hours:

```json
{
  "business_name": "Demo Store",
  "hours": {
    "timezone": "America/New_York",
    "Monday": { "open": "09:00", "close": "17:00" },
    "Tuesday": { "open": "09:00", "close": "17:00" }
  }
}
```

### Storefront Display

**Header:**
- Real-time open/closed status
- Green dot (🟢) when open
- Red dot (🔴) when closed
- Shows closing time when open: "Open now • Closes at 5:00 PM"
- Shows next opening when closed: "Closed • Opens Monday at 9:00 AM"

**Footer:**
- Full weekly schedule
- Shows all 7 days
- Displays "Closed" for days without hours
- Format: "Monday    09:00 - 17:00"

## Admin UI

### Settings Page
**URL:** `/t/{tenantId}/settings/hours`

**Features:**
- Weekly schedule editor
- Timezone selector
- Special/holiday hours calendar
- Auto-save on blur
- Sync status badge

**Components:**
- `HoursEditor` - Weekly schedule grid
- `TimezonePicker` - Timezone dropdown
- `SpecialHoursCalendar` - Holiday hours management
- `SyncStateBadge` - GBP sync status

### Feature Flag Management

**Platform Flags:**
- Enable/disable globally
- Set description
- Allow tenant override
- Delete with cascade

**Tenant Flags:**
- Enable/disable per tenant
- Inherits from platform settings
- Override platform defaults

## Status Calculation Logic

The `computeStoreStatus` function:
1. Gets current time in store's timezone
2. Checks if currently within operating hours → "Open now"
3. If before opening today → "Opens today at X"
4. If after closing today → Finds next open day
5. Searches up to 7 days ahead
6. Falls back to "Closed" if no hours found

## Time Format Support
- **24-hour:** "09:00", "17:00"
- **12-hour:** "9:00 AM", "5:00 PM"
- **Display:** Automatically formatted based on locale

## Timezone Support
- Stored in database per tenant
- Used for all time calculations
- Supports all IANA timezone identifiers
- Default: "America/New_York"

## Migration Guide

### Enabling for a Tenant
1. Enable platform flag: `FF_TENANT_GBP_HOURS_SYNC`
2. Enable tenant flag for specific tenant
3. Tenant navigates to Settings → Hours
4. Set timezone and weekly schedule
5. Hours appear on storefront automatically

### Data Migration
If migrating from old `hours` field in business profile:
```sql
-- Example migration (adjust as needed)
INSERT INTO business_hours (id, tenant_id, timezone, periods)
SELECT 
  gen_random_uuid()::text,
  tenant_id,
  'America/New_York',
  -- Convert old format to new format
  old_hours_data
FROM tenant_business_profile
WHERE hours IS NOT NULL;
```

## Best Practices

### For Developers
- Always check feature flag before showing hours UI
- Use server-side timezone calculations
- Cache profile API responses appropriately
- Handle missing hours gracefully

### For Tenants
- Set accurate timezone for your location
- Update hours for holidays in advance
- Keep regular hours up to date
- Test storefront display after changes

## Troubleshooting

### Hours Not Showing
1. Check platform flag is enabled
2. Check tenant flag is enabled
3. Verify hours are saved in database
4. Check browser console for API errors
5. Verify day names match (Monday vs MONDAY)

### Status Incorrect
1. Verify timezone is correct
2. Check time format (24-hour)
3. Ensure periods are saved correctly
4. Test with different times of day

### Sync Issues
1. Check GBP API credentials
2. Verify sync job is running
3. Check sync status endpoint
4. Review error logs

## Future Enhancements
- [ ] Bulk hours editor for multiple locations
- [ ] Import/export hours data
- [ ] Hours templates (e.g., "Standard Retail")
- [ ] Automatic holiday detection
- [ ] SMS notifications for hours changes
- [ ] Analytics on hours effectiveness
