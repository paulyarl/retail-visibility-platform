import { NextRequest, NextResponse } from 'next/server';

/**
 * Deprecated single-file sitemap.
 *
 * `/sitemap.xml` is the only sitemap now (spec §4.2). This path 308s rather
 * than 404s so an existing Search Console submission or external reference
 * lands on a valid document.
 */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/sitemap.xml', request.url), 308);
}
