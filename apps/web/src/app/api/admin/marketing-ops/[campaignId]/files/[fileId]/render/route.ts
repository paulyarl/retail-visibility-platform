import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

/**
 * Platform-fronted render for diagnostic screenshots.
 *
 * The disputes bucket is private, so <img>/<a> can't hit the API directly
 * (no way to attach a Bearer token) and signed URLs expose the raw
 * supabase.co origin in the UI. This route keeps the visible URL on the
 * platform domain: the Auth0 session cookie flows same-origin, we mint the
 * Bearer token server-side, and stream the bytes through.
 *
 * ?download=1 forces Content-Disposition: attachment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; fileId: string }> }
) {
  try {
    const { campaignId, fileId } = await params;

    const authResult = await requirePlatformAdmin(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { accessToken } = authResult;
    const download = req.nextUrl.searchParams.get('download');
    const upstream = await authenticatedFetch(
      `/api/admin/marketing-ops/${encodeURIComponent(campaignId)}/files/${encodeURIComponent(fileId)}/render${download ? '?download=1' : ''}`,
      accessToken,
      { method: 'GET' }
    );

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { success: false, error: upstream.status === 404 ? 'not_found' : 'render_failed' },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) headers.set('Content-Disposition', disposition);
    headers.set('Cache-Control', 'private, max-age=300');

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'proxy_failed' },
      { status: 500 }
    );
  }
}
