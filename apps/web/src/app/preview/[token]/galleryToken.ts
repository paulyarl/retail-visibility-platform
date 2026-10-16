/**
 * Gallery token resolution.
 *
 * The public gallery URL is path-form — `/preview/<token>` — for every producer
 * (PostalMailerService's postcard QR, the gallery-token routes,
 * LogContactModal, CallScriptService, GalleryPanel, and the /g/<shortCode>
 * redirect). The route segment is therefore the source of truth; `?token=`
 * stays supported so legacy links keep working.
 */
export function resolveGalleryToken(
  routeToken: string | string[] | undefined | null,
  queryToken?: string | null,
): string {
  const fromRoute = Array.isArray(routeToken) ? routeToken[0] : routeToken;
  return (fromRoute || queryToken || '').trim();
}
