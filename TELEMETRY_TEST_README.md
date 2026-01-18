# Security Telemetry Test Suite

Complete test suite for the security telemetry batching system, including both frontend client simulation and backend API testing.

## 🚀 Quick Start

### Prerequisites
1. API server running on `localhost:4000`
2. Database accessible
3. Node.js installed

### Backend Test
```bash
cd apps/api
npx tsx src/test-telemetry-batch.ts
```

### Frontend Test
1. Start web app: `cd apps/web && npm run dev`
2. Open browser console
3. Run: `window.testTelemetry.runTest()`
4. Cleanup: `window.testTelemetry.cleanup()`

### Cleanup Test Data
```bash
cd apps/api
npx tsx -e "require('./src/test-telemetry-batch.ts').cleanupTestData()"
```

## 📦 Test Components

### 1. Backend Test (`test-telemetry-batch.ts`)
Tests the complete server-side telemetry system:

**Features:**
- ✅ Generates realistic security events
- ✅ Tests all event types (rate limit, auth failure, suspicious activity, security incident)
- ✅ Simulates batch sending to API
- ✅ Verifies database storage
- ✅ Tests metrics endpoint
- ✅ Priority-based event processing
- ✅ System vs user event handling

**Test Batches:**
- **Rate Limit Exceeded:** 25 events (mixed priorities)
- **Authentication Failures:** 10 events (all critical)
- **Suspicious Activity:** 15 events (mixed priorities)
- **Security Incidents:** 5 events (all critical)

**Verification:**
- Database alert creation
- Rate limit warning storage
- API response validation
- Metrics endpoint testing

### 2. Frontend Test (`test-telemetry-client.ts`)
Simulates the client-side batching behavior:

**Features:**
- ✅ Event caching with priority sorting
- ✅ Local storage persistence
- ✅ Automatic batch sending (5-second intervals for testing)
- ✅ Critical event immediate sending
- ✅ Memory management (max 50 events)
- ✅ Storage cleanup and recovery

**Mock Cache Class:**
- Simplified version of production `SecurityAlertTrackingCache`
- 5-second batch interval (vs 15 seconds in production)
- Full priority system implementation
- Local storage integration
- Browser console integration

**Test Scenarios:**
- Rapid event addition (25 events)
- Priority-based sorting
- Automatic batch sending
- Critical event immediate sending
- Storage persistence testing

### 3. Test Runner (`test-telemetry.sh`)
Automated test suite runner (Unix/Linux/macOS):

**Features:**
- ✅ API availability check
- ✅ Backend test execution
- ✅ Frontend test validation
- ✅ API endpoint testing
- ✅ Test data cleanup
- ✅ Colored output and status reporting

**Usage:**
```bash
./test-telemetry.sh
```

## 🔍 What Gets Tested

### Backend System
1. **Event Processing:**
   - Batch reception and parsing
   - Event type routing
   - Priority handling
   - Duplicate detection

2. **Database Storage:**
   - Security alert creation
   - Metadata preservation
   - Rate limit warning storage
   - System vs user event handling

3. **API Endpoints:**
   - `/api/security/telemetry/batch`
   - `/api/security/telemetry/metrics`
   - Type-specific endpoints
   - Error handling

4. **Rate Analysis:**
   - Request pattern detection
   - Historical comparison
   - Trend analysis
   - Limit information

### Frontend System
1. **Event Caching:**
   - Event addition and priority assignment
   - Memory management
   - Storage persistence
   - Cache recovery

2. **Batch Processing:**
   - Automatic batch sending
   - Priority-based sorting
   - Critical event immediate sending
   - Retry logic

3. **Storage Management:**
   - Local storage save/load
   - Cache size limits
   - Event eviction
   - Cross-session persistence

## 📊 Test Data

### Generated Events
Each test generates realistic security events with:

**Common Metadata:**
- Endpoint, method, IP address
- User agent, location data
- Device fingerprinting
- Network information
- Rate analysis metrics

**Type-Specific Data:**
- **Rate Limit:** Current rate, limit info, trigger reason
- **Auth Failure:** Attempted email, failure reason
- **Suspicious Activity:** Activity type, pattern info
- **Security Incident:** Incident details, confidence

**Priority Distribution:**
- Critical: ~20% (incidents, auth failures)
- High: ~30% (rate limits, suspicious activity)
- Normal: ~50% (general telemetry)

## 🎯 Test Scenarios

### Scenario 1: Normal Traffic
- Mixed event types
- Normal priority distribution
- Expected batch processing

### Scenario 2: Attack Simulation
- High volume rate limit events
- Critical security incidents
- Immediate processing verification

### Scenario 3: System Load
- Maximum cache size (50 events)
- Priority eviction testing
- Memory management validation

### Scenario 4: Offline Recovery
- Storage persistence testing
- Cache recovery after restart
- Event continuity verification

## 🐛 Troubleshooting

### Common Issues

**API Not Running:**
```bash
# Start API server
cd apps/api && npm run dev
```

**TypeScript Errors:**
```bash
# Check compilation
cd apps/api && npx tsc --noEmit src/test-telemetry-batch.ts
```

**Database Connection:**
- Verify database is running
- Check connection string in `.env`
- Ensure migrations are applied

**Frontend Test Not Working:**
- Ensure web app is running
- Check browser console for errors
- Verify API base URL in environment

### Debug Mode

Enable verbose logging:
```typescript
// In test files
console.log('Debug info:', { events, metadata, cache });
```

API request debugging:
```typescript
// Add to test-telemetry-batch.ts
console.log('API Request:', batchData);
console.log('API Response:', result);
```

## 📈 Expected Results

### Successful Test Output
```
🚀 Starting Security Telemetry Batch Test
=====================================

📦 Generating test batches...
Generated 4 test batches:
   - Rate Limit Exceeded: 25 events
   - Authentication Failures: 10 events
   - Suspicious Activity: 15 events
   - Security Incidents: 5 events

📡 Sending batches to API...
📤 Sending batch: Rate Limit Exceeded
✅ Batch sent successfully: {
  totalProcessed: 25,
  totalAlertsCreated: 25
}

🔍 Verifying database storage...
📊 Found 25 recent telemetry alerts:
   1. rate_limit_exceeded - warning - Rate Limit Exceeded - Telemetry

🎉 Test Summary
=============
✅ Batches sent: 4
✅ Total events: 55
✅ Alerts created: 55
✅ Database alerts: 55
```

### Frontend Test Output
```
🚀 Starting Frontend Telemetry Client Test
==========================================

✅ Telemetry cache initialized

📦 Adding events rapidly...
✅ Added 25 events in 1250ms

📊 Cache metrics:
   Total events: 25
   Priority breakdown: { critical: 5, high: 8, normal: 12 }

⏳ Waiting for batch to send (5 seconds)...

📊 Cache metrics after batch:
   Total events: 0
   Events sent: 25

🎉 Frontend telemetry test completed successfully!
```

## 🔄 Continuous Testing

### Automated Testing
Add to CI/CD pipeline:
```yaml
- name: Test Telemetry System
  run: |
    cd apps/api
    npm run test:telemetry
```

### Manual Testing
Run before deployments:
```bash
# Quick test
./test-telemetry.sh

# Full test with cleanup
./test-telemetry.sh && echo "y" | ./test-telemetry.sh cleanup
```

## 📚 Reference

### Production vs Test Differences
- **Batch Interval:** 15s (prod) vs 5s (test)
- **Cache Size:** 50 events (both)
- **Event Types:** Same (both)
- **Priority System:** Same (both)
- **Storage:** Same (both)

### Related Files
- `apps/web/src/utils/securityAlertTracking.ts` - Production frontend cache
- `apps/api/src/routes/security-telemetry.ts` - Production API endpoints
- `apps/api/src/middleware/rate-limit.ts` - Rate limiting integration

## 🎉 Success Criteria

Test passes when:
- ✅ All batches sent successfully
- ✅ All events stored in database
- ✅ Priority system works correctly
- ✅ Rate analysis preserved
- ✅ System vs user events handled
- ✅ Frontend caching works
- ✅ Storage persistence works
- ✅ Cleanup removes test data

The telemetry system is working correctly when all tests pass and the expected number of alerts are created in the database with proper metadata.
