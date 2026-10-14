/**
 * Subdomain / custom-domain rate limits — the single source of truth.
 *
 * Enforced by the write routes in `routes/tenants.ts` and surfaced to the
 * platform admin dashboard (`GET /api/admin/subdomains/rate-limits`) so the
 * "Rate Limiting" panel shows what is actually enforced. The panel used to
 * hardcode these numbers while claiming they came from the backend, which meant
 * any change here silently made the dashboard wrong.
 */
export const RATE_LIMITS = {
  subdomainCheck: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 checks per minute
  subdomainCreate: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 creations per hour per tenant
  subdomainResolve: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 resolutions per minute (for middleware)
  customDomainResolve: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 resolutions per minute (for middleware)
  customDomainAction: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 add/check/remove actions per hour per tenant
} as const;

export type RateLimitOperation = keyof typeof RATE_LIMITS;
