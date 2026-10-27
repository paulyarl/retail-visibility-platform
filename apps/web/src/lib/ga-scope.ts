/**
 * GA4 surface-scope enforcement.
 *
 * GtagScript's pathname gate decides whether the *initial* page_view fires
 * (it has to — config runs before any API call). This module is the runtime
 * backstop wired into the API singleton bases: the moment a page exercises a
 * tenant/admin/system-scoped service, GA is hard-disabled for the rest of
 * that page load via the official `ga-disable-<MEASUREMENT_ID>` opt-out flag.
 * That catches private surfaces the pathname blocklist misses (unlisted
 * routes, tenant subdomain/custom-domain hosts, future admin areas).
 *
 * One-directional by design: a PUBLIC request never re-enables tracking —
 * tenant pages legitimately call public APIs (e.g. tenant resolve), so scope
 * can only narrow, never widen.
 */

// Allowlist: request types compatible with GA. public + customer cover the
// acquisition funnel and shopper activity; external (third-party lookups)
// and system (background plumbing like cache refresh) can fire on any
// surface and don't imply private scope. The remaining types — tenant,
// admin, authenticated — only exist for signed-in operator work, so any
// one of them disables GA for the page. That means a logged-in merchant's
// session drops out of tracking even on public pages — intentional: GA here
// measures anonymous acquisition plus shoppers, not operator behavior.
const GA_ALLOWED_REQUEST_TYPES = new Set(['public', 'customer', 'external', 'system']);

export function markSurfaceScope(requestType: string): void {
  if (typeof window === 'undefined') return;
  if (GA_ALLOWED_REQUEST_TYPES.has(requestType)) return;
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
}
