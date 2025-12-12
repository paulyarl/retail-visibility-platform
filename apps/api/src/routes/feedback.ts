import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { generateQuickStart } from '../lib/id-generator';

const router = Router();

// Validation schemas
const submitFeedbackSchema = z.object({
  tenantId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  feedback: z.record(z.string(), z.any()),
  score: z.number().int().min(1).max(5),
  category: z.enum(['usability', 'performance', 'features', 'support']).optional(),
  context: z.string().optional(),
});

/**
 * POST /api/feedback
 * Submit feedback
 */
router.post('/', async (req, res) => {
  try {
    const body = submitFeedbackSchema.parse(req.body);

    const feedback = await prisma.outreach_feedback_list.create({
      data: {
        id: generateQuickStart("fbid"),
        tenant_id: body.tenantId || null,
        user_id: body.userId || null,
        feedback: body.feedback as any,
        score: body.score,
        category: body.category || null,
        context: body.context || null,
        updated_at: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback',
    });
  }
});

/**
 * GET /api/feedback
 * List feedback with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      tenantId,
      userId,
      category,
      minScore,
      maxScore,
      context,
      limit = '50',
      offset = '0',
    } = req.query;

    const where: any = {};
    
    if (tenantId) {
      where.tenantId = tenantId as string;
    }
    
    if (userId) {
      where.userId = userId as string;
    }
    
    if (category) {
      where.category = category as string;
    }
    
    if (context) {
      where.context = context as string;
    }
    
    if (minScore || maxScore) {
      where.score = {};
      if (minScore) where.score.gte = parseInt(minScore as string);
      if (maxScore) where.score.lte = parseInt(maxScore as string);
    }

    const [feedbacks, total] = await Promise.all([
      prisma.outreach_feedback_list.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.outreach_feedback_list.count({ where }),
    ]);

    res.json({
      success: true,
      data: feedbacks,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback',
    });
  }
});

/**
 * GET /api/feedback/:id
 * Get a specific feedback entry
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await prisma.outreach_feedback_list.findUnique({
      where: { id },
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Feedback not found',
      });
    }

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback',
    });
  }
});

/**
 * GET /api/feedback/analytics/summary
 * Get feedback analytics
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const { tenantId, days = '30' } = req.query;

    const where: any = {
      createdAt: {
        gte: new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000),
      },
    };

    if (tenantId) {
      where.tenantId = tenantId as string;
    }

    const feedbacks = await prisma.outreach_feedback_list.findMany({
      where,
      select: {
        score: true,
        category: true,
        context: true,
      },
    });

    const totalFeedback = feedbacks.length;
    const avgScore = totalFeedback > 0
      ? feedbacks.reduce((sum, f) => sum + f.score, 0) / totalFeedback
      : 0;

    const positiveCount = feedbacks.filter(f => f.score >= 4).length;
    const negativeCount = feedbacks.filter(f => f.score <= 2).length;
    const satisfactionRate = totalFeedback > 0
      ? (positiveCount / totalFeedback) * 100
      : 0;

    // Group by category
    const byCategory = feedbacks.reduce((acc, f) => {
      if (f.category) {
        acc[f.category] = (acc[f.category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Group by context
    const byContext = feedbacks.reduce((acc, f) => {
      if (f.context) {
        acc[f.context] = (acc[f.context] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Score distribution
    const scoreDistribution = feedbacks.reduce((acc, f) => {
      acc[f.score] = (acc[f.score] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    res.json({
      success: true,
      data: {
        summary: {
          totalFeedback,
          avgScore: parseFloat(avgScore.toFixed(2)),
          positiveCount,
          negativeCount,
          satisfactionRate: parseFloat(satisfactionRate.toFixed(2)),
        },
        distribution: {
          byCategory,
          byContext,
          byScore: scoreDistribution,
        },
        period: {
          days: parseInt(days as string),
          from: where.created_at.gte,
          to: new Date(),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching feedback analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback analytics',
    });
  }
});

/**
 * GET /api/feedback/pilot/kpis
 * Get pilot program KPIs
 */
router.get('/pilot/kpis', async (req, res) => {
  try {
    const { tenantId } = req.query;

    const where: any = {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    };

    if (tenantId) {
      where.tenantId = tenantId as string;
    }

    const feedbacks = await prisma.outreach_feedback_list.findMany({
      where,
      select: {
        score: true,
        tenant_id: true,
      },
    });

    const totalFeedback = feedbacks.length;
    const avgScore = totalFeedback > 0
      ? feedbacks.reduce((sum, f) => sum + f.score, 0) / totalFeedback
      : 0;

    const satisfactionCount = feedbacks.filter(f => f.score >= 4).length;
    const satisfactionRate = totalFeedback > 0
      ? (satisfactionCount / totalFeedback) * 100
      : 0;

    // Get feed accuracy (from feed_push_jobs)
    const feedJobsWhere: any = {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    };

    if (tenantId) {
      feedJobsWhere.tenantId = tenantId as string;
    }

    const [totalJobs, successJobs] = await Promise.all([
      prisma.feed_push_jobs_list.count({ where: feedJobsWhere }),
      prisma.feed_push_jobs_list.count({
        where: { ...feedJobsWhere, job_status: 'success' },
      }),
    ]);

    const feedAccuracy = totalJobs > 0
      ? (successJobs / totalJobs) * 100
      : 0;

    // Pilot KPI targets
    const kpis = {
      satisfaction: {
        current: parseFloat(satisfactionRate.toFixed(2)),
        target: 80,
        status: satisfactionRate >= 80 ? 'met' : 'not_met',
      },
      feedAccuracy: {
        current: parseFloat(feedAccuracy.toFixed(2)),
        target: 90,
        status: feedAccuracy >= 90 ? 'met' : 'not_met',
      },
      avgScore: {
        current: parseFloat(avgScore.toFixed(2)),
        target: 4.0,
        status: avgScore >= 4.0 ? 'met' : 'not_met',
      },
      totalFeedback: {
        current: totalFeedback,
        target: 10, // Minimum feedback entries
        status: totalFeedback >= 10 ? 'met' : 'not_met',
      },
    };

    const overallStatus = Object.values(kpis).every(kpi => kpi.status === 'met')
      ? 'all_met'
      : 'some_not_met';

    res.json({
      success: true,
      data: {
        kpis,
        overallStatus,
        period: 'last_30_days',
      },
    });
  } catch (error) {
    console.error('Error fetching pilot KPIs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pilot KPIs',
    });
  }
});

/**
 * DELETE /api/feedback/:id
 * Delete feedback (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.outreach_feedback_list.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Feedback deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete feedback',
    });
  }
});

export default router;
