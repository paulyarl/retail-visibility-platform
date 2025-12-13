/**
 * Product Enrichment API
 * 
 * Endpoints for enriching products with scanned barcode data
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { 
  findMatchingProducts, 
  ScannedProductData,
  EnrichmentOptions,
  getMissingFields,
  getEnrichableFields,
  calculateEnrichmentValue
} from '../../utils/productMatcher';
import { generatePhotoId } from '../../lib/id-generator';

const router = Router();

/**
 * POST /api/products/find-matches
 * 
 * Find existing products that match scanned barcode data
 */
router.post('/find-matches', async (req: Request, res: Response) => {
  try {
    const { scannedData } = req.body as { scannedData: ScannedProductData };
    const user = req.user as any;
    const tenantId = user?.tenantIds?.[0]; // Get first tenant

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!scannedData || !scannedData.barcode) {
      return res.status(400).json({ error: 'Scanned data with barcode is required' });
    }

    // Find matching products
    const matches = await findMatchingProducts(prisma, scannedData, tenantId);

    // Calculate enrichment value for each match
    const matchesWithValue = matches.map(match => {
      const enrichmentValue = calculateEnrichmentValue(
        match.existingProduct,
        match.scannedData
      );
      const enrichableFields = getEnrichableFields(
        match.existingProduct,
        match.scannedData
      );

      return {
        ...match,
        enrichmentValue,
        enrichableFields,
        existingProduct: {
          ...match.existingProduct,
          price: match.existingProduct.price.toString() // Convert Decimal to string
        }
      };
    });

    return res.json({
      success: true,
      matches: matchesWithValue,
      totalMatches: matchesWithValue.length
    });
  } catch (error) {
    console.error('[Products] Find matches error:', error);
    return res.status(500).json({ 
      error: 'Failed to find matching products',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/products/:productId/enrich
 * 
 * Enrich an existing product with scanned data
 */
router.post('/:productId/enrich', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { scannedData, enrichmentOptions } = req.body as {
      scannedData: ScannedProductData;
      enrichmentOptions: EnrichmentOptions;
    };
    const user = req.user as any;
    const tenantId = user?.tenantIds?.[0]; // Get first tenant
    const userId = user?.userId;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Enforce subscription state with 6-month maintenance window for google_only fallback
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_tier: true, subscription_status: true, trial_ends_at: true }, 
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tier = tenant.subscription_tier || 'starter';
    const status = tenant.subscription_status || 'active';
    const now = new Date();
    const isInactive = status === 'canceled' || status === 'expired';

    // google_only maintenance window: allow enrichment while active and before trial_ends_at boundary.
    // trial_ends_at is treated as the current maintenance boundary and should be extended externally
    // in 6-month increments while the subscription remains active.
    const inMaintenanceWindow =
      tier === 'google_only' &&
      status === 'active' &&
      (!tenant.trial_ends_at || now < tenant.trial_ends_at);

    const isFullyFrozen = isInactive || (tier === 'google_only' && !inMaintenanceWindow);

    if (isFullyFrozen) {
      return res.status(403).json({
        error: 'subscription_read_only',
        message: 'Your account is in read-only visibility mode. Upgrade to add or update products or sync new changes.',
        subscription_tier: tier,
        subscription_status: status,
      });
    }

    // Get existing product
    const product = await prisma.inventory_items.findUnique({
      where: { id: productId },
      include: { photo_assets: true }
    });

    if (!product || product.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Build update data based on options
    const updateData: any = {
      enrichedAt: new Date(),
      enrichedBy: userId,
      enrichedFromBarcode: scannedData.barcode
    };

    // Update name if requested
    if (enrichmentOptions.useName && scannedData.name) {
      updateData.name = scannedData.name;
      updateData.title = scannedData.name;
    }

    // Update description if requested
    if (enrichmentOptions.useDescription && scannedData.description) {
      updateData.description = scannedData.description;
      updateData.missingDescription = false;
    }

    // Update brand if requested
    if (enrichmentOptions.useBrand && scannedData.brand) {
      updateData.brand = scannedData.brand;
      updateData.missingBrand = false;
    }

    // Update price if requested (keep user's price by default)
    if (enrichmentOptions.usePrice && scannedData.price) {
      updateData.price = scannedData.price;
    }

    // Update category if requested
    if (enrichmentOptions.useCategory && scannedData.category) {
      // Note: Category mapping would need to be implemented based on your taxonomy
      updateData.categoryPath = [scannedData.category];
    }

    // Update specifications if requested
    if (enrichmentOptions.useSpecs && scannedData.specifications) {
      updateData.metadata = {
        ...(product.metadata as any || {}),
        specifications: scannedData.specifications
      };
      updateData.missingSpecs = false;
    }

    // Update manufacturer if available
    if (scannedData.manufacturer) {
      updateData.manufacturer = scannedData.manufacturer;
    }

    // Update MPN if available
    if (scannedData.mpn) {
      updateData.mpn = scannedData.mpn;
    }

    // Update GTIN if not already set
    if (!product.gtin && scannedData.barcode) {
      updateData.gtin = scannedData.barcode;
    }

    // Update product
    const updatedProduct = await prisma.inventory_items.update({
      where: { id: productId },
      data: updateData
    });

    // Add images if requested
    let addedImages: any[] = [];
    if (enrichmentOptions.useImages && scannedData.images && scannedData.images.length > 0) {
      // Delete existing photos if any
      await prisma.photo_assets.deleteMany({
        where: { inventoryItemId: productId }
      });

      // Add new photos
      const photoData = scannedData.images.map((url, index) => ({
        id:generatePhotoId(tenantId,productId),
        tenantId: tenantId,
        inventoryItemId: productId,
        url,
        position: index,
        contentType: 'image/jpeg', // Default, could be detected
        alt: `${updatedProduct.name} - Image ${index + 1}`
      }));

      const batchResult = await prisma.photo_assets.createMany({
        data: photoData
      });
      addedImages = photoData; // Return the data we created

      // Update missing images flag
      await prisma.inventory_items.update({
        where: { id: productId },
        data: { missing_images: false }
      });
    }

    // Check if fully enriched
    const missing = getMissingFields(updatedProduct);
    const fullyEnriched = !missing.missingImages && 
                          !missing.missingDescription && 
                          !missing.missingSpecs && 
                          !missing.missingBrand;

    if (fullyEnriched) {
      await prisma.inventory_items.update({
        where: { id: productId },
        data: { enrichment_status: 'COMPLETE' }
      });
    } else {
      await prisma.inventory_items.update({
        where: { id: productId },
        data: { enrichment_status: 'PARTIALLY_ENRICHED' }
      });
    }

    // Get final product with photos
    const enrichedProduct = await prisma.inventory_items.findUnique({
      where: { id: productId },
      include: { photo_assets: true }
    });

    // Track analytics
    console.log('[Products] Product enriched:', {
      productId,
      tenantId,
      source: product.source,
      enrichmentType: 'SCAN',
      fieldsEnriched: Object.keys(enrichmentOptions).filter(
        k => enrichmentOptions[k as keyof EnrichmentOptions]
      ),
      imagesAdded: scannedData.images?.length || 0
    });

    return res.json({
      success: true,
      product: {
        ...enrichedProduct,
        price: enrichedProduct?.price.toString()
      },
      imagesAdded: scannedData.images?.length || 0,
      fullyEnriched
    });
  } catch (error) {
    console.error('[Products] Enrich error:', error);
    return res.status(500).json({ 
      error: 'Failed to enrich product',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/products/needs-enrichment
 * 
 * Get products that need enrichment
 */
router.get('/needs-enrichment', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const tenantId = user?.tenantIds?.[0]; // Get first tenant

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const products = await prisma.inventory_items.findMany({
      where: {
        tenant_id:tenantId,
        OR: [
          { enrichment_status: 'NEEDS_ENRICHMENT' },
          { enrichment_status: 'PARTIALLY_ENRICHED' }
        ]
      },
      include: {
        photo_assets: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Add missing fields info
    const productsWithMissing = products.map(product => {
      const missing = getMissingFields(product);
      return {
        ...product,
        price: product.price.toString(),
        missing
      };
    });

    return res.json({
      success: true,
      products: productsWithMissing,
      total: productsWithMissing.length
    });
  } catch (error) {
    console.error('[Products] Get needs enrichment error:', error);
    return res.status(500).json({ 
      error: 'Failed to get products needing enrichment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/products/:productId/enrichment-status
 * 
 * Get enrichment status for a specific product
 */
router.get('/:productId/enrichment-status', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const user = req.user as any;
    const tenantId = user?.tenantIds?.[0]; // Get first tenant

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const product = await prisma.inventory_items.findUnique({
      where: { id: productId },
      include: { photo_assets: true }
    });

    if (!product || product.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const missing = getMissingFields(product);

    return res.json({
      success: true,
      enrichment_status: product.enrichment_status,
      source: product.source,
      enrichedAt: product.enriched_at,
      enrichedBy: product.enriched_by,
      enrichedFromBarcode: product.enriched_from_barcode,
      missing,
      photoCount: product.photo_assets.length
    });
  } catch (error) {
    console.error('[Products] Get enrichment status error:', error);
    return res.status(500).json({ 
      error: 'Failed to get enrichment status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
