/**
 * social-customer.ts — customer portal routes for the Social Posting Suite.
 *
 * Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §7
 * Mounted at /api/customer/marketing/social — same auth stack as gbp-customer.
 *
 *   GET  /status                    — platform profile: per-surface state
 *   GET  /meta/surfaces             — resolvable surfaces for the picker
 *   POST /meta/select-surface       — persist page/IG surface connection
 *   GET  /meta/threads/authorize    — redirect into the Threads OAuth leg
 *   GET  /meta/threads/callback     — Threads token exchange → surface row
 *   DELETE /meta/surfaces/:id       — disconnect a single surface
 *   GET  /posts                     — list posts
 *   POST /posts                     — create (immediate publish or schedule)
 *   DELETE /posts/:id               — cancel scheduled / best-effort remote delete
 *   POST /posts/suggest             — dual-pattern AI copy (renderOnly | resolve)
 *   POST /media/upload              — public-bucket media upload
 *   GET  /media                     — list uploaded post media
 *   GET  /settings                  — merchant soft-gate settings
 *   PUT  /settings                  — update merchant toggles (invalidate caps)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { logger } from '../logger';
import { prisma } from '../prisma';
import { CustomerGBPAccessService } from '../services/CustomerGBPAccessService';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { requireCustomerAuth, requirePlatformContext } from '../middleware/customer-auth';
import { getSocialAdapter } from '../lib/social/registry';
import { buildSocialPostSuggestPrompt, SOCIAL_POST_SUGGEST_SYSTEM } from '../lib/social/social-post-suggest';
import { decryptToken, encryptToken, getBusinessAccounts, META_POSTING_SCOPES } from '../lib/meta/oauth';
import {
  getThreadsAuthorizationUrl,
  exchangeThreadsCode,
  getThreadsLongLivedToken,
  getThreadsProfile,
  THREADS_SCOPES,
} from '../lib/social/threads-oauth';
import { generateQuickStart } from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import type { SocialPlatform } from '../lib/social/types';

const router = Router();
const customerGbpAccessService = CustomerGBPAccessService.getInstance();

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const PLATFORM_SURFACE_KEY: Partial<Record<SocialPlatform, string>> = {
  meta_facebook: 'social_posting_meta',
  meta_instagram: 'social_posting_instagram',
  meta_threads: 'social_posting_threads',
};

async function resolveTenant(req: Request): Promise<{ tenantId: string }> {
  const customerId = (req as any).customerId as string;
  return customerGbpAccessService.resolveTenant(customerId);
}

// ── /status — platform profile ───────────────────────────────────────────

router.get('/status', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);

    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        meta_oauth_tokens_list: true,
        meta_surface_connections: true,
      },
    });

    const tokenScopes = account?.meta_oauth_tokens_list?.scopes ?? [];
    const scopesMissing = META_POSTING_SCOPES.filter((s) => !tokenScopes.includes(s));

    const surfaces: Record<string, any> = {};
    for (const c of account?.meta_surface_connections ?? []) {
      surfaces[c.surface] = {
        id: c.id,
        targetRef: c.target_ref,
        displayName: c.display_name,
        connectedAt: c.connected_at,
        tokenExpired: c.token_expires_at ? c.token_expires_at <= new Date() : false,
      };
    }

    res.json({
      success: true,
      data: {
        meta: {
          connected: !!account,
          reauthorizationRequired: account?.reauthorization_required || scopesMissing.length > 0,
          scopesGranted: tokenScopes,
          scopesMissing,
          surfaces,
        },
      },
    });
  } catch (error: any) {
    logger.error('[social-customer] GET /status error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'status_failed', message: 'Failed to load status' });
  }
});

// ── /meta/surfaces — what can be connected ───────────────────────────────

router.get('/meta/surfaces', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: { meta_oauth_tokens_list: true, meta_surface_connections: true },
    });
    if (!account?.meta_oauth_tokens_list) {
      return res.json({ success: true, data: { pages: [], threads: { authorized: false }, surfaces: [] } });
    }

    const token = decryptToken(account.meta_oauth_tokens_list.access_token_encrypted);
    const businesses = await getBusinessAccounts(token);

    const pages = (businesses?.data ?? []).map((p) => ({
      pageId: p.id,
      name: p.name,
      instagramAccountId: p.instagram_business_account?.id ?? null,
      instagramUsername: p.instagram_business_account?.username ?? null,
    }));

    res.json({
      success: true,
      data: {
        pages,
        threads: { authorized: account.meta_surface_connections.some((c) => c.surface === 'threads') },
        surfaces: account.meta_surface_connections.map((c) => ({
          id: c.id, surface: c.surface, targetRef: c.target_ref, displayName: c.display_name,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[social-customer] GET /meta/surfaces error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'surfaces_failed', message: 'Failed to list surfaces' });
  }
});

// ── /meta/select-surface — persist a facebook_page or instagram surface ──

const selectSurfaceSchema = z.object({
  surface: z.enum(['facebook_page', 'instagram']),
  pageId: z.string().min(1),
});

router.post('/meta/select-surface', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const parsed = selectSurfaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { surface, pageId } = parsed.data;
    const { tenantId } = await resolveTenant(req);

    const featureKey = surface === 'facebook_page' ? 'social_posting_meta' : 'social_posting_instagram';
    if (!(await permissionServiceFactory.hasFeature(tenantId, featureKey))) {
      return res.status(403).json({ success: false, error: 'entitlement_required', message: `${featureKey} is not enabled for this tenant` });
    }

    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: { meta_oauth_tokens_list: true },
    });
    if (!account?.meta_oauth_tokens_list) {
      return res.status(400).json({ success: false, error: 'not_connected', message: 'Connect Meta first' });
    }

    const userToken = decryptToken(account.meta_oauth_tokens_list.access_token_encrypted);

    if (surface === 'facebook_page') {
      // Fetch the Page-scoped token from /me/accounts — never expires when
      // derived from a long-lived user token.
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`
      );
      const pages = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string }> };
      const page = (pages.data ?? []).find((p) => p.id === pageId);
      if (!page) {
        return res.status(404).json({ success: false, error: 'page_not_found', message: 'Page not found or not admin of it' });
      }

      const row = await prisma.meta_surface_connections.upsert({
        where: {
          meta_oauth_account_id_surface_target_ref: {
            meta_oauth_account_id: account.id,
            surface: 'facebook_page',
            target_ref: page.id,
          },
        },
        create: {
          id: generateQuickStart('msurf'),
          meta_oauth_account_id: account.id,
          surface: 'facebook_page',
          target_ref: page.id,
          display_name: page.name,
          access_token_enc: encryptToken(page.access_token),
          scopes: ['pages_manage_posts', 'publish_video'],
        },
        update: {
          display_name: page.name,
          access_token_enc: encryptToken(page.access_token),
          updated_at: new Date(),
        },
      });
      return res.json({ success: true, data: { surface: row } });
    }

    // instagram — the IG business account hangs off the selected Page
    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`
    );
    const igData = await igRes.json() as { instagram_business_account?: { id: string; username?: string } };
    const ig = igData.instagram_business_account;
    if (!ig) {
      return res.status(404).json({ success: false, error: 'no_ig_linked', message: 'No Instagram business account linked to that Page' });
    }

    const row = await prisma.meta_surface_connections.upsert({
      where: {
        meta_oauth_account_id_surface_target_ref: {
          meta_oauth_account_id: account.id,
          surface: 'instagram',
          target_ref: ig.id,
        },
      },
      create: {
        id: generateQuickStart('msurf'),
        meta_oauth_account_id: account.id,
        surface: 'instagram',
        target_ref: ig.id,
        display_name: ig.username ? `@${ig.username}` : ig.id,
        // IG Graph calls ride the Page token
        access_token_enc: encryptToken((await (await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=access_token&access_token=${encodeURIComponent(userToken)}`)).json() as any)?.data?.find?.((p: any) => p.id === pageId)?.access_token || userToken),
        scopes: ['instagram_content_publish'],
      },
      update: { updated_at: new Date() },
    });
    return res.json({ success: true, data: { surface: row } });
  } catch (error: any) {
    logger.error('[social-customer] POST /meta/select-surface error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'select_failed', message: 'Failed to connect surface' });
  }
});

// ── Threads OAuth leg ────────────────────────────────────────────────────

router.get('/meta/threads/authorize', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const state = Buffer.from(JSON.stringify({ tenantId, ts: Date.now() })).toString('base64url');
    res.json({ success: true, data: { url: getThreadsAuthorizationUrl(state) } });
  } catch (error: any) {
    logger.error('[social-customer] GET /meta/threads/authorize error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'authorize_failed', message: 'Failed to build Threads auth URL' });
  }
});

router.get('/meta/threads/callback', async (req: Request, res: Response) => {
  const fail = (msg: string) => res.redirect(`${unifiedConfig.webUrl}/settings/integrations/social?error=${encodeURIComponent(msg)}`);
  try {
    const { code, state } = req.query;
    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') return fail('missing_params');
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
    const tenantId = parsed.tenantId as string;
    if (!tenantId) return fail('bad_state');

    const account = await prisma.meta_oauth_accounts_list.findFirst({ where: { tenant_id: tenantId } });
    if (!account) return fail('meta_not_connected');

    const short = await exchangeThreadsCode(code);
    if (!short) return fail('exchange_failed');
    const long = await getThreadsLongLivedToken(short.access_token);
    const token = long?.access_token ?? short.access_token;
    const expiresIn = long?.expires_in ?? 3600;
    const profile = await getThreadsProfile(token);
    if (!profile) return fail('profile_fetch_failed');

    await prisma.meta_surface_connections.upsert({
      where: {
        meta_oauth_account_id_surface_target_ref: {
          meta_oauth_account_id: account.id,
          surface: 'threads',
          target_ref: profile.id,
        },
      },
      create: {
        id: generateQuickStart('msurf'),
        meta_oauth_account_id: account.id,
        surface: 'threads',
        target_ref: profile.id,
        display_name: profile.username ? `@${profile.username}` : profile.id,
        access_token_enc: encryptToken(token),
        token_expires_at: new Date(Date.now() + expiresIn * 1000),
        scopes: THREADS_SCOPES,
      },
      update: {
        display_name: profile.username ? `@${profile.username}` : profile.id,
        access_token_enc: encryptToken(token),
        token_expires_at: new Date(Date.now() + expiresIn * 1000),
        updated_at: new Date(),
      },
    });

    res.redirect(`${unifiedConfig.webUrl}/settings/integrations/social?connected=threads`);
  } catch (error: any) {
    logger.error('[social-customer] threads callback error', undefined, { error: error.message });
    fail('callback_failed');
  }
});

// ── DELETE /meta/surfaces/:id — disconnect one surface ───────────────────

router.delete('/meta/surfaces/:id', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const row = await prisma.meta_surface_connections.findFirst({
      where: { id: req.params.id, meta_oauth_accounts_list: { tenant_id: tenantId } },
    });
    if (!row) return res.status(404).json({ success: false, error: 'not_found' });
    await prisma.meta_surface_connections.delete({ where: { id: row.id } });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[social-customer] DELETE surface error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'delete_failed' });
  }
});

// ── /posts — list + create + delete ─────────────────────────────────────

router.get('/posts', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const { platform, status } = req.query;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize || '20'), 10)));

    const where: any = { tenant_id: tenantId };
    if (platform) where.platform = String(platform);
    if (status) where.status = String(status).toUpperCase();

    const [posts, total] = await Promise.all([
      prisma.social_posts.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.social_posts.count({ where }),
    ]);
    res.json({ success: true, data: { posts, total, page, pageSize } });
  } catch (error: any) {
    logger.error('[social-customer] GET /posts error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'posts_list_failed' });
  }
});

const createPostSchema = z.object({
  platform: z.enum(['meta_facebook', 'meta_instagram', 'meta_threads']),
  targetRef: z.string().optional(),
  body: z.string().min(1).max(63206),
  linkUrl: z.string().url().optional(),
  media: z.array(z.object({
    social_media_id: z.string().optional(),
    url: z.string().url(),
    type: z.enum(['photo', 'video']),
    alt: z.string().optional(),
  })).optional(),
  scheduledFor: z.string().datetime().optional(),
  recurrence: z.object({
    freq: z.enum(['weekly', 'monthly']),
    remaining: z.number().int().positive().optional(),
  }).optional(),
  platformPayload: z.record(z.string(), z.unknown()).optional(),
});

router.post('/posts', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', details: parsed.error.flatten() });
    }
    const data = parsed.data;
    const { tenantId } = await resolveTenant(req);

    // Per-platform entitlement
    const featureKey = PLATFORM_SURFACE_KEY[data.platform];
    if (featureKey && !(await permissionServiceFactory.hasFeature(tenantId, featureKey))) {
      return res.status(403).json({ success: false, error: 'entitlement_required', message: `${data.platform} posting is not enabled` });
    }

    // Scheduling is the premium key — immediate publish rides the module
    if (data.scheduledFor) {
      const entitled = await permissionServiceFactory.hasFeature(tenantId, 'social_posting_scheduler');
      if (!entitled) {
        return res.status(403).json({ success: false, error: 'scheduler_entitlement_required', message: 'Scheduled posting requires the scheduler capability' });
      }
    }

    const adapter = getSocialAdapter(data.platform);
    if (!adapter) return res.status(400).json({ success: false, error: 'unsupported_platform' });

    const lint = adapter.validateDraft({
      tenantId, platform: data.platform, targetRef: data.targetRef ?? null,
      body: data.body, linkUrl: data.linkUrl ?? null, media: data.media, platformPayload: data.platformPayload,
    });
    if (lint.length) {
      return res.status(422).json({ success: false, error: 'draft_invalid', details: lint });
    }

    if (data.scheduledFor) {
      const post = await prisma.social_posts.create({
        data: {
          id: generateQuickStart('spost'),
          tenant_id: tenantId,
          platform: data.platform,
          target_ref: data.targetRef ?? null,
          body: data.body,
          link_url: data.linkUrl ?? null,
          media: data.media ?? undefined,
          platform_payload: (data.platformPayload ?? undefined) as any,
          status: 'SCHEDULED',
          scheduled_for: new Date(data.scheduledFor),
          recurrence: data.recurrence ?? undefined,
        },
      });
      return res.json({ success: true, data: { post } });
    }

    // Immediate publish — row is the record of truth
    const post = await prisma.social_posts.create({
      data: {
        id: generateQuickStart('spost'),
        tenant_id: tenantId,
        platform: data.platform,
        target_ref: data.targetRef ?? null,
        body: data.body,
        link_url: data.linkUrl ?? null,
        media: data.media ?? undefined,
        platform_payload: (data.platformPayload ?? undefined) as any,
        status: 'PUBLISHING',
        publishing_started_at: new Date(),
      },
    });

    const result = await adapter.publish(tenantId, {
      tenantId, platform: data.platform, targetRef: data.targetRef ?? null,
      body: data.body, linkUrl: data.linkUrl ?? null, media: data.media, platformPayload: data.platformPayload,
    });

    const updated = await prisma.social_posts.update({
      where: { id: post.id },
      data: result.success
        ? { status: 'PUBLISHED', published_at: new Date(), publishing_started_at: null, remote_post_id: result.remoteId ?? null, permalink: result.permalink ?? null }
        : { status: 'FAILED', publishing_started_at: null, attempts: 1, last_error: result.error ?? 'publish_failed' },
    });

    if (!result.success) {
      return res.status(502).json({ success: false, error: 'publish_failed', message: result.error, data: { post: updated } });
    }
    res.json({ success: true, data: { post: updated } });
  } catch (error: any) {
    logger.error('[social-customer] POST /posts error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'post_create_failed' });
  }
});

router.delete('/posts/:id', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const post = await prisma.social_posts.findFirst({ where: { id: req.params.id, tenant_id: tenantId } });
    if (!post) return res.status(404).json({ success: false, error: 'not_found' });

    if (post.status === 'SCHEDULED' || post.status === 'DRAFT') {
      await prisma.social_posts.update({ where: { id: post.id }, data: { status: 'CANCELED', updated_at: new Date() } });
      return res.json({ success: true });
    }

    // Published — best-effort remote delete where the adapter supports it
    const adapter = getSocialAdapter(post.platform);
    if (post.remote_post_id && adapter?.delete) {
      await adapter.delete(tenantId, post.remote_post_id, post.target_ref ?? '');
    }
    await prisma.social_posts.delete({ where: { id: post.id } });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[social-customer] DELETE /posts error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'delete_failed' });
  }
});

// ── /posts/suggest — dual-pattern AI copy ────────────────────────────────

const suggestSchema = z.object({
  platform: z.enum(['meta_facebook', 'meta_instagram', 'meta_threads']),
  photoDescription: z.string().optional().nullable(),
  tone: z.enum(['friendly', 'professional', 'playful', 'urgent', 'informative']).optional(),
  theme: z.enum(['problem_solution', 'announcement', 'offer', 'tip', 'seasonal', 'feature_highlight']).optional(),
  topic: z.string().optional().nullable(),
  linkUrl: z.string().url().optional().nullable(),
  renderOnly: z.boolean().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

router.post('/posts/suggest', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const parsed = suggestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', details: parsed.error.flatten() });
    }
    const data = parsed.data;
    const { tenantId } = await resolveTenant(req);

    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId }, select: { name: true, business_type: true } });

    const prompt = buildSocialPostSuggestPrompt({
      platform: data.platform,
      businessName: (tenant as any)?.name || 'your business',
      category: (tenant as any)?.business_type || 'local business',
      photoDescription: data.photoDescription,
      tone: data.tone,
      theme: data.theme,
      topic: data.topic,
      linkUrl: data.linkUrl,
    });

    // Dual pattern (mirrors GBP suggest + marketing-ops briefings)
    if (data.renderOnly) {
      return res.json({ success: true, data: { prompt, system: SOCIAL_POST_SUGGEST_SYSTEM } });
    }

    const { default: aiProviderFactory } = await import('../services/ai-providers');
    const temp = typeof data.temperature === 'number' ? data.temperature : 0.7;
    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        { role: 'system', content: SOCIAL_POST_SUGGEST_SYSTEM },
        { role: 'user', content: prompt },
      ],
      maxTokens: 400,
      temperature: temp,
    });

    res.json({ success: true, data: { text: result?.content?.trim() || '' } });
  } catch (error: any) {
    logger.error('[social-customer] POST /posts/suggest error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'suggest_failed' });
  }
});

// ── /media — public-bucket upload + list ─────────────────────────────────

router.post('/media/upload', requireCustomerAuth, requirePlatformContext, mediaUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'file_required' });

    const { createClient } = await import('@supabase/supabase-js');
    const { StorageBuckets } = await import('../storage-config');
    const supabaseUrl = unifiedConfig.supabaseUrl;
    const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: 'storage_not_configured' });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const mediaId = generateQuickStart('smed');
    const ext = (file.originalname?.split('.').pop() || 'bin').toLowerCase();
    const path = `${tenantId}/social/${mediaId}.${ext}`;

    const { error } = await supabase.storage
      .from(StorageBuckets.TENANTS.name)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) {
      return res.status(502).json({ success: false, error: 'upload_failed', message: error.message });
    }

    const pub = supabase.storage.from(StorageBuckets.TENANTS.name).getPublicUrl(path);
    const row = await prisma.social_media.create({
      data: {
        id: mediaId,
        tenant_id: tenantId,
        storage_path: path,
        public_url: pub.data.publicUrl,
        mime_type: file.mimetype,
        bytes: file.size,
      },
    });
    res.json({ success: true, data: { media: row } });
  } catch (error: any) {
    logger.error('[social-customer] media upload error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'upload_failed' });
  }
});

router.get('/media', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const media = await prisma.social_media.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: { media } });
  } catch (error: any) {
    logger.error('[social-customer] GET /media error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'media_list_failed' });
  }
});

// ── /settings — merchant soft gate ───────────────────────────────────────

const settingsSchema = z.object({
  social_posting_enabled: z.boolean().optional(),
  social_posting_meta_on: z.boolean().optional(),
  social_posting_ig_on: z.boolean().optional(),
  social_posting_threads_on: z.boolean().optional(),
  default_publish_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

router.get('/settings', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const { tenantId } = await resolveTenant(req);
    const settings = await prisma.tenant_social_posting_settings.findUnique({ where: { tenant_id: tenantId } });
    res.json({
      success: true,
      data: settings ?? {
        social_posting_enabled: true,
        social_posting_meta_on: true,
        social_posting_ig_on: true,
        social_posting_threads_on: true,
        default_publish_time: null,
      },
    });
  } catch (error: any) {
    logger.error('[social-customer] GET /settings error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'settings_failed' });
  }
});

router.put('/settings', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { tenantId } = await resolveTenant(req);

    const settings = await prisma.tenant_social_posting_settings.upsert({
      where: { tenant_id: tenantId },
      create: {
        id: generateQuickStart('tsps'),
        tenant_id: tenantId,
        ...parsed.data,
      },
      update: { ...parsed.data, updated_at: new Date() },
    });

    // Per add-capability-feature: settings PUT must invalidate the cache
    invalidateEffectiveCapabilities(tenantId);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('[social-customer] PUT /settings error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'settings_update_failed' });
  }
});

export default router;
