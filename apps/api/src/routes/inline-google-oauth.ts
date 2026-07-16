import { Router } from 'express';
import { prisma } from '../prisma';
import {
  getAuthorizationUrl,
  decodeState,
  exchangeCodeForTokens,
  getUserInfo,
  encryptToken,
} from '../lib/google/oauth';
import {
  listMerchantAccounts,
  syncMerchantAccount,
  listProducts,
  getProductStats,
} from '../lib/google/gmc';
import { unifiedConfig } from '../config/unifiedConfig';
import {
  listBusinessAccounts,
  listLocations,
  getLocation,
  syncLocation,
  getAggregatedInsights,
} from '../lib/google/gbp';
import crypto from 'crypto';
import { logger } from '../logger';

const router = Router();

router.get('/google/auth', async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(400).json({ error: 'tenant_not_found' });
    }

    const businessProfileRaw = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id }
    });

    const { enhanceDatabaseResult } = require('../middleware/universal-transform');
    const businessProfile = enhanceDatabaseResult(businessProfileRaw);

    const hasProfile = businessProfile
      ? (businessProfile.businessName && businessProfile.city && businessProfile.state)
      : ((tenant.metadata as any)?.businessName && (tenant.metadata as any)?.city && (tenant.metadata as any)?.state);

    if (!hasProfile) {
      return res.status(400).json({
        error: 'incomplete_business_profile',
        message: 'Please complete your business profile before connecting to Google',
      });
    }

    const authUrl = getAuthorizationUrl(tenant_id);
    res.json({ authUrl });
  } catch (error) {
    logger.error('[Google OAuth] Auth initiation error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'oauth_init_failed' });
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('[Google OAuth] Authorization error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return res.redirect(`${unifiedConfig.webUrl}/settings/tenant?google_error=${error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'missing_code_or_state' });
    }

    const stateData = decodeState(state as string);
    if (!stateData) {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const tokens = await exchangeCodeForTokens(code as string);
    if (!tokens) {
      return res.status(500).json({ error: 'token_exchange_failed' });
    }

    const userInfo = await getUserInfo(tokens.access_token);
    if (!userInfo) {
      return res.status(500).json({ error: 'user_info_failed' });
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = encryptToken(tokens.refresh_token);

    const account = await prisma.google_oauth_accounts_list.upsert({
      where: {
        tenant_id_google_account_id: {
          tenant_id: stateData.tenantId,
          google_account_id: userInfo.id,
        },
      },
      create: {
        id: crypto.randomUUID(),
        tenant_id: stateData.tenantId,
        google_account_id: userInfo.id,
        email: userInfo.email,
        display_name: userInfo.name,
        profile_picture_url: userInfo.picture,
        scopes: tokens.scope.split(' '),
        updated_at: new Date(),
      },
      update: {
        email: userInfo.email,
        display_name: userInfo.name,
        profile_picture_url: userInfo.picture,
        scopes: tokens.scope.split(' '),
      },
    });

    console.log('[Google OAuth] Account connected:', account.email);

    res.redirect(`${unifiedConfig.webUrl}/settings/tenant?google_connected=true`);
  } catch (error) {
    logger.error('[Google OAuth] Callback error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'oauth_callback_failed' });
  }
});

// GET /api/google/status
router.get('/api/google/status', async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id || req.query.tenantId) as string;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id },
    });

    if (!account) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      email: account.email,
      display_name: account.display_name,
      profile_picture_url: account.profile_picture_url,
      scopes: account.scopes,
      merchant_links: 0,
      gbp_locations: 0,
    });
  } catch (error) {
    logger.error('[Google OAuth] Status check error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'status_check_failed' });
  }
});

// DELETE /google/disconnect
router.delete('/google/disconnect', async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id || req.query.tenantId) as string;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id },
    });

    if (!account) {
      return res.status(400).json({ error: 'account_not_found' });
    }

    await prisma.google_oauth_accounts_list.delete({
      where: { id: account.id },
    });

    console.log('[Google OAuth] Account disconnected:', account.email);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Google OAuth] Disconnect error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'disconnect_failed' });
  }
});

// GET /google/gmc/accounts
router.get('/google/gmc/accounts', async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id || req.query.tenantId) as string;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id },
    });

    if (!account) {
      return res.status(400).json({ error: 'google_account_not_found' });
    }

    const merchants = await listMerchantAccounts(account.id);
    res.json({ merchants });
  } catch (error) {
    logger.error('[GMC] List accounts error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_list_merchants' });
  }
});

// POST /google/gmc/sync
router.post('/google/gmc/sync', async (req, res) => {
  try {
    const { tenant_id, merchantId } = req.body;
    if (!tenant_id || !merchantId) {
      return res.status(400).json({ error: 'tenant_id_and_merchant_id_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id },
    });

    if (!account) {
      return res.status(400).json({ error: 'google_account_not_found' });
    }

    const success = await syncMerchantAccount(account.id, merchantId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'sync_failed' });
    }
  } catch (error) {
    logger.error('[GMC] Sync error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'sync_failed' });
  }
});

// GET /google/gmc/products
router.get('/google/gmc/products', async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id || req.query.tenantId) as string;
    const { merchantId } = req.query;
    if (!tenant_id || !merchantId) {
      return res.status(400).json({ error: 'tenant_id_and_merchant_id_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id as string },
    });

    if (!account) {
      return res.status(400).json({ error: 'google_account_not_found' });
    }

    const products = await listProducts(account.id, merchantId as string);
    res.json({ products });
  } catch (error) {
    logger.error('[GMC] List products error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_list_products' });
  }
});

// GET /google/gmc/stats
router.get('/google/gmc/stats', async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id || req.query.tenantId) as string;
    const { merchantId } = req.query;
    if (!tenant_id || !merchantId) {
      return res.status(400).json({ error: 'tenant_id_and_merchant_id_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id as string },
    });

    if (!account) {
      return res.status(400).json({ error: 'google_account_not_found' });
    }

    const stats = await getProductStats(account.id, merchantId as string);
    res.json({ stats });
  } catch (error) {
    logger.error('[GMC] Get stats error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_get_stats' });
  }
});

// GET /google/gbp/locations
router.get('/google/gbp/locations', async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id || req.query.tenantId) as string;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id },
    });

    if (!account) {
      return res.status(400).json({ error: 'google_account_not_found' });
    }

    const businessAccounts = await listBusinessAccounts(account.id);
    if (businessAccounts.length === 0) {
      return res.json({ locations: [] });
    }

    const locations = await listLocations(account.id, businessAccounts[0].name);
    res.json({ locations });
  } catch (error) {
    logger.error('[GBP] List locations error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_list_locations' });
  }
});

// POST /google/gbp/sync
router.post('/google/gbp/sync', async (req, res) => {
  try {
    const { tenant_id, locationName } = req.body;
    if (!tenant_id || !locationName) {
      return res.status(400).json({ error: 'tenant_id_and_location_name_required' });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id },
    });

    if (!account) {
      return res.status(400).json({ error: 'google_account_not_found' });
    }

    const locationData = await getLocation(account.id, locationName);
    if (!locationData) {
      return res.status(400).json({ error: 'location_not_found' });
    }

    const success = await syncLocation(account.id, locationData);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'sync_failed' });
    }
  } catch (error) {
    logger.error('[GBP] Sync error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'sync_failed' });
  }
});

// GET /google/gbp/insights
router.get('/google/gbp/insights', async (req, res) => {
  try {
    const { locationId, days } = req.query;
    if (!locationId) {
      return res.status(400).json({ error: 'location_id_required' });
    }

    const daysNum = days ? parseInt(days as string) : 30;
    const insights = await getAggregatedInsights(locationId as string, daysNum);
    res.json({ insights });
  } catch (error) {
    logger.error('[GBP] Get insights error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_get_insights' });
  }
});

// GET /api/google/taxonomy/browse
router.get('/api/google/taxonomy/browse', async (req, res) => {
  try {
    const { parent } = req.query;
    const parentPath = parent ? decodeURIComponent(parent as string) : null;

    const dbCount = await prisma.google_taxonomy_list.count();
    const useDatabase = dbCount > 0;

    let categories: any[] = [];

    if (useDatabase) {
      if (!parentPath) {
        categories = await prisma.google_taxonomy_list.findMany({
          where: { is_active: true, level: 1 },
          orderBy: { category_path: 'asc' },
          take: 50,
        });
      } else {
        const parentDepth = parentPath.split(' > ').length;
        categories = await prisma.google_taxonomy_list.findMany({
          where: {
            is_active: true,
            category_path: { startsWith: parentPath + ' > ' },
          },
          orderBy: { category_path: 'asc' },
        });
        categories = categories.filter(cat => {
          const catDepth = cat.category_path.split(' > ').length;
          return catDepth === parentDepth + 1;
        });
      }
    } else {
      const taxonomyData = require('../lib/google/taxonomy-data.json');
      const allCategories = taxonomyData.categories || [];

      if (!parentPath) {
        categories = allCategories
          .filter((cat: any) => cat.path.length === 1)
          .map((cat: any) => ({ category_id: cat.id, category_path: cat.fullPath, level: 1 }));
      } else {
        const parentDepth = parentPath.split(' > ').length;
        categories = allCategories
          .filter((cat: any) => cat.fullPath.startsWith(parentPath + ' > ') && cat.path.length === parentDepth + 1)
          .map((cat: any) => ({ category_id: cat.id, category_path: cat.fullPath, level: cat.path.length }));
      }
    }

    let categoriesWithChildInfo: any[];

    if (useDatabase) {
      categoriesWithChildInfo = await Promise.all(
        categories.map(async (cat: any) => {
          const childCount = await prisma.google_taxonomy_list.count({
            where: {
              is_active: true,
              category_path: { startsWith: cat.category_path + ' > ' },
            },
          });
          return {
            id: cat.category_id,
            name: cat.category_path.split(' > ').pop() || cat.category_path,
            path: cat.category_path.split(' > '),
            fullPath: cat.category_path,
            hasChildren: childCount > 0,
          };
        })
      );
    } else {
      const taxonomyData = require('../lib/google/taxonomy-data.json');
      const allCategories = taxonomyData.categories || [];
      categoriesWithChildInfo = categories.map((cat: any) => {
        const hasChildren = allCategories.some((c: any) => c.fullPath.startsWith(cat.category_path + ' > '));
        return {
          id: cat.category_id,
          name: cat.category_path.split(' > ').pop() || cat.category_path,
          path: cat.category_path.split(' > '),
          fullPath: cat.category_path,
          hasChildren,
        };
      });
    }

    res.json({ success: true, categories: categoriesWithChildInfo });
  } catch (error) {
    logger.error('[Google Taxonomy Browse] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Browse failed' });
  }
});

// GET /api/google/taxonomy/search
router.get('/api/google/taxonomy/search', async (req, res) => {
  try {
    const { q: query, limit = '20' } = req.query;

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const searchQuery = query.trim().toLowerCase();
    const maxResults = parseInt(limit as string, 10);

    const categories = await prisma.google_taxonomy_list.findMany({
      where: {
        is_active: true,
        OR: [
          { category_path: { contains: query, mode: 'insensitive' } },
          { category_id: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: maxResults * 5,
      orderBy: { category_path: 'asc' },
    });

    const scoredResults = categories.map(cat => {
      const path = cat.category_path;
      const leafName = path.split(' > ').pop()?.toLowerCase() || '';
      const pathLower = path.toLowerCase();
      let score = 0;

      if (leafName === searchQuery) { score += 1000; }
      else if (leafName.startsWith(searchQuery)) { score += 500; }
      else if (new RegExp(`\\b${searchQuery}\\b`, 'i').test(leafName)) { score += 300; }
      else if (leafName.includes(searchQuery)) { score += 100; }

      const depth = path.split(' > ').length;
      score += Math.max(0, 50 - depth * 5);

      if (pathLower.includes(searchQuery) && !leafName.includes(searchQuery)) { score += 20; }

      return { id: cat.category_id, name: path.split(' > ').pop() || path, path: path.split(' > '), fullPath: path, score };
    });

    scoredResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.fullPath.localeCompare(b.fullPath);
    });

    const results = scoredResults.slice(0, maxResults).map(({ score, ...rest }) => rest);

    res.json({ success: true, categories: results });
  } catch (error) {
    logger.error('[Google Taxonomy Search] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
