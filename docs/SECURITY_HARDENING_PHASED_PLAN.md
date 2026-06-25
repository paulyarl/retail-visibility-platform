# Security Hardening Phased Plan

> **Context**: Rate limiting, CSRF, XSS/sanitization, and SSRF middleware are all implemented but intentionally disabled during development. This plan activates and tightens them for go-live readiness.

---

## Phase 1: Rate Limiting Activation (P0 — Pre-Launch Blocker)

### 1A. Enable Rate Limiting Globally

**Problem**: `RateLimitingService.isRateLimitingEnabled()` defaults to `false`. No env var is set in production.

**Actions**:
1. Add `RATE_LIMITING_ENABLED=true` to production environment (Railway/Vercel)
2. Add `RATE_LIMITING_ENABLED=false` to `.env.example` with comment: `# Set to true in production`
3. Update `RateLimitingService.ts:287-291` — change default fallback from `false` to `true` when env var is absent and DB setting is absent (safe default: ON)
4. Remove duplicate rate limit middleware at `index.ts:294-327` (inline async) OR at `index.ts:361` (`applyRateLimit`) — keep only one
5. Verify `rate_limit_configurations` table has seed rows for: `auth`, `admin`, `strict`, `standard`, `exempt`

**Files**:
- `apps/api/src/services/RateLimitingService.ts` (default change)
- `apps/api/.env.example` (document env vars)
- `apps/api/src/index.ts` (remove duplicate middleware)

**Risk**: Low — if limits are too aggressive, can be tuned via DB without redeploy

---

### 1B. Apply Specialized Rate Limiters to Routes

**Problem**: 7 of 9 specialized rate limiters are exported but never applied to any route. All traffic uses a single `standard` rule.

**Actions** — apply limiters to route groups in `index.ts`:

| Limiter | Routes | Current | Target |
|---|---|---|---|
| `authRateLimit` | `/api/auth/*`, `/api/login`, `/api/register` | None | 5 req / 15 min |
| `adminRateLimit` | `/api/admin/*` | None | 50 req / 15 min |
| `searchRateLimit` | `/api/items/search`, `/api/products/search`, `/api/directory/search` | None | 30 req / min |
| `uploadRateLimit` | `/api/photos`, `/api/uploads`, any multer routes | None | 10 req / hour |
| `costlyApiRateLimit` | `/api/geocode`, `/api/google/*`, `/api/external/*` | None | 20 req / hour |
| `storeStatusRateLimit` | `/api/public/store-status/*` | None | 500 req / 15 min |
| `downloadRateLimit` | `/api/downloads/*`, `/api/digital-download/*` | Already applied | Verify coverage |
| `accessTokenRateLimit` | `/api/access-token/*` | Already applied | Verify coverage |
| `searchRateLimit` | `/api/public/bot/*` | None | 30 req / min (anti-scraping) |

**Pattern**: Mount as `app.use('/api/auth', authRateLimit, authRoutes)` before route handler

**Files**:
- `apps/api/src/index.ts` (mount limiters on route groups)
- `apps/api/src/middleware/rate-limit.ts` (no changes needed — limiters already exported)

**Risk**: Medium — misconfigured limits could block legitimate traffic. Start conservative, monitor `rate_limit_warnings` table, tune via DB.

---

### 1C. Remove Admin Blanket Bypass

**Problem**: Every rate limiter skips `PLATFORM_ADMIN` and `PLATFORM_SUPPORT` entirely. A compromised admin account has zero rate limiting.

**Actions**:
1. Replace `skip` logic in all 9 limiters: instead of skipping admins, apply a 10x higher limit
2. Add `keyGenerator` function that uses `userId` when authenticated, falls back to IP
3. This ensures per-user limits for authenticated users, per-IP for anonymous

**Pattern**:
```typescript
skip: (req: Request) => {
  // Never skip — apply higher limits for admins instead
  return false;
},
max: (req: Request) => {
  const user = (req as any).user;
  if (user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT') {
    return config.maxRequests * 10; // 10x higher limit for admins
  }
  return config.maxRequests;
}
```

**Files**:
- `apps/api/src/middleware/rate-limit.ts` (all 9 limiters)

**Risk**: Low — admins still get high limits, just not unlimited

---

### 1D. Consolidate Rate Limiting Systems

**Problem**: Three overlapping rate limit implementations exist:
1. `RateLimitingService` (singleton, DB-driven) — `index.ts:294`
2. `applyRateLimit` (express-rate-limit, DB-driven) — `index.ts:361`
3. `basicRateLimit` (in-memory Map) — `ssrf-protection.ts:208`

**Actions**:
1. Remove `basicRateLimit` from `ssrf-protection.ts` (unused in `index.ts` but exported)
2. Keep `RateLimitingService` as the single global gatekeeper
3. Keep specialized `express-rate-limit` limiters for route-specific limits
4. Remove the inline async middleware at `index.ts:294-327` (redundant with `applyRateLimit` at `index.ts:361`)

**Files**:
- `apps/api/src/middleware/ssrf-protection.ts` (remove `basicRateLimit`)
- `apps/api/src/index.ts` (remove inline middleware)

**Risk**: Low — consolidation only, no behavior change

---

## Phase 2: CSRF Enforcement (P0 — Pre-Launch Blocker)

### 2A. Enable CSRF Enforcement

**Problem**: `FF_ENFORCE_CSRF` defaults to `false`. CSRF protection is wired but completely inactive.

**Actions**:
1. Set `FF_ENFORCE_CSRF=true` in production environment
2. Add `FF_ENFORCE_CSRF=false` to `.env.example` with comment: `# Set to true in production`
3. Remove `console.log` at `csrf.ts:43` (logs token presence on every write)
4. Remove `console.error` at `csrf.ts:48` (logs token fragments)
5. Verify frontend sends `x-csrf-token` header on all write operations (check API client/fetch wrapper)

**Files**:
- `apps/api/src/middleware/csrf.ts` (remove console logs)
- `apps/api/.env.example` (document env var)

**Frontend Check**:
- Verify `apps/web/src/services/` API client reads `csrf` cookie and sends `x-csrf-token` header
- If not implemented, add a global fetch interceptor that injects the header from cookie

**Risk**: High if frontend doesn't send token — all writes will 403. Must verify frontend first.

---

### 2B. Frontend CSRF Token Injection

**Problem**: Need to verify/implement frontend sending of CSRF token.

**Actions**:
1. Audit `apps/web/src/services/` for existing CSRF token handling
2. If missing, add a utility that reads the `csrf` cookie and injects `x-csrf-token` header on all POST/PUT/PATCH/DELETE requests
3. Add to the global fetch wrapper or API client singleton
4. Test: make a write request from frontend, verify token is sent

**Files**:
- `apps/web/src/services/` (API client — verify or add CSRF header injection)
- `apps/web/src/lib/` (if a fetch wrapper exists, add there)

**Risk**: Medium — requires frontend coordination

---

## Phase 3: XSS & Sanitization Hardening (P1 — Post-Launch)

### 3A. Expand Sanitization Field Coverage

**Problem**: `input-validation.ts:160` only sanitizes 8 field names: `name`, `description`, `comment`, `message`, `title`, `content`, `email`, `phone`. All other fields pass through unsanitized.

**Actions**:
1. Expand `sensitiveFields` to include: `url`, `address`, `notes`, `tags`, `metadata`, `sku`, `variant_name`, `category`, `slug`, `bio`, `summary`, `label`, `value`, `query`, `search`, `term`
2. Alternatively, switch to deny-list approach: sanitize ALL string fields except known binary/safe fields (e.g., `id`, `token`, `password`, `hash`)
3. Add test: send XSS payload in non-standard field, verify it's blocked/sanitized

**Files**:
- `apps/api/src/middleware/input-validation.ts` (expand field list)

**Risk**: Medium — over-sanitization could corrupt legitimate data with `<` or `>` in content (e.g., HTML in product descriptions). Need to verify which fields intentionally allow HTML.

---

### 3B. Sanitize Multipart Form Text Fields

**Problem**: `input-validation.ts:136` skips body sanitization for `multipart/form-data`. Text fields in multipart forms (e.g., product name uploaded with images) bypass `sanitizeObject`.

**Actions**:
1. After multer processes the request, sanitize text fields from `req.body` (multer populates text fields in `req.body` even for multipart)
2. Move the multipart check to only skip binary file content, not text fields
3. Add `sanitizeRequest` call after multer middleware for upload routes

**Files**:
- `apps/api/src/middleware/input-validation.ts` (fix multipart handling)

**Risk**: Low — text fields in multipart are the same as JSON body fields

---

### 3C. Consolidate Dangerous Pattern Checkers

**Problem**: Two overlapping pattern arrays with different coverage:
- `security.ts:8-37` — 37 patterns (template literals, protocols, event handlers, JS functions)
- `input-validation.ts:10-19` — 4 patterns (SQL injection, XSS, path traversal, SQL comments)

**Actions**:
1. Merge into a single comprehensive `DANGEROUS_PATTERNS` array in a shared module (e.g., `apps/api/src/utils/security-patterns.ts`)
2. Import from both `security.ts` and `input-validation.ts`
3. Categorize patterns: `SQL_INJECTION`, `XSS`, `PATH_TRAVERSAL`, `TEMPLATE_INJECTION`, `PROTOCOL_INJECTION`, `JS_EXECUTION`
4. Add tests for each category

**Files**:
- `apps/api/src/utils/security-patterns.ts` (NEW — shared patterns)
- `apps/api/src/middleware/security.ts` (import from shared)
- `apps/api/src/middleware/input-validation.ts` (import from shared)

**Risk**: Low — consolidation only, patterns are additive

---

### 3D. Tighten CSP Headers

**Problem**: `security-headers.ts:14` allows `'unsafe-inline'` and `'unsafe-eval'` in `scriptSrc`. These weaken XSS protection significantly.

**Actions**:
1. Audit frontend for inline scripts and `eval()` usage
2. If feasible, remove `'unsafe-eval'` first (less likely to be used)
3. Remove `'unsafe-inline'` if no inline scripts exist, or replace with nonce-based CSP
4. If inline scripts are needed, implement CSP nonce: server generates per-request nonce, frontend uses it in `<script nonce="...">`
5. Add `'strict-dynamic'` if using nonces

**Files**:
- `apps/api/src/middleware/security-headers.ts` (CSP directives)
- Frontend layout files (if nonce approach needed)

**Risk**: High — removing `unsafe-inline` can break frontend if inline scripts exist. Requires thorough testing. **Defer to post-launch if risky.**

---

## Phase 4: SSRF & Input Edge Cases (P2 — Post-Launch)

### 4A. Fix SSRF Allowlist Placeholders

**Problem**: `ssrf-protection.ts:24-29` has placeholder domains (`api.example.com`, `cdn.example.com`). The whitelist check at line 84-91 blocks any URL not matching these — meaning real external services (Google APIs, Stripe, etc.) would be blocked if the check were active.

**Actions**:
1. Replace `ALLOWED_DOMAINS` with actual external service domains:
   - `maps.googleapis.com`
   - `maps.gstatic.com`
   - `api.stripe.com`
   - `connect.square.com`
   - `api.tiktok.com`
   - `graph.facebook.com`
   - `api.easypost.com`
   - `api.openai.com`
2. OR: Change the whitelist logic to a deny-list approach (block known-dangerous domains, allow everything else) — safer for a platform with many integrations
3. Add test: verify legitimate API calls pass SSRF check

**Files**:
- `apps/api/src/middleware/ssrf-protection.ts` (replace placeholders or switch to deny-list)

**Risk**: Medium — too restrictive could break integrations; too permissive defeats the purpose

---

### 4B. Remove Hardcoded Validation Skip Endpoints

**Problem**: `input-validation.ts:178-190` skips validation for 3 endpoints:
- `/api/recommendations/track-batch`
- `/api/security/telemetry/batch`
- `/api/oauth/square/register-test-token`
- `/api/oauth/paypal/register-test-token`

**Actions**:
1. For `track-batch` and `telemetry/batch`: add targeted Zod schemas that validate the specific expected shape
2. For OAuth test token endpoints: these should be disabled in production entirely (gate behind `NODE_ENV !== 'production'`)
3. Remove the skip conditions from `inputValidationMiddleware`

**Files**:
- `apps/api/src/middleware/input-validation.ts` (remove skips)
- Route files for skipped endpoints (add Zod schemas)

**Risk**: Low — test token endpoints shouldn't exist in production

---

### 4C. Add Webhook Signature Verification Middleware

**Problem**: No general middleware verifies webhook signatures. Each webhook route implements its own verification (Stripe does, but others may not).

**Actions**:
1. Create `apps/api/src/middleware/webhook-verify.ts` — generic HMAC signature verification
2. Accept config: `header` (e.g., `X-Webhook-Signature`), `secret` (from env), `algorithm` (sha256)
3. Apply to webhook routes that don't have their own verification (Stripe routes already handle this)
4. Add replay attack protection: check `X-Webhook-Timestamp` within 5-minute window

**Files**:
- `apps/api/src/middleware/webhook-verify.ts` (NEW)
- `apps/api/src/index.ts` (apply to webhook routes)

**Risk**: Low — additive, only affects webhook routes

---

## Phase 5: Observability & Monitoring (P2 — Post-Launch)

### 5A. Security Alert Dashboard

**Problem**: `createSecurityAlert` is called from rate limiters but there's no admin UI to view/alert on them.

**Actions**:
1. Verify `security_alerts` table exists and is populated
2. Add admin route: `GET /api/admin/security/alerts` (list, filter by type/severity/date)
3. Add admin UI page: `/settings/admin/security` — alert feed with severity badges
4. Add Sentry integration: forward `critical` severity alerts to Sentry

**Files**:
- `apps/api/src/routes/admin-security.ts` (verify/extend alert endpoints)
- `apps/web/src/app/settings/admin/security/` (NEW — admin UI)

**Risk**: None — read-only observability

---

### 5B. Rate Limit Metrics Dashboard

**Problem**: `RateLimitingService.getRateLimitMetrics()` returns metrics but many methods return empty stubs (`getTotalRequests`, `getBlockedRequests`, etc. all return 0/empty).

**Actions**:
1. Implement actual DB queries in `RateLimitingService.ts:690-713` using `rate_limit_warnings` table
2. Add admin UI widget: top violators, blocked requests trend, route breakdown
3. Wire to existing `/api/rate-limit/metrics` endpoint

**Files**:
- `apps/api/src/services/RateLimitingService.ts` (implement metric queries)
- `apps/web/src/app/settings/admin/` (add metrics widget)

**Risk**: None — read-only observability

---

## Execution Priority

| Phase | Priority | When | Effort |
|---|---|---|---|
| 1A. Enable rate limiting | P0 | Pre-launch | 1 hour |
| 1B. Apply specialized limiters | P0 | Pre-launch | 2 hours |
| 2A. Enable CSRF enforcement | P0 | Pre-launch | 1 hour |
| 2B. Frontend CSRF token | P0 | Pre-launch | 2 hours |
| 1C. Remove admin bypass | P1 | Post-launch | 1 hour |
| 1D. Consolidate systems | P1 | Post-launch | 1 hour |
| 3A. Expand sanitization | P1 | Post-launch | 2 hours |
| 3B. Multipart sanitization | P1 | Post-launch | 1 hour |
| 3C. Consolidate patterns | P1 | Post-launch | 2 hours |
| 4A. SSRF allowlist | P2 | Post-launch | 1 hour |
| 4B. Remove skip endpoints | P2 | Post-launch | 2 hours |
| 4C. Webhook verification | P2 | Post-launch | 2 hours |
| 3D. Tighten CSP | P2 | Post-launch | 4 hours |
| 5A. Security alert dashboard | P2 | Post-launch | 4 hours |
| 5B. Rate limit metrics | P2 | Post-launch | 4 hours |

---

## Environment Variables to Add

```env
# Rate Limiting
RATE_LIMITING_ENABLED=true                    # Enable/disable globally
RATE_LIMIT_AUTH_MAX=5                         # Login attempts per window
RATE_LIMIT_AUTH_WINDOW=15                     # Window in minutes
RATE_LIMIT_ADMIN_MAX=50                       # Admin requests per window
RATE_LIMIT_ADMIN_WINDOW=15
RATE_LIMIT_STANDARD_MAX=100                   # Standard API requests per window
RATE_LIMIT_STANDARD_WINDOW=15
RATE_LIMIT_STRICT_MAX=20                      # Costly API requests per window
RATE_LIMIT_STRICT_WINDOW=15

# CSRF
FF_ENFORCE_CSRF=true                          # Enforce CSRF token validation
```

---

## Verification Checklist

- [ ] Rate limiting enabled in production env
- [ ] `authRateLimit` applied to auth routes
- [ ] `searchRateLimit` applied to search routes
- [ ] `adminRateLimit` applied to admin routes
- [ ] `uploadRateLimit` applied to upload routes
- [ ] `costlyApiRateLimit` applied to external API routes
- [ ] Bot endpoints have rate limiting
- [ ] Admin bypass replaced with higher limits
- [ ] Duplicate rate limit middleware removed
- [ ] CSRF enforcement enabled in production
- [ ] Frontend sends `x-csrf-token` header on writes
- [ ] CSRF console logs removed
- [ ] `.env.example` documents all security env vars
- [ ] SSRF allowlist has real domains
- [ ] Validation skip endpoints removed or schema'd
- [ ] Sanitization covers all user-input fields
- [ ] Multipart text fields sanitized
- [ ] Security alert dashboard accessible
