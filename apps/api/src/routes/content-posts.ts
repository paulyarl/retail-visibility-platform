import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { createPost } from '../services/GBPAdvancedSync';
import { logger } from '../logger';

/**
 * Content Hub — unified posts composer (spec §4, Phase 1).
 *
 * One tenant-auth endpoint that multiplexes a single authored post into the
 * existing per-channel pipelines — storage stays per-channel:
 *   - GBP   → gbp_posts (SCHEDULED row when scheduledFor, else inline
 *             createPost + PUBLISHED row — same two paths gbp-customer uses)
 *   - Meta  → social_posts SCHEDULED rows, one per platform
 *             (meta_facebook / meta_instagram / meta_threads); the
 *             socialPostScheduler picks them up on its next tick
 *   - LinkedIn → social_posts SCHEDULED rows, one per connected
 *             organization page (linkedin_surface_connections); the
 *             member token rides linkedin_oauth_accounts_list
 *
 * Gates come from resolveEffectiveCapabilities (module-level flexible keys),
 * never per-key hasFeature for module on/off (see spec §11).
 */

const router = Router();

const postSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  mediaUrl: z.string().url().max(2048).optional(),
  linkUrl: z.string().url().max(2048).optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  destinations: z.object({
    gbp: z.boolean().optional(),
    meta: z.array(z.enum(['meta_facebook', 'meta_instagram', 'meta_threads'])).optional(),
    linkedin: z.boolean().optional(),
    place: z.boolean().optional(),
  }),
});

const META_FEATURE_KEY: Record<string, string> = {
  meta_facebook: 'social_posting_meta',
  meta_instagram: 'social_posting_instagram',
  meta_threads: 'social_posting_threads',
};

interface DestinationResult {
  channel: string;
  ok: boolean;
  postId?: string;
  scheduled?: boolean;
  error?: string;
}

const newPostId = () => `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

router.post('/:tenantId/content/posts', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { body, mediaUrl, linkUrl, scheduledFor, destinations } = parsed.data;

    if (!destinations.gbp && !destinations.place && !destinations.linkedin && (!destinations.meta || destinations.meta.length === 0)) {
      return res.status(400).json({ success: false, error: 'no_destinations', message: 'Select at least one destination' });
    }

    const caps = await resolveEffectiveCapabilities(tenantId);
    const gbpMod = caps?.effective?.gbp_management as { enabled?: boolean } | undefined;
    const socialMod = caps?.effective?.social_posting as
      | {
          enabled?: boolean;
          facebook_enabled?: boolean;
          instagram_enabled?: boolean;
          threads_enabled?: boolean;
          linkedin_enabled?: boolean;
          can_use_scheduler?: boolean;
        }
      | undefined;

    // Scheduler gate — resolver flag OR legacy override check (spec F1).
    const hasSchedulerGate = async () =>
      !!socialMod?.can_use_scheduler || await permissionServiceFactory.hasFeature(tenantId, 'social_posting_scheduler');

    const results: DestinationResult[] = [];
    const scheduledAt = scheduledFor ? new Date(scheduledFor) : null;

    // ── GBP destination ──
    if (destinations.gbp) {
      if (!gbpMod?.enabled) {
        results.push({ channel: 'gbp', ok: false, error: 'gbp_management not enabled for this tier' });
      } else if (scheduledAt && !(await permissionServiceFactory.hasFeature(tenantId, 'gbp_posts_scheduler'))) {
        results.push({ channel: 'gbp', ok: false, error: 'scheduling requires the GBP Posts Scheduler capability' });
      } else if (scheduledAt) {
        const post = await prisma.gbp_posts.create({
          data: {
            id: newPostId(), tenant_id: tenantId, summary: body, topic_type: 'STANDARD',
            media_url: mediaUrl || null, status: 'SCHEDULED', scheduled_for: scheduledAt,
          },
        });
        results.push({ channel: 'gbp', ok: true, postId: post.id, scheduled: true });
      } else {
        const publish = await createPost(tenantId, {
          summary: body, topicType: 'STANDARD',
          ...(mediaUrl ? { media: [{ sourceUrl: mediaUrl, mediaFormat: 'PHOTO' as const }] } : {}),
          ...(linkUrl ? { callToAction: { actionType: 'LEARN_MORE', url: linkUrl } } : {}),
        });
        if (!publish.success) {
          results.push({ channel: 'gbp', ok: false, error: publish.error || 'GBP publish failed' });
        } else {
          const post = await prisma.gbp_posts.create({
            data: {
              id: newPostId(), tenant_id: tenantId, summary: body, topic_type: 'STANDARD',
              media_url: mediaUrl || null, status: 'PUBLISHED', published_at: new Date(),
              post_name: publish.postId || null, google_post_id: publish.postId || null,
            },
          });
          results.push({ channel: 'gbp', ok: true, postId: post.id, scheduled: false });
        }
      }
    }

    // ── Directory-entry destination (Phase 2: own surface, publishes immediately) ──
    if (destinations.place) {
      const deMod = caps?.effective?.directory_entry as { is_flexible?: boolean } | undefined;
      const entitled =
        !!deMod?.is_flexible ||
        (await permissionServiceFactory.hasFeature(tenantId, 'directory_entry_posts_on'));
      if (!entitled) {
        results.push({ channel: 'place', ok: false, error: 'directory_entry_posts_on is not enabled for this tier' });
      } else {
        const post = await prisma.tenant_place_posts.create({
          data: {
            id: newPostId(), tenant_id: tenantId, body,
            media_url: mediaUrl || null,
            status: 'PUBLISHED', published_at: new Date(),
          },
        });
        results.push({ channel: 'place', ok: true, postId: post.id, scheduled: false });
      }
    }

    // ── Meta destinations (one social_posts row per platform; scheduler publishes) ──
    for (const platform of destinations.meta ?? []) {
      const featureKey = META_FEATURE_KEY[platform];
      const moduleFlag =
        platform === 'meta_facebook' ? socialMod?.facebook_enabled
        : platform === 'meta_instagram' ? socialMod?.instagram_enabled
        : socialMod?.threads_enabled;
      const granted = !!socialMod?.enabled && (!!moduleFlag || (await permissionServiceFactory.hasFeature(tenantId, featureKey)));
      if (!granted) {
        results.push({ channel: `meta:${platform}`, ok: false, error: `${platform} posting is not enabled` });
        continue;
      }
      if (scheduledAt && !(await hasSchedulerGate())) {
        results.push({ channel: `meta:${platform}`, ok: false, error: 'scheduling requires the Social Post Scheduler capability' });
        continue;
      }
      const post = await prisma.social_posts.create({
        data: {
          id: newPostId(),
          tenant_id: tenantId,
          platform,
          body,
          link_url: linkUrl || null,
          // v1: media is GBP-only — the social adapter media shape lands with the composer media picker
          status: 'SCHEDULED',
          scheduled_for: scheduledAt ?? new Date(),
          created_by: 'tenant',
        },
      });
      results.push({ channel: `meta:${platform}`, ok: true, postId: post.id, scheduled: true });
    }

    // ── LinkedIn destination — one social_posts row per connected org page ──
    if (destinations.linkedin) {
      const granted =
        !!socialMod?.enabled &&
        (!!socialMod?.linkedin_enabled ||
          (await permissionServiceFactory.hasFeature(tenantId, 'social_posting_linkedin')));
      if (!granted) {
        results.push({ channel: 'linkedin', ok: false, error: 'linkedin posting is not enabled' });
      } else if (scheduledAt && !(await hasSchedulerGate())) {
        results.push({ channel: 'linkedin', ok: false, error: 'scheduling requires the Social Post Scheduler capability' });
      } else {
        const account = await prisma.linkedin_oauth_accounts_list.findFirst({
          where: { tenant_id: tenantId },
          include: { linkedin_surface_connections: true },
        });
        const orgs = account?.linkedin_surface_connections ?? [];
        if (!orgs.length) {
          results.push({ channel: 'linkedin', ok: false, error: 'no LinkedIn organization pages connected' });
        } else {
          for (const surface of orgs) {
            const post = await prisma.social_posts.create({
              data: {
                id: newPostId(),
                tenant_id: tenantId,
                platform: 'linkedin',
                target_ref: surface.target_ref,
                body,
                link_url: linkUrl || null,
                status: 'SCHEDULED',
                scheduled_for: scheduledAt ?? new Date(),
                created_by: 'tenant',
              },
            });
            results.push({ channel: `linkedin:${surface.display_name || surface.target_ref}`, ok: true, postId: post.id, scheduled: true });
          }
        }
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    res.status(okCount > 0 ? 200 : 502).json({
      success: okCount > 0,
      data: { results, posted: okCount, total: results.length },
    });
  } catch (error) {
    logger.error('[content-posts] POST failed', undefined, { tenantId, error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'post_create_failed', message: 'Failed to create post' });
  }
});

export default router;
