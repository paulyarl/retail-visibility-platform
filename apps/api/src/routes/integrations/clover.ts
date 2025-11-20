/**
 * Clover POS Integration API Routes
 * 
 * Handles demo mode, OAuth flow, and production sync for Clover POS integration
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { getDemoItems, convertDemoItemToRVPFormat } from '../../services/clover-demo-emulator';
import {
  generateAuthorizationUrl,
  decodeState,
  exchangeCodeForToken,
  encryptToken,
  calculateTokenExpiration,
  formatScopesForDisplay
} from '../../services/clover-oauth';

const router = Router();

/**
 * Enable demo mode for a tenant
 * Creates a CloverIntegration record and imports demo items
 */
router.post('/:tenantId/clover/demo/enable', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const hasAccess = tenant.users.some((ut: any) => ut.user_id === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Check if integration already exists
    let integration = await prisma.clover_integrations.findUnique({
      where: { tenantId }
    });

    if (integration) {
      // If already in demo mode, just refresh the timestamp
      if (integration.mode === 'demo') {
        integration = await prisma.clover_integrations.update({
          where: { id: integration.id },
          data: {
            demoLastActiveAt: new Date(),
            status: 'active'
          }
        });
        return res.json({
          message: 'Demo mode already enabled',
          integration
        });
      }

      // If in production mode, cannot switch back to demo
      return res.status(400).json({
        error: 'already_in_production',
        message: 'Cannot enable demo mode after migrating to production'
      });
    }

    // Create new integration in demo mode
    integration = await prisma.clover_integrations.create({
      data: {
        tenantId,
        mode: 'demo',
        status: 'active',
        demoEnabledAt: new Date(),
        demoLastActiveAt: new Date()
      }
    });

    // Import demo items into inventory
    const demoItems = getDemoItems();
    const importedItems = [];

    for (const demoItem of demoItems) {
      const rvpItem = convertDemoItemToRVPFormat(demoItem);
      
      try {
        // Check if item with this SKU already exists
        const existingItem = await prisma.inventory_item.findFirst({
          where: {
            tenantId,
            sku: rvpItem.sku
          }
        });

        if (existingItem) {
          // Skip if already exists (user might have manually created it)
          continue;
        }

        // Create inventory item
        const createdItem = await prisma.inventory_item.create({
          data: {
            tenantId,
            ...rvpItem
          }
        });

        // Create mapping
        await prisma.clover_item_mappings.create({
          data: {
            integrationId: integration.id,
            cloverItemId: demoItem.id,
            cloverItemName: demoItem.name,
            cloverSku: demoItem.sku,
            rvpItemId: createdItem.id,
            rvpSku: createdItem.sku,
            mappingStatus: 'mapped',
            lastSyncedAt: new Date(),
            lastSyncStatus: 'success'
          }
        });

        importedItems.push(createdItem);
      } catch (error) {
        console.error(`Failed to import demo item ${demoItem.sku}:`, error);
        // Continue with other items
      }
    }

    // Create sync log
    await prisma.clover_sync_logs.create({
      data: {
        integrationId: integration.id,
        traceId: `demo_import_${Date.now()}`,
        operation: 'import',
        status: 'success',
        itemsProcessed: demoItems.length,
        itemsSucceeded: importedItems.length,
        itemsFailed: demoItems.length - importedItems.length,
        durationMs: 0, // Calculated later if needed
        completed_at: new Date()
      }
    });

    return res.json({
      message: 'Demo mode enabled successfully',
      integration,
      itemsImported: importedItems.length,
      totalDemoItems: demoItems.length
    });

  } catch (error: any) {
    console.error('[POST /integrations/:tenantId/clover/demo/enable] Error:', error);
    return res.status(500).json({
      error: 'failed_to_enable_demo',
      message: error.message
    });
  }
});

/**
 * Disable demo mode for a tenant
 * Removes demo items and deactivates integration
 */
router.post('/:tenantId/clover/demo/disable', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { keepItems = false } = req.body; // Option to keep demo items
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const hasAccess = tenant.users.some((ut: any) => ut.user_id === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Find integration
    const integration = await prisma.clover_integrations.findUnique({
      where: { tenantId },
      include: { itemMappings: true }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    if (integration.mode !== 'demo') {
      return res.status(400).json({
        error: 'not_in_demo_mode',
        message: 'Can only disable demo mode when integration is in demo mode'
      });
    }

    let deletedItemsCount = 0;

    // Delete demo items unless user wants to keep them
    if (!keepItems) {
      for (const mapping of integration.itemMappings) {
        if (mapping.rvpItemId) {
          try {
            await prisma.inventory_item.delete({
              where: { id: mapping.rvpItemId }
            });
            deletedItemsCount++;
          } catch (error) {
            console.error(`Failed to delete item ${mapping.rvpItemId}:`, error);
          }
        }
      }
    }

    // Delete integration (cascades to mappings, logs, snapshots)
    await prisma.clover_integrations.delete({
      where: { id: integration.id }
    });

    return res.json({
      message: 'Demo mode disabled successfully',
      itemsDeleted: deletedItemsCount,
      itemsKept: keepItems ? integration.itemMappings.length : 0
    });

  } catch (error: any) {
    console.error('[POST /integrations/:tenantId/clover/demo/disable] Error:', error);
    return res.status(500).json({
      error: 'failed_to_disable_demo',
      message: error.message
    });
  }
});

/**
 * Get Clover integration status for a tenant
 */
router.get('/:tenantId/clover/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const hasAccess = tenant.users.some((ut: any) => ut.user_id === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Find integration
    const integration = await prisma.clover_integrations.findUnique({
      where: { tenantId },
      include: {
        itemMappings: {
          take: 10, // Limit to recent mappings
          orderBy: { updated_at: 'desc' }
        },
        syncLogs: {
          take: 5, // Last 5 sync logs
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!integration) {
      return res.json({
        enabled: false,
        mode: null,
        status: null
      });
    }

    // Calculate stats
    const totalMappings = await prisma.clover_item_mappings.count({
      where: { integrationId: integration.id }
    });

    const mappedCount = await prisma.clover_item_mappings.count({
      where: {
        integrationId: integration.id,
        mappingStatus: 'mapped'
      }
    });

    const conflictCount = await prisma.clover_item_mappings.count({
      where: {
        integrationId: integration.id,
        mappingStatus: 'conflict'
      }
    });

    return res.json({
      enabled: true,
      mode: integration.mode,
      status: integration.status,
      merchantId: integration.merchantId,
      demoEnabledAt: integration.demoEnabledAt,
      demoLastActiveAt: integration.demoLastActiveAt,
      productionEnabledAt: integration.productionEnabledAt,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      stats: {
        totalItems: totalMappings,
        mappedItems: mappedCount,
        conflictItems: conflictCount
      },
      recentMappings: integration.itemMappings,
      recentSyncs: integration.syncLogs
    });

  } catch (error: any) {
    console.error('[GET /integrations/:tenantId/clover/status] Error:', error);
    return res.status(500).json({
      error: 'failed_to_get_status',
      message: error.message
    });
  }
});

/**
 * Get OAuth authorization URL
 * Initiates the OAuth flow by generating the Clover authorization URL
 */
router.get('/:tenantId/clover/oauth/authorize', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const hasAccess = tenant.users.some((ut: any) => ut.user_id === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Check if already in production mode
    const integration = await prisma.clover_integrations.findUnique({
      where: { tenantId }
    });

    if (integration && integration.mode === 'production') {
      return res.status(400).json({
        error: 'already_connected',
        message: 'Clover account already connected'
      });
    }

    // Generate authorization URL
    const authUrl = generateAuthorizationUrl(tenantId);
    
    // Return URL and scope information
    return res.json({
      authorizationUrl: authUrl,
      scopes: formatScopesForDisplay(),
      message: 'Redirect user to authorizationUrl to begin OAuth flow'
    });

  } catch (error: any) {
    console.error('[GET /integrations/:tenantId/clover/oauth/authorize] Error:', error);
    return res.status(500).json({
      error: 'failed_to_generate_auth_url',
      message: error.message
    });
  }
});

/**
 * OAuth callback handler
 * Receives authorization code from Clover and exchanges it for access token
 */
router.get('/clover/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Check for OAuth errors
    if (oauthError) {
      console.error('[OAuth Callback] OAuth error:', oauthError);
      return res.redirect(`/settings/integrations?error=oauth_denied&message=${oauthError}`);
    }

    if (!code || !state) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Missing code or state parameter'
      });
    }

    // Decode state to get tenant ID
    const stateData = decodeState(state as string);
    const { tenantId } = stateData;

    // Verify state timestamp (prevent replay attacks)
    const stateAge = Date.now() - stateData.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    if (stateAge > maxAge) {
      return res.redirect(`/t/${tenantId}/settings/integrations?error=state_expired`);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code as string);

    // Encrypt tokens for storage
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token 
      ? encryptToken(tokenData.refresh_token)
      : null;

    // Calculate token expiration
    const tokenExpiresAt = tokenData.expires_in
      ? calculateTokenExpiration(tokenData.expires_in)
      : null;

    // Find or create integration
    let integration = await prisma.clover_integrations.findUnique({
      where: { tenantId }
    });

    if (integration) {
      // Update existing integration to production mode
      integration = await prisma.clover_integrations.update({
        where: { id: integration.id },
        data: {
          mode: 'production',
          status: 'active',
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          merchantId: tokenData.merchant_id,
          productionEnabledAt: new Date()
        }
      });
    } else {
      // Create new integration in production mode
      integration = await prisma.clover_integrations.create({
        data: {
          tenantId,
          mode: 'production',
          status: 'active',
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          merchantId: tokenData.merchant_id,
          productionEnabledAt: new Date()
        }
      });
    }

    // Create sync log for OAuth connection
    await prisma.clover_sync_logs.create({
      data: {
        integrationId: integration.id,
        traceId: `oauth_connect_${Date.now()}`,
        operation: 'import',
        status: 'started',
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0
      }
    });

    // Redirect back to integrations page with success message
    return res.redirect(`/t/${tenantId}/settings/integrations?success=connected`);

  } catch (error: any) {
    console.error('[OAuth Callback] Error:', error);
    // Try to redirect with error, fallback to error page
    const tenantId = req.query.state ? decodeState(req.query.state as string).tenant_id : null;
    if (tenantId) {
      return res.redirect(`/t/${tenantId}/settings/integrations?error=connection_failed&message=${encodeURIComponent(error.message)}`);
    }
    return res.status(500).json({
      error: 'oauth_callback_failed',
      message: error.message
    });
  }
});

export default router;
