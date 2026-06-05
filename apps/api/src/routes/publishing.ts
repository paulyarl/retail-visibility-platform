import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

interface PublishingJob {
  id: string;
  tenantId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date | null;
  completedAt: Date | null;
  error?: string;
}

interface ValidationResults {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * POST /api/publishing/publish
 * Publish a shop to the directory
 */
router.post('/publish', async (req, res) => {
  try {
    const { tenantId, shopData, publishOptions } = req.body;
    
    if (!tenantId || !shopData) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Tenant ID and shop data are required'
      });
    }
    
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
    
    // Create publishing job
    const publishingJob: PublishingJob = {
      id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      status: 'pending',
      startedAt: null,
      completedAt: null
    };
    
    // Store job data for later use (in production, use Redis or database)
    const jobData = {
      shopData,
      publishOptions: publishOptions || {
        publishToDirectory: true,
        publishToGoogle: false,
        notifyCustomers: false
      }
    };
    
    // Simulate async publishing process
    setTimeout(async () => {
      try {
        // Update job status to running
        publishingJob.status = 'running';
        publishingJob.startedAt = new Date();
        
        // Simulate publishing steps
        await new Promise(resolve => setTimeout(resolve, 2000)); // Validation step
        await new Promise(resolve => setTimeout(resolve, 3000)); // Directory publishing
        await new Promise(resolve => setTimeout(resolve, 2000)); // Finalization
        
        // Mark as completed
        publishingJob.status = 'completed';
        publishingJob.completedAt = new Date();
        
        // Update tenant metadata
        const existingMetadata = (tenant.metadata as Record<string, any>) || {};
        await prisma.tenants.update({
          where: { id: tenantId },
          data: {
            metadata: {
              ...existingMetadata,
              lastPublishedAt: new Date(),
              publishingHistory: [
                ...(existingMetadata.publishingHistory || []),
                {
                  jobId: publishingJob.id,
                  publishedAt: new Date(),
                  shopData: jobData.shopData,
                  publishOptions: jobData.publishOptions
                }
              ]
            }
          }
        });
        
      } catch (error) {
        publishingJob.status = 'failed';
        publishingJob.error = error instanceof Error ? error.message : 'Unknown error';
        publishingJob.completedAt = new Date();
      }
    }, 1000);
    
    res.json({
      success: true,
      data: {
        jobId: publishingJob.id,
        status: publishingJob.status,
        estimatedDuration: '7-10 seconds'
      },
      message: 'Publishing job started successfully'
    });
  } catch (error) {
    console.error('[Publish Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to start publishing job'
    });
  }
});

/**
 * GET /api/publishing/status/:jobId
 * Get publishing job status
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // In a real implementation, this would query the database
    // For now, return a mock response
    const jobStatus = {
      id: jobId,
      status: 'completed', // pending, running, completed, failed
      progress: 100,
      steps: [
        { name: 'Validation', status: 'completed', duration: '2s' },
        { name: 'Directory Publishing', status: 'completed', duration: '3s' },
        { name: 'Finalization', status: 'completed', duration: '2s' }
      ],
      createdAt: new Date(Date.now() - 7000),
      startedAt: new Date(Date.now() - 6000),
      completedAt: new Date(),
      error: null,
      results: {
        publishedUrl: `/shops/${jobId}`,
        directoryListing: true,
        googleSync: false
      }
    };
    
    res.json({
      success: true,
      data: jobStatus
    });
  } catch (error) {
    console.error('[Get Publishing Status Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch publishing status'
    });
  }
});

/**
 * GET /api/publishing/:tenantId/history
 * Get publishing history for a tenant
 */
router.get('/:tenantId/history', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
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
    const publishingHistory = metadata.publishingHistory || [];
    
    // Sort by most recent first
    const sortedHistory = publishingHistory.sort((a: any, b: any) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    
    res.json({
      success: true,
      data: {
        history: sortedHistory,
        total: sortedHistory.length,
        lastPublishedAt: sortedHistory.length > 0 ? sortedHistory[0].publishedAt : null
      }
    });
  } catch (error) {
    console.error('[Get Publishing History Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch publishing history'
    });
  }
});

/**
 * POST /api/publishing/validate
 * Validate shop data before publishing
 */
router.post('/validate', async (req, res) => {
  try {
    const { shopData } = req.body;
    
    if (!shopData) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Shop data is required'
      });
    }
    
    const validationResults: ValidationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };
    
    // Validate required fields
    const requiredFields = ['name', 'description', 'category'];
    for (const field of requiredFields) {
      if (!shopData[field]) {
        validationResults.isValid = false;
        validationResults.errors.push(`${field} is required`);
      }
    }
    
    // Validate name length
    if (shopData.name && shopData.name.length < 3) {
      validationResults.isValid = false;
      validationResults.errors.push('Shop name must be at least 3 characters');
    }
    
    if (shopData.name && shopData.name.length > 100) {
      validationResults.warnings.push('Shop name is quite long, consider shortening it');
    }
    
    // Validate description
    if (shopData.description && shopData.description.length < 50) {
      validationResults.recommendations.push('Consider adding more detail to your description for better visibility');
    }
    
    // Validate category
    const validCategories = ['grocery', 'fashion', 'electronics', 'home', 'health', 'sports'];
    if (shopData.category && !validCategories.includes(shopData.category)) {
      validationResults.warnings.push('Category might not be recognized, consider using a standard category');
    }
    
    // Check for contact info
    if (!shopData.contactInfo?.email && !shopData.contactInfo?.phone) {
      validationResults.recommendations.push('Add contact information for better customer engagement');
    }
    
    res.json({
      success: true,
      data: validationResults
    });
  } catch (error) {
    console.error('[Validate Shop Data Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to validate shop data'
    });
  }
});

/**
 * DELETE /api/publishing/:tenantId
 * Unpublish a shop from directory
 */
router.delete('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
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
    
    // Update tenant metadata to mark as unpublished
    const existingMetadata = (tenant.metadata as Record<string, any>) || {};
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        metadata: {
          ...existingMetadata,
          isPublished: false,
          unpublishedAt: new Date()
        }
      }
    });
    
    res.json({
      success: true,
      message: 'Shop unpublished successfully'
    });
  } catch (error) {
    console.error('[Unpublish Shop Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to unpublish shop'
    });
  }
});

export default router;
