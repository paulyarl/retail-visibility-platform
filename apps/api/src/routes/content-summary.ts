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

async function hasAnyFeature(tenantId: string, keys: string[]): Promise<boolean> {
  const checks = await Promise.all(keys.map((k) => permissionServiceFactory.hasFeature(tenantId, k)));
  return checks.some(Boolean);
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
      gbpGranted,
      socialGranted,
      gbpFlexible,
      socialFlexible,
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
      hasAnyFeature(tenantId, ['gbp_management', 'gbp_management_flexible']),
      hasAnyFeature(tenantId, ['social_posting_enabled', 'social_posting_flexible', 'social_posting_meta']),
      permissionServiceFactory.hasFeature(tenantId, 'gbp_management_flexible'),
      permissionServiceFactory.hasFeature(tenantId, 'social_posting_flexible'),
    ]);

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
        nudge: dirOpts.enabled && !listing?.is_published ? 'Publish your listing to appear on the directory' : photoCount === 0 ? 'Add photos — pages with photos rank higher' : undefined,
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
        nudge: photoCount === 0 ? 'Pages with photos rank higher and earn more clicks' : undefined,
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
          nudge: flyerEnabled && total === 0 ? 'Run your first flyer — it also surfaces on your listing' : undefined,
        } as ContentChannelCard;
      })(),
      (() => {
        const gbpPublished = gbpByStatus.find((r) => r.status === 'PUBLISHED')?._count ?? 0;
        const gbpScheduled = gbpByStatus.find((r) => r.status === 'SCHEDULED')?._count ?? 0;
        const socialPublished = socialByStatus.find((r) => r.status === 'PUBLISHED')?._count ?? 0;
        const postsTotal = gbpPublished + gbpScheduled + socialPublished;
        return {
          key: 'posts_updates',
          label: 'Posts & updates',
          rendersOn: ['Google Business Profile', 'Meta'],
          state: postsTotal > 0 ? 'active' : 'empty',
          metrics: { published: gbpPublished + socialPublished, scheduled: gbpScheduled },
          capability: { enabled: gbpGranted || socialGranted, flexible: gbpFlexible || socialFlexible },
          editorHref: '/settings/social-commerce',
          nudge: postsTotal === 0 ? 'A dated post is fresh content on every channel it reaches' : undefined,
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
          capability: { enabled: gbpGranted, flexible: gbpFlexible },
          editorHref: '/settings/gbp-category',
          nudge: gbpGranted ? undefined : 'Unlock GBP posting and profile sync',
        } as ContentChannelCard;
      })(),
      (() => {
        const published = socialByStatus.find((r) => r.status === 'PUBLISHED')?._count ?? 0;
        const scheduled = socialByStatus.find((r) => r.status === 'SCHEDULED')?._count ?? 0;
        return {
          key: 'social_meta',
          label: 'Social (Meta)',
          rendersOn: ['Facebook', 'Instagram', 'Threads'],
          // social_posting ships DARK until the dogfood gate passes — an
          // ungranted tenant sees "coming soon", never an error.
          state: socialGranted ? (published + scheduled > 0 ? 'active' : 'empty') : 'dark',
          metrics: { published, scheduled },
          capability: { enabled: socialGranted, flexible: socialFlexible },
          editorHref: '/settings/social-commerce',
          nudge: socialGranted ? undefined : 'Social posting arrives after the pilot completes',
        } as ContentChannelCard;
      })(),
    ];

    const live = channels.filter((c) => c.state === 'active').length;
    res.json({
      success: true,
      data: {
        surfaces: { live, total: channels.length },
        channels,
        meta: { tierKey },
      },
    });
  } catch (error) {
    logger.error('[content-summary] GET summary failed', undefined, { tenantId, error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to load content summary' });
  }
});

export default router;
