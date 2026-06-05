/**
 * Security Telemetry API Routes
 * 
 * Handles batched security event data collection from frontend
 * Optimized for high-volume security monitoring with minimal performance impact
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Security telemetry doesn't require authentication for collection
// But we can optionally add rate limiting if needed

/**
 * POST /api/security/telemetry/rate_limit_exceeded
 * Handle batched rate limit exceeded events
 */
router.post('/rate_limit_exceeded', async (req: Request, res: Response) => {
  try {
    const { events, batchMetadata } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid events data' });
    }

    console.log(`[Security Telemetry] Received ${events.length} rate limit events`);

    // Process each event and create security alerts if needed
    const processedEvents = [];
    
    for (const event of events) {
      try {
        // Create security alert for rate limit exceeded
        const alertData = {
          type: 'rate_limit_exceeded',
          severity: event.severity || 'warning',
          title: 'Rate Limit Exceeded - Telemetry',
          message: `Rate limit exceeded on ${event.metadata?.endpoint || 'unknown endpoint'} (${event.metadata?.rateAnalysis?.currentRate || 0} req/min)`,
          metadata: {
            ...event.metadata,
            telemetrySource: 'frontend_batch',
            batchId: batchMetadata?.clientTimestamp,
            originalTimestamp: event.timestamp,
            sessionId: event.sessionId,
            userId: event.userId
          }
        };

        // Only create alert if it's not a duplicate (check recent alerts)
        const recentAlert = await prisma.$queryRaw<any[]>`
          SELECT * FROM security_alerts 
          WHERE type = 'rate_limit_exceeded'
            AND created_at >= ${new Date(Date.now() - 5 * 60 * 1000)}
            AND metadata->>'endpoint' = ${event.metadata?.endpoint || ''}
          LIMIT 1
        `;

        if (!recentAlert) {
          await prisma.security_alerts.create({
            data: {
              user_id: event.userId || 'system',
              type: alertData.type,
              severity: alertData.severity,
              title: alertData.title,
              message: alertData.message,
              metadata: alertData.metadata
            }
          });
          processedEvents.push({ ...event, alertCreated: true });
        } else {
          processedEvents.push({ ...event, alertCreated: false, reason: 'duplicate' });
        }
      } catch (error) {
        console.error('[Security Telemetry] Error processing rate limit event:', error);
        processedEvents.push({ ...event, alertCreated: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Return processing results
    res.json({
      success: true,
      processed: processedEvents.length,
      alertsCreated: processedEvents.filter(e => e.alertCreated).length,
      duplicates: processedEvents.filter(e => !e.alertCreated && e.reason === 'duplicate').length,
      errors: processedEvents.filter(e => e.error).length,
      batchMetadata: {
        ...batchMetadata,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Security Telemetry] Error processing rate limit batch:', error);
    res.status(500).json({ error: 'Failed to process security telemetry' });
  }
});

/**
 * POST /api/security/telemetry/auth_failure
 * Handle batched authentication failure events
 */
router.post('/auth_failure', async (req: Request, res: Response) => {
  try {
    const { events, batchMetadata } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid events data' });
    }

    console.log(`[Security Telemetry] Received ${events.length} auth failure events`);

    const processedEvents = [];
    
    for (const event of events) {
      try {
        const alertData = {
          type: 'auth_failure',
          severity: event.severity || 'critical',
          title: 'Authentication Failure - Telemetry',
          message: `Authentication failure detected for ${event.metadata?.ipAddress || 'unknown IP'}`,
          metadata: {
            ...event.metadata,
            telemetrySource: 'frontend_batch',
            batchId: batchMetadata?.clientTimestamp,
            originalTimestamp: event.timestamp,
            sessionId: event.sessionId,
            userId: event.userId
          }
        };

        // Create security alert for auth failure
        await prisma.security_alerts.create({
          data: {
            user_id: null, // Use null for all telemetry events to avoid foreign key issues
            type: alertData.type,
            severity: alertData.severity,
            title: alertData.title,
            message: alertData.message,
            metadata: alertData.metadata
          }
        });

        processedEvents.push({ ...event, alertCreated: true });
      } catch (error) {
        console.error('[Security Telemetry] Error processing auth failure event:', error);
        processedEvents.push({ ...event, alertCreated: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({
      success: true,
      processed: processedEvents.length,
      alertsCreated: processedEvents.filter(e => e.alertCreated).length,
      errors: processedEvents.filter(e => e.error).length,
      batchMetadata: {
        ...batchMetadata,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Security Telemetry] Error processing auth failure batch:', error);
    res.status(500).json({ error: 'Failed to process security telemetry' });
  }
});

/**
 * POST /api/security/telemetry/suspicious_activity
 * Handle batched suspicious activity events
 */
router.post('/suspicious_activity', async (req: Request, res: Response) => {
  try {
    const { events, batchMetadata } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid events data' });
    }

    console.log(`[Security Telemetry] Received ${events.length} suspicious activity events`);

    const processedEvents = [];
    
    for (const event of events) {
      try {
        const alertData = {
          type: 'suspicious_activity',
          severity: event.severity || 'warning',
          title: 'Suspicious Activity - Telemetry',
          message: `Suspicious activity detected: ${event.metadata?.threatLevel || 'unknown'} risk level`,
          metadata: {
            ...event.metadata,
            telemetrySource: 'frontend_batch',
            batchId: batchMetadata?.clientTimestamp,
            originalTimestamp: event.timestamp,
            sessionId: event.sessionId,
            userId: event.userId
          }
        };

        // Create security alert for suspicious activity
        await prisma.security_alerts.create({
          data: {
            user_id: null, // Use null for all telemetry events to avoid foreign key issues
            type: alertData.type,
            severity: alertData.severity,
            title: alertData.title,
            message: alertData.message,
            metadata: alertData.metadata
          }
        });

        processedEvents.push({ ...event, alertCreated: true });
      } catch (error) {
        console.error('[Security Telemetry] Error processing suspicious activity event:', error);
        processedEvents.push({ ...event, alertCreated: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({
      success: true,
      processed: processedEvents.length,
      alertsCreated: processedEvents.filter(e => e.alertCreated).length,
      errors: processedEvents.filter(e => e.error).length,
      batchMetadata: {
        ...batchMetadata,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Security Telemetry] Error processing suspicious activity batch:', error);
    res.status(500).json({ error: 'Failed to process security telemetry' });
  }
});

/**
 * POST /api/security/telemetry/security_incident
 * Handle batched security incident events
 */
router.post('/security_incident', async (req: Request, res: Response) => {
  try {
    const { events, batchMetadata } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid events data' });
    }

    console.log(`[Security Telemetry] Received ${events.length} security incident events`);

    const processedEvents = [];
    
    for (const event of events) {
      try {
        const alertData = {
          type: 'security_incident',
          severity: event.severity || 'critical',
          title: 'Security Incident - Telemetry',
          message: `Security incident detected: ${event.metadata?.threatLevel || 'unknown'} severity`,
          metadata: {
            ...event.metadata,
            telemetrySource: 'frontend_batch',
            batchId: batchMetadata?.clientTimestamp,
            originalTimestamp: event.timestamp,
            sessionId: event.sessionId,
            userId: event.userId === 'system' ? 'system' : null // Use null for invalid user IDs
          }
        };

        // Create security alert for security incident
        await prisma.security_alerts.create({
          data: {
            user_id: null, // Use null for all telemetry events to avoid foreign key issues
            type: alertData.type,
            severity: alertData.severity,
            title: alertData.title,
            message: alertData.message,
            metadata: alertData.metadata
          }
        });

        processedEvents.push({ ...event, alertCreated: true });
      } catch (error) {
        console.error('[Security Telemetry] Error processing security incident event:', error);
        processedEvents.push({ ...event, alertCreated: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({
      success: true,
      processed: processedEvents.length,
      alertsCreated: processedEvents.filter(e => e.alertCreated).length,
      errors: processedEvents.filter(e => e.error).length,
      batchMetadata: {
        ...batchMetadata,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Security Telemetry] Error processing security incident batch:', error);
    res.status(500).json({ error: 'Failed to process security telemetry' });
  }
});

/**
 * GET /api/security/telemetry/metrics
 * Get telemetry collection metrics (admin only)
 */
router.get('/metrics', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get telemetry metrics from database
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      totalTelemetryEvents,
      telemetryAlertsCreated
    ] = await Promise.all([
      // Count telemetry events (approximate from security alerts with telemetry source)
      prisma.security_alerts.count({
        where: {
          created_at: {
            gte: last24Hours
          },
          metadata: {
            path: ['telemetrySource'],
            equals: 'frontend_batch'
          }
        }
      }),
      // Count alerts created from telemetry (same query)
      prisma.security_alerts.count({
        where: {
          created_at: {
            gte: last24Hours
          },
          metadata: {
            path: ['telemetrySource'],
            equals: 'frontend_batch'
          }
        }
      })
    ]);

    // For now, provide simple metrics without complex grouping
    const telemetryByType: Array<{ eventType: string; count: number }> = [];
    const telemetryByHour: Array<{ hour: number; count: number }> = [];

    res.json({
      success: true,
      metrics: {
        totalTelemetryEvents: totalTelemetryEvents,
        telemetryAlertsCreated: telemetryAlertsCreated,
        telemetryByType: telemetryByType,
        telemetryByHour: telemetryByHour,
        timeRange: '24 hours',
        generatedAt: new Date().toISOString(),
        note: 'Detailed grouping metrics temporarily disabled due to Prisma compatibility issues'
      }
    });

  } catch (error) {
    console.error('[Security Telemetry] Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get telemetry metrics' });
  }
});

/**
 * POST /api/security/telemetry/batch
 * Generic batch endpoint for mixed event types
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { events, batchMetadata } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400). json({ error: 'Invalid events data' });
    }

    console.log(`[Security Telemetry] Received mixed batch of ${events.length} events`);

    // Group events by type and route to appropriate handler
    const eventsByType = events.reduce((acc, event) => {
      if (!acc[event.type]) {
        acc[event.type] = [];
      }
      acc[event.type].push(event);
      return acc;
    }, {} as Record<string, any[]>);

    const results: Record<string, any> = {};

    // Process each event type
    for (const [eventType, typeEvents] of Object.entries(eventsByType)) {
      try {
        const events = typeEvents as any[]; // Type assertion for safety
        
        switch (eventType) {
          case 'rate_limit_exceeded':
            // Process rate limit events directly
            for (const event of events) {
              await prisma.security_alerts.create({
                data: {
                  user_id: null, // Use null for all telemetry events to avoid foreign key issues
                  type: 'rate_limit_exceeded',
                  severity: event.severity || 'warning',
                  title: 'Rate Limit Exceeded - Batch',
                  message: `Rate limit exceeded on ${event.metadata?.endpoint || 'unknown'}`,
                  metadata: {
                    ...event.metadata,
                    telemetrySource: 'frontend_batch',
                    batchId: batchMetadata?.clientTimestamp
                  }
                }
              });
            }
            results[eventType] = { success: true, processed: events.length };
            break;
            
          case 'auth_failure':
            // Process auth failure events directly
            for (const event of events) {
              await prisma.security_alerts.create({
                data: {
                  user_id: null, // Use null for all telemetry events to avoid foreign key issues
                  type: 'auth_failure',
                  severity: event.severity || 'critical',
                  title: 'Authentication Failure - Batch',
                  message: `Authentication failure detected`,
                  metadata: {
                    ...event.metadata,
                    telemetrySource: 'frontend_batch',
                    batchId: batchMetadata?.clientTimestamp
                  }
                }
              });
            }
            results[eventType] = { success: true, processed: events.length };
            break;
            
          case 'suspicious_activity':
            // Process suspicious activity events directly
            for (const event of events) {
              await prisma.security_alerts.create({
                data: {
                  user_id: null, // Use null for all telemetry events to avoid foreign key issues
                  type: 'suspicious_activity',
                  severity: event.severity || 'warning',
                  title: 'Suspicious Activity - Batch',
                  message: `Suspicious activity detected`,
                  metadata: {
                    ...event.metadata,
                    telemetrySource: 'frontend_batch',
                    batchId: batchMetadata?.clientTimestamp
                  }
                }
              });
            }
            results[eventType] = { success: true, processed: events.length };
            break;
            
          case 'security_incident':
            // Process security incident events directly
            for (const event of events) {
              await prisma.security_alerts.create({
                data: {
                  user_id: null, // Use null for all telemetry events to avoid foreign key issues
                  type: 'security_incident',
                  severity: event.severity || 'critical',
                  title: 'Security Incident - Batch',
                  message: `Security incident detected`,
                  metadata: {
                    ...event.metadata,
                    telemetrySource: 'frontend_batch',
                    batchId: batchMetadata?.clientTimestamp
                  }
                }
              });
            }
            results[eventType] = { success: true, processed: events.length };
            break;
            
          default:
            console.warn(`[Security Telemetry] Unknown event type: ${eventType}`);
            results[eventType] = { success: false, error: 'Unknown event type' };
        }
      } catch (error) {
        console.error(`[Security Telemetry] Error processing ${eventType} batch:`, error);
        results[eventType] = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    const totalProcessed = Object.values(results).reduce((sum: number, result: any) => 
      sum + (result.processed || 0), 0
    );
    const totalAlertsCreated = Object.values(results).reduce((sum: number, result: any) => 
      sum + (result.alertsCreated || 0), 0
    );

    res.json({
      success: true,
      totalProcessed,
      totalAlertsCreated,
      results,
      batchMetadata: {
        ...batchMetadata,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Security Telemetry] Error processing mixed batch:', error);
    res.status(500).json({ error: 'Failed to process security telemetry batch' });
  }
});

export default router;
