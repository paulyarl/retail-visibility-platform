import { Router } from 'express';
import tenantSingletonService from '../services/TenantSingletonService';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/branding/:tenantId
 * Get branding settings for a tenant
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Use centralized tenant service with smart collision detection
    const tenantService = tenantSingletonService;
    const tenantInfo = await tenantService.getTenantInfo(tenantId);
    
    // Use smart slug with automatic collision detection
    const smartSlug = await tenantService.getTenantSlugSmart(tenantId);
    
    // Build branding data from tenant info
    const branding = {
      shopName: tenantInfo.businessName || tenantInfo.name,
      shopSlug: smartSlug, // Use smart slug with collision detection
      logo: tenantInfo.logo || null,
      primaryColor: tenantInfo.metadata?.primaryColor || '#3b82f6',
      secondaryColor: tenantInfo.metadata?.secondaryColor || '#64748b',
      backgroundColor: tenantInfo.metadata?.backgroundColor || '#ffffff',
      textColor: tenantInfo.metadata?.textColor || '#1f2937',
      accentColor: tenantInfo.metadata?.accentColor || '#10b981',
      customCSS: tenantInfo.metadata?.customCSS || '',
      theme: tenantInfo.metadata?.theme || 'default',
      favicon: tenantInfo.metadata?.favicon || null,
      bannerImage: tenantInfo.banner || null,
      contactInfo: {
        email: tenantInfo.contact?.email || '',
        phone: tenantInfo.contact?.phone || '',
        address: tenantInfo.location?.address || '',
        website: tenantInfo.contact?.website || ''
      },
      socialLinks: tenantInfo.socialLinks || {
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: ''
      },
      description: tenantInfo.description || ''
    };
    
    res.json({
      success: true,
      data: branding
    });
  } catch (error) {
    logger.error('[Get Branding Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to get branding settings'
    });
  }
});

/**
 * PUT /api/branding/:tenantId
 * Update branding settings for a tenant
 */
router.put('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const brandingData = req.body;
    
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('../prisma');
    
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Tenant not found'
      });
    }
    
    // Update tenant metadata with branding settings
    const existingMetadata = (tenant.metadata as Record<string, any>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      logo: brandingData.logo,
      primaryColor: brandingData.primaryColor,
      secondaryColor: brandingData.secondaryColor,
      backgroundColor: brandingData.backgroundColor,
      textColor: brandingData.textColor,
      accentColor: brandingData.accentColor,
      customCSS: brandingData.customCSS,
      theme: brandingData.theme,
      favicon: brandingData.favicon,
      bannerImage: brandingData.bannerImage,
      contactInfo: brandingData.contactInfo,
      socialLinks: brandingData.socialLinks
    };
    
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        metadata: updatedMetadata
      }
    });
    
    res.json({
      success: true,
      data: {
        ...brandingData,
        shopName: tenant.name,
        shopSlug: tenant.slug
      },
      message: 'Branding settings updated successfully'
    });
  } catch (error) {
    logger.error('[Update Branding Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update branding settings'
    });
  }
});

/**
 * POST /api/branding/:tenantId/logo
 * Upload logo for tenant
 */
router.post('/:tenantId/logo', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('../prisma');
    
    // This would integrate with your file upload service
    // For now, return a mock response
    const logoUrl = `https://example.com/logos/${tenantId}-${Date.now()}.png`;
    
    // For now, just return success since settings don't exist
    // In production, this would update a branding_settings table
    res.json({
      success: true,
      data: { logoUrl },
      message: 'Logo uploaded successfully (mock implementation)'
    });
  } catch (error) {
    logger.error('[Upload Logo Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to upload logo'
    });
  }
});

/**
 * GET /api/branding/:tenantId/preview
 * Get branding preview (CSS variables)
 */
router.get('/:tenantId/preview', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('../prisma');
    
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true }
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Tenant not found'
      });
    }
    
    const metadata = (tenant.metadata as Record<string, any>) || {};
    const cssVariables = `
:root {
  --color-primary: ${metadata.primaryColor || '#3b82f6'};
  --color-secondary: ${metadata.secondaryColor || '#64748b'};
  --color-background: ${metadata.backgroundColor || '#ffffff'};
  --color-text: ${metadata.textColor || '#1f2937'};
  --color-accent: ${metadata.accentColor || '#10b981'};
}
    `.trim();
    
    res.json({
      success: true,
      data: {
        cssVariables,
        customCSS: metadata.customCSS || '',
        theme: metadata.theme || 'default'
      }
    });
  } catch (error) {
    logger.error('[Get Branding Preview Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to generate branding preview'
    });
  }
});

/**
 * DELETE /api/branding/:tenantId/logo
 * Remove logo for tenant
 */
router.delete('/:tenantId/logo', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('../prisma');
    
    // For now, just return success since settings don't exist
    // In production, this would update a branding_settings table
    res.json({
      success: true,
      message: 'Logo removed successfully (mock implementation)'
    });
  } catch (error) {
    logger.error('[Remove Logo Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to remove logo'
    });
  }
});

export default router;
