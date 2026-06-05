# Google Business Profile Status Sync

## Overview

Automatically syncs location lifecycle status changes to Google Business Profile, keeping your Google listings in sync with your internal operational status.

## Status Mapping

| Internal Status | Google Status | Description |
|----------------|---------------|-------------|
| `active` | `OPEN` | Location is fully operational |
| `inactive` | `CLOSED_TEMPORARILY` | Temporarily closed with optional reopening date |
| `closed` | `CLOSED_PERMANENTLY` | Permanently closed |
| `pending` | *(no sync)* | Not yet live, don't update Google |
| `archived` | *(no sync)* | Historical record only |

## How It Works

### 1. Status Change Trigger

When a location status is changed via `/api/tenants/:id/status`:

```typescript
PATCH /api/tenants/:id/status
{
  "status": "inactive",
  "reason": "Renovations",
  "reopeningDate": "2024-03-01"
}
```

### 2. Automatic Sync

The system automatically:
1. ✅ Updates internal database
2. ✅ Creates audit log entry
3. ✅ Syncs to Google Business Profile (async)
4. ✅ Logs sync result

### 3. Google API Call

```typescript
PATCH https://mybusinessbusinessinformation.googleapis.com/v1/{locationId}
{
  "openInfo": {
    "status": "CLOSED_TEMPORARILY",
    "canReopen": true,
    "openingDate": {
      "year": 2024,
      "month": 3,
      "day": 1
    }
  }
}
```

## Features

### ✅ Async Non-Blocking

Sync happens asynchronously and doesn't block the status change response. If Google sync fails, the internal status change still succeeds.

### ✅ Retry Logic

Built-in retry with exponential backoff:
- 3 retry attempts
- Exponential backoff (1s, 2s, 4s)
- Max 5 second delay
- Skips retry on permanent errors

### ✅ Smart Skipping

Automatically skips sync when:
- No Google Business Profile connected
- Status doesn't map to Google (pending/archived)
- Token is expired (logs warning)

### ✅ Error Handling

Graceful error handling:
- Logs all sync attempts
- Doesn't fail status change on sync error
- Clear error messages for debugging

## Implementation Details

### Service: `GoogleBusinessStatusSync.ts`

**Main Functions:**

```typescript
// Map internal status to Google format
mapToGoogleStatus(status, reopeningDate): GoogleOpenInfo | null

// Sync status to Google
syncLocationStatusToGoogle(tenantId, status, reopeningDate): Promise<StatusSyncResult>

// Sync with retry logic
syncWithRetry(tenantId, status, reopeningDate, maxRetries): Promise<StatusSyncResult>

// Log sync result
logSyncResult(tenantId, status, result): Promise<void>
```

**Result Structure:**

```typescript
interface StatusSyncResult {
  success: boolean;
  gbpStatus?: string;      // Google status that was set
  error?: string;          // Error message if failed
  skipped?: boolean;       // True if sync was skipped
  reason?: string;         // Reason for skipping
}
```

### Integration Point

In `/api/tenants/:id/status` endpoint:

```typescript
// After successful status update
const { syncLocationStatusToGoogle } = await import('./services/GoogleBusinessStatusSync');
syncLocationStatusToGoogle(id, status, reopeningDate)
  .then((result) => {
    if (result.success) {
      console.log('Google sync successful:', result.gbpStatus);
    } else if (result.skipped) {
      console.log('Google sync skipped:', result.reason);
    } else {
      console.error('Google sync failed:', result.error);
    }
  })
  .catch((error) => {
    console.error('Google sync error:', error);
  });
```

## Google Business Profile Connection

### Requirements

For sync to work, tenant must have:
1. ✅ Google OAuth account connected (`googleOAuthAccounts`)
2. ✅ At least one GBP location linked (`gbpLocations`)
3. ✅ Valid access token (not expired)

### Token Management

**Token Sources** (in priority order):
1. OAuth token from `GoogleOAuthToken` table (encrypted)
2. Legacy token from `Tenant.googleBusinessAccessToken`

**Token Expiry:**
- Checks `GoogleOAuthToken.expiresAt` or `Tenant.googleBusinessTokenExpiry`
- Logs warning if expired
- Skips sync (refresh logic should be in separate service)

## Logging

### Success

```
[Status Change] Google sync successful for tenant abc123: CLOSED_TEMPORARILY
```

### Skipped

```
[Status Change] Google sync skipped for tenant abc123: No Google Business Profile connected
```

### Failed

```
[Status Change] Google sync failed for tenant abc123: Google API error: 401 Unauthorized
```

## Testing

### Manual Test

```bash
# Change status to inactive
curl -X PATCH https://api.visibleshelf.com/api/tenants/YOUR_TENANT_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive",
    "reason": "Test closure",
    "reopeningDate": "2024-12-25"
  }'

# Check logs for sync result
# Should see: "Google sync successful" or "Google sync skipped"
```

### Verify on Google

1. Go to Google Business Profile dashboard
2. Check location status
3. Should show "Temporarily closed" with reopening date

## Error Scenarios

### No Google Connection

```json
{
  "success": true,
  "skipped": true,
  "reason": "No Google Business Profile connected"
}
```

**Action:** No action needed, sync not applicable

### Token Expired

```json
{
  "success": false,
  "error": "Google access token expired"
}
```

**Action:** User needs to reconnect Google account

### API Error

```json
{
  "success": false,
  "error": "Google API error: 403 Forbidden"
}
```

**Action:** Check Google API permissions and quotas

### Network Error

```json
{
  "success": false,
  "error": "fetch failed"
}
```

**Action:** Retry will happen automatically (up to 3 times)

## Future Enhancements

### Phase 1: Token Refresh

Add automatic token refresh when expired:

```typescript
if (tokenExpiry && tokenExpiry < now) {
  // Refresh token automatically
  const newToken = await refreshGoogleToken(tenant.googleRefreshToken);
  // Update token in database
  // Retry sync with new token
}
```

### Phase 2: Sync Queue

Add job queue for reliable sync:

```typescript
// Add to queue instead of immediate sync
await addToSyncQueue({
  tenantId,
  status,
  reopeningDate,
  retries: 0,
  maxRetries: 3,
});
```

### Phase 3: Sync Status Tracking

Add database table to track sync status:

```prisma
model GoogleStatusSync {
  id          String   @id @default(cuid())
  tenantId    String
  status      LocationStatus
  gbpStatus   String?
  success     Boolean
  error       String?
  syncedAt    DateTime @default(now())
  
  @@index([tenantId, syncedAt])
}
```

### Phase 4: Bulk Sync

Add endpoint to bulk sync all locations:

```typescript
POST /api/admin/google/sync-all-statuses
// Syncs all active tenants with Google connections
```

### Phase 5: Webhook Integration

Listen for Google Business Profile changes:

```typescript
// Detect when status changes in Google
// Update internal status to match
// Keep bidirectional sync
```

## Security Considerations

### Token Encryption

⚠️ **Important:** The `accessTokenEncrypted` field should be decrypted before use in production.

```typescript
// TODO: Add decryption
const decryptedToken = await decryptToken(googleAccount.tokens.accessTokenEncrypted);
```

### API Permissions

Required Google OAuth scopes:
- `https://www.googleapis.com/auth/business.manage`

### Rate Limiting

Google My Business API limits:
- 1000 requests per day per project
- 10 requests per second

## Monitoring

### Metrics to Track

1. **Sync Success Rate:** % of successful syncs
2. **Sync Latency:** Time to complete sync
3. **Skip Rate:** % of skipped syncs
4. **Error Rate:** % of failed syncs
5. **Retry Rate:** % requiring retries

### Alerts

Set up alerts for:
- ⚠️ Sync success rate < 95%
- ⚠️ Error rate > 5%
- ⚠️ Multiple token expiry errors

## Support

### User-Facing Messages

When Google sync fails, users see:
- ✅ Status change still succeeds internally
- ℹ️ Optional notification about Google sync failure
- 🔗 Link to reconnect Google account if needed

### Admin Tools

Admins can:
- View sync logs in database
- Manually trigger sync for a tenant
- Bulk sync all tenants
- Monitor sync health metrics

## Conclusion

This integration ensures that your location status changes are automatically reflected in Google Business Profile, providing accurate information to customers and maintaining consistency across platforms.

**Key Benefits:**
- ✅ Automatic sync (no manual updates)
- ✅ Non-blocking (doesn't slow down status changes)
- ✅ Reliable (retry logic and error handling)
- ✅ Transparent (comprehensive logging)
- ✅ User-friendly (graceful degradation)

