/**
 * LinkedIn adapter — company-page posts via the Posts API.
 *
 * Spec: docs/LocalBiz/LINKEDIN_POSTING_SPEC.md §4.2
 * POST /rest/posts with author=urn:li:organization:{id}; mandatory
 * Linkedin-Version + X-Restli-Protocol-Version headers on every call.
 *
 * Media divergence vs Meta: LinkedIn does NOT fetch a public URL — images go
 * through the Images API (initializeUpload → PUT bytes → urn:li:image:*).
 * We download our own social_media.public_url server-side and push the bytes.
 * Video is lint-rejected in v1 (chunked Videos API is a v1.1 item).
 */

import { logger } from '../../logger';
import { resolveSurface } from './surfaces';
import { LINKEDIN_API_VERSION } from '../linkedin/oauth';
import type { PublishResult, SocialPlatformAdapter, SocialPostDraft } from './types';

const LINKEDIN_API = 'https://api.linkedin.com';
const MAX_BODY = 3000;
const MAX_IMAGES = 9;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Linkedin-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

async function linkedinFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: any; headers: Headers; retryAfterMs?: number }> {
  const res = await fetch(`${LINKEDIN_API}${path}`, { ...init, headers: { ...headers(token), ...(init.headers as Record<string, string> | undefined) } });
  const json = await res.json().catch(() => ({}));
  const retryAfter = res.headers.get('Retry-After');
  return { ok: res.ok, status: res.status, json, headers: res.headers, retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined };
}

/** Images API: initializeUpload → PUT bytes → image URN. */
async function uploadImage(token: string, authorUrn: string, imageUrl: string): Promise<string | null> {
  const init = await linkedinFetch('/rest/images?action=initializeUpload', token, {
    method: 'POST',
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  const uploadUrl = init.json?.value?.uploadUrl;
  const imageUrn = init.json?.value?.image;
  if (!init.ok || !uploadUrl || !imageUrn) return null;

  const img = await fetch(imageUrl);
  if (!img.ok) return null;
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) return null;

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': img.headers.get('content-type') || 'image/jpeg' },
    body: buf,
  });
  return put.ok ? String(imageUrn) : null;
}

function permalinkFor(postUrn: string): string {
  // urn:li:share:123 / urn:li:ugcPost:123 → feed update URL
  const id = postUrn.split(':').pop();
  return `https://www.linkedin.com/feed/update/${postUrn}`;
}

export const linkedinAdapter: SocialPlatformAdapter = {
  platform: 'linkedin',

  validateDraft(draft: SocialPostDraft): string[] {
    const errors: string[] = [];
    if (!draft.body?.trim()) errors.push('body is required');
    if (draft.body && draft.body.length > MAX_BODY) errors.push(`body exceeds ${MAX_BODY} chars`);
    const media = draft.media ?? [];
    const photos = media.filter((m) => m.type === 'photo');
    const videos = media.filter((m) => m.type === 'video');
    if (videos.length) errors.push('linkedin video posts are not supported yet');
    if (photos.length > MAX_IMAGES) errors.push(`linkedin allows at most ${MAX_IMAGES} images`);
    if (draft.linkUrl && media.length) errors.push('linkedin link posts cannot include media');
    return errors;
  },

  async publish(tenantId: string, draft: SocialPostDraft): Promise<PublishResult> {
    const surface = await resolveSurface(tenantId, 'linkedin', draft.targetRef);
    if (!surface) return { success: false, error: 'No connected LinkedIn organization page' };
    const authorUrn = surface.targetRef;
    const media = (draft.media ?? []).filter((m) => m.type === 'photo');

    try {
      let content: Record<string, unknown> | undefined;
      if (draft.linkUrl && !media.length) {
        content = { article: { source: draft.linkUrl } };
      } else if (media.length === 1) {
        const urn = await uploadImage(surface.token, authorUrn, media[0].url);
        if (!urn) return { success: false, error: 'image upload failed' };
        content = { media: { id: urn } };
      } else if (media.length > 1) {
        const images: Array<{ id: string; altText?: string }> = [];
        for (const m of media) {
          const urn = await uploadImage(surface.token, authorUrn, m.url);
          if (!urn) return { success: false, error: 'image upload failed' };
          images.push({ id: urn, ...(m.alt ? { altText: m.alt } : {}) });
        }
        content = { multiImage: { images } };
      }

      const r = await linkedinFetch('/rest/posts', surface.token, {
        method: 'POST',
        body: JSON.stringify({
          author: authorUrn,
          commentary: draft.body,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
          ...(content ? { content } : {}),
        }),
      });
      if (!r.ok) {
        const err = r.json?.message || r.json?.error || `API error: ${r.status}`;
        return { success: false, error: String(err), status: r.status, retryAfterMs: r.retryAfterMs };
      }
      const postUrn = r.headers.get('x-restli-id') || r.json?.id;
      return {
        success: true,
        remoteId: postUrn ? String(postUrn) : undefined,
        permalink: postUrn ? permalinkFor(String(postUrn)) : undefined,
      };
    } catch (error) {
      logger.error('[linkedin] publish error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },

  async delete(tenantId: string, remoteId: string, targetRef: string): Promise<boolean> {
    const surface = await resolveSurface(tenantId, 'linkedin', targetRef);
    if (!surface) return false;
    try {
      const r = await linkedinFetch(`/rest/posts/${encodeURIComponent(remoteId)}`, surface.token, { method: 'DELETE' });
      return r.ok;
    } catch {
      return false;
    }
  },
};
