/**
 * Behavior Tracking API Routes
 * Integrates BehaviorTrackingService with Express API
 * 
 * Auth0 Integration:
 * - User identity extracted server-side from Auth0 session
 * - Supports both authenticated and anonymous users
 * - userId determined by Auth0 session (not client-provided)
 */

import { Router } from 'express';
import BehaviorTrackingService from '../services/BehaviorTrackingService';
import { extractTrackingIdentity, TrackingIdentity } from '../utils/auth0Identity';

const router = Router();

// Get singleton instance
const behaviorService = BehaviorTrackingService.getInstance();

/**
 * Track a behavior event
 * POST /api/behavior/events
 * 
 * Auth0: User identity extracted server-side from session
 */
router.post('/events', async (req, res) => {
  try {
    // Extract identity from Auth0 session (server-side)
    const identity: TrackingIdentity = await extractTrackingIdentity(req);
    
    const eventData = {
      eventType: req.body.eventType,
      userId: identity.userId,              // Server-determined (null if anonymous)
      sessionId: identity.sessionId,        // Server-determined
      isAuthenticated: identity.isAuthenticated,  // Track auth status
      tenantId: req.body.tenantId || identity.tenantId,
      url: req.body.url,
      referrer: req.body.referrer,
      userAgent: req.get('User-Agent'),
      metadata: req.body.metadata || {},
      priority: req.body.priority || 'medium',
      eventData: req.body.eventData || {}
    };

    const event = await behaviorService.trackEvent(eventData);
    
    res.status(201).json({
      success: true,
      data: {
        event,
        identity: {
          userId: identity.userId,
          isAuthenticated: identity.isAuthenticated
        },
        timestamp: new Date().toISOString()
      },
      message: 'Behavior event tracked successfully'
    });
  } catch (error) {
    console.error('Behavior event tracking failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track behavior event',
      error: (error as Error).message
    });
  }
});

/**
 * Batch track multiple events
 * POST /api/behavior/events/batch
 * 
 * Auth0: User identity extracted server-side, applied to all events in batch
 */
router.post('/events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Events array is required and must not be empty'
      });
    }
    
    // Extract identity once for entire batch
    const identity: TrackingIdentity = await extractTrackingIdentity(req);
    
    // Enrich all events with server-determined identity
    const enrichedEvents = events.map(event => ({
      ...event,
      userId: identity.userId,
      sessionId: identity.sessionId,
      isAuthenticated: identity.isAuthenticated
    }));
    
    await behaviorService.batchEvents(enrichedEvents);
    
    res.json({
      success: true,
      data: {
        processed: events.length,
        identity: {
          userId: identity.userId,
          isAuthenticated: identity.isAuthenticated
        },
        timestamp: new Date().toISOString()
      },
      message: `${events.length} events batch tracked successfully`
    });
  } catch (error) {
    console.error('Batch event tracking failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch track events',
      error: (error as Error).message
    });
  }
});

/**
 * Save session data
 * POST /api/behavior/sessions
 *
 * Auth0: User identity extracted server-side from session
 */
router.post('/sessions', async (req, res) => {
  try {
    const identity: TrackingIdentity = await extractTrackingIdentity(req);

    const sessionData = {
      ...req.body,
      userId: identity.userId,
      sessionId: identity.sessionId,
      isAuthenticated: identity.isAuthenticated
    };

    const session = await behaviorService.saveSession(sessionData);

    res.status(201).json({
      success: true,
      data: {
        session,
        identity: {
          userId: identity.userId,
          isAuthenticated: identity.isAuthenticated
        },
        timestamp: new Date().toISOString()
      },
      message: 'Session data saved successfully'
    });
  } catch (error) {
    console.error('Session save failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save session data',
      error: (error as Error).message
    });
  }
});

/**
 * Get behavior analytics
 * GET /api/behavior/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const analytics = await behaviorService.getBehaviorAnalytics(hours);
    
    res.json({
      success: true,
      data: {
        analytics,
        timeRange: `${hours} hours`,
        timestamp: new Date().toISOString()
      },
      message: 'Behavior analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Behavior analytics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve behavior analytics',
      error: (error as Error).message
    });
  }
});

/**
 * Get user behavior patterns
 * GET /api/behavior/patterns/:userId
 */
router.get('/patterns/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    
    const patterns = await behaviorService.getUserBehaviorPatterns(userId, days);
    
    res.json({
      success: true,
      data: {
        userId,
        patterns,
        days,
        timestamp: new Date().toISOString()
      },
      message: 'User behavior patterns retrieved successfully'
    });
  } catch (error) {
    console.error('User behavior patterns retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user behavior patterns',
      error: (error as Error).message
    });
  }
});

/**
 * Get session data
 * GET /api/behavior/session/:sessionId
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = await behaviorService.getSessionData(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
        error: `No session found for ID: ${sessionId}`
      });
    }
    
    res.json({
      success: true,
      data: {
        session: sessionData,
        timestamp: new Date().toISOString()
      },
      message: 'Session data retrieved successfully'
    });
  } catch (error) {
    console.error('Session data retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve session data',
      error: (error as Error).message
    });
  }
});

/**
 * End a session
 * POST /api/behavior/session/:sessionId/end
 */
router.post('/session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    await behaviorService.endSession(sessionId);
    
    res.json({
      success: true,
      data: {
        sessionId,
        timestamp: new Date().toISOString()
      },
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('Session ending failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end session',
      error: (error as Error).message
    });
  }
});

/**
 * Update tracking configuration
 * PUT /api/behavior/config
 */
router.put('/config', async (req, res) => {
  try {
    const config = req.body;
    
    await behaviorService.updateConfig(config);
    
    res.json({
      success: true,
      data: {
        config,
        timestamp: new Date().toISOString()
      },
      message: 'Tracking configuration updated successfully'
    });
  } catch (error) {
    console.error('Tracking config update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tracking configuration',
      error: (error as Error).message
    });
  }
});

/**
 * Get tracking configuration
 * GET /api/behavior/config
 */
router.get('/config', async (req, res) => {
  try {
    const config = await behaviorService.getConfig();
    
    res.json({
      success: true,
      data: {
        config,
        timestamp: new Date().toISOString()
      },
      message: 'Tracking configuration retrieved successfully'
    });
  } catch (error) {
    console.error('Tracking config retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tracking configuration',
      error: (error as Error).message
    });
  }
});

/**
 * Get behavior metrics
 * GET /api/behavior/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // This would be implemented in the service
    // For now, return basic metrics from the service
    const hours = parseInt(req.query.hours as string) || 24;
    const analytics = await behaviorService.getBehaviorAnalytics(hours);
    
    const metrics = {
      totalEvents: analytics.totalEvents,
      uniqueUsers: analytics.uniqueUsers,
      uniqueSessions: analytics.uniqueSessions,
      averageSessionDuration: analytics.averageSessionDuration,
      bounceRate: analytics.bounceRate,
      topPages: analytics.topPages,
      topEvents: analytics.topEvents
    };
    
    res.json({
      success: true,
      metrics,
      message: 'Behavior metrics retrieved successfully'
    });
  } catch (error) {
    console.error('Behavior metrics retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve behavior metrics',
      message: (error as Error).message
    });
  }
});

export default router;