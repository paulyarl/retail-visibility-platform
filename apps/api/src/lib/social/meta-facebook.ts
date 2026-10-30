/**
 * Facebook Page adapter — publish text/link/photo/video posts to a Page.
 *
 * Spec: SOCIAL_POSTING_SUITE_SPEC.md §4.1
 * Graph calls run on graph.facebook.com with the Page access token stored on
 * the surface row (never-expiring when derived from a long-lived user token).
 */

import { logger } from '../../logger';
import { resolveSurface } from './surfaces';
import type { PublishResult, SocialPlatformAdapter, SocialPostDraft } from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_BODY = 63206;
const MAX_PHOTOS = 10;

async function graphPost(
  path: string,
  token: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: any; retryAfterMs?: number }> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json().catch(() => ({}));
  const retryAfter = res.headers.get('Retry-After');
  return {
    ok: res.ok,
    status: res.status,
    json,
    retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined,
  };
}

async function uploadUnpublishedPhoto(token: string, pageId: string, url: string): Promise<string | null> {
  const r = await graphPost(`/${pageId}/photos`, token, { url, published: false });
  return r.ok && r.json?.id ? String(r.json.id) : null;
}

export const metaFacebookAdapter: SocialPlatformAdapter = {
  platform: 'meta_facebook',

  validateDraft(draft: SocialPostDraft): string[] {
    const errors: string[] = [];
    if (!draft.body?.trim()) errors.push('body is required');
    if (draft.body && draft.body.length > MAX_BODY) errors.push(`body exceeds ${MAX_BODY} chars`);
    const media = draft.media ?? [];
    const photos = media.filter((m) => m.type === 'photo');
    const videos = media.filter((m) => m.type === 'video');
    if (photos.length > MAX_PHOTOS) errors.push(`facebook allows at most ${MAX_PHOTOS} photos`);
    if (videos.length > 1) errors.push('facebook allows at most 1 video per post');
    if (videos.length && photos.length) errors.push('facebook post cannot mix photo and video media');
    return errors;
  },

  async publish(tenantId: string, draft: SocialPostDraft): Promise<PublishResult> {
    const surface = await resolveSurface(tenantId, 'meta_facebook', draft.targetRef);
    if (!surface) return { success: false, error: 'No connected Facebook Page surface' };
    const pageId = surface.targetRef;
    const media = draft.media ?? [];
    const videos = media.filter((m) => m.type === 'video');
    const photos = media.filter((m) => m.type === 'photo');

    try {
      // Video post → /{page}/videos
      if (videos.length) {
        const r = await graphPost(`/${pageId}/videos`, surface.token, {
          file_url: videos[0].url,
          description: draft.body,
        });
        if (!r.ok) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
        return { success: true, remoteId: r.json?.id ? String(r.json.id) : undefined };
      }

      // Photo(s) → unpublished uploads + /feed attached_media
      let attached: Array<{ media_fbid: string }> | undefined;
      if (photos.length === 1) {
        // Single photo: publish it directly with caption — simplest path
        const r = await graphPost(`/${pageId}/photos`, surface.token, { url: photos[0].url, caption: draft.body });
        if (!r.ok) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
        return { success: true, remoteId: r.json?.post_id ? String(r.json.post_id) : (r.json?.id ? String(r.json.id) : undefined) };
      }
      if (photos.length > 1) {
        attached = [];
        for (const p of photos) {
          const id = await uploadUnpublishedPhoto(surface.token, pageId, p.url);
          if (!id) return { success: false, error: 'photo upload failed' };
          attached.push({ media_fbid: id });
        }
      }

      // Text / link / multi-photo feed post
      const payload: Record<string, unknown> = { message: draft.body };
      if (draft.linkUrl) payload.link = draft.linkUrl;
      if (attached) payload.attached_media = attached;
      const r = await graphPost(`/${pageId}/feed`, surface.token, payload);
      if (!r.ok) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
      return { success: true, remoteId: r.json?.id ? String(r.json.id) : undefined };
    } catch (error) {
      logger.error('[meta-facebook] publish error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },

  async delete(tenantId: string, remoteId: string, targetRef: string): Promise<boolean> {
    const surface = await resolveSurface(tenantId, 'meta_facebook', targetRef);
    if (!surface) return false;
    try {
      const res = await fetch(`${GRAPH}/${remoteId}?access_token=${encodeURIComponent(surface.token)}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },
};
