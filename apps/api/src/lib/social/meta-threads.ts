/**
 * Threads adapter — container publish on graph.threads.net.
 *
 * Spec: SOCIAL_POSTING_SUITE_SPEC.md §4.1
 * POST /{threads-user}/threads (media_type TEXT|IMAGE|VIDEO|CAROUSEL)
 *   → poll status → POST /{threads-user}/threads_publish
 * Differences vs IG: media OPTIONAL (text posts allowed), 500-char cap,
 * separate Threads-scoped token.
 */

import { logger } from '../../logger';
import { graphJson, publishContainer, waitForContainer } from './containers';
import { resolveSurface } from './surfaces';
import type { PublishResult, SocialPlatformAdapter, SocialPostDraft } from './types';

const THREADS_GRAPH = 'https://graph.threads.net/v1.0';
const MAX_TEXT = 500;
const MAX_CAROUSEL = 10;

async function createThreadsContainer(token: string, userId: string, item: { url: string; type: string }, isCarouselItem: boolean): Promise<string | null> {
  const body: Record<string, unknown> = { is_carousel_item: isCarouselItem };
  if (item.type === 'video') {
    body.media_type = 'VIDEO';
    body.video_url = item.url;
  } else {
    body.media_type = 'IMAGE';
    body.image_url = item.url;
  }
  const r = await graphJson(THREADS_GRAPH, `/${userId}/threads`, 'POST', token, body);
  return r.ok && r.json?.id ? String(r.json.id) : null;
}

export const metaThreadsAdapter: SocialPlatformAdapter = {
  platform: 'meta_threads',

  validateDraft(draft: SocialPostDraft): string[] {
    const errors: string[] = [];
    const hasBody = !!draft.body?.trim();
    const media = draft.media ?? [];
    if (!hasBody && !media.length) errors.push('threads post needs text or media');
    if (draft.body && draft.body.length > MAX_TEXT) errors.push(`threads text exceeds ${MAX_TEXT} chars`);
    if (media.length > MAX_CAROUSEL) errors.push(`threads carousel allows at most ${MAX_CAROUSEL} items`);
    if (media.filter((m) => m.type === 'video').length > 1) errors.push('threads allows at most 1 video per post');
    return errors;
  },

  async publish(tenantId: string, draft: SocialPostDraft): Promise<PublishResult> {
    const surface = await resolveSurface(tenantId, 'meta_threads', draft.targetRef);
    if (!surface) return { success: false, error: 'No connected Threads surface' };
    const userId = surface.targetRef;
    const media = draft.media ?? [];
    const text = draft.linkUrl ? `${draft.body} ${draft.linkUrl}`.trim() : draft.body;

    try {
      if (media.length === 0) {
        const r = await graphJson(THREADS_GRAPH, `/${userId}/threads`, 'POST', surface.token, {
          media_type: 'TEXT',
          text,
        });
        if (!r.ok || !r.json?.id) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
        return await publishContainer(THREADS_GRAPH, [String(r.json.id)], `/${userId}/threads_publish`, surface.token);
      }

      if (media.length === 1) {
        const item = media[0];
        const body: Record<string, unknown> = {
          media_type: item.type === 'video' ? 'VIDEO' : 'IMAGE',
          text,
        };
        if (item.type === 'video') body.video_url = item.url;
        else body.image_url = item.url;
        const r = await graphJson(THREADS_GRAPH, `/${userId}/threads`, 'POST', surface.token, body);
        if (!r.ok || !r.json?.id) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
        return await publishContainer(THREADS_GRAPH, [String(r.json.id)], `/${userId}/threads_publish`, surface.token);
      }

      // Carousel — children containers then a CAROUSEL parent
      const children: string[] = [];
      for (const item of media) {
        const id = await createThreadsContainer(surface.token, userId, item, true);
        if (!id) return { success: false, error: 'carousel item container creation failed' };
        children.push(id);
      }
      for (const id of children) {
        const wait = await waitForContainer(THREADS_GRAPH, id, surface.token);
        if (!wait.ready) return { success: false, error: wait.error };
      }
      const r = await graphJson(THREADS_GRAPH, `/${userId}/threads`, 'POST', surface.token, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        text,
      });
      if (!r.ok || !r.json?.id) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
      return await publishContainer(THREADS_GRAPH, [String(r.json.id)], `/${userId}/threads_publish`, surface.token);
    } catch (error) {
      logger.error('[meta-threads] publish error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
