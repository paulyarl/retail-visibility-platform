import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { resolveDirectoryEntryOptions } from '../services/resolvers/DirectoryEntryOptionsResolver';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { getTierFeatures } from '../services/TierService';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { logger } from '../logger';

/**
 * Content Hub summary — one aggregate read for /t/:tenantId/content.
 *
 * Spec: docs/LocalBiz/TENANT_CONTENT_HUB_SPEC.md §6. Returns per-channel
 * state, metrics, capability, editor deep-links, and inline quick levers so
 * the hub page renders from a single fetch instead of N client requests.
 *
 * Storage stays per-channel (this endpoint only reads/statuses them); the
 * Phase-1+ composer writes into the existing gbp_posts / social_posts
 * pipelines — nothing here mutates.
 */

const router = Router();

interface QuickLever {
  key: string;         // directory-entry merchant setting key
  label: string;
  value: boolean;      // current effective state
  available: boolean;  // tier grants the underlying flag
}

interface ContentChannelCard {
  key: string;
  label: string;
  rendersOn: string[];
  state: 'empty' | 'active' | 'locked' | 'dark';
  metrics: Record<string, number>;
  detail?: string;
  freshness?: string | null;
  capability: { enabled: boolean; flexible: boolean };
  editorHref: string;
  quickLevers?: QuickLever[];
  nudge?: string;
}

// ── GET /:tenantId/content/summary ────────────────────────────────────────
router.get('/:tenantId/content/summary', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    const now = new Date();
    const [
      tenant,
      entrySettings,
      listing,
      photoCount,
      itemCount,
      flyerLive,
      flyerScheduled,
      flyerDraft,
      gbpByStatus,
      socialByStatus,
      caps,
      placePostCount,
      placeFeedEntitled,
      gbpLastPublished,
      socialLastPublished,
      placeLastPublished,
      socialByPlatformStatus,
      socialMetaLastPublished,
      socialLinkedInLastPublished,
    ] = await Promise.all([
      prisma.tenants.findUnique({ where: { id: tenantId }, select: { subscription_tier: true } }),
      prisma.tenant_directory_entry_settings.findUnique({ where: { tenant_id: tenantId } }),
      prisma.directory_listings_list.findFirst({
        where: { tenant_id: tenantId },
        select: { slug: true, is_published: true, description: true, logo_url: true },
      }),
      prisma.directory_photos.count({ where: { tenant_id: tenantId } }),
      prisma.inventory_items.count({ where: { tenant_id: tenantId } }),
      prisma.tenant_flyers.count({
        where: { tenant_id: tenantId, status: 'published', starts_at: { lte: now }, ends_at: { gt: now } },
      }),
      prisma.tenant_flyers.count({ where: { tenant_id: tenantId, status: 'scheduled' } }),
      prisma.tenant_flyers.count({ where: { tenant_id: tenantId, status: 'draft' } }),
      prisma.gbp_posts.groupBy({ by: ['status'], where: { tenant_id: tenantId }, _count: true }),
      prisma.social_posts.groupBy({ by: ['status'], where: { tenant_id: tenantId }, _count: true }),
      resolveEffectiveCapabilities(tenantId),
      prisma.tenant_place_posts.count({ where: { tenant_id: tenantId, status: 'PUBLISHED' } }),
      resolveEffectiveCapabilities(tenantId).then((c) => {
        const de = c?.effective?.directory_entry as { is_flexible?: boolean } | undefined;
        return !!de?.is_flexible || permissionServiceFactory.hasFeature(tenantId, 'directory_entry_posts_on');
      }),
      prisma.gbp_posts.aggregate({ _max: { published_at: true }, where: { tenant_id: tenantId, status: 'PUBLISHED' } }),
      prisma.social_posts.aggregate({ _max: { published_at: true }, where: { tenant_id: tenantId, status: 'PUBLISHED' } }),
      prisma.tenant_place_posts.aggregate({ _max: { published_at: true }, where: { tenant_id: tenantId, status: 'PUBLISHED' } }),
      // Platform-scoped splits — the social cards must not mislabel LinkedIn
      // activity as Meta (and vice versa).
      prisma.social_posts.groupBy({ by: ['status', 'platform'], where: { tenant_id: tenantId }, _count: true }),
      prisma.social_posts.aggregate({ _max: { published_at: true }, where: { tenant_id: tenantId, status: 'PUBLISHED', platform: { startsWith: 'meta_' } } }),
      prisma.social_posts.aggregate({ _max: { published_at: true }, where: { tenant_id: tenantId, status: 'PUBLISHED', platform: 'linkedin' } }),
    ]);

    // Phase 3 gap intelligence — staleness helpers. `freshness` is the ISO
    // stamp of the channel's last publish; nudges escalate never → stale.
    const daysSince = (d: Date | null | undefined) =>
      d ? Math.floor((now.getTime() - new Date(d).getTime()) / 86400000) : null;
    const staleNudge = (label: string, d: Date | null | undefined) => {
      const days = daysSince(d);
      return days != null && days > 45 ? `Last ${label} was ${days}d ago — fresh content tells Google the page is alive` : undefined;
    };
    const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

    // Module gates come from effective capabilities, NOT per-key hasFeature
    // checks — enterprise tiers resolve modules through their flexible keys
    // (e.g. gbp_management_flexible), which a literal feature-key lookup
    // misses. Verified against tid-sud4ky1c (enterprise): gbp_management and
    // social_posting both resolve enabled+flexible here while hasFeature()
    // returned false for every individual key.
    const gbpMod = caps?.effective?.gbp_management as { enabled?: boolean; is_flexible?: boolean } | undefined;
    const socialMod = caps?.effective?.social_posting as { enabled?: boolean; is_flexible?: boolean; linkedin_enabled?: boolean; can_post_linkedin?: boolean } | undefined;
    const gbpGranted = !!gbpMod?.enabled;
    const gbpFlexible = !!gbpMod?.is_flexible;
    const socialGranted = !!socialMod?.enabled;
    const socialFlexible = !!socialMod?.is_flexible;
    const linkedinGranted = !!socialMod?.enabled && !!socialMod?.linkedin_enabled;

    const tierKey = tenant?.subscription_tier || 'starter';
    const tierFeatureKeys = await getTierFeatures(tierKey);
    const F = Object.fromEntries(tierFeatureKeys.map((k) => [k, true]));
    const dirFlexible = !!F.directory_entry_flexible;
    const dirOpts = resolveDirectoryEntryOptions(F, entrySettings || null);
    const tierAllows = (flag: string) => dirFlexible || !!F[flag];

    // ── Directory listing card ──
    const sectionsOn = [
      dirOpts.hours_enabled, dirOpts.map_enabled, dirOpts.contact_enabled,
      dirOpts.qr_enabled, dirOpts.gallery_enabled, dirOpts.social_enabled, dirOpts.seo_enabled,
    ].filter(Boolean).length;
    const directoryRendersOn = listing?.slug ? [`/directory/${listing.slug}`] : ['/directory'];

    const channels: ContentChannelCard[] = [
      {
        key: 'directory_listing',
        label: 'Directory listing',
        rendersOn: directoryRendersOn,
        state: dirOpts.enabled ? (listing?.is_published ? 'active' : 'empty') : 'locked',
        metrics: { photos: photoCount, sectionsOn },
        detail: `${dirOpts.effective_layout} layout`,
        capability: { enabled: dirOpts.enabled, flexible: dirFlexible },
        editorHref: '/settings/directory',
        quickLevers: dirOpts.enabled
          ? [
              { key: 'hours_display', label: 'Hours', value: !!dirOpts.hours_enabled, available: tierAllows('directory_entry_hours_on') || !!F.directory_entry_hours_enabled },
              { key: 'map_display', label: 'Map', value: !!dirOpts.map_enabled, available: tierAllows('directory_entry_map_on') || !!F.directory_entry_map_enabled },
              { key: 'storefront_contact', label: 'Contact', value: !!dirOpts.contact_enabled, available: tierAllows('directory_entry_contact_on') || !!F.directory_entry_contact_enabled },
              { key: 'storefront_social_media', label: 'Social links', value: !!dirOpts.social_enabled, available: tierAllows('directory_entry_social_on') || !!F.directory_entry_social_enabled },
            ]
          : undefined,
        nudge: dirOpts.enabled && !listing?.is_published
          ? 'Publish your listing to appear on the directory'
          : !listing?.description
            ? 'Write your About — the one block of copy fully yours'
            : photoCount === 0
              ? 'Add photos — pages with photos rank higher'
              : undefined,
      },
      {
        key: 'storefront_catalog',
        label: 'Storefront & catalog',
        rendersOn: ['storefront'],
        state: itemCount > 0 ? 'active' : 'empty',
        metrics: { items: itemCount },
        capability: { enabled: true, flexible: false },
        editorHref: '/catalog',
        nudge: itemCount === 0 ? 'Add products to stock your storefront' : undefined,
      },
      {
        key: 'photos_media',
        label: 'Photos & media',
        rendersOn: directoryRendersOn,
        state: photoCount > 0 ? 'active' : 'empty',
        metrics: { photos: photoCount },
        capability: { enabled: dirOpts.gallery_enabled || dirOpts.enabled, flexible: dirFlexible },
        editorHref: '/settings/directory',
        nudge: photoCount === 0
          ? itemCount > 0
            ? 'Your catalog exists but no one has seen it — add photos'
            : 'Pages with photos rank higher and earn more clicks'
          : undefined,
      },
      (() => {
        const flyerCap = caps?.effective?.flyer as { enabled?: boolean } | null | undefined;
        const flyerEnabled = !!flyerCap?.enabled;
        const total = flyerLive + flyerScheduled + flyerDraft;
        return {
          key: 'flyers_offers',
          label: 'Flyers & offers',
          rendersOn: ['directory listing', 'storefront'],
          state: !flyerEnabled ? 'locked' : total > 0 ? 'active' : 'empty',
          metrics: { live: flyerLive, scheduled: flyerScheduled, drafts: flyerDraft },
          capability: { enabled: flyerEnabled, flexible: !!F.flyer_flexible },
          editorHref: '/settings/flyers',
          nudge: !flyerEnabled
            ? undefined
            : flyerDraft > 0 && flyerLive === 0
              ? 'You have an unpublished flyer — set it live to surface it'
              : total === 0
                ? 'Run your first flyer — it also surfaces on your listing'
                : undefined,
        } as ContentChannelCard;
      })(),
      (() => {
        const gbpPublished = gbpByStatus.find((r) => r.status === 'PUBLISHED')?._count ?? 0;
        const gbpScheduled = gbpByStatus.find((r) => r.status === 'SCHEDULED')?._count ?? 0;
        const socialPublished = socialByStatus.find((r) => r.status === 'PUBLISHED')?._count ?? 0;
        const postsTotal = gbpPublished + gbpScheduled + socialPublished + placePostCount;
        const lastPostAt = [gbpLastPublished._max.published_at, socialLastPublished._max.published_at, placeLastPublished._max.published_at]
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        return {
          key: 'posts_updates',
          label: 'Posts & updates',
          rendersOn: ['Google Business Profile', 'Meta', 'Directory listing'],
          state: postsTotal > 0 ? 'active' : 'empty',
          metrics: { published: gbpPublished + socialPublished + placePostCount, scheduled: gbpScheduled },
          freshness: iso(lastPostAt),
          capability: { enabled: gbpGranted || socialGranted || placeFeedEntitled, flexible: gbpFlexible || socialFlexible },
          editorHref: '/settings/social-commerce',
          nudge: postsTotal === 0
            ? 'A dated post is fresh content on every channel it reaches'
            : staleNudge('post', lastPostAt),
        } as ContentChannelCard;
      })(),
      (() => {
        const published = gbpByStatus.find((r) => r.status === 'PUBLISHED')?._count ?? 0;
        const scheduled = gbpByStatus.find((r) => r.status === 'SCHEDULED')?._count ?? 0;
        return {
          key: 'google_gbp',
          label: 'Google (GBP)',
          rendersOn: ['Google Business Profile'],
          state: !gbpGranted ? 'locked' : published + scheduled > 0 ? 'active' : 'empty',
          metrics: { published, scheduled },
          freshness: iso(gbpLastPublished._max.published_at),
          capability: { enabled: gbpGranted, flexible: gbpFlexible },
          editorHref: '/settings/gbp-category',
          nudge: gbpGranted ? staleNudge('GBP post', gbpLastPublished._max.published_at) : 'Unlock GBP posting and profile sync',
        } as ContentChannelCard;
      })(),
      (() => {
        const countFor = (status: string) =>
          socialByPlatformStatus
            .filter((r) => r.status === status && r.platform.startsWith('meta_'))
            .reduce((sum, r) => sum + r._count, 0);
        const published = countFor('PUBLISHED');
        const scheduled = countFor('SCHEDULED');
        return {
          key: 'social_meta',
          label: 'Social (Meta)',
          rendersOn: ['Facebook', 'Instagram', 'Threads'],
          // social_posting ships DARK until the dogfood gate passes — an
          // ungranted tenant sees "coming soon", never an error.
          state: socialGranted ? (published + scheduled > 0 ? 'active' : 'empty') : 'dark',
          metrics: { published, scheduled },
          freshness: iso(socialMetaLastPublished._max.published_at),
          capability: { enabled: socialGranted, flexible: socialFlexible },
          editorHref: '/settings/social-commerce',
          nudge: socialGranted ? staleNudge('social post', socialMetaLastPublished._max.published_at) : 'Social posting arrives after the pilot completes',
        } as ContentChannelCard;
      })(),
      (() => {
        const countFor = (status: string) =>
          socialByPlatformStatus
            .filter((r) => r.status === status && r.platform === 'linkedin')
            .reduce((sum, r) => sum + r._count, 0);
        const published = countFor('PUBLISHED');
        const scheduled = countFor('SCHEDULED');
        return {
          key: 'social_linkedin',
          label: 'Social (LinkedIn)',
          rendersOn: ['LinkedIn company page'],
          state: linkedinGranted ? (published + scheduled > 0 ? 'active' : 'empty') : 'dark',
          metrics: { published, scheduled },
          freshness: iso(socialLinkedInLastPublished._max.published_at),
          capability: { enabled: linkedinGranted, flexible: socialFlexible },
          editorHref: '/settings/social-commerce',
          nudge: linkedinGranted ? staleNudge('LinkedIn post', socialLinkedInLastPublished._max.published_at) : 'Connect a LinkedIn company page to publish here',
        } as ContentChannelCard;
      })(),
    ];

    const live = channels.filter((c) => c.state === 'active').length;
    // Header nudge priority: staleness > coverage gaps > empty-channel nudges.
    const topNudge =
      channels.find((c) => c.nudge?.includes('ago'))?.nudge ??
      (flyerDraft > 0 && flyerLive === 0 ? 'You have an unpublished flyer — set it live to surface it' : undefined) ??
      (itemCount > 0 && photoCount === 0 ? 'Your catalog exists but no one has seen it — add photos' : undefined) ??
      channels.find((c) => c.nudge)?.nudge;
    res.json({
      success: true,
      data: {
        surfaces: { live, total: channels.length },
        channels,
        meta: {
          tierKey,
          placeFeed: { enabled: placeFeedEntitled, posts: placePostCount },
          topNudge,
          about: { text: listing?.description ?? null, editable: dirOpts.enabled },
        },
      },
    });
  } catch (error) {
    logger.error('[content-summary] GET summary failed', undefined, { tenantId, error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to load content summary' });
  }
});

export default router;
