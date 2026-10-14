/**
 * Response-envelope unwrapping for the platform API.
 *
 * Two layers wrap a payload on the way to a component:
 *
 *   fetch body            → `{ success: true, data: <payload> }`  (BaseController.handleSuccess)
 *   RequestExecutionUtility → `{ success: true, data: <parsed body> }`  (ApiResult)
 *
 * So a caller holding an `ApiResult` must unwrap twice to reach the payload. The
 * tenant subdomain settings page unwrapped once (`result?.data?.subdomain`),
 * which read the envelope instead of the tenant — the "Current Subdomain" banner
 * stayed blank and the picker never got seeded with the live value.
 *
 * Payloads that are not wrapped (`{ success, subdomains, total }`) are returned
 * as-is, so this is safe for both shapes.
 */
export function unwrapApiBody<T = any>(result: any): T | null {
  if (result == null) return null;
  if (result.success === false) return null;

  const body = result?.data ?? result;
  if (body == null) return null;
  if (typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return ((body as any).data ?? null) as T | null;
  }
  return body as T;
}
