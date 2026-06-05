/**
 * Admin Sentry Monitoring API Routes
 *
 * Provides endpoints for platform admins to fetch Sentry monitoring data.
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requirePlatformAdmin } from '../../middleware/auth';
import { SentryApiService } from '../../services/SentryApiService';

const router = Router();

/**
 * GET /api/admin/sentry
 * Fetch Sentry monitoring data for admin dashboard
 * Permission: Platform admin only
 */
router.get('/', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN SENTRY] Request received from platform admin');

    // Check if Sentry API is configured
    const sentryToken = process.env.SENTRY_API_TOKEN;
    const sentryOrg = process.env.SENTRY_ORG_SLUG;

    if (!sentryToken || !sentryOrg) {
      // Return mock data if Sentry API is not configured
      return res.json({
        configured: false,
        message: 'Sentry API not configured. Add SENTRY_API_TOKEN and SENTRY_ORG_SLUG to environment variables.',
        mockData: {
          metrics: [
            {
              title: 'Total Errors',
              value: '1,247',
              change: '+12%',
              trend: 'up',
              description: 'Errors captured in the last 24 hours'
            },
            {
              title: 'Error Rate',
              value: '0.3%',
              change: '-5%',
              trend: 'down',
              description: 'Percentage of sessions with errors'
            },
            {
              title: 'Active Issues',
              value: '89',
              change: '-15%',
              trend: 'down',
              description: 'Unresolved error issues'
            },
            {
              title: 'Performance Score',
              value: '92',
              change: '+3%',
              trend: 'up',
              description: 'Average performance score'
            }
          ],
          projects: [
            {
              id: '1',
              name: 'Web App',
              slug: 'web',
              platform: 'javascript-nextjs',
              status: 'active',
              lastEvent: '2 minutes ago'
            },
            {
              id: '2',
              name: 'API Server',
              slug: 'api',
              platform: 'node-express',
              status: 'active',
              lastEvent: '1 minute ago'
            }
          ]
        }
      });
    }

    // Initialize Sentry API service
    const sentryService = new SentryApiService(sentryToken, sentryOrg);

    // Fetch data from Sentry API in parallel
    console.log('[ADMIN SENTRY] Fetching data from Sentry API...');

    const [projectsResponse, issuesResponse, statsResponse] = await Promise.all([
      sentryService.getProjects(),
      sentryService.getIssues({ limit: 50 }),
      sentryService.getStats({
        since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Last 7 days
        resolution: '1d'
      })
    ]);

    // Check for API errors
    if (projectsResponse.error) {
      console.error('[ADMIN SENTRY] Projects API error:', projectsResponse.error);
      return res.status(500).json({
        configured: true,
        error: `Failed to fetch projects: ${projectsResponse.error}`
      });
    }

    if (issuesResponse.error) {
      console.error('[ADMIN SENTRY] Issues API error:', issuesResponse.error);
      return res.status(500).json({
        configured: true,
        error: `Failed to fetch issues: ${issuesResponse.error}`
      });
    }

    if (statsResponse.error) {
      console.error('[ADMIN SENTRY] Stats API error:', statsResponse.error);
      return res.status(500).json({
        configured: true,
        error: `Failed to fetch stats: ${statsResponse.error}`
      });
    }

    // Transform data for frontend
    const transformedData = sentryService.transformForFrontend(
      projectsResponse.data || [],
      issuesResponse.data || [],
      statsResponse.data || {}
    );

    console.log(`[ADMIN SENTRY] Successfully fetched ${transformedData.projects.length} projects and ${transformedData.metrics.length} metrics`);

    return res.json({
      configured: true,
      message: 'Sentry API data fetched successfully',
      data: transformedData
    });

  } catch (error) {
    console.error('Error fetching Sentry data:', error);
    return res.status(500).json({
      configured: true,
      error: 'Failed to fetch Sentry data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
