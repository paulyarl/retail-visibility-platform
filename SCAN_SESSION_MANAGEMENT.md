# Scan Session Management

## Problem
Users were hitting the 50 active session limit because sessions weren't being closed automatically.

## Solutions Implemented

### 1. ✅ Auto-Cleanup on Navigation
**Location:** `apps/web/src/app/t/[tenantId]/scan/[sessionId]/page.tsx`

- Automatically cancels empty sessions (0 scanned items) when user navigates away
- Uses React cleanup effect (`useEffect` return function)
- Silently fails if API call doesn't complete (user already navigating)

### 2. ✅ Idle Session Timeout
**Location:** `apps/api/src/routes/scan.ts`

- Endpoint: `POST /api/scan/cleanup-idle-sessions`
- Automatically closes sessions active for more than 1 hour
- Can be called by cron job or scheduled task
- No authentication required (internal cleanup)

**To set up automated cleanup:**
```bash
# Add to Railway cron or external service
curl -X POST https://your-api.railway.app/api/scan/cleanup-idle-sessions
```

### 3. ✅ Session List with Kill Buttons
**Location:** `apps/web/src/app/t/[tenantId]/scan/page.tsx`

- Shows user's 20 most recent sessions
- Each active session has a "Cancel" button
- Refresh button to reload the list
- Shows session details: status, timestamp, device type, scan counts

### 4. ✅ Bulk Cleanup Button
**Location:** `apps/web/src/app/t/[tenantId]/scan/page.tsx`

- Appears when user hits rate limit (50 sessions)
- "Close All My Sessions" button
- Only affects the current user's sessions
- Endpoint: `POST /api/scan/cleanup-my-sessions`

## Admin Tools

### Tenant-Wide Cleanup
**Location:** `apps/web/src/components/admin/CleanupScanSessionsModal.tsx`

- Admin selects a tenant
- Shows active/total session counts
- Closes ALL active sessions for that tenant (all users)
- Endpoint: `POST /api/admin/scan-sessions/cleanup`

## API Endpoints

### User Endpoints
- `GET /api/scan/my-sessions?tenantId=xxx` - Get user's sessions
- `POST /api/scan/cleanup-my-sessions` - User cleanup their own sessions
- `DELETE /api/scan/:sessionId` - Cancel individual session

### Admin Endpoints
- `GET /api/admin/scan-sessions/stats?tenantId=xxx` - Get session stats
- `POST /api/admin/scan-sessions/cleanup` - Admin cleanup for tenant

### Maintenance Endpoints
- `POST /api/scan/cleanup-idle-sessions` - Cleanup sessions older than 1 hour

## Session Lifecycle

1. **Created** - User starts new session (`POST /api/scan/start`)
2. **Active** - User scans items
3. **Closed** - One of:
   - User commits: `POST /api/scan/:sessionId/commit` → status: `completed`
   - User cancels: `DELETE /api/scan/:sessionId` → status: `cancelled`
   - Auto-cleanup on navigation (if empty)
   - Idle timeout (1 hour)
   - User bulk cleanup
   - Admin cleanup

## Rate Limits

- **Per tenant:** 50 active sessions
- **Increased from:** 10 (original limit)
- **Location:** `apps/api/src/routes/scan.ts` line 82-88

## Audit Logging

All cleanup actions are logged:
- `scan.sessions.cleanup_my` - User cleanup
- `admin.scan_sessions.cleanup` - Admin cleanup
- `scan.session.cancel` - Individual cancellation

## Future Improvements

1. **Better idle detection** - Track last activity time, not just start time
2. **Session warnings** - Warn users before auto-canceling
3. **Session recovery** - Allow resuming cancelled sessions
4. **Analytics** - Track session duration and completion rates
