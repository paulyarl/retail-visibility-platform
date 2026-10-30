/**
 * Instagram adapter — two-step media-container publishing.
 *
 * Spec: SOCIAL_POSTING_SUITE_SPEC.md §4.1
 * POST /{ig-user}/media (container) → poll status → POST /{ig-user}/media_publish
 * Hard rule: media REQUIRED (≥1 image or video); URL must be publicly
 * fetchable — social_media.public_url (never a signed gallery URL).
 */

import { logger } from '../../logger';
import { graphJson, publishContainer, waitForContainer } from './containers';
import { resolveSurface } from './surfaces';
import type { PublishResult, SocialPlatformAdapter, SocialPostDraft } from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_CAPTION = 2200;
const MAX_CAROUSEL = 10;

async function createContainer(token: string, igUserId: string, item: { url: string; type: string }, opts: { caption?: string; isCarouselItem?: boolean }): Promise<string | null> {
  const body: Record<string, unknown> = {};
  if (item.type === 'video') {
    body.media_type = 'VIDEO';
    body.video_url = item.url;
  } else {
    body.image_url = item.url;
  }
  if (opts.caption) body.caption = opts.caption;
  if (opts.isCarouselItem) body.is_carousel_item = true;
  const r = await graphJson(GRAPH, `/${igUserId}/media`, 'POST', token, body);
  return r.ok && r.json?.id ? String(r.json.id) : null;
}

export const metaInstagramAdapter: SocialPlatformAdapter = {
  platform: 'meta_instagram',

  validateDraft(draft: SocialPostDraft): string[] {
    const errors: string[] = [];
    const media = draft.media ?? [];
    if (!media.length) errors.push('instagram requires at least one image or video');
    if (media.length > MAX_CAROUSEL) errors.push(`instagram carousel allows at most ${MAX_CAROUSEL} items`);
    if (draft.body && draft.body.length > MAX_CAPTION) errors.push(`caption exceeds ${MAX_CAPTION} chars`);
    return errors;
  },

  async publish(tenantId: string, draft: SocialPostDraft): Promise<PublishResult> {
    const surface = await resolveSurface(tenantId, 'meta_instagram', draft.targetRef);
    if (!surface) return { success: false, error: 'No connected Instagram surface' };
    const igUserId = surface.targetRef;
    const media = draft.media ?? [];

    try {
      if (media.length === 1) {
        // Single item — caption on the media container
        const id = await createContainer(surface.token, igUserId, media[0], { caption: draft.body });
        if (!id) return { success: false, error: 'media container creation failed' };
        return await publishContainer(GRAPH, [id], `/${igUserId}/media_publish`, surface.token);
      }

      // Carousel — item containers first, then the CAROUSEL parent
      const children: string[] = [];
      for (const item of media) {
        const id = await createContainer(surface.token, igUserId, item, { isCarouselItem: true });
        if (!id) return { success: false, error: 'carousel item container creation failed' };
        children.push(id);
      }
      for (const id of children) {
        const wait = await waitForContainer(GRAPH, id, surface.token);
        if (!wait.ready) return { success: false, error: wait.error };
      }
      const r = await graphJson(GRAPH, `/${igUserId}/media`, 'POST', surface.token, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: draft.body,
      });
      if (!r.ok || !r.json?.id) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
      return await publishContainer(GRAPH, [String(r.json.id)], `/${igUserId}/media_publish`, surface.token);
    } catch (error) {
      logger.error('[meta-instagram] publish error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
