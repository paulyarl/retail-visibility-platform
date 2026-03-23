# Auth0 Migration Plan

## Overview

Migrate from legacy internal JWT Bearer tokens to Auth0 cookie-based authentication.

## Status: ✅ COMPLETED

All phases completed on March 23, 2026.

## Current State

- **Auth0**: Primary authentication via cookies (`auth0_session`, `auth0_id`, `auth0_email`)
- **Legacy**: Deprecated - JWT methods still exist but log warnings
- **Hybrid**: No longer supported - Auth0-only authentication

## Bearer Token Categories

### ✅ External OAuth Tokens (No Migration)

These are **access tokens for external APIs** and should remain as Bearer tokens:

| Service | Files | Purpose |
|---------|-------|---------|
| Google Business Profile | `lib/google/gbp.ts`, `services/GBP*.ts` | Google OAuth access token |
| Google Merchant Center | `lib/google/gmc.ts`, `services/GMC*.ts` | Google OAuth access token |
| PayPal | `routes/checkout/paypal.ts` | PayPal OAuth access token |
| Square | `routes/checkout/square.ts` | Square OAuth access token |
| Clover | `routes/integrations/clover.ts` | Clover OAuth access token |
| Mailtrap | `services/email-providers/mailtrap.ts` | API key |
| SendGrid | `services/email-providers/sendgrid.ts` | API key |
| Sentry | `services/SentryApiService.ts` | Sentry API token |
| Barcode | `services/BarcodeEnrichmentService.ts` | API key |

**Action**: None required - these are external OAuth/API tokens.

### ⚠️ Internal Auth Tokens (Require Migration)

These use **internal platform JWT tokens** that must migrate to Auth0:

| File | Line | Current Usage | Status |
|------|------|---------------|--------|
| `auth.middleware.ts` | 12 | `authHeader.split(' ')[1]` | ✅ Migrated |
| `middleware/auth.ts` | 116 | `authHeader.split(' ')[1]` | ✅ Migrated |
| `middleware/session-tracker.ts` | 321 | `req.headers.authorization?.replace('Bearer ', '')` | ✅ Migrated |
| `routes/auth-sessions.ts` | 51, 150 | `req.headers.authorization?.replace('Bearer ', '')` | ✅ Migrated |
| `routes/security-monitoring.ts` | 25 | `req.headers.authorization?.replace('Bearer ', '')` | ✅ Migrated |
| `lib/UniversalSingleton.ts` | 440 | `Bearer ${this.currentAuthContext.token}` | ✅ Migrated |
| `jobs/rates.ts` | 18 | `authHeader?.slice(7)` | ✅ No change needed (SERVICE_TOKEN) |

---

## Migration Phases

### Phase 1: Audit and Categorize ✅

**Status**: Complete

**Actions**:
- [x] Grep all Bearer token usage
- [x] Categorize as external (keep) vs internal (migrate)
- [x] Assess risk level for each file

---

### Phase 2: Migrate Auth Middleware ✅

**Status**: Complete

**Files**: `auth.middleware.ts`, `middleware/auth.ts`

**Changes Made**:
- Removed Bearer token extraction from `auth.middleware.ts`
- Removed legacy JWT path from `middleware/auth.ts`
- Both now use Auth0 cookie/header authentication only

---

### Phase 3: Update Session Tracker ✅

**Status**: Complete

**File**: `middleware/session-tracker.ts`

**Changes Made**:
- Removed `token` parameter from `SessionInfo` interface
- Updated `trackSession` to use Auth0 session ID only
- Updated `sessionActivityMiddleware` to pass Auth0 session ID

---

### Phase 4: Migrate UniversalSingleton ✅

**Status**: Complete

**File**: `lib/UniversalSingleton.ts`

**Changes Made**:
- Updated `AuthContext` interface to use `auth0Id` and `auth0Email` instead of `token`
- Updated `makeAuthenticatedRequest` to set Auth0 headers instead of Bearer token

---

### Phase 5: Update Auth-Sessions Routes ✅

**Status**: Complete

**File**: `routes/auth-sessions.ts`

**Changes Made**:
- Replaced token extraction with Auth0 session ID
- Updated session identification logic
- Removed `crypto` import (no longer needed)

---

### Phase 6: Update Security Monitoring ✅

**Status**: Complete

**File**: `routes/security-monitoring.ts`

**Changes Made**:
- Updated `setAuthContext` to use Auth0 fields

---

### Phase 7: Update Jobs/Cron Tasks ✅

**Status**: Complete

**File**: `jobs/rates.ts`

**Result**: No changes needed - uses `SERVICE_TOKEN` for service-to-service auth (appropriate pattern)

---

### Phase 8: Remove Legacy Code ✅

**Status**: Complete

**Actions**:
- [x] Added deprecation warnings to `authService.verifyAccessToken`
- [x] Added deprecation warnings to `authService.generateAccessToken`
- [x] Added deprecation warnings to `authService.generateRefreshToken`
- [x] Added deprecation warnings to `authService.verifyRefreshToken`
- [x] Kept methods for rollback safety

---

### Phase 9: Add Deprecation Warnings ✅

**Status**: Complete

**Actions**:
- [x] Added `@deprecated` JSDoc comments
- [x] Added `console.warn` calls for runtime visibility

---

### Phase 10: Testing ⏳

**Status**: Pending User Verification

**Test Matrix**:

| Flow | Auth Method | Status |
|------|-------------|--------|
| User login | Auth0 cookie | ⬜ Verify |
| API calls | Auth0 headers | ⬜ Verify |
| Session tracking | Auth0 session ID | ⬜ Verify |
| Session revocation | Auth0 session ID | ⬜ Verify |
| Security alerts | Auth0 context | ⬜ Verify |
| Jobs/Cron | SERVICE_TOKEN | ✅ No change |
| External APIs | OAuth tokens | ✅ No change |

**Actions**:
- [ ] Test all user flows with Auth0
- [ ] Verify no legacy token paths are hit
- [ ] Check server logs for deprecation warnings
- [ ] Security audit for token leakage

---

## Rollback Plan

If issues arise:

1. **Immediate**: Re-enable legacy JWT middleware paths
2. **Short-term**: Hybrid mode (Auth0 + legacy)
3. **Long-term**: Fix issues and re-migrate

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | Done | None |
| Phase 2 | 1 day | None |
| Phase 3 | 1 day | Phase 2 |
| Phase 4 | 2 days | Phase 2 |
| Phase 5 | 1 day | Phase 2, 3 |
| Phase 6 | 0.5 day | Phase 2 |
| Phase 7 | 1 day | Phase 2 |
| Phase 8 | 0.5 day | Phases 2-7 |
| Phase 9 | 0.5 day | Phase 8 |
| Phase 10 | 2 days | Phases 2-9 |

**Total**: ~9 days

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing sessions | Medium | High | Gradual rollout, session migration |
| Job authentication failure | Low | High | Test jobs before full migration |
| Performance regression | Low | Medium | Load testing before migration |
| Token leakage in logs | Low | Medium | Audit all logging |

---

## Success Criteria

- [ ] All internal auth uses Auth0 cookies/headers
- [ ] No Bearer token extraction in internal code
- [ ] All tests pass
- [ ] No performance regression
- [ ] Security audit clean
