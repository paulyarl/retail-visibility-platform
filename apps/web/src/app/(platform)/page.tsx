import { cookies } from 'next/headers';
import { LandingHero } from '@/components/landing/LandingHero';
import PlatformSummaryBand from './PlatformSummaryBand';
import PlatformHomeClient from './PlatformHomeClient';

/**
 * Platform root — server component.
 *
 * The hero (H1, subcopy, CTAs) and the executive summary band are rendered on
 * the server, so they are in the initial HTML for crawlers and link
 * unfurlers instead of the spinner the client used to ship. The interactive
 * remainder — Mantine cards, platform stats, showcase, dashboard — stays in
 * `PlatformHomeClient` behind its mount gate, because Mantine cannot render
 * without its provider during SSR.
 *
 * The intro is skipped when an auth cookie is present so a signed-in user
 * lands on the dashboard without a marketing flash. The cookie is only a
 * hint: if it is stale, the client sees `!isAuthenticated` and renders the
 * intro itself after mount (`introRendered` tells it whether to).
 */

const AUTH_COOKIE_PREFIXES = ['auth0', 'appSession'];

async function hasAuthSession(): Promise<boolean> {
  const store = await cookies();
  return store
    .getAll()
    .some(({ name }) => AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix)));
}

/** Best-effort: the hero's trust strip. Absent count simply hides the line. */
async function getBusinessCount(): Promise<number | undefined> {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_BASE_URL ||
    process.env.API_URL;
  if (!base) return undefined;

  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/api/public/platform/stats`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return undefined;
    const body = await res.json();
    const stats = body?.data ?? body;
    const count = stats?.activeRetailers ?? stats?.activeTenants ?? stats?.totalTenants;
    return typeof count === 'number' && count > 0 ? count : undefined;
  } catch {
    return undefined;
  }
}

export default async function PlatformHomePage() {
  const [signedIn, businessCount] = await Promise.all([hasAuthSession(), getBusinessCount()]);

  return (
    <>
      {!signedIn && <LandingHero businessCount={businessCount} />}
      {!signedIn && <PlatformSummaryBand />}
      <PlatformHomeClient introRendered={!signedIn} />
    </>
  );
}
