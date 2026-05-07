# Security Sessions & Alerts - Implementation Guide

## Overview
Full implementation of live security sessions tracking and security alerts for the `/settings/security` page.

## What Was Built

### 1. Database Tables
- **user_sessions** - Tracks active login sessions with device and location info
- **security_alerts** - Security notifications (new device, failed login, etc.)
- **failed_login_attempts** - Failed login tracking for threat detection

### 2. Backend API Routes

#### Sessions Management (`/api/auth/sessions`)
- `GET /api/auth/sessions` - Get all active sessions
- `DELETE /api/auth/sessions/:sessionId` - Revoke specific session
- `POST /api/auth/sessions/revoke-all` - Revoke all except current
- `PUT /api/auth/sessions/:sessionId/activity` - Update last activity

#### Security Alerts (`/api/user/security-alerts`)
- `GET /api/user/security-alerts` - Get all alerts (with filters)
- `PUT /api/user/security-alerts/:alertId/read` - Mark as read
- `POST /api/user/security-alerts/mark-all-read` - Mark all as read
- `DELETE /api/user/security-alerts/:alertId` - Dismiss alert
- `GET /api/user/security-alerts/preferences` - Get alert preferences
- `PUT /api/user/security-alerts/preferences` - Update preferences
- `POST /api/user/security-alerts/test` - Create test alert (dev only)

### 3. Session Tracking Middleware
- Automatically tracks sessions on login
- Detects new devices and creates alerts
- Tracks failed login attempts
- Updates session activity timestamps

### 4. Frontend Integration
Already built and ready:
- `SecuritySettings.tsx` - Main component with tabs
- `useSecurity.ts` - Hook for fetching data
- `security.ts` service - API client calls

## Installation Steps

### Step 1: Run Database Migration
1. Open Supabase SQL Editor
2. Copy contents of `SECURITY_TABLES_MIGRATION.sql`
3. Run the migration
4. Verify tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('user_sessions', 'security_alerts', 'failed_login_attempts');
   ```

### Step 2: Install Dependencies
```bash
cd apps/api
npm install ua-parser-js
npm install --save-dev @types/ua-parser-js
```

### Step 3: Deploy Backend
```bash
git add .
git commit -m "feat: implement live security sessions and alerts"
git push
```

### Step 4: Test the Implementation

#### Create Test Alerts (Development Only)
```bash
curl -X POST http://localhost:4000/api/user/security-alerts/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "new_device", "severity": "info"}'
```

#### Test Sessions Endpoint
```bash
curl http://localhost:4000/api/auth/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test Revoke Session
```bash
curl -X DELETE http://localhost:4000/api/auth/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Features

### Active Sessions Tab
- ✅ Shows all active login sessions
- ✅ Device info (browser, OS, device type)
- ✅ IP address and location
- ✅ Last activity timestamp
- ✅ Current session indicator
- ✅ Revoke individual sessions
- ✅ Revoke all other sessions

### Security Alerts Tab
- ✅ New device login alerts
- ✅ Failed login attempt alerts
- ✅ Password change alerts
- ✅ Suspicious activity alerts
- ✅ Account change alerts
- ✅ Mark as read/unread
- ✅ Dismiss alerts
- ✅ Unread count badge

### Automatic Features
- ✅ Session tracking on login
- ✅ New device detection
- ✅ Failed login tracking (5+ attempts = alert)
- ✅ Session activity updates
- ✅ Auto-cleanup of expired sessions

## Database Schema

### user_sessions
```sql
- id (TEXT, PK)
- user_id (TEXT, FK to User)
- token_hash (TEXT, unique)
- device_info (JSONB)
- ip_address (TEXT)
- location (JSONB)
- user_agent (TEXT)
- is_current (BOOLEAN)
- last_activity (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
- expires_at (TIMESTAMPTZ)
- revoked_at (TIMESTAMPTZ)
```

### security_alerts
```sql
- id (TEXT, PK)
- user_id (TEXT, FK to User)
- type (TEXT) - 'failed_login', 'new_device', etc.
- severity (TEXT) - 'info', 'warning', 'critical'
- title (TEXT)
- message (TEXT)
- metadata (JSONB)
- read (BOOLEAN)
- dismissed (BOOLEAN)
- created_at (TIMESTAMPTZ)
- read_at (TIMESTAMPTZ)
- dismissed_at (TIMESTAMPTZ)
```

### failed_login_attempts
```sql
- id (TEXT, PK)
- email (TEXT)
- ip_address (TEXT)
- user_agent (TEXT)
- reason (TEXT)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
```

## Alert Types

1. **new_device** - User logged in from a new device
2. **failed_login** - Failed login attempt detected
3. **password_change** - Password was changed
4. **suspicious_activity** - Multiple failed attempts (5+)
5. **account_change** - Account settings modified

## Security Features

### Automatic Threat Detection
- Tracks failed login attempts
- Creates alert after 5+ failures from same IP
- Blocks suspicious IPs (via existing threat detection)

### Session Security
- SHA256 token hashing
- 30-day session expiration
- Automatic cleanup of old sessions
- Current session protection (can't revoke current)

### Privacy
- IP addresses stored for security only
- Location data is approximate
- User can revoke sessions anytime
- Alerts can be dismissed

## Future Enhancements

### Planned Features
- [ ] GeoIP integration for accurate location
- [ ] Email notifications for security alerts
- [ ] Two-factor authentication integration
- [ ] Device fingerprinting
- [ ] Session timeout warnings
- [ ] Export security logs

### Optional Improvements
- [ ] Rate limiting per user
- [ ] Anomaly detection (unusual login times/locations)
- [ ] Trusted devices list
- [ ] Security score/health indicator

## Troubleshooting

### No sessions showing
1. Check if tables were created: `SELECT * FROM user_sessions LIMIT 1;`
2. Verify user is logged in with valid token
3. Check API logs for errors
4. Try logging in again to create a new session

### Alerts not appearing
1. Verify tables exist: `SELECT * FROM security_alerts LIMIT 1;`
2. Create test alert: `POST /api/user/security-alerts/test`
3. Check user_id matches authenticated user
4. Look for errors in API logs

### Sessions not tracking
1. Verify `trackSession` is being called on login
2. Check for errors in session-tracker.ts logs
3. Ensure token is being passed correctly
4. Verify database connection

## Files Created

### Backend
- `apps/api/src/routes/auth-sessions.ts` - Sessions API routes
- `apps/api/src/routes/security-alerts.ts` - Alerts API routes
- `apps/api/src/middleware/session-tracker.ts` - Session tracking logic
- `apps/api/src/index.ts` - Routes mounted

### Database
- `SECURITY_TABLES_MIGRATION.sql` - Database schema

### Documentation
- `SECURITY_IMPLEMENTATION_GUIDE.md` - This file

## Testing Checklist

- [ ] Run database migration
- [ ] Install ua-parser-js dependency
- [ ] Start dev server
- [ ] Login to create a session
- [ ] Visit `/settings/security`
- [ ] Verify sessions tab shows current session
- [ ] Create test alert (dev only)
- [ ] Verify alerts tab shows test alert
- [ ] Mark alert as read
- [ ] Dismiss alert
- [ ] Revoke a session
- [ ] Test "Revoke All" button

## Production Deployment

1. **Database Migration**
   - Run migration in production Supabase
   - Verify tables created successfully

2. **Environment Variables**
   - No new env vars needed
   - Existing auth system handles everything

3. **Deploy API**
   - Push to production branch
   - Verify routes are mounted
   - Check logs for errors

4. **Monitor**
   - Watch for session creation on logins
   - Check alert generation
   - Monitor database growth

## Success Criteria

✅ Users can see all active sessions
✅ Users can revoke individual sessions
✅ Users can revoke all other sessions
✅ Security alerts display in real-time
✅ New device logins create alerts
✅ Failed login attempts tracked
✅ Alerts can be marked as read
✅ Alerts can be dismissed
✅ No mock data - all live from database

**Status: READY FOR TESTING** 🚀
