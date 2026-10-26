/**
 * Content-Security-Policy header values for the production web app.
 *
 * Kept here (rather than inline in `next.config.ts`) so the directives are
 * unit-testable — `content-security-policy.test.ts` guards that every
 * third-party host the app loads scripts/beacons from is actually allowed.
 * A missing host fails silently in the browser: the tag renders in the HTML
 * but the request is blocked, which is how GA4 Realtime sat at 0 users.
 */

/** Applied to every non-API route. */
export const PAGE_CSP = [
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
  "connect-src 'self' https: ws: wss: https://api.stripe.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://maps.googleapis.com https://maps.gstatic.com https://js.stripe.com https://checkout.stripe.com https://web.squarecdn.com https://sandbox.web.squarecdn.com blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://web.squarecdn.com https://sandbox.web.squarecdn.com",
  "img-src 'self' data: blob: https: https://maps.googleapis.com https://maps.gstatic.com https://js.stripe.com",
  "media-src 'self' https:",
  "font-src 'self' data: https://fonts.gstatic.com https://cash-f.squarecdn.com",
  "frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://checkout.stripe.com https://web.squarecdn.com https://sandbox.web.squarecdn.com https://www.youtube.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  "block-all-mixed-content",
].join("; ");

/** Applied to the `/api/*` proxy routes, which load no third-party scripts. */
export const API_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:; worker-src 'self' blob:;";
