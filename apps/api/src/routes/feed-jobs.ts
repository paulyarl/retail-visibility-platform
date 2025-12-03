import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { Flags } from '../config';
import { generateQuickStart } from '../lib/id-generator';

const router = Router();

// Validation schemas
const createFeedJobSchema = z.object({
  tenantId: z.string().cuid(),
  sku: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

const updateJobStatusSchema = z.object({
  jobStatus: z.enum(['queued', 'processing', 'success', 'failed']),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
  result: z.record(z.string(), z.any()).optional(),
});

/**
 * POST /api/feed-jobs
 * Create a new feed push job
 */
router.post('/', async (req, res) => {
  try {
    const body = createFeedJobSchema.parse(req.body);

    // Block feed pushes for fully frozen tenants, but allow google_only fallback
    // tenants to push feeds while they are active and within the maintenance window.
    const tenant = await prisma.tenants.findUnique({
      where: { id: body.tenantId },
      select: { subscription_tier: true, subscription_status: true, trial_ends_at: true },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
      });
    }

    const tier = tenant.subscription_tier || 'starter';
    const status = tenant.subscription_status || 'active';
    const now = new Date();
    const isInactive = status === 'canceled' || status === 'expired';

    const inMaintenanceWindow =
      tier === 'google_only' &&
      status === 'active' &&
      (!tenant.trial_ends_at || now < tenant.trial_ends_at);

    const isFullyFrozen = isInactive || (tier === 'google_only' && !inMaintenanceWindow);

    if (isFullyFrozen) {
      return res.status(403).json({
        success: false,
        error: 'subscription_read_only',
        message: 'Your account is in read-only visibility mode. Upgrade to sync products to Google.',
        subscriptionTier: tier,
        subscriptionStatus: status,
      });
    }

    // Optional enforcement: block feed pushes when categories are missing/unmapped
    if (Flags.FEED_ALIGNMENT_ENFORCE === true) {
      const tenantId = body.tenantId;

      // Build item filter: active + public items
      const baseWhere: any = {
        tenant_id: tenantId,
        item_status: 'active',
        visibility: 'public',
      };
      if (body.sku) {
        baseWhere.OR = [
          { sku: { equals: body.sku } },
          { id: { equals: body.sku } },
        ];
      }

      const items = await prisma.inventory_items.findMany({
        where: baseWhere,
        select: { id: true, sku: true, category_path: true },
        take: body.sku ? 1 : 2000, // cap to avoid huge scans; job processor can chunk
      });

      const missingCategory: Array<{ id: string; sku: string | null } > = [];
      const unmapped: Array<{ id: string; sku: string | null; category_path: string[] } > = [];

      // Pre-load mapped slugs → googleCategoryId for efficiency
      // Collect slugs from items
      const slugs = new Set<string>();
      for (const it of items) {
        const path = (it as any).categoryPath as string[] | null;
        if (!path || path.length === 0) continue;
        const leaf = path[path.length - 1];
        if (leaf) slugs.add(leaf);
      }
      const slugList = Array.from(slugs);
      const catMap: Record<string, string | null> = {};
      if (slugList.length > 0) {
        const cats = await prisma.directory_category.findMany({
          where: { tenantId: tenantId, slug: { in: slugList }, isActive: true },
          select: { slug: true, googleCategoryId: true },
        });
        for (const c of cats) catMap[c.slug] = c.googleCategoryId;
      }

      for (const it of items) {
        const path = it.category_path as string[] | null;
        const sku = typeof it.sku === 'string' ? it.sku : null;
        if (!path || path.length === 0) {
          missingCategory.push({ id: it.id, sku });
          continue;
        }
        const leaf = path[path.length - 1];
        const gId = leaf ? catMap[leaf] ?? null : null;
        if (!gId) {
          unmapped.push({ id: it.id, sku, category_path: path });
        }
      }

      if (missingCategory.length > 0 || unmapped.length > 0) {
        return res.status(422).json({
          success: false,
          error: 'alignment_required',
          message: 'Some products are missing categories or use categories not aligned to Google taxonomy.',
          details: {
            missingCategoryCount: missingCategory.length,
            unmappedCount: unmapped.length,
            examples: {
              missingCategory: missingCategory.slice(0, 10),
              unmapped: unmapped.slice(0, 10),
            },
            nextSteps: [
              'Open Categories: align unmapped categories to Google taxonomy',
              'Assign categories to uncategorized products',
              'Re-run Precheck before pushing feed',
            ],
          },
        });
      }
    }

    const job = await prisma.feed_push_jobs_list.create({
      data: {
        id: generateQuickStart("feed"), // Generate unique ID
        tenant_id: body.tenantId,
        sku: body.sku,
        payload: body.payload as any || {},
        job_status: 'queued',
        updated_at: new Date(), // Set updatedAt explicitly
      },
    });

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,  // Changed from error.errors to error.issues
      });
    }

    console.error('Error creating feed job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create feed job',
    });
  }
});

/**
 * GET /api/feed-jobs
 * List feed push jobs with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      tenantId,
      status,
      limit = '50',
      offset = '0',
    } = req.query;

    const where: any = {};
    
    if (tenantId) {
      where.tenantId = tenantId as string;
    }
    
    if (status) {
      where.job_status = status as string;
    }

    const [jobs, total] = await Promise.all([
      prisma.feed_push_jobs_list.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.feed_push_jobs_list.count({ where }),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Error fetching feed jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feed jobs',
    });
  }
});

/**
 * GET /api/feed-jobs/:id
 * Get a specific feed push job
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.feed_push_jobs_list.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Feed job not found',
      });
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Error fetching feed job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feed job',
    });
  }
});

/**
 * PATCH /api/feed-jobs/:id/status
 * Update job status (for job processor)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const body = updateJobStatusSchema.parse(req.body);

    const updateData: any = {
      jobStatus: body.jobStatus,
      updatedAt: new Date(),
    };

    if (body.jobStatus === 'processing') {
      updateData.lastAttempt = new Date();
    }

    if (body.jobStatus === 'success') {
      updateData.completed_at = new Date();
      updateData.result = body.result;
    }

    if (body.jobStatus === 'failed') {
      updateData.errorMessage = body.errorMessage;
      updateData.errorCode = body.errorCode;
      
      // Increment retry count
      const currentJob = await prisma.feed_push_jobs_list.findUnique({
        where: { id },
        select: { retry_count: true, max_retries: true },
      });

      if (currentJob) {
        updateData.retry_count = currentJob.retry_count + 1;
        
        // Calculate next retry time if not exceeded max retries
        if (currentJob.retry_count + 1 < currentJob.max_retries) {
          const delays = [60, 300, 900, 3600, 3600]; // 1m, 5m, 15m, 1h, 1h
          const delaySeconds = delays[currentJob.retry_count] || 3600;
          updateData.nextRetry = new Date(Date.now() + delaySeconds * 1000);
          updateData.jobStatus = 'queued'; // Re-queue for retry
        } else {
          updateData.completed_at = new Date();
        }
      }
    }

    const job = await prisma.feed_push_jobs_list.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error updating feed job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update feed job status',
    });
  }
});

/**
 * GET /api/feed-jobs/ready
 * Get jobs ready for processing (queued and past retry time)
 */
router.get('/queue/ready', async (req, res) => {
  try {
    const { limit = '10' } = req.query;

    const jobs = await prisma.feed_push_jobs_list.findMany({
      where: {
        job_status: 'queued',
        OR: [
          { next_retry: null },
          { next_retry: { lte: new Date() } },
        ],
      },
      orderBy: { created_at: 'asc' },
      take: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error('Error fetching ready jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ready jobs',
    });
  }
});

/**
 * GET /api/feed-jobs/stats
 * Get job statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const { tenantId } = req.query;

    const where: any = tenantId ? { tenantId: tenantId as string } : {};

    const [
      totalJobs,
      queuedJobs,
      processingJobs,
      successJobs,
      failedJobs,
    ] = await Promise.all([
      prisma.feed_push_jobs_list.count({ where }),
      prisma.feed_push_jobs_list.count({ where: { ...where, job_status: 'queued' } }),
      prisma.feed_push_jobs_list.count({ where: { ...where, job_status: 'processing' } }),
      prisma.feed_push_jobs_list.count({ where: { ...where, job_status: 'success' } }),
      prisma.feed_push_jobs_list.count({ where: { ...where, job_status: 'failed' } }),
    ]);

    const successRate = totalJobs > 0 
      ? ((successJobs / totalJobs) * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      data: {
        total: totalJobs,
        queued: queuedJobs,
        processing: processingJobs,
        success: successJobs,
        failed: failedJobs,
        successRate: parseFloat(successRate),
      },
    });
  } catch (error) {
    console.error('Error fetching job stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job statistics',
    });
  }
});

/**
 * DELETE /api/feed-jobs/:id
 * Delete a feed push job (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.feed_push_jobs_list.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Feed job deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting feed job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete feed job',
    });
  }
});

export default router;
