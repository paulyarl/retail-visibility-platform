/**
 * Clover POS Integration API Routes
 * 
 * Handles demo mode, OAuth flow, and production sync for Clover POS integration
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { 
  getDemoItems,
  getDemoItem,
  convertDemoItemToRVPFormat,
  getAvailableScenarios,
  generateSimulationEvent,
  SimulationScenario,
  SimulationEvent,
  CONFLICT_DEMO_ITEMS
} from '../../services/clover-demo-emulator';
import {
  generateAuthorizationUrl,
  decodeState,
  exchangeCodeForToken,
  encryptToken,
  calculateTokenExpiration,
  formatScopesForDisplay
} from '../../services/clover-oauth';
import { generateCloverCatId, generateCloverIntegrationId, generateCloverItemId, generateCloverItemMappingsId, generateCloverOauthChangeLogId, generateCloverSyncLogId } from '../../lib/id-generator';
 

// Helper to create slug from category name
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const userId = user.userId || user.id;
    const hasAccess = tenant.user_tenants.some((ut: any) => ut.user_id === userId);
    const isPlatformUser = user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT' || user.role === 'ADMIN';
    if (!hasAccess && !isPlatformUser) {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Check if integration already exists
    let integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (integration) {
      // If already in demo mode, just refresh the timestamp
      if (integration.mode === 'demo') {
        integration = await prisma.clover_integrations_list.update({
          where: { id: integration.id },
          data: {
            demo_last_active_at: new Date(),
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
    integration = await prisma.clover_integrations_list.create({
      data: { 
        id: generateCloverIntegrationId(),
        tenant_id: tenantId,
        mode: 'demo',
        status: 'active',
        demo_enabled_at: new Date(),
        demo_last_active_at: new Date(),
        updated_at: new Date()
      } as any
    });

    // Import demo items into inventory
    const demoItems = getDemoItems();
    const importedItems = [];

    // First, create tenant-specific categories for demo items
    const categoryMap = new Map<string, string>(); // Maps category name to directory_category ID
    const uniqueCategories = [...new Set(demoItems.map(item => item.category))];
    
    for (const categoryName of uniqueCategories) {
      const slug = slugify(categoryName);
      
      // Check if category already exists for this tenant
      let existingCategory = await prisma.directory_category.findFirst({
        where: {
          tenantId: tenantId,
          slug: slug
        }
      });
      
      if (existingCategory) {
        categoryMap.set(categoryName, existingCategory.id);
        console.log(`[Clover Demo] Using existing category: ${categoryName} (${existingCategory.id})`);
      } else {
        // Create new tenant category
        const newCategory = await prisma.directory_category.create({
          data: {
            id: generateCloverCatId(),
            tenantId: tenantId,
            name: categoryName,
            slug: slug,
            isActive: true,
            updatedAt: new Date()
          }
        });
        categoryMap.set(categoryName, newCategory.id);
        console.log(`[Clover Demo] Created category: ${categoryName} (${newCategory.id})`);
      }
    }

    for (const demoItem of demoItems) {
      const rvpItem = convertDemoItemToRVPFormat(demoItem);
      
      try {
        // Check if item with this SKU already exists
        const existingItem = await prisma.inventory_items.findFirst({
          where: {
            tenant_id: tenantId,
            sku: rvpItem.sku
          }
        });

        // Get directory category ID from our tenant-specific category map
        const directoryCategoryId = categoryMap.get(demoItem.category) || null;
        
        if (existingItem) {
          // Update existing demo item with proper category assignment
          console.log(`[Clover Demo] Updating existing item: ${existingItem.sku} with category: ${demoItem.category} (${directoryCategoryId})`);

          const updatedItem = await prisma.inventory_items.update({
            where: { id: existingItem.id },
            data: {
              category_path: rvpItem.category_path,
              directory_category_id: directoryCategoryId,
              metadata: rvpItem.metadata,
              updated_at: new Date()
            }
          });

          importedItems.push(updatedItem);
          continue;
        }

        // Create inventory item
        const createdItem = await prisma.inventory_items.create({
          data: { 
            id: generateCloverItemId(),
            tenant_id: tenantId,
            ...rvpItem,
            directory_category_id: directoryCategoryId,
            updated_at: new Date()
          } as any,
        });

        // Create mapping
        await prisma.clover_item_mappings_list.create({
          data: { 
            id: generateCloverItemMappingsId(),
            integration_id: integration.id,
            clover_item_id: demoItem.id,
            clover_item_name: demoItem.name,
            clover_sku: demoItem.sku,
            rvp_item_id: createdItem.id,
            rvp_sku: rvpItem.sku,
            mapping_status: 'mapped',
            last_synced_at: new Date(),
            last_sync_status: 'success',
            updated_at: new Date()
          } as any,
        });

        importedItems.push(createdItem);
        console.log(`Imported demo item: ${demoItem.sku}`);
      } catch (error) {
        console.error(`Failed to import demo item ${demoItem.sku}:`, error);
        // Continue with other items
      }
    }

    // Create sync log
    await prisma.clover_sync_logs_list.create({
      data: { 
        id: generateCloverSyncLogId(),
        integration_id: integration.id,
        trace_id: `demo_import_${Date.now()}`,
        operation: 'import',
        status: 'success',
        items_processed: demoItems.length,
        items_succeeded: importedItems.length,
        items_failed: demoItems.length - importedItems.length,
        duration_ms: 0, // Calculated later if needed
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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const userId = user.userId || user.id;
    const hasAccess = tenant.user_tenants.some((ut: any) => ut.user_id === userId);
    const isPlatformUser = user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT' || user.role === 'ADMIN';
    if (!hasAccess && !isPlatformUser) {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Find integration
    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
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
    let keptItemsCount = 0;

    // Get all item mappings for this integration
    const itemMappings = await prisma.clover_item_mappings_list.findMany({
      where: { integration_id: integration.id },
      select: { rvp_item_id: true }
    });

    const rvpItemIds = itemMappings
      .map(m => m.rvp_item_id)
      .filter((id): id is string => id !== null);

    if (!keepItems && rvpItemIds.length > 0) {
      // Delete demo items from inventory
      // First delete associated photo_assets
      await prisma.photo_assets.deleteMany({
        where: { inventoryItemId: { in: rvpItemIds } }
      });

      // Then delete the inventory items
      const deleteResult = await prisma.inventory_items.deleteMany({
        where: { id: { in: rvpItemIds } }
      });
      deletedItemsCount = deleteResult.count;
      console.log(`[Clover Demo Disable] Deleted ${deletedItemsCount} demo items for tenant ${tenantId}`);
    } else {
      keptItemsCount = rvpItemIds.length;
      console.log(`[Clover Demo Disable] Kept ${keptItemsCount} demo items for tenant ${tenantId}`);
    }

    // Delete integration (cascades to mappings, logs, snapshots)
    await prisma.clover_integrations_list.delete({
      where: { id: integration.id }
    });

    return res.json({
      message: 'Demo mode disabled successfully',
      itemsDeleted: deletedItemsCount,
      itemsKept: keptItemsCount
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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const userId = user.userId || user.id;
    const hasAccess = tenant.user_tenants.some((ut: any) => ut.user_id === userId);
    const isPlatformUser = user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT' || user.role === 'ADMIN';
    if (!hasAccess && !isPlatformUser) {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Find integration
    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.json({
        enabled: false,
        mode: null,
        status: null
      });
    }

    // Calculate stats
    const totalMappings = await prisma.clover_item_mappings_list.count({
      where: { integration_id: integration.id }
    });

    const mappedCount = await prisma.clover_item_mappings_list.count({
      where: {
        integration_id: integration.id,
        mapping_status: 'mapped'
      }
    });

    const conflictCount = await prisma.clover_item_mappings_list.count({
      where: {
        integration_id: integration.id,
        mapping_status: 'conflict'
      }
    });

    return res.json({
      enabled: true,
      mode: integration.mode,
      status: integration.status,
      merchantId: integration.merchant_id,
      demoEnabledAt: integration.demo_enabled_at,
      demoLastActiveAt: integration.demo_last_active_at,
      productionEnabledAt: integration.production_enabled_at,
      lastSyncAt: integration.last_sync_at,
      lastSyncStatus: integration.last_sync_status,
      stats: {
        totalItems: totalMappings,
        mappedItems: mappedCount,
        conflictItems: conflictCount
      },
      recentMappings: [], // Relations not available
      recentSyncs: [] // Relations not available
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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const userId = user.userId || user.id;
    const hasAccess = tenant.user_tenants.some((ut: any) => ut.user_id === userId);
    const isPlatformUser = user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT' || user.role === 'ADMIN';
    if (!hasAccess && !isPlatformUser) {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Check if already in production mode
    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
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
    let integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (integration) {
      // Update existing integration to production mode
      integration = await prisma.clover_integrations_list.update({
        where: { id: integration.id },
        data: {
          mode: 'production',
          status: 'active',
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          merchant_id: tokenData.merchant_id,
          production_enabled_at: new Date()
        }
      });
    } else {
      // Create new integration in production mode
      integration = await prisma.clover_integrations_list.create({
        data: {
          id: generateCloverIntegrationId(),
          tenant_id: tenantId,
          mode: 'production',
          status: 'active',
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          merchant_id: tokenData.merchant_id,
          production_enabled_at: new Date(),
          updated_at: new Date()
        } as any
      });
    }

    // Create sync log for OAuth connection
    await prisma.tier_change_logs_list.create({
      data: {
        id: generateCloverOauthChangeLogId(),
        entity_type: 'clover_integration',
        entity_id: integration.id,
        action: 'oauth_connect',
        change_type: 'create',
        changed_by: req.user?.userId || 'system',
        reason: 'OAuth connection established for Clover POS'
      }
    });

    // Redirect back to integrations page with success message
    return res.redirect(`/t/${tenantId}/settings/integrations?success=connected`);

  } catch (error: any) {
    console.error('[OAuth Callback] Error:', error);
    // Try to redirect with error, fallback to error page
    const tenantId = req.query.state ? decodeState(req.query.state as string).tenantId : null;
    if (tenantId) {
      return res.redirect(`/t/${tenantId}/settings/integrations?error=connection_failed&message=${encodeURIComponent(error.message)}`);
    }
    return res.status(500).json({
      error: 'oauth_callback_failed',
      message: error.message
    });
  }
});

// ============================================================================
// ENHANCED DEMO MODE - Simulation Routes
// ============================================================================

// In-memory store for active simulations (in production, use Redis or DB)
const activeSimulations = new Map<string, SimulationEvent>();

/**
 * Get available simulation scenarios
 * Returns list of scenarios user can trigger to learn the sync flow
 */
router.get('/:tenantId/clover/demo/scenarios', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    // Verify demo mode is enabled
    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration || integration.mode !== 'demo') {
      return res.status(400).json({
        error: 'demo_mode_required',
        message: 'Simulation scenarios are only available in demo mode'
      });
    }

    const scenarios = getAvailableScenarios();
    
    return res.json({
      scenarios,
      message: 'Select a scenario to simulate Clover sync behavior'
    });

  } catch (error: any) {
    console.error('[GET /clover/demo/scenarios] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Trigger a simulation scenario
 * Creates a simulated sync event that the user can observe
 */
router.post('/:tenantId/clover/demo/simulate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { scenario } = req.body as { scenario: SimulationScenario };

    if (!scenario) {
      return res.status(400).json({
        error: 'missing_scenario',
        message: 'Please specify a simulation scenario'
      });
    }

    // Verify demo mode is enabled
    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration || integration.mode !== 'demo') {
      return res.status(400).json({
        error: 'demo_mode_required',
        message: 'Simulations are only available in demo mode'
      });
    }

    // Generate simulation event
    const event = generateSimulationEvent(scenario);
    
    // Store in memory for status polling
    activeSimulations.set(event.id, event);

    // Create sync log for the simulation
    await prisma.clover_sync_logs_list.create({
      data: {
        id: generateCloverSyncLogId(),
        integration_id: integration.id,
        trace_id: event.id,
        operation: `simulation_${scenario}`,
        status: event.status,
        items_processed: event.affectedItems.length,
        items_succeeded: 0,
        items_failed: 0,
        duration_ms: 0
      }
    });

    return res.json({
      event,
      message: `Simulation started: ${event.message}`,
      nextSteps: [
        'Poll /demo/simulate/:eventId/status to see progress',
        'Call /demo/simulate/:eventId/execute to apply changes',
        'Or call /demo/simulate/:eventId/cancel to discard'
      ]
    });

  } catch (error: any) {
    console.error('[POST /clover/demo/simulate] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Get simulation event status
 */
router.get('/:tenantId/clover/demo/simulate/:eventId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    
    const event = activeSimulations.get(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'event_not_found',
        message: 'Simulation event not found or expired'
      });
    }

    return res.json({ event });

  } catch (error: any) {
    console.error('[GET /clover/demo/simulate/:eventId/status] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Execute a simulation - apply the simulated changes to the database
 */
router.post('/:tenantId/clover/demo/simulate/:eventId/execute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, eventId } = req.params;
    
    const event = activeSimulations.get(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'event_not_found',
        message: 'Simulation event not found or expired'
      });
    }

    // Update event status to syncing
    event.status = 'syncing';
    activeSimulations.set(eventId, event);

    // Get integration
    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    // Apply changes based on scenario
    // Enhanced results with before/after values and item details
    const results: {
      itemId: string;
      itemName: string;
      sku: string;
      field: string;
      oldValue: any;
      newValue: any;
      action: 'updated' | 'created' | 'archived' | 'conflict' | 'failed';
      formattedOld?: string;
      formattedNew?: string;
    }[] = [];
    
    switch (event.scenario) {
      case 'stock_update':
      case 'bulk_update':
        // Update stock for affected items
        for (let i = 0; i < event.affectedItems.length; i++) {
          const cloverItemId = event.affectedItems[i];
          const change = event.changes[i];
          
          // Find mapping
          const mapping = await prisma.clover_item_mappings_list.findFirst({
            where: {
              integration_id: integration.id,
              clover_item_id: cloverItemId
            }
          });

          if (mapping && mapping.rvp_item_id) {
            // Get current item state before update
            const currentItem = await prisma.inventory_items.findUnique({
              where: { id: mapping.rvp_item_id }
            });
            
            // Update inventory item
            const updated = await prisma.inventory_items.update({
              where: { id: mapping.rvp_item_id },
              data: {
                stock: change.newValue,
                updated_at: new Date()
              }
            });
            
            results.push({ 
              itemId: mapping.rvp_item_id, 
              itemName: currentItem?.name || mapping.clover_item_name || 'Unknown Item',
              sku: currentItem?.sku || mapping.clover_sku || '',
              field: 'stock', 
              oldValue: currentItem?.stock ?? change.oldValue,
              newValue: change.newValue,
              action: 'updated',
              formattedOld: `${currentItem?.stock ?? change.oldValue} units`,
              formattedNew: `${change.newValue} units`
            });
          }
        }
        break;

      case 'price_update':
        for (const cloverItemId of event.affectedItems) {
          const change = event.changes[0];
          
          const mapping = await prisma.clover_item_mappings_list.findFirst({
            where: {
              integration_id: integration.id,
              clover_item_id: cloverItemId
            }
          });

          if (mapping && mapping.rvp_item_id) {
            // Get current item state before update
            const currentItem = await prisma.inventory_items.findUnique({
              where: { id: mapping.rvp_item_id }
            });
            
            const updated = await prisma.inventory_items.update({
              where: { id: mapping.rvp_item_id },
              data: {
                price_cents: change.newValue,
                price: change.newValue / 100,
                updated_at: new Date()
              }
            });
            
            results.push({ 
              itemId: mapping.rvp_item_id, 
              itemName: currentItem?.name || mapping.clover_item_name || 'Unknown Item',
              sku: currentItem?.sku || mapping.clover_sku || '',
              field: 'price', 
              oldValue: currentItem?.price_cents ?? change.oldValue,
              newValue: change.newValue,
              action: 'updated',
              formattedOld: `$${((currentItem?.price_cents ?? change.oldValue) / 100).toFixed(2)}`,
              formattedNew: `$${(change.newValue / 100).toFixed(2)}`
            });
          }
        }
        break;

      case 'new_item':
        // Create new item from simulation with auto-categorization
        // Uses same approach as demo startup - category comes from simulation data
        const newItemData = event.changes[0].newValue;
        const categoryName = newItemData.category || 'Electronics';
        
        // Check if item with this SKU already exists for this tenant
        const existingItem = await prisma.inventory_items.findFirst({
          where: {
            tenant_id: tenantId,
            sku: newItemData.sku
          }
        });
        
        if (existingItem) {
          // Item already exists - report as already synced
          results.push({ 
            itemId: existingItem.id, 
            itemName: existingItem.name || newItemData.name,
            sku: newItemData.sku,
            field: 'item',
            oldValue: null,
            newValue: null,
            action: 'updated',
            formattedOld: '(already exists)',
            formattedNew: `Item already in inventory - no changes needed`
          });
          break;
        }
        
        // Find or create the category for this tenant (same as demo startup)
        const slug = slugify(categoryName);
        let existingCategory = await prisma.directory_category.findFirst({
          where: {
            tenantId: tenantId,
            slug: slug
          }
        });
        
        if (!existingCategory) {
          // Create the category (same as demo startup)
          existingCategory = await prisma.directory_category.create({
            data: {
              id: generateCloverCatId(),
              tenantId: tenantId,
              name: categoryName,
              slug: slug,
              isActive: true,
              updatedAt: new Date()
            }
          });
          console.log(`[Clover Simulation] Created category: ${categoryName} (${existingCategory.id})`);
        }
        
        const directoryCategoryId = existingCategory.id;
        
        const newItem = await prisma.inventory_items.create({
          data: { 
            id: generateCloverItemId(),
            tenant_id: tenantId,
            sku: newItemData.sku,
            name: newItemData.name,
            title: newItemData.name,
            price_cents: newItemData.price,
            price: newItemData.price / 100,
            stock: newItemData.stock,
            source: 'CLOVER_DEMO',
            brand: 'Demo Brand',
            currency: 'USD',
            availability: 'in_stock',
            directory_category_id: directoryCategoryId,
            category_path: [categoryName],
            updated_at: new Date()
          } as any
        });
        
        // Create mapping
        await prisma.clover_item_mappings_list.create({
          data: { 
            id: generateCloverItemMappingsId(),
            integration_id: integration.id,
            clover_item_id: event.affectedItems[0],
            clover_item_name: newItemData.name,
            clover_sku: newItemData.sku,
            rvp_item_id: newItem.id,
            rvp_sku: newItemData.sku,
            mapping_status: 'mapped',
            last_synced_at: new Date(),
            last_sync_status: 'success',
            updated_at: new Date()
          } as any
        });
        
        // Add result for item creation
        results.push({ 
          itemId: newItem.id, 
          itemName: newItemData.name,
          sku: newItemData.sku,
          field: 'item',
          oldValue: null,
          newValue: newItemData,
          action: 'created',
          formattedOld: '(new item)',
          formattedNew: `${newItemData.name} - $${(newItemData.price / 100).toFixed(2)} (${newItemData.stock} in stock)`
        });
        
        // Add result for auto-categorization
        results.push({ 
          itemId: newItem.id, 
          itemName: newItemData.name,
          sku: newItemData.sku,
          field: 'category',
          oldValue: null,
          newValue: categoryName,
          action: 'updated',
          formattedOld: '(uncategorized)',
          formattedNew: `Auto-assigned to "${categoryName}"`
        });
        break;

      case 'item_deleted':
        for (const cloverItemId of event.affectedItems) {
          const mapping = await prisma.clover_item_mappings_list.findFirst({
            where: {
              integration_id: integration.id,
              clover_item_id: cloverItemId
            }
          });

          if (mapping && mapping.rvp_item_id) {
            // Get current item state before archiving
            const currentItem = await prisma.inventory_items.findUnique({
              where: { id: mapping.rvp_item_id }
            });
            
            // Archive item instead of deleting
            await prisma.inventory_items.update({
              where: { id: mapping.rvp_item_id },
              data: {
                item_status: 'archived',
                updated_at: new Date()
              }
            });
            
            results.push({ 
              itemId: mapping.rvp_item_id, 
              itemName: currentItem?.name || mapping.clover_item_name || 'Unknown Item',
              sku: currentItem?.sku || mapping.clover_sku || '',
              field: 'status',
              oldValue: 'active',
              newValue: 'archived',
              action: 'archived',
              formattedOld: 'Active',
              formattedNew: 'Archived (item deleted in Clover)'
            });
          }
        }
        break;

      case 'conflict':
        // Mark mapping as conflict for user to resolve
        for (let i = 0; i < event.affectedItems.length; i++) {
          const cloverItemId = event.affectedItems[i];
          const mapping = await prisma.clover_item_mappings_list.findFirst({
            where: {
              integration_id: integration.id,
              clover_item_id: cloverItemId
            }
          });

          // Get current item for details
          let currentItem = null;
          let itemName = 'Demo Item';
          let itemSku = '';
          
          if (mapping) {
            currentItem = mapping.rvp_item_id 
              ? await prisma.inventory_items.findUnique({ where: { id: mapping.rvp_item_id } })
              : null;
            itemName = currentItem?.name || mapping.clover_item_name || 'Unknown Item';
            itemSku = currentItem?.sku || mapping.clover_sku || '';
            
            await prisma.clover_item_mappings_list.update({
              where: { id: mapping.id },
              data: {
                mapping_status: 'conflict',
                last_sync_status: 'conflict',
                updated_at: new Date()
              }
            });
          } else {
            // No mapping found - use demo item data from the emulator
            const demoItem = getDemoItem(cloverItemId);
            if (demoItem) {
              itemName = demoItem.name;
              itemSku = demoItem.sku;
            }
          }
          
          const change = event.changes[0]; // Price change from Clover
          const rvpChange = event.changes[1]; // Price change from Visible Shelf
          
          results.push({ 
            itemId: mapping?.rvp_item_id || cloverItemId,
            itemName: itemName,
            sku: itemSku,
            field: 'price',
            oldValue: change?.oldValue,
            newValue: change?.newValue,
            action: 'conflict',
            formattedOld: `Visible Shelf: $${((rvpChange?.newValue || change?.oldValue) / 100).toFixed(2)}`,
            formattedNew: `Clover: $${((change?.newValue || 0) / 100).toFixed(2)}`
          });
        }
        event.status = 'conflict';
        break;

      case 'sync_failure':
        // Simulate failure - don't apply changes
        event.status = 'failed';
        for (const cloverItemId of event.affectedItems) {
          const mapping = await prisma.clover_item_mappings_list.findFirst({
            where: {
              integration_id: integration.id,
              clover_item_id: cloverItemId
            }
          });
          
          let failItemName = 'Unknown Item';
          let failItemSku = '';
          
          if (mapping) {
            const currentItem = mapping.rvp_item_id 
              ? await prisma.inventory_items.findUnique({ where: { id: mapping.rvp_item_id } })
              : null;
            failItemName = currentItem?.name || mapping.clover_item_name || 'Unknown Item';
            failItemSku = currentItem?.sku || mapping.clover_sku || '';
          } else {
            // No mapping found - use demo item data
            const demoItem = getDemoItem(cloverItemId);
            if (demoItem) {
              failItemName = demoItem.name;
              failItemSku = demoItem.sku;
            }
          }
          
          results.push({ 
            itemId: mapping?.rvp_item_id || cloverItemId,
            itemName: failItemName,
            sku: failItemSku,
            field: 'sync',
            oldValue: null,
            newValue: null,
            action: 'failed',
            formattedOld: 'Pending sync',
            formattedNew: 'Sync failed - connection timeout'
          });
        }
        break;

      case 'new_category':
        // Create new category from Clover
        const newCatData = event.changes[0].newValue;
        const newCatSlug = slugify(newCatData.name);
        
        // Check if category already exists
        let newCategory = await prisma.directory_category.findFirst({
          where: { tenantId, slug: newCatSlug }
        });
        
        if (!newCategory) {
          newCategory = await prisma.directory_category.create({
            data: {
              id: generateCloverCatId(),
              tenantId,
              name: newCatData.name,
              slug: newCatSlug,
              isActive: true,
              updatedAt: new Date()
            }
          });
          
          results.push({
            itemId: newCategory.id,
            itemName: newCatData.name,
            sku: '',
            field: 'category',
            oldValue: null,
            newValue: newCatData.name,
            action: 'created',
            formattedOld: '(new category)',
            formattedNew: `Category "${newCatData.name}" created`
          });
        } else {
          results.push({
            itemId: newCategory.id,
            itemName: newCatData.name,
            sku: '',
            field: 'category',
            oldValue: null,
            newValue: null,
            action: 'updated',
            formattedOld: '(already exists)',
            formattedNew: `Category "${newCatData.name}" already exists`
          });
        }
        break;

      case 'category_renamed':
        // Rename category and show affected items
        const renameChange = event.changes[0];
        const oldCatName = renameChange.oldValue;
        const newCatName = renameChange.newValue;
        
        // Find the category to rename
        const catToRename = await prisma.directory_category.findFirst({
          where: { tenantId, name: oldCatName }
        });
        
        if (catToRename) {
          await prisma.directory_category.update({
            where: { id: catToRename.id },
            data: {
              name: newCatName,
              slug: slugify(newCatName),
              updatedAt: new Date()
            }
          });
          
          results.push({
            itemId: catToRename.id,
            itemName: oldCatName,
            sku: '',
            field: 'category_name',
            oldValue: oldCatName,
            newValue: newCatName,
            action: 'updated',
            formattedOld: oldCatName,
            formattedNew: newCatName
          });
          
          // Show affected items
          const affectedItems = await prisma.inventory_items.findMany({
            where: { tenant_id: tenantId, directory_category_id: catToRename.id },
            take: 10
          });
          
          for (const item of affectedItems) {
            results.push({
              itemId: item.id,
              itemName: item.name || 'Unknown Item',
              sku: item.sku || '',
              field: 'category_path',
              oldValue: oldCatName,
              newValue: newCatName,
              action: 'updated',
              formattedOld: `In "${oldCatName}"`,
              formattedNew: `Now in "${newCatName}"`
            });
          }
        } else {
          results.push({
            itemId: '',
            itemName: oldCatName,
            sku: '',
            field: 'category_name',
            oldValue: oldCatName,
            newValue: newCatName,
            action: 'updated',
            formattedOld: `"${oldCatName}" not found`,
            formattedNew: `Would rename to "${newCatName}"`
          });
        }
        break;

      case 'category_items_moved':
        // Move items between categories
        const moveChange = event.changes[0];
        const fromCatName = moveChange.oldValue;
        const toCatName = moveChange.newValue;
        
        // Find destination category
        let destCategory = await prisma.directory_category.findFirst({
          where: { tenantId, name: toCatName }
        });
        
        if (!destCategory) {
          destCategory = await prisma.directory_category.create({
            data: {
              id: generateCloverCatId(),
              tenantId,
              name: toCatName,
              slug: slugify(toCatName),
              isActive: true,
              updatedAt: new Date()
            }
          });
        }
        
        // Move affected items
        for (const cloverItemId of event.affectedItems) {
          const mapping = await prisma.clover_item_mappings_list.findFirst({
            where: { integration_id: integration.id, clover_item_id: cloverItemId }
          });
          
          let movedItemName = 'Unknown Item';
          let movedItemSku = '';
          
          if (mapping?.rvp_item_id) {
            const item = await prisma.inventory_items.findUnique({ where: { id: mapping.rvp_item_id } });
            if (item) {
              movedItemName = item.name || 'Unknown Item';
              movedItemSku = item.sku || '';
              
              await prisma.inventory_items.update({
                where: { id: item.id },
                data: {
                  directory_category_id: destCategory.id,
                  category_path: [toCatName],
                  updated_at: new Date()
                }
              });
            }
          } else {
            const demoItem = getDemoItem(cloverItemId);
            if (demoItem) {
              movedItemName = demoItem.name;
              movedItemSku = demoItem.sku;
            }
          }
          
          results.push({
            itemId: mapping?.rvp_item_id || cloverItemId,
            itemName: movedItemName,
            sku: movedItemSku,
            field: 'category',
            oldValue: fromCatName,
            newValue: toCatName,
            action: 'updated',
            formattedOld: `In "${fromCatName}"`,
            formattedNew: `Moved to "${toCatName}"`
          });
        }
        break;

      case 'category_conflict':
        // Category name conflict between Clover and Visible Shelf
        const cloverCatChange = event.changes[0];
        const rvpCatChange = event.changes[1];
        
        results.push({
          itemId: '',
          itemName: cloverCatChange.oldValue,
          sku: '',
          field: 'category_name',
          oldValue: cloverCatChange.oldValue,
          newValue: cloverCatChange.newValue,
          action: 'conflict',
          formattedOld: `Visible Shelf: "${rvpCatChange?.newValue || cloverCatChange.oldValue}"`,
          formattedNew: `Clover: "${cloverCatChange.newValue}"`
        });
        event.status = 'conflict';
        break;
    }

    // Update event status
    if (event.status !== 'conflict' && event.status !== 'failed') {
      event.status = 'success';
    }
    activeSimulations.set(eventId, event);

    // Update sync log with detailed results for history tab
    // Using error_details (Json field) to store audit trail
    await prisma.clover_sync_logs_list.updateMany({
      where: { trace_id: eventId },
      data: {
        status: event.status,
        items_succeeded: event.status === 'success' ? results.length : 0,
        items_failed: event.status === 'failed' ? event.affectedItems.length : 0,
        completed_at: new Date(),
        error_details: {
          scenario: event.scenario,
          message: event.message,
          resolution: event.resolution,
          auditTrail: results
        }
      }
    });

    return res.json({
      event,
      results,
      message: event.status === 'success' 
        ? 'Simulation executed successfully - changes applied to inventory'
        : event.status === 'conflict'
        ? 'Conflict detected - manual resolution required'
        : 'Simulation failed - no changes applied'
    });

  } catch (error: any) {
    console.error('[POST /clover/demo/simulate/:eventId/execute] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Cancel a simulation
 */
router.post('/:tenantId/clover/demo/simulate/:eventId/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    
    const event = activeSimulations.get(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'event_not_found',
        message: 'Simulation event not found or expired'
      });
    }

    // Remove from active simulations
    activeSimulations.delete(eventId);

    return res.json({
      message: 'Simulation cancelled - no changes applied',
      eventId
    });

  } catch (error: any) {
    console.error('[POST /clover/demo/simulate/:eventId/cancel] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Get item mappings for demo mode
 * Shows how Clover items are mapped to Visible Shelf items
 */
router.get('/:tenantId/clover/demo/mappings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    const where: any = { integration_id: integration.id };
    if (status) {
      where.mapping_status = status;
    }

    const [mappings, total] = await Promise.all([
      prisma.clover_item_mappings_list.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { updated_at: 'desc' }
      }),
      prisma.clover_item_mappings_list.count({ where })
    ]);

    // Enrich with Visible Shelf item data
    const enrichedMappings = await Promise.all(
      mappings.map(async (mapping) => {
        let rvpItem = null;
        if (mapping.rvp_item_id) {
          rvpItem = await prisma.inventory_items.findUnique({
            where: { id: mapping.rvp_item_id },
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              stock: true,
              item_status: true
            }
          });
        }
        return {
          ...mapping,
          rvpItem
        };
      })
    );

    return res.json({
      mappings: enrichedMappings,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    console.error('[GET /clover/demo/mappings] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Resolve a mapping conflict
 * User chooses which value to keep: clover, rvp, or custom
 */
router.post('/:tenantId/clover/demo/mappings/:mappingId/resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, mappingId } = req.params;
    const { resolution, customValues } = req.body;
    // resolution: 'use_clover' | 'use_rvp' | 'custom'
    // customValues: { price?: number, stock?: number, name?: string }

    if (!resolution || !['use_clover', 'use_rvp', 'custom'].includes(resolution)) {
      return res.status(400).json({
        error: 'invalid_resolution',
        message: 'Resolution must be: use_clover, use_rvp, or custom'
      });
    }

    const mapping = await prisma.clover_item_mappings_list.findUnique({
      where: { id: mappingId }
    });

    if (!mapping) {
      return res.status(404).json({ error: 'mapping_not_found' });
    }

    if (mapping.mapping_status !== 'conflict') {
      return res.status(400).json({
        error: 'not_in_conflict',
        message: 'This mapping is not in conflict state'
      });
    }

    // Get the demo item data (simulating Clover data)
    const demoItems = getDemoItems();
    const cloverItem = demoItems.find(item => item.id === mapping.clover_item_id);

    let updateData: any = {};

    switch (resolution) {
      case 'use_clover':
        if (cloverItem) {
          updateData = {
            price_cents: cloverItem.price,
            price: cloverItem.price / 100,
            stock: cloverItem.stock,
            name: cloverItem.name
          };
        }
        break;
      case 'use_rvp':
        // Keep current Visible Shelf values - no update needed
        break;
      case 'custom':
        if (customValues) {
          if (customValues.price !== undefined) {
            updateData.price_cents = customValues.price;
            updateData.price = customValues.price / 100;
          }
          if (customValues.stock !== undefined) {
            updateData.stock = customValues.stock;
          }
          if (customValues.name !== undefined) {
            updateData.name = customValues.name;
            updateData.title = customValues.name;
          }
        }
        break;
    }

    // Update Visible Shelf item if needed
    if (Object.keys(updateData).length > 0 && mapping.rvp_item_id) {
      await prisma.inventory_items.update({
        where: { id: mapping.rvp_item_id },
        data: {
          ...updateData,
          updated_at: new Date()
        }
      });
    }

    // Mark conflict as resolved
    await prisma.clover_item_mappings_list.update({
      where: { id: mappingId },
      data: {
        mapping_status: 'mapped',
        last_sync_status: 'success',
        last_synced_at: new Date(),
        updated_at: new Date()
      }
    });

    return res.json({
      message: 'Conflict resolved successfully',
      resolution,
      mappingId
    });

  } catch (error: any) {
    console.error('[POST /clover/demo/mappings/:mappingId/resolve] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Get sync history for demo mode
 */
router.get('/:tenantId/clover/demo/sync-history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = 20 } = req.query;

    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    const syncLogs = await prisma.clover_sync_logs_list.findMany({
      where: { integration_id: integration.id },
      take: Number(limit),
      orderBy: { started_at: 'desc' }
    });

    return res.json({
      syncLogs,
      total: syncLogs.length
    });

  } catch (error: any) {
    console.error('[GET /clover/demo/sync-history] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// ============================================================================
// PRODUCTION MODE - Sync & Import Routes
// ============================================================================

/**
 * Mock Clover API response - simulates what real Clover API would return
 * This allows full sync logic testing without real API keys
 */
function getMockCloverInventory() {
  return {
    categories: [
      { id: 'clv_cat_001', name: 'Appetizers', sortOrder: 1 },
      { id: 'clv_cat_002', name: 'Main Courses', sortOrder: 2 },
      { id: 'clv_cat_003', name: 'Desserts', sortOrder: 3 },
      { id: 'clv_cat_004', name: 'Beverages', sortOrder: 4 },
      { id: 'clv_cat_005', name: 'Sides', sortOrder: 5 },
    ],
    items: [
      { id: 'clv_item_001', name: 'Caesar Salad', sku: 'APP-001', price: 1299, stockCount: 50, categoryId: 'clv_cat_001' },
      { id: 'clv_item_002', name: 'Soup of the Day', sku: 'APP-002', price: 899, stockCount: 30, categoryId: 'clv_cat_001' },
      { id: 'clv_item_003', name: 'Grilled Salmon', sku: 'MAIN-001', price: 2499, stockCount: 25, categoryId: 'clv_cat_002' },
      { id: 'clv_item_004', name: 'Ribeye Steak', sku: 'MAIN-002', price: 3499, stockCount: 20, categoryId: 'clv_cat_002' },
      { id: 'clv_item_005', name: 'Pasta Primavera', sku: 'MAIN-003', price: 1899, stockCount: 40, categoryId: 'clv_cat_002' },
      { id: 'clv_item_006', name: 'Chocolate Cake', sku: 'DES-001', price: 999, stockCount: 15, categoryId: 'clv_cat_003' },
      { id: 'clv_item_007', name: 'Tiramisu', sku: 'DES-002', price: 1099, stockCount: 12, categoryId: 'clv_cat_003' },
      { id: 'clv_item_008', name: 'Iced Tea', sku: 'BEV-001', price: 399, stockCount: 100, categoryId: 'clv_cat_004' },
      { id: 'clv_item_009', name: 'Fresh Lemonade', sku: 'BEV-002', price: 499, stockCount: 80, categoryId: 'clv_cat_004' },
      { id: 'clv_item_010', name: 'French Fries', sku: 'SIDE-001', price: 599, stockCount: 60, categoryId: 'clv_cat_005' },
    ]
  };
}

/**
 * Fetch inventory from Clover API (or mock data if no real connection)
 * Set CLOVER_USE_REAL_API=true in environment to use real Clover API
 */
async function fetchCloverInventory(integration: any): Promise<{ categories: any[], items: any[] }> {
  // Check environment variable for real API usage
  const useRealApi = process.env.CLOVER_USE_REAL_API === 'true';
  
  // Check if we have real API credentials
  const hasRealCredentials = integration.access_token && 
    !integration.access_token.startsWith('demo_') && 
    integration.merchant_id;

  if (useRealApi && hasRealCredentials) {
    try {
      console.log('[Clover Sync] Using real Clover API...');
      
      // Fetch categories from Clover
      const categoriesResponse = await fetch(
        `https://api.clover.com/v3/merchants/${integration.merchant_id}/categories`,
        { headers: { 'Authorization': `Bearer ${integration.access_token}` } }
      );
      const categoriesData = await categoriesResponse.json() as { elements?: any[] };
      
      // Fetch items from Clover
      const itemsResponse = await fetch(
        `https://api.clover.com/v3/merchants/${integration.merchant_id}/items?expand=categories`,
        { headers: { 'Authorization': `Bearer ${integration.access_token}` } }
      );
      const itemsData = await itemsResponse.json() as { elements?: any[] };
      
      // Transform Clover API response to our format
      const categories = (categoriesData.elements || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder || 0,
        parentId: null
      }));
      
      const items = (itemsData.elements || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku || item.code || `CLV-${item.id.substring(0, 8)}`,
        price: item.price || 0,
        salePrice: item.priceType === 'VARIABLE' ? null : (item.alternatePrices?.[0]?.price || null), // Clover sale price
        stockCount: item.stockCount || 0,
        categoryId: item.categories?.elements?.[0]?.id || null
      }));
      
      console.log(`[Clover Sync] Fetched ${categories.length} categories and ${items.length} items from Clover API`);
      return { categories, items };
      
    } catch (error) {
      console.error('[Clover Sync] Real API call failed, falling back to mock data:', error);
    }
  }

  // Return mock data for development/testing
  if (!useRealApi) {
    console.log('[Clover Sync] CLOVER_USE_REAL_API not set, using mock data');
  } else if (!hasRealCredentials) {
    console.log('[Clover Sync] Missing credentials, using mock data');
  }
  
  return getMockCloverInventory();
}

/**
 * Trigger a sync from Clover (Production Mode)
 * Imports items and categories from connected Clover account into Visible Shelf inventory
 * Supports 2-way category sync
 */
router.post('/:tenantId/clover/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { 
      importNew = true, 
      updateExisting = true,
      syncCategories = true,
      useMockData = false  // Force mock data for testing
    } = req.body;

    // Verify integration exists
    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    // Allow sync in both demo and production mode (demo uses mock data)
    const useRealApi = integration.mode === 'production' && integration.access_token && !useMockData;

    // Create sync log entry
    //const syncLogId = crypto.randomUUID();
    const syncLogId = generateCloverSyncLogId();
    const startTime = Date.now();
    
    await prisma.clover_sync_logs_list.create({
      data: {
        id: syncLogId,
        integration_id: integration.id,
        trace_id: `sync_${Date.now()}`,
        operation: 'full_sync',
        status: 'in_progress',
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0
      }
    });

    // Fetch inventory from Clover (real API or mock)
    const cloverData = await fetchCloverInventory(integration);
    
    let categoriesCreated = 0;
    let categoriesMapped = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsFailed = 0;

    // ========================================
    // STEP 1: Sync Categories (Clover → Visible Shelf)
    // ========================================
    if (syncCategories && cloverData.categories.length > 0) {
      console.log(`[Clover Sync] Syncing ${cloverData.categories.length} categories...`);
      
      for (const cloverCat of cloverData.categories) {
        try {
          // Check if category mapping already exists
          let categoryMapping = await prisma.clover_category_mappings_list.findFirst({
            where: {
              integration_id: integration.id,
              clover_category_id: cloverCat.id
            }
          });

          let rvpCategoryId: string | null = null;

          if (categoryMapping && categoryMapping.rvp_category_id) {
            // Category already mapped
            rvpCategoryId = categoryMapping.rvp_category_id;
            categoriesMapped++;
          } else {
            // Create or find Visible Shelf category
            const slug = cloverCat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            
            let rvpCategory = await prisma.directory_category.findFirst({
              where: {
                tenantId: tenantId,
                slug: slug
              }
            });

            if (!rvpCategory) {
              // Create new Visible Shelf category
              rvpCategory = await prisma.directory_category.create({
                data: { 
                  id: generateCloverCatId(),
                  tenantId: tenantId,
                  name: cloverCat.name,
                  slug: slug,
                  isActive: true,
                  sortOrder: cloverCat.sortOrder || 0,
                  updatedAt: new Date()
                }
              });
              categoriesCreated++;
              console.log(`[Clover Sync] Created category: ${cloverCat.name}`);
            }

            rvpCategoryId = rvpCategory.id;

            // Create or update category mapping
            if (categoryMapping) {
              await prisma.clover_category_mappings_list.update({
                where: { id: categoryMapping.id },
                data: {
                  rvp_category_id: rvpCategoryId,
                  rvp_category_name: cloverCat.name,
                  mapping_status: 'mapped',
                  last_synced_at: new Date(),
                  last_sync_status: 'success',
                  updated_at: new Date()
                }
              });
            } else {
              await prisma.clover_category_mappings_list.create({
                data: { 
                  id: generateCloverItemMappingsId(),
                  integration_id: integration.id,
                  clover_category_id: cloverCat.id,
                  clover_category_name: cloverCat.name,
                  clover_parent_id: cloverCat.parentId || null,
                  rvp_category_id: rvpCategoryId,
                  rvp_category_name: cloverCat.name,
                  sync_direction: 'bidirectional',
                  mapping_status: 'mapped',
                  last_synced_at: new Date(),
                  last_sync_status: 'success',
                  updated_at: new Date()
                }
              });
            }
            categoriesMapped++;
          }
        } catch (catError) {
          console.error(`[Clover Sync] Failed to sync category ${cloverCat.name}:`, catError);
        }
      }
    }

    // ========================================
    // STEP 2: Sync Items (Clover → Visible Shelf)
    // ========================================
    console.log(`[Clover Sync] Syncing ${cloverData.items.length} items...`);
    
    for (const cloverItem of cloverData.items) {
      try {
        // Find category mapping for this item
        const categoryMapping = await prisma.clover_category_mappings_list.findFirst({
          where: {
            integration_id: integration.id,
            clover_category_id: cloverItem.categoryId
          }
        });
        const rvpCategoryId = categoryMapping?.rvp_category_id || null;

        // Check if item mapping already exists
        let itemMapping = await prisma.clover_item_mappings_list.findFirst({
          where: {
            integration_id: integration.id,
            clover_item_id: cloverItem.id
          }
        });

        if (itemMapping && itemMapping.rvp_item_id) {
          // Item already mapped - update if requested
          if (updateExisting) {
            await prisma.inventory_items.update({
              where: { id: itemMapping.rvp_item_id },
              data: {
                name: cloverItem.name,
                price_cents: cloverItem.price,
                sale_price_cents: cloverItem.salePrice || null,
                stock: cloverItem.stockCount,
                directory_category_id: rvpCategoryId,
                updated_at: new Date()
              }
            });
            
            await prisma.clover_item_mappings_list.update({
              where: { id: itemMapping.id },
              data: {
                last_synced_at: new Date(),
                last_sync_status: 'success',
                updated_at: new Date()
              }
            });
            
            itemsUpdated++;
          }
        } else if (importNew) {
          // Create new Visible Shelf item
          const newItem = await prisma.inventory_items.create({
            data: { 
              id: generateCloverItemId(),
              tenant_id: tenantId,
              sku: cloverItem.sku,
              name: cloverItem.name,
              priceCents: cloverItem.price,
              salePriceCents: cloverItem.salePrice || null,
              stockQuantity: cloverItem.stockCount,
              directory_category_id: rvpCategoryId,
              itemStatus: 'active',
              visibility: 'public',
              updated_at: new Date()
            } as any
          });

          // Create item mapping
          if (itemMapping) {
            await prisma.clover_item_mappings_list.update({
              where: { id: itemMapping.id },
              data: {
                rvp_item_id: newItem.id,
                rvp_sku: cloverItem.sku,
                mapping_status: 'mapped',
                last_synced_at: new Date(),
                last_sync_status: 'success',
                updated_at: new Date()
              }
            });
          } else {
            await prisma.clover_item_mappings_list.create({
              data: { 
                id: generateCloverItemMappingsId(),
                integration_id: integration.id,
                clover_item_id: cloverItem.id,
                clover_item_name: cloverItem.name,
                clover_sku: cloverItem.sku,
                rvp_item_id: newItem.id,
                rvp_sku: cloverItem.sku,
                mapping_status: 'mapped',
                last_synced_at: new Date(),
                last_sync_status: 'success',
                updated_at: new Date()
              }
            });
          }
          
          itemsCreated++;
          console.log(`[Clover Sync] Created item: ${cloverItem.name}`);
        }
      } catch (itemError) {
        console.error(`[Clover Sync] Failed to sync item ${cloverItem.name}:`, itemError);
        itemsFailed++;
      }
    }

    // Update sync log with results
    const duration = Date.now() - startTime;
    await prisma.clover_sync_logs_list.update({
      where: { id: syncLogId },
      data: {
        status: itemsFailed > 0 ? 'partial' : 'success',
        items_processed: cloverData.items.length,
        items_succeeded: itemsCreated + itemsUpdated,
        items_failed: itemsFailed,
        completed_at: new Date(),
        duration_ms: duration
      }
    });

    // Update integration last sync time
    await prisma.clover_integrations_list.update({
      where: { id: integration.id },
      data: {
        last_sync_at: new Date(),
        last_sync_status: itemsFailed > 0 ? 'partial' : 'success'
      }
    });

    return res.json({
      message: 'Sync completed successfully',
      syncId: syncLogId,
      duration: `${duration}ms`,
      results: {
        categories: {
          total: cloverData.categories.length,
          created: categoriesCreated,
          mapped: categoriesMapped
        },
        items: {
          total: cloverData.items.length,
          created: itemsCreated,
          updated: itemsUpdated,
          failed: itemsFailed
        }
      },
      dataSource: useRealApi ? 'clover_api' : 'mock_data'
    });

  } catch (error: any) {
    console.error('[POST /clover/sync] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Disconnect Clover integration (Production Mode)
 */
router.post('/:tenantId/clover/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { keepItems = true } = req.body;

    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    // Clear tokens and set to disconnected
    await prisma.clover_integrations_list.update({
      where: { id: integration.id },
      data: {
        status: 'disconnected',
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        updated_at: new Date()
      }
    });

    // Optionally clear mappings
    if (!keepItems) {
      await prisma.clover_item_mappings_list.deleteMany({
        where: { integration_id: integration.id }
      });
    }

    return res.json({
      message: 'Clover disconnected successfully',
      itemsKept: keepItems
    });

  } catch (error: any) {
    console.error('[POST /clover/disconnect] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Get item mappings (Production Mode)
 * Works for both demo and production - returns all Clover↔Visible Shelf item mappings
 */
router.get('/:tenantId/clover/mappings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status } = req.query;

    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    // Build query
    const where: any = { integration_id: integration.id };
    if (status) {
      where.mapping_status = status;
    }

    const mappings = await prisma.clover_item_mappings_list.findMany({
      where,
      orderBy: { last_synced_at: 'desc' }
    });

    // Fetch Visible Shelf items for each mapping
    const rvpItemIds = mappings.map(m => m.rvp_item_id).filter((id): id is string => id !== null);
    const rvpItems = await prisma.inventory_items.findMany({
      where: { id: { in: rvpItemIds } },
      select: { id: true, name: true, sku: true, price_cents: true, stock: true }
    });

    const rvpItemMap = new Map(rvpItems.map(item => [item.id, item]));

    const mappingsWithItems = mappings.map(mapping => ({
      ...mapping,
      rvpItem: mapping.rvp_item_id ? rvpItemMap.get(mapping.rvp_item_id) : null
    }));

    return res.json({
      mappings: mappingsWithItems,
      total: mappings.length,
      conflicts: mappings.filter(m => m.mapping_status === 'conflict').length
    });

  } catch (error: any) {
    console.error('[GET /clover/mappings] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Resolve mapping conflict (Production Mode)
 */
router.post('/:tenantId/clover/mappings/:mappingId/resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, mappingId } = req.params;
    const { resolution, customValues } = req.body as {
      resolution: 'use_clover' | 'use_rvp' | 'custom';
      customValues?: { price?: number; stock?: number; name?: string };
    };

    if (!resolution) {
      return res.status(400).json({
        error: 'missing_resolution',
        message: 'Please specify a resolution: use_clover, use_rvp, or custom'
      });
    }

    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    const mapping = await prisma.clover_item_mappings_list.findFirst({
      where: { id: mappingId, integration_id: integration.id }
    });

    if (!mapping) {
      return res.status(404).json({ error: 'mapping_not_found' });
    }

    // Apply resolution
    if (resolution === 'use_clover' && mapping.rvp_item_id) {
      // Update Visible Shelf item with Clover values
      // In production, would fetch current Clover values and apply
      await prisma.inventory_items.update({
        where: { id: mapping.rvp_item_id },
        data: {
          // Would apply Clover values here
          updated_at: new Date()
        }
      });
    } else if (resolution === 'use_rvp') {
      // Keep Visible Shelf values, mark as resolved
      // In production, would push Visible Shelf values to Clover
    } else if (resolution === 'custom' && customValues && mapping.rvp_item_id) {
      // Apply custom values
      await prisma.inventory_items.update({
        where: { id: mapping.rvp_item_id },
        data: {
          ...(customValues.price !== undefined && { price_cents: customValues.price }),
          ...(customValues.stock !== undefined && { stock_quantity: customValues.stock }),
          ...(customValues.name !== undefined && { name: customValues.name }),
          updated_at: new Date()
        }
      });
    }

    // Update mapping status
    await prisma.clover_item_mappings_list.update({
      where: { id: mappingId },
      data: {
        mapping_status: 'mapped',
        last_synced_at: new Date(),
        updated_at: new Date()
      }
    });

    return res.json({
      message: 'Conflict resolved successfully',
      resolution,
      mappingId
    });

  } catch (error: any) {
    console.error('[POST /clover/mappings/:mappingId/resolve] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Get category mappings (Production Mode)
 * Returns all Clover↔Visible Shelf category mappings for 2-way category sync
 */
router.get('/:tenantId/clover/category-mappings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status } = req.query;

    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    // Build query
    const where: any = { integration_id: integration.id };
    if (status) {
      where.mapping_status = status;
    }

    const categoryMappings = await prisma.clover_category_mappings_list.findMany({
      where,
      orderBy: { last_synced_at: 'desc' }
    });

    // Fetch Visible Shelf categories for each mapping
    const rvpCategoryIds = categoryMappings
      .map(m => m.rvp_category_id)
      .filter((id): id is string => id !== null);
    
    const rvpCategories = await prisma.directory_category.findMany({
      where: { id: { in: rvpCategoryIds } },
      select: { id: true, name: true, slug: true, isActive: true }
    });

    const rvpCategoryMap = new Map(rvpCategories.map(cat => [cat.id, cat]));

    const mappingsWithCategories = categoryMappings.map(mapping => ({
      ...mapping,
      rvpCategory: mapping.rvp_category_id ? rvpCategoryMap.get(mapping.rvp_category_id) : null
    }));

    return res.json({
      categoryMappings: mappingsWithCategories,
      total: categoryMappings.length,
      conflicts: categoryMappings.filter(m => m.mapping_status === 'conflict').length,
      syncDirections: {
        bidirectional: categoryMappings.filter(m => m.sync_direction === 'bidirectional').length,
        cloverToRvp: categoryMappings.filter(m => m.sync_direction === 'clover_to_rvp').length,
        rvpToClover: categoryMappings.filter(m => m.sync_direction === 'rvp_to_clover').length
      }
    });

  } catch (error: any) {
    console.error('[GET /clover/category-mappings] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * Get sync history (Production Mode)
 */
router.get('/:tenantId/clover/sync-history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = 20 } = req.query;

    const integration = await prisma.clover_integrations_list.findFirst({
      where: { tenant_id: tenantId }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    const syncLogs = await prisma.clover_sync_logs_list.findMany({
      where: { integration_id: integration.id },
      take: Number(limit),
      orderBy: { started_at: 'desc' }
    });

    return res.json({
      syncLogs,
      total: syncLogs.length
    });

  } catch (error: any) {
    console.error('[GET /clover/sync-history] Error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

export default router;
